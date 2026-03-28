import 'dotenv/config';
import { eq, isNotNull } from 'drizzle-orm';
import { getDb } from '../src/server/db/index.js';
import { workers } from '../src/server/db/schema.js';
import { encryptSsn } from '../src/server/services/cryptoService.js';

// One-time backfill: encrypt existing ssnLast4 values into ssnEncrypted.
// Workers with null ssnLast4 are skipped (per D-09).
// Run with: npx tsx scripts/backfill-ssn-encrypted.ts

async function backfillSsnEncrypted() {
  const db = getDb();

  const workersToBackfill = db
    .select({ id: workers.id, ssnLast4: workers.ssnLast4 })
    .from(workers)
    .where(isNotNull(workers.ssnLast4))
    .all();

  let count = 0;
  for (const worker of workersToBackfill) {
    if (!worker.ssnLast4) continue; // type guard
    const encrypted = encryptSsn(worker.ssnLast4);
    db.update(workers)
      .set({ ssnEncrypted: encrypted })
      .where(eq(workers.id, worker.id))
      .run();
    count++;
  }

  console.log(`Backfilled ${count} workers`);
}

backfillSsnEncrypted().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
