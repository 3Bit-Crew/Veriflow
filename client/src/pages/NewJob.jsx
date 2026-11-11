import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createJob, generateChecklist, getJob } from '../api.js';
import ChecklistEditor, { CompositionBar } from '../components/ChecklistEditor.jsx';
import PayPalButton from '../components/PayPalButton.jsx';
import { Icon } from '../components/ui.jsx';
import { formatMoney } from '../format.js';

const STEPS = ['Describe the job', 'Approve the checklist', 'Hold the payment'];

// The PayPal sandbox business account that owns our PayPal app. On Render the server accepts
// only this worker email (PAYPAL_WORKER_EMAIL, PLAN.md 5.8), so the form starts with it.
const SANDBOX_WORKER_EMAIL = 'sb-m8uku53787938@business.example.com';

const TITLE_PLACEHOLDERS = {
  code: 'Add coupon codes',
  website: 'Bakery landing page',
};

const PLACEHOLDERS = {
  code: 'Add coupon codes to src/checkout.js: SAVE10 = 10% off the items. All tests must pass. Don\'t change anything in src/payment/.',
  website: 'Landing page with the headline "Fresh every morning" and a signup form with an email field and a "Sign up" button. Must look good on mobile.',
};

// "Fill with an example": the two demo jobs (demo/README.md).
const EXAMPLES = {
  code: {
    title: 'Add coupon codes to the checkout',
    description: "Add coupon codes to src/checkout.js: SAVE10 = 10% off the items, FREESHIP = free shipping. Totals must be correct to the cent. Don't change anything in src/payment/.",
    repoUrl: 'https://github.com/3Bit-Crew/veriflow-demo',
  },
  website: {
    title: 'Bakery landing page',
    description: 'Landing page for my bakery with the headline "Fresh every morning", a signup form with an email field and a "Sign up" button. Signing up shows a thank-you message. Must look good on mobile.',
  },
};

