import { readFile, readdir } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';

import { config } from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

import { generateMusicElevenLabs as generateMusic } from '../services/elevenlabs-music-service.js';
import { writeJsonFile } from '../utils/file-helpers.js';
import { AssetManifest, AssetFile, ScriptOutput } from '../types/index.js';

const OUTPUT_DIR = join(
  PROJECT_ROOT,
  'projects/ch-strange-universe/output/20260312-170623-zdfw'
);

async function main(): Promise<void> {
  console.log('=== Building Asset Manifest + Generating Music ===');

  const scriptRaw = await readFile(join(OUTPUT_DIR, 'script-output.json'), 'utf-8');
  const scriptOutput: ScriptOutput = JSON.parse(scriptRaw);

  // Build image manifest from generated files
  const imageDir = join(OUTPUT_DIR, 'images');
  const portraitDir = join(OUTPUT_DIR, 'images-portrait');
  const imageFiles = (await readdir(imageDir)).filter(f => f.endsWith('.png')).sort();
  const portraitFiles = (await readdir(portraitDir)).filter(f => f.endsWith('.png')).sort();

  const images: AssetFile[] = imageFiles.map((f, i) => ({
    id: `section-${i}`,
    path: join(imageDir, f),
    type: 'image' as const,
    metadata: { prompt: scriptOutput.script[i]?.imageCue ?? '' },
  }));

  const portraitImages: AssetFile[] = portraitFiles.map((f, i) => ({
    id: `section-${i}`,
    path: join(portraitDir, f),
    type: 'image' as const,
    metadata: { prompt: scriptOutput.script[i]?.imageCue ?? '' },
  }));

  // Voiceover
  const voiceover: AssetFile[] = [{
    id: randomUUID(),
    path: join(OUTPUT_DIR, 'voiceover', 'full-narration.mp3'),
    type: 'voiceover' as const,
    metadata: { voiceId: 'EiNlNiXeDU1pqqOPrYMO' },
  }];

  console.log(`Images: ${images.length} landscape, ${portraitImages.length} portrait`);
  console.log(`Voiceover: ${voiceover.length} files`);

  // Generate music via ElevenLabs
  console.log('\n--- Generating background music via ElevenLabs ---');
  const brief = scriptOutput.productionBrief?.musicDirection;
  const musicPrompt = [
    'Dark cinematic ambient with subtle electronic undertones',
    brief?.primaryMood ?? 'investigative tension',
    'low energy',
    'instrumental, no lyrics, no vocals',
    'deep sub-bass synth drones, sparse reverb-heavy piano, distant metallic textures',
  ].join(', ');

  const musicAsset = await generateMusic({
    prompt: musicPrompt,
    durationSeconds: 120,
    outputPath: join(OUTPUT_DIR, 'music', 'background.mp3'),
    forceInstrumental: true,
  });
  console.log(`Music saved: ${musicAsset.path}`);

  // Build full manifest
  const manifest: AssetManifest = {
    images,
    portraitImages,
    voiceover,
    music: [musicAsset],
    animations: [],
  };

  await writeJsonFile(join(OUTPUT_DIR, 'asset-manifest.json'), manifest);
  console.log('Asset manifest saved');

  // Build teaser manifest
  const teaserImageCount = Math.min(
    scriptOutput.teaserScript?.length ?? 0,
    portraitImages.length
  );
  const teaserManifest: AssetManifest = {
    images: portraitImages.slice(0, teaserImageCount),
    voiceover: [{
      id: randomUUID(),
      path: join(OUTPUT_DIR, 'teaser', 'teaser-narration.mp3'),
      type: 'voiceover' as const,
      metadata: { voiceId: 'EiNlNiXeDU1pqqOPrYMO' },
    }],
    music: [musicAsset],
    animations: [],
  };

  await writeJsonFile(join(OUTPUT_DIR, 'teaser-manifest.json'), teaserManifest);
  console.log('Teaser manifest saved');

  // Update pipeline status
  await writeJsonFile(join(OUTPUT_DIR, 'pipeline-status.json'), {
    stage: 'compilation',
    startedAt: '2026-03-12T17:06:23.377Z',
    updatedAt: new Date().toISOString(),
    topic: 'UAP Caught on Film',
  });

  console.log('\n=== All Assets Complete ===');
  console.log(`Total: ${images.length} landscape images, ${portraitImages.length} portrait images, 1 voiceover, 1 teaser voiceover, 1 music track`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
