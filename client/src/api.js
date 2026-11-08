// One function per endpoint in PLAN.md 5.8. Pages call these and never use fetch directly.
// Set VITE_USE_FAKE_API=true to run against sample data in the browser instead of the server.
import * as fake from './fake/fakeApi.js';

export const isFakeApi = import.meta.env.VITE_USE_FAKE_API === 'true';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Failed calls throw an Error with the server's message and an HTTP `status`.
async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error('Could not reach the server. Check your connection and try again.'), { status: 0 });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { status: res.status });
  }
  return data;
}

const real = {
  createJob: (job) => request('POST', '/api/jobs', job),
  generateChecklist: (id) => request('POST', `/api/jobs/${id}/checklist`, {}),
  approveChecklist: (id, items) => request('PUT', `/api/jobs/${id}/checklist`, { items }),
  createPayPalOrder: (jobId) => request('POST', '/api/paypal/orders', { jobId }),
  authorizePayPalOrder: (orderId, jobId) => request('POST', `/api/paypal/orders/${orderId}/authorize`, { jobId }),
  submitWork: (id, submissionUrl) => request('POST', `/api/jobs/${id}/submit`, { submissionUrl }),
  reviewJob: (id, payoutAmount) => request('POST', `/api/jobs/${id}/review`, { payoutAmount }),
  getJobs: () => request('GET', '/api/jobs'),
  getJob: (id) => request('GET', `/api/jobs/${id}`), // returns { job, events }
  getEvents: () => request('GET', '/api/events'),
  screenshotUrl: (id) => `${BASE_URL}/api/screenshots/${id}`,
};

const api = isFakeApi ? fake : real;

export const {
  createJob,
  generateChecklist,
  approveChecklist,
  createPayPalOrder,
  authorizePayPalOrder,
  submitWork,
  reviewJob,
  getJobs,
  getJob,
  getEvents,
  screenshotUrl,
} = api;

export const resetFakeData = fake.resetFakeData;
