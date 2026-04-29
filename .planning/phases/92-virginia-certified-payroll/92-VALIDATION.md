# Phase 92 Validation Checklist — Virginia Certified Payroll (STATE-15)

## Automated

- [ ] `npm test -- tests/services/vaPdfGenerator.test.ts` — all 5 tests pass
- [ ] `npm test` — full suite passes (no regressions)
- [ ] `npx tsc --noEmit` — no new type errors (pre-existing workers.ts errors are known non-fatal)

## Artifacts

- [ ] `src/server/services/vaPdfGenerator.ts` exists and exports `fillVaCertifiedPayroll` + `VaPdfInput`
- [ ] `src/server/routes/export.ts` contains `/va-doli/:weekId` route handler
- [ ] `src/server/db/migrations/0056_phase92_va_project_fields.sql` contains `ALTER TABLE projects ADD COLUMN va_contract_id TEXT`
- [ ] `src/server/db/migrations/meta/_journal.json` contains `idx: 56` entry with tag `0056_phase92_va_project_fields`
- [ ] `src/server/db/schema.ts` contains `vaContractId: text('va_contract_id')`
- [ ] `src/client/pages/PayrollWeekDetailPage.tsx` STATE_FORMS contains `VA: { downloadLabel: 'Download VA DOLI Payroll', route: 'va-doli' }`

## PDF Content (visual inspection)

- [ ] Page 1 title: "VIRGINIA CERTIFIED PAYROLL REPORT"
- [ ] Day column order is Monday-first (Mo-Tu-We-Th-Fr-Sa-Su)
- [ ] Worker row shows Name on line 1, XXX-XX-XXXX on line 2
- [ ] null optional fields render as blank (not "0.00")
- [ ] Page 2: "STATEMENT OF COMPLIANCE" with citation to Va. Code § 2.2-4360
- [ ] Page 2: Signature / Title / Date lines present

## State Gate

- [ ] VA project → 200 + PDF download
- [ ] Non-VA project → 400 `{ error: 'VA DOLI Payroll is only available for Virginia projects' }`
- [ ] Unauthenticated request → 401 (requireAuth middleware)
