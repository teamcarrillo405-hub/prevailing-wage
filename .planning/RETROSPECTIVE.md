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

## Cross-Milestone Trends

| Metric | v1.0 | v2.0 | v2.1 |
|--------|------|------|------|
| Phases | 5 | 4 | 5 |
| Plans | — | 16 | 14 |
| Tests | — | 181 | 181 |
| Files changed | — | 70 | ~45 |
| LOC (src/) | — | ~10,774 | ~10,375 |
| Days | — | 1 | 2 |
| Regressions | — | 0 | 0 |
