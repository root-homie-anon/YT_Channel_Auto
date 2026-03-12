import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ChannelFormat, ChannelConfig } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const TEMPLATES_DIR = join(PROJECT_ROOT, 'shared', 'channel-templates');
const FRAMEWORK_TEMPLATES_DIR = join(PROJECT_ROOT, 'templates', 'channel', 'frameworks');

export interface ChannelInputs {
  name: string;
  slug: string;
  format: ChannelFormat;
  niche: string;
  elevenLabsVoiceId: string;
  musicOnly: {
    defaultDurationHours: number | null;
    defaultSegmentCount: number | null;
  };
}

export function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export const TEMPLATE_MAP: Record<ChannelFormat, string> = {
  long: 'template-long.md',
  short: 'template-short.md',
  'long+short': 'template-long-short.md',
  'music-only': 'template-music-only.md',
};

export const FRAMEWORK_FILES: Record<ChannelFormat, string[]> = {
  long: ['script-formula.md', 'image-framework.md', 'music-framework.md', 'thumbnail-formula.md', 'title-formula.md'],
  short: ['script-formula.md', 'image-framework.md', 'music-framework.md', 'thumbnail-formula.md', 'title-formula.md'],
  'long+short': ['script-formula.md', 'image-framework.md', 'music-framework.md', 'thumbnail-formula.md', 'title-formula.md', 'teaser-formula.md'],
  'music-only': ['image-framework.md', 'music-framework.md', 'thumbnail-formula.md', 'title-formula.md'],
};

export function processTemplate(inputs: ChannelInputs, oauthPath: string): string {
  const templateFile = TEMPLATE_MAP[inputs.format];
  const templatePath = join(TEMPLATES_DIR, templateFile);
  let content = readFileSync(templatePath, 'utf-8');

  const replacements: Record<string, string> = {
    '{{CHANNEL_NAME}}': inputs.name,
    '{{CHANNEL_SLUG}}': inputs.slug,
    '{{CHANNEL_NICHE}}': inputs.niche,
    '{{ELEVENLABS_VOICE_ID}}': inputs.elevenLabsVoiceId,
    '{{YOUTUBE_OAUTH_PATH}}': oauthPath,
    '{{DEFAULT_DURATION_HOURS}}': String(inputs.musicOnly.defaultDurationHours ?? 'not set'),
    '{{DEFAULT_SEGMENT_COUNT}}': String(inputs.musicOnly.defaultSegmentCount ?? 'none — seamless video'),
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, value);
  }

  return content;
}

export function buildConfig(inputs: ChannelInputs, oauthPath: string): ChannelConfig {
  const includesShorts = inputs.format === 'short' || inputs.format === 'long+short';
  const includesNarration = inputs.format !== 'music-only';

  const config: ChannelConfig = {
    channel: {
      name: inputs.name,
      slug: inputs.slug,
      format: inputs.format,
      niche: inputs.niche,
    },
    credentials: {
      youtubeOAuthPath: oauthPath,
      elevenLabsVoiceId: inputs.elevenLabsVoiceId,
    },
    frameworks: {
      script: includesNarration ? 'frameworks/script-formula.md' : '',
      image: 'frameworks/image-framework.md',
      music: 'frameworks/music-framework.md',
      thumbnail: 'frameworks/thumbnail-formula.md',
      title: 'frameworks/title-formula.md',
      ...(includesShorts && { teaser: 'frameworks/teaser-formula.md' }),
    },
    ...(inputs.format === 'music-only' && { musicOnly: inputs.musicOnly }),
  };

  return config;
}

export function scaffoldFrameworks(frameworksDir: string, format: ChannelFormat): void {
  mkdirSync(frameworksDir, { recursive: true });
  for (const file of FRAMEWORK_FILES[format]) {
    const destPath = join(frameworksDir, file);
    const templatePath = join(FRAMEWORK_TEMPLATES_DIR, file);
    if (existsSync(templatePath)) {
      copyFileSync(templatePath, destPath);
    } else {
      const name = file.replace('.md', '').replace(/-/g, ' ');
      writeFileSync(destPath, `# ${name}\n\n<!-- Author your framework here before first run -->\n`);
    }
  }
}

export function createChannel(inputs: ChannelInputs): ChannelConfig {
  const channelDir = join(PROJECT_ROOT, 'projects', inputs.slug);
  const frameworksDir = join(channelDir, 'frameworks');
  const oauthPath = `projects/${inputs.slug}/.youtube-oauth.json`;

  mkdirSync(channelDir, { recursive: true });

  const claudeMd = processTemplate(inputs, oauthPath);
  writeFileSync(join(channelDir, 'CLAUDE.md'), claudeMd);

  const config = buildConfig(inputs, oauthPath);
  writeFileSync(join(channelDir, 'config.json'), JSON.stringify(config, null, 2));

  scaffoldFrameworks(frameworksDir, inputs.format);

  return config;
}
