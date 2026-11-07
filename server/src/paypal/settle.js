import { logEvent } from '../events.js';

// Round DOWN to 2 decimals: 133.339 -> 133.33 (PLAN.md 5.5)
export function roundDown2(n) {
  return Math.floor(n * 100 + 1e-9) / 100;
}

// Pays the worker and closes the job. This is the ONLY place a job becomes SETTLED.
//   amount > 0  -> capture that amount (FULL if it's the whole job amount, else PARTIAL)
//   amount == 0 -> void (buyer gets all the money back)
// Returns the updated job.
//
// PLACEHOLDER (day 1): it does not call PayPal yet. It only updates the database
// so B's loop and C's pages can be built and tested. Day 2 adds the real PayPal calls.
export async function settleJob(job, amount) {
  if (job.status === 'SETTLED') {
    throw new Error(`Job ${job._id} is already settled`);
  }

  const payout = roundDown2(Number(amount));
  if (!Number.isFinite(payout) || payout < 0 || payout > job.amount) {
    throw new Error(`Payout must be between 0 and ${job.amount}, got ${amount}`);
  }

  let settlement;
  if (payout === 0) settlement = 'VOID';
  else if (payout === job.amount) settlement = 'FULL';
  else settlement = 'PARTIAL';

  // TODO day 2: real PayPal calls using job.paypalAuthId
  //   capture: POST /v2/payments/authorizations/{authId}/capture
  //            { amount: { currency_code, value: payout.toFixed(2) }, final_capture: true }
  //   void:    POST /v2/payments/authorizations/{authId}/void

  job.payoutAmount = payout;
  job.settlement = settlement;
  job.status = 'SETTLED';
  await job.save();

  if (settlement === 'VOID') {
    await logEvent(job._id, 'PAYPAL_VOIDED', `Payment voided. ${job.currency} ${job.amount.toFixed(2)} returned to buyer (placeholder, no PayPal call yet)`);
  } else {
    await logEvent(job._id, 'PAYPAL_CAPTURED', `Captured ${job.currency} ${payout.toFixed(2)} of ${job.amount.toFixed(2)} (${settlement}, placeholder, no PayPal call yet)`, { payout, settlement });
  }

  return job;
}
