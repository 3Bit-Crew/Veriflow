// "interaction" items (PLAN.md 5.3): the AI uses the site like a person, then judges the result.
// Pure function: no database. website.js calls it with its open browser; loop.js saves the screenshot.
//
//   checkInteractionItem(browser, url, item, idx)
//     → { result, shot }   result in the PLAN 5.4 shape, shot = JPEG Buffer of the page AFTER the steps (or null)
//
// How one item is checked:
//   1. open the site in a fresh tab and list its visible inputs, buttons and links, numbered
//   2. the AI turns item.params.steps into actions on those numbers (fill / select / click / press Enter)
//   3. Playwright does the actions
//   4. the AI judges "before" and "after" screenshots against item.text
//
// Never throws. A step that can't be done gives UNSURE (a person decides), never FAIL:
// only the judge, looking at a page where every step worked, can fail the work.
import { generateJSON, judgeImages } from '../ai/index.js';
import { interactionPlanPrompt, interactionJudgePrompt } from '../ai/prompts.js';
import { isPrivateHost } from '../validate.js'; // K's check for localhost / private addresses

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
// The whole item, AI calls included. A busy Gemini can take 30s before its fallback model answers.
const ITEM_TIMEOUT_MS = 120000;
const NAV_TIMEOUT_MS = 20000;
const ACTION_TIMEOUT_MS = 5000;
const MAX_ELEMENTS = 40;
const MAX_ACTIONS = 5;
const MAX_VALUE_LENGTH = 500;
const MAX_SCREENSHOT_BYTES = 300 * 1024;

const result = (item, idx, status, reasoning, confidence = 1.0) => ({
  itemId: String(item._id ?? idx),
  status,
  confidence,
  reasoning,
  evidence: { screenshots: [], logUrl: null },
});
const unsure = (item, idx, why) => result(item, idx, 'UNSURE', why, 0);

// ---------- page helpers ----------

// Numbers every visible input, button and link (data-vf-id) and describes them for the AI.
async function listElements(page) {
  return page.evaluate(({ max }) => {
    const clip = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const labelOf = (el) => {
      const byFor = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const wrap = el.closest('label');
      return clip(
        el.getAttribute('aria-label') || (byFor && byFor.innerText) || (wrap && wrap.innerText) ||
          el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('name') || '',
        60,
      );
    };
    const selector = 'input:not([type=hidden]), textarea, select, button, a[href], [role=button], [contenteditable="true"]';
    const out = [];
    for (const el of document.querySelectorAll(selector)) {
      if (out.length >= max) break;
      if (!visible(el) || el.disabled) continue;
      const id = out.length + 1;
      el.setAttribute('data-vf-id', String(id));
      const tag = el.isContentEditable && !['input', 'textarea'].includes(el.tagName.toLowerCase()) ? 'editable' : el.tagName.toLowerCase();
      out.push({
        id,
        tag,
        type: tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : '',
        label: labelOf(el),
        text: tag === 'input' || tag === 'textarea' ? '' : clip(el.innerText || el.value, 60),
        href: tag === 'a' ? clip(el.getAttribute('href'), 80) : '',
      });
    }
    return out;
  }, { max: MAX_ELEMENTS });
}

// Viewport-sized JPEG first (what a person sees); full page only if it's still small enough.
async function screenshot(page) {
  try {
    const full = await page.screenshot({ type: 'jpeg', quality: 60, fullPage: true });
    return full.length <= MAX_SCREENSHOT_BYTES ? full : await page.screenshot({ type: 'jpeg', quality: 60 });
  } catch {
    return null;
  }
}

// Counts the page's open requests. Playwright's "networkidle" only works for a full page load,
// so after a click in a single-page app (fetch to an API) we track requests ourselves.
function trackRequests(page) {
  const open = new Set();
  const ignore = (req) => ['eventsource', 'websocket'].includes(req.resourceType()); // never finish
  page.on('request', (req) => { if (!ignore(req)) open.add(req); });
  page.on('requestfinished', (req) => open.delete(req));
  page.on('requestfailed', (req) => open.delete(req));
  return open;
}

