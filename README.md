# Veriflow

**Escrow where AI checks the delivered work, and PayPal releases the money only when the work meets the agreed requirements.**

Built for the PayPal AI Hackathon by team 3Bit-Crew.

- Live app: https://veriflow-web-f4u1.onrender.com
- API: https://veriflow-api-wzi0.onrender.com/api/health

The live app runs on Render's free plan, which sleeps when idle. The first request can take about a minute.

## The problem

When you hire someone online, one side has to trust first. If the buyer pays first, the worker might not deliver. If the worker delivers first, the buyer might not pay. Today a person checks the work and settles disputes, which is slow and often unfair.

## How Veriflow works

1. **Agree.** The buyer describes the job in plain English. AI turns it into a checklist with a weight for each item. The buyer edits and approves it. The checklist is the contract.
2. **Hold.** The buyer approves the payment on PayPal. The money is authorized (held), not charged.
3. **Prove.** The worker submits a GitHub pull request or a website URL. Checkers gather evidence for every checklist item.
4. **Release.** A fixed rule decides the payout from the results, and PayPal captures or cancels the hold.

### What gets checked

| Job type | Check | How |
|---|---|---|
| Code | Tests pass | GitHub Actions results on the pull request (GitHub API) |
| Code | Files changed | Which files the pull request must or must not touch (GitHub API) |
| Website | Page loads, element exists, text present | A real browser opens the site (Playwright) |
| Website | Visual check | AI judges desktop and mobile screenshots (Gemini) |
| Website | Speed score | Google PageSpeed Insights |

### The payout rule

The AI never moves money. It only reports a result and a confidence for each item. The payout comes from this rule in [server/src/decision.js](server/src/decision.js):

| Result | What happens |
|---|---|
| Any item is unsure, or confidence is below 0.7 | A person decides the payout. The money stays held. |
| Every item passes | Full payment to the worker |
| Some items fail on the first try | The money stays held and the worker gets one chance to fix and resubmit |
| Some items still fail on the second try | Partial payment for the items that passed. The rest goes back to the buyer. |
| Nothing passes on the second try | The hold is cancelled. The buyer pays nothing. |

Every step is written to an audit log that is shown on the job page.

## Tech stack

| Part | Tools |
|---|---|
| Frontend | React 19, Vite, React Router, PayPal JS SDK (`@paypal/react-paypal-js`) |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB Atlas |
| Payments | PayPal Orders API v2 in the sandbox: authorize, capture, void |
| AI | Google Gemini (checklists and screenshot judging), Groq as a text backup |
| Checkers | GitHub REST API, Playwright (Chromium), PageSpeed Insights |
| Hosting | Render: Docker web service for the API, static site for the frontend |

## How PayPal is used

- `POST /v2/checkout/orders` with `intent: AUTHORIZE` creates the hold, with the worker as payee.
- `POST /v2/checkout/orders/{id}/authorize` locks the hold after the buyer approves.
- `POST /v2/payments/authorizations/{id}/capture` pays the worker the amount the checklist earned. The rest of the hold is released.
- `POST /v2/payments/authorizations/{id}/void` cancels the hold when nothing passed.
- Each capture and void carries a `PayPal-Request-Id`, so a retry never pays twice.

The code is in [server/src/paypal/](server/src/paypal/).

## Run it locally

You need Node.js 22 or newer, a MongoDB database (a free Atlas cluster works), a PayPal developer account, and a Gemini API key.

### 1. Backend

```bash
cd server
npm install
npx playwright install chromium
cp .env.example .env
```

Fill in `server/.env`:

| Variable | Value |
|---|---|
| `MONGODB_URI` | Your MongoDB connection string |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | From a sandbox app at developer.paypal.com |
| `GEMINI_API_KEY` | From Google AI Studio |
| `GROQ_API_KEY` | Optional. Text backup when Gemini is busy. |
| `GITHUB_TOKEN` | Optional. Raises the GitHub API rate limit. |
| `PAGESPEED_API_KEY` | Optional. Raises the PageSpeed quota. |
| `CHECKER_LOOP` | `true` to check submitted work on this machine. Only one server per database should run it. |
| `DNS_SERVERS` | Optional. Set to `8.8.8.8,1.1.1.1` if MongoDB fails with `querySrv ECONNREFUSED`. |

```bash
npm run dev
```

The API runs on http://localhost:5000. Open http://localhost:5000/api/health to check it.

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env
```

Fill in `client/.env`:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `http://localhost:5000` |
| `VITE_PAYPAL_CLIENT_ID` | The same PayPal Client ID as the server. Never the secret. |
| `VITE_USE_FAKE_API` | `false`. Set to `true` to try the pages with sample data and no server. |

```bash
npm run dev
```

The app runs on http://localhost:5173.

### 3. PayPal sandbox accounts

Everything runs in the PayPal sandbox, so no real money moves. Create the accounts at developer.paypal.com under Testing Tools, Sandbox Accounts.

- **Worker:** enter a sandbox **business** account email when you create a job.
- **Buyer:** log in to the PayPal window with a different sandbox **personal** account.
- A real email address as the worker is refused by PayPal.
- PayPal only lets an app cancel a hold whose payee is the app's own business account. To test a full refund, use that account as the worker.

### 4. Try a job

1. Create a job, let the AI write the checklist, and approve it.
2. Hold the payment with the sandbox buyer account.
3. Open the job's submit page and send a pull request URL or a website URL.
4. Watch the checklist fill in on the job page.

For code jobs, the repository needs a GitHub Actions workflow that runs on pull requests. Without one there are no tests to read, and the job goes to a person for review.

## Test scripts

Run these from the `server` folder.

| Script | What it checks |
|---|---|
| `node scripts/test-decision.js` | Every case of the payout rule. No network needed. |
| `node scripts/test-checklist.js` | AI checklist generation |
| `node scripts/test-github.js <PR URL>` | The pull request checker |
| `node scripts/test-website.js <URL>` | The website checker. Saves two screenshots. |
| `node scripts/test-judge.js <image> "<requirement>"` | The AI screenshot judge |
| `node scripts/smoke-test.js <API URL> [web URL]` | A deployed server. Read-only. |
| `node scripts/paypal-test.js` | The PayPal hold, capture and void flow in the sandbox |

## Deploy

[render.yaml](render.yaml) is a Render Blueprint that creates both services. In Render choose New, Blueprint, pick this repository, and enter the values it asks for. After the first deploy:

- set `CLIENT_URL` on the API to the frontend's URL,
- set `VITE_API_URL` on the frontend to the API's URL, then redeploy the frontend.

The API uses [server/Dockerfile](server/Dockerfile), which starts from the official Playwright image so Chromium is available. The image tag must match the Playwright version in `server/package-lock.json`.

## Project layout

```
client/            React app (Vite)
  src/pages/       Landing, NewJob, Submit, JobStatus, Dashboard
  src/components/  PayPal button, checklist editor and view
server/
  src/ai/          Gemini and Groq calls, prompts, checklist rules
  src/checkers/    GitHub, website, visual and speed checkers, and the checker loop
  src/paypal/      PayPal client, orders, settlement
  src/routes/      REST API
  src/decision.js  The payout rule
  scripts/         Test scripts
PLAN.md            Team plan and the shared contracts between the three parts
render.yaml        Render Blueprint
```

## Limitations

- PayPal sandbox only.
- There are no user accounts. Anyone with the link can open and act on a job.
- The worker gets one resubmit per job.
- Code jobs rely on the repository's own GitHub Actions tests.

## License

[MIT](LICENSE)
