import { join } from 'path';

import { DescriptionRotationState } from '../types/index.js';
import { readJsonFile, writeJsonFile, fileExists } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('description-state');

const STATE_FILE = 'description-state.json';

function defaultState(): DescriptionRotationState {
  return {
    lastBlock1Opener: 0,
    lastBlock2Opener: 0,
    lastGenreTags: [],
    lastFunctionTags: [],
    lastVibeTags: [],
    lastMoodDescriptors: [],
    lastStyleDescriptors: [],
    updatedAt: new Date().toISOString(),
    lastProductionId: '',
  };
}

export async function loadDescriptionState(channelDir: string): Promise<DescriptionRotationState> {
  const statePath = join(channelDir, STATE_FILE);

  if (!(await fileExists(statePath))) {
    log.info('No description state found — using defaults');
    return defaultState();
  }

  try {
    return await readJsonFile<DescriptionRotationState>(statePath);
  } catch {
    log.warn('Corrupt description state — resetting to defaults');
    return defaultState();
  }
}

export async function saveDescriptionState(
  channelDir: string,
  state: DescriptionRotationState
): Promise<void> {
  state.updatedAt = new Date().toISOString();
  const statePath = join(channelDir, STATE_FILE);
  await writeJsonFile(statePath, state);
  log.info(`Description state saved (production: ${state.lastProductionId})`);
}
