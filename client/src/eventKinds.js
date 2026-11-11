// Audit-log events (PLAN.md 5.7): a readable label and a color group for each type.

const MONEY = ['PAYPAL_ORDER_CREATED', 'PAYPAL_AUTHORIZED', 'PAYPAL_CAPTURED', 'PAYPAL_VOIDED'];
const AI = ['CHECKLIST_GENERATED', 'CHECK_RESULT'];
const WARN = ['REVIEW_REQUIRED', 'CHANGES_REQUESTED', 'ERROR'];

// "money" (PayPal), "ai" (the AI wrote or checked something), "warn" (needs attention), or "".
export function eventKind(type) {
  if (MONEY.includes(type)) return 'money';
  if (AI.includes(type)) return 'ai';
  if (WARN.includes(type)) return 'warn';
  return '';
}

export const EVENT_SYMBOL = { money: '$', ai: '✦', warn: '!', '': '•' };

// "PAYPAL_CAPTURED" -> "PayPal captured"
export function eventLabel(type = '') {
  const words = type.toLowerCase().split('_').join(' ');
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(/paypal/i, 'PayPal');
}
