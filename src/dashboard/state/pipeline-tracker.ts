import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { Response } from 'express';
import { PipelineStage, PipelineStatus } from '../../types/index.js';
import { readJsonFile, fileExists } from '../../utils/file-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

export interface ActivePipeline {
  channelSlug: string;
  productionId: string;
  topic: string;
  stage: PipelineStage;
  startedAt: Date;
  updatedAt: Date;
}

const activePipelines = new Map<string, ActivePipeline>();
const sseClients: Response[] = [];

export function getActivePipelines(): ActivePipeline[] {
  return Array.from(activePipelines.values());
}

export function getActivePipeline(channelSlug: string): ActivePipeline | undefined {
  return activePipelines.get(channelSlug);
}

export function registerPipeline(
  channelSlug: string,
  productionId: string,
  topic: string
): void {
  const pipeline: ActivePipeline = {
    channelSlug,
    productionId,
    topic,
    stage: 'planning',
    startedAt: new Date(),
    updatedAt: new Date(),
  };
  activePipelines.set(channelSlug, pipeline);
  broadcast({ type: 'pipeline_started', data: pipeline });
}

export function removePipeline(channelSlug: string): void {
  activePipelines.delete(channelSlug);
  broadcast({ type: 'pipeline_removed', data: { channelSlug } });
}

export function addSseClient(res: Response): void {
  sseClients.push(res);
  res.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) sseClients.splice(index, 1);
  });
}

function broadcast(event: { type: string; data: unknown }): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

export function startPipelineWatcher(channelSlug: string, productionId: string): void {
  const statusPath = join(
    PROJECT_ROOT,
    'projects',
    channelSlug,
    'output',
    productionId,
    'pipeline-status.json'
  );

  const interval = setInterval(async () => {
    const pipeline = activePipelines.get(channelSlug);
    if (!pipeline) {
      clearInterval(interval);
      return;
    }

    if (await fileExists(statusPath)) {
      const status = await readJsonFile<PipelineStatus>(statusPath);
      if (status.stage !== pipeline.stage) {
        pipeline.stage = status.stage;
        pipeline.updatedAt = new Date();
        broadcast({
          type: 'stage_change',
          data: {
            channelSlug,
            productionId,
            stage: status.stage,
            updatedAt: pipeline.updatedAt,
          },
        });
      }

      if (status.stage === 'complete' || status.stage === 'failed' || status.stage === 'rejected') {
        clearInterval(interval);
        removePipeline(channelSlug);
      }
    }
  }, 2000);
}
