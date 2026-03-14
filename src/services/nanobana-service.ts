import { GoogleGenAI } from '@google/genai';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { requireEnv } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import { ApiError } from '../errors/index.js';

const log = createLogger('nbpro');

type AspectRatio = '16:9' | '9:16';
type Resolution = '2K' | '4K';

export interface ThumbnailOptions {
  prompt: string;
  aspectRatio: AspectRatio;
  outputPath: string;
  resolution?: Resolution;
  systemInstruction?: string;
  model?: string;
  generationSettings?: {
    topP?: number;
    maxOutputTokens?: number;
    groundingEnabled?: boolean;
  };
}

export interface ThumbnailResult {
  filePath: string;
  model: string;
  generatedAt: string;
}

const DEFAULT_MODEL = 'gemini-3-pro-image-preview';

function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') });
}

export async function generateThumbnailNBPro(
  options: ThumbnailOptions
): Promise<ThumbnailResult> {
  const {
    prompt,
    aspectRatio,
    outputPath,
    resolution = '4K',
    systemInstruction,
    model: modelOverride,
    generationSettings,
  } = options;

  const model = modelOverride ?? process.env.GEMINI_IMAGE_MODEL ?? DEFAULT_MODEL;

  const fullPrompt = `Generate an image with these specifications:\n${prompt}\nOutput specs: ${resolution} resolution, ${aspectRatio} aspect ratio, thumbnail-optimized, all elements clearly readable at mobile size (320px width minimum).`;

  log.info(`Generating thumbnail via ${model} (${aspectRatio}, ${resolution})`);
  if (systemInstruction) {
    log.info(`System instruction loaded (${systemInstruction.length} chars)`);
  }

  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(generationSettings?.topP != null ? { topP: generationSettings.topP } : {}),
        ...(generationSettings?.maxOutputTokens != null ? { maxOutputTokens: generationSettings.maxOutputTokens } : {}),
        imageConfig: {
          aspectRatio,
          imageSize: resolution,
        },
      },
    });

    // Extract image from response parts
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new ApiError(`No response parts returned from ${model}`, 'nbpro');
    }

    const imagePart = parts.find(
      (p) => 'inlineData' in p && p.inlineData != null
    );

    const imageData = imagePart && 'inlineData' in imagePart
      ? (imagePart.inlineData as { data?: string })?.data
      : undefined;

    if (!imageData) {
      throw new ApiError(`No image data returned from ${model}`, 'nbpro');
    }

    await mkdir(dirname(outputPath), { recursive: true });

    const buffer = Buffer.from(imageData, 'base64');
    await writeFile(outputPath, buffer);

    log.info(`Thumbnail saved: ${outputPath}`);

    return {
      filePath: outputPath,
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `Thumbnail generation failed: ${(error as Error).message}`,
      'nbpro'
    );
  }
}

/**
 * Load a system instruction file from disk.
 */
export async function loadSystemInstruction(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8');
  return content;
}
