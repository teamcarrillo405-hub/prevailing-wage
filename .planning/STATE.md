---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: State Portal Integration
status: v2.5 milestone complete
stopped_at: "126-04 Task 1 complete — FileErpCard shipped; awaiting checkpoint:human-verify for Task 2"
last_updated: "2026-05-28T22:52:00.058Z"
progress:
  total_phases: 37
  completed_phases: 37
  total_plans: 84
  completed_plans: 84
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-11)

**Core value:** GC can run a full project end-to-end -- create -> workers -> payroll -> WH-347 -> submit -- with compliance feedback, no missing steps. Team-ready with encrypted SSN storage and payroll imports.
**Current focus:** Phase 126 — integration-foundation

## Current Position

Phase: 126 (integration-foundation) — EXECUTING
Plan: 4 of 4

## Performance Metrics

**Velocity (v4.0 -- completed 2026-04-07):**

- Total phases: 10 (phases 37-46)
- Total plans: 34
- Shipped: 2026-04-07

**v9.0 target:**

- Total phases: 9 (phases 126-134)
- Total plans: TBD (set during plan-phase)

## Accumulated Context

### Decisions

Phase 37 Plan 01 decisions:

- Drizzle index() (not uniqueIndex()) for audit log composite indexes -- they are non-unique
- DESC ordering in raw SQL migration only -- Drizzle index() builder lacks .desc() for composite indexes in installed version
- projectId FK uses onDelete: set null so audit rows survive project deletion

Key decisions carried forward from v3.0:

