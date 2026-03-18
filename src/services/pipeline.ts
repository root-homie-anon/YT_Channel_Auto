import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

import { PipelineError } from '../errors/index.js';
import {
  AssetManifest,
  ChannelConfig,
  CheckpointData,
  CompilationResult,
  ContentPlan,
  PipelineContext,
  PipelineStage,
  PipelineStatus,
  PublishResult,
  ScriptOutput,
  formatTimestamp,
} from '../types/index.js';
import {
  getChannelDir,
  getOutputDir,
  loadChannelConfig,
  loadFramework,
} from '../utils/config-loader.js';
import { generateProductionId, readJsonFile, writeJsonFile, fileExists } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

import { generateBatchImages, generateImage } from './flux-service.js';
import { groundBatchPrompts } from './prompt-grounding.js';
import { generateVoiceover } from './elevenlabs-service.js';
import { generateMusic as generateMusicStableAudio } from './replicate-audio-service.js';
import { generateAnimation } from './runway-service.js';
import { findFootageForCues, downloadClip } from './archive-service.js';
import {
  compileLongFormVideo,
  compileShortFormVideo,
  compileMusicOnlyVideo,
} from './ffmpeg-service.js';
import { generateThumbnailNBPro, loadSystemInstruction } from './nanobana-service.js';
import { advanceRotationState } from './rotation-state.js';
import { uploadVideo } from './youtube-service.js';
import { sendApprovalRequest, sendTextMessage, sendVideo, sendPhoto, sendAudio } from './telegram-service.js';
import {
  waitForCompilationSlot,
  releaseCompilationSlot,
} from './production-queue.js';

const execFileAsync = promisify(execFile);
const log = createLogger('pipeline');

async function runFfmpegDirect(args: string[]): Promise<void> {
  await execFileAsync('ffmpeg', args, { maxBuffer: 50 * 1024 * 1024 });
}

/**
 * Run the pipeline from the beginning. Generates assets, sends Telegram preview,
 * then pauses at a checkpoint (awaiting_asset_approval or awaiting_final_approval).
 * Returns 'checkpoint' if paused, 'complete' if fully done (narrated channels
 * without music-only checkpoint skip straight through).
 */
export async function runPipeline(
  channelSlug: string,
  contentPlan: ContentPlan,
  scriptOutput: ScriptOutput,
  existingProductionId?: string
): Promise<PipelineContext> {
  const config = await loadChannelConfig(channelSlug);
  const channelDir = getChannelDir(channelSlug);
  const productionId = existingProductionId ?? generateProductionId();
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
    const assetResult = await generateAssets(config, channelDir, outputDir, scriptOutput, contentPlan);
    context.assetManifest = assetResult.manifest;
    await writeJsonFile(join(outputDir, 'asset-manifest.json'), context.assetManifest);

    // Stage: Asset Preview (Telegram Checkpoint 1 — non-blocking)
    if (config.channel.format === 'music-only' && context.assetManifest) {
      if (config.skipApproval) {
        log.info('skipApproval enabled — skipping asset checkpoint, proceeding to compilation');
      } else {
        await updateStage(status, 'asset_preview', outputDir);
        log.info('Sending asset previews to Telegram for approval');
        const messageId = await sendAssetPreviewMessages(config, context.assetManifest, contentPlan);

        // Write checkpoint and pause — pipeline resumes on approval
        const checkpoint: CheckpointData = {
          type: 'asset_preview',
          channelSlug,
          productionId,
          telegramMessageId: messageId,
          requestedAt: new Date().toISOString(),
        };
        status.stage = 'awaiting_asset_approval';
        status.checkpoint = checkpoint;
        status.updatedAt = new Date();
        await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);
        log.info('Pipeline paused — awaiting asset approval (no timeout)');
        return context;
      }
    }

    // Non-music-only channels: continue straight to compilation
    return await runFromCompilation(channelSlug, productionId, config, channelDir, outputDir, contentPlan, scriptOutput, context, status, assetResult.teaserManifest);
  } catch (error) {
    const failedStage = status.stage;
    status.stage = 'failed';
    status.failedAtStage = failedStage;
    status.error = (error as Error).message;
    status.updatedAt = new Date();
    await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);

    // Notify user via Telegram
    try {
      await sendTextMessage(
        `Pipeline FAILED for ${config.channel.name}\n` +
        `Stage: ${failedStage}\n` +
        `Error: ${(error as Error).message}\n` +
        `Production: ${productionId}\n\n` +
        `Fix the issue and resume — partial progress is saved.`
      );
    } catch {
      log.warn('Could not send failure notification to Telegram');
    }

    throw new PipelineError(
      `Pipeline failed at stage ${failedStage}: ${(error as Error).message}`,
      failedStage as string,
      error as Error
    );
  }
}

/**
 * Resume the pipeline after an approval. Reads all state from disk.
 * Dispatches to the correct stage based on pipeline-status.json.
 */
