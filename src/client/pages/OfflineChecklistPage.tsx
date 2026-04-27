// Phase 98 — Offline compliance checklist page (MOB-22)
// Offline-first: IndexedDB storage, syncs to server when online.
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  openChecklistDb,
  saveChecklist,
  getChecklists,
  syncPendingChecklists,
  type Checklist,
  type ChecklistItem,
} from '../lib/checklistDb';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../contexts/ToastContext';

// ── Default pre-inspection template ──────────────────────────────────────────
const DEFAULT_ITEMS: Omit<ChecklistItem, 'id'>[] = [
  { label: 'Wage determination posted at job site', checked: false },
  { label: 'WH-347 forms available for this week', checked: false },
  { label: 'Worker IDs verified (matches WH-347 roster)', checked: false },
  { label: 'Certified payroll up to date', checked: false },
  { label: 'Apprentice ratio within limits', checked: false },
  { label: 'Fringe benefits current (health + pension + training)', checked: false },
  { label: 'No cash-pay workers on site', checked: false },
  { label: 'Subcontractor CPRs received and compliant', checked: false },
];

function buildDefaultChecklist(projectId: string): Checklist {
  return {
    id: crypto.randomUUID(),
    projectId,
    title: 'Pre-Inspection Checklist',
    items: DEFAULT_ITEMS.map((item) => ({ ...item, id: crypto.randomUUID() })),
    createdAt: new Date().toISOString(),
    completedAt: null,
    syncedAt: null,
  };
}

// ── Inline IDB delete helper (not in checklistDb to avoid over-engineering) ──
async function deleteChecklist(id: string): Promise<void> {
  const db = await openChecklistDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('checklists', 'readwrite');
    const store = tx.objectStore('checklists');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

// ── Sync status type ──────────────────────────────────────────────────────────
type SyncStatus = 'offline' | 'syncing' | 'synced' | 'idle';

export function OfflineChecklistPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { toast } = useToast();

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // ── Load checklists from IDB ──────────────────────────────────────────────
  const loadChecklists = useCallback(async () => {
    const all = await getChecklists(projectId);
    if (projectId && all.length === 0) {
      // Auto-create default template for this project
      const defaultChecklist = buildDefaultChecklist(projectId);
      await saveChecklist(defaultChecklist);
      setChecklists([defaultChecklist]);
    } else {
      setChecklists(all);
    }
  }, [projectId]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  // ── Online/offline event listeners ───────────────────────────────────────
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      triggerSync();
    }
    function handleOffline() {
      setIsOnline(false);
      setSyncStatus('offline');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Attempt sync on initial mount if already online
    if (navigator.onLine) {
      triggerSync();
    } else {
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function triggerSync() {
    setSyncStatus('syncing');
    try {
      const { synced } = await syncPendingChecklists();
      setSyncStatus('synced');
      if (synced > 0) {
        toast.success(`${synced} checklist${synced === 1 ? '' : 's'} synced`);
        await loadChecklists();
      }
    } catch {
      setSyncStatus('idle');
    }
  }

  // ── Toggle checkbox ───────────────────────────────────────────────────────
  async function toggleItem(checklistId: string, itemId: string) {
    const updated = checklists.map((cl) => {
      if (cl.id !== checklistId) return cl;
      const newItems = cl.items.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item,
      );
      const allChecked = newItems.every((i) => i.checked);
      return {
        ...cl,
        items: newItems,
        completedAt: allChecked ? new Date().toISOString() : null,
        syncedAt: null, // mark as needing re-sync
      };
    });
    setChecklists(updated);
    const target = updated.find((cl) => cl.id === checklistId);
    if (target) {
      await saveChecklist(target);
      // If completed and online, sync immediately
      if (target.completedAt && navigator.onLine) {
        triggerSync();
      }
    }
  }

  // ── New checklist ─────────────────────────────────────────────────────────
  async function addChecklist() {
    const pid = projectId ?? 'unscoped';
    const newChecklist = buildDefaultChecklist(pid);
    await saveChecklist(newChecklist);
    setChecklists((prev) => [...prev, newChecklist]);
  }

  // ── Delete checklist ──────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await deleteChecklist(id);
    setChecklists((prev) => prev.filter((cl) => cl.id !== id));
  }

  // ── Sync status badge ─────────────────────────────────────────────────────
  function SyncBadge() {
    if (syncStatus === 'offline' || !isOnline) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          Offline
        </span>
      );
    }
    if (syncStatus === 'syncing') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          Syncing...
        </span>
      );
    }
    if (syncStatus === 'synced') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          Synced
        </span>
      );
    }
    return null;
  }

  if (!projectId) {
    return (
      <Layout>
        <PageHeader title="Compliance Checklists" />
        <Card>
          <p className="text-sm text-text-secondary">
            Select a project to view its checklists. Navigate to a project and open Checklists from
            there.
          </p>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Compliance Checklists"
        action={<Button onClick={addChecklist}>New Checklist</Button>}
      />

      {/* Always-visible offline info banner */}
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Checklists are saved on this device and sync automatically when you reconnect.
      </div>

      {/* Sync status */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-text-secondary">Status:</span>
        <SyncBadge />
      </div>

      {checklists.length === 0 && (
        <Card>
          <p className="text-sm text-text-secondary">No checklists yet. Click "New Checklist" to create one.</p>
        </Card>
      )}

      <div className="space-y-4">
        {checklists.map((cl) => (
          <Card key={cl.id}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-headline text-base text-text-primary">{cl.title}</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Created {new Date(cl.createdAt).toLocaleDateString()}
                  {cl.completedAt && (
                    <span className="ml-2 text-green-600">
                      Completed {new Date(cl.completedAt).toLocaleDateString()}
                    </span>
                  )}
                  {cl.syncedAt && (
                    <span className="ml-2 text-blue-600">Synced</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(cl.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>

            <ul className="space-y-2">
              {cl.items.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id={`${cl.id}-${item.id}`}
                    checked={item.checked}
                    onChange={() => toggleItem(cl.id, item.id)}
                    className="mt-0.5 h-4 w-4 rounded border-border-default accent-brand-gold cursor-pointer"
                  />
                  <label
                    htmlFor={`${cl.id}-${item.id}`}
                    className={`text-sm cursor-pointer ${
                      item.checked ? 'text-text-secondary line-through' : 'text-text-primary'
                    }`}
                  >
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>

            {cl.items.every((i) => i.checked) && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
                All items complete.{' '}
                {cl.syncedAt ? 'Synced to server.' : isOnline ? 'Syncing...' : 'Will sync when online.'}
              </div>
            )}
          </Card>
        ))}
      </div>
    </Layout>
  );
}
