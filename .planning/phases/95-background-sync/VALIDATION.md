# Phase 95 Validation: Background Sync

## Requirements Covered
- MOB-18: Service Worker Background Sync API for clock-in queue + offline payroll flush, sync status indicator in header

## Automated Checks

```bash
cd /c/Users/glcar/prevailing-wage

# 1. Full TypeScript check — zero errors
npx tsc --noEmit 2>&1 | head -40

# 2. Confirm payroll-queue-replay handler in SW
grep -n "payroll-queue-replay\|replayPayrollQueue" src/client/sw.ts

# 3. Confirm SyncStatusIndicator is in Layout
grep -n "SyncStatusIndicator\|useSyncStatus" src/client/components/shared/Layout.tsx

# 4. Confirm registerSyncIfSupported is exported
grep -n "registerSyncIfSupported" src/client/lib/offlineQueue.ts

# 5. Confirm OfflineBanner calls registerSyncIfSupported
grep -n "registerSyncIfSupported" src/client/components/ui/OfflineBanner.tsx

# 6. Confirm SyncStatusIndicator returns null on idle
grep -n "state === 'idle'" src/client/components/ui/SyncStatusIndicator.tsx
```

## Manual Browser Verification (Required — Background Sync is browser-only)

All tests require a production build (`npm run build && npx serve dist/client -p 4300`) in Chrome or Edge.

| Check | How | Expected |
|-------|-----|----------|
| Indicator idle state | Load app, no queued items | No sync pill visible in nav |
| Syncing state | Go offline, enter payroll, come back online | Nav shows "Syncing..." amber pill |
| Synced state | After flush completes | Pill changes to "Synced" green, disappears after 4s |
| Pending state | Go offline with queued items | Nav shows "N items pending" amber pill |
| BG Sync 30s timing | In Chrome: offline, enter hours, restore network, watch DevTools SW tab | Sync event fires within 30s |
| Safari fallback | Repeat in Safari | No BG Sync, but window 'online' drains queue directly |

## Acceptance Criteria (from ROADMAP)

- Background sync fires within 30s of connectivity restoration (Chrome/Edge)
- Sync status indicator shows "Syncing...", "Synced", "X items pending" as appropriate
- Safari and Firefox use the direct-flush fallback path without errors

## Plans in This Phase

| Plan | Wave | Description | Status |
|------|------|-------------|--------|
| 95-01 | 1 | SW payroll-queue-replay handler | [ ] |
| 95-02 | 2 | useSyncStatus hook + SyncStatusIndicator + Layout wiring | [ ] |
| 95-03 | 3 | registerSyncIfSupported + OfflineBanner wiring + human checkpoint | [ ] |
