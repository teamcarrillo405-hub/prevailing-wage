---
phase: 119
slug: dashboard-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 119 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/routes/dashboard.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/dashboard.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 119-01-01 | 01 | 1 | DASH-01, DASH-02 | unit | `npx vitest run tests/routes/dashboard.test.ts` | ❌ W0 | ⬜ pending |
| 119-01-02 | 01 | 1 | DASH-03 | unit | `npx vitest run tests/routes/dashboard.test.ts` | ❌ W0 | ⬜ pending |
| 119-01-03 | 01 | 1 | DASH-04 | unit | `npx vitest run tests/routes/dashboard.test.ts` | ❌ W0 | ⬜ pending |
| 119-02-01 | 02 | 2 | DASH-01 | integration | `npx vitest run` | ✅ | ⬜ pending |
| 119-02-02 | 02 | 2 | DASH-02 | integration | `npx vitest run` | ✅ | ⬜ pending |
| 119-02-03 | 02 | 2 | DASH-03 | integration | `npx vitest run` | ✅ | ⬜ pending |
| 119-02-04 | 02 | 2 | DASH-04 | integration | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/dashboard.test.ts` — stubs for DASH-01, DASH-02, DASH-03 (new server endpoints); DASH-04 already tested via existing ProjectCard tests

*Wave 0 must create the test file before endpoint implementation tasks run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ComplianceTrendChart renders correct line in browser | DASH-02 | recharts renders to SVG; Vitest (jsdom) does not execute canvas/SVG layout | Start dev server, navigate to Dashboard, verify 12-week line chart visible and labeled correctly |
| ProjectsAtRisk panel hidden when no at-risk projects | DASH-03 | Requires seeded DB state | Ensure test DB has no violations > 7 days old; verify panel element not in DOM |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 25s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
