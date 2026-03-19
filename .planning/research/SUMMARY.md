# Project Research Summary

**Project:** HCC Prevailing Wage App — Milestone v2.0 (Contractor UX Overhaul + Compliance)
**Domain:** Davis-Bacon prevailing wage compliance — certified payroll generation and violation detection
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

The HCC Prevailing Wage app is a mature, working system with a well-established architecture: React 19 + Vite on the client, Express + SQLite + Drizzle ORM on the server, pdf-lib for WH-347 generation, and TanStack Query for server state. Milestone v2.0 is not a greenfield build — it is a compliance-completeness layer added on top of an already functional payroll entry and PDF system. The research confirms that all three compliance checks (under-wage, CWHSSA OT, apprentice ratio) can be computed from data the system already stores, that no new PDF library is needed, and that only three lightweight libraries need to be installed (`clsx`, `tailwind-merge`, `date-fns`). The build surface is well-bounded.

The regulatory foundation is concrete. The WH-347 was revised in January 2025, consolidating the Statement of Compliance (formerly WH-348) onto the back of page 1. This is a correctness issue, not a feature addition — the current overlay targets the outdated pre-2025 form. Additionally, the 2025 form added a mandatory Journeyworker/Registered Apprentice classification checkbox per worker row, which is currently missing from the schema. These two items — WH-347 form update and J/RA classification field — are blockers for legal compliance and must come first. Every other v2.0 feature depends on or builds on these.

The dominant risk in this milestone is compliance logic precision. Pitfall research identified ten specific failure modes, all of which "look done but aren't" — apprentice ratio checked at the week level instead of daily, Statement of Compliance checkboxes auto-checked true, OT fringe applied at 1.5x instead of 1.0x, multi-classification workers missing OT aggregation across classifications. These are regulatory precision errors, not bugs the app will catch itself. The mitigation is well-defined: reuse existing pure functions in `calculations.ts` (especially `calculateCwhssaOt()` and `checkApprenticeRatio()`), compute violations on-demand from stored snapshots rather than live WD data, and build the compliance engine before the UI so the UI is never wired to hardcoded compliance booleans.

## Key Findings

### Recommended Stack

The existing stack handles all v2.0 requirements without new frameworks. Three utility libraries are the only additions: `clsx@^2.1.1` for conditional className composition (compliance badge variants), `tailwind-merge@^3.5.0` (required for Tailwind v4 class override correctness — note: must be v3.x, not v2.x), and `date-fns@^4.1.0` for week boundary calculations if workweek logic requires date arithmetic beyond what the schema's stored week keys provide.

All PDF generation continues via pdf-lib, following the established pattern in `variancePdf.ts` (`PDFDocument.create()`, `doc.addPage()`, `StandardFonts.Helvetica`). Brand constants should be extracted from `variancePdf.ts` into a shared `pdfBranding.ts` file to avoid duplication across new report types. No second PDF library, no UI component framework, no React Table.

**Core technologies:**
- `clsx@^2.1.1`: Badge variant composition — 239B, no dependencies, replaces ad-hoc inline class logic in ProjectCard
- `tailwind-merge@^3.5.0`: Tailwind v4-compatible class deduplication — required for reusable Badge component with className override support
- `date-fns@^4.1.0`: ESM-first week boundary math — needed only if workweek boundary calculation is not already handled by schema keys; add-only dependency

### Expected Features

The January 2025 WH-347 revision changes the v2.0 scope in two important ways: the Statement of Compliance is no longer a separate document (WH-348 is eliminated), and J/RA classification is now a mandatory per-worker checkbox on the form. The v2.0 MVP is the minimum set for a contractor to submit a legally compliant 2025 WH-347 package with no open regulatory gaps.

**Must have (v2.0 launch — table stakes):**
- J/RA classification field on worker — blocks two other features; build first
- WH-347 PDF updated to January 2025 form — current overlay is on the obsolete form; Statement of Compliance now consolidated
- WH-347 accessible from payroll week view — one UI route addition; removes workflow dead end
- Under-wage compliance flag — most common DOL violation; highest audit-risk catch
- CWHSSA OT error flag — $10/day/violation liquidated damages exposure
- Missing SSN/address flag — WH-347 submission is legally invalid without these fields
- Apprentice ratio compliance check — excess apprentices must be paid journeyworker rate
- Dashboard with project compliance status — surface open flags across all projects
- Fringe benefit summary report — per worker per week; DOL auditors request this on every investigation
- Worker pay history report — cross-week view; standard 3-year retention audit document

