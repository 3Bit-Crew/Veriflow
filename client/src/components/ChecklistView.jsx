import { screenshotUrl } from '../api.js';
import { describeParams, KIND_LABELS } from '../checklistKinds.js';
import { formatMoney } from '../format.js';

const STATUS_TEXT = {
  PENDING: 'Not checked yet',
  CHECKING: 'Checking now',
  PASS: 'Passed',
  FAIL: 'Failed',
  UNSURE: 'Unsure, needs a person',
};

function StatusIcon({ status }) {
  return (
    <span className={`status-icon status-icon--${status.toLowerCase()}`}>
      {status === 'CHECKING' && <span className="spinner spinner--small" aria-hidden="true" />}
      {status === 'PASS' && (
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
      )}
      {status === 'FAIL' && (
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
      )}
      {status === 'UNSURE' && <span aria-hidden="true">?</span>}
      <span className="visually-hidden">{STATUS_TEXT[status]}</span>
    </span>
  );
}

// Read-only checklist with each item's result. While the job is CHECKING, the first
// item still pending is the one being checked right now.
export default function ChecklistView({ job }) {
  const checkingIndex = job.status === 'CHECKING' ? job.items.findIndex((i) => i.status === 'PENDING') : -1;

  return (
    <ol className="results">
      {job.items.map((item, index) => {
        const status = index === checkingIndex ? 'CHECKING' : item.status || 'PENDING';
        const screenshots = item.evidence?.screenshots || [];
        const logUrl = item.evidence?.logUrl;
        const showConfidence = typeof item.confidence === 'number' && item.confidence < 1;

        return (
          <li key={item._id || index} className={`result result--${status.toLowerCase()}`}>
            {/* Keyed by status so a new result swaps in with a short entrance. */}
            <StatusIcon key={status} status={status} />
            <div className="result__body">
              <div className="result__top">
                <span className="result__text">{item.text}</span>
                <span className="result__weight">
                  {item.weight}% · {formatMoney((job.amount * item.weight) / 100, job.currency)}
                </span>
              </div>
              <p className="result__meta">
                <span className="kind-tag">{KIND_LABELS[item.kind] || item.kind}</span>
                <span className="muted">{describeParams(item)}</span>
              </p>
              {item.reasoning && (
                <p className="result__reasoning">
                  {item.reasoning}
                  {showConfidence && <span className="muted"> AI confidence {Math.round(item.confidence * 100)}%.</span>}
                </p>
              )}
              {(screenshots.length > 0 || logUrl) && (
                <div className="evidence">
                  {screenshots.map((id) => (
                    <a key={id} href={screenshotUrl(id)} target="_blank" rel="noreferrer" className="evidence__shot">
                      <img src={screenshotUrl(id)} alt="Screenshot the checker took" loading="lazy" />
                    </a>
                  ))}
                  {logUrl && (
                    <a href={logUrl} target="_blank" rel="noreferrer" className="evidence__link">
                      View the test log
                    </a>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
