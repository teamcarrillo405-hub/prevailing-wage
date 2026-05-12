import Database from 'better-sqlite3';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Phase 126 — db pragmas', () => {
  it('busy_timeout pragma is 5000 (INTG-03)', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('busy_timeout = 5000');
    expect(sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
  });
});

describe('Phase 126 — integration tables', () => {
  it('migration 0070 creates integration_connections and integration_sync_runs (INTG-02)', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec('CREATE TABLE users (id text PRIMARY KEY)');
    sqlite.exec("INSERT INTO users (id) VALUES ('u1')");
    const sql = readFileSync(resolve(__dirname, '../../src/server/db/migrations/0070_integration_foundation.sql'), 'utf-8');
    for (const stmt of sql.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
    sqlite.prepare("INSERT INTO integration_connections (id,user_id,erp_type,sync_status,consecutive_failure_count,connected_at,updated_at) VALUES (?,?,?,?,?,?,?)").run('c1','u1','sage300','idle',0,'2026-05-12','2026-05-12');
    sqlite.prepare("INSERT INTO integration_sync_runs (id,connection_id,erp_type,started_at,records_synced,errors_count,trigger) VALUES (?,?,?,?,?,?,?)").run('r1','c1','sage300','2026-05-12T02:00:00Z',0,0,'cron');
    const conn = sqlite.prepare("SELECT id, erp_type, sync_status FROM integration_connections WHERE id=?").get('c1') as any;
    expect(conn.erp_type).toBe('sage300');
    expect(conn.sync_status).toBe('idle');
    const run = sqlite.prepare("SELECT trigger FROM integration_sync_runs WHERE id=?").get('r1') as any;
    expect(run.trigger).toBe('cron');
  });

  it('migration 0070 is registered in _journal.json (Pitfall 2)', () => {
    const journal = JSON.parse(readFileSync(resolve(__dirname, '../../src/server/db/migrations/meta/_journal.json'), 'utf-8'));
    const entry = journal.entries.find((e: any) => e.tag === '0070_integration_foundation');
    expect(entry).toBeDefined();
    expect(entry.idx).toBe(70);
    expect(entry.breakpoints).toBe(true);
  });
});
