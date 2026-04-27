---
phase: 95-background-sync
plan: 03
subsystem: client-lib
tags: [offline, background-sync, mob-18]
dependency_graph:
  requires: [sw-payroll-queue-replay-handler, SyncStatusIndicator]
  provides: [registerSyncIfSupported, payroll-queue-replay-registration]
  affects: [offlineQueue, OfflineBanner]
tech_stack:
  added: []
  patterns: [SyncManager feature detection, fire-and-forget void registration]
key_files:
  modified:
    - src/client/lib/offlineQueue.ts
    - src/client/components/ui/OfflineBanner.tsx
decisions:
  - registerSyncIfSupported uses 'SyncManager' in window feature detect (Chrome/Edge only; Safari skips)
  - Called with void in handleOnline (fire-and-forget — non-critical for UX transition timing)
  - Exported from offlineQueue.ts for reuse by any future background sync registrations
  - Checkpoint auto-approved per autonomous execution rules
metrics:
  duration: "~5 minutes"
  completed: "2026-04-27"
  tasks: 1
  files: 2
---

# Phase 95 Plan 03: registerSyncIfSupported + Wiring Summary

**One-liner:** Missing link between OfflineBanner reconnect handler and SW payroll-queue-replay: registerSyncIfSupported exported from offlineQueue.ts with SyncManager feature detection.

## What Was Built

- `offlineQueue.ts`: `registerSyncIfSupported(tag)` exported — checks serviceWorker + SyncManager presence; catches all errors silently; `console.warn` on failure
- `OfflineBanner.tsx`: `handleOnline` calls `void registerSyncIfSupported('payroll-queue-replay')` after `processQueue()` completes

## Deviations from Plan

None — plan executed exactly as written.

## Checkpoint: auto-approved

The `checkpoint:human-verify` task was auto-approved per orchestrator instruction to approve checkpoints autonomously. Background Sync timing verification (SW fires within 30s in Chrome/Edge) and Safari fallback validation are deferred to manual QA in a production-like build.

## Self-Check: PASSED

- `registerSyncIfSupported` exported from offlineQueue.ts
- OfflineBanner imports and calls it in handleOnline
- Commit f3be2b2 verified
- 0 TS errors; 803 tests passing
