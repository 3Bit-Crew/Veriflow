// Run from the server folder:  node scripts/test-decision.js
// Checks every case of the payout rule (PLAN.md 5.5). No database, no AI.
import { decide } from '../src/decision.js';

const item = (weight, status, confidence = 1) => ({ text: `${status} item`, weight, status, confidence });
// A files_changed item as github.js reports it.
const files = (weight, status, reasoning) => ({ text: 'Only allowed files changed', kind: 'files_changed', weight, status, confidence: 1, reasoning });
const CHEATED = 'The pull request changed files it must not touch: test/app.test.js.';
const MISSED = 'The pull request did not change src/.';

const CASES = [
  ['All pass → full', { amount: 200, attempts: 1, items: [item(60, 'PASS'), item(40, 'PASS')] }, 'SETTLE', 200],
  ['1st try, one fails → changes requested', { amount: 200, attempts: 1, items: [item(60, 'PASS'), item(40, 'FAIL')] }, 'CHANGES_REQUESTED', null],
  ['2nd try, one small item fails → nothing paid', { amount: 200, attempts: 2, items: [item(40, 'PASS'), item(30, 'PASS'), item(30, 'FAIL')] }, 'SETTLE', 0],
  ['2nd try, 99/100 passed → nothing paid', { amount: 200, attempts: 2, items: [item(99, 'PASS'), item(1, 'FAIL')] }, 'SETTLE', 0],
  ['2nd try, all fail → void', { amount: 200, attempts: 2, items: [item(60, 'FAIL'), item(40, 'FAIL')] }, 'SETTLE', 0],
  ['Cheat on 1st try → void at once, no resubmit', { amount: 200, attempts: 1, items: [item(60, 'PASS'), files(40, 'FAIL', CHEATED)] }, 'SETTLE', 0],
  ['Cheat on 2nd try → void', { amount: 200, attempts: 2, items: [item(60, 'PASS'), files(40, 'FAIL', CHEATED)] }, 'SETTLE', 0],
  ['Cheat + another item unsure → still void', { amount: 200, attempts: 1, items: [item(60, 'UNSURE', 0), files(40, 'FAIL', CHEATED)] }, 'SETTLE', 0],
  ['Missed a required file (not cheating), 1st try → changes requested', { amount: 200, attempts: 1, items: [item(60, 'PASS'), files(40, 'FAIL', MISSED)] }, 'CHANGES_REQUESTED', null],
  ['Allowed files only → full', { amount: 200, attempts: 1, items: [item(60, 'PASS'), files(40, 'PASS', 'The pull request did not touch test/.')] }, 'SETTLE', 200],
  ['UNSURE item → review', { amount: 200, attempts: 1, items: [item(60, 'PASS'), item(40, 'UNSURE', 0)] }, 'NEEDS_REVIEW', null],
  ['Low confidence PASS → review', { amount: 200, attempts: 1, items: [item(60, 'PASS'), item(40, 'PASS', 0.6)] }, 'NEEDS_REVIEW', null],
  ['Low confidence FAIL → review', { amount: 200, attempts: 2, items: [item(60, 'PASS'), item(40, 'FAIL', 0.5)] }, 'NEEDS_REVIEW', null],
  ['Unchecked (PENDING) → review', { amount: 200, attempts: 1, items: [item(100, 'PENDING', undefined)] }, 'NEEDS_REVIEW', null],
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
