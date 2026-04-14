---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: State Portal Integration
status: Milestone complete
stopped_at: Completed 59-01-PLAN.md
last_updated: "2026-04-14T10:28:45.263Z"
progress:
  total_phases: 37
  completed_phases: 34
  total_plans: 81
  completed_plans: 83
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — with compliance feedback, no missing steps. Team-ready with encrypted SSN storage and payroll imports.
**Current focus:** Phase 56 — subcontractor-ui-panel

## Current Position

Phase: 59
Plan: Not started

## Performance Metrics

**Velocity (v4.0 — completed 2026-04-07):**

- Total phases: 10 (phases 37–46)
- Total plans: 34
- Shipped: 2026-04-07

**v5.0 target:**

- Total phases: 13 (phases 47–59)
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
- [Phase 46-notifications]: NOTIF-01 fires only from upsertPayrollEntry write path; computeCompliance is never patched internally so GET reads never trigger violation emails
- [Phase 46-notifications]: ny-submit and il-submit NOTIF-04 fire unconditionally because these routes have no submitted boolean toggle
- [Phase 46-notifications]: dateDiffDays threshold uses [0, dueSoonDays] inclusive window; past-due weeks (negative days) are not reminded
- [Phase 46-notifications]: vi.mock factories use inline vi.fn() to avoid Vitest hoisting ReferenceErrors; tests use vi.mocked() pattern
- [Phase 46-notifications]: Shallow spread merge for projectSettings preserves sibling keys (NY form data) when notif prefs are updated via PATCH
- [Phase 46-notifications]: parseNotifSettings defined locally in ProjectDetailPage to avoid server code in client bundle

Key decisions locked for v5.0 scope:

- STATE_FORMS registry replaces per-state boolean blocks in PayrollWeekDetailPage (STATE-12) — must be committed before any new state phase (NFR-06)
- All state comparisons normalized to .toUpperCase() on both client and server (STATE-13) — committed in Phase 47
- TX and FL use existing WH-347 generator (no new PDF generator) — TX adds header field overlay, FL is WH-347 only with informational callout
- MA and NJ use PDFDocument.create() programmatic draw (ilPdfGenerator.ts pattern) — no official fillable PDF template available for pdf-lib template overlay
- workerSex is a separate column from gender — legally-required sex on a compliance form is semantically distinct from gender identity; different code sets
- Subcontractor model is per-project (not global) — subs have different contacts/licenses per project; assertProjectAccess scopes via projectId without a separate access layer
- subcontractor_cpr_weeks uses weekEndingDate text (not payrollWeekId FK) per REQUIREMENTS.md SUB-02 spec — tracking is by calendar week, not by internal payroll week record
- CSV formula injection sanitization: cell values starting with =, +, -, or @ are prefixed with a space before passing to csv-stringify (NFR-07)
- Multi-project compliance PDF generates counts + status badges only (no per-violation detail rows) — violation detail listing deferred to v6.0
- complianceSummaryPdfGenerator.ts enforces 50-project hard cap to stay within Render.com 512 MB memory ceiling
- [Phase 47]: state?.toUpperCase() === 'XX' is the canonical pattern for all state comparisons — optional chain handles null/undefined project state safely
- [Phase 47]: STATE_FORMS registry replaces per-state boolean download-button blocks in PayrollWeekDetailPage (STATE-12); NY/IL remain standalone modal-flow blocks; TX route is 'wh347' matching existing WH-347 generator; handleStateFormDownload uses shared generatingRef
- [Phase 47-state-foundations-tx-certified-payroll]: TX fields use existing projects schema pattern (no new table) — 3 columns on projects, 1 on payroll_weeks
- [Phase 47-state-foundations-tx-certified-payroll]: WH-347 builder uses txdotProjectId || wdIdentifier fallback — TX projects get TxDOT number; non-TX projects keep WD identifier
- [Phase 47]: ExternalLink added to lucide-react import in PayrollWeekDetailPage for TX LCPtracker callout — preferred icon for external portal references
- [Phase 47]: TX HelpCallout placed after WA PWIA panel, before CA eCPR modal — consistent with state-panel ordering
- [Phase 48-fl-certified-payroll]: FL uses WH-347 generator via STATE_FORMS registry (no new PDF generator, no DB migration); Info icon for purely informational callouts; plain string body for callouts without anchor tags
- [Phase 49-ma-schema-ui]: checkNumber/allOtherHours/totalWeekGrossWages stored as nullable fields; amendment clone copies verbatim (user-entered data); isWoman/isMinority/oshaTraining added to select for Phase 50 generator
- [Phase 49-ma-schema-ui]: MA nullable booleans use integer({ mode: 'boolean' }) with no .notNull()/.default() — workers may decline to self-identify
- [Phase 49-ma-schema-ui]: MA/NJ dual gate (isMA || isNJ) for UI sections — NJ reuses same worker demographics columns
- [Phase 49-03]: assertProjectAccess called before MA state gate in export route (NFR-03)
- [Phase 49-03]: MA export stub returns 501 — Phase 50 fills in the PDF generator
- [Phase 49-03]: PayrollEntryPage is actual render site for PayrollWeekForm (not PayrollWeekDetailPage)
- [Phase 50]: fmtBoolean returns Y/N/em-dash for boolean|null — distinct from fmtDollar/fmtOptional
- [Phase 50]: Statement of Compliance always on dedicated page 2 via unconditional addPage() (Phase 43 pattern)
- [Phase 50-ma-pdf-generator]: Sunday-first day order in MA entry mapping matches MaPdfInput interface; checkNumber/totalWeekGrossWages/allOtherHours use null (not 0) for blank-on-PDF semantics
- [Phase 50-ma-pdf-generator]: Audit log action 'ma_pdf.downloaded' matches IL pattern 'il_pdf.downloaded'; assertProjectAccess before state gate preserved (NFR-03)
- [Phase 51-nj-schema-routes]: workerSex uses text() not integer — EEO sex codes M/F/N are not boolean; Zod enum enforces valid values at route layer; no NJ state gate on workers route
- [Phase 51-nj-schema-routes]: NJ export stub returns 501 following assertProjectAccess before state gate (NFR-03); Phase 52 implements the PDF generator
- [Phase 51-nj-schema-routes]: Indigo color scheme for NJ blocks distinct from MA teal; workerSex sent only in isNJ mutation branch; STATE_FORMS NJ entry uses route key nj-mw562 matching server path
- [Phase 52]: ficaTax/federalIncomeTax/stateIncomeTax use nullable real() with no .notNull()/.default() — matches fringeHealthWelfare pattern
- [Phase 52]: Amendment clone carries NJ deduction fields verbatim per 29 CFR Part 3 (user-entered data, not computed)
- [Phase 52]: fmtEeo returns code letter (M/F/N, W/B/A/N/I/M, H/N) or em-dash, distinct from fmtBoolean; NJ day order Monday-first vs MA Sunday-first
- [Phase 52]: Dedicated compliance page 2 via unconditional addPage(); audit action nj_pdf.downloaded; assertProjectAccess before NJ state gate (NFR-03)
- [Phase 53-ca-a-1-131-gap-close]: Conditional onClick on STATE_FORMS button routes CA through handleCaDownloadClick() modal; all other states use handleStateFormDownload()
- [Phase 53-ca-a-1-131-gap-close]: ca_pdf.downloaded audit log placed after res.end() in a1131 route — matches NJ/MA/IL pattern (AUDIT-03)
- [Phase 53]: Checkpoint auto-approved per user authorization; visual PDF inspection deferred to post-deployment QA
- [Phase 54]: isCompliant stored as bare INTEGER (no mode:boolean, no notNull) — null=unassessed, 0=non-compliant, 1=compliant; coercion would destroy three-state semantics
- [Phase 54]: subcontractors is per-project (not global) — subs have different contacts/licenses per project; assertProjectAccess scopes via projectId without a separate access layer
- [Phase 54]: subcontractor_cpr_weeks uses weekEndingDate text ISO 8601 (not payrollWeekId FK) — tracking is by calendar week, not internal payroll week record (SUB-02 spec locked)
- [Phase 55]: isCompliant uses z.union([z.literal(0), z.literal(1)]) not z.boolean() — three-state null/0/1 semantics preserved
- [Phase 55]: Audit logs only on subcontractor.created and subcontractor.removed — no audit on PATCH or CPR-week operations
- [Phase 55]: 409 from application-level duplicate check before insert, not from DB UNIQUE constraint propagation
- [Phase 56]: BadgeVariant exported from Badge.tsx to allow import type in cprStatus.ts (Rule 2 auto-fix)
- [Phase 56]: CprWeekTable nested inside SubcontractorsPanel body (single-use, not exported)
- [Phase 56]: isCompliant === 1 strict equality enforced; weekEndingDate + T00:00:00 for local time parse

