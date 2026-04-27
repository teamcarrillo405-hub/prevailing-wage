// Phase 98 — IndexedDB wrapper for offline compliance checklists (MOB-22)
// No IDB library — uses native indexedDB API wrapped in Promises.

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface Checklist {
  id: string;
  projectId: string;
  title: string;
  items: ChecklistItem[];
  createdAt: string;
  completedAt: string | null;
  syncedAt: string | null;
}

const DB_NAME = 'pw-checklists';
const DB_VERSION = 1;
const STORE = 'checklists';

export function openChecklistDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

export async function saveChecklist(checklist: Checklist): Promise<void> {
  const db = await openChecklistDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.put(checklist);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function getChecklists(projectId?: string): Promise<Checklist[]> {
  const db = await openChecklistDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = (e) => {
      let results = (e.target as IDBRequest<Checklist[]>).result;
      if (projectId) results = results.filter((c) => c.projectId === projectId);
      resolve(results);
    };
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function markSynced(id: string): Promise<void> {
  const db = await openChecklistDb();
  const checklists = await getChecklists();
  const checklist = checklists.find((c) => c.id === id);
  if (!checklist) return;
  checklist.syncedAt = new Date().toISOString();
  await saveChecklist(checklist);
  db.close();
}

export async function syncPendingChecklists(): Promise<{ synced: number; failed: number }> {
  const all = await getChecklists();
  const pending = all.filter((c) => c.completedAt && !c.syncedAt);
  let synced = 0;
  let failed = 0;
  for (const checklist of pending) {
    try {
      const res = await fetch('/api/checklists/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklists: [checklist] }),
        credentials: 'include',
      });
      if (res.ok) {
        await markSynced(checklist.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }
  return { synced, failed };
}
