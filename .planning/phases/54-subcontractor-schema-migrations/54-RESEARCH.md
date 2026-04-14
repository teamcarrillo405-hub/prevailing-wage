# Phase 54: Subcontractor Schema + Migrations — Research

**Researched:** 2026-04-13
**Domain:** Drizzle ORM SQLite schema + manual migration files
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-01 | `subcontractors` table: UUID PK, projectId FK → projects CASCADE DELETE, name NOT NULL, licenseNumber, contactName, contactEmail, address, createdAt | Migration pattern confirmed from 0027_payroll_provider_mappings.sql; Drizzle schema pattern confirmed from existing tables |
| SUB-02 | `subcontractor_cpr_weeks` table: UUID PK, subcontractorId FK → subcontractors CASCADE DELETE, weekEndingDate NOT NULL, receivedDate, isCompliant integer, notes, createdAt; UNIQUE(subcontractorId, weekEndingDate) | Inline UNIQUE constraint + CREATE UNIQUE INDEX patterns both confirmed from codebase |
| NFR-01 | All new Drizzle migrations use `--> statement-breakpoint` (one space) separator between SQL statements; single-statement migrations need no separator | Confirmed from every multi-statement migration reviewed |
</phase_requirements>

---

## Summary

Phase 54 creates two new tables in the SQLite database: `subcontractors` and `subcontractor_cpr_weeks`. This is a pure schema phase — no routes, no UI. The deliverables are: (1) two new Drizzle table definitions appended to `schema.ts`, (2) a single new migration SQL file, and (3) a new entry in `meta/_journal.json`.

The codebase has a well-established pattern for both CREATE TABLE migrations and for registering them in the journal. The highest-risk item is the journal registration: the last entry is idx 27 (tag `0031_nj_deductions`), so the new entry must be idx 28. Drizzle silently skips migration files not registered in `_journal.json` — this is a known pitfall documented in CLAUDE.md.

Two tables go into one migration file (matching the 0017/0021/0022 pattern where multiple CREATE TABLE or mixed DDL goes in a single file with `statement-breakpoint` separators). No backfill is needed because both tables are new (no existing rows). No snapshot files are required — the project does not maintain per-migration snapshots beyond idx 2.

**Primary recommendation:** Write one SQL file (`0032_subcontractor_schema.sql`) with two CREATE TABLE statements separated by `-->·statement-breakpoint`, register it as idx 28 in `_journal.json`, and add two `sqliteTable` exports to `schema.ts`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 (installed) | ORM + schema definitions | Already in project; all tables use it |
| better-sqlite3 | ^12.8.0 (installed) | SQLite driver | Already in project; used by migrator |

No new packages are required for this phase.

**Installation:** None needed.

---

## Architecture Patterns

### Recommended Project Structure

This phase touches two files plus one new file:

```
src/server/db/
├── schema.ts                          # Append two new sqliteTable exports
└── migrations/
    ├── 0032_subcontractor_schema.sql  # New migration file
    └── meta/
        └── _journal.json              # Add idx 28 entry
```

### Pattern 1: CREATE TABLE Migration with Inline UNIQUE Constraint

The preferred pattern for a single-table migration with a UNIQUE constraint is the inline approach (matching `0027_payroll_provider_mappings.sql`):

```sql
-- Source: src/server/db/migrations/0027_payroll_provider_mappings.sql
CREATE TABLE payroll_provider_mappings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_worker_id TEXT NOT NULL,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, provider, provider_worker_id)
);
```

For Phase 54, with two tables, the two CREATE TABLE statements are separated by a `statement-breakpoint`:

```sql
CREATE TABLE subcontractors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  license_number TEXT,
  contact_name TEXT,
  contact_email TEXT,
  address TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE subcontractor_cpr_weeks (
  id TEXT PRIMARY KEY,
  subcontractor_id TEXT NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  week_ending_date TEXT NOT NULL,
  received_date TEXT,
  is_compliant INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (subcontractor_id, week_ending_date)
);
```

**Key observations:**
- `is_compliant` uses bare `INTEGER` (no default, no NOT NULL) — matches how nullable boolean columns are stored in this codebase (e.g., `is_final` is `INTEGER` in the DB)
- `week_ending_date` is `TEXT NOT NULL` — ISO 8601 date string, matching the established `weekEndingDate` pattern on `payroll_weeks`
- No `updatedAt` on either table — REQUIREMENTS.md spec does not include it; matches simpler tables like `payrollImports` and `payrollProviderMappings`

### Pattern 2: Drizzle Schema Definition for New Tables

New table exports follow the `sqliteTable` pattern with a table-level callback for constraints:

