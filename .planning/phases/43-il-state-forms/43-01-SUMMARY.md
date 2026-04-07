---
phase: 43-il-state-forms
plan: 01
slug: migration-schema-service
subsystem: database, payroll-service
tags: [migration, schema, drizzle, sqlite, payroll-service, il-idol]
dependency_graph:
  requires: []
  provides: [il_idol_submitted_at column, setIlIdolSubmitted service function]
  affects: [payrollWeeks table, payrollService exports]
tech_stack:
  added: []
  patterns: [single-statement ALTER TABLE migration (no breakpoint), setCaEcprSubmitted/setNyMpwrSubmitted service pattern]
key_files:
  created:
    - src/server/db/migrations/0026_il_idol_submission.sql
  modified:
    - src/server/db/migrations/meta/_journal.json
    - src/server/db/schema.ts
    - src/server/services/payrollService.ts
key_decisions:
  - Used single-statement migration with no statement-breakpoint, matching 0024_ny_mpwr_submission.sql pattern
  - Inserted ilIdolSubmittedAt after nyMpwrSubmittedAt with Phase 43 comment for traceability
metrics:
  duration: ~5 minutes
  completed: 2026-04-06
  tasks_completed: 2
  files_modified: 4
---

# Phase 43 Plan 01: Migration + Schema + Service for IL IDOL Submission Tracking

IL IDOL submission tracking column added via migration 0026, Drizzle schema updated, and setIlIdolSubmitted service function implemented following the setCaEcprSubmitted/setNyMpwrSubmitted pattern.

## What Was Built

- **Migration 0026** (`0026_il_idol_submission.sql`): Single-statement `ALTER TABLE payroll_weeks ADD COLUMN il_idol_submitted_at TEXT;` — no statement-breakpoint, matching the established pattern for single-statement migrations.
- **Journal update**: `_journal.json` appended with idx 22 entry (`tag: "0026_il_idol_submission"`, `when: 1743984000000`, `breakpoints: true`).
- **Schema update** (`schema.ts`): `ilIdolSubmittedAt: text('il_idol_submitted_at')` added to `payrollWeeks` table after `nyMpwrSubmittedAt`, with `// Phase 43 -- IL IDOL submission tracking` comment.
- **Service function** (`payrollService.ts`): `setIlIdolSubmitted(weekId)` added after `setNyMpwrSubmitted` — sets `ilIdolSubmittedAt` and `updatedAt` to current ISO timestamp, returns `{ ilIdolSubmittedAt: now }`.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Write migration 0026 and update Drizzle schema | e82bf8e | 0026_il_idol_submission.sql, _journal.json, schema.ts |
| 2 | Add setIlIdolSubmitted service function | 6a16e33 | payrollService.ts |

## Verification

```
grep "ilIdolSubmittedAt" src/server/db/schema.ts
  → ilIdolSubmittedAt: text('il_idol_submitted_at'),

grep "setIlIdolSubmitted" src/server/services/payrollService.ts
  → export async function setIlIdolSubmitted(weekId: string): Promise<{ ilIdolSubmittedAt: string }>

cat src/server/db/migrations/0026_il_idol_submission.sql
  → ALTER TABLE payroll_weeks ADD COLUMN il_idol_submitted_at TEXT;

npx tsc --noEmit
  → Only pre-existing errors in audit.ts and projects.ts (unrelated to Phase 43 changes)
```

## Deviations from Plan

None — plan executed exactly as written. Pre-existing TypeScript errors in `src/server/routes/audit.ts` (parameter `row`) and `src/server/routes/projects.ts` (parameter `r`) were present before this plan and are out of scope.

## Known Stubs

None — this plan is purely additive infrastructure (migration + schema + service). No UI rendering paths involved.

## Self-Check: PASSED

- `src/server/db/migrations/0026_il_idol_submission.sql` — FOUND
- `src/server/db/migrations/meta/_journal.json` idx 22 entry — FOUND
- `src/server/db/schema.ts` ilIdolSubmittedAt — FOUND
- `src/server/services/payrollService.ts` setIlIdolSubmitted — FOUND
- Commits e82bf8e and 6a16e33 — FOUND
