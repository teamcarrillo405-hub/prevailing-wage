# Retrospective: HCC Prevailing Wage

---

## Milestone: v2.0 — Contractor UX Overhaul + Compliance

**Shipped:** 2026-03-20
**Phases:** 4 (6-9) | **Plans:** 16 | **Tests:** 181

### What Was Built

- January 2025 WH-347: multi-page support, Page X of Y, `certApprentices` derived from real data
- Compliance engine: `computeCompliance()` detects under-wage and CWHSSA OT violations from frozen rate snapshots
- Payroll Week Detail page: per-entry violation badges, one-click WH-347 download
- Dashboard compliance badges: green/red/gray per project card, per-card TanStack Query fetch
- UX completion: explicit nav links, WH-347 per payroll week row, missing-data warnings on worker cards
- Reports: fringe benefit summary and worker pay history — tabbed UI, frozen rates

### What Worked

- **Wave-based TDD**: Wave 0 stubs → Wave 1 implementation → Wave 2 checkpoint was extremely reliable. Test stubs caught integration issues before any UI work began.
- **Rate snapshot discipline**: Always reading `fringeRateSnapshot`/`baseRateSnapshot` from `payrollEntries` (never live WD) made compliance calculations simple and deterministic.
- **`computeCompliance()` pure function**: Accepting `(db, weekId)` and returning `ComplianceViolation[]` made the function trivially testable and reusable across the export route and compliance route.
- **Route ordering rule**: Registering static paths (`/project/:projectId`) before parameterized paths (`/:weekId`) as an explicit documented rule prevented a subtle routing bug.
- **Per-card fetch pattern**: Each `ProjectCard` owning its compliance fetch (with `staleTime: 60_000`) scaled better than a single dashboard-level fetch because it allows individual card updates without re-fetching all projects.

### What Was Inefficient

- **Stale server process**: The old server (started before Phase 9 files were created) was not killable via `taskkill /IM node.exe` — it survived across sessions on Windows. This caused phantom 404s that wasted diagnosis time. Should have used a process manager or been more careful about server restarts.
- **Migration journal not auto-updated**: Adding SQL-only migration files requires manually editing `meta/_journal.json`. Drizzle's `generate` workflow updates this automatically but Phase 6 used a manual SQL file. Should document this as a required step in migration workflow.
- **Test fixture schema mismatch** (Phase 8): `seedProjectWithViolation` used wrong API field names (`weekId` instead of `payrollWeekId`, `straightTimeHours` instead of daily `monSt`). Zod silently rejected invalid fields, no violations were created. Took additional time to debug. Should validate test fixtures against Zod schemas before running.
- **`computeCompliance()` called twice**: In `export.ts`, entries are fetched once for WH-347 data and again in `computeCompliance()`. Two DB reads for the same data. Acceptable for v2.0 but flagged as tech debt.

### Patterns Established

- `assertProjectOwner(projectId, userId, res)` — ownership helper reused across payroll and reports routes
- Wave 0 stubs use actual `expect()` assertions (not `.todo`) so they fail with clear error messages
- `VarianceReportPageRoute` pattern — thin wrapper that extracts URL params and passes as explicit props to reusable components
- `?? true` null-fallback on compliance boolean — no entries = no violations = compliant

### Key Lessons

1. **Kill processes between sessions on Windows**: A server started in session A survives to session B even after context reset. Always verify what's on the target port before debugging "missing routes."
2. **Migration journal is authoritative**: Drizzle silently ignores SQL migrations not in `meta/_journal.json`. Any hand-written migration file is invisible until registered.
3. **Test fixtures must match Zod schema exactly**: Zod `.strip()` silently drops unknown fields. If a fixture sends the wrong field name, the route succeeds with empty data — and your tests pass green even though nothing was inserted.
4. **`pdfDoc.copyPages()` snapshots current state**: Pages must be blank (no content drawn) at the time of copy. Drawing then copying captures the drawing — the opposite of what multi-page WH-347 needs.

### Cost Observations

- Sessions: 2 (v2.0 spanned 2 context windows)
- All work on master branch — no feature branching
- Single-day milestone execution (2026-03-19 → 2026-03-20)

---

## Milestone: v2.1 — Design Polish + Landing Page