export async function resumePipeline(
  channelSlug: string,
  productionId: string
): Promise<PipelineContext> {
  const config = await loadChannelConfig(channelSlug);
  const channelDir = getChannelDir(channelSlug);
  const outputDir = getOutputDir(channelSlug, productionId);

  const status = await readJsonFile<PipelineStatus>(join(outputDir, 'pipeline-status.json'));
  const contentPlan = await readJsonFile<ContentPlan>(join(outputDir, 'content-plan.json'));
  const scriptOutput = await readJsonFile<ScriptOutput>(join(outputDir, 'script-output.json'));

  const context: PipelineContext = {
    channelConfig: config,
    channelDir,
    outputDir,
    contentPlan,
    scriptOutput,
  };

  try {
    if (status.stage === 'asset_generation' || status.stage === 'asset_preview' || status.stage === 'planning') {
      // Crashed during asset generation — resume with skip logic for existing assets
      log.info(`Resuming from ${status.stage} — existing assets will be reused`);
      return await runPipeline(channelSlug, contentPlan, scriptOutput, productionId);
    }

    if (status.stage === 'compilation') {
      // Resuming after asset approval — run compilation through to final checkpoint
      const manifest = await readJsonFile<AssetManifest>(join(outputDir, 'asset-manifest.json'));
      context.assetManifest = manifest;
      return await runFromCompilation(channelSlug, productionId, config, channelDir, outputDir, contentPlan, scriptOutput, context, status);
    }

    if (status.stage === 'approval' || status.stage === 'metadata_generation') {
      // Crashed during approval send or metadata gen — re-run from compilation
      // (compilation result should exist, if not, will re-compile)
      const manifestExists = await fileExists(join(outputDir, 'asset-manifest.json'));
      if (manifestExists) {
        const manifest = await readJsonFile<AssetManifest>(join(outputDir, 'asset-manifest.json'));
        context.assetManifest = manifest;
        const compilationExists = await fileExists(join(outputDir, 'compilation-result.json'));
        if (compilationExists) {
          // Compilation done, just need to re-send approval
          const compilation = await readJsonFile<CompilationResult>(join(outputDir, 'compilation-result.json'));
          context.compilationResult = compilation;
          return await runFromCompilation(channelSlug, productionId, config, channelDir, outputDir, contentPlan, scriptOutput, context, status);
        }
        return await runFromCompilation(channelSlug, productionId, config, channelDir, outputDir, contentPlan, scriptOutput, context, status);
      }
      // No manifest — restart from beginning
      return await runPipeline(channelSlug, contentPlan, scriptOutput, productionId);
    }

    if (status.stage === 'awaiting_asset_approval') {
      // Paused at asset checkpoint — approval not yet received, return current state
      log.info('Pipeline is awaiting asset approval — no action needed');
      const manifest = await readJsonFile<AssetManifest>(join(outputDir, 'asset-manifest.json'));
      context.assetManifest = manifest;
      return context;
    }

    if (status.stage === 'awaiting_final_approval') {
      // Paused at final checkpoint — approval not yet received, return current state
      log.info('Pipeline is awaiting final approval — no action needed');
      const compilation = await readJsonFile<CompilationResult>(join(outputDir, 'compilation-result.json'));
      context.compilationResult = compilation;
      return context;
    }

    if (status.stage === 'ready') {
      // Approved but not yet published — resume from publishing
      log.info('Pipeline is ready — resuming from publishing');
      const compilation = await readJsonFile<CompilationResult>(join(outputDir, 'compilation-result.json'));
      context.compilationResult = compilation;
      return await runFromPublishing(config, outputDir, compilation, scriptOutput, context, status);
    }

    if (status.stage === 'publishing') {
      // Resuming after final approval — upload to YouTube
      const compilation = await readJsonFile<CompilationResult>(join(outputDir, 'compilation-result.json'));
      context.compilationResult = compilation;
      return await runFromPublishing(config, outputDir, compilation, scriptOutput, context, status);
    }

    if (status.stage === 'failed') {
      // Resume from last known good stage using saved error context
      const lastGoodStage = status.failedAtStage ?? 'asset_generation';
      log.info(`Resuming from failed state (was at: ${lastGoodStage})`);
      status.stage = lastGoodStage as PipelineStage;
      delete status.error;
      await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);
      return await resumePipeline(channelSlug, productionId);
    }

    throw new PipelineError(`Cannot resume pipeline at stage "${status.stage}"`, status.stage);
  } catch (error) {
    const failedStage = status.stage;
    status.stage = 'failed';
    status.failedAtStage = failedStage;
    status.error = (error as Error).message;
    status.updatedAt = new Date();
    await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);

    // Notify user via Telegram
    try {
      await sendTextMessage(
        `Pipeline FAILED for ${config.channel.name}\n` +
        `Stage: ${failedStage}\n` +
        `Error: ${(error as Error).message}\n` +
        `Production: ${productionId}\n\n` +
        `Fix the issue and resume — partial progress is saved.`
      );
    } catch {
      log.warn('Could not send failure notification to Telegram');
    }

    throw new PipelineError(
      `Pipeline failed at stage ${failedStage}: ${(error as Error).message}`,
      status.stage,
      error as Error
    );
  }
}

/**
 * Run from compilation stage through to final approval checkpoint or completion.
 */
