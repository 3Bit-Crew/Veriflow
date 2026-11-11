import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney, formatTime } from '../../format.js';
import { HoldBar, StatusPill, statusLabel } from '../ui.jsx';
import { moneyText, tip } from './gridSetup.js';
import VfGrid from './VfGrid.jsx';

const passedWeight = (job) => job.items.filter((i) => i.status === 'PASS').reduce((sum, i) => sum + i.weight, 0);
const typeText = (type) => (type === 'code' ? 'Code · pull request' : 'Website · live URL');

// Columns that only show on wide enough grids (pixels).
const HIDE_BELOW = { checklist: 640, attempts: 760, workerEmail: 1000, createdAt: 1100, payoutAmount: 520 };

// The pinned totals row, for whatever rows are on screen after search and filters.
function totals(rows) {
  return {
    _id: '__totals',
    title: `Total · ${rows.length} ${rows.length === 1 ? 'job' : 'jobs'}`,
    amount: rows.reduce((sum, job) => sum + (job.amount || 0), 0),
    payoutAmount: rows.reduce((sum, job) => sum + (job.payoutAmount || 0), 0),
    currency: rows[0]?.currency || 'USD',
  };
}

// One row per job (GET /api/jobs).
export default function JobsGrid({ jobs, search, filter, onApi, onDisplayedCount }) {
  const columnDefs = useMemo(
    () => [
      {
        field: 'title',
        headerName: 'Job',
        flex: 2,
        minWidth: 200,
        tooltip: tip('title'),
        cellRenderer: (p) =>
          p.node.rowPinned ? (
            <div className="cell-stack"><span className="t1">{p.value}</span></div>
          ) : (
            <div className="cell-stack">
              <Link className="t1" to={`/jobs/${p.data._id}`} onClick={(e) => e.stopPropagation()}>{p.value}</Link>
              <span className="t2">{typeText(p.data.type)}</span>
            </div>
          ),
        getQuickFilterText: (p) => `${p.value} ${typeText(p.data.type)}`,
      },
      {
        field: 'status',
        width: 176,
        enableCellChangeFlash: true,
        valueFormatter: (p) => (p.value ? statusLabel(p.value) : ''),
        cellRenderer: (p) => (p.node.rowPinned || !p.value ? null : <StatusPill status={p.value} />),
        getQuickFilterText: (p) => statusLabel(p.value),
      },
      {
        colId: 'checklist',
        headerName: 'Checklist',
        width: 190,
        valueGetter: (p) => (p.data?.items ? passedWeight(p.data) : null),
        valueFormatter: (p) => (p.data?.items ? `${p.value}% passed (${p.data.items.filter((i) => i.status === 'PASS').length}/${p.data.items.length})` : ''),
        cellRenderer: (p) =>
          p.node.rowPinned || !p.data.items ? null : (
            <div className="cell-stack">
              <HoldBar items={p.data.items} height={8} gap={2} />
              <span className="t2" style={{ marginTop: 6 }}>
                {p.data.items.filter((i) => i.status === 'PASS').length}/{p.data.items.length} passed
              </span>
            </div>
          ),
        getQuickFilterText: () => '',
      },
      {
        field: 'amount',
        headerName: 'Held',
        width: 120,
        type: 'rightAligned',
        valueFormatter: (p) => moneyText(p.value),
        cellRenderer: (p) => <span className="cell-num">{formatMoney(p.value, p.data.currency)}</span>,
      },
      {
        field: 'payoutAmount',
        headerName: 'Paid out',
        width: 120,
        type: 'rightAligned',
        enableCellChangeFlash: true,
        valueFormatter: (p) => moneyText(p.value),
        cellRenderer: (p) =>
          p.value == null ? (
            <span className="muted">—</span>
          ) : (
            <span className={`cell-num${p.value > 0 ? ' cell-paid' : ''}`}>{formatMoney(p.value, p.data.currency)}</span>
          ),
      },
      {
        field: 'attempts',
        headerName: 'Try',
        width: 72,
        type: 'rightAligned',
        valueFormatter: (p) => (p.value == null ? '' : `${p.value}/2`),
        cellRenderer: (p) => (p.node.rowPinned ? null : <span className="cell-num">{p.value || 0}/2</span>),
      },
      {
        field: 'workerEmail',
        headerName: 'Worker',
        flex: 1,
        minWidth: 150,
        tooltip: tip('workerEmail'),
        cellRenderer: (p) => (p.node.rowPinned ? null : <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.value}</span>),
      },
      {
        field: 'createdAt',
        headerName: 'Created',
        width: 150,
        sort: 'desc',
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : ''),
        cellRenderer: (p) => (p.node.rowPinned ? null : <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{formatTime(p.value)}</span>),
      },
    ],
    [],
  );

  return (
    <VfGrid
      rows={jobs}
      columnDefs={columnDefs}
      getRowId={(p) => p.data._id}
      getLink={(job) => `/jobs/${job._id}`}
      search={search}
      filter={filter}
      hideBelow={HIDE_BELOW}
      totals={totals}
      emptyText="No jobs match. Try another search or filter."
      onApi={onApi}
      onDisplayedCount={onDisplayedCount}
    />
  );
}