// Wait for the page to react to an action: no open requests AND the page text unchanged for
// QUIET_MS, at most maxMs. A slow API (a server waking up) shows "Loading…" for a while:
// its request stays open, so we keep waiting instead of screenshotting the spinner.
const QUIET_MS = 1000;
async function settle(page, open, maxMs = 5000) {
  const until = Date.now() + maxMs;
  const snapshot = () => page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  await page.waitForTimeout(300); // let the click start its requests
  let last = await snapshot();
  let quietSince = open.size === 0 ? Date.now() : null;
  while (Date.now() < until) {
    await page.waitForTimeout(250);
    const now = await snapshot();
    if (open.size > 0 || now !== last) {
      quietSince = null;
      last = now;
    } else if (quietSince === null) {
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= QUIET_MS) {
      return;
    }
  }
}

// ---------- the AI's plan ----------

// Keeps only actions that are safe and possible. Returns { actions } or { problem }.
export function cleanPlan(plan, elements) {
  if (!plan || typeof plan !== 'object') return { problem: 'The AI did not return a plan.' };
  if (plan.possible === false) {
    return { problem: `The AI could not find a way to do the steps: ${String(plan.reason || 'no reason given').slice(0, 200)}` };
  }
  const byId = new Map(elements.map((e) => [e.id, e]));
  const raw = Array.isArray(plan.actions) ? plan.actions.slice(0, MAX_ACTIONS) : [];
  if (raw.length === 0) return { problem: 'The AI planned no actions.' };

  const actions = [];
  for (const [n, a] of raw.entries()) {
    const el = byId.get(Number(a?.id));
    const what = String(a?.do || '').toLowerCase();
    const value = typeof a?.value === 'string' ? a.value.slice(0, MAX_VALUE_LENGTH) : '';
    const bad = (why) => ({ problem: `Step ${n + 1} of the AI's plan can't be used: ${why}.` });

    if (!el) return bad(`there is no element #${a?.id}`);
    const fillable = el.tag === 'textarea' || el.tag === 'editable' ||
      (el.tag === 'input' && !['checkbox', 'radio', 'submit', 'button', 'file', 'image', 'reset', 'range', 'color'].includes(el.type));
    if (what === 'fill') {
      if (!fillable) return bad(`#${el.id} is a <${el.tag}>, not a text field`);
      actions.push({ do: 'fill', el, value });
    } else if (what === 'select') {
      if (el.tag !== 'select') return bad(`#${el.id} is not a dropdown`);
      if (!value) return bad('no option given');
      actions.push({ do: 'select', el, value });
    } else if (what === 'click') {
      actions.push({ do: 'click', el });
    } else if (what === 'press') {
      actions.push({ do: 'press', el, value: 'Enter' });
    } else {
      return bad(`unknown action "${a?.do}"`);
    }
  }
  return { actions };
}

// "Type "https://…" into the URL box (#3)" — for the judge, the evidence log and the reasoning.
function describe(a) {
  const name = a.el.label || a.el.text || `<${a.el.tag}>`;
  if (a.do === 'fill') return `Typed "${a.value}" into "${name}"`;
  if (a.do === 'select') return `Chose "${a.value}" in "${name}"`;
  if (a.do === 'press') return `Pressed Enter in "${name}"`;
  return `Clicked "${name}"`;
}

// After the LAST step, give a slow site up to this long to finish (the item's 2-minute limit still applies).
const FINAL_SETTLE_MS = 30000;

