---
phase: 17
slug: db-migration-project-archive
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 |
| **Config file** | package.json (`"test": "vitest run"`) |
| **Quick run command** | `npx vitest run tests/routes/projects.test.ts` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/routes/projects.test.ts`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite green + manual browser verification of archive/restore flow
- **Max feedback latency:** 10 seconds (automated) + 2 minutes (manual: archive button, show archived toggle)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Manual Steps | Status |
|---------|------|------|-------------|-----------|-------------------|--------------|--------|
| 17-01-01 | 01 | 0 | Migration | unit | `npm run test -- --run` | `SELECT sql FROM sqlite_master WHERE name = 'payroll_weeks'` — verify 4 new columns | ⬜ pending |
| 17-01-02 | 01 | 0 | PRJ-01, PRJ-02, PRJ-03 | unit | `npx vitest run tests/routes/projects.test.ts` | — | ⬜ pending |
| 17-02-01 | 02 | 1 | PRJ-01 | shell+manual | `npx vitest run tests/routes/projects.test.ts` | Open ProjectDetailPage → click Archive → project disappears from dashboard | ⬜ pending |
| 17-02-02 | 02 | 1 | PRJ-02 | shell+manual | `npx vitest run tests/routes/projects.test.ts` | Toggle "Show Archived" → archived project reappears with Archived badge | ⬜ pending |
| 17-02-03 | 02 | 1 | PRJ-03 | shell+manual | `npx vitest run tests/routes/projects.test.ts` | Archive project with violations → advisory modal shows; Archive project without violations → simple confirm modal | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/projects.test.ts` — add describe block: `GET /api/projects?status=active|all` filter — covers PRJ-01, PRJ-02
- [ ] `tests/routes/projects.test.ts` — add describe block: `DELETE /api/projects/:id` — verify no compliance 409 block (advisory only) — covers PRJ-03
- [ ] `tests/db/migration.test.ts` (or inline in projects.test.ts) — verify `submitted_at`, `submitted_to`, `amendment_number`, `original_week_id` columns exist post-migrate

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Archive button on ProjectDetailPage | PRJ-01 | DOM + navigation requires browser | Open any project detail, click Archive, verify redirect to dashboard and project absent |
| Archived badge on ProjectCard | PRJ-02 | Visual rendering requires browser | Enable "Show Archived" toggle, verify archived project has distinct "Archived" badge |
| Compliance advisory modal content | PRJ-03 | Modal rendering requires browser | Archive a project with violations — verify modal mentions open violations; archive without — verify simple confirmation |
| Restore button on ProjectDetailPage | PRJ-01 | DOM + navigation requires browser | Navigate to archived project, click Restore, verify project returns to dashboard |
| "Show Archived" toggle persists list | PRJ-02 | TanStack Query cache requires browser | Toggle on, verify both active + archived shown; toggle off, verify only active shown |

---

## Validation Sign-Off

- [ ] All tasks have automated regression verify (`npm run test -- --run`)
- [ ] Sampling continuity: regression suite after each task commit
- [ ] Wave 0: test stubs written before implementation
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s automated + 2min manual
- [ ] `nyquist_compliant: true` set in frontmatter after sign-off

**Approval:** pending
