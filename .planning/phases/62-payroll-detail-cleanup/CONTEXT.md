# Phase 62 — Payroll Week Detail Page: Remove Inline Data Entry

**Depends on:** Phase 60 (payroll wizard MVP, shipped 2026-04-22) + Phase 61 (state-specific column toggles, if shipped before 62)
**Originally:** Task 20 of the phase 60 plan (`docs/superpowers/plans/2026-04-22-payroll-entry-wizard.md`), deferred for risk-managed refactor.

## Problem

`src/client/pages/PayrollWeekDetailPage.tsx` is currently 2,948 lines because it tries to be three pages at once:

1. **Data entry surface** — inline hour inputs per worker (now redundant with wizard)
2. **Compliance review** — violations display, green-light certification
3. **Agency submission tracking** — WH-347 PDF, CA eCPR, WA L&I, NY MPWR, IL IDOL, TX CPR submit buttons + status

Phase 60 added the wizard for (1), but did not remove the inline data entry from the detail page. Both paths still work. Users have two different-looking ways to edit hours, which is confusing and bloats the codebase.

## Goal

Reduce `PayrollWeekDetailPage` to its intended role: compliance view + certification + submission tracking + WH-347 generation. Remove the ~800-1,200 lines of inline data-entry JSX, form state, mutations, and validation.

After this phase, the file should be <2,000 lines (estimated ~1,700-2,100 depending on how aggressive we are about extracting remaining substructure).

## Scope

**Files to modify:**
- `src/client/pages/PayrollWeekDetailPage.tsx` — primary refactor target

**Sections to preserve (do NOT touch):**
- WH-347 download button + related generation flow
- State-form primary download button (`stateFormConfig` registry pattern at ~line 1035)
- CA eCPR submit workflow + status badges
- WA L&I, NY MPWR, IL IDOL, TX CPR submit buttons
- Amendment creation flow (the "Amend" button that posts to `/weeks/amend`)
- Compliance violations display + red/yellow cards
- Summary table (gross/net totals per worker)
- "Edit hours" button that links to the wizard edit route (added in Phase 60 commit `8904f16`)

**Sections to remove:**
- Per-worker hour input fields + day columns
- `useForm`/`register`/`setValue`/`handleSubmit` hooks attached to entry editing
- Any state setters that call `POST /api/payroll/entries` or `PUT /api/payroll/entries/:id` — those are now wizard-only
- Per-row "Save" buttons inside the entry area
- Inline validation for hour inputs

## Risk

High. This is surgical removal from the largest file in the codebase. Breaking compliance display or submission tracking would be a significant regression. Concrete mitigations:

1. Before any deletion, screenshot / export the current page behavior for a draft week and a submitted week.
2. Manual UAT after each chunk: can still view compliance? still download WH-347? still submit CA eCPR?
3. Keep a local `git diff --stat` running to confirm only `PayrollWeekDetailPage.tsx` changes.
4. Run the existing `tests/routes/payroll.test.ts` + `tests/services/complianceService.test.ts` after every commit — server-side behavior must stay unchanged.

## Execution Notes

- `grep -n "useForm\|register\|setValue\|handleSubmit\|input type=.number" src/client/pages/PayrollWeekDetailPage.tsx` is the starting map. The noise in that output tells you the blast radius.
- Some callers may be split between entry and submission (e.g., a single `useForm` that handles both hours AND submission metadata). Unwind carefully — don't delete a hook that's also feeding the submit flow.
- Extracting the remaining submission logic into `PayrollWeekDetailPage/` sub-components is a valid followup but not required. YAGNI until the file is under 2,000 lines.

## Success Criteria

- `PayrollWeekDetailPage.tsx` line count < 2,000
- All existing compliance + submission + amendment UAT paths continue to work
- No new `POST /api/payroll/entries` calls from this page — all entry edits route through the wizard
- Zero new typecheck errors
- `tests/routes/payroll.test.ts` + `tests/services/complianceService.test.ts` still pass

## Artifacts

- Phase 60 commit that added the wizard edit link: `8904f16`
- Phase 60 commit that deleted the old PayrollEntryPage/PayrollWeekForm: `0d8c283` — its deletion pattern + usage-grep technique applies here
- Wizard source for reference on which endpoints the entry flow now uses: `src/client/components/payrollWizard/useEntryMutation.ts`
