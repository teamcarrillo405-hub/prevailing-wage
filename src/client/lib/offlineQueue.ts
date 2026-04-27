// src/client/lib/offlineQueue.ts
// IDB-backed offline request queue for PWA offline support (MOB-04)
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  body: string; // JSON-stringified
  headers: string; // JSON-stringified Record<string, string>
  idempotencyKey: string;
  queuedAt: number;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const DB_NAME = 'offline-queue';
const STORE_NAME = 'requests';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbPromise: Promise<IDBPDatabase<any>> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(): Promise<IDBPDatabase<any>> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueRequest(
  url: string,
  method: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<void> {
  const db = await getDb();
  const item: QueuedRequest = {
    url,
    method: method.toUpperCase(),
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: JSON.stringify(headers),
    idempotencyKey: generateIdempotencyKey(),
    queuedAt: Date.now(),
  };
  await db.add(STORE_NAME, item);
}

export async function processQueue(): Promise<void> {
  const db = await getDb();
  const all: QueuedRequest[] = await db.getAll(STORE_NAME);

  // Oldest first
  all.sort((a, b) => a.queuedAt - b.queuedAt);

  for (const item of all) {
    const parsedHeaders: Record<string, string> = JSON.parse(item.headers);
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...parsedHeaders,
      'Idempotency-Key': item.idempotencyKey,
    };

    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: requestHeaders,
        body: item.body,
        credentials: 'include',
      });

      if (res.ok) {
        // 2xx — remove from queue
        await db.delete(STORE_NAME, item.id!);
      } else if (res.status >= 500) {
        // Server error — keep for retry
        console.warn('[offlineQueue] Server error replaying', item.url, res.status);
      } else {
        // 4xx client error — remove (not retriable)
        await db.delete(STORE_NAME, item.id!);
      }
    } catch {
      // Network error — keep for next attempt
      console.warn('[offlineQueue] Network error replaying', item.url);
    }
  }
}

export async function getQueueLength(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}

/**
 * Register a Background Sync tag with the service worker.
 * No-ops silently on Safari / non-SW environments where SyncManager is unavailable.
 * In those browsers, the window 'online' event + processQueue() provides the fallback.
 */
export async function registerSyncIfSupported(tag: string): Promise<void> {
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!('SyncManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // TypeScript doesn't include sync in the standard lib — cast needed
    const syncReg = reg as ServiceWorkerRegistration & {
      sync: { register(tag: string): Promise<void> };
    };
    await syncReg.sync.register(tag);
  } catch (err) {
    // Ignore — Background Sync not available or SW not active
    console.warn('[offlineQueue] registerSyncIfSupported failed:', err);
  }
}
