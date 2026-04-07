# Phase 45: Import ID-Mapped Providers — Research

**Researched:** 2026-04-07
**Domain:** Payroll CSV import pipeline — ID-based provider parsing, employee mapping flow, modal state machine extension
**Confidence:** HIGH (all findings sourced from direct file reads of the live codebase)

---

## Summary

Phase 45 adds two new payroll import providers (Paychex Flex and Sage 300 CRE) that cannot match workers by name — they export only numeric employee IDs. A new "Map Employees" step (Step 2b) must be injected into the existing 3-step import modal between file upload (Step 1) and the review table (Step 2). The `payroll_provider_mappings` table was created in Phase 44 and is ready for use.

The core challenge is that the existing pipeline resolves workers by name lookup (`nameLookup.get(csvName.toLowerCase())`). For ID-mapped providers, that lookup must be replaced with an ID lookup (`providerMappings.get(providerWorkerId)`). The mapper output shape must carry a `providerWorkerId` string instead of a `csvName`, and a new intermediate type is needed in `importTypes.ts`.

The import modal's state machine (`importStep: 1 | 2 | 3`) must expand to accommodate Step 2b. The cleanest approach — matching the existing modal pattern — is to insert `'2b'` as a literal union member and route the JSX conditionally. Sage 100 Contractor (Check Register format) does include employee names, so it follows the existing name-match path and needs no ID mapping step.

**Primary recommendation:** Create `paychexMapper.ts` and `sage300Mapper.ts` following the `adpMapper.ts`/`gustoMapper.ts` pattern, extend `detectProvider()` in `importService.ts`, add a new `idMappingRequired` / `unmappedIds` shape to `ImportPreviewResult`, wire two new API routes (`GET` + `POST` `/api/payroll/import/mappings`), and inject Step 2b into the client modal.

---

## Project Constraints (from CLAUDE.md)

### DB Migration Pattern
- Migrations are plain SQL `ALTER TABLE ... ADD COLUMN` files in `src/server/db/migrations/`
- Always register in `meta/_journal.json` — Drizzle silently skips unregistered files
- Never drop or rename columns — add-only migrations only

### Design Tokens
- All brand values via `@theme` tokens in `src/client/index.css` — never hardcode hex values
- Key tokens: `bg-nav-dark`, `border-brand-gold`, `bg-surface-card`, `bg-surface-page`
- Typography: `font-headline` (Oswald) for h1–h4, `font-body` (Inter) for body

### UI Primitives
- `Card` — `padding="default"|"sm"|"none"`
- `Button` — no `asChild` prop
- `Badge` — variants: `compliant`, `violation`, `warning`, `neutral`

### React Patterns
- `useRef` for synchronous guards; `useState` for display state
- TanStack Query: include all variable state in query key array
- Never set `Content-Type` manually for multipart — browser must set boundary

### Security
- Server-side submitted-week guard is non-negotiable (`week.submittedAt` → 423)
- `assertProjectAccess` required before any data access (NFR-03)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-02 | Paychex Flex CSV parser: detect by `Pay Component` + `Worker ID` columns. Aggregate rows per `Worker ID`: sum `Hours` where `Pay Component = "Regular"` → ST; sum `"Overtime"` → OT. `Line Date` → week-ending date. No name — requires ID mapping. | See Paychex Format section + paychexMapper.ts design |
| IMPORT-03 | Sage 300 CRE parser: detect by positional 9-column order. `PayID` maps REG/OT/DT. Employee is numeric code. Also support Sage 100 Contractor Check Register (named columns, no ID mapping). | See Sage 300 Format section + sage300Mapper.ts design |
| IMPORT-05 | ID mapping Step 2b: between upload and preview. Shows `providerWorkerId` → worker dropdown. Confirmed mappings saved to `payroll_provider_mappings`. Unmapped rows → skip behavior. | See ID Mapping Flow + Modal State sections |
| NFR-03 | All new routes apply `assertProjectAccess` before any data access. | See Provider Mappings API Routes section |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no new installs needed)
| Library | Version | Purpose | Why Used |
|---------|---------|---------|----------|
| papaparse | existing | CSV parsing | Already used in `importService.ts` via `Papa.parse()` |
| drizzle-orm | existing | DB queries | `payroll_provider_mappings` table already defined |
| express | existing | API routing | New mapping routes mount on `importRouter` |

### No new packages required
All functionality builds on the existing stack. Phase 44 already added the `payroll_provider_mappings` table to `schema.ts` and the `payrollProviderMappings` export. The `ImportProvider` union already includes `'paychex'` and `'sage_300'`.

