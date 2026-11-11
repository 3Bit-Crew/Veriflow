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

## Demo website

To do: a bakery landing page in a good and a broken version (the "Sign up" button cut off on a 390px phone screen), hosted on GitHub Pages or Render Static Site. See PLAN.md 10.1.
