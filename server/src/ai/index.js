// The only public entry point for AI in Veriflow (PLAN.md 4.1 and 5.6).
// Everyone else calls generateJSON / judgeImages, never Gemini or Groq directly.
import { geminiText, geminiImages } from './gemini.js';
import { groqText } from './groq.js';

const MAX_IMAGES = 2;
const STATUSES = ['PASS', 'FAIL', 'UNSURE'];

// Turn a model reply into an object. Handles ```json fences and extra text around the JSON.
export function parseJSON(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty AI reply');
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(s.slice(start, end + 1));
    throw new Error('AI reply is not valid JSON');
  }
}

// Rate limit (429) or overloaded (503): worth switching to the backup provider.
function isBusy(err) {
  return (
    err?.status === 429 ||
    err?.status === 503 ||
    err?.status === 504 ||
    /429|503|504|rate.?limit|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED|timed? ?out|aborted|high demand|overloaded/i.test(
      err?.message || ''
    )
  );
}

function textProvider(name) {
  return name === 'groq' ? groqText : geminiText;
}

/**
 * Send a text prompt and get back a parsed JSON object.
 * Tries twice with the provider from AI_PROVIDER (gemini | groq).
 * If Gemini is rate-limited and a Groq key exists, switches to Groq.
 * Throws Error('AI failed: ...') if nothing works.
 * options.preferGroq: try Groq first when a Groq key exists (fast, text-only tasks like planning clicks).
 */
export async function generateJSON(prompt, { preferGroq = false } = {}) {
  const primary =
    (preferGroq && process.env.GROQ_API_KEY) || (process.env.AI_PROVIDER || 'gemini').toLowerCase() === 'groq'
      ? 'groq'
      : 'gemini';
  let provider = primary;
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await textProvider(provider)(prompt);
      return parseJSON(text);
    } catch (err) {
      lastError = err;
      if (provider === 'gemini' && isBusy(err) && process.env.GROQ_API_KEY) {
        console.warn('[ai] Gemini busy or rate-limited, switching to Groq');
        provider = 'groq';
      } else if (provider === 'groq' && preferGroq && process.env.GEMINI_API_KEY) {
        console.warn('[ai] Groq failed, switching to Gemini');
        provider = 'gemini';
      }
    }
  }
  throw new Error(`AI failed: ${lastError?.message || 'unknown error'}`);
}

/**
 * Show the AI up to 2 images and get a verdict.
 * Always uses Gemini. Never throws: any problem returns UNSURE.
 * @returns {Promise<{status: 'PASS'|'FAIL'|'UNSURE', confidence: number, reasoning: string}>}
 */
export async function judgeImages(prompt, buffers = []) {
  try {
    const images = buffers.filter(Buffer.isBuffer).slice(0, MAX_IMAGES);
    if (images.length === 0) throw new Error('No images given');

    let reply;
    try {
      reply = parseJSON(await geminiImages(prompt, images));
    } catch {
      reply = parseJSON(await geminiImages(prompt, images)); // one retry
    }

    const status = String(reply.status || '').toUpperCase();
    if (!STATUSES.includes(status)) throw new Error(`Bad status in AI reply: ${reply.status}`);
    let confidence = Number(reply.confidence);
    if (!Number.isFinite(confidence)) confidence = 0;
    confidence = Math.min(1, Math.max(0, confidence));
    const reasoning = String(reply.reasoning || '').trim() || 'No reasoning given';

    return { status, confidence, reasoning };
  } catch (err) {
    return { status: 'UNSURE', confidence: 0, reasoning: `AI error: ${err.message}` };
  }
}
