import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { KIND_LABELS } from '../../checklistKinds.js';
import { formatMoney } from '../../format.js';
import { ResultPill, resultOf } from '../ui.jsx';
import { moneyText, tip } from './gridSetup.js';
import VfGrid from './VfGrid.jsx';

// Every checklist item from every job, one row each, with its latest result.
export function resultRows(jobs) {
  return (jobs ?? []).flatMap((job) =>
    job.items.map((item, index) => ({
      id: `${job._id}:${item._id || index}`,
      jobId: job._id,
      jobTitle: job.title,
      text: item.text,
      kind: item.kind,
      weight: item.weight,
      worth: (job.amount * item.weight) / 100,
      currency: job.currency,
      status: item.status || 'PENDING',
      confidence: typeof item.confidence === 'number' ? item.confidence : null,
      reasoning: item.reasoning || '',
      attempts: job.attempts,
    })),
  );
}

const HIDE_BELOW = { kind: 700, weight: 860, worth: 600, confidence: 960, reasoning: 1100 };

export default function ResultsGrid({ jobs, search, filter, onApi, onDisplayedCount }) {
  const rows = useMemo(() => (jobs ? resultRows(jobs) : null), [jobs]);

  const columnDefs = useMemo(
    () => [
      {
        field: 'text',
        headerName: 'Checklist item',
        flex: 2,
        minWidth: 200,
        tooltip: tip('text'),
        cellRenderer: (p) => (
          <div className="cell-stack">
            <span className="t1">{p.value}</span>
            <Link className="t2" to={`/jobs/${p.data.jobId}`} onClick={(e) => e.stopPropagation()}>{p.data.jobTitle}</Link>
          </div>
        ),
        getQuickFilterText: (p) => `${p.value} ${p.data.jobTitle}`,
      },
      {
        field: 'kind',
        headerName: 'Check',
        width: 170,
        valueFormatter: (p) => KIND_LABELS[p.value] || p.value,
        cellRenderer: (p) => <span className="tag">{p.valueFormatted}</span>,
        getQuickFilterText: (p) => KIND_LABELS[p.value] || p.value,
      },
      {
        field: 'status',
        headerName: 'Result',
        width: 130,
        enableCellChangeFlash: true,
        valueFormatter: (p) => resultOf(p.value).label,
        cellRenderer: (p) => <ResultPill status={p.value} />,
        getQuickFilterText: (p) => resultOf(p.value).label,
      },
      {
        field: 'weight',
        headerName: 'Weight',
        width: 96,
        type: 'rightAligned',
        valueFormatter: (p) => `${p.value}%`,
        cellRenderer: (p) => <span className="cell-num">{p.value}%</span>,
      },
      {
        field: 'worth',
        headerName: 'Worth',
        width: 110,
        type: 'rightAligned',
        valueFormatter: (p) => moneyText(p.value),
        cellRenderer: (p) => <span className="cell-num">{formatMoney(p.value, p.data.currency)}</span>,
      },
      {
        field: 'confidence',
        headerName: 'Confidence',
        width: 150,
        valueFormatter: (p) => (p.value == null ? '' : `${Math.round(p.value * 100)}%`),
        cellRenderer: (p) => {
          if (p.value == null) return <span className="muted">—</span>;
          const pct = Math.round(p.value * 100);
          return (
            <div className="conf-cell">
              <div className="conf__bar">
                <i style={{ width: `${pct}%`, background: pct >= 70 ? 'var(--pass)' : 'var(--unsure)' }} />
              </div>
              <span className="mono">{pct}%</span>
            </div>
          );
        },
      },
      {
        field: 'reasoning',
        headerName: 'Why',
        flex: 2,
        minWidth: 220,
        tooltip: tip('reasoning'),
        cellRenderer: (p) => <div className="why">{p.value || '—'}</div>,
      },
    ],
    [],
  );

  return (
    <VfGrid
      rows={rows}
      columnDefs={columnDefs}
      getRowId={(p) => p.data.id}
      getLink={(row) => `/jobs/${row.jobId}`}
      search={search}
      filter={filter}
      hideBelow={HIDE_BELOW}
      emptyText="No checklist items match. Try another search or filter."
      onApi={onApi}
      onDisplayedCount={onDisplayedCount}
    />
  );
}