async function runFromCompilation(
  channelSlug: string,
  productionId: string,
  config: ChannelConfig,
  channelDir: string,
  outputDir: string,
  contentPlan: ContentPlan,
  scriptOutput: ScriptOutput,
  context: PipelineContext,
  status: PipelineStatus,
  teaserManifest?: AssetManifest
): Promise<PipelineContext> {
  const manifest = context.assetManifest ?? await readJsonFile<AssetManifest>(join(outputDir, 'asset-manifest.json'));
  context.assetManifest = manifest;

  // Stage: Compilation — gated by concurrency limiter (1 at a time)
  await updateStage(status, 'compilation', outputDir);

  // Check if compilation already completed (crash recovery)
  const compilationResultPath = join(outputDir, 'compilation-result.json');
  if (await fileExists(compilationResultPath)) {
    try {
      const existingCompilation = await readJsonFile<CompilationResult>(compilationResultPath);
      const needsTeaser = (config.channel.format === 'long+short' || config.channel.format === 'short')
        && scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0;
      const teaserComplete = !needsTeaser || (existingCompilation.teaserVideoPath && await fileExists(existingCompilation.teaserVideoPath));
      if (existingCompilation.videoPath && await fileExists(existingCompilation.videoPath) && teaserComplete) {
        log.info('Compilation result already exists, skipping');
        context.compilationResult = existingCompilation;

        // Send thumbnail to Telegram regardless of approval flow
        if (existingCompilation.thumbnailPath && config.channel.format !== 'music-only') {
          try {
            await sendPhoto(existingCompilation.thumbnailPath, `🖼 Thumbnail: ${scriptOutput.title}`);
          } catch (err) {
            log.warn(`Failed to send thumbnail to Telegram: ${(err as Error).message}`);
          }
        }

        if (config.skipApproval) {
          log.info('skipApproval enabled — skipping final checkpoint, publishing as unlisted');
          await writeJsonFile(join(outputDir, 'publish-params.json'), { privacy: 'unlisted' });
          return await runFromPublishing(config, outputDir, context.compilationResult, scriptOutput, context, status);
        }

        // Skip to approval
        await updateStage(status, 'approval', outputDir);
        log.info('Sending final video for approval');
        const messageId = await sendFinalApprovalMessages(config, context.compilationResult, scriptOutput);

        const checkpoint: CheckpointData = {
          type: 'final_approval',
          channelSlug,
          productionId,
          telegramMessageId: messageId,
          requestedAt: new Date().toISOString(),
        };
        status.stage = 'awaiting_final_approval';
        status.checkpoint = checkpoint;
        status.updatedAt = new Date();
        await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);
        log.info('Pipeline paused — awaiting final approval (no timeout)');
        return context;
      }
    } catch { /* re-compile */ }
  }

  log.info('Waiting for compilation slot...');
  await waitForCompilationSlot();
  try {
    log.info('Starting video compilation');
    context.compilationResult = await compileVideo(
      config, channelDir, outputDir, manifest, scriptOutput, teaserManifest
    );
    await writeJsonFile(compilationResultPath, context.compilationResult);
  } finally {
    releaseCompilationSlot();
  }

  // Advance rotation state after successful compilation (music-only)
  if (config.channel.format === 'music-only' && contentPlan.musicOnlyPrompts) {
    const segmentsConsumed = contentPlan.segmentCount ?? 1;
    await advanceRotationState(
      channelDir,
      segmentsConsumed,
      contentPlan.musicOnlyPrompts.lastEnvironment ?? '',
      contentPlan.musicOnlyPrompts.lastAtmosphere ?? '',
      productionId
    );
  }

  // Inject chapter markers into description if segment timestamps exist
  if (context.compilationResult?.segmentTimestamps && context.compilationResult.segmentTimestamps.length > 0) {
    // Load scene labels from agent (if available) to replace default "Scene N" labels
    try {
      const sceneLabels = await readJsonFile<string[]>(join(outputDir, 'scene-labels.json'));
      if (Array.isArray(sceneLabels)) {
        for (let i = 0; i < context.compilationResult.segmentTimestamps.length; i++) {
          if (sceneLabels[i]) {
            context.compilationResult.segmentTimestamps[i].label = sceneLabels[i];
          }
        }
      }
    } catch {
      // No scene labels file — use default "Scene N" labels from compilation
    }

    const chapters = context.compilationResult.segmentTimestamps
      .map((seg) => `${formatTimestamp(seg.startSeconds)} ${seg.label}`)
      .join('\n');
    // Insert chapters before the CTA line (marked by "---" separator or "Subscribe")
    const desc = scriptOutput.description;
    const ctaIndex = desc.indexOf('\n---\n');
    if (ctaIndex !== -1) {
      scriptOutput.description = desc.slice(0, ctaIndex) + '\n\n' + chapters + desc.slice(ctaIndex);
    } else {
      // Fallback: append before last paragraph
      scriptOutput.description = desc + '\n\n' + chapters;
    }
    await writeJsonFile(join(outputDir, 'script-output.json'), scriptOutput);
    log.info(`Injected ${context.compilationResult.segmentTimestamps.length} chapter markers into description`);
  }

  // Send thumbnail to Telegram regardless of approval flow
  if (context.compilationResult?.thumbnailPath && config.channel.format !== 'music-only') {
    try {
      await sendPhoto(context.compilationResult.thumbnailPath, `🖼 Thumbnail: ${scriptOutput.title}`);
      log.info('Thumbnail sent to Telegram');
    } catch (err) {
      log.warn(`Failed to send thumbnail to Telegram: ${(err as Error).message}`);
    }
  }

  // Stage: Send final approval (Telegram Checkpoint 2 — non-blocking)
  // NOTE: Title, description, and hashtags must be set in scriptOutput BEFORE
  // the pipeline reaches this point. For music-only channels, the @content-strategist
  // agent generates metadata using the channel's frameworks and prompt context.
  // For narrated channels, @script-writer generates all metadata.
  if (config.skipApproval) {
    log.info('skipApproval enabled — skipping final checkpoint, publishing as unlisted');
    // Write publish params as unlisted
    await writeJsonFile(join(outputDir, 'publish-params.json'), { privacy: 'unlisted' });
    return await runFromPublishing(config, outputDir, context.compilationResult!, scriptOutput, context, status);
  }

  await updateStage(status, 'approval', outputDir);
  log.info('Sending final video for approval');
  const messageId = await sendFinalApprovalMessages(config, context.compilationResult, scriptOutput);

  const checkpoint: CheckpointData = {
    type: 'final_approval',
    channelSlug,
    productionId,
    telegramMessageId: messageId,
    requestedAt: new Date().toISOString(),
  };
  status.stage = 'awaiting_final_approval';
  status.checkpoint = checkpoint;
  status.updatedAt = new Date();
  await writeJsonFile(join(outputDir, 'pipeline-status.json'), status);
  log.info('Pipeline paused — awaiting final approval (no timeout)');

  return context;
}

