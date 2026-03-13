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
} from '../types/index.js';
import {
  getChannelDir,
  getOutputDir,
  loadChannelConfig,
  loadFramework,
} from '../utils/config-loader.js';
import { generateProductionId, readJsonFile, writeJsonFile } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

import { generateBatchImages, generateImage } from './flux-service.js';
import { generateVoiceover } from './elevenlabs-service.js';
import { generateMusicElevenLabs } from './elevenlabs-music-service.js';
import { generateMusic as generateMusicStableAudio } from './replicate-audio-service.js';
import { generateAnimation } from './runway-service.js';
import { findFootageForCues, downloadClip } from './archive-service.js';
import {
  compileLongFormVideo,
  compileShortFormVideo,
  compileMusicOnlyVideo,
} from './ffmpeg-service.js';
import { generateThumbnailNB2 } from './nanobana-service.js';
import { advanceRotationState } from './rotation-state.js';
import { uploadVideo } from './youtube-service.js';
import { sendApprovalRequest, sendVideo, sendPhoto, sendAudio } from './telegram-service.js';

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

    // Non-music-only channels: continue straight to compilation
    return await runFromCompilation(channelSlug, productionId, config, channelDir, outputDir, contentPlan, scriptOutput, context, status, assetResult.teaserManifest);
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
    if (status.stage === 'compilation') {
      // Resuming after asset approval — run compilation through to final checkpoint
      const manifest = await readJsonFile<AssetManifest>(join(outputDir, 'asset-manifest.json'));
      context.assetManifest = manifest;
      return await runFromCompilation(channelSlug, productionId, config, channelDir, outputDir, contentPlan, scriptOutput, context, status);
    }

    if (status.stage === 'publishing') {
      // Resuming after final approval — upload to YouTube
      const compilation = await readJsonFile<CompilationResult>(join(outputDir, 'compilation-result.json'));
      context.compilationResult = compilation;
      return await runFromPublishing(config, outputDir, compilation, scriptOutput, context, status);
    }

    throw new PipelineError(`Cannot resume pipeline at stage "${status.stage}"`, status.stage);
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

  // Stage: Compilation
  await updateStage(status, 'compilation', outputDir);
  log.info('Starting video compilation');
  context.compilationResult = await compileVideo(
    config, channelDir, outputDir, manifest, scriptOutput, teaserManifest
  );
  await writeJsonFile(join(outputDir, 'compilation-result.json'), context.compilationResult);

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

  // Stage: Metadata Generation (music-only channels generate title/desc/tags from frameworks)
  if (config.channel.format === 'music-only') {
    await updateStage(status, 'metadata_generation', outputDir);
    log.info('Generating metadata from frameworks');
    await generateMusicOnlyMetadata(config, channelDir, contentPlan, scriptOutput, context.compilationResult);
    await writeJsonFile(join(outputDir, 'script-output.json'), scriptOutput);
    log.info(`Metadata generated — title: "${scriptOutput.title}"`);
  }

  // Stage: Send final approval (Telegram Checkpoint 2 — non-blocking)
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
    const ytResult = await uploadVideo(oauthPath, {
      videoPath: compilation.videoPath,
      thumbnailPath: compilation.thumbnailPath,
      title: scriptOutput.title,
      description: scriptOutput.description,
      tags: scriptOutput.tags,
      hashtags: scriptOutput.hashtags,
      privacy: 'public',
    });
    publishResult.youtubeVideoId = ytResult.youtubeVideoId;
    publishResult.youtubeUrl = ytResult.youtubeUrl;
    publishResult.status = 'published';
    log.info(`Video published: ${ytResult.youtubeUrl}`);
  }

  context.publishResult = publishResult;
  await writeJsonFile(join(outputDir, 'publish-result.json'), publishResult);

  await updateStage(status, 'complete', outputDir);
  log.info(`Pipeline complete for "${scriptOutput.title}"`);

  return context;
}

/**
 * Build a music prompt from the production brief and music framework.
 * Uses the framework's Sonauto prompt template structure with production
 * brief overrides for mood, arc, and instrumentation.
 */
