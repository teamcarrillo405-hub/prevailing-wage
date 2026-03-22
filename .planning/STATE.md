---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Design Polish + Landing Page
status: completed
stopped_at: Completed 14-03-PLAN.md
last_updated: "2026-03-22T19:11:15.974Z"
last_activity: 2026-03-22
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 14
  completed_plans: 14
  percent: 80
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** GC can run a full project end-to-end — create -> workers -> payroll -> WH-347 -> submit — no missing steps.
**Current focus:** v2.1 — Design Polish + Landing Page — Phase 10 next

## Current Position

Milestone: v2.1 — Design Polish + Landing Page
Phase: 14
Status: Phase 13 complete — begin with `/gsd:plan-phase 14`
Last activity: 2026-03-22

Progress: [████████░░] 80% (4 of 5 v2.1 phases complete)

### Phase Structure

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 10 | CSS Design Token Foundation | DESIGN-01, 02, 03, 04 | Complete |
| 11 | UI Primitives | UI-01, 02, 03, 04, 05 | Complete |
| 12 | App Shell + Global Layout | SHELL-01, 02, 03 | Complete |
| 13 | Landing Page + Routing | LANDING-01, 02, 03, 04, 05, 06, 07 | Complete |
| 14 | Page-by-Page Polish | PAGE-01, 02, 03, 04, 05, 06, 07 | Not started |

## Performance Metrics

**Velocity (v2.1):**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

### Research Flags for v2.1

- Phase 10: `--color-*: initial` in @theme silently wipes all default Tailwind colors — never use initial namespace wipe; add tokens only
- Phase 10: @theme must NOT be split into imported CSS files — all @theme content stays in index.css
- Phase 10: 7 hardcoded inline brand values confirmed in: ManualWageEntryForm, WageClassificationsTable, AdminStateWagePage, WageLookupPage, ReportsPage — must be cleared in Phase 10
- Phase 10: 5 confirmed `focus:outline-none` instances in form inputs — first task of Phase 10
- Phase 11: WageClassificationsTable uses `style={{ backgroundColor: '#F5C518' }}` on a `<tr>` element — verify className="bg-brand-gold" on tr before applying broadly
- Phase 13: /register must be added as an explicit public route before landing page CTA is wired — otherwise CTA dead-ends at login for new users
- Phase 13: Auth-aware wildcard may require extracting ProtectedRoute auth-check logic into a shared useAuth hook — evaluate scope during Phase 13 planning
- Phase 14: Apply Inter globally as the FIRST action and immediately verify PayrollEntryPage (7-day grid) and WageClassificationsTable at 1280px — font change can cause table column overflow
- Phase 14: Run existing 181-test suite after each page polish pass to confirm no regressions

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-22T19:06:17.019Z
Stopped at: Completed 14-03-PLAN.md
Resume file: None
