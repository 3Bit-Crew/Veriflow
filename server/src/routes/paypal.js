import { Router } from 'express';
import { logEvent } from '../events.js';
import { createOrder, authorizeOrder } from '../paypal/orders.js';
import { httpError, findJobOr404, requireStatus } from '../validate.js';

const router = Router();

// POST /api/paypal/orders { jobId }  -> { orderId }
// Called by the PayPal button's createOrder. Creates a PayPal order that will hold the money.
router.post('/orders', async (req, res) => {
  const job = await findJobOr404(req.body?.jobId);
  requireStatus(job, 'CHECKLIST_READY');

  const { orderId } = await createOrder(job);
  job.paypalOrderId = orderId;
  await job.save();
  await logEvent(job._id, 'PAYPAL_ORDER_CREATED', `PayPal order ${orderId} created for ${job.currency} ${job.amount.toFixed(2)}`, { orderId });
  res.json({ orderId });
});

// POST /api/paypal/orders/:orderId/authorize { jobId }  -> job (status FUNDED)
// Called by the PayPal button's onApprove, after the buyer approved in the popup.
router.post('/orders/:orderId/authorize', async (req, res) => {
  const job = await findJobOr404(req.body?.jobId);
  requireStatus(job, 'CHECKLIST_READY');
  if (job.paypalOrderId !== req.params.orderId) {
    throw httpError(400, 'This PayPal order does not belong to this job');
  }

  const { authId, authStatus, buyerEmail } = await authorizeOrder(req.params.orderId);
  job.paypalAuthId = authId;
  if (buyerEmail) job.buyerEmail = buyerEmail;
  job.status = 'FUNDED';
  await job.save();
  await logEvent(job._id, 'PAYPAL_AUTHORIZED', `Buyer's ${job.currency} ${job.amount.toFixed(2)} is now held by PayPal`, { authId, authStatus });
  res.json(job);
});

export default router;
