// Run from the server folder:
//   node scripts/test-interaction.js <URL> "<what must be true after>" "<steps a user does>" [desktop|mobile]
// Prints the result and saves the "after" screenshot to your temp folder. No database, no PayPal.
// Example:
//   node scripts/test-interaction.js https://shrink-this.vercel.app "A QR code is shown after shortening a link" "Paste a long link into the URL box and click Shrink It"
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { checkInteractionItem } from '../src/checkers/interaction.js';

const [url, requirement, steps, viewport = 'desktop'] = process.argv.slice(2);
if (!url || !requirement || !steps) {
  console.log('Usage: node scripts/test-interaction.js <URL> "<what must be true after>" "<steps>" [desktop|mobile]');
  process.exit(1);
}

const item = { text: requirement, kind: 'interaction', params: { steps, viewport }, weight: 100 };
const started = Date.now();
const browser = await chromium.launch();
try {
  const { result, shot } = await checkInteractionItem(browser, url, item, 0);
  console.log(`${result.status} (${Math.round(result.confidence * 100)}% sure)`);
  console.log(result.reasoning);
  if (shot) {
    const file = join(tmpdir(), 'veriflow-interaction-after.jpg');
    await writeFile(file, shot);
    console.log(`after screenshot: ${Math.round(shot.length / 1024)} KB → ${file}`);
  } else {
    console.log('after screenshot: none');
  }
} finally {
  await browser.close();
}
console.log(`(${Date.now() - started} ms)`);
