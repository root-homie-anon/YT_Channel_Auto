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

  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',
  TELEGRAM_OWNER_ID: process.env.TELEGRAM_OWNER_ID ?? '',

  // Gemini / Nano Banana 2
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',

  // Anthropic (Prompt Grounding)
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',

  // Tavily (Visual Reference Search)
  TAVILY_API_KEY: process.env.TAVILY_API_KEY ?? '',

  // YouTube OAuth
  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID ?? '',
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ?? '',

  // ZapCap (Captions)
  ZAPCAP_API_KEY: process.env.ZAPCAP_API_KEY ?? '',
  ZAPCAP_API_SECRET: process.env.ZAPCAP_API_SECRET ?? '',

  // Supabase (Asset Archival)
  SUPABASE_URL: process.env.SUPABASE_URL ?? '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ?? '',

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

const REQUIRED_ENV_VARS: ReadonlyArray<keyof typeof ENV> = [
  'ANTHROPIC_API_KEY',
  'FLUX_API_KEY',
  'ELEVENLABS_API_KEY',
  'REPLICATE_API_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
];

const OPTIONAL_ENV_VARS: ReadonlyArray<keyof typeof ENV> = [
  'TAVILY_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'RUNWAY_API_KEY',
  'TELEGRAM_OWNER_ID',
  'DASHBOARD_USER',
  'DASHBOARD_PASS',
];

/**
 * Validates all critical env vars at once. Throws with a complete list of missing vars
 * so the operator can fix all issues in one restart. Call at server startup.
 */
export function validateRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !ENV[key]);
  if (missing.length > 0) {
    throw new Error(
      `Server startup aborted — missing required environment variables:\n` +
      missing.map((k) => `  - ${k}`).join('\n') +
      `\n\nAdd these to your .env file and restart.`
    );
  }

  const missingOptional = OPTIONAL_ENV_VARS.filter((key) => !ENV[key]);
  if (missingOptional.length > 0) {
    console.warn(
      `[env] Optional env vars not set (some features may be disabled): ${missingOptional.join(', ')}`
    );
  }
}
