import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jobRoutes from './routes/jobs.js';
import paypalRoutes from './routes/paypal.js';
import eventRoutes from './routes/events.js';
import screenshotRoutes from './routes/screenshots.js';
import { startCheckerLoop } from './checkers/loop.js';

import dns from 'node:dns';
dotenv.config({ quiet: true });
// Some internet providers' DNS blocks MongoDB Atlas lookups (querySrv ECONNREFUSED).
// Set DNS_SERVERS=8.8.8.8,1.1.1.1 in .env to use public DNS instead. Must come after dotenv.config().
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));

const app = express();
const PORT = process.env.PORT || 5000;

// CORS: which websites may call this API. CLIENT_URL can list several, separated by commas,
// e.g. "https://veriflow-web.onrender.com,http://localhost:5173"
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/jobs', jobRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/screenshots', screenshotRoutes);

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Errors are always { error: "message" } (see PLAN.md 5.8)
app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  if (err.name === 'ValidationError' || err.name === 'CastError') status = 400; // bad input caught by Mongoose
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error' });
});

async function start() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  // B's checker loop: checks submitted work every 5 seconds.
  // Only ONE server should run it per database. When the Render server is live, set
  // CHECKER_LOOP=false in your laptop's .env (a restarting laptop would re-queue jobs Render is checking).
  let stopLoop = null;
  if (process.env.CHECKER_LOOP === 'false') {
    console.log('[checker] loop is OFF (CHECKER_LOOP=false)');
  } else {
    stopLoop = startCheckerLoop();
  }

  const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

  // Render sends SIGTERM before replacing the server on each deploy: stop cleanly.
  // (A job cut off mid-check is re-queued by the loop when the new server starts.)
  process.once('SIGTERM', () => {
    console.log('SIGTERM received, shutting down');
    stopLoop?.();
    server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref(); // don't hang forever
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
