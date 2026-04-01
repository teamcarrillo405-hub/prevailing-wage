---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: State Portal Integration
status: Executing Phase 37
stopped_at: Phase 37 Plan 01 complete — audit_logs schema + migration
last_updated: "2026-04-01T22:00:00.000Z"
progress:
  total_phases: 24
  completed_phases: 14
  total_plans: 32
  completed_plans: 31
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — with compliance feedback, no missing steps. Team-ready with encrypted SSN storage and payroll imports.
**Current focus:** Phase 37 — Audit Trail Foundation

## Current Position

Phase: 37 (Audit Trail Foundation) — EXECUTING
Plan: 2 of 2 (Plan 01 complete)

## Performance Metrics

**Velocity (v3.0 — completed):**

- Total phases: 6 (phases 31–36)
- Total plans: 17
- Shipped: 2026-04-01

**v4.0 target:**

- Total phases: TBD (set during roadmap)
- Total plans: TBD (set during plan-phase)

## Accumulated Context

### Decisions

Phase 37 Plan 01 decisions:
- Drizzle index() (not uniqueIndex()) for audit log composite indexes — they are non-unique
- DESC ordering in raw SQL migration only — Drizzle index() builder lacks .desc() for composite indexes in installed version
- projectId FK uses onDelete: set null so audit rows survive project deletion

Key decisions carried forward from v3.0:

- Multi-user: flat model — owner invites by email; all members see all projects; no per-project permission tiers; max 2 users (owner + 1 member)
- Payroll import: QuickBooks + ADP CSV/export formats; preview-then-commit pattern; rate snapshots always from WD cache, never from CSV
- Auto-submit: research confirmed no public machine-to-machine API for CA DIR eCPR or WA L&I PWIA as of 2026-03; replaced with "Mark as Submitted" tracking only
- SSN encryption: AES-256-GCM at rest using node:crypto; key versioning JSON envelope; decrypt only at CA eCPR / WA PWIA XML export; never in API responses or WH-347
- nodemailer@8.0.4 installed for invite email (available for notification emails in v4.0)
- assertProjectAccess(projectId, userId, db) is the centralized IDOR guard across all route files

Key decisions locked for v4.0 scope:

- Notifications: email only via nodemailer; 4 triggers: compliance violation detected, payroll due-soon (configurable threshold), team member activity, submission confirmed
- Additional state forms: NY DOL and IL DOL certified payroll PDFs only (PDF generation, no XML); TX deferred pending research
- More payroll providers: Gusto, Paychex, Sage/Timberline CSV import; same preview-then-commit pattern as QB/ADP
- Audit trail: activity_log table (who + what + when); viewable per project; immutable append-only rows
- Worker profile depth: structured address (street/city/state/zip), union local + book number, apprenticeship committee + registration number, multiple trade classifications per payroll week

### Phase Order Rationale

TBD — set during roadmap creation.

### Critical Pitfalls (from research)

- IDOR from scattered ownership checks — mitigated by assertProjectAccess in Phase 32 with cross-tenant test suite
- Rate snapshot corruption on CSV import — rate snapshots must come from getCachedClassifications, never from CSV values
- SSN encryption key loss — versioned JSON envelope + startup assertion + re-encryption runbook before first migration
- submittedAt set optimistically — use agency_submissions status table; never set submittedAt until portal confirms

### Pending Todos

- Phase 24: 24-03-PLAN.md not yet executed (A-1-131 PDF generator + export route). Pre-existing v2.4 work. Deferred — user chose to proceed with v3.0 → v4.0 milestones.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-01T22:00:00.000Z
Stopped at: Phase 37 Plan 01 complete — audit_logs schema + migration committed (52cc6e3, bf851db)
Resume file: None
Next action: Execute `/gsd:execute-phase 37` for Plan 02 (auditService.ts + tests)