---

## Architecture Patterns

### Pattern 1: Mapper Module (follows adpMapper.ts / gustoMapper.ts)

Each new provider gets its own mapper file. The mapper:
1. Declares column constants at top
2. Declares an `interface XxxAggregated` with `providerWorkerId` (not `csvName`) + hour buckets
3. Exports `mapXxxRows(rows)` returning `{ entries: Map<string, XxxAggregated>; xxxWeeklyTotalsOnly: true }`
4. For ID-mapped providers, the map **key is the providerWorkerId** (not lowercase name)

**Critical difference from ADP/Gusto:** The aggregated type uses `providerWorkerId: string` instead of `csvName: string`. The `parseImportFile` orchestrator must take a different resolution path for ID-mapped providers.

### Pattern 2: detectProvider() — Adding New Signatures

Current `detectProvider()` in `importService.ts` returns `'quickbooks' | 'adp' | 'gusto' | 'unknown'`. The return type must be widened to `ImportProvider | 'unknown'`. New signatures are checked after existing ones.

Detection priority order (most specific first to avoid misfire):
1. Gusto (4-column signature — already most specific)
2. Paychex (column-presence check: `Pay Component` + `Worker ID`)
3. Sage 300 CRE (positional 9-column check — see Sage 300 format below)
4. Sage 100 (column-presence check: named employee columns)
5. QuickBooks (existing)
6. ADP (existing)

### Pattern 3: Two-Path parseImportFile Orchestration

The current orchestrator resolves workers by name. For ID-mapped providers it must resolve by ID from `payroll_provider_mappings`. Two paths:

**Name-match path** (QB, ADP, Gusto, Sage 100): existing behavior — `nameLookup.get(csvName.toLowerCase())`

**ID-match path** (Paychex, Sage 300 CRE):
1. Run the provider mapper → get `entriesMap` keyed by `providerWorkerId`
2. Query `payroll_provider_mappings` for `(projectId, provider, providerWorkerId IN [...])`
3. For each mapped ID: resolve to `workerId`, look up classifications, build `ImportedRow` (matched)
4. For each unmapped ID: add to `UnmatchedRow` with `csvName = providerWorkerId` (the ID itself, as placeholder display value)
5. Set `idMappingRequired: true` on `ImportPreviewResult` and populate `unmappedIds: string[]`

**Auto-match on subsequent imports:** If all `providerWorkerId` values are found in `payroll_provider_mappings`, the preview resolves fully and `idMappingRequired` is false (or absent). No Step 2b is shown — the user goes directly from Step 1 to Step 2.

### Pattern 4: Modal State Machine Extension

Current state: `importStep: 1 | 2 | 3`

Extended state: `importStep: 1 | '2b' | 2 | 3`

Step 2b is injected when `importPreview?.idMappingRequired === true`. After upload (Step 1), the normal `handleImportPreview` advances to Step 2. If `idMappingRequired` is true, the client intercepts and sets `importStep = '2b'` instead.

New state variables for Step 2b:
```typescript
const [idMappings, setIdMappings] = useState<Record<string, string>>({}); // providerWorkerId -> workerId
const [idMappingsSaving, setIdMappingsSaving] = useState(false);
const [idMappingsError, setIdMappingsError] = useState<string | null>(null);
```

The `closeImportModal` function must reset all three new state variables.

### Recommended File Structure for New Code
```
src/server/services/
├── paychexMapper.ts          # NEW — Paychex Flex CSV mapper
├── sage300Mapper.ts          # NEW — Sage 300 CRE + Sage 100 mapper
├── importService.ts          # MODIFY — detectProvider(), parseImportFile()
├── importTypes.ts            # MODIFY — ImportPreviewResult, new types

src/server/routes/
├── import.ts                 # MODIFY — add GET/POST /mappings routes

src/client/pages/
├── PayrollWeekDetailPage.tsx # MODIFY — Step 2b injection

tests/services/
├── importService.test.ts     # MODIFY — add detectProvider tests for new providers
├── paychexMapper.test.ts     # NEW — mapper unit tests
├── sage300Mapper.test.ts     # NEW — mapper unit tests
```

---

## CSV Format Specifications

### Paychex Flex Format (IMPORT-02)

**Detection signature:** Column-presence check (case-insensitive):
- Required: `Pay Component` AND `Worker ID`
- These two columns together are unique to Paychex Flex exports