const TYPES = [
  { value: 'code', icon: 'code', title: 'Code', text: 'GitHub pull request, checked by tests and diffs' },
  { value: 'website', icon: 'globe', title: 'Website', text: 'Live URL, checked in a real browser' },
];

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
  const navigate = useNavigate();
  const jobId = searchParams.get('job');
  const [job, setJob] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [values, setValues] = useState({
    title: '',
    description: '',
    type: 'code',
    amount: '200',
    workerEmail: SANDBOX_WORKER_EMAIL,
    repoUrl: '',
  });
  const [draftItems, setDraftItems] = useState(null); // live edits from the checklist editor, for the receipt

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoadError(null);
      return undefined;
    }
    if (job?._id === jobId) return undefined;
    let active = true;
    getJob(jobId)
      .then((result) => active && setJob(result.job))
      .catch((err) => active && setLoadError(err.message));
    return () => {
      active = false;
    };
    // Only the URL drives loading; `job` is read to skip a reload we caused ourselves.
  }, [jobId]);

  const step = stepFor(job);

  // Once the money is held, the job page takes over (with a confirmation toast).
  useEffect(() => {
    if (job && step === 3) navigate(`/jobs/${job._id}`, { replace: true, state: { toast: 'held' } });
  }, [job, step, navigate]);

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

  async function handleCreate(form) {
    const created = await createJob(form);
    setJob(created);
    setSearchParams({ job: created._id }, { replace: true });
    await runGenerate(created._id);
  }

  const handleDraft = useCallback((items) => setDraftItems(items), []);

  if (loadError) {
    return (
      <section className="page page--narrow">
        <div className="card empty-state">
          <h1>Couldn't open this job</h1>
          <p role="alert">{loadError}</p>
          <Link className="btn btn--primary" to="/jobs/new">Start a new job</Link>
        </div>
      </section>
    );
  }
  if (jobId && !job) {
    return (
      <section className="page">
        <p className="loading-line"><span className="spin" />Loading…</p>
      </section>
    );
  }

  const shownStep = Math.min(step === 0 && job ? 1 : step, 2);

  return (
    <section className="page fade">
      <div className="ph" style={{ marginBottom: 0 }}>
        <div>
          <span className="eyebrow">New escrow</span>
          <h1 style={{ marginTop: 8 }}>Create a job</h1>
        </div>
      </div>
      <Stepper current={shownStep} />

      <div className="create">
        <div>
          {step === 0 && !job && <JobDetailsForm values={values} setValues={setValues} onSubmit={handleCreate} />}

          {step === 0 && job && (
            <div className="card form fade" aria-live="polite">
              <div className="form__head">
                <div>
                  <h2>Review the checklist</h2>
                  <p className="muted">Each item is checked automatically. Its weight is its share of the payment if the work only partly passes.</p>
                </div>
              </div>
              {generating ? (
                <div className="gen">
                  <p className="loading-line" style={{ fontSize: 13 }}>
                    <span className="spin" />
                    AI is turning your description into checks…
                  </p>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="gen__ln" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              ) : (
                <>
                  {generateError && <p className="form-error" role="alert">{generateError}</p>}
                  <div className="form__foot">
                    <span className="muted" style={{ fontSize: 13 }}>The AI writes the checklist from your description.</span>
                    <div className="actions">
                      <button type="button" className="btn btn--primary" onClick={() => runGenerate(job._id)}>
                        {generateError ? 'Try again' : 'Generate checklist'} <Icon name="spark" size={15} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 1 && <ChecklistEditor job={job} onApproved={setJob} onChange={handleDraft} />}

          {step === 2 && <HoldStep job={job} onAuthorized={setJob} />}
        </div>

        <Receipt job={job} values={values} items={step === 1 ? draftItems : job?.items} ready={step === 2} />
      </div>
    </section>
  );
}

function Stepper({ current }) {
  return (
    <ol className="stepper">
      {STEPS.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'on' : '';
        return (
          <Fragment key={label}>
            {index > 0 && <li className="stepper__sep" aria-hidden="true" />}
            <li className={`stepper__i ${state}`} aria-current={state === 'on' ? 'step' : undefined}>
              <b aria-hidden="true">{state === 'done' ? <Icon name="check" size={12} stroke={2.4} /> : index + 1}</b>
              {label}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

// The dark "contract" card: what the buyer is agreeing to, updated as they type and edit.
function Receipt({ job, values, items, ready }) {
  const source = job || values;
  const amount = Number(job ? job.amount : values.amount) || 0;
  const list = items || [];
  const total = list.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const type = source.type;
  const repo = (job ? job.repoUrl : values.repoUrl) || '';

  return (
    <aside className="vault receipt" aria-label="Contract summary">
      <div className="receipt__head">
        <span className="eyebrow">Contract</span>
        {ready ? (
          <span className="lock"><b />Ready to hold</span>
        ) : (
          <span className="eyebrow">{job ? 'Draft' : 'Not saved yet'}</span>
        )}
      </div>
      <div className="vault__amt receipt__amt">
        {formatMoney(amount, job?.currency)}
        <small>USD</small>
      </div>
      <div className="muted receipt__title">{source.title?.trim() || 'Untitled job'}</div>
      {list.length > 0 ? (
        <CompositionBar items={list} height={10} dark />
      ) : (
        <div className="hold hold--dark" style={{ height: 10 }}>
          <div className="hold__seg" style={{ flexGrow: 1 }} />
        </div>
      )}
      <div style={{ marginTop: 18 }}>
        <div className="receipt__line"><span>Type</span><span>{type === 'code' ? 'Code · PR' : 'Website · URL'}</span></div>
        <div className="receipt__line"><span>Worker</span><span title={source.workerEmail}>{source.workerEmail || '—'}</span></div>
        {type === 'code' && (
          <div className="receipt__line"><span>Repo</span><span>{repo.replace('https://github.com/', '') || '—'}</span></div>
        )}
        <div className="receipt__line">
          <span>Checklist</span>
          <span>{list.length ? `${list.length} items · ${total}%` : '—'}</span>
        </div>
        <div className="receipt__line"><span>Retries</span><span>1 resubmit</span></div>
        <div className="receipt__line"><span>Human review</span><span>if confidence &lt; 70%</span></div>
      </div>
    </aside>
  );
}

function HoldStep({ job, onAuthorized }) {
  const amount = formatMoney(job.amount, job.currency);
  const timeline = [
    ['Now', `PayPal authorizes ${amount} from your account`, 'lock'],
    ['When work is submitted', 'Each checklist item is checked against evidence', 'eye'],
    ['After the checks', 'PayPal captures what passed. The rest of the hold is released to you.', 'shield'],
  ];
  return (
    <div className="card form fade">
      <div className="form__head">
        <div>
          <h2>Hold {amount} on PayPal</h2>
          <p className="muted">PayPal authorizes the amount and holds it. Nothing is captured until the checks finish.</p>
        </div>
      </div>
      <div className="timeline">
        {timeline.map(([when, what, icon]) => (
          <div className="timeline__i" key={when}>
            <span className="icon-box"><Icon name={icon} size={16} /></span>
            <div>
              <div className="eyebrow">{when}</div>
              <div style={{ fontWeight: 500 }}>{what}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="paypal-zone">
        <PayPalButton job={job} onAuthorized={onAuthorized} />
        <p className="hint" style={{ textAlign: 'center' }}>Sandbox. Log in with a personal sandbox account, not the worker's.</p>
      </div>
    </div>
  );
}

function JobDetailsForm({ values, setValues, onSubmit }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));

  function fillExample() {
    setValues((current) => ({ ...current, ...EXAMPLES[current.type] }));
  }

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
    <form className="card form fade" onSubmit={handleSubmit}>
      <fieldset className="seg">
        <legend className="label">What kind of work?</legend>
        {TYPES.map((t) => (
          <label key={t.value} className="seg__o">
            <input type="radio" name="type" value={t.value} checked={values.type === t.value} onChange={set('type')} />
            <span className="ico"><Icon name={t.icon} size={17} /></span>
            <span>
              <b>{t.title}</b>
              <span>{t.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label className="label" htmlFor="title">Title</label>
        <input
          id="title"
          className="input"
          required
          value={values.title}
          onChange={set('title')}
          placeholder={TITLE_PLACEHOLDERS[values.type]}
        />
      </div>

      <div>
        <label className="label" htmlFor="description">What has to be true when the work is done?</label>
        <textarea
          id="description"
          className="input"
          required
          rows={4}
          value={values.description}
          onChange={set('description')}
          placeholder={PLACEHOLDERS[values.type]}
        />
        <div className="hint hint-row">
          <span>Be specific. The AI turns this into the checklist the work is tested against.</span>
          <span className="mono">{values.description.length}</span>
        </div>
        <div className="examples">
          <button type="button" onClick={fillExample}>✦ Fill with an example</button>
        </div>
      </div>

      {values.type === 'code' && (
        <div className="fade">
          <label className="label" htmlFor="repoUrl">GitHub repo</label>
          <input
            id="repoUrl"
            className="input mono"
            style={{ fontSize: 13 }}
            type="url"
            required
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            pattern="https://github\.com/[^\/\s]+/[^\/\s]+/?"
            title="A repo URL like https://github.com/owner/repo"
            value={values.repoUrl}
            onChange={set('repoUrl')}
            placeholder="https://github.com/owner/repo"
          />
          <div className="hint">Needs a GitHub Actions workflow that runs on pull requests.</div>
        </div>
      )}

      <div className="row2">
        <div className="field--narrow">
          <label className="label" htmlFor="amount">Amount (USD)</label>
          <div className="prefix">
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
        <div>
          <label className="label" htmlFor="workerEmail">Worker's PayPal email</label>
          <input
            id="workerEmail"
            className="input"
            type="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            aria-describedby="workerEmail-hint"
            value={values.workerEmail}
            onChange={set('workerEmail')}
            placeholder="worker@example.com"
          />
        </div>
      </div>
      <p className="hint" id="workerEmail-hint" style={{ marginTop: -12 }}>
        Filled in with our PayPal sandbox worker account. The live demo only accepts this one, so PayPal can return the
        buyer's money if the work fails.
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form__foot">
        <span className="muted" style={{ fontSize: 13 }}>Nothing is charged at this step.</span>
        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? <><span className="spin spin--dark" />Saving…</> : <>Generate checklist <Icon name="spark" size={15} /></>}
          </button>
        </div>
      </div>
    </form>
  );
}
