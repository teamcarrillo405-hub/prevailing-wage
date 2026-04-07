# Phase 44: Import Provider Foundation - Research

**Researched:** 2026-04-06
**Domain:** Payroll CSV import pipeline — provider detection, Gusto parser, `payroll_provider_mappings` table, UI integration
**Confidence:** HIGH

---

## Summary

Phase 44 extends the existing QB/ADP import pipeline (built in Phases 35–36) to support Gusto, Paychex, Sage 300, and establishes a persistent mapping table for providers that use opaque worker IDs rather than names. The pipeline is well-structured: a single `detectProvider()` function in `importService.ts` drives everything, and the import modal in `PayrollWeekDetailPage.tsx` is a 3-step flow (file upload → preview/review → confirm). Every new provider follows the same mapper contract — a function that returns `Map<string, { csvName, monSt … sunOt }>`.

The migration situation is clear: the journal max idx is 22 (tag `0026_il_idol_submission`), so the new migration is `0027_payroll_provider_mappings.sql` at idx 23. This phase adds a single `CREATE TABLE` statement — no `ADD COLUMN` breakpoints are needed (breakpoints are only required between multiple statements in the same file). A CREATE TABLE + a UNIQUE INDEX would need one breakpoint between them.

The `provider` field in `payroll_provider_mappings` should use string literals matching the enum: `"QB"`, `"ADP"`, `"GUSTO"`, `"PAYCHEX"`, `"SAGE_300"`. The existing `payrollImports.provider` column is typed `'quickbooks' | 'adp'` and will need expansion.

**Primary recommendation:** Mirror the `adpMapper.ts` pattern exactly for `gustoMapper.ts`. Extend `detectProvider()` and `ImportPreviewResult.provider` union type. Add provider badge strings for all five providers. Persist mappings in `payroll_provider_mappings` keyed by `(projectId, provider, providerWorkerId)`.

---

## Project Constraints (from CLAUDE.md)

- **Never hard-delete** projects or payroll weeks — 3-year records retention requirement.
- **Migrations are plain SQL** in `src/server/db/migrations/`. Always register in `meta/_journal.json`. The `idx` field must be sequential.
- **Never drop or rename columns** — add-only migrations.
- **NFR-01:** Multi-statement migration files use `--> statement-breakpoint` separator between statements.
- **NFR-05:** Every new migration file has a corresponding `schema.ts` update.
- **Design tokens:** All styling through TailwindCSS v4 `@theme` tokens — no hardcoded hex values.
- **UI primitives:** `Card`, `Button`, `Badge`, `PageHeader` from `src/client/components/ui/`.
- **`Badge` variants:** `compliant`, `violation`, `warning`, `neutral` only.
- **`useRef` for sync guards** (double-click prevention) — `useState` is async.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-04 | Create `payroll_provider_mappings` table: `(id, projectId, provider, providerWorkerId, workerId, createdAt)`. Stores user-confirmed link between a provider's worker ID and our internal worker. Mappings persist across imports. | Migration 0027, schema.ts addition, Drizzle table definition with uniqueIndex on (projectId, provider, providerWorkerId). |
| IMPORT-01 | Gusto CSV parser: detect by `Employee first name` + `Employee last name`. Concatenate to "First Last". Parse `Regular hours` and `Overtime hours` as decimals. Parse `Payroll end date` (MM/DD/YYYY). `Double overtime hours` → OT bucket if present. Error if required columns missing. | New `gustoMapper.ts` following adpMapper.ts pattern; extended `detectProvider()` in importService.ts. |
| IMPORT-06 | Auto-detect provider type from CSV column signatures during preview parse. Show provider badge (Gusto/Paychex/Sage/QB/ADP) in Step 2 header. For Paychex/Sage 300, insert ID mapping step. For Gusto, proceed directly to matched/unmatched table. | Extend `detectProvider()` return type. Update `ImportPreviewResult.provider`. Update Step 2 badge rendering in PayrollWeekDetailPage.tsx. |
| NFR-01 | Migrations use `--> statement-breakpoint` separator. | Migration 0027 has one CREATE TABLE + one CREATE UNIQUE INDEX → needs one breakpoint between them. |
| NFR-05 | New migration files have corresponding schema.ts update. | Add `payrollProviderMappings` table export to schema.ts. Update `payrollImports.provider` type union. |
</phase_requirements>

