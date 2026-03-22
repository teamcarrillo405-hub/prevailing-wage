---
phase: 15
slug: compliance-engine-hardening-independent-frontend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (server-side logic — compliance engine testable) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

> **Note:** COMP-03 apprentice ratio logic is server-side and can be unit-tested. RPT-01/02 print CSS and UX-04 progress indicator are visual — manual browser verification required. Existing 181-test suite serves as regression guard for all tasks.

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run` + open browser for visual verification
- **Before `/gsd:verify-work`:** Full suite green + manual print preview for RPT-01/02 + visual check of UX-04 progress indicator
- **Max feedback latency:** 10 seconds (automated) + 3 minutes (manual: print preview + progress indicator)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 15-01-01 | 01 | 1 | COMP-03 | unit+shell | `npm run test -- --run` | Open a payroll week with >1:3 apprentice ratio — verify violation badge appears on PayrollWeekDetailPage | ⬜ pending |
| 15-02-01 | 02 | 1 | UX-04 | shell+manual | `npm run test -- --run` | Open ProjectDetailPage — verify 4-step indicator with correct completion state per project data | ⬜ pending |
| 15-03-01 | 03 | 2 | RPT-01, RPT-02 | shell+manual | `npm run test -- --run` | Open ReportsPage, press Ctrl+P — verify table headers repeat, totals row visible, nav chrome hidden | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No Wave 0 test file stubs needed. COMP-03 extends existing compliance service — existing tests cover the compute path. The apprentice ratio logic should be covered by adding test cases to the existing compliance test file if it exists.

*Existing infrastructure covers all phase requirements as regression guard.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apprentice ratio violation badge on PayrollWeekDetailPage | COMP-03 | UI badge rendering requires browser | Enter payroll data with >1:3 apprentice:journeyworker ratio for a week, open PayrollWeekDetailPage, verify violation badge appears |
| 4-step progress indicator shows correct completion state | UX-04 | DOM + data-driven UI requires browser | Open a project with workers added + payroll entered — verify steps 1-3 marked complete, step 4 pending |
| Fringe summary table headers repeat on print | RPT-01 | CSS @media print — browser-only | Open ReportsPage → Fringe tab → Ctrl+P → verify thead repeats on multi-page print preview |
| Fringe summary totals row visible on print | RPT-01 | Visual table layout — browser-only | Verify totals row (tfoot) appears on last page of print preview |
| Nav chrome hidden on print | RPT-01, RPT-02 | @media print CSS — browser-only | Ctrl+P from ReportsPage — verify nav bar, tabs, and worker selector are hidden |
| Worker pay history full table visible on print | RPT-02 | @media print CSS — browser-only | Open pay history tab → Ctrl+P → verify full table with column alignment across pages |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npm run test -- --run`)
- [ ] Sampling continuity: regression suite after each plan commit
- [ ] Wave 0: N/A — existing compliance test infrastructure covers regression
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 3min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
