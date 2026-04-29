# Phase 91 Validation Checklist — Minnesota Certified Payroll (STATE-14)

## Automated

- [ ] `npm test -- tests/services/mnPdfGenerator.test.ts` — all 5 tests pass
- [ ] `npm test` — full suite passes (no regressions)
- [ ] `npx tsc --noEmit` — no new type errors (pre-existing workers.ts errors are known non-fatal)

## Artifacts

- [ ] `src/server/services/mnPdfGenerator.ts` exists and exports `fillMnCertifiedPayroll` + `MnPdfInput`
- [ ] `src/server/routes/export.ts` contains `/mn-dli/:weekId` route handler
- [ ] `src/server/db/migrations/0055_phase91_mn_project_fields.sql` contains `ALTER TABLE projects ADD COLUMN mn_contract_id TEXT`
- [ ] `src/server/db/migrations/meta/_journal.json` contains `idx: 55` entry with tag `0055_phase91_mn_project_fields`
- [ ] `src/server/db/schema.ts` contains `mnContractId: text('mn_contract_id')`
- [ ] `src/client/pages/PayrollWeekDetailPage.tsx` STATE_FORMS contains `MN: { downloadLabel: 'Download MN DLI Payroll', route: 'mn-dli' }`

## PDF Content (visual inspection)

- [ ] Page 1 title: "MINNESOTA CERTIFIED PAYROLL REPORT"
- [ ] Day column order is Monday-first (Mo-Tu-We-Th-Fr-Sa-Su)
- [ ] Worker row shows Name on line 1, XXX-XX-XXXX on line 2
- [ ] null optional fields render as blank (not "0.00")
- [ ] Page 2: "STATEMENT OF COMPLIANCE" with citation to Minn. Stat. 177.42
- [ ] Page 2: Signature / Title / Date lines present

## State Gate

- [ ] MN project → 200 + PDF download
- [ ] Non-MN project → 400 `{ error: 'MN DLI Payroll is only available for Minnesota projects' }`
- [ ] Unauthenticated request → 401 (requireAuth middleware)
