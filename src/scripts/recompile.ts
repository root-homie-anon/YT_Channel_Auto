/**
 * Re-run the pipeline from a previous production's script-output.json.
 * Reuses existing images/voiceover but recompiles video with latest FFmpeg logic.
 *
 * Usage: npx tsx src/scripts/recompile.ts <channel-slug> <production-id> [--reuse-assets]
 */
import 'dotenv/config';
import { join, resolve, dirname } from 'path';
import { readFile, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

import { runPipeline } from '../services/pipeline.js';
import { ContentPlan, ScriptOutput } from '../types/index.js';
import { generateProductionId } from '../utils/file-helpers.js';
import { ensureDir } from '../utils/file-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

async function main(): Promise<void> {
  const [slug, prevId, ...flags] = process.argv.slice(2);
  const reuseAssets = flags.includes('--reuse-assets');

  if (!slug || !prevId) {
    console.error('Usage: npx tsx src/scripts/recompile.ts <channel-slug> <production-id> [--reuse-assets]');
    process.exit(1);
  }

  const prevDir = join(PROJECT_ROOT, 'projects', slug, 'output', prevId);
  if (!existsSync(prevDir)) {
    console.error(`Previous production not found: ${prevDir}`);
    process.exit(1);
  }

  const scriptOutput: ScriptOutput = JSON.parse(
    await readFile(join(prevDir, 'script-output.json'), 'utf-8')
  );
  const contentPlan: ContentPlan = JSON.parse(
    await readFile(join(prevDir, 'content-plan.json'), 'utf-8')
  );

  const newId = generateProductionId();
  const newDir = join(PROJECT_ROOT, 'projects', slug, 'output', newId);
  await ensureDir(newDir);

  // If reusing assets, copy images and voiceover from previous production
  if (reuseAssets) {
    console.log('Copying assets from previous production...');
    const prevImagesDir = join(prevDir, 'images');
    const prevVoDir = join(prevDir, 'voiceover');

    if (existsSync(prevImagesDir)) {
      const newImagesDir = join(newDir, 'images');
      await ensureDir(newImagesDir);
      const { readdirSync } = await import('fs');
      for (const file of readdirSync(prevImagesDir)) {
        await copyFile(join(prevImagesDir, file), join(newImagesDir, file));
      }
    }

    if (existsSync(prevVoDir)) {
      const newVoDir = join(newDir, 'voiceover');
      await ensureDir(newVoDir);
      const { readdirSync } = await import('fs');
      for (const file of readdirSync(prevVoDir)) {
        await copyFile(join(prevVoDir, file), join(newVoDir, file));
      }
    }
  }

  console.log(`Starting pipeline: ${slug} / ${newId}`);
  console.log(`Script: "${scriptOutput.title}"`);
  console.log(`Sections: ${scriptOutput.script.length}`);
  console.log(`Teaser sections: ${scriptOutput.teaserScript?.length ?? 0}`);

  const context = await runPipeline(slug, contentPlan, scriptOutput, newId);
  console.log('\nPipeline complete!');
  console.log(`Video: ${context.compilationResult?.videoPath}`);
  console.log(`Thumbnail: ${context.compilationResult?.thumbnailPath}`);
  console.log(`Teaser: ${context.compilationResult?.teaserVideoPath ?? 'none'}`);
}

main().catch((err) => {
  console.error('Recompile failed:', err);
  process.exit(1);
});
