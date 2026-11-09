// Run from the server folder:  node scripts/test-decision.js
// Checks every case of the payout rule (PLAN.md 5.5). No database, no AI.
import { decide } from '../src/decision.js';

const item = (weight, status, confidence = 1) => ({ text: `${status} item`, weight, status, confidence });

const CASES = [
  ['All pass → full', { amount: 200, attempts: 1, items: [item(60, 'PASS'), item(40, 'PASS')] }, 'SETTLE', 200],
  ['1st try, one fails → changes requested', { amount: 200, attempts: 1, items: [item(60, 'PASS'), item(40, 'FAIL')] }, 'CHANGES_REQUESTED', null],
  ['2nd try, one fails → partial', { amount: 200, attempts: 2, items: [item(40, 'PASS'), item(30, 'PASS'), item(30, 'FAIL')] }, 'SETTLE', 140],
  ['2nd try, all fail → void', { amount: 200, attempts: 2, items: [item(60, 'FAIL'), item(40, 'FAIL')] }, 'SETTLE', 0],
  ['UNSURE item → review', { amount: 200, attempts: 1, items: [item(60, 'PASS'), item(40, 'UNSURE', 0)] }, 'NEEDS_REVIEW', null],
  ['Low confidence PASS → review', { amount: 200, attempts: 1, items: [item(60, 'PASS'), item(40, 'PASS', 0.6)] }, 'NEEDS_REVIEW', null],
  ['Low confidence FAIL → review', { amount: 200, attempts: 2, items: [item(60, 'PASS'), item(40, 'FAIL', 0.5)] }, 'NEEDS_REVIEW', null],
  ['Unchecked (PENDING) → review', { amount: 200, attempts: 1, items: [item(100, 'PENDING', undefined)] }, 'NEEDS_REVIEW', null],
  ['Rounds down: 1/3 of $100', { amount: 100, attempts: 2, items: [item(33, 'PASS'), item(67, 'FAIL')] }, 'SETTLE', 33],
  ['Rounds down: odd cents', { amount: 99.99, attempts: 2, items: [item(33, 'PASS'), item(67, 'FAIL')] }, 'SETTLE', 32.99],
  ['No items → review', { amount: 200, attempts: 1, items: [] }, 'NEEDS_REVIEW', null],
];

let failed = 0;
for (const [name, job, wantAction, wantAmount] of CASES) {
  const got = decide(job);
  const ok = got.action === wantAction && got.amount === wantAmount;
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}: ${got.action} ${got.amount ?? ''}${ok ? '' : `  (expected ${wantAction} ${wantAmount ?? ''})`}`);
  if (!ok) console.log('   reason:', got.reason);
}
console.log(failed ? `\n${failed} case(s) failed` : '\nAll cases passed');
process.exit(failed ? 1 : 0);
