import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { requireEnv } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import { ApiError } from '../errors/index.js';

const log = createLogger('nanobana');

type AspectRatio = '16:9' | '9:16';
type Resolution = '2K' | '4K';

export interface ThumbnailOptions {
  prompt: string;
  aspectRatio: AspectRatio;
  outputPath: string;
  resolution?: Resolution;
}

export interface ThumbnailResult {
  filePath: string;
  model: string;
  generatedAt: string;
}

const MODEL = 'gemini-3.1-flash-image-preview';

function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') });
}

export async function generateThumbnailNB2(
  options: ThumbnailOptions
): Promise<ThumbnailResult> {
  const { prompt, aspectRatio, outputPath, resolution = '4K' } = options;

  const fullPrompt = `${prompt}\nOutput specs: ${resolution} resolution, thumbnail-optimized, all elements clearly readable at mobile size (320px width minimum).`;

  log.info(`Generating thumbnail via ${MODEL} (${aspectRatio}, ${resolution})`);

  try {
    const ai = getClient();
    const response = await ai.models.generateImages({
      model: MODEL,
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio,
      },
    });

    const imageData = response.generatedImages?.[0]?.image?.imageBytes;

    if (!imageData) {
      throw new ApiError(`No image data returned from ${MODEL}`, 'nanobana');
    }

    await mkdir(dirname(outputPath), { recursive: true });

    const buffer = Buffer.from(imageData, 'base64');
    await writeFile(outputPath, buffer);

    log.info(`Thumbnail saved: ${outputPath}`);

    return {
      filePath: outputPath,
      model: MODEL,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `Thumbnail generation failed: ${(error as Error).message}`,
      'nanobana'
    );
  }
}
