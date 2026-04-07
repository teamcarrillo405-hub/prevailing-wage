---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: State Portal Integration
status: Phase complete — ready for verification
stopped_at: Completed 46-notifications-46-01-PLAN.md
last_updated: "2026-04-07T17:53:26.659Z"
progress:
  total_phases: 24
  completed_phases: 23
  total_plans: 62
  completed_plans: 59
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — with compliance feedback, no missing steps. Team-ready with encrypted SSN storage and payroll imports.
**Current focus:** Phase 41 — ny-state-forms

## Current Position

Phase: 41 (ny-state-forms) — EXECUTING
Plan: 5 of 5

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
- [Phase 39]: overrideId added to getPayrollEntriesWithWorkerDetails select — enables DELETE /payroll-week-classifications/:id from UI without separate lookup
- [Phase 39]: Apprenticeship section conditionally shown via w.classifications?.some(c => c.laborType === 'apprentice') — hidden for new workers and journeyworker-only workers
- [Phase 40]: projectSettings stored as text (not json type) — consistent with auditLogs diff/snapshot/meta pattern
- [Phase 40]: nysRegisteredApprentice uses integer({ mode: 'boolean' }) — standard Drizzle SQLite boolean pattern
- [Phase 40]: isNY uses stateValue?.toUpperCase() === 'NY' — exact isCA/isWA pattern
- [Phase 40]: nysRegisteredApprentice checkbox shown universally (all workers, not NY-gated)
- [Phase 40]: getDb() called inline inside computeCompliance for project fetch — avoids renaming _db parameter (research Pitfall 2)
- [Phase 40]: NY daily OT violation emits before grossWages null check — fires even when wages not yet recorded
- [Phase 40]: NY daily check is additive to weekly CWHSSA check — not a replacement; both run for NY projects
- [Phase 41-ny-state-forms]: No statement-breakpoint in 0024 migration — single ALTER TABLE statement needs no separator
- [Phase 41-ny-state-forms]: getPayrollWeek uses select * so nyMpwrSubmittedAt automatically available; no explicit change needed
- [Phase 41-ny-state-forms]: nysRegisteredApprentice added to getPayrollEntriesWithWorkerDetails select only — workers table already joined, purely additive
- [Phase 41-ny-state-forms]: PDFDocument.create() not load() for PW-12 — programmatic drawing required, no fillable template exists
- [Phase 41-ny-state-forms]: MPWR XML uses plain ProjectRollup root — no namespace prefix; SSN placeholder 000000+ssnLast4 per STATE-03; multi-classification workers grouped into one employeeWorkWeek
- [Phase 41-ny-state-forms]: No agency_submissions table: followed setCaEcprSubmitted pattern — only update payrollWeeks.nyMpwrSubmittedAt
- [Phase 41-ny-state-forms]: Badge variant 'compliant' used for NY MPWR submitted state — no 'success' variant in design system BadgeVariant type
- [Phase 42-il-schema-project-flag]: skillLevel stored as plain text() in schema.ts; Zod enum enforcement in routes layer only
- [Phase 42-il-schema-project-flag]: skillLevel uses z.enum(['journeyman', 'apprentice']) in Zod — not z.string() — per STATE-10 requirement
- [Phase 42-il-schema-project-flag]: nonPwHours copied verbatim in amendment clone because it is user-entered data like ST/OT hours, not a computed field
- [Phase 42-il-schema-project-flag]: IL demographics section uses details/summary (open by default) to ensure IL users see the fields immediately
- [Phase 43-il-state-forms]: Used single-statement ALTER TABLE migration (no breakpoint) matching 0024 pattern
- [Phase 43-il-state-forms]: Affidavit always on dedicated page 2 — unconditional addPage() after worker rows regardless of remaining space
- [Phase 43-il-state-forms]: Non-PW hours shown as weekly total only in totalNonPw column — daily non-PW cells intentionally blank
- [Phase 43-il-state-forms]: assertProjectAccess called before IL state gate in both routes — NFR-03 compliance
- [Phase 43-il-state-forms]: ilIdolStep typed as <1 | 2> — IL is 2-step, no registration collection unlike NY MPWR 3-step
- [Phase 44-import-provider-foundation]: Used inline UNIQUE constraint in migration SQL (no statement-breakpoint) and named ImportProvider type for reuse across server files
- [Phase 44-import-provider-foundation]: Gusto signature (4 columns) checked after QB and before ADP — more specific than ADP 2-column signature
- [Phase 44-import-provider-foundation]: Overtime hours column is optional in Gusto (zero-OT exports omit it) — defaults to 0, not a required column
- [Phase 44-03]: PROVIDER_LABELS at module level — single source of truth for provider display names; fallback ?? provider for forward-compat
- [Phase 45]: Sage 100 detected by Employee Name + Pay Type signature (before QB Online check) to prevent QB misfires
- [Phase 45]: Sage 300 positional check runs before Paychex presence check — more specific detection wins
- [Phase 45-02]: onConflictDoUpdate targets all 3 columns of providerMappingUnique index for correct upsert semantics
- [Phase 45-import-id-mapped-providers]: importStep uses string literal '2b' to avoid TypeScript number literal clash; re-call handleImportPreview after saving mappings for server-authoritative step routing
- [Phase 46-notifications]: sendDueSoonEmail takes ownerEmail as direct arg (no DB query) — caller already has it from the due-soon scan
- [Phase 46-notifications]: All email send functions are non-fatal: try/catch + console.error, never rethrow (NFR-02)

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

Last session: 2026-04-07T17:53:26.655Z
Stopped at: Completed 46-notifications-46-01-PLAN.md
Resume file: None
Next action: Execute `/gsd:execute-phase 37` for Plan 02 (auditService.ts + tests)