**Shipped:** 2026-03-22
**Phases:** 5 (10-14) | **Plans:** 14 | **Tests:** 181 (no regressions)

### What Was Built

- **CSS token pipeline**: 14-token `@theme` in index.css — gold, dark, surface, status colors — propagating to all components via utility classes
- **Oswald/Inter typography**: Google Fonts via HTML preconnect, `@layer base` defaults, `font-headline` / `font-body` utilities
- **5 UI primitives**: Card, Button (primary/secondary/ghost), Badge (compliant/violation/warning/neutral), PageHeader, EmptyState — fully token-referenced
- **Dark nav shell**: Layout.tsx using `bg-nav-dark`/`border-brand-gold`/`hover:text-brand-gold` tokens applied globally to all 8 protected pages
- **Full marketing landing page**: 8 sections (nav, hero, problem, how-it-works, feature highlights, trust signals, CTA close, footer) — WH-347/Davis-Bacon/SAM.gov above fold
- **Auth-aware routing**: PublicRoute guard, WildcardRedirect, separate RegisterPage at /register, LoginPage simplified to login-only
- **Page-by-page polish**: All 7 app pages migrated to primitives — zero `bg-[#F5C518]` hardcoded hex remaining anywhere

### What Worked

- **Plan-checker blockers before execution**: Catching the `<Button as="span">` inside `<a>` (invalid HTML), the truth/implementation contradiction in 14-02, and the missing ProjectCard task before execution saved significant rework. Plan verification gates paid off.
- **Wave-1 parallelization on independent pages**: Plans 14-01 and 14-02 each modified different files — parallel execution cut wave time in half with zero merge conflicts.
- **Token-first approach**: Defining `@theme` tokens in Phase 10 before any component work meant Phase 11–14 never needed to invent colors — they just referenced existing tokens. Single-source propagation worked exactly as intended.
- **`<details>` milestone collapse**: Prior milestone details sections in ROADMAP.md maintained constant context cost — only the active milestone was in working context at any time.

### What Was Inefficient

- **Stale traceability in REQUIREMENTS.md**: LANDING-01 through LANDING-06 showed "Pending" even after Phase 13 shipped. The gsd-tools `milestone complete` doesn't auto-update traceability rows based on phase completion — this required a manual note during archival. A post-phase hook to update traceability would eliminate this.
- **`must_haves.truths` occasionally drifted from implementation**: Plan 14-02 had a truth saying "Button variant='secondary'" but the task used copied CSS classes directly. Plan-checker caught it, but the root issue is that truths were written before the interface investigation revealed the `asChild` gap. Truths should be written after reading the actual component interfaces.
- **Page-by-page plans required prior context to write**: The plan-checker needed all 3 Phase 14 plans re-read after previous context was lost. Next time, phase plans should be written and verified in the same session as execution if possible.

### Patterns Established

- `import { Badge } from '../ui/Badge'` — semantic status display, not inline `<span className="bg-red-100">` shortcuts
- `<a href={url} className={buttonSecondaryClasses}>` — correct pattern for link-buttons when Button has no `asChild` prop
- Plan `must_haves.truths` as grep-verifiable assertions — every truth should have a matching `pattern:` field for automated verification
- LoginPage as login-only with `<Link to="/register">` — embed-toggle pattern creates routing complexity and is the wrong abstraction

### Key Lessons

1. **Catch HTML validity in plan review**: `<button>` inside `<a>` is invalid HTML — the interactive content model rule. Any plan that nests a Button component inside an `<a>` needs `asChild` support or a different approach.
2. **Truths must match implementation**: If a plan truth says "uses Button primitive" but the task copies Button's CSS classes instead, the grep verification will fail. Write truths after deciding the implementation approach, not before.
3. **Token migration is the right foundation investment**: Phases 10–12 felt like infrastructure work with no user-visible output. But Phase 14 ran smoothly specifically because every primitive already referenced tokens — no color decisions needed at polish time.
4. **PublicRoute mirrors ProtectedRoute**: The symmetry (both read `useAuth()`, both redirect on mismatch) made the auth routing trivial to reason about and test.

### Cost Observations

- Sessions: 3 (Phase 13 + plan writing / Phase 14 execution / milestone completion)
- 53 commits across phases 10–14
- All work on master branch
- 2 days total (2026-03-20 planning → 2026-03-22 completion)

