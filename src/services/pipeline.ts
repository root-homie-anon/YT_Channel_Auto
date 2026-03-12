import { readFile } from 'fs/promises';
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
import { generateVoiceover } from './elevenlabs-service.js';
import { generateMusicElevenLabs } from './elevenlabs-music-service.js';
import { generateAnimation } from './runway-service.js';
import { findFootageForCues, downloadClip } from './archive-service.js';
import {
  compileLongFormVideo,
  compileShortFormVideo,
  compileMusicOnlyVideo,
} from './ffmpeg-service.js';
import { generateThumbnailNB2 } from './nanobana-service.js';
import { uploadVideo, updateVideoPrivacy } from './youtube-service.js';
import { sendApprovalRequest, pollForApproval } from './telegram-service.js';

const log = createLogger('pipeline');

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
    const assetResult = await generateAssets(config, channelDir, outputDir, scriptOutput);
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

async function generateAssets(
  config: ChannelConfig,
  channelDir: string,
  outputDir: string,
  scriptOutput: ScriptOutput
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

  // Generate images from script cues
  // For long+short and short formats, also generate 9:16 portrait variants
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

  // Search Archive.org for relevant stock footage to supplement generated images
  // Only downloads clips for sections where real footage matches the content
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
          // Store as stockFootage in manifest for FFmpeg to use
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

  // Runway ML animation — music-only channels ONLY
  // Long/short formats use Ken Burns (FFmpeg zoompan) instead
  if (isMusicOnly && manifest.images.length > 0 && process.env.RUNWAY_API_KEY) {
    log.info(`Generating Runway ML animations for ${manifest.images.length} images (music-only)`);
    for (let i = 0; i < manifest.images.length; i++) {
      const image = manifest.images[i];
      const section = scriptOutput.script[i];
      try {
        const imageData = await readFile(image.path);
        const base64 = imageData.toString('base64');
        const mimeType = image.path.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${base64}`;

        const animAsset = await generateAnimation({
          imageUrl: dataUri,
          prompt: section?.imageCue ?? 'Subtle slow cinematic motion',
          durationSeconds: 4,
          outputPath: join(outputDir, 'animations', `anim-${String(i).padStart(3, '0')}.mp4`),
        });
        manifest.animations.push(animAsset);
      } catch (err) {
        log.warn(`Animation ${i} failed (non-fatal): ${(err as Error).message}`);
      }
    }
  }

  // Generate single voiceover from full script (skip for music-only)
  if (!isMusicOnly) {
    const fullNarration = scriptOutput.script.map((s) => s.narration).join('\n\n');
    const voAsset = await generateVoiceover({
      text: fullNarration,
      voiceId: config.credentials.elevenLabsVoiceId,
      outputPath: join(outputDir, 'voiceover', 'full-narration.mp3'),
    });
    manifest.voiceover = [voAsset];
  }

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

    // Teaser manifest: use portrait images for shorts if available, otherwise fall back to landscape
    const teaserImageCount = Math.min(scriptOutput.teaserScript.length, manifest.images.length);
    const portraitAvailable = manifest.portraitImages && manifest.portraitImages.length > 0;
    teaserManifest = {
      images: portraitAvailable
        ? manifest.portraitImages!.slice(0, teaserImageCount)
        : manifest.images.slice(0, teaserImageCount),
      voiceover: [teaserVoAsset],
      music: manifest.music, // reuse same music
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

  // Generate thumbnail via NB2 (Nano Banana 2 / Gemini image gen)
  const thumbnailPath = join(outputDir, 'thumbnail.png');
  try {
    const thumbnailPrompt = buildThumbnailPrompt(config, channelDir, scriptOutput);
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

  return result;
}

/**
 * Build a cinematic NB2 prompt inspired by high-performing YouTube thumbnails.
 *
 * Style reference: massive integrated text dominating 40-50% of the image,
 * epic cinematic scenes with depth (foreground silhouette → midground structures
 * → background atmosphere), volumetric lighting, dramatic scale contrast,
 * and atmospheric color grading (deep blues, purples, ambers).
 */
function buildThumbnailPrompt(
  _config: ChannelConfig,
  _channelDir: string,
  scriptOutput: ScriptOutput
): string {
  const td = scriptOutput.productionBrief?.thumbnailDirection;
  const textOverlay = td?.textOverlay ?? scriptOutput.title.split(' ').slice(0, 3).join(' ').toUpperCase();

  // Scene description from production brief or generic epic scene
  const scene = td
    ? `${td.primaryConcept}. ${td.compositionNote}`
    : `Dark cinematic scene related to "${scriptOutput.title}"`;

  const mood = td?.emotionalHook ?? 'awe and mystery';

  return [
    // Scene — paint a vivid, epic, layered composition
    `Epic cinematic scene: ${scene}.`,
    `The scene has dramatic depth with three layers: a dark silhouetted foreground element, detailed midground subject matter, and atmospheric background fading into moody sky.`,
    `Volumetric fog and atmospheric haze between layers creates cinematic depth.`,
    `Scale contrast: the scene feels massive and overwhelming, dwarfing any human-scale elements.`,
    '',
    // Text — the defining feature, MASSIVE and integrated
    `CRITICAL TEXT REQUIREMENT: The words "${textOverlay}" must be rendered as ENORMOUS bold text across the lower-left portion of the image.`,
    `The text must be the single most dominant visual element, covering approximately 40-50% of the image width.`,
    `Text style: ultra-bold, wide tracking, pure bright white with subtle shadow for depth. The letters should feel monumental and powerful.`,
    `The text must be integrated into the scene composition — it should feel like it belongs in the image, not pasted on top.`,
    '',
    // Style and color
    `Color palette: deep navy blues (#0a1628), rich purples, and near-black shadows. Accent lighting in amber, electric blue, or cold white on focal elements.`,
    `Style: dark cinematic photorealism with film grain, dramatic atmospheric lighting, high production value.`,
    `Mood: ${mood}.`,
    `Lighting: dramatic volumetric rays, rim lighting on key elements, strong contrast between lit and shadow areas.`,
    '',
    // Technical
    `Image must have extremely high contrast — bright elements pop against deep dark backgrounds.`,
    `Must be clearly readable and impactful at small thumbnail size (320px width).`,
    `16:9 aspect ratio, 4K resolution.`,
    '',
    // Avoid
    `Avoid: cartoonish or campy elements, bright cheerful colors, busy cluttered compositions, soft low-contrast look, visible human faces, watermarks, cheap stock photo aesthetic. The image should look like a frame from a high-budget documentary or cinematic trailer.`,
  ].join('\n');
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
