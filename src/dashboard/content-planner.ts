import { ContentPlan, ChannelConfig, ChannelFormat } from '../types/index.js';

const DEFAULT_DURATIONS: Record<ChannelFormat, number> = {
  long: 600,
  short: 60,
  'long+short': 600,
  'music-only': 3600,
};

export interface MusicOnlyOptions {
  durationMinutes?: number;
  segmentCount?: number;
  imagePrompt?: string;
  musicPrompt?: string;
  animationPrompt?: string;
}

export function buildContentPlan(
  topic: string,
  config: ChannelConfig,
  musicOptions?: MusicOnlyOptions,
): ContentPlan {
  const duration =
    config.channel.format === 'music-only' && musicOptions?.durationMinutes
      ? musicOptions.durationMinutes * 60
      : DEFAULT_DURATIONS[config.channel.format];

  const plan: ContentPlan = {
    topic,
    angle: topic,
    keyPoints: [],
    targetDurationSeconds: duration,
    format: config.channel.format,
  };

  if (config.channel.format === 'music-only' && musicOptions) {
    if (musicOptions.segmentCount && musicOptions.segmentCount > 1) {
      plan.segmentCount = musicOptions.segmentCount;
    }
    const prompts: Record<string, string> = {};
    if (musicOptions.imagePrompt) prompts.imagePrompt = musicOptions.imagePrompt;
    if (musicOptions.musicPrompt) prompts.musicPrompt = musicOptions.musicPrompt;
    if (musicOptions.animationPrompt) prompts.animationPrompt = musicOptions.animationPrompt;
    if (Object.keys(prompts).length > 0) {
      plan.musicOnlyPrompts = prompts as ContentPlan['musicOnlyPrompts'];
    }
  }

  return plan;
}
