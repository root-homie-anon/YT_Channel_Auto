import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

config({ path: resolve(PROJECT_ROOT, '.env') });

export const ENV = {
  // Flux
  FLUX_API_KEY: process.env.FLUX_API_KEY ?? '',
  FLUX_API_URL: process.env.FLUX_API_URL ?? '',

  // ElevenLabs
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? '',

  // Replicate (Stable Audio 2.5)
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN ?? '',

  // Runway ML
  RUNWAY_API_KEY: process.env.RUNWAY_API_KEY ?? '',

  // YouTube
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY ?? '',

  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',

  // Gemini / Nano Banana 2
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',

  // YouTube OAuth
  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID ?? '',
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ?? '',

  // Dashboard
  DASHBOARD_PORT: process.env.DASHBOARD_PORT ?? '3000',
  DASHBOARD_USER: process.env.DASHBOARD_USER ?? '',
  DASHBOARD_PASS: process.env.DASHBOARD_PASS ?? '',

  // General
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
} as const;

export function requireEnv(key: keyof typeof ENV): string {
  const value = ENV[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
