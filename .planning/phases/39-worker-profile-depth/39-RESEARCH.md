# Phase 39: Worker Profile Depth — Research

**Researched:** 2026-04-01
**Domain:** SQLite schema migration, Drizzle ORM, Express routes, React form patterns
**Confidence:** HIGH — all findings sourced from direct code inspection

---

## Summary

Phase 39 adds four data model extensions to the `workers` table and introduces a new
`payroll_week_classifications` junction table. The work splits cleanly into two tracks:
(1) database schema + backfill + server-side service/route changes, and (2) React UI
updates on WorkersPage and PayrollWeekDetailPage.

The most delicate operation is WORKER-01: SQLite does not support `ALTER TABLE ... RENAME
COLUMN` in older SQLite versions (< 3.25), and this project's CLAUDE.md mandates
add-only migrations — never drop or rename. The correct strategy is to add four new
columns, backfill `address_street` from the existing `address` value using an `UPDATE`
statement in the same migration, and keep the `address` column for backward compatibility
(it remains in the schema but is superseded). The WH-347 generator and the
`getPayrollEntriesWithWorkerDetails` function both currently use `workers.address` and
must be updated to concatenate the four structured fields instead.

Classification data for workers lives in the `worker_classifications` table (a separate
table joined at query time), not a JSON column on `workers`. `payroll_entries` references
a single `classificationId` per row; the planned `payroll_week_classifications` table
provides a week-specific override layer that the WH-347 generator must respect via a
LEFT JOIN.

**Primary recommendation:** Two plans. Plan 01 covers all SQL migrations + schema.ts +
workerService + routes + payrollService query updates. Plan 02 covers WorkersPage and
PayrollWeekDetailPage React changes.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORKER-01 | Replace `address` text with 4 structured columns; backfill into `addressStreet`; WH-347 concatenates | Add-only migration (4 ADD COLUMN + 1 UPDATE); keep old column; update WH-347 path in export.ts |
| WORKER-02 | Add `unionLocal` + `unionBookNumber` columns; WorkersPage "Union Information" section | Two ADD COLUMN statements; new optional form section; no service complexity |
| WORKER-03 | Add `apprenticeshipCommittee` + `apprenticeshipRegNumber` columns; shown when `laborType = "apprentice"` | Two ADD COLUMN statements; conditional render in WorkersPage using `w.classifications.some(c => c.laborType === 'apprentice')` |
| WORKER-04 | New `payroll_week_classifications` table; override dropdown in PayrollWeekDetailPage; WH-347 uses week-specific classification when set | New CREATE TABLE migration; new route POST/DELETE; modified WH-347 assembly to LEFT JOIN override table |
| NFR-01 | All new migrations use `--> statement-breakpoint` separator | Confirmed pattern in 0021_audit_logs.sql — one space before `statement-breakpoint` |
| NFR-05 | All new migration files have corresponding Drizzle schema update in schema.ts | Must add all new columns/table to schema.ts and register in `_journal.json` |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Add-only migrations:** Never drop or rename columns — `ALTER TABLE ... ADD COLUMN`
  only. This governs WORKER-01 (must keep `address` column).
- **Migration journal:** Every new migration file MUST be registered in
  `src/server/db/migrations/meta/_journal.json`. Drizzle silently skips unregistered
  files. Current highest idx is **17** (tag `0021_audit_logs`). Next migrations start at
  idx 18.
- **No column rename:** SQLite `ALTER TABLE ... RENAME COLUMN` is supported in SQLite
  3.25+ but is explicitly forbidden by CLAUDE.md policy. Keep `address` in place.
- **Statement-breakpoint separator:** `--> statement-breakpoint` (one space) between SQL
  statements, per NFR-01 and confirmed in `0021_audit_logs.sql`.
- **`assertProjectAccess` before any data access** (NFR-03).
- **Design tokens:** `bg-nav-dark`, `border-brand-gold`, `bg-surface-card` etc. — never
  hardcode hex values in JSX.
- **UI primitives:** `Card`, `Button`, `Badge`, `PageHeader`, `EmptyState` from
  `src/client/components/ui/`.
- **No test framework found in project source** — no `src/**/*.test.ts` files exist
  outside `node_modules`. Validation is manual via the running app and compile checks.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | installed | Schema definition + type-safe queries | Already used for all tables |
| better-sqlite3 | installed | SQLite driver | Existing stack |
| Zod | installed | Input validation schemas in routes | Existing pattern throughout routes |
| React + TanStack Query | installed | UI state + server-sync | Existing pattern throughout pages |

