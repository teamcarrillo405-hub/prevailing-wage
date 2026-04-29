---
phase: 85
slug: full-text-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 85 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 \| tail -10` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~35 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -10`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 35 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 85-01-01 | 01 | 1 | PERF-01 | migration + vitest | `test -f src/server/db/migrations/0054_workers_fts.sql && npx vitest run --reporter=verbose 2>&1 \| tail -5` | ❌ W0 | ⬜ pending |
| 85-01-02 | 01 | 1 | PERF-01 | vitest + curl | `npx vitest run --reporter=verbose 2>&1 \| tail -5` | ✅ | ⬜ pending |
| 85-02-01 | 02 | 2 | PERF-02 | grep + vitest | `grep -c "useDebounce\|debounce" src/client/pages/WorkersPage.tsx && npx vitest run 2>&1 \| tail -5` | ✅ | ⬜ pending |
| 85-02-02 | 02 | 2 | PERF-02 | grep | `grep -c "filteredProjects\|searchQuery" src/client/pages/DashboardPage.tsx` | ✅ | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/server/db/migrations/0054_workers_fts.sql` — created in plan 85-01
- [ ] New vitest test file for search route (path TBD by planner)

*Existing vitest infrastructure covers the project — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Search response time < 50ms on 500-worker dataset | PERF-01 | Requires seeded dataset + live server | Seed 500 workers, run `curl -w "%{time_total}" http://localhost:4099/api/projects/1/workers/search?q=john`, confirm < 0.05s |
| WorkersPage search input clears and restores full list | PERF-02 | UI interaction | Run dev server, type in search box, clear it, verify full list returns |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 35s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
