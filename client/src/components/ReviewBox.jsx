import { useState } from 'react';
import { reviewJob } from '../api.js';
import { formatMoney } from '../format.js';
import { HoldBar } from './ui.jsx';

const CONFIDENCE_THRESHOLD = 0.7; // PLAN.md 5.5
const isResult = (status) => status === 'PASS' || status === 'FAIL' || status === 'UNSURE';

// An item a person has to decide: unsure, checked with low confidence, or never checked
// (the check stopped partway). Everything else keeps its result.
export const needsDecision = (item) =>
  item.status === 'UNSURE' || !isResult(item.status) || !(Number(item.confidence) >= CONFIDENCE_THRESHOLD);

// For NEEDS_REVIEW jobs: the reviewer marks each undecided item Pass or Fail. Payouts are all or
// nothing (PLAN.md 5.5): every item passes → the full amount, anything fails → $0 (the hold is
// cancelled). POST /api/jobs/:id/review settles it on PayPal. It can't be undone, so it takes a confirm click.
export default function ReviewBox({ job, onSettled }) {
  const money = (n) => formatMoney(n, job.currency);
  const open = job.items.map((item, index) => ({ item, index })).filter(({ item }) => needsDecision(item));
  const [decisions, setDecisions] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const resolved = job.items.map((item, i) => (needsDecision(item) ? { ...item, status: decisions[i] || 'UNSURE' } : item));
  const allPass = resolved.every((item) => item.status === 'PASS');
  const payout = allPass ? job.amount : 0;
  const back = job.amount - payout;
  const ready = open.every(({ index }) => decisions[index]);

  function decide(index, value) {
    setDecisions((current) => ({ ...current, [index]: value }));
    setConfirming(false);
    setError(null);
  }

  async function settle() {
    setSaving(true);
    setError(null);
    try {
      await reviewJob(job._id, payout);
      onSettled(payout);
    } catch (err) {
      setError(err.message);
      setSaving(false);
      setConfirming(false);
    }
  }

  return (
    <div className="review review-box">
      <div className="review__head">
        <span className="eyebrow">
          Your decision{open.length > 0 ? ` · ${open.length} to decide` : ''}
        </span>
        <span className="eyebrow">Read the evidence below first</span>
      </div>

      {open.length === 0 && (
        <p className="muted" style={{ fontSize: 13, padding: '6px 0' }}>
          Every item already has a confident result. Settling pays in full only if every item passed; otherwise it
          cancels the hold.
        </p>
      )}

      {open.map(({ item, index }) => (
        <div className="review__row" key={item._id || index}>
          <span>{item.text}</span>
          <div className="tg" role="group" aria-label={`Decide: ${item.text}`}>
            <button
              type="button"
              className={`p${decisions[index] === 'PASS' ? ' on' : ''}`}
              aria-pressed={decisions[index] === 'PASS'}
              onClick={() => decide(index, 'PASS')}
            >
              Pass
            </button>
            <button
              type="button"
              className={`f${decisions[index] === 'FAIL' ? ' on' : ''}`}
              aria-pressed={decisions[index] === 'FAIL'}
              onClick={() => decide(index, 'FAIL')}
            >
              Fail
            </button>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 14 }}>
        <HoldBar items={resolved} dark height={8} />
      </div>
      <p className="hint" style={{ marginTop: 8 }}>All or nothing: every item must pass for the worker to be paid. One Fail cancels the hold.</p>

      <div className="review__foot">
        <span style={{ fontSize: 13 }} aria-live="polite">
          Worker gets <b className="mono review__payout">{money(payout)}</b>{' '}
          <span className="muted">· {money(back)} back to buyer</span>
        </span>
        {confirming ? (
          <div className="review__actions">
            <button type="button" className="btn btn--sm btn--on-dark" onClick={() => setConfirming(false)} disabled={saving}>
              Back
            </button>
            <button type="button" className="btn btn--lime btn--sm" onClick={settle} disabled={saving} autoFocus>
              {saving ? <><span className="spin" />Settling…</> : payout === 0 ? 'Confirm: pay nothing' : `Confirm: pay ${money(payout)}`}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--lime btn--sm" disabled={!ready} onClick={() => setConfirming(true)}>
            Settle on PayPal
          </button>
        )}
      </div>
      {confirming && !saving && (
        <p className="hint" role="alert">
          {payout === 0
            ? `This cancels the hold and returns all ${money(job.amount)} to the buyer. It can't be undone.`
            : `PayPal pays ${money(payout)} to the worker${back > 0 ? ` and returns ${money(back)} to the buyer` : ''}. It can't be undone.`}
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
