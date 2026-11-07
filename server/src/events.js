import Event from './models/Event.js';

// The only event types allowed (PLAN.md 5.7)
export const EVENT_TYPES = [
  'JOB_CREATED',
  'CHECKLIST_GENERATED',
  'CHECKLIST_APPROVED',
  'PAYPAL_ORDER_CREATED',
  'PAYPAL_AUTHORIZED',
  'WORK_SUBMITTED',
  'CHECK_STARTED',
  'CHECK_RESULT',
  'CHANGES_REQUESTED',
  'REVIEW_REQUIRED',
  'REVIEW_DECIDED',
  'PAYPAL_CAPTURED',
  'PAYPAL_VOIDED',
  'ERROR'
];

// Saves one line to the audit log. Everyone (A and B) logs through this.
// Example: await logEvent(job._id, 'WORK_SUBMITTED', 'Worker submitted a PR', { url });
// Logging must never crash the caller, so errors are printed instead of thrown.
export async function logEvent(jobId, type, message, data = {}) {
  if (!EVENT_TYPES.includes(type)) {
    console.warn(`logEvent: unknown event type "${type}". Use one from PLAN.md 5.7.`);
  }
  try {
    return await Event.create({ jobId, type, message, data });
  } catch (err) {
    console.error('logEvent failed:', err.message);
    return null;
  }
}
