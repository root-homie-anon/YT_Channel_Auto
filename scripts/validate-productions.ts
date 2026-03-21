/**
 * Post-production validator: scans all completed productions for missing pieces.
 * If a fixable gap is found, attempts to fill it automatically.
 *
 * Checks:
 * 1. Completed productions have publish-result.json with a YouTube URL
 * 2. Narrated channels have a thumbnail generated and uploaded to YouTube
 * 3. long+short channels have a teaser/short uploaded
 * 4. Failed productions are retried via the dashboard API
 *
 * Usage: npx tsx scripts/validate-productions.ts [--fix]
 */

import 'dotenv/config';
import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:3000';
const FIX_MODE = process.argv.includes('--fix');

interface ValidationIssue {
  channel: string;
  prodId: string;
  title: string;
  issue: string;
  fixable: boolean;
  fix?: string;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

async function validateProduction(
  channelSlug: string,
  prodDir: string,
  config: { format: string; thumbnail?: unknown }
): Promise<ValidationIssue[]> {
  const prodId = basename(prodDir);
  const issues: ValidationIssue[] = [];

  const status = await readJson<{ stage: string; failedAtStage?: string; error?: string }>(
    join(prodDir, 'pipeline-status.json')
  );
  if (!status) return issues;

  const scriptOutput = await readJson<{
    title: string;
    description: string;
    hashtags: string[];
    teaserScript?: unknown[];
    productionBrief?: { thumbnailDirection?: { nbproPrompt?: string } };
  }>(join(prodDir, 'script-output.json'));

  const title = scriptOutput?.title ?? prodId;

  // Check 1: Failed productions
  if (status.stage === 'failed') {
    issues.push({
      channel: channelSlug,
      prodId,
      title,
      issue: `Failed at ${status.failedAtStage}: ${status.error?.slice(0, 120)}`,
      fixable: true,
      fix: 'retry',
    });
    return issues;
  }

  // Only validate completed productions from here
  if (status.stage !== 'complete') return issues;

  const compilation = await readJson<{
    videoPath: string;
    thumbnailPath: string;
    teaserVideoPath?: string;
    durationSeconds: number;
  }>(join(prodDir, 'compilation-result.json'));

  const publishResult = await readJson<{
    youtubeVideoId: string;
    youtubeUrl: string;
    shortVideoId?: string;
    shortUrl?: string;
    status: string;
  }>(join(prodDir, 'publish-result.json'));

  // Check 2: No publish result
  if (!publishResult || !publishResult.youtubeVideoId) {
    issues.push({
      channel: channelSlug,
      prodId,
      title,
      issue: 'Complete but no YouTube upload',
      fixable: true,
      fix: 'republish',
    });
  }

  // Check 3: Thumbnail missing for narrated channels
  if (config.format !== 'music-only' && config.thumbnail) {
    const thumbPath = compilation?.thumbnailPath;
    if (!thumbPath || !existsSync(thumbPath)) {
      issues.push({
        channel: channelSlug,
        prodId,
        title,
        issue: 'No thumbnail generated',
        fixable: true,
        fix: 'gen-thumbnail',
      });
    }
  }

  // Check 4: Short/teaser missing for long+short
  if (config.format === 'long+short' && publishResult?.youtubeVideoId) {
    if (!publishResult.shortVideoId) {
      // Check if teaser video exists on disk but wasn't uploaded
      const teaserPath = compilation?.teaserVideoPath;
      if (teaserPath && existsSync(teaserPath)) {
        issues.push({
          channel: channelSlug,
          prodId,
          title,
          issue: 'Teaser video exists but not uploaded as Short',
          fixable: true,
          fix: 'upload-short',
        });
      } else {
        issues.push({
          channel: channelSlug,
          prodId,
          title,
          issue: 'No teaser/short produced',
          fixable: false,
        });
      }
    }
  }

  // Check 5: Video file still exists (not cleaned prematurely)
  if (compilation?.videoPath && !existsSync(compilation.videoPath)) {
    if (publishResult?.status !== 'published') {
      issues.push({
        channel: channelSlug,
        prodId,
        title,
        issue: 'Video file missing but not published',
        fixable: false,
      });
    }
  }

  // Check 6: Description is empty or too short
  if (scriptOutput?.description && scriptOutput.description.length < 50) {
    issues.push({
      channel: channelSlug,
      prodId,
      title,
      issue: `Description too short (${scriptOutput.description.length} chars)`,
      fixable: false,
    });
  }

  return issues;
}

async function applyFix(issue: ValidationIssue): Promise<boolean> {
  try {
    if (issue.fix === 'retry') {
      const resp = await fetch(`${DASHBOARD_URL}/api/channels/${issue.channel}/retry/${issue.prodId}`, {
        method: 'POST',
      });
      if (resp.ok) {
        console.log(`  ✓ Retrying ${issue.prodId}`);
        return true;
      }
      const body = await resp.json() as { error?: string };
      console.log(`  ✗ Retry failed: ${body.error}`);
      return false;
    }

    if (issue.fix === 'gen-thumbnail') {
      const { execSync } = await import('child_process');
      const outputDir = join(PROJECT_ROOT, 'projects', issue.channel, 'output', issue.prodId);
      try {
        execSync(
          `npx tsx scripts/gen-thumbnail.ts "${outputDir}"`,
          { cwd: PROJECT_ROOT, timeout: 60000, stdio: 'pipe' }
        );
        console.log(`  ✓ Thumbnail generated for ${issue.prodId}`);
        return true;
      } catch (err) {
        console.log(`  ✗ Thumbnail gen failed: ${(err as Error).message?.slice(0, 100)}`);
        return false;
      }
    }

    if (issue.fix === 'upload-short') {
      const outputDir = join(PROJECT_ROOT, 'projects', issue.channel, 'output', issue.prodId);
      const compilation = await readJson<{ teaserVideoPath: string }>(join(outputDir, 'compilation-result.json'));
      const scriptOutput = await readJson<{ title: string; description: string; hashtags: string[] }>(
        join(outputDir, 'script-output.json')
      );
      if (!compilation?.teaserVideoPath || !scriptOutput) return false;

      const { uploadVideo } = await import('../src/services/youtube-service.js');
      const oauthPath = join(PROJECT_ROOT, 'projects', issue.channel, '.youtube-oauth.json');

      const shortTitle = scriptOutput.title.length > 90
        ? scriptOutput.title.slice(0, 90) + '...'
        : scriptOutput.title;

      const result = await uploadVideo(oauthPath, {
        videoPath: compilation.teaserVideoPath,
        thumbnailPath: '',
        title: `${shortTitle} #Shorts`,
        description: scriptOutput.description,
        hashtags: [...scriptOutput.hashtags, '#Shorts'],
        privacy: 'unlisted',
      });

      // Update publish result
      const publishResult = await readJson<Record<string, unknown>>(join(outputDir, 'publish-result.json'));
      if (publishResult) {
        publishResult.shortVideoId = result.youtubeVideoId;
        publishResult.shortUrl = result.youtubeUrl;
        await writeFile(join(outputDir, 'publish-result.json'), JSON.stringify(publishResult, null, 2));
      }
      console.log(`  ✓ Short uploaded: ${result.youtubeUrl}`);
      return true;
    }

    return false;
  } catch (err) {
    console.log(`  ✗ Fix failed: ${(err as Error).message?.slice(0, 100)}`);
    return false;
  }
}

async function main(): Promise<void> {
  const projectsDir = join(PROJECT_ROOT, 'projects');
  const channels = (await readdir(projectsDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name.startsWith('ch-'))
    .map((d) => d.name);
  const allIssues: ValidationIssue[] = [];

  for (const channelSlug of channels) {
    const configPath = join(PROJECT_ROOT, 'projects', channelSlug, 'config.json');
    if (!existsSync(configPath)) continue;
    const config = JSON.parse(await readFile(configPath, 'utf-8'));

    const outputBase = join(PROJECT_ROOT, 'projects', channelSlug, 'output');
    if (!existsSync(outputBase)) continue;

    const productions = (await readdir(outputBase)).sort();
    for (const prodId of productions) {
      const prodDir = join(outputBase, prodId);
      const prodStats = await stat(prodDir);
      if (!prodStats.isDirectory()) continue;

      const issues = await validateProduction(channelSlug, prodDir, {
        format: config.channel.format,
        thumbnail: config.thumbnail,
      });
      allIssues.push(...issues);
    }
  }

  if (allIssues.length === 0) {
    console.log('✓ All productions validated — no issues found');
    return;
  }

  console.log(`Found ${allIssues.length} issue(s):\n`);
  for (const issue of allIssues) {
    const fixLabel = issue.fixable ? ` [${FIX_MODE ? 'FIXING' : 'fixable: ' + issue.fix}]` : ' [manual]';
    console.log(`${issue.channel} / ${issue.prodId}`);
    console.log(`  "${issue.title}"`);
    console.log(`  → ${issue.issue}${fixLabel}`);

    if (FIX_MODE && issue.fixable) {
      await applyFix(issue);
    }
    console.log('');
  }

  if (!FIX_MODE && allIssues.some((i) => i.fixable)) {
    console.log('Run with --fix to auto-repair fixable issues');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
