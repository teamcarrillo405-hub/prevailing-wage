---
phase: 47
slug: state-foundations-tx-certified-payroll
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx vitest run --exclude ".claude/**"` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run --exclude ".claude/**"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 47-01-01 | 01 | 1 | STATE-13 | compile | `npx tsc --noEmit` | pending |
| 47-01-02 | 01 | 1 | STATE-13 | integration | `npx vitest run tests/routes/export.test.ts --reporter=verbose 2>&1 \| tail -30` | pending |
| 47-02-01 | 02 | 2 | STATE-12, NFR-06 | compile + grep | `npx tsc --noEmit && grep -n "STATE_FORMS" src/client/pages/PayrollWeekDetailPage.tsx` | pending |
| 47-02-02 | 02 | 2 | TX-01 | integration | `npx vitest run tests/routes/export.test.ts --reporter=verbose 2>&1 \| tail -30` | pending |
| 47-03-01 | 03 | 3 | TX-01 | compile + grep | `npx tsc --noEmit && grep -n "txdotProjectId\|txAwardingAgency\|txContractorLicense" src/server/db/schema.ts` | pending |
| 47-03-02 | 03 | 3 | TX-01 | integration | `npx vitest run tests/routes/projects.test.ts --reporter=verbose 2>&1 \| tail -30` | pending |
| 47-04-01 | 04 | 4 | TX-02 | compile + grep | `npx tsc --noEmit && grep -n "LCPtracker\|lcp123" src/client/pages/PayrollWeekDetailPage.tsx` | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing test infrastructure (vitest, supertest, export.test.ts, projects.test.ts) covers Phase 47 needs. New test cases are added to existing files, not new test files.

- [ ] Add STATE-13 case normalization tests in `tests/routes/export.test.ts` (Plan 01 Task 2)
- [ ] Add TX-01 WH-347 TX project test in `tests/routes/export.test.ts` (Plan 02 Task 2)
- [ ] Add TX-01 project save test in `tests/routes/projects.test.ts` (Plan 03 Task 2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TX projects show LCPtracker callout with correct link | TX-02 | React UI — no automated DOM test | Open dev server, create TX project, open any payroll week, confirm callout text and lcp123.com link appear |
| STATE_FORMS registry download buttons render correctly | STATE-12 | React UI rendering | Open CA, WA, NY, IL projects — confirm state-specific download buttons all still appear correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (tsc --noEmit + grep or vitest)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 gaps documented (test cases added within plans)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