```typescript
// Source: src/server/db/schema.ts — payrollProviderMappings as model
export const subcontractors = sqliteTable('subcontractors', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  licenseNumber: text('license_number'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  address: text('address'),
  createdAt: text('created_at').notNull(),
});

export const subcontractorCprWeeks = sqliteTable('subcontractor_cpr_weeks', {
  id: text('id').primaryKey(),
  subcontractorId: text('subcontractor_id').notNull().references(() => subcontractors.id, { onDelete: 'cascade' }),
  weekEndingDate: text('week_ending_date').notNull(),
  receivedDate: text('received_date'),
  isCompliant: integer('is_compliant'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  subCprWeekUnique: uniqueIndex('sub_cpr_week_unique').on(table.subcontractorId, table.weekEndingDate),
}));
```

**Key observations:**
- `isCompliant` uses `integer('is_compliant')` with no `.notNull()` and no `{ mode: 'boolean' }` — it is a tri-state column (null = unknown, 0 = non-compliant, 1 = compliant). Using `{ mode: 'boolean' }` would coerce null to false, losing the "not assessed" state. The REQUIREMENTS.md spec says `integer` not `integer({ mode: 'boolean' })`.
- The UNIQUE constraint on `subcontractor_cpr_weeks` uses `uniqueIndex()` (not `index()`) because uniqueness must be enforced. This matches `payrollProviderMappings` (providerMappingUnique), `payrollEntries` (payrollEntryUnique), and `payrollWeekClassifications` (pwcUnique).
- Import: `uniqueIndex` is already imported in `schema.ts` — no new import needed.

### Pattern 3: Journal Registration

The current last entry in `_journal.json`:
```json
{
  "idx": 27,
  "version": "7",
  "when": 1744329600000,
  "tag": "0031_nj_deductions",
  "breakpoints": true
}
```

The new entry must be:
```json
{
  "idx": 28,
  "version": "7",
  "when": <unix-ms-timestamp>,
  "tag": "0032_subcontractor_schema",
  "breakpoints": true
}
```

The `when` value must be a Unix timestamp in milliseconds. Convention from recent entries: use a round number approximately one day after the previous entry (1744329600000 + 86400000 = 1744416000000 is a clean choice).

### Anti-Patterns to Avoid

- **Using `integer({ mode: 'boolean' })` for `isCompliant`:** Would coerce null to false. The column intentionally has three states (null/0/1). Use bare `integer('is_compliant')`.
- **Creating a separate migration file per table:** All prior multi-DDL phases put related statements in one file. Two tables for the same feature belong in one file.
- **Omitting `statement-breakpoint` between two CREATE TABLE statements:** SQLite itself executes both fine, but Drizzle's migrator in breakpoints mode parses on this separator. Without it, the second statement may not be applied correctly.
- **Using `CREATE UNIQUE INDEX` as a separate statement instead of inline UNIQUE:** Both work. The inline UNIQUE approach (used in 0027) is cleaner for single-column or simple multi-column constraints. The Drizzle schema must still use `uniqueIndex()` in the table callback regardless — the SQL and schema are independent declarations.
- **Forgetting to export the new table from schema.ts:** Drizzle's `getDb()` returns a db instance typed with the schema. If the table is not exported from `schema.ts`, TypeScript queries against it will fail.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for new rows | Custom UUID function | `crypto.randomUUID()` | Already used in all route files (Phase 39 decision) |
| Migration application | Custom SQL runner | Drizzle `migrate()` via startup | Already wired in `db/index.ts` |
| Unique constraint enforcement | Application-layer duplicate check | SQL `UNIQUE` clause | DB enforces atomically; app-layer check has TOCTOU race |

---

## Runtime State Inventory

This is a greenfield schema phase — no tables being renamed, no existing data being migrated. Both tables are new.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — both tables are new | None |
| Live service config | None — no external services reference these table names | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars | None |
| Build artifacts | None — no compiled artifacts reference these tables yet | None |

---

## Common Pitfalls

### Pitfall 1: Journal Not Updated (Silent Migration Skip)
**What goes wrong:** Migration file exists in `src/server/db/migrations/` but is not in `_journal.json`. Drizzle's migrator silently skips it on startup. The tables are never created. Routes in Phase 55 get "no such table: subcontractors" errors at runtime.
**Why it happens:** Drizzle-kit generates both the SQL file and the journal entry when you run `db:generate`. Manual migrations skip this step.
**How to avoid:** Always add the journal entry as part of the same commit as the SQL file. Verify post-migration with `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('subcontractors', 'subcontractor_cpr_weeks')`.
**Warning signs:** Server starts without error but `GET /api/projects/:id/subcontractors` returns 500 with "no such table".

