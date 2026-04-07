---
phase: 46-notifications
plan: 02
subsystem: email-hooks
tags: [email, notifications, nfr-02, notif-01, notif-03, notif-04]
dependency_graph:
  requires:
    - src/server/services/emailService.ts
    - src/server/services/complianceService.ts
    - src/server/services/payrollService.ts
    - src/server/services/workerService.ts
    - src/server/routes/payroll.ts
  provides:
    - NOTIF-01 hook in upsertPayrollEntry (compliance violation email on write)
    - NOTIF-03 hooks in upsertPayrollEntry, createWorker, updateWorker
    - NOTIF-04 hooks in ca-submit, wa-submit, ny-submit, il-submit
  affects:
    - src/server/services/payrollService.ts
    - src/server/services/workerService.ts
    - src/server/routes/payroll.ts
tech_stack:
  added: []
  patterns:
    - best-effort-try-catch (NFR-02 — email failures never cause 4xx/5xx)
    - write-path-only hook (NOTIF-01 fires from upsertPayrollEntry, not from computeCompliance reads)
    - notifWeek-reuse (NOTIF-03 reuses week object fetched by NOTIF-01 to avoid second DB query)
key_files:
  created: []
  modified:
    - src/server/services/payrollService.ts
    - src/server/services/workerService.ts
    - src/server/routes/payroll.ts
decisions:
  - "NOTIF-03 in payrollService guards on input.userId && input.userEmail — both already present in UpsertPayrollEntryInput as optional fields populated from req.user on POST/PUT routes"
  - "notifWeek variable declared before NOTIF-01 try/catch and reused in NOTIF-03 block to avoid a redundant getPayrollWeek call when both hooks fire in sequence"
  - "computeCompliance receives (db as any) because its _db parameter is typed as BetterSQLite3Database<typeof schema> while payrollService uses BetterSQLite3Database<Record<string, never>> — both resolve to the same runtime db instance from getDb()"
  - "ny-submit and il-submit fire NOTIF-04 unconditionally because they have no submitted boolean — these routes only have a set path, never a clear path"
  - "ca-submit and wa-submit guard NOTIF-04 with if (submitted) — mirroring the existing audit log guard in those same routes"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-07"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
  tests_added: 0
---

# Phase 46 Plan 02: Email Hook Wiring Summary

**One-liner:** NOTIF-01 (violation), NOTIF-03 (activity), and NOTIF-04 (submission confirmation) email hooks wired into payrollService, workerService, and payroll routes — all best-effort, non-fatal per NFR-02.

## What Was Built

### Task 1: NOTIF-01 + NOTIF-03 in payrollService.ts and workerService.ts

**payrollService.ts additions** (after existing audit log block in `upsertPayrollEntry`):

- **NOTIF-01:** Calls `getPayrollWeek`, looks up project name, calls `computeCompliance(db as any, weekId)`, and fires `sendViolationEmail` when `complianceResult.hasViolations === true`. Fires ONLY from this write path — `computeCompliance` is never patched internally, so GET reads never trigger the email.
- **NOTIF-03:** Reuses the `notifWeek` variable from NOTIF-01 (or re-fetches if NOTIF-01 threw), then calls `sendActivityEmail` when `input.userId` and `input.userEmail` are both present. `sendActivityEmail` internally skips when `actingUserId === ownerUserId`.

New imports added:
```typescript
import { sendViolationEmail, sendActivityEmail } from './emailService.js';
import { computeCompliance } from './complianceService.js';
```

**workerService.ts additions** (after existing audit log blocks in `createWorker` and `updateWorker`):

- **NOTIF-03 in createWorker:** Queries project name then calls `sendActivityEmail` with `Worker created: {name}`.
- **NOTIF-03 in updateWorker:** Queries project name then calls `sendActivityEmail` with `Worker updated: {name}`.

Both use `input.userEmail` directly — available from `AuditContext` which both `CreateWorkerInput` and `UpdateWorkerInput` extend.

New imports added:
```typescript
import { workers, projects } from '../db/schema.js';
import { sendActivityEmail } from './emailService.js';
```

### Task 2: NOTIF-04 in payroll.ts agency submit routes

Four routes updated. Pattern per route:

| Route | Guard | Agency Label |
|---|---|---|
| ca-submit | `if (submitted)` | `'CA DIR eCPR'` |
| wa-submit | `if (submitted)` | `'WA L&I'` |
| ny-submit | unconditional | `'NY MPWR'` |
| il-submit | unconditional | `'IL IDOL'` |

New imports added:
```typescript
import { sendSubmissionConfirmationEmail } from '../services/emailService.js';
import { payrollEntries, workers, projects } from '../db/schema.js';
```

## Decisions Made

1. **`notifWeek` declared before NOTIF-01 try/catch** — Allows NOTIF-03 to reuse the same week object without a second `getPayrollWeek` call. If NOTIF-01 threw before setting `notifWeek`, NOTIF-03 re-fetches it via `notifWeek ?? await getPayrollWeek(...)`.

2. **`computeCompliance(db as any, weekId)`** — The compliance service's `_db` param is typed as `BetterSQLite3Database<typeof schema>` but the function body calls `getDb()` internally and ignores the parameter. The type cast avoids a TS structural incompatibility between `BetterSQLite3Database<typeof schema>` and `BetterSQLite3Database<Record<string, never>>`.

3. **ny-submit and il-submit fire unconditionally** — These routes have no `AgencySubmitSchema` body validation and no `submitted` boolean — they are one-way "mark as submitted" routes. Firing the email unconditionally is correct behavior.

## Deviations from Plan

None — plan executed exactly as written. The `db as any` cast for `computeCompliance` was anticipated by the plan's note: "Note: `computeCompliance` takes `(db, weekId)` where `db` is the result of `getDb()` — already available in the function."

## Verification Results

### TypeScript
```
src/server/routes/audit.ts(56,28): error TS7006: Parameter 'row' implicitly has an 'any' type.
src/server/routes/projects.ts(121,49): error TS7006: Parameter 'r' implicitly has an 'any' type.
```
Same two pre-existing errors as Plan 01. Zero new errors introduced.

### Tests
```
Test Files  40 passed | 7 skipped (47)
Tests       548 passed | 42 todo (590)
Duration    5.18s
```
All 548 existing tests pass. The test output confirms email hooks are firing and gracefully skipping when `RESEND_API_KEY` is unset (NFR-02 no-op path working correctly).

### Grep Verification
```
payrollService.ts: sendViolationEmail, computeCompliance, sendActivityEmail — all present
workerService.ts: sendActivityEmail at lines 5, 137, 141, 220, 224
payroll.ts: sendSubmissionConfirmationEmail at lines 10, 487, 549, 606, 662
```

## Known Stubs

None — all hooks are fully wired to the emailService functions built in Plan 01.

## Self-Check: PASSED

- FOUND: `src/server/services/payrollService.ts` — contains sendViolationEmail, sendActivityEmail, computeCompliance
- FOUND: `src/server/services/workerService.ts` — contains sendActivityEmail in createWorker and updateWorker
- FOUND: `src/server/routes/payroll.ts` — contains sendSubmissionConfirmationEmail in 4 routes
- FOUND: commit 3d27da4 (Task 1)
- FOUND: commit ad1b722 (Task 2)
