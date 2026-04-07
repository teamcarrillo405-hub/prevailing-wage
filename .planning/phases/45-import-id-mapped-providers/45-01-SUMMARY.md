---
phase: 45-import-id-mapped-providers
plan: 01
subsystem: payroll-import
tags: [import, paychex, sage-300, sage-100, id-mapping, tdd]
dependency_graph:
  requires: [phase-44-payroll-provider-mappings-table]
  provides: [paychex-mapper, sage300-mapper, id-match-pipeline]
  affects: [importService, importTypes, payrollImportPipeline]
tech_stack:
  added: []
  patterns: [TDD-red-green, provider-mapper-pattern, ID-match-vs-name-match]
key_files:
  created:
    - src/server/services/paychexMapper.ts
    - src/server/services/sage300Mapper.ts
    - tests/services/paychexMapper.test.ts
    - tests/services/sage300Mapper.test.ts
  modified:
    - src/server/services/importTypes.ts
    - src/server/services/importService.ts
    - tests/services/importService.test.ts
decisions:
  - "Sage 100 detection uses Employee Name + Pay Type signature (before QB Online check) to avoid QB misfires"
  - "Sage 300 positional check uses isSage300CRE before Paychex presence check — more specific wins"
  - "DT (double-time) in Sage 300 lumped into OT bucket — consistent with Gusto double-overtime pattern"
  - "providerWorkerId used as csvName display value when worker not yet mapped (placeholder for unmatched rows)"
  - "Worker name used as csvName for matched ID-mapped rows for clarity in preview and audit trail"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-06"
  tasks: 2
  files: 7
---

# Phase 45 Plan 01: Paychex/Sage 300/Sage 100 Mappers + ID-Match Pipeline Summary

**One-liner:** Paychex Flex and Sage 300 CRE CSV parsers with Worker-ID-to-worker resolution via `payroll_provider_mappings`; Sage 100 name-based path follows existing QB/ADP/Gusto pattern.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create paychexMapper.ts and sage300Mapper.ts with tests | 154db2e | paychexMapper.ts, sage300Mapper.ts, importTypes.ts, paychexMapper.test.ts, sage300Mapper.test.ts |
| 2 | Extend detectProvider() and parseImportFile() with ID-match path | a7c93ab | importService.ts, importService.test.ts |

---

## What Was Built

### Task 1: New Mapper Modules

**`src/server/services/paychexMapper.ts`**
- `mapPaychexRows(rows)` — aggregates by `Worker ID` (raw string key); routes `Pay Component` case-insensitively: `'regular'` → ST, `'overtime'` → OT; `Line Date` parsed via `parseLineDate()` (manual MM/DD/YYYY split, never `new Date(string)`)
- `PaychexAggregated` interface with `providerWorkerId: string` (not `csvName`) + 14 day buckets
- Returns `{ entries: Map<string, PaychexAggregated>; paychexWeeklyTotalsOnly: false }` — daily data available

**`src/server/services/sage300Mapper.ts`**
- `isSage300CRE(fields)` — checks first 9 headers against `SAGE_300_POSITIONAL_COLS` positionally (case-insensitive)
- `mapSage300Rows(rows)` — keyed by `Employee` field (numeric ID as `providerWorkerId`); `PayID`: `REG`→ST, `OT`→OT, `DT`→OT (double-time lumped per established pattern); unknown PayIDs silently skipped
- `mapSage100Rows(rows)` — keyed by `Employee Name` lowercase (`csvName`); name-based path, no ID mapping
- `Sage300Aggregated` and `Sage100Aggregated` interfaces

**`src/server/services/importTypes.ts`**
- Added `'sage_100'` to `ImportProvider` union
- Added `idMappingRequired?: boolean` and `unmappedIds?: string[]` to `ImportPreviewResult`

### Task 2: Pipeline Integration

