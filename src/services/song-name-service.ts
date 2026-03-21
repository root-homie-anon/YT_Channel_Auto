import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { requireEnv } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import { ApiError } from '../errors/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

const log = createLogger('song-name');

interface SongNameInput {
  imagePrompt: string;
  musicPrompt: string;
  segmentIndex: number;
  totalSegments: number;
  existingNames: string[];
  channelName?: string | undefined;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are a song title generator for an electronic/synth music channel.

Generate a short, evocative song title (2-5 words) for an instrumental electronic track.

Rules:
- The title should feel like a real song name you'd see on Spotify
- Draw from the visual scene and musical mood — don't just describe them literally
- Evoke a feeling, place, or moment — not a technical description
- No quotes, no punctuation except hyphens, no emojis
- No generic titles like "Chill Vibes" or "Night Drive" — be specific and poetic
- Each title must be COMPLETELY UNIQUE — never reuse a title that already exists
- Capitalize like a song title (Title Case)

Output ONLY the title, nothing else.`;

async function callHaiku(userMessage: string): Promise<string> {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }] as ClaudeMessage[],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(`Claude API failed: ${response.status} ${body}`, 'anthropic', response.status);
  }

  const result = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  return result.content[0]?.text?.trim() ?? '';
}

export async function generateSongName(input: SongNameInput): Promise<string> {
  const MAX_ATTEMPTS = 3;
  const usedLower = new Set(input.existingNames.map((n) => n.toLowerCase()));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const avoidBlock = input.existingNames.length > 0
      ? `\nALREADY USED TITLES (do NOT reuse any of these):\n${input.existingNames.map((n) => `- ${n}`).join('\n')}\n`
      : '';

    const retryNote = attempt > 1 ? `\nATTEMPT ${attempt} — your previous suggestion was a duplicate. Generate something COMPLETELY different.\n` : '';

    const userMessage = `Generate a song title for segment ${input.segmentIndex + 1} of ${input.totalSegments}.

VISUAL SCENE: ${input.imagePrompt.slice(0, 300)}

MUSICAL MOOD: ${input.musicPrompt.slice(0, 200)}
${avoidBlock}${retryNote}
Output ONLY the song title.`;

    const name = await callHaiku(userMessage);
    if (!name) continue;

    if (!usedLower.has(name.toLowerCase())) {
      log.info(`Song name for segment ${input.segmentIndex + 1}: "${name}"`);
      return name;
    }

    log.warn(`Duplicate song name "${name}" on attempt ${attempt}, retrying`);
  }

  // Fallback: append segment number to make unique
  const fallback = `Track ${input.segmentIndex + 1} (${Date.now().toString(36).slice(-4)})`;
  log.warn(`Could not generate unique name after ${MAX_ATTEMPTS} attempts, using: "${fallback}"`);
  return fallback;
}

/**
 * Load all existing song names from a channel's completed productions.
 */
export async function loadExistingSongNames(channelSlug: string): Promise<string[]> {
  const outputBase = join(PROJECT_ROOT, 'projects', channelSlug, 'output');
  if (!existsSync(outputBase)) return [];

  const names: string[] = [];
  const dirs = await readdir(outputBase, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const manifestPath = join(outputBase, dir.name, 'asset-manifest.json');
    if (!existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      for (const music of manifest.music ?? []) {
        const songName = music.metadata?.songName;
        if (songName) names.push(songName);
      }
    } catch { /* skip */ }
  }

  return names;
}

export async function generateSongNames(
  imagePrompts: string[],
  musicPrompt: string,
  channelName?: string,
  channelSlug?: string,
): Promise<string[]> {
  // Load all previously used song names to avoid duplicates
  const existingNames = channelSlug
    ? await loadExistingSongNames(channelSlug)
    : [];

  if (existingNames.length > 0) {
    log.info(`Loaded ${existingNames.length} existing song names to avoid duplicates`);
  }

  const names: string[] = [];
  const allUsed = [...existingNames];
  const total = imagePrompts.length;

  for (let i = 0; i < total; i++) {
    try {
      const name = await generateSongName({
        imagePrompt: imagePrompts[i],
        musicPrompt,
        segmentIndex: i,
        totalSegments: total,
        existingNames: allUsed,
        channelName,
      });
      names.push(name);
      allUsed.push(name); // prevent duplicates within same batch
    } catch (err) {
      log.warn(`Song name gen failed for segment ${i}: ${(err as Error).message}`);
      const fallback = `Track ${i + 1}`;
      names.push(fallback);
      allUsed.push(fallback);
    }
  }

  return names;
}
