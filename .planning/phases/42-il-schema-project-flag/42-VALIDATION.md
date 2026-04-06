---
phase: 42
slug: il-schema-project-flag
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-06
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx vitest run --exclude ".claude/**"` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` (compile check — primary gate for schema/route/service changes)
- **After every plan wave:** Run `npx vitest run --exclude ".claude/**"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | NFR-01, STATE-09, STATE-10 | compile + grep | `grep -c "statement-breakpoint" src/server/db/migrations/0025_il_schema.sql && grep "0025_il_schema" src/server/db/migrations/meta/_journal.json` | N/A (new file) | pending |
| 42-01-02 | 01 | 1 | NFR-05, STATE-09, STATE-10 | compile | `npx tsc --noEmit && grep -c "nonPwHours" src/server/db/schema.ts` | extend | pending |
| 42-02-01 | 02 | 2 | STATE-10 | compile | `npx tsc --noEmit && grep -c "skillLevel" src/server/routes/workers.ts` | extend | pending |
| 42-02-02 | 02 | 2 | STATE-09 | compile | `npx tsc --noEmit && grep -c "nonPwHours" src/server/services/payrollService.ts` | extend | pending |
| 42-03-01 | 03 | 3 | STATE-07, STATE-10 | compile | `npx tsc --noEmit && grep -c "isIL" src/client/pages/WorkersPage.tsx` | extend | pending |
| 42-03-02 | 03 | 3 | STATE-09 | compile | `npx tsc --noEmit && grep -c "nonPwHours" src/client/components/PayrollWeekForm.tsx` | extend | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

No new test files required for this phase. All verification is via TypeScript compile checks (`npx tsc --noEmit`) and grep for expected symbols. The phase adds nullable columns and optional fields — no business logic that warrants unit tests. The compliance engine (complianceService) is not modified in this phase.

Existing test suite must remain green — `npx vitest run --exclude ".claude/**"` should pass unchanged since all new fields are optional/nullable.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ProjectForm shows IL info section when state=IL is entered | STATE-07 | React conditional UI requires browser | Create a new project, type "IL" in state field, confirm purple IL section appears; change to "CA", confirm IL section disappears |
| WorkersPage shows collapsible "IL Compliance Demographics" section for IL projects | STATE-10 | React conditional UI requires browser | Open WorkersPage for an IL project, confirm demographics section with 5 fields is visible; open WorkersPage for a CA project, confirm section is absent |
| PayrollWeekForm shows "Non-PW Hours" input for IL projects | STATE-09 | React conditional UI requires browser | Navigate to payroll entry for an IL project, confirm Non-PW Hours input appears; do the same for a CA project, confirm it does not appear |
| PayrollWeekDetailPage shows IL export placeholder and IDOL submission row | STATE-07 | React conditional UI requires browser | Open PayrollWeekDetailPage for an IL project, confirm disabled IL export button and IDOL submission row are visible |
| Demographic data round-trips through create/update | STATE-10 | End-to-end requires running server + UI | Create worker on IL project with race/ethnicity/gender filled, save, reload page, confirm values persist |
| nonPwHours round-trips through payroll entry upsert | STATE-09 | End-to-end requires running server + UI | Enter Non-PW Hours value on IL project payroll entry, save, reload, confirm value persists |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (tsc --noEmit + grep)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none needed — no new test files)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
