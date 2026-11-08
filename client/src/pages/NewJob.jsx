import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createJob, generateChecklist, getJob } from '../api.js';
import ChecklistEditor from '../components/ChecklistEditor.jsx';
import PayPalButton from '../components/PayPalButton.jsx';
import { formatMoney } from '../format.js';

const STEPS = ['Describe the job', 'Approve the checklist', 'Hold the payment'];

const PLACEHOLDERS = {
  code: 'Fix the login bug so emails with capital letters work. All tests must pass. Don\'t change the database code.',
  website: 'Landing page with the headline "Fresh every morning" and a signup form with an email field and a "Sign up" button. Must look good on mobile.',
};

// Which step a job is on, from its status (PLAN.md 5.1).
function stepFor(job) {
  if (!job || job.status === 'DRAFT') return job?.items.length ? 1 : 0;
  if (job.status === 'CHECKLIST_READY') return 2;
  return 3;
}

// The job id is kept in the URL (?job=...), so a reload or a return visit resumes
// at the right step instead of starting over.
export default function NewJob() {
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get('job');
  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoadError(null);
      return;
    }
    if (job?._id === jobId) return;
    let active = true;
    getJob(jobId)
      .then((result) => active && setJob(result.job))
      .catch((err) => active && setLoadError(err.message));
    return () => {
      active = false;
    };
    // Only the URL drives loading; `job` is read to skip a reload we caused ourselves.
  }, [jobId]);

  async function runGenerate(id) {
    setGenerating(true);
    setGenerateError(null);
    try {
      setJob(await generateChecklist(id));
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate(values) {
    const created = await createJob(values);
    setJob(created);
    setSearchParams({ job: created._id }, { replace: true });
    await runGenerate(created._id);
  }

  if (loadError) {
    return (
      <section className="page page--narrow">
        <h1>Couldn't open this job</h1>
        <p className="form-error" role="alert">{loadError}</p>
        <Link className="button" to="/jobs/new">Start a new job</Link>
      </section>
    );
  }
  if (jobId && !job) return <section className="page page--narrow"><p className="muted">Loading…</p></section>;

  const step = stepFor(job);

  return (
    <section className="page page--narrow">
      <h1>Create a job</h1>
      <Stepper current={step} />

      {job && <JobSummary job={job} />}

      {step === 0 && !job && <JobDetailsForm onSubmit={handleCreate} />}

      {step === 0 && job && (
        <div className="card stack" aria-live="polite">
          {generating ? (
            <>
              <h2 className="loading-title">
                <span className="spinner" aria-hidden="true" />
                Writing your checklist…
              </h2>
              <p className="muted">AI is turning your description into checks. This can take a few seconds.</p>
            </>
          ) : (
            <>
              <h2>Generate the checklist</h2>
              {generateError && <p className="form-error" role="alert">{generateError}</p>}
              <div className="actions">
                <button type="button" className="button button--primary" onClick={() => runGenerate(job._id)}>
                  {generateError ? 'Try again' : 'Generate checklist'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="card stack">
          <div>
            <h2>Review the checklist</h2>
            <p className="muted">
              Each item is checked automatically. Its weight is the share of the payment it's worth if the
              work only partly passes.
            </p>
          </div>
          <ChecklistEditor job={job} onApproved={setJob} />
        </div>
      )}

      {step === 2 && (
        <div className="card stack">
          <div>
            <h2>Hold {formatMoney(job.amount, job.currency)} on PayPal</h2>
            <p className="muted">
              You approve the payment on PayPal, but you're not charged yet. The money is only released
              for checklist items the work passes.
            </p>
          </div>
          <PayPalButton job={job} onAuthorized={setJob} />
        </div>
      )}

      {step === 3 && <Done job={job} />}
    </section>
  );
}

function Stepper({ current }) {
  return (
    <ol className="stepper">
      {STEPS.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li key={label} className={`stepper__step stepper__step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="stepper__number" aria-hidden="true">{state === 'done' ? '✓' : index + 1}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function JobSummary({ job }) {
  return (
    <dl className="summary">
      <div>
        <dt>Job</dt>
        <dd>{job.title}</dd>
      </div>
      <div>
        <dt>Amount</dt>
        <dd className="tabular">{formatMoney(job.amount, job.currency)}</dd>
      </div>
      <div>
        <dt>Worker</dt>
        <dd className="break-anywhere">{job.workerEmail}</dd>
      </div>
      {job.repoUrl && (
        <div>
          <dt>Repo</dt>
          <dd className="break-anywhere">{job.repoUrl.replace('https://github.com/', '')}</dd>
        </div>
      )}
    </dl>
  );
}

function JobDetailsForm({ onSubmit }) {
  const [values, setValues] = useState({
    title: '',
    description: '',
    type: 'code',
    amount: '',
    workerEmail: '',
    repoUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { repoUrl, ...rest } = values;
    const job = {
      ...rest,
      title: rest.title.trim(),
      description: rest.description.trim(),
      workerEmail: rest.workerEmail.trim(),
      amount: Number(rest.amount),
    };
    if (values.type === 'code') job.repoUrl = repoUrl.trim().replace(/\/$/, '');
    try {
      await onSubmit(job);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <fieldset className="field">
        <legend>What kind of work?</legend>
        <div className="segmented">
          <label>
            <input type="radio" name="type" value="code" checked={values.type === 'code'} onChange={set('type')} />
            <span>Code (GitHub pull request)</span>
          </label>
          <label>
            <input type="radio" name="type" value="website" checked={values.type === 'website'} onChange={set('type')} />
            <span>Website (live URL)</span>
          </label>
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" className="input" required value={values.title} onChange={set('title')} placeholder="Fix the login bug" />
      </div>

      <div className="field">
        <label htmlFor="description">What has to be true when the work is done?</label>
        <textarea
          id="description"
          className="input"
          required
          rows={5}
          value={values.description}
          onChange={set('description')}
          placeholder={PLACEHOLDERS[values.type]}
        />
        <p className="field__hint">Be specific. The AI turns this into the checklist the work is tested against.</p>
      </div>

      {values.type === 'code' && (
        <div className="field">
          <label htmlFor="repoUrl">GitHub repo</label>
          <input
            id="repoUrl"
            className="input"
            type="url"
            required
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            pattern="https://github\.com/[^\/\s]+/[^\/\s]+/?"
            title="A repo URL like https://github.com/owner/repo"
            value={values.repoUrl}
            onChange={set('repoUrl')}
            placeholder="https://github.com/owner/repo"
          />
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="amount">Amount (USD)</label>
          <div className="input-prefix">
            <span aria-hidden="true">$</span>
            <input
              id="amount"
              className="input"
              type="number"
              required
              inputMode="decimal"
              min="1"
              step="0.01"
              value={values.amount}
              onChange={set('amount')}
              placeholder="200"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="workerEmail">Worker's PayPal email</label>
          <input
            id="workerEmail"
            className="input"
            type="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            value={values.workerEmail}
            onChange={set('workerEmail')}
            placeholder="worker@example.com"
          />
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Generate checklist'}
        </button>
      </div>
    </form>
  );
}

function Done({ job }) {
  const [copied, setCopied] = useState(false);
  const submitLink = `${window.location.origin}/jobs/${job._id}/submit`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(submitLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still shown for copying by hand.
    }
  }

  if (job.status !== 'FUNDED') {
    return (
      <div className="card stack">
        <h2>This job is already under way</h2>
        <Link className="button button--primary" to={`/jobs/${job._id}`}>Open the job page</Link>
      </div>
    );
  }

  return (
    <div className="card card--good stack">
      <div>
        <h2>{formatMoney(job.amount, job.currency)} is held on PayPal</h2>
        <p className="muted">Nothing is paid out until the work passes the checklist.</p>
      </div>
      <div className="field">
        <label htmlFor="submit-link">Send the worker this link to submit their work</label>
        <div className="copy-row">
          <input id="submit-link" className="input" readOnly value={submitLink} onFocus={(e) => e.target.select()} />
          <button type="button" className="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
      <div className="actions">
        <Link className="button button--primary" to={`/jobs/${job._id}`}>Open the job page</Link>
      </div>
    </div>
  );
}
