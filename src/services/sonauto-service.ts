import { writeFile } from 'fs/promises';
import { join } from 'path';

import { ApiError, AssetError } from '../errors/index.js';
import { AssetFile } from '../types/index.js';
import { requireEnv } from '../utils/env.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('sonauto-service');

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
    genre,
    mood,
    isInstrumental = true,
  } = options;

  log.info(`Generating music: "${prompt.slice(0, 80)}..." (${durationSeconds}s)`);
  await ensureDir(join(outputPath, '..'));

  try {
    // Start generation
    const startResponse = await fetch('https://api.sonauto.ai/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        duration: durationSeconds,
        genre,
        mood,
        instrumental: isInstrumental,
      }),
    });

    if (!startResponse.ok) {
      throw new ApiError(
        `Sonauto API returned ${startResponse.status}: ${startResponse.statusText}`,
        'sonauto',
        startResponse.status
      );
    }

    const { taskId } = (await startResponse.json()) as { taskId: string };
    log.info(`Music generation started, task: ${taskId}`);

    // Poll for completion
    const audioUrl = await pollForCompletion(apiKey, taskId);

    // Download the audio
    const audioResponse = await fetch(audioUrl);
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
      metadata: { prompt, genre: genre ?? '', mood: mood ?? '' },
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

async function pollForCompletion(apiKey: string, taskId: string): Promise<string> {
  const MAX_POLLS = 120;
  const POLL_INTERVAL_MS = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusResponse = await fetch(`https://api.sonauto.ai/v1/status/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!statusResponse.ok) {
      throw new ApiError(
        `Sonauto status check failed: ${statusResponse.status}`,
        'sonauto',
        statusResponse.status
      );
    }

    const status = (await statusResponse.json()) as {
      status: string;
      audioUrl?: string;
      error?: string;
    };

    if (status.status === 'completed' && status.audioUrl) {
      return status.audioUrl;
    }

    if (status.status === 'failed') {
      throw new ApiError(
        `Music generation failed: ${status.error ?? 'Unknown error'}`,
        'sonauto'
      );
    }

    log.debug(`Poll ${i + 1}/${MAX_POLLS}: status=${status.status}`);
  }

  throw new ApiError('Music generation timed out after 10 minutes', 'sonauto');
}
