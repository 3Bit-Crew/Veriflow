import { Link, useParams } from 'react-router-dom';

export default function Submit() {
  const { id } = useParams();
  return (
    <section className="page">
      <h1>Submit work</h1>
      <p className="muted">The submission form is coming soon.</p>
      <Link className="button" to={`/jobs/${id}`}>Back to the job</Link>
    </section>
  );
}