/**
 * Run from publishing stage — upload to YouTube and mark complete.
 */
async function runFromPublishing(
  config: ChannelConfig,
  outputDir: string,
  compilation: CompilationResult,
  scriptOutput: ScriptOutput,
  context: PipelineContext,
  status: PipelineStatus
): Promise<PipelineContext> {
  await updateStage(status, 'publishing', outputDir);
  log.info('Publishing to YouTube');

  const oauthPath = join(getChannelDir(config.channel.slug), '.youtube-oauth.json');
  let hasYouTubeOAuth = false;
  try {
    const { access: fsAccess } = await import('fs/promises');
    await fsAccess(oauthPath);
    hasYouTubeOAuth = true;
  } catch {
    log.warn('No YouTube OAuth file — skipping upload');
  }

  const publishResult: PublishResult = {
    youtubeVideoId: '',
    youtubeUrl: '',
    status: 'approved',
  };

  if (hasYouTubeOAuth) {
    // Read publish params (set by schedule endpoint) or default to public
    let privacy: 'private' | 'unlisted' | 'public' = 'public';
    let scheduledTime: Date | undefined;
    try {
      const params = await readJsonFile<{ privacy?: string; scheduledTime?: string }>(
        join(outputDir, 'publish-params.json')
      );
      if (params.privacy === 'private' || params.privacy === 'unlisted' || params.privacy === 'public') {
        privacy = params.privacy;
      }
      if (params.scheduledTime) {
        scheduledTime = new Date(params.scheduledTime);
      }
    } catch {
      // No publish params file — use defaults
    }

    // Verify thumbnail file exists before passing to YouTube
    let thumbnailForUpload = compilation.thumbnailPath;
    if (thumbnailForUpload) {
      const thumbExists = await fileExists(thumbnailForUpload);
      if (!thumbExists) {
        log.warn(`Thumbnail file not found at ${thumbnailForUpload} — skipping thumbnail upload`);
        thumbnailForUpload = '';
      }
    }

    const ytResult = await uploadVideo(oauthPath, {
      videoPath: compilation.videoPath,
      thumbnailPath: thumbnailForUpload,
      title: scriptOutput.title,
      description: scriptOutput.description,
      hashtags: scriptOutput.hashtags,
      privacy,
      ...(scheduledTime ? { scheduledTime } : {}),
    });
    publishResult.youtubeVideoId = ytResult.youtubeVideoId;
    publishResult.youtubeUrl = ytResult.youtubeUrl;
    publishResult.status = 'published';
    log.info(`Video published: ${ytResult.youtubeUrl}`);

    // Upload teaser/short as a separate YouTube Short (long+short format only)
    if (compilation.teaserVideoPath && await fileExists(compilation.teaserVideoPath)) {
      try {
        const shortTitle = scriptOutput.title.length > 90
          ? scriptOutput.title.slice(0, 90) + '...'
          : scriptOutput.title;
        const shortResult = await uploadVideo(oauthPath, {
          videoPath: compilation.teaserVideoPath,
          thumbnailPath: '',
          title: `${shortTitle} #Shorts`,
          description: scriptOutput.description,
          hashtags: [...scriptOutput.hashtags, '#Shorts'],
          privacy,
          ...(scheduledTime ? { scheduledTime } : {}),
        });
        log.info(`Short published: ${shortResult.youtubeUrl}`);
        // Store short video ID alongside main video
        publishResult.shortVideoId = shortResult.youtubeVideoId;
        publishResult.shortUrl = shortResult.youtubeUrl;
      } catch (shortErr) {
        log.warn(`Short upload failed (non-fatal): ${(shortErr as Error).message}`);
      }
    }
  }

  context.publishResult = publishResult;
  await writeJsonFile(join(outputDir, 'publish-result.json'), publishResult);

  await updateStage(status, 'complete', outputDir);
  log.info(`Pipeline complete for "${scriptOutput.title}"`);

  // Archive all assets to Supabase after publish (cleanup disabled until archive is proven reliable)
  if (publishResult.status === 'published') {
    try {
      const { archiveProduction } = await import('./supabase-storage.js');
      const slug = context.channelConfig.channel.slug;
      const prodId = outputDir.split('/').pop() ?? 'unknown';
      await archiveProduction(slug, prodId, outputDir);
      log.info('Assets archived to Supabase');
    } catch (err) {
      log.warn(`Supabase archive failed (assets preserved locally): ${(err as Error).message}`);
    }

  }

  return context;
}


interface AssetGenerationResult {
  manifest: AssetManifest;
  teaserManifest?: AssetManifest | undefined;
}

