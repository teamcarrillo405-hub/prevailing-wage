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

## Cross-Milestone Trends

| Metric | v1.0 | v2.0 |
|--------|------|------|
| Phases | 5 | 4 |
| Plans | — | 16 |
| Tests | — | 181 |
| Files changed | — | 70 |
| LOC (net) | — | +10,774 |
| Days | — | 1 |
| Regressions | — | 0 |
