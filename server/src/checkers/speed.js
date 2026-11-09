// "speed_score" items (PLAN.md 5.3): Google PageSpeed Insights performance score (mobile).
// Pure function: no database. Never throws: problems become UNSURE.
//
//   checkSpeedItems(job) → results[] (one per speed_score item)
//
// Works without a key (low shared quota). Add PAGESPEED_API_KEY to server/.env for more.

const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

async function getScore(url) {
  const qs = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' });
  if (process.env.PAGESPEED_API_KEY) qs.set('key', process.env.PAGESPEED_API_KEY);
  const res = await fetch(`${API}?${qs}`, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`PageSpeed API error ${res.status}`);
  const data = await res.json();
  const score = data?.lighthouseResult?.categories?.performance?.score;
  if (typeof score !== 'number') throw new Error('PageSpeed returned no performance score');
  return Math.round(score * 100);
}

export async function checkSpeedItems(job) {
  const items = (job.items || []).map((item, idx) => ({ item, idx })).filter(({ item }) => item.kind === 'speed_score');
  if (items.length === 0) return [];

  let score = null;
  let error = null;
  try {
    score = await getScore(job.submissionUrl); // one API call shared by all speed items
  } catch (err) {
    error = err.message;
  }

  return items.map(({ item, idx }) => {
    const base = { itemId: String(item._id ?? idx), evidence: { screenshots: [], logUrl: null } };
    if (error) return { ...base, status: 'UNSURE', confidence: 0, reasoning: `Speed check failed: ${error}` };
    const min = Number(item.params?.min) || 80;
    return {
      ...base,
      status: score >= min ? 'PASS' : 'FAIL',
      confidence: 1.0,
      reasoning: `Mobile performance score is ${score} (needs at least ${min}).`,
    };
  });
}
