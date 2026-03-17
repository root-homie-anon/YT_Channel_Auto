/**
 * Bulk upload all unuploaded productions as unlisted.
 * Uploads main videos + teaser shorts where available.
 *
 * Usage: npx tsx scripts/bulk-upload-unlisted.ts
 */

import { readdir, access, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// Dynamic imports to use the existing service
async function main(): Promise<void> {
  const { uploadVideo } = await import('../src/services/youtube-service.js');

  const channelSlug = 'ch-strange-universe';
  const oauthPath = join(PROJECT_ROOT, 'projects', channelSlug, '.youtube-oauth.json');
  const outputBase = join(PROJECT_ROOT, 'projects', channelSlug, 'output');

  // Verify OAuth
  try {
    await access(oauthPath);
  } catch {
    console.error('No YouTube OAuth file found');
    process.exit(1);
  }

  const productions = await readdir(outputBase);
  let uploaded = 0;
  let skipped = 0;

  for (const prodId of productions.sort()) {
    const prodDir = join(outputBase, prodId);

    // Skip if already published
    const publishPath = join(prodDir, 'publish-result.json');
    if (existsSync(publishPath)) {
      try {
        const existing = JSON.parse(await readFile(publishPath, 'utf-8'));
        if (existing.youtubeVideoId) {
          console.log(`SKIP ${prodId} — already published: ${existing.youtubeUrl}`);
          skipped++;
          continue;
        }
      } catch { /* proceed */ }
    }

    // Need compilation result and script output
    const compilationPath = join(prodDir, 'compilation-result.json');
    const scriptPath = join(prodDir, 'script-output.json');
    if (!existsSync(compilationPath) || !existsSync(scriptPath)) {
      console.log(`SKIP ${prodId} — missing compilation or script output`);
      skipped++;
      continue;
    }

    const compilation = JSON.parse(await readFile(compilationPath, 'utf-8'));
    const scriptOutput = JSON.parse(await readFile(scriptPath, 'utf-8'));

    // Validate main video exists and is >1MB
    if (!compilation.videoPath || !existsSync(compilation.videoPath)) {
      console.log(`SKIP ${prodId} — video file missing`);
      skipped++;
      continue;
    }
    const { stat } = await import('fs/promises');
    const videoStats = await stat(compilation.videoPath);
    if (videoStats.size < 1024 * 1024) {
      console.log(`SKIP ${prodId} — video too small (${videoStats.size} bytes)`);
      skipped++;
      continue;
    }

    // Upload main video
    console.log(`\nUPLOAD ${prodId} — "${scriptOutput.title}" (${Math.round(videoStats.size / 1024 / 1024)}MB)`);
    try {
      const thumbnailPath = compilation.thumbnailPath && existsSync(compilation.thumbnailPath)
        ? compilation.thumbnailPath
        : '';

      const result = await uploadVideo(oauthPath, {
        videoPath: compilation.videoPath,
        thumbnailPath,
        title: scriptOutput.title,
        description: scriptOutput.description,
        hashtags: scriptOutput.hashtags ?? [],
        privacy: 'unlisted',
      });

      console.log(`  ✓ Main: ${result.youtubeUrl}`);

      const publishResult: Record<string, unknown> = {
        youtubeVideoId: result.youtubeVideoId,
        youtubeUrl: result.youtubeUrl,
        status: 'published',
      };

      // Upload teaser short if it exists
      const teaserPaths = [
        join(prodDir, 'teaser', 'teaser-video.mp4'),
        join(prodDir, 'teaser-video.mp4'),
      ];
      const teaserPath = teaserPaths.find((p) => existsSync(p));

      if (teaserPath) {
        try {
          const shortTitle = scriptOutput.title.length > 90
            ? scriptOutput.title.slice(0, 90) + '...'
            : scriptOutput.title;

          const shortResult = await uploadVideo(oauthPath, {
            videoPath: teaserPath,
            thumbnailPath: '',
            title: `${shortTitle} #Shorts`,
            description: scriptOutput.description,
            hashtags: [...(scriptOutput.hashtags ?? []), '#Shorts'],
            privacy: 'unlisted',
          });

          console.log(`  ✓ Short: ${shortResult.youtubeUrl}`);
          publishResult.shortVideoId = shortResult.youtubeVideoId;
          publishResult.shortUrl = shortResult.youtubeUrl;
        } catch (shortErr) {
          console.error(`  ✗ Short failed: ${(shortErr as Error).message}`);
        }
      }

      // Save publish result
      const { writeFile } = await import('fs/promises');
      await writeFile(publishPath, JSON.stringify(publishResult, null, 2));
      uploaded++;
    } catch (err) {
      console.error(`  ✗ Upload failed: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
