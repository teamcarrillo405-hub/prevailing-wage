---
phase: 87
slug: phase-a-watchdog-gate
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-27
---

# Phase 87 — Validation Strategy

> Gate phase: validation is the plan. All checks are automated file/grep/test commands.
> No new production code is written. The artifact under test is 87-SCORE.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing), bash file/grep checks |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `cd /c/Users/glcar/prevailing-wage && npx vitest run --exclude ".worktrees/**" 2>&1 \| tail -5` |
| **Full suite command** | `cd /c/Users/glcar/prevailing-wage && npx vitest run --exclude ".worktrees/**"` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After Task 1:** Verify all 10 bash checks completed and raw results are noted
- **After Task 2:** Confirm 87-SCORE.md exists and contains GATE_PASS or GATE_FAIL
- **No mid-phase sampling needed:** This phase is two sequential tasks with immediate feedback

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 87-01-01 | 01 | 1 | SEC-07,SEC-08,SEC-09,SEC-10,PERF-01,PERF-02,NOTIF-05,NOTIF-06 | file+grep | See 10 criterion checks in PLAN Task 1 | ⬜ pending |
| 87-01-02 | 01 | 1 | all | file-exists | `grep -q "GATE_PASS\|GATE_FAIL" .planning/phases/87-phase-a-watchdog-gate/87-SCORE.md` | ⬜ pending |

---

## Gate Criteria Reference

These are the 10 scored criteria. Each is 1.0 point.

| ID | Phase | Requirement | Bash Command | Pass Condition |
|----|-------|-------------|--------------|----------------|
| C1 | 83 | SEC-07 | `grep -c "pinoHttp\|@logtail/pino" src/server/index.ts src/server/logger.ts` | count >= 2 |
| C2 | 83 | SEC-08 | `test -f SECURITY_POLICY.md && grep -q "72 hours" SECURITY_POLICY.md` | exit 0 |
| C3 | 83 | SEC-08 | `test -f src/client/pages/SecurityPolicyPage.tsx && grep -q "security\|SecurityPolicy" src/client/App.tsx` | exit 0 |
| C4 | 84 | SEC-09 | `test -f .github/dependabot.yml && grep -q "npm" .github/dependabot.yml && grep -q "github-actions" .github/dependabot.yml` | exit 0 |
| C5 | 84 | SEC-10 | `grep -qi "status\|betterstack\|uptime" src/client/pages/LandingPage.tsx` | exit 0 |
| C6 | 85 | PERF-01 | `test -f src/server/db/migrations/0054_workers_fts.sql` | exit 0 |
| C7 | 85 | PERF-02 | `grep -c "useDebounce\|debounce" src/client/pages/WorkersPage.tsx` | count >= 1 |
| C8 | 85 | PERF-02 | `grep -c "filteredProjects\|searchQuery" src/client/pages/DashboardPage.tsx` | count >= 1 |
| C9 | 86 | NOTIF-05 | `test -f src/server/jobs/scheduledReports.ts && grep -q "runScheduledReports\|scheduledReports" src/server/index.ts` | exit 0 |
| C10 | 86 | NOTIF-06 | `grep -q "unsubscribe" src/server/routes/notifications.ts && grep -c "reportSchedule\|reportEmail" src/client/pages/ProjectSettingsPage.tsx` | exit 0 + count >= 1 |

## Integrity Checks (deductions, not scored criteria)

| Check | Command | Deduction if failing |
|-------|---------|----------------------|
| Full test suite green | `npx vitest run --exclude ".worktrees/**" 2>&1 \| tail -3` | -0.5 |
| No new TS errors | `npx tsc --noEmit 2>&1 \| grep -v stripeService \| grep error \| wc -l` | -0.5 if count > 0 |

---

## Manual-Only Verifications (excluded from score)

| Behavior | Requirement | Why Excluded |
|----------|-------------|-------------|
| Logs appear in Better Stack drain dashboard | SEC-07 | Requires live LOGTAIL_TOKEN + external network |
| Better Stack monitor fires on /api/health downtime | SEC-10 | Requires live Better Stack account |
| Scheduled report email delivered to inbox | NOTIF-05 | Requires Resend sandbox + live server + wait for cron |
| Unsubscribe link deactivates schedule in DB | NOTIF-06 | Requires browser + live server session |

These are real requirements but cannot be mechanically verified in a CI context.
They are noted in 87-SCORE.md under Notes as "manual deferred."

---

## Wave 0 Requirements

None. This phase creates no new source files — only the 87-SCORE.md evidence document.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify
- [x] Sampling continuity: 2-task plan with verification after each
- [x] No Wave 0 needed (no new test stubs required)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
