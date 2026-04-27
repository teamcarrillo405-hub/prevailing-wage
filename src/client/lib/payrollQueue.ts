// src/client/lib/payrollQueue.ts
// IndexedDB-backed payroll entry queue for offline-first payroll entry (MOB-16, MOB-17)
// Follows the same lazy-singleton openDB pattern as offlineQueue.ts.
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

export const PAYROLL_QUEUE_DB = 'payroll-queue';
export const PAYROLL_STORE = 'entries';

// EntryPayload is defined inline to avoid circular refs with useEntryMutation.ts
export interface EntryPayload {
  workerId: string;
  classificationId: string;
  values: Record<string, number | null>;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  deductions: number;
  grossWages?: number | null;
  netPay?: number | null;
}

export interface PayrollQueueEntry {
  id?: number;
  weekId: string;
  projectId: string;
  workerId: string;
  classificationId: string;
  payload: EntryPayload;
  status: 'pending' | 'syncing' | 'synced-elsewhere';
  queuedAt: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbPromise: Promise<IDBPDatabase<any>> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(): Promise<IDBPDatabase<any>> {
  if (!dbPromise) {
    dbPromise = openDB(PAYROLL_QUEUE_DB, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PAYROLL_STORE)) {
          const store = db.createObjectStore(PAYROLL_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('weekId', 'weekId', { unique: false });
          store.createIndex('composite', ['weekId', 'workerId', 'classificationId'], {
            unique: false,
          });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Exported for testing only — clears all entries from the store so tests start fresh.
 */
export async function _resetDb(): Promise<void> {
  // Reset the singleton so a fresh openDB call is made after clearing
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.clear(PAYROLL_STORE);
    } catch {
      // Ignore errors during cleanup
    }
  }
  dbPromise = null;
}

/**
 * Upsert a payroll entry into the queue.
 * If an entry with the same (weekId, workerId, classificationId) exists, it is overwritten.
 */
export async function enqueuePayrollEntry(
  weekId: string,
  projectId: string,
  payload: EntryPayload,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(PAYROLL_STORE, 'readwrite');
  const store = tx.objectStore(PAYROLL_STORE);
  const all: PayrollQueueEntry[] = await store.getAll();

  // Find existing entry with same composite key
  const existing = all.find(
    (e) =>
      e.weekId === weekId &&
      e.workerId === payload.workerId &&
      e.classificationId === payload.classificationId,
  );

  if (existing) {
    // Overwrite in-place — keep same id, reset to pending
    const updated: PayrollQueueEntry = {
      ...existing,
      payload,
      status: 'pending',
      queuedAt: Date.now(),
    };
    await store.put(updated);
  } else {
    const entry: PayrollQueueEntry = {
      weekId,
      projectId,
      workerId: payload.workerId,
      classificationId: payload.classificationId,
      payload,
      status: 'pending',
      queuedAt: Date.now(),
    };
    await store.add(entry);
  }

  await tx.done;
}

/**
 * Return all queued entries, optionally filtered by weekId, sorted by queuedAt asc.
 */
export async function getPayrollQueue(weekId?: string): Promise<PayrollQueueEntry[]> {
  const db = await getDb();
  let all: PayrollQueueEntry[];

  if (weekId) {
    const idx = db.transaction(PAYROLL_STORE, 'readonly').objectStore(PAYROLL_STORE).index('weekId');
    all = await idx.getAll(weekId);
  } else {
    all = await db.getAll(PAYROLL_STORE);
  }

  return all.sort((a, b) => a.queuedAt - b.queuedAt);
}

/**
 * Delete a single entry by composite key. No-op if not found.
 */
export async function clearPayrollEntry(
  weekId: string,
  workerId: string,
  classificationId: string,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(PAYROLL_STORE, 'readwrite');
  const store = tx.objectStore(PAYROLL_STORE);
  const all: PayrollQueueEntry[] = await store.getAll();

  const match = all.find(
    (e) => e.weekId === weekId && e.workerId === workerId && e.classificationId === classificationId,
  );

  if (match?.id !== undefined) {
    await store.delete(match.id);
  }

  await tx.done;
}

/**
 * Mark an entry as 'synced-elsewhere' (server returned 409 — another device already submitted).
 * Does NOT delete the entry so callers can surface conflict UI.
 */
export async function markSyncedElsewhere(
  weekId: string,
  workerId: string,
  classificationId: string,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(PAYROLL_STORE, 'readwrite');
  const store = tx.objectStore(PAYROLL_STORE);
  const all: PayrollQueueEntry[] = await store.getAll();

  const match = all.find(
    (e) => e.weekId === weekId && e.workerId === workerId && e.classificationId === classificationId,
  );

  if (match) {
    const updated: PayrollQueueEntry = { ...match, status: 'synced-elsewhere' };
    await store.put(updated);
  }

  await tx.done;
}

/**
 * Return the count of entries with status='pending'.
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const all: PayrollQueueEntry[] = await db.getAll(PAYROLL_STORE);
  return all.filter((e) => e.status === 'pending').length;
}
