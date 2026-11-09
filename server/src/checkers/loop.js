// The checker loop (PLAN.md 5.1, 5.6). Runs inside the Express server.
//
//   startCheckerLoop()  → K calls it once in index.js after MongoDB connects. Returns a stop() function.
//   processNextJob()    → checks ONE submitted job (exported so test scripts can drive it step by step).
//
// Each job: SUBMITTED → CHECKING → run checkers → save results → decide →
//   SETTLE            → settleJob() (K's code: PayPal capture/void, status SETTLED)
//   CHANGES_REQUESTED → worker can resubmit
//   NEEDS_REVIEW      → human decides (POST /api/jobs/:id/review)
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import Screenshot from '../models/Screenshot.js';
import { logEvent } from '../events.js';
import { settleJob } from '../paypal/settle.js';
import { decide } from '../decision.js';
import { checkCodeJob } from './github.js';
import { checkWebsiteJob } from './website.js';
import { checkVisualItems } from './visual.js';
import { checkSpeedItems } from './speed.js';

const INTERVAL_MS = 5000;
const WAIT_FOR_TESTS_MS = 5 * 60 * 1000; // give GitHub Actions up to 5 minutes
const RETRY_PENDING_MS = 15000; // while tests run, look again every 15s (saves GitHub API calls)

// Jobs whose GitHub tests are still running: jobId → { since, lastTry }.
// In memory only: after a restart the 5-minute wait simply starts again.
const waiting = new Map();

// ---------- running the checkers ----------

// Returns results for every item, or null if GitHub tests are still running.
async function runCheckers(job) {
  if (job.type === 'code') {
    const id = String(job._id);
    const since = waiting.get(id)?.since ?? Date.now();
    const timedOut = Date.now() - since > WAIT_FOR_TESTS_MS;
    return checkCodeJob(job, { timedOut });
  }

  // Website job: Playwright first (screenshots), then AI on the screenshots, then speed.
  const { results, screenshots } = await checkWebsiteJob(job);

  const ids = {};
  for (const viewport of ['desktop', 'mobile']) {
    if (!screenshots[viewport]) continue;
    const doc = await Screenshot.create({ jobId: job._id, viewport, data: screenshots[viewport] });
    ids[viewport] = String(doc._id);
  }

  const visual = await checkVisualItems(job, screenshots);
  const speed = await checkSpeedItems(job);

  // Attach screenshot ids as evidence: visual items get their own viewport, the rest get both.
  const allIds = Object.values(ids);
  const byId = new Map(job.items.map((item) => [String(item._id), item]));
  for (const r of [...results, ...visual]) {
    const item = byId.get(r.itemId);
    const own = item?.kind === 'visual' ? ids[item.params?.viewport === 'desktop' ? 'desktop' : 'mobile'] : null;
    r.evidence.screenshots = own ? [own] : allIds;
  }
  return [...results, ...visual, ...speed];
}

// Copy results onto the job's items and log one CHECK_RESULT per item.
async function saveResults(job, results) {
  const byId = new Map(results.map((r) => [r.itemId, r]));
  for (const item of job.items) {
    const r = byId.get(String(item._id)) ?? {
      status: 'UNSURE',
      confidence: 0,
      reasoning: `No checker handles "${item.kind}" items.`,
      evidence: { screenshots: [], logUrl: null },
    };
    item.status = r.status;
    item.confidence = r.confidence;
    item.reasoning = r.reasoning;
    item.evidence = r.evidence;
  }
  await job.save();

  for (const item of job.items) {
    await logEvent(job._id, 'CHECK_RESULT', `${item.text}: ${item.status} (${Math.round(item.confidence * 100)}% sure). ${item.reasoning}`, {
      itemId: String(item._id),
      kind: item.kind,
      status: item.status,
      confidence: item.confidence,
    });
  }
}

// ---------- one job ----------

