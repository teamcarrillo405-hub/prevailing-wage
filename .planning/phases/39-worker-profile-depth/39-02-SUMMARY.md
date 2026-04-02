---
phase: 39-worker-profile-depth
plan: 02
subsystem: ui
tags: [react, tanstack-query, tailwindcss, workers, payroll, classification-override]

requires:
  - phase: 39-worker-profile-depth/39-01
    provides: "8 new worker columns, payrollWeekClassifications table, POST/DELETE classification override routes, getPayrollEntriesWithWorkerDetails with COALESCE override logic"

provides:
  - "WorkersPage form with 4 structured address inputs (Street, City, State, Zip)"
  - "WorkersPage Union Information section (unionLocal, unionBookNumber)"
  - "WorkersPage Apprenticeship section conditionally rendered for apprentice workers"
  - "Worker card shows concatenated structured address + union + apprenticeship details"
  - "PayrollWeekDetailPage classification override dropdown per entry row"
  - "overrideId exposed from getPayrollEntriesWithWorkerDetails for DELETE support"

affects:
  - PayrollWeekDetailPage
  - WorkersPage
  - WH-347 export (worker address is now structured, concatenation handled in payrollService)

tech-stack:
  added: []
  patterns:
    - "Structured address split into 4 fields; concatenated display via filter(Boolean).join(', ')"
    - "Conditional section render: apprenticeship section only shown when worker has apprentice classification"
    - "Classification override via IIFE pattern in table cell for per-row dropdown logic"
    - "overrideId exposed from LEFT JOIN result for DELETE endpoint targeting"

key-files:
  created: []
  modified:
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/server/services/payrollService.ts

key-decisions:
  - "overrideId added to getPayrollEntriesWithWorkerDetails select — enables DELETE /payroll-week-classifications/:id from UI without needing separate lookup query"
  - "Override dropdown hidden for workers with only one classification (no point overriding a single trade)"
  - "Override dropdown disabled when week is submitted — consistent with existing edit lock pattern"
  - "Apprenticeship section in edit form uses w.classifications?.some(c => c.laborType === 'apprentice') — hidden for new workers (no classifications yet)"

patterns-established:
  - "Structured address: 4 separate inputs in Street + (City/State/Zip grid) layout; display with filter(Boolean).join(', ')"
  - "Conditional form sections: read worker.classifications from server response to gate section visibility"

requirements-completed: [WORKER-01, WORKER-02, WORKER-03, WORKER-04, NFR-01, NFR-05]

duration: 25min
completed: 2026-04-02
---

# Phase 39 Plan 02: Worker Profile Depth — UI Summary

**WorkersPage gains structured 4-field address, always-visible Union Information, conditional Apprenticeship section; PayrollWeekDetailPage gains per-worker classification override dropdown with POST/DELETE mutations**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-02T16:10:00Z
- **Completed:** 2026-04-02T16:35:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- WorkersPage form completely replaced single address input with structured 4-field address (Street, City, State, Zip) in grid layout
- Union Information section (unionLocal, unionBookNumber) added to both the add-worker and edit-worker forms, always visible
- Apprenticeship section (committee, regNumber) added to edit form, conditionally rendered only when worker has an apprentice classification
- Worker card display updated to show concatenated structured address, union info, and apprenticeship details inline
- PayrollWeekDetailPage entries table gains an Override column with a per-worker classification dropdown
- Override dropdown calls POST /api/projects/:projectId/payroll-week-classifications on selection change
- Remove override (select "Default") calls DELETE via the overrideId exposed from payrollService
- Active overrides show Badge variant="warning" next to trade description in the Trade column
- `overrideId` added to `getPayrollEntriesWithWorkerDetails` select (one-line change to payrollService.ts)

## Task Commits

1. **Task 1: Update WorkersPage — form, display, and mutation payload** - `78b92df` (feat)
2. **Task 2: Add classification override dropdown to PayrollWeekDetailPage** - `230e7c5` (feat)

## Files Created/Modified
- `src/client/pages/WorkersPage.tsx` - 4-field address inputs, Union Information section, conditional Apprenticeship section, updated mutation payloads, updated card display
- `src/client/pages/PayrollWeekDetailPage.tsx` - Override column header, per-row classification dropdown, overrideMutation and removeOverrideMutation, updated PayrollEntryRow interface
- `src/server/services/payrollService.ts` - Added `overrideId: payrollWeekClassifications.id` to getPayrollEntriesWithWorkerDetails select

## Decisions Made
- Added `overrideId` to `getPayrollEntriesWithWorkerDetails` — enables clean DELETE from UI without needing an additional lookup query. This is the approach specified as "Option A" in the plan and is preferred over the "Option B" workaround.
- Override dropdown hidden (returns `—`) for workers with only one classification — no value in overriding if there's nothing to switch to.
- Override dropdown disabled when week is submitted — consistent with the existing edit lock enforced across the page.

## Deviations from Plan

None - plan executed exactly as written. The plan mentioned "Option A vs Option B" for overrideId — Option A (adding `overrideId` to the payrollService select) was the recommended approach and was applied.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. All 8 new fields are wired end-to-end: form inputs → mutation payload → API → database → GET response → UI display.

## Next Phase Readiness
- Phase 39 (worker-profile-depth) is now complete (Plan 01 backend + Plan 02 UI)
- Worker profile depth features fully surfaced: structured address, union info, apprenticeship, per-week classification overrides
- Ready for next v4.0 phase (notifications, additional state forms, or payroll import providers)

---
*Phase: 39-worker-profile-depth*
*Completed: 2026-04-02*
