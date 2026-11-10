import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getEvents, getJobs } from '../api.js';
import AuditGrid from '../components/grids/AuditGrid.jsx';
import JobsGrid from '../components/grids/JobsGrid.jsx';
import ResultsGrid, { resultRows } from '../components/grids/ResultsGrid.jsx';

const REFRESH_MS = 5000;

const TABS = [
  { id: 'jobs', label: 'Jobs' },
  { id: 'results', label: 'Checklist results' },
  { id: 'audit', label: 'Audit log' },
];

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

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'jobs';
  const [search, setSearch] = useState('');
  const { jobs, events, error } = useDashboardData();
  const tabRefs = useRef({});

  const counts = useMemo(
    () => ({ jobs: jobs?.length, results: jobs ? resultRows(jobs).length : undefined, audit: events?.length }),
    [jobs, events],
  );

  // The tab lives in the URL so a reload (or a shared link) opens the same grid.
  function selectTab(id) {
    setParams(id === 'jobs' ? {} : { tab: id }, { replace: true });
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

  return (
    <section className="page dashboard">
      <div className="stack stack--tight">
        <h1>Dashboard</h1>
        <p className="muted">Every job, check result and PayPal action in one place. Updates every few seconds.</p>
      </div>

      <div className="dashboard__bar">
        <div className="tabs" role="tablist" aria-label="Dashboard views" onKeyDown={handleTabKey}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => (tabRefs.current[t.id] = el)}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
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
        <input
          type="search"
          className="input dashboard__search"
          placeholder="Search this table"
          aria-label="Search this table"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="notice" role="status">Couldn't refresh: {error.message} Retrying…</p>}

      <div id="dashboard-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="grid-wrap">
        {tab === 'jobs' && <JobsGrid jobs={jobs} search={search} />}
        {tab === 'results' && <ResultsGrid jobs={jobs} search={search} />}
        {tab === 'audit' && <AuditGrid events={events} search={search} />}
      </div>
    </section>
  );
}