- Multi-user: flat model -- owner invites by email; all members see all projects; no per-project permission tiers; max 2 users (owner + 1 member)
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
- [Phase 37]: redactSensitiveFields is NOT exported -- internal write-side guard only; diffObjects IS exported for Phase 38+ callers; hasSensitiveNonNull checks key presence never ciphertext; zero cryptoService imports to avoid test process.exit
- [Phase 38]: trust proxy set to 1 in index.ts for real client IP behind Render.com load balancer
- [Phase 38]: assertProjectAccess called before deletePayrollEntry for correct NFR-03 authorization ordering
- [Phase 38]: dynamic import used for auditService in route files to avoid circular dependency risk
- [Phase 38-audit-trail-wiring-activity-ui]: audit route: conditions typed as ReturnType<typeof eq>[], to param appended T23:59:59.999Z for inclusive end-of-day, JSON column parsing at HTTP boundary not in service
- [Phase 38-audit-trail-wiring-activity-ui]: useSearchParams (not useState) for date filter -- makes URLs bookmarkable per AUDIT-05 requirement
- [Phase 38-audit-trail-wiring-activity-ui]: ACTION_LABELS map (15 entries) covers all audit action types; route uses :id (not :projectId) to match useParams destructuring in ProjectActivityPage
- [Phase 39-01]: randomUUID from crypto instead of uuid package -- no @types/uuid; consistent with all other route files
- [Phase 39-01]: LEFT JOIN for payrollWeekClassifications -- INNER JOIN would exclude entries without override from all exports
- [Phase 39-01]: DELETE+INSERT upsert for classification override -- handles unique constraint; SQLite lacks UPSERT ON CONFLICT UPDATE syntax
- [Phase 39]: overrideId added to getPayrollEntriesWithWorkerDetails select -- enables DELETE /payroll-week-classifications/:id from UI without separate lookup
- [Phase 39]: Apprenticeship section conditionally shown via w.classifications?.some(c => c.laborType === 'apprentice') -- hidden for new workers and journeyworker-only workers
- [Phase 40]: projectSettings stored as text (not json type) -- consistent with auditLogs diff/snapshot/meta pattern
- [Phase 40]: nysRegisteredApprentice uses integer({ mode: 'boolean' }) -- standard Drizzle SQLite boolean pattern
- [Phase 40]: isNY uses stateValue?.toUpperCase() === 'NY' -- exact isCA/isWA pattern
- [Phase 40]: nysRegisteredApprentice checkbox shown universally (all workers, not NY-gated)
- [Phase 40]: getDb() called inline inside computeCompliance for project fetch -- avoids renaming _db parameter (research Pitfall 2)
- [Phase 40]: NY daily OT violation emits before grossWages null check -- fires even when wages not yet recorded
- [Phase 40]: NY daily check is additive to weekly CWHSSA check -- not a replacement; both run for NY projects
- [Phase 41-ny-state-forms]: No statement-breakpoint in 0024 migration -- single ALTER TABLE statement needs no separator
- [Phase 41-ny-state-forms]: getPayrollWeek uses select * so nyMpwrSubmittedAt automatically available; no explicit change needed
- [Phase 41-ny-state-forms]: nysRegisteredApprentice added to getPayrollEntriesWithWorkerDetails select only -- workers table already joined, purely additive
- [Phase 41-ny-state-forms]: PDFDocument.create() not load() for PW-12 -- programmatic drawing required, no fillable template exists
- [Phase 41-ny-state-forms]: MPWR XML uses plain ProjectRollup root -- no namespace prefix; SSN placeholder 000000+ssnLast4 per STATE-03; multi-classification workers grouped into one employeeWorkWeek
- [Phase 41-ny-state-forms]: No agency_submissions table: followed setCaEcprSubmitted pattern -- only update payrollWeeks.nyMpwrSubmittedAt
- [Phase 41-ny-state-forms]: Badge variant 'compliant' used for NY MPWR submitted state -- no 'success' variant in design system BadgeVariant type
- [Phase 42-il-schema-project-flag]: skillLevel stored as plain text() in schema.ts; Zod enum enforcement in routes layer only
- [Phase 42-il-schema-project-flag]: skillLevel uses z.enum(['journeyman', 'apprentice']) in Zod -- not z.string() -- per STATE-10 requirement
- [Phase 42-il-schema-project-flag]: nonPwHours copied verbatim in amendment clone because it is user-entered data like ST/OT hours, not a computed field
- [Phase 42-il-schema-project-flag]: IL demographics section uses details/summary (open by default) to ensure IL users see the fields immediately
- [Phase 43-il-state-forms]: Used single-statement ALTER TABLE migration (no breakpoint) matching 0024 pattern
- [Phase 43-il-state-forms]: Affidavit always on dedicated page 2 -- unconditional addPage() after worker rows regardless of remaining space
- [Phase 43-il-state-forms]: Non-PW hours shown as weekly total only in totalNonPw column -- daily non-PW cells intentionally blank
- [Phase 43-il-state-forms]: assertProjectAccess called before IL state gate in both routes -- NFR-03 compliance
- [Phase 43-il-state-forms]: ilIdolStep typed as <1 | 2> -- IL is 2-step, no registration collection unlike NY MPWR 3-step
- [Phase 44-import-provider-foundation]: Used inline UNIQUE constraint in migration SQL (no statement-breakpoint) and named ImportProvider type for reuse across server files
- [Phase 44-import-provider-foundation]: Gusto signature (4 columns) checked after QB and before ADP -- more specific than ADP 2-column signature
- [Phase 44-import-provider-foundation]: Overtime hours column is optional in Gusto (zero-OT exports omit it) -- defaults to 0, not a required column
- [Phase 44-03]: PROVIDER_LABELS at module level -- single source of truth for provider display names; fallback ?? provider for forward-compat
- [Phase 45]: Sage 100 detected by Employee Name + Pay Type signature (before QB Online check) to prevent QB misfires
- [Phase 45]: Sage 300 positional check runs before Paychex presence check -- more specific detection wins
- [Phase 45-02]: onConflictDoUpdate targets all 3 columns of providerMappingUnique index for correct upsert semantics
- [Phase 45-import-id-mapped-providers]: importStep uses string literal '2b' to avoid TypeScript number literal clash; re-call handleImportPreview after saving mappings for server-authoritative step routing
- [Phase 46-notifications]: sendDueSoonEmail takes ownerEmail as direct arg (no DB query) -- caller already has it from the due-soon scan
- [Phase 46-notifications]: All email send functions are non-fatal: try/catch + console.error, never rethrow (NFR-02)
- [Phase 46-notifications]: NOTIF-01 fires only from upsertPayrollEntry write path; computeCompliance is never patched internally so GET reads never trigger violation emails
- [Phase 46-notifications]: ny-submit and il-submit NOTIF-04 fire unconditionally because these routes have no submitted boolean toggle
- [Phase 46-notifications]: dateDiffDays threshold uses [0, dueSoonDays] inclusive window; past-due weeks (negative days) are not reminded
- [Phase 46-notifications]: vi.mock factories use inline vi.fn() to avoid Vitest hoisting ReferenceErrors; tests use vi.mocked() pattern
- [Phase 46-notifications]: Shallow spread merge for projectSettings preserves sibling keys (NY form data) when notif prefs are updated via PATCH
- [Phase 46-notifications]: parseNotifSettings defined locally in ProjectDetailPage to avoid server code in client bundle

