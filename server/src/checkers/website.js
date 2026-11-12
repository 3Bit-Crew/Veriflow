// Website-job checker (PLAN.md 5.3 and 5.4): opens the site with Playwright.
// Pure function: no database. loop.js saves the results and the screenshots.
//
//   checkWebsiteJob(job)
//     → { results, screenshots, interactions }
//       results:      one per page_loads / element_exists / text_present item (PLAN 5.4 shape)
//       screenshots:  { desktop: Buffer|null, mobile: Buffer|null }  (JPEG)
//       interactions: one { result, shot } per "interaction" item (interaction.js), shot = page after the steps
//
// "visual" and "speed_score" items are NOT handled here (visual.js and speed.js do those).
// It never throws: any problem becomes an UNSURE result.
import { chromium } from 'playwright';
import { checkInteractionItem } from './interaction.js';

export const WEBSITE_KINDS = ['page_loads', 'element_exists', 'text_present'];

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};
const NAV_TIMEOUT_MS = 20000;
const MAX_SCREENSHOT_BYTES = 300 * 1024;

const result = (item, idx, status, reasoning, confidence = 1.0) => ({
  itemId: String(item._id ?? idx),
  status,
  confidence,
  reasoning,
  evidence: { screenshots: [], logUrl: null },
});

// Open a URL. Returns { status, error } (status = HTTP code, or null if it never loaded).
async function open(page, url) {
  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    // Give client-side apps (React etc.) a moment to render, but don't wait forever.
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    return { status: response ? response.status() : null, error: null };
  } catch (err) {
    return { status: null, error: err.message.split('\n')[0] };
  }
}

// Full-page JPEG; falls back to just the visible screen if the full page is too big.
async function screenshot(page) {
  try {
    let shot = await page.screenshot({ type: 'jpeg', quality: 60, fullPage: true });
    if (shot.length > MAX_SCREENSHOT_BYTES) shot = await page.screenshot({ type: 'jpeg', quality: 60 });
    return shot;
  } catch {
    return null;
  }
}

const loaded = (s) => s.status !== null && s.status >= 200 && s.status < 400;

// ---------- the three checks ----------

// Paths in the checklist are relative to the SUBMITTED page, not the domain root.
// So for https://h.github.io/demo/good/ :
//   "/"      → https://h.github.io/demo/good/        (the submitted page itself)
//   "/about" → https://h.github.io/demo/good/about
// Returns null if the path would lead to another site.
export function resolvePagePath(baseUrl, path = '/') {
  const rest = String(path).trim().replace(/^\/+/, '');
  if (!rest) return baseUrl;
  const base = new URL(baseUrl);
  base.search = '';
  base.hash = '';
  // "…/good" (a folder without the final slash) → "…/good/", but keep "…/index.html" as a file.
  const lastPart = base.pathname.split('/').pop();
  if (lastPart && !lastPart.includes('.')) base.pathname += '/';
  const target = new URL(rest, base);
  return target.origin === base.origin ? target.href : null;
}

const offSite = (item, idx) => result(item, idx, 'UNSURE', `The page "${item.params?.path}" is not on the submitted site.`, 0);

async function checkPageLoads(context, baseUrl, main, item, idx) {
  const target = resolvePagePath(baseUrl, item.params?.path || '/');
  if (!target) return offSite(item, idx);
  const sameAsMain = target === baseUrl;

  let res = main.desktop;
  if (!sameAsMain) {
    const page = await context.desktop.newPage();
    res = await open(page, target);
    await page.close();
  }
  if (res.error) return result(item, idx, 'UNSURE', `Could not open ${target}: ${res.error}`, 0);
  if (res.status >= 200 && res.status < 300) return result(item, idx, 'PASS', `${target} loaded (HTTP ${res.status}).`);
  return result(item, idx, 'FAIL', `${target} returned HTTP ${res.status}.`);
}

async function checkElement(pages, item, idx) {
  const selector = item.params?.selector;
  try {
    const desktop = await pages.desktop.locator(selector).count();
    const mobile = await pages.mobile.locator(selector).count();
    if (desktop > 0) {
      return result(item, idx, 'PASS', `Found ${desktop} element(s) matching ${selector} on desktop${mobile > 0 ? ' and mobile' : ', but not on mobile'}.`);
    }
    return result(item, idx, 'FAIL', `No element matches ${selector} on the page.`);
  } catch (err) {
    return result(item, idx, 'UNSURE', `Selector ${selector} could not be checked: ${err.message.split('\n')[0]}`, 0);
  }
}

