---
phase: 120-apprenticeship-enforcement-suite
plan: 01
subsystem: compliance-ui-tests
tags: [apprenticeship, compliance, ui, vitest, comp-04, comp-05]
dependency_graph:
  requires: [117-apprenticeship-dashboard]
  provides: [APP-02, APP-03, APP-04, APP-05]
  affects: [WorkersPage, PayrollWeekDetailPage, complianceService.test]
tech_stack:
  added: []
  patterns: [conditional-form-fields, structured-violation-rendering, supertest-seed-pattern]
key_files:
  created: []
  modified:
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
    - tests/services/complianceService.test.ts
decisions:
  - WA branch input IDs use add-wa- prefix to avoid duplicate-id conflicts with hasWd branch (add-apprenticeship-program-name / add-rapids-number)
  - COMP-04 structured render uses ?? 0 nullish coalescing for excessHours/estimatedLiabilityUsd (optional fields in WeekViolation interface, always set by COMP-04 emitter)
  - Non-COMP-04 violations (COMP-03 apprentice-ratio and COMP-05 ira-iija-apprentice-pct) intentionally fall through to flat wv.detail span per RESEARCH Pitfall 3
  - seedProjectWithApprenticeshipConfig uses != null check (not !== undefined) so null apprenticeshipRequirements omits the field from POST body (Zod z.string().optional() rejects null)
metrics:
  duration_seconds: 196
  completed_date: "2026-04-29"
  tasks_completed: 3
  files_modified: 3
---

# Phase 120 Plan 01: Apprenticeship Enforcement Suite Summary

**One-liner:** WA add-worker apprenticeship fields (parity with hasWd), structured COMP-04 violation rendering at both PayrollWeekDetailPage sites, and 6 Vitest cases locking COMP-04/COMP-05 behavior.

## What Was Built

### Task 1: WA Add-Worker Form Parity (APP-02)

`src/client/pages/WorkersPage.tsx` — Inserted two new conditional JSX blocks immediately after the WA-branch `apprenticePercent` input (line ~1402). Both are gated on `form.laborType === 'apprentice'` matching the hasWd branch pattern. IDs use `add-wa-` prefix (`add-wa-apprenticeship-program-name`, `add-wa-rapids-number`) to prevent duplicate HTML id attributes with the hasWd branch. Apprenticeship Program Name uses `col-span-2` for full-width layout; RAPIDS Number uses single-column. Both bind to existing `form.apprenticeshipProgramName` and `form.rapidsNumber` state — no changes to `blankWorkerForm()` or the mutation handler.

### Task 2: Structured COMP-04 Violation Rendering (APP-05)

`src/client/pages/PayrollWeekDetailPage.tsx` — Replaced the flat `<span>{wv.detail}</span>` with a conditional ternary at **both** render sites (main violations panel ~line 1779, WH-347 preflight modal ~line 3357). When `wv.violationType === 'apprentice-trade-ratio' && wv.trade`, renders: bold trade name, apprentice hrs, JW hrs, max-allowed hrs, excess hrs, and estimated dollar liability. All other violation types (COMP-03 apprentice-ratio, COMP-05 ira-iija-apprentice-pct) fall through to the original `<span>{wv.detail}</span>`.

### Task 3: COMP-04 + COMP-05 Vitest Coverage (APP-03/APP-04)

`tests/services/complianceService.test.ts` — Added `seedProjectWithApprenticeshipConfig` helper before the `describe` block. Added 6 tests at the end of the `describe('computeCompliance', ...)` block:

**COMP-04 (3 cases):**
- Fires when 20 apprentice hrs exceed 1:2 ratio (10 max) — asserts trade='Electrician', excessHours≈10, estimatedLiabilityUsd≈150
- No violation at exactly 10 apprentice hrs (at limit)
- No violation when `apprenticeshipRequirements` is null (config absent)

**COMP-05 (3 cases):**
- Fires when IRA/IIJA project has 5/95 hrs = 5.3% (below 15%) — asserts actualPct < 0.15, apprenticeHours=5, totalHours=95
- No violation when 10/60 hrs = 16.7% (above 15%)
- No violation when `isIraIijaProject = false`

## Test Count Delta

849 → 855 tests passing, 0 failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed null passed to Zod z.string().optional() in POST /api/projects**
- **Found during:** Task 3 test run
- **Issue:** Plan's `seedProjectWithApprenticeshipConfig` used `opts.apprenticeshipRequirements !== undefined` guard, which passes `null` to the POST body when the caller passes `{ apprenticeshipRequirements: null }`. The POST schema's `z.string().optional()` rejects `null` (accepts only `string | undefined`), causing project creation to fail and `computeCompliance` to return `null` (week not found).
- **Fix:** Changed guard from `!== undefined` to `!= null` so null values omit the field from the request body entirely.
- **Files modified:** tests/services/complianceService.test.ts
- **Commit:** 4bd2d84

## Phase 120 Status

All 5 requirements shipped end-to-end:
- APP-01: Already shipped (ProjectForm Apprenticeship Ratios section)
- APP-02: This plan — WA add-form inputs
- APP-03: Already shipped server-side + this plan test coverage (3 COMP-04 cases)
- APP-04: Already shipped server-side + this plan test coverage (3 COMP-05 cases)
- APP-05: This plan — structured COMP-04 rendering at both PayrollWeekDetailPage sites

## Pitfalls Avoided

- **Duplicate id attributes:** Used `add-wa-` prefix distinguishing WA branch from hasWd branch IDs
- **Two render sites:** Updated both weekViolations?.map occurrences (verified by grep returning exactly 2)
- **Trade description matching:** Test uses `tradeDescription: 'Electrician'` matching config key `'Electrician'` per COMP-04 case-insensitive partial match logic (RESEARCH Pitfall 4)
- **wv.detail fallback:** COMP-03 and COMP-05 violations retain flat string render — only COMP-04 gets structured row

## Known Stubs

None — all three tasks are fully wired with real data.

## Next Phase

Phase 121: QuickBooks Employee + Time Import

## Self-Check: PASSED

- `src/client/pages/WorkersPage.tsx` — modified (30 insertions)
- `src/client/pages/PayrollWeekDetailPage.tsx` — modified (24 insertions, 2 deletions)
- `tests/services/complianceService.test.ts` — modified (254 insertions)
- Task commits: 4ce749f, 36d8149, 4bd2d84
- Full suite: 855 tests passing, 0 failures
- TypeScript: 0 errors
