import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CountUp, HoldBar, Icon, ResultIcon, resultOf } from '../components/ui.jsx';
import { formatMoney } from '../format.js';

// The hero's live example: our demo website job ($200). Payouts are all or nothing (PLAN.md 5.5),
// so the story is: try 1, one check fails → changes requested, money held; try 2, all pass → paid in full.
const DEMO_TOTAL = 200;
const DEMO_ITEMS = [
  { text: 'The bakery page loads', weight: 20 },
  { text: 'Signup form has an email field', weight: 30 },
  { text: 'Signing up shows a thank-you message', weight: 30 },
  { text: 'Looks good on mobile', weight: 20 },
];
const TRY_ONE = ['PASS', 'PASS', 'PASS', 'FAIL'];
const N = DEMO_ITEMS.length;
// Ticks: 0 held · 1..N try 1 checks · N+1 changes requested · N+2..2N+1 try 2 checks · 2N+2 settled.
const CHANGES_TICK = N + 1;
const TRY_TWO_START = N + 2;
const SETTLED_TICK = 2 * N + 2;
const LOOP_TICKS = SETTLED_TICK + 2; // hold the settled frame a little longer before looping

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function demoFrame(tick) {
  const tryTwo = tick >= TRY_TWO_START;
  const base = tryTwo ? TRY_TWO_START : 1; // the tick at which this try's first check runs
  const finals = tryTwo ? DEMO_ITEMS.map(() => 'PASS') : TRY_ONE;
  const items = DEMO_ITEMS.map((it, i) => {
    const at = base + i;
    const status = tick > at ? finals[i] : tick === at && tick < SETTLED_TICK ? 'CHECKING' : 'PENDING';
    return { ...it, status: tick >= SETTLED_TICK ? 'PASS' : status };
  });
  return { items, tryNumber: tryTwo ? 2 : 1 };
}

// Plays the escrow story on a loop. Explanatory, so slower than UI motion; each step is still
// a quick color change. Pauses while the tab is hidden; with reduced motion it shows the last frame.
function HeroDemo() {
  const [still] = useState(reducedMotion);
  const [tick, setTick] = useState(still ? SETTLED_TICK : 0);
  const [resumed, setResumed] = useState(0);

  useEffect(() => {
    if (still) return undefined;
    if (document.hidden) {
      // Hidden tab: wait for it to come back instead of animating for nobody.
      const onVisible = () => !document.hidden && setResumed((n) => n + 1);
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }
    const delay = tick === 0 ? 1500 : tick === CHANGES_TICK ? 2200 : tick >= SETTLED_TICK ? 2400 : 850;
    const timer = setTimeout(() => setTick((t) => (t + 1) % LOOP_TICKS), delay);
    return () => clearTimeout(timer);
  }, [tick, still, resumed]);

  const { items, tryNumber } = demoFrame(tick);
  const settled = tick >= SETTLED_TICK;
  const changes = tick === CHANGES_TICK;
  const done = items.filter((i) => i.status === 'PASS' || i.status === 'FAIL').length;

  let lock = 'Checking work';
  if (tick === 0) lock = 'Held on PayPal';
  if (changes) lock = 'Changes requested';

  return (
    <div className="vault demo" aria-label="Example job: a $200 bakery landing page, checked twice, then paid in full">
      <div className="demo__head">
        <span className="eyebrow">Job · Bakery landing page</span>
        {settled ? (
          <span className="lock lock--settled">Settled</span>
        ) : (
          <span className={`lock${changes ? ' lock--warn' : ''}`}>
            <b />
            {lock}
          </span>
        )}
      </div>
      <div style={{ marginTop: 26 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          {settled ? 'Released to the worker' : changes ? 'Still held. One more try.' : 'In escrow'}
        </div>
        <div className="vault__amt" style={{ fontSize: 64 }}>
          {settled ? <CountUp key="paid" value={DEMO_TOTAL} animate={!still} /> : formatMoney(DEMO_TOTAL)}
          <small>USD</small>
        </div>
      </div>
      <div style={{ margin: '24px 0 18px' }}>
        <HoldBar items={items} dark height={14} gap={4} />
        <div
          style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 9, fontFamily: 'var(--mono)', fontSize: 11 }}
          className="muted"
        >
          <span>{settled ? 'Every item passed' : `${done}/${items.length} checked · try ${tryNumber} of 2`}</span>
          <span>every item must pass</span>
        </div>
      </div>
      <div>
        {items.map((it) => (
          <div key={it.text} className={`demo__row ${resultOf(it.status).key || 'pending'}`}>
            <span className="ic">
              {it.status === 'CHECKING' ? (
                <span className="spin spin--dark" style={{ width: 10, height: 10 }} />
              ) : (
                <ResultIcon status={it.status} size={12} />
              )}
            </span>
            <span className="t">{it.text}</span>
            <span className="w">{it.weight}%</span>
          </div>
        ))}
      </div>
      <div className="demo__split">
        <div className="demo__box" style={{ opacity: settled ? 1 : 0.35 }}>
          <span className="eyebrow">PayPal capture · worker</span>
          <span className="mono" style={{ color: 'var(--lime)' }}>{settled ? formatMoney(DEMO_TOTAL) : '—'}</span>
        </div>
        <div className="demo__box">
          <span className="eyebrow">Try</span>
          <span className="mono">{tryNumber} of 2</span>
        </div>
      </div>
    </div>
  );
}

