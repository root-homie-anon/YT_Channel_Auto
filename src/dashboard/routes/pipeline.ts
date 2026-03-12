import { Router, Request, Response } from 'express';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadChannelConfig } from '../../utils/config-loader.js';
import { generateProductionId, readJsonFile } from '../../utils/file-helpers.js';
import { runPipeline } from '../../services/pipeline.js';
import { ScriptOutput } from '../../types/index.js';
import { buildContentPlan, buildPlaceholderScript } from '../content-planner.js';
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

router.post('/:slug/produce', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const { topic, contentPlan, scriptOutput } = req.body;

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
    const productionId = generateProductionId();

    const plan = contentPlan || buildContentPlan(topic, config);
    const script = scriptOutput || buildPlaceholderScript(topic, config);

    registerPipeline(slug, productionId, topic);
    startPipelineWatcher(slug, productionId);

    // Run pipeline in background — don't await
    runPipeline(slug, plan, script)
      .catch((err) => {
        console.error(`Pipeline failed for ${slug}:`, (err as Error).message);
      })
      .finally(() => {
        removePipeline(slug);
      });

    res.status(202).json({ productionId, status: 'started' });
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

    runPipeline(slug, plan, scriptOutput)
      .catch((err) => {
        console.error(`Pipeline failed for ${slug}:`, (err as Error).message);
      })
      .finally(() => {
        removePipeline(slug);
      });

    res.status(202).json({ productionId, status: 'pipeline_started' });
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

export default router;
