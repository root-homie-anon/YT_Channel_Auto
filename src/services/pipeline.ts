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
import { sendApprovalRequest, pollForApproval, sendVideo, sendPhoto, sendAudio } from './telegram-service.js';

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

    // Stage: Asset Preview (Telegram Checkpoint 1 — approve assets before compilation)
    if (config.channel.format === 'music-only' && context.assetManifest) {
      await updateStage(status, 'asset_preview', outputDir);
      log.info('Sending asset previews to Telegram for approval');
      const assetApproved = await sendAssetPreview(config, context.assetManifest, contentPlan);
      if (!assetApproved) {
        throw new PipelineError('Assets rejected during preview', 'asset_preview');
      }
      log.info('Assets approved — proceeding to compilation');
    }

    // Stage: Compilation
    await updateStage(status, 'compilation', outputDir);
    log.info('Starting video compilation');
    context.compilationResult = await compileVideo(
      config, channelDir, outputDir, context.assetManifest, scriptOutput, assetResult.teaserManifest
    );
    await writeJsonFile(join(outputDir, 'compilation-result.json'), context.compilationResult);

    // Stage: Metadata Generation (music-only channels generate title/desc/tags from frameworks)
    if (config.channel.format === 'music-only') {
      await updateStage(status, 'metadata_generation', outputDir);
      log.info('Generating metadata from frameworks');
      await generateMusicOnlyMetadata(config, channelDir, contentPlan, scriptOutput, context.compilationResult);
      await writeJsonFile(join(outputDir, 'script-output.json'), scriptOutput);
      log.info(`Metadata generated — title: "${scriptOutput.title}"`);
    }

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
    const musicDuration = Math.min(segmentDuration, 190); // Stable Audio 2.5 max 190s
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
 * Telegram Checkpoint 1: Send asset previews for approval before compilation.
 * Sends one image + one music sample per segment. Waits for approve/reject.
 */
async function sendAssetPreview(
  config: ChannelConfig,
  manifest: AssetManifest,
  contentPlan: ContentPlan
): Promise<boolean> {
  const segmentCount = contentPlan.segmentCount ?? 1;

  // Send each segment's image and a short music preview
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

  // Send prompts used so user can review what was sent to APIs
  const prompts = contentPlan.musicOnlyPrompts;
  const promptSummary = [
    `📋 Prompts Used:`,
    `🖼 Image: ${prompts?.imagePrompt?.slice(0, 200) ?? 'default'}`,
    `🎵 Music: ${prompts?.musicPrompt ?? 'default'}`,
    `🎞 Animation: ${prompts?.animationPrompt ?? 'default'}`,
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

  const approved = await pollForApproval(messageId);
  return approved;
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
  const imageWords = prompts?.imagePrompt?.split(/[\s,]+/).filter(w => w.length > 3) ?? [];
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
    prompts?.imagePrompt ? `Visual direction: ${prompts.imagePrompt.split('.')[0]}.` : '',
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
