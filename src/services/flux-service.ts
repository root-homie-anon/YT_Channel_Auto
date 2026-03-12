import { join } from 'path';
import { writeFile } from 'fs/promises';

import { ApiError, AssetError } from '../errors/index.js';
import { AssetFile } from '../types/index.js';
import { requireEnv } from '../utils/env.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('flux-service');

interface FluxGenerateOptions {
  prompt: string;
  width?: number;
  height?: number;
  outputPath: string;
}

export async function generateImage(options: FluxGenerateOptions): Promise<AssetFile> {
  const apiKey = requireEnv('FLUX_API_KEY');
  const apiUrl = requireEnv('FLUX_API_URL');

  const { prompt, width = 1920, height = 1080, outputPath } = options;

  log.info(`Generating image: "${prompt.slice(0, 80)}..."`);
  await ensureDir(join(outputPath, '..'));

  try {
    // Step 1: Submit generation request
    const submitResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        output_format: 'png',
      }),
    });

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text();
      throw new ApiError(
        `BFL API returned ${submitResponse.status}: ${errorBody}`,
        'flux',
        submitResponse.status
      );
    }

    const submitResult = (await submitResponse.json()) as { id: string; polling_url: string };
    log.info(`Image generation submitted, task: ${submitResult.id}`);

    // Step 2: Poll for completion
    const sampleUrl = await pollForResult(submitResult.polling_url ?? `https://api.bfl.ai/v1/get_result?id=${submitResult.id}`);

    // Step 3: Download the image (signed URL valid for 10 min)
    const imageResponse = await fetch(sampleUrl);
    if (!imageResponse.ok) {
      throw new ApiError('Failed to download generated image from BFL', 'flux', imageResponse.status);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    await writeFile(outputPath, imageBuffer);

    log.info(`Image saved: ${outputPath}`);

    return {
      id: crypto.randomUUID(),
      path: outputPath,
      type: 'image',
      metadata: { prompt, width: String(width), height: String(height) },
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new AssetError(
      `Image generation failed: ${(error as Error).message}`,
      'image',
      error as Error
    );
  }
}

async function pollForResult(pollingUrl: string): Promise<string> {
  const MAX_POLLS = 60;
  const POLL_INTERVAL_MS = 3000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const response = await fetch(pollingUrl);
    if (!response.ok) {
      throw new ApiError(
        `BFL polling failed: ${response.status}`,
        'flux',
        response.status
      );
    }

    const result = (await response.json()) as {
      status: string;
      result?: { sample: string };
    };

    if (result.status === 'Ready' && result.result?.sample) {
      return result.result.sample;
    }

    if (result.status === 'Error' || result.status === 'Failed') {
      throw new ApiError('BFL image generation failed', 'flux');
    }

    log.debug(`Poll ${i + 1}/${MAX_POLLS}: status=${result.status}`);
  }

  throw new ApiError('BFL image generation timed out after 3 minutes', 'flux');
}

export async function generateBatchImages(
  cues: Array<{ id: string; prompt: string }>,
  outputDir: string,
  imageFramework: string
): Promise<AssetFile[]> {
  await ensureDir(outputDir);
  const results: AssetFile[] = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const outputPath = join(outputDir, `image-${String(i).padStart(3, '0')}-${cue.id}.png`);
    const enhancedPrompt = `${cue.prompt}\n\nStyle guide: ${imageFramework}`;

    const asset = await generateImage({
      prompt: enhancedPrompt,
      outputPath,
    });
    results.push({ ...asset, id: cue.id });
  }

  return results;
}
