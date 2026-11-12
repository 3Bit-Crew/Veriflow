<div align="center">

# Veriflow

### Pay-on-proof escrow: AI verifies the delivered work, PayPal releases the money.

Veriflow holds a freelance payment on **PayPal**, checks the submitted **GitHub pull request** or **live website** against a checklist both sides agreed on, and pays the worker only when every item passes. Checks use real evidence: GitHub Actions results, changed files, browser automation, screenshots judged by AI, and Lighthouse scores.

[![Live demo](https://img.shields.io/badge/Live_demo-Render-46E3B7?logo=render&logoColor=white)](https://veriflow-web-f4u1.onrender.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-0E5A43.svg)](LICENSE)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Express 5](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![PayPal Orders v2](https://img.shields.io/badge/PayPal-Orders_API_v2_%28sandbox%29-003087?logo=paypal&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.65-2EAD33?logo=playwright&logoColor=white)
![AG Grid](https://img.shields.io/badge/AG_Grid-36_Community-0F7FFF)

[**Live app**](https://veriflow-web-f4u1.onrender.com) · [Features](#key-features) · [Screenshots](#product-tour) · [Architecture](#architecture) · [Getting started](#getting-started) · [API](#rest-api)

<br />

<img src="docs/screenshots/landing-hero.png" alt="Veriflow landing page: 'Money moves only when the work is proven', next to a $200 escrow card for a bakery landing page job being checked on try 1 of 2, with 2 of 4 checklist items passed so far and the PayPal capture still pending" width="100%" />

</div>

---

## Table of contents

- [Overview](#overview)
- [Try it (for judges)](#try-it-for-judges)
- [How we use PayPal](#how-we-use-paypal)
- [How we use AI](#how-we-use-ai)
- [Sponsor and third-party integrations](#sponsor-and-third-party-integrations)
- [Product tour](#product-tour)
- [Key features](#key-features)
- [How the payout is decided](#how-the-payout-is-decided)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [REST API](#rest-api)
- [Security and reliability](#security-and-reliability)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License and acknowledgements](#license-and-acknowledgements)

## Overview

**The problem.** When you hire someone online, one side has to trust first. If the buyer pays first, the worker might not deliver. If the worker delivers first, the buyer might not pay. Today a person usually checks the work and settles disputes, which is slow, expensive and often unfair. It gets harder still as AI agents start hiring and paying other agents, with no human checking each deal.

**The approach.** Veriflow is an escrow service where the contract is a **machine-checkable checklist**:

1. **Agree.** The buyer describes the job in plain English. An AI (Google Gemini, with Groq as a text backup) turns it into a weighted checklist, which the buyer edits and approves. The approved checklist is the contract.
2. **Hold.** The buyer approves the payment in the PayPal popup. The money is **authorized, not charged**.
3. **Prove.** The worker submits a GitHub pull request, or for a website a public URL (plus, when the buyer gave a GitHub repo, a pull request with the site's source code in that repo). Checkers gather evidence for every item: test results, changed files, a real browser, AI-judged screenshots, Lighthouse scores.
4. **Release.** A small, tested rule turns the results into a PayPal **capture** (paid in full) or **void** (money back to the buyer). The AI only reports results; it never moves money.

**Who it's for.** Buyers hiring freelancers for code or website work, freelancers who want to be paid as soon as their work provably meets the brief, and platforms exploring **agentic commerce**, where automated agents need a neutral way to verify work before paying.

> Built by team **3Bit-Crew** for the **PayPal AI Hackathon** on Devpost. Everything runs in the **PayPal sandbox**: no real money moves.

## Try it (for judges)

1. Open the **[live app](https://veriflow-web-f4u1.onrender.com)**. The first visit can take about a minute: the free Render server wakes up, and the app shows a "Waking up the server…" notice meanwhile.
2. **Create a job**: describe the work in plain English and let the AI write the checklist, then edit and approve it.
3. **Hold the payment** in the PayPal popup with the sandbox **buyer** (personal) account. The worker email is already filled in on the New job form: it's the sandbox business account the demo pays.
4. Open the job's **submit link**, send a GitHub pull request or a website URL, and watch the results arrive one by one. The money is then captured or returned to the buyer.
5. See everything in the **[dashboard](https://veriflow-web-f4u1.onrender.com/dashboard)** (AG Grid).

**Sandbox test logins** (fake money) are in the Devpost submission's testing instructions, not in this public repo.
**No accounts at all?** Run the UI in [sample-data mode](#try-the-ui-in-a-minute-no-accounts-needed) in a minute.

## How we use PayPal

PayPal is Veriflow's escrow. The buyer's money is **held** when the job starts and only **moved** once the checks finish. All calls go to the PayPal **sandbox**.

| PayPal feature | What Veriflow does with it | Code |
|---|---|---|
| **OAuth 2.0** (client credentials) | The server logs in with the app's Client ID and Secret and reuses the access token until shortly before it expires. The Secret never leaves the server. | [`server/src/paypal/client.js`](server/src/paypal/client.js) |
| **JavaScript SDK** (`@paypal/react-paypal-js`) | The PayPal button on the job page. The buyer approves the payment in PayPal's own popup. | [`client/src/components/PayPalButton.jsx`](client/src/components/PayPalButton.jsx) |
| **Orders API v2**: create order with `intent: AUTHORIZE` | Creates the order for the job's amount, with the worker as **payee**. `AUTHORIZE` means the money is held, not charged. | [`server/src/paypal/orders.js`](server/src/paypal/orders.js) |
| **Orders API v2**: authorize order | After the buyer approves, locks the hold. We save the authorization id and the payer's email, and the job becomes `FUNDED` only if PayPal confirms the hold. | [`server/src/routes/paypal.js`](server/src/routes/paypal.js) |
| **Payments API v2**: capture authorization | When every checklist item passes, pays the worker the full amount with `final_capture: true`. | [`server/src/paypal/settle.js`](server/src/paypal/settle.js) |
| **Payments API v2**: void authorization | When the work fails, cancels the hold so the buyer keeps all the money. | [`server/src/paypal/settle.js`](server/src/paypal/settle.js) |
| **`PayPal-Request-Id`** (idempotency) | Sent with every authorize, capture and void, so a retried request is never applied twice. | `orders.js`, `settle.js` |

**Why authorize-then-capture:** it is what makes Veriflow an escrow. PayPal guarantees the buyer's money is there, while nobody, including Veriflow, can spend it before the work is proven. Only one function, `settleJob()`, can capture or void, and if PayPal fails the job goes to human review with the money still held. See the [money flow diagram](#money-flow-end-to-end).

**Known limitation:** PayPal lets an app void holds only when the payee is the app's own business account, so the demo uses one shared sandbox worker account (`PAYPAL_WORKER_EMAIL` enforces it). Paying many workers needs PayPal partner onboarding, and "Log in with PayPal" is designed for identity. Both are on the [roadmap](#roadmap).

The PayPal flow was tested end to end (hold, capture, void) with [`server/scripts/paypal-test.js`](server/scripts/paypal-test.js), using real sandbox buyer approvals.

## How we use AI

AI does the parts that need judgement: writing the checklist and judging what a page looks like or does. **It never moves money.** A small, deterministic, tested rule decides the payout from the check results ([`server/src/decision.js`](server/src/decision.js)).

| Where | Model | What it does | Code |
|---|---|---|---|
| **Checklist writing** | Google Gemini (Groq as backup) | Turns the buyer's plain-English request into a checklist of known item kinds, which the buyer edits and approves | [`server/src/ai/checklist.js`](server/src/ai/checklist.js), [`prompts.js`](server/src/ai/prompts.js) |
| **Visual checks** (`visual`) | Google Gemini (vision) | Judges a desktop or phone screenshot against the requirement, e.g. "looks good on mobile" | [`server/src/checkers/visual.js`](server/src/checkers/visual.js) |
| **Interaction checks** (`interaction`) | Groq plans, Gemini judges | Groq turns steps like "click Sign up, type an email, submit" into at most 5 actions on elements that really exist on the page. Playwright performs them, then Gemini compares the before and after screenshots. | [`server/src/checkers/interaction.js`](server/src/checkers/interaction.js) |

**Guardrails**
- **The AI only reports results.** Capture or void is decided by fixed rules, never by the model.
- **AI output is cleaned on the server:** only allowed item kinds per job type, at most 8 items, weights normalised to whole numbers that add up to 100, an automatic "the buyer's tests weren't modified" item for code jobs ([`checklistRules.js`](server/src/ai/checklistRules.js)). The approve route checks everything again ([`server/src/validate.js`](server/src/validate.js)).
- **When the AI isn't sure, a person decides.** Any `UNSURE` result or confidence below 70% sends the job to human review instead of failing the worker. A step that can't be done gives `UNSURE`, never `FAIL`.
- **No made-up selectors or URLs.** Interaction plans can only use elements listed from the live page, and the checker's browser blocks localhost and private addresses.
- **Resilient:** if Gemini is busy or out of quota, it falls back to lighter Gemini models, and text tasks can switch to Groq ([`server/src/ai/index.js`](server/src/ai/index.js)).

Everything else is exact, not AI: GitHub Actions results and changed files from the GitHub API, page loads, elements and text from Playwright, and scores from Google Lighthouse.

## Sponsor and third-party integrations

| Integration | How Veriflow uses it |
|---|---|
| **[PayPal Developer](https://developer.paypal.com)** | Escrow: Orders API v2 (authorize), Payments API v2 (capture and void), OAuth 2.0, and the JavaScript SDK button. Sandbox only. See [How we use PayPal](#how-we-use-paypal). |
| **[Render](https://render.com)** | Hosts the live app from a [Render Blueprint](render.yaml): the API runs as a **Docker** web service on the official Playwright image (Chromium preinstalled) with a `/api/health` check, and the React app is a **static site** with a rewrite rule for client-side routes. Auto-deploys from `main`. See [Deployment](#deployment). |
| **[AG Grid](https://www.ag-grid.com)** (Community) | The audit dashboard: 3 grids (jobs, checklist results, events) with custom cell renderers, live row updates with cell flashing, filter chips, a totals row and CSV export. See [`client/src/components/grids/`](client/src/components/grids/). |
| **[Google Gemini](https://ai.google.dev)** | Checklist writing and screenshot judging. See [How we use AI](#how-we-use-ai). |
| **[Groq](https://groq.com)** | Fast planning of interaction steps, and backup for text tasks. |
| **[Playwright](https://playwright.dev)** | A real Chromium browser that opens submitted websites at desktop and phone sizes, takes screenshots and performs interactions. |
| **[GitHub REST API](https://docs.github.com/rest)** and **GitHub Actions** | Reads a pull request's test results (check runs) and changed files, and the source-code pull request of website jobs. A GitHub Actions workflow keeps the free Render API awake. |
| **[Google PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started)** | One Lighthouse run per job for performance, accessibility, best-practices and SEO scores. |
| **[MongoDB Atlas](https://www.mongodb.com/atlas)** | Stores jobs, checklist results, the audit log and screenshots. |

## Product tour

All screenshots come from the running application, using its built-in **sample-data mode** (`VITE_USE_FAKE_API=true`), which runs every screen in the browser with realistic demo jobs and simulated checks.

### Create a job: from plain English to a contract

<img src="docs/screenshots/create-job-checklist.png" alt="Create a job, step 2: the AI-written checklist for a coupon-code job with weights set by slider or typed percentage, beside a dark contract card showing $200.00, the worker, the repository and the all-or-nothing payout rule" width="100%" />

The buyer picks **Code** (a GitHub pull request) or **Website** (a live URL, plus the site's source code as a pull request in the buyer's repo), describes the job, and the AI writes the checklist. Each item can be reworded, reweighted (slider or typed percentage) or removed, with undo. The contract card on the right updates live, and the buyer then holds the payment with the PayPal button. *(The real AI also adds an automatic "the buyer's tests and CI setup were not modified" item to every code job; sample-data mode shows a shorter checklist.)*

### Live verification, result by result

<img src="docs/screenshots/job-live-checking.png" alt="Job page while a website job is being checked: $200.00 held in escrow, a score bar at 55%, four items passed including the source code pull request, the interaction check in progress with a spinner, and a live activity timeline" width="100%" />

The job page polls the API every 2 seconds. Results that arrive together are revealed one at a time, about a second apart, so the check reads as progress. The vault card shows what is held, the score bar, and the next step for every status.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/screenshots/job-changes-requested.png" alt="A coupon-code job after the first try: changes requested, $200.00 still held, and the failed tests item open with its evidence: 2 of 6 GitHub checks failed, Rounds to cents and Shipping not discounted" />
      <p><b>First try fails → changes requested.</b> The money stays held, the failed item opens with its evidence (here, the two failing GitHub Actions checks and a link to the test log), and the worker gets one more try.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/screenshots/job-paid-in-full.png" alt="The same job after the second try: every check passed and $200.00 was released to the worker via PayPal" />
      <p><b>Every item passes → paid in full.</b> PayPal captures the hold and the amount counts up to $200.00. The lifecycle bar, the activity timeline and the audit log record every step.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/screenshots/job-voided-protected-files.png" alt="A job where the pull request edited the buyer's test file: the tests passed, but the hold was voided at once and $0.00 was paid, with the reason 'The pull request changed files it must not touch: tests/checkout.test.js'" />
      <p><b>Cheating is caught.</b> A pull request that makes the tests "pass" by editing them fails the protected-files check, and the hold is voided at once, even on the first try.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/screenshots/job-human-review.png" alt="A website job waiting for a person: the AI was not confident about 'Looks good on mobile', and the review box offers Pass or Fail for that item before settling on PayPal" />
      <p><b>Unsure → a person decides.</b> When the AI's confidence is under 70%, nothing moves until a reviewer marks the unsure items Pass or Fail and confirms the PayPal settlement.</p>
    </td>
  </tr>
</table>

### The worker's view

<img src="docs/screenshots/worker-submit.png" alt="The worker submit page: $200.00 held for this job, a field for the pull request URL with a 'Submit for checking' button, the buyer's brief and the checklist that will be checked" width="100%" />

The buyer sends the worker a link to `/jobs/:id/submit`, the only page where work is submitted. It shows what is held, the brief and exactly what will be checked, and validates the URL before sending (for code jobs it must be a pull request in the job's repository).

### Website jobs: the buyer gets the code

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/screenshots/website-submit-source.png" alt="The submit page of a website job: two fields, the live website URL and the pull request with the site's source code in the buyer's repo 3Bit-Crew/veriflow-demo-site, above a Submit for checking button" />
      <p><b>Two links.</b> The worker sends the live site and a pull request with its source code in the buyer's own GitHub repo. Both are checked before anything is sent.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/screenshots/job-website-get-code.png" alt="A paid website job: $200.00 released to the worker, and a Get the code box with the saved commit de475b9 and buttons to browse the code or download it as a ZIP; the details card links the source pull request and the checked commit" />
      <p><b>Get the code.</b> The commit that passed is saved with the job. After the payout the buyer can browse it or download it as a ZIP, even if the worker deletes their branch.</p>
    </td>
  </tr>
</table>

### Audit dashboard built with AG Grid

<img src="docs/screenshots/dashboard-jobs.png" alt="Dashboard: stat cards for money held in escrow, paid out, jobs waiting for review and checks passed, above an AG Grid table of jobs with status pills, a per-job checklist bar, held and paid amounts, tries and a pinned totals row" width="100%" />

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/screenshots/dashboard-checklist-results.png" alt="Checklist results grid: every checklist item from every job with its check type, result, weight, AI confidence bar and reasoning" />
      <p><b>Checklist results:</b> one row per item across all jobs, with result, weight, an AI-confidence bar and the reasoning.</p>
    </td>
    <td width="50%" valign="top">
      <img src="docs/screenshots/dashboard-audit-log.png" alt="Audit log grid: every event from every job, with PayPal, AI and needs-attention events marked by icon, filterable and exportable to CSV" />
      <p><b>Audit log:</b> every event (PayPal orders, holds, captures and voids, check results, reviews), filterable and exportable to CSV.</p>
    </td>
  </tr>
</table>

### Responsive down to phone size

<table>
  <tr>
    <td width="50%" align="center"><img src="docs/screenshots/mobile-job-page.png" alt="The job page on a 390px phone screen: escrow vault card, score bar and status message" width="300" /></td>
    <td width="50%" align="center"><img src="docs/screenshots/mobile-dashboard.png" alt="The dashboard on a 390px phone screen: stat cards and an AG Grid that hides less important columns instead of scrolling sideways" width="300" /></td>
  </tr>
</table>

## Key features

### Escrow on PayPal

- **Authorize now, capture later.** Orders are created with `intent: AUTHORIZE`, so the buyer's money is held, not charged, until the checks finish ([`server/src/paypal/orders.js`](server/src/paypal/orders.js)).
- **Capture or void, exactly once.** Settlement calls the Payments API with `final_capture: true` or voids the authorization. Every authorize, capture and void carries a `PayPal-Request-Id`, so a retried request is never applied twice ([`server/src/paypal/settle.js`](server/src/paypal/settle.js)).
- **Only one code path moves money.** `settleJob()` is the single place a job becomes `SETTLED`; the checker loop and the review route both call it. If PayPal fails, the job is sent to human review with the money still held.

### AI-written, buyer-approved checklists

- Gemini turns the description into items of known **kinds** only, and server-side rules clean up whatever the model returns: allowed kinds per job type, at most 8 items, weights normalised to whole numbers that sum to 100 ([`server/src/ai/checklistRules.js`](server/src/ai/checklistRules.js)).
- **Automatic test protection:** every code job gets a "the buyer's tests and CI setup were not modified" item covering `.github/`, `test/`, `tests/`, `__tests__/`, `spec/` and `*.test.*` / `*.spec.*` files.
- The prompt forbids invented CSS selectors and routes anything that only appears after a click to an **interaction** item.
- If Gemini is busy or out of quota, it falls back through lighter Gemini models, and text generation can switch to **Groq**.

### Evidence-based checkers

| Kind | Job type | How it is checked |
|---|---|---|
| `tests_pass` | Code | Every GitHub Actions check run on the PR's head commit must succeed. Waits up to 5 minutes for running checks. |
| `files_changed` | Code | Which files the PR must or must not touch (folder rules and `*.ext` patterns). |
| `page_loads` · `element_exists` · `text_present` | Website | Playwright (Chromium) opens the site at desktop (1280×800) and phone (390×844) sizes. |
| `visual` | Website | Gemini judges the desktop or mobile screenshot against the requirement. |
| `interaction` | Website | The AI plans up to 5 actions (fill, select, click, press Enter) on the elements it can see, Playwright performs them, and Gemini compares the before and after screenshots. At most 2 per checklist, 2 minutes each. |
| `speed_score` · `lighthouse_score` | Website | One Google PageSpeed Insights call per job asks for every category the checklist needs: performance, accessibility, best practices or SEO. |
| `source_delivered` | Website | Added automatically to every website job that has a GitHub repo (the repo is optional). The site's source code must be a pull request in the buyer's repo, open or merged, changing at least one file. The checked commit is saved, so the buyer owns that exact version (browse or ZIP), even if the branch is deleted later. |

Every checker returns `PASS`, `FAIL` or `UNSURE` with a confidence and a human-readable reason. A checker that crashes or times out returns `UNSURE` instead of throwing, so the job goes to a person rather than failing unfairly.

### Live job page and AG Grid dashboard

- **Job page:** polls every 2 seconds, reveals results one by one, opens failed and unsure items with their evidence (reasoning, screenshots, test-log links, a confidence meter with the 70% line) and shows a lifecycle bar plus an activity timeline.
- **Dashboard** ([`client/src/components/grids/`](client/src/components/grids/)) with three AG Grid Community grids, refreshed every 5 seconds:
  - custom cell renderers: status pills, a mini checklist bar per job, confidence bars, event icons;
  - row updates in place via `getRowId`, so changed cells **flash** when a job settles;
  - filter chips through AG Grid's external filter, combined with quick search;
  - a pinned totals row that follows the filters, and **CSV export**;
  - columns that hide on narrow screens instead of scrolling sideways;
  - only the AG Grid modules in use are registered, and the dashboard is lazy-loaded.

### Built for demos and development

- **Sample-data mode** (`VITE_USE_FAKE_API=true`): the whole UI runs against an in-browser stand-in for the API, with seeded jobs and simulated checks. The job title picks the scenario (`review`, `partial`, `void`, `cheat`, `batch`).
- **Waking-up notice:** if a request takes more than 5 seconds (a sleeping free Render instance), the app says so instead of looking stuck.

## How the payout is decided

The rule lives in [`server/src/decision.js`](server/src/decision.js) and is **all or nothing**: the worker is paid only when every item passes. Weights say how much each item counts toward the score shown in the UI; they do not split the money.

```mermaid
flowchart TD
    A[All checklist items checked] --> B{"A files_changed item failed:<br/>a protected file was touched?"}
    B -- yes --> V1["Void the hold, $0<br/>(any try, no resubmit)"]
    B -- no --> C{"Any item UNSURE<br/>or confidence below 0.7?"}
    C -- yes --> R["NEEDS_REVIEW<br/>a person decides, money stays held"]
    C -- no --> D{Every item PASS?}
    D -- yes --> F["Capture the full amount<br/>(paid in full)"]
    D -- no --> E{First try?}
    E -- yes --> CR["CHANGES_REQUESTED<br/>money held, one resubmit"]
    E -- no --> V2["Void the hold, $0<br/>(buyer keeps everything)"]
```

A try is counted when the worker submits (`POST /api/jobs/:id/submit`), not when checking starts, so a server restart can't use up a try. In human review, the reviewer marks each unsure item Pass or Fail, and the app settles for the full amount (all Pass) or $0 (any Fail).

## Architecture

### System overview

```mermaid
flowchart LR
    subgraph Browser
        UI["React 19 + Vite SPA<br/>PayPal JS SDK · AG Grid"]
    end
    subgraph Render
        API["Express 5 API<br/>(Docker, Playwright image)"]
        LOOP["Checker loop<br/>(same process)"]
        API --- LOOP
    end
    DB[("MongoDB Atlas<br/>jobs · events · screenshots")]
    PP["PayPal Orders v2<br/>and Payments (sandbox)"]
    GH["GitHub REST API<br/>check runs · PR files"]
    AI["Google Gemini<br/>Groq (text backup)"]
    PSI["PageSpeed Insights<br/>(Lighthouse)"]
    SITE["Submitted website"]
    UI -- "REST, JSON" --> API
    UI -- "PayPal popup" --> PP
    API --> DB
    API -- "create, authorize,<br/>capture, void" --> PP
    API -- "checklist" --> AI
    LOOP --> GH
    LOOP -- "Chromium" --> SITE
    LOOP -- "judge screenshots,<br/>plan interactions" --> AI
    LOOP --> PSI
    LOOP --> DB
```

**Why the checker runs inside the API process:** background workers aren't free on Render, so the Express server runs a loop every 5 seconds that claims one `SUBMITTED` job at a time (an atomic `SUBMITTED → CHECKING` update), runs its checkers, saves the results and applies the payout rule. One job at a time keeps Chromium within the free plan's memory.

**Why read GitHub Actions instead of running code:** running untrusted code on our server would be unsafe. GitHub already runs the buyer's tests in its own sandbox, so Veriflow only reads the results.

### Job lifecycle

```mermaid
stateDiagram-v2
    [*] --> DRAFT: POST /api/jobs
    DRAFT --> CHECKLIST_READY: buyer approves the checklist
    CHECKLIST_READY --> FUNDED: PayPal authorization (money held)
    FUNDED --> SUBMITTED: worker submits a PR or URL
    SUBMITTED --> CHECKING: checker loop claims the job
    CHECKING --> SUBMITTED: GitHub checks still running
    CHECKING --> CHANGES_REQUESTED: first try failed
    CHANGES_REQUESTED --> SUBMITTED: worker resubmits (last try)
    CHECKING --> NEEDS_REVIEW: AI unsure or payment failed
    CHECKING --> SETTLED: capture (full) or void ($0)
    NEEDS_REVIEW --> SETTLED: reviewer decides
    SETTLED --> [*]
```

### Money flow, end to end

```mermaid
sequenceDiagram
    autonumber
    actor Buyer
    actor Worker
    participant Web as React app
    participant API as Express API
    participant PP as PayPal (sandbox)
    participant Checker as Checker loop
    Buyer->>Web: Approve checklist, click PayPal
    Web->>API: POST /api/paypal/orders
    API->>PP: Create order (intent AUTHORIZE, payee = worker)
    PP-->>Web: Buyer approves in the PayPal popup
    Web->>API: POST /api/paypal/orders/:orderId/authorize
    API->>PP: Authorize the order
    API-->>Web: Job FUNDED (money held)
    Worker->>Web: Submit pull request or URL
    Web->>API: POST /api/jobs/:id/submit
    Checker->>Checker: Run checkers, apply the payout rule
    alt every item passes
        Checker->>PP: Capture the full amount (final_capture)
    else last try fails or protected files changed
        Checker->>PP: Void the authorization
    else first try fails
        Checker->>API: CHANGES_REQUESTED, money stays held
    end
```

### Data model

Checklist items are embedded in the job document; events and screenshots have their own collections ([`server/src/models/`](server/src/models/)).

```mermaid
erDiagram
    JOB ||--|{ CHECKLIST_ITEM : "embeds"
    JOB ||--o{ EVENT : "audit log"
    JOB ||--o{ SCREENSHOT : "evidence"
    JOB {
        string title
        string description
        string type "code or website"
        string repoUrl
        number amount
        string workerEmail "payee"
        string status
        string paypalOrderId
        string paypalAuthId
        string submissionUrl
        string sourcePrUrl "website: source code PR"
        string sourceCommit "website: checked commit"
        number attempts
        number payoutAmount
        string settlement "FULL, PARTIAL or VOID"
    }
    CHECKLIST_ITEM {
        string text
        string kind
        object params
        number weight
        string status "PENDING, PASS, FAIL or UNSURE"
        number confidence
        string reasoning
        object evidence "screenshot ids, log URL"
    }
    EVENT {
        objectId jobId
        string type
        string message
        object data
    }
    SCREENSHOT {
        objectId jobId
        string viewport "desktop or mobile"
        buffer data "JPEG"
    }
```

## Technology stack

| Area | Technology |
|---|---|
| **Frontend** | [React](https://react.dev) 19, [Vite](https://vite.dev) 8, React Router 7, plain CSS with design tokens (Geist, Geist Mono and Instrument Serif fonts) |
| **Data grid** | [AG Grid](https://www.ag-grid.com) 36 Community (`ag-grid-react`), modular registration |
| **Payments** | [PayPal](https://developer.paypal.com) Orders API v2 and Payments API (sandbox), `@paypal/react-paypal-js` 10 on the client |
| **Backend** | Node.js, [Express](https://expressjs.com) 5 (ES modules), `cors`, `dotenv` |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/atlas) with [Mongoose](https://mongoosejs.com) 9 |
| **AI** | Google Gemini via `@google/genai` (checklists, screenshot judging, interaction judging), [Groq](https://groq.com) via `groq-sdk` (text backup, interaction planning) |
| **Checkers** | GitHub REST API, [Playwright](https://playwright.dev) 1.65 (Chromium), Google PageSpeed Insights (Lighthouse) |
| **Hosting** | [Render](https://render.com) Blueprint: Docker web service (official Playwright image) for the API, static site for the client |
| **Automation** | GitHub Actions keep-awake ping for the API |

## Project structure

```text
Veriflow/
├── client/                         React single-page app (Vite)
│   └── src/
│       ├── pages/                  Landing, NewJob, Submit, JobStatus, Dashboard (lazy-loaded)
│       ├── components/
│       │   ├── grids/              AG Grid setup (VfGrid) and the jobs, results and audit grids
│       │   ├── ui.jsx              Design pieces: icons, hold/score bar, pills, count-up, toast
│       │   └── …                   ChecklistEditor, ChecklistView, ReviewBox, SubmitBox, PayPalButton
│       ├── fake/fakeApi.js         In-browser stand-in for the API (sample-data mode)
│       ├── api.js                  One function per API endpoint
│       └── styles.css              Design tokens and all styles
├── server/                         Express API and checker loop
│   ├── src/
│   │   ├── index.js                App setup, CORS, error handler, graceful shutdown
│   │   ├── routes/                 jobs, paypal, events, screenshots
│   │   ├── validate.js             Input validation and private-address blocking
│   │   ├── paypal/                 OAuth token cache, orders, settleJob()
│   │   ├── ai/                     Gemini and Groq wrappers, prompts, checklist rules
│   │   ├── checkers/               github, website, interaction, visual, speed, loop
│   │   ├── decision.js             The payout rule
│   │   └── models/                 Job, Event, Screenshot (Mongoose)
│   ├── scripts/                    Standalone scripts that exercise each part
│   └── Dockerfile                  Playwright-based image for Render
├── demo/README.md                  The demo repository and demo website used in the video
├── docs/screenshots/               Images used in this README
├── .github/workflows/keep-awake.yml  Pings the API every 10 minutes
├── render.yaml                     Render Blueprint for both services
└── PLAN.md                         Team plan and the shared contracts between the parts
```

## Getting started

### Try the UI in a minute (no accounts needed)

Sample-data mode runs every screen in the browser with demo jobs and simulated checks: no server, database, PayPal or AI keys.

```bash
git clone https://github.com/3Bit-Crew/Veriflow.git
cd Veriflow/client
npm install
cp .env.example .env        # then set VITE_USE_FAKE_API=true
npm run dev                 # http://localhost:5173
```

The "Sample data · Reset" button in the navigation bar resets the demo data.

### Full local setup

**Prerequisites**

- **Node.js 22** or newer (the Render static site builds with Node 22)
- A **MongoDB** connection string (a free [MongoDB Atlas](https://www.mongodb.com/atlas) M0 cluster works)
- A **PayPal developer** account with a sandbox REST app, plus sandbox **personal** (buyer) and **business** (worker) test accounts
- A **Google Gemini** API key ([Google AI Studio](https://aistudio.google.com)); optional Groq, GitHub and PageSpeed keys

**1. Backend**

```bash
cd server
npm install
npx playwright install chromium     # the browser used by the website checkers
cp .env.example .env                # fill it in, see the table below
npm run dev                         # nodemon, http://localhost:5000
```

Check it: <http://localhost:5000/api/health> returns `{"ok":true,"db":"connected"}`.

**2. Frontend**

```bash
cd client
npm install
cp .env.example .env                # VITE_API_URL=http://localhost:5000
npm run dev                         # http://localhost:5173
```

The server only accepts requests from the origins in `CLIENT_URL` (default `http://localhost:5173`), which is why Vite is pinned to port 5173.

> On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

**3. PayPal sandbox**

1. In the [PayPal developer dashboard](https://developer.paypal.com/dashboard/) (Sandbox mode), create a REST app and copy its **Client ID** and **Secret**.
2. Under **Sandbox Accounts**, note a **personal** account (the buyer logs in with it in the PayPal popup) and the **business** account that owns the app.
3. Use that business account as the job's **worker email**. PayPal only lets an app void an authorization whose payee is its own account, so set `PAYPAL_WORKER_EMAIL` to it to enforce this.

**4. Try a job**

Create a job, let the AI write the checklist, approve it, and hold the payment with the sandbox buyer. Then open the job's submit link and send a pull request or website URL. Code jobs need a repository with a GitHub Actions workflow that runs on pull requests; without one there are no tests to read and the job goes to human review. The demo repository and website used in the video are described in [`demo/README.md`](demo/README.md).

### Environment variables

<details open>
<summary><b>Server</b> (<code>server/.env</code>, template: <a href="server/.env.example"><code>server/.env.example</code></a>)</summary>

| Variable | Description | Required | Example |
|---|---|---|---|
| `MONGODB_URI` | MongoDB connection string | Yes | `mongodb+srv://user:password@cluster.mongodb.net/veriflow` |
| `PAYPAL_CLIENT_ID` | PayPal sandbox app Client ID | Yes | `AbC…` |
| `PAYPAL_CLIENT_SECRET` | PayPal sandbox app Secret (server only) | Yes | `EfG…` |
| `GEMINI_API_KEY` | Google Gemini key for checklists and screenshot judging | Yes | `AIza…` |
| `PORT` | Port to listen on (Render sets it) | No | `5000` |
| `CLIENT_URL` | Allowed browser origins for CORS, comma-separated | No | `http://localhost:5173` |
| `PAYPAL_API_BASE` | PayPal API base URL | No | `https://api-m.sandbox.paypal.com` |
| `PAYPAL_WORKER_EMAIL` | If set, the only worker email accepted (the sandbox business account that owns the app) | No | `merchant@business.example.com` |
| `PAYPAL_MOCK` | Skip PayPal for jobs that have no authorization (test scripts only) | No | `false` |
| `AI_PROVIDER` | Text provider: `gemini` or `groq` (images always use Gemini) | No | `gemini` |
| `GEMINI_MODEL` | Override the main Gemini model | No | `gemini-3.5-flash` |
| `GEMINI_FALLBACK_MODEL` | Comma-separated models to try when the main one is busy | No | `gemini-3.5-flash-lite,gemini-3.1-flash-lite` |
| `GROQ_API_KEY` | Groq key: text backup and fast interaction planning | No | `gsk_…` |
| `GROQ_MODEL` | Override the Groq model | No | `openai/gpt-oss-120b` |
| `GITHUB_TOKEN` | Read-only GitHub token (raises the API rate limit) | No | `github_pat_…` |
| `PAGESPEED_API_KEY` | PageSpeed Insights key (without it, speed and Lighthouse checks hit the shared quota and come back unsure) | No | `AIza…` |
| `INTERACTION_CHECKS` | `true` lets the AI write `interaction` items | No | `true` |
| `CHECKER_LOOP` | Set `false` to turn the checker loop off; run it on only one server per database | No | `true` |
| `DNS_SERVERS` | Public DNS for MongoDB SRV lookups if your network blocks them | No | `8.8.8.8,1.1.1.1` |

</details>

<details open>
<summary><b>Client</b> (<code>client/.env</code>, template: <a href="client/.env.example"><code>client/.env.example</code></a>)</summary>

| Variable | Description | Required | Example |
|---|---|---|---|
| `VITE_API_URL` | Base URL of the API | Yes (real mode) | `http://localhost:5000` |
| `VITE_PAYPAL_CLIENT_ID` | The same PayPal Client ID as the server (never the secret) | Yes (real mode) | `AbC…` |
| `VITE_USE_FAKE_API` | `true` runs the UI on sample data in the browser | No | `false` |

</details>

### Commands

| Where | Command | What it does |
|---|---|---|
| `client/` | `npm run dev` | Vite dev server on port 5173 |
| `client/` | `npm run build` | Production build into `client/dist` |
| `client/` | `npm run preview` | Serve the production build locally |
| `server/` | `npm run dev` | API with auto-restart (nodemon) |
| `server/` | `npm start` | API in production mode |

<details>
<summary><b>Scripts that exercise each part</b> (run from <code>server/</code>)</summary>

The project has no unit-test framework; these scripts call the real modules directly.

| Script | What it checks |
|---|---|
| `node scripts/test-decision.js` | Every case of the payout rule. No database, no AI. |
| `node scripts/test-checklist.js` | AI checklist generation (`AI_PROVIDER=groq` to try Groq) |
| `node scripts/test-github.js <PR URL> [--touch=path] [--not-touch=path] [--now]` | The pull request checker |
| `node scripts/test-website.js <URL> [--text=…] [--selector=…]` | The website checker; saves both screenshots |
| `node scripts/test-source-pr.js <repo URL> <PR URL>` | The website source-code check; prints the saved commit and ZIP link |
| `node scripts/test-interaction.js <URL> "<expected result>" "<steps>" [desktop\|mobile]` | One interaction check |
| `node scripts/test-judge.js <image> "<requirement>" [desktop\|mobile]` | The AI screenshot judge |
| `node scripts/test-loop.js [--keep]` | The checker loop against the real database (creates and deletes `[TEST]` jobs) |
| `node scripts/paypal-test.js start <worker email>` then `finish <orderId1> <orderId2>` | Hold, capture and void in the PayPal sandbox |
| `node scripts/smoke-test.js <API URL> [web URL]` | A deployed server, read-only, including CORS |

</details>

## REST API

All responses are JSON. Errors are `{ "error": "message" }` with status `400` (bad input), `404` (not found), `409` (wrong job status for this action), `402` (PayPal declined the authorization) or `500`/`502` (server or PayPal failure). Routes are defined in [`server/src/routes/`](server/src/routes/).

| Method | Path | Purpose | Allowed when the job is |
|---|---|---|---|
| `GET` | `/api/health` | Liveness and database status | — |
| `POST` | `/api/jobs` | Create a job `{ title, description, type, amount, workerEmail, repoUrl }` (`repoUrl` required for code and website jobs) | — |
| `GET` | `/api/jobs` | All jobs, newest first | — |
| `GET` | `/api/jobs/:id` | `{ job, events }` (events newest first) | — |
| `POST` | `/api/jobs/:id/checklist` | Ask the AI for a checklist | `DRAFT` |
| `PUT` | `/api/jobs/:id/checklist` | Approve the edited checklist `{ items: [{ text, kind, params, weight }] }` | `DRAFT` |
| `POST` | `/api/paypal/orders` | Create the PayPal order `{ jobId }` → `{ orderId }` | `CHECKLIST_READY` |
| `POST` | `/api/paypal/orders/:orderId/authorize` | Authorize after buyer approval `{ jobId }` | `CHECKLIST_READY` |
| `POST` | `/api/jobs/:id/submit` | Submit work `{ submissionUrl, sourcePrUrl? }` (`sourcePrUrl` required for website jobs; counts a try) | `FUNDED`, `CHANGES_REQUESTED` |
| `POST` | `/api/jobs/:id/review` | Human decision `{ payoutAmount }` (0 to the job amount) | `NEEDS_REVIEW` |
| `GET` | `/api/events` | Audit log (latest 1,000), each with `jobTitle` | — |
| `GET` | `/api/screenshots/:id` | A checker screenshot (JPEG) | — |

**Authentication:** none yet. Any client that knows a job's id can call these routes (see [Security](#security-and-reliability) and the [Roadmap](#roadmap)).

## Security and reliability

**What is implemented**

- **Input validation** on every write route ([`server/src/validate.js`](server/src/validate.js)): amounts above 0, at most 10,000 and at most 2 decimals; GitHub repository and pull-request URL formats, with the PR required to be in the job's repository; allowed checklist kinds and parameters per job type; weights summing to 100; at most 8 items, at most 2 interaction items, one Lighthouse item per category.
- **Server-side request protection:** submitted website URLs that point to `localhost` or private and link-local address ranges are rejected, and the interaction checker's browser blocks requests to private hosts by name.
- **Secrets stay on the server:** the PayPal Secret is only used by Express; the client gets the public Client ID. `.env` files are git-ignored and only `.env.example` templates are committed.
- **CORS allowlist** from `CLIENT_URL`; consistent JSON errors without stack traces.
- **Idempotent payments:** `PayPal-Request-Id` on authorize, capture and void; `final_capture: true`; a failed settlement leaves the job in human review with the money held.
- **Worker account lock:** with `PAYPAL_WORKER_EMAIL` set, jobs can only pay the sandbox account that is allowed to void, so a failed job can always return the buyer's money.
- **No double submits:** submitting work checks the job's status, counts the try and resets the results in one atomic database update, so two submits at the same moment can't both count, and a submit can't overwrite a check that is already running.
- **Resilient checking:** checkers never throw (problems become `UNSURE`); jobs stuck in `CHECKING` for 10 minutes are re-queued every minute; on `SIGTERM` the server stops taking jobs and waits up to 25 seconds for a running check; tries are counted at submission so restarts can't consume them.
- **Audit trail:** every state change, PayPal call and check result is written to the `events` collection and shown in the dashboard.
- **Container:** the API image runs as the non-root `pwuser`.

**Known limitations (this is a hackathon prototype)**

- **No authentication or authorisation yet:** anyone with a job's id can approve its checklist, submit work or decide a review. Per-job keys and "Log in with PayPal" are designed but not built ([Roadmap](#roadmap)).
- **No rate limiting.**
- The private-address check looks at host names, so a public page that redirects to a private address, or a domain that resolves to one, is not blocked; checker screenshots are publicly readable.
- **PayPal sandbox only**, with a single shared worker account.

## Deployment

The repository includes a [Render Blueprint](render.yaml) that creates both services from `main` with auto-deploy:

| Service | Type | Details |
|---|---|---|
| `veriflow-api` | Docker web service (free plan) | Built from [`server/Dockerfile`](server/Dockerfile), based on `mcr.microsoft.com/playwright:v1.65.0-noble`, so Chromium is preinstalled. Health check: `/api/health`. Runs the checker loop (`CHECKER_LOOP=true`). |
| `veriflow-web` | Static site | `npm ci && npm run build` in `client/`, publishes `dist`, rewrites every path to `index.html` for client-side routing. Node 22. |

**Steps**

1. In Render choose **New → Blueprint** and select this repository.
2. Enter the values marked `sync: false`: `MONGODB_URI`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WORKER_EMAIL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `GITHUB_TOKEN`, `PAGESPEED_API_KEY`, `CLIENT_URL` on the API, and `VITE_API_URL`, `VITE_PAYPAL_CLIENT_ID` on the static site.
3. After the first deploy, set `CLIENT_URL` to the static site's URL and `VITE_API_URL` to the API's URL, then redeploy the static site (Vite variables are read at build time).
4. In MongoDB Atlas → Network Access, allow Render to connect.

The Docker image tag must match the `playwright` version in `server/package-lock.json`. Free Render services sleep after about 15 idle minutes; [`.github/workflows/keep-awake.yml`](.github/workflows/keep-awake.yml) pings the API every 10 minutes from `main`, and the client shows a "Waking up the server…" notice when a request is slow.

**Live deployment:** [veriflow-web-f4u1.onrender.com](https://veriflow-web-f4u1.onrender.com) · API health: [veriflow-api-wzi0.onrender.com/api/health](https://veriflow-api-wzi0.onrender.com/api/health)

## Roadmap

These are **proposed** or **designed, not built**. Designs are in [PLAN.md](PLAN.md).

- [ ] **Per-job secret keys** for buyer, worker and reviewer actions (PLAN.md 5.10).
- [ ] **Log in with PayPal** (OpenID Connect) so identity and money both run through PayPal (PLAN.md 5.11).
- [ ] **Hybrid payout rule:** "required" items gate any payment, then "work" items are paid by weight. This prevents both the empty-commit exploit of weight-based payouts and buyers blocking payment with impossible checks (PLAN.md 14).
- [ ] **Agent API and MCP server** so AI agents can post jobs, submit work and check status with an API key.
- [ ] Workers connect their **own PayPal accounts** (partner onboarding) instead of one shared sandbox account.
- [ ] **Milestones:** one job split into several held payments.
- [ ] **Dispute view:** both sides comment, and AI summarises them for the reviewer.
- [ ] Rate limiting and stricter private-network protection for the checkers.

## Contributing

Contributions, bug reports and ideas are welcome.

1. **Fork** the repository and clone your fork.
2. Create a branch from `main`: `git checkout -b feature/short-description`.
3. Make your change, following the existing style: ES modules, plain JavaScript, small focused files, comments that explain *why*. Keep the shared contracts in [PLAN.md](PLAN.md) section 5 (statuses, models, checklist kinds, payout rule, API) in sync with any change to them.
4. **Verify it:** `npm run build` in `client/`, the relevant script in `server/scripts/`, and a run through the UI (sample-data mode is enough for frontend-only changes).
5. Open a **pull request** that explains what changed and why, with screenshots for UI changes.

Found a bug or have a suggestion? [Open an issue](https://github.com/3Bit-Crew/Veriflow/issues) with steps to reproduce, what you expected and what happened.

**Please don't** commit `.env` files or keys, and don't push to `main` while someone is testing or recording: Render redeploys `main` automatically.

## License and acknowledgements

Released under the [MIT License](LICENSE). Copyright © 2026 3Bit-Crew.

Built by **3Bit-Crew** for the **PayPal AI Hackathon** on Devpost, with:
[PayPal Developer](https://developer.paypal.com) (Orders and Payments APIs, sandbox) ·
[AG Grid](https://www.ag-grid.com) ·
[Render](https://render.com) ·
[Google Gemini](https://ai.google.dev) ·
[Groq](https://groq.com) ·
[Playwright](https://playwright.dev) ·
[MongoDB Atlas](https://www.mongodb.com/atlas) ·
[Google PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started).
