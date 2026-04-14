---
phase: 55
slug: subcontractor-api-routes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/routes/subcontractors.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~25 seconds |

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
| 55-01-01 | 01 | 1 | SUB-03, NFR-03 | integration | `npx vitest run tests/routes/subcontractors.test.ts` | ❌ W0 | ⬜ pending |
| 55-01-02 | 01 | 1 | SUB-04, NFR-03 | integration | `npx vitest run tests/routes/subcontractors.test.ts` | ❌ W0 | ⬜ pending |
| 55-01-03 | 01 | 1 | SUB-03, SUB-04 | integration | `npx vitest run tests/routes/subcontractors.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/subcontractors.test.ts` — RED stubs for SUB-03 (CRUD routes) and SUB-04 (CPR week routes) and NFR-03 (403 tests)

---

## Manual-Only Verifications

*All phase behaviors have automated verification via integration tests.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
