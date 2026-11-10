import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatTime } from '../../format.js';
import { gridProps } from './gridSetup.js';

const MONEY_EVENTS = ['PAYPAL_AUTHORIZED', 'PAYPAL_CAPTURED', 'PAYPAL_VOIDED'];

// "PAYPAL_CAPTURED" -> "PayPal captured"
const eventLabel = (type = '') => {
  const words = type.toLowerCase().split('_').join(' ');
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(/paypal/i, 'PayPal');
};

// The audit log (GET /api/events): every event from every job, newest first.
export default function AuditGrid({ events, search }) {
  const navigate = useNavigate();

  const columnDefs = useMemo(() => [
    {
      field: 'createdAt',
      headerName: 'Time',
      width: 150,
      sort: 'desc',
      filter: false,
      valueFormatter: (p) => formatTime(p.value),
    },
    {
      field: 'jobTitle',
      headerName: 'Job',
      flex: 1,
      minWidth: 180,
      tooltipField: 'jobTitle',
      cellRenderer: (p) => (p.data.jobId ? <Link to={`/jobs/${p.data.jobId}`}>{p.value || 'Untitled job'}</Link> : '—'),
    },
    {
      field: 'type',
      headerName: 'Event',
      width: 190,
      cellRenderer: (p) => (
        <span className={MONEY_EVENTS.includes(p.value) ? 'pill pill--money' : 'pill'}>{eventLabel(p.value)}</span>
      ),
      filterValueGetter: (p) => eventLabel(p.data.type),
      getQuickFilterText: (p) => eventLabel(p.value),
    },
    { field: 'message', headerName: 'What happened', flex: 3, minWidth: 280, tooltipField: 'message' },
  ], []);

  return (
    <AgGridReact
      {...gridProps}
      rowData={events ?? []}
      loading={events === null}
      columnDefs={columnDefs}
      getRowId={(p) => p.data._id}
      quickFilterText={search}
      onRowClicked={(e) => e.data.jobId && navigate(`/jobs/${e.data.jobId}`)}
      overlayNoRowsTemplate="Nothing has happened yet."
    />
  );
}
