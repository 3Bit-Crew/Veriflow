// "visual" items (PLAN.md 5.3): the AI judges a screenshot taken by website.js.
// Pure function: no database.
//
//   checkVisualItems(job, screenshots) → results[] (one per visual item, PLAN 5.4 shape)
//     screenshots = { desktop: Buffer|null, mobile: Buffer|null } from checkWebsiteJob()
//
// Never throws: judgeImages() already turns AI errors into UNSURE.
import { judgeImages } from '../ai/index.js';
import { judgePrompt } from '../ai/prompts.js';

export async function checkVisualItems(job, screenshots = {}) {
  const results = [];
  const items = (job.items || []).map((item, idx) => ({ item, idx })).filter(({ item }) => item.kind === 'visual');

  for (const { item, idx } of items) {
    const viewport = item.params?.viewport === 'desktop' ? 'desktop' : 'mobile';
    const shot = screenshots[viewport];
    const base = { itemId: String(item._id ?? idx), evidence: { screenshots: [], logUrl: null } };

    if (!shot) {
      results.push({ ...base, status: 'UNSURE', confidence: 0, reasoning: `No ${viewport} screenshot (the page did not load).` });
      continue;
    }
    // One at a time: keeps us inside the free AI rate limits.
    const verdict = await judgeImages(judgePrompt(item.text, viewport), [shot]);
    results.push({ ...base, ...verdict });
  }
  return results;
}
