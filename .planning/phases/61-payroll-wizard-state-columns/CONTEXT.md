# Phase 61 — Payroll Wizard: State-Specific Column Toggles

**Depends on:** Phase 60 (payroll wizard MVP, shipped 2026-04-22)
**Originally:** Task 17 of the phase 60 plan (`docs/superpowers/plans/2026-04-22-payroll-entry-wizard.md`), deferred to keep MVP scope tight.

## Problem

The MVP wizard only supports base ST + OT hour fields per worker. Five state-specific payroll entry fields are missing from the grid — users on those projects must fall back to `PayrollWeekDetailPage` inline entry to fill them:

| State | Missing fields |
|-------|----------------|
| CA | `monDt`..`sunDt` (double-time, per Labor Code §510 thresholds) |
| CA | `fringeHealthWelfare`, `fringePension`, `fringeVacation`, `fringeTraining` (disaggregated fringe, sums must equal `fringeRateSnapshot`) |
| IL | `nonPwHours` (non-prevailing-wage hours per Phase 42) |
| MA | `checkNumber`, `allOtherHours`, `totalWeekGrossWages` (per Phase 49) |
| NJ | `ficaTax`, `federalIncomeTax`, `stateIncomeTax` (per Phase 52) |

All fields already exist in the `payrollEntries` schema and `UpsertEntrySchema` (see `src/server/routes/payroll.ts:46`). The backend accepts them — the wizard UI simply doesn't expose them yet.

## Goal

Progressive-disclosure toggle chips above the grid (visible only when the project's state matches) that reveal the extra columns when clicked. Default collapsed. State-specific fields save as their schema-defined default when toggle is collapsed:

- CA DT: zero (all 7 day fields)
- CA fringe disaggregation: null (per schema)
- IL / MA / NJ fields: null

## Scope

**Files to modify:**
- `src/client/components/payrollWizard/Step2BulkActions.tsx` — add `StateToggles` interface + per-state toggle chips
- `src/client/components/payrollWizard/Step2GridRow.tsx` — extend `RowValues` with all optional fields; render extra `<td>` cells conditionally
- `src/client/components/payrollWizard/Step2HoursGrid.tsx` — hold toggle state, add matching conditional `<th>` header cells
- `src/client/components/payrollWizard/PayrollWizard.tsx` — pass `projectState` prop + the current row payload to `useEntryMutation` includes all optional fields
- `src/client/components/payrollWizard/useEntryMutation.ts` — include all state-specific fields in POST body

**Not in scope:**
- Changing the validation contract on `POST /payroll/entries` — the schema already accepts all these fields
- CA daily-OT/DT computation (that's `complianceService` — already implemented in Phase 60's parent session's CA rules commit)

## Open Decisions

- **Summing CA disaggregated fringe to `fringeRateSnapshot`:** MVP spec said the four component fields sum to the snapshot. Should the UI lock the snapshot field read-only when CA fringe toggle is active, or let users type both? Recommend read-only with live sum (matches existing `PayrollWeekForm` behavior at lines 108-114 of its pre-deletion version — see commit `0d8c283` for history).
- **Toggle persistence:** remember open/closed state across sessions (localStorage?) or re-collapse every visit? Lean toward session-local only — no persistence needed for MVP.
- **Concurrent toggles:** user opens CA DT + CA fringe simultaneously → grid becomes very wide. Horizontal scroll is already handled by the `overflow-x-auto` wrapper. Confirm under load before adding virtualization.

## Success Criteria

- CA project user can enter DT hours + disaggregated fringe from the wizard without touching the detail page
- Default-collapsed state means non-CA users don't see irrelevant columns
- Saved entries reach the DB with exactly the schema-defined field values (zero for collapsed numeric CA DT, null for collapsed nullable fields)
- No regression on Phase 60 UAT tests 1-7 (wizard creation/edit/lock/paste/keyboard nav)

## Artifacts

**Existing work to reference:**
- Phase 60 spec: `docs/superpowers/specs/2026-04-22-payroll-entry-wizard-design.md` (Step 2 section explicitly describes toggle UX)
- Phase 60 plan Task 17: `docs/superpowers/plans/2026-04-22-payroll-entry-wizard.md` (has full verbatim code for header/chip/cell pattern)
- Old `PayrollWeekForm` (deleted in `0d8c283`): can `git show 0d8c283~:src/client/components/PayrollWeekForm.tsx` for reference on CA fringe live-sum pattern
