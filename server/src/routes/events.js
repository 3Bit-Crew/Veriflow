import { Router } from 'express';
import Event from '../models/Event.js';

const router = Router();

// GET /api/events  -> newest first, each with jobTitle (for the AG Grid audit log)
router.get('/', async (req, res) => {
  const events = await Event.find()
    .sort({ createdAt: -1 })
    .limit(1000)
    .populate('jobId', 'title')
    .lean();

  res.json(events.map((e) => ({
    ...e,
    jobId: e.jobId?._id ?? e.jobId,
    jobTitle: e.jobId?.title ?? null
  })));
});

export default router;
