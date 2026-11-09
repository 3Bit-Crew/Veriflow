// The payout rule (PLAN.md 5.5). Pure logic: no database, no AI, no PayPal.
//
//   decide(job) → { action, amount, passedWeight, reason }
//     action: 'NEEDS_REVIEW'      → a human must decide (money stays held)
//             'CHANGES_REQUESTED' → 1st try failed, worker may resubmit (money stays held)
//             'SETTLE'            → call settleJob(job, amount); amount 0 = refund (void)
//
// Expects every item to have been checked (status PASS / FAIL / UNSURE, plus confidence).
import { roundDown2 } from './paypal/settle.js';

export const CONFIDENCE_THRESHOLD = 0.7;

export function decide(job) {
  const items = job.items || [];
  const passedWeight = items.filter((i) => i.status === 'PASS').reduce((sum, i) => sum + i.weight, 0);
  const passedCount = items.filter((i) => i.status === 'PASS').length;
  const summary = `${passedCount}/${items.length} checks passed (${passedWeight}/100)`;

  // 1. Not sure about something → a human decides. PENDING counts as unsure (it was never checked).
  const unsure = items.filter(
    (i) => i.status === 'UNSURE' || i.status === 'PENDING' || !(Number(i.confidence) >= CONFIDENCE_THRESHOLD)
  );
  if (items.length === 0 || unsure.length > 0) {
    const names = unsure.map((i) => `"${i.text}"`).join(', ');
    return {
      action: 'NEEDS_REVIEW',
      amount: null,
      passedWeight,
      reason: items.length === 0 ? 'The job has no checklist items.' : `${summary}. Not confident about: ${names}.`,
    };
  }

  // 2. Everything passed → full payment.
  if (passedWeight >= 100) {
    return { action: 'SETTLE', amount: job.amount, passedWeight, reason: `${summary}. Full payment.` };
  }

  // 3. First try with failures → worker gets one chance to fix it.
  if ((job.attempts || 0) <= 1) {
    return {
      action: 'CHANGES_REQUESTED',
      amount: null,
      passedWeight,
      reason: `${summary} on the first try. The worker can fix and resubmit; the money stays held.`,
    };
  }

  // 4. Second try, nothing passed → refund the buyer.
  if (passedWeight === 0) {
    return { action: 'SETTLE', amount: 0, passedWeight, reason: `${summary} on the second try. Payment voided.` };
  }

  // 5. Second try, some passed → pay for what passed.
  const amount = roundDown2((job.amount * passedWeight) / 100);
  return { action: 'SETTLE', amount, passedWeight, reason: `${summary} on the second try. Partial payment.` };
}
