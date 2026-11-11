import { useSyncExternalStore } from 'react';
import { getSlowRequests, isFakeApi, subscribeSlowRequests } from '../api.js';

// Shown while any request to the server has taken more than 5 seconds, which on Render's
// free plan almost always means the server is waking up. It never blocks the page.
export default function WakeNotice() {
  const slow = useSyncExternalStore(subscribeSlowRequests, getSlowRequests);
  if (isFakeApi || slow === 0) return null;

  return (
    <div className="wake-notice" role="status">
      <span className="spin spin--dark" aria-hidden="true" />
      <p>
        <strong>Waking up the server…</strong> It sleeps when nobody is using it, so the first load can take up to a
        minute.
      </p>
    </div>
  );
}