---

## Pipeline Architecture

### Full Flow (existing, from Phases 35–36)

```
CSV Upload (multipart)
    │
    ▼
POST /api/payroll/import/preview   (src/server/routes/import.ts)
    │   multer memory storage, 5 MB limit, CSV MIME types only
    │
    ▼
parseImportFile(buffer, weekId, projectId, db)   (importService.ts)
    │   1. Papa.parse → headers + rows
    │   2. detectProvider(headers) → 'quickbooks' | 'adp' | 'unknown'
    │   3. DB: fetch weekEndingDate for weekId
    │   4. mapQbRows() or mapAdpRows() → Map<key, day-bucket>
    │   5. DB: fetch active workers + classifications for project
    │   6. DB: fetch wage classifications for rate snapshot
    │   7. Build nameLookup: lowercase name → WorkerRow
    │   8. DB: fetch existing payrollEntries → conflictSet
    │   9. Bucket CSV entries → matched[] / unmatched[] / conflicts[]
    │
    ▼
ImportPreviewResult {provider, weekId, matched[], unmatched[], conflicts[]}
    │
    ▼ (client: PayrollWeekDetailPage.tsx, importStep → 2)
Step 2 UI: provider badge, ADP banner, conflict panel, matched table, unmatched remap dropdowns
    │
    ▼ (importStep → 3)
Step 3 UI: confirm summary — checked matched + remapped unmatched
    │
    ▼
POST /api/payroll/import/commit   (import.ts route)
    │   body: {weekId, provider, matched: ImportedRow[], unmatchedCount, sourceFilename}
    │   re-validates conflicts server-side
    │   inserts payrollEntries rows
    │   inserts payrollImports audit row
    │   best-effort audit log
    │
    ▼
{committed: N}
```

### File Map

| File | Role |
|------|------|
| `src/server/routes/import.ts` | Express router: POST /preview + POST /commit |
| `src/server/services/importService.ts` | Orchestrator: detectProvider, parseImportFile |
| `src/server/services/importTypes.ts` | Shared types: ImportedRow, UnmatchedRow, ConflictRow, ImportPreviewResult |
| `src/server/services/qbMapper.ts` | QB Desktop + QB Online CSV → day-bucket map |
| `src/server/services/adpMapper.ts` | ADP Run CSV → day-bucket map (weekly totals on Monday) |
| `src/server/db/schema.ts` | Drizzle schema — payrollImports, (new) payrollProviderMappings |
| `src/client/pages/PayrollWeekDetailPage.tsx` | 3-step import modal UI (~line 2383–2700) |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | existing | CSV parsing (already imported in importService.ts) | Already in use — `Papa.parse` with `header: true, skipEmptyLines: true, transformHeader: (h) => h.trim()` |
| drizzle-orm | existing | ORM for SQLite inserts/queries | Already in use for all DB operations |
| better-sqlite3 | existing | SQLite driver | Already in use |

No new npm dependencies are needed for this phase.

**Installation:** none required.

---

## Architecture Patterns

### Recommended Project Structure (additions for this phase)

```
src/server/services/
├── importService.ts          # extend detectProvider(), extend parseImportFile()
├── importTypes.ts            # extend ImportPreviewResult.provider union
├── qbMapper.ts               # unchanged
├── adpMapper.ts              # unchanged
└── gustoMapper.ts            # NEW — follows adpMapper.ts pattern exactly

src/server/db/
├── schema.ts                 # add payrollProviderMappings table; update payrollImports.provider type
└── migrations/
    ├── 0027_payroll_provider_mappings.sql  # NEW
    └── meta/_journal.json                  # add idx 23 entry
```

### Pattern 1: Provider Mapper Contract

