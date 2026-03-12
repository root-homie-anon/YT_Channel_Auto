import { writeFile } from 'fs/promises';
import { join } from 'path';

import { ApiError, AssetError } from '../errors/index.js';
import { AssetFile } from '../types/index.js';
import { requireEnv } from '../utils/env.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('sonauto-service');

const SONAUTO_BASE = 'https://api.sonauto.ai/v1';

interface MusicGenerateOptions {
  prompt: string;
  durationSeconds: number;
  outputPath: string;
  genre?: string;
  mood?: string;
  isInstrumental?: boolean;
}

export async function generateMusic(options: MusicGenerateOptions): Promise<AssetFile> {
  const apiKey = requireEnv('SONAUTO_API_KEY');

  const {
    prompt,
    durationSeconds,
    outputPath,
    isInstrumental = true,
  } = options;

  log.info(`Generating music: "${prompt.slice(0, 80)}..." (${durationSeconds}s)`);
  await ensureDir(join(outputPath, '..'));

  try {
    // Step 1: Start generation
    const startResponse = await fetch(`${SONAUTO_BASE}/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        num_songs: 1,
        ...(isInstrumental && { tags: 'instrumental' }),
      }),
    });

    if (!startResponse.ok) {
      const errorBody = await startResponse.text();
      throw new ApiError(
        `Sonauto API returned ${startResponse.status}: ${errorBody}`,
        'sonauto',
        startResponse.status
      );
    }

    const { task_id: taskId } = (await startResponse.json()) as { task_id: string };
    log.info(`Music generation started, task: ${taskId}`);

    // Step 2: Poll for completion
    await pollForStatus(apiKey, taskId);

    // Step 3: Get result and download
    const resultResponse = await fetch(`${SONAUTO_BASE}/generations/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });

    if (!resultResponse.ok) {
      throw new ApiError(
        `Sonauto result fetch failed: ${resultResponse.status}`,
        'sonauto',
        resultResponse.status
      );
    }

    const resultData = (await resultResponse.json()) as {
      song_paths: string[];
      error_message?: string;
    };

    if (!resultData.song_paths?.[0]) {
      throw new ApiError(
        `Sonauto returned no song: ${resultData.error_message ?? 'unknown error'}`,
        'sonauto'
      );
    }

    // Download the audio file (CDN URL, no auth needed)
    const audioResponse = await fetch(resultData.song_paths[0]);
    if (!audioResponse.ok) {
      throw new ApiError('Failed to download generated music', 'sonauto', audioResponse.status);
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    await writeFile(outputPath, audioBuffer);

    log.info(`Music saved: ${outputPath}`);

    return {
      id: crypto.randomUUID(),
      path: outputPath,
      type: 'music',
      durationSeconds,
      metadata: { prompt },
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new AssetError(
      `Music generation failed: ${(error as Error).message}`,
      'music',
      error as Error
    );
  }
}

async function pollForStatus(apiKey: string, taskId: string): Promise<void> {
  const MAX_POLLS = 120;
  const POLL_INTERVAL_MS = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusResponse = await fetch(`${SONAUTO_BASE}/generations/status/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });

    if (!statusResponse.ok) {
      throw new ApiError(
        `Sonauto status check failed: ${statusResponse.status}`,
        'sonauto',
        statusResponse.status
      );
    }

    const status = (await statusResponse.text()).trim().replace(/"/g, '');

    if (status === 'SUCCESS') {
      return;
    }

    if (status === 'FAILURE') {
      throw new ApiError('Music generation failed', 'sonauto');
    }

    log.debug(`Poll ${i + 1}/${MAX_POLLS}: status=${status}`);
  }

  throw new ApiError('Music generation timed out after 10 minutes', 'sonauto');
}
