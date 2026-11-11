import { useState } from 'react';
import { submitWork } from '../api.js';
import { cleanPullRequestUrl } from '../pullRequest.js';

// Same rules as the submit route (PLAN.md 5.8), so mistakes show before a round trip.
export function submissionProblem(job, url) {
  if (job.type === 'code') {
    if (!cleanPullRequestUrl(job.repoUrl, url)) {
      return `Use a pull request from ${job.repoUrl.replace('https://github.com/', '')}, like ${job.repoUrl}/pull/123`;
    }
    return null;
  }
  return /^https?:\/\//.test(url) ? null : 'Enter the full address, starting with https://';
}

// Where the worker sends a PR or website URL (dark box inside the job's vault card).
// Also used for the one resubmit allowed after a failed first try (CHANGES_REQUESTED).
export default function SubmitBox({ job, onSubmitted }) {
  const [url, setUrl] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const isCode = job.type === 'code';
  const isRetry = job.status === 'CHANGES_REQUESTED';

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
      const updated = await submitWork(job._id, value);
      setUrl('');
      setSubmitting(false);
      onSubmitted(updated);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form className="review submit-box" onSubmit={handleSubmit} noValidate>
      <label className="eyebrow" htmlFor="submission">
        {isRetry ? 'Last try · submit the fix' : 'Worker · submit the work'}
        <span className="visually-hidden">: {isCode ? 'Pull request URL' : 'Website URL'}</span>
      </label>
      <div className="submit-row">
        <input
          id="submission"
          className="input dark-input"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
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
        <button type="submit" className="btn btn--lime" disabled={submitting}>
          {submitting ? <><span className="spin" />Submitting…</> : isRetry ? 'Submit fixed work' : 'Submit for checking'}
        </button>
      </div>
      <p id="submission-hint" className={`hint${fieldError ? ' hint--error field__error' : ''}`}>
        {fieldError ||
          (isCode
            ? 'Tests run on GitHub Actions. The workflow must run on your pull request.'
            : 'The page must be public, so the checker can open it.')}
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
