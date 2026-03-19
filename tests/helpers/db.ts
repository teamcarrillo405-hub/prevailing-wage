import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/server/db/schema.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeAll, afterAll } from 'vitest';

let sqlite: InstanceType<typeof Database>;

beforeAll(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './src/server/db/migrations' });
  // expose on global for test files to import
  (globalThis as any).__testDb = db;
});

afterAll(() => {
  sqlite?.close();
});