async function generateAssets(
  config: ChannelConfig,
  channelDir: string,
  outputDir: string,
  scriptOutput: ScriptOutput,
  contentPlan?: ContentPlan,
): Promise<AssetGenerationResult> {
  const imageFramework = await loadFramework(channelDir, config.frameworks.image);
  const isMusicOnly = config.channel.format === 'music-only';
  const isShortOnly = config.channel.format === 'short';
  const hasTeaser = (config.channel.format === 'long+short')
    && scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0;
  const needsPortrait = isShortOnly || hasTeaser;

  const manifest: AssetManifest = {
    images: [],
    voiceover: [],
    music: [],
    animations: [],
  };

  // ========== MUSIC-ONLY: Multi-segment pipeline ==========
  // All prompts come from contentPlan.musicOnlyPrompts — constructed by the agent
  // using the channel's image-framework.md and animation-framework.md.
  // This code does not construct, modify, or append to prompts.
  if (isMusicOnly && contentPlan) {
    const prompts = contentPlan.musicOnlyPrompts;
    if (!prompts) {
      throw new PipelineError('Music-only pipeline requires musicOnlyPrompts in content plan', 'asset_generation');
    }

    const segmentCount = contentPlan.segmentCount ?? 1;
    const totalDuration = contentPlan.targetDurationSeconds;
    const segmentDuration = Math.floor(totalDuration / segmentCount);
    const musicDuration = 190; // Always generate max-length tracks; segments are trimmed at compile

    // Validate prompt arrays match segment count
    if (prompts.imagePrompts.length < segmentCount) {
      throw new PipelineError(
        `imagePrompts array (${prompts.imagePrompts.length}) must have at least ${segmentCount} entries`,
        'asset_generation'
      );
    }
    if (prompts.animationPrompts.length < segmentCount) {
      throw new PipelineError(
        `animationPrompts array (${prompts.animationPrompts.length}) must have at least ${segmentCount} entries`,
        'asset_generation'
      );
    }

    log.info(`Music-only pipeline: ${segmentCount} segment(s), ${segmentDuration}s each, ${totalDuration}s total`);

    // Load existing partial manifest if resuming after crash
    const partialManifestPath = join(outputDir, 'asset-manifest.json');
    if (await fileExists(partialManifestPath)) {
      try {
        const existing = await readJsonFile<AssetManifest>(partialManifestPath);
        manifest.images = existing.images ?? [];
        manifest.music = existing.music ?? [];
        manifest.animations = existing.animations ?? [];
        log.info(`Loaded partial manifest: ${manifest.images.length} images, ${manifest.music.length} music, ${manifest.animations.length} animations`);
      } catch { /* start fresh */ }
    }

    for (let i = 0; i < segmentCount; i++) {
      const pad = String(i).padStart(3, '0');

      // -- Image: skip if already exists on disk --
      const imagePath = join(outputDir, 'images', `image-${pad}.png`);
      if (await fileExists(imagePath) && manifest.images.some((a) => a.path === imagePath)) {
        log.info(`Segment ${i}: image already exists, skipping`);
      } else {
        const imagePrompt = prompts.imagePrompts[i];
        log.info(`Segment ${i}: image prompt = "${imagePrompt.slice(0, 80)}..."`);

        const imageAsset = await generateImage({
          prompt: imagePrompt,
          outputPath: imagePath,
        });
        // Replace or append
        const existIdx = manifest.images.findIndex((a) => a.path === imagePath);
        if (existIdx >= 0) manifest.images[existIdx] = imageAsset;
        else manifest.images.push(imageAsset);
      }

      // -- Animation: skip if already exists --
      const animPath = join(outputDir, 'animations', `anim-${pad}.mp4`);
      if (await fileExists(animPath) && manifest.animations.some((a) => a.path === animPath)) {
        log.info(`Segment ${i}: animation already exists, skipping`);
      } else if (process.env.RUNWAY_API_KEY) {
        try {
          const imageAsset = manifest.images.find((a) => a.path === imagePath)!;
          const imageData = await readFile(imageAsset.path);
          const base64 = imageData.toString('base64');
          const dataUri = `data:image/png;base64,${base64}`;
          const animPrompt = prompts.animationPrompts[i];

          const animAsset = await generateAnimation({
            imageUrl: dataUri,
            prompt: animPrompt,
            durationSeconds: 10,
            outputPath: animPath,
          });
          const existIdx = manifest.animations.findIndex((a) => a.path === animPath);
          if (existIdx >= 0) manifest.animations[existIdx] = animAsset;
          else manifest.animations.push(animAsset);
        } catch (err) {
          log.warn(`Animation ${i} failed (non-fatal): ${(err as Error).message}`);
        }
      }

      // -- Music: skip if already exists --
      const musicPath = join(outputDir, 'music', `music-${pad}.wav`);
      if (await fileExists(musicPath) && manifest.music.some((a) => a.path === musicPath)) {
        log.info(`Segment ${i}: music already exists, skipping`);
      } else {
        // Always use config.musicPrompt — locked per channel, never from content plan
        const musicPrompt = config.musicPrompt ?? prompts.musicPrompt ?? '';
        log.info(`Segment ${i}: music prompt = "${musicPrompt.slice(0, 80)}..." (${musicDuration}s)`);

        const musicAsset = await generateMusicStableAudio({
          prompt: musicPrompt,
          durationSeconds: musicDuration,
          outputPath: musicPath,
        });
        const existIdx = manifest.music.findIndex((a) => a.path === musicPath);
        if (existIdx >= 0) manifest.music[existIdx] = musicAsset;
        else manifest.music.push(musicAsset);
      }

      // Save manifest incrementally after each segment — crash-safe
      await writeJsonFile(partialManifestPath, manifest);
      log.info(`Segment ${i} complete: manifest saved (${manifest.images.length}i/${manifest.animations.length}a/${manifest.music.length}m)`);
    }

    return { manifest };
  }

  // ========== NARRATED: Original pipeline ==========
  // Load existing partial manifest if resuming after crash
  const partialManifestPath = join(outputDir, 'asset-manifest.json');
  if (await fileExists(partialManifestPath)) {
    try {
      const existing = await readJsonFile<AssetManifest>(partialManifestPath);
      if (existing.images?.length) manifest.images = existing.images;
      if (existing.voiceover?.length) manifest.voiceover = existing.voiceover;
      if (existing.music?.length) manifest.music = existing.music;
      if (existing.animations?.length) manifest.animations = existing.animations;
      if (existing.stockFootage?.length) manifest.stockFootage = existing.stockFootage;
      if (existing.portraitImages?.length) manifest.portraitImages = existing.portraitImages;
      log.info('Loaded partial manifest for resume');
    } catch { /* start fresh */ }
  }

  // Generate images from script cues — ground prompts via visual search + LLM first
  if (manifest.images.length === 0) {
    const topic = scriptOutput.productionBrief?.topic ?? '';

    // Step 1: Ground image cues with web search + Claude Haiku rewrite
    const cuesForGrounding = scriptOutput.script.map((section, i) => ({
      id: `section-${i}`,
      imageCue: section.imageCue,
      narration: section.narration,
    }));
    const groundingResults = await groundBatchPrompts(cuesForGrounding, topic, imageFramework);

    // Step 2: Build final cue list using grounded prompts
    const imageCues = scriptOutput.script.map((section, i) => {
      const id = `section-${i}`;
      const grounded = groundingResults.get(id);
      return {
        id,
        prompt: grounded?.groundedPrompt ?? section.imageCue,
      };
    });

    const imageResults = await generateBatchImages(
      imageCues,
      join(outputDir, 'images'),
      imageFramework,
      { generatePortrait: !!needsPortrait }
    );
    manifest.images = imageResults.landscape;
    if (imageResults.portrait.length > 0) {
      manifest.portraitImages = imageResults.portrait;
    }
    await writeJsonFile(partialManifestPath, manifest);
  } else {
    log.info(`Images already exist (${manifest.images.length}), skipping`);
  }

  // Search Archive.org for relevant stock footage
  if (!manifest.stockFootage?.length) {
    try {
      const cuesForSearch = scriptOutput.script.map((s, i) => ({
        index: i,
        sectionName: s.sectionName,
        narration: s.narration,
        imageCue: s.imageCue,
      }));
      const topic = scriptOutput.productionBrief?.topic ?? '';
      const footageMatches = await findFootageForCues(cuesForSearch, topic);

      if (footageMatches.size > 0) {
        const stockDir = join(outputDir, 'stock-footage');
        for (const [sectionIdx, clip] of footageMatches) {
          try {
            const asset = await downloadClip(clip, stockDir);
            if (!manifest.stockFootage) {
              manifest.stockFootage = [];
            }
            manifest.stockFootage.push({
              ...asset,
              metadata: {
                ...asset.metadata,
                sectionIndex: String(sectionIdx),
              },
            });
          } catch (dlErr) {
            log.warn(`Stock footage download failed for section ${sectionIdx}: ${(dlErr as Error).message}`);
          }
        }
        log.info(`Downloaded ${manifest.stockFootage?.length ?? 0} stock footage clips`);
        await writeJsonFile(partialManifestPath, manifest);
      }
    } catch (stockErr) {
      log.warn(`Stock footage search failed (non-fatal): ${(stockErr as Error).message}`);
    }
  } else {
    log.info('Stock footage already downloaded, skipping');
  }

  // Generate voiceover — chunked to stay under ElevenLabs 10k char limit
  const voPath = join(outputDir, 'voiceover', 'full-narration.mp3');
  if (manifest.voiceover.length === 0 || !(await fileExists(voPath))) {
    const MAX_CHARS = 9500;
    const sections = scriptOutput.script.map((s) => s.narration);
    const chunks: string[] = [];
    let current = '';
    for (const section of sections) {
      const addition = current ? '\n\n' + section : section;
      if (current.length + addition.length > MAX_CHARS && current) {
        chunks.push(current);
        current = section;
      } else {
        current = current ? current + '\n\n' + section : section;
      }
    }
    if (current) chunks.push(current);

    if (chunks.length === 1) {
      // Single chunk — generate directly to final path
      const voAsset = await generateVoiceover({
        text: chunks[0],
        voiceId: config.credentials.elevenLabsVoiceId,
        outputPath: voPath,
      });
      manifest.voiceover = [voAsset];
    } else {
      // Multiple chunks — generate parts then concatenate with FFmpeg
      log.info(`Script is ${sections.join('\n\n').length} chars — splitting into ${chunks.length} chunks`);
      const partPaths: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const partPath = join(outputDir, 'voiceover', `part-${String(i).padStart(3, '0')}.mp3`);
        await generateVoiceover({
          text: chunks[i],
          voiceId: config.credentials.elevenLabsVoiceId,
          outputPath: partPath,
        });
        partPaths.push(partPath);
      }
      // Concatenate parts using FFmpeg concat demuxer
      const { writeFile: writeFileRaw } = await import('fs/promises');
      const { execFile: execFileNode } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFileNode);
      const concatListPath = join(outputDir, 'voiceover', 'concat-list.txt');
      const concatList = partPaths.map((p) => `file '${p}'`).join('\n');
      await writeFileRaw(concatListPath, concatList);
      await execFileAsync('ffmpeg', [
        '-y', '-f', 'concat', '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy', voPath,
      ]);
      log.info(`Concatenated ${chunks.length} VO chunks → ${voPath}`);
      manifest.voiceover = [{
        id: (await import('node:crypto')).randomUUID(),
        path: voPath,
        type: 'voiceover',
        metadata: { voiceId: config.credentials.elevenLabsVoiceId, charCount: String(sections.join('\n\n').length) },
      }];
    }
    await writeJsonFile(partialManifestPath, manifest);
  } else {
    log.info('Voiceover already exists, skipping');
  }

  // Generate music via Stable Audio — prompt baked into channel config, FFmpeg loops to fill video
  const bgMusicPath = join(outputDir, 'music', 'background.wav');
  if (manifest.music.length === 0 || !(await fileExists(bgMusicPath))) {
    const musicPrompt = config.musicPrompt ?? '';
    if (!musicPrompt) {
      log.warn('No musicPrompt in channel config — skipping music generation');
    } else {
      const musicAsset = await generateMusicStableAudio({
        prompt: musicPrompt,
        durationSeconds: 120,
        outputPath: bgMusicPath,
      });
      manifest.music = [musicAsset];
      await writeJsonFile(partialManifestPath, manifest);
    }
  } else {
    log.info('Background music already exists, skipping');
  }

  // Generate separate teaser VO and build teaser manifest
  let teaserManifest: AssetManifest | undefined;
  if (hasTeaser && scriptOutput.teaserScript) {
    const teaserVoPath = join(outputDir, 'teaser', 'teaser-narration.mp3');
    let teaserVoAsset;
    if (await fileExists(teaserVoPath)) {
      log.info('Teaser voiceover already exists, skipping');
      teaserVoAsset = {
        id: 'teaser-voiceover',
        path: teaserVoPath,
        type: 'voiceover' as const,
        metadata: { voiceId: config.credentials.elevenLabsVoiceId, charCount: String(scriptOutput.teaserScript.map((s) => s.narration).join('\n\n').length) },
      };
    } else {
      log.info('Generating teaser voiceover');
      const teaserNarration = scriptOutput.teaserScript.map((s) => s.narration).join('\n\n');
      teaserVoAsset = await generateVoiceover({
        text: teaserNarration,
        voiceId: config.credentials.elevenLabsVoiceId,
        outputPath: teaserVoPath,
      });
    }

    const teaserImageCount = Math.min(scriptOutput.teaserScript.length, manifest.images.length);
    const portraitAvailable = manifest.portraitImages && manifest.portraitImages.length > 0;
    teaserManifest = {
      images: portraitAvailable
        ? manifest.portraitImages!.slice(0, teaserImageCount)
        : manifest.images.slice(0, teaserImageCount),
      voiceover: [teaserVoAsset],
      music: manifest.music,
      animations: [],
    };
  }

  return { manifest, teaserManifest };
}

