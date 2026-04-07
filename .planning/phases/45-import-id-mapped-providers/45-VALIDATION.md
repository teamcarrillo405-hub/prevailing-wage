# Phase 45: Import ID-Mapped Providers — Validation

**nyquist_compliant:** true

---

## Wave 0 Status: SATISFIED

Test infrastructure extends existing files:
- `tests/services/importService.test.ts` — exists, add new describe blocks for Paychex/Sage detection
- `tests/services/paychexMapper.test.ts` — NEW, created in Plan 01 Task 1 (TDD: tests written before implementation)
- `tests/services/sage300Mapper.test.ts` — NEW, created in Plan 01 Task 1 (TDD: tests written before implementation)

No separate Wave 0 plan needed — Plan 01 uses `tdd="true"` and writes tests as part of the red-green cycle.

---

## Per-Task Verification Map

### Plan 01 — Parsers + Detection (Wave 1)

| Req ID | Behavior | Task | Automated Command |
|--------|----------|------|-------------------|
| IMPORT-02 | detectProvider returns 'paychex' for Pay Component + Worker ID headers | Task 2 | `npx vitest run tests/services/importService.test.ts` |
| IMPORT-02 | mapPaychexRows aggregates by Worker ID, places hours in day buckets from Line Date | Task 1 | `npx vitest run tests/services/paychexMapper.test.ts` |
| IMPORT-02 | Paychex Pay Component matching is case-insensitive; unknown components skipped | Task 1 | `npx vitest run tests/services/paychexMapper.test.ts` |
| IMPORT-02 | Paychex Line Date parsed via manual split (not new Date(string)) | Task 1 | `npx vitest run tests/services/paychexMapper.test.ts` |
| IMPORT-03 | detectProvider returns 'sage_300' for positional 9-column headers | Task 2 | `npx vitest run tests/services/importService.test.ts` |
| IMPORT-03 | mapSage300Rows maps PayID REG/OT/DT to correct buckets | Task 1 | `npx vitest run tests/services/sage300Mapper.test.ts` |
| IMPORT-03 | detectProvider returns 'sage_100' for name-based Sage format | Task 2 | `npx vitest run tests/services/importService.test.ts` |
| IMPORT-03 | mapSage100Rows uses name-based path (csvName, not providerWorkerId) | Task 1 | `npx vitest run tests/services/sage300Mapper.test.ts` |
| IMPORT-05 | ImportPreviewResult has idMappingRequired + unmappedIds fields | Task 1 | `npx tsc --noEmit` |
| IMPORT-05 | parseImportFile sets idMappingRequired=true for Paychex with unmapped IDs | Task 2 | `npx vitest run tests/services/importService.test.ts` |

### Plan 02 — Mapping API Routes (Wave 2)

| Req ID | Behavior | Task | Automated Command |
|--------|----------|------|-------------------|
| IMPORT-05 | GET /mappings/:projectId returns existing provider mappings | Task 1 | `npx tsc --noEmit` |
| IMPORT-05 | POST /mappings upserts mappings via onConflictDoUpdate | Task 1 | `npx tsc --noEmit` |
| NFR-03 | GET /mappings calls assertProjectAccess before DB query | Task 1 | `npx tsc --noEmit` |
| NFR-03 | POST /mappings calls assertProjectAccess before DB write | Task 1 | `npx tsc --noEmit` |

### Plan 03 — Step 2b UI (Wave 3)

| Req ID | Behavior | Task | Automated Command |
|--------|----------|------|-------------------|
| IMPORT-05 | importStep type widened to `1 \| '2b' \| 2 \| 3` | Task 1 | `npx tsc --noEmit` |
| IMPORT-05 | handleImportPreview routes to Step 2b when idMappingRequired=true | Task 1 | `npx tsc --noEmit` |
| IMPORT-05 | Step 2b shows unmappedIds with worker dropdown per row | Task 1 | Manual (checkpoint Task 2) |
| IMPORT-05 | Save Mappings & Continue posts to API then re-calls preview | Task 1 | Manual (checkpoint Task 2) |
| IMPORT-05 | Re-import with all IDs mapped skips Step 2b entirely | Task 1 | Manual (checkpoint Task 2) |
| IMPORT-05 | closeImportModal resets idMappings state | Task 1 | `npx tsc --noEmit` |

---

## Full Suite Command

```bash
npx vitest run tests/services/importService.test.ts tests/services/paychexMapper.test.ts tests/services/sage300Mapper.test.ts && npx tsc --noEmit
```

---

## Manual Verification (Plan 03, Checkpoint)

1. Upload Paychex CSV -> Step 2b appears with mapping table
2. Map workers -> Save & Continue -> Step 2 shows resolved entries
3. Re-upload same CSV -> Step 2b skipped (auto-match)
4. Upload QB/ADP/Gusto/Sage 100 CSV -> Step 2b NOT shown
5. Close and reopen modal -> all state reset to Step 1
