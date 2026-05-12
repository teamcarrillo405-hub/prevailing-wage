/**
 * Phase 126-03 — runErpNightlySync tests (INTG-06)
 *
 * Tests the nightly ERP sync job that iterates integration_connections
 * sequentially (no Promise.all) and writes one integration_sync_runs row
 * per connection attempt.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Mock requireAuth for any transitive imports
vi.mock('../../src/server/middleware/auth.js', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

// ── In-memory DB setup ───────────────────────────────────────────────────────

async function setupTestDb() {
  const Database = (await import('better-sqlite3')).default;
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema = await import('../../src/server/db/schema.js');
  const sqlite = new (Database as any)(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec('CREATE TABLE users (id text PRIMARY KEY)');
  sqlite.prepare("INSERT INTO users (id) VALUES (?)").run('u1');
  const sql = readFileSync(
    resolve(__dirname, '../../src/server/db/migrations/0070_integration_foundation.sql'),
    'utf-8'
  );
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const t = stmt.trim();
    if (t) sqlite.exec(t);
  }
  const db = drizzle(sqlite, { schema });
  (globalThis as any).__testDb = db;
  return { sqlite, db };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Phase 126 — runErpNightlySync (INTG-06)', () => {
  it('completes without error on empty connections table', async () => {
    const { sqlite } = await setupTestDb();
    const { runErpNightlySync } = await import('../../src/server/jobs/erpNightlySync.js');
    await expect(runErpNightlySync()).resolves.toBeUndefined();
    sqlite.close();
  });

  it('writes one integration_sync_runs row per connection with trigger=cron', async () => {
    const { sqlite } = await setupTestDb();
    const now = new Date().toISOString();
    sqlite.prepare(
      "INSERT INTO integration_connections (id,user_id,erp_type,sync_status,consecutive_failure_count,connected_at,updated_at) VALUES (?,?,?,?,?,?,?)"
    ).run('c1', 'u1', 'sage300', 'idle', 0, now, now);
    sqlite.prepare(
      "INSERT INTO integration_connections (id,user_id,erp_type,sync_status,consecutive_failure_count,connected_at,updated_at) VALUES (?,?,?,?,?,?,?)"
    ).run('c2', 'u1', 'vista', 'idle', 0, now, now);

    const { runErpNightlySync } = await import('../../src/server/jobs/erpNightlySync.js');
    await runErpNightlySync();

    const runs = sqlite.prepare("SELECT trigger, connection_id FROM integration_sync_runs").all() as any[];
    expect(runs.length).toBe(2);
    expect(runs.every((r: any) => r.trigger === 'cron')).toBe(true);
    sqlite.close();
  });

  it('skips connections already in running state', async () => {
    const { sqlite } = await setupTestDb();
    const now = new Date().toISOString();
    sqlite.prepare(
      "INSERT INTO integration_connections (id,user_id,erp_type,sync_status,consecutive_failure_count,connected_at,updated_at) VALUES (?,?,?,?,?,?,?)"
    ).run('c1', 'u1', 'sage300', 'running', 0, now, now);

    const { runErpNightlySync } = await import('../../src/server/jobs/erpNightlySync.js');
    await runErpNightlySync();

    const runs = sqlite.prepare("SELECT count(*) as n FROM integration_sync_runs").get() as any;
    expect(runs.n).toBe(0);
    sqlite.close();
  });
});

it('cron job #6 is registered in index.ts with UTC timezone (Pitfall 7)', () => {
  const src = readFileSync(resolve(__dirname, '../../src/server/index.ts'), 'utf-8');
  expect(src).toMatch(/cron\.schedule\(\s*['"]0 2 \* \* \*['"]/);
  expect(src).toMatch(/runErpNightlySync/);
  // Verify the cron block uses UTC timezone (search within +500 chars of the schedule call).
  const idx = src.indexOf("'0 2 * * *'");
  const window = src.slice(idx, idx + 500);
  expect(window).toMatch(/timezone:\s*['"]UTC['"]/);
});
