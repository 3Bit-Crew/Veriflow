import { paypalRequest } from './client.js';

// PayPal wants money as a string with 2 decimals: 140 -> "140.00"
export function money(n) {
  return Number(n).toFixed(2);
}

// Step 1 of paying: create an order that will HOLD the buyer's money (intent AUTHORIZE),
// to be paid later to the worker (payee).
// returnUrl/cancelUrl: where PayPal sends the buyer after the checkout page. Only needed when
// the buyer opens approveUrl directly (test script). The React PayPal button doesn't need them.
// Returns { orderId, approveUrl }.
export async function createOrder(job, { returnUrl, cancelUrl } = {}) {
  const experience = {
    brand_name: 'Veriflow',
    shipping_preference: 'NO_SHIPPING', // digital work, no address needed
    user_action: 'CONTINUE'             // button says "Continue": money is held, not taken yet
  };
  if (returnUrl) experience.return_url = returnUrl;
  if (cancelUrl) experience.cancel_url = cancelUrl;

  const order = await paypalRequest('POST', '/v2/checkout/orders', {
    intent: 'AUTHORIZE',
    purchase_units: [{
      reference_id: job._id.toString(),
      description: job.title.slice(0, 127),
      amount: { currency_code: job.currency, value: money(job.amount) },
      payee: { email_address: job.workerEmail }
    }],
    payment_source: { paypal: { experience_context: experience } }
  });

  const approveUrl = order.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve')?.href;
  return { orderId: order.id, approveUrl };
}

// Step 2: after the buyer approves in the PayPal popup, lock the hold.
// Returns the authorization id (needed later to capture or void) and the buyer's email.
export async function authorizeOrder(orderId) {
  const result = await paypalRequest('POST', `/v2/checkout/orders/${orderId}/authorize`, {}, {
    requestId: `authorize-${orderId}`
  });
  const auth = result.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new Error('PayPal did not return an authorization id');
  return { authId: auth.id, authStatus: auth.status, buyerEmail: result.payer?.email_address };
}

// Pay the worker `amount` from the hold. final_capture: true releases whatever is left back to the buyer.
export async function captureAuthorization(authId, amount, currency, requestId) {
  return paypalRequest('POST', `/v2/payments/authorizations/${authId}/capture`, {
    amount: { currency_code: currency, value: money(amount) },
    final_capture: true
  }, { requestId });
}

// Cancel the hold completely. The buyer keeps all the money.
export async function voidAuthorization(authId, requestId) {
  return paypalRequest('POST', `/v2/payments/authorizations/${authId}/void`, null, { requestId });
}
