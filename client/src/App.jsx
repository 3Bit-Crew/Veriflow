import { lazy, Suspense } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { isFakeApi, resetFakeData } from './api.js';
import Landing from './pages/Landing.jsx';
import WakeNotice from './components/WakeNotice.jsx';
import { BrandMark, Icon } from './components/ui.jsx';

// The landing page loads first; every other page (and AG Grid, and PayPal) only when opened.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const NewJob = lazy(() => import('./pages/NewJob.jsx'));
const Submit = lazy(() => import('./pages/Submit.jsx'));
const JobStatus = lazy(() => import('./pages/JobStatus.jsx'));

function PageLoading() {
  return (
    <section className="page">
      <p className="loading-line"><span className="spin" />Loading…</p>
    </section>
  );
}

function handleReset() {
  resetFakeData();
  window.location.assign('/dashboard');
}

function NotFound() {
  return (
    <section className="page page--narrow">
      <div className="card empty-state">
        <h1>Page not found</h1>
        <p>That page doesn't exist.</p>
        <Link className="btn btn--primary" to="/">Back to home</Link>
      </div>
    </section>
  );
}

function Nav() {
  const { pathname } = useLocation();
  return (
    <header className="nav">
      <div className="nav__in">
        <Link to="/" className="brand" aria-label="Veriflow home">
          <BrandMark />
          Veriflow
        </Link>
        <nav className="nav__links" aria-label="Main">
          <NavLink to="/dashboard" className={({ isActive }) => `nav__link${isActive ? ' on' : ''}`}>
            Dashboard
          </NavLink>
          <Link to="/#how" className={`nav__link${pathname === '/' ? ' on' : ''}`}>
            How it works
          </Link>
        </nav>
        <div className="nav__right">
          {isFakeApi ? (
            <button
              type="button"
              className="sandbox fake-chip"
              title="The app is using sample data, not the server. Click to reset it."
              onClick={handleReset}
            >
              <b />
              <span className="sandbox--label">Sample data · </span>Reset
            </button>
          ) : (
            <span className="sandbox">
              <b />
              <span className="sandbox--label">PayPal </span>sandbox
            </span>
          )}
          <NavLink to="/jobs/new" className="btn btn--primary btn--sm">
            <Icon name="plus" size={14} />
            New job
          </NavLink>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/jobs/new" element={<NewJob />} />
            <Route path="/jobs/:id/submit" element={<Submit />} />
            <Route path="/jobs/:id" element={<JobStatus />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <WakeNotice />
    </>
  );
}
