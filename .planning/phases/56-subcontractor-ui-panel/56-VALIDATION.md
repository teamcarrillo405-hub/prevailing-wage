---
phase: 56
slug: subcontractor-ui-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/lib/cprStatus.test.ts` |
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
| 56-01-01 | 01 | 1 | SUB-05 | unit | `npx vitest run tests/lib/cprStatus.test.ts` | ❌ W0 | ⬜ pending |
| 56-01-02 | 01 | 1 | SUB-05 | unit + tsc | `npx vitest run tests/lib/cprStatus.test.ts && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 56-01-03 | 01 | 1 | SUB-05 | checkpoint | human-verify | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/cprStatus.test.ts` — unit tests for getCprStatus pure function (badge logic, overdue boundary, three-state isCompliant mapping)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Subcontractors panel renders on ProjectDetailPage | SUB-05 | React component + TanStack Query — DOM rendering | Open project detail, confirm "Subcontractors" section appears below existing panels |
| Add/edit/remove sub controls work | SUB-05 | Form interaction requires browser | Add a sub, edit name, remove it — confirm changes persist |
| CPR week expansion and badge display | SUB-05 | Visual badge rendering | Expand a sub row, confirm CPR week table with correct colored badges |
| Mark week received/compliant updates badge | SUB-05 | Mutation + re-render | Click badge action, confirm badge changes color immediately |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
