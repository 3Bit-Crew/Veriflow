# Veriflow: Team Plan

**Veriflow** is a pay-on-proof escrow: money is released only after the work is verified.

**Hackathon:** PayPal AI Hackathon (Devpost)
**Deadline:** November 12, 2026. Check the exact time and timezone on the Devpost page. Some sites list Nov 13 in India time. **We aim to submit on Nov 11 at night.**
**Team:** 3 people. Roles are in section 6.
**Stack:** MERN (MongoDB, Express, React, Node) + PayPal Sandbox + free Gemini / Groq AI key

> **How to read this:** sections 1–4 explain the project. **Section 5 is the contract between the three of us.** If your code matches section 5, it will fit with everyone else's. If you need to change section 5, tell the other two first and update this file.

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
   - some checks still fail on the **second try** → **partial payment**, the rest goes back to the buyer
   - nothing passes on the second try → **hold cancelled**, buyer pays nothing
   - AI not confident → **sent to a human**, with a report of the evidence

### Demo moment
A broken PR comes in → tests fail, money stays held → the fixed PR comes in → checklist items turn green → **"$200 released via PayPal"** appears on screen.

---

## 2. Prizes we're aiming for

| Prize | Why we fit |
|---|---|
| **Grand prizes** ($12k / $8k / $5k) | New idea, real problem, strong demo |
| **Best Use of Agentic Commerce** ($5k) | AI agents can hire and pay other agents safely |
| **Best Use of PayPal + AI** ($5k) | AI decides when and how much PayPal pays |
| **Best Demo Delivery** ($5k) | The live "money released" moment |
| **Best Use of AG Grid** ($5k / $2k / 3 × $1k) | Our dashboard is built with AG Grid (React) |
| **Best Use of Render** (credits) | Frontend and backend hosted on Render |

We are **not** building for Postman, APIMatic, Channel3, or Bryntum. Bryntum is a stretch goal only (section 9).
Use Postman **only** on day 1 to try PayPal's API collection.

---

## 3. What we build (scope)

### Must have (the project fails without these)
- [ ] Create a job → AI generates a checklist → buyer edits and approves it
- [ ] Buyer pays with the PayPal button → money **held** (authorized)
- [ ] Worker submits a **GitHub PR** or a **website URL**
- [ ] **Code checker:** reads the PR's test results from GitHub Actions and which files were changed
- [ ] **Website checker:** Playwright opens the site, takes screenshots, and checks elements. AI reviews the screenshots.
- [ ] **Decision engine:** full capture / one resubmit / partial capture / void / needs review (section 5.5)
- [ ] **Resubmit once** after a failed first try (the demo depends on it)
- [ ] **Human review:** approve or set a payout when a job is `NEEDS_REVIEW`
- [ ] **AG Grid dashboard:** jobs, checklist results, audit log
- [ ] Deployed on **Render**, working live with PayPal **Sandbox**
- [ ] Demo video + Devpost write-up

### Should have (if on schedule by day 4)
- [ ] **Agent API:** lets an AI agent post jobs, submit work, and check status using an API key (an MCP server too if time allows). This is our Agentic Commerce story.
- [ ] PageSpeed `speed_score` check
- [ ] Nicer evidence report (screenshots side by side, test log link)

### Won't build (say "future work" in the pitch)
- Design and writing checkers, real money (live mode), user accounts with passwords, mobile app.

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
DRAFT → CHECKLIST_READY → FUNDED → SUBMITTED → CHECKING ─┬→ SETTLED            (full / partial / void)
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
  attempts:      { type: Number, default: 0 },      // how many times the work was checked
  payoutAmount:  Number,                            // set when SETTLED
  settlement:    { type: String, enum: ['FULL', 'PARTIAL', 'VOID'] }, // set when SETTLED
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
| `files_changed` | code | `{ "mustTouch": ["src/login.js"], "mustNotTouch": ["src/db/"] }` | GitHub API | Must |
| `page_loads` | website | `{ "path": "/" }` | Playwright (status 200) | Must |
| `element_exists` | website | `{ "selector": "input[type=email]" }` | Playwright | Must |
| `text_present` | website | `{ "text": "Sign up" }` | Playwright | Must |
| `visual` | website | `{ "viewport": "mobile" }` (`desktop` or `mobile`) | AI vision on screenshot | Must |
| `speed_score` | website | `{ "min": 80 }` | PageSpeed Insights API | Should |

