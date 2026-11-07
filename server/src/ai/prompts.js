// All prompts in one place, so they are easy to tune.

const KIND_HELP = {
  code: `
- "tests_pass": all automated tests (GitHub Actions) on the pull request must succeed. params: {}
- "files_changed": which files the pull request must or must not change.
  params: { "mustTouch": ["src/login.js"], "mustNotTouch": ["src/db/"] }  (a path ending in "/" means a whole folder)`,
  website: `
- "page_loads": a page returns HTTP 200. params: { "path": "/" }
- "element_exists": a CSS selector is present. params: { "selector": "input[type=email]" }
- "text_present": some visible text is on the page. params: { "text": "Sign up" }
- "visual": a subjective look-and-feel requirement judged from a screenshot. params: { "viewport": "mobile" } or { "viewport": "desktop" }
- "speed_score": Google PageSpeed performance score at least min. params: { "min": 80 }`,
};

export function checklistPrompt(job) {
  return `You turn a freelance job description into a verification checklist for an escrow service.
Money is released to the worker only when the checklist passes, so every item must be objective and checkable.

JOB
Title: ${job.title || '(none)'}
Type: ${job.type}
${job.repoUrl ? `Repository: ${job.repoUrl}\n` : ''}Description:
"""
${job.description}
"""

ALLOWED ITEM KINDS for a ${job.type} job (use ONLY these):${KIND_HELP[job.type]}

RULES
1. Cover every requirement in the description. Do not invent requirements that are not there.
2. Prefer exact checks. Use "visual" only for subjective things (looks good on mobile, matches colors, layout not broken).
${job.type === 'code' ? '3. Include exactly one "tests_pass" item. If the description says some code must not be changed, use "files_changed" with "mustNotTouch".\n' : '3. Start with a "page_loads" item for the main page.\n'}4. Between 2 and 6 items. Each "text" is one short sentence a non-technical buyer understands.
5. "weight" = how important the item is. Whole numbers that add up to 100. The most important requirement gets the most weight.

Reply with JSON only, in exactly this shape:
{ "items": [ { "text": "...", "kind": "...", "params": { }, "weight": 0 } ] }`;
}

export function judgePrompt(itemText, viewport = 'desktop') {
  return `You are a strict but fair reviewer checking delivered website work for an escrow service.
The screenshot(s) show the website on a ${viewport} screen.

Requirement to check:
"${itemText}"

Decide only from what is visible in the screenshot(s).
- "PASS" if the requirement is clearly met.
- "FAIL" if it is clearly not met.
- "UNSURE" if the screenshot does not show enough to decide.
"confidence" is how sure you are, from 0 to 1.
"reasoning" is one or two short sentences describing what you saw.

Reply with JSON only:
{ "status": "PASS" | "FAIL" | "UNSURE", "confidence": 0.0, "reasoning": "..." }`;
}
