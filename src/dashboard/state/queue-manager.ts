import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readJsonFile, writeJsonFile, fileExists } from '../../utils/file-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

export interface QueueItem {
  topic: string;
  addedAt: string;
  scheduledTime?: string;
  status: 'queued' | 'producing' | 'done';
}

export interface VideoQueue {
  items: QueueItem[];
}

function getQueuePath(channelSlug: string): string {
  return join(PROJECT_ROOT, 'projects', channelSlug, 'queue.json');
}

export async function getQueue(channelSlug: string): Promise<VideoQueue> {
  const queuePath = getQueuePath(channelSlug);
  if (await fileExists(queuePath)) {
    return readJsonFile<VideoQueue>(queuePath);
  }
  return { items: [] };
}

export async function addToQueue(
  channelSlug: string,
  topic: string,
  scheduledTime?: string
): Promise<VideoQueue> {
  const queue = await getQueue(channelSlug);
  const item: QueueItem = {
    topic,
    addedAt: new Date().toISOString(),
    status: 'queued',
  };
  if (scheduledTime) item.scheduledTime = scheduledTime;
  queue.items.push(item);
  await writeJsonFile(getQueuePath(channelSlug), queue);
  return queue;
}

export async function removeFromQueue(
  channelSlug: string,
  index: number
): Promise<VideoQueue> {
  const queue = await getQueue(channelSlug);
  if (index < 0 || index >= queue.items.length) {
    throw new Error(`Invalid queue index: ${index}`);
  }
  queue.items.splice(index, 1);
  await writeJsonFile(getQueuePath(channelSlug), queue);
  return queue;
}

export async function reorderQueue(
  channelSlug: string,
  order: number[]
): Promise<VideoQueue> {
  const queue = await getQueue(channelSlug);
  const reordered = order.map((i) => queue.items[i]).filter(Boolean);
  queue.items = reordered;
  await writeJsonFile(getQueuePath(channelSlug), queue);
  return queue;
}

export async function updateQueueItemStatus(
  channelSlug: string,
  index: number,
  status: QueueItem['status']
): Promise<void> {
  const queue = await getQueue(channelSlug);
  if (queue.items[index]) {
    queue.items[index].status = status;
    await writeJsonFile(getQueuePath(channelSlug), queue);
  }
}

export async function popNextFromQueue(
  channelSlug: string
): Promise<QueueItem | undefined> {
  const queue = await getQueue(channelSlug);
  const nextIndex = queue.items.findIndex((item) => item.status === 'queued');
  if (nextIndex === -1) return undefined;
  queue.items[nextIndex].status = 'producing';
  await writeJsonFile(getQueuePath(channelSlug), queue);
  return queue.items[nextIndex];
}
