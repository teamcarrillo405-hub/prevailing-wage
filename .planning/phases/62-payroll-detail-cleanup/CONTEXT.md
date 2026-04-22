# Phase 62 — Payroll Week Detail Page: Cleanup (RETRACTED)

**Status:** **Not needed — the premise was wrong.** Keeping this file as a record so the investigation isn't repeated.

**Investigated at commit `e4fa66d` (2026-04-22).**

## Original premise (incorrect)

Phase 60's design doc claimed `PayrollWeekDetailPage.tsx` was 2,938 lines because "data entry was never properly separated from compliance/submission workflows," and that phase 62 would remove ~800-1,200 lines of inline data entry by routing all hour edits through the wizard.

## What I actually found

`grep` over the file at commit `e4fa66d` (2,946 lines):

| Pattern | Count |
|---------|-------|
| `useForm` / `react-hook-form` | 0 |
| `POST /api/payroll/entries` | 0 |
| `PUT /api/payroll/entries` | 0 |
| `<input type="number">` | 0 |
| `<input>` total (any type) | 13 |

There is no inline hour entry to remove. The 13 `<input>` elements are for: eCPR modal fields, import mapping modal, amendment reason text, classification override form fields, and similar narrow-scope UI.

## What the 2,946 lines actually are

| Section | Approx line range | Purpose |
|---------|------------------|---------|
| eCPR XML export modal + mutations | ~250-400 | CA certified payroll XML generation |
| Classification override mutations | ~317-370 | Per-entry worker classification adjustments (Phase 39) |
| Payroll import workflow (CSV from QuickBooks/ADP/Gusto/Paychex/Sage) | ~260 header types + ~500-2700 lines of modal + mapping UI | Provider CSV → entry import (Phases 36, 44, 45) |
| PDF download handlers (WH-347, A-1-131, F-700, MA, NJ, IL, NY, TX) | ~600-900 | Per-state PDF generation wiring |
| State-form submission tracking (CA eCPR, WA L&I, NY MPWR, IL IDOL, TX CPR) | scattered ~280-930 | `PATCH /weeks/:id/:state-submit` for each |
| Amendment creation | ~980 | `POST /weeks/amend` flow |
| Compliance display + summary table | scattered | Violations, certification badges, worker totals |

All legitimate functionality. Not redundant with the wizard.

## Possible real refactors (optional, scope creep)

If the file size still bothers someone later, these would be genuine extractions — but none are required:

1. **Extract payroll-import workflow into a sub-component.** The CSV import UI (modal, field mapping, provider selector, preview + commit) is self-contained — easily 800-1,500 lines of JSX + state. Would live under `src/client/components/payrollWeekDetail/ImportModal.tsx` or similar.
2. **Extract state-form submission buttons into a registry-driven component.** The file currently has per-state handlers for 7 states; a shared `<StateFormSubmissionButton stateConfig={...}/>` with a registry mapping would collapse duplication.
3. **Extract the eCPR XML export modal.** Self-contained; reuses Phase 38 patterns.

Each of these is a proper extraction phase with its own plan and UAT. None is blocking or high-value. Leave them deferred.

## Recommendation

**Mark this phase resolved.** The file is big because it does a lot, not because of redundant code. Close phase 62. If file-size anxiety returns, open a new phase targeting one of the three optional extractions above with honest scope.