Every provider mapper must return this shape (established by qbMapper and adpMapper):

```typescript
// Source: src/server/services/adpMapper.ts (verified)
export function mapXxxRows(
  rows: Record<string, string>[],
): { entries: Map<string, XxxAggregated>; xxxWeeklyTotalsOnly?: true } {
  const entries = new Map<string, XxxAggregated>();
  // ... process rows ...
  return { entries };
}
```

Map key: `csvName.toLowerCase()`. Map value has `csvName` (original case) + 14 day-bucket fields.

### Pattern 2: detectProvider() Extension

Current signature:
```typescript
// Source: src/server/services/importService.ts (verified)
export function detectProvider(headers: string[]): 'quickbooks' | 'adp' | 'unknown'
```

Extended signature for this phase:
```typescript
export function detectProvider(
  headers: string[]
): 'quickbooks' | 'adp' | 'gusto' | 'paychex' | 'sage_300' | 'unknown'
```

Detection order matters — check most-specific signatures first. Gusto has unique columns that won't conflict.

Gusto signature columns (exact, case-insensitive after trim):
- `Employee first name`
- `Employee last name`
- `Regular hours`
- `Payroll end date`

### Pattern 3: Gusto Mapper

Gusto is a weekly-totals-only format (like ADP) — no daily breakdown. Hours go on Monday.

```typescript
// src/server/services/gustoMapper.ts — pattern to follow
const REQUIRED_COLS = [
  'Employee first name',
  'Employee last name',
  'Regular hours',
  'Payroll end date',
] as const;

const OPTIONAL_OT = 'Overtime hours';
const OPTIONAL_DOT = 'Double overtime hours';

export function mapGustoRows(
  rows: Record<string, string>[],
): { entries: Map<string, GustoAggregated>; gustoWeeklyTotalsOnly: true } {
  // Validate required columns from first non-empty row
  // (papaparse header: true means headers are already parsed as keys)
  // ...
  // Concatenate: `${firstName} ${lastName}`.trim()
  // Parse Regular hours + Overtime hours as parseFloat (|| 0)
  // Double overtime hours → add to monOt bucket (lump into OT per QB mapper precedent)
  // All hours placed on Monday (weekly totals)
  return { entries, gustoWeeklyTotalsOnly: true };
}
```

**Critical: column validation.** The requirement says "Error if required columns missing." This must be validated inside `mapGustoRows` (throw an Error) OR in `parseImportFile` before calling the mapper. The qbMapper does NOT validate — ADP mapper does NOT validate. For Gusto, the mapper should validate because `parseImportFile` switches on provider before calling the mapper.

```typescript
// Validation pattern — run once before processing rows
const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
const missing = REQUIRED_COLS.filter(
  col => !fields.some(f => f.toLowerCase().trim() === col.toLowerCase())
);
if (missing.length > 0) {
  throw new Error(`Gusto CSV is missing required columns: ${missing.join(', ')}`);
}
```

### Pattern 4: ImportPreviewResult.provider Union

Current in `src/server/services/importTypes.ts`:
```typescript
// Source: importTypes.ts (verified)
export interface ImportPreviewResult {
  provider: 'quickbooks' | 'adp';
  // ...
}
```

Must be extended to:
```typescript
export type ImportProvider =
  | 'quickbooks'
  | 'adp'
  | 'gusto'
  | 'paychex'
  | 'sage_300';

export interface ImportPreviewResult {
  provider: ImportProvider;
  // ...
  gustoWeeklyTotalsOnly?: boolean;  // analogous to adpWeeklyTotalsOnly
}
```

The client-side `ImportPreviewResult` interface in `PayrollWeekDetailPage.tsx` (line ~139) mirrors this and must be updated in sync.

### Pattern 5: Provider Badge in Step 2

Current badge rendering (line ~2440–2444):
```typescript
// Source: PayrollWeekDetailPage.tsx line 2440 (verified)
<Badge variant="neutral">
  {importPreview.provider === 'quickbooks' ? 'QuickBooks' : 'ADP'}
</Badge>
```