---

## Milestone: v2.2 — UX Completion + Compliance Hardening

**Shipped:** 2026-03-23
**Phases:** 2 (15-16) | **Plans:** 4 | **Tests:** 188

### What Was Built

- **Apprentice ratio enforcement** (COMP-03): `weekViolations[]` added alongside existing `violations[]` — per-week aggregate check fires only when `journeyworkerHours > 0`
- **WorkflowProgress indicator**: 4-step inline component on ProjectDetail driven by live TanStack Query data (create → workers → payroll → WH-347)
- **Print CSS for reports**: `thead { display: table-header-group }` + `overflow: visible !important` on `.overflow-x-auto` — browser print with repeating headers and totals row; `print-hidden` class on UI chrome
- **WH-347 preflight modal**: violation summary (both `violations[]` and `weekViolations[]`) before generating, Download Anyway / Cancel options
- **Fetch-driven WH-347 download**: `fetch()` → Blob → `URL.createObjectURL()` → click → `setTimeout(revokeObjectURL, 100)`; `generatingRef` useRef double-click guard

### What Worked

- **`useRef` for double-click guard**: `useState` is async/batched — second click fires before re-render. `useRef.current` is synchronous and immediate. Established the pattern for all future submit/action buttons.
- **`weekViolations[]` kept separate from `violations[]`**: Not modifying existing violation consumers avoided breaking all Phase 7+ tests with zero code changes.
- **Fetch-driven download vs plain anchor**: Preflight modal requires async work before the download fires — plain `<a href>` can't intercept. Switching to fetch pattern unlocked the entire preflight UX.

### What Was Inefficient

- **`hiddenAnchorRef` placement**: Initially placed inside modal JSX — modal unmounts when download starts, causing null ref. Moved outside modal to fix. Should have anticipated this upfront.
- **`overflow: visible !important`** required for print: This CSS quirk (scroll container overrides table header group display in print) isn't documented anywhere obvious. Took research to discover.

### Patterns Established

- `useRef` for synchronous action guards — not `useState`
- Blob URL revoke after `setTimeout(fn, 100)` — give browser time to initiate download before freeing the object URL
- `weekViolations[]` as separate array alongside `violations[]` — per-week aggregates must not mix with per-entry violations

### Key Lessons

1. **Ref inside modal = null when modal unmounts**: Any ref that needs to outlive a modal's lifecycle must live outside the modal's JSX subtree.
2. **Print CSS `overflow: visible !important` is required**: Browser treats `overflow-x: auto` as a scroll container in print, which overrides `thead { display: table-header-group }`. The important override is the only fix.
3. **New violation types need separate arrays**: Mixing per-entry and per-week violations in the same array would have required consumer updates across the entire codebase. Separate arrays = zero regressions.

### Cost Observations

- Sessions: 1
- 2 phases, 4 plans
- Single-day: 2026-03-22 → 2026-03-23

---

## Milestone: v2.3 — Contractor Workflow Efficiency + Audit Readiness

**Shipped:** 2026-03-24
**Phases:** 6 (17-22) | **Plans:** 10 | **Tests:** 1,522 (+1,334 since v2.2)

### What Was Built

- **DB migration**: 4 new nullable columns on `payroll_weeks` (submitted_at, submitted_to, amendment_number, original_week_id) via idx-5 migration with `-->statement-breakpoint` separators
- **Project archive/restore**: compliance pre-check advisory (non-blocking), Archived badge, Show Archived toggle on DashboardPage, `?status=all` query param
- **Dashboard search + filter**: real-time name search, funding type dropdown, URL-persisted `?q=` and `?funding=` params, zero-results empty state
- **WH-347 submission tracking**: PATCH/DELETE `/weeks/:id/submit`, server-side 409 lock in both entry write routes, `assertWeekNotSubmitted()` service, submitted badges on PayrollListPage, submit form on PayrollWeekDetailPage
- **Copy previous week**: `copyPayrollWeek()` re-fetches live rates, preview mode returns `{copied[], skipped[]}` without DB write, 3-step modal (choose/configure/preview-with-warnings)
- **Payroll amendment**: `amendPayrollWeek()` clones rate snapshots (not live re-fetch — 29 CFR Part 3), root-week sequential numbering, "N (AMENDED M)" WH-347 PDF label, amendment badge on list
- **Per-worker compliance history**: `getWorkerComplianceHistory()` cross-project aggregation by `(name, ssnLast4)`, null-SSN safety scope guard, `WorkerComplianceHistoryPage` with violation cards, Compliance History link per worker row

