// Raw Gemini calls. Only ai/index.js should import this file.
import { GoogleGenAI } from '@google/genai';

// gemini-3.5-flash was fast and available in testing (Nov 6).
const DEFAULT_MODEL = 'gemini-3.5-flash';
// Tried in order when a model is overloaded (503), out of quota (429) or too slow (504).
// The lite models have their own (bigger) free quotas and answered in 2–5s on Nov 11.
// gemini-3.8-flash is NOT used: on the free tier it allows only 20 requests a day and often timed out.
// GEMINI_FALLBACK_MODEL can override the list, comma-separated.
const DEFAULT_FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const TIMEOUT_MS = 30000;

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing in server/.env');
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function isBusy(err) {
  return (
    err?.status === 429 ||
    err?.status === 503 ||
    err?.status === 504 ||
    /429|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED|timed? ?out|aborted|high demand|overloaded/i.test(
      err?.message || ''
    )
  );
}

function modelChain() {
  const main = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallbacks = process.env.GEMINI_FALLBACK_MODEL
    ? process.env.GEMINI_FALLBACK_MODEL.split(',').map((m) => m.trim()).filter(Boolean)
    : DEFAULT_FALLBACK_MODELS;
  return [...new Set([main, ...fallbacks])];
}

// Call the main model; while a model is busy or out of quota, try the next one in the chain.
async function generate(contents, baseConfig) {
  const config = { ...baseConfig, httpOptions: { timeout: TIMEOUT_MS } };
  const models = modelChain();
  let lastErr;
  for (const [i, model] of models.entries()) {
    try {
      const response = await getClient().models.generateContent({ model, contents, config });
      return response.text;
    } catch (err) {
      lastErr = err;
      if (!isBusy(err)) throw err;
      if (i < models.length - 1) console.warn(`[ai] ${model} busy or out of quota, trying ${models[i + 1]}`);
    }
  }
  throw lastErr;
}

// Detect PNG vs JPEG from the first bytes, so callers can pass any screenshot buffer.
function mimeTypeOf(buffer) {
  return buffer[0] === 0x89 && buffer[1] === 0x50 ? 'image/png' : 'image/jpeg';
}

// Text prompt → raw JSON text from the model.
export function geminiText(prompt) {
  return generate(prompt, { responseMimeType: 'application/json', temperature: 0.2 });
}

// Text prompt + images → raw JSON text from the model.
export function geminiImages(prompt, buffers) {
  const parts = [
    { text: prompt },
    ...buffers.map((buf) => ({
      inlineData: { mimeType: mimeTypeOf(buf), data: buf.toString('base64') },
    })),
  ];
  return generate(parts, { responseMimeType: 'application/json', temperature: 0 });
}