**Should have (v2.x — after validation):**
- No-work-week certification — add when contractors report audit findings about missing no-work submissions
- Payroll week completeness indicator — add when usage shows missing-worker submission problems
- Wage determination expiration alert — add when rate staleness is reported
- Submission checklist per payroll week — add when post-launch workflow confusion is observed

**Defer (v3+):**
- State-specific forms (CA DIR, WA L&I) — significant scope; own milestone
- Multi-user / subcontractor management — enterprise-tier feature
- Classification mismatch warning — requires capturing actual job duties; scope risk
- Payroll integration (QuickBooks/ADP) — anti-feature; intentionally manual for compliance audit trail

### Architecture Approach

The v2.0 additions follow a strict additive pattern: no existing tables modified, no existing routes changed in behavior, no existing services altered. The compliance engine lives in `src/server/services/complianceEngine.ts` as a pure service that takes `(db, projectId)` parameters and returns typed `ComplianceResult` objects — matching the established `varianceService.ts` pattern exactly. Violations are computed on-demand from stored snapshots, never cached in a new database table, so compliance results are always current with the latest payroll corrections.

**Major components:**
1. `complianceEngine.ts` — four independent check functions (`checkUnderWage`, `checkOtViolations`, `checkApprenticeRatioViolations`, `checkMissingData`) plus `runProjectCompliance()` and `runWeekCompliance()` aggregators; pure-ish service, no Express coupling
2. `compliance.ts` route + `reports.ts` route — HTTP layer for compliance queries and report data; registered in `index.ts` alongside existing routers
3. `PayrollWeekPage.tsx` — new page at `/projects/:projectId/payroll/:weekId`; week detail + compliance violations + WH-347/Statement buttons; the central contractor action point
4. `ComplianceBadge.tsx` + `ViolationsList.tsx` — shared compliance UI components; consumed by dashboard cards and payroll week view
5. `statementPdf.ts` + updated `wh347Generator.ts` — pdf-lib services for both PDF types; Statement route added to existing `export.ts`
6. `WorkerPayHistoryPage.tsx` + `FringeSummaryPage.tsx` — report pages backed by `workerHistoryService.ts` and `fringeService.ts`

### Critical Pitfalls

1. **Apprentice ratio checked weekly instead of daily** — the DOL applies the ratio daily per trade, not weekly. The compliance engine must reconstruct per-day presence from daily hour columns (`monSt + monOt > 0` = present) and run `checkApprenticeRatio()` once per trade per day. Weekly aggregation produces false negatives every time journeyworker headcount fluctuates within a week. Recovery cost if retrofitted: HIGH.

2. **Statement of Compliance booleans auto-checked true** — the `Wh347Compliance` interface requires boolean flags (`certProperPayment`, `certApprentices`, etc.). The compliance engine result must drive these values before PDF generation. Defaulting all to `true` is a false federal certification under 29 CFR 5.5(a)(3)(ii). The WH-347 and compliance engine must be built together, not independently.

3. **CWHSSA OT formula duplicated instead of reused** — the existing `calculateCwhssaOt()` in `calculations.ts` correctly applies 1.5x only to base rate (not fringe). Any new OT compliance code that independently recalculates expected pay risks applying 1.5x to fringe, overstating the required amount. Rule: `calculateCwhssaOt()` is the single source of truth for OT math in the compliance engine.

4. **Multi-classification worker OT missed** — a worker with two `payrollEntries` rows (one per classification) totaling 80 hours total shows 40 hours in each row with no OT flag. The compliance engine must group by `workerId` within a `payrollWeekId` first, aggregate total hours across all classifications, and compute OT premium at the highest `baseRateSnapshot` for the week.

