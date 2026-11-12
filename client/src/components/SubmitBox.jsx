import { useRef, useState } from 'react';
import { submitWork } from '../api.js';
import { needsSourceItem } from '../checklistKinds.js';
import { cleanPullRequestUrl } from '../pullRequest.js';

const repoName = (repoUrl) => repoUrl.replace('https://github.com/', '');

// Same rules as the submit route (PLAN.md 5.8), so mistakes show before a round trip.
export function submissionProblem(job, url) {
  if (job.type === 'code') {
    if (!cleanPullRequestUrl(job.repoUrl, url)) {
      return `Use a pull request from ${repoName(job.repoUrl)}, like ${job.repoUrl}/pull/123`;
    }
    return null;
  }
  return /^https?:\/\//.test(url) ? null : 'Enter the full address, starting with https://';
}

// Website jobs: the site's source code, as a pull request in the buyer's repo (PLAN.md 13.5).
export function sourcePrProblem(job, url) {
  if (!url) return `Add the pull request with the site's source code, like ${job.repoUrl}/pull/123`;
  return cleanPullRequestUrl(job.repoUrl, url) ? null : `Use a pull request from ${repoName(job.repoUrl)}, like ${job.repoUrl}/pull/123`;
}

// Where the worker sends a PR (code jobs), or a website URL plus the PR with its source code
// (website jobs). Dark box inside the job's vault card. Also used for the one resubmit
// allowed after a failed first try (CHANGES_REQUESTED).
export default function SubmitBox({ job, onSubmitted }) {
  const [url, setUrl] = useState('');
  const [sourcePr, setSourcePr] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const urlRef = useRef(null);
  const sourceRef = useRef(null);
  const isCode = job.type === 'code';
  const withSource = needsSourceItem(job); // older website jobs without a repo send the URL only
  const isRetry = job.status === 'CHANGES_REQUESTED';

  async function handleSubmit(event) {
    event.preventDefault();
    const value = url.trim();
    const source = sourcePr.trim();
    const problems = {
      url: submissionProblem(job, value),
      source: withSource ? sourcePrProblem(job, source) : null,
    };
    if (problems.url || problems.source) {
      setFieldErrors(problems);
      (problems.url ? urlRef : sourceRef).current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitWork(job._id, value, withSource ? source : undefined);
      setUrl('');
      setSourcePr('');
      setSubmitting(false);
      onSubmitted(updated);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const clearError = (field) => setFieldErrors((current) => (current[field] ? { ...current, [field]: null } : current));
  const buttonLabel = submitting ? <><span className="spin" />Submitting…</> : isRetry ? 'Submit fixed work' : 'Submit for checking';
  const heading = isRetry ? 'Last try · submit the fix' : 'Worker · submit the work';

  const urlInput = (
    <input
      ref={urlRef}
      id="submission"
      className="input dark-input"
      type="url"
      inputMode="url"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck="false"
      enterKeyHint={withSource ? 'next' : 'send'}
      placeholder={isCode ? `${job.repoUrl}/pull/123` : 'https://your-site.example.com'}
      value={url}
      onChange={(e) => {
        setUrl(e.target.value);
        clearError('url');
      }}
      onKeyDown={(e) => {
        // Enter in the first of two fields moves on to the second, instead of flagging it as empty.
        if (withSource && e.key === 'Enter' && !sourcePr.trim()) {
          e.preventDefault();
          sourceRef.current?.focus();
        }
      }}
      aria-invalid={fieldErrors.url ? 'true' : undefined}
      aria-describedby="submission-hint"
    />
  );
  const urlHint = (
    <p id="submission-hint" className={`hint${fieldErrors.url ? ' hint--error field__error' : ''}`}>
      {fieldErrors.url ||
        (isCode
          ? 'Tests run on GitHub Actions. The workflow must run on your pull request.'
          : 'The page must be public, so the checker can open it.')}
    </p>
  );

  if (!withSource) {
    return (
      <form className="review submit-box" onSubmit={handleSubmit} noValidate>
        <label className="eyebrow" htmlFor="submission">
          {heading}
          <span className="visually-hidden">: {isCode ? 'Pull request URL' : 'Website URL'}</span>
        </label>
        <div className="submit-row">
          {urlInput}
          <button type="submit" className="btn btn--lime" disabled={submitting}>{buttonLabel}</button>
        </div>
        {urlHint}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    );
  }

  return (
    <form className="review submit-box submit-box--two" onSubmit={handleSubmit} noValidate>
      <span className="eyebrow">{heading}</span>
      <div className="submit-field">
        <label className="submit-field__label" htmlFor="submission">Live website</label>
        {urlInput}
        {urlHint}
      </div>
      <div className="submit-field">
        <label className="submit-field__label" htmlFor="source-pr">Pull request with the source code</label>
        <input
          ref={sourceRef}
          id="source-pr"
          className="input dark-input"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="send"
          placeholder={`${job.repoUrl}/pull/123`}
          value={sourcePr}
          onChange={(e) => {
            setSourcePr(e.target.value);
            clearError('source');
          }}
          aria-invalid={fieldErrors.source ? 'true' : undefined}
          aria-describedby="source-pr-hint"
        />
        <p id="source-pr-hint" className={`hint${fieldErrors.source ? ' hint--error field__error' : ''}`}>
          {fieldErrors.source ||
            `Open it in ${repoName(job.repoUrl)}. The commit that passes is saved for the buyer.`}
        </p>
      </div>
      <button type="submit" className="btn btn--lime submit-box__send" disabled={submitting}>{buttonLabel}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