Must be updated to a label map:
```typescript
const PROVIDER_LABELS: Record<string, string> = {
  quickbooks: 'QuickBooks',
  adp: 'ADP Run',
  gusto: 'Gusto',
  paychex: 'Paychex',
  sage_300: 'Sage 300',
};
// Usage:
<Badge variant="neutral">
  {PROVIDER_LABELS[importPreview.provider] ?? importPreview.provider}
</Badge>
```

### Pattern 6: payrollProviderMappings Drizzle Table

Follow `payrollImports` table pattern (lines 269–278 in schema.ts):

```typescript
// Source: schema.ts pattern (verified)
export const payrollProviderMappings = sqliteTable('payroll_provider_mappings', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerWorkerId: text('provider_worker_id').notNull(),
  workerId: text('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  providerMappingUnique: uniqueIndex('provider_mapping_unique').on(
    table.projectId,
    table.provider,
    table.providerWorkerId,
  ),
}));
```

### Anti-Patterns to Avoid

- **Do NOT call `new Date(string)` on CSV date strings.** QB mapper uses `parseQbDate()` with manual split — Gusto must do the same for `Payroll end date` (MM/DD/YYYY). Timezone parsing with `new Date("03/29/2025")` is unreliable across environments.
- **Do NOT add breakpoints in single-statement migration.** `0026_il_idol_submission.sql` has one `ALTER TABLE` and no breakpoints. For `0027_payroll_provider_mappings.sql`, if it has `CREATE TABLE` + `CREATE UNIQUE INDEX`, one breakpoint is needed between them. If the UNIQUE INDEX is expressed as a table constraint (inline), no breakpoint is needed.
- **Do NOT reuse `adpWeeklyTotalsOnly` flag for Gusto.** Gusto gets its own `gustoWeeklyTotalsOnly` flag in `ImportPreviewResult` to allow provider-specific UI messaging.
- **Do NOT skip journal registration.** CLAUDE.md states: "Drizzle silently skips files not in the journal."

---

## Migration Details

### Journal State (verified)

Current max: `idx: 22`, tag `"0026_il_idol_submission"`.

New entry to add:
```json
{
  "idx": 23,
  "version": "7",
  "when": <timestamp>,
  "tag": "0027_payroll_provider_mappings",
  "breakpoints": true
}
```

### Migration File: `0027_payroll_provider_mappings.sql`

This is a **CREATE TABLE** (not ADD COLUMN). The table has a unique index. Two approaches:

**Option A — Inline UNIQUE constraint (no breakpoint needed, preferred):**
```sql
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

**Option B — Separate CREATE UNIQUE INDEX (requires one breakpoint):**
```sql
CREATE TABLE payroll_provider_mappings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_worker_id TEXT NOT NULL,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX provider_mapping_unique ON payroll_provider_mappings (project_id, provider, provider_worker_id);
```

**Recommendation: Option A** — inline UNIQUE constraint is simpler and avoids the breakpoint. Drizzle generates the unique index from the Drizzle `uniqueIndex()` call in schema.ts at runtime (for migrations generated by Drizzle Kit). Since this is a hand-written migration (project pattern), inline UNIQUE constraint is canonical.

**NFR-01 compliance:** If Option A, no breakpoint needed (single statement). If Option B, one breakpoint is correct between the two statements.

---

## `payrollProviderMappings` Schema (confirmed)

| Column | SQL Type | Drizzle | Notes |
|--------|----------|---------|-------|
| `id` | TEXT PRIMARY KEY | `text('id').primaryKey()` | `randomUUID()` at insert |
| `project_id` | TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE | `text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' })` | Cascade delete when project deleted |
| `provider` | TEXT NOT NULL | `text('provider').notNull()` | String literal enum: `"gusto"`, `"paychex"`, `"sage_300"`, `"quickbooks"`, `"adp"` |
| `provider_worker_id` | TEXT NOT NULL | `text('provider_worker_id').notNull()` | Opaque ID from provider CSV (e.g. Paychex employee ID) |
| `worker_id` | TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE | `text('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' })` | Internal worker ID |
| `created_at` | TEXT NOT NULL | `text('created_at').notNull()` | ISO 8601 string |

