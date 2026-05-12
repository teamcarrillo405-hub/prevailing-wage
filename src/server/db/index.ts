import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = process.env.DATABASE_PATH || './data/prevailing-wage.db';
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
// INTG-03: prevent SQLITE_BUSY when nightly ERP sync overlaps payroll writes (Phase 126)
sqlite.pragma('busy_timeout = 5000');
const _db = drizzle(sqlite, { schema });

// Auto-apply pending migrations on startup (skipped in test env — tests use in-memory DB)
if (process.env.NODE_ENV !== 'test') {
  migrate(_db, { migrationsFolder: './src/server/db/migrations' });
}

// In test environments, use the in-memory DB set up by tests/helpers/db.ts
export function getDb() {
  return (globalThis as any).__testDb ?? _db;
}

export const db = _db;

export function pingDb(): void {
  sqlite.prepare('SELECT 1').get();
}
