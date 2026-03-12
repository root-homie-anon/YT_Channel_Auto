import { Router, Request, Response } from 'express';
import { readdirSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readJsonFile } from '../../utils/file-helpers.js';
import { PipelineStatus } from '../../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

const router = Router();

router.get('/:slug/history', async (req: Request, res: Response) => {
  try {
    const outputDir = join(PROJECT_ROOT, 'projects', req.params.slug as string, 'output');
    if (!existsSync(outputDir)) {
      res.json([]);
      return;
    }

    const dirs = readdirSync(outputDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse();

    const runs = [];
    for (const productionId of dirs) {
      const statusPath = join(outputDir, productionId, 'pipeline-status.json');
      if (existsSync(statusPath)) {
        const status = await readJsonFile<PipelineStatus>(statusPath);
        const planPath = join(outputDir, productionId, 'content-plan.json');
        let topic = '';
        if (existsSync(planPath)) {
          const plan = await readJsonFile<{ topic: string }>(planPath);
          topic = plan.topic;
        }
        runs.push({ productionId, topic, ...status });
      }
    }

    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:slug/history/:productionId', async (req: Request, res: Response) => {
  try {
    const runDir = join(
      PROJECT_ROOT,
      'projects',
      req.params.slug as string,
      'output',
      req.params.productionId as string
    );
    if (!existsSync(runDir)) {
      res.status(404).json({ error: 'Production run not found' });
      return;
    }

    const files = ['pipeline-status.json', 'content-plan.json', 'script-output.json', 'asset-manifest.json', 'compilation-result.json', 'publish-result.json'];
    const result: Record<string, unknown> = { productionId: req.params.productionId };

    for (const file of files) {
      const filePath = join(runDir, file);
      if (existsSync(filePath)) {
        const key = file.replace('.json', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        result[key] = await readJsonFile(filePath);
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
