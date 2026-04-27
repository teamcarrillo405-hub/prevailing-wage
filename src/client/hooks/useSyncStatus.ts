// src/client/hooks/useSyncStatus.ts
// Hook that derives sync display state from queue lengths and online/offline transitions.
// Used by SyncStatusIndicator to show 'Syncing…', 'Synced', or 'X items pending' in the nav.
import { useState, useEffect, useRef, useCallback } from 'react';
import { processQueue, getQueueLength } from '../lib/offlineQueue';
import { getPendingCount } from '../lib/payrollQueue';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'pending';

export interface SyncStatus {
  state: SyncState;
  pendingCount: number; // > 0 when state='pending'
}

export function useSyncStatus(): SyncStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const synceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const [genericLen, payrollLen] = await Promise.all([getQueueLength(), getPendingCount()]);
    setPendingCount(genericLen + payrollLen);
  }, []);

  // Online/offline listeners + sync trigger on reconnect
  useEffect(() => {
    async function handleOnline() {
      setIsOnline(true);
      setSyncState('syncing');

      try {
        await processQueue();
      } catch {
        // Non-fatal — errors already logged by processQueue
      }

      setSyncState('synced');
      await refreshPendingCount();

      // Auto-hide 'synced' label after 4 seconds
      if (synceTimerRef.current) clearTimeout(synceTimerRef.current);
      synceTimerRef.current = setTimeout(() => {
        setSyncState('idle');
      }, 4000);
    }

    function handleOffline() {
      setIsOnline(false);
      setSyncState('idle');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshPendingCount]);

  // Poll pending count every 5 seconds + on visibility change
  useEffect(() => {
    refreshPendingCount();

    const intervalId = setInterval(() => {
      void refreshPendingCount();
    }, 5000);

    function handleVisibilityChange() {
      if (!document.hidden) void refreshPendingCount();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (synceTimerRef.current) clearTimeout(synceTimerRef.current);
    };
  }, [refreshPendingCount]);

  // Derived state
  const state: SyncState = (() => {
    if (!isOnline && pendingCount > 0) return 'pending';
    if (syncState === 'syncing') return 'syncing';
    if (syncState === 'synced') return 'synced';
    return 'idle';
  })();

  return { state, pendingCount };
}
