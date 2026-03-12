import { Router, Request, Response } from 'express';
import { readdirSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readJsonFile } from '../../utils/file-helpers.js';
import { ChannelConfig } from '../../types/index.js';
import { createChannel, toSlug, ChannelInputs } from '../../utils/channel-factory.js';
import { getActivePipeline } from '../state/pipeline-tracker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const PROJECTS_DIR = join(PROJECT_ROOT, 'projects');

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const dirs = readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('ch-'))
      .map((d) => d.name);

    const channels = [];
    for (const slug of dirs) {
      const configPath = join(PROJECTS_DIR, slug, 'config.json');
      if (existsSync(configPath)) {
        const config = await readJsonFile<ChannelConfig>(configPath);
        const active = getActivePipeline(slug);
        channels.push({
          ...config.channel,
          status: active ? active.stage : 'idle',
          currentTopic: active?.topic ?? null,
        });
      }
    }

    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const configPath = join(PROJECTS_DIR, slug, 'config.json');
    if (!existsSync(configPath)) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    const config = await readJsonFile<ChannelConfig>(configPath);
    const active = getActivePipeline(slug);

    // Build stats
    const outputDir = join(PROJECTS_DIR, slug, 'output');
    let totalVideos = 0;
    let lastProduction: string | null = null;
    let completedVideos = 0;
    let failedVideos = 0;
    if (existsSync(outputDir)) {
      const runs = readdirSync(outputDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      totalVideos = runs.length;
      if (runs.length > 0) {
        lastProduction = runs[runs.length - 1];
        for (const run of runs) {
          const statusPath = join(outputDir, run, 'pipeline-status.json');
          if (existsSync(statusPath)) {
            const status = await readJsonFile<{ stage: string }>(statusPath);
            if (status.stage === 'complete') completedVideos++;
            if (status.stage === 'failed') failedVideos++;
          }
        }
      }
    }

    const queuePath = join(PROJECTS_DIR, slug, 'queue.json');
    let queuedCount = 0;
    if (existsSync(queuePath)) {
      const queue = await readJsonFile<{ items: { status: string }[] }>(queuePath);
      queuedCount = queue.items.filter((i) => i.status === 'queued').length;
    }

    const oauthPath = join(PROJECTS_DIR, slug, '.youtube-oauth.json');
    const hasOAuth = existsSync(oauthPath);
    const hasVoiceId = config.credentials.elevenLabsVoiceId !== '' && config.credentials.elevenLabsVoiceId !== 'tbd';

    res.json({
      config,
      status: active ? active.stage : 'idle',
      currentTopic: active?.topic ?? null,
      stats: {
        totalVideos,
        completedVideos,
        failedVideos,
        lastProduction,
        queuedCount,
        hasOAuth,
        hasVoiceId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, niche, format, elevenLabsVoiceId, musicOnly } = req.body;

    if (!name || !niche || !format) {
      res.status(400).json({ error: 'name, niche, and format are required' });
      return;
    }

    const inputs: ChannelInputs = {
      name,
      slug: `ch-${toSlug(name)}`,
      format,
      niche,
      elevenLabsVoiceId: elevenLabsVoiceId || 'tbd',
      musicOnly: musicOnly || { defaultDurationHours: null, defaultSegmentCount: null },
    };

    const channelDir = join(PROJECTS_DIR, inputs.slug);
    if (existsSync(channelDir)) {
      res.status(409).json({ error: `Channel "${inputs.slug}" already exists` });
      return;
    }

    const config = createChannel(inputs);
    res.status(201).json({ config, slug: inputs.slug });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
