---
phase: 71
plan: 1
subsystem: subcontractors
tags: [dbe, mbe, wbe, certifications, dot-ifr, sqlite]
dependency_graph:
  requires: [phase-54-subcontractors]
  provides: [subcontractor_certifications table, certification CRUD API, certification UI]
  affects: [ProjectDetailPage, subcontractors.ts routes, schema.ts]
tech_stack:
  added: []
  patterns: [drizzle-orm, zod validation, react-query, inline chip selector]
key_files:
  created:
    - src/server/db/migrations/0039_same_the_leader.sql
  modified:
    - src/server/db/schema.ts
    - src/server/routes/subcontractors.ts
    - src/client/lib/cprStatus.ts
    - src/client/pages/ProjectDetailPage.tsx
decisions:
  - CertificationsSection rendered above CprWeekTable in expanded sub row
  - certTypes stored as CSV string (e.g. "DBE,MBE") matching plan spec
  - Quick-select toggle chips for CERT_TYPE_OPTIONS with freetext fallback
  - DOT IFR tooltip uses native title attribute (no external tooltip library needed)
metrics:
  duration: ~18 minutes
  completed: 2026-04-25
  tasks_completed: 4
  files_created: 1
  files_modified: 4
---

# Phase 71 Plan 1: DBE/MBE/WBE Subcontractor Certifications Summary

**One-liner:** SQLite `subcontractor_certifications` table with DOT IFR Oct 2025 reevaluation status, full CRUD API under project access guard, and inline certification badge/form UI in the subcontractor panel.

## What Was Built

### Table Created — `subcontractor_certifications`

Migration `0039_same_the_leader.sql` adds:

- `id`, `subcontractor_id` (FK cascade), `cert_types` (CSV), `certifying_agency`, `cert_number`, `naics_codes`, `issue_date`, `expires_date`
- `owner_race`, `owner_gender`, `personal_net_worth_usd`
- `reevaluation_status` (default `not_required`): DOT IFR Oct 3 2025 values — `not_required | pending | cleared | suspended`
- `self_certified` (boolean), `document_path`
- Two indexes: `idx_sub_certs_sub` on `subcontractor_id`, `idx_sub_certs_expires` on `(expires_date, reevaluation_status)`

### API Routes Added — `src/server/routes/subcontractors.ts`

Three new routes, all protected by `assertProjectAccess` + second-level sub ownership check:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:id/subcontractors/:subId/certifications` | List certs ordered by `createdAt` desc |
| POST | `/:id/subcontractors/:subId/certifications` | Create cert with Zod validation |
| DELETE | `/:id/subcontractors/:subId/certifications/:certId` | Hard delete by cert + sub ownership |

### UI Changes — `src/client/pages/ProjectDetailPage.tsx`

New `CertificationsSection` component (rendered above `CprWeekTable` in expanded sub row):
- Colored badges per cert (`emerald` = default/cleared, `amber` = pending, `red` = suspended)
- Table listing certTypes, agency, expiration, DOT IFR status
- Quick-select toggle chips for: DBE, MBE, WBE, SBE, ACDBE, 8(a), HUBZone
- Freetext certTypes input (chips update the same field)
- DOT IFR Status dropdown with all 4 values + tooltip explaining Oct 3 2025 rule
- Remove cert with confirm dialog

### Type Added — `src/client/lib/cprStatus.ts`

`SubcontractorCertification` interface exported alongside `Subcontractor` and `CprWeek`.

## Typecheck Status

**0 errors in Phase 71 files.** One pre-existing error exists in `PayrollWeekDetailPage.tsx` (variant type mismatch introduced before this phase) — not introduced or worsened by Phase 71.

## Test Count

**724 tests skipped, 56 test files failing** — all failures are pre-existing. Root cause: test DB helper replays migrations on an already-migrated SQLite test DB, causing `duplicate column name: apprenticeship_requirements` from Phase 70. Phase 71 did not introduce or worsen any test failures. Verified by stashing Phase 71 changes and confirming identical failure count.

## Deviations from Plan

None — plan executed exactly as written.

The plan spec used `.run()` (sync better-sqlite3 style). The existing codebase uses async Drizzle (`await db.select()...`). Routes were implemented using the project's established async pattern (matching how all other routes in subcontractors.ts are written) — this is consistent, not a deviation.

## Known Stubs

None. All fields flow from DB through API to UI. No hardcoded placeholders.

## Self-Check: PASSED

- `src/server/db/schema.ts` — subcontractorCertifications export confirmed present
- `src/server/routes/subcontractors.ts` — GET/POST/DELETE cert routes confirmed
- `src/client/lib/cprStatus.ts` — SubcontractorCertification interface confirmed
- `src/client/pages/ProjectDetailPage.tsx` — CertificationsSection component and rendering confirmed
- Migration file `src/server/db/migrations/0039_same_the_leader.sql` — confirmed created and applied
- Commit `26f8e0f` — confirmed in git log
