import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { generateMusicElevenLabs } from '../src/services/elevenlabs-music-service.js';
import { compileLongFormVideo, compileShortFormVideo } from '../src/services/ffmpeg-service.js';

const outputDir = resolve('projects/ch-strange-universe/output/20260312-170623-zdfw');
const scriptOutput = JSON.parse(readFileSync(join(outputDir, 'script-output.json'), 'utf-8'));
const brief = scriptOutput.productionBrief?.musicDirection;

// --- Generate music via ElevenLabs ---
console.log('=== Generating music via ElevenLabs ===');
const musicPrompt = [
  'Dark cinematic ambient with electronic undertones, investigation documentary score.',
  `Mood: ${brief?.primaryMood ?? 'investigative tension'}.`,
  brief?.supportingMoods ? brief.supportingMoods.join(', ') + '.' : '',
  `Energy: ${brief?.energyLevel ?? 'Low'} — ambient background layer, never competing with spoken narration.`,
  'Instrumentation: Deep sub-bass synth drones, slow-evolving cold synth pads, sparse reverb-heavy piano, distant metallic textures, subtle low string sustains. No percussion. No melody.',
  'Tempo: Slow and deliberate, 55-75 BPM or no discernible tempo.',
  'Structure: No lyrics. No prominent melodic hook. Continuous evolving atmospheric texture.',
  `Arc: ${brief?.arc ?? 'Opens sparse and tense, builds subtle layers, pulls back to reflective stillness'}.`,
  `Avoid: ${brief?.avoidMood ?? 'Horror stingers, sci-fi cliches, triumphant fanfares'}.`,
].filter(Boolean).join('\n');

const musicAsset = await generateMusicElevenLabs({
  prompt: musicPrompt,
  durationSeconds: 120,
  outputPath: join(outputDir, 'music', 'background.mp3'),
  forceInstrumental: true,
});
console.log('Music generated:', musicAsset.path);

// --- Update manifests with new music ---
const manifest = JSON.parse(readFileSync(join(outputDir, 'asset-manifest.json'), 'utf-8'));
manifest.music = [musicAsset];
writeFileSync(join(outputDir, 'asset-manifest.json'), JSON.stringify(manifest, null, 2));

const teaserManifest = JSON.parse(readFileSync(join(outputDir, 'teaser-manifest.json'), 'utf-8'));
teaserManifest.music = [musicAsset];
writeFileSync(join(outputDir, 'teaser-manifest.json'), JSON.stringify(teaserManifest, null, 2));

// --- Compile long-form ---
console.log('\n=== Compiling long-form (16:9) ===');
const longResult = await compileLongFormVideo({
  outputDir,
  manifest,
  sections: scriptOutput.script,
  resolution: '1920x1080',
});
console.log('Long-form:', longResult.durationSeconds + 's,', (longResult.fileSizeBytes / 1024 / 1024).toFixed(1) + 'MB');

// --- Compile short-form ---
console.log('\n=== Compiling short-form (9:16) ===');
const shortResult = await compileShortFormVideo({
  outputDir: join(outputDir, 'teaser'),
  manifest: teaserManifest,
  sections: scriptOutput.teaserScript,
  resolution: '1080x1920',
});
console.log('Short-form:', shortResult.durationSeconds + 's,', (shortResult.fileSizeBytes / 1024 / 1024).toFixed(1) + 'MB');

console.log('\n=== Done ===');
