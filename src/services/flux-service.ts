import { join } from 'path';

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
    const response = await fetch(`${apiUrl}/v1/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        output_format: 'png',
      }),
    });

    if (!response.ok) {
      throw new ApiError(
        `Flux API returned ${response.status}: ${response.statusText}`,
        'flux',
        response.status
      );
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const { writeFile } = await import('fs/promises');
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
