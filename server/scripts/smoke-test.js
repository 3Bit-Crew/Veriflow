// Quick check that a deployed (or local) server works. Read-only: it creates nothing.
//   node scripts/smoke-test.js https://veriflow-api.onrender.com [https://veriflow-web.onrender.com]
// The 2nd URL (the client) is optional: it checks that CORS lets the website call the API.
// Note: a free Render service sleeps after 15 min idle, so the first call can take ~1 minute.

const api = (process.argv[2] || 'http://localhost:5000').replace(/\/+$/, '');
const client = process.argv[3]?.replace(/\/+$/, '');
let failed = 0;

async function check(label, fn) {
  try {
    const note = await fn();
    console.log(`OK    ${label}${note ? ' - ' + note : ''}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${label} - ${err.message}`);
  }
}

async function get(path, headers = {}) {
  const res = await fetch(api + path, { headers, signal: AbortSignal.timeout(90_000) });
  const body = await res.json().catch(() => null);
  return { res, body };
}

console.log(`Testing ${api}\n`);

await check('server is up and database connected', async () => {
  const { res, body } = await get('/api/health');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (body.db !== 'connected') throw new Error(`database is ${body.db} (check MONGODB_URI and Atlas Network Access)`);
  return 'db connected';
});

await check('GET /api/jobs', async () => {
  const { res, body } = await get('/api/jobs');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body?.error}`);
  return `${body.length} jobs`;
});

await check('GET /api/events', async () => {
  const { res, body } = await get('/api/events');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body?.error}`);
  return `${body.length} events`;
});

await check('unknown job gives a JSON 404', async () => {
  const { res, body } = await get('/api/jobs/000000000000000000000000');
  if (res.status !== 404 || !body?.error) throw new Error(`expected 404 with { error }, got ${res.status}`);
});

if (client) {
  await check(`CORS allows ${client}`, async () => {
    const { res } = await get('/api/health', { Origin: client });
    const allowed = res.headers.get('access-control-allow-origin');
    if (allowed !== client) throw new Error(`server allows "${allowed ?? 'nothing'}". Add ${client} to CLIENT_URL on the server`);
  });

  await check('client website loads', async () => {
    const res = await fetch(client, { signal: AbortSignal.timeout(60_000) });
    const html = await res.text();
    if (!res.ok || !html.includes('id="root"')) throw new Error(`HTTP ${res.status}, not the React app`);
  });

  await check('client page refresh works (e.g. /dashboard)', async () => {
    const res = await fetch(client + '/dashboard', { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}. The rewrite rule /* -> /index.html is missing`);
  });
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exitCode = failed ? 1 : 0;