function StepViz({ n }) {
  if (n === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[90, 70, 80].map((w) => (
          <div key={w} style={{ height: 6, width: `${w}%`, background: 'var(--paper-2)', borderRadius: 3 }} />
        ))}
      </div>
    );
  }
  const bars = [
    null,
    ['PENDING', 'PENDING', 'PENDING'],
    ['PASS', 'CHECKING', 'PENDING'],
    ['PASS', 'PASS', 'PASS'], // released: every item passed
  ][n];
  return <HoldBar items={bars.map((status, i) => ({ weight: [40, 30, 30][i], status }))} height={10} label="" />;
}

const STEPS = [
  ['Agree', 'Buyer', 'Describe the job in plain English. AI turns it into a weighted checklist you approve. The checklist is the contract.'],
  ['Hold', 'PayPal', 'You approve the payment on PayPal. It is authorized and held, not charged.'],
  ['Prove', 'Worker', 'The worker submits a pull request or a live URL. Every item is checked against real evidence.'],
  ['Release', 'Veriflow', 'A fixed rule decides: every item passes and PayPal pays in full. Otherwise the hold goes back to the buyer.'],
];

// The payout rule (PLAN.md 5.5): all or nothing.
const RULES = [
  { title: 'Every item passes', text: 'The full amount is captured to the worker.', bar: ['PASS', 'PASS', 'PASS'], note: ['100% paid'] },
  { title: 'Something fails on try one', text: 'Money stays held. The worker gets one chance to fix and resubmit.', bar: ['PASS', 'FAIL', 'PASS'], note: ['still held'] },
  { title: 'Something still fails on try two', text: 'Nothing is paid. The whole hold goes back to the buyer.', bar: ['PASS', 'FAIL', 'PASS'], note: ['0% paid', '100% back'] },
  { title: 'A protected file was changed', text: "Editing the buyer's tests or CI voids the job at once, even on the first try. No second chance.", bar: ['PASS', 'PASS', 'FAIL'], note: ['voided at once'] },
  { title: 'AI is unsure, or under 70% confident', text: 'A person decides. Nothing moves until they do.', bar: ['PASS', 'UNSURE', 'PASS'] },
];

const CHECKS = [
  ['code', 'Code', 'Tests pass', 'Reads the GitHub Actions results on the pull request.', 'GitHub REST API'],
  ['file', 'Code', 'Files changed', "Which files the pull request must, or must not, touch. The buyer's tests are protected automatically; touching them voids the job.", 'GitHub REST API'],
  ['globe', 'Website', 'Page loads & elements', 'A real browser opens the site and finds the elements and text.', 'Playwright · Chromium'],
  ['cursor', 'Website', 'Interaction (AI)', 'The AI types and clicks like a user, then judges what happened.', 'Playwright · Gemini'],
  ['eye', 'Website', 'Visual check (AI)', 'AI judges desktop and mobile screenshots against the requirement.', 'Gemini vision'],
  ['gauge', 'Website', 'Speed & Lighthouse', 'Performance, accessibility, best-practice and SEO scores from one Lighthouse run.', 'PageSpeed Insights'],
];