function buildMusicPrompt(
  scriptOutput: ScriptOutput,
  musicFramework: string,
  _durationSeconds: number
): string {
  const brief = scriptOutput.productionBrief?.musicDirection;

  // Extract genre/style from framework
  const genreMatch = musicFramework.match(/\*\*Genre:\*\*\s*(.+)/);
  const genre = genreMatch?.[1]?.split('—')[0]?.trim() ?? 'Dark cinematic ambient';

  // Extract default instrumentation from framework
  const instrumentMatch = musicFramework.match(/\*\*Default Instrumentation:\*\*\n([\s\S]*?)(?=\n\*\*)/);
  const instruments = instrumentMatch?.[1]
    ?.split('\n')
    .map(l => l.replace(/^-\s*/, '').trim())
    .filter(Boolean)
    .join(', ') ?? 'deep sub-bass synth drones, sparse reverb-heavy piano, distant metallic textures';

  const mood = brief?.primaryMood ?? 'investigative tension';
  const supportingMoods = brief?.supportingMoods?.join(', ') ?? '';
  const energy = brief?.energyLevel ?? 'Low';
  const arc = brief?.arc ?? 'Opens sparse and tense, builds subtle layers, pulls back to reflective stillness';
  const avoid = brief?.avoidMood ?? 'Horror stingers, sci-fi cliches, triumphant fanfares';

  return [
    `${genre}, investigation documentary score.`,
    `Mood: ${mood}.${supportingMoods ? ` ${supportingMoods}.` : ''}`,
    `Energy: ${energy} — ambient background layer, never competing with spoken narration.`,
    `Instrumentation: ${instruments}. No percussion. No melody.`,
    `Tempo: Slow and deliberate, 55-75 BPM or no discernible tempo.`,
    `Structure: No lyrics. No prominent melodic hook. Continuous evolving atmospheric texture.`,
    `Arc: ${arc}.`,
    `Avoid: ${avoid}.`,
  ].join('\n');
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
  const musicFramework = await loadFramework(channelDir, config.frameworks.music);
  const isMusicOnly = config.channel.format === 'music-only';
  const hasTeaser = (config.channel.format === 'long+short' || config.channel.format === 'short')
    && scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0;

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
    const musicDuration = Math.min(segmentDuration, 190); // Stable Audio 2.5 max 190s

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

    for (let i = 0; i < segmentCount; i++) {
      const pad = String(i).padStart(3, '0');

      // -- Image: prompt comes from agent, passed through unchanged --
      const imagePrompt = prompts.imagePrompts[i];
      log.info(`Segment ${i}: image prompt = "${imagePrompt.slice(0, 80)}..."`);

      const imageAsset = await generateImage({
        prompt: imagePrompt,
        outputPath: join(outputDir, 'images', `image-${pad}.png`),
      });
      manifest.images.push(imageAsset);

      // -- Animation: Runway Gen-4 Turbo --
      // Prompt comes from agent (selected from animation-framework.md confirmed library)
      if (process.env.RUNWAY_API_KEY) {
        try {
          const imageData = await readFile(imageAsset.path);
          const base64 = imageData.toString('base64');
          const dataUri = `data:image/png;base64,${base64}`;
          const animPrompt = prompts.animationPrompts[i];

          const animAsset = await generateAnimation({
            imageUrl: dataUri,
            prompt: animPrompt,
            durationSeconds: 10,
            outputPath: join(outputDir, 'animations', `anim-${pad}.mp4`),
          });
          manifest.animations.push(animAsset);
        } catch (err) {
          log.warn(`Animation ${i} failed (non-fatal): ${(err as Error).message}`);
        }
      }

      // -- Music: Stable Audio 2.5 --
      // Single music prompt used for all segments (same sonic identity)
      log.info(`Segment ${i}: music prompt = "${prompts.musicPrompt.slice(0, 80)}..." (${musicDuration}s)`);

      const musicAsset = await generateMusicStableAudio({
        prompt: prompts.musicPrompt,
        durationSeconds: musicDuration,
        outputPath: join(outputDir, 'music', `music-${pad}.wav`),
      });
      manifest.music.push(musicAsset);

      log.info(`Segment ${i} complete: image + animation + music`);
    }

    return { manifest };
  }

  // ========== NARRATED: Original pipeline ==========
  // Generate images from script cues
  const imageCues = scriptOutput.script.map((section, i) => ({
    id: `section-${i}`,
    prompt: section.imageCue,
  }));
  const imageResults = await generateBatchImages(
    imageCues,
    join(outputDir, 'images'),
    imageFramework,
    { generatePortrait: !!hasTeaser }
  );
  manifest.images = imageResults.landscape;
  if (imageResults.portrait.length > 0) {
    manifest.portraitImages = imageResults.portrait;
  }

  // Search Archive.org for relevant stock footage
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
    }
  } catch (stockErr) {
    log.warn(`Stock footage search failed (non-fatal): ${(stockErr as Error).message}`);
  }

  // Generate single voiceover from full script
  const fullNarration = scriptOutput.script.map((s) => s.narration).join('\n\n');
  const voAsset = await generateVoiceover({
    text: fullNarration,
    voiceId: config.credentials.elevenLabsVoiceId,
    outputPath: join(outputDir, 'voiceover', 'full-narration.mp3'),
  });
  manifest.voiceover = [voAsset];

  // Generate 2-min music segment via ElevenLabs — FFmpeg loops it to fill the video
  const musicPrompt = buildMusicPrompt(scriptOutput, musicFramework, 120);
  const musicAsset = await generateMusicElevenLabs({
    prompt: musicPrompt,
    durationSeconds: 120,
    outputPath: join(outputDir, 'music', 'background.mp3'),
    forceInstrumental: true,
  });
  manifest.music = [musicAsset];

  // Generate separate teaser VO and build teaser manifest
  let teaserManifest: AssetManifest | undefined;
  if (hasTeaser && scriptOutput.teaserScript) {
    log.info('Generating teaser voiceover');
    const teaserNarration = scriptOutput.teaserScript.map((s) => s.narration).join('\n\n');
    const teaserVoAsset = await generateVoiceover({
      text: teaserNarration,
      voiceId: config.credentials.elevenLabsVoiceId,
      outputPath: join(outputDir, 'teaser', 'teaser-narration.mp3'),
    });

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
    result = await compileMusicOnlyVideo(outputDir, manifest, '1920x1080', config.visualFilter);
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

    if (format === 'long+short' && scriptOutput.teaserScript && teaserManifest) {
      const teaserResult = await compileShortFormVideo({
        outputDir: join(outputDir, 'teaser'),
        manifest: teaserManifest,
        sections: scriptOutput.teaserScript,
        resolution: '1080x1920',
      });
      result.teaserVideoPath = teaserResult.videoPath;
    }
  }

  // Generate thumbnail via NB2 — skip for music-only channels
  if (format !== 'music-only') {
    const thumbnailPath = join(outputDir, 'thumbnail.png');
    try {
      const thumbnailFramework = await loadFramework(channelDir, config.frameworks.thumbnail);
      const thumbnailPrompt = buildThumbnailPrompt(config, thumbnailFramework, scriptOutput);
      const nb2Result = await generateThumbnailNB2({
        prompt: thumbnailPrompt,
        aspectRatio: '16:9',
        outputPath: thumbnailPath,
        resolution: '4K',
      });
      result.thumbnailPath = nb2Result.filePath;
      log.info(`NB2 thumbnail generated: ${nb2Result.filePath}`);
    } catch (err) {
      log.warn(`NB2 thumbnail failed: ${(err as Error).message}. Thumbnail will be empty.`);
      result.thumbnailPath = '';
    }
  }

  return result;
}

