---
phase: 9
slug: reports
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing in project) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/routes/reports.test.ts 2>&1 \| tail -20` |
| **Full suite command** | `npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/reports.test.ts 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 0 | RPT-01, RPT-02 | stub | `npx vitest run tests/routes/reports.test.ts` | ❌ W0 | ⬜ pending |
| 9-02-01 | 02 | 1 | RPT-01, RPT-02 | integration | `npx vitest run tests/routes/reports.test.ts` | ✅ after W0 | ⬜ pending |
| 9-03-01 | 03 | 1 | RPT-01, RPT-02 | manual | See manual table | N/A | ⬜ pending |
| 9-04-01 | 04 | 2 | RPT-01, RPT-02 | integration | `npx vitest run tests/routes/reports.test.ts` | ✅ after W0 | ⬜ pending |
| 9-04-02 | 04 | 2 | RPT-01, RPT-02 | manual (checkpoint) | See manual table | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/reports.test.ts` — stubs for fringe summary (RPT-01) and pay history (RPT-02) endpoints

*Existing vitest infrastructure covers test runner. Wave 0 creates one new test file only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fringe benefit summary renders per worker | RPT-01 | React UI layout | Project → Reports → fringe summary table shows worker name, total hours, total fringe credits |
| Pay history renders in date-descending order | RPT-02 | React UI layout + ordering | Reports page → select worker → pay history shows weeks in descending order |
| Reports link navigates from project detail | RPT-01/02 | UI navigation | ProjectDetailPage → click Reports → navigates to `/projects/:id/reports` |
| Multi-classification worker aggregates correctly | RPT-01 | Aggregation behavior | Worker with 2 trades in same week shows combined fringe credits (not duplicated rows) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
