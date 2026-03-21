import { readFile, stat as statFile } from 'fs/promises';
import { google, youtube_v3 } from 'googleapis';
import { createReadStream } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

import { ApiError } from '../errors/index.js';
import { PublishRequest, PublishResult } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const UPLOAD_RETRY_DELAYS_MS = [5_000, 15_000, 45_000];

function isTransientError(err: unknown): boolean {
  const msg = (err as Error).message ?? '';
  const code = (err as NodeJS.ErrnoException).code ?? '';
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNABORTED') return true;
  if (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT')) return true;
  // 5xx from googleapis error response
  const status = (err as { status?: number }).status ?? (err as { code?: number }).code;
  if (typeof status === 'number' && status >= 500 && status < 600) return true;
  return false;
}

const log = createLogger('youtube-service');

interface OAuthFile {
  web?: {
    client_id: string;
    client_secret: string;
  };
  tokens?: {
    access_token: string;
    refresh_token: string;
    expiry_date?: number;
  };
}

async function getAuthClient(oauthPath: string) {
  const raw = JSON.parse(await readFile(oauthPath, 'utf-8')) as OAuthFile;

  const clientId = raw.web?.client_id ?? process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = raw.web?.client_secret ?? process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new ApiError('Missing OAuth client credentials', 'youtube');
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);

  if (raw.tokens?.refresh_token) {
    auth.setCredentials({
      access_token: raw.tokens.access_token,
      refresh_token: raw.tokens.refresh_token,
      expiry_date: raw.tokens.expiry_date ?? null,
    });
  } else {
    throw new ApiError('No refresh token found in OAuth file — run OAuth flow first', 'youtube');
  }

  return auth;
}

export async function uploadVideo(
  oauthPath: string,
  request: PublishRequest
): Promise<PublishResult> {
  log.info(`Uploading video: "${request.title}"`);

  try {
    const auth = await getAuthClient(oauthPath);
    const youtube = google.youtube({ version: 'v3', auth });

    // Upload video — 3 attempts with exponential backoff on transient errors
    let videoId: string | null | undefined;
    let lastUploadError: unknown;
    for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS_MS.length; attempt++) {
      try {
        const uploadResponse = await youtube.videos.insert({
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: request.title,
              description: buildDescription(request.description, request.hashtags),
              tags: request.hashtags.map((h) => h.replace(/^#/, '')),
              categoryId: '22', // People & Blogs (default)
            },
            status: {
              privacyStatus: request.privacy,
              publishAt: request.scheduledTime?.toISOString(),
              selfDeclaredMadeForKids: false,
            },
          },
          media: {
            body: createReadStream(request.videoPath),
          },
        } as youtube_v3.Params$Resource$Videos$Insert);
        videoId = uploadResponse.data.id;
        break;
      } catch (uploadErr) {
        lastUploadError = uploadErr;
        if (!isTransientError(uploadErr) || attempt >= UPLOAD_RETRY_DELAYS_MS.length) {
          throw uploadErr;
        }
        const delayMs = UPLOAD_RETRY_DELAYS_MS[attempt];
        log.warn(`YouTube upload attempt ${attempt + 1} failed (transient), retrying in ${delayMs / 1000}s: ${(uploadErr as Error).message}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (!videoId) {
      throw lastUploadError ?? new ApiError('YouTube upload returned no video ID', 'youtube');
    }

    log.info(`Video uploaded: ${videoId}`);

    // Set thumbnail (non-fatal — requires channel verification)
    // Skip if no thumbnail path provided (e.g. music-only channels)
    if (request.thumbnailPath) {
      try {
        // YouTube limit is 2MB — resize if needed
        const thumbStat = await statFile(request.thumbnailPath);
        let thumbPath = request.thumbnailPath;
        if (thumbStat.size > 2_000_000) {
          log.info(`Thumbnail too large (${(thumbStat.size / 1024 / 1024).toFixed(1)}MB) — resizing to 1280x720`);
          const resizedPath = request.thumbnailPath.replace(/\.(png|jpg|jpeg)$/i, '-yt.jpg');
          await execFileAsync('ffmpeg', [
            '-i', request.thumbnailPath,
            '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1:color=black',
            '-q:v', '2',
            '-y', resizedPath,
          ]);
          thumbPath = resizedPath;
        }
        await youtube.thumbnails.set({
          videoId,
          media: {
            body: createReadStream(thumbPath),
          },
        });
        log.info(`Thumbnail set for video: ${videoId}`);
      } catch (thumbErr) {
        log.warn(`Thumbnail upload failed (channel may need verification): ${(thumbErr as Error).message}`);
      }
    }

    const result: PublishResult = {
      youtubeVideoId: videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      status: 'uploaded',
    };
    if (request.scheduledTime !== undefined) {
      result.scheduledTime = request.scheduledTime;
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `YouTube upload failed: ${(error as Error).message}`,
      'youtube',
      undefined,
      error as Error
    );
  }
}

export async function setThumbnail(
  oauthPath: string,
  videoId: string,
  thumbnailPath: string
): Promise<void> {
  log.info(`Setting thumbnail for video ${videoId}`);
  const auth = await getAuthClient(oauthPath);
  const youtube = google.youtube({ version: 'v3', auth });
  await youtube.thumbnails.set({
    videoId,
    media: { body: createReadStream(thumbnailPath) },
  });
  log.info(`Thumbnail set for video: ${videoId}`);
}

export async function updateVideoPrivacy(
  oauthPath: string,
  videoId: string,
  privacy: 'private' | 'unlisted' | 'public'
): Promise<void> {
  log.info(`Updating video ${videoId} privacy to ${privacy}`);

  const auth = await getAuthClient(oauthPath);
  const youtube = google.youtube({ version: 'v3', auth });

  await youtube.videos.update({
    part: ['status'],
    requestBody: {
      id: videoId,
      status: {
        privacyStatus: privacy,
      },
    },
  });

  log.info(`Video ${videoId} privacy updated to ${privacy}`);
}

export interface UpdateMetadataRequest {
  title?: string | undefined;
  description?: string | undefined;
  hashtags?: string[] | undefined;
  categoryId?: string | undefined;
}

export async function updateVideoMetadata(
  oauthPath: string,
  videoId: string,
  updates: UpdateMetadataRequest
): Promise<void> {
  log.info(`Updating metadata for video ${videoId}`);

  const auth = await getAuthClient(oauthPath);
  const youtube = google.youtube({ version: 'v3', auth });

  // Fetch current snippet to preserve fields we're not updating
  const current = await youtube.videos.list({
    part: ['snippet'],
    id: [videoId],
  });

  const currentSnippet = current.data.items?.[0]?.snippet;
  if (!currentSnippet) {
    throw new ApiError(`Video ${videoId} not found`, 'youtube');
  }

  const snippet: Record<string, unknown> = {
    title: updates.title ?? currentSnippet.title,
    description: updates.description
      ? (updates.hashtags
        ? buildDescription(updates.description, updates.hashtags)
        : updates.description)
      : currentSnippet.description,
    tags: updates.hashtags
      ? updates.hashtags.map((h) => h.replace(/^#/, ''))
      : currentSnippet.tags,
    categoryId: updates.categoryId ?? currentSnippet.categoryId ?? '22',
  };

  await youtube.videos.update({
    part: ['snippet'],
    requestBody: {
      id: videoId,
      snippet,
    },
  });

  log.info(`Video ${videoId} metadata updated`);
}

function buildDescription(description: string, hashtags: string[]): string {
  const hashtagLine = hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ');
  return `${description}\n\n${hashtagLine}`;
}
