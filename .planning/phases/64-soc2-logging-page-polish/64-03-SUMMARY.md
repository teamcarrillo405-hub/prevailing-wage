---
phase: 64-soc2-logging-page-polish
plan: 03
subsystem: frontend-ui
tags: [design, tailwind, polish, pages]
key_files:
  modified:
    - src/client/pages/ProjectDetailPage.tsx
    - src/client/pages/PayrollListPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
decisions:
  - Badge component only has 4 variants (compliant/violation/warning/neutral) — semantic amber/emerald/blue colors applied via className override on neutral variant
  - Sticky bar placed immediately after header div (not inside it) to avoid breaking justify-between layout
metrics:
  duration: ~15 minutes
  completed: 2026-04-25
  tasks: 3
  files: 3
---

# Phase 64 Plan 03: Page Polish — Elevated Cards + Sticky Downloads Summary

Premium design treatment applied surgically to the three highest-traffic pages: elevated card shadows, semantic badge color tokens, and a sticky download action bar.

## Tasks Completed

### Task 1: ProjectDetailPage.tsx — Elevated Cards + Brand Step Borders

**Lines changed:** ~87, 918, 974

- `Card className="max-w-lg"` → `Card className="max-w-lg shadow-card-elevated"` (project info card, line 918)
- `Card className="mt-4 max-w-lg"` → `Card className="mt-4 max-w-lg shadow-card-elevated"` (notifications panel card, line 974)
- WorkflowProgress incomplete step: `border-gray-300` → `border-brand-navy/30` (line 87)

**Commit:** `99ad687`

### Task 2: PayrollListPage.tsx — Elevated Week Rows + Semantic Badge Colors

**Lines changed:** ~258, 269-284

- Week list Card: added `shadow-card-elevated`
- `submittedAt` Badge: `variant="compliant"` → `variant="neutral" className="ml-2 bg-amber-100 text-amber-800 border-amber-300 font-medium"`
- `isFinal` Badge: `variant="neutral"` → `variant="neutral" className="ml-2 bg-emerald-100 text-emerald-800 border-emerald-300 font-medium"`, label changed Draft→Final
- `amendmentNumber` Badge: `variant="warning"` → `variant="neutral" className="ml-2 bg-blue-100 text-blue-800 border-blue-300 font-medium"`
- EmptyState message updated to: "No payroll weeks yet — start your first week to begin compliance tracking."

**Commit:** `1f5218f`

### Task 3: PayrollWeekDetailPage.tsx — Sticky Download Action Bar

**Lines changed:** ~1005, 1027-1111

- Main content wrapper: `className="max-w-4xl mx-auto"` → `className="max-w-4xl mx-auto pb-24"` (prevents sticky bar overlap)
- All download/action buttons extracted from inline header `<div className="flex items-center gap-2">` and wrapped in:
  ```
  <div className="sticky bottom-0 z-10 bg-white border-t border-brand-navy/10 px-6 py-3 -mx-6 mt-8">
    <div className="flex gap-2 flex-wrap items-center">
      {/* all conditional buttons unchanged */}
    </div>
  </div>
  ```
- Zero changes to any conditional expression, onClick handler, disabled state, or button label
- Handler count verified: 8 references to download handlers — unchanged

**Commit:** `59968e0`

## Deviations from Plan

### Auto-handled: Badge variant constraint

**Found during:** Task 2

**Issue:** The plan suggested `variant="submitted"` and `variant="amendment"` as possible variants, but Badge component only defines 4 variants: `compliant | violation | warning | neutral`. Using an undefined variant would be a TypeScript error.

**Fix:** Used `variant="neutral"` with `className` overrides to apply amber/emerald/blue color tokens directly. This achieves the same visual result without breaking the type contract.

**Rule:** Rule 2 (missing type safety) — prevented TypeScript error proactively.

### Auto-handled: Sticky bar placement outside header

**Found during:** Task 3

**Issue:** The download buttons were inside `<div className="mb-4 flex items-center justify-between">` as the right-side child. Moving them to a sticky bar while keeping that `justify-between` div would leave it with only one child (the left side), which is fine — `justify-between` with one child just left-aligns.

**Fix:** Closed the left-side `</div>` after the PageHeader, then placed the sticky bar as a sibling element directly after the header div. Structure is clean with no orphan divs.

## Verification Results

```
grep -c "shadow-card-elevated" src/client/pages/ProjectDetailPage.tsx  → 2 ✓
grep -c "shadow-card-elevated" src/client/pages/PayrollListPage.tsx    → 1 ✓
grep -n "sticky bottom-0" src/client/pages/PayrollWeekDetailPage.tsx   → line 1028 (1 match) ✓
npx tsc --noEmit                                                        → 0 errors ✓
```

## Known Stubs

None — all changes are pure Tailwind class upgrades with no data stubs.

## Self-Check: PASSED

- All 3 files modified and committed individually
- TypeScript passes with zero errors
- Download handler count unchanged (8 references)
- No new imports added to any file
- No component APIs changed
