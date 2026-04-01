---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Compliance Depth + Operations
status: Defining requirements
stopped_at: v4.0 milestone started — defining requirements and roadmap
last_updated: "2026-04-01T00:00:00.000Z"
progress:
  total_phases: 37
  completed_phases: 36
  total_plans: 0
  completed_plans: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — with compliance feedback, no missing steps. Team-ready with encrypted SSN storage and payroll imports.
**Current focus:** v4.0 — Compliance Depth + Operations (notifications, NY/IL state forms, Gusto/Paychex/Sage import, audit trail, worker profile depth)

## Current Position

Phase: Not started (defining requirements)
Plan: —

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

Last session: 2026-04-01T00:00:00.000Z
Stopped at: v3.0 milestone archived; v4.0 milestone started; defining requirements
Resume file: None
Next action: Define REQUIREMENTS.md then run `/gsd:plan-phase 37`
