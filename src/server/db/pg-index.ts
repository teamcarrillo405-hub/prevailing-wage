import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as pgSchema from './pg-schema.js';

let _pgDb: ReturnType<typeof drizzle<typeof pgSchema>> | null = null;

export function getPgDb() {
  if (!_pgDb) {
    const client = postgres(process.env.DATABASE_URL!);
    _pgDb = drizzle(client, { schema: pgSchema });
  }
  return _pgDb;
}
