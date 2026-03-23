---
phase: 21
slug: payroll-amendment-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 + supertest ^7.2.2 |
| **Config file** | `vitest.config.ts` (`setupFiles: ['./tests/helpers/db.ts']`) |
| **Quick run command** | `npx vitest run tests/routes/payroll.test.ts` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/payroll.test.ts`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite green + manual browser verification of amendment flow
- **Max feedback latency:** 12 seconds (automated) + 5 minutes (manual: amend a submitted week, verify PDF label, check original read-only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 21-01-01 | 01 | 1 | AMD-01, AMD-02 | unit | `npx vitest run tests/routes/payroll.test.ts` | — | ⬜ pending |
| 21-01-02 | 01 | 1 | AMD-03 | unit | `npx vitest run tests/routes/payroll.test.ts` | — | ⬜ pending |
| 21-02-01 | 02 | 2 | AMD-01, AMD-02 | shell+manual | `npx vitest run` | "Amend This Week" button on submitted weeks; badge on PayrollListPage; original stays read-only | ⬜ pending |
| 21-02-02 | 02 | 2 | AMD-03 | shell+manual | `npx vitest run` | Download WH-347 for amendment week; verify "N (AMENDED M)" payroll number label | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/payroll.test.ts` — add describe block: `POST /api/payroll/weeks/amend` — covers AMD-01/AMD-02 (creates amendment week with cloned rates, correct amendment_number, original_week_id)
- [ ] `tests/routes/payroll.test.ts` — add describe block: amendment numbering — multiple amendments to same week are sequential
- [ ] `tests/routes/payroll.test.ts` — add describe block: PDF payroll number format — `GET /api/payroll/weeks/:id/export` returns "N (AMENDED M)" for amendment weeks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Amend This Week" button on submitted weeks | AMD-01 | UI button rendering requires browser | Open a submitted payroll week — "Amend This Week" button visible in Submission Status panel |
| Amendment badge on PayrollListPage | AMD-01 | Badge rendering requires browser | After amending, return to payroll list — amendment week shows "Amendment #N" badge |
| Original week stays read-only | AMD-02 | UI lock state requires browser | Open the original submitted week after amendment created — entry form still locked |
| WH-347 "N (AMENDED M)" label | AMD-03 | PDF rendering requires browser | Download WH-347 for amendment week — payroll number shows correct format |
| Sequential amendment numbering | AMD-01 | Multi-step flow requires browser | Create two amendments to same week — second shows Amendment #2 |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npx vitest run tests/routes/payroll.test.ts`)
- [ ] Sampling continuity: regression suite after each task commit
- [ ] Wave 0: 3 test describe blocks written before implementation
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 5min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
