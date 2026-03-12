import { ContentPlan, ChannelConfig, ChannelFormat } from '../types/index.js';

const DEFAULT_DURATIONS: Record<ChannelFormat, number> = {
  long: 600,
  short: 60,
  'long+short': 600,
  'music-only': 3600,
};

export function buildContentPlan(topic: string, config: ChannelConfig): ContentPlan {
  const duration =
    config.channel.format === 'music-only' && config.musicOnly?.defaultDurationHours
      ? config.musicOnly.defaultDurationHours * 3600
      : DEFAULT_DURATIONS[config.channel.format];

  return {
    topic,
    angle: topic,
    keyPoints: [],
    targetDurationSeconds: duration,
    format: config.channel.format,
  };
}
