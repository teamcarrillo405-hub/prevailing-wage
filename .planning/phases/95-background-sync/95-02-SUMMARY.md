---
phase: 95-background-sync
plan: 02
subsystem: client-ui
tags: [offline, sync-indicator, mob-18]
dependency_graph:
  requires: [sw-payroll-queue-replay-handler, payrollQueue-idb-layer]
  provides: [SyncStatusIndicator, useSyncStatus]
  affects: [Layout, nav-header]
tech_stack:
  added: []
  patterns: [presentational pill component, hook-driven derived state, 4s auto-hide timer]
key_files:
  created:
    - src/client/hooks/useSyncStatus.ts
    - src/client/components/ui/SyncStatusIndicator.tsx
  modified:
    - src/client/components/shared/Layout.tsx
decisions:
  - useSyncStatus calls processQueue() on 'online' event (generic queue); payroll queue drained by SW
  - 4-second auto-hide timer for 'synced' state via useRef + setTimeout
  - SyncStatusIndicator is pure presentational (no hook call) for testability
  - Placed between OfflineBadge and log-out button in desktop nav only (mobile uses OfflineBanner)
  - animate-pulse wrapper on syncing dot (no lucide icon — keep lightweight for nav bar)
metrics:
  duration: "~8 minutes"
  completed: "2026-04-27"
  tasks: 2
  files: 3
---

# Phase 95 Plan 02: SyncStatusIndicator Summary

**One-liner:** Nav bar sync status pill with useSyncStatus hook deriving idle/syncing/synced/pending from queue lengths and online events, auto-hiding 4 seconds after 'Synced'.

## What Was Built

- `useSyncStatus.ts`: combines `getQueueLength + getPendingCount`; transitions through syncing/synced on reconnect; auto-hides after 4s; polls every 5s + visibilitychange
- `SyncStatusIndicator.tsx`: renders null when idle; amber pulsing dot for 'Syncing...'; static green dot for 'Synced'; static amber dot for 'N items pending'
- `Layout.tsx`: imports hook + component, renders `<SyncStatusIndicator status={syncStatus} />` in desktop nav

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `useSyncStatus.ts`, `SyncStatusIndicator.tsx` exist
- `Layout.tsx` renders SyncStatusIndicator in desktop nav
- Commit 4c2d9fe verified
- 0 TS errors; 803 tests passing
