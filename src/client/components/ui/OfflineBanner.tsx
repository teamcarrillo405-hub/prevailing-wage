// src/client/components/ui/OfflineBanner.tsx
// Offline/online status banner + queue badge (MOB-05)
import { useState, useEffect } from 'react';
import { processQueue, getQueueLength } from '../../lib/offlineQueue';

// ── OfflineBadge ─────────────────────────────────────────────────────────────
export function OfflineBadge() {
  const [queueLen, setQueueLen] = useState(0);

  useEffect(() => {
    let active = true;

    async function refresh() {
      const len = await getQueueLength();
      if (active) setQueueLen(len);
    }

    // Poll every 10 seconds to keep the badge fresh
    refresh();
    const id = setInterval(refresh, 10_000);

    // Also refresh on online/offline transitions
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);

    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, []);

  if (queueLen === 0) return null;

  return (
    <span
      className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full bg-amber-500 text-white text-[11px] font-semibold leading-none"
      title={`${queueLen} change${queueLen === 1 ? '' : 's'} queued for sync`}
      aria-label={`${queueLen} pending offline changes`}
    >
      {queueLen}
    </span>
  );
}

// ── OfflineBanner ─────────────────────────────────────────────────────────────
type BannerState = 'hidden' | 'offline' | 'back-online';

export function OfflineBanner() {
  const [state, setState] = useState<BannerState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'hidden',
  );

  useEffect(() => {
    let backOnlineTimer: ReturnType<typeof setTimeout> | null = null;

    function handleOffline() {
      if (backOnlineTimer) {
        clearTimeout(backOnlineTimer);
        backOnlineTimer = null;
      }
      setState('offline');
    }

    async function handleOnline() {
      setState('back-online');

      // Replay queued requests — primary path (works in Safari, Chrome, Firefox)
      try {
        await processQueue();
      } catch (err) {
        console.warn('[OfflineBanner] processQueue error', err);
      }

      backOnlineTimer = setTimeout(() => {
        setState('hidden');
        backOnlineTimer = null;
      }, 3000);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (backOnlineTimer) clearTimeout(backOnlineTimer);
    };
  }, []);

  if (state === 'hidden') return null;

  if (state === 'offline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4 text-center"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-white opacity-80" aria-hidden="true" />
        You are offline — changes will sync when reconnected
      </div>
    );
  }

  // back-online green flash
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-medium py-2 px-4 text-center"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-white opacity-80" aria-hidden="true" />
      Back online — syncing...
    </div>
  );
}