**Key columns:**
| Column | Purpose |
|--------|---------|
| `Worker ID` | Numeric employee ID (the `providerWorkerId`) |
| `Pay Component` | Pay type string — `"Regular"` → ST hours; `"Overtime"` → OT hours |
| `Hours` | Numeric hours value for this row |
| `Line Date` | Date of the time entry (MM/DD/YYYY format — apply `parseQbDate` pattern) |

**Aggregation logic:**
- Group rows by `Worker ID`
- Per row: if `Pay Component === "Regular"` (case-insensitive trim) → add `Hours` to ST bucket for that date; if `"Overtime"` → add to OT bucket
- `Line Date` determines the day bucket (Mon–Sun) using the same `parseQbDate(dateStr)` → `date.getDay()` → `[sun,mon,tue,wed,thu,fri,sat][getDay()]` mapping from `qbMapper.ts`
- All other `Pay Component` values are ignored (do not throw — just skip the row)

**No name field:** The Paychex export does not include employee name columns. The `providerWorkerId` is the only identifier.

**Output type:**
```typescript
export interface PaychexAggregated {
  providerWorkerId: string; // from "Worker ID" column
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
}
// Map keyed by providerWorkerId (NOT lowercase name)
```

### Sage 300 CRE Format (IMPORT-03)

**Detection signature:** Positional column order — first 9 columns must be exactly (case-insensitive):
```
Employee, Date, Job, Extra, Cost Code, Category, Certified, PayID, Units
```
This positional check is the canonical Sage 300 CRE "Payroll Register" export format. The order is fixed by the Sage export template.

**Key columns:**
| Column | Purpose |
|--------|---------|
| `Employee` | Numeric code (the `providerWorkerId`) — no name in this export |
| `Date` | Date of entry (format: varies, typically `MM/DD/YYYY`) |
| `PayID` | Pay type code: `REG` → straight time; `OT` → overtime; `DT` → double-time |
| `Units` | Numeric hours for this row |

**PayID mapping:**
- `REG` → ST hours bucket
- `OT` → OT hours bucket
- `DT` → OT hours bucket (same as Gusto double-time — lump into OT per established pattern)
- All other `PayID` values → skip row (do not throw)

**Output type:**
```typescript
export interface Sage300Aggregated {
  providerWorkerId: string; // numeric code from "Employee" column
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
}
```

### Sage 100 Contractor Format (IMPORT-03, no ID mapping)

**Detection signature:** Column-presence check (case-insensitive):
- The Sage 100 Contractor Check Register export includes an employee name column
- Distinguish from Sage 300 by absence of the Sage 300 positional signature
- Recommended detection: has named employee column (`Employee Name` or similar) but does NOT match the Sage 300 9-column positional signature

**Key columns:** Includes employee name → follows existing name-match path (same as QB/ADP/Gusto). No `idMappingRequired`.

**Provider label:** `'sage_100'` — note: `ImportProvider` in `importTypes.ts` currently only includes `'sage_300'`. If Sage 100 is a separate provider variant, the union must be extended to `'sage_100'`. Alternatively, use `'sage_300'` as the provider key and sub-detect internally. Recommendation: add `'sage_100'` as a separate `ImportProvider` value for clarity in audit logs.

---

## ID Mapping Flow — End to End

### Server Side: Parse with ID extraction

When `provider === 'paychex' || provider === 'sage_300'`:

1. Run the appropriate mapper → `entriesMap: Map<providerWorkerId, XxxAggregated>`
2. Extract `providerWorkerIds = [...entriesMap.keys()]`
3. Query `payroll_provider_mappings`:
   ```typescript
   const existingMappings = db
     .select({ providerWorkerId: payrollProviderMappings.providerWorkerId, workerId: payrollProviderMappings.workerId })
     .from(payrollProviderMappings)
     .where(and(
       eq(payrollProviderMappings.projectId, projectId),
       eq(payrollProviderMappings.provider, provider),
       inArray(payrollProviderMappings.providerWorkerId, providerWorkerIds),
     ))
     .all();
   ```
4. Build `mappingLookup: Map<providerWorkerId, workerId>`
5. For each entry in `entriesMap`:
   - If `mappingLookup.has(id)` → resolve `workerId` → look up `workerRow` from `nameLookup` (by `workerId`, not by name) → build `ImportedRow`
   - If not mapped → add to `unmatched` (with `csvName = providerWorkerId` as placeholder) and collect in `unmappedIds[]`
6. Return `ImportPreviewResult` with `idMappingRequired: unmappedIds.length > 0`, `unmappedIds: string[]`

**Worker lookup by ID (not name):** The existing `nameLookup` is keyed by name. For ID-mapped providers, build a parallel `workerIdLookup: Map<workerId, WorkerRow>` from `workerRows` so the mapping can resolve `workerId → classifications → rates`.

