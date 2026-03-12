import { readFile } from 'fs/promises';
import { join } from 'path';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load dotenv first
import { config } from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

import { generateVoiceover } from '../services/elevenlabs-service.js';
import { generateMusicElevenLabs } from '../services/elevenlabs-music-service.js';
import { generateMusic as generateMusicSonauto } from '../services/sonauto-service.js';
import { findFootageForCues, downloadClip } from '../services/archive-service.js';
import { writeJsonFile, ensureDir } from '../utils/file-helpers.js';
import { AssetManifest, AssetFile, ScriptOutput } from '../types/index.js';

const OUTPUT_DIR = join(
  PROJECT_ROOT,
  'projects/ch-strange-universe/output/20260312-183125-oqd0'
);
const VOICE_ID = 'EiNlNiXeDU1pqqOPrYMO';

async function main(): Promise<void> {
  console.log('=== Audio + Stock Footage Generation ===');
  console.log(`Output: ${OUTPUT_DIR}`);

  // Load script
  const scriptRaw = await readFile(join(OUTPUT_DIR, 'script-output.json'), 'utf-8');
  const scriptOutput: ScriptOutput = JSON.parse(scriptRaw);

  // Build image manifest from existing files
  const imagesDir = join(OUTPUT_DIR, 'images');
  const portraitDir = join(OUTPUT_DIR, 'images-portrait');
  const images: AssetFile[] = [];
  const portraits: AssetFile[] = [];

  for (let i = 0; i < scriptOutput.script.length; i++) {
    const prefix = `image-${String(i).padStart(3, '0')}-section-${i}`;
    images.push({
      id: `section-${i}`,
      path: join(imagesDir, `${prefix}.png`),
      type: 'image',
    });
    portraits.push({
      id: `section-${i}`,
      path: join(portraitDir, `${prefix}.png`),
      type: 'image',
    });
  }
  console.log(`Found ${images.length} landscape + ${portraits.length} portrait images`);

  const manifest: AssetManifest = {
    images,
    portraitImages: portraits,
    voiceover: [],
    music: [],
    animations: [],
    stockFootage: [],
  };

  // 1. Stock footage search
  console.log('\n--- Searching for stock footage ---');
  const footageCues = scriptOutput.script.map((section, i) => ({
    index: i,
    sectionName: section.sectionName,
    narration: section.narration,
    imageCue: section.imageCue,
  }));
  try {
    const footageMatches = await findFootageForCues(footageCues, 'UAP Disclosure');
    if (footageMatches.size > 0) {
      console.log(`Found stock footage for ${footageMatches.size} sections, downloading...`);
      const stockDir = join(OUTPUT_DIR, 'stock-footage');
      await ensureDir(stockDir);
      for (const [_idx, clip] of footageMatches) {
        try {
          const asset = await downloadClip(clip, stockDir);
          manifest.stockFootage!.push(asset);
        } catch (err) {
          console.warn(`Failed to download clip ${clip.identifier}: ${(err as Error).message}`);
        }
      }
      console.log(`Downloaded ${manifest.stockFootage!.length} stock clips`);
    } else {
      console.log('No suitable stock footage found');
    }
  } catch (err) {
    console.warn(`Stock footage search failed (non-fatal): ${(err as Error).message}`);
  }

  // 2. Generate full narration voiceover
  console.log('\n--- Generating full narration voiceover ---');
  const fullNarration = scriptOutput.script.map((s) => s.narration).join('\n\n');
  const voAsset = await generateVoiceover({
    text: fullNarration,
    voiceId: VOICE_ID,
    outputPath: join(OUTPUT_DIR, 'voiceover', 'full-narration.mp3'),
  });
  manifest.voiceover = [voAsset];
  console.log('Full narration voiceover generated');

  // 3. Generate teaser narration voiceover
  let teaserManifest: AssetManifest | undefined;
  if (scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0) {
    console.log('\n--- Generating teaser voiceover ---');
    const teaserNarration = scriptOutput.teaserScript.map((s) => s.narration).join('\n\n');
    const teaserVoAsset = await generateVoiceover({
      text: teaserNarration,
      voiceId: VOICE_ID,
      outputPath: join(OUTPUT_DIR, 'teaser', 'teaser-narration.mp3'),
    });

    // Teaser uses portrait images from matching script sections
    const teaserImageIndices = [16, 4, 24, 33, 35];
    const teaserImages = teaserImageIndices
      .filter((idx) => idx < portraits.length)
      .map((idx) => portraits[idx]);

    teaserManifest = {
      images: teaserImages.length >= scriptOutput.teaserScript.length
        ? teaserImages.slice(0, scriptOutput.teaserScript.length)
        : portraits.slice(0, scriptOutput.teaserScript.length),
      voiceover: [teaserVoAsset],
      music: [],
      animations: [],
    };
    console.log('Teaser voiceover generated');
  }

  // 4. Generate background music
  console.log('\n--- Generating background music ---');
  const brief = scriptOutput.productionBrief?.musicDirection;
  const musicPrompt = [
    '[GENRE + STYLE]: Dark cinematic ambient with electronic undertones, investigation documentary score',
    `[MOOD]: ${brief?.primaryMood ?? 'Investigative tension'} — ${brief?.supportingMoods?.[0] ?? 'quiet awe during revelations'}`,
    '[ENERGY]: Low — ambient background layer, never competing with spoken narration',
    '[INSTRUMENTATION]: Deep sub-bass synth drones, slow-evolving cold synth pads, sparse reverb-heavy piano, distant metallic textures, subtle low string sustains. No percussion. No melody.',
    '[TEMPO]: Slow and deliberate — 55-75 BPM or no discernible tempo',
    '[DYNAMICS]: Minimal dynamic variation — no sudden drops or surges. Subtle swells only at major section transitions.',
    '[STRUCTURE]: No lyrics. No prominent melodic hook. Continuous evolving atmospheric texture. Background presence only.',
    '[DURATION]: 15 minutes',
    `[ARC]: ${brief?.arc ?? 'Opens with sparse tension, builds subtly through the investigation, swells gently at key revelations, pulls back to reflective stillness for outro'}`,
    `[AVOID]: ${brief?.avoidMood ?? 'Horror stingers, triumphant tones, sci-fi cliches, anything upbeat or comedic'}`,
  ].join('\n');

  let musicAsset;
  try {
    musicAsset = await generateMusicElevenLabs({
      prompt: musicPrompt,
      durationSeconds: 120,
      outputPath: join(OUTPUT_DIR, 'music', 'background.mp3'),
      forceInstrumental: true,
    });
    console.log('Background music generated via ElevenLabs');
  } catch (err) {
    console.warn(`ElevenLabs music failed: ${(err as Error).message}`);
    console.log('Falling back to Sonauto...');
    musicAsset = await generateMusicSonauto({
      prompt: musicPrompt,
      durationSeconds: 120,
      outputPath: join(OUTPUT_DIR, 'music', 'background.mp3'),
      isInstrumental: true,
    });
    console.log('Background music generated via Sonauto');
  }
  manifest.music = [musicAsset];

  if (teaserManifest) {
    teaserManifest.music = manifest.music;
  }

  // 5. Save manifests
  await writeJsonFile(join(OUTPUT_DIR, 'asset-manifest.json'), manifest);
  if (teaserManifest) {
    await writeJsonFile(join(OUTPUT_DIR, 'teaser-manifest.json'), teaserManifest);
  }

  // 6. Pipeline status
  await writeJsonFile(join(OUTPUT_DIR, 'pipeline-status.json'), {
    stage: 'asset_generation_complete',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    topic: 'UAP Disclosure: Real or Hype?',
  });

  console.log('\n=== Audio + Stock Footage Generation Complete ===');
  console.log(`Images: ${manifest.images.length} landscape, ${portraits.length} portrait`);
  console.log(`Stock footage: ${manifest.stockFootage!.length} clips`);
  console.log(`Voiceover: ${manifest.voiceover.length} files`);
  console.log(`Music: ${manifest.music.length} files`);
}

main().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
