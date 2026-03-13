import { readFile } from 'fs/promises';
import { join } from 'path';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load dotenv first
import { config } from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

import { generateBatchImages } from '../services/flux-service.js';
import { generateVoiceover } from '../services/elevenlabs-service.js';
import { generateMusicElevenLabs } from '../services/elevenlabs-music-service.js';
import { generateMusic as generateMusicSonauto } from '../services/sonauto-service.js';
import { findFootageForCues, downloadClip } from '../services/archive-service.js';
import { loadFramework } from '../utils/config-loader.js';
import { writeJsonFile, ensureDir } from '../utils/file-helpers.js';
import { AssetManifest, ScriptOutput } from '../types/index.js';

const OUTPUT_DIR = join(
  PROJECT_ROOT,
  'projects/ch-strange-universe/output/20260312-183125-oqd0'
);
const CHANNEL_DIR = join(PROJECT_ROOT, 'projects/ch-strange-universe');
const VOICE_ID = 'EiNlNiXeDU1pqqOPrYMO';

async function main(): Promise<void> {
  console.log('=== Asset Generation Start ===');
  console.log(`Output: ${OUTPUT_DIR}`);

  // Load script output
  const scriptRaw = await readFile(join(OUTPUT_DIR, 'script-output.json'), 'utf-8');
  const scriptOutput: ScriptOutput = JSON.parse(scriptRaw);

  // Load frameworks
  const imageFramework = await loadFramework(CHANNEL_DIR, 'frameworks/image-framework.md');

  const manifest: AssetManifest = {
    images: [],
    voiceover: [],
    music: [],
    animations: [],
    stockFootage: [],
  };

  // 1. Generate images (landscape + portrait for long+short format)
  console.log(`\n--- Generating ${scriptOutput.script.length} images (landscape + portrait) ---`);
  const imageCues = scriptOutput.script.map((section, i) => ({
    id: `section-${i}`,
    prompt: section.imageCue,
  }));
  const imageResults = await generateBatchImages(
    imageCues,
    join(OUTPUT_DIR, 'images'),
    imageFramework,
    { generatePortrait: true }
  );
  manifest.images = imageResults.landscape;
  if (imageResults.portrait.length > 0) {
    manifest.portraitImages = imageResults.portrait;
  }
  console.log(`Generated ${manifest.images.length} landscape + ${imageResults.portrait.length} portrait images`);

  // 2. Find and download stock footage for relevant sections
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
      console.log('No suitable stock footage found (continuing with generated images)');
    }
  } catch (err) {
    console.warn(`Stock footage search failed (non-fatal): ${(err as Error).message}`);
  }

  // 3. Generate full narration voiceover
  console.log('\n--- Generating full narration voiceover ---');
  const fullNarration = scriptOutput.script.map((s) => s.narration).join('\n\n');
  const voAsset = await generateVoiceover({
    text: fullNarration,
    voiceId: VOICE_ID,
    outputPath: join(OUTPUT_DIR, 'voiceover', 'full-narration.mp3'),
  });
  manifest.voiceover = [voAsset];
  console.log('Full narration voiceover generated');

  // 4. Generate teaser narration voiceover
  let teaserManifest: AssetManifest | undefined;
  if (scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0) {
    console.log('\n--- Generating teaser voiceover ---');
    const teaserNarration = scriptOutput.teaserScript.map((s) => s.narration).join('\n\n');
    const teaserVoAsset = await generateVoiceover({
      text: teaserNarration,
      voiceId: VOICE_ID,
      outputPath: join(OUTPUT_DIR, 'teaser', 'teaser-narration.mp3'),
    });

    // Map teaser image cues to portrait images from the main script
    // Teaser reuses images from the long-form: find matching cues
    const teaserImageIndices = [16, 4, 24, 33, 35]; // hangar, envelope, parchment, empty chair, desert
    const portraitAvailable = manifest.portraitImages && manifest.portraitImages.length > 0;
    const teaserImages = teaserImageIndices
      .filter((idx) => idx < manifest.images.length)
      .map((idx) => portraitAvailable ? manifest.portraitImages![idx] : manifest.images[idx])
      .filter(Boolean);

    teaserManifest = {
      images: teaserImages.length > 0 ? teaserImages : (portraitAvailable
        ? manifest.portraitImages!.slice(0, scriptOutput.teaserScript.length)
        : manifest.images.slice(0, scriptOutput.teaserScript.length)),
      voiceover: [teaserVoAsset],
      music: [], // will be filled after music gen
      animations: [],
    };
    console.log('Teaser voiceover generated');
  }

  // 5. Generate music via ElevenLabs (fall back to Sonauto on error)
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

  // Update teaser manifest with music
  if (teaserManifest) {
    teaserManifest.music = manifest.music;
  }

  // 6. Save manifests
  await writeJsonFile(join(OUTPUT_DIR, 'asset-manifest.json'), manifest);
  if (teaserManifest) {
    await writeJsonFile(join(OUTPUT_DIR, 'teaser-manifest.json'), teaserManifest);
  }

  // 7. Update pipeline status
  await writeJsonFile(join(OUTPUT_DIR, 'pipeline-status.json'), {
    stage: 'asset_generation_complete',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    topic: 'UAP Disclosure: Real or Hype?',
  });

  console.log('\n=== Asset Generation Complete ===');
  console.log(`Images: ${manifest.images.length} landscape, ${imageResults.portrait.length} portrait`);
  console.log(`Stock footage: ${manifest.stockFootage!.length} clips`);
  console.log(`Voiceover: ${manifest.voiceover.length} files`);
  console.log(`Music: ${manifest.music.length} files`);
  console.log(`Asset manifest saved to: ${join(OUTPUT_DIR, 'asset-manifest.json')}`);
}

main().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