### No new dependencies required for Phase 39.

---

## Architecture Patterns

### Current `workers` Table — Exact Column List

From `src/server/db/schema.ts` lines 71–82:

```
id            TEXT  PRIMARY KEY
projectId     TEXT  NOT NULL  FK → projects.id CASCADE
name          TEXT  NOT NULL
ssnLast4      TEXT  nullable
ssnEncrypted  TEXT  nullable
tradeUnion    TEXT  nullable
address       TEXT  nullable   ← WORKER-01: this is replaced by 4 new columns (kept for compat)
isActive      INTEGER (boolean) NOT NULL DEFAULT true
createdAt     TEXT  NOT NULL
updatedAt     TEXT  NOT NULL
```

Worker **classifications** are NOT a JSON column on `workers`. They live in the separate
`worker_classifications` table (lines 84–100 of schema.ts), joined at query time via
`workerId`. This is critical for WORKER-03: the "show only when apprentice" condition must
be driven by the worker's classification rows, not a column on the worker itself.

### Current Address Usage — All Touch Points

1. **`workers.address` column** — single freetext field.
2. **`workerService.ts`** — `createWorker()` line 69 writes `address: input.address ?? null`; `updateWorker()` line 118 updates `address` field.
3. **`workers.ts` route** — `CreateWorkerSchema` and `UpdateWorkerSchema` include `address: z.string().max(500)`. Route passes `body.address` to the service.
4. **`WorkersPage.tsx`** — `blankWorkerForm()` includes `address: ''`; `workerToEditForm()` includes `address: w.address ?? ''`; edit form renders a single `<input>` for address; worker card view displays `{w.address}`.
5. **`payrollService.ts` `getPayrollEntriesWithWorkerDetails()`** (lines 387) — joins `workerAddress: workers.address` for use in CA eCPR and WA PWIA XML generators.
6. **`export.ts`** — **does NOT use `worker.address`** for WH-347; it currently uses `contractorAddress: \`${project.county}, ${project.state}\`` (line 191). The WH-347 `contractorAddress` field is the contractor's address, not the worker's address.

**Key finding:** Worker `address` does NOT currently appear in the WH-347 PDF output —
`Wh347WorkerRow` interface has no address field, and the fill loop does not draw worker
addresses. WORKER-01 requires adding worker address to WH-347 output (per the requirement
"WH-347 concatenates them for the address column"). The WH-347 worker grid layout has an
`identifyingNo` column (column 1E at x≈175) but no dedicated worker-address column, which
means the address is typically placed in the identifying-number slot or as a sub-line.

Inspecting the WH-347 form field spec: the DOL WH-347 worker grid column 1E is labeled
"Identifying No." (SSN last 4 / worker ID). There is no separate address column in the
worker grid. Address appears in the **contractor** header, not per-worker rows.

**Revised WORKER-01 scope:** The structured address replaces the freetext `address`
column for the worker record; WH-347 uses it for the `contractorAddress` header field IF
the project's own address is not stored separately (currently `contractorAddress` is
derived from project county/state, not worker data). The worker's `address` is surfaced in
CA eCPR XML (`workerAddress` in `getPayrollEntriesWithWorkerDetails`). After migration,
that join must switch to concatenating the four new fields.

### WORKER-01 Migration Strategy

SQLite add-only constraint means the approach is:

```sql
ALTER TABLE workers ADD COLUMN address_street TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_city TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_state TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_zip TEXT;
--> statement-breakpoint
UPDATE workers SET address_street = address WHERE address IS NOT NULL;
```

The `address` column is kept (add-only policy). The service layer stops writing to it for
new records; existing records have their freetext value backfilled into `address_street`.

**The UPDATE backfill must go in the SQL migration file** — not a separate script. It runs
atomically with the ADD COLUMN statements when Drizzle applies the migration. This is the
correct pattern because the workerService is TypeScript and has no direct migration-time
hook.

### `payroll_week_classifications` Table Design (WORKER-04)

New table needed:

```sql
CREATE TABLE payroll_week_classifications (
  id TEXT PRIMARY KEY NOT NULL,
  payroll_week_id TEXT NOT NULL REFERENCES payroll_weeks(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  classification_id TEXT NOT NULL REFERENCES worker_classifications(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX pwc_unique ON payroll_week_classifications(payroll_week_id, worker_id);
```

Design notes:
- **`hours` column from the requirement spec** is NOT needed here. Hours already live in
  `payroll_entries`. The `payroll_week_classifications` table is purely an override lookup:
  "for this week + this worker, use this classification instead of the default." There is
  no need to store hours twice.
