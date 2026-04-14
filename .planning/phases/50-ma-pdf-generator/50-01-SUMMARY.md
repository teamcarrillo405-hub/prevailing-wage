---
phase: 50-ma-pdf-generator
plan: "01"
subsystem: server/pdf-generator
tags: [pdf, ma, state-forms, certified-payroll]
dependency_graph:
  requires: [49-ma-schema-ui]
  provides: [maPdfGenerator, MaPdfInput]
  affects: [ma-export-route]
tech_stack:
  added: []
  patterns: [PDFDocument.create(), programmatic-draw, ilPdfGenerator-pattern]
key_files:
  created:
    - src/server/services/maPdfGenerator.ts
    - tests/services/maPdfGenerator.test.ts
  modified: []
decisions:
  - "fmtBoolean returns Y/N/em-dash for boolean|null — distinct from fmtDollar/fmtOptional"
  - "drawCheckbox draws 8x8 outer box always; filled 6x6 inner square only for true"
  - "suppUnemp column always renders blank (no DB field) per MA spec"
  - "Statement of Compliance always on dedicated page 2 (unconditional addPage) per Phase 43 pattern"
  - "fmtOptional handles number|string|null — number.toFixed(2) for numbers, string as-is, blank for null"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 50 Plan 01: MA DLS PDF Generator Summary

**One-liner:** MA DLS Weekly Certified Payroll Report PDF generator using pdf-lib PDFDocument.create() with Sunday-first day columns, OSHA checkbox, woman/minority Y/N, blank supplemental unemployment column, and dedicated Statement of Compliance page.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Create maPdfGenerator test stubs | 819b657 | tests/services/maPdfGenerator.test.ts |
| 1 | Implement maPdfGenerator.ts | bc6debe | src/server/services/maPdfGenerator.ts |

## What Was Built

### `src/server/services/maPdfGenerator.ts` (565 lines)

Exported functions and types:
- `export interface MaPdfInput` — full MA input shape with contractor, project, week, and entries (including oshaTraining, isWoman, isMinority, sunSt-satSt, allOtherHours, totalWeekGross, checkNumber)
- `export async function fillMaCertifiedPayroll(data: MaPdfInput): Promise<Uint8Array>` — generates a valid multi-page PDF

Internal helpers:
- `fmtDollar(n)` — blank for null, `n.toFixed(2)` otherwise
- `fmtHours(n)` — blank for 0, `String(n)` for positive
- `fmtBoolean(v)` — `'Y'` / `'N'` / `'\u2014'` (em dash) for true/false/null
- `fmtOptional(n)` — blank for null, `n.toFixed(2)` for number, string as-is
- `drawCheckbox(page, x, y, checked)` — 8x8 outer box always; 6x6 filled inner square only for `true`

Page structure:
- Page 1: Header (contractor, project, week) + worker table with MA_COL column layout
- Page 2 (always dedicated): Statement of Compliance with MGL Ch. 149 Section 27 statutory language and "pains and penalties of perjury" certification

MA-specific column layout (MA_COL):
- Day order is `sunSt → monSt → tueSt → wedSt → thuSt → friSt → satSt` (Sunday-first, unlike IL which is Monday-first)
- Extra columns vs IL: `oshaCheck`, `isWoman`, `isMinority`, `suppUnemp`, `totalGross`, `allOther`, `checkNum`

### `tests/services/maPdfGenerator.test.ts` (82 lines)

5 test cases:
1. `fillMaCertifiedPayroll returns a non-empty Uint8Array`
2. `PDFDocument.load(result) succeeds — round-trip validation`
3. `Generated PDF has at least 2 pages (worker table + compliance)`
4. `handles empty entries array without crashing`
5. `handles null optional fields without crashing`

## Verification Results

```
npx vitest run tests/services/maPdfGenerator.test.ts
  ✓ tests/services/maPdfGenerator.test.ts (5 tests) 41ms
  Test Files  1 passed (1)
  Tests       5 passed (5)
```

grep checks:
- `grep -c 'sunSt' src/server/services/maPdfGenerator.ts` → 4 (column def + multiple usages)
- `grep 'pains and penalties'` → matches
- `grep 'PDFDocument.create'` → matches
- `grep 'PDFDocument.load'` → NOT found (correct)
- Line count: 565 lines (well above 200 minimum)

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing 17 failing tests in the full suite are unrelated to this plan (they are pre-existing red stubs for CA A-1-131 and other features). Before this plan's implementation, 192 test files were failing (the MA test file imported from a non-existent module). After implementation, only the 6 pre-existing failing file sets remain.

## Known Stubs

None. All columns are fully implemented. The `suppUnemp` column renders blank intentionally per the MA DLS spec (no DB field exists for supplemental unemployment fringe). This is a spec-correct blank, not a stub.

## Self-Check: PASSED

- [x] `src/server/services/maPdfGenerator.ts` exists (565 lines)
- [x] `tests/services/maPdfGenerator.test.ts` exists (82 lines)
- [x] Commit `819b657` exists (test file)
- [x] Commit `bc6debe` exists (implementation)
- [x] All 5 tests pass
- [x] `fillMaCertifiedPayroll` exported
- [x] `MaPdfInput` exported
- [x] `PDFDocument.create()` used (not load)
- [x] `sunSt` appears before `monSt` in MA_COL
- [x] `fmtBoolean` returns Y/N/em-dash
- [x] `drawCheckbox` uses drawRectangle
- [x] Statement of Compliance contains 'pains and penalties of perjury'
- [x] Statement of Compliance contains 'Chapter 149, Section 27'
- [x] suppUnemp renders blank
- [x] null fields render blank not '0'
