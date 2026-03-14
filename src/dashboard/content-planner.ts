import { ContentPlan, ChannelConfig, ChannelFormat } from '../types/index.js';

const DEFAULT_DURATIONS: Record<ChannelFormat, number> = {
  long: 600,
  short: 60,
  'long+short': 600,
  'music-only': 3600,
};

const MUSIC_SEGMENT_DURATION = 190; // Stable Audio 2.5 max per generation

export interface MusicOnlyOptions {
  segmentCount?: number;
  imagePrompts: string[];
  musicPrompt: string;
  animationPrompts: string[];
  lastEnvironment?: string;
  lastAtmosphere?: string;
}

export function buildContentPlan(
  topic: string,
  config: ChannelConfig,
  musicOptions?: MusicOnlyOptions,
): ContentPlan {
  const segments = config.channel.format === 'music-only'
    ? (musicOptions?.segmentCount ?? 1)
    : 0;
  const duration = config.channel.format === 'music-only'
    ? segments * MUSIC_SEGMENT_DURATION
    : DEFAULT_DURATIONS[config.channel.format];

  const plan: ContentPlan = {
    topic,
    angle: topic,
    keyPoints: [],
    targetDurationSeconds: duration,
    format: config.channel.format,
  };

  if (config.channel.format === 'music-only' && musicOptions) {
    plan.segmentCount = musicOptions.segmentCount ?? 1;
    const prompts: ContentPlan['musicOnlyPrompts'] = {
      imagePrompts: musicOptions.imagePrompts,
      musicPrompt: musicOptions.musicPrompt,
      animationPrompts: musicOptions.animationPrompts,
    };
    if (musicOptions.lastEnvironment) prompts!.lastEnvironment = musicOptions.lastEnvironment;
    if (musicOptions.lastAtmosphere) prompts!.lastAtmosphere = musicOptions.lastAtmosphere;
    plan.musicOnlyPrompts = prompts;
  }

  return plan;
}
