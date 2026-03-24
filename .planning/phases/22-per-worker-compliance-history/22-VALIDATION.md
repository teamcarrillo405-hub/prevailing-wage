---
phase: 22
slug: per-worker-compliance-history
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 + supertest ^7.2.2 |
| **Config file** | `vitest.config.ts` (`setupFiles: ['./tests/helpers/db.ts']`) |
| **Quick run command** | `npx vitest run tests/routes/compliance.test.ts` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/compliance.test.ts`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite green + manual browser verification of compliance history page
- **Max feedback latency:** 12 seconds (automated) + 3 minutes (manual: click Compliance History, verify violations listed)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 22-01-01 | 01 | 1 | AUD-01, AUD-02 | unit | `npx vitest run tests/routes/compliance.test.ts` | — | ⬜ pending |
| 22-02-01 | 02 | 2 | AUD-01 | shell+manual | `npx vitest run` | "Compliance History" link on Workers page; new page loads with violation list | ⬜ pending |
| 22-02-02 | 02 | 2 | AUD-01, AUD-02 | shell+manual | `npx vitest run` | Worker with no violations shows empty state; violation list shows project/week/type/amounts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/compliance.test.ts` — new test file with describe block: `GET /api/compliance/worker/:workerId/history` — covers AUD-01 (returns violations across projects), AUD-02 (correct worker identity matching)
- [ ] `tests/routes/compliance.test.ts` — add describe block: empty state — worker with no violations returns empty array
- [ ] `tests/routes/compliance.test.ts` — add describe block: ssnLast4=null safety — no cross-project merge when SSN unavailable

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Compliance History" link on Workers page | AUD-01 | Link rendering requires browser | Open Workers page — each worker row has "Compliance History" link |
| History page loads with violations | AUD-01 | Page rendering + data requires browser | Click "Compliance History" for a worker with violations — list shows project name, week, type, amounts |
| Empty state for clean worker | AUD-02 | EmptyState rendering requires browser | Click "Compliance History" for worker with no violations — shows "No violations found" message |
| Cross-project violations aggregated | AUD-01 | Multi-project data requires browser | Worker on 2+ projects — violations from all projects appear in list |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify
- [ ] Sampling continuity: regression suite after each task commit
- [ ] Wave 0: new test file with 3 describe blocks before implementation
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 3min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
