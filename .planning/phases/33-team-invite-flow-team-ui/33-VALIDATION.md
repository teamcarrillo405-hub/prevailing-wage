---
phase: 33
slug: team-invite-flow-team-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `cd C:/Users/glcar/prevailing-wage && npx vitest run tests/team --reporter=verbose 2>&1` |
| **Full suite command** | `cd C:/Users/glcar/prevailing-wage && npx vitest run --reporter=verbose 2>&1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/team --reporter=verbose`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | MT-01 | unit | `npx vitest run tests/team/inviteService --reporter=verbose` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 1 | MT-01 | unit | `npx vitest run tests/team/inviteService --reporter=verbose` | ❌ W0 | ⬜ pending |
| 33-02-01 | 02 | 2 | MT-01 | integration | `npx vitest run tests/team/team.routes --reporter=verbose` | ❌ W0 | ⬜ pending |
| 33-02-02 | 02 | 2 | MT-02 | integration | `npx vitest run tests/team/team.routes --reporter=verbose` | ❌ W0 | ⬜ pending |
| 33-02-03 | 02 | 2 | MT-01 | integration | `npx vitest run tests/team/accept-invite --reporter=verbose` | ❌ W0 | ⬜ pending |
| 33-03-01 | 03 | 3 | MT-04 | manual | — (human verify) | n/a | ⬜ pending |
| 33-03-02 | 03 | 3 | MT-05 | integration | `npx vitest run tests/security/cross-tenant --reporter=verbose` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/team/inviteService.test.ts` — stubs for invite creation, token validation, email dispatch
- [ ] `tests/team/team.routes.test.ts` — stubs for GET /api/team, POST /api/team/invite, DELETE /api/team/invite, DELETE /api/team/members/:userId, POST /api/team/transfer
- [ ] `tests/team/accept-invite.test.ts` — stubs for POST /api/auth/accept-invite (token validation, user creation, project_members insertion)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Invite email delivered to inbox | MT-01 | Requires live Resend API key + real email address | Configure RESEND_API_KEY, send invite, check inbox |
| TeamPage renders in browser | MT-01, MT-04 | React UI requires browser inspection | Start dev server, navigate to /team, verify members list and invite form |
| AcceptInvitePage pre-fills email | MT-01 | Browser navigation via tokenized link | Click invite link, confirm email is locked and pre-filled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
