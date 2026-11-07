// Run from the server folder:  node scripts/test-checklist.js
// Try Groq:                    AI_PROVIDER=groq node scripts/test-checklist.js
import 'dotenv/config';
import { generateChecklist } from '../src/ai/checklist.js';
import { findChecklistProblems } from '../src/ai/checklistRules.js';

const SAMPLE_JOBS = [
  {
    title: 'Fix login bug',
    type: 'code',
    repoUrl: 'https://github.com/3Bit-Crew/veriflow-demo',
    description:
      'Users cannot log in when their email has capital letters. Fix the login bug in the login code. All tests must pass. Do not change the database code.',
  },
  {
    title: 'Landing page with signup',
    type: 'website',
    description:
      'Build a landing page for my bakery with a headline "Fresh every morning", a signup form with an email field and a "Sign up" button. It must look good on mobile and load fast.',
  },
  {
    title: 'Vague job',
    type: 'website',
    description: 'Make my website better.',
  },
];

let failed = 0;

for (const job of SAMPLE_JOBS) {
  console.log(`\n=== ${job.title} (${job.type}) [provider: ${process.env.AI_PROVIDER || 'gemini'}]`);
  try {
    const started = Date.now();
    const items = await generateChecklist(job);
    console.table(
      items.map((i) => ({ kind: i.kind, weight: i.weight, text: i.text, params: JSON.stringify(i.params) }))
    );
    const problems = findChecklistProblems(job.type, items);
    if (problems.length) {
      failed++;
      console.log('❌ Rule problems:', problems);
    } else {
      console.log(`✅ All rules OK (${Date.now() - started} ms)`);
    }
  } catch (err) {
    failed++;
    console.log('❌ Error:', err.message);
  }
}

console.log(failed ? `\n${failed} job(s) failed` : '\nAll jobs passed');
process.exit(failed ? 1 : 0);
