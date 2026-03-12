import { join } from 'path';

import { PipelineError } from '../errors/index.js';
import {
  AssetManifest,
  ChannelConfig,
  CompilationResult,
  ContentPlan,
  PipelineContext,
  PipelineStage,
  PipelineStatus,
  PublishResult,
  ScriptOutput,
} from '../types/index.js';
import {
  getChannelDir,
  getOutputDir,
  loadChannelConfig,
  loadFramework,
} from '../utils/config-loader.js';
import { generateProductionId, writeJsonFile } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

import { generateBatchImages } from './flux-service.js';
import { generateSectionVoiceovers } from './elevenlabs-service.js';
import { generateMusic } from './sonauto-service.js';
import {
  compileLongFormVideo,
  compileShortFormVideo,
  compileMusicOnlyVideo,
  generateThumbnail,
} from './ffmpeg-service.js';
import { uploadVideo, updateVideoPrivacy } from './youtube-service.js';
import { sendApprovalRequest, pollForApproval } from './telegram-service.js';

const log = createLogger('pipeline');

export async function runPipeline(
  channelSlug: string,
  contentPlan: ContentPlan,
  scriptOutput: ScriptOutput
): Promise<PipelineContext> {
  const config = await loadChannelConfig(channelSlug);
  const channelDir = getChannelDir(channelSlug);
  const productionId = generateProductionId();
  const outputDir = getOutputDir(channelSlug, productionId);

  const context: PipelineContext = {
    channelConfig: config,
    channelDir,
    outputDir,
    contentPlan,
    scriptOutput,
  };

  const status: PipelineStatus = {
    stage: 'planning',
    startedAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    // Save initial state
    await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);
    await writeJsonFile(join(outputDir, 'content-plan.json'), contentPlan);
    await writeJsonFile(join(outputDir, 'script-output.json'), scriptOutput);

    // Stage: Asset Generation
    await updateStage(status, 'asset_generation', outputDir);
    log.info('Starting asset generation');
    context.assetManifest = await generateAssets(config, channelDir, outputDir, scriptOutput);
    await writeJsonFile(join(outputDir, 'asset-manifest.json'), context.assetManifest);

    // Stage: Compilation
    await updateStage(status, 'compilation', outputDir);
    log.info('Starting video compilation');
    context.compilationResult = await compileVideo(config, outputDir, context.assetManifest, scriptOutput);
    await writeJsonFile(join(outputDir, 'compilation-result.json'), context.compilationResult);

    // Stage: Approval
    await updateStage(status, 'approval', outputDir);
    log.info('Starting approval flow');
    context.publishResult = await publishWithApproval(config, context.compilationResult, scriptOutput);
    await writeJsonFile(join(outputDir, 'publish-result.json'), context.publishResult);

    // Stage: Complete
    await updateStage(status, 'complete', outputDir);
    log.info(`Pipeline complete for "${scriptOutput.title}"`);

    return context;
  } catch (error) {
    status.stage = 'failed';
    status.error = (error as Error).message;
    status.updatedAt = new Date();
    await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);

    throw new PipelineError(
      `Pipeline failed at stage ${status.stage}: ${(error as Error).message}`,
      status.stage,
      error as Error
    );
  }
}

