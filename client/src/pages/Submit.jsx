import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getJob, submitWork } from '../api.js';
import ChecklistView from '../components/ChecklistView.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatMoney } from '../format.js';
import { cleanPullRequestUrl } from '../pullRequest.js';

// Same rules as the submit route (PLAN.md 5.8), so mistakes show before a round trip.
function submissionProblem(job, url) {
  if (job.type === 'code') {
    if (!cleanPullRequestUrl(job.repoUrl, url)) {
      return `Use a pull request from ${job.repoUrl.replace('https://github.com/', '')}, like ${job.repoUrl}/pull/123`;
    }
    return null;
  }
  return /^https?:\/\//.test(url) ? null : 'Enter the full address, starting with https://';
}

// Where the worker sends a PR or website URL. Also used for the one resubmit
// allowed after a failed first try (status CHANGES_REQUESTED).
export default function Submit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [url, setUrl] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
        <h1>Couldn't open this job</h1>
        <p className="form-error" role="alert">{loadError}</p>
      </section>
    );
  }
  if (!job) return <section className="page page--narrow"><p className="muted">Loading…</p></section>;

  const canSubmit = job.status === 'FUNDED' || job.status === 'CHANGES_REQUESTED';
  const isRetry = job.status === 'CHANGES_REQUESTED';
  const isCode = job.type === 'code';

  async function handleSubmit(event) {
    event.preventDefault();
    const value = url.trim();
    const problem = submissionProblem(job, value);
    if (problem) {
      setFieldError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitWork(job._id, value);
      navigate(`/jobs/${job._id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <section className="page page--narrow">
      <div className="stack stack--tight">
        <h1>{isRetry ? 'Submit your fixed work' : 'Submit your work'}</h1>
        <div className="page-heading">
          <span className="job-meta">{job.title}</span>
          <StatusBadge status={job.status} />
        </div>
      </div>

      <div className="card stack">
        <div>
          <h2>{formatMoney(job.amount, job.currency)} is held for this job</h2>
          <p className="muted">You're paid automatically for the checklist items your work passes.</p>
        </div>
        <div>
          <p className="label">What the buyer asked for</p>
          <p className="prewrap">{job.description}</p>
        </div>
      </div>

      {canSubmit ? (
        <form className={`card stack ${isRetry ? 'card--warn' : ''}`} onSubmit={handleSubmit} noValidate>
          {isRetry && (
            <div>
              <h2>Your first try didn't pass every check</h2>
              <p>Fix the items marked below, then submit again. This is your last try: anything still failing isn't paid.</p>
            </div>
          )}
          <div className="field">
            <label htmlFor="submission">{isCode ? 'Pull request URL' : 'Website URL'}</label>
            <input
              id="submission"
              className="input"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="send"
              placeholder={isCode ? `${job.repoUrl}/pull/123` : 'https://your-site.example.com'}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? 'true' : undefined}
              aria-describedby="submission-hint"
            />
            <p id="submission-hint" className={fieldError ? 'field__error' : 'field__hint'}>
              {fieldError ||
                (isCode
                  ? 'Tests run on GitHub Actions. Make sure the workflow runs on your pull request.'
                  : 'The page must be public, so the checker can open it.')}
            </p>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="actions">
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? 'Submitting…' : isRetry ? 'Submit fixed work' : 'Submit for checking'}
            </button>
          </div>
        </form>
      ) : (
        <div className="card stack">
          <h2>{['DRAFT', 'CHECKLIST_READY'].includes(job.status) ? "This job isn't funded yet" : 'This work has been submitted'}</h2>
          <p className="muted">
            {['DRAFT', 'CHECKLIST_READY'].includes(job.status)
              ? 'You can submit once the buyer has approved the checklist and held the payment.'
              : 'Follow the checks and the payout on the job page.'}
          </p>
          <div className="actions">
            <Link className="button" to={`/jobs/${job._id}`}>Open the job page</Link>
          </div>
        </div>
      )}

      {job.items.length > 0 && (
        <div className="stack">
          <h2>{isRetry ? 'Results from your first try' : 'What will be checked'}</h2>
          <ChecklistView job={job} />
        </div>
      )}
    </section>
  );
}
