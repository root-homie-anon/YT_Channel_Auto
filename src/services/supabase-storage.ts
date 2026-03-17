import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFile, readdir, stat } from 'fs/promises';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';

import { requireEnv } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import { readJsonFile } from '../utils/file-helpers.js';
import { ScriptOutput, CompilationResult } from '../types/index.js';

const log = createLogger('supabase-storage');

const BUCKET = 'production-assets';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = requireEnv('SUPABASE_URL');
    const key = requireEnv('SUPABASE_SERVICE_KEY');
    client = createClient(url, key);
  }
  return client;
}

// === Bucket Setup ===

async function ensureBucket(): Promise<void> {
  const supabase = getClient();
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 500 * 1024 * 1024, // 500MB per file (videos can be 300MB+)
    });
    if (error && !error.message.includes('already exists')) {
      throw new Error(`Failed to create bucket: ${error.message}`);
    }
    log.info(`Created storage bucket: ${BUCKET}`);
  }
}

// === Upload Helpers ===

interface UploadResult {
  path: string;
  size: number;
}

async function uploadFile(
  storagePath: string,
  localPath: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  const supabase = getClient();
  const fileBuffer = await readFile(localPath);
  const fileStats = await stat(localPath);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
      ...(metadata ? { metadata } : {}),
    });

  if (error) {
    throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  }

  return { path: storagePath, size: fileStats.size };
}