export default function Landing() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash === '#how') {
      document.getElementById('how')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="fade">
      <section className="hero">
        <div>
          <span className="pill pill--em">
            <i />
            Escrow for freelance work · on PayPal
          </span>
          <h1>
            Money moves only when the work is <em>proven.</em>
          </h1>
          <p className="hero__sub">
            Veriflow holds the payment on PayPal, checks the delivered work against a checklist you both agreed on, and
            pays only when every item passes. No one has to trust first.
          </p>
          <div className="hero__cta">
            <Link className="btn btn--primary btn--lg" to="/jobs/new">
              Create a job <Icon name="arrow" size={16} />
            </Link>
            <Link className="btn btn--lg" to="/dashboard">See live jobs</Link>
          </div>
          <div className="hero__foot">
            <span><Icon name="lock" size={14} />Authorized, not charged</span>
            <i className="dot" />
            <span><Icon name="shield" size={14} />AI never moves money</span>
            <i className="dot" />
            <span><Icon name="replay" size={14} />One retry for the worker</span>
          </div>
        </div>
        <HeroDemo />
      </section>

      <section className="section" id="how" style={{ scrollMarginTop: 70 }}>
        <div className="section__head">
          <h2>
            Four steps. <em>One contract.</em>
            <br />
            Zero chasing.
          </h2>
          <p>The checklist you approve is the contract. Each item carries a weight: how much it counts toward the score. The money moves only when every item passes.</p>
        </div>
        <ol className="steps">
          {STEPS.map(([title, who, text], i) => (
            <li className="step" key={title}>
              <div className="step__n">
                <span>0{i + 1}</span>
                <span>{who}</span>
              </div>
              <div className="step__viz" aria-hidden="true"><StepViz n={i} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section section--tight">
        <div className="section__head">
          <h2>
            The payout rule is <em>boring</em> on purpose.
          </h2>
          <p>AI reports a result and a confidence for every item. A small, tested rule turns those results into a PayPal capture or void.</p>
        </div>
        <div className="rules">
          {RULES.map((rule) => (
            <div className="card rule" key={rule.title}>
              <div className="rule__viz" aria-hidden="true">
                <HoldBar items={rule.bar.map((status, i) => ({ weight: [40, 30, 30][i], status }))} height={10} label="" />
                {rule.note && (
                  <div className="rule__split">
                    {rule.note.map((n) => <span key={n}>{n}</span>)}
                  </div>
                )}
              </div>
              <div>
                <h3>{rule.title}</h3>
                <p>{rule.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section section--tight">
        <div className="section__head">
          <h2>
            Evidence, <em>not opinions.</em>
          </h2>
          <p>Every check gathers proof you can open: test runs, file diffs, screenshots, scores. All of it lands in the audit log.</p>
        </div>
        <div className="checks">
          {CHECKS.map(([icon, tag, title, text, source]) => (
            <div className="card check" key={title}>
              <div className="check__top">
                <span className="check__icon"><Icon name={icon} size={17} /></span>
                <span className="tag">{tag}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              <div className="check__src">{source}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="vault cta">
        <h2>
          Stop trusting first.
          <br />
          <em>Start proving.</em>
        </h2>
        <div>
          <p className="muted" style={{ fontSize: 16 }}>
            Write the job, approve the checklist, hold the money. It takes about two minutes in the PayPal sandbox.
          </p>
          <div className="cta__actions">
            <Link className="btn btn--lime btn--lg" to="/jobs/new">
              Create a job <Icon name="arrow" size={16} />
            </Link>
            <Link className="btn btn--lg btn--on-dark" to="/dashboard">Open dashboard</Link>
          </div>
        </div>
      </section>
      <footer className="foot">
        <span>Veriflow · 3Bit-Crew · PayPal AI Hackathon</span>
        <span className="mono">Sandbox only · no real money moves</span>
      </footer>
    </div>
  );
}
