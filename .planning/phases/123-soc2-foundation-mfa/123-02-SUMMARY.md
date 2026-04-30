---
phase: 123-soc2-foundation-mfa
plan: 02
subsystem: testing
tags: [vitest, pino, logtail, sha256, audit-chain, backfill, soc2]

requires:
  - phase: 83
    provides: "@logtail/pino transport wired in logger.ts with LOGTAIL_TOKEN env var"
  - phase: 79
    provides: "audit_logs SHA-256 hash chain (previous_hash, entry_hash columns, verifyAuditChain, GET /api/audit/integrity-check)"

provides:
  - "buildTransport() exported from src/server/logger.ts — unit-testable without spawning real Better Stack workers"
  - "tests/services/loggerTransport.test.ts — 4-branch transport unit tests (test/dev/prod-with-token/prod-no-token)"
  - "tests/routes/audit.integrity.test.ts — 6-test audit chain integration suite (happy, tamper, auth, determinism, backfill, idempotency)"
  - "scripts/backfill-audit-hash-chain.ts — one-time script with exported runBackfill() and CLI runner to hash pre-chain rows"

affects:
  - soc2-foundation-mfa
  - sec-02
  - sec-03

tech-stack:
  added: []
  patterns:
    - "vi.doMock + vi.resetModules + dynamic import for per-test env-var isolation (avoids module-level const caching)"
    - "getDb() called inside test functions (not at module scope) to ensure in-memory DB is fully initialized"
    - "runBackfill(dbHandle) accepts optional DB handle for testability — same pattern as other project services"
    - "backfill script isMain detection handles Windows path normalization"

key-files:
  created:
    - tests/services/loggerTransport.test.ts
    - tests/routes/audit.integrity.test.ts
    - scripts/backfill-audit-hash-chain.ts
  modified:
    - src/server/logger.ts

key-decisions:
  - "vi.doMock (not vi.mock) used for transport tests — vi.mock is hoisted once and lost after vi.resetModules(); vi.doMock registers synchronously at call time and survives module resets"
  - "5ms delays between insertAuditLog calls in tests — ensures distinct ISO timestamps so ORDER BY created_at produces deterministic row ordering for tamper-detection test"
  - "Task 3 (LOGTAIL_TOKEN env config) required no file changes — both .env.example and render.yaml were already correct from Phase 83"
  - "backfill script uses prevHash ?? '' matching computeAuditEntryHash exactly — test cross-check proves no formula drift"

patterns-established:
  - "Phase 123-02: per-env transport mock pattern with vi.doMock + vi.resetModules for logger unit tests"
  - "Phase 123-02: audit integrity test pattern — in-memory DB, cookie auth, explicit 5ms delays for timestamp ordering"

requirements-completed:
  - SEC-02
  - SEC-03

duration: 25min
completed: 2026-04-30
---

# Phase 123 Plan 02: SOC 2 Foundation — Logger Transport Tests + Audit Chain Coverage Summary

**buildTransport() exported from logger.ts; 10 new SOC 2 evidence tests prove Logtail transport configuration and SHA-256 audit hash chain tamper-detection, plus a one-time backfill script that hashes pre-chain rows with idempotency**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-30T02:20:00Z
- **Completed:** 2026-04-30T02:45:00Z
- **Tasks:** 4 (Task 3 was verification-only, no file changes)
- **Files modified:** 4

## Accomplishments

- Exported `buildTransport()` from `src/server/logger.ts` (single-character `export` addition) enabling deterministic unit testing of all four transport branches without spawning real Better Stack worker_threads
- Wrote 4 passing transport unit tests using `vi.doMock` + `vi.resetModules` + dynamic import isolation — proves test/dev/prod-with-token/prod-without-token branches each select the correct transport
- Wrote 6 passing audit chain integration tests: happy path (valid:true, scanned:3), tamper detection (valid:false + brokenAt), auth guard (401), SHA-256 formula determinism, backfill chain construction, backfill idempotency
- Created `scripts/backfill-audit-hash-chain.ts` with exported `runBackfill(dbHandle?)` walking `audit_logs` in stable `createdAt ASC, id ASC` order; idempotent (skips non-null entry_hash rows); CLI exits 0 with `backfilled:0` on empty table
- Verified `.env.example` and `render.yaml` already correctly document `LOGTAIL_TOKEN` with explanatory comment block (Phase 83 work confirmed complete — no changes needed)
- Full suite: 914 passing tests (up from 890 baseline), 0 failing, 0 TS errors

