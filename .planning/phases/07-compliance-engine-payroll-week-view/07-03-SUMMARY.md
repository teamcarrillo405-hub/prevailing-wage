---
phase: 07-compliance-engine-payroll-week-view
plan: 03
subsystem: ui
tags: [react, tanstack-query, tailwindcss, compliance, payroll, wh347]

# Dependency graph
requires:
  - phase: 07-02
    provides: "complianceService.ts and GET /api/compliance/:weekId route"
  - phase: 07-01
    provides: "payroll week detail route GET /api/payroll/weeks/:id returning week + entries"
provides:
  - "PayrollWeekDetailPage React component at /projects/:projectId/payroll/:weekId"
  - "Entries table with inline violation badges per entry row"
  - "Compliance violations panel with worker-level detail"
  - "Plain anchor WH-347 download to /api/export/wh347/:weekId"
affects:
  - "07-04 — route registration in App.tsx will import and wire this component"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two parallel React Query calls in a single page (payroll-week + compliance)"
    - "Map<entryId, violation> for O(1) per-row badge lookup"
    - "Plain <a href> anchor for server-side file download — no JavaScript fetch"

key-files:
  created:
    - src/client/pages/PayrollWeekDetailPage.tsx
  modified: []

key-decisions:
  - "WH-347 download is a plain <a href> anchor — browser handles Content-Disposition attachment natively"
  - "Violation lookup uses Map<entryId, violation> built from complianceData.violations before render"
  - "grossWages null shows dash in table and suppresses violation badge (compliance engine skips null entries)"

patterns-established:
  - "Parallel useQuery calls: each has its own isLoading/isError; combined loading = either loading"
  - "Status cell pattern: Map lookup from parallel query, then conditional badge render"

requirements-completed: [WH347-03, WH347-04]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 7 Plan 03: PayrollWeekDetailPage Summary

**React page with entries table, per-row violation badges, compliance panel, and plain-anchor WH-347 download wired to two parallel React Query calls**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T16:12:40Z
- **Completed:** 2026-03-20T16:16:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created PayrollWeekDetailPage.tsx with full TypeScript interfaces inline
- Entries table shows worker name, trade, hours (ST/OT totals), base rate, fringe rate, gross wages, and status badge
- Compliance violations panel below entries table lists worker name, violation type, expected/actual/delta amounts
- WH-347 download is a plain `<a href="/api/export/wh347/:weekId">` anchor — no JavaScript logic
- Loading spinner and error state render correctly for either query failure

## Task Commits

Each task was committed atomically:

1. **Task 1: PayrollWeekDetailPage.tsx — entries table + violations panel + WH-347 anchor** - `c535ac8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/client/pages/PayrollWeekDetailPage.tsx` - Payroll week detail view with compliance violations and WH-347 download anchor

## Decisions Made
- WH-347 download is a plain `<a href>` anchor — no JavaScript. Browser handles the Content-Disposition: attachment response from the server automatically.
- Built a `Map<entryId, ComplianceViolation>` from the compliance query result before render to enable O(1) per-row badge lookup without nested .find() on every row.
- Null grossWages shows "—" and suppresses any violation badge — consistent with compliance engine behavior (entries without grossWages are skipped).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The only TypeScript errors observed are pre-existing in `src/server/routes/workers.ts` (lines 109/116, implicit any) — documented in STATE.md decisions as non-fatal.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PayrollWeekDetailPage.tsx is ready to import and route
- Plan 04 will register the route in App.tsx at /projects/:projectId/payroll/:weekId
- No blockers

---
*Phase: 07-compliance-engine-payroll-week-view*
*Completed: 2026-03-20*