**`src/server/services/importService.ts`**
- `detectProvider()` return type widened to `ImportProvider | 'unknown'`
- Detection priority order (most specific first):
  1. Gusto (4-col signature)
  2. Sage 300 (positional 9-col via `isSage300CRE`)
  3. Sage 100 (`Employee Name` + `Pay Type` — before QB Online to avoid misfires)
  4. QuickBooks Desktop / Online
  5. Paychex (`Pay Component` + `Worker ID`)
  6. ADP
  7. unknown
- `parseImportFile()` dual-path:
  - **ID-match path** (Paychex, Sage 300): queries `payroll_provider_mappings` WHERE `(projectId, provider, providerWorkerId IN [...])`, builds `workerIdLookup` for ID-to-worker resolution, sets `idMappingRequired` and `unmappedIds`
  - **Name-match path** (QB, ADP, Gusto, Sage 100): existing `nameLookup` pattern unchanged
- Error message updated to list all 6 supported providers

---

## Test Results

**Total: 168 tests pass, 0 failures**

| Test File | Tests | Status |
|-----------|-------|--------|
| tests/services/paychexMapper.test.ts | 15 | PASS |
| tests/services/sage300Mapper.test.ts | 25 | PASS |
| tests/services/importService.test.ts | 56 (32 new) | PASS |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Sage 100 detection would misfire as QB Online**
- **Found during:** Task 2 (TDD red phase revealed the issue)
- **Issue:** QB Online signature is `['Employee Name', 'Hours']` — same two columns appear in Sage 100 exports. Sage 100 was never reached because QB detection came first.
- **Fix:** Added `Pay Type` to the Sage 100 signature (`SAGE_100_SIGNATURE = ['Employee Name', 'Pay Type']`) and placed Sage 100 detection BEFORE QB Online in priority order. QB Online test `['Employee Name', 'Date', 'Hours', 'Customer/Project']` correctly returns `'quickbooks'` (no `Pay Type` column); Sage 100 test `['Employee Name', 'Date', 'Hours', 'Pay Type']` correctly returns `'sage_100'`.
- **Files modified:** src/server/services/importService.ts
- **Commit:** a7c93ab

**2. [Rule 2 - Missing functionality] Old nameLookup block left outside name-match path**
- **Found during:** Task 2 implementation review
- **Issue:** The original `nameLookup` Map construction was at function scope (lines 246-259 in original). After refactoring to dual-path, this would have caused a duplicate `nameLookup` declaration and TS error.
- **Fix:** Removed the orphaned block; `nameLookup` is now built inside the name-match path block only.
- **Files modified:** src/server/services/importService.ts
- **Commit:** a7c93ab

---

## Known Stubs

None. All ID-match and name-match logic is fully wired. The `idMappingRequired` / `unmappedIds` fields are populated from live DB queries.

Note: The Step 2b modal UI (mapping table for unmapped IDs) is planned for Phase 45 Plan 02. The server-side data is ready; the client doesn't yet display it.

---

## Decisions Made

1. **Sage 100 detection signature includes `Pay Type`** — distinguishes Sage 100 from QB Online which also has `Employee Name` + `Hours`. Alternative of making QB Online more specific was rejected (would break existing single-column QB exports).
2. **Sage 300 positional check before Paychex** — positional is more specific than 2-col presence; prevents false positives on Sage 300 exports that might happen to have non-Sage columns.
3. **DT→OT for Sage 300** — consistent with existing Gusto double-overtime behavior (lumped into OT bucket per IMPORT-01 decision).
4. **Worker name as csvName for matched ID-mapped rows** — cleaner display in preview and audit trail than showing a numeric employee ID.

---

## Self-Check: PASSED

Files exist:
- FOUND: src/server/services/paychexMapper.ts
- FOUND: src/server/services/sage300Mapper.ts
- FOUND: tests/services/paychexMapper.test.ts
- FOUND: tests/services/sage300Mapper.test.ts

Commits exist:
- FOUND: 154db2e (Task 1)
- FOUND: a7c93ab (Task 2)
