import { useEffect, useState } from 'react';
import { approveChecklist } from '../api.js';
import { checklistProblems, describeParams, KIND_LABELS } from '../checklistKinds.js';
import { Icon } from './ui.jsx';

// Payouts are all or nothing (PLAN.md 5.5): the worker is paid only when every item passes.
// A weight is how much an item counts toward the score, not a share of the money.
export const WEIGHT_HELP = 'Weight is how much an item counts toward the score. The worker is paid only if every item passes.';

// One color per checklist item, used by the composition bar, the item numbers and the receipt.
export const ITEM_COLORS = ['#0E5A43', '#1E8A5E', '#5FAE7E', '#A9DB4A', '#C6F36B', '#7C8A84', '#3A4340', '#B7C9A8'];
const LIGHT_COLORS = new Set(['#A9DB4A', '#C6F36B', '#B7C9A8']);

// The checklist as colored segments, each as wide as its weight. A gap shows weight still missing.
export function CompositionBar({ items, height = 14, dark }) {
  const total = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  return (
    <div className="hold" style={{ height, gap: 3 }} role="img" aria-label={`Weights add up to ${total} of 100`}>
      {items.map((item, i) => (
        <div
          key={item.key ?? i}
          className="hold__seg"
          style={{ flexGrow: Math.max(Number(item.weight) || 0, 0.001), flexBasis: 0, background: ITEM_COLORS[i % ITEM_COLORS.length] }}
        />
      ))}
      {total < 100 && (
        <div
          className="hold__seg void"
          style={{ flexGrow: 100 - total, flexBasis: 0, boxShadow: dark ? 'inset 0 0 0 1px #33413b' : undefined }}
        />
      )}
    </div>
  );
}

const toDraft = (item, index) => ({
  key: item._id || String(index),
  text: item.text,
  kind: item.kind,
  params: item.params || {},
  // Kept as text while editing, so the number box can be cleared and retyped.
  weight: String(Number(item.weight) || 1),
});

// Exactly the shape PUT /api/jobs/:id/checklist expects (PLAN.md 5.8).
const toPayload = ({ text, kind, params, weight }) => ({
  text: text.trim(),
  kind,
  params,
  weight: String(weight).trim() === '' ? NaN : Number(weight),
});

// Whole numbers of at least 1 that add up to exactly 100.
function evenWeights(count) {
  const base = Math.floor(100 / count);
  return Array.from({ length: count }, (_, i) => base + (i < 100 - base * count ? 1 : 0));
}

// Lets the buyer edit each item's text and weight, remove items, then approve. Kind and
// params stay as the AI wrote them; they're shown so the buyer knows what will be tested.
// onChange(items) reports every edit, so the page's receipt can follow along.
export default function ChecklistEditor({ job, onApproved, onChange }) {
  const [items, setItems] = useState(() => job.items.map(toDraft));
  const [removed, setRemoved] = useState(null); // { item, index } of the last removal, for Undo
  const [restoredKey, setRestoredKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const payload = items.map(toPayload);
  const problems = checklistProblems(job.type, payload);
  const total = payload.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0);

  useEffect(() => {
    onChange?.(items);
  }, [items, onChange]);

  // Code jobs need exactly one "Tests pass" item (PLAN.md 5.3), and a checklist needs at least one item.
  const isRequired = (item) => job.type === 'code' && item.kind === 'tests_pass';
  const canRemove = (item) => items.length > 1 && !isRequired(item);

  function update(index, field, value) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function remove(index) {
    setRemoved({ item: items[index], index });
    setItems(items.filter((_, i) => i !== index));
    setRestoredKey(null);
    setError(null);
  }

  // The AI's rules for an item can't be re-created by hand, so a removal can always be undone.
  function undo() {
    const next = [...items];
    next.splice(Math.min(removed.index, next.length), 0, removed.item);
    setItems(next);
    setRestoredKey(removed.item.key);
    setRemoved(null);
  }

  function evenOut() {
    const weights = evenWeights(items.length);
    setItems((current) => current.map((item, i) => ({ ...item, weight: String(weights[i]) })));
  }

  async function handleApprove(event) {
    event.preventDefault();
    if (problems.length) return;
    setSaving(true);
    setError(null);
    try {
      onApproved(await approveChecklist(job._id, payload));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const missing = 100 - total;

  return (
    <form onSubmit={handleApprove} className="card form fade">
      <div className="form__head">
        <div>
          <h2>Review the checklist</h2>
          <p className="muted">Each item is checked automatically. {WEIGHT_HELP}</p>
        </div>
        <button type="button" className="btn btn--sm" onClick={evenOut} disabled={items.length < 2}>
          Even out
        </button>
      </div>

      <CompositionBar items={items} />

      <ol className="items checklist-editor">
        {items.map((item, index) => {
          const color = ITEM_COLORS[index % ITEM_COLORS.length];
          return (
            <li
              key={item.key}
              className="ci ci--enter checklist-editor__item"
              style={{ '--i': item.key === restoredKey ? 0 : index }}
            >
              <span className="ci__n" style={{ background: color, color: LIGHT_COLORS.has(color) ? 'var(--ink)' : '#fff' }}>
                {index + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <label>
                  <span className="visually-hidden">Item {index + 1} description</span>
                  <input className="ci__t" value={item.text} onChange={(e) => update(index, 'text', e.target.value)} />
                </label>
                <div className="ci__meta">
                  <span className="tag">{KIND_LABELS[item.kind] || item.kind}</span>
                  <span>{describeParams(item)}</span>
                </div>
              </div>
              <div className="wt">
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={Number(item.weight) || 1}
                  onChange={(e) => update(index, 'weight', e.target.value)}
                  aria-label={`Item ${index + 1} weight slider`}
                  tabIndex={-1}
                />
                <label className="wt__box">
                  <span className="visually-hidden">Item {index + 1} weight in percent</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    step="1"
                    value={item.weight}
                    onChange={(e) => update(index, 'weight', e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                  <span aria-hidden="true">%</span>
                </label>
              </div>
              {canRemove(item) ? (
                <button
                  type="button"
                  className="ci__x remove-button"
                  onClick={() => remove(index)}
                  aria-label={`Remove item ${index + 1}: ${item.text}`}
                  title="Remove"
                >
                  <Icon name="trash" size={15} />
                </button>
              ) : (
                <span className="ci__lock required-note" title={isRequired(item) ? 'Code jobs always check that the tests pass' : 'A checklist needs at least one item'}>
                  <Icon name="lock" size={14} />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {removed && (
        <p className="undo-note" role="status">
          <span>
            Removed “{removed.item.text}”. Spread its {removed.item.weight}% over the other items so the weights add up to 100.
          </span>
          <button type="button" className="link-button" onClick={undo}>Undo</button>
        </p>
      )}

      {problems.length > 0 && total === 100 && (
        <ul className="problems" aria-live="polite">
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form__foot">
        <span className="total" aria-live="polite" style={{ fontSize: 13.5 }}>
          Weights total <b className={`mono ${total === 100 ? 'total-ok' : 'total-bad'}`}>{total}</b> of 100
          {missing !== 0 && <span className="muted"> · {missing < 0 ? 'remove' : 'add'} {Math.abs(missing)} to continue</span>}
        </span>
        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={saving || problems.length > 0}>
            {saving ? <><span className="spin spin--dark" />Approving…</> : 'Approve checklist'}
          </button>
        </div>
      </div>
      <p className="hint" style={{ marginTop: -10 }}>Once approved, the checklist is the contract and can't be changed.</p>
    </form>
  );
}