### Client Side: Step 2b Mapping Table

After `handleImportPreview` receives the preview response:
```typescript
const result = await res.json() as ImportPreviewResult;
setImportPreview(result);
if (result.idMappingRequired) {
  setImportStep('2b');
} else {
  setImportStep(2);
}
```

Step 2b renders:
- Header: "Import Payroll — Step 2a: Map Employees"
- Explanation: "[Provider] does not include employee names. Match each ID to a project worker."
- A table with columns: `Provider ID | Worker Name (dropdown) | Status`
- Each row: `providerWorkerId` in first cell; a `<select>` of project workers (with "— Skip this employee —" as first option) in second cell; pre-populated from existing mappings fetched on mount
- Two action buttons: "Save & Continue" (POST mappings → advance to Step 2) and "Cancel"

**Pre-population:** On Step 2b mount, fetch `GET /api/payroll/import/mappings/:projectId?provider=paychex` to auto-fill any already-known mappings into the dropdowns.

**On "Save & Continue":**
1. POST `{ projectId, provider, mappings: [{providerWorkerId, workerId}] }` to `/api/payroll/import/mappings`
2. Re-call `handleImportPreview` with the original file — server will now find the mappings and return a fully or partially resolved preview
3. Advance to `importStep = 2`

**Alternative (simpler) approach:** Instead of re-calling preview, the client can re-use the already-received `importPreview` data and resolve matched/unmatched client-side using the just-saved mappings + the `projectWorkers` array. This avoids a second server round-trip. Recommended: re-call preview (cleaner, server-authoritative, simpler client logic).

### Commit Pipeline for ID-Mapped Imports

The commit pipeline in `POST /api/payroll/import/commit` does NOT need changes. By the time the user reaches Step 3 (Confirm), all ID-mapped workers have been resolved to `ImportedRow` objects with real `workerId` values. The `CommitBody.matched` array carries resolved rows — the commit route inserts them directly into `payroll_entries`.

The `csvName` field in `ImportedRow` will contain the `providerWorkerId` string for ID-mapped imports (since there is no name). This is acceptable — it only appears in preview display and the audit trail. Optionally, the worker name resolved from the mapping can be used as `csvName` for clarity.

---

## Provider Mappings API Routes

Two new routes mount on `importRouter` (which already has `requireAuth` applied):

### GET /api/payroll/import/mappings/:projectId

```
GET /api/payroll/import/mappings/:projectId?provider=paychex
```

**Purpose:** Fetch existing mappings for auto-fill in Step 2b.

**Implementation:**
```typescript
importRouter.get('/mappings/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { provider } = req.query as { provider?: string };
  const db = getDb();
  await assertProjectAccess(db, projectId, req.user!.userId);  // NFR-03

  const mappings = db
    .select({
      providerWorkerId: payrollProviderMappings.providerWorkerId,
      workerId: payrollProviderMappings.workerId,
    })
    .from(payrollProviderMappings)
    .where(and(
      eq(payrollProviderMappings.projectId, projectId),
      provider ? eq(payrollProviderMappings.provider, provider) : undefined,
    ))
    .all();

  res.json({ mappings });
});
```

### POST /api/payroll/import/mappings

```
POST /api/payroll/import/mappings
Body: { projectId: string; provider: string; mappings: Array<{ providerWorkerId: string; workerId: string }> }
```

**Purpose:** Batch upsert confirmed mappings.

**Implementation:** For each mapping, use Drizzle `.insert(...).onConflictDoUpdate(...)` against the `providerMappingUnique` index (`projectId, provider, providerWorkerId`). The unique index already exists from Phase 44 schema.

```typescript
importRouter.post('/mappings', async (req, res) => {
  const { projectId, provider, mappings } = req.body as { ... };
  const db = getDb();
  await assertProjectAccess(db, projectId, req.user!.userId);  // NFR-03
  const now = new Date().toISOString();

  for (const m of mappings) {
    await db.insert(payrollProviderMappings).values({
      id: randomUUID(),
      projectId,
      provider,
      providerWorkerId: m.providerWorkerId,
      workerId: m.workerId,
      createdAt: now,
    }).onConflictDoUpdate({
      target: [
        payrollProviderMappings.projectId,
        payrollProviderMappings.provider,
        payrollProviderMappings.providerWorkerId,
      ],
      set: { workerId: m.workerId },
    });
  }

  res.json({ saved: mappings.length });
});
```