5. **Under-wage flag compares snapshot to current WD rate** — `baseRateSnapshot` on `payrollEntries` is the locked applicable rate at entry time. Comparing it to the current live `wageClassifications.baseRate` produces false positives every time the WD is updated. The correct check: `grossWages < (hours * baseRateSnapshot + hours * fringeRateSnapshot)`. Updating a WD must never flip old entries to violation status.

6. **WH-347 silently truncates workers beyond 8** — the current `fillWh347()` caps at 8 rows with `Math.min(data.workers.length, 8)` and no error. Projects with 9+ workers in a week will produce incomplete submissions. Pagination (Page X of Y, per DOL convention) or a hard block with worker count warning must be implemented before the WH-347 button is exposed in the UI.

## Implications for Roadmap

Based on the dependency graph in FEATURES.md and the build order in ARCHITECTURE.md, the research strongly suggests a four-phase structure ordered by regulatory criticality and dependency resolution.

### Phase 1: Schema + WH-347 Compliance Foundation

**Rationale:** J/RA classification field is a dependency for both the 2025 WH-347 form (mandatory checkbox) and the apprentice ratio compliance check. The WH-347 form itself must be updated to the January 2025 revision before any UI work exposes it — the current overlay is on the wrong form. These are correctness prerequisites, not features. Nothing in v2.0 is legally valid until this phase is complete.

**Delivers:** A legally correct 2025 WH-347 PDF with J/RA classification field, Statement of Compliance consolidated onto WH-347, and J/RA schema in place for downstream features.

**Addresses:**
- J/RA classification field on worker (P1 — unblocks two other features)
- WH-347 PDF updated to January 2025 form (P1 — regulatory correctness issue)
- Missing SSN/address flag (LOW complexity; wires to existing nullable worker fields)

**Avoids:**
- Pitfall 7: Statement of Compliance auto-checked (build the certification checkbox logic with real data from the start)
- Pitfall 6: WH-347 truncation at 8 workers (decide pagination design before UI hookup)

**Research flag:** Standard patterns — no additional research needed. pdf-lib multi-page is documented; schema migration is add-only.

### Phase 2: Compliance Engine

**Rationale:** The compliance engine must exist before the dashboard, before the WH-347 button generates with real compliance booleans, and before any compliance UI is wired. Building engine-first means UI components are never coupled to hardcoded compliance state. This is the highest-risk phase from a regulatory precision standpoint — all ten pitfalls from PITFALLS.md live here.

**Delivers:** `complianceEngine.ts` with all four violation checks, `compliance.ts` route (project-level and week-level), `ComplianceBadge.tsx` and `ViolationsList.tsx` shared components.

**Addresses:**
- Under-wage compliance flag (P1)
- CWHSSA OT error flag (P1)
- Apprentice ratio compliance check (P1 — depends on J/RA field from Phase 1)
- Missing SSN/address flag (compliance-engine variant; dashboard surfacing)

**Avoids:**
- Pitfall 1: Apprentice ratio daily vs weekly — build daily loop into engine design from the start
- Pitfall 3: CWHSSA OT fringe multiplied — reuse `calculateCwhssaOt()` exclusively
- Pitfall 4: Multi-classification OT — aggregate by workerId before checking thresholds
- Pitfall 5: Under-wage snapshot vs live rate — compare snapshot to snapshot-derived expected pay only
- Pitfall 10: Live classification join — document known limitation; add `laborTypeSnapshot` as add-only column if phase budget allows

**Research flag:** Needs attention during planning. The daily apprentice ratio reconstruction from day columns is the highest-complexity logic in the milestone. The planner should verify the exact column structure of `payrollEntries` daily hours before writing the engine query.

### Phase 3: Contractor Dashboard + Payroll Week View

**Rationale:** Dashboard compliance status is a read of computed compliance flags — it has no logic of its own. It cannot be built until Phase 2 exists. The PayrollWeekPage is the contractor's central action point and requires both compliance data and the WH-347 button. Grouping these together makes sense: both are consumer surfaces of the compliance engine.

**Delivers:** Updated `DashboardPage.tsx` with per-project compliance badges, new `PayrollWeekPage.tsx` at `/projects/:projectId/payroll/:weekId` with violation list and PDF action buttons, updated `PayrollListPage.tsx` with View links to week page.

