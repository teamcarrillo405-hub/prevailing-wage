---
phase: 94-offline-payroll-entry-queue
plan: 01
subsystem: client-lib
tags: [offline, idb, payroll, mob-16, mob-17]
dependency_graph:
  requires: []
  provides: [payrollQueue-idb-layer]
  affects: [94-02, 94-03, 95-01, 95-02, 95-03]
tech_stack:
  added: [fake-indexeddb (dev)]
  patterns: [idb openDB lazy-singleton, composite-key scan via getAll+filter]
key_files:
  created:
    - src/client/lib/payrollQueue.ts
    - src/client/lib/payrollQueue.test.ts
decisions:
  - RowValues imported from Step2GridRow.tsx for EntryPayload.values type (no circular dep)
  - _resetDb clears store contents (not delete DB) to avoid fake-indexeddb deleteDatabase hang
  - Composite key lookups via getAll+filter (not IDBKeyRange) for Safari compatibility
  - values field in payrollQueue EntryPayload typed as RowValues (structural match to useEntryMutation)
metrics:
  duration: "~12 minutes"
  completed: "2026-04-27"
  tasks: 2
  files: 2
---

# Phase 94 Plan 01: payrollQueue IDB Library Summary

**One-liner:** IndexedDB payroll entry queue with upsert-by-composite-key, conflict marking, and 9 vitest tests via fake-indexeddb.

## What Was Built

- `payrollQueue.ts`: IDB CRUD layer — `enqueuePayrollEntry`, `getPayrollQueue`, `clearPayrollEntry`, `markSyncedElsewhere`, `getPendingCount`, `_resetDb`
- `payrollQueue.test.ts`: 9 passing tests covering all exported functions
- `PAYROLL_QUEUE_DB = 'payroll-queue'` and `PAYROLL_STORE = 'entries'` constants for SW use in 95-01
- `fake-indexeddb` installed as dev dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EntryPayload.values typed as RowValues instead of Record<string, number | null>**
- **Found during:** Task 2 (TS errors)
- **Issue:** Plan specified `Record<string, number | null>` but `RowValues` includes `checkNumber: string | null` which is incompatible; importing `RowValues` from Step2GridRow eliminated the mismatch
- **Fix:** Imported `RowValues` type into payrollQueue.ts; confirmed no circular dependency
- **Files modified:** src/client/lib/payrollQueue.ts

**2. [Rule 1 - Bug] _resetDb blocking with indexedDB.deleteDatabase**
- **Found during:** Task 2 test run
- **Issue:** `indexedDB.deleteDatabase` with fake-indexeddb caused test timeouts; the async delete promise was never settling
- **Fix:** Changed _resetDb to `db.clear(PAYROLL_STORE)` then null the singleton (store clear, not DB delete)
- **Files modified:** src/client/lib/payrollQueue.ts, src/client/lib/payrollQueue.test.ts

## Self-Check: PASSED

- `src/client/lib/payrollQueue.ts` exists
- `src/client/lib/payrollQueue.test.ts` exists
- Commit 9c649c1 verified in git log
- 9/9 tests passing; 0 TS errors
