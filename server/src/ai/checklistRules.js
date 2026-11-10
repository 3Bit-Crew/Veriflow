// Checklist rules from PLAN.md 5.3, in one place.
// Used by generateChecklist (B) and can be reused by the PUT /api/jobs/:id/checklist route (A).

export const ALLOWED_KINDS = {
  code: ["tests_pass", "files_changed"],
  website: [
    "page_loads",
    "element_exists",
    "text_present",
    "visual",
    "speed_score",
    "interaction",
  ],
};

export const MAX_ITEMS = 8;

// "interaction" items: the AI clicks and types on the site, then judges the result.
// Each one costs 2 AI calls and up to a minute of checking, so keep it to a few per job.
export const MAX_INTERACTION_ITEMS = 2;
export const MAX_STEPS_TEXT = 300;

// On/off switch for interaction items (INTERACTION_CHECKS=true in .env / Render).
// Off: the AI never writes them, and they're dropped from AI checklists.
// Jobs that already have one are still checked either way.
export const interactionEnabled = () => process.env.INTERACTION_CHECKS === "true";

// The kinds the AI may use right now for a job type.
export function allowedKinds(type) {
  const kinds = ALLOWED_KINDS[type];
  if (!kinds) return undefined;
  return interactionEnabled() ? kinds : kinds.filter((k) => k !== "interaction");
}

// Code jobs: the worker must not edit the buyer's tests or CI setup to make them "pass".
// A rule ending in "/" = whole folder (from the repo root). A rule starting with "*" = file name ending.
export const PROTECTED_PATHS = [
  ".github/",
  "test/",
  "tests/",
  "__tests__/",
  "spec/",
  "*.test.js",
  "*.spec.js",
  "*.test.ts",
  "*.spec.ts",
];
export const PROTECT_TESTS_TEXT =
  "The buyer's tests and CI setup were not modified";

/**
 * Does a changed file match a rule path?
 *   "src/db/"   → anything inside that folder (from the repo root)
 *   "*.test.js" → any file whose name ends with ".test.js"
 *   "src/a.js"  → exactly that file
 */
export function pathMatches(file, rule) {
  const clean = (p) => String(p).trim().replace(/^\.?\//, "");
  const f = clean(file);
  const r = clean(rule);
  if (r.startsWith("*")) return f.endsWith(r.slice(1));
  return r.endsWith("/") ? f.startsWith(r) : f === r;
}

// Adds the "don't edit the tests" item to a code checklist, unless:
// - an item already protects .github/ (AI or buyer added it), or
// - the job itself asks to change tests (mustTouch on a test path) → those paths are left out.
function addTestProtection(items) {
  const alreadyThere = items.some(
    (i) =>
      i.kind === "files_changed" &&
      i.params.mustNotTouch.some((p) => pathMatches(".github/x", p)),
  );
  if (alreadyThere) return items;

  const touched = items.flatMap((i) =>
    i.kind === "files_changed" ? i.params.mustTouch : [],
  );
  const protect = PROTECTED_PATHS.filter(
    (rule) =>
      !touched.some(
        (t) => t === rule || pathMatches(t, rule) || pathMatches(rule, t),
      ),
  );
  if (protect.length === 0) return items;

  const item = {
    text: PROTECT_TESTS_TEXT,
    kind: "files_changed",
    params: { mustTouch: [], mustNotTouch: protect },
    weight: 10,
  };
  // Right after tests_pass, so the MAX_ITEMS cut never drops it.
  return [items[0], item, ...items.slice(1)];
}

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const cleanPathList = (list) =>
  Array.isArray(list) ? list.filter(isNonEmptyString).map((p) => p.trim()) : [];

// Returns cleaned params for a kind, or null if the params can't be used.
function cleanParams(kind, params = {}) {
  const p = params && typeof params === "object" ? params : {};
  switch (kind) {
    case "tests_pass":
      return {};
    case "files_changed": {
      const mustTouch = cleanPathList(p.mustTouch);
      const mustNotTouch = cleanPathList(p.mustNotTouch);
      if (mustTouch.length === 0 && mustNotTouch.length === 0) return null;
      return { mustTouch, mustNotTouch };
    }
    case "page_loads":
      return {
        path:
          isNonEmptyString(p.path) && p.path.startsWith("/")
            ? p.path.trim()
            : "/",
      };
    case "element_exists":
      return isNonEmptyString(p.selector)
        ? { selector: p.selector.trim() }
        : null;
    case "text_present":
      return isNonEmptyString(p.text) ? { text: p.text.trim() } : null;
    case "visual":
      return { viewport: p.viewport === "desktop" ? "desktop" : "mobile" };
    case "speed_score": {
      const min = Math.round(Number(p.min));
      return {
        min: Number.isFinite(min) ? Math.min(100, Math.max(1, min)) : 80,
      };
    }
    case "interaction":
      // steps = what a user does first, in plain English ("Paste a long link and click Shrink It").
      return isNonEmptyString(p.steps)
        ? {
            steps: p.steps.trim().slice(0, MAX_STEPS_TEXT),
            viewport: p.viewport === "mobile" ? "mobile" : "desktop",
          }
        : null;
    default:
      return null;
  }
}

// Make weights whole numbers >= 1 that add up to exactly 100 (largest-remainder rounding).
export function normalizeWeights(weights) {
  const n = weights.length;
  if (n === 0) return [];
  const safe = weights.map((w) =>
    Number.isFinite(Number(w)) && Number(w) > 0 ? Number(w) : 1,
  );
  const total = safe.reduce((a, b) => a + b, 0);
  // Reserve 1 point per item so every item keeps at least 1.
  const spare = 100 - n;
  const raw = safe.map((w) => (w / total) * spare);
  const result = raw.map((r) => 1 + Math.floor(r));
  let left = 100 - result.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) result[order[k].i]++;
  return result;
}

