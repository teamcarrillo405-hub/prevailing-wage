# Phase 35: Payroll Import — Server Pipeline — Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Parse QuickBooks "Time by Employee Detail" CSV exports and ADP CSV exports (format TBD by researcher), auto-detect provider by column signature, match rows to project workers (case-insensitive), return a structured preview of matched/unmatched/conflicted rows — without writing any DB rows until the contractor confirms via Phase 36.

This phase does NOT include: the React import modal (Phase 36), any real-time CSV streaming, worker auto-creation from unmatched rows (that's Phase 36 confirm flow), or undo-import capability.

</domain>

<decisions>
## Implementation Decisions

### QB Export Format (PI-01)

- **D-01:** Target QuickBooks **"Time by Employee Detail"** report (CSV). This report has daily hours per employee per job — maps directly to the ST/OT per-day columns in `payrollEntries`. Contractors already run this report for job costing. The researcher must confirm exact column headers from a real QB export (QB Desktop vs QB Online may differ slightly).

### ADP Export Format (PI-02)

- **D-02:** ADP target format is **left to researcher** to confirm. ADP products (Run, Workforce Now, TotalSource) have different export formats, and prevailing wage contractors vary in which tier they use. Researcher must identify: (a) which ADP product tier is most common for small/mid contractors, (b) the specific export format and its column headers, (c) whether daily hour breakdown is available. If daily breakdown is unavailable in any ADP format, researcher should flag this so fallback behavior (weekly totals only, no day-by-day) can be scoped.

### Provider Auto-Detection (PI-01, PI-02)

- **D-03:** Auto-detect provider by **column signature** — check the CSV header row for a unique column combination present in QB but not ADP (and vice versa). The researcher will identify the distinguishing header columns. importService.ts calls a `detectProvider(headers: string[]): 'quickbooks' | 'adp' | 'unknown'` function. If `'unknown'`, return a 400 with a user-facing message: "Could not detect payroll provider. Upload a QuickBooks Time by Employee Detail or ADP payroll export."

### Worker Matching (PI-01, PI-02)

- **D-04:** Match CSV worker names to project workers using **case-insensitive exact string match**. "JOHN SMITH" matches "John Smith". Trim leading/trailing whitespace before comparing. No fuzzy matching — the Phase 36 review screen exists precisely to handle mismatches. Three outcome buckets:
  - `matched` — name matches one project worker (case-insensitive)
  - `unmatched` — name matches zero project workers
  - `conflict` — matched worker already has a manual entry for this week (see D-06)

### Rate Sourcing (PI-01, PI-02)

- **D-05:** Rates come from the **WD cache / worker's active classification snapshot**, never from the CSV. The import preview response includes `baseRateSnapshot` and `fringeRateSnapshot` pulled from the matched worker's active classification on the project. If a worker has multiple classifications, use the first active one — the contractor can adjust in Phase 36 if needed. This preserves the existing compliance invariant (rates always from WD, never user-entered).

### Conflict Handling — Duplicate Entries (PI-01, PI-02)

- **D-06:** If a matched worker already has a `payrollEntry` for this week (unique constraint: weekId + workerId + classificationId), the row is returned as `conflict` in the preview — **not silently overwritten or merged**. The conflict message: "Worker already has a manual entry for this week. Delete it before importing." Conflict rows are not committed even when the contractor clicks confirm in Phase 36. This preserves the audit trail and avoids data loss.

### Preview Response Shape (PI-01, PI-02)

- **D-07:** `POST /api/payroll/import/preview` returns:
  ```ts
  {
    provider: 'quickbooks' | 'adp',
    weekId: string,
    matched: ImportedRow[],
    unmatched: UnmatchedRow[],
    conflicts: ConflictRow[],
  }
  ```
  Where:
  - `ImportedRow`: `{ csvName, workerId, workerName, classificationId, classificationName, baseRateSnapshot, fringeRateSnapshot, monSt, tueSt, wedSt, thuSt, friSt, satSt, sunSt, monOt, tueOt, wedOt, thuOt, friOt, satOt, sunOt }`
  - `UnmatchedRow`: `{ csvName, hours: { ...same day fields } }`
  - `ConflictRow`: `{ csvName, workerId, workerName, reason: string }`

### Commit Route (PI-01, PI-02)

- **D-08:** `POST /api/payroll/import/commit` accepts the preview's `matched[]` array (client sends back matched rows after Phase 36 resolution). Server re-validates: still assertProjectAccess, week still not submitted. Inserts `payrollEntries` with `createdByUserId = req.user!.userId`. Returns `{ committed: number }`.
- **D-09:** The commit route does NOT re-parse the CSV — the client sends the resolved rows (matched + any Phase 36 user-resolved rows). This keeps the commit route simple and avoids re-uploading the file.

### Submitted-Week Guard (PI-01, PI-02)

- **D-10:** Both preview and commit routes check `week.submittedAt`. If set, return 423 (Locked) with: "This payroll week is submitted and cannot be modified." Same lock applied to manual edits — import is not an exception.

### Audit Table (PI-01, PI-02)

- **D-11:** `payroll_imports` table — **event-level only**. One row per commit:
  ```sql
  CREATE TABLE payroll_imports (
    id TEXT PRIMARY KEY,
    payroll_week_id TEXT NOT NULL REFERENCES payroll_weeks(id),
    imported_by_user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,          -- 'quickbooks' | 'adp'
    source_filename TEXT,            -- original uploaded filename
    committed_count INTEGER NOT NULL,
    unmatched_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  ```
  Sufficient for audit ("who imported what into which week"). No row-level traceability in this phase.

### Migration

- **D-12:** Migration file `0020_payroll_imports.sql`, idx 16 in `_journal.json`. Single `CREATE TABLE payroll_imports` statement.

### Route Structure

- **D-13:** Two new routes on a new `import` router, mounted at `/api/payroll/import`:
  - `POST /api/payroll/import/preview` — multipart upload (multer), parses file, returns preview JSON
  - `POST /api/payroll/import/commit` — JSON body (resolved rows), writes entries + audit row
  Both require auth + `assertProjectAccess` (project derived from `weekId`).

### File Upload (multer)

- **D-14:** Use existing `multer` package (already installed, ^2.1.1). Memory storage (`multer.memoryStorage()`) — file stored as `Buffer` in `req.file.buffer`, no disk writes. Max file size: 5 MB (typical QB/ADP CSV is < 100 KB). Accept only `text/csv` and `application/vnd.ms-excel` MIME types.

### Service Structure

- **D-15:** `src/server/services/importService.ts` — main orchestrator: `parseImportFile(buffer, weekId, projectId)` calls provider detector → appropriate mapper → worker matcher → preview builder.
  - `src/server/services/qbMapper.ts` — QB column → `ImportedRow` transformer
  - `src/server/services/adpMapper.ts` — ADP column → `ImportedRow` transformer (researcher fills in column definitions)
  - `src/server/routes/import.ts` — Express router, mounted in `index.ts`

### Claude's Discretion

- Exact QB "Time by Employee Detail" column header names — researcher confirms
- ADP column headers — researcher confirms
- Error message copy for malformed CSV (non-payroll file uploaded)
- Whether `papaparse` or `csv-parse` is used for parsing (both installed — use papaparse for consistency with existing csvExporter.ts)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB Schema
- `src/server/db/schema.ts` — reference `payrollEntries` shape + `payrollWeeks.submittedAt` lock field
- `src/server/db/migrations/meta/_journal.json` — register idx 16, tag `0020_payroll_imports`

### New Files
- `src/server/db/migrations/0020_payroll_imports.sql` — CREATE TABLE payroll_imports
- `src/server/services/importService.ts` — main import orchestrator
- `src/server/services/qbMapper.ts` — QuickBooks column mapper
- `src/server/services/adpMapper.ts` — ADP column mapper (columns TBD by researcher)
- `src/server/routes/import.ts` — Express router

### Files to Modify
- `src/server/index.ts` — mount import router at `/api/payroll/import`

### Existing Patterns to Replicate
- `src/server/routes/payroll.ts` — `assertProjectAccess` + `req.user!.userId` pattern
- `src/server/services/csvExporter.ts` — papaparse usage pattern
- `src/server/services/payrollService.ts` — Drizzle insert pattern for payrollEntries

### Requirements
- `.planning/REQUIREMENTS.md` §PI-01, PI-02

</canonical_refs>

<code_context>
## Existing Code Insights

### multer Already Installed
- `multer` ^2.1.1 in package.json — use `multer.memoryStorage()`, no disk writes
- `@types/multer` ^2.1.0 also installed

### CSV Libraries Available
- `papaparse` ^5.5.3 (client-side + server-side) — used in csvExporter.ts
- `csv-parse` ^6.2.0 — also available
- Use `papaparse` for consistency with existing service code

### payrollEntries Unique Constraint
- `payrollEntryUnique` index on `(payroll_week_id, worker_id, classification_id)` — insert will throw if conflict exists; preview must detect this before commit

### Existing Route Auth Pattern
```ts
const userId = req.user!.userId;
await assertProjectAccess(db, projectId, userId);
if (week.submittedAt) return res.status(423).json({ error: '...' });
```

### Migration Convention
- SQL-only, manually registered in `meta/_journal.json`
- Next idx: 16, next tag: `0020_payroll_imports`
- Statement separator: `-->  statement-breakpoint` (single space before, two after `-->`)

### Critical Pitfalls
- Rate snapshots must come from the WD cache / worker classification — NEVER from CSV columns
- Provider auto-detection must fail gracefully with a clear 400 (not a 500 crash on unknown format)
- The commit route must NOT re-parse the file — client sends resolved rows back
- `payrollEntries` uniqueness check must happen before any insert attempt, not rely on DB error handling

</code_context>

<specifics>
## Specific Implementation Details

- QB format: "Time by Employee Detail" CSV — researcher confirms exact column headers
- ADP format: researcher confirms (likely ADP Run payroll register or Workforce Now timesheet)
- Provider detection: by column header signature (researcher defines distinguishing headers)
- Worker matching: case-insensitive exact match, trim whitespace
- Conflict: pre-existing entry → `conflicts[]` bucket, not committed
- Rates: from worker's active classification snapshot, never from CSV
- Preview route: `POST /api/payroll/import/preview` (multipart)
- Commit route: `POST /api/payroll/import/commit` (JSON, resolved rows from client)
- Submitted-week lock: 423 on both routes
- Audit: event-level `payroll_imports` table, one row per commit
- Migration: `0020_payroll_imports.sql`, idx 16
- multer: memoryStorage, 5 MB limit, CSV MIME types only

</specifics>

<deferred>
## Deferred Ideas

- Row-level `payroll_imports` audit (entry traceability + undo-import) — deferred; event-level sufficient for v3.0
- Fuzzy worker name matching — deferred; Phase 36 review screen covers mismatches
- Re-upload same file detection — deferred
- ADP Workforce Now enterprise format (if researcher determines this is rare among small contractors) — may be descoped to v4+

</deferred>

---

*Phase: 35-payroll-import-server-pipeline*
*Context gathered: 2026-03-30*
