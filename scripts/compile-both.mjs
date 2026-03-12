import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { compileLongFormVideo, compileShortFormVideo } from '../src/services/ffmpeg-service.js';

const outputDir = resolve('projects/ch-strange-universe/output/20260312-170623-zdfw');
const manifest = JSON.parse(readFileSync(join(outputDir, 'asset-manifest.json'), 'utf-8'));
const teaserManifest = JSON.parse(readFileSync(join(outputDir, 'teaser-manifest.json'), 'utf-8'));
const scriptOutput = JSON.parse(readFileSync(join(outputDir, 'script-output.json'), 'utf-8'));

// --- Long-form video (16:9) ---
console.log('=== Compiling long-form video (16:9) ===');
const longResult = await compileLongFormVideo({
  outputDir,
  manifest,
  sections: scriptOutput.script,
  resolution: '1920x1080',
});
console.log('Long-form done:', JSON.stringify(longResult, null, 2));

// --- Short-form video (9:16, portrait images) ---
console.log('\n=== Compiling short-form video (9:16) ===');
const shortResult = await compileShortFormVideo({
  outputDir: join(outputDir, 'teaser'),
  manifest: teaserManifest,
  sections: scriptOutput.teaserScript,
  resolution: '1080x1920',
});
console.log('Short-form done:', JSON.stringify(shortResult, null, 2));

// --- Generate thumbnail via NB2 ---
console.log('\n=== Generating thumbnail ===');
import { generateThumbnailNB2 } from '../src/services/nanobana-service.js';

const thumbDir = scriptOutput.productionBrief?.thumbnailDirection;
const thumbPrompt = `Epic cinematic scene: ${thumbDir?.primaryConcept || 'A dark military control room with multiple screens showing grainy UAP footage'}. ${thumbDir?.compositionNote || 'Multiple screens fill the background, operator silhouette in foreground'}.

CRITICAL TEXT REQUIREMENT: The words "${thumbDir?.textOverlay || 'CAUGHT ON FILM'}" must be rendered as ENORMOUS bold text across the lower-left portion of the image.
The text must be the single most dominant visual element, covering approximately 40-50% of the image width.
Text style: ultra-bold, wide tracking, pure bright white with subtle shadow for depth. The letters should feel monumental and powerful.
The text must be integrated into the scene composition.

Color palette: deep navy blues, cold blues, near-black shadows. Accent lighting from screens in cold white and blue.
Style: dark cinematic photorealism with film grain, dramatic atmospheric lighting, high production value.
Mood: ${thumbDir?.emotionalHook || 'The unsettling realization that whatever is on these screens defies explanation'}.

Image must have extremely high contrast. Must be clearly readable at small thumbnail size (320px width).
16:9 aspect ratio, 4K resolution.

Avoid: cartoonish elements, flying saucers, alien creatures, bright cheerful colors, busy cluttered compositions, soft contrast, visible human faces, watermarks.`;

const thumbResult = await generateThumbnailNB2({
  prompt: thumbPrompt,
  aspectRatio: '16:9',
  outputPath: join(outputDir, 'thumbnail.png'),
  resolution: '4K',
});
console.log('Thumbnail done:', JSON.stringify(thumbResult, null, 2));

// --- Update pipeline status ---
writeFileSync(join(outputDir, 'pipeline-status.json'), JSON.stringify({
  stage: 'approval',
  startedAt: '2026-03-12T17:06:23.377Z',
  updatedAt: new Date().toISOString(),
  topic: 'UAP Caught on Film',
}, null, 2));

writeFileSync(join(outputDir, 'compilation-result.json'), JSON.stringify({
  longForm: longResult,
  shortForm: shortResult,
  thumbnail: thumbResult,
}, null, 2));

console.log('\n=== All compilation complete. Pipeline at approval stage. ===');
