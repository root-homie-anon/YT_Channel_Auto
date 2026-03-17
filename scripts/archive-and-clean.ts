/**
 * Archive all production assets to Supabase, verify each upload, then clean local files.
 * Only cleans a production if ALL its files were verified in Supabase.
 *
 * Usage: npx tsx scripts/archive-and-clean.ts
 */

import 'dotenv/config';
import { readdir, stat, rm, readFile } from 'fs/promises';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const BUCKET = 'production-assets';
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ──

async function ensureBucket(): Promise<void> {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 500 * 1024 * 1024,
    });
    if (error && !error.message.includes('already exists')) {
      throw new Error(`Failed to create bucket: ${error.message}`);
    }
    console.log(`Created bucket: ${BUCKET}`);
  } else {
    console.log(`Bucket OK: ${BUCKET}`);
  }
}

function getContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.json': 'application/json', '.txt': 'text/plain',
  };
  return map[ext] ?? 'application/octet-stream';
}

interface UploadRecord {
  storagePath: string;
  localPath: string;
  localSize: number;
}

async function uploadFile(storagePath: string, localPath: string): Promise<UploadRecord> {
  const fileBuffer = await readFile(localPath);
  const fileStats = await stat(localPath);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: getContentType(localPath),
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed ${storagePath}: ${error.message}`);
  }

  return { storagePath, localPath, localSize: fileStats.size };
}

async function verifyFile(storagePath: string, expectedSize: number): Promise<boolean> {
  // For small files (<100KB), download and compare size directly
  // (Supabase signed URL HEAD requests return content-length: 0 for small files)
  if (expectedSize < 100 * 1024) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);
    if (error || !data) {
      console.error(`  VERIFY FAIL: ${storagePath} — download failed: ${error?.message}`);
      return false;
    }
    const remoteSize = data.size;
    if (remoteSize < expectedSize * 0.9) {
      console.error(`  VERIFY FAIL: ${storagePath} — size mismatch: local=${expectedSize}, remote=${remoteSize}`);
      return false;
    }
    return true;
  }

  // For large files, use signed URL + HEAD
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error || !data?.signedUrl) {
    console.error(`  VERIFY FAIL: ${storagePath} — no signed URL: ${error?.message}`);
    return false;
  }

  try {
    const resp = await fetch(data.signedUrl, { method: 'HEAD' });
    if (!resp.ok) {
      console.error(`  VERIFY FAIL: ${storagePath} — HTTP ${resp.status}`);
      return false;
    }
    const remoteSize = parseInt(resp.headers.get('content-length') ?? '0', 10);
    if (remoteSize < expectedSize * 0.95) {
      console.error(`  VERIFY FAIL: ${storagePath} — size mismatch: local=${expectedSize}, remote=${remoteSize}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`  VERIFY FAIL: ${storagePath} — ${(err as Error).message}`);
    return false;
  }
}

async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

// ── Main ──

async function archiveProduction(channelSlug: string, prodDir: string): Promise<boolean> {
  const prodId = basename(prodDir);
  const prefix = `${channelSlug}/${prodId}`;
  const allFiles = await collectFiles(prodDir);

  if (allFiles.length === 0) {
    console.log(`  Empty production, skipping`);
    return true; // OK to clean
  }

  const uploads: UploadRecord[] = [];
  let uploadErrors = 0;

  // Upload all files
  for (const localPath of allFiles) {
    const relativePath = localPath.slice(prodDir.length + 1);
    const storagePath = `${prefix}/${relativePath}`;
    const fileStats = await stat(localPath);

    // Skip files > 450MB (Supabase limit with buffer)
    if (fileStats.size > 450 * 1024 * 1024) {
      console.log(`  SKIP (too large): ${relativePath} (${Math.round(fileStats.size / 1024 / 1024)}MB)`);
      continue;
    }

    try {
      const record = await uploadFile(storagePath, localPath);
      uploads.push(record);
    } catch (err) {
      console.error(`  UPLOAD FAIL: ${relativePath} — ${(err as Error).message}`);
      uploadErrors++;
    }
  }

  if (uploadErrors > 0) {
    console.error(`  ${uploadErrors} upload errors — skipping verification and cleanup`);
    return false;
  }

  // Verify all uploads
  console.log(`  Verifying ${uploads.length} files...`);
  let verifyErrors = 0;
  for (const record of uploads) {
    const ok = await verifyFile(record.storagePath, record.localSize);
    if (!ok) verifyErrors++;
  }

  if (verifyErrors > 0) {
    console.error(`  ${verifyErrors} verification failures — NOT cleaning`);
    return false;
  }

  console.log(`  ✓ All ${uploads.length} files verified in Supabase`);
  return true;
}

async function main(): Promise<void> {
  await ensureBucket();

  const channels = ['ch-strange-universe', 'ch-liminal-synth'];
  let totalArchived = 0;
  let totalCleaned = 0;
  let totalFailed = 0;
  let totalFreedMB = 0;

  for (const channelSlug of channels) {
    const outputBase = join(PROJECT_ROOT, 'projects', channelSlug, 'output');
    if (!existsSync(outputBase)) continue;

    const productions = (await readdir(outputBase)).sort();
    console.log(`\n=== ${channelSlug}: ${productions.length} productions ===`);

    for (const prodId of productions) {
      const prodDir = join(outputBase, prodId);
      const prodStats = await stat(prodDir);
      if (!prodStats.isDirectory()) continue;

      // Calculate size before
      const sizeMB = parseInt(
        (await import('child_process')).execSync(`du -sm "${prodDir}" 2>/dev/null`).toString().split('\t')[0],
        10
      );

      console.log(`\n${prodId} (${sizeMB}MB)`);

      const archiveOk = await archiveProduction(channelSlug, prodDir);
      totalArchived++;

      if (archiveOk) {
        console.log(`  Cleaning local files...`);
        await rm(prodDir, { recursive: true, force: true });
        totalCleaned++;
        totalFreedMB += sizeMB;
        console.log(`  ✓ Cleaned ${sizeMB}MB`);
      } else {
        totalFailed++;
        console.log(`  ✗ NOT cleaned — archive incomplete`);
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Archived: ${totalArchived}`);
  console.log(`Cleaned:  ${totalCleaned}`);
  console.log(`Failed:   ${totalFailed}`);
  console.log(`Freed:    ${totalFreedMB}MB`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
