import { randomUUID } from 'node:crypto';
import { writeFile } from 'fs/promises';
import { join } from 'path';

import { ApiError, AssetError } from '../errors/index.js';
import { AssetFile } from '../types/index.js';
import { requireEnv } from '../utils/env.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';
import { fetchWithTimeout } from '../utils/fetch-helpers.js';

const log = createLogger('runway-service');

interface AnimationOptions {
  imageUrl: string;
  prompt: string;
  durationSeconds?: number;
  outputPath: string;
}

export async function generateAnimation(options: AnimationOptions): Promise<AssetFile> {
  const apiKey = requireEnv('RUNWAY_API_KEY');

  const { imageUrl, prompt, durationSeconds = 10, outputPath } = options;

  log.info(`Generating animation: "${prompt.slice(0, 80)}..."`);
  await ensureDir(join(outputPath, '..'));

  try {
    // Start generation
    const startResponse = await fetchWithTimeout('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        model: 'gen4_turbo',
        promptImage: imageUrl,
        promptText: prompt,
        duration: durationSeconds,
        ratio: '1280:720',
      }),
    });

    if (!startResponse.ok) {
      const errorBody = await startResponse.text();
      throw new ApiError(
        `Runway API returned ${startResponse.status}: ${errorBody}`,
        'runway',
        startResponse.status
      );
    }

    const { id: taskId } = (await startResponse.json()) as { id: string };
    log.info(`Animation generation started, task: ${taskId}`);

    // Poll for completion
    const videoUrl = await pollForCompletion(apiKey, taskId);

    // Download
    const videoResponse = await fetchWithTimeout(videoUrl, {}, 120_000);
    if (!videoResponse.ok) {
      throw new ApiError('Failed to download generated animation', 'runway', videoResponse.status);
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    await writeFile(outputPath, videoBuffer);

    log.info(`Animation saved: ${outputPath}`);

    return {
      id: randomUUID(),
      path: outputPath,
      type: 'animation',
      durationSeconds,
      metadata: { prompt },
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new AssetError(
      `Animation generation failed: ${(error as Error).message}`,
      'animation',
      error as Error
    );
  }
}

async function pollForCompletion(apiKey: string, taskId: string): Promise<string> {
  const MAX_POLLS = 120;
  const POLL_INTERVAL_MS = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusResponse = await fetchWithTimeout(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    }, 30_000);

    if (!statusResponse.ok) {
      throw new ApiError(
        `Runway status check failed: ${statusResponse.status}`,
        'runway',
        statusResponse.status
      );
    }

    const status = (await statusResponse.json()) as {
      status: string;
      output?: string[];
      failure?: string;
    };

    if (status.status === 'SUCCEEDED' && status.output?.[0]) {
      return status.output[0];
    }

    if (status.status === 'FAILED') {
      throw new ApiError(
        `Animation generation failed: ${status.failure ?? 'Unknown error'}`,
        'runway'
      );
    }

    log.debug(`Poll ${i + 1}/${MAX_POLLS}: status=${status.status}`);
  }

  throw new ApiError('Animation generation timed out after 10 minutes', 'runway');
}