/**
 * Build a thumbnail prompt using the channel's thumbnail framework.
 * The framework contains all channel-specific style, palette, composition, and text rules.
 */
function buildThumbnailPrompt(
  _config: ChannelConfig,
  thumbnailFramework: string,
  scriptOutput: ScriptOutput
): string {
  const td = scriptOutput.productionBrief?.thumbnailDirection;
  const textOverlay = td?.textOverlay ?? scriptOutput.title.split(' ').slice(0, 3).join(' ').toUpperCase();
  const scene = td
    ? `${td.primaryConcept}. ${td.compositionNote}`
    : `Cinematic scene related to "${scriptOutput.title}"`;
  const mood = td?.emotionalHook ?? 'awe and mystery';

  return [
    `Generate a YouTube thumbnail image.`,
    '',
    `## Channel Style Guide (from framework)`,
    thumbnailFramework,
    '',
    `## This Video`,
    `Title: ${scriptOutput.title}`,
    `Scene: ${scene}`,
    `Mood: ${mood}`,
    `Text overlay: "${textOverlay}"`,
    '',
    `## Requirements`,
    `16:9 aspect ratio, 4K resolution.`,
    `Must be clearly readable and impactful at small thumbnail size (320px width).`,
  ].join('\n');
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
  await sendApprovalRequest({
    videoTitle: promptSummary,
    youtubeUrl: '',
    channelName: config.channel.name,
  });

  const messageId = await sendApprovalRequest({
    videoTitle: `Asset Preview — ${config.channel.name}`,
    youtubeUrl: '',
    channelName: config.channel.name,
  });

  return messageId;
}

