import { useEffect, useRef, useState } from 'react';
import { screenshotUrl } from '../api.js';
import { describeParams, KIND_ICONS, KIND_LABELS } from '../checklistKinds.js';
import { Icon, ResultIcon, ResultPill, resultOf } from './ui.jsx';

const isResult = (status) => status === 'PASS' || status === 'FAIL' || status === 'UNSURE';
const needsAttention = (item) => item.status === 'FAIL' || item.status === 'UNSURE';

// The item being checked right now: while the job is CHECKING, the first one still pending.
export function withChecking(job) {
  const index = job.status === 'CHECKING' ? job.items.findIndex((i) => !isResult(i.status)) : -1;
  return job.items.map((item, i) => (i === index ? { ...item, status: 'CHECKING' } : { ...item, status: item.status || 'PENDING' }));
}

function Evidence({ item }) {
  const screenshots = item.evidence?.screenshots || [];
  const logUrl = item.evidence?.logUrl;
  const confidence = typeof item.confidence === 'number' ? Math.round(item.confidence * 100) : null;

  return (
    <div className="it__body">
      <div className="it__why result__reasoning">
        <span className="eyebrow">Evidence</span>
        {item.reasoning || 'No details were recorded for this check.'}
        {(screenshots.length > 0 || logUrl) && (
          <div className="evidence">
            {screenshots.map((id) => (
              <a key={id} href={screenshotUrl(id)} target="_blank" rel="noreferrer" className="evidence__shot">
                <img src={screenshotUrl(id)} alt="Screenshot the checker took" loading="lazy" />
              </a>
            ))}
            {logUrl && (
              <a href={logUrl} target="_blank" rel="noreferrer" className="evidence__link">
                <Icon name="ext" size={13} />
                {item.kind === 'source_delivered' ? 'View the code at this commit' : 'View the test log'}
              </a>
            )}
          </div>
        )}
      </div>
      {confidence !== null && (
        <div className="conf">
          <span className="eyebrow" style={{ fontSize: 10 }}>Confidence</span>
          <span className="mono" style={{ fontSize: 20 }}>{confidence}%</span>
          <div className="conf__bar">
            <i style={{ width: `${confidence}%`, background: confidence >= 70 ? 'var(--pass)' : 'var(--unsure)' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>70% needed to act alone</span>
        </div>
      )}
    </div>
  );
}

function Item({ item, open, onToggle }) {
  const r = resultOf(item.status);
  const hasEvidence = isResult(item.status);
  const header = (
    <>
      <span className="it__ic">
        {item.status === 'PENDING' ? <Icon name={KIND_ICONS[item.kind] || 'check'} size={14} /> : <ResultIcon key={item.status} status={item.status} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="it__t result__text" style={{ display: 'block' }}>{item.text}</span>
        <span className="it__sub">
          <span className="tag">{KIND_LABELS[item.kind] || item.kind}</span>
          <span>{describeParams(item)}</span>
        </span>
      </span>
      <ResultPill status={item.status} />
      <span className="it__v" title="How much this item counts toward the score. Payment is all or nothing.">
        {item.weight}%
        <small>weight</small>
      </span>
      <span className="it__chev" style={{ opacity: hasEvidence ? 1 : 0 }}>
        <Icon name="chev" size={14} />
      </span>
    </>
  );

  return (
    <li className={`it result result--${(item.status || 'PENDING').toLowerCase()} ${r.key}${open && hasEvidence ? ' open' : ''}`}>
      {hasEvidence ? (
        <button type="button" className="it__h" onClick={onToggle} aria-expanded={open}>
          {header}
        </button>
      ) : (
        <div className="it__h">{header}</div>
      )}
      {open && hasEvidence && <Evidence item={item} />}
    </li>
  );
}

// Read-only checklist with each item's result. Failed and unsure items open by themselves,
// so the evidence a person needs is already showing; any checked item can be opened.
export default function ChecklistView({ job }) {
  const items = withChecking(job);
  const [open, setOpen] = useState(() => new Set(items.map((it, i) => (needsAttention(it) ? i : -1))));
  const seen = useRef(items.map((it) => it.status));

  // A result that lands as FAIL or UNSURE while someone is watching opens too.
  useEffect(() => {
    const opened = [];
    items.forEach((it, i) => {
      if (needsAttention(it) && seen.current[i] !== it.status) opened.push(i);
    });
    seen.current = items.map((it) => it.status);
    if (opened.length) setOpen((current) => new Set([...current, ...opened]));
  });

  function toggle(i) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <ol className="items results">
      {items.map((item, i) => (
        <Item
          key={item._id || i}
          item={item}
          open={open.has(i)}
          onToggle={() => toggle(i)}
        />
      ))}
    </ol>
  );
}
