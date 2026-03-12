import { randomUUID } from 'node:crypto';
import { writeFile } from 'fs/promises';
import { join } from 'path';

import { ApiError, AssetError } from '../errors/index.js';
import { AssetFile } from '../types/index.js';
import { requireEnv } from '../utils/env.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('elevenlabs-music');

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

interface MusicGenerateOptions {
  prompt: string;
  durationSeconds: number;
  outputPath: string;
  forceInstrumental?: boolean;
}

export async function generateMusicElevenLabs(
  options: MusicGenerateOptions
): Promise<AssetFile> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY');

  const {
    prompt,
    durationSeconds,
    outputPath,
    forceInstrumental = true,
  } = options;

  // Generate a 2-minute loop segment — FFmpeg loops it to fill the video
  const durationMs = Math.min(durationSeconds * 1000, 120000);

  log.info(`Generating music via ElevenLabs: "${prompt.slice(0, 80)}..." (${durationSeconds}s)`);
  await ensureDir(join(outputPath, '..'));

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/music`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        music_length_ms: durationMs,
        model_id: 'music_v1',
        force_instrumental: forceInstrumental,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(
        `ElevenLabs Music API returned ${response.status}: ${errorBody}`,
        'elevenlabs-music',
        response.status
      );
    }

    // Response is binary audio
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, audioBuffer);

    log.info(`Music saved: ${outputPath} (${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB)`);

    return {
      id: randomUUID(),
      path: outputPath,
      type: 'music',
      durationSeconds,
      metadata: { prompt, provider: 'elevenlabs' },
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new AssetError(
      `ElevenLabs music generation failed: ${(error as Error).message}`,
      'music',
      error as Error
    );
  }
}