### What Worked

- **Copy vs Amendment as two separate functions**: Research confirmed they have fundamentally different rate semantics — copy must use live rates (federal compliance), amendment must clone snapshots (29 CFR Part 3 rates-fixed-at-submission). Two explicit service functions made the distinction permanent and testable.
- **Route ordering as documented pattern**: Registering specific routes before `/:id` wildcards had already bitten v2.0. Adding it to the CLAUDE.md critical rules meant no Phase 20/21/22 route bugs — zero wildcards were accidentally captured.
- **Preview-then-commit pattern**: The copy route's `preview: true` mode made the 3-step modal trivial to implement — API returns skip warnings without any DB write, then the same endpoint commits on confirmation. Clean separation.
- **ssnLast4 null safety guard**: Decided early to scope null-SSN workers to their source project only. This prevented a potential false cross-project merge for workers missing SSN data.
- **TDD RED-GREEN consistently applied**: Every Phase 20/21/22 API plan wrote failing stubs first. Caught integration issues (fixture shape, route registration order) before any UI work.

### What Was Inefficient

- **Dev server migration tracking failure at session start**: The dev SQLite DB had tables applied manually but no `__drizzle_migrations` tracking table, causing Drizzle to try re-running all migrations and crash with "table already exists." Needed a new `scripts/seed-migration-table.mjs` to fix. Root cause: DB was set up manually in an early session before GSD structure was in place. Should have run migrations via Drizzle from the start.
- **Missing SUMMARY.md files for 19-02 and 22-01**: Two plans executed in prior sessions didn't have their SUMMARY.md saved. Discovered during `complete-milestone` readiness check. Writing SUMMARY.md immediately after each plan execution (not deferred) would prevent this.
- **Context window exhaustion mid-milestone**: v2.3 spanned 2 context windows — phases 17-19 in session 1, phases 20-22 in session 2. Some planning artifacts (STATE.md, ROADMAP.md progress table) had stale data (showing 19-02 as incomplete) that needed fixing at milestone close.

### Patterns Established

- `copyPayrollWeek()` vs `amendPayrollWeek()` semantic distinction — live re-fetch vs snapshot clone
- Root-week resolution: `source.originalWeekId ?? source.id` — never chain amendment → amendment
- Cross-project worker identity: `(name, ssnLast4)` equality; `ssnLast4 === null` scopes to source project only
- Preview-then-commit API pattern: same endpoint, `preview=true` returns dry-run result without DB write
- `scripts/seed-migration-table.mjs` — fix for pre-GSD DBs missing `__drizzle_migrations` tracking

### Key Lessons

1. **Always run Drizzle migrations via the CLI — never apply SQL manually**: Manual table creation produces a DB with no migration tracking, guaranteed to fail on next Drizzle-managed run.
2. **Write SUMMARY.md immediately after each plan**: Deferred summaries are the most common documentation debt. Two missing summaries at milestone close required reconstruction from git log and commit messages.
3. **Copy ≠ Amendment at the rate level**: These are two distinct federal compliance concepts with different legal requirements. If the codebase treats them as variants of the same function, the next engineer will incorrectly re-use copy for amendment or vice versa. Two named functions with explicit doc comments is the correct boundary.
4. **ssnLast4 null means "no cross-project identity"**: An empty SSN last 4 field is not equivalent to SSN = "0000" or any fallback — it means identity cannot be asserted. Null check before cross-project merge is a compliance boundary, not a preference.

### Cost Observations

- Sessions: 2 (v2.3 spanned 2 context windows)
- 64 commits across phases 17-22
- 74 files changed, ~12,150 net lines
- Tests grew from 188 to 1,522 (1,334 new tests added)
- 2 days total (2026-03-23 → 2026-03-24)

---

## Milestone: v2.5 — State Portal Integration

**Shipped:** 2026-03-27
**Phases:** 2 (29-30) | **Plans:** 6 | **Files changed:** 32 | **LOC:** +6,035 / -790

### What Was Built

