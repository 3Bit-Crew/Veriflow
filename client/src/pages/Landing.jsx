import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CountUp, HoldBar, Icon, ResultIcon, resultOf } from '../components/ui.jsx';
import { formatMoney } from '../format.js';

// The hero's live example: our demo website job ($200), where the mobile check fails.
const DEMO_TOTAL = 200;
const DEMO_ITEMS = [
  { text: 'The bakery page loads', weight: 20, final: 'PASS' },
  { text: 'Signup form has an email field', weight: 30, final: 'PASS' },
  { text: 'Signing up shows a thank-you message', weight: 30, final: 'PASS' },
  { text: 'Looks good on mobile', weight: 20, final: 'FAIL' },
];
const SETTLED_TICK = DEMO_ITEMS.length + 2;
const LOOP_TICKS = SETTLED_TICK + 2;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Plays the escrow story on a loop: held, each check resolves, PayPal settles.
// Pauses while the tab is hidden; with reduced motion it shows the settled frame only.
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
    const delay = tick === 0 ? 1600 : tick >= SETTLED_TICK - 1 ? 2200 : 900;
    const timer = setTimeout(() => setTick((t) => (t + 1) % LOOP_TICKS), delay);
    return () => clearTimeout(timer);
  }, [tick, still, resumed]);

  const items = DEMO_ITEMS.map((it, i) => ({
    ...it,
    status: tick > i + 1 ? it.final : tick === i + 1 ? 'CHECKING' : 'PENDING',
  }));
  const settled = tick >= SETTLED_TICK;
  const worth = (it) => (DEMO_TOTAL * it.weight) / 100;
  const paid = items.filter((i) => i.status === 'PASS').reduce((sum, it) => sum + worth(it), 0);
  const done = items.filter((i) => i.status === 'PASS' || i.status === 'FAIL').length;

  return (
    <div className="vault demo" aria-label="Example job: a $200 bakery landing page being checked and paid out">
      <div className="demo__head">
        <span className="eyebrow">Job · Bakery landing page</span>
        {settled ? (
          <span className="lock lock--settled">Settled</span>
        ) : (
          <span className="lock">
            <b />
            {tick === 0 ? 'Held on PayPal' : 'Checking work'}
          </span>
        )}
      </div>
      <div style={{ marginTop: 26 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          {settled ? 'Released to the worker' : 'In escrow'}
        </div>
        <div className="vault__amt" style={{ fontSize: 64 }}>
          {settled ? <CountUp key="paid" value={paid} animate={!still} /> : formatMoney(DEMO_TOTAL)}
          <small>USD</small>
        </div>
      </div>
      <div style={{ margin: '24px 0 18px' }}>
        <HoldBar items={items} dark height={14} gap={4} />
        <div
          style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 9, fontFamily: 'var(--mono)', fontSize: 11 }}
          className="muted"
        >
          <span>{done}/{items.length} checked</span>
          <span>each segment = share of the payment</span>
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
            <span className="v">{formatMoney(worth(it))}</span>
          </div>
        ))}
      </div>
      <div className="demo__split" style={{ opacity: settled ? 1 : 0.35 }}>
        <div className="demo__box">
          <span className="eyebrow">PayPal capture · worker</span>
          <span className="mono" style={{ color: 'var(--lime)' }}>{settled ? formatMoney(paid) : '—'}</span>
        </div>
        <div className="demo__box">
          <span className="eyebrow">Released · buyer</span>
          <span className="mono">{settled ? formatMoney(DEMO_TOTAL - paid) : '—'}</span>
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
    ['PASS', 'PASS', 'FAIL'],
  ][n];
  return <HoldBar items={bars.map((status, i) => ({ weight: [40, 30, 30][i], status }))} height={10} label="" />;
}

const STEPS = [
  ['Agree', 'Buyer', 'Describe the job in plain English. AI turns it into a weighted checklist you approve. The checklist is the contract.'],
  ['Hold', 'PayPal', 'You approve the payment on PayPal. It is authorized and held, not charged.'],
  ['Prove', 'Worker', 'The worker submits a pull request or a live URL. Every item is checked against real evidence.'],
  ['Release', 'Veriflow', 'A fixed rule decides the payout. PayPal captures what passed and releases the rest.'],
];

const RULES = [
  { title: 'Every item passes', text: 'Full payment is captured to the worker.', bar: ['PASS', 'PASS', 'PASS'] },
  { title: 'Some fail on try one', text: 'Money stays held. The worker gets one chance to fix and resubmit.', bar: ['PASS', 'FAIL', 'PASS'] },
  { title: 'Some still fail on try two', text: 'Partial payment for what passed. The rest goes back to the buyer.', bar: ['PASS', 'FAIL', 'PASS'], split: true },
  { title: 'AI is unsure, or under 70% confident', text: 'A person decides. Nothing moves until they do.', bar: ['PASS', 'UNSURE', 'PASS'] },
];

const CHECKS = [
  ['code', 'Code', 'Tests pass', 'Reads the GitHub Actions results on the pull request.', 'GitHub REST API'],
  ['file', 'Code', 'Files changed', "Which files the pull request must, or must not, touch. The buyer's tests are protected automatically.", 'GitHub REST API'],
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
            pays out exactly what passed. No one has to trust first.
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
          <p>The checklist you approve is the contract. Each item carries a weight, and that weight is its share of the money.</p>
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
                {rule.split && (
                  <div className="rule__split"><span>70% paid</span><span>30% back</span></div>
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
