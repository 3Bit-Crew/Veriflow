import { useState } from 'react';
import { approveChecklist } from '../api.js';
import { checklistProblems, describeParams, KIND_LABELS } from '../checklistKinds.js';
import { formatMoney } from '../format.js';

// Weights are kept as strings while editing so the field can be cleared and retyped.
const toDraft = (item, index) => ({
  key: item._id || String(index),
  text: item.text,
  kind: item.kind,
  params: item.params || {},
  weight: String(item.weight),
});

// Exactly the shape PUT /api/jobs/:id/checklist expects (PLAN.md 5.8).
const toPayload = ({ text, kind, params, weight }) => ({
  text: text.trim(),
  kind,
  params,
  weight: weight.trim() === '' ? NaN : Number(weight),
});

// Lets the buyer edit each item's text and weight, remove items, then approve. Kind and
// params stay as the AI wrote them; they're shown so the buyer knows what will be tested.
export default function ChecklistEditor({ job, onApproved }) {
  const [items, setItems] = useState(() => job.items.map(toDraft));
  const [removed, setRemoved] = useState(null); // { item, index } of the last removal, for Undo
  const [restoredKey, setRestoredKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const payload = items.map(toPayload);
  const problems = checklistProblems(job.type, payload);
  const total = payload.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0);

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

  return (
    <form onSubmit={handleApprove} className="stack">
      <ol className="checklist-editor">
        {items.map((item, index) => {
          const weight = payload[index].weight;
          return (
            <li
              key={item.key}
              className="checklist-editor__item"
              // The first list cascades in; an item brought back by Undo appears without waiting.
              style={{ '--i': item.key === restoredKey ? 0 : index }}
            >
              <div className="checklist-editor__kind">
                <span className="kind-tag">{KIND_LABELS[item.kind] || item.kind}</span>
                <span className="muted">{describeParams(item)}</span>
                {canRemove(item) ? (
                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => remove(index)}
                    aria-label={`Remove item ${index + 1}: ${item.text}`}
                  >
                    Remove
                  </button>
                ) : (
                  isRequired(item) && (
                    <span className="required-note" title="Code jobs always check that the tests pass">
                      Required
                    </span>
                  )
                )}
              </div>
              <div className="checklist-editor__fields">
                <label className="checklist-editor__text">
                  <span className="visually-hidden">Item {index + 1} description</span>
                  <input
                    className="input"
                    value={item.text}
                    onChange={(e) => update(index, 'text', e.target.value)}
                  />
                </label>
                <label className="checklist-editor__weight">
                  <span className="visually-hidden">Item {index + 1} weight</span>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    step="1"
                    value={item.weight}
                    onChange={(e) => update(index, 'weight', e.target.value)}
                  />
                  <span aria-hidden="true">%</span>
                </label>
                <span className="checklist-editor__money" title="Share of the payment this item is worth">
                  {Number.isFinite(weight) ? formatMoney((job.amount * weight) / 100, job.currency) : '—'}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {removed && (
        <p className="undo-note" role="status">
          <span>
            Removed “{removed.item.text}”. Spread its {removed.item.weight}% over the other items so the weights add up to 100.
          </span>
          <button type="button" className="link-button" onClick={undo}>
            Undo
          </button>
        </p>
      )}

      <p className={`total ${total === 100 ? 'total--ok' : 'total--bad'}`} aria-live="polite">
        Weights total <strong>{total}</strong> of 100
      </p>

      {problems.length > 0 && (
        <ul className="problems" aria-live="polite">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="actions">
        <button type="submit" className="button button--primary" disabled={saving || problems.length > 0}>
          {saving ? 'Approving…' : 'Approve checklist'}
        </button>
      </div>
      <p className="muted small">Once approved, the checklist is the contract and can't be changed.</p>
    </form>
  );
}