Key decisions locked for v5.0 scope:

- STATE_FORMS registry replaces per-state boolean blocks in PayrollWeekDetailPage (STATE-12) -- must be committed before any new state phase (NFR-06)
- All state comparisons normalized to .toUpperCase() on both client and server (STATE-13) -- committed in Phase 47
- TX and FL use existing WH-347 generator (no new PDF generator) -- TX adds header field overlay, FL is WH-347 only with informational callout
- MA and NJ use PDFDocument.create() programmatic draw (ilPdfGenerator.ts pattern) -- no official fillable PDF template available for pdf-lib template overlay
- workerSex is a separate column from gender -- legally-required sex on a compliance form is semantically distinct from gender identity; different code sets
- Subcontractor model is per-project (not global) -- subs have different contacts/licenses per project; assertProjectAccess scopes via projectId without a separate access layer
- subcontractor_cpr_weeks uses weekEndingDate text (not payrollWeekId FK) per REQUIREMENTS.md SUB-02 spec -- tracking is by calendar week, not by internal payroll week record
- CSV formula injection sanitization: cell values starting with =, +, -, or @ are prefixed with a space before passing to csv-stringify (NFR-07)
- Multi-project compliance PDF generates counts + status badges only (no per-violation detail rows) -- violation detail listing deferred to v6.0
- complianceSummaryPdfGenerator.ts enforces 50-project hard cap to stay within Render.com 512 MB memory ceiling
- [Phase 47]: state?.toUpperCase() === 'XX' is the canonical pattern for all state comparisons -- optional chain handles null/undefined project state safely
- [Phase 47]: STATE_FORMS registry replaces per-state boolean download-button blocks in PayrollWeekDetailPage (STATE-12); NY/IL remain standalone modal-flow blocks; TX route is 'wh347' matching existing WH-347 generator; handleStateFormDownload uses shared generatingRef
- [Phase 47-state-foundations-tx-certified-payroll]: TX fields use existing projects schema pattern (no new table) -- 3 columns on projects, 1 on payroll_weeks
- [Phase 47-state-foundations-tx-certified-payroll]: WH-347 builder uses txdotProjectId || wdIdentifier fallback -- TX projects get TxDOT number; non-TX projects keep WD identifier
- [Phase 47]: ExternalLink added to lucide-react import in PayrollWeekDetailPage for TX LCPtracker callout -- preferred icon for external portal references
- [Phase 47]: TX HelpCallout placed after WA PWIA panel, before CA eCPR modal -- consistent with state-panel ordering
- [Phase 48-fl-certified-payroll]: FL uses WH-347 generator via STATE_FORMS registry (no new PDF generator, no DB migration); Info icon for purely informational callouts; plain string body for callouts without anchor tags
- [Phase 49-ma-schema-ui]: checkNumber/allOtherHours/totalWeekGrossWages stored as nullable fields; amendment clone copies verbatim (user-entered data); isWoman/isMinority/oshaTraining added to select for Phase 50 generator
- [Phase 49-ma-schema-ui]: MA nullable booleans use integer({ mode: 'boolean' }) with no .notNull()/.default() -- workers may decline to self-identify
- [Phase 49-ma-schema-ui]: MA/NJ dual gate (isMA || isNJ) for UI sections -- NJ reuses same worker demographics columns
- [Phase 49-03]: assertProjectAccess called before MA state gate in export route (NFR-03)
- [Phase 49-03]: MA export stub returns 501 -- Phase 50 fills in the PDF generator
- [Phase 49-03]: PayrollEntryPage is actual render site for PayrollWeekForm (not PayrollWeekDetailPage)
- [Phase 50]: fmtBoolean returns Y/N/em-dash for boolean|null -- distinct from fmtDollar/fmtOptional
- [Phase 50]: Statement of Compliance always on dedicated page 2 via unconditional addPage() (Phase 43 pattern)
- [Phase 50-ma-pdf-generator]: Sunday-first day order in MA entry mapping matches MaPdfInput interface; checkNumber/totalWeekGrossWages/allOtherHours use null (not 0) for blank-on-PDF semantics
- [Phase 50-ma-pdf-generator]: Audit log action 'ma_pdf.downloaded' matches IL pattern 'il_pdf.downloaded'; assertProjectAccess before state gate preserved (NFR-03)
- [Phase 51-nj-schema-routes]: workerSex uses text() not integer -- EEO sex codes M/F/N are not boolean; Zod enum enforces valid values at route layer; no NJ state gate on workers route
- [Phase 51-nj-schema-routes]: NJ export stub returns 501 following assertProjectAccess before state gate (NFR-03); Phase 52 implements the PDF generator
- [Phase 51-nj-schema-routes]: Indigo color scheme for NJ blocks distinct from MA teal; workerSex sent only in isNJ mutation branch; STATE_FORMS NJ entry uses route key nj-mw562 matching server path
- [Phase 52]: ficaTax/federalIncomeTax/stateIncomeTax use nullable real() with no .notNull()/.default() -- matches fringeHealthWelfare pattern
- [Phase 52]: Amendment clone carries NJ deduction fields verbatim per 29 CFR Part 3 (user-entered data, not computed)
- [Phase 52]: fmtEeo returns code letter (M/F/N, W/B/A/N/I/M, H/N) or em-dash, distinct from fmtBoolean; NJ day order Monday-first vs MA Sunday-first
- [Phase 52]: Dedicated compliance page 2 via unconditional addPage(); audit action nj_pdf.downloaded; assertProjectAccess before NJ state gate (NFR-03)
- [Phase 53-ca-a-1-131-gap-close]: Conditional onClick on STATE_FORMS button routes CA through handleCaDownloadClick() modal; all other states use handleStateFormDownload()
- [Phase 53-ca-a-1-131-gap-close]: ca_pdf.downloaded audit log placed after res.end() in a1131 route -- matches NJ/MA/IL pattern (AUDIT-03)
- [Phase 53]: Checkpoint auto-approved per user authorization; visual PDF inspection deferred to post-deployment QA
- [Phase 54]: isCompliant stored as bare INTEGER (no mode:boolean, no notNull) -- null=unassessed, 0=non-compliant, 1=compliant; coercion would destroy three-state semantics
- [Phase 54]: subcontractors is per-project (not global) -- subs have different contacts/licenses per project; assertProjectAccess scopes via projectId without a separate access layer
- [Phase 54]: subcontractor_cpr_weeks uses weekEndingDate text ISO 8601 (not payrollWeekId FK) -- tracking is by calendar week, not internal payroll week record (SUB-02 spec locked)
- [Phase 55]: isCompliant uses z.union([z.literal(0), z.literal(1)]) not z.boolean() -- three-state null/0/1 semantics preserved
- [Phase 55]: Audit logs only on subcontractor.created and subcontractor.removed -- no audit on PATCH or CPR-week operations
- [Phase 55]: 409 from application-level duplicate check before insert, not from DB UNIQUE constraint propagation
- [Phase 56]: BadgeVariant exported from Badge.tsx to allow import type in cprStatus.ts (Rule 2 auto-fix)
- [Phase 56]: CprWeekTable nested inside SubcontractorsPanel body (single-use, not exported)
- [Phase 56]: isCompliant === 1 strict equality enforced; weekEndingDate + T00:00:00 for local time parse
- [Phase 83]: @logtail/pino installed with --legacy-peer-deps due to pre-existing vite8/vite-plugin-pwa peer conflict; three-branch transport (test=none, token=drain, dev-no-token=pino-pretty); startup warning after pinoHttp registration
- [Phase 83]: Primary contact security@prevailingwage.app matches /.well-known/security.txt; teamcarrillo405@gmail.com as escalation-only in SECURITY_POLICY.md
- [Phase 83]: SecurityPolicyPage.tsx SLA updated from 48h to 72h and contact from security@prevwage.app to security@prevailingwage.app -- three artifacts now consistent
- [Phase 84-dependabot-uptime-monitoring]: npm-all group with patterns:[*] consolidates 68 npm packages into single weekly PR
- [Phase 84-dependabot-uptime-monitoring]: dependencies label must be created manually in GitHub repo Settings before first Dependabot run
- [Phase 84-02]: STATUS_PAGE_URL placeholder committed deliberately -- Better Stack account setup is a deferred manual follow-up; Task 2 checkpoint deferred-approved by user
- [Phase 84-02]: System Status uses <a> not React Router <Link> because it is an external URL
- [Phase 85]: FTS5 standalone triggers use DELETE FROM workers_fts WHERE worker_id = old.id (not FTS5 delete idiom) -- works in trigger context; rowid idiom is content-table-only and fails
- [Phase 85]: Search route registered at line 194 before :workerId at line 294 in workers.ts -- prevents Express treating 'search' as workerId param
- [Phase 85]: useDebounce initialized with value (not undefined) -- first render returns correct initial value without debounce penalty
- [Phase 85]: displayedWorkers switches between FTS5 search hits and labor-filter-respecting full workers list (fullWorkers = post-filter workers, not allWorkers)
- [Phase 85]: DashboardPage client-side project filter verified unchanged (filteredProjects useMemo at lines 300-313 meets Phase 85 criterion 4 via pre-existing Phase 18 code)
- [Phase 86]: UTC timezone for scheduled-reports cron (not ET) -- deterministic region-agnostic dispatch per ROADMAP spec
- [Phase 86]: GET and POST both supported for /api/notifications/unsubscribe -- email href fires GET; POST for API callers
- [Phase 86]: Resend used (not nodemailer) for scheduled reports -- STATE.md decision; ROADMAP nodemailer wording is documented copy-paste error per RESEARCH Pitfall 1
- [Phase 86-scheduled-report-emails]: parseReportSettings exported for direct unit test coverage without mounting full page
- [Phase 87-phase-a-watchdog-gate]: GATE_PASS 10.0/10 -- all 10 Phase A criteria verified green; 762 tests passing; TypeScript clean; Phase 88 unblocked
- [Phase 94-01]: RowValues imported from Step2GridRow for EntryPayload.values type; _resetDb uses store.clear() not deleteDatabase (fake-indexeddb hang fix); composite key lookups via getAll+filter for Safari compatibility
- [Phase 94-02]: useOfflineEntryMutation wraps useEntryMutation; OfflineSaveStatus 5-value type; Step2MobileEntry also updated (found during TS check)
- [Phase 94-03]: OfflineBadge sums generic + payroll queue lengths via Promise.all; single 10s poll covers both
- [Phase 95-01]: replayPayrollQueue uses native indexedDB (not idb lib) -- SW bundle isolation; 409 synced-elsewhere; 2xx+other-4xx delete; 5xx/network keep
- [Phase 95-02]: useSyncStatus derives idle/syncing/synced/pending state; SyncStatusIndicator pure presentational pill; 4s auto-hide after 'synced'
- [Phase 95-03]: registerSyncIfSupported exported from offlineQueue.ts with SyncManager feature detect; void fire-and-forget in handleOnline
- [Phase 96-01]: Migration 0059 uses statement-breakpoint between the two CREATE TABLE statements; GET /api/projects/:id/photos returns inline base64 dataUrl (option b -- no separate file route needed)
- [Phase 96-02]: Pure HTML5 canvas for SignaturePad (no external library); extractExifGps defined outside component; capture="environment" for rear camera preference; InferSelectModel fix for photos.ts map callback
- [Phase 97-01]: BottomTabBar 4 tabs: Field/Payroll/Projects/More to /field,/dashboard,/reports,/team; pathname === tab.to exact match; pb-14 md:pb-8 on main; 60px swipe threshold
- [Phase 98-01]: crypto.randomUUID() used in client (browser native, no uuid package); deleteChecklist inline in page component; syncPendingChecklists fires on online event + mount + item completion
- [Phase 99-phase-c-watchdog-gate]: GATE_PASS 10.00/10 -- all 10 Phase C criteria verified green; 803 tests passing; 0 TS deductions; Phase 100 unblocked
- [Phase 100-01]: calcRoi() is pure exported function for deterministic unit testing; useSearchParams for URL param seeding; jsdom vitest-environment docblock per-file (not global config change)
- [Phase 100-02]: Migration numbered 0061 (plan said 0055 -- outdated); named export roiLeadsRouter; mounted before /api/auth (no auth); afterEach full-table delete in isolated in-memory DB
- [Phase 110-01]: @node-saml/node-saml v5 exports SAML class (not ServiceProvider/IdentityProvider -- plan had wrong API surface); used SAML.getAuthorizeUrlAsync + SAML.validatePostResponseAsync; ValidateInResponseTo enum for type-safe config; all 4 SSO routes created in single file for API consistency
- [Phase 111-01]: User type in AuthContext lacks planTier -- fetch from /api/billing/status via useQuery (same as BillingPage pattern)
- [Phase 112]: Phase B Gate GATE_PASS 10.02/10 -- all 6 criteria verified
- [Phase 113]: /api/health was already present in index.ts (returns {status:'ok', db:'ok'}); render.yaml healthCheckPath + 9 env vars added; DEPLOY.md 7-section runbook created
- [Phase 114]: UsComplianceMap uses grid-aligned polygon approximations (plan explicitly permits this); 8KB file; no external map library; Alaska/Hawaii as bottom-left insets
- [Phase 106-watchdog-gate]: Phase D GATE_PASS 10.0/10 -- all 10 criteria verified; 824 tests passing; 0 TS errors; LCPtracker audit 5 AHEAD / 2 PARITY / 1 BEHIND (DBE classification gap); v7.0.0 tagged 2026-04-27
- [Phase 93-phase-b-watchdog-gate]: GATE_PASS 9.50/10 -- all 10 Phase B criteria verified green; 794 tests passing; 1 TS deduction (stripeService.ts version string, -0.5); Phase 94 unblocked
- [Phase 89-01]: WH347_FORM_REVISION = 'Rev. Jan. 2025' constant + pdfDoc.setTitle() in fillSingleSet(); setText() for optional header_formRevision widget
- [Phase 89-02]: DeductionViolation type + deductionViolations[] on ComplianceResult; DEDUCTION_RATIO_CAP=0.30 loop in computeCompliance(); hasViolations excludes deduction warnings; amber banner in PayrollWeekDetailPage
- [Phase 89-03]: CIVIL_PENALTY_PER_VIOLATION=13_508 constant; useQuery for /compliance/projects/summary; civil penalty card renders only on active projects with violations
- [Phase 88]: Weekly WD sync cron (Sunday 03:00 UTC) replaces monthly 1st-of-month cron; wdRevisionLog table tracks revision bumps for audit trail
- [Phase 90-03]: Procore card placed below QBO card with same visual pattern; ?procore=connected banner uses no setTimeout (user navigates away); Import Timesheets uses plain anchor not Button
- [Phase 91]: MN DLI form uses Monday-first day order (Mo-Tu-We-Th-Fr-Sa-Su); migration idx 57 used (55/56 already taken); grossWages field simpler than MA projectGross/totalWeekGross split; Statement of Compliance cites Minn. Stat. 177.42
- [Phase 92]: VA DOLI form uses Monday-first day order matching MN; migration idx 58 (next after 57); Statement of Compliance cites Va. Code Section 2.2-4360 et seq. (Virginia Public Procurement Act)
- [Phase 119]: getBatchProjectCompliance reused for /stats and /compliance-trend -- avoids duplicate batch traversal
- [Phase 119]: Pitfall 2 resolved: at-risk definition = past-due unsubmitted payroll week < today-7d, matching /violations route semantics
- [Phase 119]: Three new useQuery hooks replace five client-side useMemos -- DashboardPage is now a thin presentation layer consuming server endpoint contracts
- [Phase 120]: WA branch input IDs use add-wa- prefix to avoid duplicate-id HTML conflicts with hasWd branch
- [Phase 120]: COMP-04 structured render uses ?? 0 nullish coalescing for optional WeekViolation fields excessHours/estimatedLiabilityUsd
- [Phase 120]: Non-COMP-04 violations fall through to flat wv.detail span per RESEARCH Pitfall 3
- [Phase 121-quickbooks-employee-time-import]: qboIds string[] in POST body forces server-side QB re-fetch; client never sees raw SSN
- [Phase 121-quickbooks-employee-time-import]: assertProjectAccess called before getValidAccessToken in import-employees route (NFR-03 ordering)
- [Phase 121-quickbooks-employee-time-import]: Shared selectedProjectId state in IntegrationsPage drives both EmployeeImportSection (121-01) and future SyncTimesheetSection (121-02)
- [Phase 121-quickbooks-employee-time-import]: buildImportRows exported not inline -- enables direct unit test import without mounting IntegrationsPage (Phase 86 pattern)
- [Phase 121-quickbooks-employee-time-import]: dailySplitConfirmed defaults false and gates commit -- prevents silent acceptance of evenly-split QB weekly totals
- [Phase 121-quickbooks-employee-time-import]: Commit posts to /api/payroll/import/commit with provider:'quickbooks' (not push-approved-hours) -- audit-row + conflict-detection consistency (Pitfall 6 resolution)
- [Phase 122]: UpdateCertSchema grouped with CreateCertSchema; PATCH cert route after DELETE cert; api.patch already exists; EMPTY_CERT_FORM extended with issueDate/naicsCodes/selfCertified for edit form pre-population; editingCertId toggle pattern for inline cert edit
- [Phase 122]: vi.mock('resend') factory uses function constructor (not arrow) -- dynamic import in job lazy-init requires new Resend() to work as constructor; shared mockSend reference handles singleton without vi.resetModules
- [Phase 122]: Branch A chosen for participation card click handler: expandedSubId state present in SubcontractorsPanel, setExpandedSubId(firstCertified.id) used
- [Phase 123-02]: vi.doMock (not vi.mock) for per-test transport isolation -- vi.mock is hoisted once; vi.doMock fires at call time and survives vi.resetModules()
- [Phase 123-02]: getDb() called inside test functions not at module scope -- module-level calls run before beforeAll in setupFiles, returning wrong DB handle
- [Phase 123]: qrcode installed with --legacy-peer-deps; generateTotpSecret made async returning qrDataUrl; TOTP gate on transfer-ownership+invite-revoke via dynamic import; bannerDismissed in-memory only for SOC 2 nag
- [Phase 125-03]: UI-08 hamburger nav confirmed fully implemented from Phase 97 -- Menu/X icons, full drawer with backdrop, all nav links with min-h-[44px]; no Layout.tsx changes needed
- [Phase 125-03]: PayrollWeekDetailPage tables already had overflow-x-auto before this plan (desktop entries table + WH-347 Mon-Sun table both wrapped); grep count 5 satisfies acceptance criterion
- [Phase 125-03]: WorkersPage action buttons (Edit/+Trade/Remove) already had min-h-[44px] sm:min-h-0 from prior plan -- only search input needed text-base addition
- [Phase 125-03]: ProjectDetailPage has no inline payroll weeks list -- weeks data used only for workflow progress step completion indicators; no payroll empty state needed

