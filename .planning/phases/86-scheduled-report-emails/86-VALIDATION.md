---
phase: 86
slug: scheduled-report-emails
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 86 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Quick run** | `npx vitest run --reporter=verbose 2>&1 \| tail -10` |
| **Full suite** | `npx vitest run` |
| **Estimated runtime** | ~35s |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Automated Command | Status |
|---------|------|------|-------------|-------------------|--------|
| 86-01-01 | 01 | 1 | NOTIF-05 | `test -f src/server/jobs/scheduledReports.ts && grep -q "runScheduledReports" src/server/index.ts` | ⬜ |
| 86-01-02 | 01 | 1 | NOTIF-06 | `grep -q "unsubscribe" src/server/routes/notifications.ts && npx vitest run 2>&1 \| tail -5` | ⬜ |
| 86-02-01 | 02 | 2 | NOTIF-05 | `grep -c "reportSchedule\|reportEmail" src/client/pages/ProjectSettingsPage.tsx` | ⬜ |

## Manual-Only Verifications

| Behavior | Why Manual |
|----------|-----------|
| Email actually delivered on schedule trigger | Requires Resend sandbox + live server |
| Unsubscribe link removes schedule in DB | Requires browser + live server |

## Validation Sign-Off
- [ ] nyquist_compliant: true
