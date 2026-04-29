---
phase: 83
slug: external-log-drain-security-policy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 83 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run src/server/routes/auth.test.ts --exclude ".worktrees/**"` |
| **Full suite command** | `npx vitest run --exclude ".worktrees/**" --exclude ".claude/worktrees/**"` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/server/routes/auth.test.ts --exclude ".worktrees/**"`
- **After every plan wave:** Run `npx vitest run --exclude ".worktrees/**" --exclude ".claude/worktrees/**"`
- **Before `/gsd:verify-work`:** Full 724-test suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 83-01-01 | 01 | 1 | SEC-07 | unit | `npx vitest run --exclude ".worktrees/**"` | ✅ | ⬜ pending |
| 83-01-02 | 01 | 1 | SEC-07 | unit | `npx vitest run --exclude ".worktrees/**"` | ✅ | ⬜ pending |
| 83-01-03 | 01 | 1 | SEC-07 | integration | `npx vitest run --exclude ".worktrees/**"` | ✅ | ⬜ pending |
| 83-02-01 | 02 | 2 | SEC-08 | manual | `ls SECURITY_POLICY.md && grep "72 hours" SECURITY_POLICY.md` | ❌ W0 | ⬜ pending |
| 83-02-02 | 02 | 2 | SEC-08 | unit | `npx vitest run --exclude ".worktrees/**"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `SECURITY_POLICY.md` — created as deliverable of Plan 83-02 Task 1 (it is the artifact being validated, not a test fixture)

*All other infrastructure exists. Existing 724-test suite covers NODE_ENV=test guard and pino-http transport.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logs appear in Better Stack drain dashboard | SEC-07 | Requires live LOGTAIL_TOKEN and external network call | Set LOGTAIL_TOKEN env var, start server, make 1 HTTP request, verify log appears in Better Stack console within 5s |
| /security page renders policy content correctly | SEC-08 | Browser rendering; React component visual check | Start dev server, navigate to /security, confirm 72h SLA text and security@prevailingwage.app email visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
