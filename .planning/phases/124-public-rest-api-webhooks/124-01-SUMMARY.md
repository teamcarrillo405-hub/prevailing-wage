---
phase: 124
plan: "01"
subsystem: public-api
tags: [rate-limit, audit-log, vitest, api-key]
dependency_graph:
  requires: []
  provides: [per-key-rate-limiting, api-v1-audit-logging, publicApi-test-suite]
  affects: [public-api]
tech_stack:
  added: [express-rate-limit/ipKeyGenerator]
  patterns: [fire-and-forget audit middleware, draft-7 rate-limit headers]
key_files:
  modified:
    - src/server/routes/publicApi.ts
  created:
    - tests/routes/publicApi.test.ts
decisions:
  - "Use express-rate-limit with ipKeyGenerator for IPv6-safe fallback (avoids ERR_ERL_KEY_GEN_IPV6 validation error)"
  - "Audit logging is fire-and-forget (void async IIFE) — never blocks response on insert failure"
  - "publicApiLimiter placed AFTER requireApiKey so keyGenerator always has apiKeyUserId available"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-29"
  tasks_completed: 3
  files_changed: 2
---

# Phase 124 Plan 01: Rate-Limit + Audit Logging + Tests Summary

**One-liner:** Per-API-key rate limiting (100 req/min, draft-7 headers) via express-rate-limit with fire-and-forget audit logging and 5 Vitest integration tests for the /v1 router.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Wire express-rate-limit per-API-key throttle to /v1 router | 8852cf0 |
| 2 | Add per-request audit logging middleware | 8852cf0 |
| 3 | Create tests/routes/publicApi.test.ts with 5 Vitest cases | 8852cf0 |

## Files Modified

- `src/server/routes/publicApi.ts` — Added `rateLimit` + `ipKeyGenerator` imports; defined `publicApiLimiter` (100 req/min, keyed by `apiKeyUserId`); added audit logging middleware; removed `RATE_LIMIT` const, `addRateLimitHeaders` function, and all 8 inline call sites.
- `tests/routes/publicApi.test.ts` (new) — 5 integration tests: 401 no-auth, 401 bad-token, response envelope shape, pagination with hasNext, scope enforcement 403.

## Test Delta

- Before: 914 tests
- After: 919 tests (+5)
- All 919 passing, 0 failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] IPv6-safe keyGenerator using ipKeyGenerator helper**
- **Found during:** Task 1 execution (express-rate-limit ValidationError at module init)
- **Issue:** Custom `keyGenerator` using `req.ip` directly triggers `ERR_ERL_KEY_GEN_IPV6` validation warning — IPv6 users could bypass limits with address variations
- **Fix:** Replaced `req.ip ?? 'unknown'` fallback with `ipKeyGenerator(req.ip ?? 'unknown')` using express-rate-limit's own IPv6-normalization helper
- **Files modified:** `src/server/routes/publicApi.ts`
- **Commit:** 8852cf0

## Self-Check: PASSED

- [x] `src/server/routes/publicApi.ts` exists with rateLimit + audit middleware
- [x] `tests/routes/publicApi.test.ts` exists with 5 tests
- [x] Commit 8852cf0 exists
- [x] `grep -c "addRateLimitHeaders" src/server/routes/publicApi.ts` = 0
- [x] `npx tsc -p tsconfig.server.json --noEmit` = 0 errors
- [x] All 919 vitest tests passing