### Phase Order Rationale

- Phase 47 first: carries the mandatory pre-flight refactors (STATE_FORMS registry, .toUpperCase() normalization) that NFR-06 requires before any new state phase; TX is the lowest-risk first state (WH-347 reuse, no new PDF generator)
- Phase 48 second: FL is so minimal (WH-347 reuse, informational callout only) it doubles as a smoke test confirming Phase 47 refactors are clean
- Phases 49-50 (MA) before Phases 51-52 (NJ): MA has more new DB columns; building MA first establishes the pattern for NJ's smaller column set; NJ reuses existing race/ethnicity columns from v4.0 reducing new-column count
- Phase 53 (CA gap) after NJ: closes the long-open Phase 24 Task 3 gap without interrupting the state form rhythm; does not block any v5.0 feature
- Phase 54 (sub schema) before Phases 55-56 (sub routes + UI): API must exist before panel can be built or tested; schema must exist before routes can query it
- Phases 57-59 (reporting) at end: benefits from all prior data being live; audit CSV (57) is lowest-risk; fringe report (58) is independent; compliance PDF (59) depends on sub schema (Phase 54) for CPR overdue counts

### Critical Pitfalls (from research)

- IDOR from scattered ownership checks — mitigated by assertProjectAccess in Phase 32 with cross-tenant test suite
- Rate snapshot corruption on CSV import — rate snapshots must come from getCachedClassifications, never from CSV values
- SSN encryption key loss — versioned JSON envelope + startup assertion + re-encryption runbook before first migration
- submittedAt set optimistically — use agency_submissions status table; never set submittedAt until portal confirms
- [v5.0] Inconsistent state case normalization — fix with STATE-13 in Phase 47 before any new state is added
- [v5.0] isXX boolean sprawl — replace with STATE_FORMS registry (STATE-12) in Phase 47 before 8-state expansion
- [v5.0] PDF coordinate trap (MA/NJ) — measure actual page dimensions from official form download before writing coordinates; do not guess from screenshots
- [v5.0] Sub model must be per-sub-per-week from day one — two-table model with UNIQUE on (subcontractorId, weekEndingDate) is non-negotiable
- [v5.0] CSV formula injection — sanitizeCsvCell() prefixer required on all user-controlled string fields; acceptance criterion for Phase 57

### Pending Todos

- Phase 24: 24-03-PLAN.md not yet executed (A-1-131 PDF generator + export route). Pre-existing v2.4 work. Closed by Phase 53 (CA-02 browser verification).

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-14T10:27:47.966Z
Stopped at: Completed 59-01-PLAN.md
Resume file: None
Next action: Execute `/gsd:plan-phase 47` to plan Phase 47 (State Foundations + TX Certified Payroll)
