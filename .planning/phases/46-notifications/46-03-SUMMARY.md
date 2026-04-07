---
phase: 46-notifications
plan: 03
subsystem: due-soon-service
tags: [notifications, cron, tdd, nfr-02, notif-02, dedup]
dependency_graph:
  requires:
    - src/server/services/emailService.ts
    - src/server/services/payrollService.ts
    - src/server/db/schema.ts
    - src/server/db/index.ts
  provides:
    - src/server/services/dueSoonService.ts
  affects:
    - src/server/index.ts
tech_stack:
  added: []
  patterns:
    - tdd-red-green-vitest
    - cron-inside-listen-callback
    - dedup-via-projectSettings-json
    - per-project-try-catch-non-fatal
    - read-modify-write-projectSettings
key_files:
  created:
    - src/server/services/dueSoonService.ts
    - tests/services/dueSoonService.test.ts
  modified:
    - src/server/index.ts
decisions:
  - "dateDiffDays bounds check uses daysUntilDue >= 0 (not >= -1) — week past due is never sent a reminder; only [0, dueSoonDays] window triggers send"
  - "vi.mock() factories cannot reference outer variables (Vitest hoisting); all mocks use vi.fn() in factory and vi.mocked() in tests"
  - "listPayrollWeeks returns all weeks DESC; find(w => !w.submittedAt) picks the most-recent unsubmitted one without an extra DB query"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-07"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  tests_added: 12
---

# Phase 46 Plan 03: Due-Soon Service Summary

**One-liner:** Daily payroll due-soon background scan with projectSettings JSON dedup, per-project non-fatal error handling, and 12 unit tests covering threshold logic, owner-only targeting, and dedup edge cases.

## What Was Built

### `src/server/services/dueSoonService.ts`

Standalone NOTIF-02 scan module. Exports:

- **`dateDiffDays(today, targetDate): number`** — UTC-safe day arithmetic; positive = future, negative = past, 0 = due today. Both params are YYYY-MM-DD strings.
- **`runDueSoonScan(): Promise<void>`** — Fetches all active projects, applies three sequential skip guards per project, then sends a due-soon reminder if the latest unsubmitted payroll week falls within the `dueSoonDays` threshold:

  | Guard | Condition | Action |
  |---|---|---|
  | Notification pref | `notifyDueSoon === false` | skip project |
  | Dedup | `lastDueSoonNotifiedAt === today` | skip project |
  | No unsubmitted week | No week with `submittedAt = null` | skip project |
  | Threshold | `daysUntilDue < 0 or > dueSoonDays` | skip project |
  | No owner | No member with `role = 'owner'` | skip project |
  | Send | All guards passed | `sendDueSoonEmail(...)` + update dedup stamp |

  The dedup stamp update is a read-modify-write (spreads existing `projectSettings` JSON before adding `lastDueSoonNotifiedAt`) to preserve all sibling keys (NY form data, etc.).

  Per NFR-02: each project iteration is wrapped in `try/catch`; one failure logs and continues — the full scan is never aborted.

### `tests/services/dueSoonService.test.ts`

12 unit tests in 2 `describe` blocks:

| Test | Behavior |
|---|---|
| `dateDiffDays` positive | 2 days future → 2 |
| `dateDiffDays` negative | 2 days past → -2 |
| `dateDiffDays` zero | same date → 0 |
| `runDueSoonScan` notifyDueSoon=false | no email, no payroll query |
| `runDueSoonScan` no unsubmitted weeks | no email |
| `runDueSoonScan` outside threshold (10d, limit 3d) | no email |
| `runDueSoonScan` within threshold (2d, limit 3d) | sendDueSoonEmail called with correct args |
| dedup: today's stamp | no email, no payroll query |
| dedup: yesterday's stamp | email sent |
| read-modify-write | update called; sibling keys preserved; lastDueSoonNotifiedAt = today |
| no owner row | no email |
| one project throws | second project still processed; email sent for second |

### `src/server/index.ts` (modified)

Added import `runDueSoonScan` and a second cron job inside the `app.listen()` callback:

```typescript
cron.schedule('0 7 * * *', async () => { ... }, { timezone: 'America/New_York' });
```

The `app.listen()` callback now contains two cron registrations:
1. `'0 2 1 * *'` — monthly wage sync (pre-existing)
2. `'0 7 * * *'` — daily due-soon scan (new, NOTIF-02)

## Decisions Made

1. **`daysUntilDue >= 0` lower bound** — Weeks already past their `weekEndingDate` should not trigger reminders (they're late, not due soon). The threshold window is `[0, dueSoonDays]` inclusive.

2. **`vi.mock()` factories use `vi.fn()` inline** — Vitest hoists `vi.mock()` calls to the top of the file before variable declarations, making it a `ReferenceError` to reference outer `const` variables inside factory functions. All mock factories use inline `vi.fn()`, and tests use `vi.mocked(importedFn)` to configure per-test behavior.

3. **`listPayrollWeeks` reused from payrollService** — The plan allowed using either the existing service function or a direct DB query. Reusing `listPayrollWeeks` is DRY and avoids duplicating the `orderBy(desc(weekEndingDate))` sort. The unsubmitted filter is applied client-side with `.find()` after the call.

## Deviations from Plan

### Auto-fixed Issues

**[Rule 1 - Bug] vi.mock factory variable hoisting error (x2)**
- **Found during:** Task 1, TDD GREEN phase
- **Issue:** `const mockSendDueSoonEmail = vi.fn()` / `const mockListPayrollWeeks = vi.fn()` referenced inside `vi.mock()` factory functions, which are hoisted before variable initialization, causing `ReferenceError: Cannot access 'mockSendDueSoonEmail' before initialization`
- **Fix:** Removed outer variable declarations from both mock factories; changed to inline `vi.fn()` in each factory. Tests now reference mocked functions via `vi.mocked(importedFn)` pattern.
- **Files modified:** `tests/services/dueSoonService.test.ts`
- **Commit:** deebc6e (same commit as implementation)

**[Rule 1 - Bug] Implicit `any` type errors in arrow function parameters**
- **Found during:** Task 1, TypeScript compile verification
- **Issue:** `dueSoonService.ts` had two implicit `any` parameters: `.find(w => !w.submittedAt)` and `.find(r => r.role === 'owner')`
- **Fix:** Added inline type annotations to both arrow function parameters
- **Files modified:** `src/server/services/dueSoonService.ts`
- **Commit:** deebc6e (same commit)

## Verification Results

### TypeScript
```
src/server/routes/audit.ts(56,28): error TS7006: Parameter 'row' implicitly has an 'any' type.
src/server/routes/projects.ts(121,49): error TS7006: Parameter 'r' implicitly has an 'any' type.
```
Same two pre-existing errors from Plan 01 (unrelated files). `dueSoonService.ts` and `index.ts` compile cleanly.

### Tests
```
Test Files  41 passed | 7 skipped (48)
Tests       560 passed | 42 todo (602)
Duration    5.92s
```

All 12 new `dueSoonService.test.ts` tests pass. Full suite shows no regressions.

### Cron Registration Confirmed
```
26: import { runDueSoonScan } from './services/dueSoonService.js';
84:   // Register daily payroll due-soon scan — NOTIF-02
87:     console.log('[due-soon] Running daily payroll due-soon scan');
89:       await runDueSoonScan();
91:       console.error('[due-soon] Scan failed:', err);
```

### Dedup Logic Confirmed
```
32:  * Dedup: stores `lastDueSoonNotifiedAt` (ISO date) in `projectSettings` JSON
58:       if (rawParsed.lastDueSoonNotifiedAt === today) continue;
95:       const updatedSettings = { ...rawParsed, lastDueSoonNotifiedAt: today };
```

## Known Stubs

None — all functionality is fully implemented and tested.

## Self-Check: PASSED

- FOUND: `src/server/services/dueSoonService.ts`
- FOUND: `tests/services/dueSoonService.test.ts`
- FOUND: `src/server/index.ts` (modified — cron registration present)
- FOUND: commit deebc6e (Task 1)
- FOUND: commit 9a9eaf7 (Task 2)
