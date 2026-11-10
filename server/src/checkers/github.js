// Code-job checker (PLAN.md 5.3 and 5.4): reads a pull request from GitHub.
// Pure function: no database. loop.js saves the results.
//
//   checkCodeJob(job, { timedOut })
//     → array of results, one per item: { itemId, status, confidence, reasoning, evidence }
//     → null if the PR's tests are still running (loop.js tries again later)
//
// It never throws: any problem becomes an UNSURE result.

import { pathMatches } from '../ai/checklistRules.js';

export { pathMatches }; // shared with the checklist rules, so both use the same path logic

const API = 'https://api.github.com';
const OK_CONCLUSIONS = ['success', 'neutral', 'skipped'];

// ---------- small helpers ----------

// "https://github.com/Owner/Repo/pull/12" → { owner, repo, number }
export function parsePrUrl(url) {
  const m = String(url || '')
    .trim()
    .match(/^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)(?:[/?#].*)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, ''), number: Number(m[3]) };
}

// "https://github.com/Owner/Repo(.git)(/)" → "owner/repo"
export function repoKey(url) {
  const m = String(url || '')
    .trim()
    .match(/^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  return m ? `${m[1]}/${m[2].replace(/\.git$/i, '')}`.toLowerCase() : null;
}

async function gh(path) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'veriflow-checker',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(`${API}${path}`, { headers, signal: AbortSignal.timeout(15000) });
  if (res.ok) return res.json();

  if (res.status === 404) throw new Error('Not found on GitHub (wrong URL, or the repo is private)');
  if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
    throw new Error('GitHub rate limit reached. Add GITHUB_TOKEN to server/.env');
  }
  throw new Error(`GitHub API error ${res.status}`);
}

// Fetch every page of a list endpoint (100 per page, at most 10 pages).
async function ghAll(path, pick = (x) => x) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const list = pick(await gh(`${path}${sep}per_page=100&page=${page}`));
    all.push(...list);
    if (list.length < 100) break;
  }
  return all;
}

const result = (item, idx, status, reasoning, logUrl = null, confidence = 1.0) => ({
  itemId: String(item._id ?? idx),
  status,
  confidence,
  reasoning,
  evidence: { screenshots: [], logUrl },
});

// Does the repo have at least one active GitHub Actions workflow?
// If we can't tell (API error), say yes, so the loop keeps waiting as before.
async function hasActiveWorkflows(base) {
  try {
    const data = await gh(`${base}/actions/workflows?per_page=100`);
    return (data.workflows || []).some((w) => w.state === 'active');
  } catch {
    return true;
  }
}

// ---------- the two checks ----------

// tests_pass: look at every GitHub Actions check run on the PR's latest commit.
// Returns { status, reasoning, logUrl } or { pending: true }.
function judgeTests(checkRuns) {
  if (checkRuns.length === 0) return { pending: true, why: 'No tests have started on this pull request yet' };

  const running = checkRuns.filter((r) => r.status !== 'completed');
  if (running.length > 0) {
    return { pending: true, why: `Tests still running: ${running.map((r) => r.name).join(', ')}` };
  }

  const failed = checkRuns.filter((r) => !OK_CONCLUSIONS.includes(r.conclusion));
  if (failed.length === 0) {
    return {
      status: 'PASS',
      reasoning: `All ${checkRuns.length} check(s) passed: ${checkRuns.map((r) => r.name).join(', ')}`,
      logUrl: checkRuns[0]?.html_url ?? null,
    };
  }
  return {
    status: 'FAIL',
    reasoning: `${failed.length} of ${checkRuns.length} check(s) failed: ${failed
      .map((r) => `${r.name} (${r.conclusion})`)
      .join(', ')}`,
    logUrl: failed[0].html_url ?? null,
  };
}

