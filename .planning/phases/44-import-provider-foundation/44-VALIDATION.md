---
phase: 44-import-provider-foundation
nyquist_compliant: true
---

# Phase 44 Validation Map

## Wave 0: Test Infrastructure

Existing test file `tests/services/importService.test.ts` already covers `detectProvider` and mapper functions. No new test file scaffold needed — Plan 02 extends the existing file with Gusto tests.

No dedicated `gustoMapper.test.ts` is needed because the existing project pattern co-locates mapper tests inside `importService.test.ts` (which already tests `mapQbRows` and `mapAdpRows`).

## Per-Task Verification

### Plan 01 — DB Migration + Schema + Types (Wave 1)

| Task | Requirement | Verification Command | What It Proves |
|------|-------------|---------------------|----------------|
| Task 1: Migration + journal | IMPORT-04, NFR-01 | `grep "CREATE TABLE payroll_provider_mappings" src/server/db/migrations/0027_payroll_provider_mappings.sql && grep "0027" src/server/db/migrations/meta/_journal.json` | Migration file exists with correct table, journal registered at idx 23 |
| Task 1: No breakpoint | NFR-01 | `! grep "statement-breakpoint" src/server/db/migrations/0027_payroll_provider_mappings.sql` | Single-statement file has no breakpoint (correct per NFR-01) |
| Task 2: Schema export | NFR-05 | `grep "payrollProviderMappings" src/server/db/schema.ts` | Drizzle table definition exists |
| Task 2: Type union | IMPORT-06 | `grep "ImportProvider" src/server/services/importTypes.ts` | Named union type exported |
| Task 2: CommitBody | IMPORT-06 | `grep "ImportProvider" src/server/routes/import.ts` | Route uses shared type |
| Task 2: Full compile | NFR-05 | `npx tsc --noEmit` | All type changes are consistent across files |

### Plan 02 — Gusto Parser (Wave 2)

| Task | Requirement | Verification Command | What It Proves |
|------|-------------|---------------------|----------------|
| Task 1: Gusto mapper | IMPORT-01 | `npx vitest run tests/services/importService.test.ts --reporter=verbose` | Name concat, hours on Monday, Double OT to monOt, missing cols error |
| Task 1: Detection | IMPORT-06 | same test file | detectProvider returns 'gusto' for Gusto headers |
| Task 2: Pipeline integration | IMPORT-01 | `npx tsc --noEmit && npx vitest run tests/services/importService.test.ts` | importService calls gustoMapper, types compile, tests pass |

### Plan 03 — Provider Badge UI (Wave 3)

| Task | Requirement | Verification Command | What It Proves |
|------|-------------|---------------------|----------------|
| Task 1: Client type | IMPORT-06 | `npx tsc --noEmit` | Client ImportPreviewResult matches server union |
| Task 2: Label map | IMPORT-06 | `grep "PROVIDER_LABELS" src/client/pages/PayrollWeekDetailPage.tsx` | Badge uses extensible map, not hardcoded ternary |
| Task 2: Gusto banner | IMPORT-06 | `grep "gustoWeeklyTotalsOnly" src/client/pages/PayrollWeekDetailPage.tsx` | Gusto weekly-totals warning renders |

## Phase Gate

Before `/gsd:verify-work`, run:

```bash
npx tsc --noEmit && npx vitest run
```

Both must pass with zero errors.

## Requirement Coverage

| Requirement | Plan(s) | How Verified |
|-------------|---------|-------------|
| IMPORT-04 | 01 | Migration exists, schema exports table, journal registered |
| IMPORT-01 | 02 | Gusto mapper tests: name concat, hours parsing, Double OT, missing cols error |
| IMPORT-06 | 01, 02, 03 | ImportProvider type exported, detectProvider returns 'gusto', badge label map, Gusto banner |
| NFR-01 | 01 | No breakpoint in single-statement migration |
| NFR-05 | 01 | schema.ts exports payrollProviderMappings, payrollImports type updated |