function defaultItems(type) {
  return type === "code"
    ? [
        {
          text: "All automated tests pass",
          kind: "tests_pass",
          params: {},
          weight: 100,
        },
      ]
    : [
        {
          text: "Website loads successfully",
          kind: "page_loads",
          params: { path: "/" },
          weight: 100,
        },
      ];
}

/**
 * Clean up a checklist so it follows every rule in PLAN.md 5.3.
 * Never throws for bad items: it drops or fixes them.
 * @param {'code'|'website'} type
 * @param {Array<{text, kind, params, weight}>} items
 * @returns {Array<{text, kind, params, weight, status}>}
 */
export function validateAndFixItems(type, items) {
  const allowed = allowedKinds(type);
  if (!allowed) throw new Error(`Unknown job type: ${type}`);

  let cleaned = (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || !allowed.includes(item.kind) || !isNonEmptyString(item.text))
        return null;
      const params = cleanParams(item.kind, item.params);
      if (!params) return null;
      return {
        text: item.text.trim(),
        kind: item.kind,
        params,
        weight: item.weight,
      };
    })
    .filter(Boolean);

  // At most MAX_INTERACTION_ITEMS interaction items (keep the first ones).
  let interactions = 0;
  cleaned = cleaned.filter(
    (i) => i.kind !== "interaction" || ++interactions <= MAX_INTERACTION_ITEMS,
  );

  // Code jobs: exactly one tests_pass item.
  if (type === "code") {
    const firstTests = cleaned.find((i) => i.kind === "tests_pass");
    cleaned = cleaned.filter((i) => i.kind !== "tests_pass");
    cleaned.unshift(
      firstTests || {
        text: "All automated tests pass",
        kind: "tests_pass",
        params: {},
        weight: 50,
      },
    );
    cleaned = addTestProtection(cleaned);
  }

  cleaned = cleaned.slice(0, MAX_ITEMS);
  if (cleaned.length === 0) cleaned = defaultItems(type);

  const weights = normalizeWeights(cleaned.map((i) => i.weight));
  return cleaned.map((item, idx) => ({
    ...item,
    weight: weights[idx],
    status: "PENDING",
  }));
}

/**
 * Strict check (no fixing). Returns a list of problems; empty list = valid.
 * Handy for the PUT route, where the buyer's edits should be rejected, not silently changed.
 */
export function findChecklistProblems(type, items) {
  const problems = [];
  const allowed = ALLOWED_KINDS[type];
  if (!allowed) return [`Unknown job type: ${type}`];
  if (!Array.isArray(items) || items.length === 0)
    return ["Checklist is empty"];
  if (items.length > MAX_ITEMS)
    problems.push(`At most ${MAX_ITEMS} items allowed`);

  items.forEach((item, i) => {
    const n = i + 1;
    if (!isNonEmptyString(item?.text))
      problems.push(`Item ${n}: text is empty`);
    if (!allowed.includes(item?.kind))
      problems.push(
        `Item ${n}: kind "${item?.kind}" not allowed for ${type} jobs`,
      );
    else if (!cleanParams(item.kind, item.params))
      problems.push(
        `Item ${n}: params are missing or invalid for ${item.kind}`,
      );
    if (!Number.isInteger(item?.weight) || item.weight < 1)
      problems.push(`Item ${n}: weight must be a whole number of at least 1`);
  });

  const sum = items.reduce((a, i) => a + (Number(i?.weight) || 0), 0);
  if (sum !== 100) problems.push(`Weights add up to ${sum}, must be 100`);
  const interactionCount = items.filter((i) => i?.kind === "interaction").length;
  if (interactionCount > MAX_INTERACTION_ITEMS)
    problems.push(
      `At most ${MAX_INTERACTION_ITEMS} interaction items (found ${interactionCount})`,
    );
  if (type === "code") {
    const count = items.filter((i) => i?.kind === "tests_pass").length;
    if (count !== 1)
      problems.push(
        `Code jobs need exactly one tests_pass item (found ${count})`,
      );
  }
  return problems;
}
