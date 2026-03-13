import express from 'express';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { config } from 'dotenv';
import { basicAuth } from './middleware/auth.js';
import channelRoutes from './routes/channels.js';
import queueRoutes from './routes/queue.js';
import pipelineRoutes from './routes/pipeline.js';
import historyRoutes from './routes/history.js';
import oauthRoutes from './routes/oauth.js';
import { startTelegramApprovalListener } from '../services/telegram-service.js';
import {
  listPendingApprovals,
  approveProduction,
  rejectProduction,
} from '../services/approval-service.js';
import { resumePipeline } from '../services/pipeline.js';
import { registerPipeline, startPipelineWatcher, removePipeline } from './state/pipeline-tracker.js';

const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT ?? '3000', 10);

app.use(express.json());
app.use(basicAuth);
app.use(express.static(resolve(__dirname, '..', 'public')));

// API routes
app.use('/api/channels', channelRoutes);
app.use('/api/channels', queueRoutes);
app.use('/api/channels', historyRoutes);
app.use('/api/pipelines', pipelineRoutes);

app.use('/api/channels', oauthRoutes);

// Produce endpoint lives under channels but needs pipeline logic
app.use('/api/channels', pipelineRoutes);

app.listen(PORT, async () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);

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

  // Start Telegram background listener for approvals
  const pendingMessageMap = new Map<number, { slug: string; productionId: string }>();

  const refreshPendingMap = async (): Promise<void> => {
    pendingMessageMap.clear();
    const pending = await listPendingApprovals();
    for (const p of pending) {
      pendingMessageMap.set(p.telegramMessageId, {
        slug: p.channelSlug,
        productionId: p.productionId,
      });
    }
  };

  await refreshPendingMap();

  startTelegramApprovalListener(
    async (messageId: number) => {
      const entry = pendingMessageMap.get(messageId);
      if (!entry) return;

      await approveProduction(entry.slug, entry.productionId);
      registerPipeline(entry.slug, entry.productionId, 'Resuming after Telegram approval');
      startPipelineWatcher(entry.slug, entry.productionId);

      resumePipeline(entry.slug, entry.productionId)
        .then((ctx) => {
          if (ctx.publishResult) removePipeline(entry.slug);
        })
        .catch((err) => {
          console.error(`Pipeline resume failed: ${(err as Error).message}`);
          removePipeline(entry.slug);
        });

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
