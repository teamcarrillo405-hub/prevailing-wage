---
phase: 20
slug: copy-previous-payroll-week
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 + supertest ^7.2.2 |
| **Config file** | `vitest.config.ts` (`setupFiles: ['./tests/helpers/db.ts']`) |
| **Quick run command** | `npx vitest run tests/routes/payroll.test.ts` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/payroll.test.ts`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite green + manual browser verification of copy modal flow
- **Max feedback latency:** 10 seconds (automated) + 3 minutes (manual: open copy modal, select week, confirm copy)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 20-01-01 | 01 | 1 | PAY-01, PAY-02 | unit | `npx vitest run tests/routes/payroll.test.ts` | — | ⬜ pending |
| 20-01-02 | 01 | 1 | PAY-01, PAY-02 | unit | `npx vitest run tests/routes/payroll.test.ts` | — | ⬜ pending |
| 20-02-01 | 02 | 2 | PAY-01, PAY-02 | shell+manual | `npx vitest run` | Copy modal appears on PayrollListPage; source week selector populates from existing weeks | ⬜ pending |
| 20-02-02 | 02 | 2 | PAY-02 | shell+manual | `npx vitest run` | Skipped entries warning shown before confirm; cancel works | ⬜ pending |
| 20-02-03 | 02 | 2 | PAY-01 | shell+manual | `npx vitest run` | Copied week appears in list; entries pre-filled with correct hours | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 20 copy tests extend `tests/routes/payroll.test.ts` following the established fixture pattern. No new test files required.

- [ ] `tests/routes/payroll.test.ts` — add describe block: `POST /api/payroll/weeks/copy` — covers PAY-01 (creates week, copies hours, uses fresh rates)
- [ ] `tests/routes/payroll.test.ts` — add describe block: `POST /api/payroll/weeks/copy?preview=true` — covers PAY-02 (returns skipped[] without DB write)
- [ ] `tests/routes/payroll.test.ts` — add describe block: copy skips inactive workers and missing rate entries — covers PAY-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Copy modal appears when >0 weeks exist | PAY-01 | UI modal rendering requires browser | Click "+ New Week" on a project with ≥1 payroll week — modal should offer "Start Fresh" + "Copy Previous Week" |
| "+ New Week" goes direct when no weeks | PAY-01 | Conditional flow requires browser | Click "+ New Week" on a project with 0 weeks — should navigate directly to new week form |
| Skipped entries warning shown | PAY-02 | Preview step requires browser | Use a project where a worker is inactive or WD lookup fails — skipped list appears before confirm |
| Copied week shows correct hours | PAY-01 | Hours rendering requires browser | After confirming copy, open the new week — entry grid shows same hours as source week |
| New week is editable | PAY-01 | Edit interaction requires browser | Open copied week — entry form fields are enabled, user can modify hours |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npx vitest run tests/routes/payroll.test.ts`)
- [ ] Sampling continuity: regression suite after each task commit
- [ ] Wave 0: 3 test describe blocks written before implementation
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 3min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
