---
phase: 46
slug: notifications
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-06
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx vitest run --exclude ".claude/**"` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run --exclude ".claude/**"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 46-01-01 | 01 | 1 | NOTIF-01-04, NFR-02 | compile | `npx tsc --noEmit` | pending |
| 46-01-02 | 01 | 1 | NOTIF-01-04, NFR-02 | unit | `npx vitest run tests/services/emailService.test.ts --reporter=verbose 2>&1 \| tail -30` | pending |
| 46-02-01 | 02 | 2 | NOTIF-01, NOTIF-03, NFR-02 | compile + grep | `npx tsc --noEmit && grep -n "sendViolationEmail\|sendActivityEmail" src/server/services/payrollService.ts` | pending |
| 46-02-02 | 02 | 2 | NOTIF-04, NFR-02 | compile + grep | `npx tsc --noEmit && grep -n "sendSubmissionConfirmationEmail" src/server/routes/payroll.ts` | pending |
| 46-03-01 | 03 | 3 | NOTIF-02, NFR-02 | unit | `npx vitest run tests/services/dueSoonService.test.ts --reporter=verbose 2>&1 \| tail -30` | pending |
| 46-03-02 | 03 | 3 | NOTIF-02 | compile + grep | `npx tsc --noEmit && grep -n "runDueSoonScan" src/server/index.ts` | pending |
| 46-04-01 | 04 | 4 | NOTIF-05 | compile + grep | `npx tsc --noEmit && grep -n "resolvedProjectSettings\|mergedSettings\|currentParsed" src/server/routes/projects.ts` | pending |
| 46-04-02 | 04 | 4 | NOTIF-05 | compile | `npx tsc --noEmit` | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Gaps

New test files required before execution:
- [ ] `tests/services/emailService.test.ts` — unit tests for all send functions with mocked Resend (created in Plan 01 Task 2)
- [ ] `tests/services/dueSoonService.test.ts` — unit tests for due-soon scan algorithm with mocked DB (created in Plan 03 Task 1)

*(Existing test infrastructure — vitest, supertest — covers Phase 46 needs. No new framework install.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Violation email sent when entry saved with compliance violations | NOTIF-01 | Requires RESEND_API_KEY in env | Enter payroll entry that violates wage rules; check inbox for violation email |
| Due-soon reminder email sent day before payroll due | NOTIF-02 | Requires real cron run + RESEND_API_KEY | Set system clock to 1 day before weekEndingDate, restart server, wait for 7:00 AM cron |
| Activity notification to project owner on member edit | NOTIF-03 | Requires multi-user setup | Log in as non-owner; create/edit worker; check owner inbox |
| Submission confirmation email on agency submit | NOTIF-04 | Requires RESEND_API_KEY | Click CA DIR submit; check inbox |
| Notification preferences panel visible on ProjectDetailPage | NOTIF-05 | React conditional UI | Open ProjectDetailPage; click gear icon; confirm preferences panel appears |
| projectSettings merge preserves sibling keys | NOTIF-05 | End-to-end | Set NY form data on project; update notification prefs; reload; confirm NY data unchanged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (tsc --noEmit + grep or vitest)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 gaps documented (email and dueSoon test files created within their plans)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
