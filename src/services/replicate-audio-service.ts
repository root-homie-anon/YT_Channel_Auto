import { randomUUID } from 'node:crypto';
import { writeFile } from 'fs/promises';
import { join } from 'path';

import { ApiError, AssetError } from '../errors/index.js';
import { AssetFile } from '../types/index.js';
import { requireEnv } from '../utils/env.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('replicate-audio');

const REPLICATE_BASE = 'https://api.replicate.com/v1';
const MODEL_VERSION = 'stability-ai/stable-audio-2.5';
const MAX_DURATION_SECONDS = 190;

interface MusicGenerateOptions {
  prompt: string;
  durationSeconds: number;
  outputPath: string;
  guidanceScale?: number;
  numInferenceSteps?: number;
  seed?: number;
}

export async function generateMusic(options: MusicGenerateOptions): Promise<AssetFile> {
  const apiToken = requireEnv('REPLICATE_API_TOKEN');

  const {
    prompt,
    durationSeconds,
    outputPath,
    guidanceScale = 1,
    numInferenceSteps = 8,
    seed,
  } = options;

  if (durationSeconds > MAX_DURATION_SECONDS) {
    log.warn(
      `Requested ${durationSeconds}s exceeds max ${MAX_DURATION_SECONDS}s — clamping to ${MAX_DURATION_SECONDS}s`
    );
  }

  const clampedDuration = Math.min(durationSeconds, MAX_DURATION_SECONDS);

  log.info(`Generating music via Stable Audio 2.5: "${prompt.slice(0, 80)}..." (${clampedDuration}s)`);
  await ensureDir(join(outputPath, '..'));

  try {
    // Step 1: Create prediction
    const input: Record<string, unknown> = {
      prompt,
      seconds_total: clampedDuration,
      guidance_scale: guidanceScale,
      num_inference_steps: numInferenceSteps,
    };
    if (seed !== undefined) {
      input.seed = seed;
    }

    const startResponse = await fetch(`${REPLICATE_BASE}/models/${MODEL_VERSION}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!startResponse.ok) {
      const errorBody = await startResponse.text();
      throw new ApiError(
        `Replicate API returned ${startResponse.status}: ${errorBody}`,
        'replicate',
        startResponse.status
      );
    }

    const prediction = (await startResponse.json()) as ReplicatePrediction;
    log.info(`Prediction created: ${prediction.id}`);

    // Step 2: Poll for completion
    const result = await pollForCompletion(apiToken, prediction.id);

    // Step 3: Download audio
    const audioUrl = result.output;
    if (!audioUrl) {
      throw new ApiError(
        `Replicate returned no output: ${result.error ?? 'unknown error'}`,
        'replicate'
      );
    }

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new ApiError('Failed to download generated audio', 'replicate', audioResponse.status);
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    await writeFile(outputPath, audioBuffer);

    log.info(`Music saved: ${outputPath} (${clampedDuration}s)`);

    return {
      id: randomUUID(),
      path: outputPath,
      type: 'music',
      durationSeconds: clampedDuration,
      metadata: { prompt, model: MODEL_VERSION },
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

// -- Replicate polling --

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string;
  error?: string;
}

async function pollForCompletion(
  apiToken: string,
  predictionId: string
): Promise<ReplicatePrediction> {
  const MAX_POLLS = 120;
  const POLL_INTERVAL_MS = 5000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const response = await fetch(`${REPLICATE_BASE}/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });

    if (!response.ok) {
      throw new ApiError(
        `Replicate status check failed: ${response.status}`,
        'replicate',
        response.status
      );
    }

    const prediction = (await response.json()) as ReplicatePrediction;

    if (prediction.status === 'succeeded') {
      return prediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new ApiError(
        `Music generation ${prediction.status}: ${prediction.error ?? 'no details'}`,
        'replicate'
      );
    }

    log.debug(`Poll ${i + 1}/${MAX_POLLS}: status=${prediction.status}`);
  }

  throw new ApiError('Music generation timed out after 10 minutes', 'replicate');
}
