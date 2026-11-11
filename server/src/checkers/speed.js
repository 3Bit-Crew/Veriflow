// Google Lighthouse scores through the PageSpeed Insights API (mobile), PLAN.md 5.3 and 13.2:
//   "speed_score"      → the performance score       params: { min }
//   "lighthouse_score" → accessibility, best-practices or seo score   params: { category, min }
// One API call per job asks for every category the checklist needs.
// Pure function: no database. Never throws: problems become UNSURE.
//
//   checkSpeedItems(job) → results[] (one per speed_score / lighthouse_score item)
//
// Needs PAGESPEED_API_KEY: without it Google's shared quota is almost always used up (tested Nov 11).

const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const KINDS = ['speed_score', 'lighthouse_score'];
export const LIGHTHOUSE_CATEGORIES = ['accessibility', 'best-practices', 'seo'];
const LABELS = { performance: 'performance', accessibility: 'accessibility', 'best-practices': 'best practices', seo: 'SEO' };
const TIMEOUT_MS = 90000; // asking for 4 categories took ~13s on Nov 11; Google can be slow
const MAX_PROBLEMS = 3; // failing Lighthouse audits named in the reasoning

const categoryOf = (item) => (item.kind === 'speed_score' ? 'performance' : item.params?.category);
const defaultMin = (category) => (category === 'performance' ? 80 : 90);

// One call → { scores: { performance: 99, seo: 82, ... }, problems: { seo: ['Document does not have a meta description', ...] } }
async function getScores(url, categories) {
  const qs = new URLSearchParams({ url, strategy: 'mobile' });
  for (const c of categories) qs.append('category', c);
  if (process.env.PAGESPEED_API_KEY) qs.set('key', process.env.PAGESPEED_API_KEY);

  const res = await fetch(`${API}?${qs}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    if (res.status === 429) throw new Error('the PageSpeed daily quota is used up (is PAGESPEED_API_KEY set?)');
    throw new Error(`PageSpeed API error ${res.status}`);
  }
  const data = await res.json();
  const lh = data?.lighthouseResult;
  const scores = {};
  const problems = {};
  for (const c of categories) {
    const cat = lh?.categories?.[c];
    if (typeof cat?.score !== 'number') continue;
    scores[c] = Math.round(cat.score * 100);
    // The audits that cost points, most important first, so the buyer and worker see what to fix.
    problems[c] = (cat.auditRefs || [])
      .filter((ref) => ref.weight > 0)
      .map((ref) => ({ ref, audit: lh.audits?.[ref.id] }))
      .filter(({ audit }) => audit && typeof audit.score === 'number' && audit.score < 0.9)
      .sort((a, b) => b.ref.weight - a.ref.weight)
      .slice(0, MAX_PROBLEMS)
      .map(({ audit }) => String(audit.title).replace(/\.+$/, ''));
  }
  return { scores, problems };
}

export async function checkSpeedItems(job) {
  const items = (job.items || []).map((item, idx) => ({ item, idx })).filter(({ item }) => KINDS.includes(item.kind));
  if (items.length === 0) return [];

  const categories = [...new Set(items.map(({ item }) => categoryOf(item)).filter(Boolean))];
  let result = null;
  let error = null;
  try {
    result = await getScores(job.submissionUrl, categories); // one API call shared by all these items
  } catch (err) {
    error = err.name === 'TimeoutError' ? 'PageSpeed took too long to answer' : err.message;
  }
  const report = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(job.submissionUrl)}&form_factor=mobile`;

  return items.map(({ item, idx }) => {
    const base = { itemId: String(item._id ?? idx), evidence: { screenshots: [], logUrl: report } };
    const category = categoryOf(item);
    const label = LABELS[category] || category;
    if (error) return { ...base, status: 'UNSURE', confidence: 0, reasoning: `Lighthouse check failed: ${error}.` };

    const score = result.scores[category];
    if (typeof score !== 'number') {
      return { ...base, status: 'UNSURE', confidence: 0, reasoning: `Lighthouse returned no ${label} score for this page.` };
    }
    const raw = Number(item.params?.min);
    const min = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : defaultMin(category);
    const passed = score >= min;
    const fixes = result.problems[category] || [];
    const name = category === 'performance' ? 'Mobile performance' : `Lighthouse ${label}`;
    return {
      ...base,
      status: passed ? 'PASS' : 'FAIL',
      confidence: 1.0,
      reasoning:
        `${name} score is ${score} (needs at least ${min}).` +
        (!passed && fixes.length ? ` Biggest problems: ${fixes.join('; ')}.` : ''),
    };
  });
}
