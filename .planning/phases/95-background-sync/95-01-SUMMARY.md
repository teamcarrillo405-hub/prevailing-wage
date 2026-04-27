---
phase: 95-background-sync
plan: 01
subsystem: service-worker
tags: [offline, sw, background-sync, mob-18]
dependency_graph:
  requires: []
  provides: [sw-payroll-queue-replay-handler]
  affects: [sw.ts, 95-02, 95-03]
tech_stack:
  added: []
  patterns: [native IDB in SW (no imports), Background Sync API dual-tag handler]
key_files:
  modified:
    - src/client/sw.ts
decisions:
  - Native indexedDB API used (not idb library) — SW bundle is isolated from app modules
  - replayPayrollQueue placed directly above sync event handler (after replayOfflineQueue)
  - 409: mark status='synced-elsewhere' via store.put(); 2xx + other 4xx: store.delete(); 5xx/network: keep
  - objectStoreNames.contains('entries') guard prevents errors if app has never run
metrics:
  duration: "~8 minutes"
  completed: "2026-04-27"
  tasks: 1
  files: 1
---

# Phase 95 Plan 01: SW payroll-queue-replay Handler Summary

**One-liner:** Service worker gains a parallel `payroll-queue-replay` Background Sync handler that drains the payroll IDB queue using native indexedDB API, with per-entry 409/2xx/5xx/network handling.

## What Was Built

- `sw.ts`: `replayPayrollQueue()` function reads 'payroll-queue'/'entries' IDB store, filters pending entries by queuedAt ascending, POSTs each to `/api/payroll/entries`; 2xx deletes entry; 409 marks synced-elsewhere; other 4xx deletes; 5xx/network leaves for retry
- Sync event handler extended: `payroll-queue-replay` tag now branches alongside `offline-queue-replay`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/client/sw.ts` contains `replayPayrollQueue` function and `payroll-queue-replay` branch
- Commit 6ad6fe6 verified
- 0 TS errors