**Addresses:**
- Dashboard — project compliance status (P1)
- WH-347 accessible from payroll week view (P1 — UI route only; no code change to existing WH-347 route)
- Proactive missing-worker-data warnings surfaced at dashboard (Pitfall 9 mitigation)

**Avoids:**
- Pitfall 9: Missing data warnings only at PDF generation — dashboard surfaces these early
- Anti-pattern: Compliance fetched inside ProjectCard — fetch at DashboardPage level, pass as props
- Anti-pattern: PDF generation via React mutation — use `window.open()` pattern from existing export route

**Research flag:** Standard patterns. Dashboard data flow follows the established `useQuery` + props pattern. No novel territory.

### Phase 4: Reports (Fringe Summary + Worker Pay History)

**Rationale:** These reports are independent of the compliance engine (they read payroll data directly) and can be built last without blocking any other phase. They are valuable for DOL audits but are not workflow blockers. Fringe benefit summary requires verifying that `fringeRateSnapshot` is stored per payroll entry before building the aggregation — confirm this during planning.

**Delivers:** `FringeSummaryPage.tsx` at `/projects/:projectId/fringe`, `WorkerPayHistoryPage.tsx` at `/projects/:projectId/workers/:workerId/history`, `fringeService.ts`, `workerHistoryService.ts`, `reports.ts` route.

**Addresses:**
- Fringe benefit summary report (P1 — per worker per week, not project aggregate)
- Worker pay history report (P1 — descending sort by weekEndingDate by default)

**Avoids:**
- Pitfall 8: Fringe report averaging across weeks — display week-level per-worker breakdown; never project aggregate as the primary view
- Performance trap: Fetching all entries and filtering in JS — use Drizzle queries with project/week filter at DB level

**Research flag:** One validation point needed before planning. Confirm `fringeRateSnapshot` is stored on `payrollEntries` (or identify where fringe rate per worker per week is accessible). If missing, a schema addition is required in this phase.

### Phase Ordering Rationale

- Phase 1 before Phase 2: J/RA classification field is a hard dependency for apprentice ratio check and 2025 WH-347 form fields. WH-347 correctness cannot be assumed while the form overlay targets the wrong form version.
- Phase 2 before Phase 3: Dashboard compliance badges and the WH-347 button's compliance boolean inputs both require a working compliance engine. Building UI first would require placeholder/hardcoded data that creates regulatory risk.
- Phase 3 before Phase 4: PayrollWeekPage establishes the navigation pattern (payroll list → week view → report links). Reports link naturally from the week view, so the page structure should exist before report pages are added.
- Phase 4 last: Fully independent; does not block any other phase.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (Compliance Engine):** Verify the exact column names for daily ST/OT hours in `payrollEntries` before designing the apprentice ratio daily-loop query. Verify `getOrDefaultThreshold()` signature and whether it handles missing rows for CWHSSA 40-hour default correctly.
- **Phase 4 (Reports):** Confirm `fringeRateSnapshot` exists on `payrollEntries`. If it does not, a schema addition is required and the phase scope expands.

Phases with standard patterns (skip additional research):
- **Phase 1 (Schema + WH-347):** pdf-lib `addPage()` is documented; add-only schema migration follows established Drizzle pattern; January 2025 WH-347 form instructions are public DOL sources.
- **Phase 3 (Dashboard + Week View):** All patterns are established in the existing codebase — `useQuery` + props delegation, `window.open()` for PDF downloads, `requireAuth` + `assertProjectOwner` on routes.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Three new libraries are minimal additions to a mature stack; version compatibility verified (tailwind-merge v3 = Tailwind v4); existing codebase reviewed directly |
| Features | HIGH | Grounded in 29 CFR Part 5, WH-347 Jan 2025 form instructions, and DOL enforcement patterns; January 2025 form revision is a confirmed regulatory fact |
| Architecture | HIGH | Based on direct codebase inspection; follows established patterns throughout; no novel integration territory |
| Pitfalls | HIGH | Ten pitfalls derived from DOL official sources, direct code audit, and LCPtracker/eBacon practitioner guidance; all are verifiable in the existing schema |

