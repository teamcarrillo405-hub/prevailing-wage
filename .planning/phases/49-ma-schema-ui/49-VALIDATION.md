---
phase: 49
slug: ma-schema-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/routes/export.test.ts tests/routes/workers.test.ts tests/routes/payroll.test.ts --reporter=verbose 2>&1 \| tail -30` |
| **Full suite command** | `npx vitest run --exclude ".claude/**"` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 49-01-01 | 01 | 1 | NFR-01, MA-01 | compile + grep | `npx tsc --noEmit && grep -c "0029_ma_schema" src/server/db/migrations/meta/_journal.json` | pending |
| 49-01-02 | 01 | 1 | MA-02 | integration | `npx vitest run tests/routes/workers.test.ts --reporter=verbose 2>&1 \| tail -30` | pending |
| 49-02-01 | 02 | 2 | MA-03 | integration | `npx vitest run tests/routes/payroll.test.ts --reporter=verbose 2>&1 \| tail -30` | pending |
| 49-03-01 | 03 | 3 | MA-01 | integration | `npx vitest run tests/routes/export.test.ts --reporter=verbose 2>&1 \| tail -30` | pending |
| 49-03-02 | 03 | 3 | MA-01 | compile + grep | `npx tsc --noEmit && grep -n "ma-cpr" src/server/routes/export.ts` | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing test infrastructure covers all phase requirements. New test cases added to existing files within their plans:

- [ ] MA-02 worker nullable boolean tests in `tests/routes/workers.test.ts` (Plan 01 Task 2)
- [ ] MA-03 payroll entry MA field tests in `tests/routes/payroll.test.ts` (Plan 02 Task 1)
- [ ] MA-01 state gate tests in `tests/routes/export.test.ts` (Plan 03 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MA project form shows MA DLS Project ID and SIC/Trade Code fields | MA-01 | React UI rendering | Create project with state=MA, confirm fields appear |
| WorkersPage shows isWoman/isMinority/oshaTraining for MA projects, hidden for non-MA | MA-02 | React UI conditional render | Compare MA vs CA project worker pages |
| PayrollWeekDetailPage shows checkNumber/allOtherHours/totalWeekGrossWages for MA projects | MA-03 | React UI conditional render | Open MA payroll week, confirm MA columns appear |
| "Download MA DLS Payroll" button visible on MA payroll week (stub returning 501) | MA-01 | React UI + STATE_FORMS | Confirm button renders; click returns 501 before Phase 50 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (tsc --noEmit + grep or vitest)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 gaps documented (test cases added within plans)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
