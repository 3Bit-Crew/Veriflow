import { useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { authorizePayPalOrder, createPayPalOrder, isFakeApi } from '../api.js';
import { formatMoney } from '../format.js';

const CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

// Holds the job's payment on PayPal (PLAN.md 5.9). intent "authorize" means the buyer
// approves now and is only charged later, when settleJob captures the money.
// Calls onAuthorized(job) with the FUNDED job once the hold is in place.
export default function PayPalButton({ job, onAuthorized }) {
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  async function authorize(orderId) {
    setConfirming(true);
    try {
      onAuthorized(await authorizePayPalOrder(orderId, job._id));
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    }
  }

  if (isFakeApi) {
    async function simulate() {
      setError(null);
      try {
        const { orderId } = await createPayPalOrder(job._id);
        await authorize(orderId);
      } catch (err) {
        setError(err.message);
      }
    }
    return (
      <div className="stack">
        <button type="button" className="button button--primary" onClick={simulate} disabled={confirming}>
          {confirming ? 'Holding payment…' : `Simulate PayPal approval of ${formatMoney(job.amount, job.currency)}`}
        </button>
        <p className="muted small">Sample data mode: no PayPal window opens.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (!CLIENT_ID) {
    return (
      <p className="form-error" role="alert">
        PayPal isn't set up. Add VITE_PAYPAL_CLIENT_ID to client/.env and restart the dev server.
      </p>
    );
  }

  return (
    <div className="stack">
      <div className="paypal-slot" aria-busy={confirming}>
        <PayPalScriptProvider options={{ clientId: CLIENT_ID, intent: 'authorize', currency: job.currency || 'USD' }}>
          <PayPalButtons
            style={{ layout: 'vertical', label: 'pay' }}
            createOrder={async () => {
              setError(null);
              try {
                const { orderId } = await createPayPalOrder(job._id);
                return orderId;
              } catch (err) {
                setError(err.message);
                throw err;
              }
            }}
            onApprove={(data) => authorize(data.orderID)}
            onCancel={() => setError('PayPal was closed before approving. Nothing was held.')}
            onError={() => setError((current) => current || 'PayPal ran into a problem. Please try again.')}
          />
        </PayPalScriptProvider>
      </div>
      {confirming && <p className="muted" aria-live="polite">Confirming the hold with PayPal…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
