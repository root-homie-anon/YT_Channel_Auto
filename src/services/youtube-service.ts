import { readFile } from 'fs/promises';
import { google, youtube_v3 } from 'googleapis';
import { createReadStream } from 'fs';

import { ApiError } from '../errors/index.js';
import { PublishRequest, PublishResult } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

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

    // Upload video
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

    const videoId = uploadResponse.data.id;
    if (!videoId) {
      throw new ApiError('YouTube upload returned no video ID', 'youtube');
    }

    log.info(`Video uploaded: ${videoId}`);

    // Set thumbnail (non-fatal — requires channel verification)
    // Skip if no thumbnail path provided (e.g. music-only channels)
    if (request.thumbnailPath) {
      try {
        await youtube.thumbnails.set({
          videoId,
          media: {
            body: createReadStream(request.thumbnailPath),
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
