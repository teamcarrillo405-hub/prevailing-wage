---
phase: 86-scheduled-report-emails
verified: 2026-04-27T12:30:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
human_verification:
  - test: "Email actually delivered on schedule trigger"
    expected: "Resend delivers a compliance report email at 08:00 UTC to the configured reportEmail address"
    why_human: "Requires live Resend sandbox credentials and a running server with a real project that has reportSchedule != 'off'"
  - test: "Unsubscribe link removes schedule in browser"
    expected: "Clicking the unsubscribe link in a received email sets reportSchedule='off' and shows a confirmation page"
    why_human: "Requires browser + live server + a real email with a valid token in the href"
---

# Phase 86: Scheduled Report Emails — Verification Report

**Phase Goal:** Deliver automated scheduled compliance-report emails (daily/weekly/monthly cadence) with an unsubscribe mechanism and a project-settings UI to configure the schedule.
**Verified:** 2026-04-27T12:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | scheduledReports.ts job file exists and is substantive | VERIFIED | File present at `src/server/jobs/scheduledReports.ts`, 258 lines |
| 2 | `runScheduledReports` is wired into server startup (index.ts) | VERIFIED | `grep -q "runScheduledReports" src/server/index.ts` returns 0 exit code |
| 3 | Unsubscribe endpoint exists in notifications route | VERIFIED | `grep -q "unsubscribe" src/server/routes/notifications.ts` returns 0 exit code |
| 4 | ProjectSettingsPage.tsx contains reportSchedule/reportEmail UI | VERIFIED | 11 occurrences of `reportSchedule\|reportEmail` in the file |
| 5 | Full test suite passes with no regressions | VERIFIED | 59 test files passed, 762 tests passed, 7 skipped (pre-existing), 0 failures |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/jobs/scheduledReports.ts` | Daily cron dispatch job | VERIFIED | 258 lines — cadence gating, dedup, owner-email fallback, Resend send, read-modify-write |
| `src/server/routes/notifications.ts` | Unsubscribe endpoints | VERIFIED | 97 lines — POST + GET unsubscribe, token-based auth, read-modify-write |
| `src/server/index.ts` | Cron wiring + router registration | VERIFIED | `runScheduledReports` import + 5th cron block + `notificationsRouter` registered |
| `src/client/pages/ProjectSettingsPage.tsx` | Report schedule UI card | VERIFIED | 573 lines (+120 from 453); `ReportScheduleSection` component, Off/Daily/Weekly/Monthly selector, email input, PATCH mutation |
| `tests/services/scheduledReports.test.ts` | Job unit tests | VERIFIED | 397 lines, 13 tests (cadence gating, dedup, fallback email, read-modify-write, error isolation, link format, compliance stats) |
| `tests/routes/notifications.test.ts` | Unsubscribe route tests | VERIFIED | 177 lines, 7 tests (POST + GET happy paths, 400/404 error cases, sibling key preservation) |
| `tests/client/ProjectSettingsPage.reportSchedule.test.tsx` | RTL tests for UI card | VERIFIED | 172 lines, 8 tests (parseReportSettings, pre-fill render, PATCH dispatch, toast success/error) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.ts` | `scheduledReports.ts` | `runScheduledReports` import + `cron.schedule('0 8 * * *', ...)` | WIRED | grep confirmed |
| `index.ts` | `notifications.ts` | `notificationsRouter` registered at `/api/notifications` | WIRED | grep confirmed |
| `ProjectSettingsPage.tsx` | `/api/projects/:id` | `api.patch` with `{ projectSettings: JSON.stringify({reportSchedule, reportEmail}) }` | WIRED | SUMMARY documents 1 matching line; 11 occurrences of reportSchedule/reportEmail in file confirm wiring |
| `scheduledReports.ts` | `Resend` | lazy-init `resendInstance`, `resend.emails.send({html, text, ...})` | WIRED | SUMMARY confirms dual-format send with compliance stats, unsubscribe footer |
| Email unsubscribe href | `GET /api/notifications/unsubscribe?token=` | token in HTML body | WIRED | SUMMARY Test 10 confirms html contains the token URL |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `scheduledReports.ts` | project rows + projectSettings JSON | DB query via Drizzle (`projectMembers` JOIN, `projectSettings` JSON blob) | Yes — reads live DB rows; skips off/dedup; falls back to owner email | FLOWING |
| `ProjectSettingsPage.tsx` `ReportScheduleSection` | `reportSchedule`, `reportEmail` | `parseReportSettings(project.projectSettings)` — prop from parent page query; PATCH writes back | Yes — populated from server response, not hardcoded; mutation sends only changed settings keys | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| scheduledReports.ts exists on disk | `test -f src/server/jobs/scheduledReports.ts` | PASS | PASS |
| runScheduledReports wired in index.ts | `grep -q "runScheduledReports" src/server/index.ts` | PASS | PASS |
| unsubscribe in notifications.ts | `grep -q "unsubscribe" src/server/routes/notifications.ts` | PASS | PASS |
| reportSchedule/reportEmail in ProjectSettingsPage | `grep -c "reportSchedule\|reportEmail" src/client/pages/ProjectSettingsPage.tsx` | 11 | PASS |
| Full test suite | `npx vitest run --exclude ".claude/**"` | 59 files / 762 tests passed, 0 failures | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NOTIF-05 | 86-01, 86-02 | Scheduled compliance report emails with configurable cadence | SATISFIED | cron job + UI selector both implemented; PATCH wired to server-side merge |
| NOTIF-06 | 86-01 | Unsubscribe mechanism for report emails | SATISFIED | GET + POST `/api/notifications/unsubscribe` with token-based auth; 7 route tests pass |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TODOs, placeholders, empty returns, or hardcoded stubs detected in phase files | — | — |

