import { Router, Request, Response } from 'express';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadChannelConfig } from '../../utils/config-loader.js';
import { generateProductionId, readJsonFile, writeJsonFile } from '../../utils/file-helpers.js';
import { ensureDir } from '../../utils/file-helpers.js';
import { runPipeline, resumePipeline } from '../../services/pipeline.js';
import { loadRotationState } from '../../services/rotation-state.js';
import { approveProduction, rejectProduction, listPendingApprovals } from '../../services/approval-service.js';
import { ScriptOutput } from '../../types/index.js';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

const router = Router();

// Produce: sets up a production and waits for @script-writer to generate content.
// If scriptOutput is provided (from Claude Code), starts pipeline immediately.
// Otherwise, creates a pending production that Claude Code picks up.
router.post('/:slug/produce', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const { topic, scriptOutput, durationMinutes, segmentCount, imagePrompts, musicPrompt, animationPrompts, lastEnvironment, lastAtmosphere } = req.body;

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

    // Music-only requires all prompt arrays from the agent
    if (isMusicOnly) {
      if (!imagePrompts?.length || !musicPrompt || !animationPrompts?.length) {
        res.status(400).json({ error: 'Music-only requires imagePrompts[], musicPrompt, and animationPrompts[]' });
        return;
      }
    }

    const productionId = generateProductionId();
    const outputDir = join(PROJECT_ROOT, 'projects', slug, 'output', productionId);
    await ensureDir(outputDir);

    const plan = isMusicOnly
      ? buildContentPlan(topic, config, { durationMinutes, segmentCount, imagePrompts, musicPrompt, animationPrompts, lastEnvironment, lastAtmosphere })
      : buildContentPlan(topic, config);
    await writeJsonFile(join(outputDir, 'content-plan.json'), plan);

    // Music-only channels don't need a script — auto-start with stub
    const resolvedScript: ScriptOutput = scriptOutput ?? (isMusicOnly ? {
      title: topic,
      description: topic,
      tags: [],
      hashtags: [],
      script: [{ sectionName: 'main', narration: '', imageCue: topic }],
    } : null);

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

// Save script output and start pipeline
router.post('/:slug/run/:productionId', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const productionId = req.params.productionId as string;
    const { scriptOutput } = req.body as { scriptOutput: ScriptOutput };

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

    const contentPlan = await readJsonFile<{ topic: string }>(join(outputDir, 'content-plan.json'));

    const config = await loadChannelConfig(slug);
    const plan = buildContentPlan(contentPlan.topic, config);

    registerPipeline(slug, productionId, contentPlan.topic);
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

    await approveProduction(slug, productionId);

    // Resume pipeline in background
    registerPipeline(slug, productionId, 'Resuming after approval');
    startPipelineWatcher(slug, productionId);

    resumePipeline(slug, productionId)
      .then((ctx) => {
        if (ctx.publishResult) removePipeline(slug);
      })
      .catch((err) => {
        console.error(`Pipeline resume failed for ${slug}:`, (err as Error).message);
        removePipeline(slug);
      });

    res.json({ status: 'approved', productionId, message: 'Pipeline resuming' });
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

export default router;
