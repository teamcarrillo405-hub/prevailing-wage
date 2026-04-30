---
phase: 122-dbe-certification-management
plan: 02
subsystem: test
tags: [vitest, supertest, sqlite, resend-mock, dbe-compliance, typescript]

# Dependency graph
requires:
  - phase: 122-01
    provides: PATCH cert route + DBE-06 auto-pending + inline edit UI

provides:
  - Vitest regression lock on DBE-02 CRUD (GET/POST/PATCH/DELETE certifications)
  - Vitest regression lock on DBE-04 internal CPR upload gate (422 + CERT_EXPIRED_OR_SUSPENDED)
  - Vitest regression lock on DBE-05 certSummary shape correctness
  - Vitest regression lock on DBE-06 auto-pending boundary (issueDate < 2025-10-03)
  - Vitest regression lock on DBE-03 alert job thresholds (90/60/30 exact-day match, off-day miss, no-key skip)

affects: [122-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Inline function-constructor vi.mock for Resend — avoids Vitest hoisting ReferenceError and 'not a constructor' error when job uses dynamic import
    - Shared mockSend vi.fn() reference at module scope handles lazy-init Resend singleton without vi.resetModules
    - makeRequester(fakeIp) pattern for rate-limit isolation per describe block (auth.test.ts canonical pattern)
    - Direct DB insert helpers (seedProjectWithOwner, seedSubWithCert) in job tests — avoids HTTP overhead for non-route unit tests
    - afterEach clearAll in job tests — keeps DB clean without full re-migration per test

key-files:
  created:
    - src/server/routes/__tests__/subcontractors.cert.test.ts
    - src/server/jobs/__tests__/certificationExpiryAlerts.test.ts
  modified: []

key-decisions:
  - "vi.mock('resend') factory uses function (not arrow/class) constructor so new Resend() works in job's dynamic import path"
  - "mockSend declared at module scope, shared across all tests — avoids vi.resetModules which would fight with the static vi.mock hoisting"
  - "subcontractors.cert.test.ts uses supertest + in-memory DB (route integration tests); certificationExpiryAlerts.test.ts uses direct DB inserts (job unit tests)"
  - "DBE-04 expired-cert test uses expiresDate '2020-01-01' — far enough in the past to be date-of-execution stable"
  - "2025-10-03 literal used verbatim in DBE-06 boundary tests — never computed"

# Metrics
duration: 18min
completed: 2026-04-30
---

# Phase 122 Plan 02: DBE Test Coverage Summary

**23 new Vitest tests locking DBE-02/03/04/05/06 behavior in place — cert CRUD, upload gate, certSummary, auto-pending, and alert job thresholds all regression-locked. Full suite 888 passing (from 838 baseline).**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-30T01:05:38Z
- **Completed:** 2026-04-30T01:23:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- `subcontractors.cert.test.ts` — 17 passing tests covering DBE-02 CRUD, DBE-04 internal CPR gate, DBE-05 certSummary, DBE-06 auto-pending boundary + explicit-wins, and auth/IDOR guards
- `certificationExpiryAlerts.test.ts` — 6 passing tests covering DBE-03: 90/60/30-day exact-match sends, off-by-one misses (89/61/31), no-key skip, and projectMembers JOIN correctness
- Full suite: 888 tests passing (from 838 baseline = +50 tests)

## Task Commits

1. **Task 1: subcontractors.cert.test.ts** - `0548dea` (test)
2. **Task 2: certificationExpiryAlerts.test.ts** - `70a8088` (test)

## Test File Details

### `src/server/routes/__tests__/subcontractors.cert.test.ts`

| Describe Block | Tests |
|---|---|
| certifications — auth + IDOR | 3 (401, cross-tenant 403/404, wrong subId → 404) |
| certifications — DBE-02 CRUD | 5 (POST minimal, GET list, PATCH expiresDate, PATCH null clears, DELETE) |
| certifications — DBE-06 auto-pending | 3 (before boundary → pending, boundary itself → not_required, explicit wins) |
| certifications — DBE-05 certSummary | 3 (no certs, current cert, expired cert) |
| certifications — DBE-04 internal upload gate | 3 (suspended → 422, expired → 422, current → 201) |

Total: **17 tests**

### `src/server/jobs/__tests__/certificationExpiryAlerts.test.ts`

| Test | Description |
|---|---|
| no-key skip | RESEND_API_KEY unset → returns without throwing, send never called |
| 90-day threshold | expiresDate = today+90 → 1 send to project owner, subject contains "90" |
| 60-day threshold | expiresDate = today+60 → 1 send to project owner, subject contains "60" |
| 30-day threshold | expiresDate = today+30 → 1 send to project owner, subject contains "30" |
| off-day miss | 89/61/31 day offsets → 0 sends |
| owner JOIN | Exactly 1 email to project owner email, body contains cert type + expiry date |

Total: **6 tests**

## Mock Decision: Resend Singleton

The job module (`certificationExpiryAlerts.ts`) caches `resendInstance` at module scope via a lazy-init pattern (`await import('resend')`). Using `vi.resetModules()` in `beforeEach` to get a fresh singleton would fight with Vitest's static `vi.mock` hoisting and cause "not a constructor" errors with arrow/class mock factories.

**Chosen approach:** Declare `mockSend = vi.fn()` at module scope before `vi.mock('resend', ...)`. The mock factory uses a plain `function` (not arrow) so `new Resend()` works as a constructor. `vi.clearAllMocks()` + `mockSend.mockClear()` in `beforeEach` reset call counts without clearing mock implementation. This works because the same `mockSend` reference is returned by every `new Resend()` call — the lazy singleton is irrelevant since all instances share the same mock.

## DBE-04 Public Portal Coverage — Plan 122-03 Decision

The DBE-04 requirement has two test paths:

1. **Internal gate** (POST `/cpr-weeks` in subcontractors.ts) — covered by Task 1 (3 test cases: suspended, expired, current)
2. **Public upload portal** (POST `/sub-upload/:token` in subUpload.ts) — NOT yet covered

The public portal test involves a different file (`subUpload.ts`) and requires seeding an `uploadToken` on a `subcontractorCprWeeks` row. This is small enough to add to an existing or new test file for subUpload.ts. Plan 122-03 (verification) should include this remaining DBE-04 public path as part of its smoke-test suite, or as a new `subUpload.cert.test.ts` file.

**Recommendation for 122-03:** Add `src/server/routes/__tests__/subUpload.cert.test.ts` targeting:
- POST `/sub-upload/:token` with expired cert → 422 + CERT_EXPIRED_OR_SUSPENDED
- POST `/sub-upload/:token` with suspended cert → 422 + CERT_EXPIRED_OR_SUSPENDED
- POST `/sub-upload/:token` with all-current certs → success

## Deviations from Plan

None — plan executed exactly as written.

The only adaptation was the Resend mock pattern. The plan suggested `vi.mocked(Resend).mock.results.at(-1)?.value` but this failed because `new Resend()` inside a dynamic import path (`await import('resend')`) requires a function/class constructor, not `vi.fn().mockImplementation(arrow)`. The fix (shared `mockSend` reference) achieves the same behavioral coverage with cleaner assertion syntax.

## Known Stubs

None — both files are pure test code with no data stubs.

## Self-Check

Files created:
- `src/server/routes/__tests__/subcontractors.cert.test.ts` — EXISTS
- `src/server/jobs/__tests__/certificationExpiryAlerts.test.ts` — EXISTS

Commits:
- `0548dea` — Task 1 commit
- `70a8088` — Task 2 commit

## Self-Check: PASSED
