import { readFile } from 'fs/promises';
import { google, youtube_v3 } from 'googleapis';
import { createReadStream } from 'fs';

import { ApiError } from '../errors/index.js';
import { PublishRequest, PublishResult } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('youtube-service');

async function getAuthClient(oauthPath: string) {
  const credentials = JSON.parse(await readFile(oauthPath, 'utf-8'));
  const auth = google.auth.fromJSON(credentials);
  return auth as unknown as InstanceType<typeof google.auth.OAuth2>;
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
          tags: request.tags,
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

    // Set thumbnail
    await youtube.thumbnails.set({
      videoId,
      media: {
        body: createReadStream(request.thumbnailPath),
      },
    });

    log.info(`Thumbnail set for video: ${videoId}`);

    return {
      youtubeVideoId: videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      status: 'uploaded',
      scheduledTime: request.scheduledTime,
    };
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

function buildDescription(description: string, hashtags: string[]): string {
  const hashtagLine = hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ');
  return `${description}\n\n${hashtagLine}`;
}