**Overall confidence:** HIGH

### Gaps to Address

- **Fringe rate storage location:** Research assumes `fringeRateSnapshot` is stored on `payrollEntries`. Confirm this before Phase 4 planning. If fringe rate is only on `wageClassifications` (not snapshotted), the fringe service must join live rates, which introduces the same snapshot-vs-live risk as the under-wage check.
- **`laborTypeSnapshot` decision:** PITFALLS.md flags that reclassifying a worker retroactively affects historical compliance checks. Whether to add `laborTypeSnapshot` as an add-only column in Phase 2 or defer as a known limitation should be an explicit planning decision, not an implementation surprise.
- **WH-347 pagination design:** The current `fillWh347()` caps at 8 workers with silent truncation. The exact pagination approach (multi-document, multi-page single document, or hard block) must be decided in Phase 1 planning before the WH-347 UI button is exposed. DOL convention supports "Page X of Y" using additional form copies.
- **Unregistered apprentice flag vs under-wage error:** PITFALLS.md identifies that an apprentice with `programName IS NULL` should surface as a "registration not confirmed" warning, distinct from an under-wage error. This is a new compliance check type not listed in FEATURES.md. It should be confirmed as in-scope for Phase 2.

## Sources

### Primary (HIGH confidence)
- [DOL WH-347 Form Instructions — Rev. Jan 2025](https://www.dol.gov/agencies/whd/forms/wh347) — 2025 form structure, Statement of Compliance consolidation, J/RA checkbox requirement
- [eCFR 29 CFR Part 5](https://www.ecfr.gov/current/title-29/subtitle-A/part-5) — Davis-Bacon labor standards provisions; fringe annualization; apprentice ratio rules
- [DOL CWHSSA and FLSA Overtime on Government Contracts](https://www.dol.gov/sites/dolgov/files/WHD/prevailing-wage-presentations/dbra-seminars/CWHSSA-and-FLSA-Overtime-and-Government-Contracts.pdf) — CWHSSA fringe exclusion from OT premium; $10/day/violation liquidated damages
- [DOL Davis-Bacon Compliance Principles](https://www.dol.gov/agencies/whd/government-contracts/prevailing-wage-resource-book/db-compliance-principles) — daily ratio enforcement, multi-classification OT rule
- Direct codebase inspection: `calculations.ts`, `variancePdf.ts`, `wh347Generator.ts`, `varianceService.ts`, `DashboardPage.tsx`, `ProjectCard.tsx`, `db/schema.ts` (2026-03-19)

### Secondary (MEDIUM confidence)
- [LCPtracker Pro feature list](https://lcptracker.com/solutions/lcptracker) — competitor feature benchmarking; confirms dashboard compliance status and apprentice tracking as expected features
- [Points North — Most Common Prevailing Wage Compliance Errors](https://www.points-north.com/trends-and-insights/prevailing-wage-investigations-the-most-common-contractor-errors) — DOL audit investigation patterns (weeks 1-4 focus, misclassification prevalence)
- [Points North — Apprenticeship Ratios and Prevailing Wage](https://www.points-north.com/trends-and-insights/apprenticeship-ratios-prevailing-wage-requirements) — per-trade daily ratio calculation
- [npm — tailwind-merge](https://www.npmjs.com/package/tailwind-merge) — v3.x Tailwind v4 support confirmed
- [date-fns v4.0 release blog](https://blog.date-fns.org/v40-with-time-zone-support/) — ESM-first, compatible with project's `"type": "module"` setup

### Tertiary (MEDIUM-LOW confidence)
- [Construction Business Forms — WH-347 Instructions](https://www.construction-business-forms.com/instructions-wh-347-348.html) — 8-worker row limit and Page X of Y pagination convention (verify against official DOL instructions before implementation)
- [SMACNA — Best Practices for Apprentices on Davis-Bacon Projects](https://www.smacna.org/news/smacnews/issue-archive/issue/articles/smacnews-july-august-2023/best-practices-for-using--apprentices--on-davis-bacon-projects) — unregistered apprentice rate rule

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
