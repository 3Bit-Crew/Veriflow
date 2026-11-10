import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Link, useNavigate } from 'react-router-dom';
import { KIND_LABELS } from '../../checklistKinds.js';
import { formatMoney } from '../../format.js';
import { gridProps } from './gridSetup.js';

const RESULT_LABELS = { PASS: 'Passed', FAIL: 'Failed', UNSURE: 'Unsure', PENDING: 'Not checked' };

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

export default function ResultsGrid({ jobs, search }) {
  const navigate = useNavigate();
  const rows = useMemo(() => (jobs ? resultRows(jobs) : null), [jobs]);

  const columnDefs = useMemo(() => [
    {
      field: 'jobTitle',
      headerName: 'Job',
      flex: 1,
      minWidth: 180,
      tooltipField: 'jobTitle',
      cellRenderer: (p) => <Link to={`/jobs/${p.data.jobId}`}>{p.value}</Link>,
    },
    { field: 'text', headerName: 'Checklist item', flex: 2, minWidth: 220, tooltipField: 'text' },
    {
      field: 'kind',
      headerName: 'Check',
      width: 150,
      valueFormatter: (p) => KIND_LABELS[p.value] || p.value,
      filterValueGetter: (p) => KIND_LABELS[p.data.kind] || p.data.kind,
    },
    {
      field: 'status',
      headerName: 'Result',
      width: 130,
      cellRenderer: (p) => <span className={`pill pill--${p.value.toLowerCase()}`}>{RESULT_LABELS[p.value] || p.value}</span>,
      filterValueGetter: (p) => RESULT_LABELS[p.data.status],
      getQuickFilterText: (p) => RESULT_LABELS[p.value],
    },
    {
      field: 'weight',
      headerName: 'Weight',
      width: 100,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => `${p.value}%`,
    },
    {
      field: 'worth',
      headerName: 'Worth',
      width: 110,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => formatMoney(p.value, p.data.currency),
    },
    {
      field: 'confidence',
      headerName: 'Confidence',
      width: 125,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => (p.value == null ? '—' : `${Math.round(p.value * 100)}%`),
    },
    { field: 'reasoning', headerName: 'Why', flex: 2, minWidth: 240, tooltipField: 'reasoning' },
  ], []);

  return (
    <AgGridReact
      {...gridProps}
      rowData={rows ?? []}
      loading={rows === null}
      columnDefs={columnDefs}
      getRowId={(p) => p.data.id}
      quickFilterText={search}
      onRowClicked={(e) => navigate(`/jobs/${e.data.jobId}`)}
      overlayNoRowsTemplate="No checklist items yet."
    />
  );
}
