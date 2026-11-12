// Run from the server folder:  node scripts/test-source-pr.js <buyer repo URL> <pull request URL>
// Checks the "source code delivered" item of a website job: the PR must be in the buyer's repo,
// open or merged, and change at least one file. Prints the commit that would be saved for the buyer.
//   node scripts/test-source-pr.js https://github.com/expressjs/express https://github.com/expressjs/express/pull/7593
import 'dotenv/config';
import { checkSourcePr } from '../src/checkers/github.js';

const [repoUrl, sourcePrUrl] = process.argv.slice(2);
if (!repoUrl || !sourcePrUrl) {
  console.log('Usage: node scripts/test-source-pr.js <buyer repo URL> <pull request URL>');
  process.exit(1);
}
const { result, sha } = await checkSourcePr({ repoUrl, sourcePrUrl }, { _id: 'source' }, 0);
console.log(`${result.status} (${Math.round(result.confidence * 100)}%): ${result.reasoning}`);
if (sha) console.log(`Saved commit: ${sha}\nBrowse: ${result.evidence.logUrl}\nZIP:    ${repoUrl.replace(/\/$/, '')}/archive/${sha}.zip`);
