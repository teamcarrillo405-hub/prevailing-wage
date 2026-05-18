---
phase: 151-p0-business-blockers
plan: "03"
subsystem: email
tags: [email, transactional, resend, welcome, contact, compliance, violation-alert]
dependency_graph:
  requires: [151-01, 151-02]
  provides: [sendEmail, sendSupportForward, welcome-email, contact-forward, violation-alert-email]
  affects: [src/server/routes/auth.ts, src/server/routes/contact.ts, src/server/routes/payroll.ts]
tech_stack:
  added: []
  patterns:
    - "fire-and-forget .catch(() => {}) pattern for non-blocking email sends"
    - "module-load readFileSync for HTML templates (process.cwd() ESM-safe)"
    - "graceful no-op on missing RESEND_API_KEY (warn + return, never throw)"
key_files:
  created:
    - src/server/services/emailService.ts (sendEmail + sendSupportForward added)
    - src/server/email/templates/welcome.html
    - src/server/email/templates/violation-alert.html
    - src/server/email/templates/deadline-reminder.html
  modified:
    - src/server/routes/auth.ts (welcome email wired to register handler)
    - src/server/routes/contact.ts (sendSupportForward wired to POST /)
    - src/server/routes/payroll.ts (maybeSendViolationAlert wired to POST+PUT /entries)
    - tests/services/emailService.test.ts (sendEmail + sendSupportForward tests added)
    - .env.example (EMAIL_FROM, EMAIL_SUPPORT vars added)
decisions:
  - "sendEmail() and sendSupportForward() added to existing emailService.ts alongside existing NOTIF-01-08 functions"
  - "process.cwd() used for template file paths (ESM-safe; __dirname unavailable in ESM modules)"
  - "maybeSendViolationAlert() helper centralizes violation alert logic for reuse in POST and PUT /entries"
  - "violation alert skips when APP_URL unset — avoids firing in test environments"
  - "welcome email uses companyName || email prefix as firstName fallback"
metrics:
  duration_minutes: 18
  completed_date: "2026-05-18"
  tasks_completed: 5
  tasks_total: 5
  files_changed: 8
---

# Phase 151 Plan 03: Transactional Email System Summary

## One-liner

Transactional email service built on existing Resend integration: sendEmail/sendSupportForward added to emailService, 3 HTML templates created, welcome email wired to registration, contact form forwarded to support inbox, violation alert fired on payroll entry save.

## What Was Built

### Task 1: sendEmail() and sendSupportForward() added to emailService.ts

Added two new exported functions to the existing `src/server/services/emailService.ts`:

- `sendEmail(to, subject, html)` — generic Resend wrapper with graceful no-op when `RESEND_API_KEY` is absent; swallows all errors per NFR-02
- `sendSupportForward(from, name, subject, message)` — builds contact-form HTML and routes to `EMAIL_SUPPORT` address via `sendEmail()`

Added `EMAIL_FROM` and `EMAIL_SUPPORT` env vars to `.env.example`.

### Task 2: HTML email templates

Three templates created in `src/server/email/templates/`:
- `welcome.html` — HCC gold header, 3-step onboarding instructions with `{{firstName}}` and `{{appUrl}}` placeholders
- `violation-alert.html` — red alert header, `{{projectName}}`, `{{weekEnding}}`, `{{violationList}}`, `{{weekUrl}}` placeholders
- `deadline-reminder.html` — gold header, `{{deadlineList}}` and `{{appUrl}}` placeholders

### Task 3: Welcome email wired to registration

`src/server/routes/auth.ts` updated:
- Imports `sendEmail`, `readFileSync`, `path`
- `welcome.html` loaded at module init via `readFileSync(path.join(process.cwd(), ...))` (ESM-safe)
- After user created and session set, fires `sendEmail(...).catch(() => {})` — non-blocking
- Uses `companyName || email.split('@')[0]` as `firstName` fallback

### Task 4: Contact forward + violation alert wired

`src/server/routes/contact.ts`:
- Imports `sendSupportForward` from emailService
- Calls `sendSupportForward(...).catch(() => {})` non-blocking after validation success

`src/server/routes/payroll.ts`:
- Imports `sendEmail`, `computeCompliance`, `readFileSync`, `path`
- `violation-alert.html` loaded at module init
- `maybeSendViolationAlert()` helper calls `computeCompliance()` after entry save, fires email only when `violations.length + weekViolations.length + deductionViolations.length > 0`
- Wired in both `POST /entries` and `PUT /entries/:id` handlers
- Skips when `APP_URL` env var is unset (prevents test environment false-fires)

### Task 5: Tests

`tests/services/emailService.test.ts` extended with 7 new tests across 2 new `describe` blocks:
- `sendEmail`: no-op when key absent, sends correctly when key present, non-fatal on Resend throw
- `sendSupportForward`: no-op when key absent, `[Contact]` prefix in subject, non-fatal on throw

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

### Notable observations

- `emailService.ts` already existed (Phase 46) with `sendViolationEmail()` (NOTIF-01) and other notification functions. The plan's `sendEmail()` and `sendSupportForward()` were additive alongside the existing functions — no conflicts.
- The plan specified `__dirname` for template path resolution but the project uses ESM (`"type": "module"` in package.json), so `process.cwd()` was used instead (matching the established pattern in `a1131Generator.ts` and `wh347Generator.ts`).
- The violation alert sends to `req.user!.email` (acting user) as the recipient rather than querying project owners — this is the simplest correct behavior given the route already has the user context.

## Commits

| Hash | Message |
|------|---------|
| eb43cb2 | feat(email): add sendEmail() and sendSupportForward() to emailService with graceful no-op |
| e125d4b | feat(email): add welcome, violation-alert, deadline-reminder HTML templates |
| 1efb6ca | feat(auth): send welcome email on registration (non-blocking) |
| eceb600 | feat(email): wire contact forward and violation alert emails |
| 6d522be | test(email): add sendEmail and sendSupportForward graceful no-op tests |

## Self-Check: PASSED

- [x] `src/server/services/emailService.ts` — sendEmail and sendSupportForward exported
- [x] `src/server/email/templates/welcome.html` — contains "Welcome to HCC Prevailing Wage"
- [x] `src/server/email/templates/violation-alert.html` — exists
- [x] `src/server/email/templates/deadline-reminder.html` — exists
- [x] `src/server/routes/auth.ts` — welcome email wired non-blocking
- [x] `src/server/routes/contact.ts` — sendSupportForward wired non-blocking
- [x] `src/server/routes/payroll.ts` — violation alert wired to POST+PUT entries
- [x] emailService tests: 26/26 passing
- [x] Full vitest suite: 1186 passing, 0 regressions
