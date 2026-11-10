import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJob } from '../api.js';
import ChecklistView from '../components/ChecklistView.jsx';
import ReviewBox from '../components/ReviewBox.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatMoney, formatTime } from '../format.js';

const POLL_MS = 2000;
const REVEAL_MS = 150;
const MAX_TRIES = 2; // first try plus one resubmit (PLAN.md 5.5)
const MONEY_EVENTS = ['PAYPAL_AUTHORIZED', 'PAYPAL_CAPTURED', 'PAYPAL_VOIDED'];

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

  return { ...state, refresh: () => refreshRef.current() };
}

const isResult = (status) => status === 'PASS' || status === 'FAIL' || status === 'UNSURE';

// When several results land in one poll (GitHub reports all of a code job's checks at
// once), shows them one at a time, 150ms apart, still as "Checking". The job's real
// status (and the payout panel) only appears after the last result. Presentation only:
// the data is untouched.
function useStaggeredReveal(latest) {
  const [shown, setShown] = useState(latest);
  const shownRef = useRef(latest);

  useEffect(() => {
    if (!latest) return;
    const show = (job) => {
      shownRef.current = job;
      setShown(job);
    };
    const prev = shownRef.current;
    const comparable = prev && prev._id === latest._id && prev.items.length === latest.items.length;
    const landed = comparable
      ? latest.items.map((_, i) => i).filter((i) => !isResult(prev.items[i].status) && isResult(latest.items[i].status))
      : [];
    if (landed.length < 2) {
      show(latest);
      return;
    }

    let count = 0;
    let timer;
    const step = () => {
      count += 1;
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
    step();
    return () => clearTimeout(timer);
  }, [latest]);

  return shown && latest && shown._id === latest._id ? shown : latest;
}

export default function JobStatus() {
  const { id } = useParams();
  const { data, error, refresh } = useLiveJob(id);
  const revealed = useStaggeredReveal(data?.job);

  // The status when this page first loaded, so the payout only counts up when the
  // job settles while someone is watching, not every time a settled job is opened.
  const firstSeen = useRef({ id: null, status: null });
  if (data && firstSeen.current.id !== id) firstSeen.current = { id, status: data.job.status };

  if (!data) {
    if (error) {
      return (
        <section className="page page--narrow">
          <h1>{error.status === 404 ? 'Job not found' : "Couldn't load this job"}</h1>
          <p className="form-error" role="alert">{error.message}</p>
          <Link className="button" to="/dashboard">Go to the dashboard</Link>
        </section>
      );
    }
    return <section className="page"><p className="muted">Loading…</p></section>;
  }

  const { events } = data;
  const job = revealed;
  const watchedSettle = job.status === 'SETTLED' && firstSeen.current.status !== 'SETTLED';

  return (
    <section className="page job-page">
      <div className="stack stack--tight">
        <div className="page-heading">
          <h1>{job.title}</h1>
          <StatusBadge status={job.status} />
        </div>
        <p className="job-meta">
          {formatMoney(job.amount, job.currency)} · {job.type === 'code' ? 'Code (GitHub pull request)' : 'Website'}
          {job.attempts > 0 && ` · Try ${Math.min(job.attempts, MAX_TRIES)} of ${MAX_TRIES}`}
        </p>
      </div>

      {error && (
        <p className="notice" role="status">Lost connection to the server. Retrying…</p>
      )}

      {/* Keyed by status so each new state eases in. */}
      <StatusPanel key={job.status} job={job} countUp={watchedSettle} onReviewed={refresh} />

      <div className="job-layout">
        <div className="stack">
          <ChecklistHeader job={job} />
          {job.items.length > 0 ? (
            <ChecklistView job={job} />
          ) : (
            <p className="muted">No checklist yet.</p>
          )}
        </div>

        <aside className="stack">
          <JobDetails job={job} />
          <Activity events={events} />
        </aside>
      </div>
    </section>
  );
}

function StatusPanel({ job, countUp, onReviewed }) {
  const amount = formatMoney(job.amount, job.currency);
  const submitLink = `/jobs/${job._id}/submit`;

  switch (job.status) {
    case 'DRAFT':
    case 'CHECKLIST_READY':
      return (
        <div className="card stack">
          <div>
            <h2>{job.status === 'DRAFT' ? 'Finish the checklist' : `Hold ${amount} on PayPal`}</h2>
            <p className="muted">
              {job.status === 'DRAFT'
                ? 'The checklist needs approving before the payment can be held.'
                : 'The checklist is approved. Hold the payment so the worker can start.'}
            </p>
          </div>
          <div className="actions">
            <Link className="button button--primary" to={`/jobs/new?job=${job._id}`}>Continue setting up</Link>
          </div>
        </div>
      );

    case 'FUNDED':
      return (
        <div className="card card--held stack">
          <div>
            <h2>{amount} is held on PayPal</h2>
            <p className="muted">Waiting for the worker to submit their work.</p>
          </div>
          <div className="actions">
            <Link className="button button--primary" to={submitLink}>Submit work</Link>
          </div>
        </div>
      );

    case 'SUBMITTED':
      return (
        <div className="card card--held">
          <h2 className="loading-title">
            <span className="spinner" aria-hidden="true" />
            Work submitted. Checks start in a moment.
          </h2>
        </div>
      );

    case 'CHECKING': {
      const done = job.items.filter((item) => item.status !== 'PENDING').length;
      const total = job.items.length;
      return (
        <div className="card card--held stack">
          <h2 className="loading-title">
            <span className="spinner" aria-hidden="true" />
            Checking try {job.attempts} of {MAX_TRIES}
          </h2>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
            <span className="progress__bar" style={{ transform: `scaleX(${total ? done / total : 0})` }} />
          </div>
          <p className="muted tabular">{done} of {total} checked · {amount} stays held until the checks finish</p>
        </div>
      );
    }

    case 'CHANGES_REQUESTED':
      return (
        <div className="card card--warn stack">
          <div>
            <h2>Changes requested. {amount} is still held.</h2>
            <p>The first try didn't pass every check. The worker has one more try to fix it.</p>
          </div>
          <div className="actions">
            <Link className="button button--primary" to={submitLink}>Submit fixed work</Link>
          </div>
        </div>
      );

    case 'NEEDS_REVIEW':
      return (
        <div className="card card--warn stack">
          <div>
            <h2>A person needs to decide the payout</h2>
            <p>The AI wasn't confident about at least one item. {amount} stays held until someone reviews the evidence below and settles it.</p>
          </div>
          <ReviewBox job={job} onSettled={onReviewed} />
        </div>
      );

    case 'SETTLED':
      return <SettledPanel job={job} countUp={countUp} />;

    default:
      return null;
  }
}

function SettledPanel({ job, countUp }) {
  const paid = job.payoutAmount ?? 0;
  const returned = Math.max(0, Math.round((job.amount - paid) * 100) / 100);

  if (job.settlement === 'VOID') {
    return (
      <div className="card stack">
        <div>
          <h2>Hold cancelled. Nothing was paid.</h2>
          <p className="muted">
            The work didn't pass any checks, so {formatMoney(job.amount, job.currency)} went back to the buyer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card card--good settled">
      <p className="settled__amount">
        <CountUp value={paid} currency={job.currency} animate={countUp} />
      </p>
      <p className="settled__line">released to the worker via PayPal</p>
      {job.settlement === 'PARTIAL' && (
        <p className="muted">
          The work passed part of the checklist. The other {formatMoney(returned, job.currency)} went back to the buyer.
        </p>
      )}
    </div>
  );
}

// Counts a money amount up from zero once, for the moment a payout lands.
function CountUp({ value, currency, animate }) {
  const [shown, setShown] = useState(animate ? 0 : value);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) {
      setShown(value);
      return;
    }
    const duration = 900;
    const start = performance.now();
    let frame;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4); // strong ease-out: fast start, gentle landing
      setShown(t === 1 ? value : Math.floor(value * eased * 100) / 100);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);

  return <span className="tabular">{formatMoney(shown, currency)}</span>;
}

