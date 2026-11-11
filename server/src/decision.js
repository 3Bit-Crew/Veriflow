// The payout rule (PLAN.md 5.5). Pure logic: no database, no AI, no PayPal.
//
//   decide(job) → { action, amount, passedWeight, reason }
//     action: 'NEEDS_REVIEW'      → a human must decide (money stays held)
//             'CHANGES_REQUESTED' → 1st try failed, worker may resubmit (money stays held)
//             'SETTLE'            → call settleJob(job, amount); amount 0 = refund (void)
//
// All or nothing: the worker is paid in full only when every item passes. No partial payouts.
// Changing a file the checklist says must not be touched counts as cheating: refund at once, no resubmit.
//
// Expects every item to have been checked (status PASS / FAIL / UNSURE, plus confidence).

export const CONFIDENCE_THRESHOLD = 0.7;

// github.js puts this text in the reasoning of a files_changed item that touched a forbidden file.
export const RESTRICTED_FILES_NOTE = 'changed files it must not touch';

const isConfident = (i) => Number(i.confidence) >= CONFIDENCE_THRESHOLD;

const touchedRestrictedFiles = (i) =>
  i.kind === 'files_changed' && i.status === 'FAIL' && isConfident(i) && String(i.reasoning || '').includes(RESTRICTED_FILES_NOTE);

export function decide(job) {
  const items = job.items || [];
  const passedWeight = items.filter((i) => i.status === 'PASS').reduce((sum, i) => sum + i.weight, 0);
  const passedCount = items.filter((i) => i.status === 'PASS').length;
  const summary = `${passedCount}/${items.length} checks passed (${passedWeight}/100)`;

  // 1. Cheating: changed a restricted file → refund the buyer now, on any try, whatever else passed.
  const cheated = items.filter(touchedRestrictedFiles);
  if (cheated.length > 0) {
    return {
      action: 'SETTLE',
      amount: 0,
      passedWeight,
      reason: `${summary}. The worker changed files they were not allowed to touch (${cheated.map((i) => `"${i.text}"`).join(', ')}). Payment voided, no resubmit.`,
    };
  }

  // 2. Not sure about something → a human decides. PENDING counts as unsure (it was never checked).
  const unsure = items.filter((i) => i.status === 'UNSURE' || i.status === 'PENDING' || !isConfident(i));
  if (items.length === 0 || unsure.length > 0) {
    const names = unsure.map((i) => `"${i.text}"`).join(', ');
    return {
      action: 'NEEDS_REVIEW',
      amount: null,
      passedWeight,
      reason: items.length === 0 ? 'The job has no checklist items.' : `${summary}. Not confident about: ${names}.`,
    };
  }

  // 3. Everything passed → full payment.
  if (items.every((i) => i.status === 'PASS')) {
    return { action: 'SETTLE', amount: job.amount, passedWeight, reason: `${summary}. Full payment.` };
  }

  // 4. First try with failures → worker gets one chance to fix it.
  if ((job.attempts || 0) <= 1) {
    return {
      action: 'CHANGES_REQUESTED',
      amount: null,
      passedWeight,
      reason: `${summary} on the first try. The worker can fix and resubmit; the money stays held.`,
    };
  }

  // 5. Second try and something still fails → nothing is paid, the buyer gets the money back.
  return { action: 'SETTLE', amount: 0, passedWeight, reason: `${summary} on the second try. Every item must pass, so the payment is voided.` };
}
