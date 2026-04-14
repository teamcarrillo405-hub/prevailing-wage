---
phase: 53
slug: ca-a-1-131-gap-close
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-14
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/services/a1131.test.ts tests/routes/export.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 53-01-01 | 01 | 1 | CA-02 | integration | `npx vitest run tests/routes/export.test.ts` | ✅ | ⬜ pending |
| 53-01-02 | 01 | 1 | CA-02 | integration | `npx vitest run tests/routes/export.test.ts` | ✅ | ⬜ pending |
| 53-01-03 | 01 | 1 | CA-02 | checkpoint | human-verify | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing test infrastructure covers all automated requirements — no new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| eCPR disclosure modal shown before CA download | CA-02 | React event routing — browser only | Click CA button on CA project payroll week; confirm CSLB/WC modal appears (not direct download) |
| A-1-131 PDF field coordinates | CA-02 | PDF rendering requires human eye | Download PDF from CA project, open in browser, verify contractor header, per-worker rows, fringe section, SDI deduction, cert text on page 2 |
| DT row spacing (no overlap with next block) | CA-02 | Visual layout check | Verify DT workers' rows don't overlap the next worker's block boundary |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