- **CA DIR eCPR XML Export**: 4 disaggregated fringe columns (H&W, Pension, Vacation, Training) in DB and entry UI; `generateEcprXml()` pure function producing CPR.xsd v1.3 compliant XML; 2-step pre-generation modal (collect FEIN/DIR Project ID/Awarding Agency/Contract Number → post-download 6-item portal checklist); amendment marker support
- **WA L&I PWIA XML Export**: `generateWaCprXml()` pure function (WaPWCPR root, Mon-first day ordering); export route with state gate + intentId validation + trade code enforcement; PWIA intentId modal with DB persistence and pre-fill; trade code gate screen listing affected workers with edit links
- **WAL-04 PWIA Submission Guide**: Per-classification Intent to Pay and Affidavit sections as live data-entry reference panel for the PWIA portal

### What Worked

- **Wave-0 TDD on XML generators**: Both phases started with Wave 0 RED stubs for the XML generator and export route before any implementation — generators came out clean with 100% test coverage on the first pass
- **xmlbuilder2 pure function pattern**: Encapsulating the XML generation in a pure `generateEcprXml(data)` / `generateWaCprXml(data)` function made both generators independently testable without any DB or Express setup
- **Persist-then-download PATCH flow**: PATCH `/api/projects/:id` before the GET download call meant field values are durable across sessions — re-opening the modal pre-fills from the DB without extra state management
- **Trade code gate as 422 response**: Returning the workers array in the 422 body (not a separate lookup) kept the gate screen fast with a single fetch — no secondary request to find missing trade codes

### What Was Inefficient

- **F700 handler still uses (row as any) cast**: The `getPayrollEntries()` + type cast pattern introduced in Phase 25 was not cleaned up in Phase 29 even though `getPayrollEntriesWithWorkerDetails()` types `waTradeCode` properly. Left as informational tech debt.
- **VALIDATION.md nyquist_compliant not updated**: Wave 0 tests went green for Phase 30 but the VALIDATION.md frontmatter was never updated to `nyquist_compliant: true` — a stale artifact that required flagging in the milestone audit.
- **Empty contractor address in eCPR XML**: No project address field exists in schema, so the CPR.xsd contractor address always emits empty strings. Portal accepts it, but adding a project-level address field would produce a more complete XML submission.

### Patterns Established

- `generateXxx(data: XxxData): string` — pure XML generator with typed input interface; no DB, no Express; tested independently before route integration
- `PATCH /api/projects/:id → GET /api/export/xxx/:weekId` — persist optional fields before download so modal pre-fills on re-open
- State gate `project.state?.toUpperCase() === 'XX'` — canonical pattern for all state-specific export routes (locked in Phase 47 as STATE-13)
- 422 with typed workers array for gate screens — single round-trip delivers both the error and the data needed to render the resolution UI

### Key Lessons

1. **Wave-0 stubs for pure functions pay off fast**: Writing the generator tests RED first constrained the interface before implementation. Both XML generators came out with clean typed interfaces that required no post-hoc refactoring.
2. **Persist before download**: Always PATCH the project record before triggering the export. This ensures that re-opening the modal on a future visit has the fields pre-filled — which was a user-requested behavior that was free with this pattern.
3. **Check VALIDATION.md at phase close**: After turning Wave 0 tests green, the workflow should include updating `nyquist_compliant: true` in VALIDATION.md frontmatter as a mandatory phase-close step.

### Cost Observations

- 1 day execution (2026-03-27)
- 22 tests added (13 ecprXmlGenerator + 9 waCprXmlGenerator)
- 2 phases, both verified at 100% (7/7 and 10/10 truths)

---

## Milestone: v3.0 — Team & Integration

**Shipped:** 2026-03-31
**Phases:** 6 (31-36) | **Plans:** 17 | **Commits:** 83

### What Was Built

- AES-256-GCM SSN encryption: versioned JSON envelope, full 9-digit SSN input, masked UI display, real SSN in CA eCPR + WA PWIA XML export
- Multi-user foundation: `project_members` table, `assertProjectAccess()` replacing 21 inline IDOR checks, cross-tenant regression suite
- Team invite flow: email invite via Resend SDK (console fallback), tokenized `/accept-invite`, TeamPage, ownership transfer, soft-delete removal
- Agency submission status tracking: per-agency timestamps, "Mark as Submitted" buttons in CA/WA export modals, independent badge rows
- Payroll import server pipeline: QB "Time by Employee Detail" + ADP Run CSV parsing, provider auto-detection, conflict detection, preview/commit routes, `payroll_imports` audit table
- Payroll import React UI: 3-step modal — file picker (Step 1), preview/resolve table with remap dropdowns (Step 2), confirm/commit with success banner (Step 3)

