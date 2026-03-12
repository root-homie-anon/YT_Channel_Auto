import { readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { config } from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
config({ path: resolve(PROJECT_ROOT, '.env') });

import { generateVoiceover } from '../services/elevenlabs-service.js';
import { compileLongFormVideo, compileShortFormVideo } from '../services/ffmpeg-service.js';
import { AssetManifest, ScriptOutput } from '../types/index.js';

const OUTPUT_DIR = join(
  PROJECT_ROOT,
  'projects/ch-strange-universe/output/20260312-183125-oqd0'
);
const VOICE_ID = 'EiNlNiXeDU1pqqOPrYMO';

async function main(): Promise<void> {
  const scriptRaw = await readFile(join(OUTPUT_DIR, 'script-output.json'), 'utf-8');
  const scriptOutput: ScriptOutput = JSON.parse(scriptRaw);
  const manifestRaw = await readFile(join(OUTPUT_DIR, 'asset-manifest.json'), 'utf-8');
  const manifest: AssetManifest = JSON.parse(manifestRaw);

  // 1. Regenerate voiceover with slower speed
  console.log('--- Regenerating voiceover (speed=0.85, multilingual_v2) ---');
  const fullNarration = scriptOutput.script.map((s) => s.narration).join('\n\n');
  console.log(`Text: ${fullNarration.length} chars, ${fullNarration.split(/\s+/).length} words`);

  const voAsset = await generateVoiceover({
    text: fullNarration,
    voiceId: VOICE_ID,
    outputPath: join(OUTPUT_DIR, 'voiceover', 'full-narration.mp3'),
    speed: 0.85,
  });
  manifest.voiceover = [voAsset];
  console.log('Voiceover regenerated');

  // 2. Regenerate teaser voiceover if teaser exists
  if (scriptOutput.teaserScript && scriptOutput.teaserScript.length > 0) {
    console.log('--- Regenerating teaser voiceover ---');
    const teaserNarration = scriptOutput.teaserScript.map((s) => s.narration).join('\n\n');
    await generateVoiceover({
      text: teaserNarration,
      voiceId: VOICE_ID,
      outputPath: join(OUTPUT_DIR, 'teaser', 'teaser-narration.mp3'),
      speed: 0.85,
    });
    console.log('Teaser voiceover regenerated');
  }

  // 3. Recompile long-form
  console.log('--- Recompiling long-form video ---');
  const longResult = await compileLongFormVideo({
    outputDir: OUTPUT_DIR,
    manifest,
    sections: scriptOutput.script,
    resolution: '1920x1080',
  });
  console.log(`Long-form: ${longResult.durationSeconds}s (${(longResult.durationSeconds / 60).toFixed(1)}min)`);

  // 4. Recompile teaser (portrait)
  if (scriptOutput.teaserScript && manifest.portraitImages) {
    console.log('--- Recompiling teaser video ---');
    const teaserManifestRaw = await readFile(join(OUTPUT_DIR, 'teaser-manifest.json'), 'utf-8');
    const teaserManifest: AssetManifest = JSON.parse(teaserManifestRaw);
    teaserManifest.voiceover = [{
      id: 'teaser-vo',
      path: join(OUTPUT_DIR, 'teaser', 'teaser-narration.mp3'),
      type: 'voiceover',
    }];

    const teaserResult = await compileShortFormVideo({
      outputDir: OUTPUT_DIR,
      manifest: teaserManifest,
      sections: scriptOutput.teaserScript,
      resolution: '1080x1920',
    });
    console.log(`Teaser: ${teaserResult.durationSeconds}s`);
  }

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
