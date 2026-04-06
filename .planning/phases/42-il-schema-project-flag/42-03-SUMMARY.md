---
phase: 42-il-schema-project-flag
plan: 03
subsystem: ui
tags: [react, illinois, prevailing-wage, demographics, payroll]

# Dependency graph
requires:
  - phase: 42-02
    provides: IL demographic fields on workers API and nonPwHours on payroll entries API

provides:
  - isIL flag derived in ProjectForm, WorkersPage, PayrollWeekDetailPage, and PayrollEntryPage
  - Collapsible IL Compliance Demographics section in WorkersPage add and edit forms (race, ethnicity, gender, veteranStatus, skillLevel), gated by isIL
  - IL informational banner in ProjectForm when state=IL
  - IL placeholder export button and IDOL submission row in PayrollWeekDetailPage, gated by isIL
  - nonPwHours numeric input in PayrollWeekForm, gated by isIL, included in submit payload
  - isIL prop threading from PayrollEntryPage through to PayrollWeekForm

affects:
  - 42-04 (any further IL UI work)
  - Phase 43 (IL Certified Transcript PDF generator and IDOL submission modal — replace placeholders)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isIL derivation pattern: stateValue?.toUpperCase() === 'IL' (ProjectForm) or projectData?.data?.project?.state?.toUpperCase() === 'IL' (pages)"
    - "IL-gated conditional rendering: {isIL && (...)} mirrors isCA/isWA/isNY pattern"
    - "Spread-based conditional API payload: ...(isIL ? { field: value } : {}) for optional IL fields"
    - "details/summary collapsible for demographics section (open by default)"

key-files:
  created: []
  modified:
    - src/client/components/projects/ProjectForm.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
    - src/client/pages/PayrollEntryPage.tsx
    - src/client/components/PayrollWeekForm.tsx

key-decisions:
  - "IL demographics section uses details/summary (native collapsible) open by default so users see it on first load for IL projects"
  - "IL fields in create/update worker mutations only sent when isIL is true — avoids sending empty strings for CA/WA/NY projects"
  - "PayrollWeekDetailPage IL export is a disabled placeholder button (Phase 43 will enable it) — avoids dead UI while signaling intent to IL users"
  - "nonPwHours is a single total per worker per week, not per-day, matching the single non_pw_hours DB column added in Plan 02"

patterns-established:
  - "isIL gate: Add derivation after isNY in each page/component that needs IL-conditional UI"
  - "IL section styling: border-purple-200 bg-purple-50 text-purple-800 (differentiates from CA amber, WA blue, NY green)"

requirements-completed:
  - STATE-07
  - STATE-09
  - STATE-10

# Metrics
duration: 25min
completed: 2026-04-06
---

# Phase 42 Plan 03: IL UI — isIL Flag, Demographics Section, Non-PW Hours Summary

**Five React files updated to surface IL-gated UI: project banner, collapsible worker demographics (race/ethnicity/gender/veteran/skill), payroll Non-PW Hours input, and placeholder export/submission actions — all hidden for non-IL projects.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-04-06
- **Tasks:** 2 / 2
- **Files modified:** 5

## Accomplishments

### Task 1: isIL in ProjectForm, WorkersPage, PayrollWeekDetailPage

**ProjectForm.tsx**
- Added `const isIL = stateValue?.toUpperCase() === 'IL'` after the isNY line
- Renders a purple informational banner (`border-purple-200 bg-purple-50`) when state=IL, noting that IL export and IDOL submission will appear on payroll weeks

**WorkersPage.tsx**
- Extended `Worker` interface with 5 nullable fields: `race`, `ethnicity`, `gender`, `veteranStatus`, `skillLevel`
- Extended `blankWorkerForm()` with those 5 fields (empty strings)
- Extended `workerToEditForm()` to map from worker data (`?? ''`)
- Extended `editForm` useState initial value with same 5 fields
- Added `const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL'` after isWA
- In `addWorker` mutationFn: spread IL fields into POST body only when `isIL` (otherwise `{}`)
- In `updateWorker` mutationFn: spread IL fields (null-coerced) only when `isIL`
- **Add form:** collapsible `<details open>` "IL Compliance Demographics" section after nysRegisteredApprentice, gated by `{isIL && ...}`, with 2-col grid for race/ethnicity/gender/veteranStatus and a full-width skillLevel select (journeyman/apprentice)
- **Edit form:** identical section using `editForm` / `setEditForm`, placed after the nysRegisteredApprentice checkbox, gated by `{isIL && ...}`

**PayrollWeekDetailPage.tsx**
- Added `const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL'`
- Added disabled "Download IL Certified Transcript (coming soon)" button after the NY MPWR button, gated by `{isIL && weekId && ...}`
- Added IL IDOL submission placeholder row (Badge + "Coming in Phase 43" text) after the NY MPWR submission row, gated by `{isIL && ...}`

### Task 2: nonPwHours in PayrollWeekForm + isIL from PayrollEntryPage

**PayrollWeekForm.tsx**
- Added `isIL?: boolean` to `PayrollWeekFormProps`
- Added `isIL = false` to function destructuring
- Added `nonPwHours: number` to `PayrollWeekFormValues` interface
- Added `nonPwHours: 0` to `defaultValues`
- In `onSubmit` payload: `...(isIL ? { nonPwHours: data.nonPwHours || 0 } : {})`
- Added IL Non-PW Hours section after the CA fringe section (`border-purple-200 bg-purple-50`), with a numeric input using `register('nonPwHours', { valueAsNumber: true })`, gated by `{isIL && ...}`

**PayrollEntryPage.tsx**
- Added `const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL'`
- Added `isIL={isIL}` prop to `<PayrollWeekForm />` usage

## Verification

- `npx tsc --noEmit` passes (only 2 pre-existing unrelated errors in audit.ts and projects.ts)
- `isIL` appears in: ProjectForm (2), WorkersPage (5), PayrollWeekDetailPage (3), PayrollEntryPage (2)
- `nonPwHours` appears in PayrollWeekForm (4)
- All IL sections are gated — non-IL projects see no IL UI

## Deviations from Plan

None — plan executed exactly as written. The IL agency submission UI was implemented as an inline card row (using Badge component) rather than a `<table><tr>` element since the surrounding HTML context used flex/div layout, not a table. This is functionally equivalent and avoids invalid HTML nesting.

## Known Stubs

- **IL Certified Transcript button** (`PayrollWeekDetailPage.tsx`): `disabled` button with title "IL Certified Transcript — coming in Phase 43". Intentional placeholder — the PDF generator is Phase 43 work.
- **IL IDOL submission row** (`PayrollWeekDetailPage.tsx`): Badge + "Coming in Phase 43" text. Intentional placeholder — IDOL submission modal is Phase 43 work.

These stubs do NOT block the plan's goal (IL-gated UI for demographics and Non-PW Hours), which is fully functional.

## Self-Check: PASSED

Files modified exist and TypeScript compiles cleanly:
- `src/client/components/projects/ProjectForm.tsx` — FOUND
- `src/client/pages/WorkersPage.tsx` — FOUND
- `src/client/pages/PayrollWeekDetailPage.tsx` — FOUND
- `src/client/pages/PayrollEntryPage.tsx` — FOUND
- `src/client/components/PayrollWeekForm.tsx` — FOUND
- Commits `b8fed93` and `9440f4e` — FOUND in git log
