# Phase 43: IL State Forms -- Validation Map

**nyquist_compliant:** true (all tasks have automated verify commands)

---

## Wave 0: Test Stubs (Failing Tests First)

| File | Status | Stubs |
|------|--------|-------|
| `tests/services/ilPdfGenerator.test.ts` | NEW (Plan 02, Task 1) | 3 failing stubs: non-empty Uint8Array, round-trip PDFDocument.load(), exactly 2 pages |

**Automated check:**
```bash
npx vitest run tests/services/ilPdfGenerator.test.ts 2>&1 | tail -5
# Expected: 3 FAIL (RED state -- generator does not exist yet)
```

---

## Per-Task Verification Map

### Plan 01: Migration + Schema + Service (Wave 1)

| Task | What | Automated Command | Expected |
|------|------|-------------------|----------|
| 01-T1 | Migration 0026 + schema.ts | `npx tsc --noEmit` | Clean compile |
| 01-T2 | setIlIdolSubmitted service | `npx tsc --noEmit && grep -c "setIlIdolSubmitted" src/server/services/payrollService.ts` | Compile clean, count >= 1 |

**Post-plan validation:**
```bash
cat src/server/db/migrations/0026_il_idol_submission.sql
# Expected: ALTER TABLE payroll_weeks ADD COLUMN il_idol_submitted_at TEXT;
# NO statement-breakpoint separator

grep "ilIdolSubmittedAt" src/server/db/schema.ts
# Expected: ilIdolSubmittedAt: text('il_idol_submitted_at')

grep "setIlIdolSubmitted" src/server/services/payrollService.ts
# Expected: export async function setIlIdolSubmitted
```

---

### Plan 02: IL PDF Generator TDD (Wave 2)

| Task | What | Automated Command | Expected |
|------|------|-------------------|----------|
| 02-T1 (RED) | 3 failing test stubs | `npx vitest run tests/services/ilPdfGenerator.test.ts 2>&1 \| tail -5` | 3 FAIL |
| 02-T2 (GREEN) | Generator implementation | `npx vitest run tests/services/ilPdfGenerator.test.ts` | 3 PASS |

**Post-plan validation:**
```bash
npx vitest run tests/services/ilPdfGenerator.test.ts
# Expected: 3 tests passed

npx tsc --noEmit
# Expected: Clean compile

grep "fillIlCertifiedTranscript" src/server/services/ilPdfGenerator.ts
# Expected: export async function fillIlCertifiedTranscript

grep "IlPdfInput" src/server/services/ilPdfGenerator.ts
# Expected: export interface IlPdfInput
```

---

### Plan 03: Export Route + Submit Route + Tests (Wave 3)

| Task | What | Automated Command | Expected |
|------|------|-------------------|----------|
| 03-T1 | Routes (export + submit) | `npx tsc --noEmit` | Clean compile |
| 03-T2 | Integration tests | `npx vitest run tests/routes/export.test.ts tests/routes/payroll.test.ts` | All pass (existing + 4 new) |

**Post-plan validation:**
```bash
npx vitest run tests/routes/export.test.ts tests/routes/payroll.test.ts
# Expected: all tests pass including 4 new IL tests

grep "il-pdf" src/server/routes/export.ts
# Expected: router.get('/il-pdf/:weekId'

grep "il-submit" src/server/routes/payroll.ts
# Expected: router.patch('/weeks/:id/il-submit'

grep "assertProjectAccess" src/server/routes/export.ts | grep -c "il-pdf" || true
# Verify assertProjectAccess is used in the il-pdf route
```

---

### Plan 04: Frontend 2-Step Modal (Wave 4)

| Task | What | Automated Command | Expected |
|------|------|-------------------|----------|
| 04-T1 | Modal implementation | `npx tsc --noEmit` | Clean compile |
| 04-T2 | Human verify | Manual: open IL project, test full modal flow | Approved |

**Post-plan validation:**
```bash
npx tsc --noEmit
# Expected: Clean compile

grep "showIlIdolModal" src/client/pages/PayrollWeekDetailPage.tsx
# Expected: state variable present

grep "ilIdolSubmittedAt" src/client/pages/PayrollWeekDetailPage.tsx
# Expected: present in PayrollWeek interface + JSX rendering

grep "Coming in Phase 43" src/client/pages/PayrollWeekDetailPage.tsx
# Expected: NO matches (placeholder replaced)
```

---

## Full Suite Validation

After all 4 plans complete:

```bash
# Full test suite
npx vitest run

# TypeScript compilation
npx tsc --noEmit

# Verify no Phase 42 placeholders remain
grep -r "Coming in Phase 43" src/client/ || echo "All placeholders replaced"
```

---

## Requirements Coverage

| Req ID | Plan(s) | Verified By |
|--------|---------|-------------|
| STATE-08 | Plan 02 (generator), Plan 03 (route) | `npx vitest run tests/services/ilPdfGenerator.test.ts tests/routes/export.test.ts` |
| STATE-11 | Plan 01 (schema), Plan 03 (submit route), Plan 04 (modal) | `npx vitest run tests/routes/payroll.test.ts` + manual modal test |
| NFR-03 | Plan 03 (assertProjectAccess in routes) | `npx vitest run tests/routes/export.test.ts tests/routes/payroll.test.ts` (403 tests) |