Note: `parseReportSettings` defaults to `{ reportSchedule: 'off', reportEmail: '' }` on null/malformed input — this is correct defensive initialization, not a stub. The `useEffect` re-syncs from the server prop on load.

### Human Verification Required

#### 1. Live Email Delivery

**Test:** With `RESEND_API_KEY` set and a project configured with `reportSchedule='daily'`, trigger `runScheduledReports()` manually or wait for the 08:00 UTC cron. Check the `reportEmail` inbox.
**Expected:** A compliance report email arrives with correct subject, compliance rate %, open violation count, View Project link, and an unsubscribe footer href containing a valid token.
**Why human:** Requires live Resend sandbox credentials and a running server with real project data. Cannot be verified by grep or vitest.

#### 2. Browser Unsubscribe Flow

**Test:** Click the unsubscribe link from a received email (GET request with token). Check the browser shows a confirmation page and the project's `reportSchedule` is now `'off'` in the DB.
**Expected:** Plain HTML "Unsubscribed" confirmation page; subsequent cron runs skip the project.
**Why human:** Requires browser + live server + a real email with a valid token embedded in the href.

### Gaps Summary

No gaps. All 5 automated must-haves verified. Phase 86 goal is achieved:

- The cron job (`scheduledReports.ts`) is substantive, handles all three cadences, deduplicates, falls back to owner email, generates real compliance stats, and sends via Resend.
- The unsubscribe route (`notifications.ts`) supports both GET (browser href) and POST (API), is token-gated (no auth required), and correctly reads-modifies-writes `projectSettings`.
- Both are wired into `index.ts` (cron block + router registration).
- The UI card in `ProjectSettingsPage.tsx` reads existing settings, patches only the schedule fields, and shows success/error toasts.
- 20 new unit/integration tests pass; full suite 762/762 passes with 0 regressions.

Two behaviors remain for human verification: live email delivery and the browser unsubscribe flow — both require a running server and live credentials.

---

_Verified: 2026-04-27T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
