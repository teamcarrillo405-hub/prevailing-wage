---
phase: 108-dbe-participation-report
plan: 02
subsystem: DBE / Payroll UI
tags: [dbe, payroll, ui, badge]
dependency_graph:
  requires: [108-01]
  provides: [payroll_week_sub_selector, dbe_row_badge]
  affects: [109-01]
tech_stack:
  added: []
  patterns: [react-query-sub-fetch, inline-select-mutation, dbe-badge-lookup-map]
key_files:
  created: []
  modified:
    - src/client/pages/PayrollWeekDetailPage.tsx
decisions:
  - "Used PUT /payroll/entries/:id (upsert) for subcontractor attribution to avoid adding a new PATCH-only endpoint; spreads full entry fields to satisfy required Zod schema fields"
  - "Added subcontractorId and classificationId to PayrollEntryRow.entry interface — both returned automatically by Drizzle full-row select"
metrics:
  duration: "~10 min"
  completed: "2026-04-27"
  tasks_completed: 1
  files_modified: 1
requirements: [DBE-08]
---

# Phase 108 Plan 02: PayrollWeekDetailPage Sub Selector + DBE Badges Summary

Subcontractor selector per entry row (conditional on project having subs) and DBE/MBE/WBE/SDVOSB color badge on worker rows added to PayrollWeekDetailPage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Sub selector + DBE badge on worker rows | 2b2135d | PayrollWeekDetailPage.tsx |

## Deviations from Plan

None — plan executed as designed. Sub selector shown as column on desktop entry table (consistent with override classification column pattern) rather than a modal form, which fits existing UX conventions.

## Self-Check: PASSED

- PayrollWeekDetailPage has useQuery for subcontractors — FOUND (line ~380)
- Sub selector shown when `subs.length > 0` in desktop table header and rows — FOUND
- subAttributionMutation fires PUT with full entry data + subcontractorId — FOUND
- DBE badge lookup via `subById` map, displayed when dbeClassification !== 'none' — FOUND
- TypeScript: 0 errors; 824 tests passing
