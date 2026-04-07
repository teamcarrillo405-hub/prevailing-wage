---
phase: 46-notifications
plan: 01
subsystem: email-service
tags: [email, resend, notifications, nfr-02, tdd]
dependency_graph:
  requires: [src/server/db/schema.ts, src/server/services/complianceService.ts, src/server/db/index.ts]
  provides: [src/server/services/emailService.ts]
  affects: [src/server/services/complianceService.ts, src/server/routes/payroll.ts, src/server/services/payrollService.ts, src/server/services/workerService.ts, src/server/index.ts]
tech_stack:
  added: []
  patterns: [resend-lazy-init, non-fatal-email-catch, drizzle-member-query, getNotifSettings-defensive-parse]
key_files:
  created:
    - src/server/services/emailService.ts
    - tests/services/emailService.test.ts
  modified: []
decisions:
  - "sendDueSoonEmail takes ownerEmail as a direct argument rather than querying the DB, because the due-soon scan (NOTIF-02) already has the owner row; no second query needed"
  - "sendActivityEmail queries members DB-side to find ownerRow, checks ownerUserId === actingUserId BEFORE checking resend to short-circuit early"
  - "Resend constructor mocked as a plain constructable function (not vi.fn()) because vitest requires 'function' or 'class' for new-able mocks"
  - "Universal DB chain mock: detects member vs settings query by checking whether innerJoin was called before where()"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-07"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  tests_added: 20
---

# Phase 46 Plan 01: Email Service Foundation Summary

**One-liner:** Resend lazy-init email service with 4 non-fatal notification send functions and `getNotifSettings` defensive JSON parser, fully covered by 20 unit tests.

## What Was Built

### `src/server/services/emailService.ts`

The single email delivery module for all Phase 46 notifications. Exports:

- **`NotifSettings` (interface)** — `{ notifyViolations, notifyDueSoon, dueSoonDays, notifyActivity, notifySubmission }`
- **`getNotifSettings(rawSettings)`** — Parses `projectSettings` JSON defensively; spreads parsed values over defaults so missing keys fall back gracefully; handles null, empty string, and malformed JSON without throwing
- **`sendViolationEmail(...)`** — NOTIF-01: sends compliance violation alert to all active project members; skips if `notifyViolations=false`; filters null emails before calling Resend
- **`sendDueSoonEmail(...)`** — NOTIF-02: sends due-soon reminder to the owner email passed by caller; no DB query (caller owns the owner lookup)
- **`sendActivityEmail(...)`** — NOTIF-03: sends activity notification to owner; skips if `actingUserId === ownerUserId` (self-edit guard); checks `notifyActivity` setting
- **`sendSubmissionConfirmationEmail(...)`** — NOTIF-04: sends submission confirmation to the acting user's email

All send functions:
- Mirror the `inviteService.ts` lazy-init Resend pattern exactly
- Wrap their entire body in `try/catch` and log to `console.error` on failure — never rethrow (NFR-02)
- Return early with a console.log when `RESEND_API_KEY` is unset

### `tests/services/emailService.test.ts`

20 unit tests organized in 5 describe blocks. Key coverage:

| Behavior | Test |
|---|---|
| `getNotifSettings` with null | returns all-true defaults, dueSoonDays=3 |
| `getNotifSettings` with `{}` | spreads empty object over defaults |
| `getNotifSettings` with override JSON | applies overrides, defaults for missing keys |
| `getNotifSettings` with malformed JSON | returns defaults without throwing |
| `sendViolationEmail` no API key | no-op, no send call |
| `sendViolationEmail` notifyViolations=false | no send call |
| `sendViolationEmail` violations present, enabled | sends to all project member emails |
| `sendViolationEmail` Resend throws | does NOT rethrow (NFR-02) |
| `sendDueSoonEmail` sends | to supplied ownerEmail |
| `sendDueSoonEmail` no API key | no-op |
| `sendDueSoonEmail` Resend throws | does NOT rethrow |
| `sendActivityEmail` owner self-edit | skips (NOTIF-03 guard) |
| `sendActivityEmail` member edit | sends to owner |
| `sendActivityEmail` notifyActivity=false | skips |
| `sendActivityEmail` no API key | no-op |
| `sendActivityEmail` Resend throws | does NOT rethrow |
| `sendSubmissionConfirmationEmail` sends | to toEmail, subject contains agency name |
| `sendSubmissionConfirmationEmail` no API key | no-op |
| `sendSubmissionConfirmationEmail` Resend throws | does NOT rethrow |

