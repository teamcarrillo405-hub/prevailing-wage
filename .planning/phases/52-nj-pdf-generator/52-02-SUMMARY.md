---
phase: 52-nj-pdf-generator
plan: 02
subsystem: pdf-generation
tags:
  - nj
  - pdf-lib
  - mw-562
  - eeo
  - certified-payroll
dependency_graph:
  requires:
    - 52-01  # NJ deduction columns (ficaTax/federalIncomeTax/stateIncomeTax) on payroll_entries
    - 50     # maPdfGenerator.ts pattern established
  provides:
    - NJ MW-562 PDF download endpoint (GET /api/export/nj-mw562/:weekId)
    - fillNjCertifiedPayroll service function
    - NjPdfInput type
  affects:
    - src/server/routes/export.ts  # 501 stub replaced with full implementation
tech_stack:
  added: []
  patterns:
    - pdf-lib programmatic draw (PDFDocument.create, not overlay)
    - Monday-first day order for NJ (Mo-Tu-We-Th-Fr-Sa-Su)
    - fmtEeo helper returns code letters not Y/N (distinct from fmtBoolean)
    - Unconditional dedicated compliance page 2 (Phase 43/50 pattern)
key_files:
  created:
    - src/server/services/njPdfGenerator.ts
    - tests/services/njPdfGenerator.test.ts
  modified:
    - src/server/routes/export.ts
    - tests/routes/export.test.ts
decisions:
  - "fmtEeo returns code letter (M/F/N, W/B/A/N/I/M, H/N) or em-dash — not Y/N (that is fmtBoolean for MA)"
  - "NJ day order is Monday-first; MA is Sunday-first — separate NJ_COL layout"
  - "assertProjectAccess called before NJ state gate (NFR-03 preserved from Phase 51 stub)"
  - "Audit log action is nj_pdf.downloaded matching il_pdf.downloaded / ma_pdf.downloaded pattern"
  - "Dedicated compliance page 2 via unconditional addPage() — Phase 43/50 pattern"
metrics:
  duration_seconds: 257
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_changed: 4
---

# Phase 52 Plan 02: NJ MW-562 PDF Generator Summary

NJ MW-562 programmatic PDF generator with EEO columns (Sex/Race/Eth), Monday-first day order, FICA/FIT/SIT deductions, and dedicated N.J.S.A. 34:11-56.25 et seq. compliance page 2, wired into GET /api/export/nj-mw562/:weekId replacing the Phase 51 501 stub.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Test scaffold + njPdfGenerator.ts implementation | dc46b52 | tests/services/njPdfGenerator.test.ts, src/server/services/njPdfGenerator.ts |
| 2 | export.ts route completion + export.test.ts update | 1a93e97 | src/server/routes/export.ts, tests/routes/export.test.ts |

## What Was Built

### njPdfGenerator.ts

New service at `src/server/services/njPdfGenerator.ts` following the `maPdfGenerator.ts` pattern exactly:

- `NjPdfInput` interface (exported) — contractor with `njPwcNumber`, project with `njContractId`, entries with EEO fields and three deduction columns
- `fillNjCertifiedPayroll(data: NjPdfInput): Promise<Uint8Array>` (exported) — main entry point
- `fmtEeo(v: string | null): string` — returns code letter or em-dash; distinct from `fmtBoolean` (MA uses Y/N/em-dash for boolean fields)
- `NJ_COL` layout — 23 columns across 540pt content width; `netPay` at x=558 stays within right margin at x=576
- Header block includes `NJ PWC Reg. No.` and `Contract No.` fields
- Day columns in Monday-first order: Mo-Tu-We-Th-Fr-Sa-Su (NJ standard vs MA Sunday-first)
- Deduction columns: FICA, FIT (Federal Income Tax), SIT (State Income Tax)
- Dedicated page 2 for Statement of Compliance via unconditional `addPage()` — references N.J.S.A. 34:11-56.25 et seq.

### Unit Tests (6 passing)

`tests/services/njPdfGenerator.test.ts`:
1. `fillNjCertifiedPayroll returns a non-empty Uint8Array`
2. `PDFDocument.load(result) succeeds — round-trip validation`
3. `Generated PDF has at least 2 pages (worker table + compliance)`
4. `handles empty entries array without crashing`
5. `handles null EEO fields — renders em-dash`
6. `Statement of Compliance references N.J.S.A. 34:11-56.25 — compliance page always present`

### export.ts Route Completion

- Added import: `import { fillNjCertifiedPayroll, type NjPdfInput } from '../services/njPdfGenerator.js'`
- Replaced 501 stub with full implementation (steps 4–8): load entries via `getPayrollEntriesWithWorkerDetails`, map to `NjPdfInput`, generate PDF, send as `application/pdf`, best-effort audit log with action `nj_pdf.downloaded`
- `assertProjectAccess` remains before NJ state gate (NFR-03 preserved)

### export.test.ts Update

Replaced `'returns 501 for a valid NJ project payroll week (stub)'` with:
- `'returns 200 with PDF content-type for a valid NJ project payroll week'`
- Asserts `res.status === 200` and `content-type` matches `/application\/pdf/`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the NJ MW-562 PDF generator is fully wired end-to-end. The route returns real PDF bytes. No placeholder data flows to the UI.

## Checkpoint

`checkpoint:human-verify` (task 3) — auto-approved per `<auto_checkpoint>` directive in execution context. The autonomous authorization covers browser verification of the generated PDF.

## Self-Check: PASSED

Files verified to exist:
- src/server/services/njPdfGenerator.ts — FOUND
- tests/services/njPdfGenerator.test.ts — FOUND

Commits verified:
- dc46b52 — FOUND
- 1a93e97 — FOUND

TypeScript: zero new errors introduced (two pre-existing errors in audit.ts and projects.ts are unrelated).
