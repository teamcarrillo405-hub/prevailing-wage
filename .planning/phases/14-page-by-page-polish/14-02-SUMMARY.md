---
phase: 14-page-by-page-polish
plan: 02
subsystem: client-pages
tags: [ui-primitives, badge, button, empty-state, page-header, polish]
dependency_graph:
  requires: []
  provides: [PAGE-02, PAGE-03, PAGE-04]
  affects: [WorkersPage, PayrollEntryPage, ProjectDetailPage]
tech_stack:
  added: []
  patterns: [Badge variant=warning for missing-data, EmptyState for no-workers branch, Button primary for CTAs, secondary button classes on Link nav]
key_files:
  created: []
  modified:
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollEntryPage.tsx
    - src/client/pages/ProjectDetailPage.tsx
decisions:
  - WorkersPage back button kept as standalone raw button above PageHeader — preserves navigation clarity without nesting inside header
  - ProjectDetailPage nav links use secondary button className directly on Link (not Button wrapping) — avoids asChild dependency since Button renders button and Link renders a
  - Cancel buttons in WorkersPage edit form use Button variant=ghost — consistent with ghost pattern for destructive-cancel actions
metrics:
  duration: 4min
  completed_date: "2026-03-22"
  tasks: 3
  files_modified: 3
---

# Phase 14 Plan 02: WorkersPage / PayrollEntryPage / ProjectDetailPage Polish Summary

Three pages migrated from ad-hoc inline styling to Badge, Button, EmptyState, and PageHeader primitives — no hardcoded `#F5C518` hex values remain in any of the three files.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | WorkersPage — Badge, Button, PageHeader | ceb6ca0 | WorkersPage.tsx |
| 2 | PayrollEntryPage — EmptyState, Button, PageHeader | 4d9135a | PayrollEntryPage.tsx |
| 3 | ProjectDetailPage — Badge, nav link styling | 407f205 | ProjectDetailPage.tsx |

## Changes Made

### WorkersPage (PAGE-02)
- Added imports: `Badge`, `Button`, `PageHeader`
- Header: replaced `<div className="mb-6 flex items-center gap-4">` + `<h1>` with standalone back button + `<PageHeader title="Workers" />`
- Missing-data warning: replaced `<span className="inline-block text-xs bg-amber-100 text-amber-700 ...">` with `<Badge variant="warning">`
- Save Changes button: replaced `bg-[#F5C518]` raw button with `<Button>` primary
- Cancel button in edit form: replaced raw button with `<Button variant="ghost">`
- Add Worker submit button: replaced `bg-[#F5C518]` raw button with `<Button className="mt-5">`

### PayrollEntryPage (PAGE-03)
- Added imports: `EmptyState`, `Button`, `PageHeader`
- Header: replaced flex div + h1 with standalone back button + `<PageHeader title="New Payroll Week" />`
- Empty state: replaced custom `rounded-lg border border-dashed ...` div with `<EmptyState heading="No workers assigned yet" message="..." action={<Button>}>`
- Sample workers CTA: now rendered via EmptyState action slot using `<Button>` primary

### ProjectDetailPage (PAGE-04)
- Added import: `Badge`
- Funding type: replaced `<dd className="inline-block ... bg-[#F5C518] ...">` with `<dd><Badge variant="neutral">...</Badge></dd>`
- All 5 nav links: replaced `inline-block rounded border border-gray-200 bg-white ... text-gray-700` with `inline-flex ... border-brand-gold text-brand-gold hover:bg-brand-gold/10` secondary button styling

## Verification

- `grep -rn "bg-\[#F5C518\]"` across all three files: no output (clean)
- Badge usage: WorkersPage (2 matches), ProjectDetailPage (3 matches)
- EmptyState usage: PayrollEntryPage (2 matches)
- All 181/181 tests pass after each task

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- WorkersPage.tsx: modified and committed (ceb6ca0)
- PayrollEntryPage.tsx: modified and committed (4d9135a)
- ProjectDetailPage.tsx: modified and committed (407f205)
- All 3 files free of `bg-[#F5C518]`
- 181/181 tests pass
