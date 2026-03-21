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
  error?: string;
  failedAtStage?: string;
}

const activePipelines = new Map<string, ActivePipeline>();
const activeWatchers = new Map<string, NodeJS.Timeout>();
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
  topic: string,
  initialStage: PipelineStage = 'planning'
): void {
  const pipeline: ActivePipeline = {
    channelSlug,
    productionId,
    topic,
    stage: initialStage,
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
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

export function startPipelineWatcher(channelSlug: string, productionId: string): void {
  // Clear any existing watcher for this channel before starting a new one
  const existingInterval = activeWatchers.get(channelSlug);
  if (existingInterval !== undefined) {
    clearInterval(existingInterval);
    activeWatchers.delete(channelSlug);
  }

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
      activeWatchers.delete(channelSlug);
      return;
    }

    if (await fileExists(statusPath)) {
      const status = await readJsonFile<PipelineStatus>(statusPath);
      const stageChanged = status.stage !== pipeline.stage;
      const errorChanged = status.error !== pipeline.error;

      if (stageChanged || errorChanged) {
        pipeline.stage = status.stage;
        pipeline.updatedAt = new Date();
        if (status.error) { pipeline.error = status.error; } else { delete pipeline.error; }
        if (status.failedAtStage) { pipeline.failedAtStage = status.failedAtStage; } else { delete pipeline.failedAtStage; }
        broadcast({
          type: 'stage_change',
          data: {
            channelSlug,
            productionId,
            stage: status.stage,
            error: status.error,
            failedAtStage: status.failedAtStage,
            updatedAt: pipeline.updatedAt,
          },
        });
      }

      if (status.stage === 'complete' || status.stage === 'failed' || status.stage === 'rejected') {
        clearInterval(interval);
        activeWatchers.delete(channelSlug);
        removePipeline(channelSlug);
      }
    }
  }, 2000);

  activeWatchers.set(channelSlug, interval);
}
