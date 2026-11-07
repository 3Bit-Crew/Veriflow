// Raw Gemini calls. Only ai/index.js should import this file.
import { GoogleGenAI } from '@google/genai';

// gemini-3.5-flash was fast and available in testing (Nov 6); 3.8-flash was often overloaded.
const DEFAULT_MODEL = 'gemini-3.5-flash';
// Used when the main model is overloaded (503), rate-limited (429) or too slow (504).
const DEFAULT_FALLBACK_MODEL = 'gemini-3.8-flash';
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

// Call the main model; if it's busy, try the fallback model once.
async function generate(contents, baseConfig) {
  const config = { ...baseConfig, httpOptions: { timeout: TIMEOUT_MS } };
  const main = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  try {
    const response = await getClient().models.generateContent({ model: main, contents, config });
    return response.text;
  } catch (err) {
    if (!isBusy(err) || fallback === main) throw err;
    console.warn(`[ai] ${main} busy, trying ${fallback}`);
    const response = await getClient().models.generateContent({ model: fallback, contents, config });
    return response.text;
  }
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
