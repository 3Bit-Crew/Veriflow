import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getJob } from '../api.js';
import ChecklistView, { withChecking } from '../components/ChecklistView.jsx';
import ReviewBox from '../components/ReviewBox.jsx';
import { CountUp, HoldBar, Icon, StatusPill, Toast } from '../components/ui.jsx';
import { eventKind, eventLabel } from '../eventKinds.js';
import { formatMoney, formatTime } from '../format.js';

const POLL_MS = 2000;
// Results that arrive together are shown one by one, this far apart, so the check reads as progress.
const REVEAL_MS = 1000;
const MAX_TRIES = 2; // first try plus one resubmit (PLAN.md 5.5)
const FEED_LIMIT = 8;

// Polls GET /api/jobs/:id every 2s until the job is SETTLED. Skips polls while the tab
// is hidden, keeps the last good data if a poll fails, and backs off while failing.
// refresh() fetches straight away, for right after an action like a review.
function useLiveJob(id) {
  const [state, setState] = useState({ data: null, error: null });
  const refreshRef = useRef(() => {});

  useEffect(() => {
    let active = true;
    let timer;
    let generation = 0; // a refresh starts a new chain; older in-flight polls then stop
    setState({ data: null, error: null });

    async function tick(mine) {
      if (document.hidden) {
        timer = setTimeout(() => tick(mine), POLL_MS);
        return;
      }
      let wait = POLL_MS;
      try {
        const data = await getJob(id);
        if (!active || mine !== generation) return;
        setState({ data, error: null });
        if (data.job.status === 'SETTLED') return;
      } catch (error) {
        if (!active || mine !== generation) return;
        setState((current) => ({ data: current.data, error }));
        if (error.status === 404) return;
        wait = POLL_MS * 2;
      }
      timer = setTimeout(() => tick(mine), wait);
    }

    refreshRef.current = () => {
      generation += 1;
      clearTimeout(timer);
      tick(generation);
    };
    tick(generation);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { ...state, refresh };
}

const isResult = (status) => status === 'PASS' || status === 'FAIL' || status === 'UNSURE';

// When several results land in one poll (the checker saves a job's results together),
// shows them one at a time, REVEAL_MS apart, still as "Checking": the next item's spinner
// turns while it waits. The job's real status (and the payout panel) only appears after
// the last result. Presentation only: the data is untouched.
function useStaggeredReveal(latest) {
  const [shown, setShown] = useState(latest);
  const shownRef = useRef(latest);
  const lastRevealRef = useRef(0);

  useEffect(() => {
    if (!latest) return undefined;
    const show = (job) => {
      shownRef.current = job;
      setShown(job);
    };
    const prev = shownRef.current;
    const comparable = prev && prev._id === latest._id && prev.items.length === latest.items.length;
    const landed = comparable
      ? latest.items.map((_, i) => i).filter((i) => !isResult(prev.items[i].status) && isResult(latest.items[i].status))
      : [];
    // Nothing new, or a single result long after the previous one (results arriving one by
    // one already read as progress): show it straight away.
    const recent = Date.now() - lastRevealRef.current < REVEAL_MS;
    if (landed.length === 0 || (landed.length === 1 && !recent)) {
      if (landed.length) lastRevealRef.current = Date.now();
      show(latest);
      return undefined;
    }

    let count = 0;
    let timer;
    const step = () => {
      count += 1;
      lastRevealRef.current = Date.now();
      if (count > landed.length) {
        show(latest);
        return;
      }
      const hidden = new Set(landed.slice(count));
      show({
        ...latest,
        status: 'CHECKING',
        items: latest.items.map((item, i) => (hidden.has(i) ? prev.items[i] : item)),
      });
      timer = setTimeout(step, REVEAL_MS);
    };
    // A poll can arrive mid-reveal and restart this effect: keep the full gap since the
    // last result shown, so results don't bunch up every time the page polls.
    const wait = Math.max(0, REVEAL_MS - (Date.now() - lastRevealRef.current));
    timer = setTimeout(step, wait);
    return () => clearTimeout(timer);
  }, [latest]);

  return shown && latest && shown._id === latest._id ? shown : latest;
}

// Same test as the payout rule (PLAN.md 5.5): unsure, or checked with confidence under 0.7.
const CONFIDENCE_THRESHOLD = 0.7;
const isUnsure = (item) => item.status === 'UNSURE' || (isResult(item.status) && !(Number(item.confidence) >= CONFIDENCE_THRESHOLD));

// Why a job is waiting for a person. The checker also sends jobs here when the PayPal
// payment fails or the check itself breaks, not only when the AI is unsure.
function reviewReason(job) {
  const unsure = job.items.filter(isUnsure);
  if (unsure.length === 1) return `The AI wasn't confident about "${unsure[0].text}".`;
  if (unsure.length > 1) return `The AI wasn't confident about ${unsure.length} items.`;
  if (job.items.some((item) => !isResult(item.status))) {
    return "The automatic check didn't finish, so a person needs to look at the work. The activity log says what happened.";
  }
  return "Every item was checked, but the payout couldn't be completed automatically. The activity log says what happened.";
}

// While a code job waits for its GitHub tests, the checker logs why (PLAN.md 5.6), newest first.
function waitingReason(events) {
  const latest = events?.[0];
  if (latest?.type !== 'CHECK_STARTED') return null;
  if (latest.data?.waiting) {
    return { title: 'Waiting for the tests on GitHub', text: latest.message.replace(/^Waiting for GitHub:\s*/, '') };
  }
  if (latest.data?.requeued) return { title: 'The check was interrupted. It will run again in a moment.', text: null };
  return null;
}

const LIFE = ['Checklist', 'Held', 'Submitted', 'Checked', 'Settled'];
const LIFE_INDEX = { DRAFT: 0, CHECKLIST_READY: 1, FUNDED: 2, SUBMITTED: 3, CHECKING: 3, CHANGES_REQUESTED: 3, NEEDS_REVIEW: 4, SETTLED: 5 };

export default function JobStatus() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, error, refresh } = useLiveJob(id);
  const revealed = useStaggeredReveal(data?.job);
  const [toast, setToast] = useState(() => (location.state?.toast === 'held' ? { type: 'held' } : null));

  // Show the "held" toast once: drop it from history so a reload doesn't repeat it.
  useEffect(() => {
    if (location.state?.toast) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  // The status when this page first loaded, so the payout only counts up when the
  // job settles while someone is watching, not every time a settled job is opened.
  const firstSeen = useRef({ id: null, status: null });
  if (data && firstSeen.current.id !== id) firstSeen.current = { id, status: data.job.status };

  const closeToast = useCallback(() => setToast(null), []);

  if (!data) {
    if (error) {
      return (
        <section className="page page--narrow">
          <div className="card empty-state">
            <h1>{error.status === 404 ? 'Job not found' : "Couldn't load this job"}</h1>
            <p role="alert">{error.message}</p>
            <Link className="btn btn--primary" to="/dashboard">Go to the dashboard</Link>
          </div>
        </section>
      );
    }
    return (
      <section className="page">
        <p className="loading-line"><span className="spin" />Loading…</p>
      </section>
    );
  }

  const { events } = data;
  const job = revealed;
  const watchedSettle = job.status === 'SETTLED' && firstSeen.current.status !== 'SETTLED';
  const reviewed = events?.some((e) => e.type === 'REVIEW_DECIDED');
  const lifeIndex = LIFE_INDEX[job.status] ?? 0;

  function handleSettled(payout) {
    setToast({ type: 'settled', amount: payout });
    refresh();
  }

  return (
    <section className="page fade job-page">
      <Link className="btn btn--ghost btn--sm back" to="/dashboard">
        <Icon name="back" size={14} />
        Dashboard
      </Link>

      <div className="jh">
        <div>
          <div className="jh__title page-heading">
            <h1>{job.title}</h1>
            <StatusPill status={job.status} />
          </div>
          <div className="jh__meta job-meta">
            <span>
              <Icon name={job.type === 'code' ? 'code' : 'globe'} size={14} />
              {job.type === 'code' ? 'Code · GitHub pull request' : 'Website · live URL'}
            </span>
            {job.attempts > 0 && (
              <>
                <i className="dot" />
                <span>Try {Math.min(job.attempts, MAX_TRIES)} of {MAX_TRIES}</span>
              </>
            )}
            <i className="dot" />
            <span className="mono" style={{ fontSize: 12 }}>{formatMoney(job.amount, job.currency)}</span>
          </div>
        </div>
        {job.submissionUrl && (
          <a className="btn btn--sm" href={job.submissionUrl} target="_blank" rel="noreferrer">
            <Icon name="ext" size={13} />
            {job.type === 'code' ? 'Pull request' : 'Open site'}
          </a>
        )}
      </div>

      {error && <p className="notice" role="status" style={{ marginBottom: 16 }}>Lost connection to the server. Retrying…</p>}

      <ol className="card life" aria-label="Job progress">
        {LIFE.map((label, i) => (
          <Fragment key={label}>
            {i > 0 && <li className={`life__line${i < lifeIndex ? ' done' : ''}`} aria-hidden="true" />}
            <li className={`life__s${i < lifeIndex ? ' done' : i === lifeIndex ? ' on' : ''}`} aria-current={i === lifeIndex ? 'step' : undefined}>
              <b aria-hidden="true">{i < lifeIndex && <Icon name="check" size={10} stroke={3} />}</b>
              {label}
            </li>
          </Fragment>
        ))}
      </ol>

      <div className="job">
        <div style={{ minWidth: 0 }}>
          <Vault
            key={job.status}
            job={job}
            events={events}
            reviewed={reviewed}
            countUp={watchedSettle}
            onSettled={handleSettled}
          />

          <div className="card brief">
            <span className="eyebrow">What the buyer asked for</span>
            <p className="brief__text">{job.description}</p>
          </div>

          <div className="section-title">
            <h2>
              Checklist <span className="muted mono">{job.items.length} items · contract</span>
            </h2>
            {job.items.some((item) => isResult(item.status)) && (
              <span className="muted" style={{ fontSize: 12.5 }}>Open a result to see the evidence</span>
            )}
          </div>
          {job.items.length > 0 ? <ChecklistView key={job._id} job={job} /> : <p className="muted">No checklist yet.</p>}
        </div>

        <aside className="side">
          <Details job={job} />
          <Activity events={events} live={job.status !== 'SETTLED'} />
        </aside>
      </div>

      {toast?.type === 'held' && (
        <Toast onDone={closeToast}>
          <b>✓ Held</b>
          {formatMoney(job.amount, job.currency)} is authorized on PayPal. Share the job link with the worker.
        </Toast>
      )}
      {toast?.type === 'settled' && (
        <Toast onDone={closeToast}>
          <b>✓ Settled</b>
          {toast.amount > 0 ? `PayPal paid ${formatMoney(toast.amount, job.currency)} to the worker.` : 'PayPal cancelled the hold.'}
        </Toast>
      )}
    </section>
  );
}

// The dark money card: what's held or paid, the hold bar, and the next step for this status.
function Vault({ job, events, reviewed, countUp, onSettled }) {
  const items = withChecking(job);
  const amount = formatMoney(job.amount, job.currency);
  const passed = job.items.filter((item) => item.status === 'PASS').reduce((sum, item) => sum + item.weight, 0);
  const settled = job.status === 'SETTLED';
  const voided = settled && job.settlement === 'VOID';
  const notHeld = job.status === 'DRAFT' || job.status === 'CHECKLIST_READY';
  const paid = job.payoutAmount ?? 0;
  const back = Math.max(0, Math.round((job.amount - paid) * 100) / 100);
  const message = statusMessage(job, events, reviewed, back);

  return (
    <div className="vault jv">
      <div className="jv__top">
        <div style={{ minWidth: 0 }}>
          <div className="muted jv__label">
            {settled ? (voided ? 'Paid to the worker' : 'Released to the worker') : notHeld ? 'To be held' : 'Held in escrow'}
          </div>
          <div className="vault__amt jv__amt settled__amount">
            {settled ? <CountUp value={paid} currency={job.currency} animate={countUp} /> : amount}
            <small>USD</small>
          </div>
          {settled && (
            <div className="muted mono jv__of">
              of {amount} · {formatMoney(job.settlement === 'VOID' ? job.amount : back, job.currency)} released to the buyer
            </div>
          )}
        </div>
        {settled ? (
          <span className="lock lock--settled">{voided ? 'Voided' : 'Settled'}</span>
        ) : notHeld ? (
          <span className="eyebrow">Not held</span>
        ) : (
          <span className="lock"><b />PayPal hold</span>
        )}
      </div>

      {items.length > 0 && (
        <>
          <div className="jv__bar"><HoldBar items={items} dark height={16} gap={4} /></div>
          <div className="jv__legend">
            <span><i style={{ background: 'var(--lime)' }} />Score {passed}%</span>
            <span><i style={{ background: 'var(--unsure)' }} />Unsure</span>
            <span><i style={{ background: 'var(--fail)' }} />Failed</span>
            <span><i style={{ background: '#2C3833' }} />Not checked</span>
          </div>
        </>
      )}

      <div className="jv__msg">
        <div style={{ minWidth: 0 }}>
          <h2>
            {message.busy && <span className="spin spin--dark" aria-hidden="true" />}
            {message.title}
          </h2>
          {message.text && <p className="muted">{message.text}</p>}
        </div>
        {notHeld && (
          <Link className="btn btn--lime" to={`/jobs/new?job=${job._id}`}>
            {job.status === 'DRAFT' ? 'Finish the checklist' : `Hold ${amount} on PayPal`}
          </Link>
        )}
      </div>

      {settled && !voided && job.sourceCommit && job.repoUrl && <GetCode job={job} />}
      {job.status === 'NEEDS_REVIEW' && <ReviewBox job={job} onSettled={onSettled} />}
      {(job.status === 'FUNDED' || job.status === 'CHANGES_REQUESTED') && <WorkerLink job={job} />}
    </div>
  );
}

function statusMessage(job, events, reviewed, back) {
  const amount = formatMoney(job.amount, job.currency);
  const backText = formatMoney(job.settlement === 'VOID' ? job.amount : back, job.currency);
  const done = job.items.filter((item) => isResult(item.status)).length;

  switch (job.status) {
    case 'DRAFT':
      return { title: 'Finish the checklist', text: 'The checklist needs approving before the payment can be held.' };
    case 'CHECKLIST_READY':
      return { title: 'Waiting for the buyer to hold the payment', text: 'The checklist is approved. Nothing is held yet.' };
    case 'FUNDED':
      return { title: 'Held on PayPal. Waiting for the work.', text: 'Send the worker the link below. Checks start as soon as they submit.' };
    case 'SUBMITTED': {
      const waiting = waitingReason(events);
      if (waiting) return { busy: true, title: waiting.title, text: waiting.text && `${waiting.text} ${amount} stays held meanwhile.` };
      return { busy: true, title: 'Work submitted. Checks start in a moment.', text: job.submissionUrl };
    }
    case 'CHECKING':
      return {
        busy: true,
        title: `Checking try ${job.attempts} of ${MAX_TRIES}`,
        text: `${done} of ${job.items.length} checked · ${amount} stays held until every check finishes`,
      };
    case 'CHANGES_REQUESTED':
      return {
        title: `Changes requested. ${amount} is still held.`,
        text: "The first try didn't pass every check. The worker has one more try: if anything still fails, nothing is paid.",
      };
    case 'NEEDS_REVIEW':
      return {
        title: 'A person needs to decide the payout',
        text: `${reviewReason(job)} ${amount} stays held until someone reviews the evidence below and settles it.`,
      };
    case 'SETTLED':
      if (job.settlement === 'VOID') return { title: 'Hold cancelled. Nothing was paid.', text: voidReason(job, reviewed, backText) };
      // Payouts are all or nothing now; a partial one only exists if set through the review API.
      if (job.settlement === 'PARTIAL') {
        return {
          title: 'Partly paid.',
          text: `${reviewed ? 'A reviewer set this payout.' : 'Part of the payment was captured.'} The other ${backText} went back to the buyer.`,
        };
      }
      return {
        title: reviewed ? 'Paid in full.' : 'Every check passed. Paid in full.',
        text: reviewed ? 'A reviewer approved the full payment.' : 'Captured to the worker via PayPal.',
      };
    default:
      return { title: '', text: '' };
  }
}

// The server's rule marks cheating by this text in a failed "files changed" item (RESTRICTED_FILES_NOTE
// in server/src/decision.js): the pull request touched a file the checklist protects.
const RESTRICTED_FILES_NOTE = 'changed files it must not touch';
const touchedProtectedFiles = (job) =>
  job.items.some((i) => i.kind === 'files_changed' && i.status === 'FAIL' && String(i.reasoning || '').includes(RESTRICTED_FILES_NOTE));

// Why a hold was cancelled (PLAN.md 5.5, all or nothing).
function voidReason(job, reviewed, backText) {
  if (reviewed) return `A reviewer decided not to pay, so ${backText} went back to the buyer.`;
  if (touchedProtectedFiles(job)) {
    return `The worker changed files they were not allowed to touch, so the hold was cancelled at once. ${backText} went back to the buyer.`;
  }
  if (job.items.some((i) => i.status === 'PASS')) {
    return `Some checks still failed on the last try, so nothing was paid. Every item must pass. ${backText} went back to the buyer.`;
  }
  return `The work didn't pass any checks, so ${backText} went back to the buyer.`;
}

const shortSha = (sha) => sha.slice(0, 7);
const repoPath = (url) => url.replace('https://github.com/', '');

// Website jobs (PLAN.md 13.5): after a payout, the exact commit that passed. GitHub keeps
// that commit even if the worker deletes their branch later. Not shown on a voided job:
// nothing was bought.
function GetCode({ job }) {
  const tree = `${job.repoUrl}/tree/${job.sourceCommit}`;
  const zip = `${job.repoUrl}/archive/${job.sourceCommit}.zip`;
  return (
    <div className="review get-code">
      <div className="get-code__text">
        <span className="eyebrow">Get the code</span>
        <p>
          The exact version that passed is saved: commit <span className="mono get-code__sha">{shortSha(job.sourceCommit)}</span> in{' '}
          {repoPath(job.repoUrl)}.
        </p>
      </div>
      <div className="get-code__actions">
        <a className="btn btn--on-dark" href={tree} target="_blank" rel="noreferrer">
          <Icon name="ext" size={14} />
          Browse the code
        </a>
        <a className="btn btn--lime" href={zip}>
          <Icon name="download" size={14} />
          Download ZIP
        </a>
      </div>
    </div>
  );
}

// The link the buyer sends to the worker. Work is only submitted on that page, never here.
function WorkerLink({ job }) {
  const [copied, setCopied] = useState(false);
  const path = `/jobs/${job._id}/submit`;
  const link = `${window.location.origin}${path}`;
  const isRetry = job.status === 'CHANGES_REQUESTED';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still shown for copying by hand.
    }
  }

  return (
    <div className="review worker-link">
      <label className="eyebrow" htmlFor="submit-link">
        {isRetry ? 'The worker resubmits the fix here' : 'Send the worker this link to submit their work'}
      </label>
      <div className="copy-row" style={{ marginTop: 10 }}>
        <input id="submit-link" className="input dark-input" readOnly value={link} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn--on-dark" onClick={copy}>
          <Icon name="copy" size={14} />
          {copied ? 'Copied' : 'Copy'}
        </button>
        <Link className="btn btn--lime" to={path}>
          Open submit page
          <Icon name="arrow" size={14} />
        </Link>
      </div>
    </div>
  );
}