**NFR-03 compliance:** Both routes call `assertProjectAccess` before any DB read or write, matching the existing pattern in `/preview` and `/commit`.

---

## importTypes.ts Extensions

Current `ImportPreviewResult`:
```typescript
export interface ImportPreviewResult {
  provider: ImportProvider;
  weekId: string;
  matched: ImportedRow[];
  unmatched: UnmatchedRow[];
  conflicts: ConflictRow[];
  adpWeeklyTotalsOnly?: boolean;
  gustoWeeklyTotalsOnly?: boolean;
}
```

Required additions:
```typescript
export interface ImportPreviewResult {
  // ... existing fields ...
  adpWeeklyTotalsOnly?: boolean;
  gustoWeeklyTotalsOnly?: boolean;
  paychexWeeklyTotalsOnly?: boolean;  // Paychex has daily data, but flag for UI banner if needed
  // ID mapping fields (Paychex, Sage 300 only):
  idMappingRequired?: boolean;        // true when at least one providerWorkerId has no mapping
  unmappedIds?: string[];             // list of unresolved providerWorkerIds
}
```

The `UnmatchedRow.csvName` field will hold the `providerWorkerId` for ID-mapped providers — this is acceptable per the existing type since it's a `string`. No type change needed for `UnmatchedRow`.

`ImportProvider` union already includes `'paychex' | 'sage_300'` from Phase 44. Add `'sage_100'` if Sage 100 is treated as a separate provider.

---

## Modal State Machine (PayrollWeekDetailPage.tsx)

### Current State
```typescript
const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
```

### Required Extension
```typescript
const [importStep, setImportStep] = useState<1 | '2b' | 2 | 3>(1);
// New state for Step 2b:
const [idMappings, setIdMappings] = useState<Record<string, string>>({}); // providerWorkerId → workerId
const [idMappingsSaving, setIdMappingsSaving] = useState(false);
const [idMappingsError, setIdMappingsError] = useState<string | null>(null);
```

### Updated closeImportModal
```typescript
function closeImportModal() {
  setShowImportModal(false);
  setImportStep(1);
  setImportPreview(null);
  setImportFile(null);
  setImportParsing(false);
  setImportError(null);
  setImportCheckedRows({});
  setImportRemaps({});
  setImportCommitError(null);
  // New:
  setIdMappings({});
  setIdMappingsSaving(false);
  setIdMappingsError(null);
}
```

### Updated handleImportPreview
```typescript
// After: const result = (await res.json()) as ImportPreviewResult;
setImportPreview(result);
if (result.idMappingRequired) {
  setImportStep('2b');
} else {
  setImportStep(2);
}
```

### Step 2b JSX Placement
Insert between the `{importStep === 1 && ...}` block and the `{importStep === 2 && ...}` block:
```typescript
{importStep === '2b' && importPreview && (
  <>
    <p className="text-xs text-text-secondary">Step 2a of 3</p>
    <h3 ...>Import Payroll — Map Employees</h3>
    {/* mapping table — providerWorkerId → worker dropdown */}
    {/* Save & Continue button → POST /mappings → re-call handleImportPreview */}
  </>
)}
```

### Step number display update
The existing `Step 2 of 3` and `Step 3 of 3` header labels are hardcoded strings. When Step 2b is active, these would render as `Step 2a of 3`. The Step 2 and Step 3 labels remain unchanged — Step 2b is an insertion, not a renumbering.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom string splitter | `Papa.parse()` | Already used; handles quoting, encoding, empty lines |
| Upsert on conflict | Manual SELECT + INSERT/UPDATE | Drizzle `.onConflictDoUpdate()` | Atomic; uses existing unique index |
| Date parsing | `new Date(dateString)` | Manual `MM/DD/YYYY` split pattern (see `parseQbDate` in `qbMapper.ts`) | Timezone parsing is unreliable |
| File upload validation | Custom MIME check | Existing multer config in `importRouter` | Already handles 5 MB limit and MIME whitelist |

---

## Common Pitfalls

### Pitfall 1: Using `new Date(string)` for Paychex Line Date
**What goes wrong:** `new Date('01/06/2025')` produces Invalid Date in V8 for non-ISO strings; `new Date('2025-01-06')` shifts by timezone offset producing the wrong day-of-week.
**Why it happens:** The `qbMapper.ts` comment explicitly warns: "NEVER pass raw date strings to new Date(string) — timezone parsing is unreliable."
**How to avoid:** Use the `parseQbDate` pattern — split on `/`, construct `new Date(year, month - 1, day)` in local time.
**Warning signs:** Tests pass in UTC CI but fail locally; day-of-week is off by one.

