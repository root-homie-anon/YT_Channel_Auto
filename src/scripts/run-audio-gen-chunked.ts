import { readFile } from 'fs/promises';
import { join } from 'path';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

// Load dotenv first
import { config } from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

import { generateVoiceover } from '../services/elevenlabs-service.js';
import { generateMusic as generateMusicSonauto } from '../services/sonauto-service.js';
import { writeJsonFile, ensureDir } from '../utils/file-helpers.js';
import { AssetManifest, AssetFile, ScriptOutput } from '../types/index.js';

const execFileAsync = promisify(execFile);

const OUTPUT_DIR = join(
  PROJECT_ROOT,
  'projects/ch-strange-universe/output/20260312-183125-oqd0'
);
const VOICE_ID = 'EiNlNiXeDU1pqqOPrYMO';

// ElevenLabs flash v2.5 costs ~0.5 credits per character
// We have ~2035 credits remaining, so ~4070 chars max
const MAX_CHARS_PER_BATCH = 3800; // Leave some margin

async function concatAudioFiles(files: string[], outputPath: string): Promise<void> {
  await ensureDir(join(outputPath, '..'));

  // Create concat list file
  const listPath = join(outputPath, '..', 'concat-list.txt');
  const listContent = files.map((f) => `file '${f}'`).join('\n');
  const { writeFile: wf } = await import('fs/promises');
  await wf(listPath, listContent);

  await execFileAsync('ffmpeg', [
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    '-y',
    outputPath,
  ]);
}

