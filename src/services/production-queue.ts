import { join } from 'path';
import { readdirSync, existsSync } from 'fs';
import { stat } from 'fs/promises';

import { PipelineStatus } from '../types/index.js';
import { readJsonFile, writeJsonFile, fileExists } from '../utils/file-helpers.js';
import { getChannelDir } from '../utils/config-loader.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('production-queue');

// === Concurrency Limits ===
const MAX_CONCURRENT_PIPELINES = 2;
const MAX_CONCURRENT_COMPILATIONS = 1;

// === State ===
let activePipelineCount = 0;
let activeCompilationCount = 0;

interface QueuedProduction {
  channelSlug: string;
  productionId: string;
  topic: string;
  priority: number; // lower = higher priority
  queuedAt: Date;
  stage: 'pending' | 'stalled_resume';
}

const productionQueue: QueuedProduction[] = [];

// === Concurrency Gates ===

export function acquirePipelineSlot(): boolean {
  if (activePipelineCount >= MAX_CONCURRENT_PIPELINES) {
    return false;
  }
  activePipelineCount++;
  log.info(`Pipeline slot acquired (${activePipelineCount}/${MAX_CONCURRENT_PIPELINES})`);
  return true;
}

export function releasePipelineSlot(): void {
  activePipelineCount = Math.max(0, activePipelineCount - 1);
  log.info(`Pipeline slot released (${activePipelineCount}/${MAX_CONCURRENT_PIPELINES})`);
}

export function acquireCompilationSlot(): boolean {
  if (activeCompilationCount >= MAX_CONCURRENT_COMPILATIONS) {
    return false;
  }
  activeCompilationCount++;
  log.info(`Compilation slot acquired (${activeCompilationCount}/${MAX_CONCURRENT_COMPILATIONS})`);
  return true;
}

export function releaseCompilationSlot(): void {
  activeCompilationCount = Math.max(0, activeCompilationCount - 1);
  log.info(`Compilation slot released (${activeCompilationCount}/${MAX_CONCURRENT_COMPILATIONS})`);
}

