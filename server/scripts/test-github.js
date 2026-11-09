// Run from the server folder:
//   node scripts/test-github.js <PR URL> [--touch=path] [--not-touch=path] [--now]
// --now : don't wait for running tests (treat them as timed out)
// Example:
//   node scripts/test-github.js https://github.com/owner/repo/pull/12 --touch=src/login.js --not-touch=src/db/
import 'dotenv/config';
import { checkCodeJob, parsePrUrl } from '../src/checkers/github.js';

const args = process.argv.slice(2);
const prUrl = args.find((a) => !a.startsWith('--'));
const flag = (name) => args.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.split('=')[1]);
const now = args.includes('--now');

const pr = parsePrUrl(prUrl);
if (!pr) {
  console.log('Usage: node scripts/test-github.js <PR URL> [--touch=path] [--not-touch=path] [--now]');
  process.exit(1);
}

const job = {
  type: 'code',
  repoUrl: `https://github.com/${pr.owner}/${pr.repo}`,
  submissionUrl: prUrl,
  items: [
    { text: 'All automated tests pass', kind: 'tests_pass', params: {}, weight: 60 },
    {
      text: 'Right files changed',
      kind: 'files_changed',
      params: { mustTouch: flag('touch'), mustNotTouch: flag('not-touch').length ? flag('not-touch') : ['no-such-folder/'] },
      weight: 40,
    },
  ],
};

console.log(`Token: ${process.env.GITHUB_TOKEN ? 'yes' : 'NO (60 requests/hour limit)'}`);
const started = Date.now();
const results = await checkCodeJob(job, { timedOut: now });

if (results === null) {
  console.log('⏳ Tests are still running → returned null (the loop would retry). Use --now to stop waiting.');
} else {
  results.forEach((r, i) => console.log(`\n[${job.items[i].kind}]`, r));
}
console.log(`\n(${Date.now() - started} ms)`);
