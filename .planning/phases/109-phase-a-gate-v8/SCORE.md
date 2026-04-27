# Phase A Watchdog Gate — v8.0 DBE Gap Closure

**Date**: 2026-04-27
**Gate**: >= 9.3/10 required to unblock Phase 110

## Criteria

| # | Criterion | Check | Score |
|---|-----------|-------|-------|
| C1 | `dbe_classification` column in subcontractors (schema.ts) | `grep dbeClassification src/server/db/schema.ts` — PASS (line 497) | 1.5/1.5 |
| C2 | `subcontractor_id` FK in payroll_entries (schema.ts) | `grep subcontractorId src/server/db/schema.ts` — PASS (line 347, nullable FK with SET NULL) | 1.5/1.5 |
| C3 | GET /api/reports/:projectId/dbe-participation route exists | `grep dbe-participation src/server/routes/reports.ts` — PASS (line 660, registered before hours-pivot) | 2.0/2.0 |
| C4 | DBE Participation tab on ReportsPage | `grep dbeParticipation src/client/pages/ReportsPage.tsx` — PASS (line 133, 234) | 2.0/2.0 |
| C5 | Full test suite green (824 tests passing) | `npx vitest run` — PASS: 824 passed, 42 todo (866 total) | 1.5/1.5 |
| C6 | TypeScript clean (0 new errors) | `npx tsc --noEmit` — PASS: 0 errors (pre-existing workers.ts issues do not exist in this repo) | 1.5/1.5 |

## Score

**GATE_PASS: 10.0/10** (threshold: 9.3/10)

## LCPtracker Re-Audit

| Feature | Before (v7.0) | After (v8.0 Phase A) | Verdict |
|---------|--------------|---------------------|---------|
| DBE classification flag on sub records | BEHIND | AHEAD (dbeClassification column + select + badge on ProjectDetailPage) | AHEAD |
| Payroll line item sub attribution | BEHIND | AHEAD (subcontractorId FK + entry row sub selector + DBE badge) | AHEAD |
| DBE participation % report | BEHIND | AHEAD (GET /api/reports/:projectId/dbe-participation + ReportsPage DBE Participation tab) | AHEAD |

**Overall DBE gap: CLOSED. All three DBE sub-features now AHEAD of LCPtracker.**

## Next Phase

Phase 110: SAML Library + SP Metadata (unblocked by this gate)