**Unique constraint:** `(project_id, provider, provider_worker_id)` — one mapping per provider worker per project.

**No `updatedAt`** — mappings are immutable after creation (delete + re-create if wrong). Matches `payrollImports` pattern which also has no `updatedAt`.

---

## Gusto CSV Parser Spec (IMPORT-01)

### Column Names (exact, case-sensitive as Gusto exports them)
| Column | Use | Required |
|--------|-----|---------|
| `Employee first name` | First name | Yes |
| `Employee last name` | Last name | Yes |
| `Regular hours` | ST hours → monSt | Yes |
| `Overtime hours` | OT hours → monOt | Yes |
| `Payroll end date` | Date string MM/DD/YYYY (for future use / validation) | Yes |
| `Double overtime hours` | DT hours → add to monOt bucket | No (optional) |

### Name Assembly
```typescript
const csvName = `${firstName} ${lastName}`.trim();
// Key: csvName.toLowerCase()
```
This matches the ADP pattern exactly (`${firstName} ${lastName}`).

### Hour Parsing
```typescript
const regHours = parseFloat(row['Regular hours'] ?? '0') || 0;
const otHours = parseFloat(row['Overtime hours'] ?? '0') || 0;
const dotHours = parseFloat(row['Double overtime hours'] ?? '0') || 0;

entry.monSt += regHours;
entry.monOt += otHours + dotHours;  // Double OT goes into OT bucket
```

### Date Parsing (for validation only — not needed for hour bucketing)
```typescript
// NEVER new Date(dateStr) — timezone unreliable
function parseGustoDate(dateStr: string): Date {
  const [month, day, year] = dateStr.trim().split('/').map(Number);
  return new Date(year, month - 1, day); // local time, midnight
}
```
Pattern copied from `parseQbDate` in qbMapper.ts.

### Error Handling
Throw inside `mapGustoRows` if required columns are missing. `parseImportFile` catches and returns 400.

---

## Provider Detection Pattern (IMPORT-06)

### Existing Signatures
```typescript
// Source: importService.ts (verified)
const QB_SIGNATURES = [
  ['Employee', 'Duration'],       // QB Desktop
  ['Employee Name', 'Hours'],     // QB Online
];
const ADP_SIGNATURE = ['Co Code', 'File #'];
```

### New Signatures to Add
```typescript
const GUSTO_SIGNATURE = ['Employee first name', 'Employee last name', 'Regular hours', 'Payroll end date'];
// Paychex and Sage 300 signatures — research note below
```

**Detection order** (most specific first to avoid false positives):
1. Gusto (4-column signature — very specific)
2. ADP (2-column signature)
3. QuickBooks (2-column signatures)
4. Paychex / Sage 300 (when their signatures are known)
5. `'unknown'`

### Open Question: Paychex and Sage 300 Column Signatures

IMPORT-06 mentions Paychex and Sage 300 but IMPORT-01 specifies only Gusto parser implementation. Paychex/Sage 300 parsers are likely in a future phase. For Phase 44:
- Add Gusto detection + Gusto mapper.
- Add Paychex and Sage 300 to the detection return type union for forward compatibility.
- Stub their mapper with a clear `throw new Error('Paychex/Sage 300 parser not yet implemented')` (or simply allow detectProvider to return the provider string and let the switch in parseImportFile throw naturally).

This is the minimal correct approach — extend the type, add Gusto parser, leave Paychex/Sage 300 parsers as stubs that fail gracefully.

---

## UI Integration Points

### Where Provider Badge Lives

File: `src/client/pages/PayrollWeekDetailPage.tsx`, approximately line 2440.

Current:
```tsx
// Source: PayrollWeekDetailPage.tsx ~line 2440 (verified)
<Badge variant="neutral">
  {importPreview.provider === 'quickbooks' ? 'QuickBooks' : 'ADP'}
</Badge>
```

