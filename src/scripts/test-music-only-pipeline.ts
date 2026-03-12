/**
 * Test script for music-only pipeline.
 * Tests: Flux image gen → Runway animation → Sonauto music → FFmpeg loop/compile
 * Skips: YouTube upload, Telegram checkpoints
 *
 * Usage: npx tsx src/scripts/test-music-only-pipeline.ts
 */

import { readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { generateImage } from '../services/flux-service.js';
import { generateAnimation } from '../services/runway-service.js';
import { generateMusic } from '../services/replicate-audio-service.js';
import { compileMusicOnlyVideo } from '../services/ffmpeg-service.js';
import { ensureDir } from '../utils/file-helpers.js';
import { AssetManifest, AssetFile } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

const OUTPUT_DIR = join(PROJECT_ROOT, 'projects', 'ch-liminal-synth', 'output', 'test-run');

// -- Config --
const IMAGE_PROMPT =
  'Elevated highway stretching to a perfect vanishing point at the horizon, neon grid lines on the road surface, ' +
  'massive retro-futuristic skyline on both sides, low-hanging full moon casting everything in pink and orange haze. ' +
  'Hot pink, electric blue, deep purple, neon orange horizon. 16:9 aspect ratio, cinematic quality, loop-friendly composition.';

const ANIMATION_PROMPT =
  'Subtle forward motion along neon grid road, city lights pulsing slowly, moon glow shifting gently. Hypnotic, steady, loop-friendly.';

const MUSIC_PROMPT =
  'Synthwave retrowave instrumental. Synthesizer arpeggios, gated reverb drums, bass synth, lead synth with slow attack. ' +
  'Nostalgic, driving, neon-lit, 80s forward motion. 110 BPM. No lyrics. Continuous seamless flow.';

const MUSIC_DURATION_SECONDS = 90; // 90s test — Stable Audio 2.5 max is 190s

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  console.log(`\n── ${name} ──`);
  try {
    await fn();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  ✓ ${name} complete (${elapsed}s)`);
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`  ✗ ${name} failed (${elapsed}s):`, (err as Error).message);
    throw err;
  }
}

async function main(): Promise<void> {
  console.log('Music-Only Pipeline Test');
  console.log(`Output: ${OUTPUT_DIR}\n`);

  await ensureDir(OUTPUT_DIR);
  await ensureDir(join(OUTPUT_DIR, 'images'));
  await ensureDir(join(OUTPUT_DIR, 'animations'));
  await ensureDir(join(OUTPUT_DIR, 'music'));

  const manifest: AssetManifest = {
    images: [],
    voiceover: [],
    music: [],
    animations: [],
  };

  // Step 1: Generate image via Flux
  let imageAsset: AssetFile;
  await step('Image Generation (Flux)', async () => {
    imageAsset = await generateImage({
      prompt: IMAGE_PROMPT,
      outputPath: join(OUTPUT_DIR, 'images', 'segment-001.png'),
      width: 1408,
      height: 768,
    });
    manifest.images.push(imageAsset);
    console.log(`  → Image: ${imageAsset.path}`);
  });

  // Step 2: Animate image via Runway ML
  await step('Animation Generation (Runway ML)', async () => {
    const imageData = await readFile(imageAsset!.path);
    const base64 = imageData.toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;

    const animAsset = await generateAnimation({
      imageUrl: dataUri,
      prompt: ANIMATION_PROMPT,
      durationSeconds: 10,
      outputPath: join(OUTPUT_DIR, 'animations', 'anim-001.mp4'),
    });
    manifest.animations.push(animAsset);
    console.log(`  → Animation: ${animAsset.path}`);
  });

  // Step 3: Generate music via Sonauto
  await step('Music Generation (Sonauto)', async () => {
    const musicAsset = await generateMusic({
      prompt: MUSIC_PROMPT,
      durationSeconds: MUSIC_DURATION_SECONDS,
      outputPath: join(OUTPUT_DIR, 'music', 'track-001.wav'),
    });
    manifest.music.push(musicAsset);
    console.log(`  → Music: ${musicAsset.path}`);
  });

  // Step 4: Compile — loop animation to fill music duration
  await step('Video Compilation (FFmpeg loop)', async () => {
    const result = await compileMusicOnlyVideo(OUTPUT_DIR, manifest);
    console.log(`  → Video: ${result.videoPath}`);
    console.log(`  → Duration: ${result.durationSeconds}s`);
  });

  console.log('\n── All steps complete ──');
  console.log(`Final output: ${join(OUTPUT_DIR, 'music-video.mp4')}`);
}

main().catch((err) => {
  console.error('\nPipeline test failed:', err);
  process.exit(1);
});
