---
phase: 86-scheduled-report-emails
plan: "02"
subsystem: client-ui
tags: [report-schedule, project-settings, rtl-tests, phase-86]
dependency_graph:
  requires: [86-01]
  provides: [NOTIF-05-ui]
  affects: [ProjectSettingsPage, projectSettings-json-blob]
tech_stack:
  added: ["@testing-library/react", "@testing-library/user-event", "@testing-library/dom", "@testing-library/jest-dom", "jsdom"]
  patterns: [vitest-environment-jsdom-docblock, react-testing-library, useMutation-toast-pattern]
key_files:
  modified:
    - path: src/client/pages/ProjectSettingsPage.tsx
      lines_before: 453
      lines_after: 573
  created:
    - path: tests/client/ProjectSettingsPage.reportSchedule.test.tsx
      lines: 172
decisions:
  - "parseReportSettings exported (not module-private) so RTL tests can unit-test it directly without mounting the full page"
  - "ToastContainer included in test wrapper so toast message text appears in DOM for assertions"
  - "// @vitest-environment jsdom docblock used per-file; global vitest config stays node for server tests"
  - "Testing-library packages installed with --legacy-peer-deps due to vite-plugin-pwa peer constraint"
metrics:
  duration: "~18 minutes"
  completed: "2026-04-27"
  tasks_completed: 1
  files_changed: 4
requirements_closed: [NOTIF-05]
---

# Phase 86 Plan 02: Compliance Report Schedule Card Summary

**One-liner:** ReportScheduleSection card with Off/Daily/Weekly/Monthly selector, optional email input, and isolated PATCH mutation wired to ProjectSettingsPage — backed by 8 RTL tests.

## What Was Built

Added a "Compliance Report Schedule" card to `ProjectSettingsPage` between the GPS card and the Field Clock link. Users can select Off, Daily, Weekly (Mondays), or Monthly (1st) cadence and optionally enter a recipient email. Saving issues a PATCH to `/api/projects/:id` with only `{ projectSettings: JSON.stringify({reportSchedule, reportEmail}) }` — the server-side shallow-merge (already in projects.ts:208-223 from Plan 86-01) preserves GPS, NY form data, and notification prefs.

## Files Changed

| File | Before | After | Change |
|------|--------|-------|--------|
| `src/client/pages/ProjectSettingsPage.tsx` | 453 lines | 573 lines | +120 lines |
| `tests/client/ProjectSettingsPage.reportSchedule.test.tsx` | (new) | 172 lines | new file |
| `package.json` / `package-lock.json` | — | — | dev deps added |

## Key Changes in ProjectSettingsPage.tsx

1. **Project interface** — added `projectSettings: string | null` (line 19)
2. **parseReportSettings** — exported pure parser with try/catch JSON fallback; defaults to `{ reportSchedule: 'off', reportEmail: '' }` on null or malformed input
3. **ReportScheduleSection** — self-contained component with `useState`, `useEffect` (re-sync on prop change), `useMutation` (`api.patch` with `{ projectSettings: JSON.stringify(...) }` only), `useToast` success/error callbacks
4. **JSX insertion** — `<ReportScheduleSection>` placed after GPS card's closing div and before Field Clock link

## Layout Order Confirmed

1. Header (Back link + page title)
2. GPS Settings Card
3. **Compliance Report Schedule Card** (new)
4. Field clock link
5. Transfer Ownership section (owners only)

## Test Coverage (8 tests)

| # | Test | Result |
|---|------|--------|
| 1 | `parseReportSettings(null)` returns defaults | PASS |
| 2 | `parseReportSettings('bad-json')` returns defaults | PASS |
| 3 | `parseReportSettings(valid-json)` extracts schedule + email, ignores extra keys | PASS |
| 4 | Render with `projectSettings` — select pre-set to monthly, email pre-filled | PASS |
| 5 | Render with `projectSettings: null` — select on "off", email empty | PASS |
| 6 | Save dispatches PATCH with exactly `{ projectSettings: '...' }` (no GPS fields) | PASS |
| 7 | `toast.success('Report schedule saved')` fires on success | PASS |
| 8 | `toast.error('Failed to save report schedule')` fires on failure | PASS |

## Deviations from Plan

### Auto-installed Dependencies (Rule 3 - Blocking)

**Found during:** Task 1 (test creation)
**Issue:** `@testing-library/react`, `@testing-library/user-event`, `@testing-library/dom`, `jsdom` not installed. RTL tests would fail to import.
**Fix:** Installed all four + `@testing-library/jest-dom` with `--legacy-peer-deps` (required due to vite-plugin-pwa peer constraint in package.json).
**Files modified:** `package.json`, `package-lock.json`

### ToastContainer Added to Test Wrapper (Rule 1 - Bug)

**Found during:** Task 1 (Tests 7 and 8 failing)
**Issue:** `ToastProvider` only provides context; toast messages are rendered by a separate `ToastContainer` component. Without `ToastContainer` in the render wrapper, `screen.queryByText('Report schedule saved')` returned null.
**Fix:** Added `import { ToastContainer }` and included `<ToastContainer />` inside the test wrapper alongside `<MemoryRouter>`.
**Files modified:** `tests/client/ProjectSettingsPage.reportSchedule.test.tsx`

## Acceptance Criteria Verification

- `projectSettings: string | null` in interface: 1 line (line 19)
- `function ReportScheduleSection`: 1 line (line 58)
- `parseReportSettings` occurrences: 3 (declaration + 2 uses)
- `Compliance Report Schedule` heading: 2 lines (component + JSX comment)
- Four `value=` options (off/daily/weekly/monthly): 4 lines
- `Save Report Schedule` button: 1 line
- `<ReportScheduleSection` in JSX: 1 line (line 556)
- `JSON.stringify.*reportSchedule` in mutation: 1 line
- `import.*from.*server` in client file: 0 matches
- Toast message strings: 2 lines (success + error)
- Test file has 8 test blocks: confirmed
- All 8 tests pass: confirmed
- `npx tsc --noEmit`: pre-existing stripeService.ts error only (not from this plan)
- Full suite: 59 files passed, 762 tests passed, 0 failures

## Notes

- Plan 86-01 must be merged before this plan produces real emails (cron registers on server boot; Plan 86-01 adds the cron job and `scheduledReports.ts` service)
- parseReportSettings is exported — this is intentional and safe (no server dependencies, pure function)
- No server imports in `ProjectSettingsPage.tsx` (confirmed by grep returning 0 matches for `import.*from.*server`)

## Self-Check: PASSED

- `src/client/pages/ProjectSettingsPage.tsx` exists and has 573 lines
- `tests/client/ProjectSettingsPage.reportSchedule.test.tsx` exists and has 172 lines
- Commit `a8277c7` confirmed in git log
- All 8 new tests pass; full suite 762/762 pass