### Pitfall 2: Wrong `statement-breakpoint` Separator Format
**What goes wrong:** Using `-->statement-breakpoint` (no space) or `-- > statement-breakpoint` (space in wrong place). Drizzle's parser uses exactly `--> statement-breakpoint` (one space after `-->`).
**Why it happens:** Typo, editor auto-formatting, or copy from an alternate source.
**How to avoid:** NFR-01 in REQUIREMENTS.md states one space. Every migration in this codebase uses this exact format. Copy from an existing multi-statement migration.
**Warning signs:** Only the first statement in the migration runs; subsequent tables silently not created.

### Pitfall 3: `isCompliant` Modeled as Boolean in Drizzle
**What goes wrong:** Using `integer('is_compliant', { mode: 'boolean' })` converts null to false in Drizzle's deserialization. The "not yet assessed" state (null) becomes indistinguishable from "assessed as non-compliant" (0/false).
**Why it happens:** Other boolean columns in the schema use `{ mode: 'boolean' }`. It's tempting to apply it uniformly.
**How to avoid:** Use bare `integer('is_compliant')` — no mode. The Phase 55 route layer will handle null/0/1 values explicitly.
**Warning signs:** Newly-created CPR week records with null isCompliant show as "false" in API responses.

### Pitfall 4: idx Value Collision in Journal
**What goes wrong:** New entry uses an idx other than 28, or a `when` timestamp earlier than the last entry's timestamp (1744329600000).
**Why it happens:** Miscounting existing entries (27 entries, next is 28 not 27).
**How to avoid:** Count the last entry's idx (27) and increment by 1. Use a `when` value >= 1744329600000.
**Warning signs:** Drizzle migrator may re-apply or skip migrations depending on the collision type.

---

## Code Examples

### Complete Migration SQL (`0032_subcontractor_schema.sql`)

```sql
CREATE TABLE subcontractors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  license_number TEXT,
  contact_name TEXT,
  contact_email TEXT,
  address TEXT,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE subcontractor_cpr_weeks (
  id TEXT PRIMARY KEY,
  subcontractor_id TEXT NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  week_ending_date TEXT NOT NULL,
  received_date TEXT,
  is_compliant INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (subcontractor_id, week_ending_date)
);
```

### Journal Entry to Append

```json
{
  "idx": 28,
  "version": "7",
  "when": 1744416000000,
  "tag": "0032_subcontractor_schema",
  "breakpoints": true
}
```

### Drizzle Schema Additions (`schema.ts`)

```typescript
// ── Phase 54: Subcontractor Tracking ──────────────────────────────────────
// subcontractors is project-scoped; subs may have different contacts/licenses
// per project. assertProjectAccess scopes access via projectId.
export const subcontractors = sqliteTable('subcontractors', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  licenseNumber: text('license_number'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  address: text('address'),
  createdAt: text('created_at').notNull(),
});

// Tracks weekly CPR receipt and compliance status per sub per calendar week.
// weekEndingDate is a text ISO 8601 date — NOT a FK to payrollWeeks.
// UNIQUE(subcontractorId, weekEndingDate) enforced at DB level.
export const subcontractorCprWeeks = sqliteTable('subcontractor_cpr_weeks', {
  id: text('id').primaryKey(),
  subcontractorId: text('subcontractor_id').notNull().references(() => subcontractors.id, { onDelete: 'cascade' }),
  weekEndingDate: text('week_ending_date').notNull(),
  receivedDate: text('received_date'),
  isCompliant: integer('is_compliant'),   // null=unknown, 0=non-compliant, 1=compliant
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  subCprWeekUnique: uniqueIndex('sub_cpr_week_unique').on(table.subcontractorId, table.weekEndingDate),
}));
```

### Post-Migration Verification Query

```sql
-- Run against the dev DB after applying migration to verify both tables exist
SELECT name, sql FROM sqlite_master
WHERE type = 'table'
  AND name IN ('subcontractors', 'subcontractor_cpr_weeks')
ORDER BY name;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `drizzle-kit generate` + auto snapshot | Manual SQL + manual journal entry | v1.0 convention | Requires manual idx/when management but gives full control over SQL |
| Separate UNIQUE index statement | Inline `UNIQUE(...)` in CREATE TABLE | Phase 27 pattern | Fewer breakpoints needed; simpler migration |

**No deprecated patterns identified** for this phase type.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is code/config-only changes to SQLite schema files).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (configured in `vitest.config.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

