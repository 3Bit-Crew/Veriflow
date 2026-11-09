// Talks to the PayPal REST API. Every PayPal call in the project goes through paypalRequest().

let cachedToken = null;
let tokenExpiresAt = 0;

function baseUrl() {
  return process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
}

// Logs our server in to PayPal with the Client ID + Secret and returns an access token.
// The token lasts ~9 hours, so we keep it and only ask for a new one shortly before it expires.
export async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const id = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing in .env');

  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal login failed: ${data.error_description || res.status}`);

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // renew 1 minute early
  return cachedToken;
}

// Sends one request to PayPal and returns the JSON reply.
// requestId: PayPal remembers it, so if the same request is sent twice (e.g. a retry),
// PayPal does it only once. We use it so money is never captured twice.
export async function paypalRequest(method, path, body, { requestId } = {}) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation' // ask PayPal to send back the full object
  };
  if (requestId) headers['PayPal-Request-Id'] = requestId;

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text(); // some replies (e.g. void) can be empty
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    // Turn PayPal's error into a readable message, e.g. "UNPROCESSABLE_ENTITY: PAYEE_ACCOUNT_INVALID"
    const issue = data.details?.[0]?.issue;
    const err = new Error(`PayPal ${data.name || res.status}${issue ? ': ' + issue : ''} (${method} ${path})`);
    err.status = 502; // 502 = an outside service (PayPal) failed
    err.paypal = { httpStatus: res.status, debugId: data.debug_id, details: data.details };
    throw err;
  }
  return data;
}
