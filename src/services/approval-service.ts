import { join } from 'path';
import { readdirSync, existsSync } from 'fs';

import { PipelineStatus } from '../types/index.js';
import { readJsonFile, writeJsonFile } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';
import { getOutputDir, getProjectsDir } from '../utils/config-loader.js';

const log = createLogger('approval-service');

const approvalsInProgress = new Set<string>();

export interface PendingApproval {
  channelSlug: string;
  productionId: string;
  checkpointType: 'asset_preview' | 'final_approval';
  telegramMessageId: number;
  telegramMessageIds: number[];
  requestedAt: string;
  stage: string;
}

export async function approveProduction(
  channelSlug: string,
  productionId: string
): Promise<void> {
  const key = `${channelSlug}:${productionId}`;
  if (approvalsInProgress.has(key)) {
    log.info(`Approval already in progress for ${productionId} — ignoring duplicate`);
    return;
  }
  approvalsInProgress.add(key);

  try {
  const outputDir = getOutputDir(channelSlug, productionId);
  const statusPath = join(outputDir, 'pipeline-status.json');
  const status = await readJsonFile<PipelineStatus>(statusPath);

  if (status.stage !== 'awaiting_asset_approval' && status.stage !== 'awaiting_final_approval') {
    throw new Error(`Cannot approve: pipeline is at stage "${status.stage}", not awaiting approval`);
  }

  log.info(`Production ${productionId} approved at stage ${status.stage}`);

  // Clear checkpoint — asset approval resumes to compilation, final approval parks at 'ready'
  const resumeStage = status.stage === 'awaiting_asset_approval' ? 'compilation' : 'ready';
  status.stage = resumeStage;
  delete status.checkpoint;
  status.updatedAt = new Date();
  await writeJsonFile(statusPath, status);
  } finally {
    approvalsInProgress.delete(key);
  }
}

export async function rejectProduction(
  channelSlug: string,
  productionId: string,
  reason?: string
): Promise<void> {
  const outputDir = getOutputDir(channelSlug, productionId);
  const statusPath = join(outputDir, 'pipeline-status.json');
  const status = await readJsonFile<PipelineStatus>(statusPath);

  if (status.stage !== 'awaiting_asset_approval' && status.stage !== 'awaiting_final_approval') {
    throw new Error(`Cannot reject: pipeline is at stage "${status.stage}", not awaiting approval`);
  }

  log.info(`Production ${productionId} rejected: ${reason ?? 'no reason given'}`);

  status.stage = 'rejected';
  status.error = reason ?? 'Rejected by user';
  delete status.checkpoint;
  status.updatedAt = new Date();
  await writeJsonFile(statusPath, status);
}

export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const projectsDir = getProjectsDir();
  const pending: PendingApproval[] = [];

  let channelDirs: string[];
  try {
    channelDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('ch-'))
      .map((d) => d.name);
  } catch {
    return pending;
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
        if (
          (status.stage === 'awaiting_asset_approval' || status.stage === 'awaiting_final_approval') &&
          status.checkpoint
        ) {
          pending.push({
            channelSlug: slug,
            productionId: run,
            checkpointType: status.checkpoint.type,
            telegramMessageId: status.checkpoint.telegramMessageId,
            telegramMessageIds: status.checkpoint.telegramMessageIds ?? [status.checkpoint.telegramMessageId],
            requestedAt: status.checkpoint.requestedAt,
            stage: status.stage,
          });
        }
      } catch {
        // Skip corrupt status files
      }
    }
  }

  return pending;
}

export interface ReadyProduction {
  channelSlug: string;
  productionId: string;
  title: string;
  approvedAt: string;
}

export async function listReadyProductions(): Promise<ReadyProduction[]> {
  const projectsDir = getProjectsDir();
  const ready: ReadyProduction[] = [];

  let channelDirs: string[];
  try {
    channelDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('ch-'))
      .map((d) => d.name);
  } catch {
    return ready;
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
        if (status.stage === 'ready') {
          const scriptPath = join(outputBase, run, 'script-output.json');
          let title = run;
          try {
            const script = await readJsonFile<{ title: string }>(scriptPath);
            title = script.title || run;
          } catch { /* use productionId as fallback */ }
          ready.push({
            channelSlug: slug,
            productionId: run,
            title,
            approvedAt: status.updatedAt?.toString() ?? '',
          });
        }
      } catch {
        // Skip corrupt status files
      }
    }
  }

  return ready;
}

export async function getPendingApproval(
  channelSlug: string,
  productionId: string
): Promise<PendingApproval | null> {
  const outputDir = getOutputDir(channelSlug, productionId);
  const statusPath = join(outputDir, 'pipeline-status.json');

  if (!existsSync(statusPath)) return null;

  const status = await readJsonFile<PipelineStatus>(statusPath);
  if (
    (status.stage !== 'awaiting_asset_approval' && status.stage !== 'awaiting_final_approval') ||
    !status.checkpoint
  ) {
    return null;
  }

  return {
    channelSlug,
    productionId,
    checkpointType: status.checkpoint.type,
    telegramMessageId: status.checkpoint.telegramMessageId,
    telegramMessageIds: status.checkpoint.telegramMessageIds ?? [status.checkpoint.telegramMessageId],
    requestedAt: status.checkpoint.requestedAt,
    stage: status.stage,
  };
}
