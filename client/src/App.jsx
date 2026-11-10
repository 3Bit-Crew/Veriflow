import { lazy, Suspense } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { isFakeApi, resetFakeData } from './api.js';
import Landing from './pages/Landing.jsx';
import NewJob from './pages/NewJob.jsx';
import Submit from './pages/Submit.jsx';
import JobStatus from './pages/JobStatus.jsx';

// AG Grid is large, so the dashboard loads only when it's opened.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));

function handleReset() {
  resetFakeData();
  window.location.assign('/dashboard');
}

function NotFound() {
  return (
    <section className="page">
      <h1>Page not found</h1>
      <p className="muted">That page doesn't exist.</p>
      <Link className="button" to="/">Back to home</Link>
    </section>
  );
}

export default function App() {
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">Veriflow</Link>
          <nav className="site-nav" aria-label="Main">
            {isFakeApi && (
              <button
                type="button"
                className="fake-chip"
                title="The app is using sample data, not the server. Click to reset it."
                onClick={handleReset}
              >
                Sample data · Reset
              </button>
            )}
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/jobs/new">Create a job</NavLink>
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/jobs/new" element={<NewJob />} />
          <Route path="/jobs/:id/submit" element={<Submit />} />
          <Route path="/jobs/:id" element={<JobStatus />} />
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<section className="page"><p className="muted">Loading the dashboard…</p></section>}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
