import { readFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadChannelConfig, getChannelDir } from '../utils/config-loader.js';
import { generateProductionId, writeJsonFile, ensureDir } from '../utils/file-helpers.js';
import { ContentPlan, ScriptOutput, ScriptSection } from '../types/index.js';
import { popNextFromQueue } from '../dashboard/state/queue-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

export interface ProductionSetup {
  channelSlug: string;
  productionId: string;
  outputDir: string;
  topic: string;
  contentPlan: ContentPlan;
  frameworks: {
    script: string;
    image: string;
    music: string;
    thumbnail: string;
    title: string;
    teaser?: string;
    description: string;
  };
}

const MUSIC_SEGMENT_DURATION = 190;

export interface ProductionOptions {
  segmentCount?: number;
}

export async function setupProduction(
  channelSlug: string,
  topic?: string,
  options?: ProductionOptions,
): Promise<ProductionSetup> {
  const config = await loadChannelConfig(channelSlug);
  const channelDir = getChannelDir(channelSlug);
  const productionId = generateProductionId();
  const outputDir = join(PROJECT_ROOT, 'projects', channelSlug, 'output', productionId);
  await ensureDir(outputDir);

  // If no topic provided, pop from queue
  let finalTopic = topic;
  if (!finalTopic) {
    const queueItem = await popNextFromQueue(channelSlug);
    if (!queueItem) {
      throw new Error('No topic provided and queue is empty');
    }
    finalTopic = queueItem.topic;
  }

  // Build content plan
  const contentPlan: ContentPlan = {
    topic: finalTopic,
    angle: '',
    keyPoints: [],
    targetDurationSeconds:
      config.channel.format === 'music-only'
        ? (options?.segmentCount ?? 1) * MUSIC_SEGMENT_DURATION
        : 600,
    format: config.channel.format,
  };

  // Load all frameworks
  const loadFw = async (relativePath: string): Promise<string> => {
    const fullPath = relativePath.startsWith('../../')
      ? join(PROJECT_ROOT, relativePath.replace('../../', ''))
      : join(channelDir, relativePath);
    return readFile(fullPath, 'utf-8');
  };

  const frameworks: ProductionSetup['frameworks'] = {
    script: config.frameworks.script ? await loadFw(config.frameworks.script) : '',
    image: await loadFw(config.frameworks.image),
    music: await loadFw(config.frameworks.music),
    thumbnail: await loadFw(config.frameworks.thumbnail),
    title: await loadFw(config.frameworks.title),
    description: await loadFw('../../shared/description-formula.md'),
  };
  if (config.frameworks.teaser) {
    frameworks.teaser = await loadFw(config.frameworks.teaser);
  }

  // Save initial state
  await writeJsonFile(join(outputDir, 'content-plan.json'), contentPlan);
  await writeJsonFile(join(outputDir, 'pipeline-status.json'), {
    stage: 'scripting',
    startedAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    channelSlug,
    productionId,
    outputDir,
    topic: finalTopic,
    contentPlan,
    frameworks,
  };
}

export async function saveScriptOutput(
  outputDir: string,
  scriptOutput: ScriptOutput
): Promise<void> {
  await writeJsonFile(join(outputDir, 'script-output.json'), scriptOutput);
  await writeJsonFile(join(outputDir, 'pipeline-status.json'), {
    stage: 'asset_generation',
    startedAt: new Date(),
    updatedAt: new Date(),
  });
}

export function buildScriptOutput(params: {
  title: string;
  sections: Array<{
    sectionName: string;
    narration: string;
    imageCue: string;
    durationSeconds: number;
  }>;
  description: string;
  hashtags: string[];
  teaserSections?: Array<{
    sectionName: string;
    narration: string;
    imageCue: string;
    durationSeconds: number;
  }>;
}): ScriptOutput {
  const output: ScriptOutput = {
    title: params.title,
    script: params.sections.map((s): ScriptSection => ({
      sectionName: s.sectionName,
      narration: s.narration,
      imageCue: s.imageCue,
      durationSeconds: s.durationSeconds,
    })),
    description: params.description,
    hashtags: params.hashtags,
  };

  if (params.teaserSections) {
    output.teaserScript = params.teaserSections.map((s): ScriptSection => ({
      sectionName: s.sectionName,
      narration: s.narration,
      imageCue: s.imageCue,
      durationSeconds: s.durationSeconds,
    }));
  }

  return output;
}
