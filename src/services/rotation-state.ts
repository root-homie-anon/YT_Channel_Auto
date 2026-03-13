import { join } from 'path';

import { readJsonFile, writeJsonFile, fileExists } from '../utils/file-helpers.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('rotation-state');

const STATE_FILE = 'rotation-state.json';
const MAX_IMAGE_SLOT = 8;

export interface RotationState {
  imageSlot: number;
  lastEnvironment: string;
  lastAtmosphere: string;
  productionCount: number;
  lastProductionId: string;
  lastUpdated: string;
}

const DEFAULT_STATE: RotationState = {
  imageSlot: 1,
  lastEnvironment: '',
  lastAtmosphere: '',
  productionCount: 0,
  lastProductionId: '',
  lastUpdated: '',
};

export async function loadRotationState(channelDir: string): Promise<RotationState> {
  const statePath = join(channelDir, STATE_FILE);

  if (await fileExists(statePath)) {
    const state = await readJsonFile<RotationState>(statePath);
    log.info(`Loaded rotation state: slot ${state.imageSlot}, production #${state.productionCount}`);
    return state;
  }

  log.info('No rotation state found — starting at slot 1');
  return { ...DEFAULT_STATE };
}

export async function advanceRotationState(
  channelDir: string,
  segmentsConsumed: number,
  lastEnvironment: string,
  lastAtmosphere: string,
  productionId: string
): Promise<RotationState> {
  const current = await loadRotationState(channelDir);

  const rawSlot = current.imageSlot + segmentsConsumed;
  const newSlot = ((rawSlot - 1) % MAX_IMAGE_SLOT) + 1;

  const updated: RotationState = {
    imageSlot: newSlot,
    lastEnvironment,
    lastAtmosphere,
    productionCount: current.productionCount + 1,
    lastProductionId: productionId,
    lastUpdated: new Date().toISOString(),
  };

  const statePath = join(channelDir, STATE_FILE);
  await writeJsonFile(statePath, updated);
  log.info(
    `Rotation advanced: slot ${current.imageSlot} → ${newSlot} (${segmentsConsumed} segments), production #${updated.productionCount}`
  );

  return updated;
}
