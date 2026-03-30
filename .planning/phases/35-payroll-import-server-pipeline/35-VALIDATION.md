---
phase: 35
slug: payroll-import-server-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `cd C:/Users/glcar/prevailing-wage && npx vitest run tests/routes/import.test.ts tests/services/importService.test.ts --reporter=verbose 2>&1` |
| **Full suite command** | `cd C:/Users/glcar/prevailing-wage && npx vitest run --reporter=verbose 2>&1` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 1 | PI-01, PI-02 | unit | `npx vitest run tests/services/importService.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 35-01-02 | 01 | 1 | PI-01, PI-02 | unit | `npx vitest run tests/services/importService.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 35-02-01 | 02 | 2 | PI-01, PI-02 | integration | `npx vitest run tests/routes/import.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 35-02-02 | 02 | 2 | PI-01, PI-02 | integration | `npx vitest run tests/routes/import.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/importService.test.ts` — stubs for `detectProvider`, QB mapper aggregation, ADP mapper weekly-total warning, worker matching (case-insensitive), conflict detection
- [ ] `tests/routes/import.test.ts` — stubs for `POST /api/payroll/import/preview` (QB, ADP, unknown provider, submitted-week 423) and `POST /api/payroll/import/commit` (entries written + audit row)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QB CSV upload produces correct preview in browser | PI-01 | Requires real QB export file | Start dev server, navigate to payroll week, upload QB CSV, verify preview JSON |
| ADP CSV upload shows weekly-total warning | PI-02 | Requires real ADP export file | Upload ADP CSV, verify `adpWeeklyTotalsOnly: true` in preview response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
