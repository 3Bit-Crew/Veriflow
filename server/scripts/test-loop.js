// Run from the server folder:  node scripts/test-loop.js [--keep]
// End-to-end test of the checker loop with the real database, K's models and settleJob (placeholder PayPal).
// Creates 4 "[TEST]" jobs, checks them, prints what happened, then deletes them (unless --keep).
//
// If MongoDB fails with "querySrv ECONNREFUSED", your DNS blocks Atlas lookups. Add to server/.env:
//   DNS_SERVERS=8.8.8.8,1.1.1.1
import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import Job from '../src/models/Job.js';
import Event from '../src/models/Event.js';
import Screenshot from '../src/models/Screenshot.js';
import { processNextJob } from '../src/checkers/loop.js';

if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(','));
const keep = process.argv.includes('--keep');
const PR = 'https://github.com/expressjs/express/pull/7590'; // real PR: tests pass, changes only test/ files

const base = { description: 'Test job created by scripts/test-loop.js', amount: 200, workerEmail: 'worker@example.com', status: 'SUBMITTED', attempts: 1 }; // 1 = first submit, as K's /submit route counts it
const JOBS = {
  codePass: {
    ...base,
    title: '[TEST] Code job, everything passes',
    type: 'code',
    repoUrl: 'https://github.com/expressjs/express',
    submissionUrl: PR,
    items: [
      { text: 'All tests pass', kind: 'tests_pass', params: {}, weight: 60 },
      { text: 'Library code not changed', kind: 'files_changed', params: { mustTouch: [], mustNotTouch: ['lib/'] }, weight: 40 },
    ],
  },
  codeFailTwice: {
    ...base,
    title: '[TEST] Code job, one check fails twice',
    type: 'code',
    repoUrl: 'https://github.com/expressjs/express',
    submissionUrl: PR,
    items: [
      { text: 'All tests pass', kind: 'tests_pass', params: {}, weight: 60 },
      { text: 'Fix is in lib/response.js', kind: 'files_changed', params: { mustTouch: ['lib/response.js'], mustNotTouch: [] }, weight: 40 },
    ],
  },
  website: {
    ...base,
    title: '[TEST] Website job',
    type: 'website',
    submissionUrl: 'https://react.dev',
    repoUrl: 'https://github.com/expressjs/express', // stands in for the buyer's repo
    sourcePrUrl: 'https://github.com/expressjs/express/pull/7593', // an open PR: the "source code"
    items: [
      { text: 'Home page loads', kind: 'page_loads', params: { path: '/' }, weight: 30 },
      { text: 'Source code delivered as a pull request', kind: 'source_delivered', params: {}, weight: 10 },
      { text: 'Shows "Learn React"', kind: 'text_present', params: { text: 'Learn React' }, weight: 30 },
      { text: 'Page is readable on a phone, nothing overlapping or cut off', kind: 'visual', params: { viewport: 'mobile' }, weight: 30 },
    ],
  },
  badPr: {
    ...base,
    title: '[TEST] Code job, PR does not exist',
    type: 'code',
    repoUrl: 'https://github.com/expressjs/express',
    submissionUrl: 'https://github.com/expressjs/express/pull/999999',
    items: [{ text: 'All tests pass', kind: 'tests_pass', params: {}, weight: 100 }],
  },
};

async function runUntilIdle() {
  for (let i = 0; i < 20; i++) {
    const job = await processNextJob();
    if (!job) return;
    console.log(`  checked: ${job.title} → ${job.status}`);
  }
}

async function report(id) {
  const job = await Job.findById(id);
  console.log(`\n=== ${job.title}`);
  console.log(`status ${job.status} | attempts ${job.attempts} | settlement ${job.settlement ?? '-'} | payout ${job.payoutAmount ?? '-'}`);
  for (const i of job.items) {
    console.log(`  [${i.status}] ${i.text} (${i.weight}, ${Math.round((i.confidence ?? 0) * 100)}%) ${i.reasoning}${i.evidence?.screenshots?.length ? ` [${i.evidence.screenshots.length} screenshot(s)]` : ''}`);
  }
  const events = await Event.find({ jobId: id }).sort({ createdAt: 1 });
  console.log('  events:', events.map((e) => e.type).join(' → '));
  return job;
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
console.log('MongoDB connected\n');

// Only our test jobs should be SUBMITTED, so the loop doesn't touch real data.
const others = await Job.countDocuments({ status: 'SUBMITTED', title: { $not: /^\[TEST\]/ } });
if (others) {
  console.log(`Stopping: ${others} real SUBMITTED job(s) in this database. Run this on a test database.`);
  process.exit(1);
}

const ids = {};
for (const [key, data] of Object.entries(JOBS)) ids[key] = (await Job.create(data))._id;

console.log('Round 1 (first tries):');
await runUntilIdle();

console.log('\nWorker resubmits the job that got CHANGES_REQUESTED (as K\'s /submit route would):');
await Job.updateOne(
  { _id: ids.codeFailTwice, status: 'CHANGES_REQUESTED' },
  { $set: { status: 'SUBMITTED', 'items.$[].status': 'PENDING' }, $inc: { attempts: 1 } }
);
await runUntilIdle();

for (const id of Object.values(ids)) await report(id);

if (keep) {
  console.log('\n--keep: test jobs left in the database.');
} else {
  const all = Object.values(ids);
  await Promise.all([Job.deleteMany({ _id: { $in: all } }), Event.deleteMany({ jobId: { $in: all } }), Screenshot.deleteMany({ jobId: { $in: all } })]);
  console.log('\nTest jobs, events and screenshots deleted.');
}
await mongoose.disconnect();