**Rules:**
- Use an exact check whenever possible. Use `visual` only for things like "looks good on mobile" or "matches the brand colors".
- Every code job must include exactly one `tests_pass` item.
- Weights are whole numbers and must add up to **100**. The route rejects the checklist otherwise.
- `mustTouch` / `mustNotTouch` paths: a path ending in `/` means "anything in that folder" (from the repo root). A path starting with `*` means "any file whose name ends with this", e.g. `*.test.js`.
- **Test protection (added automatically to every code job):** a `files_changed` item "The buyer's tests and CI setup were not modified" with `mustNotTouch: [".github/", "test/", "tests/", "__tests__/", "spec/", "*.test.js", "*.spec.js", "*.test.ts", "*.spec.ts"]`. This stops a worker from editing the tests to make them pass. If the job itself asks to change tests (a `mustTouch` on a test path), those paths are left out. The buyer can still delete the item in the editor.

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
- **Checkers don't use the database.** `checkWebsiteJob(job)` returns `{ results, screenshots: { desktop, mobile } }` (JPEG buffers). `loop.js` saves the screenshots as `Screenshot` documents and puts their ids in `evidence.screenshots`.

### 5.5 Decision rule (`server/src/decision.js`, owned by B)
B's loop runs this after all items are checked, then acts on the result.

```
passedWeight = sum of weights of items with status PASS

1. any item UNSURE, or any item has confidence < 0.7     → NEEDS_REVIEW
2. passedWeight == 100                                   → settleJob(job, amount)              → FULL
3. job.attempts == 1  (this was the first try)           → CHANGES_REQUESTED  (money stays held)
4. passedWeight == 0                                     → settleJob(job, 0)                   → VOID
5. otherwise                                             → settleJob(job, amount × passedWeight / 100) → PARTIAL
```
- Amounts are **rounded down to 2 decimals** (e.g. 133.333 → 133.33) and sent to PayPal as a string `"133.33"`.
- `job.attempts` goes up by 1 each time the loop starts checking a job (`SUBMITTED` → `CHECKING`).
- Example: $200 job, items worth 40 + 30 + 30. On the 1st try the last item fails → `CHANGES_REQUESTED`. On the 2nd try it still fails → capture **$140**, and the remaining $60 hold is released.

### 5.6 Shared functions (how A's and B's code connect)
| Function | File | Owner | Called by | What it does |
|---|---|---|---|---|
| `logEvent(jobId, type, message, data?)` | `server/src/events.js` | A | A and B | Saves an `Event`. **Everyone uses this for logging.** |
| `settleJob(job, amount)` | `server/src/paypal/settle.js` | A | B (loop), A (review route) | `amount > 0` → capture that amount with `final_capture: true`. `amount == 0` → void. Sets `payoutAmount`, `settlement`, `status = SETTLED`, logs the event. Returns the updated job. |
| `generateChecklist(job)` | `server/src/ai/checklist.js` | B | A (`POST /checklist` route) | Returns an array of items in the 5.2 shape (no `_id`, status `PENDING`). Weights sum to 100. Only allowed kinds. |
| `generateJSON(prompt)` | `server/src/ai/index.js` | B | B only | Returns a parsed JSON object |
| `judgeImages(prompt, buffers)` | `server/src/ai/index.js` | B | B only | Returns `{ status, confidence, reasoning }` |
| `startCheckerLoop()` | `server/src/checkers/loop.js` | B | A (`index.js`, once at startup) | Every 5s, checks one `SUBMITTED` job. On startup, resets any job stuck in `CHECKING` back to `SUBMITTED`. |

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
| `POST` | `/api/jobs/:id/review` | `{ payoutAmount }` (0 to job amount) | job object, status `SETTLED` | `NEEDS_REVIEW` |
| `GET` | `/api/jobs` | none | `[job object, ...]` newest first | any |
| `GET` | `/api/jobs/:id` | none | `{ job, events: [...] }` | any |
| `GET` | `/api/events` | none | `[event, ...]` newest first, each with `jobTitle` added | any |
| `GET` | `/api/screenshots/:id` | none | the JPEG image | any |

