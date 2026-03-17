import { randomUUID } from 'node:crypto';
import { join } from 'path';
import { access, writeFile } from 'fs/promises';

import { ApiError, AssetError } from '../errors/index.js';
import { AssetFile } from '../types/index.js';
import { requireEnv } from '../utils/env.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

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

  const { prompt, width = 1280, height = 720, outputPath } = options;

  log.info(`Generating image: "${prompt.slice(0, 80)}..."`);
  await ensureDir(join(outputPath, '..'));

  try {
    // Step 1: Submit generation request (with retry for transient errors)
    const submitResult = await withRetry('flux-submit', async () => {
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

      return (await submitResponse.json()) as { id: string; polling_url: string };
    });
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
      id: randomUUID(),
      path: outputPath,
      type: 'image',
      metadata: { prompt, width: String(width), height: String(height), bflTaskId: submitResult.id, bflResultUrl: sampleUrl },
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
  const MAX_POLLS = 100;
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

    if (result.status === 'Error' || result.status === 'Failed' || result.status === 'Content Moderated' || result.status === 'Request Moderated') {
      const details = (result as Record<string, unknown>).details;
      const reason = details ? ` (${JSON.stringify(details)})` : '';
      throw new ApiError(`BFL image generation failed: ${result.status}${reason}`, 'flux');
    }

    log.debug(`Poll ${i + 1}/${MAX_POLLS}: status=${result.status}`);
  }

  throw new ApiError('BFL image generation timed out after 5 minutes', 'flux');
}

// ---------------------------------------------------------------------------
// Style tag extraction — appended to grounded prompts for visual consistency
// ---------------------------------------------------------------------------

/** Compact style anchor — appended to every grounded prompt */
const DEFAULT_STYLE_TAG = 'Mike Mignola Hellboy style, heavy black ink shadows, bold flat shapes, high-contrast, graphic novel panel, no faces, no text';

/**
 * Extract the style tag from the image framework's Flux Prompt Construction
 * Template section. Falls back to the **Style:** line, then DEFAULT_STYLE_TAG.
 */
export function extractStyleTag(imageFramework: string): string {
  const templateMatch = imageFramework.match(new RegExp('```\\n\\[subject.*?\\],\\s*(.+?)\\n```', 's'));
  if (templateMatch?.[1]) {
    return templateMatch[1].trim();
  }
  const styleMatch = imageFramework.match(/\*\*Style:\*\*\s*(.+)/);
  if (styleMatch?.[1]) {
    const firstSentence = styleMatch[1].split(/[.—]/)[0].trim();
    return firstSentence;
  }
  return DEFAULT_STYLE_TAG;
}

