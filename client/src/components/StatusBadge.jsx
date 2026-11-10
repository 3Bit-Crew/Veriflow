const LABELS = {
  DRAFT: 'Draft',
  CHECKLIST_READY: 'Awaiting payment',
  FUNDED: 'Money held',
  SUBMITTED: 'Submitted',
  CHECKING: 'Checking',
  CHANGES_REQUESTED: 'Changes requested',
  NEEDS_REVIEW: 'Needs review',
  SETTLED: 'Settled',
};

// Tone drives the color, see .badge--* in styles.css.
const TONES = {
  DRAFT: 'neutral',
  CHECKLIST_READY: 'neutral',
  FUNDED: 'held',
  SUBMITTED: 'active',
  CHECKING: 'active',
  CHANGES_REQUESTED: 'warn',
  NEEDS_REVIEW: 'warn',
  SETTLED: 'good',
};

export const statusLabel = (status) => LABELS[status] || status;

export default function StatusBadge({ status }) {
  return <span className={`badge badge--${TONES[status] || 'neutral'}`}>{LABELS[status] || status}</span>;
}
