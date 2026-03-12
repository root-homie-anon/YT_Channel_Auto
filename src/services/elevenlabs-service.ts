import { randomUUID } from 'node:crypto';
import { join } from 'path';
import { writeFile } from 'fs/promises';

import { ApiError, AssetError } from '../errors/index.js';
import { AssetFile } from '../types/index.js';
import { requireEnv } from '../utils/env.js';
import { ensureDir } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('elevenlabs-service');

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

interface VoiceoverOptions {
  text: string;
  voiceId: string;
  outputPath: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
}

export async function generateVoiceover(options: VoiceoverOptions): Promise<AssetFile> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY');

  const {
    text,
    voiceId,
    outputPath,
    modelId = 'eleven_multilingual_v2',
    stability = 0.5,
    similarityBoost = 0.75,
    speed = 0.85,
  } = options;

  log.info(`Generating voiceover (${text.length} chars) with voice ${voiceId}`);
  await ensureDir(join(outputPath, '..'));

  try {
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            speed,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new ApiError(
        `ElevenLabs API returned ${response.status}: ${errorBody}`,
        'elevenlabs',
        response.status
      );
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, audioBuffer);

    log.info(`Voiceover saved: ${outputPath}`);

    return {
      id: randomUUID(),
      path: outputPath,
      type: 'voiceover',
      metadata: { voiceId, modelId, charCount: String(text.length) },
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new AssetError(
      `Voiceover generation failed: ${(error as Error).message}`,
      'voiceover',
      error as Error
    );
  }
}

export async function generateSectionVoiceovers(
  sections: Array<{ id: string; text: string }>,
  voiceId: string,
  outputDir: string
): Promise<AssetFile[]> {
  await ensureDir(outputDir);
  const results: AssetFile[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const outputPath = join(outputDir, `vo-${String(i).padStart(3, '0')}-${section.id}.mp3`);

    const asset = await generateVoiceover({
      text: section.text,
      voiceId,
      outputPath,
    });
    results.push({ ...asset, id: section.id });
  }

  return results;
}
