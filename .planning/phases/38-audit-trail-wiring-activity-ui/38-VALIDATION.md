---
phase: 38
slug: audit-trail-wiring-activity-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/services/workerService.test.ts tests/routes/audit.test.ts` |
| **Full suite command** | `npx vitest run --exclude ".claude/**"` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --exclude ".claude/**"`
- **After every plan wave:** Run `npx vitest run --exclude ".claude/**"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | AUDIT-03 | integration | `npx vitest run tests/services/workerService.test.ts` | ❌ W0 | ⬜ pending |
| 38-01-02 | 01 | 1 | AUDIT-03 | integration | `npx vitest run tests/services/payrollService.audit.test.ts` | ❌ W0 | ⬜ pending |
| 38-01-03 | 01 | 1 | AUDIT-03 | route test | `npx vitest run --exclude ".claude/**"` | ✅ extend | ⬜ pending |
| 38-02-01 | 02 | 2 | AUDIT-04, NFR-03 | route test | `npx vitest run tests/routes/audit.test.ts` | ❌ W0 | ⬜ pending |
| 38-03-01 | 03 | 3 | AUDIT-05 | compile | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/workerService.test.ts` — stubs for AUDIT-03 worker CRUD actions (created in Plan 01 Task 1)
- [ ] `tests/services/payrollService.audit.test.ts` — stubs for AUDIT-03 entry create/update/delete (created in Plan 01 Task 2)
- [ ] `tests/routes/audit.test.ts` — stubs for AUDIT-04 403, pagination, filter (created in Plan 02 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Activity feed shows reverse-chronological timeline with correct actor, action label, and timestamp in browser | AUDIT-05 | React UI rendering not covered by server-side tests | Navigate to `/projects/:id/activity`, perform a worker edit, confirm new row appears at top within 2 seconds of page refresh |
| Date-range filter updates URL and filters rows correctly | AUDIT-05 | URL state behavior requires browser interaction | Apply a start/end date filter, confirm URL changes, confirm rows outside range disappear, confirm browser Back restores filter |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