**Submit route checks:** for code jobs, `submissionUrl` must be a PR in the job's `repoUrl` (`https://github.com/owner/repo/pull/123`). For website jobs, it must start with `http`.

### 5.9 Payment flow (PayPal Sandbox)
```
1. React PayPal button  createOrder → POST /api/paypal/orders { jobId } → returns { orderId }
2. Express creates order: intent = "AUTHORIZE",
                          purchase_units[0].amount = job.amount,
                          purchase_units[0].payee.email_address = job.workerEmail
                          saves job.paypalOrderId
3. Buyer logs in with a SANDBOX personal account and approves
4. Button onApprove     → POST /api/paypal/orders/:orderId/authorize { jobId }
5. Express authorizes, saves job.paypalAuthId → status FUNDED
   ... worker submits, checks run, decision ...
6. settleJob(job, amount):
     amount > 0  → POST /v2/payments/authorizations/{authId}/capture
                   { amount: { currency_code, value: "140.00" }, final_capture: true }
     amount == 0 → POST /v2/payments/authorizations/{authId}/void
```
⚠️ An authorization is safe to capture for **about 3 days** (honor period). Keep demo jobs short.
🔒 The PayPal **Secret** is used only in Express. React only gets the **Client ID**.

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
- Create order / authorize / capture (full and partial) / void, all tested
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
- `checkers/loop.js`: `startCheckerLoop()`. Every 5s, take **one** `SUBMITTED` job → `attempts + 1`, status `CHECKING` → run each item's checker → save results on the items → `logEvent` → apply 5.5 → set `CHANGES_REQUESTED` / `NEEDS_REVIEW` or call `settleJob`. **One job at a time** (Playwright uses a lot of memory on the free plan). Close the browser after each job.
- Test every checker on its own with a small script before connecting it

### Person C: Frontend & Demo
- `client/src/api.js`: one function per endpoint in 5.8. All pages use these, never `fetch` directly.
- React routes:
  1. `/`: landing page with one-line pitch + "Create a job"
  2. `/jobs/new`: title, description, type, amount, worker email (+ repo URL for code jobs) → "Generate checklist" → edit items (text, weight) with a "weights must add up to 100" check → "Approve" → **PayPal button**
  3. `/jobs/:id/submit`: worker pastes PR or website URL. Also used for the resubmit when status is `CHANGES_REQUESTED`.
  4. `/jobs/:id`: **live status** (poll `GET /api/jobs/:id` every 2s): each item turning green/red/grey, reasoning, screenshots, attempts, final payout. When status is `NEEDS_REVIEW`, show a **review box** (payout amount input + "Settle" button → `POST /review`).
  5. `/dashboard`: **AG Grid** with 3 grids: jobs (`GET /api/jobs`), checklist results (items from all jobs, one row per item), audit log (`GET /api/events`)