- `UNIQUE(payroll_week_id, worker_id)` — one override per worker per week. If a second
  override is needed, the user replaces it (DELETE + INSERT pattern via UI).
- `ON DELETE CASCADE` on both FKs — if the payroll week or worker is deleted, the override
  rows are cleaned up automatically.

### WH-347 Classification Lookup (WORKER-04)

Currently: `getPayrollEntries()` joins `workerClassifications` on `payrollEntries.classificationId`. The `tradeDescription` and `laborType` come from the classification that was recorded when the payroll entry was created.

After WORKER-04: the WH-347 assembly in `export.ts` must check whether a
`payroll_week_classifications` override exists for that worker+week. If it does, use the
override classification's `tradeDescription`/`laborType` in the WH-347 row. If not, fall
back to the entry's `classificationId` join (current behavior).

Recommended approach: add a new service function (or modify `getPayrollEntries`) to LEFT
JOIN `payroll_week_classifications` and `worker_classifications` (aliased) for the
override. The final `tradeDescription` is `COALESCE(override.tradeDescription, entry_classification.tradeDescription)`.

In Drizzle, this requires either raw SQL or the `leftJoin` + `coalesce` approach. Given
the complexity of a three-table join with aliased tables, a targeted raw SQL helper in
`payrollService.ts` is the most readable option.

### Classification Data Model — Confirmed NOT JSON

`workers.classifications` in the API response is an array assembled in the route handler
(`workers.ts` lines 112–134): for each worker row, a second query fetches all rows from
`worker_classifications` where `workerId = w.id`. The result is attached as
`classifications: [...]`. There is no JSON column on the `workers` table.

### workerService.ts — Migration Backfill

The backfill is SQL-only (in the migration file). The `workerService.ts` service:
- Must be updated to accept `addressStreet`, `addressCity`, `addressState`, `addressZip`
  in `CreateWorkerInput` and `UpdateWorkerInput`
- Must stop writing the `address` column for new records
- Must write the four new columns on create/update

The existing `address` field in `CreateWorkerSchema` / `UpdateWorkerSchema` in
`workers.ts` route must be replaced with four new optional string fields.

### WORKER-03 Conditional Rendering

The `laborType` for apprentice check lives on `workerClassifications`, not directly on
`workers`. On WorkersPage the worker object includes `w.classifications[]` each with
`laborType`. The conditional display is:

```typescript
const isApprentice = w.classifications.some(c => c.laborType === 'apprentice');
```

This is the correct gate for showing the "Apprenticeship" section. The new fields
(`apprenticeshipCommittee`, `apprenticeshipRegNumber`) are stored on `workers` itself
(not on the classification row), because they describe the worker's apprenticeship
registration, not a specific classification assignment.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column rename in SQLite | Custom data migration script | ADD COLUMN + UPDATE in SQL migration | SQLite does not support RENAME COLUMN in older versions; add-only is project policy |
| Multi-table join for override classification | Complex application-level join | SQL LEFT JOIN in payrollService query | Performance and correctness; avoids N+1 queries |
| Form state for 4 address fields | Nested object state | Flat state object with `addressStreet`, `addressCity`, `addressState`, `addressZip` keys | Consistent with existing `blankWorkerForm()` pattern (all fields flat) |

---

## Common Pitfalls

### Pitfall 1: Forgetting to Register Migration in `_journal.json`
**What goes wrong:** Drizzle silently skips migration files not in the journal. The
columns never get added to the database, but the app compiles and starts. Runtime errors
appear only when the new columns are first accessed.
**Why it happens:** The journal is manually maintained in this project; Drizzle does not
auto-discover files by filename.
**How to avoid:** After writing each migration file, immediately add a new entry to
`meta/_journal.json` with the correct `idx` (next after 17 = 18), matching `tag`, and
`breakpoints: true`.
**Warning signs:** App starts without error but API calls that touch new columns return
null or throw "no such column" SQLite errors.

### Pitfall 2: Address Backfill Creates NULL `address_street` for New Workers
**What goes wrong:** After the migration, new workers created before the service is
updated still have `address` written (old code path). After the service is updated, new
workers have `address_street` but not `address`. Code that still reads `workers.address`
gets null.
**How to avoid:** Update service + route + schema.ts atomically in Plan 01. The old
`address` column stays in the schema but service code stops writing it.

### Pitfall 3: WH-347 Classification Override Breaks Existing Entries
**What goes wrong:** If the WH-347 override join is written to INNER JOIN instead of LEFT
JOIN, workers with no override row are excluded from the WH-347 PDF.
**How to avoid:** Always use LEFT JOIN on `payroll_week_classifications`; coalesce to the
entry's own classification when no override exists.

