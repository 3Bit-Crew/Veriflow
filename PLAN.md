# Veriflow: Team Plan

**Veriflow** is a pay-on-proof escrow: money is released only after the work is verified.

**Hackathon:** PayPal AI Hackathon (Devpost)
**Deadline:** November 12, 2026, 12:00 PM Pacific (about 1:30 am IST on Nov 13). **We aim to submit on Nov 12, ~10 pm IST** (section 13).
**Team:** 3 people. Roles are in section 6.
**Stack:** MERN (MongoDB, Express, React, Node) + PayPal Sandbox + free Gemini / Groq AI key

> **How to read this:** sections 1–4 explain the project. **Section 5 is the contract between the three of us.** If your code matches section 5, it will fit with everyone else's. If you need to change section 5, tell the other two first and update this file.

> **Latest changes (Nov 11–12):**
> - **Payouts are all or nothing (5.5):** the worker is paid only when every item passes. A second try that still fails anything voids the hold ($0). Changing a protected file (for example the buyer's tests) voids it at once, even on the first try. Weights no longer split the money: they only say how much an item counts toward the score. The review box marks unsure items Pass or Fail: all Pass pays in full, any Fail pays $0. A hybrid rule is planned for after the hackathon (section 14).
> - **Tries are counted when the worker submits** (`POST /submit`), not when checking starts, so a server restart can't use up a try (5.5).
> - **New frontend design** with an AG Grid dashboard (filter chips, totals row, live cell flash, CSV export). The worker submits only on `/jobs/:id/submit`; the job page shows the worker link instead. Results that land together are shown about 1 second apart.
> - **Demo website is live** on GitHub Pages (10.1), and a **keep-awake ping** (GitHub Actions, every 10 minutes) stops the Render API from sleeping (11).
> - **New dates and final work plan in section 13:** code freeze **Nov 12, 4 pm IST**, submit by **Nov 12, ~10 pm IST**. These replace the Nov 11 dates in section 7. Section 13 also covers interaction checks, Lighthouse scores and the PageSpeed key.
> - **New demo:** the code job is now a **checkout coupon feature**, not the login bug. Section 10 has everything: what the demo repo and site contain, how to prepare, and the script. **B:** the demo repo runs each test as its own GitHub Actions job, so `github.js` names the failed tests (10.1). No code change needed.
> - **Worker email:** on Render, `POST /api/jobs` only accepts the sandbox worker account set in `PAYPAL_WORKER_EMAIL` (5.8). Use `sb-m8uku53787938@business.example.com`.
> - **No pushes to `main` while anyone is testing, recording or judging** (8.5). Every push redeploys Render.
> - The checker loop now re-queues stuck jobs every minute (5.6), and the client has a sample-data mode, `VITE_USE_FAKE_API` (8.3).

---

## 1. The idea in one line

> **Escrow where AI checks the delivered work, and PayPal releases the money only when the work meets the agreed requirements.**

### The problem
When you hire someone online, someone has to trust first:
- If the buyer pays first, the worker might not deliver.
- If the worker delivers first, the buyer might not pay.
- Today a human checks the work and settles disputes. That's slow, expensive, and often unfair.

This gets worse as **AI agents start hiring and paying other AI agents**, because no human is watching each deal.

### Our solution
1. The **buyer** describes the job in plain English.
2. **AI turns it into a checklist** that the buyer reviews and approves. The checklist is the contract.
3. The money is **held on PayPal** (authorized, not charged yet).
4. The **worker** submits work: a GitHub pull request or a website URL.
5. **Checkers** run real tests and gather evidence, and AI judges the subjective parts.
6. **PayPal pays out automatically:**
   - all checks pass → **full payment** to the worker
   - some checks fail on the **first try** → money stays held, worker gets **one chance to fix and resubmit**
   - any check still fails on the **second try** → **hold cancelled**: the worker gets nothing, the buyer pays nothing (all or nothing, no partial payouts)
   - the worker changes a file they must not touch (cheating) → **hold cancelled at once**, on any try, no resubmit
   - AI not confident → **sent to a human**, with a report of the evidence

### Demo moment
A worker's coupon feature PR comes in with two money bugs → **2 of 6 tests fail**, money stays held → the fixed PR comes in → checklist items turn green → **"$200 released via PayPal"** appears on screen. Full script in section 10.

---

## 2. Prizes we're aiming for

| Prize | Why we fit |
|---|---|
| **Grand prizes** ($12k / $8k / $5k) | New idea, real problem, strong demo |
| **Best Use of Agentic Commerce** ($5k) | AI agents can hire and pay other agents safely |
| **Best Use of PayPal + AI** ($5k) | AI checks the work and decides whether PayPal pays, from real evidence |
| **Best Demo Delivery** ($5k) | The live "money released" moment |
| **Best Use of AG Grid** ($5k / $2k / 3 × $1k) | Our dashboard is built with AG Grid (React) |
| **Best Use of Render** (credits) | Frontend and backend hosted on Render |

We are **not** building for Postman, APIMatic, Channel3, or Bryntum. Bryntum is a stretch goal only (section 9).
Use Postman **only** on day 1 to try PayPal's API collection.

---

## 3. What we build (scope)

### Must have (the project fails without these)
- [x] Create a job → AI generates a checklist → buyer edits and approves it
- [x] Buyer pays with the PayPal button → money **held** (authorized)
- [x] Worker submits a **GitHub PR** or a **website URL**
- [x] **Code checker:** reads the PR's test results from GitHub Actions and which files were changed
- [x] **Website checker:** Playwright opens the site, takes screenshots, and checks elements. AI reviews the screenshots.
- [x] **Decision engine:** full capture / one resubmit / void / needs review (section 5.5)
- [x] **Resubmit once** after a failed first try (the demo depends on it)
- [x] **Human review:** mark each unsure item Pass or Fail when a job is `NEEDS_REVIEW`. All Pass → paid in full, any Fail → hold cancelled.
- [x] **AG Grid dashboard:** jobs, checklist results, audit log
- [ ] Deployed on **Render**, working live with PayPal **Sandbox** (deployed; a full code job still has to pass live)
- [ ] Demo video + Devpost write-up

### Should have (if on schedule by day 4)
- [ ] **Agent API:** lets an AI agent post jobs, submit work, and check status using an API key (an MCP server too if time allows). This is our Agentic Commerce story.
- [x] PageSpeed `speed_score` check (plus Lighthouse scores, 13.2)
- [x] Nicer evidence report (screenshots side by side, test log link)

### Won't build (say "future work" in the pitch)
- Design and writing checkers, real money (live mode), user accounts with passwords, mobile app.
- Instead of accounts, we protect actions with **secret keys per job** (buyer key, worker link, admin key). See **5.10 Authentication**.

---

## 4. How it works (architecture)

```
 ┌──────────────────────────┐         ┌───────────────────────────────┐
 │  React app (Vite)        │  HTTP   │  Express server (Node)        │
 │  - Create job page       │ ──────▶ │  - REST API (jobs, payments)  │
 │  - PayPal button         │         │  - PayPal calls               │
 │  - Submit work page      │         │  - AI: checklist generator    │
 │  - Job status + review   │         │                               │
 │  - AG Grid dashboard     │         │  - Checker loop (same process)│
 │  Render: Static Site     │         │    · GitHub checker           │
 └──────────────────────────┘         │    · Playwright checker       │
                                      │    · AI vision judge          │
                                      │    · Decision → PayPal        │
                                      │  Render: Web Service (Docker) │
                                      └───────────────┬───────────────┘
                                                      │ Mongoose
                                                      ▼
                                      ┌───────────────────────────────┐
                                      │  MongoDB Atlas (free M0)      │
                                      │  jobs, events, screenshots    │
                                      └───────────────────────────────┘
```

**Why the checker runs inside the Express server:** Render's background workers are **not free**. So the server runs a small loop every 5 seconds that picks up `SUBMITTED` jobs and checks them. The checker code lives in its own folder, so it can be moved to a separate worker later.

### Tech stack
| Part | Tool |
|---|---|
| Frontend | **React** + **Vite** + React Router |
| Backend | **Node.js** + **Express** |
| Database | **MongoDB Atlas** (free M0 cluster) + **Mongoose** |
| Payments | **PayPal Orders API v2** (Sandbox) + **@paypal/react-paypal-js** button |
| AI | **Google Gemini** free key (main, because it can read images) + **Groq** free key (backup for text). See 4.1. |
| Code checks | **GitHub API**: GitHub Actions check results + changed files on the PR |
| Website checks | **Playwright** (Chromium) + Google **PageSpeed Insights API** (free, should-have) |
| Dashboard | **AG Grid** Community edition (`ag-grid-react`, free) |
| Hosting | **Render**: Static Site (React) + Web Service with Docker (Express + Playwright) |

**Why read GitHub Actions results instead of running the code ourselves?** Running someone else's code on our server is unsafe and hard to do on Render. GitHub already runs the tests for free in its own sandbox, so we just read the result.

### 4.1 AI provider (Gemini or Groq)
We need AI for two jobs:
1. **Text → JSON:** turn the job description into a checklist. Both Gemini and Groq can do this.
2. **Images → judgment:** look at website screenshots and decide pass/fail. **Gemini** handles images well on the free tier. Groq has some vision models, but check what's currently available in the Groq console before relying on one.

**Decision:** use **Gemini (current Flash model)** for both. Use Groq only as a backup for **text** if we hit Gemini's free limits. `judgeImages` always uses Gemini.

All AI calls go through **one file**, `server/src/ai/index.js` (see 5.8). Nobody else calls the AI directly.

**Free-tier rules:**
- Free keys have **rate limits** (requests per minute and per day). Don't call AI in loops. Send at most 2 screenshots per check.
- **Cache** results while testing (save the AI response in MongoDB and reuse it) so we don't burn the daily limit.
- Each person should create **their own free key** for development. Use one shared key only on the deployed server.
- Always ask the AI for **JSON only**, and check it before saving. If it's invalid, retry once, then mark the item `UNSURE`.

---

## 5. Shared contracts (agree on these on day 1, then work in parallel)

**Nobody changes these without telling the other two.**

### 5.1 Job statuses
```
DRAFT → CHECKLIST_READY → FUNDED → SUBMITTED → CHECKING ─┬→ SETTLED            (full / void)
                                       ▲                 ├→ CHANGES_REQUESTED  (1st try failed, money still held)
                                       │                 │        │
                                       └─────────────────┼────────┘  worker resubmits
                                                         └→ NEEDS_REVIEW → (human decides) → SETTLED
```
| Status | Meaning | Set by | Where in code |
|---|---|---|---|
| `DRAFT` | Job created, no checklist yet | A | `POST /api/jobs` |
| `CHECKLIST_READY` | Buyer approved the checklist | A | `PUT /api/jobs/:id/checklist` |
| `FUNDED` | PayPal payment authorized (money held) | A | `POST /api/paypal/orders/:orderId/authorize` |
| `SUBMITTED` | Worker submitted a URL (1st or 2nd try) | A | `POST /api/jobs/:id/submit` |
| `CHECKING` | Checker loop is running checks | B | `checkers/loop.js` |
| `CHANGES_REQUESTED` | 1st try failed, worker can resubmit | B | `checkers/loop.js` |
| `NEEDS_REVIEW` | AI not confident, waiting for a human | B | `checkers/loop.js` |
| `SETTLED` | PayPal capture or void done. Final. | A | `settleJob()` in `paypal/settle.js` |

**Only the code listed in "Where in code" may change a job to that status.** For example, B's loop never captures money itself. It calls A's `settleJob()`.

There's no separate `DECIDED` status. The decision and the PayPal call happen in one step inside `settleJob()`.

### 5.2 Database models (Mongoose), owned by A
Checklist items are stored **inside** the job document. Events and screenshots get their own collections.

```js
// server/src/models/Job.js
const ChecklistItemSchema = new Schema({
  text:       { type: String, required: true },   // "Signup form has an email field"
  kind:       { type: String, required: true },   // see 5.3
  params:     { type: Object, default: {} },      // settings for the checker, see 5.3
  weight:     { type: Number, required: true },   // whole numbers, all weights add up to 100
  status:     { type: String, default: 'PENDING' }, // PENDING | PASS | FAIL | UNSURE
  confidence: Number,                             // 0.0 – 1.0
  reasoning:  String,                             // why it passed or failed
  evidence:   { screenshots: [String], logUrl: String } // screenshots = Screenshot ids
});
// Each item gets an automatic _id. That _id (as a string) is the "itemId" everywhere.

const JobSchema = new Schema({
  title:         { type: String, required: true },
  description:   { type: String, required: true }, // buyer's plain-English request
  type:          { type: String, enum: ['code', 'website'], required: true },
  repoUrl:       String,                            // code jobs only: https://github.com/owner/repo
  amount:        { type: Number, required: true },  // e.g. 200 (USD)
  currency:      { type: String, default: 'USD' },
  buyerEmail:    String,                            // sandbox personal account
  workerEmail:   { type: String, required: true },  // sandbox business account (payee)
  status:        { type: String, default: 'DRAFT' },
  paypalOrderId: String,
  paypalAuthId:  String,
  submissionUrl: String,                            // PR URL (code) or website URL (website)
  attempts:      { type: Number, default: 0 },      // how many times the worker submitted (set by POST /submit)
  payoutAmount:  Number,                            // set when SETTLED
  settlement:    { type: String, enum: ['FULL', 'PARTIAL', 'VOID'] }, // set when SETTLED. The rule (5.5) gives only FULL or VOID; PARTIAL only comes from a human review payout
  items:         [ChecklistItemSchema]
}, { timestamps: true });

// server/src/models/Event.js  (audit log, shown in AG Grid)
const EventSchema = new Schema({
  jobId:   { type: Schema.Types.ObjectId, ref: 'Job', index: true },
  type:    String,   // one of the list in 5.7
  message: String,   // human-readable, shown in the grid
  data:    Object    // extra details, e.g. PayPal response ids
}, { timestamps: true });

// server/src/models/Screenshot.js
const ScreenshotSchema = new Schema({
  jobId:    { type: Schema.Types.ObjectId, ref: 'Job', index: true },
  viewport: { type: String, enum: ['desktop', 'mobile'] },
  data:     Buffer,  // JPEG, quality ~60, keep each under ~300KB
}, { timestamps: true });
```

**Screenshots** are stored in MongoDB (no extra account needed). The frontend shows one with:
`<img src={`${VITE_API_URL}/api/screenshots/${id}`} />`

### 5.3 Checklist item kinds
The AI may **only** use kinds allowed for the job's type. A's `PUT /checklist` route rejects anything else.

| `kind` | Job type | `params` | Checked by | Required? |
|---|---|---|---|---|
| `tests_pass` | code | `{}` (all GitHub Actions checks on the PR must succeed) | GitHub API | Must |
| `files_changed` | code | `{ "mustTouch": ["src/checkout.js"], "mustNotTouch": ["src/payment/"] }` | GitHub API | Must |
| `page_loads` | website | `{ "path": "/" }` | Playwright (status 200) | Must |
| `element_exists` | website | `{ "selector": "input[type=email]" }` | Playwright | Must |
| `text_present` | website | `{ "text": "Sign up" }` | Playwright | Must |
| `visual` | website | `{ "viewport": "mobile" }` (`desktop` or `mobile`) | AI vision on screenshot | Must |
| `speed_score` | website | `{ "min": 80 }` | PageSpeed Insights API | Should |
| `interaction` | website | `{ "steps": "Paste a long link and click Shrink It", "viewport": "desktop" }` (`viewport`: `desktop` or `mobile`; steps ≤ 300 characters) | Playwright + AI: plans clicks/typing, does them, judges before/after screenshots | Added Nov 11 (section 13.1) |
| `lighthouse_score` | website | `{ "category": "accessibility", "min": 90 }` (category: `accessibility`, `best-practices` or `seo`) | PageSpeed Insights API (Lighthouse) | Added Nov 11 (section 13.2) |

**Rules:**
- Use an exact check whenever possible. Use `visual` only for things like "looks good on mobile" or "matches the brand colors".
- Every code job must include exactly one `tests_pass` item.
- Weights are whole numbers and must add up to **100**. The route rejects the checklist otherwise.
- **A weight is how much an item counts toward the score**, shown as "Score 85%" on the job page. It does **not** split the money: payouts are all or nothing (5.5). The app shows no dollar amount per item.
- `mustTouch` / `mustNotTouch` paths: a path ending in `/` means "anything in that folder" (from the repo root). A path starting with `*` means "any file whose name ends with this", e.g. `*.test.js`.
- **Test protection (added automatically to every code job):** a `files_changed` item "The buyer's tests and CI setup were not modified" with `mustNotTouch: [".github/", "test/", "tests/", "__tests__/", "spec/", "*.test.js", "*.spec.js", "*.test.ts", "*.spec.ts"]`. This stops a worker from editing the tests to make them pass. If the job itself asks to change tests (a `mustTouch` on a test path), those paths are left out. The buyer can still delete the item in the editor.
- **`interaction` items** (details in 13.1):
  - Use them for anything that only appears after a user types or clicks (a QR code after "Shrink It", a message after submitting a form). `element_exists`, `text_present` and `visual` only see the page before anyone uses it.
  - At most **2 per checklist** (A's route rejects more).
  - The AI only writes them when the server has **`INTERACTION_CHECKS=true`** (8.3). Jobs that already have one are checked either way.
  - Each item takes **about 2 minutes at most** (hard limit), so a website job can take several minutes in total.
  - A step that can't be done (no matching button or field, login or captcha needed, timeout, AI error) gives **`UNSURE`, never `FAIL`**, so a person decides. Only the AI judging a page where every step worked can give `FAIL`.
- **Never invent CSS selectors.** Use `element_exists` only for standard HTML (`input[type=email]`, `form`, `img`) or a selector written in the job description.

### 5.4 Checker result (every checker returns this, one per item)
```json
{
  "itemId": "665f1c2e9a...",
  "status": "PASS",
  "confidence": 0.95,
  "reasoning": "Email input found at input#email on desktop and mobile.",
  "evidence": { "screenshots": ["665f1d..."], "logUrl": null }
}
```
- `status` is one of `PASS`, `FAIL`, `UNSURE`.
- Exact checks always return `confidence: 1.0`.
- **If a checker crashes or times out, it returns `UNSURE` with the error in `reasoning`. It never throws an error up to the loop.**
- **GitHub checks still running:** `checkCodeJob(job, { timedOut })` returns `null` if the PR's checks haven't finished (or haven't started). The loop puts the job back to `SUBMITTED` and tries again next round. After **5 minutes** of waiting, the loop calls it with `timedOut: true`, and still-running tests become `UNSURE`.
- **Checkers don't use the database.** `checkWebsiteJob(job)` returns `{ results, screenshots: { desktop, mobile }, interactions }` (JPEG buffers; `interactions` is one `{ result, shot }` per `interaction` item). `loop.js` saves the screenshots as `Screenshot` documents and puts their ids in `evidence.screenshots`.

### 5.5 Decision rule (`server/src/decision.js`, owned by B)
B's loop runs this after all items are checked, then acts on the result.

**All or nothing:** the worker is paid only when every item passes. There are no partial payouts.

```
1. a files_changed item FAILED because a restricted file was changed (cheating) → settleJob(job, 0) → VOID, on any try, no resubmit
2. any item UNSURE, or any item has confidence < 0.7     → NEEDS_REVIEW
3. every item PASS                                       → settleJob(job, amount)  → FULL
4. job.attempts == 1  (this was the first try)           → CHANGES_REQUESTED  (money stays held)
5. otherwise (something still fails on the 2nd try)      → settleJob(job, 0)       → VOID
```
- `job.attempts` goes up by 1 each time the worker submits (`POST /api/jobs/:id/submit`), not when checking starts, so a server restart can't use up a try.
- Example: $200 job. On the 1st try one item fails → `CHANGES_REQUESTED`. On the 2nd try it still fails → $0, the hold is voided and the buyer keeps everything.
- Example: the PR changes `test/` when the checklist says it must not → voided at once, even on the 1st try.
- **Human review** (`NEEDS_REVIEW`) follows the same rule: the review box marks each unsure item Pass or Fail, then sends `payoutAmount` = the full amount (all Pass) or 0 (any Fail).
- After the hackathon we plan a **hybrid** rule ("required" items gate the payment, "work" items are paid by weight): section 14.

### 5.6 Shared functions (how A's and B's code connect)
| Function | File | Owner | Called by | What it does |
|---|---|---|---|---|
| `logEvent(jobId, type, message, data?)` | `server/src/events.js` | A | A and B | Saves an `Event`. **Everyone uses this for logging.** |
| `settleJob(job, amount)` | `server/src/paypal/settle.js` | A | B (loop), A (review route) | `amount > 0` → capture that amount with `final_capture: true`. `amount == 0` → void. Sets `payoutAmount`, `settlement`, `status = SETTLED`, logs the event. Returns the updated job. |
| `generateChecklist(job)` | `server/src/ai/checklist.js` | B | A (`POST /checklist` route) | Returns an array of items in the 5.2 shape (no `_id`, status `PENDING`). Weights sum to 100. Only allowed kinds. |
| `generateJSON(prompt)` | `server/src/ai/index.js` | B | B only | Returns a parsed JSON object |
| `judgeImages(prompt, buffers)` | `server/src/ai/index.js` | B | B only | Returns `{ status, confidence, reasoning }` |
| `startCheckerLoop()` | `server/src/checkers/loop.js` | B | A (`index.js`, once at startup) | Every 5s, checks one `SUBMITTED` job. Every minute, puts any job that has sat in `CHECKING` for more than **10 minutes** back to `SUBMITTED` (its server was restarted mid-check). Newer `CHECKING` jobs are left alone, because during a Render deploy the old server may still be checking them, and checking twice would count as two tries. |

**When A and B can't wait for each other:** A writes `settleJob` and `logEvent` first (day 2), and B uses a fake version (`console.log`) until then. B writes `generateChecklist` first (day 1–2), and A returns a hardcoded checklist until then.

### 5.7 Event types (use exactly these strings)
`JOB_CREATED`, `CHECKLIST_GENERATED`, `CHECKLIST_APPROVED`, `PAYPAL_ORDER_CREATED`, `PAYPAL_AUTHORIZED`, `WORK_SUBMITTED`, `CHECK_STARTED`, `CHECK_RESULT` (one per item), `CHANGES_REQUESTED`, `REVIEW_REQUIRED`, `REVIEW_DECIDED`, `PAYPAL_CAPTURED`, `PAYPAL_VOIDED`, `ERROR`

### 5.8 API endpoints (Express, owned by A)
All responses are JSON. Errors are always `{ "error": "message" }` with status 400 (bad input), 404 (not found), 409 (wrong status for this action) or 500.
A "job object" means the full `Job` document including `items`.

| Method | Path | Request body | Response | Allowed when status is |
|---|---|---|---|---|
| `POST` | `/api/jobs` | `{ title, description, type, amount, workerEmail, repoUrl? }` | job object | any |
| `POST` | `/api/jobs/:id/checklist` | `{}` | job object, with AI items (status stays `DRAFT`) | `DRAFT` |
| `PUT` | `/api/jobs/:id/checklist` | `{ items: [{ text, kind, params, weight }] }` | job object, status `CHECKLIST_READY` | `DRAFT` |
| `POST` | `/api/paypal/orders` | `{ jobId }` | `{ orderId }` | `CHECKLIST_READY` |
| `POST` | `/api/paypal/orders/:orderId/authorize` | `{ jobId }` | job object, status `FUNDED` | `CHECKLIST_READY` |
| `POST` | `/api/jobs/:id/submit` | `{ submissionUrl }` | job object, status `SUBMITTED`, all items reset to `PENDING` | `FUNDED` or `CHANGES_REQUESTED` |
| `POST` | `/api/jobs/:id/review` | `{ payoutAmount }` (0 to job amount; the app sends only 0 or the full amount, see 5.5) | job object, status `SETTLED` | `NEEDS_REVIEW` |
| `GET` | `/api/jobs` | none | `[job object, ...]` newest first | any |
| `GET` | `/api/jobs/:id` | none | `{ job, events: [...] }` | any |
| `GET` | `/api/events` | none | `[event, ...]` newest first, each with `jobTitle` added | any |
| `GET` | `/api/screenshots/:id` | none | the JPEG image | any |

**Submit route checks:** for code jobs, `submissionUrl` must be a PR in the job's `repoUrl` (`https://github.com/owner/repo/pull/123`). For website jobs, it must start with `http`.

**Worker email check (`POST /api/jobs`):** when the server has `PAYPAL_WORKER_EMAIL` set (it is on Render), `workerEmail` must be exactly that address, or the route returns 400 with a message naming it. **Why:** PayPal only lets our app void a hold whose payee is the sandbox business account that owns the app. With any other worker, a job that fails could never give the buyer's money back. Our worker account is `sb-m8uku53787938@business.example.com`.

**Auth:** every route that changes a job also needs a key. See **5.10** for which key each route needs. A missing key returns **401**, a wrong key returns **403**.

### 5.9 Payment flow (PayPal Sandbox)
```
1. React PayPal button  createOrder → POST /api/paypal/orders { jobId } → returns { orderId }
2. Express creates order: intent = "AUTHORIZE",
                          purchase_units[0].amount = job.amount,
                          purchase_units[0].payee.email_address = job.workerEmail  (must be the app's own sandbox business account, see 5.8)
                          saves job.paypalOrderId
3. Buyer logs in with a SANDBOX personal account and approves
4. Button onApprove     → POST /api/paypal/orders/:orderId/authorize { jobId }
5. Express authorizes, saves job.paypalAuthId → status FUNDED
   ... worker submits, checks run, decision ...
6. settleJob(job, amount):
     amount > 0  → POST /v2/payments/authorizations/{authId}/capture
                   { amount: { currency_code, value: "200.00" }, final_capture: true }   (the full amount: payouts are all or nothing, 5.5)
     amount == 0 → POST /v2/payments/authorizations/{authId}/void
```
⚠️ An authorization is safe to capture for **about 3 days** (honor period). Keep demo jobs short.
🔒 The PayPal **Secret** is used only in Express. React only gets the **Client ID**.

### 5.10 Authentication (owned by A, client side by C)

**Today, anyone who knows a job's id can change it**, including approving its checklist, submitting work, and deciding the payout in review. With sandbox money that's acceptable for a demo, but it's the first question a judge will ask. We fix it **without user accounts**: each person gets a secret key that only they know.

**Who is who**
| Role | Proves it with | How they get it |
|---|---|---|
| **Buyer** | buyer key for that job | Returned **once** by `POST /api/jobs`. The client saves it in the buyer's browser. |
| **Worker** | worker key for that job | Also returned by `POST /api/jobs`. The buyer sends the worker a link: `/jobs/:id/submit?key=<workerKey>` |
| **Reviewer** (decides payouts in `NEEDS_REVIEW`) | admin key | `ADMIN_KEY` in the server `.env`. Shared privately with the team. |
| **AI agent** (Agent API, stretch) | agent key | `AGENT_API_KEY` in the server `.env` |
| **Anyone** | nothing | Can **read** jobs, events and screenshots (the public dashboard is part of the demo) |

**Rules**
- Keys are long random strings: `crypto.randomBytes(24).toString('base64url')`.
- The database stores only a **SHA-256 hash** of each key (`buyerKeyHash`, `workerKeyHash` on `Job`, with `select: false`), never the key itself. A leaked database doesn't leak keys.
- Keys are compared with `crypto.timingSafeEqual` (on the hashes).
- Keys travel in a **header**: `x-job-key` for buyer and worker, `x-admin-key` for the reviewer, `x-api-key` for agents. Never in a request body.
- The worker link puts the key in the URL **only once**. The client saves it and removes it from the address bar (`history.replaceState`). The client sets `<meta name="referrer" content="no-referrer">` so the key never leaks to other sites.
- Job responses (`GET` and others) **never** include key hashes.
- The **admin key also works as buyer or worker** for any job (for fixing demo mistakes).
- Errors: missing key → `401 { "error": "This action needs a key" }`, wrong key → `403 { "error": "Wrong key for this job" }`.

**Which key each route needs (5.8)**
| Route | Needs |
|---|---|
| `POST /api/jobs` | nothing (or `x-api-key` for agents). Response adds `{ buyerKey, workerKey }` **this one time only** |
| `POST /api/jobs/:id/checklist`, `PUT /api/jobs/:id/checklist` | buyer key |
| `POST /api/paypal/orders`, `POST /api/paypal/orders/:orderId/authorize` | buyer key |
| `POST /api/jobs/:id/submit` | worker key |
| `POST /api/jobs/:id/review` | admin key |
| All `GET` routes | nothing |

The checker loop (B) runs inside the server and calls `settleJob()` directly, so it needs no key. **B's code doesn't change.**

**Code changes**
| Who | File | Change |
|---|---|---|
| A | `server/src/auth.js` (new) | `makeKey()`, `hashKey()`, and middleware `requireJobKey('buyer' \| 'worker')`, `requireAdminKey`, `requireAgentKey` |
| A | `server/src/models/Job.js` | add `buyerKeyHash`, `workerKeyHash` (`select: false`) |
| A | `server/src/routes/*.js` | put the middleware on the routes above. `POST /api/jobs` returns the 2 keys once |
| A | `server/.env.example`, `render.yaml` | `ADMIN_KEY`, `AGENT_API_KEY` |
| C | `client/src/api.js` | save keys in `localStorage` (`veriflow:key:<jobId>`) and send `x-job-key` / `x-admin-key` |
| C | New job page | after creating, show the **worker link** with a "Copy" button |
| C | Submit page | read `?key=` from the link, save it, remove it from the URL |
| C | Review box | ask for the admin key once and keep it in `sessionStorage` |

**Tests (A)**
- No key → 401. Buyer key on submit → 403. Worker key on the checklist → 403. The right key → works.
- The admin key works everywhere. `GET /api/jobs` has no key hashes.
- Full flow on Render with keys: create → pay → open the worker link → submit → paid.

**Timing:** today is feature-freeze day (noon, Nov 11). Build this **only if** it's done and passes the full live flow **before the freeze**. Otherwise, keep it as the first item under "future work" and mention it in the pitch.

**Future work (after the hackathon)**
- Real accounts with **Log in with PayPal**: see **5.11** for the full design.
- Workers connect their **own** PayPal account (PayPal partner onboarding) instead of one shared sandbox account.
- Rate limits on login and job creation, and audit events for who did each action.

### 5.11 Log in with PayPal (future work, owned by A, client side by C)

**Status:** designed, **not built**. Too big for the freeze (Nov 12, 4 pm IST), because it touches every route that changes a job. In the pitch and Devpost, say: *"Next: buyers and workers log in with PayPal, so identity and money both run through PayPal."*

**Idea:** buyers and workers click **"Log in with PayPal"**. PayPal checks who they are and tells our server their PayPal id, email and name. We never store a password. It uses OAuth 2.0 / OpenID Connect (like "Sign in with Google").

**Flow**
```
1. Browser → GET /api/auth/paypal/login
   Server makes a random "state" (stops fake logins), redirects to PayPal's login page
2. User logs in on PayPal's own page and agrees to share name + email
3. PayPal → GET /api/auth/paypal/callback?code=…&state=…
4. Server checks "state", trades the one-time code for a token
   (POST /v1/oauth2/token, grant_type=authorization_code, with our Client ID + Secret)
5. Server asks "who is this?" (GET /v1/identity/oauth2/userinfo)
   → { user_id, email, name }
6. Server finds or creates the User in MongoDB
7. Server creates its OWN session token and sends the user back to the website.
   PayPal is no longer involved after this.
```

**Server (A)**
| Piece | What it does |
|---|---|
| `models/User.js` | `paypalUserId` (unique), `email`, `name`, `createdAt` |
| `GET /api/auth/paypal/login` | Makes `state`, redirects to PayPal |
| `GET /api/auth/paypal/callback` | Checks `state`, gets the token and user info, saves the user, creates our session, redirects to the website |
| `GET /api/auth/me` | Returns the logged-in user (or 401) |
| `POST /api/auth/logout` | Ends the session |
| `auth.js` → `requireUser` | Middleware: no valid session → **401** |
| `Job.buyerId` | Set to the logged-in user when a job is created |

**Who may do what**
| Action | Allowed for |
|---|---|
| Create a job | Any logged-in user (becomes its buyer) |
| Generate or approve the checklist, pay | Only that job's buyer (`job.buyerId`) |
| Submit work | Only the worker: logged-in PayPal email = `job.workerEmail` |
| Review and payout | Admins only: email in `ADMIN_EMAILS` |
| View jobs, events, screenshots, dashboard | Everyone (no login) |
| Checker loop (B) | Unchanged (runs inside the server) |
| AI agents (Agent API) | Keep the `x-api-key` from 5.10 (agents can't use a login page) |

Wrong user → **403**. Extra check at authorize: the PayPal payer email should match the logged-in buyer.

**Session: a token in a header, not a cookie.** The website (`veriflow-web-…onrender.com`) and the API (`veriflow-api-…onrender.com`) count as **different sites** to browsers (`onrender.com` is a public suffix). Browsers increasingly block login cookies between different sites, so a cookie could work on our laptops and fail on a judge's. Instead:
- After the callback, the server redirects to the website with a **one-time code**. The website exchanges it for a signed token (JWT, signed with `SESSION_SECRET`, valid **8 hours**).
- The website keeps the token and sends `Authorization: Bearer <token>` with every request.
- Never put the token itself in the URL.

**Website (C)**
- Header: **"Log in with PayPal"** button, or the user's name and "Log out".
- New job, Submit and Review pages ask the user to log in first.
- `api.js` adds the `Authorization` header and sends the user to log in again on 401.

**What it gives Veriflow**
- The worker's PayPal email comes **from PayPal itself**: no typos, no paying the wrong account.
- We can check that the person paying is the buyer.
- No passwords to store or leak.

**What it does NOT solve**
- Logging in is **not** permission to move money. PayPal still won't let our app **void** holds for a worker's own account. That needs PayPal **partner onboarding** (Multiparty), a separate, bigger project. Until then, `PAYPAL_WORKER_EMAIL` stays.
- On live PayPal, sharing the email needs a PayPal review. In the sandbox it works right away.

**Manual setup (sandbox)**
1. developer.paypal.com → Apps & Credentials → our app → **Sandbox** → turn on **Log in with PayPal** → Advanced settings.
2. Return URLs: `https://veriflow-api-wzi0.onrender.com/api/auth/paypal/callback` and `http://localhost:5000/api/auth/paypal/callback`.
3. Information requested: **full name, email**. Add privacy policy and user agreement links (simple pages on our site are enough).
4. New server variables: `SESSION_SECRET` (long random string), `ADMIN_EMAILS` (comma-separated), `PAYPAL_LOGIN_RETURN_URL`.
5. Demo: two browser windows (normal + incognito). Buyer = sandbox **personal** account, worker = sandbox **business** account.

**Tests**
- Not logged in → 401 on every route that changes a job. Another user's job → 403.
- The worker can't approve the checklist. The buyer can't submit work. Only admins can review.
- A tampered or expired token → 401. A wrong `state` in the callback → login refused.
- Full flow on Render with both sandbox accounts: log in → create → pay → (worker) log in → submit → paid.

**Effort:** A 4–6 h, C 2–3 h, testing on Render 1–2 h.

---

## 6. Who does what

Fill in names:

| Role | Person | Owns |
|---|---|---|
| **A: Payments & Backend** | **K** | Express server, MongoDB models, PayPal, all API routes, `logEvent`, `settleJob`, Render deploy |
| **B: AI & Checkers** | **M** | AI wrapper (Gemini/Groq), `generateChecklist`, all checkers, decision rule, checker loop |
| **C: Frontend & Demo** | **H** | React app, PayPal button, AG Grid dashboard, review screen, demo repo and site, video, Devpost write-up |

### Person A: Payments & Backend
- Set up the repo (`client/` + `server/`), Express, MongoDB Atlas, all 3 Mongoose models. **Do this first, day 1 morning, and push it so B and C can start.**
- `events.js` (`logEvent`) and a placeholder `settleJob` on day 1
- PayPal Sandbox: app keys, test accounts, access-token helper
- Create order / authorize / capture / void, all tested (the rule now only captures the full amount; a partial capture still works if the review route is ever sent one)
- All routes in 5.8, including input checks, the "allowed when status is" rule, and CORS for the React app
- Call `startCheckerLoop()` from `index.js`
- Deploy to Render: Static Site (client) + Web Service (server, Docker with Playwright)
- Stretch: Agent API (same routes, protected by an `x-api-key` header) + MCP server

### Person B: AI & Checkers
- `ai/index.js`: `generateJSON` (Gemini, Groq backup) + `judgeImages` (Gemini)
- `ai/checklist.js`: `generateChecklist(job)` following all rules in 5.3
- `checkers/github.js`: from the PR URL, read check runs → `tests_pass`; read changed files → `files_changed`. Returns `null` while checks are still running.
- `checkers/website.js`: Playwright, desktop (1280px) and mobile (390px) screenshots (returned as buffers; `loop.js` saves them as `Screenshot` documents), plus `page_loads` / `element_exists` / `text_present`
- `checkers/visual.js`: send the right screenshot + item text to `judgeImages` → result
- `checkers/speed.js` (should-have): PageSpeed Insights → `speed_score`
- `decision.js`: rule 5.5
- `checkers/loop.js`: `startCheckerLoop()`. Every 5s, take **one** `SUBMITTED` job → status `CHECKING` (the loop does not touch `attempts`, the submit route counts it) → run each item's checker → save results on the items → `logEvent` → apply 5.5 → set `CHANGES_REQUESTED` / `NEEDS_REVIEW` or call `settleJob`. **One job at a time** (Playwright uses a lot of memory on the free plan). Close the browser after each job.
- Test every checker on its own with a small script before connecting it

### Person C: Frontend & Demo
- `client/src/api.js`: one function per endpoint in 5.8. All pages use these, never `fetch` directly.
- React routes:
  1. `/`: landing page with one-line pitch + "Create a job"
  2. `/jobs/new`: title, description, type, amount, worker email (+ repo URL for code jobs) → "Generate checklist" → edit items (text, weight) with a "weights must add up to 100" check → "Approve" → **PayPal button**
  3. `/jobs/:id/submit`: worker pastes PR or website URL. Also used for the resubmit when status is `CHANGES_REQUESTED`. **The only page where work is submitted.**
  4. `/jobs/:id`: **live status** (poll `GET /api/jobs/:id` every 2s): each item turning green/red/grey, reasoning, screenshots, attempts, final payout. Results that land together are shown about 1 second apart. While the job waits for work, it shows the **worker link** (Copy / Open submit page), not a submit box. When status is `NEEDS_REVIEW`, show a **review box**: Pass or Fail for each unsure item, then "Settle on PayPal" → `POST /review` with the full amount (all Pass) or 0 (any Fail).
  5. `/dashboard`: **AG Grid** with 3 grids: jobs (`GET /api/jobs`), checklist results (items from all jobs, one row per item), audit log (`GET /api/events`)
- Use fake data matching section 5 until A's API is ready
- **Demo material** (start by day 3), exactly as described in **10.1**:
  - The demo GitHub repo: a small shop checkout where the worker adds coupon codes, 6 buyer tests (each its own GitHub Actions job), and 3 PRs: `attempt-1`, `fix` and `cheat`
  - The demo website: a good and a broken version of one landing page, hosted on GitHub Pages (live, 10.1)
- Demo video, Devpost write-up, screenshots, and the architecture image

---

## 7. Day-by-day plan

| Day | Date | A: Payments & Backend | B: AI & Checkers | C: Frontend & Demo |
|---|---|---|---|---|
| **1** | Nov 6 | Repo + Express + MongoDB Atlas + 3 models + `logEvent` + placeholder `settleJob`. Push. PayPal sandbox keys + test accounts. Try authorize → partial capture → void in **Postman**. | Gemini (and Groq) keys. `ai/index.js`. `generateChecklist` working in a script. | Read this plan. Vite + React Router. `api.js` with fake data. Page layouts. Install AG Grid. |
| **2** | Nov 7 | Order / authorize / real `settleJob` (capture + void) in code. Job routes. | GitHub checker done. Playwright checker (load, element, text, screenshots). | Create-job page (checklist editor + PayPal button) connected to A's routes. |
| **3** | Nov 8 | First deploy to Render (client + server, no Playwright yet). Screenshot route. | Visual checker. Decision rule. `loop.js` first version. | Submit page + job status page. Build the **demo repo** and **demo site**. |
| **4** | Nov 9 | Dockerfile with Playwright working on Render. Call `startCheckerLoop()`. | Loop end to end incl. `CHANGES_REQUESTED` + `NEEDS_REVIEW`. | AG Grid dashboard (3 grids). Review box. |
| **5** | Nov 10 | **Full flow works on Render.** Bug fixes. Stretch: Agent API. | Tune prompts on demo cases. Speed check (should-have). | Polish UI. Write the demo script. Record a rough video. |
| **6** | Nov 11 | Freeze features at noon. Fix bugs only. | Freeze features at noon. Fix bugs only. | **Record the final video.** Devpost write-up. **Submit tonight.** |
| **7** | Nov 12 | Buffer day for emergencies only. | Buffer | Buffer. Check the submission is complete. |

### Checkpoints (all 3 together, 15 min)
- **Day 1, end:** everyone has read section 5 and agrees. Everyone can run the project locally.
- **Day 3, end:** one code job goes create → pay → submit → check → paid (even if ugly).
- **Day 5, end:** full demo (including resubmit and review) works on the **deployed** site, not only on a laptop.

If a checkpoint is missed, **cut scope** (section 3 "should have") instead of working longer.

---

## 8. Getting started

### 8.1 PayPal Sandbox (Person A, then share the Client ID and test account logins with the team)
1. Go to https://developer.paypal.com/dashboard/ and log in with any PayPal account.
2. Make sure the toggle says **Sandbox**.
3. **Apps & Credentials → Create App** → name `veriflow`, type **Merchant** → copy the **Client ID** and **Secret**.
4. **Sandbox Accounts** → note the Personal (buyer) and Business (worker) test accounts and their passwords.
5. No real money, card, or ID verification needed.

### 8.2 Free accounts to create
| Service | Who | Link |
|---|---|---|
| MongoDB Atlas (free M0 cluster) | A | https://www.mongodb.com/atlas |
| Gemini API key | B (everyone for dev) | https://aistudio.google.com |
| Groq API key (backup) | B | https://console.groq.com |
| GitHub token (read-only, public repos) | B | GitHub → Settings → Developer settings → Tokens |
| Render | A | https://render.com |

In MongoDB Atlas → Network Access, allow `0.0.0.0/0` so Render can connect (fine for a hackathon).

### 8.3 Environment variables (**never commit `.env`**)
`server/.env`
```
PORT=5000
MONGODB_URI=mongodb+srv://...
CLIENT_URL=http://localhost:5173        # for CORS; the Render client URL when deployed
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
AI_PROVIDER=gemini                      # gemini | groq  (text only; images always use Gemini)
GEMINI_API_KEY=...
GROQ_API_KEY=...
GITHUB_TOKEN=...
PAGESPEED_API_KEY=...                   # needed for speed checks: without it they all come back UNSURE (13.3)
INTERACTION_CHECKS=true                 # true = the AI may write "interaction" items (5.3, 13.1); unset/false = off
PAYPAL_WORKER_EMAIL=sb-m8uku53787938@business.example.com   # sandbox business account that owns the PayPal app; the only worker email allowed (5.8). Leave empty locally to allow any
CHECKER_LOOP=true                       # true on Render; false on laptops once Render is live (one checker per database)
ADMIN_KEY=...                           # reviewer key for payouts (5.10), long random string
AGENT_API_KEY=...                       # Agent API key (5.10, stretch)
```
`client/.env`
```
VITE_API_URL=http://localhost:5000
VITE_PAYPAL_CLIENT_ID=...               # same Client ID, NOT the secret
VITE_USE_FAKE_API=false                 # true = the client runs on sample data in the browser, no server needed (for UI work only)
```
Share secrets privately (e.g. a direct message), **never** in GitHub or a public chat. Add `.env` to `.gitignore` on day 1. Commit a `.env.example` with the names but no values.

### 8.4 Folder layout (owner in brackets)
```
veriflow/
├─ client/                         # React + Vite                         (C)
│  ├─ src/
│  │  ├─ pages/                    # Landing, NewJob, Submit, JobStatus, Dashboard
│  │  ├─ components/               # ui.jsx (design pieces), PayPalButton, ChecklistEditor, ChecklistView,
│  │  │                            # ReviewBox, SubmitBox, WakeNotice, grids/ (AG Grid: VfGrid + 3 grids)
│  │  └─ api.js                    # one function per endpoint in 5.8
│  └─ .env
├─ server/
│  ├─ src/
│  │  ├─ index.js                  # app setup, routes, startCheckerLoop()  (A)
│  │  ├─ events.js                 # logEvent()                             (A)
│  │  ├─ auth.js                   # keys + auth middleware (5.10)          (A)
│  │  ├─ models/                   # Job.js, Event.js, Screenshot.js        (A)
│  │  ├─ validate.js               # input checks, isPrivateHost            (A)
│  │  ├─ routes/                   # jobs.js, paypal.js, events.js, screenshots.js (A)
│  │  ├─ paypal/                   # client.js (token), orders.js, settle.js (A)
│  │  ├─ ai/                       # index.js, gemini.js, groq.js, checklist.js, checklistRules.js, prompts.js (B)
│  │  ├─ checkers/                 # github.js, website.js, interaction.js, visual.js, speed.js, loop.js (B)
│  │  └─ decision.js               # rule 5.5                               (B)
│  ├─ scripts/                     # small test scripts for each checker    (B)
│  ├─ Dockerfile                   # Playwright image for Render            (A)
│  └─ .env
├─ demo/                           # notes for demo repo + demo site        (C)
├─ .github/workflows/keep-awake.yml # pings the Render API every 10 minutes (11)
└─ PLAN.md
```
**Each file has exactly one owner.** If you need a change in someone else's file, ask them or open a PR and tag them.

### 8.5 Git rules
- `main` must always work. Everyone works on their own branch (`a/paypal`, `b/checkers`, `c/dashboard`).
- Small pull requests, merged at least once a day. Pull `main` every morning.
- Changes to section 5 (models, routes, statuses) go in their own small PR, merged quickly, and announced in the team chat.
- **Never push or merge to `main` while someone is testing, recording or judging.** Render redeploys `main` automatically, and a redeploy restarts the server. A check that gets cut off in the middle only restarts after 10 minutes (5.6), which ruins a take. Say in the team chat before you start recording, and again when you're done.

---

## 9. Stretch goals (only after day 5 checkpoint passes)
1. **Agent API + MCP server**: an AI agent posts a job and pays, and another agent submits the work. Strongest boost for the Agentic Commerce prize.
2. **Milestones**: one job split into 3 held payments, shown on a **Bryntum** timeline (extra sponsor prize).
3. **Dispute view**: buyer and worker each add a comment, and AI summarizes both sides for the human reviewer.

---

## 10. Demo (≈ 3 minutes; check the time limit in the Devpost rules)

**The story:** a shop owner hires a freelancer to add coupon codes to their checkout. The freelancer's first attempt gets the money math wrong, so Veriflow holds the payment. The fixed version passes, and PayPal pays automatically. It's money math in a PayPal hackathon, and it's a real feature rather than a one-line fix, so it shows Veriflow works for real freelance work.

### 10.1 What we build for the demo (C)

**Demo repo: `3Bit-Crew/veriflow-demo`** (public)
```
src/checkout.js               # the cart total; the worker adds coupon support here
src/payment/                  # "payment code": the job says not to touch it
tests/checkout.test.js        # the buyer's 6 tests (protected automatically, see 5.3)
.github/workflows/tests.yml   # runs each test as its own job (see below)
```

The buyer's 6 tests:
| # | Test name (what shows on screen) | Checks that |
|---|---|---|
| 1 | Total without a coupon | Items plus shipping add up correctly |
| 2 | SAVE10 takes 10% off | `SAVE10` takes 10% off the items |
| 3 | FREESHIP makes shipping free | `FREESHIP` sets shipping to $0 |
| 4 | Unknown coupon is rejected | A made-up code gives an error, not a silent $0 discount |
| 5 | Shipping not discounted | `SAVE10` takes 10% off the items only, never the shipping |
| 6 | Rounds to cents | $19.99 × 3 with `SAVE10` = $53.97, not $53.973 |

**Each test is its own GitHub Actions job** (a `matrix` in `tests.yml`, with the job named after the test). Why: B's `github.js` reports results per GitHub check, and each job is one check. With one job for all tests, the screen would only say "1 of 1 check(s) failed: test". With one job per test, it says **"2 of 6 check(s) failed: Rounds to cents (failure), Shipping not discounted (failure)"**, which a judge understands at a glance. The jobs run in parallel and must finish in under 30 seconds.

**The 3 pull requests** (all from the worker, opened **before** recording so GitHub has already finished the tests):
| PR branch | What the worker did | Tests | What Veriflow does |
|---|---|---|---|
| `attempt-1` | Adds coupons, but forgets to round to cents and discounts the shipping too | 4 of 6 pass | **Changes requested**, money still held |
| `fix` | Everything right | 6 of 6 pass | **Paid in full** |
| `cheat` | Edits the tests so they "pass" | all "pass" | The automatic test-protection item fails (5.3), so it's **caught and blocked**: the hold is voided at once, $0 to the worker, no resubmit |

- `attempt-1` and `fix` change **only `src/checkout.js`**. They never touch `tests/`, `.github/` or `src/payment/`, so only the tests decide the result.
- `cheat` needs **its own job**, because it ends that job: changing a restricted file voids the hold at once, on any try (5.5). Run it before recording. On screen it is "caught and blocked: $0".
- Voiding only works when the worker is the app's **own** sandbox business account (PayPal rule, 8.1). With any other worker the void fails and the job goes to human review. Use that account as the worker on the cheat and website jobs.

**Demo website: `3Bit-Crew/veriflow-demo-site`** (public, on GitHub Pages, live since Nov 11)
- A bakery landing page: headline "Fresh every morning", an email field and a "Sign up" button. Signing up shows "Thank you, you're on the list!" in place of the form (for the interaction check).
- **Good version:** `https://3bit-crew.github.io/veriflow-demo-site/good/`. Everything fits on a phone.
- **Broken version:** `https://3bit-crew.github.io/veriflow-demo-site/broken/`. The "Sign up" button is cut off at the right edge on a 390px phone screen, so the AI vision check flags it. On desktop it looks the same as the good one.
- Job description to type (type Website): *Landing page for my bakery with the headline "Fresh every morning", a signup form with an email field and a "Sign up" button. Signing up shows a thank-you message. Must look good on mobile.*
- Details and what each check should find: `demo/README.md`.

### 10.2 Before recording
- [ ] Tell the team you're recording. **Nobody pushes to `main`** until you say you're done (8.5).
- [ ] All 3 PRs are open and their GitHub Actions runs have finished.
- [ ] **Pre-run two jobs**, so nobody waits on screen:
  - the **website job**, in two tries: submit the broken site URL. The visual check fails, so the first try ends in "Changes requested" (5.5: a confident failure on a first try always does). Then submit the **same broken URL again**: the second try ends in a **void**: the worker gets $0 and the buyer keeps the whole hold. (If the AI is unsure instead, it ends in human review. That works for the script too.)
  - the **cheat job** on the `cheat` PR (ends **voided**, $0 to the worker, with the test-protection item red)
- [ ] Wake up Render: open the live site and `<server>/api/health` a few minutes before (the free plan sleeps after ~15 minutes).
- [ ] Have ready: the sandbox **buyer** login for the PayPal popup (8.1). The worker email `sb-m8uku53787938@business.example.com` (5.8) is already filled in on the New job form.

### 10.3 Script
| # | Part | Time | What happens on screen |
|---|---|---|---|
| 1 | **Problem** | 20s | "Online work has a trust problem. And soon AI agents will be hiring other AI agents with no human watching." |
| 2 | **Create the job** | 30s | On **Create a job**: type Code, repo `https://github.com/3Bit-Crew/veriflow-demo`, amount **200** (the worker email is already filled in), and the description below. The AI writes the checklist: tests pass, "files changed" (must change `src/checkout.js`, must not change `src/payment/`), and the automatic test-protection item. Approve, pay with PayPal → **"$200.00 is held on PayPal."** |
| 3 | **First try** | 35s | The worker submits the `attempt-1` PR. Items turn red: **"2 of 6 check(s) failed: Shipping not discounted, Rounds to cents"** (the order of the two names can vary) → **"Changes requested. $200.00 is still held."** |
| 4 | **Second try** | 35s | The worker submits the `fix` PR. Items turn green one by one → **"$200.00 released to the worker via PayPal."** |
| 5 | **Caught and flagged** | 30s | Open the pre-run **cheat** job: the tests "pass", but "The buyer's tests and CI setup were not modified" is red. Then the pre-run **website** job: the AI flags the cut-off button on the mobile screenshot. The worker resubmitted without fixing it, so the worker gets **nothing** and the whole hold goes back to the buyer: every item must pass. The cheat job was voided the same way, on its first try. |
| 6 | **Dashboard** | 20s | AG Grid: every job, every check result and every PayPal action, all auditable. |
| 7 | **Close** | 10s | "Veriflow: money moves only when the work is proven." |

**Job description to type in step 2** (it names the files on purpose, so the AI's "files changed" rules match the repo exactly; the checklist editor can't change those rules):
> Add coupon codes to `src/checkout.js`: SAVE10 = 10% off the items, FREESHIP = free shipping. Totals must be correct to the cent. Don't change anything in `src/payment/`.

---

## 11. Risks and backup plans

| Risk | Backup |
|---|---|
| PayPal capture, void or payee setup gives errors | Test it in Postman on day 1. If payee fails, capture to our sandbox business account. A void only works when the worker is that account (10.1), so the New job form fills it in. |
| AI gives wrong results or invalid JSON | Use exact checks for most items. Validate JSON, retry once, else `UNSURE` → `NEEDS_REVIEW`. Pick demo cases that are clearly pass or fail. |
| Free AI limit hit during testing or demo | Cache AI responses in MongoDB. Separate dev keys per person. Switch `AI_PROVIDER` to Groq for text. |
| Playwright doesn't run on Render | Use a Dockerfile based on the official Playwright image (`mcr.microsoft.com/playwright`). If still stuck by day 4, run the server on a laptop for the demo. |
| Render free plan runs out of memory with Playwright | One job at a time, close the browser after each job, small viewports, JPEG screenshots. |
| Render free server "sleeps" after ~15 min idle (first request takes ~1 min), and the checker loop pauses while asleep | `.github/workflows/keep-awake.yml` pings `/api/health` every 10 minutes from `main` (GitHub can delay scheduled runs, so it isn't guaranteed). Still open the site a few minutes before recording or judging. The app shows "Waking up the server…" if a request takes over 5 seconds. |
| Server restarts in the middle of a check | Every minute the loop puts jobs stuck in `CHECKING` for over 10 minutes back to `SUBMITTED` (5.6). Only old ones, so during a Render deploy the new server doesn't re-check the job the old server is still finishing. That 10-minute wait would ruin a take, so nobody pushes to `main` while someone is recording (8.5). |
| GitHub Actions slow during the demo | Keep the test suite tiny (finishes in under 30s). Open the demo PRs before recording so the results already exist (10.2). Pre-record that part of the video if needed. |
| Running out of time | Cut in this order: speed check → Agent API → website job → keep the code job only. **Don't cut resubmit**, the demo needs it. |
| Deployed site breaks on demo day | Record the video from a working run on day 5–6. Don't change code after the freeze. |

---

## 12. Submission checklist
- [ ] Public GitHub repo with a README (what it is, how to run, sandbox test logins)
- [ ] Live link (Render)
- [ ] Demo video uploaded (YouTube or Vimeo) and within the time limit
- [ ] Devpost write-up: problem, solution, how we used **PayPal**, how we used **AI**, **AG Grid**, **Render**, challenges, what's next
- [ ] Select the right prize categories on Devpost (AG Grid, Render, etc.)
- [ ] Architecture image + screenshots
- [ ] All 3 team members added to the Devpost project
- [ ] Re-read the official Rules page once (eligibility, video length, required items)

---

## 13. Final additions (Nov 11–12)

**Submission target: Nov 12, ~10 pm IST.** Devpost closes Nov 12, 12:00 PM Pacific (about 1:30 am IST on Nov 13), so 10 pm leaves a buffer.
**Code freeze: Nov 12, 4 pm IST.** After that, only fixes for bugs found while recording the video.

Three pieces of work, in this order. All three are done and merged.

| # | Work | Owner(s) | Status |
|---|---|---|---|
| 13.1 | Interaction checks (AI clicks and types on the site) | M, K, H | Done: K; M (PR #14); H (PR #16) |
| 13.3 | PageSpeed API key | K | Done: set on Render and tested |
| 13.2 | Lighthouse scores (accessibility, best practices, SEO) | M, K, H | Done: K; M (PR #23); H |

### 13.1 Interaction checks

**Why:** the website checker only looked at the page as it first loads, so anything that appears after a click (a QR code after "Shrink It", a success message after a form) was always marked FAIL with 100% confidence, even when the work was correct. The AI also guessed CSS class names like `.qr-code` that don't exist.

**How it works:** for an `interaction` item, the checker opens the site in a fresh tab, lists the visible inputs, buttons and links, and the AI turns `params.steps` into at most 5 actions on those elements (fill, select, click, press Enter). Playwright does them, then the AI judges the before and after screenshots against the item text. The "after" screenshot is saved as the item's evidence.

**Safety rules (already built):**
- A step that can't be done (no matching button, login or captcha needed, timeout) gives **UNSURE → human review**, never FAIL.
- The AI can only act on elements from the list, with those 4 actions. No made-up selectors, no visiting other URLs.
- The checker's browser blocks every request to localhost or a private address (uses K's `isPrivateHost`).
- Each item has a 2-minute limit. Planning uses Groq first (fast); judging uses Gemini.
- Switch: `INTERACTION_CHECKS=true` on the server. Off = the AI never writes interaction items. Jobs that already have one are still checked.
- The checklist AI no longer invents CSS selectors, and the `visual` judge answers UNSURE (not FAIL) for anything that only appears after a click.

**Tasks:**
- [x] **K:** `validate.js` accepts `interaction` (steps ≤ 300 characters, viewport desktop/mobile, max 2 per checklist); `isPrivateHost` exported.
- [x] **M:** checker (`checkers/interaction.js`), wired into `website.js` and `loop.js`, checklist rules and prompts, `scripts/test-interaction.js`. Tested: ShrinkThis QR → PASS, wrong expectation → FAIL, impossible steps → UNSURE.
- [x] **M:** push branch `b/interaction-check` and open a pull request (merged as #14). One retry when Gemini times out while judging.
- [x] **K:** add `INTERACTION_CHECKS=true` to `render.yaml` and `server/.env.example`. Set it on Render (already added in the dashboard).
- [x] **H:** `checklistKinds.js`: label `interaction: 'Interaction (AI)'`, `describeParams` → "AI will, on desktop: …" or "AI will, on mobile: …" followed by the steps (the viewport was added). `fakeApi.js`: `interaction` added to the website kinds, with a fake result and screenshot, and the same max-2 rule as the server. In PR #16.
- [ ] **All:** after merge, run one real website job on Render with an interaction item and watch the Render logs for memory errors.

**Deploy order:** K's part is already live, so M's branch can merge any time. H's part can go out separately; without it the item shows the raw word "interaction", but nothing breaks.

### 13.2 Lighthouse scores (accessibility, best practices, SEO)

**Why:** PageSpeed Insights already runs Google Lighthouse. We only read the performance score. The same call also returns accessibility, best-practice and SEO scores: exact, stable numbers that fit Veriflow's "proof, not opinion" pitch, at no extra time or quota.

**Contract (new kind, see 5.3):**
- `lighthouse_score` with params `{ "category": "accessibility" | "best-practices" | "seo", "min": 0–100 }`.
- `speed_score` stays as it is for performance, so existing jobs and H's labels don't change.
- One PageSpeed call per job, asking for every category the checklist needs (mobile).
- Score ≥ min → PASS (confidence 1.0). Score below → FAIL. API error → UNSURE.
- The AI uses it only when the description asks for it ("accessible", "SEO-friendly", "follows best practices"), at most one item per category.

**Tasks:**
- [x] **M:** (merged as #23) `checkers/speed.js` reads all needed categories from one call and returns results for `speed_score` and `lighthouse_score` items. Add the kind to `ai/checklistRules.js` (`cleanParams`: category from the list, `min` 0–100, default 90) and the prompt. Test script run on 2 sites. **~45 min**
- [x] **K:** `validate.js`: `lighthouse_score: (p) => ['accessibility','best-practices','seo'].includes(p.category) && Number.isFinite(p.min) && p.min >= 0 && p.min <= 100`. **~10 min**
- [x] **H:** `checklistKinds.js`: label `lighthouse_score: 'Lighthouse score'`, `describeParams` → `` `Lighthouse ${params.category} score of at least ${params.min}` ``. `fakeApi.js`: add the kind. **~10 min** Done: harmless if M's part never lands, since the AI then never writes the item.
- [x] **All:** move the 5.3 row from "Planned" to done.

**Deploy order:** K's rule must be live **before or together with** M's change. Otherwise the AI writes `lighthouse_score` items that the approve route rejects, and buyers can't approve website checklists. Merge K's PR first, or put both in one PR.

**Done on Nov 11** (it was to start only after 13.1 worked on Render and 13.3 was done). The AI adds Lighthouse items only when the description asks for accessibility, SEO or best practices, so the demo jobs are unaffected.

### 13.3 PageSpeed API key (owner: K)

**Why:** without a key, PageSpeed uses a quota shared by everyone on the internet, and it's already used up (tested Nov 11: "Quota exceeded" every time). Every speed check then comes back UNSURE, so **every website job with a speed item goes to human review** instead of paying out.

**Tasks (K, ~10 min):** all done on Nov 11. One PageSpeed call returns all 4 scores in about 12 seconds.
- [x] console.cloud.google.com → create or pick a project → enable **PageSpeed Insights API**.
- [x] APIs & Services → Credentials → **Create credentials → API key**. Restrict it to the PageSpeed Insights API.
- [x] Render → veriflow-api → Environment: `PAGESPEED_API_KEY` = the key. Save, rebuild, and deploy (when nobody is testing).
- [x] Share the key privately with M and H for their local `server/.env`. **Never commit it.**
- [x] Check: run a website job with a speed item, or `node scripts/test-website.js` locally with the key; the speed item should show a real score.

Free limit: about 25,000 checks a day.

### 13.4 Render environment checklist (veriflow-api)

| Variable | Value | Owner | Status |
|---|---|---|---|
| `INTERACTION_CHECKS` | `true` | M | Added |
| `PAYPAL_WORKER_EMAIL` | Sandbox business account that owns the PayPal app | K | Check it's set |
| `PAGESPEED_API_KEY` | Key from 13.3 | K | Set |
| `GITHUB_TOKEN` | Read-only token (raises the GitHub API limit from 60 to 5,000 requests an hour) | K | Set |
| `CHECKER_LOOP` | `true` (laptops: `false`) | K | Set |

---

## 14. Future scope (after the hackathon): a hybrid payout rule

**Status:** idea only. **Not building it before the hackathon:** it changes the payout rule, the checklist format, the AI prompts and the UI, and it needs a lot of testing. In the pitch and Devpost, mention it as what's next.

### Why we moved away from weights
We started with partial payouts: each checklist item had a weight, and the worker was paid for the weight of the items that passed. Then we found a way to cheat it. Take this checklist for a $40 job:

| Item | Weight |
|---|---|
| 1. Don't change files outside your job | $20 |
| 2. Fix bug A | $20 |

A worker can open a pull request with an **empty commit**. It changes no files, so item 1 passes and they cash out $20 without doing any work. That's why we switched to **all or nothing** (5.5): every item must pass, or nothing is paid.

### Why all or nothing isn't enough either
It protects the buyer, but not the worker. A **malicious buyer** can add a check that can never pass, for example a GitHub Actions test that fails if anything in the repo changes. The worker does the job, fails that check every time, and is never paid, even though they did the work.

### The proposal: two kinds of checklist items
(The names are placeholders and can change.)

| Kind | What it is | Examples |
|---|---|---|
| **"Required"** | Basic conditions any honest submission meets | Don't change files outside `src/checkout.js`; don't edit the buyer's tests |
| **"Work"** | The actual job being paid for | Fix bug A; SAVE10 takes 10% off; the page looks good on mobile |

**The rule:**
1. If **any "required" item fails**, the worker gets **nothing**, whatever the other results are.
2. If **all "required" items pass**, the worker is paid by **how much of the "work" passed**, using the "work" items' weights, as in the old partial system.

**The same example under the hybrid rule:** "don't change other files" is required and "fix bug A" is work. The empty commit passes the required item but does no work, so it earns **$0**. A real fix passes both and earns the full amount.

### What it would touch
- **Checklist format (5.2, 5.3):** a new field on each item, for example `group: "required" | "work"`, with weights that add up to 100 across the "work" items.
- **AI checklist prompt:** label each item as required or work. The automatic test-protection item would always be required.
- **Payout rule (5.5):** the two steps above, plus the cheating rule.
- **UI:** the editor shows the two groups, the job page shows "required: all passed" next to the work score, and the review box goes back to paying a share.
- **Tests:** every combination of required and work results, on the first and second try.

### Open questions to settle before building it
- **The malicious-buyer problem can move into "required".** A buyer could put the impossible check in the required group. Who decides what may be required? Options: only a fixed list of required kinds (file rules, test protection), the worker accepting the checklist before starting, or a human review when a required item looks impossible.
- **First try and resubmit:** does a failed "work" item on the first try still give the worker one more try, as now?
- **Is there a minimum?** For example, no payout below a set share of the work.
