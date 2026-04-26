// src/client/sw.ts
// Service Worker — injectManifest strategy (MOB-03)
// Built by VitePWA; self.__WB_MANIFEST is injected at build time.

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Precache app shell
precacheAndRoute(self.__WB_MANIFEST);

// Network-first for all API routes — always try live data, fall back to cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 5, // 5 minutes
      }),
    ],
  }),
);

// Cache-first for static assets (images, fonts, etc.)
registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  }),
);

// ── Inline queue replay for Background Sync ──────────────────────────────────
// We cannot import from ../lib/offlineQueue here because the SW runs in its own
// thread and the module would be bundled separately. Instead we open IDB directly.
async function replayOfflineQueue(): Promise<void> {
  // Feature-detect IDB (always available in SW contexts that support IndexedDB)
  if (typeof indexedDB === 'undefined') return;

  const openReq = indexedDB.open('offline-queue', 1);
  await new Promise<void>((resolve, reject) => {
    openReq.onerror = () => reject(openReq.error);
    openReq.onsuccess = async () => {
      const db = openReq.result;
      const tx = db.transaction('requests', 'readwrite');
      const store = tx.objectStore('requests');
      const allReq = store.getAll();

      await new Promise<void>((res2, rej2) => {
        allReq.onerror = () => rej2(allReq.error);
        allReq.onsuccess = async () => {
          const items = (allReq.result as Array<{
            id: number;
            url: string;
            method: string;
            body: string;
            headers: string;
            idempotencyKey: string;
            queuedAt: number;
          }>).sort((a, b) => a.queuedAt - b.queuedAt);

          for (const item of items) {
            const parsedHeaders: Record<string, string> = JSON.parse(item.headers);
            try {
              const res = await fetch(item.url, {
                method: item.method,
                headers: {
                  'Content-Type': 'application/json',
                  ...parsedHeaders,
                  'Idempotency-Key': item.idempotencyKey,
                },
                body: item.body,
                credentials: 'include',
              });
              if (res.ok || (res.status >= 400 && res.status < 500)) {
                // 2xx or non-retriable 4xx — remove
                const delReq = store.delete(item.id);
                await new Promise<void>((d, e) => {
                  delReq.onsuccess = () => d();
                  delReq.onerror = () => e(delReq.error);
                });
              }
              // 5xx — keep for retry
            } catch {
              // Network error — keep
            }
          }
          res2();
        };
      });
      resolve();
    };
  });
}

// Background Sync replay — fires when connectivity is restored
// Primary replay path is the 'online' event in OfflineBanner.tsx (works in Safari too)
// SyncEvent is not in the standard WebWorker lib — use ExtendableEvent + unknown cast
self.addEventListener('sync', (event) => {
  const syncEvent = event as ExtendableEvent & { tag: string };
  if (syncEvent.tag === 'offline-queue-replay') {
    syncEvent.waitUntil(replayOfflineQueue());
  }
});

// Activate immediately on install — don't wait for old SW to die
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