Must become a label map lookup (see Pattern 5 above).

### Where Gusto Weekly Totals Banner Would Live

Immediately below the badge, analogous to the ADP banner at ~line 2448:
```tsx
{importPreview.gustoWeeklyTotalsOnly && (
  <Card padding="sm" className="mt-3 border border-status-warning/30 bg-status-warning/10">
    <p className="text-sm text-status-warning">
      Gusto export does not include daily breakdown. Hours are shown as weekly totals placed on Monday.
    </p>
  </Card>
)}
```

### Where Provider-Specific Steps Would Be Added

IMPORT-06 specifies: "For Paychex/Sage 300, insert ID mapping step." This is NOT in scope for the Gusto parser implementation (IMPORT-01). The ID mapping step would be an intermediate modal step between Step 1 (file upload) and the current Step 2 (review entries). The `payroll_provider_mappings` table is built in this phase precisely to support that future step.

For Phase 44, the client changes are:
1. Update `ImportPreviewResult` interface type in PayrollWeekDetailPage.tsx.
2. Update provider badge to use label map.
3. Add `gustoWeeklyTotalsOnly` banner.
4. No new step added — Gusto goes straight to Step 2 (matched/unmatched table).

### Where Import Button Is

Search for `setShowImportModal(true)` in PayrollWeekDetailPage.tsx — this triggers the modal. The button itself is in the page action area. No changes needed to the trigger.

---

## Provider Enum Values

Based on the existing code and requirements, the canonical string values for the `provider` field are:

| Value | Used In | Provider |
|-------|---------|---------|
| `"quickbooks"` | Existing: `importService.ts`, `importTypes.ts`, `import.ts` route, `payrollImports` schema | QuickBooks Desktop + Online |
| `"adp"` | Existing: same files | ADP Run |
| `"gusto"` | New: this phase | Gusto |
| `"paychex"` | New: type extension this phase, parser future | Paychex |
| `"sage_300"` | New: type extension this phase, parser future | Sage 300 |

Note: `"UNKNOWN"` is the return value from `detectProvider()` but is never stored in the DB (unknown triggers an error before any DB insert). The `payrollImports.provider` column will need its Drizzle `.$type<>()` annotation updated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom CSV tokenizer | `papaparse` (already imported) | Already handles quoting, BOM, empty lines |
| Date parsing | `new Date(string)` | Manual `split('/')` + `new Date(y, m-1, d)` (see parseQbDate) | `new Date("03/29/2025")` is timezone-unreliable in Node |
| Worker name matching | Fuzzy match | Exact lowercase match (existing pattern) | Consistent with existing QB/ADP — no new dependency |

---

## Common Pitfalls

### Pitfall 1: Column Name Case Sensitivity in Gusto Detection
**What goes wrong:** Gusto headers may have inconsistent casing depending on export settings. Detection uses `.toLowerCase()` comparison but the column map must also normalize when reading rows.
**Why it happens:** `Papa.parse` with `transformHeader: (h) => h.trim()` trims but does NOT lowercase. Column lookup in the mapper uses exact key access (`row['Employee first name']`).
**How to avoid:** In `mapGustoRows`, build a case-insensitive lookup shim or always access using the exact header string as exported by Gusto (which is consistent). Detection already normalizes. Mapper should match what papaparse preserves after `transformHeader`.
**Warning signs:** `row['Employee first name']` returns `undefined` even though the column exists.

### Pitfall 2: Double Overtime Hours Column Missing
**What goes wrong:** Treating `Double overtime hours` as required causes a throw on Gusto files that don't export it.
**Why it happens:** Not all Gusto payrolls include double overtime.
**How to avoid:** `Double overtime hours` is optional — `parseFloat(row['Double overtime hours'] ?? '0') || 0`.