// Pick the oldest SUBMITTED job that isn't in its "tests still running" pause, and claim it.
async function claimNextJob() {
  const candidates = await Job.find({ status: 'SUBMITTED' }).sort({ updatedAt: 1 }).limit(20).select('_id');
  const now = Date.now();
  for (const { _id } of candidates) {
    const w = waiting.get(String(_id));
    if (w && now - w.lastTry < RETRY_PENDING_MS) continue;
    // Atomic: only one loop can move a job from SUBMITTED to CHECKING.
    const job = await Job.findOneAndUpdate({ _id, status: 'SUBMITTED' }, { $set: { status: 'CHECKING' } }, { returnDocument: 'after' });
    if (job) return job;
  }
  return null;
}

/** Checks one submitted job. Returns the job (after its update), or null if there was nothing to do. */
export async function processNextJob() {
  const job = await claimNextJob();
  if (!job) return null;
  const id = String(job._id);

  try {
    // A new attempt starts only when we're not just re-polling running tests.
    if (!waiting.has(id)) {
      job.attempts = (job.attempts || 0) + 1;
      await job.save();
      await logEvent(job._id, 'CHECK_STARTED', `Checking try ${job.attempts} of the ${job.type} job: ${job.submissionUrl}`, {
        attempt: job.attempts,
      });
    }

    const results = await runCheckers(job);

    if (results === null) {
      // GitHub tests still running → back in the queue, try again later.
      const w = waiting.get(id);
      waiting.set(id, { since: w?.since ?? Date.now(), lastTry: Date.now() });
      job.status = 'SUBMITTED';
      await job.save();
      return job;
    }
    waiting.delete(id);

    await saveResults(job, results);
    const decision = decide(job);

    if (decision.action === 'SETTLE') {
      try {
        return await settleJob(job, decision.amount); // K's code: PayPal + status SETTLED + event
      } catch (err) {
        // Payment failed: keep the money held and let a human retry from the review screen.
        job.status = 'NEEDS_REVIEW';
        await job.save();
        await logEvent(job._id, 'ERROR', `Payment step failed: ${err.message}. Sent to human review.`, decision);
        return job;
      }
    }

    if (decision.action === 'CHANGES_REQUESTED') {
      job.status = 'CHANGES_REQUESTED';
      await job.save();
      await logEvent(job._id, 'CHANGES_REQUESTED', decision.reason, { passedWeight: decision.passedWeight });
      return job;
    }

    job.status = 'NEEDS_REVIEW';
    await job.save();
    await logEvent(job._id, 'REVIEW_REQUIRED', decision.reason, { passedWeight: decision.passedWeight });
    return job;
  } catch (err) {
    // Something unexpected: never leave the job stuck in CHECKING.
    waiting.delete(id);
    await Job.updateOne({ _id: job._id, status: 'CHECKING' }, { $set: { status: 'NEEDS_REVIEW' } }).catch(() => {});
    await logEvent(job._id, 'ERROR', `Checker crashed: ${err.message}. Sent to human review.`);
    console.error('[checker] job', id, 'failed:', err);
    return job;
  }
}

// ---------- the loop ----------

/** Starts checking jobs every 5 seconds. Call once, after MongoDB is connected. Returns stop(). */
export function startCheckerLoop({ intervalMs = INTERVAL_MS } = {}) {
  let busy = false; // a website check can take longer than 5s; never run two at once

  // A crash or restart may leave jobs half-checked: put them back in the queue.
  Job.updateMany({ status: 'CHECKING' }, { $set: { status: 'SUBMITTED' } })
    .then((r) => r.modifiedCount && console.log(`[checker] re-queued ${r.modifiedCount} job(s) stuck in CHECKING`))
    .catch((err) => console.error('[checker] could not re-queue jobs:', err.message));

  const timer = setInterval(async () => {
    if (busy || mongoose.connection.readyState !== 1) return;
    busy = true;
    try {
      await processNextJob();
    } catch (err) {
      console.error('[checker] loop error:', err.message);
    } finally {
      busy = false;
    }
  }, intervalMs);

  console.log(`[checker] loop started (every ${intervalMs / 1000}s)`);
  return () => clearInterval(timer);
}
