// Kick off a full WDOL sync from the CLI without starting the HTTP server.
// Calls runWageSync() directly — same function used by cron and POST /api/wages/sync.
//
//   npx tsx scripts/run-wage-sync.mts
//
// Progress is logged per-seed by wdolSync itself. This wrapper just times the run
// and reports the final summary. Skip-cache logic (isWdCached) makes re-runs safe —
// already-cached unexpired WDs are silently skipped.

import { runWageSync } from '../src/server/services/wdolSync.js';

const started = Date.now();
console.log(`[run-wage-sync] starting at ${new Date().toISOString()}`);

try {
  const { fetched, failed } = await runWageSync();
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[run-wage-sync] done in ${elapsed}s — fetched=${fetched} failed=${failed}`);
  process.exit(0);
} catch (err) {
  console.error('[run-wage-sync] fatal:', err);
  process.exit(1);
}