### Pitfall 2: Keying the entries Map by name instead of providerWorkerId
**What goes wrong:** If `paychexMapper.ts` uses `csvName.toLowerCase()` as the map key (copying ADP pattern), the entire ID-lookup in `parseImportFile` breaks — the orchestrator looks up by ID.
**How to avoid:** Use `providerWorkerId` (the raw `Worker ID` value) as both the map key and the `providerWorkerId` field in the aggregated object.

### Pitfall 3: Sage 300 positional detection misfire
**What goes wrong:** The 9-column positional check could match a file that has the same column names in different order (user has re-ordered Sage export columns).
**How to avoid:** Check positional order (index 0 = Employee, index 1 = Date, etc.) using `fields[0].toLowerCase() === 'employee'` etc., not just column-presence. This is more restrictive than the Gusto/ADP presence check, but Sage 300's fixed export template makes positional reliable.
**Warning signs:** A QuickBooks file with an `Employee` column at position 0 misfires as Sage 300 — guard against this by also checking `fields[2].toLowerCase() === 'job'` (QB never has a "Job" column at index 2).

### Pitfall 4: importStep type mismatch with Step 2b
**What goes wrong:** TypeScript infers `importStep` as `1 | 2 | 3` at declaration. Adding `'2b'` to the union causes `setImportStep('2b')` to be a type error unless the useState generic is updated.
**How to avoid:** Explicitly type `useState<1 | '2b' | 2 | 3>(1)`.

### Pitfall 5: Re-calling handleImportPreview without the original File object
**What goes wrong:** After Step 2b saves mappings, if `importFile` state was cleared or the File object is no longer accessible, the re-parse call fails.
**How to avoid:** `importFile` state is already set in Step 1 and is not cleared until `closeImportModal`. Re-use it directly.

### Pitfall 6: Conflict detection on ID-mapped matched rows uses wrong worker
**What goes wrong:** The conflict set checks `workerId::classificationId`. If the ID mapping resolves to the correct worker but the classification lookup picks a wrong classification, the conflict check may miss a real conflict.
**How to avoid:** Build `workerIdLookup: Map<workerId, WorkerRow>` from `workerRows` so the first active classification per worker is consistently selected — same D-05 rule as the name-match path.

### Pitfall 7: Missing assertProjectAccess on the new GET /mappings route
**What goes wrong:** Without the guard, any authenticated user can read another project's provider mappings by guessing a projectId.
**How to avoid:** NFR-03 is explicit. The GET route must call `assertProjectAccess(db, projectId, req.user!.userId)` before the DB query, matching the pattern in `/preview` and `/commit`.

### Pitfall 8: onConflictDoUpdate target must match unique index columns exactly
**What goes wrong:** Drizzle's `onConflictDoUpdate` target must list the same columns as the `providerMappingUnique` index: `projectId, provider, providerWorkerId`. Using only `id` as target will not trigger the upsert correctly.
**How to avoid:** Target `[payrollProviderMappings.projectId, payrollProviderMappings.provider, payrollProviderMappings.providerWorkerId]` in the `onConflictDoUpdate` call.

---

## Code Examples

### paychexMapper.ts skeleton
```typescript
// Source: pattern from adpMapper.ts and gustoMapper.ts in this codebase
const COL_WORKER_ID = 'Worker ID';
const COL_PAY_COMPONENT = 'Pay Component';
const COL_HOURS = 'Hours';
const COL_LINE_DATE = 'Line Date';

export interface PaychexAggregated {
  providerWorkerId: string;
  monSt: number; tueSt: number; wedSt: number; thuSt: number;
  friSt: number; satSt: number; sunSt: number;
  monOt: number; tueOt: number; wedOt: number; thuOt: number;
  friOt: number; satOt: number; sunOt: number;
}

// Date parsing — NEVER use new Date(string) for non-ISO strings
function parseLineDate(dateStr: string): Date {
  // Handles MM/DD/YYYY format
  const [month, day, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day); // local midnight
}

const DAY_ST_KEYS = ['sunSt','monSt','tueSt','wedSt','thuSt','friSt','satSt'] as const;
const DAY_OT_KEYS = ['sunOt','monOt','tueOt','wedOt','thuOt','friOt','satOt'] as const;

export function mapPaychexRows(
  rows: Record<string, string>[],
): { entries: Map<string, PaychexAggregated>; paychexWeeklyTotalsOnly: false } {
  const entries = new Map<string, PaychexAggregated>();

  for (const row of rows) {
    const workerId = (row[COL_WORKER_ID] ?? '').trim();
    if (!workerId) continue;

    if (!entries.has(workerId)) {
      entries.set(workerId, { providerWorkerId: workerId, ...emptyBuckets() });
    }
    const entry = entries.get(workerId)!;

    const payComponent = (row[COL_PAY_COMPONENT] ?? '').trim().toLowerCase();
    const hours = parseFloat(row[COL_HOURS] ?? '0') || 0;
    const date = parseLineDate((row[COL_LINE_DATE] ?? '').trim());
    const dayIndex = date.getDay(); // 0=Sun, 1=Mon...6=Sat

    if (payComponent === 'regular') {
      entry[DAY_ST_KEYS[dayIndex]] += hours;
    } else if (payComponent === 'overtime') {
      entry[DAY_OT_KEYS[dayIndex]] += hours;
    }
    // All other pay components: silently skip
  }

  return { entries, paychexWeeklyTotalsOnly: false };
}
```

