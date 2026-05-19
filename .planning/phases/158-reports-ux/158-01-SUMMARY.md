---
phase: 158-reports-ux
plan: 01
subsystem: reports
tags: [reports, ux, sort, filter, csv]
key-files:
  modified:
    - src/client/pages/GlobalReportsPage.tsx
decisions:
  - CSV export is client-side (uses sortedRows) so filtered/sorted view exports cleanly
  - Server-side anchor export link for compliance replaced with client button to export current filtered+sorted data
  - toggleSort uses generic Record<string, unknown> cast to avoid per-column type guards
metrics:
  duration: ~15min
  completed: 2026-05-18
  tasks: 4
  files: 1
---

# Phase 158 Plan 01: GlobalReportsPage Column Sort + Date Filter + Token Fix Summary

One-liner: Fixed brand-navy invisible text, added 7d/30d/quarter/year date range filter, clickable column sort with asc/desc indicators, and client-side CSV export of filtered+sorted compliance data.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 2 | Replace brand-navy token with nav-dark | 7d03be3 |
| 3 | Date range filter (7d / 30d / quarter / year) | 975e5f3 |
| 4 | Clickable column sort with asc/desc indicators | f2b527b |
| 5 | Client-side CSV export of filtered/sorted report | 7ab5101 |

## What Was Built

**Token fix:** Two brand-navy occurrences in GlobalReportsPage replaced with nav-dark (`text-nav-dark`, `bg-nav-dark`, `hover:bg-nav-dark/90`). The icon container that used `text-brand-navy` was invisible before; now renders correctly in dark.

**Date range filter:** Four pill buttons (Last 7 days / Last 30 days / This quarter / This year) rendered above the compliance table. Active button uses `bg-brand-gold text-black`. `startDate` is derived via `useMemo`. The query key includes `dateRange` so TanStack Query re-fetches when the range changes. The `startDate` is appended as a query param to `/reports/compliance-summary` (server ignores unknown params gracefully if not yet implemented server-side).

**Column sort:** All 8 table columns are now clickable headers. `toggleSort(col)` flips direction if same column is clicked again, otherwise sets new column ascending. `sortedRows` is derived via `useMemo` from `complianceRows`. Sort compares numerically for number fields and via `localeCompare` for strings. Active column shows a ▲ or ▼ indicator.

**CSV export:** The existing server-side anchor export link was replaced with a client-side button. `handleExport()` maps `sortedRows` (filtered by date + sorted by column) to CSV rows, wraps all values in double-quotes, creates a Blob, and triggers a download via `URL.createObjectURL`. `URL.revokeObjectURL` is called after 100ms to avoid memory leaks.

## Deviations from Plan

**Auto-fixed Issues**

**1. [Rule 2 - Token] Added useMemo to React imports**
- Found during: Task 3
- Issue: useMemo not imported, needed for startDate and sortedRows derivations
- Fix: Added to React import destructure

**2. [Rule 1 - Enhancement] CSV quotes all fields**
- Found during: Task 5
- Issue: Plan's CSV map didn't quote fields — project names with commas would corrupt the CSV
- Fix: Wrapped all fields in escaped double-quotes per RFC 4180

## Pre-existing Issues Noted (Out of Scope)

- `src/server/services/localWageAdapter.ts` and `stateWageAdapter.ts`: TypeScript errors related to "local" not being in the wage_determinations source enum — pre-existing, not touched by this plan.

## Known Stubs

None.
