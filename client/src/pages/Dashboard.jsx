import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getEvents, getJobs } from '../api.js';
import AuditGrid from '../components/grids/AuditGrid.jsx';
import JobsGrid from '../components/grids/JobsGrid.jsx';
import ResultsGrid, { resultRows } from '../components/grids/ResultsGrid.jsx';
import { HoldBar, Icon } from '../components/ui.jsx';
import { eventKind } from '../eventKinds.js';
import { formatMoney } from '../format.js';

const REFRESH_MS = 5000;
const HELD = ['FUNDED', 'SUBMITTED', 'CHECKING', 'CHANGES_REQUESTED', 'NEEDS_REVIEW'];

const TABS = [
  { id: 'jobs', label: 'Jobs' },
  { id: 'results', label: 'Checklist results' },
  { id: 'audit', label: 'Audit log' },
];

// The filter chips of each tab. Each one is a test on a row (AG Grid's external filter).
const FILTERS = {
  jobs: [
    ['all', 'All', null],
    ['review', 'Needs review', (job) => job.status === 'NEEDS_REVIEW'],
    ['held', 'In escrow', (job) => HELD.includes(job.status)],
    ['settled', 'Settled', (job) => job.status === 'SETTLED'],
  ],
  results: [
    ['all', 'All', null],
    ['unsure', 'Unsure', (row) => row.status === 'UNSURE'],
    ['failed', 'Failed', (row) => row.status === 'FAIL'],
    ['passed', 'Passed', (row) => row.status === 'PASS'],
    ['pending', 'Not checked', (row) => row.status === 'PENDING'],
  ],
  audit: [
    ['all', 'All', null],
    ['money', 'PayPal', (e) => eventKind(e.type) === 'money'],
    ['ai', 'AI', (e) => eventKind(e.type) === 'ai'],
    ['warn', 'Needs attention', (e) => eventKind(e.type) === 'warn'],
  ],
};

