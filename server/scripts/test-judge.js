// Run from the server folder:
//   node scripts/test-judge.js <image path> "<requirement>" [desktop|mobile]
// Example:
//   node scripts/test-judge.js ./shot.png "There is a visible Sign up button" mobile
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { judgeImages } from '../src/ai/index.js';
import { judgePrompt } from '../src/ai/prompts.js';

const [imagePath, requirement, viewport = 'desktop'] = process.argv.slice(2);
if (!imagePath || !requirement) {
  console.log('Usage: node scripts/test-judge.js <image path> "<requirement>" [desktop|mobile]');
  process.exit(1);
}

const image = await readFile(imagePath);
const result = await judgeImages(judgePrompt(requirement, viewport), [image]);
console.log(result);