Key decisions locked for v9.0 scope:

- SQLite WAL mode (PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000) must be enabled in Phase 126 before any sync job runs -- cannot be retrofitted safely
- SSN must never appear in any outbound ERP payload -- enforce via explicit inclusion lists (never row spread); unit tests must assert no /ssn/i field in serialized payloads
- Procore OAuth working code (routes/integrations.ts lines 609-868) is extracted into procoreAdapter.ts, not rewritten -- Phase 127 is formalization, not greenfield
- Sage 300 CRE has no public REST API -- all Sage phases are file-based only; Sage REST deferred to v10.0
- Vista AppXchange REST requires Trimble developer account -- Vista phases are file-based only in v9.0; REST gated behind feature flag
- PKCE code_verifier must be stored in DB (not in-memory session) to survive server restarts -- SEC-03 is Phase 127 responsibility
- Worker deduplication by erp_external_id + erp_source (unique constraint) -- never by name; name-based dedup breaks on shared names and name changes
- ERP pay rates are never used as baseRateSnapshot -- compliance requires Davis-Bacon rate from wage_determinations, not what the contractor paid
- vista_pending_actions table must exist from Phase 132 day one -- Vista API async 202 Accepted pattern means writes are never synchronously confirmed
- Sequential DB writes in syncOrchestrator.ts -- never Promise.all against SQLite; commit every 50-100 rows
- nightly ERP sync is cron job #6 in index.ts -- no new infrastructure (no BullMQ, no Redis, no external queue)
- Sage 300 file dedup by file hash stored in sync_file_log table -- stale file protection; parse by column header name not column index (resilient to schema changes)
- Path injection protection on Sage and Vista import/export directory paths -- allowlist validation + path.resolve() prefix check before any file operation
- Procore classification authority: Procore tradeClassification wins when pulling workers (classification_source = 'erp'); other ERPs only set classification for new workers, never overwrite existing local classification
- [Phase 126]: busy_timeout=5000 inserted at line 14 of db/index.ts after foreign_keys pragma; prevents SQLITE_BUSY on nightly ERP sync (INTG-03)
- [Phase 126]: integration_connections + integration_sync_runs added alongside procore_tokens in schema.ts (add-alongside pattern D-01); nullable credentials_encrypted and file_path_config per D-02

