---
phase: 49-ma-schema-ui
plan: "03"
subsystem: ui-forms, export-routes
tags: [ma, state-forms, project-form, payroll-form, export, state-gate]
dependency_graph:
  requires: [49-01, 49-02]
  provides: [MA-project-form-fields, MA-STATE_FORMS-registry, MA-payroll-inputs, MA-export-stub]
  affects: [ProjectForm, PayrollWeekDetailPage, PayrollWeekForm, PayrollEntryPage, export.ts]
tech_stack:
  added: []
  patterns: [STATE_FORMS-registry, isXX-boolean, state-gate-before-auth-check]
key_files:
  created: []
  modified:
    - src/client/components/projects/ProjectForm.tsx
    - src/server/routes/projects.ts
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/client/components/PayrollWeekForm.tsx
    - src/client/pages/PayrollEntryPage.tsx
    - src/server/routes/export.ts
    - tests/routes/export.test.ts
decisions:
  - isMA = stateValue?.toUpperCase() === 'MA' follows exact isCA/isWA/isIL pattern
  - assertProjectAccess called before MA state gate in export route (NFR-03)
  - MA export returns 501 (not implemented) so Phase 50 can fill in the PDF generator
  - PayrollEntryPage is the real render site for PayrollWeekForm (not PayrollWeekDetailPage)
metrics:
  duration_minutes: 25
  completed: "2026-04-09T20:26:54Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 7
---

# Phase 49 Plan 03: MA UI Wiring + Export Route Stub Summary

MA project fields, STATE_FORMS registry MA entry, payroll form MA inputs, and MA CPR export route stub with state gate — completing the full UI surface for Massachusetts phase 49.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | ProjectForm MA fields + PayrollWeekDetailPage STATE_FORMS + PayrollWeekForm MA inputs | b8515bc | ProjectForm.tsx, projects.ts, PayrollWeekDetailPage.tsx, PayrollWeekForm.tsx, PayrollEntryPage.tsx |
| 2 | Export route stub + state gate integration test | dacef23 | export.ts, export.test.ts |

## What Was Built

### Task 1: UI Forms

**ProjectForm.tsx:**
- Added `maDlsProjectId` and `maSicCode` to `CreateProjectSchema` Zod object
- Added `isMA = stateValue?.toUpperCase() === 'MA'` boolean after `isFL`
- Added conditional `{isMA && (...)}` JSX block with teal styling — MA DLS Project ID + SIC/Trade Code fields

**projects.ts (server):**
- Added `maDlsProjectId` + `maSicCode` to both `CreateProjectSchema` and `UpdateProjectSchema`
- Wired both fields into the INSERT `.values()` call
- Wired both fields into the PATCH `.set()` conditional spread

**PayrollWeekDetailPage.tsx:**
- Added `isMA = projectData?.data?.project?.state?.toUpperCase() === 'MA'` after `isFL`
- Added `MA: { downloadLabel: 'Download MA DLS Payroll', route: 'ma-cpr' }` to `STATE_FORMS` registry

**PayrollWeekForm.tsx:**
- Added `checkNumber: string`, `allOtherHours: number`, `totalWeekGrossWages: number` to `PayrollWeekFormValues` interface
- Added `isMA?: boolean` to `PayrollWeekFormProps` interface
- Added MA field defaults in `useForm` `defaultValues`
- Added conditional MA payload spread in `onSubmit` after IL `nonPwHours`
- Added `{isMA && (...)}` JSX section after IL section — Check Number, All Other Hours, Total Week Gross Wages

**PayrollEntryPage.tsx:**
- Added `isMA = projectData?.data?.project?.state?.toUpperCase() === 'MA'`
- Passed `isMA={isMA}` to `<PayrollWeekForm>` (PayrollEntryPage is the actual render site for PayrollWeekForm)

### Task 2: Export Route Stub + Tests

**export.ts:**
- Added `GET /api/export/ma-cpr/:weekId` route following exact IL pattern
- `assertProjectAccess` called before state gate (NFR-03 compliance)
- Returns 404 for unknown week, 403/401 via assertProjectAccess, 400 for non-MA project, 501 for MA project (Phase 50 stub)

**export.test.ts:**
- Added `describe('MA DLS Payroll export (MA-01)')` block with 3 tests
- Test 1: 400 for non-MA project (TX)
- Test 2: 501 for MA project (stub)
- Test 3: 404 for non-existent week ID

## Verification

- `npx tsc --noEmit`: 2 pre-existing errors only (audit.ts:56, projects.ts:140 — known implicit any, not introduced by this plan)
- `npx vitest run tests/routes/export.test.ts --exclude ".claude/**"`: 29/29 tests pass (3 new MA tests green)
- All acceptance criteria greps pass

## Deviations from Plan

### Auto-discovered: PayrollEntryPage is actual render site for PayrollWeekForm

The plan referenced `PayrollWeekDetailPage.tsx` as needing `isMA` prop threading to `PayrollWeekForm`. However, `PayrollWeekForm` is not rendered in `PayrollWeekDetailPage` — it is rendered in `PayrollEntryPage.tsx` (route: `/projects/:projectId/payroll/new`). Updated `PayrollEntryPage.tsx` instead, which is the correct render site. This is consistent with how `isIL` is already wired.

No architectural changes. Applied inline per Rule 1 (bug — plan had wrong file reference).

## Known Stubs

- `GET /api/export/ma-cpr/:weekId` returns 501 intentionally — Phase 50 will implement the PDF generator. This is a documented stub, not an accidental one. The plan's goal (state-gated route stub) is fully achieved.

## Self-Check: PASSED

- `src/client/components/projects/ProjectForm.tsx` — exists with maDlsProjectId
- `src/client/pages/PayrollWeekDetailPage.tsx` — exists with "Download MA DLS Payroll"
- `src/server/routes/export.ts` — exists with ma-cpr route
- `tests/routes/export.test.ts` — exists with MA DLS Payroll export describe block
- Commit b8515bc — confirmed in git log
- Commit dacef23 — confirmed in git log
