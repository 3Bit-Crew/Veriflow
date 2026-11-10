import { logEvent } from '../events.js';
import { captureAuthorization, voidAuthorization, money } from './orders.js';

// Round DOWN to 2 decimals: 133.339 -> 133.33 (PLAN.md 5.5)
export function roundDown2(n) {
  return Math.floor(n * 100 + 1e-9) / 100;
}

// Pays the worker and closes the job. This is the ONLY place a job becomes SETTLED.
//   amount > 0  -> capture that amount from the PayPal hold (FULL or PARTIAL),
//                  the rest of the hold goes back to the buyer
//   amount == 0 -> void the hold (buyer gets all the money back)
// Returns the updated job. Throws if PayPal fails (the job is then NOT settled).
//
// Testing without PayPal: if PAYPAL_MOCK=true in .env AND the job has no paypalAuthId
// (e.g. a fake job made by a test script), the PayPal call is skipped.
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

  const mock = !job.paypalAuthId && process.env.PAYPAL_MOCK === 'true';
  if (!job.paypalAuthId && !mock) {
    throw new Error(`Job ${job._id} has no PayPal authorization, so it can't be settled`);
  }

  // 1. Move the money (PayPal). If this fails, stop: the job stays as it was.
  let paypalResult = null;
  if (!mock) {
    try {
      // Same request id on an identical retry -> PayPal won't capture/void twice.
      // The action + amount are part of it, so a reviewer who picks a different payout after a
      // failed attempt gets a fresh request instead of PayPal replaying the old (failed) answer.
      // Paying twice is still impossible: final_capture closes the authorization after one capture.
      const requestId = `settle-${job._id}-${settlement}-${money(payout)}`;
      paypalResult = settlement === 'VOID'
        ? await voidAuthorization(job.paypalAuthId, requestId)
        : await captureAuthorization(job.paypalAuthId, payout, job.currency, requestId);
    } catch (err) {
      if (settlement === 'VOID' && err.message.includes('PERMISSION_DENIED')) {
        // PayPal only lets an app void holds whose payee is the app's own business account
        err.message += `. Void only works when workerEmail (${job.workerEmail}) is the sandbox business account that owns the PayPal app`;
      }
      await logEvent(job._id, 'ERROR', `PayPal ${settlement === 'VOID' ? 'void' : 'capture'} failed: ${err.message}`, err.paypal);
      throw err;
    }
  }

  // 2. Save the result on the job
  job.payoutAmount = payout;
  job.settlement = settlement;
  job.status = 'SETTLED';
  await job.save();

  // 3. Write it in the audit log
  const note = mock ? ' (mock, no PayPal call)' : '';
  if (settlement === 'VOID') {
    await logEvent(job._id, 'PAYPAL_VOIDED',
      `Payment voided. ${job.currency} ${money(job.amount)} returned to buyer${note}`,
      { authId: job.paypalAuthId, status: paypalResult?.status });
  } else {
    const returned = money(job.amount - payout);
    await logEvent(job._id, 'PAYPAL_CAPTURED',
      `Paid worker ${job.currency} ${money(payout)} of ${money(job.amount)} (${settlement})` +
      (settlement === 'PARTIAL' ? `, ${returned} returned to buyer` : '') + note,
      { payout, settlement, captureId: paypalResult?.id, status: paypalResult?.status });
  }

  return job;
}
