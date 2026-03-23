---
phase: 7
slug: compliance-engine-payroll-week-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing in project) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/services/complianceService.test.ts 2>&1 \| tail -20` |
| **Full suite command** | `npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/services/complianceService.test.ts 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 0 | COMP-01, COMP-02 | stub | `npx vitest run tests/services/complianceService.test.ts` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 0 | WH347-03 | stub | `npx vitest run tests/routes/compliance.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 1 | COMP-01, COMP-02 | unit | `npx vitest run tests/services/complianceService.test.ts` | ✅ after W0 | ⬜ pending |
| 7-02-02 | 02 | 1 | WH347-03 | integration | `npx vitest run tests/routes/compliance.test.ts` | ✅ after W0 | ⬜ pending |
| 7-03-01 | 03 | 1 | WH347-03, WH347-04 | manual | See manual table | N/A | ⬜ pending |
| 7-03-02 | 03 | 1 | WH347-03 | manual | See manual table | N/A | ⬜ pending |
| 7-04-01 | 04 | 2 | COMP-01, COMP-02 | unit | `npx vitest run tests/services/complianceService.test.ts` | ✅ after W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/complianceService.test.ts` — stubs for under-wage (COMP-01) and CWHSSA OT (COMP-02) detection
- [ ] `tests/routes/compliance.test.ts` — stubs for compliance route contract (WH347-03)

*Existing vitest infrastructure covers test runner. Wave 0 adds two test files only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Payroll week detail page shows compliance violations inline | WH347-03 | UI layout cannot be automated | Navigate to payroll week → verify violations list shows worker name + violation type |
| WH-347 download button present on payroll week view | WH347-03 | UI presence check | Payroll week page → one button → PDF download without navigation |
| certProperPayment unchecked when violations exist | COMP-01/02 | PDF visual | Generate WH-347 for a week with violations → Page 2 checkbox (a) unchecked |
| certAccuratePayroll unchecked when OT violations exist | COMP-02 | PDF visual | Generate WH-347 for week with CWHSSA error → Page 2 checkbox (b) unchecked |
| Multi-page WH-347 accessible from week view | WH347-04 | PDF page count | Week with 9+ workers → click download → verify 4+ pages |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
