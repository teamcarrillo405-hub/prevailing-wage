---
phase: 70
plan: 1
subsystem: compliance-engine
tags: [apprenticeship, comp-04, comp-05, ira-iija, schema, workers, projects]
requirements: [APP-01, APP-02, APP-03, APP-04, APP-05]
key-files:
  created:
    - src/server/services/complianceApprenticeRatio.test.ts
    - src/server/db/migrations/0042_phase70_apprenticeship_ratio.sql
  modified:
    - src/server/db/schema.ts
    - src/server/services/complianceService.ts
    - src/server/services/workerService.ts
    - src/server/routes/workers.ts
    - src/server/routes/projects.ts
    - src/client/components/projects/ProjectForm.tsx
    - src/client/pages/WorkersPage.tsx
    - src/client/pages/PayrollWeekDetailPage.tsx
decisions:
  - COMP-04 trade matching uses case-insensitive substring match to handle "Electrician" vs "IBEW Electrician" variance
  - COMP-05 threshold is inclusive (exactly 15% does not trigger violation)
  - Estimated liability = excess_hours × (avg_jw_rate − avg_apprentice_rate) using snapshot rates
  - Trade ratio UI uses uncontrolled local state (not react-hook-form) since it's a dynamic list
metrics:
  duration: 45m
  completed: 2026-04-25
  tasks: 7
  files: 11
tech-stack:
  patterns:
    - WeekViolation union type extended with 'apprentice-trade-ratio' | 'ira-iija-apprentice-pct'
    - Per-trade hour aggregation using Map<string, number> keyed by tradeDescription
---

# Phase 70: Per-Trade Apprenticeship Ratio Enforcement Summary

Per-trade daily apprenticeship ratio enforcement with dollar-denominated wage liability estimates (COMP-04) and IRA/IIJA 15% apprenticeship hour requirement (COMP-05).

## Schema Additions

**workers table** (migration 0042):
- `apprenticeship_program_name TEXT` — DOL-registered apprenticeship program name
- `rapids_number TEXT` — RAPIDS (Registered Apprenticeship Partners Information Data System) number

**projects table** (migration 0042):
- `apprenticeship_requirements TEXT` — JSON map: `{ "Electrician": { "maxRatio": "1:2" }, ... }`
- `is_ira_iija_project INTEGER (boolean)` — flags IRA/IIJA clean energy projects for 15% enforcement

Both columns applied to local SQLite DB via `ALTER TABLE` (pnpm db:migrate had a dialect conflict; manual ALTER used as documented fallback for dev environment).

## COMP-04: Per-Trade Daily Apprenticeship Ratio

Logic runs when `project.apprenticeshipRequirements` is set (non-null):

1. Aggregate JW/apprentice hours and base rate snapshots by `tradeDescription`
2. For each configured trade in `apprenticeshipRequirements`:
   - Match against payroll row `tradeDescription` (case-insensitive substring match)
   - Parse ratio string `"N:M"` → max_allowed_apprentice_hours = jw_hours × N/M
   - If apprentice_hours > max_allowed + 0.001 (tolerance):
     - excess_hours = apprentice_hours − max_allowed
     - estimated_liability = excess_hours × max(0, avg_jw_rate − avg_app_rate)
     - Push `WeekViolation { violationType: 'apprentice-trade-ratio', trade, excessHours, estimatedLiabilityUsd }`

Detail string format: `"Trade: Electrician — 6.0 apprentice hrs vs 8.0 JW hrs (max ratio 1:2). Excess: 2.0 hrs. Est. wage adjustment: $60.00"`

## COMP-05: IRA/IIJA 15% Apprenticeship Requirement

Runs when `project.isIraIijaProject === true`:

- Sum total hours and apprentice hours across all entries for the week
- If `apprentice_hours / total_hours < 0.15`:
  - Push `WeekViolation { violationType: 'ira-iija-apprentice-pct', actualPct, totalHours, apprenticeHours }`

Detail string format: `"IRA/IIJA: Apprentice hours are 9.1% of total — below 15% requirement for tax credit eligibility."`

## UI Changes

**ProjectForm** (`src/client/components/projects/ProjectForm.tsx`):
- Shown when `fundingType === 'federal' || fundingType === 'state'`
- IRA/IIJA checkbox: `isIraIijaProject` boolean
- Dynamic trade ratio table: add/remove rows with trade name + ratio string; serialized to `apprenticeshipRequirements` JSON on submit

**WorkersPage** (`src/client/pages/WorkersPage.tsx`):
- Add worker form: `Apprenticeship Program Name` + `RAPIDS Number` shown when `laborType === 'apprentice'`
- Edit worker form: same fields shown when `worker.classifications.some(c => c.laborType === 'apprentice')`
- Both fields passed through to server create/update mutations

**PayrollWeekDetailPage** (`src/client/pages/PayrollWeekDetailPage.tsx`):
- `WeekViolation` interface extended with `'apprentice-trade-ratio' | 'ira-iija-apprentice-pct'` types
- Both violation display locations updated to show badge labels "Trade Ratio" and "IRA/IIJA" respectively
- `detail` string from server is rendered as-is (contains full human-readable description)

## Tests

New test file: `src/server/services/complianceApprenticeRatio.test.ts`

13 tests across two describe blocks:
- COMP-04 (7 tests): ratio satisfied, exceeded, at boundary, null config, no apprentices, 1:1 ratio, detail string format
- COMP-05 (6 tests): at/above 15%, below 15%, non-IRA project, zero hours, exactly 15%, detail string format

Test results: **724 total passing** (up from 711), 0 failures, 0 TypeScript errors.

## Deviations from Plan

**1. [Rule 3 - Blocking] `pnpm db:migrate` dialect conflict**
- Found during: Schema step
- Issue: `drizzle-kit migrate` exited with code 1 — existing migration journal had dialect version conflicts with the full-schema migration file generated by drizzle-kit
- Fix: Applied ALTER TABLE statements directly to dev SQLite DB via `node better-sqlite3`; created named migration file `0042_phase70_apprenticeship_ratio.sql` with the 4 ALTER statements; updated journal
- Files modified: `_journal.json`, `0042_phase70_apprenticeship_ratio.sql`

## Self-Check: PASSED

- `src/server/services/complianceApprenticeRatio.test.ts` — exists
- `src/server/db/migrations/0042_phase70_apprenticeship_ratio.sql` — exists
- Commit `36c4537` — verified in git log
- 724 tests passing — verified
- TypeScript: 0 errors — verified