### Pitfall 3: Missing Journal Entry
**What goes wrong:** Drizzle silently skips the migration file.
**Why it happens:** `_journal.json` is the authoritative list — file existence alone doesn't trigger execution.
**How to avoid:** Always add the idx 23 entry to `meta/_journal.json` after writing the SQL file. CLAUDE.md makes this explicit.

### Pitfall 4: Type Union Mismatch Between Server and Client
**What goes wrong:** Server returns `provider: 'gusto'` but the client TypeScript interface still has `provider: 'quickbooks' | 'adp'`, causing a type error or silent string comparison failure in the badge render.
**Why it happens:** `ImportPreviewResult` is duplicated — once in `importTypes.ts` (server) and once inline in `PayrollWeekDetailPage.tsx` (~line 139).
**How to avoid:** Update both in the same commit. The client interface is at approximately line 139 in PayrollWeekDetailPage.tsx.

### Pitfall 5: payrollImports.provider Type Not Updated
**What goes wrong:** Inserting `provider: 'gusto'` into `payrollImports` triggers a TypeScript error because schema.ts has `.$type<'quickbooks' | 'adp'>()`.
**Why it happens:** The commit route inserts a `payrollImports` row using `body.provider`.
**How to avoid:** Update the `.$type<>()` annotation on `payrollImports.provider` in schema.ts to include all new provider strings.

### Pitfall 6: CommitBody Interface Not Updated
**What goes wrong:** `POST /commit` body interface in `import.ts` route still has `provider: 'quickbooks' | 'adp'` — TypeScript compile error when client sends `'gusto'`.
**Why it happens:** The `CommitBody` interface in `src/server/routes/import.ts` (line ~96) mirrors the old union.
**How to avoid:** Import the new `ImportProvider` type from `importTypes.ts` and use it in `CommitBody`.

---

## Code Examples

### Gusto Detection Addition (in importService.ts)
```typescript
// Pattern verified against existing QB_SIGNATURES and ADP_SIGNATURE
const GUSTO_SIGNATURE = [
  'Employee first name',
  'Employee last name',
  'Regular hours',
  'Payroll end date',
];

// In detectProvider, add BEFORE ADP check:
if (GUSTO_SIGNATURE.every((col) => normalised.includes(col.toLowerCase()))) {
  return 'gusto';
}
```

### Drizzle uniqueIndex Pattern (from schema.ts)
```typescript
// Source: schema.ts payrollWeekClassifications table (verified, ~line 136)
}, (table) => ({
  pwcUnique: uniqueIndex('pwc_unique').on(table.payrollWeekId, table.workerId),
}));
```