async function perform(page, a, open, isLast) {
  const target = page.locator(`[data-vf-id="${a.el.id}"]`).first();
  const opts = { timeout: ACTION_TIMEOUT_MS };
  if (a.do === 'fill') await target.fill(a.value, opts);
  else if (a.do === 'select') {
    await target.selectOption({ label: a.value }, opts).catch(() => target.selectOption(a.value, opts));
  } else if (a.do === 'press') await target.press('Enter', opts);
  else await target.click(opts);
  await settle(page, open, isLast ? FINAL_SETTLE_MS : 5000);
}

// ---------- main entry ----------

async function runItem(browser, url, item, idx, state) {
  const viewport = item.params?.viewport === 'mobile' ? 'mobile' : 'desktop';
  const steps = String(item.params?.steps || '').trim();
  if (!steps) return { result: unsure(item, idx, 'This item has no steps to do.'), shot: null };

  const context = await browser.newContext(VIEWPORTS[viewport]);
  state.context = context;
  // The checker runs on our server: never let the site make the browser call a private address.
  await context.route('**/*', (route) => {
    let host = '';
    try { host = new URL(route.request().url()).hostname; } catch { /* data: or blob: URL */ }
    return host && isPrivateHost(host) ? route.abort('blockedbyclient') : route.continue();
  });
  const page = await context.newPage();
  const open = trackRequests(page);

  // 1. Open the page and list what can be used
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
  } catch (err) {
    return { result: unsure(item, idx, `Could not open the site: ${err.message.split('\n')[0]}`), shot: null };
  }
  if (response && response.status() >= 400) {
    return { result: result(item, idx, 'FAIL', `The site returned HTTP ${response.status()}, so the steps could not be tried.`), shot: null };
  }
  await settle(page, open, 5000);
  const before = await screenshot(page);
  const elements = await listElements(page);
  if (elements.length === 0) {
    return { result: unsure(item, idx, 'The page has no buttons, links or fields to use.'), shot: before };
  }

  // 2. The AI plans the actions
  let plan;
  try {
    plan = await generateJSON(
      interactionPlanPrompt({ steps, requirement: item.text, pageTitle: await page.title(), elements }),
      { preferGroq: true },
    );
  } catch (err) {
    return { result: unsure(item, idx, `The AI could not plan the steps: ${err.message}`), shot: before };
  }
  const { actions, problem } = cleanPlan(plan, elements);
  if (problem) return { result: unsure(item, idx, problem), shot: before };

  // 3. Do them
  const done = [];
  for (const [n, a] of actions.entries()) {
    try {
      await perform(page, a, open, n === actions.length - 1);
      done.push(describe(a));
    } catch (err) {
      const why = err.message.split('\n')[0];
      return {
        result: unsure(item, idx, `Did: ${done.join('; ') || 'nothing'}. Then could not do "${describe(a)}": ${why}`),
        shot: await screenshot(page),
      };
    }
  }

  // 4. The AI judges the result
  const after = await screenshot(page);
  if (!after) return { result: unsure(item, idx, `Did: ${done.join('; ')}. Then could not take a screenshot.`), shot: null };
  const images = before ? [before, after] : [after, after];
  const verdict = await judgeImages(interactionJudgePrompt({ requirement: item.text, done, viewport }), images);
  return {
    result: { ...result(item, idx, verdict.status, `Did: ${done.join('; ')}. ${verdict.reasoning}`, verdict.confidence) },
    shot: after,
  };
}

/**
 * Checks one interaction item with an already open Playwright browser.
 * @returns {Promise<{ result: object, shot: Buffer|null }>}
 */
export async function checkInteractionItem(browser, url, item, idx) {
  const state = { context: null };
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(
      () => resolve({ result: unsure(item, idx, `The steps took longer than ${ITEM_TIMEOUT_MS / 1000} seconds.`), shot: null }),
      ITEM_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([
      runItem(browser, url, item, idx, state).catch((err) => ({
        result: unsure(item, idx, `Interaction check failed: ${err.message.split('\n')[0]}`),
        shot: null,
      })),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
    await state.context?.close().catch(() => {}); // closing it also stops a step still running after a timeout
  }
}