## Task Commits

1. **Task 1: Export buildTransport + 4-branch transport tests** - `f541977` (feat)
2. **Task 2: Audit hash chain integration tests (4 tests)** - `b6808b1` (test)
3. **Task 3: LOGTAIL_TOKEN env config verification** - no commit (files already correct)
4. **Task 4: Backfill script + 2 backfill integration tests** - `2c87e94` (feat)

## Files Created/Modified

- `src/server/logger.ts` — Added `export` keyword to `buildTransport()` function declaration (1 char change)
- `tests/services/loggerTransport.test.ts` — 4-branch transport unit test using vi.doMock per-test-isolation pattern
- `tests/routes/audit.integrity.test.ts` — 6-test audit chain integration suite (Tests 1-4 Task 2, Tests 5-6 Task 4)
- `scripts/backfill-audit-hash-chain.ts` — Backfill script with exported `runBackfill()`, SHA-256 formula matching `computeAuditEntryHash`, idempotency guard, CLI main runner

## Decisions Made

- **vi.doMock vs vi.mock for transport tests:** `vi.mock` is hoisted once before module evaluation and is not re-registered after `vi.resetModules()`. `vi.doMock` fires at call time and correctly intercepts re-imports after each reset. This was the key fix enabling per-branch transport testing.
- **getDb() inside test functions not at module scope:** Module-level `const db = getDb()` executed before `tests/helpers/db.ts` `beforeAll` ran, returning the production DB handle instead of `__testDb`. Moving calls inside test functions fixed this.
- **5ms delays between insertAuditLog calls:** SQLite timestamps at millisecond precision — rapid sequential inserts can get the same timestamp, causing `ORDER BY createdAt` to return non-deterministic ordering. 5ms delays ensure stable chronological order for tamper-detection assertions.
- **Task 3 no-op:** `.env.example` already had a 4-line comment block and blank `LOGTAIL_TOKEN=` value; `render.yaml` already had `LOGTAIL_TOKEN: sync: false`. Phase 83 delivered both — no changes needed.

## Deviations from Plan

None - plan executed exactly as written. The vi.doMock approach was specified as the correct strategy in the plan's action section (Step 3 for Task 1). The 5ms delays were a minor implementation detail not in the plan but required for test determinism.

## Issues Encountered

- **vi.mock + vi.resetModules incompatibility:** Initial test implementation used top-level `vi.mock('pino', ...)` which was lost after `vi.resetModules()`. Tests 2 and 3 (logtail/pino-pretty branches) returned `undefined` because re-imported logger didn't get the mocked pino. Fixed by switching to `vi.doMock` registered inside each test before the dynamic import.
- **getDb() module-scope timing:** `const db = getDb()` at module top level returned production DB before `beforeAll` in `db.ts` setup file had run. Fixed by calling `getDb()` inside `beforeEach` and test functions.

## User Setup Required

None - no external service configuration required. LOGTAIL_TOKEN already documented.

## Next Phase Readiness

- SEC-02 (Logtail drain integration test) and SEC-03 (hash chain backfill + tests) fully satisfied
- Phase 123 Plan 02 complete — all SOC 2 evidence tests for logging and audit chain are in place
- The `runBackfill()` script is ready to run against production DB once deployed: `NODE_ENV=production npx tsx scripts/backfill-audit-hash-chain.ts`

## Self-Check: PASSED

- FOUND: src/server/logger.ts (export function buildTransport at line 16)
- FOUND: tests/services/loggerTransport.test.ts
- FOUND: tests/routes/audit.integrity.test.ts
- FOUND: scripts/backfill-audit-hash-chain.ts
- FOUND: commit f541977 (feat: export buildTransport + 4-branch transport tests)
- FOUND: commit b6808b1 (test: audit hash chain integration tests)
- FOUND: commit 2c87e94 (feat: backfill script + 2 backfill integration tests)
- LOGTAIL_TOKEN in .env.example: 1 match
- LOGTAIL_TOKEN in render.yaml: 1 match
- 914 passing tests, 0 failing, 0 TS errors

---
*Phase: 123-soc2-foundation-mfa*
*Completed: 2026-04-30*