- [Phase 126-03]: req.user.userId (not req.userId) for ERP routes — requireAuth sets req.user per middleware/auth.ts pattern; consistent with all other routes
- [Phase 126-03]: dispatchNoop in syncOrchestrator.ts is module-private; Phase 127+ replaces dispatch call without changing orchestrator API
- [Phase 126-03]: cron job #6 registered at '0 2 * * *' UTC inside server.listen callback (6th total cron.schedule in index.ts)

- [Phase 126-02]: integrationVault.ts is a pure re-export of encryptSsn/decryptSsn — no new crypto logic, no node:crypto import (Pitfall 4 prevention)
- [Phase 126-02]: erpSerializer.ts uses explicit inclusion list — spread operator on worker rows forbidden per SEC-01; JSDoc comments must avoid forbidden-pattern text to pass source-reading tests
- [Phase 126-02]: OAuth nonces in integrations.ts: Math.random() replaced with randomBytes(16).toString('hex') at QBO line 36 + Procore line 526
- [Phase 126]: req.user.userId (not req.userId) for ERP routes — requireAuth sets req.user per middleware/auth.ts pattern; consistent with all other routes
- [Phase 126]: dispatchNoop in syncOrchestrator.ts is module-private; Phase 127+ replaces dispatch call without changing orchestrator API

