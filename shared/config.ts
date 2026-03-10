import 'dotenv/config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Config {
  elevenlabs: {
    apiKey: string;
  };
  flux: {
    apiKey: string;
  };
  gemini: {
    apiKey: string;
  };
  sonauto: {
    apiKey: string;
  };
  runway: {
    apiKey: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REQUIRED_KEYS = [
  'ELEVENLABS_API_KEY',
  'FLUX_API_KEY',
  'GEMINI_API_KEY',
  'SONAUTO_API_KEY',
  'RUNWAY_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
] as const;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[config] Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function validateAll(): void {
  const missing = REQUIRED_KEYS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === '',
  );

  if (missing.length > 0) {
    throw new Error(
      `[config] Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n\nCopy env.example to .env and fill in all values.`,
    );
  }
}

// ─── Load ─────────────────────────────────────────────────────────────────────

function loadConfig(): Config {
  validateAll();

  return {
    elevenlabs: {
      apiKey: requireEnv('ELEVENLABS_API_KEY'),
    },
    flux: {
      apiKey: requireEnv('FLUX_API_KEY'),
    },
    gemini: {
      apiKey: requireEnv('GEMINI_API_KEY'),
    },
    sonauto: {
      apiKey: requireEnv('SONAUTO_API_KEY'),
    },
    runway: {
      apiKey: requireEnv('RUNWAY_API_KEY'),
    },
    telegram: {
      botToken: requireEnv('TELEGRAM_BOT_TOKEN'),
      chatId: requireEnv('TELEGRAM_CHAT_ID'),
    },
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const config: Config = loadConfig();
