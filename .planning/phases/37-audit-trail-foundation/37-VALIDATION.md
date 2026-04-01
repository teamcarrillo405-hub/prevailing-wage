---
phase: 37
slug: audit-trail-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/services/auditService.test.ts` |
| **Full suite command** | `npx vitest run --exclude ".claude/**"` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/services/auditService.test.ts`
- **After every plan wave:** Run `npx vitest run --exclude ".claude/**"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | AUDIT-01, NFR-05 | compile | `npx tsc --noEmit` | ✅ schema.ts | ⬜ pending |
| 37-01-02 | 01 | 1 | AUDIT-01, NFR-01 | integration | `npx vitest run --exclude ".claude/**"` | ❌ W0 migration | ⬜ pending |
| 37-02-01 | 02 | 2 | AUDIT-02, NFR-04 | unit | `npx vitest run tests/services/auditService.test.ts` | ❌ W0 | ⬜ pending |
| 37-02-02 | 02 | 2 | AUDIT-02 | integration | `npx vitest run tests/services/auditService.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/services/auditService.test.ts` — stubs for AUDIT-01, AUDIT-02, NFR-04 (created in Plan 02 Task 1 before implementation)

*Note: Plan 01 (schema + migration) has no Wave 0 test file gap — it is verified by the existing test suite running migrations on the in-memory DB.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration uses `--> statement-breakpoint` with exactly one space | NFR-01 | Whitespace difference not caught by compile or runtime | Open `src/server/db/migrations/0021_audit_logs.sql` and visually confirm separator format |
| `auditService.ts` exports no `updateAuditLog` or `deleteAuditLog` | AUDIT-02 | TypeScript compile passes even if extra exports exist | `grep -n "export" src/server/services/auditService.ts` — confirm only `insertAuditLog` and type exports appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
