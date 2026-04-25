---
phase: 64-soc2-logging-page-polish
plan: 02
subsystem: auth-audit
tags: [soc2, audit, security-events, login-attempts, auth]
dependency_graph:
  requires: [64-01]
  provides: [SOC2-02]
  affects: [src/server/routes/auth.ts]
tech_stack:
  patterns: [fire-and-forget audit, best-effort try/catch, drizzle insert]
key_files:
  created:
    - src/server/db/auditHelpers.ts
  modified:
    - src/server/routes/auth.ts
    - src/server/db/schema.ts
    - src/server/db/migrations/0040_security_events_login_attempts.sql
decisions:
  - "All audit calls use void (fire-and-forget) — helpers handle their own errors internally"
  - "login failure branch distinguishes email_not_found vs wrong_password internally but HTTP response stays identical to prevent user enumeration"
  - "security_events.user_id FK uses ON DELETE SET NULL so audit records survive user deletion"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-25"
  tasks: 2
  files: 4
---

# Phase 64 Plan 02: SOC 2 Audit Helpers Wired to Auth Routes Summary

**One-liner:** Best-effort `insertSecurityEvent` and `insertLoginAttempt` helpers wired fire-and-forget to all five auth route handlers, starting the SOC 2 Type II observation clock.

## What Was Built

### src/server/db/auditHelpers.ts (new)

Two exported async helpers:
- `insertSecurityEvent(params)` — inserts a row into `security_events` table
- `insertLoginAttempt(params)` — inserts a row into `login_attempts` table

Both are wrapped in `try/catch` and never throw or reject. A failed audit insert is logged via `console.error` and silently swallowed — the calling auth handler is never affected.

### src/server/routes/auth.ts (modified)

Six `void` call sites added (fire-and-forget, never awaited in a way that delays responses):

| Handler | Event(s) emitted |
|---|---|
| POST /api/auth/register | `loginAttempt(success=true)` + `securityEvent(register)` |
| POST /api/auth/login — failure | `loginAttempt(success=false, failureReason=email_not_found\|wrong_password)` + `securityEvent(login_failure)` |
| POST /api/auth/login — success | `loginAttempt(success=true)` + `securityEvent(login_success)` |
| POST /api/auth/logout | `securityEvent(logout, userId=null)` |
| POST /api/auth/accept-invite | `securityEvent(invite_accepted, metadata={inviteToken: prefix...})` |
| GET /api/auth/me | (not touched — read-only health check) |

**Security note:** The failure-branch `failureReason` field distinguishes `email_not_found` vs `wrong_password` in the DB for SOC 2 analysis, but the HTTP response to the client remains identical ("Invalid email or password") in both cases to prevent user enumeration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added ON DELETE SET NULL to security_events.user_id FK**
- **Found during:** Task 1 / test run
- **Issue:** The `security_events.user_id` FK referenced `users(id)` with no cascade behavior. When auth tests run `afterEach` cleanup (DELETE from users), SQLite FK enforcement rejected the DELETE because `security_events` rows pointed to the user. Tests 1-6 in `auth.test.ts` all failed.
- **Fix:** Added `ON DELETE SET NULL` to the FK in both `0040_security_events_login_attempts.sql` and `schema.ts`. Audit records now survive user deletion — correct SOC 2 behavior (audit trail should be immutable even if user is removed).
- **Files modified:** `src/server/db/migrations/0040_security_events_login_attempts.sql`, `src/server/db/schema.ts`
- **Commit:** `672b452`

## Test Results

- Before: 705 passed, 6 failed (auth register tests)
- After: **711 passed, 0 failed** (55 test files, 753 total, 42 todo)
- `pnpm tsc --noEmit`: 0 errors

## Commits

- `672b452` — feat(64-02): create auditHelpers.ts with insertSecurityEvent and insertLoginAttempt
- `1b0ee5e` — feat(64-02): wire audit helpers into all five auth route handlers

## Known Stubs

None. All audit calls write to real DB tables via the migration applied in 64-01.
