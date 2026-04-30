import 'dotenv/config';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/server/db/index.js';
import { auditLogs } from '../src/server/db/schema.js';
import { logger } from '../src/server/logger.js';

export interface BackfillReport {
  scanned: number;       // total rows examined
  alreadyHashed: number; // rows where entry_hash was already non-null (skipped, prevHash carry forward)
  backfilled: number;    // rows where entry_hash was null and got computed
}

/**
 * One-time backfill: walks audit_logs in stable chronological order
 * (created_at ASC, id ASC — ties broken by id for determinism) and computes
 * entry_hash + previous_hash for any row where entry_hash IS NULL.
 *
 * Formula mirrors computeAuditEntryHash() in auditService.ts exactly:
 *   SHA-256(`${id}|${action}|${prevHash ?? ''}|${createdAt}`)
 *
 * Idempotent: re-running on a fully-hashed table is a no-op (returns backfilled:0).
 *
 * @param dbHandle - Drizzle DB handle; defaults to getDb() for production use.
 *                   Pass a test DB handle to use the same in-memory DB as tests.
 */
export async function runBackfill(dbHandle = getDb()): Promise<BackfillReport> {
  const rows = await dbHandle
    .select()
    .from(auditLogs)
    .orderBy(auditLogs.createdAt, auditLogs.id);

  let prevHash: string | null = null;
  let scanned = 0;
  let alreadyHashed = 0;
  let backfilled = 0;

  for (const row of rows) {
    scanned++;

    if (row.entryHash) {
      // Already part of the chain — carry its hash forward as the next prevHash.
      prevHash = row.entryHash;
      alreadyHashed++;
      continue;
    }

    // Compute entry_hash using the SAME formula as computeAuditEntryHash:
    //   SHA-256(`${id}|${action}|${prevHash ?? ''}|${createdAt}`)
    const entryHash = createHash('sha256')
      .update(`${row.id}|${row.action}|${prevHash ?? ''}|${row.createdAt}`, 'utf8')
      .digest('hex');

    await dbHandle
      .update(auditLogs)
      .set({ previousHash: prevHash, entryHash })
      .where(eq(auditLogs.id, row.id));

    prevHash = entryHash;
    backfilled++;
  }

  return { scanned, alreadyHashed, backfilled };
}

// CLI runner — only executes when invoked directly via `npx tsx scripts/backfill-audit-hash-chain.ts`
const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  // Windows: handle both forward-slash and backslash paths
  process.argv[1]?.endsWith('backfill-audit-hash-chain.ts') ||
  process.argv[1]?.endsWith('backfill-audit-hash-chain.js');

if (isMain) {
  runBackfill()
    .then((report) => {
      logger.info({ report }, 'audit hash chain backfill complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'audit hash chain backfill failed');
      process.exit(1);
    });
}
