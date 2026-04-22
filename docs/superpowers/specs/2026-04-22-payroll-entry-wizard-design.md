# Payroll Entry Wizard — Design

**Date:** 2026-04-22
**Status:** Design approved, ready for implementation plan
**Replaces:** `PayrollEntryPage` + `PayrollWeekForm` (single-worker placeholder)
**Related:** `.planning/ROADMAP-v6.md` (deferred from session 2026-04-22_10-45)

## Motivation

The current "new payroll week" flow is half-built. `PayrollWeekForm` hardcodes `firstWorker = workers[0]` (see `src/client/components/PayrollWeekForm.tsx:78-80`), so creating a multi-worker payroll requires using the 2,938-line `PayrollWeekDetailPage` as a data entry surface after week creation. That page was designed for viewing compliance results and managing agency submissions — it grew into an entry editor by accident, and the entry UX suffers for it.

The wizard captures weekly payroll data through a dedicated three-step flow with keyboard-first spreadsheet-style entry, shrinking `PayrollWeekDetailPage` back to its intended role (compliance + certify + submit).

## Goals

1. Enter hours for N workers in a single flow without leaving the page.
2. Match contractor muscle memory — spreadsheet-grade keyboard navigation, paste-from-Excel, bulk actions.
3. Preserve existing server behavior. No new endpoints, no schema changes.
4. Shrink `PayrollWeekDetailPage` to its real scope by removing inline data entry.

## Non-goals

- Amendment logic. Amendment stays on the detail page; it creates an amended copy, then redirects to `/edit` which enters wizard edit mode on that copy.
- WH-347 generation, CA eCPR/WA L&I/NY MPWR/IL IDOL/TX CPR submission tracking. All remain on the detail page.
- Bulk-upload CSV import. Orthogonal feature, out of scope.
- Mobile-first design. Wizard targets desktop/tablet; mobile viewing of existing weeks still works via detail page.
- Orphan draft-week cleanup. A janitor for abandoned `isFinal=false` weeks with zero entries is a separate follow-up.

## Routes & Entry Points

| Route | Mode | Replaces |
|-------|------|----------|
| `/projects/:projectId/payroll/new` | Create | `PayrollEntryPage` |
| `/projects/:projectId/payroll/:weekId/edit` | Edit | (new — replaces inline editing on detail page) |
| `/projects/:projectId/payroll/:weekId` | View / compliance / submit | `PayrollWeekDetailPage` (data-entry parts removed) |

Edit-mode entry is a new "Edit hours" button on the detail page. If the week is `isFinal=true`, the button instead opens the existing amendment flow, which creates an amended copy via `POST /weeks/amend`, then redirects to `/payroll/:newWeekId/edit`.

## UX — Three Steps

### Step 1: Confirm Roster

- Week metadata: `weekEndingDate` (date picker, default = next Sunday), `payrollNumber` (default = `max(existing) + 1` for this project).
- Roster area: checkboxes for workers, pre-populated from the project's most recent payroll week (copy-forward). Each row shows worker name + classification + baseRate preview (read-only).
- First-week-for-project fallback: all project workers listed, unchecked by default.
- "Add a worker" button → modal picker from project roster (minus already-listed).
- "Next →" enabled only if ≥1 worker checked AND `weekEndingDate` and `payrollNumber` are valid.
- On "Next": fires `POST /api/payroll/weeks`, gets `weekId`, advances to Step 2. Point of no return — the week now exists in the DB as `isFinal=false`.

### Step 2: Hours Grid

- Sticky header: Mon-ST through Sun-ST, then Mon-OT through Sun-OT. Sticky first column: worker name + trade.
- One row per (worker, classification) pair. Numeric inputs, auto-select-on-focus.
- Keyboard nav: `Tab`/`Shift+Tab` horizontal, `Enter`/`Arrow-Down` / `Arrow-Up` vertical within same column.
- Per-row bulk: **"Standard week"** fills Mon-Fri ST=8, zeros elsewhere.
- Top-of-grid bulk: **"Apply standard week to all"** fires standard week on every row.
- Paste support: at cell focus, detect tab/newline delimited paste (spreadsheet shape) and fill the rectangular region starting at the focused cell.
- Per-row total column (auto-computed, read-only): `40.0 ST / 2.0 OT`.
- State-specific columns collapsed behind per-state toggle chip above the grid:
  - `[+ CA double-time columns]` — reveals Mon-DT through Sun-DT.
  - `[+ CA fringe disaggregation]` — reveals Health/Welfare, Pension, Vacation, Training columns (sums update `fringeRateSnapshot` live).
  - `[+ IL non-PW hours]` — reveals per-row `nonPwHours` input.
  - `[+ MA fields]` — reveals `checkNumber`, `allOtherHours`, `totalWeekGrossWages`.
  - `[+ NJ deductions]` — reveals `ficaTax`, `federalIncomeTax`, `stateIncomeTax` per row.
- Only toggles relevant to the project's state are rendered (CA project → CA toggles only).
- Footer: "Save draft" (persists, stays in wizard) and "Review →" (flushes dirty rows, advances to Step 3).

