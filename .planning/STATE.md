---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Team & Integration
status: Roadmap created — Phase 31 next
stopped_at: roadmap phase — ROADMAP.md written, STATE.md updated, REQUIREMENTS.md traceability updated
last_updated: "2026-03-27T12:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — with compliance feedback, no missing steps.
**Current focus:** v3.0 milestone — Team & Integration

## Current Position

Phase: 31 — SSN Encryption Foundation
Plan: Not started

[==========----------] 0% (0/6 phases)

## Performance Metrics

**Velocity (v2.5 — completed):**

- Total phases: 2 (phases 29–30)
- Total plans: 6
- Shipped: 2026-03-27

**v3.0 target:**

- Total phases: 6 (phases 31–36)
- Total plans: TBD (set during plan-phase)

## Accumulated Context

### Decisions

Key decisions locked for v3.0 scope:

- Multi-user: flat model — owner invites by email; all members see all projects; no per-project permission tiers; max 2 users (owner + 1 member)
- Payroll import: QuickBooks + ADP CSV/export formats; preview-then-commit pattern; rate snapshots always from WD cache, never from CSV
- Auto-submit: research confirmed no public machine-to-machine API for CA DIR eCPR or WA L&I PWIA as of 2026-03; replaced with "Mark as Submitted" tracking only
- SSN encryption: AES-256-GCM at rest using node:crypto; key versioning JSON envelope; decrypt only at CA eCPR / WA PWIA XML export; never in API responses or WH-347
- New production dependency: nodemailer@8.0.4 for invite email (only new dep; multer + papaparse already installed)
- Auth refactor: assertProjectAccess(projectId, userId, db) replaces all inline project.userId checks across 9 route files — must land in Phase 32 before any team data exists

### Phase Order Rationale

- Phase 31 (SSN) first: zero dependencies; unblocks CA eCPR real-SSN fix deferred from v2.5
- Phase 32 (Auth foundation) before Phase 33 (Invite flow): project_members table must exist before invite routes create member rows; cross-tenant test suite is regression gate
- Phase 34 (Submission tracking) after Phase 30 is shipped: independent, additive; placed before import to avoid import blocking on unrelated status UI work
- Phase 35 (Import server) before Phase 36 (Import UI): natural dependency; pipeline tested before UI reduces debugging surface

### Critical Pitfalls (from research)

- IDOR from scattered ownership checks — mitigated by assertProjectAccess in Phase 32 with cross-tenant test suite
- Rate snapshot corruption on CSV import — rate snapshots must come from getCachedClassifications, never from CSV values
- SSN encryption key loss — versioned JSON envelope + startup assertion + re-encryption runbook before first migration
- submittedAt set optimistically — use agency_submissions status table; never set submittedAt until portal confirms

### Pending Todos

- Phase 24: 24-03-PLAN.md not yet executed (A-1-131 PDF generator + export route). Pre-existing v2.4 work. Deferred — user chose to proceed with v3.0 milestone.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-27
Stopped at: roadmap-phase — v3.0 ROADMAP.md written (Phases 31-36), STATE.md updated, REQUIREMENTS.md traceability updated
Resume file: None
Next action: `/gsd:plan-phase 31`