async function compileVideo(
  config: ChannelConfig,
  channelDir: string,
  outputDir: string,
  manifest: AssetManifest,
  scriptOutput: ScriptOutput,
  teaserManifest?: AssetManifest
): Promise<CompilationResult> {
  const format = config.channel.format;
  let result: CompilationResult;

  if (format === 'music-only') {
    const introOutroOpts = config.introOutro ? {
      introPath: config.introOutro.introPath
        ? join(channelDir, config.introOutro.introPath)
        : undefined,
      outroPath: config.introOutro.outroPath
        ? join(channelDir, config.introOutro.outroPath)
        : undefined,
      crossfadeDuration: config.introOutro.crossfadeDuration,
    } : undefined;
    result = await compileMusicOnlyVideo(
      outputDir, manifest, '1920x1080', config.visualFilter, introOutroOpts
    );
  } else if (format === 'short') {
    // Use portrait images for shorts if available
    const shortManifest: AssetManifest = manifest.portraitImages?.length
      ? { ...manifest, images: manifest.portraitImages }
      : manifest;
    result = await compileShortFormVideo({
      outputDir,
      manifest: shortManifest,
      sections: scriptOutput.script,
      resolution: '1080x1920',
      ...(config.visualFilter ? { visualFilterPreset: config.visualFilter } : {}),
    });
  } else {
    // 'long' or 'long+short'
    result = await compileLongFormVideo({
      outputDir,
      manifest,
      sections: scriptOutput.script,
      ...(config.visualFilter ? { visualFilterPreset: config.visualFilter } : {}),
    });

    if (format === 'long+short' && scriptOutput.teaserScript && teaserManifest) {
      const teaserResult = await compileShortFormVideo({
        outputDir: join(outputDir, 'teaser'),
        manifest: teaserManifest,
        sections: scriptOutput.teaserScript,
        resolution: '1080x1920',
        ...(config.visualFilter ? { visualFilterPreset: config.visualFilter } : {}),
      });
      result.teaserVideoPath = teaserResult.videoPath;
    }
  }

  // Caption generation via ZapCap — shorts and teasers
  // For standalone 'short' format, caption the main video; for 'long+short', caption the teaser
  const captionTargetPath = format === 'short' ? result.videoPath : result.teaserVideoPath;
  if (config.captions?.provider === 'zapcap' && config.captions.templateId && captionTargetPath) {
    const { captionVideo } = await import('./zapcap-service.js');
    const { stat: statFile } = await import('fs/promises');
    try {
      const targetStats = await statFile(captionTargetPath);
      const targetSizeMB = targetStats.size / 1024 / 1024;

      // Free tier limits: 1.5 min duration, 200MB file size
      if (targetSizeMB > 200) {
        log.warn(`Video too large for ZapCap (${targetSizeMB.toFixed(1)}MB > 200MB), skipping captions`);
      } else {
        const captionedPath = captionTargetPath.replace('.mp4', '-captioned.mp4');
        await captionVideo({
          videoPath: captionTargetPath,
          outputPath: captionedPath,
          templateId: config.captions.templateId,
          language: config.captions.language ?? 'en',
        });
        const { rename: renameFile } = await import('fs/promises');
        await renameFile(captionedPath, captionTargetPath);
        log.info(`Captions applied: ${captionTargetPath}`);
      }
    } catch (err) {
      log.warn(`ZapCap captioning failed (non-fatal): ${(err as Error).message}`);
    }
  }

  // Thumbnail generation via NBPro — skip for music-only channels
  if (format !== 'music-only' && config.thumbnail) {
    const thumbnailPath = join(outputDir, 'thumbnail.png');
    // Use agent-provided prompt if available, otherwise build a fallback from script content
    let thumbnailPrompt = scriptOutput.productionBrief?.thumbnailDirection?.nbproPrompt;
    if (!thumbnailPrompt) {
      // Fallback: build prompt from title + first image cue
      const firstCue = scriptOutput.script[0]?.imageCue ?? '';
      const topic = scriptOutput.productionBrief?.topic ?? scriptOutput.title;
      thumbnailPrompt = `YouTube thumbnail for "${topic}". ${firstCue}. Cinematic, dramatic lighting, eye-catching composition.`;
      log.info('No thumbnailDirection.nbproPrompt in production brief — using fallback thumbnail prompt');
    }

    try {
      // Load system instruction from config path
      let systemInstruction: string | undefined;
      if (config.thumbnail.systemInstructionPath) {
        const { resolve } = await import('path');
        const projectRoot = resolve(channelDir, '..');
        const siPath = resolve(projectRoot, '..', config.thumbnail.systemInstructionPath);
        systemInstruction = await loadSystemInstruction(siPath);
      }

      const nbResult = await generateThumbnailNBPro({
        prompt: thumbnailPrompt,
        aspectRatio: (config.thumbnail.aspectRatio as '16:9' | '9:16') ?? '16:9',
        outputPath: thumbnailPath,
        resolution: (config.thumbnail.resolution as '2K' | '4K') ?? '4K',
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(config.thumbnail.model ? { model: config.thumbnail.model } : {}),
        ...(config.thumbnail.generationSettings ? { generationSettings: config.thumbnail.generationSettings } : {}),
      });
      result.thumbnailPath = nbResult.filePath;
      log.info(`NBPro thumbnail generated: ${nbResult.filePath}`);
    } catch (err) {
      log.warn(`NBPro thumbnail failed: ${(err as Error).message}. Thumbnail will be empty.`);
      result.thumbnailPath = '';
    }
  }

  return result;
}


