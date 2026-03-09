import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY ?? (() => { throw new Error('ELEVENLABS_API_KEY is required'); })(),
  },
  flux: {
    apiKey: process.env.FLUX_API_KEY ?? (() => { throw new Error('FLUX_API_KEY is required'); })(),
  },
  sonauto: {
    apiKey: process.env.SONAUTO_API_KEY ?? (() => { throw new Error('SONAUTO_API_KEY is required'); })(),
  },
  runway: {
    apiKey: process.env.RUNWAY_API_KEY ?? (() => { throw new Error('RUNWAY_API_KEY is required'); })(),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? (() => { throw new Error('TELEGRAM_BOT_TOKEN is required'); })(),
    chatId: process.env.TELEGRAM_CHAT_ID ?? (() => { throw new Error('TELEGRAM_CHAT_ID is required'); })(),
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? (() => { throw new Error('YOUTUBE_API_KEY is required'); })(),
  },
} as const;
