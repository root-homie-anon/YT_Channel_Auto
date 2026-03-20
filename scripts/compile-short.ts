import { compileShortFormVideo } from '../src/services/ffmpeg-service.js';
import { AssetManifest, ScriptOutput } from '../src/types/index.js';
import { readJsonFile } from '../src/utils/file-helpers.js';
import { join } from 'path';
import { readdirSync } from 'fs';

const outputDir = 'projects/ch-strange-universe/output/20260316-001615-1llk';

async function main(): Promise<void> {
  const scriptOutput = await readJsonFile<ScriptOutput>(join(outputDir, 'script-output.json'));

  if (!scriptOutput.teaserScript?.length) {
    console.error('No teaser script found');
    process.exit(1);
  }

  const portraitDir = join(outputDir, 'images-portrait');
  const portraitFiles = readdirSync(portraitDir).filter(f => f.endsWith('.png')).sort();

  const teaserManifest: AssetManifest = {
    images: portraitFiles.slice(0, scriptOutput.teaserScript.length).map((f, i) => ({
      id: `portrait-${i}`,
      path: join(portraitDir, f),
      type: 'image' as const,
    })),
    voiceover: [{
      id: 'teaser-vo',
      path: join(outputDir, 'teaser', 'teaser-narration.mp3'),
      type: 'voiceover' as const,
    }],
    music: [{
      id: 'bg-music',
      path: join(outputDir, 'music', 'background.wav'),
      type: 'music' as const,
    }],
    animations: [],
  };

  console.log(`Compiling short with ${teaserManifest.images.length} portrait images, teaser VO, music`);

  const result = await compileShortFormVideo({
    outputDir: join(outputDir, 'teaser'),
    manifest: teaserManifest,
    sections: scriptOutput.teaserScript,
    visualFilterPreset: 'cinematic',
  });

  console.log('Short compiled:', JSON.stringify(result, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
