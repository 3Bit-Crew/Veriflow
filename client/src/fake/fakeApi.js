// A stand-in for the server, used when VITE_USE_FAKE_API=true.
// Same function names as api.js, same response shapes and error rules as PLAN.md 5.8.
//
// The checker is simulated from timestamps instead of timers: every read moves jobs forward
// by however much time has passed, so reloading a page mid-check picks up where it left off.
//
// The job title picks the outcome, so each path can be tried by hand:
//   (default)         first try fails one item, second try passes everything -> FULL
//   title has "review"   an item comes back UNSURE -> NEEDS_REVIEW
//   title has "partial"  the same item fails on both tries -> PARTIAL
//   title has "void"     everything fails on both tries -> VOID

const STORAGE_KEY = 'veriflow.fakeApi.v1';
const STEP_MS = 1500; // time between each simulated check
const LATENCY_MS = 150;

const ALLOWED_KINDS = {
  code: ['tests_pass', 'files_changed'],
  website: ['page_loads', 'element_exists', 'text_present', 'visual', 'speed_score'],
};
const MAX_ITEMS = 8;

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

const newId = () =>
  Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const isoAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

const money = (n) => `$${Number(n).toFixed(2)}`;

// Same rounding as roundDown2 in server/src/paypal/settle.js.
const roundDown2 = (n) => Math.floor(n * 100 + 1e-9) / 100;

// ---- Storage ----------------------------------------------------------------------------

let memory = null; // used when localStorage is unavailable

function loadState() {
  if (memory) return memory;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      memory = JSON.parse(saved);
      return memory;
    }
  } catch {
    // Blocked storage or unreadable data: start again from the sample jobs.
  }
  memory = buildSeedState();
  saveState();
  return memory;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Keep going from memory; the data just won't survive a reload.
  }
}