/**
 * Generate title, description, tags, and hashtags for music-only channels.
 * Reads title-formula.md and description-formula.md frameworks, then builds
 * metadata based on the content plan prompts and compilation result.
 * Mutates scriptOutput in place.
 */
async function generateMusicOnlyMetadata(
  _config: ChannelConfig,
  _channelDir: string,
  contentPlan: ContentPlan,
  scriptOutput: ScriptOutput,
  compilation: CompilationResult
): Promise<void> {
  const prompts = contentPlan.musicOnlyPrompts;
  const topic = contentPlan.topic;
  const segmentCount = contentPlan.segmentCount ?? 1;
  const totalDuration = compilation.durationSeconds;

  // Extract keywords from prompts for SEO
  const imageWords = prompts?.imagePrompts[0]?.split(/[\s,]+/).filter(w => w.length > 3) ?? [];
  const musicWords = prompts?.musicPrompt?.split(/[\s,]+/).filter(w => w.length > 3) ?? [];
  const allKeywords = [...new Set([...imageWords, ...musicWords])];

  // Build genre/mood from music prompt
  const musicPrompt = prompts?.musicPrompt ?? topic;
  const genreMatch = musicPrompt.match(/^([^,]+)/);
  const genre = genreMatch?.[1]?.trim() ?? topic;

  // Extract mood descriptors from music prompt
  const moodWords = ['Melancholic', 'Atmospheric', 'Energetic', 'Dark', 'Ethereal',
    'Dreamy', 'Intense', 'Calm', 'Mysterious', 'Euphoric', 'Nostalgic', 'Cool',
    'Ambient', 'Cinematic', 'Epic', 'Chill', 'Uplifting', 'Haunting'];
  const moods = moodWords.filter(m => musicPrompt.toLowerCase().includes(m.toLowerCase()));
  const moodStr = moods.length > 0 ? moods.slice(0, 2).join(' & ') : 'Atmospheric';

  // Extract BPM if present
  const bpmMatch = musicPrompt.match(/(\d+)\s*BPM/i);
  const bpm = bpmMatch?.[1] ?? '';

  // Format duration for display
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);
  const durationStr = hours > 0
    ? `${hours}h ${minutes}m`
    : `${minutes} min`;

  // --- Generate Title ---
  // Use title formula patterns: keyword front-loaded, 50-60 chars, curiosity/specificity
  const titleCandidates = [
    `${genre} — ${moodStr} ${topic} Mix`,
    `${topic}: ${durationStr} of ${moodStr} ${genre}`,
    `${moodStr} ${genre} | ${topic} Session`,
    `${genre} — ${segmentCount > 1 ? `${segmentCount} Scenes` : 'Full Session'} [${durationStr}]`,
  ];
  // Pick shortest title that's under 70 chars and over 20 chars
  const title = titleCandidates.find(t => t.length >= 20 && t.length <= 70) ?? titleCandidates[0]!;
  scriptOutput.title = title.slice(0, 70);
  log.info(`Generated title: "${scriptOutput.title}" (${scriptOutput.title.length} chars)`);

  // --- Generate Tags ---
  const baseTags = [
    topic.toLowerCase(),
    genre.toLowerCase(),
    ...moods.map(m => m.toLowerCase()),
    'ambient', 'music', 'mix',
  ];
  if (bpm) baseTags.push(`${bpm}bpm`);
  // Add relevant keywords from prompts (cleaned)
  const cleanKeywords = allKeywords
    .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 3 && !baseTags.includes(w));
  scriptOutput.tags = [...new Set([...baseTags, ...cleanKeywords.slice(0, 10)])].slice(0, 20);

  // --- Generate Hashtags ---
  // Mix broad + niche, 3-5 hashtags per formula
  const broadHashtags = [`#${genre.replace(/\s+/g, '')}`, '#ambient', '#music'];
  const nicheHashtags = moods.slice(0, 2).map(m => `#${m.toLowerCase()}`);
  scriptOutput.hashtags = [...new Set([...broadHashtags, ...nicheHashtags])].slice(0, 5);

  // --- Generate Description ---
  // Follow description-formula.md structure:
  // 1. Compelling one-liner
  // 2. Video summary
  // 3. Timestamps/chapters (if multi-segment)
  // 4. Links section
  // 5. Hashtags
  const oneLiner = `${moodStr} ${genre.toLowerCase()} — ${durationStr} of immersive ${topic.toLowerCase()} to study, relax, or drift away to.`;

  const summary = [
    `${segmentCount > 1 ? `${segmentCount} unique scenes` : 'A single immersive scene'} of ${genre.toLowerCase()},`,
    `each with distinct visuals and ${bpm ? `${bpm} BPM` : 'ambient'} production.`,
    prompts?.imagePrompts[0] ? `Visual direction: ${prompts.imagePrompts[0].split('.')[0]}.` : '',
  ].filter(Boolean).join(' ');

  const descParts = [oneLiner, '', summary];

  // Chapter markers for multi-segment
  // YouTube requires: first chapter at 0:00, min 3 chapters, min 10s each
  if (segmentCount > 1) {
    descParts.push('');
    const CROSSFADE = 3.0; // matches SEGMENT_CROSSFADE in ffmpeg-service
    const segDuration = totalDuration / segmentCount;

    // Abstract song names — placeholder pool until prompt-driven generation is wired in
    // TODO: Replace with prompt-interpreted names once prompt structure is finalized
    const SCENE_NAMES = [
      'Neon Drift',
      'Chrome Horizon',
      'Vapor Circuit',
      'Midnight Signal',
      'Pulse Decay',
      'Static Bloom',
      'Phantom Grid',
      'Hollow Frequency',
      'Afterglow',
      'Terminal Haze',
      'Silhouette',
      'Data Rain',
      'Ghost Protocol',
      'Solar Wind',
      'Echo Chamber',
    ];

    for (let i = 0; i < segmentCount; i++) {
      const offsetSec = i === 0 ? 0 : Math.round(i * segDuration - i * CROSSFADE);
      const h = Math.floor(offsetSec / 3600);
      const m = Math.floor((offsetSec % 3600) / 60);
      const s = offsetSec % 60;
      const ts = h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
      const sceneName = SCENE_NAMES[i % SCENE_NAMES.length];
      descParts.push(`${ts} ${sceneName}`);
    }
  }

  // Links placeholder
  descParts.push(
    '',
    '---',
    'Subscribe for more ambient music sessions.',
  );

  // Hashtags at end
  descParts.push('', scriptOutput.hashtags.join(' '));

  scriptOutput.description = descParts.join('\n');
  log.info(`Generated description (${scriptOutput.description.length} chars, ${segmentCount} chapters)`);
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
    `🏷 Tags: ${scriptOutput.tags.slice(0, 10).join(', ')}`,
    `# ${scriptOutput.hashtags.join(' ')}`,
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
  if (compilation.thumbnailPath && config.channel.format !== 'music-only') {
    await sendPhoto(compilation.thumbnailPath, `Thumbnail: ${scriptOutput.title}`);
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