### Migration with Inline UNIQUE (recommended for 0027)
```sql
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
No `--> statement-breakpoint` needed because there is only one SQL statement. NFR-01 is satisfied (the rule requires the separator only when multiple statements exist).

---

## State of the Art

| Old Approach | Current Approach | Changed | Impact |
|--------------|------------------|---------|--------|
| Provider detection: QB + ADP only | Add Gusto + Paychex + Sage 300 | This phase | Broader CSV source support |
| Worker matching: name-only | Name-only for QB/ADP/Gusto; ID mapping for Paychex/Sage 300 | This phase (table), future phase (UI step) | Persistent cross-import mappings |
| `provider` union: `'quickbooks' \| 'adp'` | Extended union: `ImportProvider` type | This phase | Type safety across server + client |

---

## Open Questions

1. **Paychex and Sage 300 column signatures**
   - What we know: IMPORT-06 requires detection + badge for these providers; IMPORT-04 creates the mappings table they need.
   - What's unclear: The exact Paychex/Sage 300 CSV header columns are not specified in the requirements and not present in the codebase.
   - Recommendation: Extend the detection return type for forward compatibility but do not add detection logic for providers whose signatures are unknown. The planner should note this as a stub / future task.

2. **Provider string casing in DB vs. TypeScript**
   - What we know: Existing values are lowercase (`"quickbooks"`, `"adp"`). Requirements use uppercase (`"GUSTO"`, `"QB"`).
   - What's unclear: Should new DB values be lowercase `"gusto"` (consistent with existing) or uppercase `"GUSTO"` (per requirements spec)?
   - Recommendation: Use lowercase throughout to match the existing pattern. The badge display label (e.g. "Gusto") is separate from the stored string.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config/migration changes only. No new external CLI tools, databases, or services are required. All dependencies (papaparse, drizzle, better-sqlite3) are already installed.

---

## Validation Architecture

`workflow.nyquist_validation` is not explicitly set to `false` in `.planning/config.json` (key is absent), so this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (inferred from project structure — ecprXmlGenerator.test.ts exists) |
| Config file | check for vitest.config.ts in project root |
| Quick run command | `npm test` or `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-01 | Gusto CSV parser: required columns detected, names concatenated, hours parsed, double OT → OT bucket | unit | `npx vitest run --reporter=verbose src/server/services/gustoMapper.test.ts` | Wave 0 |
| IMPORT-01 | Error thrown if required columns missing | unit | same file | Wave 0 |
| IMPORT-04 | payroll_provider_mappings table created with correct schema | integration/smoke | manual SQL verify: `SELECT sql FROM sqlite_master WHERE name='payroll_provider_mappings'` | manual |
| IMPORT-06 | detectProvider returns 'gusto' for Gusto headers | unit | `npx vitest run src/server/services/importService.test.ts` | Wave 0 (may exist from Phase 35) |
| NFR-01 | Migration file uses correct statement-breakpoint format | manual review | n/a | n/a |
| NFR-05 | schema.ts exports payrollProviderMappings | TypeScript compile | `npx tsc --noEmit` | existing infra |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/server/services/gustoMapper.test.ts` — covers IMPORT-01 (required columns, name assembly, hour parsing, double OT, missing column error)
- [ ] Verify `src/server/services/importService.test.ts` exists and covers detectProvider — if not, create it for IMPORT-06

---

## Sources

### Primary (HIGH confidence)
- `src/server/services/importService.ts` — detectProvider(), parseImportFile() full implementation, verified line by line
- `src/server/services/importTypes.ts` — ImportedRow, UnmatchedRow, ConflictRow, ImportPreviewResult exact types
- `src/server/services/adpMapper.ts` — ADP mapper pattern: name assembly, weekly totals on Monday, column constants
- `src/server/services/qbMapper.ts` — QB mapper pattern: parseQbDate() anti-new-Date-string, isOvertimeItem()
- `src/server/routes/import.ts` — CommitBody interface, /preview and /commit route logic, payrollImports insert
- `src/server/db/schema.ts` — all existing tables, uniqueIndex patterns, type annotations
- `src/server/db/migrations/meta/_journal.json` — confirmed max idx = 22, tag 0026_il_idol_submission
- `src/server/db/migrations/0020_payroll_imports.sql` — CREATE TABLE pattern with no breakpoints
- `src/server/db/migrations/0023_ny_schema.sql` — multi-ADD-COLUMN with `--> statement-breakpoint`
- `src/server/db/migrations/0026_il_idol_submission.sql` — single-statement, no breakpoint
- `src/client/pages/PayrollWeekDetailPage.tsx` — import modal state (~line 251–531), modal render (~line 2383–2700), badge render (~line 2440)
- `CLAUDE.md` — migration rules, design token rules, UI primitive rules

### Secondary (MEDIUM confidence)
- Gusto CSV column names (`Employee first name`, `Employee last name`, `Regular hours`, `Overtime hours`, `Double overtime hours`, `Payroll end date`) — from requirements specification; not independently verified against a live Gusto export. The detection signature and mapper should be written to be case-insensitive as a precaution.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, verified in source files
- Architecture: HIGH — full import pipeline traced from upload to DB insert
- Migration details: HIGH — journal verified, max idx = 22, pattern verified from 3 existing migrations
- Schema design: HIGH — follows existing table patterns exactly
- Gusto column names: MEDIUM — from requirements spec, not verified against live Gusto export
- Paychex/Sage 300 signatures: LOW — not specified anywhere in codebase or requirements

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable domain — migration patterns and pipeline architecture do not change)