export function resetFakeData() {
  memory = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

// ---- Building jobs and events -----------------------------------------------------------

function buildItem(fields) {
  return {
    _id: newId(),
    status: 'PENDING',
    params: {},
    evidence: { screenshots: [], logUrl: null },
    ...fields,
  };
}

function checklistFor(job) {
  if (job.type === 'code') {
    return [
      { text: 'All automated tests pass', kind: 'tests_pass', params: {}, weight: 60 },
      {
        text: 'Login code changed, database code left alone',
        kind: 'files_changed',
        params: { mustTouch: ['src/login.js'], mustNotTouch: ['src/db/'] },
        weight: 40,
      },
    ];
  }
  return [
    { text: 'Home page loads', kind: 'page_loads', params: { path: '/' }, weight: 20 },
    { text: 'Signup form has an email field', kind: 'element_exists', params: { selector: 'input[type=email]' }, weight: 25 },
    { text: 'Page says "Sign up"', kind: 'text_present', params: { text: 'Sign up' }, weight: 20 },
    { text: 'Looks good on mobile', kind: 'visual', params: { viewport: 'mobile' }, weight: 35 },
  ];
}

function addEvent(state, jobId, type, message, data = {}, createdAt = new Date().toISOString()) {
  state.events.push({ _id: newId(), jobId, type, message, data, createdAt, updatedAt: createdAt });
}

function touch(job) {
  job.updatedAt = new Date().toISOString();
}

// A small placeholder image, standing in for a stored screenshot.
function placeholderScreenshot(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300">
    <rect width="480" height="300" fill="#e7ece9"/>
    <text x="240" y="155" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#5b6b64">${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ---- Simulated checker ------------------------------------------------------------------

function scenarioOf(job) {
  const title = job.title.toLowerCase();
  if (title.includes('review')) return 'review';
  if (title.includes('partial')) return 'partial';
  if (title.includes('void')) return 'void';
  return 'demo';
}

// The item that goes wrong: tests for code jobs, the visual check for website jobs.
function weakItemIndex(job) {
  const index = job.items.findIndex((i) => i.kind === 'tests_pass' || i.kind === 'visual');
  return index === -1 ? job.items.length - 1 : index;
}

function resultFor(job, index) {
  const item = job.items[index];
  const scenario = scenarioOf(job);
  const isWeak = index === weakItemIndex(job);
  const isVisual = item.kind === 'visual';

  const evidence = {
    screenshots: isVisual ? [`fake-${item.params.viewport || 'mobile'}`] : [],
    logUrl: item.kind === 'tests_pass' ? 'https://github.com/3Bit-Crew/veriflow-demo/actions' : null,
  };

  if (scenario === 'review' && isWeak) {
    return {
      status: 'UNSURE',
      confidence: 0.55,
      reasoning: 'Could not tell with confidence. A person should look at the evidence.',
      evidence,
    };
  }

  const fails =
    scenario === 'void' ||
    (scenario === 'partial' && isWeak) ||
    (scenario === 'demo' && isWeak && job.attempts === 1);

  if (fails) {
    return {
      status: 'FAIL',
      confidence: isVisual ? 0.9 : 1,
      reasoning: {
        tests_pass: '1 of 6 checks failed: "login accepts capital letters in the email".',
        files_changed: 'A file in src/db/ was changed, which the checklist does not allow.',
        visual: 'The signup button is cut off at the right edge on a 390px screen.',
      }[item.kind] || 'The check did not pass.',
      evidence,
    };
  }

  return {
    status: 'PASS',
    confidence: isVisual ? 0.92 : 1,
    reasoning: {
      tests_pass: 'All 6 checks on the pull request passed.',
      files_changed: 'Only the allowed files were changed.',
      page_loads: 'The page returned status 200.',
      element_exists: `Found ${item.params.selector} on desktop and mobile.`,
      text_present: `Found the text "${item.params.text}".`,
      visual: 'The layout fits the screen and every control is visible.',
      speed_score: 'The speed score is above the minimum.',
    }[item.kind] || 'The check passed.',
    evidence,
  };
}

function settle(state, job, amount) {
  const payout = roundDown2(amount);
  job.payoutAmount = payout;
  job.settlement = payout === 0 ? 'VOID' : payout === job.amount ? 'FULL' : 'PARTIAL';
  job.status = 'SETTLED';
  touch(job);
  if (job.settlement === 'VOID') {
    addEvent(state, job._id, 'PAYPAL_VOIDED', `Payment voided. ${money(job.amount)} returned to buyer`);
  } else {
    addEvent(state, job._id, 'PAYPAL_CAPTURED', `Captured ${money(payout)} of ${money(job.amount)} (${job.settlement})`, {
      payout,
      settlement: job.settlement,
    });
  }
}

// Decision rule from PLAN.md 5.5.
function decide(state, job) {
  const passedWeight = job.items.filter((i) => i.status === 'PASS').reduce((sum, i) => sum + i.weight, 0);
  const notSure = job.items.some((i) => i.status === 'UNSURE' || i.confidence < 0.7);

  if (notSure) {
    job.status = 'NEEDS_REVIEW';
    touch(job);
    addEvent(state, job._id, 'REVIEW_REQUIRED', 'AI was not confident. Waiting for a person to decide');
  } else if (passedWeight === 100) {
    settle(state, job, job.amount);
  } else if (job.attempts === 1) {
    job.status = 'CHANGES_REQUESTED';
    touch(job);
    addEvent(state, job._id, 'CHANGES_REQUESTED', `First try failed. ${money(job.amount)} still held, worker can resubmit`);
  } else if (passedWeight === 0) {
    settle(state, job, 0);
  } else {
    settle(state, job, (job.amount * passedWeight) / 100);
  }
}

function stepChecker(state, job, sim) {
  if (job.status === 'SUBMITTED') {
    job.attempts += 1;
    job.status = 'CHECKING';
    touch(job);
    addEvent(state, job._id, 'CHECK_STARTED', `Checking try ${job.attempts}`);
    sim.index = 0;
    return false;
  }

  const item = job.items[sim.index];
  Object.assign(item, resultFor(job, sim.index));
  touch(job);
  addEvent(state, job._id, 'CHECK_RESULT', `${item.status}: ${item.text}`, { itemId: item._id, status: item.status });
  sim.index += 1;

  if (sim.index < job.items.length) return false;
  decide(state, job);
  return true;
}

// Moves every job being checked forward to the current time.
function advance(state) {
  const now = Date.now();
  let changed = false;
  for (const [jobId, sim] of Object.entries(state.sims)) {
    const job = state.jobs.find((j) => j._id === jobId);
    if (!job) {
      delete state.sims[jobId];
      continue;
    }
    while (now >= sim.nextAt) {
      changed = true;
      sim.nextAt += STEP_MS;
      if (stepChecker(state, job, sim)) {
        delete state.sims[jobId];
        break;
      }
    }
  }
  if (changed) saveState();
}

function startCheck(state, job) {
  state.sims[job._id] = { nextAt: Date.now() + STEP_MS, index: 0 };
}

// ---- Sample data ------------------------------------------------------------------------

const WORKER = 'worker@business.example.com';

function seedJob(state, fields, itemResults) {
  const createdAt = isoAgo(fields.ageMinutes);
  const { ageMinutes, ...rest } = fields;
  const job = {
    _id: newId(),
    currency: 'USD',
    workerEmail: WORKER,
    attempts: 0,
    createdAt,
    updatedAt: createdAt,
    items: [],
    ...rest,
  };
  if (job.status !== 'DRAFT') {
    job.items = checklistFor(job).map((item, i) => buildItem({ ...item, ...(itemResults?.[i] || {}) }));
  }
  if (!['DRAFT', 'CHECKLIST_READY'].includes(job.status)) {
    job.paypalOrderId = `FAKEORDER${job._id.slice(0, 8).toUpperCase()}`;
    job.paypalAuthId = `FAKEAUTH${job._id.slice(0, 8).toUpperCase()}`;
  }
  state.jobs.push(job);
  addEvent(state, job._id, 'JOB_CREATED', `Job created: ${job.title}`, {}, createdAt);
  if (job.paypalAuthId) {
    addEvent(state, job._id, 'PAYPAL_AUTHORIZED', `${money(job.amount)} held on PayPal`, {}, isoAgo(ageMinutes - 1));
  }
  return job;
}

const passed = (reasoning, extra = {}) => ({ status: 'PASS', confidence: 1, reasoning, ...extra });
const failed = (reasoning, extra = {}) => ({ status: 'FAIL', confidence: 1, reasoning, ...extra });
const REPO = 'https://github.com/3Bit-Crew/veriflow-demo';

function buildSeedState() {
  const state = { jobs: [], events: [], sims: {} };

  seedJob(state, {
    title: 'Redesign the pricing page',
    description: 'Clearer pricing page with three plans and a signup button on each.',
    type: 'website',
    amount: 300,
    status: 'SETTLED',
    attempts: 2,
    submissionUrl: 'https://pricing-demo.example.com',
    payoutAmount: 0,
    settlement: 'VOID',
    ageMinutes: 2880,
  }, [
    failed('The page returned status 500.'),
    failed('No email field was found.'),
    failed('The text "Sign up" was not found.'),
    failed('The page is blank on a 390px screen.', { confidence: 0.95 }),
  ]);

  seedJob(state, {
    title: 'Bakery landing page',
    description: 'Landing page with a signup form that looks good on mobile.',
    type: 'website',
    amount: 150,
    status: 'SETTLED',
    attempts: 2,
    submissionUrl: 'https://bakery-demo.example.com',
    payoutAmount: 97.5,
    settlement: 'PARTIAL',
    ageMinutes: 1440,
  }, [
    passed('The page returned status 200.'),
    passed('Found input[type=email] on desktop and mobile.'),
    passed('Found the text "Sign up".'),
    failed('The signup button is cut off at the right edge on a 390px screen.', { confidence: 0.9, evidence: { screenshots: ['fake-mobile'], logUrl: null } }),
  ]);

  seedJob(state, {
    title: 'Fix the password reset email',
    description: 'Password reset emails are not being sent. All tests must pass.',
    type: 'code',
    repoUrl: REPO,
    amount: 200,
    status: 'SETTLED',
    attempts: 1,
    submissionUrl: `${REPO}/pull/4`,
    payoutAmount: 200,
    settlement: 'FULL',
    ageMinutes: 720,
  }, [
    passed('All 6 checks on the pull request passed.', { evidence: { screenshots: [], logUrl: `${REPO}/actions` } }),
    passed('Only the allowed files were changed.'),
  ]);

  seedJob(state, {
    title: 'Contact form for the clinic site',
    description: 'A contact form with an email field. Must look good on mobile.',
    type: 'website',
    amount: 120,
    status: 'NEEDS_REVIEW',
    attempts: 1,
    submissionUrl: 'https://clinic-demo.example.com',
    ageMinutes: 240,
  }, [
    passed('The page returned status 200.'),
    passed('Found input[type=email] on desktop and mobile.'),
    passed('Found the text "Sign up".'),
    { status: 'UNSURE', confidence: 0.55, reasoning: 'Could not tell with confidence. A person should look at the evidence.', evidence: { screenshots: ['fake-mobile'], logUrl: null } },
  ]);

  seedJob(state, {
    title: 'Fix the login bug',
    description: 'Users cannot log in when their email has capital letters. All tests must pass. Do not change the database code.',
    type: 'code',
    repoUrl: REPO,
    amount: 200,
    status: 'CHANGES_REQUESTED',
    attempts: 1,
    submissionUrl: `${REPO}/pull/7`,
    ageMinutes: 120,
  }, [
    failed('1 of 6 checks failed: "login accepts capital letters in the email".', { evidence: { screenshots: [], logUrl: `${REPO}/actions` } }),
    passed('Only the allowed files were changed.'),
  ]);

  const checking = seedJob(state, {
    title: 'Add dark mode to the settings page',
    description: 'A dark mode switch on the settings page. All tests must pass.',
    type: 'code',
    repoUrl: REPO,
    amount: 80,
    status: 'SUBMITTED',
    submissionUrl: `${REPO}/pull/9`,
    ageMinutes: 60,
  });
  startCheck(state, checking);

  seedJob(state, {
    title: 'Speed up the search API',
    description: 'Search takes too long. All tests must pass.',
    type: 'code',
    repoUrl: REPO,
    amount: 250,
    status: 'FUNDED',
    ageMinutes: 45,
  });

  seedJob(state, {
    title: 'Portfolio site for a photographer',
    description: 'A portfolio home page with a contact section.',
    type: 'website',
    amount: 180,
    status: 'CHECKLIST_READY',
    ageMinutes: 30,
  });

  seedJob(state, {
    title: 'Write the export-to-CSV feature',
    description: 'Let users download their orders as a CSV file.',
    type: 'code',
    repoUrl: REPO,
    amount: 100,
    status: 'DRAFT',
    ageMinutes: 15,
  });

  return state;
}

// ---- API functions ----------------------------------------------------------------------

// Runs a call like a network request: after a short delay, against up-to-date state,
// returning a copy so pages can't change the stored data by accident.
async function call(handler) {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  const state = loadState();
  advance(state);
  const result = handler(state);
  saveState();
  return structuredClone(result);
}

function findJob(state, id) {
  return state.jobs.find((j) => j._id === id) || fail(404, 'Job not found');
}

function requireStatus(job, ...allowed) {
  if (!allowed.includes(job.status)) {
    fail(409, `This action isn't allowed while the job is ${job.status}`);
  }
}

export function createJob(input) {
  return call((state) => {
    const { title, description, type, amount, workerEmail, repoUrl } = input || {};
    if (!title?.trim() || !description?.trim() || !workerEmail?.trim()) {
      fail(400, 'Title, description and worker email are required');
    }
    if (!ALLOWED_KINDS[type]) fail(400, 'Type must be code or website');
    if (!(Number(amount) > 0)) fail(400, 'Amount must be more than 0');
    if (type === 'code' && !/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(repoUrl || '')) {
      fail(400, 'Code jobs need a repo URL like https://github.com/owner/repo');
    }

    const now = new Date().toISOString();
    const job = {
      _id: newId(),
      title: title.trim(),
      description: description.trim(),
      type,
      amount: Number(amount),
      currency: 'USD',
      workerEmail: workerEmail.trim(),
      status: 'DRAFT',
      attempts: 0,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    if (type === 'code') job.repoUrl = repoUrl.replace(/\/$/, '');
    state.jobs.push(job);
    addEvent(state, job._id, 'JOB_CREATED', `Job created: ${job.title}`);
    return job;
  });
}

export function generateChecklist(id) {
  return call((state) => {
    const job = findJob(state, id);
    requireStatus(job, 'DRAFT');
    job.items = checklistFor(job).map(buildItem);
    touch(job);
    addEvent(state, job._id, 'CHECKLIST_GENERATED', `AI wrote ${job.items.length} checklist items`);
    return job;
  });
}

// The same rules the server applies, see findChecklistProblems in server/src/ai/checklistRules.js.
function checklistProblem(type, items) {
  if (!Array.isArray(items) || items.length === 0) return 'Checklist is empty';
  if (items.length > MAX_ITEMS) return `At most ${MAX_ITEMS} items allowed`;
  if (items.some((i) => !i.text?.trim())) return 'Every item needs text';
  if (items.some((i) => !ALLOWED_KINDS[type].includes(i.kind))) return `An item has a kind that isn't allowed for ${type} jobs`;
  if (items.some((i) => !Number.isInteger(i.weight) || i.weight < 1)) return 'Weights must be whole numbers of at least 1';
  const sum = items.reduce((total, i) => total + i.weight, 0);
  if (sum !== 100) return `Weights add up to ${sum}, must be 100`;
  if (type === 'code' && items.filter((i) => i.kind === 'tests_pass').length !== 1) {
    return 'Code jobs need exactly one tests_pass item';
  }
  return null;
}

export function approveChecklist(id, items) {
  return call((state) => {
    const job = findJob(state, id);
    requireStatus(job, 'DRAFT');
    const problem = checklistProblem(job.type, items);
    if (problem) fail(400, problem);
    job.items = items.map(({ text, kind, params, weight }) => buildItem({ text: text.trim(), kind, params: params || {}, weight }));
    job.status = 'CHECKLIST_READY';
    touch(job);
    addEvent(state, job._id, 'CHECKLIST_APPROVED', 'Buyer approved the checklist');
    return job;
  });
}

export function createPayPalOrder(jobId) {
  return call((state) => {
    const job = findJob(state, jobId);
    requireStatus(job, 'CHECKLIST_READY');
    job.paypalOrderId = `FAKEORDER${newId().slice(0, 8).toUpperCase()}`;
    touch(job);
    addEvent(state, job._id, 'PAYPAL_ORDER_CREATED', `PayPal order created for ${money(job.amount)}`, { orderId: job.paypalOrderId });
    return { orderId: job.paypalOrderId };
  });
}

export function authorizePayPalOrder(orderId, jobId) {
  return call((state) => {
    const job = findJob(state, jobId);
    requireStatus(job, 'CHECKLIST_READY');
    if (job.paypalOrderId !== orderId) fail(400, "That PayPal order doesn't belong to this job");
    job.paypalAuthId = `FAKEAUTH${newId().slice(0, 8).toUpperCase()}`;
    job.status = 'FUNDED';
    touch(job);
    addEvent(state, job._id, 'PAYPAL_AUTHORIZED', `${money(job.amount)} held on PayPal`, { authId: job.paypalAuthId });
    return job;
  });
}

export function submitWork(id, submissionUrl) {
  return call((state) => {
    const job = findJob(state, id);
    requireStatus(job, 'FUNDED', 'CHANGES_REQUESTED');
    const url = (submissionUrl || '').trim();
    if (job.type === 'code') {
      const prPrefix = `${job.repoUrl}/pull/`;
      if (!url.startsWith(prPrefix) || !/^\d+\/?$/.test(url.slice(prPrefix.length))) {
        fail(400, `Submit a pull request from this job's repo, like ${prPrefix}123`);
      }
    } else if (!url.startsWith('http')) {
      fail(400, 'Website URL must start with http');
    }

    job.submissionUrl = url;
    job.status = 'SUBMITTED';
    job.items.forEach((item) => {
      item.status = 'PENDING';
      item.evidence = { screenshots: [], logUrl: null };
      delete item.confidence;
      delete item.reasoning;
    });
    touch(job);
    addEvent(state, job._id, 'WORK_SUBMITTED', `Worker submitted ${url}`, { url });
    startCheck(state, job);
    return job;
  });
}

export function reviewJob(id, payoutAmount) {
  return call((state) => {
    const job = findJob(state, id);
    requireStatus(job, 'NEEDS_REVIEW');
    const payout = Number(payoutAmount);
    if (!Number.isFinite(payout) || payout < 0 || payout > job.amount) {
      fail(400, `Payout must be between 0 and ${job.amount}`);
    }
    addEvent(state, job._id, 'REVIEW_DECIDED', `Reviewer set the payout to ${money(payout)}`, { payout });
    settle(state, job, payout);
    return job;
  });
}

const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);

export function getJobs() {
  return call((state) => [...state.jobs].sort(newestFirst));
}

export function getJob(id) {
  return call((state) => {
    const job = findJob(state, id);
    return { job, events: state.events.filter((e) => e.jobId === id).sort(newestFirst) };
  });
}

export function getEvents() {
  return call((state) =>
    [...state.events].sort(newestFirst).map((event) => ({
      ...event,
      jobTitle: state.jobs.find((j) => j._id === event.jobId)?.title,
    })),
  );
}

export function screenshotUrl(id) {
  return placeholderScreenshot(`Sample screenshot (${String(id).replace('fake-', '')})`);
}
