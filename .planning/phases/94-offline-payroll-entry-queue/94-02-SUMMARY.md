---
phase: 94-offline-payroll-entry-queue
plan: 02
subsystem: payroll-wizard
tags: [offline, hook, mob-16, mob-17]
dependency_graph:
  requires: [payrollQueue-idb-layer]
  provides: [useOfflineEntryMutation]
  affects: [PayrollWizard, Step2HoursGrid, Step2MobileEntry]
tech_stack:
  added: []
  patterns: [offline-aware hook wrapper, dual-flush pattern, navigator.onLine detection]
key_files:
  created:
    - src/client/components/payrollWizard/useOfflineEntryMutation.ts
  modified:
    - src/client/components/payrollWizard/PayrollWizard.tsx
    - src/client/components/payrollWizard/Step2HoursGrid.tsx
    - src/client/components/payrollWizard/Step2MobileEntry.tsx
decisions:
  - EntryPayload from useEntryMutation.ts passed via structural identity cast (both define identical fields)
  - OfflineSaveStatus = 'idle' | 'pending' | 'saving' | 'queued' | 'conflict' extended both grid components
  - Step2MobileEntry saveStatus type also updated to accept full OfflineSaveStatus (found during TS check)
metrics:
  duration: "~10 minutes"
  completed: "2026-04-27"
  tasks: 2
  files: 4
---

# Phase 94 Plan 02: useOfflineEntryMutation Hook Summary

**One-liner:** Offline-aware wrapper hook that intercepts payroll saves when offline, routes to IDB queue, drains queue on reconnect, and surfaces conflict/queued badges in the hours grid.

## What Was Built

- `useOfflineEntryMutation.ts`: wraps `useEntryMutation`; online path unchanged; offline path calls `enqueuePayrollEntry`; `flush()` drains both generic + payroll-specific IDB queues; 409 → `markSyncedElsewhere` + sets `offlineStatus='conflict'`
- `PayrollWizard.tsx`: swapped `useEntryMutation` for `useOfflineEntryMutation`, passes `projectId`
- `Step2HoursGrid.tsx`: `saveStatus` type extended to `OfflineSaveStatus`; amber 'Queued for sync' badge + red 'Synced by another device' badge rendered
- `Step2MobileEntry.tsx`: same `saveStatus` type update (found during TS check)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Step2MobileEntry saveStatus type not in plan**
- **Found during:** Task 2 TS check
- **Issue:** `Step2MobileEntry.tsx` also accepts `saveStatus` prop and needed the same type update
- **Fix:** Updated `saveStatus?: 'idle' | 'pending' | 'saving' | 'queued' | 'conflict'` in Step2MobileEntry
- **Files modified:** src/client/components/payrollWizard/Step2MobileEntry.tsx

## Self-Check: PASSED

- `useOfflineEntryMutation.ts` exists
- `PayrollWizard.tsx` uses `useOfflineEntryMutation`
- Commit 752c11b verified
- 0 TS errors; 803 tests passing
