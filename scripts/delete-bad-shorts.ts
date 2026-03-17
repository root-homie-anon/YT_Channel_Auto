/**
 * Delete mis-uploaded shorts (full-length videos uploaded as shorts).
 * Usage: npx tsx scripts/delete-bad-shorts.ts
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { google } from 'googleapis';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const BAD_SHORT_IDS = ['WFiLPV04IkY', 'X6sRQCwtGNA', 'ESnj8SgZeaY'];

async function main(): Promise<void> {
  const oauthPath = join(PROJECT_ROOT, 'projects', 'ch-strange-universe', '.youtube-oauth.json');
  const raw = JSON.parse(await readFile(oauthPath, 'utf-8'));

  const clientId = raw.web?.client_id ?? process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = raw.web?.client_secret ?? process.env.YOUTUBE_CLIENT_SECRET;
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({
    access_token: raw.tokens.access_token,
    refresh_token: raw.tokens.refresh_token,
    expiry_date: raw.tokens.expiry_date ?? null,
  });

  const youtube = google.youtube({ version: 'v3', auth });

  for (const videoId of BAD_SHORT_IDS) {
    try {
      await youtube.videos.delete({ id: videoId });
      console.log(`✓ Deleted ${videoId}`);
    } catch (err) {
      console.error(`✗ Failed to delete ${videoId}: ${(err as Error).message}`);
    }
  }

  // Also clean up the publish-result.json files
  const { readdir, writeFile } = await import('fs/promises');
  const { existsSync } = await import('fs');
  const outputBase = join(PROJECT_ROOT, 'projects', 'ch-strange-universe', 'output');
  const badProds = ['20260312-022428-bzir', '20260312-031139-1x5x', '20260312-043234-3frh'];

  for (const prodId of badProds) {
    const publishPath = join(outputBase, prodId, 'publish-result.json');
    if (existsSync(publishPath)) {
      const data = JSON.parse(await readFile(publishPath, 'utf-8'));
      delete data.shortVideoId;
      delete data.shortUrl;
      await writeFile(publishPath, JSON.stringify(data, null, 2));
      console.log(`  Cleaned publish-result for ${prodId}`);
    }
  }

  console.log('\nDone');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
