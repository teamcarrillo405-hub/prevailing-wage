import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'fs';

const dbPath = process.env.DATABASE_PATH || './data/prevailing-wage.db';
mkdirSync('./data', { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
const _db = drizzle(sqlite, { schema });

// In test environments, use the in-memory DB set up by tests/helpers/db.ts
export function getDb() {
  return (globalThis as any).__testDb ?? _db;
}

export const db = _db;