## Decisions Made

1. **`sendDueSoonEmail` takes ownerEmail directly** — The NOTIF-02 due-soon scan (in `index.ts` cron) already queries members for each project to get the owner email. Passing it directly avoids a redundant DB round-trip and makes the function pure-ish (no side-effect queries). This differs from the plan's `<action>` block which showed the function taking a project object, but the test contract (passing direct args) is cleaner and was consistent with the plan's behavior block.

2. **Resend constructor mock as plain function** — `vi.fn().mockImplementation(...)` does not produce a constructable function in Vitest 4.x. Used `function ResendMock() { return { emails: { send: mockSend } }; }` directly. This is a known Vitest constraint documented in their warning output.

3. **Universal DB mock chain** — The `mockDb` helper detects whether `.innerJoin()` was called before `.where()` to distinguish member queries from settings queries, allowing both `sendViolationEmail` (settings first, then members) and `sendActivityEmail` (members first, then settings) to use the same helper.

4. **`sendActivityEmail` checks `ownerUserId === actingUserId` after querying members** — The plan required this check "BEFORE querying resend." Implementation queries the member list first (to get ownerUserId), then checks the guard. Resend is never called if they match. This is correct — the guard happens before `resend.emails.send`, just not before the DB query (which is unavoidable to get the ownerUserId).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed correctly.

### Adjusted Approach

**[Rule 1 - Bug] Resend vi.fn() constructor mock incompatibility with Vitest 4.x**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** `vi.fn().mockImplementation(() => ({ emails: ... }))` throws "vi.fn() mock did not use 'function' or 'class'" when used with `new Resend(...)`
- **Fix:** Changed mock to a plain constructable function: `function ResendMock() { return { emails: { send: mockSend } }; }`
- **Files modified:** `tests/services/emailService.test.ts`
- **Commit:** 86a9975 (same commit)

**[Rule 1 - Bug] DB mock call order mismatch**
- **Found during:** Task 2 (TDD GREEN — 1 test failing after initial fix)
- **Issue:** `mockDb` helper returned chains in wrong order (member first vs settings first) causing the "sends to all project members" test to receive no call
- **Fix:** Redesigned to a universal chain that detects query type by checking `innerJoin.mock.calls.length`
- **Files modified:** `tests/services/emailService.test.ts`
- **Commit:** 86a9975 (same commit)

## Verification Results

### TypeScript
```
src/server/routes/audit.ts(56,28): error TS7006: Parameter 'row' implicitly has an 'any' type.
src/server/routes/projects.ts(121,49): error TS7006: Parameter 'r' implicitly has an 'any' type.
```
Two pre-existing TS errors in unrelated files (audit.ts, projects.ts). `emailService.ts` compiles cleanly.

### Tests
```
Test Files  1 passed (1)
Tests       20 passed (20)
Duration    392ms
```

All 20 emailService tests pass. No regressions in existing test suite (pre-existing failures in worktree files and unrelated tests unaffected).

### Exports Confirmed
```
export interface NotifSettings
export function getNotifSettings
export async function sendViolationEmail
export async function sendDueSoonEmail
export async function sendActivityEmail
export async function sendSubmissionConfirmationEmail
```

## Known Stubs

None — all functions are fully implemented and tested.

## Self-Check: PASSED

- FOUND: `src/server/services/emailService.ts`
- FOUND: `tests/services/emailService.test.ts`
- FOUND: commit 86a9975
