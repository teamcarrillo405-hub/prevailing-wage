---
phase: 54
slug: subcontractor-schema-migrations
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-14
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run full suite (migration auto-exercised via tests/helpers/db.ts)
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 54-01-01 | 01 | 1 | NFR-01, SUB-01, SUB-02 | integration | `npx vitest run` | ✅ (via db.ts global setup) | ⬜ pending |
| 54-01-02 | 01 | 1 | SUB-01, SUB-02 | integration | `npx vitest run` | ✅ (via db.ts global setup) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No new test files needed. The global `tests/helpers/db.ts` migration runner automatically validates the new SQL on every test run.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification via the global migration runner.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
