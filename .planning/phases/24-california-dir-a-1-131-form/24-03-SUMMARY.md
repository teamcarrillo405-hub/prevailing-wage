---
phase: 24-california-dir-a-1-131-form
plan: "03"
subsystem: export
tags: [pdf-generation, california, a1131, compliance, frontend]
dependency_graph:
  requires: [24-01, 24-02]
  provides: [fillA1131, GET /api/export/a1131/:weekId, CA download button, eCPR preflight modal]
  affects: [PayrollWeekDetailPage, export routes, CAL-02]
tech_stack:
  added: []
  patterns: [pdf-lib coordinate overlay, state-gated route, persistent disclosure modal, blob download]
key_files:
  created:
    - src/server/services/a1131Generator.ts
  modified:
    - src/server/routes/export.ts
    - src/client/pages/PayrollWeekDetailPage.tsx
    - tests/services/a1131.test.ts
    - tests/routes/export.test.ts
decisions:
  - "A-1-131 PDF is 612x1008 pt (legal 8.5x14), not 8.5x11 — coordinates calibrated accordingly"
  - "fringeCredit kept separate from totalDeductions as required by CA DIR form structure"
  - "eCPR modal shown unconditionally on every CA download click (regulatory disclosure, not violation warning)"
  - "caGeneratingRef is separate from generatingRef to prevent WH-347 interference"
  - "CSLB/WC missing shows advisory in modal (non-blocking) — user can still download"
metrics:
  duration: "~15min"
  completed: "2026-03-24T22:01:00Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 4
requirements_satisfied: [CAL-02]
---

# Phase 24 Plan 03: A-1-131 PDF Generation End-to-End Summary

**One-liner:** California A-1-131 PDF generator (pdf-lib coordinate overlay on 8.5x14 legal form) with state-gated export route and persistent eCPR regulatory disclosure modal.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | A-1-131 generator + export route + CAL-02 tests GREEN | 2345b54 | a1131Generator.ts, export.ts, a1131.test.ts, export.test.ts |
| 2 | CA download button + eCPR preflight modal | 051c2c1 | PayrollWeekDetailPage.tsx |

## Task 3: Awaiting Browser Verification

Task 3 is a `checkpoint:human-verify` — browser verification of the complete CA A-1-131 flow is required before plan can be marked complete.

## What Was Built

### 1. `src/server/services/a1131Generator.ts`

PDF generator using pdf-lib coordinate overlay on the official DIR A-1-131 template:
- Exports `fillA1131()`, `A1131Data`, `A1131WorkerRow`
- Correct day order: Sun, Mon, Tue, Wed, Thu, Fri, Sat (Sunday FIRST per CA form)
- Three rows per worker: ST / OT / DT
- `fringeCredit` is a separate field — NOT included in `totalDeductions`
- CSLB license and WC policy number in header section
- Multi-page support: 5 workers per page, `copyPages()` before filling
- PDF page dimensions: 612x1008 pt (portrait legal, not letter)

### 2. `src/server/routes/export.ts`

Added `GET /api/export/a1131/:weekId` route:
- State gate: returns 400 for non-CA projects
- Ownership check: returns 403 for wrong user
- Maps `getPayrollEntries()` result to `A1131WorkerRow[]` with DT fields
- Loads `assets/a1131-official.pdf` template, calls `fillA1131()`, streams PDF download
- Filename: `a1131-{payrollNumber}.pdf` or `a1131-{payrollNumber}-amended-{N}.pdf`

### 3. `src/client/pages/PayrollWeekDetailPage.tsx`

CA-specific UI additions:
- `useQuery` for project data (state, cslbLicense, wcPolicyNumber) gated on `weekData?.week.projectId`
- `isCA = project.state === 'CA'` controls all CA-specific UI visibility
- `showCaDisclosure` state + `caGeneratingRef` (separate from WH-347's `generatingRef`)
- "Download CA A-1-131" button: `{isCA && weekId && (<Button ...>)}`
- eCPR disclosure modal: shown on EVERY CA download click (persistent regulatory disclosure)
- Modal contains link to `efiling.dir.ca.gov/eCPR`
- Advisory warning in modal when CSLB or WC fields are missing (non-blocking)
- `handleCaConfirmedDownload`: fetch → blob → createObjectURL → click → revokeObjectURL (100ms)

## Test Results

- `tests/services/a1131.test.ts`: 7 tests passing
- `tests/routes/export.test.ts`: 5 tests passing (replaced 3 RED stubs with 5 real tests)
- `tests/services/wh347.test.ts`: 15 tests passing (no regression)
- Full suite: 250 tests passing, 42 todo, 7 skipped — no regressions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A-1-131 page dimensions are 612x1008 (legal), not 612x792 (letter)**
- **Found during:** Task 1 CRITICAL FIRST STEP — measured actual PDF dimensions
- **Issue:** Research notes said "Portrait 8.5x11 (612x792 pt)" but the official PDF is 8.5x14 (612x1008 pt)
- **Fix:** Calibrated all field coordinates for 1008 pt tall pages (not 792 pt)
- **Files modified:** src/server/services/a1131Generator.ts
- **Commit:** 2345b54

## Self-Check: PASSED

- FOUND: src/server/services/a1131Generator.ts
- FOUND: src/server/routes/export.ts
- FOUND: src/client/pages/PayrollWeekDetailPage.tsx
- FOUND: .planning/phases/24-california-dir-a-1-131-form/24-03-SUMMARY.md
- FOUND: commit 2345b54 (Task 1)
- FOUND: commit 051c2c1 (Task 2)
- 250 tests passing, 0 new failures
