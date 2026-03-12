import { readFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { ConfigError } from '../errors/index.js';
import { ChannelConfig } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

export async function loadChannelConfig(channelSlug: string): Promise<ChannelConfig> {
  const channelDir = join(PROJECT_ROOT, 'projects', channelSlug);
  const configPath = join(channelDir, 'config.json');

  try {
    const raw = await readFile(configPath, 'utf-8');
    const config: ChannelConfig = JSON.parse(raw);
    validateConfig(config, configPath);
    return config;
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(
      `Failed to load channel config: ${(error as Error).message}`,
      configPath
    );
  }
}

export async function loadFramework(channelDir: string, frameworkPath: string): Promise<string> {
  const fullPath = join(channelDir, frameworkPath);
  try {
    return await readFile(fullPath, 'utf-8');
  } catch {
    throw new ConfigError(`Framework file not found: ${frameworkPath}`, fullPath);
  }
}

export async function loadSharedDescriptionFormula(): Promise<string> {
  const formulaPath = join(PROJECT_ROOT, 'shared', 'description-formula.md');
  try {
    return await readFile(formulaPath, 'utf-8');
  } catch {
    throw new ConfigError('Shared description formula not found', formulaPath);
  }
}

export function getChannelDir(channelSlug: string): string {
  return join(PROJECT_ROOT, 'projects', channelSlug);
}

export function getOutputDir(channelSlug: string, productionId: string): string {
  return join(PROJECT_ROOT, 'projects', channelSlug, 'output', productionId);
}

function validateConfig(config: ChannelConfig, configPath: string): void {
  if (!config.channel?.name) {
    throw new ConfigError('Missing channel.name', configPath);
  }
  if (!config.channel?.slug) {
    throw new ConfigError('Missing channel.slug', configPath);
  }
  if (!config.channel?.format) {
    throw new ConfigError('Missing channel.format', configPath);
  }
  const validFormats = ['long', 'short', 'long+short', 'music-only'];
  if (!validFormats.includes(config.channel.format)) {
    throw new ConfigError(
      `Invalid format "${config.channel.format}". Must be one of: ${validFormats.join(', ')}`,
      configPath
    );
  }
  if (!config.credentials?.elevenLabsVoiceId && config.channel.format !== 'music-only') {
    throw new ConfigError('Missing credentials.elevenLabsVoiceId (required for non-music-only)', configPath);
  }
  if (!config.frameworks?.script) {
    throw new ConfigError('Missing frameworks.script path', configPath);
  }
}
