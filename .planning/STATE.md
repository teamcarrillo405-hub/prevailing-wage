---
gsd_state_version: 1.0
milestone: v2.3
milestone_name: Contractor Workflow Efficiency + Audit Readiness
status: Milestone complete
stopped_at: Completed 22-02-PLAN.md
last_updated: "2026-03-24T17:39:42.181Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 11
  completed_plans: 9
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — with compliance feedback, no missing steps.
**Current focus:** Phase 22 — per-worker-compliance-history

## Current Position

Phase: 22
Plan: Not started

### Phase Structure

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 15 | Compliance Engine Hardening + Independent Frontend | COMP-03, UX-04, RPT-01, RPT-02 | ✅ Complete |
| 16 | WH-347 Submission UX | WH-01, WH-02 | ✅ Complete |
| 17 | DB Migration + Project Archive | PRJ-01, PRJ-02, PRJ-03 | ✅ Complete |
| 18 | Dashboard Search + Filter | DASH-03, DASH-04 | ✅ Complete |
| 19 | WH-347 Submission Tracking | SUB-01, SUB-02, SUB-03 | ✅ Complete |
| 20 | Copy Previous Payroll Week | PAY-01, PAY-02 | Not started |
| 21 | Payroll Amendment Workflow | AMD-01, AMD-02, AMD-03 | Not started |
| 22 | Per-Worker Compliance History | AUD-01, AUD-02 | Not started |

## Performance Metrics

**Velocity (v2.2):**

- Total plans completed: 4
- Total phases: 2
- Shipped: 2026-03-23

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 15 | 3/3 | ✅ Complete |
| 16 | 1/1 | ✅ Complete |
| 17 | 2/2 | ✅ Complete |
| 18 | 1/1 | ✅ Complete |
| Phase 20 P01 | 4 | 1 tasks | 3 files |
| Phase 20 P02 | 15 | 2 tasks | 1 files |
| Phase 21 P01 | 5min | 2 tasks | 4 files |
| Phase 21-payroll-amendment-workflow P02 | 5min | 2 tasks | 2 files |
| Phase 21 P02 | 15min | 3 tasks | 2 files |
| Phase 22 P01 | 4min | 1 tasks | 3 files |
| Phase 22 P02 | 30min | 2 tasks | 3 files |

## Accumulated Context

| Phase 10-css-design-token-foundation P01 | 10 | 2 tasks | 2 files |
| Phase 10-css-design-token-foundation P03 | 5min | 2 tasks | 9 files |
| Phase 10-css-design-token-foundation P02 | 20min | 3 tasks | 5 files |
| Phase 11 P01 | 5min | 3 tasks | 4 files |
| Phase 11-ui-primitives P02 | 3min | 2 tasks | 2 files |
| Phase 12-app-shell-global-layout P01 | 2min | 1 tasks | 1 files |
| Phase 12-app-shell-global-layout P02 | 5min | 2 tasks | 2 files |
| Phase 12-app-shell-global-layout P03 | 10min | 3 tasks | 5 files |
| Phase 13-landing-page-routing P01 | 3min | 2 tasks | 6 files |
| Phase 13-landing-page-routing P02 | 2min | 1 tasks | 1 files |
| Phase 13-landing-page-routing P03 | 2min | 2 tasks | 1 files |
| Phase 14 P01 | 5min | 3 tasks | 3 files |
| Phase 14 P02 | 4min | 3 tasks | 3 files |
| Phase 14-page-by-page-polish P03 | 15 | 3 tasks | 2 files |
| Phase 15-compliance-engine-hardening-independent-frontend P02 | 5 | 1 tasks | 1 files |
| Phase 15 P01 | 7min | 2 tasks | 3 files |
| Phase 15-compliance-engine-hardening-independent-frontend P03 | 3 | 2 tasks | 1 files |
| Phase 16-wh-347-submission-ux P01 | 2min | 2 tasks | 1 files |

### Decisions