// files_changed: every mustTouch path changed, no mustNotTouch path changed.
function judgeFiles(changedFiles, params) {
  const mustTouch = params.mustTouch || [];
  const mustNotTouch = params.mustNotTouch || [];

  const missing = mustTouch.filter((rule) => !changedFiles.some((f) => pathMatches(f, rule)));
  const forbidden = changedFiles.filter((f) => mustNotTouch.some((rule) => pathMatches(f, rule)));

  if (missing.length === 0 && forbidden.length === 0) {
    const parts = [];
    if (mustTouch.length) parts.push(`changed ${mustTouch.join(', ')}`);
    if (mustNotTouch.length) parts.push(`did not touch ${mustNotTouch.join(', ')}`);
    return { status: 'PASS', reasoning: `The pull request ${parts.join(' and ')} (${changedFiles.length} file(s) changed).` };
  }
  const problems = [];
  if (missing.length) problems.push(`did not change ${missing.join(', ')}`);
  if (forbidden.length) problems.push(`changed files it must not touch: ${forbidden.join(', ')}`);
  return { status: 'FAIL', reasoning: `The pull request ${problems.join('; ')}.` };
}

// ---------- main entry ----------

/**
 * @param {object} job  needs: submissionUrl (PR URL), repoUrl, items[]
 * @param {{ timedOut?: boolean, onPending?: (why: string) => void }} options
 *   timedOut=true → still-running tests become UNSURE instead of null
 *   onPending     → called with the reason whenever we return null (so the loop can tell the user)
 */
export async function checkCodeJob(job, { timedOut = false, onPending } = {}) {
  const items = job.items || [];
  const unsureAll = (why) => items.map((item, i) => result(item, i, 'UNSURE', why, null, 0));

  const pr = parsePrUrl(job.submissionUrl);
  if (!pr) return unsureAll(`Not a GitHub pull request URL: ${job.submissionUrl}`);
  if (job.repoUrl && repoKey(job.repoUrl) !== `${pr.owner}/${pr.repo}`.toLowerCase()) {
    return unsureAll(`Pull request is not in the job's repository (${job.repoUrl})`);
  }

  const base = `/repos/${pr.owner}/${pr.repo}`;
  const prLink = `https://github.com/${pr.owner}/${pr.repo}/pull/${pr.number}`;

  try {
    const prData = await gh(`${base}/pulls/${pr.number}`);
    const sha = prData.head.sha;

    const needsTests = items.some((i) => i.kind === 'tests_pass');
    const needsFiles = items.some((i) => i.kind === 'files_changed');

    const [checkRuns, changedFiles] = await Promise.all([
      needsTests ? ghAll(`${base}/commits/${sha}/check-runs`, (d) => d.check_runs) : [],
      needsFiles ? ghAll(`${base}/pulls/${pr.number}/files`).then((fs) => fs.map((f) => f.filename)) : [],
    ]);

    let tests = needsTests ? judgeTests(checkRuns) : null;

    // No check runs at all: if the repo has no GitHub Actions, no tests will ever start,
    // so don't make everyone wait 5 minutes. A person decides instead.
    if (tests?.pending && checkRuns.length === 0 && !(await hasActiveWorkflows(base))) {
      tests = {
        noCi: true,
        reasoning: 'This repository has no GitHub Actions workflows, so there are no tests to run. A person needs to check the work.',
      };
    }

    if (tests?.pending && !timedOut) {
      onPending?.(tests.why);
      return null; // loop.js will try again
    }

    return items.map((item, i) => {
      if (item.kind === 'tests_pass') {
        if (tests.noCi) return result(item, i, 'UNSURE', tests.reasoning, prLink, 0);
        if (tests.pending) return result(item, i, 'UNSURE', `${tests.why} (gave up waiting)`, prLink, 0);
        return result(item, i, tests.status, tests.reasoning, tests.logUrl);
      }
      if (item.kind === 'files_changed') {
        const f = judgeFiles(changedFiles, item.params || {});
        return result(item, i, f.status, f.reasoning, `${prLink}/files`);
      }
      return result(item, i, 'UNSURE', `"${item.kind}" is not a code-job check`, null, 0);
    });
  } catch (err) {
    return unsureAll(`Could not check the pull request: ${err.message}`);
  }
}