/**
 * Telegram Checkpoint 1: Send asset previews to Telegram (non-blocking).
 * Returns the approval message ID for checkpoint tracking.
 */
async function sendAssetPreviewMessages(
  config: ChannelConfig,
  manifest: AssetManifest,
  contentPlan: ContentPlan
): Promise<number> {
  const segmentCount = contentPlan.segmentCount ?? 1;

  for (let i = 0; i < Math.min(segmentCount, manifest.images.length); i++) {
    const image = manifest.images[i];
    const music = manifest.music[i];
    const animation = manifest.animations[i];
    const segLabel = segmentCount > 1 ? `Segment ${i + 1}/${segmentCount}` : 'Preview';

    if (image) {
      await sendPhoto(image.path, `🖼 ${segLabel} — Image`);
    }
    if (animation) {
      await sendVideo(animation.path, `🎞 ${segLabel} — Animation`);
    }
    if (music) {
      await sendAudio(music.path, `🎵 ${segLabel} — Music`);
    }
  }

  const prompts = contentPlan.musicOnlyPrompts;
  const promptSummary = [
    `📋 Prompts Used:`,
    `🖼 Image (${prompts?.imagePrompts.length ?? 0} prompts): ${prompts?.imagePrompts[0]?.slice(0, 200) ?? 'none'}`,
    `🎵 Music: ${prompts?.musicPrompt ?? 'none'}`,
    `🎞 Animation (${prompts?.animationPrompts.length ?? 0} prompts): ${prompts?.animationPrompts[0]?.slice(0, 100) ?? 'none'}`,
  ].join('\n');
  await sendTextMessage(promptSummary);

  const messageId = await sendApprovalRequest({
    videoTitle: `Asset Preview — ${config.channel.name}`,
    youtubeUrl: '',
    channelName: config.channel.name,
  });

  return messageId;
}