The test setup file `tests/helpers/db.ts` runs `migrate(db, { migrationsFolder: './src/server/db/migrations' })` against an in-memory SQLite DB in `beforeAll`. This means the new migration file is automatically exercised by every test run — if the migration SQL has a syntax error, all tests fail.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUB-01 | `subcontractors` table exists with correct columns after migration | integration (via test DB setup) | `npm test` | N/A — covered by global db.ts setup |
| SUB-02 | `subcontractor_cpr_weeks` table exists; UNIQUE constraint enforced | integration (via test DB setup) | `npm test` | N/A — covered by global db.ts setup |
| NFR-01 | `statement-breakpoint` separator present in multi-statement migration | code review / SQL syntax check | `npm test` (migration runs) | N/A |

**Key insight:** Because `tests/helpers/db.ts` is the global `setupFiles` for all tests, any migration syntax error immediately breaks the entire test suite. This provides automatic validation that both CREATE TABLE statements are syntactically correct and that the journal entry is registered. No separate schema test file is needed for Phase 54.

### Sampling Rate

- **Per task commit:** `npm test` (full suite — all tests share the migrated in-memory DB)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure (global db setup + migration runner) covers all Phase 54 requirements automatically.

---

## Project Constraints (from CLAUDE.md)

- **Migration files:** Plain SQL in `src/server/db/migrations/` — add-only, never drop or rename columns
- **Journal registration:** Always register in `meta/_journal.json` — Drizzle silently skips files not in the journal
- **UUID generation:** Use `crypto.randomUUID()` — not the `uuid` package (Phase 39 decision)
- **`statement-breakpoint` format:** `--> statement-breakpoint` (one space) between SQL statements; single-statement migrations need no separator (NFR-01)
- **No hard deletes on compliance data** — not applicable to new tables, but CASCADE DELETE on projectId is intentional (project deletion already subject to separate access control)
- **`assertProjectAccess` guard** — applies to routes (Phase 55), not schema; noted for planner awareness

---

## Open Questions

1. **Should `subcontractors` have an `updatedAt` column?**
   - What we know: REQUIREMENTS.md SUB-01 spec lists `(id, projectId, name, licenseNumber, contactName, contactEmail, address, createdAt)` — no `updatedAt`
   - What's unclear: Phase 55 will need PATCH routes; without `updatedAt`, there's no mutation timestamp
   - Recommendation: Follow the spec exactly (no `updatedAt`) for Phase 54; Phase 55 can assess whether it's needed at route time. Tables like `payrollImports` and `payrollProviderMappings` also omit `updatedAt` — it is not universal in this codebase.

2. **Should `subcontractorCprWeeks` include an `updatedAt` column?**
   - What we know: REQUIREMENTS.md SUB-02 spec does not include it
   - Recommendation: Omit per spec. CPR week rows are created and patched (receivedDate, isCompliant, notes can change), but `updatedAt` is not in the spec and the PATCH route can omit it since the UNIQUE constraint identifies the row.

---

## Sources

### Primary (HIGH confidence)

- `src/server/db/schema.ts` — all existing table definitions; confirms Drizzle DSL patterns, column types, FK syntax
- `src/server/db/migrations/meta/_journal.json` — confirms current last idx is 27, version "7", breakpoints true pattern
- `src/server/db/migrations/0027_payroll_provider_mappings.sql` — CREATE TABLE + inline UNIQUE pattern (single table, no breakpoint needed)
- `src/server/db/migrations/0017_project_members.sql` — multi-statement migration with `statement-breakpoint`; backfill pattern
- `src/server/db/migrations/0022_worker_profile_depth.sql` — mixed ALTER TABLE + CREATE TABLE in one file
- `src/server/db/migrations/0021_audit_logs.sql` — CREATE TABLE + CREATE INDEX with breakpoints
- `tests/helpers/db.ts` — confirms migration-based test DB setup
- `vitest.config.ts` — confirms `setupFiles` wires db.ts for all tests
- `CLAUDE.md` (project) — migration conventions, journal requirement, UUID pattern
- `.planning/REQUIREMENTS.md` — SUB-01, SUB-02, NFR-01 specs (verbatim column lists)
- `.planning/STATE.md` — locked decisions: per-project sub model, weekEndingDate as text not FK, two-table model non-negotiable

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` — Phase 54 scope confirmation (sub schema before routes/UI)

---

## Metadata

**Confidence breakdown:**
- Migration SQL syntax: HIGH — directly derived from existing migration files in the repo
- Journal registration: HIGH — current state confirmed by reading `_journal.json`
- Drizzle schema DSL: HIGH — directly derived from existing `schema.ts`
- isCompliant column type: HIGH — explicitly locked in STATE.md ("integer" per REQUIREMENTS.md SUB-02 spec)
- Test validation: HIGH — db.ts setup file auto-exercises all migrations

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable — SQLite + Drizzle patterns are not fast-moving)