- Use fake data matching section 5 until A's API is ready
- **Demo material** (start by day 3):
  - A demo GitHub repo with a failing test, a GitHub Actions workflow that runs the tests, and 2 PRs: one that **doesn't** fix the bug and one that does. **Use the same branch:** push the broken version first, then push the fix to the same PR. Or use two PRs, both are fine because the worker submits a URL each time.
  - A demo website with a good and a broken version, hosted on Render Static Site or GitHub Pages
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
PAGESPEED_API_KEY=...                   # optional
```
`client/.env`
```
VITE_API_URL=http://localhost:5000
VITE_PAYPAL_CLIENT_ID=...               # same Client ID, NOT the secret
```
Share secrets privately (e.g. a direct message), **never** in GitHub or a public chat. Add `.env` to `.gitignore` on day 1. Commit a `.env.example` with the names but no values.

### 8.4 Folder layout (owner in brackets)
```
veriflow/
├─ client/                         # React + Vite                         (C)
│  ├─ src/
│  │  ├─ pages/                    # Landing, NewJob, Submit, JobStatus, Dashboard
│  │  ├─ components/               # PayPalButton, ChecklistEditor, ChecklistView, ReviewBox, grids/
│  │  └─ api.js                    # one function per endpoint in 5.8
│  └─ .env
├─ server/
│  ├─ src/
│  │  ├─ index.js                  # app setup, routes, startCheckerLoop()  (A)
│  │  ├─ events.js                 # logEvent()                             (A)
│  │  ├─ models/                   # Job.js, Event.js, Screenshot.js        (A)
│  │  ├─ routes/                   # jobs.js, paypal.js, screenshots.js     (A)
│  │  ├─ paypal/                   # client.js (token), orders.js, settle.js (A)
│  │  ├─ ai/                       # index.js, gemini.js, groq.js, checklist.js, prompts.js (B)
│  │  ├─ checkers/                 # github.js, website.js, visual.js, speed.js, loop.js    (B)
│  │  └─ decision.js               # rule 5.5                               (B)
│  ├─ scripts/                     # small test scripts for each checker    (B)
│  ├─ Dockerfile                   # Playwright image for Render            (A)
│  └─ .env
├─ demo/                           # notes for demo repo + demo site        (C)
└─ PLAN.md
```
**Each file has exactly one owner.** If you need a change in someone else's file, ask them or open a PR and tag them.

### 8.5 Git rules
- `main` must always work. Everyone works on their own branch (`a/paypal`, `b/checkers`, `c/dashboard`).
- Small pull requests, merged at least once a day. Pull `main` every morning.
- Changes to section 5 (models, routes, statuses) go in their own small PR, merged quickly, and announced in the team chat.

---

## 9. Stretch goals (only after day 5 checkpoint passes)
1. **Agent API + MCP server**: an AI agent posts a job and pays, and another agent submits the work. Strongest boost for the Agentic Commerce prize.
2. **Milestones**: one job split into 3 held payments, shown on a **Bryntum** timeline (extra sponsor prize).
3. **Dispute view**: buyer and worker each add a comment, and AI summarizes both sides for the human reviewer.

---

## 10. Demo script (≈ 3 minutes; check the time limit in the Devpost rules)

1. **Problem (20s):** "Online work has a trust problem. And soon AI agents will be hiring other AI agents with no human watching."
2. **Create job (30s):** type "Fix the login bug, all tests must pass, don't change the database code." AI makes the checklist (`tests_pass`, `files_changed` with `mustNotTouch: src/db/`). Pay $200 with PayPal → *"$200 held."*
3. **First try, broken (35s):** worker submits a PR that still fails a test → items go red → **"Changes requested, $200 still held."**
4. **Second try, fixed (35s):** worker submits the fixed PR → tests pass → items go green → **"$200 released to worker via PayPal."**
5. **Website job (30s, quick):** a site where the signup button is cut off on mobile. The AI flags it, and the dashboard shows the job going to human review or a partial payout. Use a job that has already run, so you don't wait on screen.
6. **Dashboard (20s):** AG Grid with every job, check result, and PayPal action, all auditable.
7. **Close (10s):** "Veriflow: money moves only when the work is proven."

---

## 11. Risks and backup plans

| Risk | Backup |
|---|---|
| PayPal partial capture or payee setup gives errors | Test it in Postman on day 1. If payee fails, capture to our sandbox business account and **show** the split in the UI. |
| AI gives wrong results or invalid JSON | Use exact checks for most items. Validate JSON, retry once, else `UNSURE` → `NEEDS_REVIEW`. Pick demo cases that are clearly pass or fail. |
| Free AI limit hit during testing or demo | Cache AI responses in MongoDB. Separate dev keys per person. Switch `AI_PROVIDER` to Groq for text. |
| Playwright doesn't run on Render | Use a Dockerfile based on the official Playwright image (`mcr.microsoft.com/playwright`). If still stuck by day 4, run the server on a laptop for the demo. |
| Render free plan runs out of memory with Playwright | One job at a time, close the browser after each job, small viewports, JPEG screenshots. |
| Render free server "sleeps" after ~15 min idle (first request takes ~1 min), and the checker loop pauses while asleep | Open the site a few minutes before recording or judging. |
| Server restarts in the middle of a check | On startup the loop resets `CHECKING` jobs to `SUBMITTED` (5.6). |
| GitHub Actions slow during the demo | Keep the test suite tiny (finishes in under 30s). Pre-record that part of the video. |
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
