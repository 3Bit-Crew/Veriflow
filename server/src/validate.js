import mongoose from 'mongoose';
import Job from './models/Job.js';

// Makes an error that the error handler in index.js turns into { error: message } with this status.
//   400 = bad input, 404 = not found, 409 = wrong job status for this action
export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Loads a job by id, or fails with 404
export async function findJobOr404(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, 'Job not found');
  const job = await Job.findById(id);
  if (!job) throw httpError(404, 'Job not found');
  return job;
}

// Fails with 409 unless the job is in one of the allowed statuses
export function requireStatus(job, ...allowed) {
  if (!allowed.includes(job.status)) {
    throw httpError(409, `This action needs status ${allowed.join(' or ')}, but the job is ${job.status}`);
  }
}

const GITHUB_REPO = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;

// "https://github.com/a/b.git/" -> "https://github.com/a/b"
export function cleanRepoUrl(url) {
  return String(url).trim().replace(/\/+$/, '').replace(/\.git$/, '');
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checks the body of POST /api/jobs. Returns clean values or throws 400.
export function validateNewJob(body) {
  const { title, description, type, amount, workerEmail, repoUrl, buyerEmail } = body;

  if (!isNonEmptyString(title)) throw httpError(400, 'title is required');
  if (!isNonEmptyString(description)) throw httpError(400, 'description is required');
  if (!['code', 'website'].includes(type)) throw httpError(400, 'type must be "code" or "website"');

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw httpError(400, 'amount must be a number above 0');
  if (Math.round(amt * 100) / 100 !== amt) throw httpError(400, 'amount can have at most 2 decimals');
  if (amt > 10000) throw httpError(400, 'amount can be at most 10000');

  if (!isNonEmptyString(workerEmail) || !EMAIL.test(workerEmail.trim())) {
    throw httpError(400, 'workerEmail must be a valid email (the worker\'s PayPal sandbox business account)');
  }

  const job = {
    title: title.trim(),
    description: description.trim(),
    type,
    amount: amt,
    workerEmail: workerEmail.trim()
  };
  if (isNonEmptyString(buyerEmail)) job.buyerEmail = buyerEmail.trim();

  if (type === 'code') {
    const repo = repoUrl ? cleanRepoUrl(repoUrl) : '';
    if (!GITHUB_REPO.test(repo)) throw httpError(400, 'Code jobs need repoUrl like https://github.com/owner/repo');
    job.repoUrl = repo;
  }
  return job;
}

// Which checklist kinds each job type may use (PLAN.md 5.3), and a check for each kind's params
const isStringList = (v) => Array.isArray(v) && v.every(isNonEmptyString);
const KIND_RULES = {
  code: {
    tests_pass:    () => true,
    files_changed: (p) => (p.mustTouch === undefined || isStringList(p.mustTouch)) &&
                          (p.mustNotTouch === undefined || isStringList(p.mustNotTouch)) ||
                          'needs mustTouch / mustNotTouch as lists of paths'
  },
  website: {
    page_loads:     (p) => p.path === undefined || isNonEmptyString(p.path) || 'needs params.path like "/"',
    element_exists: (p) => isNonEmptyString(p.selector) || 'needs params.selector',
    text_present:   (p) => isNonEmptyString(p.text) || 'needs params.text',
    visual:         (p) => ['desktop', 'mobile'].includes(p.viewport) || 'needs params.viewport "desktop" or "mobile"',
    speed_score:    (p) => (Number.isFinite(p.min) && p.min >= 0 && p.min <= 100) || 'needs params.min between 0 and 100'
  }
};

// Checks the items of PUT /api/jobs/:id/checklist. Returns clean items or throws 400.
export function validateChecklist(job, items) {
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'items must be a non-empty list');
  if (items.length >8) throw httpError(400, 'At most 8 checklist items');

  const rules = KIND_RULES[job.type];
  const clean = items.map((item, i) => {
    const n = `Item ${i + 1}`;
    if (!item || typeof item !== 'object') throw httpError(400, `${n} is not an object`);
    if (!isNonEmptyString(item.text)) throw httpError(400, `${n}: text is required`);
    if (!rules[item.kind]) {
      throw httpError(400, `${n}: kind "${item.kind}" is not allowed for ${job.type} jobs. Allowed: ${Object.keys(rules).join(', ')}`);
    }
    const params = item.params ?? {};
    if (typeof params !== 'object' || Array.isArray(params)) throw httpError(400, `${n}: params must be an object`);
    const ok = rules[item.kind](params);
    if (ok !== true) throw httpError(400, `${n} (${item.kind}): ${ok}`);
    if (!Number.isInteger(item.weight) || item.weight < 1) throw httpError(400, `${n}: weight must be a whole number of at least 1`);

    return { text: item.text.trim(), kind: item.kind, params, weight: item.weight, status: 'PENDING' };
  });

  const total = clean.reduce((sum, it) => sum + it.weight, 0);
  if (total !== 100) throw httpError(400, `Weights must add up to 100 (they add up to ${total})`);

  if (job.type === 'code') {
    const tests = clean.filter((it) => it.kind === 'tests_pass').length;
    if (tests !== 1) throw httpError(400, `Code jobs need exactly one tests_pass item (found ${tests})`);
  }
  return clean;
}

// Checks POST /api/jobs/:id/submit. Code jobs: a PR in the job's repo. Website jobs: an http(s) URL.
export function validateSubmissionUrl(job, submissionUrl) {
  if (!isNonEmptyString(submissionUrl)) throw httpError(400, 'submissionUrl is required');
  const url = submissionUrl.trim();

  if (job.type === 'code') {
    const prPattern = new RegExp(`^${job.repoUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/pull/\\d+/?$`, 'i');
    if (!prPattern.test(url)) throw httpError(400, `submissionUrl must be a pull request like ${job.repoUrl}/pull/123`);
    return url.replace(/\/$/, '');
  }

  let parsed;
  try { parsed = new URL(url); } catch { parsed = null; }
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
    throw httpError(400, 'submissionUrl must be a website address starting with http:// or https://');
  }
  return url;
}