export async function generateBatchImages(
  cues: Array<{ id: string; prompt: string }>,
  outputDir: string,
  imageFramework: string,
  options?: { generatePortrait?: boolean }
): Promise<{ landscape: AssetFile[]; portrait: AssetFile[] }> {
  await ensureDir(outputDir);
  const landscape: AssetFile[] = [];
  const portrait: AssetFile[] = [];
  const styleTag = extractStyleTag(imageFramework);
  const genPortrait = options?.generatePortrait ?? false;

  if (genPortrait) {
    await ensureDir(join(outputDir, '..', 'images-portrait'));
  }

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    // Prompt is either pre-grounded (from prompt-grounding service) or raw cue
    // Append the channel's style tag for visual consistency
    const enhancedPrompt = `${cue.prompt}, ${styleTag}`;
    const wordCount = enhancedPrompt.split(/\s+/).filter(Boolean).length;
    log.info(`Prompt [${i}] (${wordCount}w): "${enhancedPrompt}"`);
    const prefix = `image-${String(i).padStart(3, '0')}-${cue.id}`;

    // 16:9 landscape (default) — retry with simplified prompt on content moderation
    const landscapePath = join(outputDir, `${prefix}.png`);
    let landscapeAsset: AssetFile;

    // Skip if already exists (resume support)
    const landscapeExists = await access(landscapePath).then(() => true, () => false);
    if (landscapeExists) {
      log.info(`Skipping existing landscape image ${i}: ${landscapePath}`);
      landscapeAsset = { id: cue.id, path: landscapePath, type: 'image', metadata: { prompt: enhancedPrompt } };
      landscape.push(landscapeAsset);

      if (genPortrait) {
        const portraitPath = join(outputDir, '..', 'images-portrait', `${prefix}.png`);
        const portraitExists = await access(portraitPath).then(() => true, () => false);
        if (portraitExists) {
          log.info(`Skipping existing portrait image ${i}: ${portraitPath}`);
          portrait.push({ id: cue.id, path: portraitPath, type: 'image', metadata: { prompt: enhancedPrompt } });
        } else {
          let portraitAsset: AssetFile;
          try {
            portraitAsset = await generateImage({
              prompt: `${enhancedPrompt}, vertical composition, portrait orientation`,
              width: 720,
              height: 1280,
              outputPath: portraitPath,
            });
          } catch (err) {
            const msg = (err as Error).message;
            if (msg.includes('Content Moderated')) {
              log.warn(`Portrait image ${i} moderated, retrying with simplified prompt`);
              const safePrompt = `Dark atmospheric scene, dramatic shadows and light, vertical composition, portrait orientation, ${styleTag}`;
              portraitAsset = await generateImage({ prompt: safePrompt, width: 720, height: 1280, outputPath: portraitPath });
            } else { throw err; }
          }
          portrait.push({ ...portraitAsset, id: cue.id });
        }
      }
      continue;
    }

    try {
      landscapeAsset = await generateImage({
        prompt: enhancedPrompt,
        width: 1280,
        height: 720,
        outputPath: landscapePath,
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Content Moderated') || msg.includes('Request Moderated')) {
        log.warn(`Image ${i} moderated, retrying with simplified prompt`);
        const safePrompt = `Dark atmospheric scene, dramatic shadows and light, ${styleTag}`;
        landscapeAsset = await generateImage({
          prompt: safePrompt,
          width: 1280,
          height: 720,
          outputPath: landscapePath,
        });
      } else if (msg.includes('402') || msg.includes('Insufficient credits') || msg.includes('Payment Required')) {
        log.error(`Flux credits exhausted at image ${i}/${cues.length}. Stopping image generation.`);
        throw new ApiError(
          `Flux API credits exhausted after generating ${i}/${cues.length} images. Add credits at https://api.bfl.ai and retry.`,
          'flux',
          402
        );
      } else {
        throw err;
      }
    }
    landscape.push({ ...landscapeAsset, id: cue.id });

    // 9:16 portrait (same prompt, vertical composition)
    if (genPortrait) {
      const portraitPath = join(outputDir, '..', 'images-portrait', `${prefix}.png`);
      let portraitAsset: AssetFile;
      try {
        portraitAsset = await generateImage({
          prompt: `${enhancedPrompt}, vertical composition, portrait orientation`,
          width: 720,
          height: 1280,
          outputPath: portraitPath,
        });
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('Content Moderated') || msg.includes('Request Moderated')) {
          log.warn(`Portrait image ${i} moderated, retrying with simplified prompt`);
          const safePrompt = `Dark atmospheric scene, dramatic shadows and light, vertical composition, portrait orientation, ${styleTag}`;
          portraitAsset = await generateImage({
            prompt: safePrompt,
            width: 720,
            height: 1280,
            outputPath: portraitPath,
          });
        } else if (msg.includes('402') || msg.includes('Insufficient credits') || msg.includes('Payment Required')) {
          log.error(`Flux credits exhausted at portrait image ${i}. Stopping.`);
          throw new ApiError(
            `Flux API credits exhausted. Add credits at https://api.bfl.ai and retry.`,
            'flux',
            402
          );
        } else {
          throw err;
        }
      }
      portrait.push({ ...portraitAsset, id: cue.id });
    }
  }

  return { landscape, portrait };
}
