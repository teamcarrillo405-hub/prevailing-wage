---
phase: 86-scheduled-report-emails
plan: "01"
subsystem: notifications
tags: [cron, email, resend, unsubscribe, notif-06]
dependency_graph:
  requires: []
  provides: [scheduled-compliance-report-emails, unsubscribe-endpoint]
  affects: [src/server/index.ts]
tech_stack:
  added: []
  patterns: [lazy-init-resend, read-modify-write-projectSettings, vi.hoisted-mock, supertest-integration]
key_files:
  created:
    - src/server/jobs/scheduledReports.ts
    - src/server/routes/notifications.ts
    - tests/services/scheduledReports.test.ts
    - tests/routes/notifications.test.ts
  modified:
    - src/server/index.ts
decisions:
  - GET and POST both supported for unsubscribe (email href fires GET, API callers use POST)
  - UTC timezone for scheduled-reports cron (not ET — ROADMAP author specified region-agnostic dispatch)
  - Resend used (not nodemailer) — STATE.md decision locks this; ROADMAP nodemailer wording is a documented copy-paste error per RESEARCH Pitfall 1
  - Single daily cron with internal cadence gating (not 3 separate crons) — simpler maintenance per RESEARCH Pattern 3
  - Token self-generated on first send if 86-02 UI hasn't written it yet — job is self-sufficient
  - lastReportSentAt set ONLY after Resend returns no error — failed sends retry on next cron tick
  - vi.hoisted() used for shared mockSend in scheduledReports tests — avoids Vitest hoisting ReferenceError (Phase 46 pattern)
metrics:
  duration_seconds: 504
  completed_date: "2026-04-27"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
  tests_added: 20
---

# Phase 86 Plan 01: Scheduled Report Emails — Cron + Unsubscribe Summary

One-liner: Daily compliance report cron via Resend with cadence gating (daily/weekly-Monday/monthly-1st), lastReportSentAt dedup, owner email fallback, and public token-based unsubscribe (POST + GET) wired into Express.

## What Was Built

### src/server/jobs/scheduledReports.ts (new, 258 lines)
- `runScheduledReports()` exported function — the daily dispatch job
- Lazy-init Resend pattern (mirrors certificationExpiryAlerts.ts lines 17-25)
- `shouldSendToday()` uses `getUTCDay()` and `getUTCDate()` (not `getDay()`/`getDate()`) — avoids timezone-dependent cadence shift on Render.com
- Per-project try/catch — per NFR-02, one bad project never aborts the full scan
- Dedup: reads `projectSettings.lastReportSentAt`, skips if === today's ISO date
- Falls back to project owner email via `projectMembers` JOIN when `reportEmail` is blank
- Generates `randomUUID()` unsubscribe token on first send if not yet set by UI (86-02)
- Read-modify-write merge of `projectSettings` preserves all sibling keys (notifyViolations, lastDueSoonNotifiedAt, GPS settings, NY form data, etc.)
- Dual-format email: both `html` and `text` body sent via `resend.emails.send`
- Email body includes: compliance rate %, open violations count, weeks-due-in-7 count, View Project link, Unsubscribe footer href

### src/server/routes/notifications.ts (new, 97 lines)
- `POST /api/notifications/unsubscribe { token }` — API callers
- `GET /api/notifications/unsubscribe?token=xxx` — browser email link (href fires as GET)
- Public route — no `requireAuth` — token IS the authorization credential (mirrors subUpload.ts)
- `unsubscribeByToken()` scans all projects for matching `reportUnsubscribeToken`
- Read-modify-write: sets `reportSchedule='off'`, preserves all sibling keys
- Returns JSON (POST) or plain HTML (GET) for browser-friendly response

### src/server/index.ts (modified, +17 lines)
- Import: `runScheduledReports` from `./jobs/scheduledReports.js`
- Import: `notificationsRouter` from `./routes/notifications.js`
- `app.use('/api/notifications', notificationsRouter)` — registered in API cluster before `/v1`
- 5th cron block: `cron.schedule('0 8 * * *', ..., { timezone: 'UTC' })` — daily at 08:00 UTC

### tests/services/scheduledReports.test.ts (new, 397 lines — 13 tests)
- Uses `vi.hoisted()` for shared `mockSend` — avoids Vitest hoisting ReferenceError (Phase 46 decision)
- Test 1: RESEND_API_KEY unset → returns without throw, no send
- Test 2: reportSchedule='off' → skipped
- Test 3: daily → sends with correct subject/recipient
- Test 4a/4b: weekly → sends on Monday, not Tuesday (UTC day gating)
- Test 5a/5b: monthly → sends on 1st, not 15th (UTC date gating)
- Test 6: dedup → skips when lastReportSentAt === today
- Test 7: fallback email → uses owner email when reportEmail is blank
- Test 8: read-modify-write → lastReportSentAt set, sibling keys preserved
- Test 9: error isolation → one project's throw doesn't abort next project
- Test 10: unsubscribe link → html contains /api/notifications/unsubscribe?token=...
- Test 11: compliance stats → 50% rate and 2 violations in email body

### tests/routes/notifications.test.ts (new, 177 lines — 7 tests)
- Uses real Express app via supertest (same pattern as projects.test.ts)
- Test 1: POST with empty body → 400
- Test 2: POST with unknown token → 404
- Test 3: POST with valid token → 200, reportSchedule='off'
- Test 4: sibling key preservation after unsubscribe (reportEmail, token, notifyViolations, lastDueSoonNotifiedAt all intact)
- Test 5: GET with valid token → 200 HTML, project unsubscribed
- Test 6: GET with unknown token → 404 HTML
- Test 7: GET with no token param → 400 HTML

## Test Results

- `tests/services/scheduledReports.test.ts`: 13/13 passed
- `tests/routes/notifications.test.ts`: 7/7 passed
- Full suite: 754/754 passed, 7 skipped (pre-existing), 0 regressions

## Decisions Made

1. **Resend over nodemailer** — ROADMAP uses "nodemailer" wording but STATE.md Decisions locks Resend for all notification emails since Phase 46. RESEARCH Pitfall 1 explicitly documents this as a copy-paste error. Implemented with Resend.
2. **UTC cron timezone** — `{ timezone: 'UTC' }` for scheduled-reports vs. `{ timezone: 'America/New_York' }` for other crons. Cert-expiry also uses `'0 8 * * *'` but in ET, so they fire 4-5h apart with no conflict.
3. **Both GET and POST unsubscribe** — Email clients render `<a href>` as GET. Requiring users to receive a form to POST is bad UX. POST retained for programmatic API callers.
4. **Single daily cron + internal dispatch** — Researched as Pattern 3 (simpler maintenance vs. 3 separate crons for daily/weekly/monthly).
5. **vi.hoisted() for mockSend** — Required to share one spy reference across all `new Resend()` instances when the module-level `resendInstance` is cached. Plain `const mockSend = vi.fn()` outside `vi.mock` factory causes hoisting ReferenceError.

## Deviations from Plan

None — plan executed exactly as written. The `vi.hoisted()` approach for the test mock was not specified in the plan but was required to make the Resend spy work correctly across the module-level lazy-init cache. This is consistent with the Phase 46 decision documented in STATE.md.

## Known Stubs

None — all logic is fully implemented. `reportSchedule`, `reportEmail`, `reportUnsubscribeToken`, `lastReportSentAt` are read from existing `projectSettings` JSON blob (no migration required). Plan 86-02 will add the UI selector that writes these settings.

## Self-Check: PASSED
