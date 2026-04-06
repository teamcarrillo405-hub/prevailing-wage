---
phase: 41-ny-state-forms
plan: "03"
slug: pw12-pdf-generator
subsystem: pdf-generation
tags: [pdf-lib, ny-state, tdd, certified-payroll]
dependency_graph:
  requires: [41-01]
  provides: [pw12Generator.ts, fillPw12]
  affects: [ny-state-forms-export-route]
tech_stack:
  added: []
  patterns: [PDFDocument.create (programmatic PDF), TDD red-green, maxWidth drawText guard]
key_files:
  created:
    - src/server/services/pw12Generator.ts
    - tests/services/pw12Generator.test.ts
  modified: []
decisions:
  - "PDFDocument.create() not load() — no fillable PW-12 template exists; programmatic drawing required"
  - "maxWidth on all drawText calls — prevents text overflow across column boundaries"
  - "ST/OT split into two sub-rows per worker — matches PW-12 format spec"
  - "Fringe sub-clauses (b) and (c) both drawn — required by NY Labor Law Section 220"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_changed: 2
requirements: [STATE-02]
---

# Phase 41 Plan 03: PW-12 PDF Generator Summary

**One-liner:** NY PW-12 weekly payroll PDF via pdf-lib programmatic drawing — contractor header, ST/OT worker rows with daily hours, fringe Statement of Compliance with clauses (b) and (c).

## What Was Built

`src/server/services/pw12Generator.ts` exports `fillPw12(data: Pw12Input): Promise<Uint8Array>` — a fully programmatic PDF generator that creates a NY DOL PW-12 weekly payroll report from scratch (no template).

**Key implementation details:**
- `PDFDocument.create()` — letter portrait 612×792 pt
- Header: centered title, contractor name/FEIN/address, week ending date, payroll number, PRC number, county
- Worker table: `Name/SSN | Classification | Mon-Sun | Hrs | Rate | Gross | Ded | Net` column headers with `maxWidth` on every `drawText` call
- Per-worker two sub-rows: ST (with gross/deductions/net) and OT (blank financials, rate × 1.5 shown)
- Pagination guard: adds new page when `y < 150pt`
- Statement of Compliance block: fringe sub-clauses (b) and (c) + signature line

## TDD Execution

| Phase | File | Commit | Status |
|-------|------|--------|--------|
| RED   | tests/services/pw12Generator.test.ts | ae3220e | Committed while failing (module-not-found) |
| GREEN | src/server/services/pw12Generator.ts | 91aad9e | All 3 tests pass |

## Tests

All 3 tests pass in `tests/services/pw12Generator.test.ts`:
1. `fillPw12` returns non-empty `Uint8Array` (length > 0)
2. `PDFDocument.load(result)` round-trip succeeds — valid PDF structure
3. `loaded.getPageCount() >= 1`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all fields draw real data from `Pw12Input`. Generator is wired and functional.

## Self-Check: PASSED
