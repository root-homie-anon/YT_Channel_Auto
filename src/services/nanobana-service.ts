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

// Preferred: gemini-3.1-flash-image-preview (NB2), fallback: gemini-2.5-flash-image (NB1)
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image';

function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') });
}

export async function generateThumbnailNB2(
  options: ThumbnailOptions
): Promise<ThumbnailResult> {
  const { prompt, aspectRatio, outputPath, resolution = '4K' } = options;

  const fullPrompt = `Generate an image with these specifications:\n${prompt}\nOutput specs: ${resolution} resolution, ${aspectRatio} aspect ratio, thumbnail-optimized, all elements clearly readable at mobile size (320px width minimum).`;

  log.info(`Generating thumbnail via ${MODEL} (${aspectRatio}, ${resolution})`);

  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: fullPrompt,
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio,
          imageSize: resolution,
        },
      },
    });

    // Extract image from response parts
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new ApiError(`No response parts returned from ${MODEL}`, 'nanobana');
    }

    const imagePart = parts.find(
      (p) => 'inlineData' in p && p.inlineData != null
    );

    const imageData = imagePart && 'inlineData' in imagePart
      ? (imagePart.inlineData as { data?: string })?.data
      : undefined;

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
