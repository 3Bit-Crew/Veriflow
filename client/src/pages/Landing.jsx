import { Link } from 'react-router-dom';

const STEPS = [
  { title: 'Agree', text: 'Describe the job in plain English. AI turns it into a checklist you approve.' },
  { title: 'Hold', text: 'Your payment is held on PayPal. You are not charged yet.' },
  { title: 'Prove', text: 'The worker submits a pull request or website, and every item is checked against real evidence.' },
  { title: 'Release', text: 'PayPal pays for what passed. The worker gets one chance to fix anything that failed.' },
];

export default function Landing() {
  return (
    <section className="page landing">
      <h1 className="landing__title">Money moves only when the work is proven.</h1>
      <p className="landing__lead">
        Veriflow is escrow where AI checks the delivered work, and PayPal releases the money only
        when it meets the agreed requirements.
      </p>
      <div className="actions">
        <Link className="button button--primary" to="/jobs/new">Create a job</Link>
        <Link className="button" to="/dashboard">View the dashboard</Link>
      </div>

      <ol className="steps">
        {STEPS.map((step) => (
          <li key={step.title} className="steps__item">
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
