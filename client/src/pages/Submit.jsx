import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getJob } from '../api.js';
import ChecklistView, { withChecking } from '../components/ChecklistView.jsx';
import SubmitBox from '../components/SubmitBox.jsx';
import { HoldBar, Icon, StatusPill } from '../components/ui.jsx';
import { formatMoney } from '../format.js';

// The page the buyer sends to the worker. Also used for the one resubmit
// allowed after a failed first try (status CHANGES_REQUESTED).
export default function Submit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    setJob(null);
    setLoadError(null);
    getJob(id)
      .then((result) => active && setJob(result.job))
      .catch((err) => active && setLoadError(err.message));
    return () => {
      active = false;
    };
  }, [id]);

  if (loadError) {
    return (
      <section className="page page--narrow">
        <div className="card empty-state">
          <h1>Couldn't open this job</h1>
          <p role="alert">{loadError}</p>
        </div>
      </section>
    );
  }
  if (!job) {
    return (
      <section className="page">
        <p className="loading-line"><span className="spin" />Loading…</p>
      </section>
    );
  }

  const canSubmit = job.status === 'FUNDED' || job.status === 'CHANGES_REQUESTED';
  const isRetry = job.status === 'CHANGES_REQUESTED';
  const notFunded = job.status === 'DRAFT' || job.status === 'CHECKLIST_READY';

  return (
    <section className="page page--narrow fade">
      <div className="jh">
        <div>
          <span className="eyebrow">{isRetry ? 'Your last try' : 'Submit your work'}</span>
          <div className="jh__title page-heading" style={{ marginTop: 8 }}>
            <h1>{isRetry ? 'Submit your fixed work' : 'Submit your work'}</h1>
            <StatusPill status={job.status} />
          </div>
          <div className="jh__meta job-meta">
            <span>
              <Icon name={job.type === 'code' ? 'code' : 'globe'} size={14} />
              {job.title}
            </span>
          </div>
        </div>
      </div>

      <div className="vault jv">
        <div className="jv__top">
          <div>
            <div className="muted jv__label">{notFunded ? 'Not held yet' : 'Held for this job'}</div>
            <div className="vault__amt jv__amt">
              {formatMoney(job.amount, job.currency)}
              <small>USD</small>
            </div>
          </div>
          {!notFunded && <span className="lock"><b />PayPal hold</span>}
        </div>
        {job.items.length > 0 && (
          <div className="jv__bar"><HoldBar items={withChecking(job)} dark height={16} gap={4} /></div>
        )}
        <div className="jv__msg">
          <div>
            <h2>
              {canSubmit
                ? isRetry
                  ? "Your first try didn't pass every check"
                  : "You're paid when every item passes"
                : notFunded
                  ? "This job isn't funded yet"
                  : 'This work has been submitted'}
            </h2>
            <p className="muted">
              {canSubmit
                ? isRetry
                  ? 'Fix the items marked below, then submit again. This is your last try: if anything still fails, nothing is paid.'
                  : "Every checklist item below is checked automatically, and every one must pass to be paid. Changing a protected file (like the buyer's tests) cancels the job at once."
                : notFunded
                  ? 'You can submit once the buyer has approved the checklist and held the payment.'
                  : 'Follow the checks and the payout on the job page.'}
            </p>
          </div>
          {!canSubmit && (
            <Link className="btn btn--lime" to={`/jobs/${job._id}`}>Open the job page</Link>
          )}
        </div>
        {canSubmit && <SubmitBox job={job} onSubmitted={() => navigate(`/jobs/${job._id}`)} />}
      </div>

      <div className="card side__c" style={{ marginBottom: 8 }}>
        <h2>What the buyer asked for</h2>
        <p>{job.description}</p>
      </div>

      {job.items.length > 0 && (
        <>
          <div className="section-title">
            <h2>{isRetry ? 'Results from your first try' : 'What will be checked'}</h2>
          </div>
          <ChecklistView job={job} />
        </>
      )}
    </section>
  );
}