### sage300Mapper.ts detection check
```typescript
// Source: IMPORT-03 requirement + positional column spec
const SAGE_300_POSITIONAL_COLS = ['employee','date','job','extra','cost code','category','certified','payid','units'];

export function isSage300CRE(fields: string[]): boolean {
  if (fields.length < 9) return false;
  return SAGE_300_POSITIONAL_COLS.every(
    (col, idx) => fields[idx]?.trim().toLowerCase() === col,
  );
}
```

### detectProvider extension pattern
```typescript
// Source: importService.ts — extend existing detectProvider()
const PAYCHEX_SIGNATURE = ['Pay Component', 'Worker ID'];

export function detectProvider(headers: string[]): ImportProvider | 'unknown' {
  const normalised = headers.map((h) => h.trim().toLowerCase());

  // ... existing QB and Gusto checks first ...

  if (isSage300CRE(headers)) return 'sage_300';

  if (PAYCHEX_SIGNATURE.every((col) => normalised.includes(col.toLowerCase()))) {
    return 'paychex';
  }

  // ... ADP check ...
  return 'unknown';
}
```

### Drizzle onConflictDoUpdate for mapping upsert
```typescript
// Source: Drizzle ORM docs — onConflictDoUpdate with explicit target
await db.insert(payrollProviderMappings).values({
  id: randomUUID(),
  projectId,
  provider,
  providerWorkerId: m.providerWorkerId,
  workerId: m.workerId,
  createdAt: now,
}).onConflictDoUpdate({
  target: [
    payrollProviderMappings.projectId,
    payrollProviderMappings.provider,
    payrollProviderMappings.providerWorkerId,
  ],
  set: { workerId: m.workerId },
});
```

---

## Auto-Match on Subsequent Imports

On re-import of a Paychex or Sage 300 file for the same project:

1. `parseImportFile` extracts `providerWorkerIds` from the mapper output
2. Queries `payroll_provider_mappings` — finds all previously-confirmed mappings
3. All IDs in `mappingLookup` → resolve to `ImportedRow` (matched)
4. `unmappedIds` is empty → `idMappingRequired = false` (not set, or set to `false`)
5. Client receives preview with `idMappingRequired` falsy → advances directly from Step 1 to Step 2
6. User sees the review table without Step 2b interruption

This provides a "one-time setup" UX: the user maps employees once, and subsequent imports are as smooth as name-matched providers.

---

## Validation Architecture

`nyquist_validation` is not explicitly set to `false` in `.planning/config.json` (the file only has `_auto_chain_active: false`), so validation is enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/services/importService.test.ts tests/services/paychexMapper.test.ts tests/services/sage300Mapper.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-02 | Paychex detection by Pay Component + Worker ID columns | unit | `npx vitest run tests/services/importService.test.ts` | Partial (add cases) |
| IMPORT-02 | mapPaychexRows aggregates by Worker ID + Pay Component | unit | `npx vitest run tests/services/paychexMapper.test.ts` | No — Wave 0 |
| IMPORT-02 | mapPaychexRows places hours in correct day bucket from Line Date | unit | `npx vitest run tests/services/paychexMapper.test.ts` | No — Wave 0 |
| IMPORT-03 | Sage 300 detection by positional 9-column order | unit | `npx vitest run tests/services/importService.test.ts` | Partial (add cases) |
| IMPORT-03 | mapSage300Rows PayID → ST/OT/DT bucket mapping | unit | `npx vitest run tests/services/sage300Mapper.test.ts` | No — Wave 0 |
| IMPORT-05 | parseImportFile returns idMappingRequired + unmappedIds for Paychex | unit | `npx vitest run tests/services/importService.test.ts` | Partial (add cases) |
| IMPORT-05 | parseImportFile returns fully matched when all IDs in mappings table | unit | `npx vitest run tests/services/importService.test.ts` | No — Wave 0 |
| NFR-03 | GET/POST /mappings routes reject without assertProjectAccess | integration | `npx vitest run tests/routes/` | Partial (add cases) |