async function checkText(pages, item, idx) {
  const text = item.params?.text;
  const visibleOn = async (page) => {
    const matches = page.getByText(text); // case-insensitive, matches part of the text
    const n = Math.min(await matches.count(), 10);
    for (let i = 0; i < n; i++) if (await matches.nth(i).isVisible()) return true;
    return false;
  };
  try {
    const desktop = await visibleOn(pages.desktop);
    const mobile = await visibleOn(pages.mobile);
    if (desktop || mobile) {
      const where = desktop && mobile ? 'desktop and mobile' : desktop ? 'desktop only' : 'mobile only';
      return result(item, idx, 'PASS', `The text "${text}" is visible (${where}).`);
    }
    return result(item, idx, 'FAIL', `The text "${text}" is not visible on the page.`);
  } catch (err) {
    return result(item, idx, 'UNSURE', `Could not look for the text "${text}": ${err.message.split('\n')[0]}`, 0);
  }
}

// ---------- main entry ----------

/** @param {object} job  needs: submissionUrl (website URL), items[] */
export async function checkWebsiteJob(job) {
  const all = (job.items || []).map((item, idx) => ({ item, idx }));
  const items = all.filter(({ item }) => WEBSITE_KINDS.includes(item.kind));
  const interactionItems = all.filter(({ item }) => item.kind === 'interaction');
  const screenshots = { desktop: null, mobile: null };
  const unsureAll = (why) => ({
    results: [...items, ...interactionItems].map(({ item, idx }) => result(item, idx, 'UNSURE', why, 0)),
    screenshots,
    interactions: [],
  });

  let url;
  try {
    url = new URL(job.submissionUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    return unsureAll(`Not a valid website URL: ${job.submissionUrl}`);
  }

  let browser;
  try {
    browser = await chromium.launch();
    const context = {
      desktop: await browser.newContext(VIEWPORTS.desktop),
      mobile: await browser.newContext(VIEWPORTS.mobile),
    };
    const pages = { desktop: await context.desktop.newPage(), mobile: await context.mobile.newPage() };

    // Open the submitted page once per viewport and take the screenshots.
    const main = {};
    for (const view of ['desktop', 'mobile']) {
      main[view] = await open(pages[view], url.href);
      if (loaded(main[view])) screenshots[view] = await screenshot(pages[view]);
    }

    // Items with params.path check another page of the site (e.g. "/jobs/new").
    // Each extra page is opened once per viewport and shared by every item on it.
    const extra = new Map();
    async function pagesAt(target) {
      if (target === url.href) return { pages, main };
      if (!extra.has(target)) {
        const p = { desktop: await context.desktop.newPage(), mobile: await context.mobile.newPage() };
        extra.set(target, { pages: p, main: { desktop: await open(p.desktop, target), mobile: await open(p.mobile, target) } });
      }
      return extra.get(target);
    }

    const results = [];
    for (const { item, idx } of items) {
      if (item.kind === 'page_loads') {
        results.push(await checkPageLoads(context, url.href, main, item, idx));
        continue;
      }
      const target = resolvePagePath(url.href, item.params?.path || '/');
      if (!target) {
        results.push(offSite(item, idx));
        continue;
      }
      const at = await pagesAt(target);
      let r;
      if (!loaded(at.main.desktop)) {
        const why = at.main.desktop.error ? `could not open it: ${at.main.desktop.error}` : `HTTP ${at.main.desktop.status}`;
        // Page is down or erroring: the element/text can't be there.
        r = result(item, idx, at.main.desktop.error ? 'UNSURE' : 'FAIL', `The page did not load (${why}).`, at.main.desktop.error ? 0 : 1);
      } else if (item.kind === 'element_exists') {
        r = await checkElement(at.pages, item, idx);
      } else {
        r = await checkText(at.pages, item, idx);
      }
      if (target !== url.href) r.reasoning += ` Page checked: ${target}`;
      results.push(r);
    }

    // Interaction items: same browser (no second Chrome in 512 MB), free the main tabs first.
    const interactions = [];
    if (interactionItems.length) {
      await context.desktop.close().catch(() => {});
      await context.mobile.close().catch(() => {});
      for (const { item, idx } of interactionItems) {
        const target = resolvePagePath(url.href, item.params?.path || '/');
        interactions.push(target ? await checkInteractionItem(browser, target, item, idx) : { result: offSite(item, idx), shot: null });
      }
    }
    return { results, screenshots, interactions };
  } catch (err) {
    return unsureAll(`Website check failed: ${err.message.split('\n')[0]}`);
  } finally {
    await browser?.close().catch(() => {}); // always free the memory
  }
}
