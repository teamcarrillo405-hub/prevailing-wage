---
phase: 6
slug: wh-347-2025-compliance-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing in project) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 0 | WH347-02 | stub | `npx vitest run tests/routes/workers.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | WH347-02 | unit | `npx vitest run tests/routes/workers.test.ts` | ✅ after W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | WH347-02 | unit | `npx vitest run tests/routes/workers.test.ts` | ✅ after W0 | ⬜ pending |
| 6-02-01 | 02 | 0 | WH347-01 | stub | `npx vitest run tests/services/wh347Generator.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | WH347-01 | unit | `npx vitest run tests/services/wh347Generator.test.ts` | ✅ after W0 | ⬜ pending |
| 6-02-03 | 02 | 1 | WH347-01 | manual | See manual table | N/A | ⬜ pending |
| 6-02-04 | 02 | 1 | WH347-01 | unit | `npx vitest run tests/services/wh347Generator.test.ts` | ✅ after W0 | ⬜ pending |
| 6-02-05 | 02 | 2 | WH347-01 | manual | See manual table | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/workers.test.ts` — stubs for programName field (WH347-02)
- [ ] `tests/services/wh347Generator.test.ts` — stubs for multi-page and compliance boolean fix (WH347-01)

*Existing infrastructure covers test runner. Wave 0 adds test files only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WH-347 PDF renders 2025 form correctly | WH347-01 | PDF visual layout cannot be automated | Download WH-347 for a payroll week; verify form fields, Statement of Compliance on page 2 |
| J/RA column shows "J" or "RA" per worker | WH347-02 | PDF coordinate placement | Worker with apprentice classification → generate WH-347 → verify "RA" in column |
| 9+ workers produce multi-page WH-347 | WH347-01 | PDF page count visual | Create payroll week with 9 workers; generate WH-347; verify 4 pages |
| Page X of Y notation correct | WH347-01 | PDF text position | Multi-page WH-347 shows "Page 1 of 2" on first page |
| certApprentices = false when no programName | WH347-01 | Statement of Compliance boolean | Apprentice with no programName → WH-347 page 2 box unchecked |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
