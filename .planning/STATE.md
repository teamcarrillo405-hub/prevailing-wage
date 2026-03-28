---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: State Portal Integration
status: Ready to execute
stopped_at: "CHECKPOINT: 32-03-PLAN.md Task 2 (human-verify)"
last_updated: "2026-03-28T19:59:25.694Z"
progress:
  total_phases: 28
  completed_phases: 27
  total_plans: 70
  completed_plans: 72
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — with compliance feedback, no missing steps.
**Current focus:** Phase 32 — multi-user-auth-foundation

## Current Position

Phase: 32 (multi-user-auth-foundation) — EXECUTING
Plan: 3 of 3

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
- [Phase 31]: AES-256-GCM cryptoService with versioned JSON envelope; ENCRYPTION_KEY_V1 env var as 64-char hex; ssnLast4 kept unchanged for WH-347 and compliance history
- [Phase 31]: encryptSsn envelope includes len field — hasFullSsn derivable without decrypting (avoids D-15 decrypt-in-list-route violation)
- [Phase 31]: resolveEcprSsn() extracted as testable pure function in export.ts — CA eCPR SSN logic testable without route mocking
- [Phase 32]: assertProjectAccess throws plain { status, message } objects — no app-wide error handler needed
- [Phase 32]: Drizzle better-sqlite3 migrator requires --> statement-breakpoint separators between SQL statements in migration files
- [Phase 32-02]: PATCH/DELETE WHERE clauses simplified to id-only after assertProjectAccess membership check
- [Phase 32-02]: amendPayrollWeek copies use null for createdByUserId/updatedByUserId (system-generated clones, not direct user edits)
- [Phase 32]: workers.ts routes mounted at /api/projects (not /api/workers) — cross-tenant test corrected to use actual mount path

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

Last session: 2026-03-28T19:59:10.083Z
Stopped at: CHECKPOINT: 32-03-PLAN.md Task 2 (human-verify)
Resume file: None
Next action: `/gsd:plan-phase 31`
