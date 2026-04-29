---
phase: 50
slug: ma-pdf-generator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/services/maPdfGenerator.test.ts tests/routes/export.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~35 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 50-01-01 | 01 | 1 | MA-04 | unit | `npx vitest run tests/services/maPdfGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 50-01-02 | 01 | 1 | MA-04 | unit | `npx vitest run tests/services/maPdfGenerator.test.ts` | ❌ W0 | ⬜ pending |
| 50-02-01 | 02 | 2 | MA-04, NFR-03 | integration | `npx vitest run tests/routes/export.test.ts` | ✅ | ⬜ pending |
| 50-02-02 | 02 | 2 | NFR-03 | integration | `npx vitest run tests/routes/export.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/maPdfGenerator.test.ts` — stubs for MA-04 (generator unit tests)

*Existing `tests/routes/export.test.ts` already has MA-01 stub test — Wave 0 adds generator unit tests only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF visual layout (columns, alignment, MA form structure) | MA-04 | PDF rendering requires human eye | Open generated PDF, verify contractor header, per-worker rows, OSHA checkbox, woman/minority columns present |
| Statement of Compliance MA-specific text | MA-04 | String content in binary PDF | Open PDF page 2, confirm "pains and penalties of perjury" and MGL Ch. 149 §27 reference |
| Sunday-first day column order | MA-04 | Visual column header check | Open PDF, confirm day headers read Su-Mo-Tu-We-Th-Fr-Sa left to right |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