async function generateAssets(
  config: ChannelConfig,
  channelDir: string,
  outputDir: string,
  scriptOutput: ScriptOutput
): Promise<AssetManifest> {
  const imageFramework = await loadFramework(channelDir, config.frameworks.image);
  const musicFramework = await loadFramework(channelDir, config.frameworks.music);

  const manifest: AssetManifest = {
    images: [],
    voiceover: [],
    music: [],
    animations: [],
  };

  // Generate images from script cues
  const imageCues = scriptOutput.script.map((section, i) => ({
    id: `section-${i}`,
    prompt: section.imageCue,
  }));
  manifest.images = await generateBatchImages(
    imageCues,
    join(outputDir, 'images'),
    imageFramework
  );

  // Generate voiceover (skip for music-only)
  if (config.channel.format !== 'music-only') {
    const voSections = scriptOutput.script.map((section, i) => ({
      id: `section-${i}`,
      text: section.narration,
    }));
    manifest.voiceover = await generateSectionVoiceovers(
      voSections,
      config.credentials.elevenLabsVoiceId,
      join(outputDir, 'voiceover')
    );
  }

  // Generate background music
  const musicPrompt = `Background music for a video about: ${scriptOutput.title}. Style: ${musicFramework}`;
  const totalDuration = scriptOutput.script.reduce((sum, s) => sum + s.durationSeconds, 0);

  const musicAsset = await generateMusic({
    prompt: musicPrompt,
    durationSeconds: totalDuration,
    outputPath: join(outputDir, 'music', 'background.mp3'),
  });
  manifest.music = [musicAsset];

  return manifest;
}

async function compileVideo(
  config: ChannelConfig,
  outputDir: string,
  manifest: AssetManifest,
  scriptOutput: ScriptOutput
): Promise<CompilationResult> {
  const format = config.channel.format;
  let result: CompilationResult;

  if (format === 'music-only') {
    result = await compileMusicOnlyVideo(outputDir, manifest);
  } else if (format === 'short') {
    result = await compileShortFormVideo({
      outputDir,
      manifest,
      sections: scriptOutput.script,
      resolution: '1080x1920',
    });
  } else {
    // 'long' or 'long+short'
    result = await compileLongFormVideo({
      outputDir,
      manifest,
      sections: scriptOutput.script,
    });

    if (format === 'long+short' && scriptOutput.teaserScript) {
      const teaserResult = await compileShortFormVideo({
        outputDir: join(outputDir, 'teaser'),
        manifest,
        sections: scriptOutput.teaserScript,
        resolution: '1080x1920',
      });
      result.teaserVideoPath = teaserResult.videoPath;
    }
  }

  // Generate thumbnail
  if (manifest.images.length > 0) {
    const thumbnailPath = join(outputDir, 'thumbnail.jpg');
    result.thumbnailPath = await generateThumbnail(
      manifest.images[0].path,
      thumbnailPath,
      scriptOutput.title
    );
  }

  return result;
}

async function publishWithApproval(
  config: ChannelConfig,
  compilation: CompilationResult,
  scriptOutput: ScriptOutput
): Promise<PublishResult> {
  const oauthPath = join(getChannelDir(config.channel.slug), '.youtube-oauth.json');

  // Upload as unlisted first
  const publishResult = await uploadVideo(oauthPath, {
    videoPath: compilation.videoPath,
    thumbnailPath: compilation.thumbnailPath,
    title: scriptOutput.title,
    description: scriptOutput.description,
    tags: scriptOutput.tags,
    hashtags: scriptOutput.hashtags,
    privacy: 'unlisted',
  });

  // Send Telegram approval
  const messageId = await sendApprovalRequest({
    videoTitle: scriptOutput.title,
    youtubeUrl: publishResult.youtubeUrl,
    channelName: config.channel.name,
  });

  publishResult.status = 'pending_approval';

  // Wait for approval
  const approved = await pollForApproval(messageId);

  if (approved) {
    await updateVideoPrivacy(oauthPath, publishResult.youtubeVideoId, 'public');
    publishResult.status = 'published';
    log.info(`Video published: ${publishResult.youtubeUrl}`);
  } else {
    publishResult.status = 'rejected';
    log.warn(`Video rejected: ${publishResult.youtubeUrl}`);
  }

  return publishResult;
}

async function updateStage(
  status: PipelineStatus,
  stage: PipelineStage,
  outputDir: string
): Promise<void> {
  status.stage = stage;
  status.updatedAt = new Date();
  await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);
  log.info(`Pipeline stage: ${stage}`);
}
