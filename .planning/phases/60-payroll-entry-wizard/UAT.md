# Phase 60 — Payroll Entry Wizard UAT

Feature branch: `feat/payroll-entry-wizard`
Design spec: `docs/superpowers/specs/2026-04-22-payroll-entry-wizard-design.md`
Implementation plan: `docs/superpowers/plans/2026-04-22-payroll-entry-wizard.md`

## Scope

MVP wizard covering Steps 1-3 (roster → hours grid → review), edit mode with lock redirect, debounced save, standard-week bulk actions, paste from spreadsheet, and list-page draft badge. Detail page gets an "Edit hours" button linking to the wizard.

## Deferred (not in this release)

- **State-specific column toggles** (CA DT / CA fringe disaggregation / IL / MA / NJ). Users who need these fields can still use the detail-page data entry until the toggles ship.
- **Detail-page inline-entry cleanup.** The old inline-entry controls still exist on `PayrollWeekDetailPage`; they continue to work. Cleanup is a follow-up refactor.
- **Obsolete file cleanup.** `PayrollEntryPage.tsx` + `PayrollWeekForm.tsx` + `SamplePayrollForm.tsx` remain in the repo but are no longer reachable from the main flow.

## Test 1: Create a multi-worker week from scratch

1. Open `/projects/<pid>/payroll/new` on a project with ≥3 workers.
2. Expected: roster pre-populated from the most recent payroll week (copy-forward), OR empty if no prior weeks exist.
3. Check 3 workers. Enter payroll # 1, next Sunday as week ending.
4. Click "Next →". Expected: week created via `POST /payroll/weeks`, wizard advances to Step 2 showing 3 rows.
5. Click "Apply standard week to all". Expected: every row shows Mon-Fri 8 ST, all else 0.
6. Wait 2 seconds. Expected: one `POST /payroll/entries` per row (3 requests) fire in parallel.
7. Click "Review →". Expected: Step 3 loads compliance + summary table with gross/deductions/net per worker.
8. Click "Save & continue to compliance review". Expected: redirect to `/projects/<pid>/payroll/<weekId>` (detail page).

## Test 2: Edit an existing draft week

1. From payroll list page, find a draft week (labeled "Draft"). Click it.
2. Detail page should show an "Edit hours" button (yellow/gold) next to Download WH-347.
3. Click "Edit hours". Expected: wizard opens in Step 2 (skips roster) with existing hours pre-populated.
4. Modify one worker's Mon ST from 8 to 10. Tab out of the cell.
5. Wait 2 seconds. Expected: single `POST /payroll/entries` for that row only.
6. Click "Review →", verify the updated gross reflects the new hours.

## Test 3: Lock redirect on submitted week

1. Via detail page or direct DB update, set `isFinal=true` on a week.
2. Navigate to `/projects/<pid>/payroll/<weekId>/edit`.
3. Expected: immediate redirect to `/projects/<pid>/payroll/<weekId>` (detail page). Wizard shell never renders.

## Test 4: Concurrent-submit lock banner

1. Open wizard Step 2 for a draft week in tab A.
2. In tab B, submit the same week (patch isFinal=true via API or detail page).
3. In tab A, edit any cell. Within 2s, expect:
   - Red lock banner at top: "Payroll week was submitted"
   - All grid inputs disabled
   - "Open detail page →" link visible

## Test 5: Paste rectangular block from Excel

1. In Excel, highlight a 3-row × 5-column block (15 numeric cells).
2. Copy (Ctrl-C).
3. In wizard Step 2, focus the Mon-ST cell of the first worker. Paste (Ctrl-V).
4. Expected: 3 rows × 5 columns filled with the pasted values. Fourth row and columns 6+ untouched.
5. After 2 seconds, expect 3 `POST /payroll/entries` (one per touched row).

## Test 6: Keyboard navigation

1. Focus any cell in the grid.
2. Press `Tab`. Expected: focus advances to the next cell in the same row.
3. Press `Shift+Tab`. Expected: focus retreats.
4. Press `Enter` or `ArrowDown`. Expected: focus jumps to the same column, next row.
5. Press `ArrowUp`. Expected: focus jumps to the same column, previous row.
6. On first row `ArrowUp` should be a no-op. On last row `ArrowDown` should be a no-op.

## Test 7: Single-row "Standard" button

1. In Step 2, click the "Standard" link in any worker's name cell.
2. Expected: that row's Mon-Fri ST set to 8, all else 0. Other rows unchanged.
3. Within 2s, exactly one `POST /payroll/entries` for that row.

## Known limitations (ship anyway, fix in follow-up)

- CA double-time + disaggregated fringe fields cannot be entered from the wizard yet. Users must fall back to the detail-page inline entry for those.
- IL non-prevailing-wage hours, MA check number + all-other-hours, NJ FICA/FIT/SIT fields likewise deferred.
- If a worker was on last week's payroll but didn't work this week, unchecking them in Step 1 during edit mode does NOT zero their existing entry — it's simply excluded from the grid. The existing entry remains with its previous values. To actually zero an entry, open it on the detail page.
