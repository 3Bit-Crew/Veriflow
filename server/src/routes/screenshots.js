import { Router } from 'express';
import mongoose from 'mongoose';
import Screenshot from '../models/Screenshot.js';
import { httpError } from '../validate.js';

const router = Router();

// GET /api/screenshots/:id  -> the JPEG image itself
// Frontend: <img src={`${VITE_API_URL}/api/screenshots/${id}`} />
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Screenshot not found');
  const shot = await Screenshot.findById(req.params.id).lean();
  if (!shot?.data) throw httpError(404, 'Screenshot not found');

  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=86400'); // screenshots never change
  res.send(shot.data.buffer ?? shot.data);
});

export default router;