// Loads jobs and events together, then refreshes every 5s (skipped while the tab is hidden).
function useDashboardData() {
  const [state, setState] = useState({ jobs: null, events: null, error: null });

  useEffect(() => {
    let active = true;
    let timer;
    async function load() {
      if (!document.hidden) {
        try {
          const [jobs, events] = await Promise.all([getJobs(), getEvents()]);
          if (!active) return;
          setState({ jobs, events, error: null });
        } catch (error) {
          if (!active) return;
          setState((current) => ({ ...current, error }));
        }
      }
      timer = setTimeout(load, REFRESH_MS);
    }
    load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return state;
}

function Stats({ jobs, onShowReview }) {
  const list = jobs ?? [];
  const heldJobs = list.filter((job) => HELD.includes(job.status));
  const held = heldJobs.reduce((sum, job) => sum + job.amount, 0);
  const paid = list.reduce((sum, job) => sum + (job.payoutAmount || 0), 0);
  const review = list.filter((job) => job.status === 'NEEDS_REVIEW').length;
  const items = list.flatMap((job) => job.items);
  const checked = items.filter((i) => ['PASS', 'FAIL', 'UNSURE'].includes(i.status));
  const passRate = checked.length ? Math.round((checked.filter((i) => i.status === 'PASS').length / checked.length) * 100) : 0;
  const dash = jobs === null;

  return (
    <div className="stats">
      <div className="vault stat">
        <div className="stat__top">
          <span className="eyebrow">Held in escrow</span>
          <span className="lock lock--sm"><b />PayPal</span>
        </div>
        <div className="stat__v stat__v--big">{dash ? '—' : formatMoney(held)}</div>
        <div style={{ marginTop: 14 }}>
          {heldJobs.length > 0 ? (
            <HoldBar
              dark
              height={8}
              items={heldJobs.map((job) => ({ weight: job.amount, status: job.status === 'NEEDS_REVIEW' ? 'UNSURE' : 'PENDING', text: job.title }))}
              label={`${heldJobs.length} jobs hold ${formatMoney(held)}`}
            />
          ) : (
            <div className="hold hold--dark" style={{ height: 8 }}><div className="hold__seg" style={{ flexGrow: 1 }} /></div>
          )}
        </div>
      </div>
      <div className="card stat">
        <span className="eyebrow">Paid out</span>
        <div className="stat__v">{dash ? '—' : formatMoney(paid)}</div>
        <div className="stat__s">Captured to workers</div>
      </div>
      <button type="button" className="card stat" onClick={onShowReview}>
        <span className="eyebrow">Waiting on you</span>
        <div className="stat__v" style={{ color: review ? 'var(--unsure)' : undefined }}>{dash ? '—' : review}</div>
        <div className="stat__s">{review === 1 ? 'Job needs' : 'Jobs need'} a human decision →</div>
      </button>
      <div className="card stat">
        <span className="eyebrow">Checks passed</span>
        <div className="stat__v">{dash ? '—' : `${passRate}%`}</div>
        <div className="stat__s">{checked.length} items checked</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'jobs';
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState('all');
  const [displayed, setDisplayed] = useState(null);
  const { jobs, events, error } = useDashboardData();
  const tabRefs = useRef({});
  const apiRef = useRef(null);

  const counts = useMemo(
    () => ({ jobs: jobs?.length, results: jobs ? resultRows(jobs).length : undefined, audit: events?.length }),
    [jobs, events],
  );
  const filter = FILTERS[tab].find(([key]) => key === filterKey)?.[2] ?? null;

  // The tab lives in the URL so a reload (or a shared link) opens the same grid.
  function selectTab(id, nextFilter = 'all') {
    setParams(id === 'jobs' ? {} : { tab: id }, { replace: true });
    setFilterKey(nextFilter);
    setDisplayed(null);
  }

  // Arrow keys move between tabs, as screen reader users expect from a tab list.
  function handleTabKey(event) {
    const index = TABS.findIndex((t) => t.id === tab);
    const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!move) return;
    event.preventDefault();
    const next = TABS[(index + move + TABS.length) % TABS.length];
    selectTab(next.id);
    tabRefs.current[next.id]?.focus();
  }

  function exportCsv() {
    apiRef.current?.exportDataAsCsv({
      fileName: `veriflow-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
      allColumns: true,
      skipPinnedBottom: true,
    });
  }

  const gridProps = {
    search,
    filter,
    onApi: (api) => (apiRef.current = api),
    onDisplayedCount: setDisplayed,
  };
  const total = counts[tab];

  return (
    <section className="page fade dashboard">
      <div className="ph">
        <div>
          {error ? (
            <span className="live live--off" role="status"><b />Reconnecting… {error.message}</span>
          ) : (
            <span className="live"><b />Live · refreshes every few seconds</span>
          )}
          <h1>Dashboard</h1>
          <p>Every job, check result and PayPal action in one place.</p>
        </div>
        <Link className="btn btn--primary" to="/jobs/new">
          <Icon name="plus" size={14} />
          New job
        </Link>
      </div>

      <Stats jobs={jobs} onShowReview={() => selectTab('jobs', 'review')} />

      <div className="card panel">
        <div className="tbar">
          <div className="tabs" role="tablist" aria-label="Dashboard views" onKeyDown={handleTabKey}>
            {TABS.map((t) => (
              <button
                key={t.id}
                ref={(el) => (tabRefs.current[t.id] = el)}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                className={`tab${tab === t.id ? ' on' : ''}`}
                aria-selected={tab === t.id}
                aria-controls="dashboard-panel"
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => selectTab(t.id)}
              >
                {t.label}
                {counts[t.id] !== undefined && <span className="tabs__count">{counts[t.id]}</span>}
              </button>
            ))}
          </div>
          <div className="tbar__right">
            <div className="filters" role="group" aria-label="Filter rows">
              {FILTERS[tab].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`chip${filterKey === key ? ' on' : ''}`}
                  aria-pressed={filterKey === key}
                  onClick={() => setFilterKey(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="search">
              <Icon name="search" size={15} />
              <input
                type="search"
                className="input dashboard__search"
                placeholder="Search this table"
                aria-label="Search this table"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div id="dashboard-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="grid-wrap">
          {tab === 'jobs' && <JobsGrid jobs={jobs} {...gridProps} />}
          {tab === 'results' && <ResultsGrid jobs={jobs} {...gridProps} />}
          {tab === 'audit' && <AuditGrid events={events} {...gridProps} />}
        </div>

        <div className="grid-foot">
          <span className="tabular" aria-live="polite">
            {total === undefined ? 'Loading…' : `Showing ${displayed ?? total} of ${total}`}
          </span>
          <button type="button" className="btn btn--sm" onClick={exportCsv} disabled={!total}>
            <Icon name="download" size={14} />
            Export CSV
          </button>
        </div>
      </div>
    </section>
  );
}