export async function waitForCompilationSlot(pollIntervalMs: number = 5000): Promise<void> {
  while (!acquireCompilationSlot()) {
    log.info('Waiting for compilation slot...');
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

// === Queue Management ===

export function enqueue(production: Omit<QueuedProduction, 'queuedAt' | 'priority'>): void {
  const existing = productionQueue.find(
    (p) => p.channelSlug === production.channelSlug && p.productionId === production.productionId
  );
  if (existing) return;

  // Stalled resumes get higher priority (lower number)
  const priority = production.stage === 'stalled_resume' ? 0 : 1;
  productionQueue.push({ ...production, priority, queuedAt: new Date() });
  productionQueue.sort((a, b) => a.priority - b.priority || a.queuedAt.getTime() - b.queuedAt.getTime());
  log.info(`Queued: ${production.channelSlug}/${production.productionId} (${production.stage})`);
}

export function dequeue(): QueuedProduction | undefined {
  return productionQueue.shift();
}

export function getQueueLength(): number {
  return productionQueue.length;
}

export function getQueueSnapshot(): QueuedProduction[] {
  return [...productionQueue];
}

export function getConcurrencyStatus(): {
  activePipelines: number;
  maxPipelines: number;
  activeCompilations: number;
  maxCompilations: number;
  queueLength: number;
} {
  return {
    activePipelines: activePipelineCount,
    maxPipelines: MAX_CONCURRENT_PIPELINES,
    activeCompilations: activeCompilationCount,
    maxCompilations: MAX_CONCURRENT_COMPILATIONS,
    queueLength: productionQueue.length,
  };
}

// === Stalled Pipeline Detection ===

// Stages that indicate a pipeline was running and may have crashed
const ACTIVE_STAGES: string[] = [
  'pending_script',
  'planning',
  'scripting',
  'asset_generation',
  'asset_preview',
  'compilation',
  'metadata_generation',
  'approval',
  'publishing',
];

// If a pipeline has been in an active stage for longer than this, it's stalled
const STALL_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface StalledProduction {
  channelSlug: string;
  productionId: string;
  stage: string;
  topic: string;
  stalledAt: Date;
  lastUpdated: Date;
}

/**
 * Scan all productions and find ones stuck in active stages.
 * These are productions that were running when the process crashed.
 */
export async function findStalledProductions(projectsDir: string): Promise<StalledProduction[]> {
  const stalled: StalledProduction[] = [];

  let channelDirs: string[];
  try {
    channelDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('ch-'))
      .map((d) => d.name);
  } catch {
    return stalled;
  }

  for (const slug of channelDirs) {
    const outputBase = join(projectsDir, slug, 'output');
    if (!existsSync(outputBase)) continue;

    const runs = readdirSync(outputBase, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const run of runs) {
      const statusPath = join(outputBase, run, 'pipeline-status.json');
      if (!existsSync(statusPath)) continue;

      try {
        const status = await readJsonFile<PipelineStatus>(statusPath);
        if (!ACTIVE_STAGES.includes(status.stage)) continue;

        const updatedAt = new Date(status.updatedAt);
        const elapsed = Date.now() - updatedAt.getTime();

        if (elapsed > STALL_THRESHOLD_MS) {
          // Read topic from content plan or script output
          let topic = 'unknown';
          try {
            const plan = await readJsonFile<{ topic: string }>(join(outputBase, run, 'content-plan.json'));
            topic = plan.topic;
          } catch {
            try {
              const script = await readJsonFile<{ title: string }>(join(outputBase, run, 'script-output.json'));
              topic = script.title;
            } catch { /* use default */ }
          }

          stalled.push({
            channelSlug: slug,
            productionId: run,
            stage: status.stage,
            topic,
            stalledAt: new Date(),
            lastUpdated: updatedAt,
          });
        }
      } catch {
        // Skip corrupt status files
      }
    }
  }

  return stalled;
}

/**
 * Mark a stalled production as failed so it can be retried or cleaned up.
 */
export async function markStalledAsFailed(
  channelSlug: string,
  productionId: string,
  reason: string
): Promise<void> {
  const channelDir = getChannelDir(channelSlug);
  const outputDir = join(channelDir, 'output', productionId);
  const statusPath = join(outputDir, 'pipeline-status.json');

  if (!(await fileExists(statusPath))) return;

  const status = await readJsonFile<PipelineStatus>(statusPath);
  status.stage = 'failed';
  status.error = `Stalled recovery: ${reason}`;
  status.updatedAt = new Date();
  await writeJsonFile(statusPath, status);
  log.info(`Marked stalled production as failed: ${channelSlug}/${productionId} — ${reason}`);
}

/**
 * Find productions in active stages that were updated recently (not stalled).
 * Used on dashboard startup to re-register running pipelines in the tracker.
 */
export async function findActiveProductions(projectsDir: string): Promise<Array<{
  channelSlug: string;
  productionId: string;
  stage: string;
  topic: string;
}>> {
  const active: Array<{ channelSlug: string; productionId: string; stage: string; topic: string }> = [];

  let channelDirs: string[];
  try {
    channelDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('ch-'))
      .map((d) => d.name);
  } catch {
    return active;
  }

  for (const slug of channelDirs) {
    const outputBase = join(projectsDir, slug, 'output');
    if (!existsSync(outputBase)) continue;

    const runs = readdirSync(outputBase, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const run of runs) {
      const statusPath = join(outputBase, run, 'pipeline-status.json');
      if (!existsSync(statusPath)) continue;

      try {
        const status = await readJsonFile<PipelineStatus>(statusPath);
        if (!ACTIVE_STAGES.includes(status.stage)) continue;

        const updatedAt = new Date(status.updatedAt);
        const elapsed = Date.now() - updatedAt.getTime();
        // Only return non-stalled (fresh) active productions
        if (elapsed <= STALL_THRESHOLD_MS) {
          let topic = 'unknown';
          try {
            const plan = await readJsonFile<{ topic: string }>(join(outputBase, run, 'content-plan.json'));
            topic = plan.topic;
          } catch {
            try {
              const script = await readJsonFile<{ title: string }>(join(outputBase, run, 'script-output.json'));
              topic = script.title;
            } catch { /* use default */ }
          }
          active.push({ channelSlug: slug, productionId: run, stage: status.stage, topic });
        }
      } catch { /* skip */ }
    }
  }

  return active;
}

