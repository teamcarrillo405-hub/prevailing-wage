---
phase: 19
slug: wh-347-submission-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 |
| **Config file** | package.json (`"test": "vitest run"`) |
| **Quick run command** | `npx vitest run tests/routes/payroll.test.ts` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/payroll.test.ts`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite green + manual browser verification of submit/un-submit flow
- **Max feedback latency:** 10 seconds (automated) + 3 minutes (manual: submit form, lock check, un-submit)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 19-01-01 | 01 | 1 | SUB-01, SUB-02 | unit | `npx vitest run tests/routes/payroll.test.ts` | — | ⬜ pending |
| 19-01-02 | 01 | 1 | SUB-02 | unit | `npx vitest run tests/routes/payroll.test.ts` | — | ⬜ pending |
| 19-02-01 | 02 | 2 | SUB-01, SUB-03 | shell+manual | `npx vitest run` | Submit form appears on PayrollWeekDetailPage; submitted badge on PayrollListPage | ⬜ pending |
| 19-02-02 | 02 | 2 | SUB-02 | shell+manual | `npx vitest run` | Payroll entry form is disabled/hidden on submitted weeks | ⬜ pending |
| 19-02-03 | 02 | 2 | SUB-03 | shell+manual | `npx vitest run` | Un-submit button clears badge and re-enables entry form | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/payroll.test.ts` — add describe block: `PATCH /api/payroll/weeks/:id/submit` — covers SUB-01
- [ ] `tests/routes/payroll.test.ts` — add describe block: `DELETE /api/payroll/weeks/:id/submit` — covers SUB-03
- [ ] `tests/routes/payroll.test.ts` — add describe block: server-side lock — `POST /api/payroll/entries` and `PUT /api/payroll/entries/:id` return 409 on submitted week — covers SUB-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Submit form on PayrollWeekDetailPage | SUB-01 | Form rendering + date input requires browser | Open a payroll week detail, verify submit form with date + agency fields |
| Submitted badge on PayrollListPage | SUB-01 | Visual badge rendering requires browser | After submitting, return to project detail — week shows "Submitted" badge |
| Entry form disabled on submitted week | SUB-02 | UI lock state requires browser | Open submitted week — payroll entry form fields should be disabled/hidden |
| Un-submit restores editing | SUB-03 | Mutation + cache invalidation requires browser | Click Un-submit — badge disappears, entry form re-enables |
| WorkflowProgress step 4 activates | bonus | Visual indicator requires browser | After submitting a week, verify step 4 in ProjectDetailPage WorkflowProgress turns active |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npx vitest run tests/routes/payroll.test.ts`)
- [ ] Sampling continuity: regression suite after each task commit
- [ ] Wave 0: 3 test describe blocks written before implementation
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 3min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
