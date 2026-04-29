---
phase: 93
slug: phase-b-watchdog-gate
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-27
---

# Phase 93 — Validation Strategy

> Gate phase: validation is the plan. All checks are automated file/grep/test commands.
> No new production code is written. The artifact under test is 93-SCORE.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing), bash file/grep checks |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `cd /c/Users/glcar/prevailing-wage && npx vitest run --exclude ".worktrees/**" 2>&1 \| tail -5` |
| **Full suite command** | `cd /c/Users/glcar/prevailing-wage && npx vitest run --exclude ".worktrees/**"` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After Task 1:** Verify all 10 bash checks completed and raw results are noted
- **After Task 2:** Confirm 93-SCORE.md exists and contains GATE_PASS or GATE_FAIL
- **No mid-phase sampling needed:** Two sequential tasks with immediate feedback

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 93-01-01 | 01 | 1 | COMP-06,COMP-07,COMP-08,INT-01,INT-02,STATE-14,STATE-15 | file+grep | See 10 criterion checks in PLAN Task 1 | pending |
| 93-01-02 | 01 | 1 | all | file-exists | `test -f .planning/phases/93-phase-b-watchdog-gate/93-SCORE.md && grep -q "GATE_PASS\|GATE_FAIL" .planning/phases/93-phase-b-watchdog-gate/93-SCORE.md` | pending |

---

## Gate Criteria Reference

These are the 10 scored criteria. Each is 1.0 point.

| ID  | Phase | Requirement | Bash Command | Pass Condition |
|-----|-------|-------------|--------------|----------------|
| C1  | 88 | COMP-06 | `grep -c "0 3 \* \* 0" src/server/index.ts` AND `grep -c "StaleWdBanner\|lastFetchedAt\|days ago" src/client/pages/ProjectDetailPage.tsx` | cron count >= 1 AND banner count >= 2 |
| C2  | 88 | COMP-07 | `grep -c "wdRevisionLog" src/server/db/schema.ts` AND `grep -c "wdRevisionLog" src/server/services/wdolSync.ts` | both >= 1 |
| C3  | 89 | COMP-08 | `grep -c "WH347_FORM_REVISION" src/server/services/wh347Generator.ts` | count >= 1 |
| C4  | 89 | COMP-08 | `grep -c "deduction-ratio\|deductionRatio" src/server/services/complianceService.ts` AND `grep -c "CIVIL_PENALTY_PER_VIOLATION" src/client/pages/ProjectDetailPage.tsx` | both >= 1 |
| C5  | 90 | INT-01 | `grep -c "getProcoreConnection\|saveProcoreTokens\|deleteProcoreTokens\|getValidProcoreToken" src/server/services/procoreService.ts` | count >= 3 |
| C6  | 90 | INT-02 | `grep -c "procore/connect\|procore/callback\|procore/status" src/server/routes/integrations.ts` AND `grep -c "Procore\|procore" src/client/pages/IntegrationsPage.tsx` | both >= 2 |
| C7  | 91 | STATE-14 | `grep -c "fillMnCertifiedPayroll" src/server/services/mnPdfGenerator.ts` AND `grep -c "mn-dli" src/server/routes/export.ts` | both >= 1 |
| C8  | 91 | STATE-14 | `grep -c "MN\|mn-dli\|mnPdf\|Minnesota" src/client/pages/PayrollWeekDetailPage.tsx` | count >= 1 |
| C9  | 92 | STATE-15 | `grep -c "fillVaCertifiedPayroll" src/server/services/vaPdfGenerator.ts` AND `grep -c "va-doli" src/server/routes/export.ts` | both >= 1 |
| C10 | 92 | STATE-15 | `grep -c "VA\|va-doli\|vaPdf\|Virginia" src/client/pages/PayrollWeekDetailPage.tsx` | count >= 1 |

## Integrity Checks (deductions, not scored criteria)

| Check | Command | Deduction if failing |
|-------|---------|----------------------|
| Full test suite green | `npx vitest run --exclude ".worktrees/**" 2>&1 \| tail -3` | -0.5 |
| No new TS errors | `npx tsc --noEmit 2>&1 \| grep -v "workers.ts" \| grep "error TS" \| wc -l` | -0.5 if count > 0 |

---

## Migration Collision Note

Phases 88, 90, and 91 each planned a migration at index 55 with different file names:
- Phase 88 planned: `0055_wd_revision_log.sql`
- Phase 90 planned: `0055_procore_connections.sql`
- Phase 91 planned: `0055_phase91_mn_project_fields.sql`

Only one can occupy idx 55 in `_journal.json`. The executor must check which file actually
exists and document the resolution in 93-SCORE.md Notes. Criteria C2, C5, and C7 are scored
against actual source code exports (not migration file presence), so this collision does not
directly cause a scoring failure — but missing migrations may cause runtime errors that
should be flagged for remediation.

---

## Manual-Only Verifications (excluded from score)

| Behavior | Requirement | Why Excluded |
|----------|-------------|--------------|
| Procore OAuth connect/disconnect works end-to-end | INT-01 | Requires live PROCORE_CLIENT_ID/SECRET + browser session |
| Procore timesheet import preview shows real data | INT-02 | Requires Procore sandbox project + live tokens |
| MN form passes visual inspection against MN DLI template | STATE-14 | Requires rendering PDF + side-by-side visual comparison |
| VA form passes visual inspection against VA DOLI template | STATE-15 | Requires rendering PDF + side-by-side visual comparison |
| Live SAM.gov WD fetch returns a real revision bump | COMP-06 | Requires SAMGOV_API_KEY + live network call to SAM.gov |

These are real requirements but cannot be mechanically verified in a CI context.
They are noted in 93-SCORE.md under Notes as "manual deferred."

---

## Wave 0 Requirements

None. This phase creates no new source files — only the 93-SCORE.md evidence document.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity: 2-task plan with verification after each
- [x] No Wave 0 needed (no new test stubs required)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