### Pitfall 4: `payroll_week_classifications` Unique Constraint Conflict on Re-override
**What goes wrong:** User sets an override, then tries to change it. The INSERT fails
because of the unique constraint on `(payroll_week_id, worker_id)`.
**How to avoid:** The route for setting an override should use "upsert" semantics —
DELETE existing + INSERT, or use SQLite `INSERT OR REPLACE`. The simpler pattern in this
project is: DELETE where `payrollWeekId + workerId` match, then INSERT.

### Pitfall 5: `workerToEditForm()` Missing New Fields
**What goes wrong:** When the user opens the edit form on an existing worker, the new
fields are blank because `workerToEditForm()` doesn't include them.
**How to avoid:** Update `workerToEditForm(w: Worker)` to include all new fields:
`addressStreet: w.addressStreet ?? ''`, etc.

### Pitfall 6: `blankWorkerForm()` Missing New Fields Causes TypeScript Error
**What goes wrong:** Adding new fields to the `Worker` interface without updating
`blankWorkerForm()` produces a TypeScript error on `setForm(blankWorkerForm())` because
the form state type won't match the mutation payload shape.
**How to avoid:** Update `blankWorkerForm()` to include all new optional fields with
empty-string defaults. Update all mutation payloads and server schemas in lockstep.

---

## Code Examples

### Migration File Pattern (NFR-01)
```sql
-- src/server/db/migrations/0022_worker_profile_depth.sql
ALTER TABLE workers ADD COLUMN address_street TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_city TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_state TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_zip TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN union_local TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN union_book_number TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN apprenticeship_committee TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN apprenticeship_reg_number TEXT;
--> statement-breakpoint
UPDATE workers SET address_street = address WHERE address IS NOT NULL;
--> statement-breakpoint
CREATE TABLE payroll_week_classifications (
  id TEXT PRIMARY KEY NOT NULL,
  payroll_week_id TEXT NOT NULL REFERENCES payroll_weeks(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  classification_id TEXT NOT NULL REFERENCES worker_classifications(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX pwc_unique ON payroll_week_classifications(payroll_week_id, worker_id);
```

### Drizzle Schema Addition Pattern (NFR-05)
```typescript
// Additions to workers table in schema.ts
addressStreet: text('address_street'),
addressCity: text('address_city'),
addressState: text('address_state'),
addressZip: text('address_zip'),
unionLocal: text('union_local'),
unionBookNumber: text('union_book_number'),
apprenticeshipCommittee: text('apprenticeship_committee'),
apprenticeshipRegNumber: text('apprenticeship_reg_number'),
```

### `payroll_week_classifications` Drizzle Table
```typescript
export const payrollWeekClassifications = sqliteTable('payroll_week_classifications', {
  id: text('id').primaryKey(),
  payrollWeekId: text('payroll_week_id').notNull().references(() => payrollWeeks.id, { onDelete: 'cascade' }),
  workerId: text('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  classificationId: text('classification_id').notNull().references(() => workerClassifications.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  pwcUnique: uniqueIndex('pwc_unique').on(table.payrollWeekId, table.workerId),
}));
```

### WH-347 Address Concatenation
```typescript
// In export.ts — build formatted worker address for WH-347 contractor address field
// (Note: WH-347 worker grid has no per-worker address column; this pattern is for
// the CA eCPR workerAddress join in payrollService.ts)
function concatAddress(worker: {
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
}): string {
  return [worker.addressStreet, worker.addressCity, worker.addressState, worker.addressZip]
    .filter(Boolean)
    .join(', ');
}
```

### Apprentice Conditional Render Pattern (WORKER-03)
```tsx
{/* In WorkersPage edit form — show only when worker has an apprentice classification */}
{w.classifications.some(c => c.laborType === 'apprentice') && (
  <div className="mt-4 border-t border-gray-100 pt-4">
    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
      Apprenticeship
    </p>
    {/* apprenticeshipCommittee + apprenticeshipRegNumber inputs */}
  </div>
)}
```

### Override Route Pattern (WORKER-04)
```typescript
// PUT /api/projects/:projectId/payroll-week-classifications
// Sets (or replaces) the classification override for a worker in a payroll week.
// DELETE existing override row first, then INSERT new one.
```

---

## Migration Numbering

Current highest migration: `0021_audit_logs` at journal idx 17.

Phase 39 needs **one migration file** (recommended to consolidate all 8 ADD COLUMNs + 1
UPDATE + 1 CREATE TABLE into a single file to minimize journal entries):