### Wave 0 Gaps
- [ ] `tests/services/paychexMapper.test.ts` — covers IMPORT-02 mapper logic
- [ ] `tests/services/sage300Mapper.test.ts` — covers IMPORT-03 mapper logic
- [ ] `tests/services/importService.test.ts` — add describe blocks for `detectProvider` with Paychex/Sage 300 headers, and for `parseImportFile` returning `idMappingRequired`

---

## Environment Availability

Step 2.6: SKIPPED — Phase is purely code/config changes. No new external dependencies. All required tools (Node.js 24, SQLite, papaparse, drizzle-orm) are already available and verified in the existing project stack.

---

## Open Questions

1. **Sage 100 as separate ImportProvider or subtype of sage_300?**
   - What we know: `ImportProvider` currently has `'sage_300'` but not `'sage_100'`. Sage 100 uses name matching.
   - What's unclear: Whether the audit log and provider badge should distinguish Sage 100 from Sage 300.
   - Recommendation: Add `'sage_100'` to the `ImportProvider` union. The detection is clearly different (positional vs. named columns) and audit clarity is worth the minor addition.

2. **Paychex `Pay Component` exact strings**
   - What we know: IMPORT-02 specifies `"Regular"` and `"Overtime"` as the pay component strings.
   - What's unclear: Whether Paychex uses other variants (e.g., `"Regular Time"`, `"OT"`) in different account configurations.
   - Recommendation: Accept `"regular"` and `"overtime"` (lowercase comparison). Log/skip unknown pay components rather than throwing, to be resilient to configuration variation.

3. **Paychex Line Date format guarantee**
   - What we know: IMPORT-02 specifies `Line Date` as the date column.
   - What's unclear: Whether Paychex always exports `MM/DD/YYYY` or whether the format varies by account locale.
   - Recommendation: Use the `parseQbDate` pattern (split on `/`) with a fallback error message if the parse fails. Do not use `Date.parse()` or ISO assumption.

4. **Step 2b "Save & Continue" approach: re-call preview vs. client-side resolution**
   - What we know: Both approaches are viable.
   - Recommendation: Re-call `handleImportPreview` with the saved file (server-authoritative). This ensures the conflict detection also runs with the resolved workers — a client-side resolution would skip that check.

---

## Sources

### Primary (HIGH confidence)
- `src/server/services/importService.ts` — full source read; `detectProvider()`, `parseImportFile()`, pipeline structure
- `src/server/services/importTypes.ts` — `ImportPreviewResult`, `ImportProvider`, `ImportedRow`, `UnmatchedRow`
- `src/server/services/adpMapper.ts` — ID-provider output shape template; `AdpAggregated` interface
- `src/server/services/gustoMapper.ts` — Phase 44 mapper pattern; `mapGustoRows()` signature
- `src/server/routes/import.ts` — existing route structure; `assertProjectAccess` usage pattern; `CommitBody` shape
- `src/server/db/schema.ts` — `payrollProviderMappings` table definition (Phase 44); unique index columns
- `src/client/pages/PayrollWeekDetailPage.tsx` — modal state machine; `importStep` type; `closeImportModal`; `handleImportPreview`; Step 1/2/3 JSX
- `tests/services/importService.test.ts` — test file structure; `describe`/`it`/`expect` pattern; helper function pattern

### Secondary (MEDIUM confidence)
- IMPORT-02/IMPORT-03/IMPORT-05/NFR-03 requirement text — exact column names, detection signatures, and behavioral expectations from the phase prompt

### Tertiary (LOW confidence)
- Paychex Flex CSV export exact column name variants — based on IMPORT-02 spec; actual Paychex export format not verified against a real file. The column names `Pay Component`, `Worker ID`, `Hours`, `Line Date` are taken from the requirement as authoritative.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct codebase reads, no new libraries
- Architecture patterns: HIGH — derived from existing adpMapper, gustoMapper, importService source
- Paychex/Sage format specs: MEDIUM — sourced from requirement text; no real CSV sample verified
- Pitfalls: HIGH — derived from existing code comments and established patterns in qbMapper.ts

**Research date:** 2026-04-07
**Valid until:** Stable — no external dependencies; remains valid until codebase structure changes