function Details({ job }) {
  const rows = [
    ['Amount', `${formatMoney(job.amount, job.currency)} ${job.currency || 'USD'}`],
    ['Worker', job.workerEmail],
    job.repoUrl && ['Repo', repoPath(job.repoUrl)],
    [
      'Submission',
      job.submissionUrl ? (
        <a href={job.submissionUrl} target="_blank" rel="noreferrer">{job.submissionUrl.replace(/^https?:\/\//, '')}</a>
      ) : (
        '—'
      ),
    ],
    job.sourcePrUrl && [
      'Source code',
      <a href={job.sourcePrUrl} target="_blank" rel="noreferrer">{`Pull request #${job.sourcePrUrl.split('/pull/')[1]}`}</a>,
    ],
    job.sourceCommit && job.repoUrl && [
      'Checked commit',
      <a href={`${job.repoUrl}/tree/${job.sourceCommit}`} target="_blank" rel="noreferrer">{shortSha(job.sourceCommit)}</a>,
    ],
    ['PayPal order', job.paypalOrderId || '—'],
    job.paypalAuthId && ['Authorization', job.paypalAuthId],
    ['Created', formatTime(job.createdAt) || '—'],
  ].filter(Boolean);

  return (
    <div className="card side__c">
      <h2>Details</h2>
      <dl style={{ margin: 0 }}>
        {rows.map(([label, value]) => (
          <div className="kv" key={label}>
            <dt>{label}</dt>
            <dd title={typeof value === 'string' ? value : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Activity({ events, live }) {
  const [all, setAll] = useState(false);
  if (!events?.length) return null;
  const shown = all ? events : events.slice(0, FEED_LIMIT);

  return (
    <div className="card side__c">
      <h2>
        Activity
        {live && <span className="live"><b />live</span>}
      </h2>
      <ol className="feed activity">
        {shown.map((event) => (
          <li key={event._id} className={`feed__i activity__item ${eventKind(event.type)}`}>
            <b aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <strong>{eventLabel(event.type)}</strong>
              <p className="activity__message">{event.message}</p>
              <time dateTime={event.createdAt}>{formatTime(event.createdAt)}</time>
            </div>
          </li>
        ))}
      </ol>
      {events.length > FEED_LIMIT && (
        <button type="button" className="link-button feed__more" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${events.length}`}
        </button>
      )}
    </div>
  );
}