### What Worked

- **Research-before-roadmap discipline**: Running 4 parallel research agents before defining requirements confirmed no public CA DIR or WA L&I API exists. This prevented building an auto-submit feature against a non-existent API.
- **assertProjectAccess centralization**: Replacing 21 scattered IDOR guards with a single utility + cross-tenant test suite was worth the Phase 32 investment. Every subsequent phase (33-36) got IDOR safety for free.
- **CONTEXT.md per phase**: Having a dedicated CONTEXT.md with decisions (D-01 through D-15+) for each phase prevented rework when options were revisited. The D-10 escape-hatch decision in Phase 36 avoided scope creep.
- **Two-route strategy for file upload**: Documenting `raw fetch() for FormData / api.post for JSON` in SUMMARY.md prevented the same trap in future phases — FormData + Content-Type collision is a silent failure that's easy to re-introduce.
- **Plan wave sequencing within Phase 36**: 3 plans in tight dependency order (state foundation → UI skeleton → commit flow) meant each plan's executor had all state variables and functions it needed without guessing.

### What Was Inefficient

- **Stale worktrees polluting test runs**: `.claude/worktrees/agent-*/tests/` directories accumulated from parallel executor agents and were included by vitest's default glob. Running `npm test` without `--exclude ".claude/**"` gave misleading failure counts. Should add worktree exclusion to `vitest.config.ts` for next milestone.
- **PI-03 requirement drift**: The requirement said "confirm creation of a new worker record" but the design decision (D-10) scoped that out early. The mismatch wasn't caught until verification. Better to update requirements immediately when a scoping decision is made, not wait for the verifier to flag it.

### Patterns Established

- **`IIFE (() => {...})()` in JSX**: Compute derived display values inside JSX without polluting component scope or adding `useMemo`. Established in Phase 36, applicable wherever you have 3+ local variables from the same computation.
- **Two-mutation pattern for preview/commit**: Preview uses `raw fetch()` with `FormData`, commit uses `api.post()` with JSON. Pattern is documented and should be referenced when building other multi-step file-import flows.
- **`assertProjectAccess()` before any route handler**: Centralized IDOR check on every resource route. Phase 32+ route files all use this pattern — new phases must follow it.

### Key Lessons

1. **Update requirements when scoping decisions are made, not at verification time**: PI-03 drift cost one verification cycle and a conversation with the user. The fix was easy (Option A), but the pattern of "requirement text diverges from CONTEXT.md decision" is worth preventing upstream.
2. **Exclude `.claude/worktrees/` from vitest**: Worktree test files accumulate silently and produce hundreds of false failures. One vitest config change would have saved confusion across multiple milestone phases.
3. **Versioned encryption envelopes are non-negotiable for new encrypted fields**: The AES-256-GCM envelope (version + iv + tag + ciphertext) costs 30 extra characters per record and saves a complete DB migration if the key ever needs rotation. Always use envelopes.

### Cost Observations

- Sessions: 4 (Phases 31-33, 34, 35, 36)
- 83 commits across phases 31-36
- 32 src files changed, ~2,818 net lines added
- 4 days (2026-03-28 → 2026-03-31)

---

## Cross-Milestone Trends

| Metric | v1.0 | v2.0 | v2.1 | v2.2 | v2.3 | v3.0 |
|--------|------|------|------|------|------|------|
| Phases | 5 | 4 | 5 | 2 | 6 | 6 |
| Plans | — | 16 | 14 | 4 | 10 | 17 |
| Tests | — | 181 | 181 | 188 | 1,522 | 387+ |
| Files changed (src/) | — | 70 | ~45 | ~15 | 74 | 32 |
| LOC (src/) | — | ~10,774 | ~10,375 | ~10,800 | ~12,150 net | ~2,818 net |
| Days | — | 1 | 2 | 1 | 2 | 4 |
| Regressions | — | 0 | 0 | 0 | 0 | 0 |