function ChecklistHeader({ job }) {
  const checked = job.items.filter((item) => ['PASS', 'FAIL', 'UNSURE'].includes(item.status));
  const passedWeight = job.items.filter((item) => item.status === 'PASS').reduce((sum, item) => sum + item.weight, 0);
  return (
    <div className="section-heading">
      <h2>Checklist</h2>
      {checked.length > 0 && <span className="muted tabular">{passedWeight}% of the work passed</span>}
    </div>
  );
}

function JobDetails({ job }) {
  return (
    <div className="card card--quiet stack">
      <div>
        <p className="label">What the buyer asked for</p>
        <p className="prewrap">{job.description}</p>
      </div>
      <dl className="details">
        {job.submissionUrl && (
          <div>
            <dt>Submitted work</dt>
            <dd className="break-anywhere">
              <a href={job.submissionUrl} target="_blank" rel="noreferrer">{job.submissionUrl}</a>
            </dd>
          </div>
        )}
        {job.repoUrl && (
          <div>
            <dt>Repo</dt>
            <dd className="break-anywhere">{job.repoUrl.replace('https://github.com/', '')}</dd>
          </div>
        )}
        <div>
          <dt>Worker</dt>
          <dd className="break-anywhere">{job.workerEmail}</dd>
        </div>
        {job.paypalAuthId && (
          <div>
            <dt>PayPal authorization</dt>
            <dd className="break-anywhere mono">{job.paypalAuthId}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function Activity({ events }) {
  if (!events?.length) return null;
  return (
    <div className="card card--quiet stack">
      <h2>Activity</h2>
      <ol className="activity">
        {events.map((event) => (
          <li key={event._id} className={MONEY_EVENTS.includes(event.type) ? 'activity__item activity__item--money' : 'activity__item'}>
            <span className="activity__message">{event.message}</span>
            <time className="activity__time" dateTime={event.createdAt}>{formatTime(event.createdAt)}</time>
          </li>
        ))}
      </ol>
    </div>
  );
}
