import { execFile } from 'child_process';
import { access, readFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';

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
import { uploadVideo } from './youtube-service.js';
import { sendApprovalRequest, pollForApproval, sendVideo, sendPhoto } from './telegram-service.js';

const execFileAsync = promisify(execFile);
const log = createLogger('pipeline');

async function runFfmpegDirect(args: string[]): Promise<void> {
  await execFileAsync('ffmpeg', args, { maxBuffer: 50 * 1024 * 1024 });
}

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

    // Stage: Compilation
    await updateStage(status, 'compilation', outputDir);
    log.info('Starting video compilation');
    context.compilationResult = await compileVideo(
      config, channelDir, outputDir, context.assetManifest, scriptOutput, assetResult.teaserManifest
    );
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

// -- Segment diversity pools for music-only multi-segment --
const SHOT_VARIATIONS = [
  'wide establishing shot',
  'medium shot',
  'close-up detail',
  'low angle looking up',
  'aerial overhead view',
  'over-the-shoulder perspective',
];

const TIME_PROGRESSION = [
  'golden hour warm light',
  'twilight fading sky',
  'night scene',
  'deep night, minimal light',
  'pre-dawn blue hour',
];

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
  if (isMusicOnly && contentPlan) {
    const segmentCount = contentPlan.segmentCount ?? 1;
    const totalDuration = contentPlan.targetDurationSeconds;
    const segmentDuration = Math.floor(totalDuration / segmentCount);
    const musicDuration = Math.min(segmentDuration, 120); // Stable Audio max ~190s, use 120s
    const prompts = contentPlan.musicOnlyPrompts;

    log.info(`Music-only pipeline: ${segmentCount} segment(s), ${segmentDuration}s each, ${totalDuration}s total`);

    for (let i = 0; i < segmentCount; i++) {
      const pad = String(i).padStart(3, '0');
      const shot = SHOT_VARIATIONS[i % SHOT_VARIATIONS.length];
      const time = TIME_PROGRESSION[i % TIME_PROGRESSION.length];

      // -- Image: apply diversity modifiers to base prompt --
      const baseImagePrompt = prompts?.imagePrompt ?? scriptOutput.script[0]?.imageCue ?? contentPlan.topic;
      const diverseImagePrompt = `${baseImagePrompt}. ${shot}, ${time}`;
      log.info(`Segment ${i}: image prompt = "${diverseImagePrompt.slice(0, 80)}..."`);

      const imageAsset = await generateImage({
        prompt: diverseImagePrompt,
        outputPath: join(outputDir, 'images', `image-${pad}.png`),
      });
      manifest.images.push(imageAsset);

      // -- Animation: Runway ML --
      if (process.env.RUNWAY_API_KEY) {
        try {
          const imageData = await readFile(imageAsset.path);
          const base64 = imageData.toString('base64');
          const dataUri = `data:image/png;base64,${base64}`;
          const animPrompt = prompts?.animationPrompt ?? 'Slow ambient motion, light pulses, fog drift, reflections shimmer. Static camera, no panning, no traveling motion. Loop-friendly';

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
      const musicPromptText = prompts?.musicPrompt ?? buildMusicPrompt(scriptOutput, musicFramework, musicDuration);
      log.info(`Segment ${i}: music prompt = "${musicPromptText.slice(0, 80)}..." (${musicDuration}s)`);

      const musicAsset = await generateMusicStableAudio({
        prompt: musicPromptText,
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

async function publishWithApproval(
  config: ChannelConfig,
  compilation: CompilationResult,
  scriptOutput: ScriptOutput
): Promise<PublishResult> {
  const oauthPath = join(getChannelDir(config.channel.slug), '.youtube-oauth.json');

  // Check if YouTube OAuth is available
  let hasYouTubeOAuth = false;
  try {
    await access(oauthPath);
    hasYouTubeOAuth = true;
  } catch {
    log.warn('No YouTube OAuth file — will send to Telegram for review only');
  }

  // Send preview clip + thumbnail to Telegram for review
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

  const caption = [
    `🎬 ${scriptOutput.title}`,
    `📺 ${config.channel.name}`,
    `⏱ ${compilation.durationSeconds}s total (${PREVIEW_SECONDS}s preview)`,
    '',
    'Reply "approve" to publish or "reject" to discard.',
  ].join('\n');

  const { stat: statFile } = await import('fs/promises');
  try {
    await statFile(previewPath);
    await sendVideo(previewPath, caption);
  } catch {
    log.warn('No preview clip to send');
  }
  if (compilation.thumbnailPath) {
    await sendPhoto(compilation.thumbnailPath, `Thumbnail: ${scriptOutput.title}`);
  }

  const messageId = await sendApprovalRequest({
    videoTitle: scriptOutput.title,
    youtubeUrl: '',
    channelName: config.channel.name,
  });

  const publishResult: PublishResult = {
    youtubeVideoId: '',
    youtubeUrl: '',
    status: 'pending_approval',
  };

  // Wait for approval
  const approved = await pollForApproval(messageId);

  if (!approved) {
    publishResult.status = 'rejected';
    log.warn(`Video rejected: ${scriptOutput.title}`);
    return publishResult;
  }

  // Upload to YouTube if OAuth is available
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
  } else {
    publishResult.status = 'approved';
    log.info(`Video approved (no YouTube upload — OAuth not configured)`);
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
