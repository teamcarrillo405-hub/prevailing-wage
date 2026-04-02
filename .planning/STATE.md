---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: State Portal Integration
status: Ready to execute
stopped_at: Completed 39-worker-profile-depth Plan 01 — backend data model and API surface
last_updated: "2026-04-02T16:07:53.981Z"
progress:
  total_phases: 24
  completed_phases: 16
  total_plans: 37
  completed_plans: 36
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — with compliance feedback, no missing steps. Team-ready with encrypted SSN storage and payroll imports.
**Current focus:** Phase 39 — worker-profile-depth

## Current Position

Phase: 39 (worker-profile-depth) — EXECUTING
Plan: 2 of 2

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
- [Phase 37]: redactSensitiveFields is NOT exported — internal write-side guard only; diffObjects IS exported for Phase 38+ callers; hasSensitiveNonNull checks key presence never ciphertext; zero cryptoService imports to avoid test process.exit
- [Phase 38]: trust proxy set to 1 in index.ts for real client IP behind Render.com load balancer
- [Phase 38]: assertProjectAccess called before deletePayrollEntry for correct NFR-03 authorization ordering
- [Phase 38]: dynamic import used for auditService in route files to avoid circular dependency risk
- [Phase 38-audit-trail-wiring-activity-ui]: audit route: conditions typed as ReturnType<typeof eq>[], to param appended T23:59:59.999Z for inclusive end-of-day, JSON column parsing at HTTP boundary not in service
- [Phase 38-audit-trail-wiring-activity-ui]: useSearchParams (not useState) for date filter — makes URLs bookmarkable per AUDIT-05 requirement
- [Phase 38-audit-trail-wiring-activity-ui]: ACTION_LABELS map (15 entries) covers all audit action types; route uses :id (not :projectId) to match useParams destructuring in ProjectActivityPage
- [Phase 39-01]: randomUUID from crypto instead of uuid package — no @types/uuid; consistent with all other route files
- [Phase 39-01]: LEFT JOIN for payrollWeekClassifications — INNER JOIN would exclude entries without override from all exports
- [Phase 39-01]: DELETE+INSERT upsert for classification override — handles unique constraint; SQLite lacks UPSERT ON CONFLICT UPDATE syntax

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

Last session: 2026-04-02T16:07:53.977Z
Stopped at: Completed 39-worker-profile-depth Plan 01 — backend data model and API surface
Resume file: None
Next action: Execute `/gsd:execute-phase 37` for Plan 02 (auditService.ts + tests)
