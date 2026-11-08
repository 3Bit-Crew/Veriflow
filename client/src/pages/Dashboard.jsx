import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJobs } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

// A plain list for now. The AG Grid tables replace it in a later phase.
export default function Dashboard() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getJobs()
      .then((result) => active && setJobs(result))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="page">
      <h1>Dashboard</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!jobs && !error && <p className="muted">Loading…</p>}
      {jobs?.length === 0 && <p className="muted">No jobs yet.</p>}
      {jobs?.length > 0 && (
        <ul className="job-list">
          {jobs.map((job) => (
            <li key={job._id}>
              <Link to={`/jobs/${job._id}`}>{job.title}</Link>
              <span className="job-list__amount">${job.amount.toFixed(2)}</span>
              <StatusBadge status={job.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
