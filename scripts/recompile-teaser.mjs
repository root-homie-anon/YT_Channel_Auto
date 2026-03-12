import { compileShortFormVideo } from '../src/services/ffmpeg-service.js';
import { readFileSync } from 'fs';

const outputDir = 'projects/ch-strange-universe/output/20260312-150810-j3lc';
const manifest = JSON.parse(readFileSync(`${outputDir}/asset-manifest.json`, 'utf-8'));
const scriptOutput = JSON.parse(readFileSync(`${outputDir}/script-output.json`, 'utf-8'));

// Build teaser manifest: reuse first N images, teaser VO, same music
const teaserSections = scriptOutput.teaserScript;
const teaserManifest = {
  images: manifest.images.slice(0, teaserSections.length),
  voiceover: [{ id: 'teaser-narration', path: `${outputDir}/teaser/teaser-narration.mp3`, type: 'voiceover' }],
  music: manifest.music,
  animations: [],
};

console.log(`Recompiling teaser: ${teaserSections.length} sections, resolution 1080x1920`);

const result = await compileShortFormVideo({
  outputDir: `${outputDir}/teaser`,
  manifest: teaserManifest,
  sections: teaserSections,
  resolution: '1080x1920',
});

console.log('Done:', JSON.stringify(result, null, 2));
