// Raw Groq call (text only). Only ai/index.js should import this file.
import Groq from 'groq-sdk';

const DEFAULT_MODEL = 'openai/gpt-oss-120b';

let client = null;
function getClient() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is missing in server/.env');
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

// Text prompt → raw JSON text from the model.
export async function groqText(prompt) {
  const completion = await getClient().chat.completions.create({
    model: process.env.GROQ_MODEL || DEFAULT_MODEL,
    messages: [
      { role: 'system', content: 'You reply with a single valid JSON object and nothing else.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  return completion.choices[0]?.message?.content ?? '';
}
