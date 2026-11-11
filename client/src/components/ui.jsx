// Shared building blocks of the Veriflow design: icons, the hold bar, pills, brand mark, count-up, toast.
import { useEffect, useState } from 'react';
import { formatMoney } from '../format.js';

const ICONS = {
  check: <path d="M4 10.5l4 4 8-9" />,
  x: <path d="M5 5l10 10M15 5L5 15" />,
  q: (
    <>
      <path d="M7.5 7.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7" />
      <circle cx="10" cy="14.6" r=".4" fill="currentColor" />
    </>
  ),
  chev: <path d="M8 5l5 5-5 5" />,
  arrow: <path d="M4 10h12M11 5l5 5-5 5" />,
  back: <path d="M16 10H4M9 5l-5 5 5 5" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.5 13.5L17 17" />
    </>
  ),
  code: <path d="M7 6l-4 4 4 4M13 6l4 4-4 4M11 4l-2 12" />,
  globe: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2 2 3 4.5 3 7s-1 5-3 7c-2-2-3-4.5-3-7s1-5 3-7z" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="9" width="11" height="8" rx="2" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </>
  ),
  spark: <path d="M10 3v4M10 13v4M3 10h4M13 10h4M5.5 5.5l2 2M12.5 12.5l2 2M14.5 5.5l-2 2M7.5 12.5l-2 2" />,
  plus: <path d="M10 4v12M4 10h12" />,
  trash: <path d="M5 6h10M8 6V4.5h4V6M6.5 6l.7 10h5.6l.7-10" />,
  replay: (
    <>
      <path d="M4 10a6 6 0 1 0 2-4.5" />
      <path d="M4 4v3h3" />
    </>
  ),
  ext: <path d="M8 4H4v12h12v-4M11 4h5v5M16 4l-7 7" />,
  shield: <path d="M10 3l6 2.5v4.5c0 3.5-2.6 6.2-6 7-3.4-.8-6-3.5-6-7V5.5z" />,
  eye: (
    <>
      <path d="M2.5 10S5.5 4.5 10 4.5 17.5 10 17.5 10 14.5 15.5 10 15.5 2.5 10 2.5 10z" />
      <circle cx="10" cy="10" r="2.3" />
    </>
  ),
  gauge: (
    <>
      <path d="M3.5 14a7 7 0 1 1 13 0" />
      <path d="M10 13l3-4" />
    </>
  ),
  file: (
    <>
      <path d="M5 3h6.5L15 6.5V17H5z" />
      <path d="M11 3v4h4" />
    </>
  ),
  cursor: <path d="M5 3l11 6-5 1.5L9 16z" />,
  text: <path d="M4 5h12M10 5v11M7 16h6" />,
  copy: (
    <>
      <rect x="6.5" y="6.5" width="9.5" height="9.5" rx="2" />
      <path d="M13.5 6.5V4H4v9.5h2.5" />
    </>
  ),
  download: <path d="M10 3v10M6 9l4 4 4-4M4 16h12" />,
};

export function Icon({ name, size = 16, stroke = 1.7 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

// Job statuses (PLAN.md 5.1): label and pill color.
export const STATUS = {
  DRAFT: { label: 'Draft', cls: '' },
  CHECKLIST_READY: { label: 'Awaiting payment', cls: '' },
  FUNDED: { label: 'Held on PayPal', cls: 'pill--held' },
  SUBMITTED: { label: 'Submitted', cls: 'pill--held' },
  CHECKING: { label: 'Checking', cls: 'pill--held' },
  CHANGES_REQUESTED: { label: 'Changes requested', cls: 'pill--unsure' },
  NEEDS_REVIEW: { label: 'Needs review', cls: 'pill--unsure' },
  SETTLED: { label: 'Settled', cls: 'pill--pass' },
};

// Checklist item results (PLAN.md 5.4), plus CHECKING for the item being checked right now.
export const RESULT = {
  PASS: { label: 'Passed', cls: 'pill--pass', key: 'pass' },
  FAIL: { label: 'Failed', cls: 'pill--fail', key: 'fail' },
  UNSURE: { label: 'Unsure', cls: 'pill--unsure', key: 'unsure' },
  PENDING: { label: 'Not checked', cls: '', key: '' },
  CHECKING: { label: 'Checking', cls: 'pill--held', key: 'checking' },
};

export const statusLabel = (status) => STATUS[status]?.label || status;
export const resultOf = (status) => RESULT[status] || RESULT.PENDING;

export function StatusPill({ status }) {
  const s = STATUS[status] || { label: status, cls: '' };
  return (
    <span className={`pill ${s.cls}`}>
      <i />
      {s.label}
    </span>
  );
}

export function ResultPill({ status }) {
  const r = resultOf(status);
  return <span className={`pill ${r.cls}`}>{r.label}</span>;
}

export function ResultIcon({ status, size = 14 }) {
  if (status === 'PASS') return <Icon name="check" size={size} stroke={2.2} />;
  if (status === 'FAIL') return <Icon name="x" size={size} stroke={2.2} />;
  if (status === 'UNSURE') return <Icon name="q" size={size} stroke={2} />;
  if (status === 'CHECKING') return <span className="spin" aria-hidden="true" />;
  return null;
}

// The signature element: the held payment split into one segment per checklist item,
// each as wide as its weight and colored by its result.
export function HoldBar({ items, dark, height = 12, gap = 3, label }) {
  const passed = items.filter((it) => it.status === 'PASS').reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
  return (
    <div
      className={`hold${dark ? ' hold--dark' : ''}`}
      style={{ height, gap }}
      role="img"
      aria-label={label ?? `${passed}% of the payment passed`}
    >
      {items.map((it, i) => (
        <div
          key={i}
          title={`${it.weight}%${it.text ? ` · ${it.text}` : ''}`}
          className={`hold__seg ${resultOf(it.status).key}`}
          style={{ flexGrow: Math.max(Number(it.weight) || 0, 0.001), flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

export function BrandMark() {
  return (
    <span className="brand__mark" aria-hidden="true">
      <i style={{ top: 6, background: '#C6F36B', right: 9 }} />
      <i style={{ top: 11.5, background: '#C6F36B' }} />
      <i style={{ top: 17, background: '#4B5A54', right: 12 }} />
    </span>
  );
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts a money amount up from zero once (a payout landing). Static when `animate` is off
// or the viewer prefers reduced motion.
export function CountUp({ value, currency = 'USD', animate = true, duration = 1000 }) {
  const [shown, setShown] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate || prefersReducedMotion()) {
      setShown(value);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // strong ease-out: fast start, gentle landing
      setShown(t === 1 ? value : Math.floor(value * eased * 100) / 100);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, animate, duration]);

  return <span className="tabular">{formatMoney(shown, currency)}</span>;
}

// A short confirmation at the bottom of the screen. Hides itself after a few seconds.
export function Toast({ children, onDone, ms = 3600 }) {
  useEffect(() => {
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [onDone, ms]);
  return (
    <div className="toast" role="status">
      {children}
    </div>
  );
}