async function main(): Promise<void> {
  console.log('=== Chunked Audio + Music Generation ===');
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

  // Build stock footage list from existing downloads
  const stockFootage: AssetFile[] = [];
  try {
    const { readdir } = await import('fs/promises');
    const stockDir = join(OUTPUT_DIR, 'stock-footage');
    const stockFiles = await readdir(stockDir);
    for (const f of stockFiles) {
      if (f.endsWith('.mp4') || f.endsWith('.ogv')) {
        stockFootage.push({
          id: f.replace(/\.[^.]+$/, ''),
          path: join(stockDir, f),
          type: 'animation',
        });
      }
    }
    console.log(`Found ${stockFootage.length} existing stock footage clips`);
  } catch {
    console.log('No stock footage directory found');
  }

  const manifest: AssetManifest = {
    images,
    portraitImages: portraits,
    voiceover: [],
    music: [],
    animations: [],
    stockFootage,
  };

  // 1. Generate voiceover in chunks
  console.log('\n--- Generating voiceover (chunked to fit credit limit) ---');
  const voiceoverDir = join(OUTPUT_DIR, 'voiceover');
  await ensureDir(voiceoverDir);

  // Split sections into chunks that fit within credit limits
  const chunks: { sections: number[]; text: string }[] = [];
  let currentChunk: { sections: number[]; text: string } = { sections: [], text: '' };

  for (let i = 0; i < scriptOutput.script.length; i++) {
    const section = scriptOutput.script[i];
    const newText = currentChunk.text
      ? currentChunk.text + '\n\n' + section.narration
      : section.narration;

    if (newText.length > MAX_CHARS_PER_BATCH && currentChunk.text.length > 0) {
      // Start a new chunk
      chunks.push(currentChunk);
      currentChunk = { sections: [i], text: section.narration };
    } else {
      currentChunk.sections.push(i);
      currentChunk.text = newText;
    }
  }
  if (currentChunk.text.length > 0) {
    chunks.push(currentChunk);
  }

  console.log(`Split narration into ${chunks.length} chunks:`);
  chunks.forEach((c, i) => {
    console.log(`  Chunk ${i}: sections ${c.sections[0]}-${c.sections[c.sections.length - 1]}, ${c.text.length} chars`);
  });

  const chunkFiles: string[] = [];
  let creditsExhausted = false;

  for (let i = 0; i < chunks.length; i++) {
    if (creditsExhausted) {
      console.log(`Skipping chunk ${i} — credits exhausted`);
      continue;
    }

    const chunk = chunks[i];
    const chunkPath = join(voiceoverDir, `chunk-${String(i).padStart(2, '0')}.mp3`);
    console.log(`Generating chunk ${i}: ${chunk.text.length} chars (~${Math.ceil(chunk.text.length * 0.5)} credits)...`);

    try {
      await generateVoiceover({
        text: chunk.text,
        voiceId: VOICE_ID,
        outputPath: chunkPath,
      });
      chunkFiles.push(chunkPath);
      console.log(`Chunk ${i} generated successfully`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('quota_exceeded') || msg.includes('401')) {
        console.warn(`Credits exhausted at chunk ${i}. Generated ${chunkFiles.length}/${chunks.length} chunks.`);
        creditsExhausted = true;
      } else {
        throw err;
      }
    }
  }

  if (chunkFiles.length === 0) {
    console.error('ERROR: Could not generate any voiceover chunks. Cannot proceed.');
    process.exit(1);
  }

  // Concatenate chunks into single file
  const fullVoPath = join(voiceoverDir, 'full-narration.mp3');
  if (chunkFiles.length === 1) {
    const { copyFile } = await import('fs/promises');
    await copyFile(chunkFiles[0], fullVoPath);
  } else {
    console.log(`Concatenating ${chunkFiles.length} chunks...`);
    await concatAudioFiles(chunkFiles, fullVoPath);
  }
  console.log(`Full narration saved: ${fullVoPath}`);

  manifest.voiceover = [{
    id: 'full-narration',
    path: fullVoPath,
    type: 'voiceover',
    metadata: { voiceId: VOICE_ID, chunks: String(chunkFiles.length), totalChunks: String(chunks.length) },
  }];

  // 2. Generate teaser narration voiceover
  let teaserManifest: AssetManifest | undefined;
  if (scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0 && !creditsExhausted) {
    console.log('\n--- Generating teaser voiceover ---');
    const teaserNarration = scriptOutput.teaserScript.map((s) => s.narration).join('\n\n');
    console.log(`Teaser narration: ${teaserNarration.length} chars`);

    try {
      const teaserVoAsset = await generateVoiceover({
        text: teaserNarration,
        voiceId: VOICE_ID,
        outputPath: join(OUTPUT_DIR, 'teaser', 'teaser-narration.mp3'),
      });

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
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('quota_exceeded') || msg.includes('401')) {
        console.warn('Credits exhausted — skipping teaser voiceover');
        creditsExhausted = true;
      } else {
        throw err;
      }
    }
  } else if (scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0) {
    console.log('Skipping teaser voiceover — credits already exhausted');
  }

  // Build teaser manifest without VO if needed
  if (!teaserManifest && scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0) {
    const teaserImageIndices = [16, 4, 24, 33, 35];
    const teaserImages = teaserImageIndices
      .filter((idx) => idx < portraits.length)
      .map((idx) => portraits[idx]);

    teaserManifest = {
      images: teaserImages.length >= scriptOutput.teaserScript.length
        ? teaserImages.slice(0, scriptOutput.teaserScript.length)
        : portraits.slice(0, scriptOutput.teaserScript.length),
      voiceover: manifest.voiceover, // Reuse full narration as fallback
      music: [],
      animations: [],
    };
  }

  // 3. Generate background music via Sonauto (skip ElevenLabs to preserve voice credits)
  console.log('\n--- Generating background music via Sonauto ---');
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

  const musicAsset = await generateMusicSonauto({
    prompt: musicPrompt,
    durationSeconds: 120,
    outputPath: join(OUTPUT_DIR, 'music', 'background.mp3'),
    isInstrumental: true,
  });
  console.log('Background music generated via Sonauto');
  manifest.music = [musicAsset];

  if (teaserManifest) {
    teaserManifest.music = manifest.music;
  }

  // 4. Save manifests
  await writeJsonFile(join(OUTPUT_DIR, 'asset-manifest.json'), manifest);
  if (teaserManifest) {
    await writeJsonFile(join(OUTPUT_DIR, 'teaser-manifest.json'), teaserManifest);
  }

  // 5. Pipeline status
  await writeJsonFile(join(OUTPUT_DIR, 'pipeline-status.json'), {
    stage: 'asset_generation_complete',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    topic: 'UAP Disclosure: Real or Hype?',
  });

  console.log('\n=== Audio + Music Generation Complete ===');
  console.log(`Images: ${manifest.images.length} landscape, ${portraits.length} portrait`);
  console.log(`Stock footage: ${manifest.stockFootage!.length} clips`);
  console.log(`Voiceover: ${manifest.voiceover.length} files (${chunkFiles.length}/${chunks.length} chunks generated)`);
  console.log(`Music: ${manifest.music.length} files`);
  if (creditsExhausted) {
    console.warn('\nWARNING: ElevenLabs credits were exhausted. Only partial voiceover was generated.');
    console.warn('The video will be compiled with whatever audio was successfully generated.');
  }
}

main().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
