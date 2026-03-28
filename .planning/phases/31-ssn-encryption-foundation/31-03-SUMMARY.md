---
phase: 31-ssn-encryption-foundation
plan: 03
subsystem: api+export
tags: [aes-256-gcm, encryption, decrypt, export, ca-ecpr, wa-pwia, payrollService, tdd]

# Dependency graph
requires:
  - 31-01 (cryptoService.ts, ssn_encrypted column)
  - 31-02 (workers route — encrypt on write, hasFullSsn)
provides:
  - resolveEcprSsn() pure testable helper in export.ts
  - CA eCPR XML uses real 9-digit SSN from decrypted storage (fallback to placeholder)
  - WA PWIA XML uses real 9-digit SSN from decrypted storage (fallback to placeholder)
  - getPayrollEntriesWithWorkerDetails returns workerSsnEncrypted for export use
affects:
  - Future phases that consume payroll entry worker details (already have workerSsnEncrypted)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - decryptSsn called ONLY in export.ts — D-15 compliance enforced and tested
    - resolveEcprSsn() extracted as pure testable function — test against extracted logic, not route handler
    - TDD RED/GREEN cycle: test file set process.env before dynamic import of module under test

key-files:
  created:
    - tests/services/ecprXmlGenerator.test.ts
  modified:
    - src/server/services/payrollService.ts
    - src/server/routes/export.ts

key-decisions:
  - "resolveEcprSsn() exported as pure function — keeps CA eCPR logic testable without route mocking"
  - "WA PWIA uses inline decrypt pattern (not extracted to helper) — one-liner equivalence, consistent with RESEARCH Pattern 5"
  - "decryptSsn imported ONLY in export.ts — D-15 compliance confirmed via grep verification"

requirements-completed: [SEC-02]

# Metrics
duration: 12min
completed: 2026-03-28
---

# Phase 31 Plan 03: CA eCPR + WA PWIA SSN Decrypt Integration Summary

**CA eCPR and WA PWIA XML generators decrypt real 9-digit SSNs from encrypted storage (fallback to 000000+last4 placeholder for null/partial). payrollService extended to join workerSsnEncrypted. 4 unit tests validate resolveEcprSsn() behavior.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-28T09:00:00Z
- **Completed:** 2026-03-28T09:12:00Z
- **Tasks:** 2/2 complete (Task 1 auto + Task 2 checkpoint:human-verify approved)
- **Files modified:** 3

## Accomplishments

- `resolveEcprSsn(ssnEncrypted, ssnLast4)` exported from export.ts — pure function, testable without route mocking; returns 9-digit SSN if available, falls back to `'000000' + last4`
- CA eCPR XML generator (`export.ts` ~line 600): `ssn10` now calls `resolveEcprSsn(row.workerSsnEncrypted, row.workerSsnLast4)` — real SSN when available, placeholder otherwise
- WA PWIA XML generator (`export.ts` ~line 800): `ssn9` now uses inline decrypt-with-fallback pattern per RESEARCH Pattern 5 — real SSN when available, `'00000' + last4` placeholder otherwise
- `getPayrollEntriesWithWorkerDetails()` in payrollService.ts extended: `workerSsnEncrypted: workers.ssnEncrypted` added to `.select()` object alongside `workerSsnLast4`
- `decryptSsn` imported in export.ts (only file with decrypt per D-15)
- 4 eCPR unit tests: full 9-digit decrypts correctly; null falls back; 4-digit partial falls back; both null = `'0000000000'`
- waCprXmlGenerator.test.ts: all 9 existing tests continue to pass

## Task Commits

1. **Task 1: eCPR test stubs + payrollService extension + export.ts decrypt integration** — `84f01e4` (feat, TDD green)
2. **Task 2: checkpoint:human-verify** — approved by user (end-to-end pipeline verified)

## Files Created/Modified

- `tests/services/ecprXmlGenerator.test.ts` — 4 unit tests for resolveEcprSsn() (TDD RED→GREEN)
- `src/server/services/payrollService.ts` — workerSsnEncrypted added to getPayrollEntriesWithWorkerDetails select
- `src/server/routes/export.ts` — decryptSsn import + resolveEcprSsn() export + CA eCPR SSN update + WA PWIA SSN update

## Decisions Made

- **resolveEcprSsn extracted to exported helper:** The plan offered two options — test the extracted function or add cases to export.test.ts. Extracted helper is cleaner (avoids route test infrastructure overhead) and directly testable with dynamic import + env setup.
- **WA PWIA inline (not extracted):** The WA PWIA decrypt block follows the same pattern as CA eCPR but is kept inline per RESEARCH Pattern 5 exactly. Not extracting a second helper keeps the code consistent with the research spec and avoids over-abstracting.

## Deviations from Plan

### Pre-existing out-of-scope issue (not a deviation)

**tests/routes/export.test.ts failure (pre-existing from Plan 31-01)**
- The main project `tests/routes/export.test.ts` fails with `process.exit unexpectedly called with "1"` because `ENCRYPTION_KEY_V1` is not set before the app imports workers.ts (which imports cryptoService.ts with module-level startup assertion).
- This failure existed before Plan 31-03 changes — confirmed by `git stash` + re-run.
- Root cause: Plan 31-01 added the module-level startup assertion to cryptoService.ts, but export.test.ts does not set `ENCRYPTION_KEY_V1` in its beforeAll.
- Scope: Out of scope for this plan. Documented in deferred-items.md.
- Fix: Add `process.env.ENCRYPTION_KEY_V1 = createHash('sha256').update('test').digest('hex');` before the app import in export.test.ts.

## Deferred Items

- `tests/routes/export.test.ts` needs ENCRYPTION_KEY_V1 set before app import — pre-existing issue from Plan 31-01 startup assertion. Fix is a 2-line change; deferred as out of scope for this plan.

## Known Stubs

None — CA eCPR and WA PWIA XML generators now use real decrypted SSNs. Workers with only 4-digit partial SSN (backfilled by Plan 31-01 script) correctly fall back to the placeholder format. The full end-to-end flow is complete.

## Self-Check

- File `tests/services/ecprXmlGenerator.test.ts` — exists (created)
- File `src/server/services/payrollService.ts` — modified (workerSsnEncrypted present)
- File `src/server/routes/export.ts` — modified (decryptSsn import + resolveEcprSsn + decrypt blocks)
- Commit `84f01e4` — Task 1

## Self-Check: PASSED

- `tests/services/ecprXmlGenerator.test.ts` present and all 4 tests pass
- `grep workerSsnEncrypted src/server/services/payrollService.ts` — found at line 266
- `grep decryptSsn src/server/routes/export.ts` — found at lines 56, 78, 801
- `grep decryptSsn src/server/routes/workers.ts` — NOT found (D-15 compliant)
- Commit `84f01e4` present in git log

## Checkpoint Result

Task 2 (`checkpoint:human-verify`) — **approved by user**. Complete SSN encryption pipeline verified end-to-end: server startup assertion, worker SSN entry/masking, masked display, DevTools confirmation of no ssnEncrypted in API response, CA eCPR XML contains real 9-digit SSN.
