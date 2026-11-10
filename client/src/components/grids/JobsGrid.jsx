import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Link, useNavigate } from 'react-router-dom';
import StatusBadge, { statusLabel } from '../StatusBadge.jsx';
import { formatMoney, formatTime } from '../../format.js';
import { gridProps } from './gridSetup.js';

const OUTCOME = { FULL: 'Paid in full', PARTIAL: 'Partly paid', VOID: 'Hold cancelled' };

// One row per job (GET /api/jobs).
export default function JobsGrid({ jobs, search }) {
  const navigate = useNavigate();

  const columnDefs = useMemo(() => [
    {
      field: 'title',
      headerName: 'Job',
      flex: 2,
      minWidth: 220,
      tooltipField: 'title',
      cellRenderer: (p) => <Link to={`/jobs/${p.data._id}`}>{p.value}</Link>,
    },
    {
      field: 'status',
      width: 170,
      cellRenderer: (p) => <StatusBadge status={p.value} />,
      filterValueGetter: (p) => statusLabel(p.data.status),
      getQuickFilterText: (p) => statusLabel(p.value),
    },
    {
      field: 'type',
      width: 110,
      valueFormatter: (p) => (p.value === 'code' ? 'Code' : 'Website'),
    },
    {
      field: 'amount',
      headerName: 'Held',
      width: 120,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => formatMoney(p.value, p.data.currency),
    },
    {
      field: 'payoutAmount',
      headerName: 'Paid out',
      width: 120,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => (p.value == null ? '—' : formatMoney(p.value, p.data.currency)),
    },
    {
      field: 'settlement',
      headerName: 'Outcome',
      width: 140,
      valueFormatter: (p) => OUTCOME[p.value] || '—',
    },
    { field: 'attempts', headerName: 'Tries', width: 90, type: 'rightAligned', filter: 'agNumberColumnFilter' },
    { field: 'workerEmail', headerName: 'Worker', flex: 1, minWidth: 200, tooltipField: 'workerEmail' },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      sort: 'desc',
      filter: false,
      valueFormatter: (p) => formatTime(p.value),
    },
  ], []);

  return (
    <AgGridReact
      {...gridProps}
      rowData={jobs ?? []}
      loading={jobs === null}
      columnDefs={columnDefs}
      getRowId={(p) => p.data._id}
      quickFilterText={search}
      onRowClicked={(e) => navigate(`/jobs/${e.data._id}`)}
      overlayNoRowsTemplate="No jobs yet. Create one to see it here."
    />
  );
}