### Step 3: Review & Save

- Fetches `GET /api/compliance/:weekId` on mount (after dirty-flush completes).
- Violations grouped:
  - **Red** — under-wage, CWHSSA OT missed (>40 ST in a week without OT premium), apprentice ratio exceeded.
  - **Yellow** — CA daily OT/DT warnings, unusual patterns.
  - **Green** — "All N workers pass federal minimums" confirmation.
- Clickable violation → jumps to Step 2 with the offending cell highlighted and scrolled into view.
- Read-only summary table: worker name, total hours (ST/OT/DT), gross wages, deductions, net pay.
- Buttons:
  - **Back to hours** — returns to Step 2.
  - **Save as draft** — persists, leaves wizard, toast "Saved draft — return anytime via Payroll Weeks."
  - **Save & continue to compliance review** — persists, redirects to `/payroll/:weekId` (detail page) for WH-347 + submission.
- Neither save button sets `isFinal=true`. Finalization happens on the detail page at submit/generate-PDF time.

## Data Flow & Save Semantics

### Draft model

The schema has no separate "draft" flag — a week is in-progress until `isFinal=true` via `PATCH /weeks/:id/submit`. The wizard leverages this directly.

### Save strategy

- **Dirty-set tracker** keyed by `(workerId, classificationId)`. Any cell edit marks its row dirty.
- **Debounced flush:** 2-second trailing debounce after last cell edit fires `POST /api/payroll/entries` (one request per dirty row) via `Promise.all`. `POST /entries` is upsert by `(payrollWeekId, workerId, classificationId)` per `upsertPayrollEntry` in `src/server/routes/payroll.ts:262`.
- **Forced flush** on: "Review →" click, "Save draft" click, tab close (`beforeunload`).
- No localStorage. The DB is the source of truth. The in-flight dirty-set is the only client-side mutable state.

### Lock handling (409)

`assertWeekNotSubmitted` (`src/server/routes/payroll.ts:249`) returns HTTP 409 if `isFinal=true`. The wizard must:

1. On mount with `:weekId`, fetch the week first. If `isFinal=true`, redirect to `/payroll/:weekId` with toast "Submitted weeks must be amended before editing." Do not render wizard shell.
2. If a 409 arrives during an active session (concurrent submit from another tab), show a top-of-wizard banner "This week was submitted — changes can't be saved. Copy values out if needed." Disable all inputs. Preserve in-memory state.

### Edit mode pre-population

On mount with `:weekId`:

- `GET /api/payroll/weeks/:weekId` — returns `{ week, entries }` in one response (`src/server/routes/payroll.ts:191-210`). Provides both the lock check (`week.isFinal`) and pre-population data.
- `GET /api/projects/:projectId/workers` — full project roster (needed to distinguish "on project but not on this week" workers in Step 1).

Entries map to grid rows by `(workerId, classificationId)`. Workers on the project but not on this week appear unchecked in Step 1.

### Rate snapshots

`baseRateSnapshot` and `fringeRateSnapshot` are set at first-save of an entry and are read-only in the wizard thereafter. No "refresh rates from current WD" affordance in v1 (deferred).

### State-specific field persistence

| State | Fields filled when toggle expanded | Default when toggle collapsed |
|-------|-----------------------------------|-------------------------------|
| CA | `monDt..sunDt` | `0` |
| CA | `fringeHealthWelfare`, `fringePension`, `fringeVacation`, `fringeTraining` | `null` |
| IL | `nonPwHours` | `null` |
| MA | `checkNumber`, `allOtherHours`, `totalWeekGrossWages` | `null` |
| NJ | `ficaTax`, `federalIncomeTax`, `stateIncomeTax` | `null` |

These defaults match the existing nullable schema semantics (Phase 29/42/49/52 columns in `payrollEntries`).

### Compliance check

- `GET /api/compliance/:weekId` (`src/server/routes/compliance.ts:148`). Read-only. Runs against stored entries, so dirty-flush must complete before the fetch fires.

### Unchecked-worker behavior (edit mode)

When a worker who had entries last time is unchecked in Step 1 during edit mode: **zero all hour fields on that worker's entry row, keep the DB row**. Preserves audit trail. Can be changed to hard-delete later if product asks.

## Component Map

New directory: `src/client/components/payrollWizard/`

```
payrollWizard/
  PayrollWizard.tsx          Shell — step state, weekId, dirty-set owner
  Step1Roster.tsx            Week metadata + roster checkboxes
  Step2HoursGrid.tsx         Sticky-header table, keyboard nav, paste
  Step2GridRow.tsx           Per-worker row — cells, per-row total, blur→save
  Step2BulkActions.tsx       "Standard week", state-column toggles, paste target
  Step3Review.tsx            Compliance fetch + summary + save/draft buttons
  useWizardState.ts          Step state, nav guards, dirty-set, debounced flush
  useEntryMutation.ts        POST /entries wrapper with 409 detection + toast
  types.ts                   WizardStep, RosterEntry, GridRow, PersistedEntry
```

New page:

- `src/client/pages/PayrollWizardPage.tsx` — route handler, mounts wizard in create/edit mode.

