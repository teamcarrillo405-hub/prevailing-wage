// src/client/components/payrollWizard/useEntryMutation.ts
// Dirty-set-backed debounced saver for payroll entry rows.
// - markDirty(...) enqueues a row and restarts a 2s trailing-edge timer.
// - flush() drains the dirty set, fires one POST /payroll/entries per row in parallel,
//   and re-queues any row whose save failed for non-409 reasons.
// - 409 (week isFinal=true) triggers onLocked() — caller should set wizard state.locked.
import { useRef, useCallback, useEffect } from 'react';
import { api } from '../../lib/api';
import { DirtySet } from './dirtySet';
import type { RowValues } from './Step2GridRow';

export interface EntryPayload {
  workerId: string;
  classificationId: string;
  values: RowValues;
  baseRateSnapshot: number;
  fringeRateSnapshot: number;
  deductions: number;
}

export function useEntryMutation(weekId: string | null, onLocked: () => void) {
  const dirty = useRef(new DirtySet());
  const rowData = useRef(new Map<string, EntryPayload>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (!weekId) return;
    const dirtyRows = dirty.current.drain();
    if (dirtyRows.length === 0) return;
    await Promise.all(
      dirtyRows.map(async ({ workerId, classificationId }) => {
        const key = `${workerId}::${classificationId}`;
        const payload = rowData.current.get(key);
        if (!payload) return;
        try {
          // Spread all values (ST/OT/DT + fringe disaggregation + state-specific fields).
          // Server's UpsertEntrySchema accepts nullable state-specific fields; unused
          // fields pass through as null / 0 and the server defaults them.
          await api.post('/payroll/entries', {
            payrollWeekId: weekId,
            workerId,
            classificationId,
            ...payload.values,
            baseRateSnapshot: payload.baseRateSnapshot,
            fringeRateSnapshot: payload.fringeRateSnapshot,
            deductions: payload.deductions,
          });
        } catch (err) {
          const status = (err as Error & { status?: number }).status;
          if (status === 409) {
            onLocked();
          } else {
            // Re-queue for the next flush tick so transient failures retry.
            dirty.current.add(workerId, classificationId);
          }
        }
      })
    );
  }, [weekId, onLocked]);

  const markDirty = useCallback(
    (payload: EntryPayload) => {
      const key = `${payload.workerId}::${payload.classificationId}`;
      rowData.current.set(key, payload);
      dirty.current.add(payload.workerId, payload.classificationId);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, 2000);
    },
    [flush]
  );

  // Flush on tab close so drafts aren't lost.
  useEffect(() => {
    function beforeUnload() {
      void flush();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [flush]);

  return { markDirty, flush };
}
