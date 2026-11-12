import { Router } from 'express';
import Job from '../models/Job.js';
import Event from '../models/Event.js';
import { logEvent } from '../events.js';
import { settleJob, roundDown2 } from '../paypal/settle.js';
import {
  httpError, findJobOr404, requireStatus,
  validateNewJob, validateChecklist, validateSubmissionUrl, validateSourcePrUrl
} from '../validate.js';

const router = Router();

// Uses B's generateChecklist() from ai/checklist.js when that file exists.
// Until B pushes it, returns a sample checklist so C can build the pages (PLAN.md 5.6).
async function makeChecklist(job) {
  let mod;
  try {
    mod = await import('../ai/checklist.js');
  } catch (err) {
    if (err.code !== 'ERR_MODULE_NOT_FOUND' || !String(err.message).includes('checklist.js')) throw err;
    return { items: sampleChecklist(job), source: 'sample' };
  }
  return { items: await mod.generateChecklist(job), source: 'ai' };
}

function sampleChecklist(job) {
  if (job.type === 'code') {
    return [
      { text: 'All GitHub Actions checks on the pull request pass', kind: 'tests_pass', params: {}, weight: 60 },
      { text: 'Only source files are changed, not the database folder', kind: 'files_changed', params: { mustTouch: ['src/'], mustNotTouch: ['src/db/'] }, weight: 40 }
    ];
  }
  return [
    { text: 'Home page loads', kind: 'page_loads', params: { path: '/' }, weight: 20 },
    { text: 'Signup form has an email field', kind: 'element_exists', params: { selector: 'input[type=email]' }, weight: 30 },
    { text: 'Page shows a "Sign up" button', kind: 'text_present', params: { text: 'Sign up' }, weight: 20 },
    { text: 'Looks good on mobile', kind: 'visual', params: { viewport: 'mobile' }, weight: 30 }
  ];
}

// POST /api/jobs  -> create a job (status DRAFT)
router.post('/', async (req, res) => {
  const job = await Job.create(validateNewJob(req.body ?? {}));
  await logEvent(job._id, 'JOB_CREATED', `Job "${job.title}" created for ${job.currency} ${job.amount.toFixed(2)}`);
  res.status(201).json(job);
});

// GET /api/jobs  -> all jobs, newest first
router.get('/', async (req, res) => {
  const jobs = await Job.find().sort({ createdAt: -1 });
  res.json(jobs);
});

// GET /api/jobs/:id  -> { job, events } (events newest first)
router.get('/:id', async (req, res) => {
  const job = await findJobOr404(req.params.id);
  const events = await Event.find({ jobId: job._id }).sort({ createdAt: -1 });
  res.json({ job, events });
});

// POST /api/jobs/:id/checklist  -> AI suggests a checklist (status stays DRAFT)
router.post('/:id/checklist', async (req, res) => {
  const job = await findJobOr404(req.params.id);
  requireStatus(job, 'DRAFT');

  const { items, source } = await makeChecklist(job);
  job.items = items;
  await job.save();
  await logEvent(job._id, 'CHECKLIST_GENERATED',
    `${source === 'ai' ? 'AI generated' : 'Sample'} checklist with ${items.length} items`);
  res.json(job);
});

// PUT /api/jobs/:id/checklist  -> buyer approves the (edited) checklist (status CHECKLIST_READY)
router.put('/:id/checklist', async (req, res) => {
  const job = await findJobOr404(req.params.id);
  requireStatus(job, 'DRAFT');

  job.items = validateChecklist(job, req.body?.items);
  job.status = 'CHECKLIST_READY';
  await job.save();
  await logEvent(job._id, 'CHECKLIST_APPROVED', `Buyer approved a checklist with ${job.items.length} items`);
  res.json(job);
});

// POST /api/jobs/:id/submit  -> worker submits a PR / website URL (status SUBMITTED)
router.post('/:id/submit', async (req, res) => {
  const job = await findJobOr404(req.params.id);
  requireStatus(job, 'FUNDED', 'CHANGES_REQUESTED');

  const url = validateSubmissionUrl(job, req.body?.submissionUrl);
  // Website jobs with a repo also deliver the source code as a PR there (older jobs without a repo: URL only)
  const sourcePr = job.type === 'website' && job.repoUrl ? validateSourcePrUrl(job, req.body?.sourcePrUrl) : null;
  const isRetry = job.status === 'CHANGES_REQUESTED';

  job.submissionUrl = url;
  if (sourcePr) job.sourcePrUrl = sourcePr;
  job.sourceCommit = undefined; // set again by the checker for this try
  for (const item of job.items) {
    item.status = 'PENDING';
    item.confidence = undefined;
    item.reasoning = undefined;
    item.evidence = undefined;
  }
  // Count the try here, once per submit. The checker loop must not count it: a server restart
  // would make it re-check this try and count it again (PLAN.md 5.5 uses attempts for the payout).
  job.attempts = (job.attempts || 0) + 1;
  job.status = 'SUBMITTED';
  await job.save();
  await logEvent(job._id, 'WORK_SUBMITTED',
    `Worker ${isRetry ? 'resubmitted' : 'submitted'} ${url}${sourcePr ? ` with the source code in ${sourcePr}` : ''}`,
    { submissionUrl: url, ...(sourcePr && { sourcePrUrl: sourcePr }) });
  res.json(job);
});

// POST /api/jobs/:id/review  -> a human decides the payout (status SETTLED)
router.post('/:id/review', async (req, res) => {
  const job = await findJobOr404(req.params.id);
  requireStatus(job, 'NEEDS_REVIEW');

  const payout = Number(req.body?.payoutAmount);
  if (!Number.isFinite(payout) || payout < 0 || payout > job.amount) {
    throw httpError(400, `payoutAmount must be a number from 0 to ${job.amount}`);
  }
  await logEvent(job._id, 'REVIEW_DECIDED', `Reviewer decided to pay ${job.currency} ${roundDown2(payout).toFixed(2)} of ${job.amount.toFixed(2)}`);
  const settled = await settleJob(job, payout);
  res.json(settled);
});

export default router;
