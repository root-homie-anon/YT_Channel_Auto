import { join } from 'path';
import { writeFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import FormData from 'form-data';

import { ApiError } from '../errors/index.js';
import { requireEnv } from '../utils/env.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('zapcap-service');

const BASE_URL = 'https://api.zapcap.ai';

// ---------------------------------------------------------------------------
// ZapCap API — video captioning service
//
// Flow: upload video → create task → poll until complete → download result
// ---------------------------------------------------------------------------

interface ZapCapTaskStatus {
  status: 'pending' | 'transcribing' | 'transcriptionCompleted' | 'rendering' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
}

interface CaptionOptions {
  videoPath: string;
  outputPath: string;
  templateId: string;
  language?: string;
  autoApprove?: boolean;
}

interface CaptionResult {
  captionedVideoPath: string;
  fileSizeBytes: number;
}

function getHeaders(): Record<string, string> {
  const apiKey = requireEnv('ZAPCAP_API_KEY');
  return {
    'x-api-key': apiKey,
  };
}

/**
 * Upload a video file to ZapCap and return the video ID.
 */
async function uploadVideo(videoPath: string): Promise<string> {
  const fileStats = await stat(videoPath);
  log.info(`Uploading video to ZapCap: ${videoPath} (${(fileStats.size / 1024 / 1024).toFixed(1)}MB)`);

  const formData = new FormData();
  formData.append('file', createReadStream(videoPath), {
    filename: videoPath.split('/').pop() ?? 'video.mp4',
    contentType: 'video/mp4',
  });

  const headers = { ...getHeaders(), ...formData.getHeaders() };

  const response = await fetch(`${BASE_URL}/videos`, {
    method: 'POST',
    headers,
    body: formData as unknown as BodyInit,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(`ZapCap upload failed: ${response.status} ${body}`, 'zapcap', response.status);
  }

  const data = (await response.json()) as { id: string };
  log.info(`Video uploaded to ZapCap, ID: ${data.id}`);
  return data.id;
}

/**
 * Create a captioning task for an uploaded video.
 */
async function createTask(videoId: string, templateId: string, language: string, autoApprove: boolean): Promise<string> {
  log.info(`Creating captioning task: videoId=${videoId}, template=${templateId}, lang=${language}`);

  const response = await fetch(`${BASE_URL}/videos/${videoId}/task`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      templateId,
      autoApprove,
      language,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(`ZapCap task creation failed: ${response.status} ${body}`, 'zapcap', response.status);
  }

  const data = (await response.json()) as { taskId: string };
  log.info(`Captioning task created: ${data.taskId}`);
  return data.taskId;
}

/**
 * Poll task status until completed or failed.
 */
async function pollTask(videoId: string, taskId: string): Promise<string> {
  const MAX_POLLS = 300; // 10 minutes at 2s intervals
  const POLL_INTERVAL_MS = 2000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const response = await fetch(`${BASE_URL}/videos/${videoId}/task/${taskId}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new ApiError(`ZapCap poll failed: ${response.status}`, 'zapcap', response.status);
    }

    const data = (await response.json()) as ZapCapTaskStatus;

    if (data.status === 'completed' && data.downloadUrl) {
      log.info(`Captioning complete, download URL ready`);
      return data.downloadUrl;
    }

    if (data.status === 'failed') {
      throw new ApiError(`ZapCap captioning failed: ${data.error ?? 'unknown error'}`, 'zapcap');
    }

    log.debug(`Poll ${i + 1}/${MAX_POLLS}: status=${data.status}`);
  }

  throw new ApiError('ZapCap captioning timed out after 10 minutes', 'zapcap');
}

/**
 * Download the captioned video from ZapCap.
 */
async function downloadResult(downloadUrl: string, outputPath: string): Promise<number> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new ApiError(`ZapCap download failed: ${response.status}`, 'zapcap', response.status);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await ensureDir(join(outputPath, '..'));
  await writeFile(outputPath, buffer);

  log.info(`Captioned video saved: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  return buffer.length;
}

// -- Public API -------------------------------------------------------------

/**
 * Caption a video using ZapCap: upload → task → poll → download.
 *
 * Returns the path to the captioned video file.
 */
export async function captionVideo(options: CaptionOptions): Promise<CaptionResult> {
  const {
    videoPath,
    outputPath,
    templateId,
    language = 'en',
    autoApprove = true,
  } = options;

  log.info(`Starting ZapCap captioning pipeline for: ${videoPath}`);

  // Step 1: Upload
  const videoId = await uploadVideo(videoPath);

  // Step 2: Create task
  const taskId = await createTask(videoId, templateId, language, autoApprove);

  // Step 3: Poll until done
  const downloadUrl = await pollTask(videoId, taskId);

  // Step 4: Download result
  const fileSizeBytes = await downloadResult(downloadUrl, outputPath);

  log.info(`ZapCap captioning complete: ${outputPath}`);

  return {
    captionedVideoPath: outputPath,
    fileSizeBytes,
  };
}