/**
 * Telegram Checkpoint 2: Send final video preview to Telegram (non-blocking).
 * Returns the approval message ID for checkpoint tracking.
 */
async function sendFinalApprovalMessages(
  config: ChannelConfig,
  compilation: CompilationResult,
  scriptOutput: ScriptOutput
): Promise<number> {
  // Send preview clip to Telegram
  const previewPath = join(compilation.videoPath, '..', 'preview-clip.mp4');
  const PREVIEW_SECONDS = 20;
  try {
    await runFfmpegDirect([
      '-i', compilation.videoPath,
      '-t', String(PREVIEW_SECONDS),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      '-y', previewPath,
    ]);
    log.info(`Preview clip created: ${PREVIEW_SECONDS}s`);
  } catch {
    log.warn('Preview clip failed, skipping video in Telegram');
  }

  const durationMin = Math.floor(compilation.durationSeconds / 60);
  const durationSec = compilation.durationSeconds % 60;
  const durationDisplay = durationMin > 0
    ? `${durationMin}m ${durationSec}s`
    : `${durationSec}s`;

  const captionParts = [
    `🎬 ${scriptOutput.title}`,
    `📺 ${config.channel.name}`,
    `⏱ ${durationDisplay} (${PREVIEW_SECONDS}s preview)`,
    '',
    `📝 Description:`,
    scriptOutput.description.slice(0, 500) + (scriptOutput.description.length > 500 ? '...' : ''),
    '',
    `🏷 ${scriptOutput.hashtags.join(' ')}`,
    '',
    'Reply /approve to publish or /reject to discard.',
  ];
  const caption = captionParts.join('\n');

  const { stat: statFile } = await import('fs/promises');
  try {
    await statFile(previewPath);
    await sendVideo(previewPath, caption);
  } catch {
    log.warn('No preview clip to send');
  }
  const messageId = await sendApprovalRequest({
    videoTitle: scriptOutput.title,
    youtubeUrl: '',
    channelName: config.channel.name,
  });

  return messageId;
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
