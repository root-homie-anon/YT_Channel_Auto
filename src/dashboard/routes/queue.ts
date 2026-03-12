import { Router, Request, Response } from 'express';
import {
  getQueue,
  addToQueue,
  removeFromQueue,
  reorderQueue,
} from '../state/queue-manager.js';

const router = Router();

router.get('/:slug/queue', async (req: Request, res: Response) => {
  try {
    const queue = await getQueue(req.params.slug as string);
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/:slug/queue', async (req: Request, res: Response) => {
  try {
    const { topic, scheduledTime } = req.body;
    if (!topic) {
      res.status(400).json({ error: 'topic is required' });
      return;
    }
    const queue = await addToQueue(req.params.slug as string, topic, scheduledTime);
    res.status(201).json(queue);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/:slug/queue/:index', async (req: Request, res: Response) => {
  try {
    const queue = await removeFromQueue(req.params.slug as string, parseInt(req.params.index as string, 10));
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:slug/queue/reorder', async (req: Request, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      res.status(400).json({ error: 'order must be an array of indices' });
      return;
    }
    const queue = await reorderQueue(req.params.slug as string, order);
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
