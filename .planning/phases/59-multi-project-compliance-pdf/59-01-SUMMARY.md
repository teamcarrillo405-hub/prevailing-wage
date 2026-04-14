---
phase: 59
plan: 01
subsystem: export
tags: [pdf, compliance, portfolio, dashboard]
dependency_graph:
  requires: [pdf-lib, drizzle-orm, express]
  provides: [GET /api/export/compliance-summary, generateComplianceSummaryPdf]
  affects: [DashboardPage, export router]
tech_stack:
  added: []
  patterns: [pdf-lib PDFDocument.create(), drizzle select/from/where, Promise.all per-project aggregation]
key_files:
  created:
    - src/server/services/complianceSummaryPdfGenerator.ts
    - tests/services/complianceSummaryPdfGenerator.test.ts
  modified:
    - src/server/routes/export.ts
    - src/client/pages/DashboardPage.tsx
decisions:
  - Used db.select().from().where() instead of db.query.*.findMany() with where callbacks to avoid implicit-any TypeScript errors
  - Used req.user!.userId (not .id) consistent with all other export.ts routes
  - Applied explicit type aliases (ProjectRow, WeekRow) on map/filter callbacks to satisfy noImplicitAny
  - router.use(requireAuth) already applied at router level — did not add per-route auth guard
  - Overdue CPR: submittedAt IS NULL AND weekEndingDate < today-7d (matches plan spec)
metrics:
  duration: ~8 minutes
  completed: 2026-04-14
  tasks: 4
  files: 4
---

# Phase 59 Plan 01: Multi-Project Compliance Summary PDF Summary

Generated a portfolio-level compliance PDF using pdf-lib PDFDocument.create() with per-project worker counts, payroll week totals, CPR overdue counts, and sub-CPR status rows.

## What Was Built

- `src/server/services/complianceSummaryPdfGenerator.ts` — New service. Accepts `ComplianceSummaryInput` (generatedAt, contractorEmail, projects array) and returns a `Uint8Array` PDF. Uses pdf-lib with letter-size pages (612x792pt), bottom-left coordinate origin, HelveticaBold titles, gray table header backgrounds, red overdue counts, and per-page page numbers. Automatically adds new pages when y < 120.

- `src/server/routes/export.ts` — Added `GET /api/export/compliance-summary`. Queries all active projects for `req.user!.userId`, then for each project queries worker counts, payroll weeks (total/submitted/pending/overdue), and subcontractor CPR weeks (compliant/violation/pending). Builds `ComplianceSummaryInput` and calls the generator. Returns `application/pdf` with `Content-Disposition: attachment; filename="compliance-summary.pdf"`. Uses `db.select().from(schema.x).where(eq(...))` pattern with explicit type annotations to avoid implicit-any TS errors.

- `src/client/pages/DashboardPage.tsx` — Added a plain `<a>` download link styled with Tailwind border/hover classes, inserted between the dashboard-bg hero strip and HelpCallout. No new imports required.

- `tests/services/complianceSummaryPdfGenerator.test.ts` — TDD test file. Test 1: buffer length > 0. Test 2: first 5 bytes equal `%PDF-`. Both pass GREEN.

## Key Implementation Decisions

1. **`db.select().from().where()` over `db.query.*.findMany({ where: callback })`** — The relational query API's callback pattern (`(p, { eq, and }) =>`) triggered implicit-any TS errors under this project's tsconfig. Switching to the explicit select/from/where pattern with `import { eq, and } from 'drizzle-orm'` and `import * as schema` resolved all new errors.

2. **`req.user!.userId`** — Consistent with 100% of existing export.ts routes. The plan's context note said `.id` but all 15+ existing uses are `.userId`.

3. **No per-route `requireAuth`** — The router already has `router.use(requireAuth)` applied globally at line 67 of export.ts.

4. **Overdue definition** — `submittedAt === null && weekEndingDate < today-7d` (ISO string comparison works because dates are stored as `YYYY-MM-DD` text).

5. **Sub-CPR status mapping** — `isCompliant === 1` = compliant, `isCompliant === 0` = violation, `isCompliant === null` = pending. Matches schema integer field semantics.

## Test Results

```
Tests: 2 passed (2)
Files: 1 passed (1)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Implicit-any TypeScript errors in route callbacks**
- **Found during:** Task 2
- **Issue:** `db.query.*.findMany({ where: (p, { eq, and }) => ... })` pattern caused TS7006/TS7031 implicit-any errors under this tsconfig.
- **Fix:** Switched to `db.select().from(schema.x).where(eq(...))` with `import { eq, and } from 'drizzle-orm'` and `import * as schema`. Added `type ProjectRow = typeof schema.projects.$inferSelect` and `type WeekRow` aliases for map/filter callbacks.
- **Files modified:** `src/server/routes/export.ts`
- **Commit:** 915d643

**2. [Rule 1 - Bug] Route context note said `req.user!.id` but correct property is `req.user!.userId`**
- **Found during:** Task 2 (pre-read check)
- **Fix:** Used `req.user!.userId` consistent with all 15+ existing routes in export.ts.
- **Commit:** 915d643

## Known Stubs

None — all fields are wired to live DB queries.

## Self-Check: PASSED

Files exist:
- FOUND: src/server/services/complianceSummaryPdfGenerator.ts
- FOUND: tests/services/complianceSummaryPdfGenerator.test.ts
- FOUND: src/server/routes/export.ts (modified)
- FOUND: src/client/pages/DashboardPage.tsx (modified)

Commit exists: 915d643
