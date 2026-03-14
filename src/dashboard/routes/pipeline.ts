import { Router, Request, Response } from 'express';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadChannelConfig } from '../../utils/config-loader.js';
import { generateProductionId, readJsonFile, writeJsonFile } from '../../utils/file-helpers.js';
import { ensureDir } from '../../utils/file-helpers.js';
import { runPipeline, resumePipeline } from '../../services/pipeline.js';
import { loadRotationState } from '../../services/rotation-state.js';
import { approveProduction, rejectProduction, listPendingApprovals, listReadyProductions, getPendingApproval } from '../../services/approval-service.js';
import { ScriptOutput, PipelineStatus } from '../../types/index.js';
import { buildContentPlan } from '../content-planner.js';
import { setupProduction, saveScriptOutput } from '../../production/produce.js';
import {
  registerPipeline,
  startPipelineWatcher,
  getActivePipelines,
  getActivePipeline,
  removePipeline,
  addSseClient,
} from '../state/pipeline-tracker.js';
import { getConcurrencyStatus, getQueueSnapshot } from '../../services/production-queue.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

const router = Router();

// Produce: sets up a production and waits for @script-writer to generate content.
// If scriptOutput is provided (from Claude Code), starts pipeline immediately.
// Otherwise, creates a pending production that Claude Code picks up.
router.post('/:slug/produce', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const {
      topic, scriptOutput, durationMinutes, segmentCount,
      // Accept both singular (from dashboard UI) and plural (from agent API)
      imagePrompts: imagePromptsArr, imagePrompt: imagePromptSingle,
      musicPrompt: musicPromptBody,
      animationPrompts: animationPromptsArr, animationPrompt: animationPromptSingle,
      lastEnvironment, lastAtmosphere,
      // Optional metadata — if provided, used instead of stub defaults
      title: metaTitle, description: metaDescription, tags: metaTags, hashtags: metaHashtags,
    } = req.body;

    if (!topic) {
      res.status(400).json({ error: 'topic is required' });
      return;
    }

    const configPath = join(PROJECT_ROOT, 'projects', slug, 'config.json');
    if (!existsSync(configPath)) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    if (getActivePipeline(slug)) {
      res.status(409).json({ error: 'Pipeline already running for this channel' });
      return;
    }

    const config = await loadChannelConfig(slug);
    const isMusicOnly = config.channel.format === 'music-only';

    // Normalize prompts: accept singular string or array
    const imagePrompts: string[] = imagePromptsArr ?? (imagePromptSingle ? [imagePromptSingle] : []);
    const animationPrompts: string[] = animationPromptsArr ?? (animationPromptSingle ? [animationPromptSingle] : []);
    // Music prompt: request body → channel config (baked in) → empty
    const musicPrompt: string = musicPromptBody ?? config.musicPrompt ?? '';

    const productionId = generateProductionId();
    const outputDir = join(PROJECT_ROOT, 'projects', slug, 'output', productionId);
    await ensureDir(outputDir);

    // Music-only: if prompts provided, start pipeline immediately.
    // If no prompts, create pending production for @content-strategist to build prompts from frameworks.
    const hasPrompts = imagePrompts.length > 0 && animationPrompts.length > 0 && !!musicPrompt;

    const plan = isMusicOnly && hasPrompts
      ? buildContentPlan(topic, config, { durationMinutes, segmentCount, imagePrompts, musicPrompt, animationPrompts, lastEnvironment, lastAtmosphere })
      : buildContentPlan(topic, config);
    await writeJsonFile(join(outputDir, 'content-plan.json'), plan);

    // Resolve script output:
    // - If scriptOutput provided directly → use it
    // - If music-only with prompts → create stub with optional metadata
    // - Otherwise → null (pending for agent)
    let resolvedScript: ScriptOutput | null = null;
    if (scriptOutput) {
      resolvedScript = scriptOutput;
    } else if (isMusicOnly && hasPrompts) {
      resolvedScript = {
        title: metaTitle ?? topic,
        description: metaDescription ?? '',
        tags: metaTags ?? [],
        hashtags: metaHashtags ?? [],
        script: [{ sectionName: 'main', narration: '', imageCue: topic, durationSeconds: 0 }],
      };
    }

    if (resolvedScript) {
      await saveScriptOutput(outputDir, resolvedScript);

      registerPipeline(slug, productionId, topic);
      startPipelineWatcher(slug, productionId);

      runPipeline(slug, plan, resolvedScript, productionId)
        .then((ctx) => {
          // Only remove pipeline if it completed (not paused at checkpoint)
          const stage = ctx.publishResult ? 'complete' : 'checkpoint';
          if (stage === 'complete') removePipeline(slug);
        })
        .catch((err) => {
          console.error(`Pipeline failed for ${slug}:`, (err as Error).message);
          removePipeline(slug);
        });

      res.status(202).json({ productionId, status: 'pipeline_started' });
    } else {
      // No script — create pending production for Claude Code to pick up
      await writeJsonFile(join(outputDir, 'pipeline-status.json'), {
        stage: 'pending_script',
        startedAt: new Date(),
        updatedAt: new Date(),
        topic,
      });

      res.status(202).json({ productionId, status: 'pending_script', topic });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Setup production — returns frameworks for Claude Code to generate content
router.post('/:slug/setup', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const { topic } = req.body;

    const setup = await setupProduction(slug, topic);
    res.json({
      productionId: setup.productionId,
      outputDir: setup.outputDir,
      topic: setup.topic,
      contentPlan: setup.contentPlan,
      frameworks: setup.frameworks,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Save script output and start pipeline for an existing production.
// For music-only: also accepts imagePrompts, animationPrompts to build a full content plan.
router.post('/:slug/run/:productionId', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const productionId = req.params.productionId as string;
    const {
      scriptOutput,
      imagePrompts, animationPrompts, musicPrompt: musicPromptBody,
      durationMinutes, segmentCount, lastEnvironment, lastAtmosphere,
    } = req.body;

    if (!scriptOutput?.title || !scriptOutput?.script?.length) {
      res.status(400).json({ error: 'scriptOutput with title and script sections is required' });
      return;
    }

    if (getActivePipeline(slug)) {
      res.status(409).json({ error: 'Pipeline already running for this channel' });
      return;
    }

    const outputDir = join(PROJECT_ROOT, 'projects', slug, 'output', productionId);
    await saveScriptOutput(outputDir, scriptOutput);

    const config = await loadChannelConfig(slug);
    const isMusicOnly = config.channel.format === 'music-only';

    // Rebuild content plan — for music-only, include prompt arrays if provided
    const savedPlan = await readJsonFile<{ topic: string }>(join(outputDir, 'content-plan.json'));
    const musicPrompt = musicPromptBody ?? config.musicPrompt ?? '';
    const plan = isMusicOnly && imagePrompts?.length
      ? buildContentPlan(savedPlan.topic, config, {
          durationMinutes, segmentCount, imagePrompts, musicPrompt,
          animationPrompts: animationPrompts ?? [], lastEnvironment, lastAtmosphere,
        })
      : buildContentPlan(savedPlan.topic, config);
    await writeJsonFile(join(outputDir, 'content-plan.json'), plan);

    registerPipeline(slug, productionId, savedPlan.topic);
    startPipelineWatcher(slug, productionId);

    runPipeline(slug, plan, scriptOutput, productionId)
      .then((ctx) => {
        if (ctx.publishResult) removePipeline(slug);
      })
      .catch((err) => {
        console.error(`Pipeline failed for ${slug}:`, (err as Error).message);
        removePipeline(slug);
      });

    res.status(202).json({ productionId, status: 'pipeline_started' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List pending productions awaiting script generation
router.get('/pending', async (_req: Request, res: Response) => {
  try {
    const { readdirSync } = await import('fs');
    const projectsDir = join(PROJECT_ROOT, 'projects');
    const pending: Array<{ slug: string; productionId: string; topic: string; createdAt: string }> = [];

    const channelDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('ch-'));

    for (const dir of channelDirs) {
      const outputDir = join(projectsDir, dir.name, 'output');
      if (!existsSync(outputDir)) continue;

      const runs = readdirSync(outputDir, { withFileTypes: true })
        .filter((d) => d.isDirectory());

      for (const run of runs) {
        const statusPath = join(outputDir, run.name, 'pipeline-status.json');
        if (!existsSync(statusPath)) continue;

        const status = await readJsonFile<{ stage: string; topic?: string; startedAt?: string }>(statusPath);
        if (status.stage === 'pending_script') {
          pending.push({
            slug: dir.name,
            productionId: run.name,
            topic: status.topic ?? 'unknown',
            createdAt: status.startedAt ?? '',
          });
        }
      }
    }

    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/active', (_req: Request, res: Response) => {
  res.json(getActivePipelines());
});

router.get('/active/:slug', (req: Request, res: Response) => {
  const pipeline = getActivePipeline(req.params.slug as string);
  if (!pipeline) {
    res.status(404).json({ error: 'No active pipeline for this channel' });
    return;
  }
  res.json(pipeline);
});

router.get('/events', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addSseClient(res);
});

router.get('/:slug/rotation-state', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const channelDir = join(PROJECT_ROOT, 'projects', slug);
    if (!existsSync(join(channelDir, 'config.json'))) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    const state = await loadRotationState(channelDir);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// === Approval Endpoints ===

router.post('/:slug/approve/:productionId', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const productionId = req.params.productionId as string;

    // Check checkpoint type before approving (approval clears it)
    const pending = await getPendingApproval(slug, productionId);
    const checkpointType = pending?.checkpointType;

    await approveProduction(slug, productionId);

    if (checkpointType === 'asset_preview') {
      // Asset approval → resume pipeline to compilation
      registerPipeline(slug, productionId, 'Resuming after asset approval');
      startPipelineWatcher(slug, productionId);

      resumePipeline(slug, productionId)
        .then((ctx) => {
          if (ctx.publishResult) removePipeline(slug);
        })
        .catch((err) => {
          console.error(`Pipeline resume failed for ${slug}:`, (err as Error).message);
          removePipeline(slug);
        });

      res.json({ status: 'approved', productionId, message: 'Pipeline resuming to compilation' });
    } else {
      // Final approval → 'ready' — parked until scheduled
      removePipeline(slug);
      res.json({ status: 'ready', productionId, message: 'Video ready — schedule to publish' });
    }
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post('/:slug/reject/:productionId', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const productionId = req.params.productionId as string;
    const { reason } = req.body ?? {};

    await rejectProduction(slug, productionId, reason);
    removePipeline(slug);

    res.json({ status: 'rejected', productionId });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/approvals/pending', async (_req: Request, res: Response) => {
  try {
    const pending = await listPendingApprovals();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// === Ready & Schedule Endpoints ===

// List all productions in 'ready' state (approved, not yet published)
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const ready = await listReadyProductions();
    res.json(ready);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Schedule a ready production for YouTube upload
// Body: { scheduledTime?: ISO string, privacy?: 'private' | 'unlisted' | 'public' }
// If scheduledTime provided: uploads as private with YouTube scheduled publish
// If no scheduledTime: uploads immediately with given privacy (default 'public')
router.post('/:slug/schedule/:productionId', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const productionId = req.params.productionId as string;
    const { scheduledTime, privacy } = req.body ?? {};

    const outputDir = join(PROJECT_ROOT, 'projects', slug, 'output', productionId);
    const status = await readJsonFile<PipelineStatus>(join(outputDir, 'pipeline-status.json'));

    if (status.stage !== 'ready') {
      res.status(400).json({ error: `Production is at stage "${status.stage}", not "ready"` });
      return;
    }

    const scriptOutput = await readJsonFile<ScriptOutput>(join(outputDir, 'script-output.json'));

    // Set publish parameters on the status file for the pipeline to use
    const publishParams = {
      privacy: scheduledTime ? 'private' : (privacy ?? 'public'),
      scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
    };
    await writeJsonFile(join(outputDir, 'publish-params.json'), publishParams);

    // Advance to publishing and resume pipeline
    status.stage = 'publishing';
    status.updatedAt = new Date();
    await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);

    registerPipeline(slug, productionId, `Publishing: ${scriptOutput.title}`);
    startPipelineWatcher(slug, productionId);

    resumePipeline(slug, productionId)
      .then((ctx) => {
        if (ctx.publishResult) removePipeline(slug);
      })
      .catch((err) => {
        console.error(`Publish failed for ${slug}:`, (err as Error).message);
        removePipeline(slug);
      });

    const msg = scheduledTime
      ? `Scheduled for ${new Date(scheduledTime).toISOString()}`
      : `Publishing now as ${publishParams.privacy}`;
    res.json({ status: 'publishing', productionId, message: msg });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// === System Status ===
router.get('/system-status', (_req: Request, res: Response) => {
  res.json({
    concurrency: getConcurrencyStatus(),
    queue: getQueueSnapshot(),
    activePipelines: getActivePipelines(),
  });
});

// Retry a failed production — resets stage and re-queues
router.post('/:slug/retry/:productionId', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const productionId = req.params.productionId as string;

    const outputDir = join(PROJECT_ROOT, 'projects', slug, 'output', productionId);
    const status = await readJsonFile<PipelineStatus>(join(outputDir, 'pipeline-status.json'));

    if (status.stage !== 'failed' && status.stage !== 'rejected') {
      res.status(400).json({ error: `Cannot retry: stage is "${status.stage}", not "failed" or "rejected"` });
      return;
    }

    if (getActivePipeline(slug)) {
      res.status(409).json({ error: 'Pipeline already running for this channel' });
      return;
    }

    const contentPlan = await readJsonFile<{ topic: string }>(join(outputDir, 'content-plan.json'));

    // Reset status to allow resume
    status.stage = 'asset_generation';
    delete status.error;
    status.updatedAt = new Date();
    await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);

    registerPipeline(slug, productionId, contentPlan.topic);
    startPipelineWatcher(slug, productionId);

    resumePipeline(slug, productionId)
      .then((ctx) => {
        if (ctx.publishResult) removePipeline(slug);
      })
      .catch((err) => {
        console.error(`Retry failed for ${slug}:`, (err as Error).message);
        removePipeline(slug);
      });

    res.json({ status: 'retrying', productionId, message: 'Pipeline retrying — existing assets will be reused' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
