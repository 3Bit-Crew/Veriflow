// Run from the server folder:
//   node scripts/test-website.js <URL> [--text="Some text"] [--selector="css"] [--path=/other]
// Prints the results and saves the 2 screenshots to your temp folder.
// Example:
//   node scripts/test-website.js https://example.com --text="Example Domain" --selector="h1"
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkWebsiteJob } from '../src/checkers/website.js';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3).replace(/^"|"$/g, '') : fallback;
};
if (!url) {
  console.log('Usage: node scripts/test-website.js <URL> [--text="..."] [--selector="..."] [--path=/...]');
  process.exit(1);
}

const job = {
  type: 'website',
  submissionUrl: url,
  items: [
    { text: 'Main page loads', kind: 'page_loads', params: { path: '/' }, weight: 25 },
    { text: 'Second page loads', kind: 'page_loads', params: { path: flag('path', '/') }, weight: 25 },
    { text: 'Element exists', kind: 'element_exists', params: { selector: flag('selector', 'a') }, weight: 25 },
    { text: 'Text is shown', kind: 'text_present', params: { text: flag('text', 'Example') }, weight: 25 },
    { text: 'Looks good on mobile', kind: 'visual', params: { viewport: 'mobile' }, weight: 0 }, // skipped here
  ],
};

const started = Date.now();
const { results, screenshots } = await checkWebsiteJob(job);
results.forEach((r) => console.log(`[${job.items[Number(r.itemId)].kind}]`, r.status, `(${r.confidence}) -`, r.reasoning));

for (const [view, buf] of Object.entries(screenshots)) {
  if (!buf) {
    console.log(`${view} screenshot: none`);
    continue;
  }
  const file = join(tmpdir(), `veriflow-${view}.jpg`);
  await writeFile(file, buf);
  console.log(`${view} screenshot: ${Math.round(buf.length / 1024)} KB → ${file}`);
}
console.log(`(${Date.now() - started} ms)`);