- v1.0: Server on port 4099 (moved from 3001 due to port conflicts)
- v1.0: tsx does NOT watch for file changes — server must be manually restarted after edits
- v1.0: Workers table has `address` column added via ALTER TABLE (already in schema.ts)
- v1.0: getCachedWd has statewide (county IS NULL) fallback for resilience
- v1.0: Known pre-existing TS errors in workers.ts (108, 115) — implicit any — non-fatal
- v2.0: Compliance engine must be built before WH-347 UI button is exposed — compliance booleans on Statement of Compliance must be driven by real engine output
- v2.0: Violations computed on-demand from stored snapshots — never compared to live WD rates
- v2.0: Phase 6 BEFORE Phase 7 — J/RA field is a hard dependency for 2025 form AND apprentice ratio check
- [Phase 06]: Stubs must use actual assertions (not .todo) so they run and fail on missing fields
- [Phase 06]: certApprentices contract test is green by design — documents API accepts false, not a failing stub
- [Phase 06]: Migration journal must be updated manually when adding SQL-only migrations outside Drizzle generate workflow
- [Phase 06]: programName is optional on all laborTypes in route — server does not restrict it to apprentices
- [Phase 06]: Copy additional template pages before filling any content in fillWh347() — pdf-lib copyPages() snapshots current state so pages must be blank when copied
- [Phase 06]: addPage() used (not insertPage()) in multi-page WH-347 — appending worker/statement pairs gives correct DOL page ordering automatically
- [Phase 06]: deriveAllApprenticesRegistered() exported from export.ts for testability without route mocking
- [Phase 06]: programName only included in POST payload when non-empty; server accepts null per Plan 02
- [Phase 07]: Test stubs import from complianceService.ts (not yet created) — import error is the intentional TDD RED state
- [Phase 07]: CWHSSA fringe NOT multiplied for OT: expected = totalHours*base + otHours*0.5*base + totalHours*fringe
- [Phase 07]: cwhssa-ot fires when totalOt > 0 AND |delta| > 0.01 (before under-wage check); under-wage fires only for straight-time underpayment
- [Phase 07]: POST /api/payroll/entries added as convenience endpoint mirroring PUT — required by compliance test seeders
- [Phase 07]: WH-347 download is a plain <a href> anchor — browser handles Content-Disposition attachment natively
- [Phase 07]: computeCompliance() called independently in export.ts route — entries fetched twice is acceptable for Phase 7; performance optimization deferred to v2.1
- [Phase 07]: certProperPayment/certAccuratePayroll use ?? true fallback when computeCompliance returns null — no entries means no violations detected = compliant
- [Phase 07]: Browser verification (Task 3) approved — all 6 end-to-end tests confirmed passing in browser
- [Phase 08-dashboard-ux-polish]: seedProjectFixture is a separate helper (not a modification of seedFixture) to preserve existing test isolation
- [Phase 08-dashboard-ux-polish]: Wave-0 assertion style: actual expect() calls so stubs fail with clear assertion error (not .todo)
- [Phase 08-dashboard-ux-polish]: Route /project/:projectId registered before /:weekId to prevent wildcard capture
- [Phase 08-dashboard-ux-polish]: seedProjectWithViolation fixture corrected to use payrollWeekId, classificationId, and daily hour fields
- [Phase 08-dashboard-ux-polish]: VarianceReportPageRoute is a thin wrapper — preserves VarianceReportPage as reusable component with explicit Props
- [Phase 08-dashboard-ux-polish]: Reports nav link is a span (not Link) with cursor-not-allowed to signal Phase 9 pending without a broken route
- [Phase 08-dashboard-ux-polish]: Compliance query lives inside ProjectCard (not DashboardPage) — each card owns its own fetch, staleTime:60_000 prevents N re-fetches on navigate-back
- [Phase 08-dashboard-ux-polish]: Browser verification (Task 2) approved — all 5 Phase 8 requirements (DASH-01, DASH-02, UX-01, UX-02, UX-03) confirmed passing end-to-end
- [Phase 09-reports]: Fringe-summary 404 test asserts res.body.error is string — prevents accidental pass from Express default 404 HTML
- [Phase 09-reports]: getWorkerPayHistory uses ASC SQL order then Array.reverse() to produce DESC output
- [Phase 09-reports]: Reports router left unregistered in index.ts — Plan 04 wires it to turn tests fully GREEN
- [Phase 09-reports]: ReportsPage omits PDF export — on-screen only per ROADMAP success criteria for v2.0
- [Phase 09-reports]: Fringe summary column shows total credits only (not effective rate) — simpler is better per plan spec
- [Phase 09-reports]: Reports route placed adjacent to VarianceReportPageRoute in App.tsx for consistency
- [Phase 09-reports]: Reports nav Link uses identical className pattern as all other nav links in ProjectDetailPage
- [Phase 10-css-design-token-foundation]: Google Fonts loaded via HTML link tag in index.html (not CSS @import) to prevent FOUT and ensure fonts load before JS executes
- [Phase 10-css-design-token-foundation]: Only font weights 400-700 loaded for Oswald and Inter — full weight range adds 600-900ms TTFB
- [Phase 10-css-design-token-foundation]: @layer base sets body (Inter) and h1-h4 (Oswald) font-family globally — no per-component font class required
- [Phase Phase 10-css-design-token-foundation]: focus:outline-hidden is the correct TailwindCSS v4 rename — preserves accessibility tree in forced-color mode
- [Phase Phase 10-css-design-token-foundation]: WorkersPage programName inputs use focus:border-brand-gold (not ring) as sole focus indicator — no ring companion needed for optional plain-text inputs
- [Phase Phase 10-css-design-token-foundation]: bg-brand-gold works correctly on tr elements in browser — no CSS variable fallback needed for WageClassificationsTable
- [Phase Phase 10-css-design-token-foundation]: font-headline applied explicitly even on h1-h4 heading elements covered by @layer base — preserves explicit token usage intent
- [Phase Phase 10-css-design-token-foundation]: ReportsPage focus:outline-none migration bundled with Plan 02 (not Plan 03) to avoid concurrent file write conflicts
- [Phase 11]: neutral Badge uses bg-gray-100/text-gray-600/border-gray-300 — no custom token (--color-status-neutral does not exist in @theme)
- [Phase 11]: Button uses hover:bg-brand-gold/90 (TailwindCSS v4 opacity modifier) not hover:bg-yellow-400
- [Phase 11-02]: PageHeader uses mb-6 (not mb-8) — spec value, not the existing DashboardPage inline pattern
- [Phase 11-02]: EmptyState prop named 'message' (not 'body') — matches planning context interface spec
- [Phase 11-02]: Action slot conditionally rendered — undefined action produces no empty right-side div
- [Phase 12-01]: [Phase 12-01]: bg-gray-900 (#111827) replaced with bg-nav-dark (#1a1a1a) — nav-dark is brand-correct per HCC spec
- [Phase 12-app-shell-global-layout]: ProjectDetailPage subtitle: state — county location string passed as subtitle prop to PageHeader (not left as separate p element)
- [Phase 12-app-shell-global-layout]: DashboardPage New Project button migrated to Button primitive inside PageHeader action slot — removes last hardcoded #F5C518
- [Phase 12-app-shell-global-layout]: PageHeader mb-6 is the correct spec value; replaces old inline mb-8 in DashboardPage
- [Phase 12-app-shell-global-layout]: Card padding=none for table wrappers; padding=sm for compact item cards; ProjectCard button not wrapped in Card (Phase 14 scope)
- [Phase 13-landing-page-routing]: PublicRoute returns null (not LoadingSpinner) during isLoading — spinner adds visual noise on fast auth checks
- [Phase 13-landing-page-routing]: WildcardRedirect defined inline in App.tsx module — single-use component does not warrant its own file
- [Phase 13-02]: HowItWorksSection uses plain div (not Card) for steps on dark background — Card is white/surface-card which clashes with bg-nav-dark
- [Phase 13-02]: hero h1 packs all three required terms (WH-347, Davis-Bacon, SAM.gov) into a two-line headline above the fold
- [Phase 14]: LoginPage is now login-only — RegisterForm removed, Link to /register replaces mode toggle
- [Phase 14]: Badge variant mapping in ProjectCard: violations->violation, clean->compliant, no payroll->neutral
- [Phase 14-page-by-page-polish]: WorkersPage back button kept as standalone raw button above PageHeader — preserves navigation clarity without nesting inside header
- [Phase 14-page-by-page-polish]: ProjectDetailPage nav links use secondary button className directly on Link (not Button wrapping) — avoids asChild dependency since Button renders button and Link renders a
- [Phase 14-page-by-page-polish]: WH-347 download uses secondary button classes directly on <a> tag — Button renders <button> making nesting invalid HTML
- [Phase 14-page-by-page-polish]: Print CSS added via inline style block before Layout — avoids touching Layout.tsx
- [Phase 15-compliance-engine-hardening-independent-frontend]: WorkflowProgress defined inline in ProjectDetailPage (not a separate file) — single-use component
- [Phase 15-compliance-engine-hardening-independent-frontend]: isFinal used as WH-347 download proxy for step 4 — Phase 16 may add proper download tracking
- [Phase 15]: apprenticePercent required by workers API schema when laborType=apprentice — seedApprenticeWorker must include it
- [Phase 15]: weekViolations rendered inside same violations ul — consistent visual treatment with entry-level violations
- [Phase 15]: apprenticeHours > maxAllowed uses strict greater-than — exactly at 1:3 ratio is compliant
- [Phase 15-compliance-engine-hardening-independent-frontend]: print-hidden CSS class used (not Tailwind print:hidden variant) — consistent with inline style approach in ReportsPage
- [Phase 15-compliance-engine-hardening-independent-frontend]: tfoot totals row uses reduce() inline — no derived state needed for accumulation in JSX
- [Phase 16]: generatingRef (useRef) used as synchronous double-click guard — useState is async/batched and cannot prevent rapid duplicate download requests
- [Phase 16]: hiddenAnchorRef placed outside modal JSX so anchor persists when modal unmounts during download initiation
- [Phase 16]: Blob URL revoked after 100ms setTimeout to give browser time to initiate download before freeing object URL
- [Phase 16]: generatingRef (useRef) used as synchronous double-click guard — useState cannot prevent rapid duplicate download requests
- [Phase 16]: hiddenAnchorRef placed outside modal JSX so anchor persists when modal unmounts during download initiation
- [Phase 16]: Blob URL revoked after 100ms setTimeout to give browser time to initiate download before freeing object URL
- [Phase 17-01]: Multi-statement SQL migrations require --> statement-breakpoint between each ALTER TABLE (Drizzle breakpoints:true mode)
- [Phase 17-01]: originalWeekId has no .references() in schema.ts — self-referencing FK is SQL-only to avoid AnySQLiteColumn import complexity
- [Phase 17-01]: GET /api/projects defaults to active-only; ?status=all returns both active and closed projects
- [Phase 17-02]: Compliance check uses queryClient.fetchQuery (imperative) — fires only on Archive button click, not on page load
- [Phase 17-02]: Archive advisory is non-blocking — "Archive Anyway" CTA always present when violations exist (PRJ-03 requirement)
- [Phase 17-02]: TanStack Query key includes filter state ['projects', 'all'|'active'] — separate cache buckets prevent stale data when toggling
- [Phase 18-01]: inputValue useState initialized from searchParams.get('q') — avoids useSearchParams keystroke lag while keeping URL in sync on every change
- [Phase 18-01]: Functional setSearchParams(prev => next) used exclusively — direct object form wipes co-existing params (showArchived, funding, etc.)
- [Phase 18-01]: filteredProjects derived via useMemo client-side — no server changes needed, filtering against already-fetched array
- [Phase 18-01]: FUNDING_OPTIONS/FUNDING_LABELS defined as module-level constants — funding type is a closed set, no API call needed
- [Phase 19-01]: assertWeekNotSubmitted returns { locked, submittedAt } (not throw) — routes own HTTP response, service stays pure
- [Phase 19-01]: clearWeekSubmission uses unconditional UPDATE (idempotent) — no pre-check avoids TOCTOU race
- [Phase 19-01]: Lock guard placed after assertProjectOwner, before upsertPayrollEntry in both POST /entries and PUT /entries/:id
- [Phase 20]: Use getCachedWd ?? lookupWageDetermination for cache-first WD lookup in copyPayrollWeek (matching workers.ts pattern)
- [Phase 20]: POST /weeks/copy placed before GET /weeks/:id to prevent wildcard route capture
- [Phase 20]: weeks[0] used as default source (DESC sort already applied); weekEndingDate pre-populated as source+7 days; copyingRef useRef for synchronous double-click guard on Preview+Confirm; direct navigate (no modal) when weeks.length === 0
- [Phase 21-01]: amendPayrollWeek() is dedicated (not copyPayrollWeek()) — copy re-fetches live rates, amendment clones snapshots per 29 CFR Part 3
- [Phase 21-01]: rootWeekId = originalWeek.originalWeekId ?? originalWeek.id — chains always resolve to root week for sequential numbering
- [Phase 21-02]: Amend This Week shown for any submitted week — service resolves root week, no UI distinction needed
- [Phase 21-02]: Amend This Week shown for any submitted week — service resolves root week, no UI distinction needed
- [Phase 22]: ssnLast4=null workers scoped to source project only — null identity cannot safely merge across projects
- [Phase 22]: WorkerHistoryResult discriminated union return type (not throw) — route owns HTTP status, service stays pure
- [Phase 22]: Route /worker/:workerId/history registered before /:weekId wildcard — consistent with /project/:projectId pattern
- [Phase 22]: Client-side WorkerComplianceHistory interface mirrors server type — no cross-boundary import from src/server
- [Phase 22]: Compliance History link uses React Router Link with direct className (same as Edit button) — not Button component which renders <button>
- [Phase 22]: Badge variant: warning for apprentice-ratio, violation for under-wage and cwhssa-ot — matches severity hierarchy

### Research Flags for v2.3

- Phase 20: Review wageLookup.ts before building the copy route — confirm per-classification lookup supports graceful per-entry failure (omit vs. default to zero). Highest-risk implementation decision in v2.3.
- Phase 21: Verify wh347Data.payrollNumber type in wh347Generator.ts accepts string values before writing any route code. Confirm export.ts string assembly approach for "N (AMENDED M)" label does not require fillWh347() coordinate changes.
- Phase 22: Review complianceService.computeCompliance() input contract before designing the batch query. Write a 20-week test fixture before any implementation to catch N+1 regressions.

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-24T17:35:16.038Z
Stopped at: Completed 22-02-PLAN.md
Resume file: None
