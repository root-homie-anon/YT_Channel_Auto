import { readFile } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { config } from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

import { generateMusicElevenLabs as generateMusic } from '../services/elevenlabs-music-service.js';
import { writeJsonFile, readJsonFile } from '../utils/file-helpers.js';
import { AssetManifest, ScriptOutput } from '../types/index.js';

const OUTPUT_DIR = join(
  PROJECT_ROOT,
  'projects/ch-strange-universe/output/20260312-170623-zdfw'
);

async function main(): Promise<void> {
  console.log('=== Music Generation via ElevenLabs ===');

  const scriptRaw = await readFile(join(OUTPUT_DIR, 'script-output.json'), 'utf-8');
  const scriptOutput: ScriptOutput = JSON.parse(scriptRaw);
  const brief = scriptOutput.productionBrief?.musicDirection;

  const musicPrompt = [
    'Dark cinematic ambient with subtle electronic undertones',
    brief?.primaryMood ?? 'investigative tension',
    'low energy',
    'instrumental, no lyrics, no vocals',
    'deep sub-bass synth drones, sparse reverb-heavy piano, distant metallic textures',
  ].join(', ');

  console.log(`Prompt: ${musicPrompt}`);

  const musicAsset = await generateMusic({
    prompt: musicPrompt,
    durationSeconds: 120,
    outputPath: join(OUTPUT_DIR, 'music', 'background.mp3'),
    forceInstrumental: true,
  });

  console.log(`Music saved: ${musicAsset.path}`);

  // Load existing manifest and update music
  const manifestPath = join(OUTPUT_DIR, 'asset-manifest.json');
  let manifest: AssetManifest;
  try {
    manifest = await readJsonFile<AssetManifest>(manifestPath);
  } catch {
    // If no manifest exists yet, read image/voiceover files from what was generated
    console.log('No existing manifest found, creating new one');
    manifest = { images: [], voiceover: [], music: [], animations: [] };
  }
  manifest.music = [musicAsset];
  await writeJsonFile(manifestPath, manifest);

  // Update teaser manifest too
  const teaserManifestPath = join(OUTPUT_DIR, 'teaser-manifest.json');
  try {
    const teaserManifest = await readJsonFile<AssetManifest>(teaserManifestPath);
    teaserManifest.music = [musicAsset];
    await writeJsonFile(teaserManifestPath, teaserManifest);
  } catch {
    // No teaser manifest yet, skip
  }

  // Update pipeline status
  await writeJsonFile(join(OUTPUT_DIR, 'pipeline-status.json'), {
    stage: 'compilation',
    startedAt: '2026-03-12T17:06:23.377Z',
    updatedAt: new Date().toISOString(),
    topic: 'UAP Caught on Film',
  });

  console.log('=== Music Generation Complete ===');
}

main().catch((err) => {
  console.error('Music generation failed:', err);
  process.exit(1);
});
