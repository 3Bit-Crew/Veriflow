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

// Short, readable reason for an AI failure. These end up on the job page, so no raw JSON.
export function friendlyAiError(err) {
  const m = String(err?.message || err || '');
  if (err?.status === 429 || /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(m)) {
    return 'the AI service hit its usage limit';
  }
  if (err?.status === 503 || /503|UNAVAILABLE|overloaded|high demand/i.test(m)) return 'the AI service is overloaded';
  if (err?.status === 504 || /504|DEADLINE_EXCEEDED|timed? ?out|aborted/i.test(m)) return 'the AI service took too long to answer';
  if (/not valid JSON|Empty AI reply|Bad status/i.test(m)) return 'the AI gave an answer we could not read';
  if (/API_KEY is missing/i.test(m)) return m;
  // Unknown: first line only, without any JSON body
  return m.split('\n')[0].replace(/\{.*$/s, '').trim().slice(0, 120) || 'unknown AI error';
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
  console.error('[ai] generateJSON failed:', lastError?.message);
  throw new Error(`AI failed: ${friendlyAiError(lastError)}`);
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
    } catch (err) {
      // Busy / out of quota: gemini.js already tried every model, a retry would only double the wait.
      if (isBusy(err)) throw err;
      reply = parseJSON(await geminiImages(prompt, images)); // one retry for an unreadable answer
    }

    const status = String(reply.status || '').toUpperCase();
    if (!STATUSES.includes(status)) throw new Error(`Bad status in AI reply: ${reply.status}`);
    let confidence = Number(reply.confidence);
    if (!Number.isFinite(confidence)) confidence = 0;
    confidence = Math.min(1, Math.max(0, confidence));
    const reasoning = String(reply.reasoning || '').trim() || 'No reasoning given';

    return { status, confidence, reasoning };
  } catch (err) {
    console.error('[ai] judgeImages failed:', err?.message);
    return {
      status: 'UNSURE',
      confidence: 0,
      reasoning: `Could not check this automatically because ${friendlyAiError(err)}. A person should look at the screenshot.`,
    };
  }
}