- [Phase 126-04]: useToast() returns { toast: { success, error } } not { add } — FileErpCard uses toast.success/toast.error
- [Phase 126-04]: Badge lacks title prop — wrap in <span title={lastError}> for hover disclosure (no BadgeProps change)

### Phase Order Rationale

- Phase 126 first: DB schema, adapter interface, WAL mode, and credential vault are prerequisites for all other phases; IntegrationsPage connection UI required before any adapter UI can ship
- Phases 127-129 (Procore) second: working code already exists in routes/integrations.ts, reducing risk and delivering value fastest; bidirectional loop completed within three phases
- Phases 130-131 (Sage) third: file adapter is independently developable after Phase 126 with no Procore dependency; second-highest GC market penetration
- Phases 132-133 (Vista) fourth: no existing code, REST API requires third-party access to validate; file adapter pattern from Sage is reference; highest risk
- Phase 134 (Dashboard) last: requires sync history data from all three ERP tracks to show meaningful content; failure banner infrastructure wired incrementally as each sync job phase ships

### Critical Pitfalls (from v9.0 research)

- SQLITE_BUSY during nightly sync -- WAL mode + busy_timeout=5000 in Phase 126 is non-negotiable; BEGIN IMMEDIATE for all sync writes
- SSN in outbound ERP payloads -- explicit inclusion lists on all serializers; outbound request middleware regex-checks 9-digit patterns before dispatch
- Duplicate workers on re-sync -- erp_external_id + erp_source unique constraint with ON CONFLICT DO UPDATE; never name-based dedup
- Vista 202 Accepted treated as success -- vista_pending_actions table mandatory from Phase 132; polling required before reporting success
- Silent sync failures invisible to contractors -- Phase 134 failure banner is compliance-critical; consecutive_failure_count >= 2 triggers both banner and email
- OAuth token rot undetected -- store refresh_token_acquired_at; proactive re-auth warning after 25 days; 401 on refresh marks credential_expired

### Pending Todos

- Phase 24: 24-03-PLAN.md not yet executed (A-1-131 PDF generator + export route). Pre-existing v2.4 work. Closed by Phase 53 (CA-02 browser verification).
- Manual follow-up: create Better Stack account and replace STATUS_PAGE_URL placeholder in src/client/pages/LandingPage.tsx.
- Research flag (Phase 130): Validate exact Sage 300 CRE payroll import .txt field order against a live test import before Phase 130 ships.
- Research flag (Phase 132-133): Vista CSV export format documented but not locally verified; AppXchange REST endpoint schemas require Trimble developer account.
- Confirm: check whether PRAGMA journal_mode=WAL is already set in existing DB init before applying in Phase 126.
- Confirm: verify axios and csv-parse installation status in package.json before Phase 126 -- do not add duplicates.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-05-12T17:32:11.633Z
Stopped at: 126-04 Task 1 complete — FileErpCard shipped; awaiting checkpoint:human-verify for Task 2
Resume file: None
Next action: Execute 126-04-PLAN.md (IntegrationsPage Import Now button)
