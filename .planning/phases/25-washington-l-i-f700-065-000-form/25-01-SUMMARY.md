---
phase: 25
plan: "01"
subsystem: wa-f700-foundation
tags: [wa, migration, schema, pdf, tdd, export-route]
dependency_graph:
  requires: [24-01, 24-02]
  provides: [25-02]
  affects: [schema, export-routes, worker-classifications]
tech_stack:
  added: []
  patterns: [pdf-lib-coordinate-overlay, drizzle-add-only-migration, state-gated-export-route, tdd-red-green]
key_files:
  created:
    - assets/f700-official.pdf
    - src/server/services/f700Generator.ts
    - tests/services/f700.test.ts
    - src/server/db/migrations/0012_wa_project_fields.sql
    - src/server/db/migrations/0013_wa_manual_rate.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/routes/projects.ts
    - src/server/routes/workers.ts
    - src/server/routes/export.ts
    - tests/routes/export.test.ts
    - tests/routes/projects.test.ts
    - tests/routes/workers.test.ts
decisions:
  - "assets/f700-official.pdf is a placeholder PDF (612x792 portrait, /Rotate=0) — official LNI form is behind TAM authentication; replace when credentials available"
  - "WA_TRADE_CODES exported from f700Generator.ts as static const — 16 codes from secondary sources (MEDIUM confidence); validates against official LNI determinations in Plan 25-02"
  - "waTradeCode added to 0013 migration alongside waManualRate — persistent override per classification avoids query param complexity on download"
  - "fillF700() stub renders but uses placeholder coordinates (all 0) — Plan 25-02 measures real coordinates from official form"
  - "_journal.json updated immediately after creating SQL files — prevents Drizzle silent-skip (burned twice historically)"
metrics:
  duration: "13 minutes"
  completed_date: "2026-03-25"
  tasks_completed: 5
  files_changed: 13
---

# Phase 25 Plan 01: WA F700 Foundation Summary

WA L&I F700-065-000 infrastructure established — DB migrations, schema extensions, route stubs, and TDD test harness for the WA certified payroll export pipeline.

## What Was Built

### Wave 0 — PDF Asset + Test Stubs

**assets/f700-official.pdf:** Placeholder PDF (612x792 pt, portrait, /Rotate=0). The official LNI form at `https://lni.wa.gov/forms-publications/F700-065-000.pdf` returns 404. The authenticated portal at `secure.lni.wa.gov/pubs/f700-065-000.pdf` redirects to a TAM (Tivoli Access Manager) login wall — the file is gated behind portal credentials. A valid placeholder was created via pdf-lib; replace with the official form when credentials are obtained for Plan 25-02.

**src/server/services/f700Generator.ts:** Full stub for the WA F700-065-000 generator. Exports `F700Data`, `F700WorkerRow` interfaces, `WA_TRADE_CODES` constant (16 confirmed codes), and `fillF700()` function. All coordinate constants are placeholder (0) pending measurement from the official form in Plan 25-02. The `WA_TRADE_CODES` map covers 16 4-letter codes confirmed from multiple secondary sources (MEDIUM confidence).

**tests/services/f700.test.ts:** 14 passing unit tests covering:
- `fillF700()` returns valid PDF bytes (startswith `%PDF`)
- `fillF700()` handles empty workers array
- `WA_TRADE_CODES` has all required codes (CARP, ELEC, LABO, etc.) with 4-char keys
- F700WorkerRow has ST/OT but no DT fields (WA form has no DT column)
- Multi-page rendering (9 workers → 2 pages at ROWS_PER_PAGE=8)

**tests/routes/export.test.ts:** 5 RED stubs added (GET /api/export/f700/:weekId — WAL-02). These become GREEN in Wave 1.

**tests/routes/projects.test.ts:** 3 RED stubs added for WA project fields (ubiNumber, lniCertificate, wcAccount — WAL-02). These become GREEN in Wave 1.

**tests/routes/workers.test.ts:** 3 RED stubs added for waManualRate on classifications (WAL-01). These become GREEN in Wave 1.

### Wave 1 — DB Migrations, Schema, Routes

**0012_wa_project_fields.sql:** Adds `ubi_number`, `lni_certificate`, `wc_account` (all TEXT nullable) to `projects` table.

**0013_wa_manual_rate.sql:** Adds `wa_manual_rate` (REAL nullable) and `wa_trade_code` (TEXT nullable) to `worker_classifications` table.

**meta/_journal.json:** Registered both migrations — idx 8 (`0012_wa_project_fields`) and idx 9 (`0013_wa_manual_rate`). Immediate registration after SQL file creation per the hard-won lesson from earlier phases.

**schema.ts:** Extended `projects` table with `ubiNumber`, `lniCertificate`, `wcAccount`; extended `workerClassifications` with `waManualRate`, `waTradeCode`.

**projects.ts:** `CreateProjectSchema` now accepts `ubiNumber`, `lniCertificate`, `wcAccount` (all optional); INSERT stores them.

**workers.ts:** `CreateClassificationSchema` now accepts `waManualRate` (positive number, optional) and `waTradeCode` (string max 10, optional); INSERT stores them.

**export.ts:** New `GET /api/export/f700/:weekId` route gated on `project.state === 'WA'`. Mirrors the A-1-131 route pattern exactly. Maps WA project fields, waTradeCode per worker, and calls `fillF700()`. Returns 400 for non-WA projects, 403 for unauthorized, 404 for missing weeks.

## Test Results

- Wave 0 stubs were RED before Wave 1 (9 failing, 38 passing — regression-free baseline confirmed)
- After Wave 1: all 47 WA-specific tests GREEN
- Full suite: 275 passing, 0 failing (regression-free)

## Deviations from Plan

### Auto-handled Issues

**[Rule 1 - Discovery] Official F700 PDF behind TAM authentication**
- **Found during:** Task 25-01-01
- **Issue:** `https://lni.wa.gov/forms-publications/F700-065-000.pdf` returns 404. All `lni.wa.gov` subdomain patterns tested return 404. `secure.lni.wa.gov/pubs/f700-065-000.pdf` redirects through TAM login (IBM Tivoli Access Manager) — requires portal credentials to download.
- **Fix:** Created a valid placeholder PDF via pdf-lib (612x792 pt, portrait, /Rotate=0, no AcroForm fields) and documented the auth requirement clearly in f700Generator.ts stub header. Plan 25-02 must replace this file.
- **Files modified:** assets/f700-official.pdf, src/server/services/f700Generator.ts (header comments)

## Self-Check

### Files Verified
- FOUND: assets/f700-official.pdf (valid PDF, 1257 bytes)
- FOUND: src/server/services/f700Generator.ts
- FOUND: tests/services/f700.test.ts
- FOUND: src/server/db/migrations/0012_wa_project_fields.sql
- FOUND: src/server/db/migrations/0013_wa_manual_rate.sql
- meta/_journal.json: idx 8 = 0012_wa_project_fields, idx 9 = 0013_wa_manual_rate (CONFIRMED)
- schema.ts: 5 WA columns present (ubiNumber, lniCertificate, wcAccount, waManualRate, waTradeCode)

### Commits Verified
- e3696ad: wave 0 — f700 PDF asset, generator stub, and RED test stubs
- f90990c: wave 1 — WA DB migrations, schema, and route extensions

## Self-Check: PASSED
