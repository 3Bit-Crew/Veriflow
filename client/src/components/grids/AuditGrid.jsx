import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EVENT_SYMBOL, eventKind, eventLabel } from '../../eventKinds.js';
import { formatTime } from '../../format.js';
import { tip } from './gridSetup.js';
import VfGrid from './VfGrid.jsx';

// On a phone: time and what happened (the event type is in the message too).
const HIDE_BELOW = { jobTitle: 720, type: 560 };

// The audit log (GET /api/events): every event from every job, newest first.
export default function AuditGrid({ events, search, filter, onApi, onDisplayedCount }) {
  const columnDefs = useMemo(
    () => [
      {
        field: 'createdAt',
        headerName: 'Time',
        width: 110,
        sort: 'desc',
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : ''),
        cellRenderer: (p) => <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{formatTime(p.value)}</span>,
        getQuickFilterText: () => '',
      },
      {
        field: 'type',
        headerName: 'Event',
        width: 210,
        valueFormatter: (p) => eventLabel(p.value),
        cellRenderer: (p) => {
          const kind = eventKind(p.value);
          return (
            <span className={`ev ${kind}`}>
              <i aria-hidden="true">{EVENT_SYMBOL[kind]}</i>
              {p.valueFormatted}
            </span>
          );
        },
        getQuickFilterText: (p) => eventLabel(p.value),
      },
      {
        field: 'jobTitle',
        headerName: 'Job',
        flex: 1,
        minWidth: 170,
        tooltip: tip('jobTitle'),
        cellRenderer: (p) =>
          p.data.jobId ? (
            <Link className="t1" to={`/jobs/${p.data.jobId}`} onClick={(e) => e.stopPropagation()} style={{ display: 'block' }}>
              {p.value || 'Untitled job'}
            </Link>
          ) : (
            '—'
          ),
      },
      {
        field: 'message',
        headerName: 'What happened',
        flex: 2.6,
        minWidth: 200,
        tooltip: tip('message'),
        cellRenderer: (p) => <div className="why">{p.value}</div>,
      },
    ],
    [],
  );

  return (
    <VfGrid
      rows={events}
      columnDefs={columnDefs}
      getRowId={(p) => p.data._id}
      getLink={(e) => (e.jobId ? `/jobs/${e.jobId}` : '/dashboard?tab=audit')}
      search={search}
      filter={filter}
      rowHeight={48}
      hideBelow={HIDE_BELOW}
      emptyText="Nothing matches. Try another search or filter."
      onApi={onApi}
      onDisplayedCount={onDisplayedCount}
    />
  );
}
