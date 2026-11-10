import { useState } from 'react';
import { reviewJob } from '../api.js';
import { formatMoney } from '../format.js';

// Same rounding the server uses (roundDown2 in server/src/paypal/settle.js).
const roundDown2 = (n) => Math.floor(n * 100 + 1e-9) / 100;

// For NEEDS_REVIEW jobs: a person picks the payout (0 to the job amount) and settles it
// with POST /api/jobs/:id/review. Paying out can't be undone, so it takes a confirm step.
export default function ReviewBox({ job, onSettled }) {
  const money = (n) => formatMoney(n, job.currency);
  const passedWeight = job.items.filter((item) => item.status === 'PASS').reduce((sum, item) => sum + item.weight, 0);
  const forPassed = roundDown2((job.amount * passedWeight) / 100);

  const [value, setValue] = useState(String(forPassed));
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const text = value.trim();
  const payout = Number(text);
  let problem = null;
  if (text === '') problem = 'Enter an amount.';
  else if (!/^\d+(\.\d{1,2})?$/.test(text)) problem = 'Use dollars and cents, like 120 or 120.50.';
  else if (payout > job.amount) problem = `The most you can pay is ${money(job.amount)}.`;
  const returned = problem ? 0 : Math.round((job.amount - payout) * 100) / 100;

  const presets = [
    { label: `Passed items (${passedWeight}%)`, amount: forPassed },
    { label: 'In full', amount: job.amount },
    { label: 'Nothing', amount: 0 },
  ];

  function choose(next) {
    setValue(String(next));
    setConfirming(false);
    setError(null);
  }

  async function settle() {
    setSaving(true);
    setError(null);
    try {
      await reviewJob(job._id, payout);
      onSettled();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="review stack">
      <div className="field">
        <label htmlFor="payout">Pay the worker</label>
        <div className="review__row">
          <div className="input-prefix review__amount">
            <span aria-hidden="true">$</span>
            <input
              id="payout"
              className="input"
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setConfirming(false);
              }}
              aria-invalid={problem ? 'true' : undefined}
              aria-describedby="payout-hint"
            />
          </div>
          <div className="preset-row" role="group" aria-label="Quick amounts">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="button button--small"
                aria-pressed={!problem && payout === preset.amount}
                onClick={() => choose(preset.amount)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <p id="payout-hint" className={problem ? 'field__error' : 'field__hint tabular'}>
          {problem || `Worker gets ${money(payout)} · Buyer gets back ${money(returned)}`}
        </p>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {confirming ? (
        <div className="confirm stack" role="alertdialog" aria-labelledby="confirm-text">
          <p id="confirm-text">
            {payout === 0
              ? `Cancel the hold and return all ${money(job.amount)} to the buyer?`
              : `Pay ${money(payout)} to the worker${returned > 0 ? ` and return ${money(returned)} to the buyer` : ''}?`}{' '}
            This can't be undone.
          </p>
          <div className="actions">
            <button type="button" className="button button--primary" onClick={settle} disabled={saving} autoFocus>
              {saving ? 'Settling with PayPal…' : 'Confirm payout'}
            </button>
            <button type="button" className="button" onClick={() => setConfirming(false)} disabled={saving}>
              Go back
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="button button--primary" disabled={!!problem} onClick={() => setConfirming(true)}>
            {problem ? 'Settle' : payout === 0 ? 'Settle: pay nothing' : `Settle: pay ${money(payout)}`}
          </button>
        </div>
      )}
    </div>
  );
}