| File | Tag | Journal idx |
|------|-----|-------------|
| `0022_worker_profile_depth.sql` | `0022_worker_profile_depth` | 18 |

---

## Plan Count Recommendation

**2 plans:**

| Plan | Scope |
|------|-------|
| Plan 01: Schema + Server | SQL migration file + journal entry + schema.ts additions + workerService.ts updated inputs + workers.ts route schema updates + payrollService.ts `getPayrollEntriesWithWorkerDetails` concat update + new `payrollWeekClassifications` route (POST/DELETE) |
| Plan 02: React UI | WorkersPage: 4 address inputs, union section, apprenticeship conditional section, edit form updates + PayrollWeekDetailPage: per-worker classification override dropdown + query key updates |

The split is clean: Plan 01 has zero React changes; Plan 02 has zero migration/service
changes. This minimizes merge conflicts and allows Plan 01 to be verified via API calls
before the UI is touched.

---

## Validation Architecture

`nyquist_validation` key is absent from `.planning/config.json` — treat as enabled.

**Test framework status:** No `src/**/*.test.ts` files exist in this project. All
validation is integration-tested by running the app and exercising routes manually.

### Phase Requirements → Validation Map

| Req ID | Behavior | Validation Method |
|--------|----------|-------------------|
| WORKER-01 | 4 address columns exist post-migration; backfill fills `address_street` | `SELECT address_street, address FROM workers LIMIT 5` in SQLite shell after migration; WorkersPage shows 4 address inputs |
| WORKER-02 | `union_local` + `union_book_number` columns exist; API accepts/returns them | POST worker with `unionLocal`; GET and verify returned; WorkersPage union section renders |
| WORKER-03 | Apprenticeship fields exist; section shows only for apprentice workers | POST worker with apprentice classification; edit form should show apprenticeship section |
| WORKER-04 | `payroll_week_classifications` table created; override persists; WH-347 uses it | POST override; GET entries for week and verify tradeDescription matches override; download WH-347 and confirm |
| NFR-01 | Migration uses `--> statement-breakpoint` separator | Code review of `0022_worker_profile_depth.sql` |
| NFR-05 | schema.ts matches migration columns | TypeScript compilation: `tsc --noEmit` passes with zero errors |

### Wave 0 Gaps

- [ ] No automated test files for worker routes — manual verification via curl/Postman
  against the running server at port 4099 is the project's validation pattern
- [ ] `tsc --noEmit` — TypeScript type-check is the automated gate for Plan 01 and Plan 02

---

## Environment Availability

Step 2.6: SKIPPED — Phase 39 is purely code/config/schema changes. No external
dependencies beyond the existing Node.js + SQLite stack.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `src/server/db/schema.ts` — workers table exact column list confirmed
- Direct inspection of `src/server/services/workerService.ts` — service input types confirmed
- Direct inspection of `src/server/routes/workers.ts` — Zod schemas and route handlers confirmed
- Direct inspection of `src/server/routes/export.ts` — WH-347 assembly confirmed; worker `address` NOT used in WH-347 worker grid
- Direct inspection of `src/server/services/wh347Generator.ts` — WH-347 field map and Wh347WorkerRow interface confirmed (no address column in worker grid)
- Direct inspection of `src/server/services/payrollService.ts` — `getPayrollEntries` and `getPayrollEntriesWithWorkerDetails` queries confirmed; `workerAddress: workers.address` used in CA eCPR/WA generator join
- Direct inspection of `src/client/pages/WorkersPage.tsx` — form structure, blankWorkerForm, workerToEditForm, edit form rendering confirmed
- Direct inspection of `src/server/db/migrations/0021_audit_logs.sql` — NFR-01 statement-breakpoint syntax confirmed
- Direct inspection of `src/server/db/migrations/meta/_journal.json` — current highest idx = 17 confirmed
- Direct inspection of `.planning/REQUIREMENTS.md` — WORKER-01 through WORKER-04, NFR-01, NFR-05 confirmed
- Direct inspection of `CLAUDE.md` — add-only migration policy and journal registration requirement confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries required; all existing
- Architecture patterns: HIGH — sourced from direct code inspection
- Migration strategy: HIGH — confirmed against CLAUDE.md constraints and existing migration examples
- Pitfalls: HIGH — derived from direct code inspection of all touch points
- WORKER-04 override query design: MEDIUM — Drizzle LEFT JOIN with coalesce is the right approach but the exact query syntax needs to be verified against installed Drizzle version during implementation

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable stack; no external dependencies)
