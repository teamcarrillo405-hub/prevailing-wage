---
phase: 41-ny-state-forms
plan: "04"
slug: export-routes-and-tests
subsystem: api
tags: [ny-state, export, pdf, xml, routes, integration-tests]

# Dependency graph
requires:
  - phase: 41-ny-state-forms plan 02
    provides: generateMpwrXml, MpwrXmlInput
  - phase: 41-ny-state-forms plan 03
    provides: fillPw12, Pw12Input

provides:
  - GET /api/export/pw12/:weekId — PW-12 PDF download for NY projects
  - GET /api/export/ny-mpwr-xml/:weekId — MPWR XML download for NY projects
  - PATCH /api/payroll/weeks/:id/ny-submit — sets nyMpwrSubmittedAt on payroll week
  - setNyMpwrSubmitted() service function

affects: [41-05, ny-state-forms-ui-modal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NY state gate: project.state?.toUpperCase() !== 'NY' → 400
    - assertProjectAccess before data access (NFR-03)
    - Best-effort audit log via dynamic import (AUDIT-03)
    - follows ecpr-xml / wa-cpr-xml / ca-ecpr-submit / wa-lni-submit patterns exactly

key-files:
  created: []
  modified:
    - src/server/routes/export.ts
    - src/server/routes/payroll.ts
    - src/server/services/payrollService.ts
    - tests/routes/export.test.ts
    - tests/routes/payroll.test.ts

key-decisions:
  - "No agency_submissions table insert — existing CA/WA submit routes only update the payrollWeeks timestamp column; followed the actual code pattern rather than plan description"
  - "State gate uses toUpperCase() === 'NY' for case-insensitive comparison"
  - "nyprcNumber and nysContractorRegNumber are first-class schema columns on projects — no (project as any) cast needed"

requirements-completed: [STATE-02, STATE-03, STATE-05, NFR-03]

# Metrics
duration: 15min
completed: 2026-04-06
---

# Phase 41 Plan 04: Export Routes and Tests Summary

**NY PW-12 PDF and MPWR XML export routes wired to generators with NY state gate, assertProjectAccess (NFR-03), and audit logs; ny-submit PATCH route sets nyMpwrSubmittedAt; 9 integration tests all passing.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-06T19:55:00Z
- **Completed:** 2026-04-06T20:09:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `GET /api/export/pw12/:weekId` — assertProjectAccess + NY state gate + fillPw12() + PDF download + best-effort audit log
- `GET /api/export/ny-mpwr-xml/:weekId` — same pattern + generateMpwrXml() + XML download
- `setNyMpwrSubmitted()` added to payrollService.ts — follows setCaEcprSubmitted exactly
- `PATCH /api/payroll/weeks/:id/ny-submit` — assertProjectAccess + setNyMpwrSubmitted + audit log
- 9 new integration tests: 3 for pw12, 3 for ny-mpwr-xml, 3 for ny-submit — all passing

## Task Commits

1. **Task 1: PW-12 and MPWR XML export routes** — `99fce54`
2. **Task 2: NY MPWR submit route and service** — `b741b63`
3. **Task 3: Integration tests** — `c169a67`

## Files Created/Modified

- `src/server/routes/export.ts` — added imports (fillPw12, generateMpwrXml) and two new routes
- `src/server/routes/payroll.ts` — added import (setNyMpwrSubmitted) and PATCH /ny-submit route
- `src/server/services/payrollService.ts` — added setNyMpwrSubmitted()
- `tests/routes/export.test.ts` — added 6 new test cases (pw12 + ny-mpwr-xml)
- `tests/routes/payroll.test.ts` — added 3 new test cases (ny-submit)

## Decisions Made

- No `agency_submissions` table insert: the plan mentioned this but the actual CA/WA code pattern only updates the `payrollWeeks` timestamp column. Followed the existing code, not the plan description.
- `project.state?.toUpperCase() !== 'NY'` — case-insensitive guard per plan instruction
- `nyprcNumber` and `nysContractorRegNumber` accessed as first-class typed fields (confirmed in schema.ts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] agency_submissions table does not exist**
- **Found during:** Task 2
- **Issue:** Plan said to insert an agency_submissions row with `agency: 'NY_MPWR'`, but no such table exists in schema.ts. CA/WA submit routes only update payrollWeeks timestamp.
- **Fix:** Followed the actual setCaEcprSubmitted / setWaLniSubmitted code pattern — only set `nyMpwrSubmittedAt` on the payrollWeek. Audit log still records `agency_submission.created` with `meta: { agency: 'NY_MPWR' }`.
- **Files modified:** src/server/routes/payroll.ts

## Known Stubs

None — all routes call real generators and return real data.

## Self-Check: PASSED

- `src/server/routes/export.ts` — FOUND (contains pw12 and ny-mpwr-xml routes)
- `src/server/routes/payroll.ts` — FOUND (contains ny-submit route)
- `src/server/services/payrollService.ts` — FOUND (contains setNyMpwrSubmitted)
- `tests/routes/export.test.ts` — FOUND (contains pw12 tests)
- `tests/routes/payroll.test.ts` — FOUND (contains ny-submit tests)
- Commits 99fce54, b741b63, c169a67 — all present in git log
- TypeScript: only pre-existing errors in unrelated files (audit.ts, projects.ts)
- 9/9 new integration tests passing

---
*Phase: 41-ny-state-forms*
*Completed: 2026-04-06*
