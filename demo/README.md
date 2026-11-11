# Demo material

Everything the demo uses, as described in PLAN.md section 10. Owner: C.

## Demo repo: [3Bit-Crew/veriflow-demo](https://github.com/3Bit-Crew/veriflow-demo)

A small shop checkout. The buyer's job is to add coupon codes. The repo's `main` branch is the shop before the work: no coupons yet, so 5 of the buyer's 6 tests fail on `main`. That's expected, because it's the work being hired.

**Repo URL to type when creating the job:** `https://github.com/3Bit-Crew/veriflow-demo`

**Job description to type** (it names the files, so the AI's "files changed" rules match the repo):
> Add coupon codes to `src/checkout.js`: SAVE10 = 10% off the items, FREESHIP = free shipping. Totals must be correct to the cent. Don't change anything in `src/payment/`.

### The worker's pull requests

Keep these open. Don't merge them.

| PR | Branch | What the worker did | GitHub checks | What Veriflow should do |
|---|---|---|---|---|
| [#1](https://github.com/3Bit-Crew/veriflow-demo/pull/1) | `attempt-1` | Adds coupons, but the 10% also comes off the shipping, and totals aren't rounded to the cent | 4 of 6 pass. Failing: **Shipping not discounted**, **Rounds to cents** | First try: **Changes requested**, money still held |
| [#2](https://github.com/3Bit-Crew/veriflow-demo/pull/2) | `fix` | Everything right | 6 of 6 pass | Second try: **paid in full** |
| [#3](https://github.com/3Bit-Crew/veriflow-demo/pull/3) | `cheat` | `attempt-1`'s code, plus the tests weakened so they "pass" | 6 of 6 "pass" | The automatic test-protection item fails (PLAN.md 5.3), so it's caught. Use a **separate job** for this one (a job only allows 2 tries) |

`attempt-1` and `fix` change only `src/checkout.js`. `cheat` also changes `tests/checkout.test.js`.

### How the checks work

`.github/workflows/tests.yml` runs each of the 6 tests as its own GitHub Actions job, named after the test. B's `github.js` reads one check per job, so Veriflow reports "2 of 6 check(s) failed: Shipping not discounted (failure), Rounds to cents (failure)" instead of "1 of 1 check(s) failed: test". If a test is renamed or deleted, its job fails, so a typo can't pass silently.

**If a PR shows no checks:** push an empty commit to its branch. Closing and reopening the PR didn't start a run when we tried it on Nov 11.
```
git switch <branch>
git commit --allow-empty -m "Re-run the checks"
git push
```

### Run the tests locally

Needs Node.js 22 or newer. No packages to install. In the demo repo:
```
npm test
```

## Demo website: [3Bit-Crew/veriflow-demo-site](https://github.com/3Bit-Crew/veriflow-demo-site)

A made-up bakery landing page ("Hearth & Crumb"), hosted on GitHub Pages. Two versions of the same page:

| Version | URL to submit | On a phone (390px) |
|---|---|---|
| Good | `https://3bit-crew.github.io/veriflow-demo-site/good/` | Everything fits. The "Sign up" button goes under the email field. |
| Broken | `https://3bit-crew.github.io/veriflow-demo-site/broken/` | The "Sign up" button is cut off at the right edge ("Sign" shows, "up" doesn't) |

On a desktop screen both look the same. The two versions differ only in the signup row's CSS.

**Job description to type** (type: Website):
> Landing page for my bakery with the headline "Fresh every morning", a signup form with an email field and a "Sign up" button. Signing up shows a thank-you message. Must look good on mobile.

What each check finds on both versions:
- the page loads, with an email field (`input[type=email]`), the headline and a "Sign up" button
- typing an email and clicking "Sign up" shows "Thank you, you're on the list!" in place of the form, without loading a new page (for the AI interaction check)
- **only on `broken/`, on a phone**: the button is cut off, which the AI's mobile screenshot check should flag

**Pre-run for the video (PLAN.md 10.2):** submit the broken URL. The first try ends in "Changes requested". Then submit the broken URL again: the second try ends in a partial payout. Submitting the good URL as the second try instead pays in full.

Checked on Nov 11 in a real browser at the checker's screen sizes (1280×800 and 390×844): every item above behaves as described.
