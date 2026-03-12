/**
 * Reuse existing images/VO from a previous production,
 * generate new music via ElevenLabs and thumbnail via NB2,
 * then recompile the video.
 *
 * Usage: npx tsx src/scripts/regen-music-thumbnail.ts <channel-slug> <production-id>
 */
import 'dotenv/config';
import { join, resolve, dirname } from 'path';
import { readFile, copyFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

import { generateMusicElevenLabs } from '../services/elevenlabs-music-service.js';
import { generateThumbnailNB2 } from '../services/nanobana-service.js';
import {
  compileLongFormVideo,
  compileShortFormVideo,
} from '../services/ffmpeg-service.js';
import { generateVoiceover } from '../services/elevenlabs-service.js';
import {
  AssetManifest,
  AssetFile,
  ScriptOutput,
} from '../types/index.js';
import { generateProductionId, writeJsonFile } from '../utils/file-helpers.js';
import { ensureDir } from '../utils/file-helpers.js';
import { loadChannelConfig } from '../utils/config-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

async function main(): Promise<void> {
  const [slug, prevId] = process.argv.slice(2);

  if (!slug || !prevId) {
    console.error('Usage: npx tsx src/scripts/regen-music-thumbnail.ts <channel-slug> <production-id>');
    process.exit(1);
  }

  const prevDir = join(PROJECT_ROOT, 'projects', slug, 'output', prevId);
  if (!existsSync(prevDir)) {
    console.error(`Previous production not found: ${prevDir}`);
    process.exit(1);
  }

  const config = await loadChannelConfig(slug);
  const scriptOutput: ScriptOutput = JSON.parse(
    await readFile(join(prevDir, 'script-output.json'), 'utf-8')
  );

  const newId = generateProductionId();
  const newDir = join(PROJECT_ROOT, 'projects', slug, 'output', newId);
  await ensureDir(newDir);

  console.log(`Production: ${newId}`);
  console.log(`Reusing assets from: ${prevId}`);
  console.log(`Script: "${scriptOutput.title}"`);

  // Copy images from previous production
  const prevImagesDir = join(prevDir, 'images');
  const newImagesDir = join(newDir, 'images');
  await ensureDir(newImagesDir);
  const imageFiles = await readdir(prevImagesDir);
  const images: AssetFile[] = [];
  for (const file of imageFiles) {
    await copyFile(join(prevImagesDir, file), join(newImagesDir, file));
    images.push({
      id: `section-${images.length}`,
      path: join(newImagesDir, file),
      type: 'image',
    });
  }
  console.log(`Copied ${images.length} images`);

  // Copy voiceover from previous production
  const prevVoDir = join(prevDir, 'voiceover');
  const newVoDir = join(newDir, 'voiceover');
  await ensureDir(newVoDir);
  const voFiles = await readdir(prevVoDir);
  const voiceover: AssetFile[] = [];
  for (const file of voFiles) {
    await copyFile(join(prevVoDir, file), join(newVoDir, file));
    voiceover.push({
      id: 'full-narration',
      path: join(newVoDir, file),
      type: 'voiceover',
    });
  }
  console.log(`Copied voiceover`);

  // Generate NEW music via ElevenLabs
  console.log('Generating music via ElevenLabs...');
  const musicPrompt = buildMusicPrompt(scriptOutput);
  const musicAsset = await generateMusicElevenLabs({
    prompt: musicPrompt,
    durationSeconds: 120, // 2-min segment, FFmpeg loops it
    outputPath: join(newDir, 'music', 'background.mp3'),
    forceInstrumental: true,
  });
  console.log(`Music generated: ${(await readFile(musicAsset.path)).length / 1024 / 1024}MB`);

  // Build manifest
  const manifest: AssetManifest = {
    images,
    voiceover,
    music: [musicAsset],
    animations: [],
  };
  await writeJsonFile(join(newDir, 'asset-manifest.json'), manifest);

  // Save script output
  await writeJsonFile(join(newDir, 'script-output.json'), scriptOutput);
  await writeJsonFile(join(newDir, 'content-plan.json'), {
    topic: scriptOutput.title,
    angle: scriptOutput.title,
    keyPoints: [],
    targetDurationSeconds: scriptOutput.script.reduce((sum, s) => sum + s.durationSeconds, 0),
    format: config.channel.format,
  });

  // Compile long-form video
  console.log('Compiling long-form video...');
  const longResult = await compileLongFormVideo({
    outputDir: newDir,
    manifest,
    sections: scriptOutput.script,
  });
  console.log(`Long video: ${longResult.durationSeconds}s, ${(longResult.fileSizeBytes / 1024 / 1024).toFixed(1)}MB`);

  // Compile teaser with separate VO
  if (scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0) {
    console.log('Generating teaser voiceover...');
    const teaserDir = join(newDir, 'teaser');
    await ensureDir(teaserDir);

    const teaserNarration = scriptOutput.teaserScript.map((s) => s.narration).join('\n\n');
    const teaserVoAsset = await generateVoiceover({
      text: teaserNarration,
      voiceId: config.credentials.elevenLabsVoiceId,
      outputPath: join(teaserDir, 'teaser-narration.mp3'),
    });

    const teaserImageCount = Math.min(scriptOutput.teaserScript.length, images.length);
    const teaserManifest: AssetManifest = {
      images: images.slice(0, teaserImageCount),
      voiceover: [teaserVoAsset],
      music: [musicAsset],
      animations: [],
    };

    console.log('Compiling teaser...');
    const teaserResult = await compileShortFormVideo({
      outputDir: teaserDir,
      manifest: teaserManifest,
      sections: scriptOutput.teaserScript,
      resolution: '1080x1920',
    });
    longResult.teaserVideoPath = teaserResult.videoPath;
    console.log(`Teaser: ${teaserResult.durationSeconds}s`);
  }

  // Generate NB2 thumbnail
  console.log('Generating NB2 thumbnail...');
  const thumbnailPath = join(newDir, 'thumbnail.png');
  try {
    const thumbnailPrompt = buildThumbnailPrompt(scriptOutput);
    const nb2Result = await generateThumbnailNB2({
      prompt: thumbnailPrompt,
      aspectRatio: '16:9',
      outputPath: thumbnailPath,
      resolution: '4K',
    });
    longResult.thumbnailPath = nb2Result.filePath;
    console.log(`Thumbnail generated: ${nb2Result.filePath}`);
  } catch (err) {
    console.error(`NB2 thumbnail failed: ${(err as Error).message}`);
  }

  // Save compilation result
  await writeJsonFile(join(newDir, 'compilation-result.json'), longResult);
  await writeJsonFile(join(newDir, 'pipeline-status.json'), {
    stage: 'approval',
    startedAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('\nDone!');
  console.log(`Output: ${newDir}`);
  console.log(`Video: ${longResult.videoPath}`);
  console.log(`Teaser: ${longResult.teaserVideoPath ?? 'none'}`);
  console.log(`Thumbnail: ${longResult.thumbnailPath}`);
}

function buildMusicPrompt(scriptOutput: ScriptOutput): string {
  const brief = scriptOutput.productionBrief?.musicDirection;
  const mood = brief?.primaryMood?.split('--')[0]?.trim() ?? 'investigative tension';
  return [
    'Dark cinematic ambient with subtle electronic undertones',
    mood,
    brief?.energyLevel ? `${brief.energyLevel} energy` : 'low energy',
    'instrumental, no lyrics, no vocals',
  ].join(', ');
}

function buildThumbnailPrompt(scriptOutput: ScriptOutput): string {
  const td = scriptOutput.productionBrief?.thumbnailDirection;
  if (!td) {
    return `Dark cinematic thumbnail for "${scriptOutput.title}". High contrast, documentary aesthetic, 16:9.`;
  }
  return [
    `[SUBJECT]: ${td.primaryConcept}`,
    `[MOOD]: ${td.emotionalHook}`,
    `[COMPOSITION]: ${td.compositionNote}. Subject left-of-center, negative space upper-right for text, dark vignette border fading to black at edges.`,
    `[STYLE]: Dark cinematic photorealism, documentary aesthetic, film grain, moody atmospheric lighting.`,
    `[COLOR]: Deep navy and near-black background, cold steel blue midtones, amber or cold white accent on focal element. High contrast separation.`,
    `[TEXT]: "${td.textOverlay}" — upper-right zone — bold white or amber on dark background, large and commanding.`,
    `[AVOID]: Aliens, flying saucers, cartoonish elements, bright colors, busy backgrounds, visible human faces, cheesy sci-fi aesthetics.`,
    `[SPECS]: 16:9 aspect ratio, 4K resolution, thumbnail-optimized, mobile-readable at 320px width.`,
  ].join('\n');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
