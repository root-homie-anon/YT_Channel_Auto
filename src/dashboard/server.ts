import express, { Request, Response, NextFunction } from 'express';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { config } from 'dotenv';
import { basicAuth, checkAuthConfig } from './middleware/auth.js';
import { validateRequiredEnv } from '../utils/env.js';
import channelRoutes from './routes/channels.js';
import queueRoutes from './routes/queue.js';
import pipelineRoutes from './routes/pipeline.js';
import historyRoutes from './routes/history.js';
import oauthRoutes from './routes/oauth.js';
import { PipelineStage } from '../types/index.js';
import { startTelegramApprovalListener } from '../services/telegram-service.js';
import {
  listPendingApprovals,
  approveProduction,
  rejectProduction,
} from '../services/approval-service.js';
import { resumePipeline } from '../services/pipeline.js';
import { registerPipeline, startPipelineWatcher, removePipeline, getActivePipeline } from './state/pipeline-tracker.js';
import {
  findStalledProductions,
  markStalledAsFailed,
  findActiveProductions,
  restoreConcurrencyState,
} from '../services/production-queue.js';

const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

validateRequiredEnv();
checkAuthConfig();

// --- In-memory rate limiter: 10 requests per minute per IP on mutating endpoints ---
const _rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const entry = _rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    _rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests — try again in a minute' });
    return;
  }

  entry.count++;
  next();
}

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT ?? '3000', 10);

app.use(express.json());
app.use(basicAuth);
app.use(express.static(resolve(__dirname, '..', 'public')));

// Apply rate limiting to mutating pipeline endpoints before mounting routes
app.post('/api/channels/:slug/produce', rateLimitMiddleware);
app.post('/api/channels/:slug/approve/:productionId', rateLimitMiddleware);
app.post('/api/channels/:slug/schedule/:productionId', rateLimitMiddleware);
app.post('/api/channels/:slug/retry/:productionId', rateLimitMiddleware);

// API routes
app.use('/api/channels', channelRoutes);
app.use('/api/channels', queueRoutes);
app.use('/api/channels', historyRoutes);
app.use('/api/pipelines', pipelineRoutes);

app.use('/api/channels', oauthRoutes);

// Produce endpoint lives under channels but needs pipeline logic
app.use('/api/channels', pipelineRoutes);

app.listen(PORT, '127.0.0.1', async () => {
  console.log(`Dashboard running at http://127.0.0.1:${PORT}`);

  // Recover pending approvals and register them in the tracker
  try {
    const pending = await listPendingApprovals();
    for (const p of pending) {
      registerPipeline(p.channelSlug, p.productionId, `Awaiting ${p.checkpointType}`);
      startPipelineWatcher(p.channelSlug, p.productionId);
    }
    if (pending.length > 0) {
      console.log(`Recovered ${pending.length} pending approval(s)`);
    }
  } catch (err) {
    console.error('Failed to recover pending approvals:', (err as Error).message);
  }

  // Recover active (non-stalled) pipelines into the tracker
  try {
    const projectsDir = resolve(PROJECT_ROOT, 'projects');
    const activeProds = await findActiveProductions(projectsDir);
    for (const a of activeProds) {
      if (!getActivePipeline(a.channelSlug)) {
        registerPipeline(a.channelSlug, a.productionId, a.topic, a.stage as PipelineStage);
        startPipelineWatcher(a.channelSlug, a.productionId);
      }
    }
    if (activeProds.length > 0) {
      console.log(`Recovered ${activeProds.length} active pipeline(s)`);
    }
    // Restore in-memory concurrency counters to match re-registered pipelines
    await restoreConcurrencyState(projectsDir);
  } catch (err) {
    console.error('Failed to recover active pipelines:', (err as Error).message);
  }

  // Detect and handle stalled pipelines (crashed during active processing)
  try {
    const projectsDir = resolve(PROJECT_ROOT, 'projects');
    const stalled = await findStalledProductions(projectsDir);
    for (const s of stalled) {
      console.log(`Stalled production detected: ${s.channelSlug}/${s.productionId} at stage "${s.stage}" (last updated: ${s.lastUpdated.toISOString()})`);
      // Mark as failed with recovery info — watcher or manual retry can pick these up
      await markStalledAsFailed(s.channelSlug, s.productionId, `Stalled at ${s.stage} since ${s.lastUpdated.toISOString()}`);
    }
    if (stalled.length > 0) {
      console.log(`Marked ${stalled.length} stalled production(s) as failed for recovery`);
    }
  } catch (err) {
    console.error('Failed to scan for stalled productions:', (err as Error).message);
  }

  // Start Telegram background listener for approvals
  const pendingMessageMap = new Map<number, { slug: string; productionId: string; checkpointType: 'asset_preview' | 'final_approval' }>();

  const refreshPendingMap = async (): Promise<void> => {
    pendingMessageMap.clear();
    const pending = await listPendingApprovals();
    for (const p of pending) {
      const entry = {
        slug: p.channelSlug,
        productionId: p.productionId,
        checkpointType: p.checkpointType,
      };
      for (const msgId of p.telegramMessageIds) {
        pendingMessageMap.set(msgId, entry);
      }
    }
  };

  await refreshPendingMap();

  startTelegramApprovalListener(
    async (messageId: number) => {
      const entry = pendingMessageMap.get(messageId);
      if (!entry) return;

      // Determine checkpoint type before approving (approval clears the checkpoint)
      const checkpointType = entry.checkpointType;
      await approveProduction(entry.slug, entry.productionId);

      if (checkpointType === 'asset_preview') {
        // Asset approval → resume pipeline to compilation
        registerPipeline(entry.slug, entry.productionId, 'Resuming after asset approval');
        startPipelineWatcher(entry.slug, entry.productionId);

        resumePipeline(entry.slug, entry.productionId)
          .then((ctx) => {
            if (ctx.publishResult) removePipeline(entry.slug);
          })
          .catch((err) => {
            console.error(`Pipeline resume failed: ${(err as Error).message}`);
            removePipeline(entry.slug);
          });
      } else {
        // Final approval → video is 'ready', parked until scheduled
        removePipeline(entry.slug);
        console.log(`Production ${entry.productionId} is ready — schedule via dashboard to publish`);
      }

      await refreshPendingMap();
    },
    async (messageId: number, reason?: string) => {
      const entry = pendingMessageMap.get(messageId);
      if (!entry) return;

      await rejectProduction(entry.slug, entry.productionId, reason);
      removePipeline(entry.slug);
      await refreshPendingMap();
    },
    () => Array.from(pendingMessageMap.keys())
  );
});