/**
 * Restore in-memory concurrency counters after a process restart.
 * Scans all non-stalled, non-terminal productions to count how many are
 * actively occupying pipeline and compilation slots.
 *
 * Call this from server startup, after findActiveProductions().
 */
export async function restoreConcurrencyState(projectsDir: string): Promise<void> {
  const PIPELINE_ACTIVE_STAGES: string[] = ['asset_generation', 'compilation', 'publishing'];
  const COMPILATION_ACTIVE_STAGES: string[] = ['compilation'];

  let pipelineCount = 0;
  let compilationCount = 0;

  let channelDirs: string[];
  try {
    channelDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('ch-'))
      .map((d) => d.name);
  } catch {
    return;
  }

  for (const slug of channelDirs) {
    const outputBase = join(projectsDir, slug, 'output');
    if (!existsSync(outputBase)) continue;

    const runs = readdirSync(outputBase, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const run of runs) {
      const statusPath = join(outputBase, run, 'pipeline-status.json');
      if (!existsSync(statusPath)) continue;

      try {
        const status = await readJsonFile<PipelineStatus>(statusPath);

        // Only consider non-stalled productions
        const updatedAt = new Date(status.updatedAt);
        const elapsed = Date.now() - updatedAt.getTime();
        if (elapsed > STALL_THRESHOLD_MS) continue;

        if (PIPELINE_ACTIVE_STAGES.includes(status.stage)) {
          pipelineCount++;
        }
        if (COMPILATION_ACTIVE_STAGES.includes(status.stage)) {
          compilationCount++;
        }
      } catch { /* skip corrupt files */ }
    }
  }

  activePipelineCount = Math.min(pipelineCount, MAX_CONCURRENT_PIPELINES);
  activeCompilationCount = Math.min(compilationCount, MAX_CONCURRENT_COMPILATIONS);

  if (activePipelineCount > 0 || activeCompilationCount > 0) {
    log.info(
      `Concurrency state restored: ${activePipelineCount} pipeline slot(s), ` +
      `${activeCompilationCount} compilation slot(s)`
    );
  }
}

// === Post-Publish Cleanup ===

const CLEANUP_DIRS = ['images', 'animations', 'music', 'voiceover', 'stock-footage', 'teaser'];

/**
 * Remove heavy asset files after successful publish.
 * Keeps: pipeline-status.json, script-output.json, content-plan.json,
 *        asset-manifest.json, compilation-result.json, publish-result.json,
 *        publish-params.json, final video, thumbnail, preview clip.
 */
export async function cleanupAfterPublish(outputDir: string): Promise<void> {
  const { rm } = await import('fs/promises');

  for (const dir of CLEANUP_DIRS) {
    const dirPath = join(outputDir, dir);
    if (existsSync(dirPath)) {
      try {
        await rm(dirPath, { recursive: true, force: true });
        log.info(`Cleaned up: ${dirPath}`);
      } catch (err) {
        log.warn(`Cleanup failed for ${dirPath}: ${(err as Error).message}`);
      }
    }
  }
}

/**
 * Get disk usage of an output directory in bytes.
 */
export async function getProductionDiskUsage(outputDir: string): Promise<number> {
  if (!existsSync(outputDir)) return 0;

  let total = 0;
  const { readdir } = await import('fs/promises');

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        try {
          const s = await stat(fullPath);
          total += s.size;
        } catch { /* skip */ }
      }
    }
  }

  await walk(outputDir);
  return total;
}
