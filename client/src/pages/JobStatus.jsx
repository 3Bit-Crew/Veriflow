import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getJob } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function JobStatus() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    getJob(id)
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <section className="page">
        <h1>Couldn't load this job</h1>
        <p className="form-error" role="alert">{error}</p>
      </section>
    );
  }
  if (!data) return <section className="page"><p className="muted">Loading…</p></section>;

  const { job } = data;
  return (
    <section className="page">
      <div className="page-heading">
        <h1>{job.title}</h1>
        <StatusBadge status={job.status} />
      </div>
      <p className="muted">{job.description}</p>
      <p className="muted">Live checklist results are coming soon.</p>
    </section>
  );
}
