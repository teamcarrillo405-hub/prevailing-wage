// src/client/components/payrollWizard/useOfflineEntryMutation.ts
// Offline-aware wrapper around useEntryMutation.
// - When online: delegates to useEntryMutation (existing network path).
// - When offline: writes to IDB payrollQueue instead of the network.
// - flush() drains both the generic offline queue (via useEntryMutation.flush) AND
//   the payroll-specific IDB queue (by POSTing each entry to /api/payroll/entries).
import { useState, useEffect, useCallback } from 'react';
import { useEntryMutation } from './useEntryMutation';
import {
  enqueuePayrollEntry,
  getPayrollQueue,
  clearPayrollEntry,
  markSyncedElsewhere,
  type EntryPayload,
} from '../../lib/payrollQueue';
import { api } from '../../lib/api';

export type OfflineSaveStatus = 'idle' | 'pending' | 'saving' | 'queued' | 'conflict';

export function useOfflineEntryMutation(
  weekId: string | null,
  projectId: string,
  onLocked: () => void,
): {
  markDirty: (payload: EntryPayload) => void;
  flush: () => Promise<void>;
  saveStatus: OfflineSaveStatus;
} {
  const inner = useEntryMutation(weekId, onLocked);
  const [offlineStatus, setOfflineStatus] = useState<'idle' | 'queued' | 'conflict'>('idle');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  // Track connectivity changes
  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Drain the payroll-specific IDB queue for this week
  const drainPayrollQueue = useCallback(async () => {
    if (!weekId) return;
    const entries = await getPayrollQueue(weekId);
    const pending = entries.filter((e) => e.status === 'pending');

    for (const entry of pending) {
      try {
        await api.post('/payroll/entries', {
          payrollWeekId: entry.weekId,
          workerId: entry.workerId,
          classificationId: entry.classificationId,
          ...entry.payload.values,
          baseRateSnapshot: entry.payload.baseRateSnapshot,
          fringeRateSnapshot: entry.payload.fringeRateSnapshot,
          deductions: entry.payload.deductions,
          grossWages: null,
          netPay: null,
        });
        // 2xx — clear entry
        await clearPayrollEntry(entry.weekId, entry.workerId, entry.classificationId);
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        if (status === 409) {
          // Another device already submitted this entry
          await markSyncedElsewhere(entry.weekId, entry.workerId, entry.classificationId);
          setOfflineStatus('conflict');
        }
        // Network error or 5xx — leave in queue for retry
      }
    }
  }, [weekId]);

  const flush = useCallback(async () => {
    // Drain the generic offline queue (existing path)
    await inner.flush();
    // Also drain the payroll-specific IDB queue
    await drainPayrollQueue();
  }, [inner, drainPayrollQueue]);

  const markDirty = useCallback(
    (payload: EntryPayload) => {
      if (isOnline) {
        // Online path — delegate to existing mutation (network POST).
        // EntryPayload in payrollQueue.ts and useEntryMutation.ts are structurally identical.
        inner.markDirty(payload);
      } else if (weekId) {
        // Offline path — write to IDB payroll queue
        void enqueuePayrollEntry(weekId, projectId, payload);
        setOfflineStatus('queued');
      } else {
        // No weekId yet (week not created) — silently discard
        console.warn('[useOfflineEntryMutation] markDirty called without weekId while offline');
      }
    },
    [isOnline, weekId, projectId, inner],
  );

  // Derive combined saveStatus
  const saveStatus: OfflineSaveStatus = (() => {
    if (offlineStatus === 'conflict') return 'conflict';
    if (offlineStatus === 'queued') return 'queued';
    return inner.saveStatus;
  })();

  return { markDirty, flush, saveStatus };
}