async function uploadDirectory(
  storagePrefix: string,
  localDir: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<UploadResult[]> {
  if (!existsSync(localDir)) return [];

  const files = await readdir(localDir);
  const results: UploadResult[] = [];

  for (const file of files) {
    const localPath = join(localDir, file);
    const fileStat = await stat(localPath);
    if (!fileStat.isFile()) continue;

    const ext = extname(file).toLowerCase();
    const type = contentType === 'auto'
      ? (ext === '.wav' ? 'audio/wav'
        : ext === '.mp3' ? 'audio/mpeg'
        : ext === '.mp4' ? 'video/mp4'
        : ext === '.png' ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
        : 'application/octet-stream')
      : contentType;

    const storagePath = `${storagePrefix}/${file}`;
    const result = await uploadFile(storagePath, localPath, type, metadata);
    results.push(result);
  }

  return results;
}

// === Main Archive Function ===

export interface ArchiveResult {
  channelSlug: string;
  productionId: string;
  imageFiles: UploadResult[];
  imagePortraitFiles: UploadResult[];
  voiceoverFiles: UploadResult[];
  musicFiles: UploadResult[];
  animationFiles: UploadResult[];
  videoFile?: UploadResult;
  thumbnailFile?: UploadResult;
  totalBytes: number;
  archivedAt: string;
}

/**
 * Archive ALL production assets to Supabase Storage.
 * Called after publish, before local cleanup.
 *
 * Archives: images (landscape + portrait), voiceover, music, animations, final video, thumbnail.
 */
export async function archiveProduction(
  channelSlug: string,
  productionId: string,
  outputDir: string
): Promise<ArchiveResult> {
  log.info(`Archiving production ${channelSlug}/${productionId}`);
  await ensureBucket();

  const prefix = `${channelSlug}/${productionId}`;

  // Read metadata for tagging
  let topic = '';
  let youtubeUrl = '';
  try {
    const scriptOutput = await readJsonFile<ScriptOutput>(join(outputDir, 'script-output.json'));
    topic = scriptOutput.title;
  } catch { /* optional */ }
  try {
    const publishResult = await readJsonFile<{ youtubeUrl?: string }>(join(outputDir, 'publish-result.json'));
    youtubeUrl = publishResult.youtubeUrl ?? '';
  } catch { /* optional */ }

  const meta: Record<string, string> = {
    channel: channelSlug,
    productionId,
    topic,
    youtubeUrl,
    archivedAt: new Date().toISOString(),
  };

  // Upload images (landscape — 16:9)
  const imageFiles = await uploadDirectory(
    `images/${prefix}`,
    join(outputDir, 'images'),
    'auto',
    meta
  );
  log.info(`Archived ${imageFiles.length} landscape image(s)`);

  // Upload images (portrait — 9:16 for shorts)
  const imagePortraitFiles = await uploadDirectory(
    `images-portrait/${prefix}`,
    join(outputDir, 'images-portrait'),
    'auto',
    meta
  );
  log.info(`Archived ${imagePortraitFiles.length} portrait image(s)`);

  // Upload voiceover files
  const voiceoverFiles = await uploadDirectory(
    `voiceover/${prefix}`,
    join(outputDir, 'voiceover'),
    'auto',
    meta
  );
  // Also grab teaser voiceover if it exists
  const teaserVoFiles = await uploadDirectory(
    `voiceover/${prefix}/teaser`,
    join(outputDir, 'teaser'),
    'auto',
    meta
  );
  const allVoiceoverFiles = [...voiceoverFiles, ...teaserVoFiles];
  log.info(`Archived ${allVoiceoverFiles.length} voiceover file(s)`);

  // Upload music tracks
  const musicFiles = await uploadDirectory(
    `music/${prefix}`,
    join(outputDir, 'music'),
    'auto',
    meta
  );
  log.info(`Archived ${musicFiles.length} music file(s)`);

  // Upload animations
  const animationFiles = await uploadDirectory(
    `animations/${prefix}`,
    join(outputDir, 'animations'),
    'auto',
    meta
  );
  log.info(`Archived ${animationFiles.length} animation file(s)`);

  // Upload final video — verify file integrity before uploading
  let videoFile: UploadResult | undefined;
  try {
    const compilation = await readJsonFile<CompilationResult>(join(outputDir, 'compilation-result.json'));
    if (compilation.videoPath && existsSync(compilation.videoPath)) {
      const videoStats = await stat(compilation.videoPath);
      // Sanity check: video must be > 1MB to be valid (avoids uploading corrupt/truncated files)
      if (videoStats.size > 1024 * 1024) {
        videoFile = await uploadFile(
          `videos/${prefix}/${basename(compilation.videoPath)}`,
          compilation.videoPath,
          'video/mp4',
          meta
        );
        log.info(`Archived final video (${(videoFile.size / 1024 / 1024).toFixed(1)}MB)`);
      } else {
        log.warn(`Skipping video archive — file too small (${videoStats.size} bytes), likely corrupt`);
      }
    }
  } catch { /* optional */ }

  // Upload thumbnail
  let thumbnailFile: UploadResult | undefined;
  try {
    const compilation = await readJsonFile<CompilationResult>(join(outputDir, 'compilation-result.json'));
    if (compilation.thumbnailPath && existsSync(compilation.thumbnailPath)) {
      thumbnailFile = await uploadFile(
        `thumbnails/${prefix}/${basename(compilation.thumbnailPath)}`,
        compilation.thumbnailPath,
        'image/png',
        meta
      );
      log.info(`Archived thumbnail`);
    }
  } catch { /* optional */ }

  const totalBytes = [
    ...imageFiles,
    ...imagePortraitFiles,
    ...allVoiceoverFiles,
    ...musicFiles,
    ...animationFiles,
    ...(videoFile ? [videoFile] : []),
    ...(thumbnailFile ? [thumbnailFile] : []),
  ].reduce((sum, f) => sum + f.size, 0);

  const result: ArchiveResult = {
    channelSlug,
    productionId,
    imageFiles,
    imagePortraitFiles,
    voiceoverFiles: allVoiceoverFiles,
    musicFiles,
    animationFiles,
    ...(videoFile ? { videoFile } : {}),
    ...(thumbnailFile ? { thumbnailFile } : {}),
    totalBytes,
    archivedAt: new Date().toISOString(),
  };

  // Save archive manifest locally
  const { writeJsonFile } = await import('../utils/file-helpers.js');
  await writeJsonFile(join(outputDir, 'archive-result.json'), result);

  log.info(`Archive complete: ${(totalBytes / 1024 / 1024).toFixed(1)}MB total`);
  return result;
}

// === Query Helpers (for future compilation feature) ===

/**
 * List all archived music tracks for a channel.
 */
export async function listArchivedMusic(channelSlug: string): Promise<string[]> {
  const supabase = getClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`music/${channelSlug}`, { sortBy: { column: 'created_at', order: 'asc' } });

  if (error) {
    log.warn(`Failed to list music for ${channelSlug}: ${error.message}`);
    return [];
  }

  // Each entry is a production folder — list contents
  const tracks: string[] = [];
  for (const folder of data ?? []) {
    if (folder.id === null) {
      // It's a folder — list its files
      const { data: files } = await supabase.storage
        .from(BUCKET)
        .list(`music/${channelSlug}/${folder.name}`);
      for (const file of files ?? []) {
        if (file.name.endsWith('.wav') || file.name.endsWith('.mp3')) {
          tracks.push(`music/${channelSlug}/${folder.name}/${file.name}`);
        }
      }
    }
  }

  return tracks;
}

/**
 * Get a signed download URL for an archived file (valid 1 hour).
 */
export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const supabase = getClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL for ${storagePath}: ${error?.message}`);
  }

  return data.signedUrl;
}