Modified files:

- `src/client/App.tsx` — rewire `/payroll/new` to `PayrollWizardPage`; add `/payroll/:weekId/edit`.
- `src/client/pages/PayrollWeekDetailPage.tsx` — add "Edit hours" button; remove inline data-entry controls. Estimated 800-1,200 lines removed.
- `src/client/pages/PayrollListPage.tsx` — surface draft-week status ("Draft — N workers").

Deleted files:

- `src/client/pages/PayrollEntryPage.tsx`
- `src/client/components/PayrollWeekForm.tsx`
- `src/client/components/SamplePayrollForm.tsx` (check usage count; may be referenced in onboarding — do not delete blindly)

Preserved:

- `src/client/components/LiveCalcDisplay.tsx` — reused inside Step 2 rows for per-row gross-pay preview.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| 409 on save (week locked mid-session) | Top-of-wizard banner, inputs disabled, in-memory state preserved, no auto-redirect |
| Network error on per-row save | Row stays marked dirty; retry on next debounced flush. Per-row toast with manual retry button |
| Compliance fetch fails (Step 3) | Non-blocking toast; save still allowed with confirm |
| Client-side validation error (negative hours, non-numeric) | Inline red border + tooltip; blocks Step 2→3 advance |
| Duplicate `payrollNumber` on Step 1 Next | Server 409 from unique constraint → inline Step 1 error |
| Edit mode, week is `isFinal=true` | Pre-render redirect to detail page with amendment toast |

## Migration Plan

Single PR, clean cutover. No feature flag — the old flow is known-broken for N>1 workers, so parallel rollout preserves no working state.

Commit order within the feature branch:

1. `feat(payroll-wizard): scaffold PayrollWizardPage + Step1 roster` — new routes live, Step 2/3 stubbed.
2. `feat(payroll-wizard): Step 2 hours grid with keyboard nav`
3. `feat(payroll-wizard): Step 3 review + compliance fetch + save`
4. `feat(payroll-wizard): bulk actions, paste support, state-column toggles`
5. `refactor(payroll-detail): remove inline data entry; add Edit-hours button`
6. `chore(payroll): delete PayrollEntryPage + PayrollWeekForm; evaluate SamplePayrollForm`

Each commit compiles and passes existing tests.

Rollback = revert the feature-branch commits. Backend is untouched, so server state is unaffected.

## Testing Scope

### Unit (Vitest + React Testing Library)

New directory: `tests/client/payrollWizard/`

- `useWizardState.test.ts` — step transitions, dirty-set tracking, debounced flush timing, forced-flush triggers.
- `Step1Roster.test.tsx` — copy-forward pre-population from most recent week, first-week fallback, add-worker modal, validation (date format, payroll number range).
- `Step2HoursGrid.test.tsx` — keyboard nav (Tab/Enter/Arrow), "Standard week" bulk action, "Apply standard week to all", paste parser (tab-delimited + rectangular fill), state-column toggle visibility per project state, per-row total computation.
- `Step3Review.test.tsx` — compliance fetch mock → violation grouping (red/yellow/green), click-violation-to-jump behavior, save/draft flows.

### Integration

Existing `tests/routes/payroll.test.ts` and `tests/services/complianceService.test.ts` already cover the endpoints the wizard uses. No new route tests needed.

### End-to-end

Out of scope. Project has no Playwright rig. Separate initiative.

### Manual UAT

Documented in `.planning/phases/60-payroll-entry-wizard/UAT.md`:

1. Create new week, 5 workers, "Apply standard week to all" → save → verify 5 entries persist with 40 ST each.
2. Edit existing week, uncheck one worker → save → verify that worker's entry has all hour fields zeroed.
3. CA project → verify DT columns toggle visible only when expanded; values persist when expanded + entered, zero out when collapsed.
4. Attempt edit on `isFinal=true` week → verify pre-render redirect to detail page with amendment toast.
5. Paste a 3×5 block of hours from Excel into a grid cell → verify rectangular fill starting at focused cell.
6. Concurrent-submit simulation: submit the week from another tab mid-wizard-session → verify top-of-wizard lock banner appears and inputs disable.

## Open Decisions

- **Unchecked-worker in edit mode:** default is (b) zero hours, keep row. Revisit after first real UAT cycle if contractors request hard-delete.
- **Virtualization:** not required for expected workload (5-20 workers × 14-21 cells ≈ 70-420 cells). Skip `react-virtual` in v1. Add if a user reports lag on a 50+ worker crew.
- **`SamplePayrollForm` fate:** verify usage before delete; fold into Step 1 as "preview with sample data" affordance if onboarding references it.

## Success Criteria

- Creating a 10-worker payroll week takes ≤3 minutes of active user time, down from ~10 minutes on the current detail-page flow.
- Zero regressions on compliance display, WH-347 PDF generation, or state-agency submission tracking (all behaviors stay on detail page).
- `PayrollWeekDetailPage.tsx` drops below 2,000 lines after data-entry removal.
- All existing `tests/routes/payroll.test.ts` cases continue to pass without modification.
