import { writeFileSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const outputDir = 'projects/ch-strange-universe/output/20260312-170623-zdfw';
const absDir = resolve(outputDir);

// Build image lists
const landscapeFiles = readdirSync(join(absDir, 'images')).filter(f => f.endsWith('.png')).sort();
const portraitFiles = readdirSync(join(absDir, 'images-portrait')).filter(f => f.endsWith('.png')).sort();

const images = landscapeFiles.map(f => {
  const id = f.replace(/^image-\d+-/, '').replace('.png', '');
  return { id, path: join(absDir, 'images', f), type: 'image' };
});

const portraitImages = portraitFiles.map(f => {
  const id = f.replace(/^image-\d+-/, '').replace('.png', '');
  return { id, path: join(absDir, 'images-portrait', f), type: 'image' };
});

const manifest = {
  images,
  portraitImages,
  voiceover: [{ id: 'full-narration', path: join(absDir, 'voiceover', 'full-narration.mp3'), type: 'voiceover' }],
  music: [{
    id: 'sonauto-bg',
    path: join(absDir, 'music', 'background.mp3'),
    type: 'music',
    durationSeconds: 120,
    metadata: {
      prompt: 'Dark cinematic ambient with subtle electronic undertones, investigative tension',
      provider: 'sonauto'
    }
  }],
  animations: []
};

// Teaser manifest uses portrait images
const scriptOutput = JSON.parse(readFileSync(join(absDir, 'script-output.json'), 'utf-8'));
const teaserCount = scriptOutput.teaserScript?.length ?? 4;

const teaserManifest = {
  images: portraitImages.slice(0, teaserCount),
  voiceover: [{ id: 'teaser-narration', path: join(absDir, 'teaser', 'teaser-narration.mp3'), type: 'voiceover' }],
  music: manifest.music,
  animations: []
};

writeFileSync(join(absDir, 'asset-manifest.json'), JSON.stringify(manifest, null, 2));
writeFileSync(join(absDir, 'teaser-manifest.json'), JSON.stringify(teaserManifest, null, 2));
writeFileSync(join(absDir, 'pipeline-status.json'), JSON.stringify({
  stage: 'compilation',
  startedAt: '2026-03-12T17:06:23.377Z',
  updatedAt: new Date().toISOString(),
  topic: 'UAP Caught on Film'
}, null, 2));

console.log(`Manifest: ${images.length} landscape, ${portraitImages.length} portrait images`);
console.log(`Teaser manifest: ${teaserManifest.images.length} portrait images`);
console.log('Pipeline status: compilation');
