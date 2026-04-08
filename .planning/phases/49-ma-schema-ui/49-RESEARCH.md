# Phase 49: MA Schema + UI — Research

**Researched:** 2026-04-07
**Domain:** Massachusetts DLS certified payroll — schema additions, UI field surfacing, state gate wiring
**Confidence:** HIGH (all findings from direct codebase reads; NFR/schema patterns from prior phases confirmed)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MA-01 | MA is a selectable project state. MA projects show a state-gated "Download MA DLS Weekly Payroll" button on PayrollWeekDetailPage. | STATE_FORMS registry already established in Phase 47; `isMA` boolean follows `isTX`/`isFL` pattern at lines 461–466 of PayrollWeekDetailPage. Entry in `STATE_FORMS` object uses route `'ma-cpr'`. |
| MA-02 | New nullable worker columns `isWoman` (boolean), `isMinority` (boolean), `oshaTraining` (boolean). Shown in WorkersPage for MA AND NJ projects. | IL demographics pattern (Phase 42) is the direct template. Gate is `(isMA \|\| isNJ)` from the start. Drizzle pattern: `integer('col', { mode: 'boolean' })` — no `.notNull().default(false)` since these are nullable. |
| MA-03 | New nullable payroll entry fields `checkNumber` (text), `allOtherHours` (decimal), `totalWeekGrossWages` (decimal). Shown in PayrollWeekDetailPage for MA projects. | IL `nonPwHours` pattern is the direct template. Payroll entry Zod schema in `payroll.ts` and `payrollService.ts` UpsertPayrollEntry interface both need these fields, same path as `nonPwHours`. |
| NFR-01 | All new Drizzle migrations use `--> statement-breakpoint` (one space) separator between SQL statements; single-statement migrations need no separator. | Confirmed pattern: 0025_il_schema.sql uses `--> statement-breakpoint` between 6 ALTER TABLE statements. 0024_ny_mpwr_submission.sql is single-statement with no separator. |
</phase_requirements>

---

## Summary

Phase 49 lays the data foundation for the Massachusetts DLS Weekly Certified Payroll Report. The phase has three distinct work areas: (1) a database migration adding 3 worker columns and 3 payroll entry columns, (2) wiring MA into the STATE_FORMS registry and adding project-level MA fields, and (3) surfacing all new fields in the WorkersPage and PayrollWeekDetailPage UIs.

The IL Phase 42 schema additions are the canonical template for every decision in this phase. `isWoman`, `isMinority`, and `oshaTraining` follow the exact same Drizzle boolean pattern as would IL demographics — except they must be fully nullable (no `.notNull().default(false)`) because workers may decline to self-identify. `checkNumber`, `allOtherHours`, and `totalWeekGrossWages` follow the `nonPwHours` pattern.

One design decision to lock before writing: MA-02 requires the UI gate to be `(isMA || isNJ)`. Phase 49 does not implement NJ, but the gate must be written as the dual condition from the start. `isNJ` will evaluate `false` for all existing projects; no NJ boolean block is needed. This prevents a second diff to WorkersPage when Phase 51 arrives.

**Primary recommendation:** Follow the IL Phase 42 pattern verbatim for migration SQL, Drizzle schema additions, Zod schema extensions, payrollService interface additions, and WorkersPage demographic section — swapping `isIL` gate for `(isMA || isNJ)` gate and boolean input widgets for boolean checkbox widgets.

---

## Project Constraints (from CLAUDE.md)

The CLAUDE.md is from an older session (v2.3) but contains directives still active in the codebase:

- **Add-only migrations:** Never drop or rename columns. ALTER TABLE ADD COLUMN only.
- **Always register in `meta/_journal.json`:** Drizzle silently skips files not in the journal.
- **Design tokens:** Use `@theme` tokens — `border-brand-gold`, `bg-surface-card`, etc. Never hardcode hex values.
- **UI Primitives:** `Card`, `Button`, `Badge`, `PageHeader`, `EmptyState` from `src/client/components/ui/`.
- **PDF lib only:** No pdfmake, jsPDF, or other PDF packages (v5.0 SUMMARY.md constraint).
- **assertProjectAccess before state gate** on all export routes (NFR-03).
- **useRef for synchronous guards** (double-click prevention on download buttons).
- **Blob URL download pattern:** `fetch()` → `.blob()` → `URL.createObjectURL()` → click → `setTimeout(URL.revokeObjectURL, 100)`.

---

## Standard Stack

### Core (all installed — zero new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | Schema definition + migrations | Project ORM; all DB access via Drizzle |
| better-sqlite3 | ^12.8.0 | SQLite driver | Project DB engine |
| zod | (installed) | Runtime validation on API routes | Project validation layer |
| react-hook-form | (installed) | Form state in WorkersPage, PayrollWeekForm | Project form library |

No new packages required for Phase 49.

**Version verification:** No new packages to verify — all stack elements confirmed installed from direct package.json read.

---

## Architecture Patterns

### Migration Structure

**Next migration:** idx 25, file `0029_ma_schema.sql`

Current highest idx in `_journal.json` is 24 (`0028_tx_schema.sql`). Next is idx 25.

**Migration SQL pattern (from 0025_il_schema.sql — exact template):**

```sql
-- Workers: MA nullable boolean columns
ALTER TABLE workers ADD COLUMN is_woman INTEGER;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN is_minority INTEGER;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN osha_training INTEGER;
--> statement-breakpoint
-- Payroll entries: MA nullable columns
ALTER TABLE payroll_entries ADD COLUMN check_number TEXT;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN all_other_hours REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN total_week_gross_wages REAL;
--> statement-breakpoint
-- Payroll weeks: MA submission tracking
ALTER TABLE payroll_weeks ADD COLUMN ma_cpr_submitted_at TEXT;
--> statement-breakpoint
-- Projects: MA project fields
ALTER TABLE projects ADD COLUMN ma_dls_project_id TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN ma_sic_code TEXT;
```

Note: This is a multi-statement migration, so `--> statement-breakpoint` (exactly one space before `statement-breakpoint`) is required between each statement per NFR-01.

### Drizzle Schema Additions Pattern

**workers table additions (from Phase 40 `nysRegisteredApprentice` and Phase 42 IL demographics):**

```typescript
// Phase 49 — MA nullable boolean columns (nullable; workers may decline to self-identify)
isWoman: integer('is_woman', { mode: 'boolean' }),
isMinority: integer('is_minority', { mode: 'boolean' }),
oshaTraining: integer('osha_training', { mode: 'boolean' }),
```

Key: Do NOT use `.notNull().default(false)`. These are nullable booleans. The difference from `nysRegisteredApprentice` (which has `.notNull().default(false)`) is intentional — MA workforce participation is self-reported and may be unknown.

**payrollEntries table additions (from Phase 42 `nonPwHours`):**

```typescript
// Phase 49 — MA nullable payroll entry fields
checkNumber: text('check_number'),
allOtherHours: real('all_other_hours'),
totalWeekGrossWages: real('total_week_gross_wages'),
```

**payrollWeeks table addition:**

```typescript
// Phase 49 — MA CPR submission tracking
maCprSubmittedAt: text('ma_cpr_submitted_at'),
```

**projects table additions:**

```typescript
// Phase 49 — Massachusetts-specific fields
maDlsProjectId: text('ma_dls_project_id'),
maSicCode: text('ma_sic_code'),
```

### STATE_FORMS Registry Addition

`PayrollWeekDetailPage.tsx` already has the `STATE_FORMS` registry established in Phase 47. The current shape (lines 470–481):

```typescript
const STATE_FORMS: Record<string, { downloadLabel: string; route: string; buttonVariant?: string }> = {
  TX: { downloadLabel: 'Download WH-347 (TX)', route: 'wh347' },
  FL: { downloadLabel: 'Download WH-347 (FL)', route: 'wh347' },
};
```

MA entry to add:

```typescript
MA: { downloadLabel: 'Download MA DLS Payroll', route: 'ma-cpr' },
```

**isMA boolean** at lines 461–466 (after existing `isFL`):

```typescript
const isMA = projectData?.data?.project?.state?.toUpperCase() === 'MA';
```

The `stateFormConfig` lookup already handles the download button automatically once MA is in the registry.

### WorkersPage MA Demographics Section Pattern

**Gate: `(isMA || isNJ)` — not `isMA` alone**

This is the dual-gate decision that must be locked in Phase 49. When Phase 51 adds NJ, `isNJ` will already exist in the gate. The `isNJ` boolean evaluates `false` until Phase 51 adds that state comparison — no behavior change.

**Add `isMA` alongside existing `isIL` declaration:**

```typescript
const isMA = projectData?.data?.project?.state?.toUpperCase() === 'MA';
// isNJ will be added in Phase 51; gate uses it from Phase 49 onward
const isNJ = projectData?.data?.project?.state?.toUpperCase() === 'NJ';
```

**Form state additions** (in `editForm` and `form` useState, following `gender`/`veteranStatus`/`skillLevel` pattern):

```typescript
isWoman: null as boolean | null,
isMinority: null as boolean | null,
oshaTraining: null as boolean | null,
```

**Section JSX pattern** (modeled on IL demographics `details/summary` with `open` attribute):

```tsx
{(isMA || isNJ) && (
  <details className="rounded-lg border border-teal-200 bg-teal-50 p-3" open>
    <summary className="cursor-pointer text-sm font-medium text-teal-800">
      MA/NJ Workforce Participation
    </summary>
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-1 gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={editForm.isWoman ?? false}
            onChange={e => setEditForm(f => ({ ...f, isWoman: e.target.checked }))}
          />
          Woman (self-identified)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={editForm.isMinority ?? false}
            onChange={e => setEditForm(f => ({ ...f, isMinority: e.target.checked }))}
          />
          Minority (self-identified)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={editForm.oshaTraining ?? false}
            onChange={e => setEditForm(f => ({ ...f, oshaTraining: e.target.checked }))}
          />
          OSHA 10 Certified
        </label>
      </div>
      <p className="text-xs text-teal-600">
        All fields are optional. Workers may decline to self-identify.
      </p>
    </div>
  </details>
)}
```

Note: The checkbox `checked` value must default to `false` when the stored value is `null` (for display), but the API payload should send `null` if unchanged (not `false`) — or accept that the user explicitly checked/unchecked. The IL pattern uses `|| undefined` / `|| null` guards in the mutation payload. The same guard applies here: `...(isMA || isNJ ? { isWoman: data.isWoman ?? null, isMinority: data.isMinority ?? null, oshaTraining: data.oshaTraining ?? null } : {})`.

### PayrollWeekForm MA Fields Pattern

MA entry fields follow the `nonPwHours` / IL pattern in `PayrollWeekForm.tsx`.

**Form state additions:**

```typescript
checkNumber: '',
allOtherHours: 0,
totalWeekGrossWages: 0,
```

**Mutation payload (conditional on isMA):**

```typescript
...(isMA ? {
  checkNumber: data.checkNumber || null,
  allOtherHours: data.allOtherHours || null,
  totalWeekGrossWages: data.totalWeekGrossWages || null,
} : {}),
```

**JSX section** (`isMA && (...)` within the form, after the IL non-PW hours block):

```tsx
{isMA && (
  <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
    <p className="text-sm font-medium text-teal-800">MA Payroll Fields</p>
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Check Number</label>
      <input type="text" className="w-full rounded border px-2 py-1 text-sm"
        {...register('checkNumber')} placeholder="Optional" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">All Other Hours (other employers)</label>
      <input type="number" step="0.01" min="0" className="w-full rounded border px-2 py-1 text-sm"
        {...register('allOtherHours', { valueAsNumber: true })} placeholder="0.00" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">Total Week Gross Wages (all employers)</label>
      <input type="number" step="0.01" min="0" className="w-full rounded border px-2 py-1 text-sm"
        {...register('totalWeekGrossWages', { valueAsNumber: true })} placeholder="0.00" />
    </div>
  </div>
)}
```

### ProjectForm.tsx MA State Fields Pattern

The existing `isTX` block (lines 284–335) and `isNY` block (lines 249–277) are the templates. MA gets an `isMA && (...)` block with teal color scheme.

**Zod schema additions** (in `CreateProjectSchema` at the top of `ProjectForm.tsx`):

```typescript
// Phase 49 — Massachusetts-specific fields
maDlsProjectId: z.string().max(100).optional(),
maSicCode: z.string().max(50).optional(),
```

**isMA boolean** (alongside `isTX`, `isFL` at lines 62–63):

```typescript
const isMA = stateValue?.toUpperCase() === 'MA';
```

**JSX block** (after `isFL && (...)` informational block):

```tsx
{isMA && (
  <div className="space-y-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
    <p className="text-sm font-medium text-teal-800">Massachusetts Project Fields</p>
    <div>
      <label htmlFor="maDlsProjectId" className="block text-sm font-medium text-gray-700">
        MA DLS Project ID
      </label>
      <input id="maDlsProjectId" type="text" {...register('maDlsProjectId')}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-gold focus:outline-none"
        placeholder="DCAMM-assigned project ID" />
    </div>
    <div>
      <label htmlFor="maSicCode" className="block text-sm font-medium text-gray-700">
        SIC / Trade Code
      </label>
      <input id="maSicCode" type="text" {...register('maSicCode')}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-gold focus:outline-none"
        placeholder="e.g. 1731" />
    </div>
    <p className="text-xs text-teal-600">
      MA DLS certified payroll download will be available on payroll weeks.
    </p>
  </div>
)}
```

### Server-Side Route and Schema Touch Points

**`payroll.ts` Zod route schema** — add to `UpsertPayrollEntrySchema`:

```typescript
// Phase 49 — MA payroll entry fields
checkNumber: z.string().max(50).nullable().optional(),
allOtherHours: z.number().min(0).nullable().optional(),
totalWeekGrossWages: z.number().min(0).nullable().optional(),
```

**`payrollService.ts` UpsertPayrollEntry interface** — add after `nonPwHours`:

```typescript
checkNumber?: string | null;
allOtherHours?: number | null;
totalWeekGrossWages?: number | null;
```

**`payrollService.ts` upsertPayrollEntry insert values** — add after `nonPwHours`:

```typescript
checkNumber: input.checkNumber ?? null,
allOtherHours: input.allOtherHours ?? null,
totalWeekGrossWages: input.totalWeekGrossWages ?? null,
```

**`payrollService.ts` update values** — add after `nonPwHours`:

```typescript
checkNumber: values.checkNumber,
allOtherHours: values.allOtherHours,
totalWeekGrossWages: values.totalWeekGrossWages,
```

**`payrollService.ts` getPayrollEntriesWithWorkerDetails select** — add MA columns for Phase 50 generator use:

```typescript
// Phase 49 — MA worker fields
isWoman: workers.isWoman,
isMinority: workers.isMinority,
oshaTraining: workers.oshaTraining,
// Phase 49 — MA payroll entry fields
checkNumber: payrollEntries.checkNumber,
allOtherHours: payrollEntries.allOtherHours,
totalWeekGrossWages: payrollEntries.totalWeekGrossWages,
```

**`workers.ts` route** — add MA fields to PATCH body Zod schema and update handler, following IL race/ethnicity/gender pattern.

**`projects.ts` route** — add `maDlsProjectId` and `maSicCode` to project PATCH Zod schema.

### Projects Server Route — MA Fields

The server-side project PATCH/POST routes need the MA fields accepted. Pattern from TX fields in the existing schema:

```typescript
// projects route Zod schema
maDlsProjectId: z.string().max(100).optional(),
maSicCode: z.string().max(50).optional(),
```

### Recommended Project Structure

No new files required for Phase 49. All changes are additive to existing files.

```
src/server/db/
├── schema.ts                          # add MA columns to workers, payrollEntries, payrollWeeks, projects
└── migrations/
    ├── 0029_ma_schema.sql             # NEW — all MA ALTER TABLE statements
    └── meta/_journal.json             # register idx 25 entry

src/server/routes/
├── payroll.ts                         # add MA fields to UpsertPayrollEntrySchema
├── projects.ts                        # add maDlsProjectId, maSicCode to project PATCH schema
└── workers.ts                         # add isWoman, isMinority, oshaTraining to PATCH schema

src/server/services/
└── payrollService.ts                  # add MA fields to interface + upsert + select

src/client/pages/
├── WorkersPage.tsx                    # isMA + isNJ booleans; MA/NJ demographics section
└── PayrollWeekDetailPage.tsx         # isMA boolean; STATE_FORMS MA entry

src/client/components/
├── projects/ProjectForm.tsx           # isMA boolean; MA project fields block
└── PayrollWeekForm.tsx               # MA payroll entry fields section
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Nullable boolean in SQLite | Custom null-handling boolean | `integer('col', { mode: 'boolean' })` with no `.notNull()` | Drizzle's established pattern; mode: 'boolean' handles 0/1/null correctly |
| Decimal field in SQLite | Custom decimal type | `real('col')` nullable | All existing decimal fields use `real()` — consistent throughout schema |
| State-specific form sections | Custom component/hook | Conditional JSX with existing `isXX` pattern | Already used in 6 places — consistent, reviewable |
| Checkbox triple-state (true/false/null) | Custom state machine | `checked={field ?? false}` display + `field ?? null` payload | Standard nullable boolean checkbox pattern; IL demographics shows the `|| undefined` approach |

---

## Common Pitfalls

### Pitfall 1: Nullable Boolean vs Non-Nullable Boolean
**What goes wrong:** Using `.notNull().default(false)` like `nysRegisteredApprentice` — this makes null impossible to store, preventing workers who decline to self-identify from having a stored null vs a stored false.
**Why it happens:** Phase 40 `nysRegisteredApprentice` is the closest prior example but has different semantics — it is a non-nullable flag that defaults off.
**How to avoid:** MA boolean columns use `integer('col', { mode: 'boolean' })` with NO `.notNull()` or `.default()`. The column accepts null, 0, and 1.
**Warning signs:** Migration SQL has `NOT NULL DEFAULT 0` — that's the wrong pattern for these columns.

### Pitfall 2: isMA Gate Alone Instead of (isMA || isNJ)
**What goes wrong:** If the WorkersPage gate is `{isMA && (...)}`, Phase 51 (NJ) must touch WorkersPage again to change it to `{(isMA || isNJ) && (...)}` — a second unnecessary diff.
**Why it happens:** Natural instinct to gate narrowly for the current phase.
**How to avoid:** Define both `isMA` and `isNJ` booleans in WorkersPage in Phase 49 and write the gate as `(isMA || isNJ)` from the start. `isNJ` is `false` for all current projects.
**Warning signs:** WorkersPage has `{isMA && (` without `isNJ` in the gate.

### Pitfall 3: Missing _journal.json Registration
**What goes wrong:** Migration SQL file exists but `meta/_journal.json` is not updated — Drizzle silently skips the migration on next migrate run.
**Why it happens:** Easy to forget the journal update after writing the SQL file.
**How to avoid:** Journal update is a required step in the same plan task as the SQL file write. idx 25, tag `0029_ma_schema`.
**Warning signs:** `drizzle-kit push` or `migrate` does not execute the new file.

### Pitfall 4: statement-breakpoint Spacing Error
**What goes wrong:** Writing `--> statement-breakpoint` (two spaces) instead of `--> statement-breakpoint` (one space) causes Drizzle to fail to parse the separator.
**Why it happens:** Typo; editors may auto-correct.
**How to avoid:** Copy verbatim from 0025_il_schema.sql. The exact string is `--> statement-breakpoint` (space, dash, dash, right angle, space, statement-breakpoint).
**Warning signs:** Migration runs all statements as one, or Drizzle errors on parse.

### Pitfall 5: PayrollWeekForm isMA Propagation
**What goes wrong:** `PayrollWeekForm.tsx` receives project state via props or a separate query. If `isMA` is derived locally using `projectState?.toUpperCase() === 'MA'` but the prop name differs from other pages, the field section never renders.
**Why it happens:** `PayrollWeekForm.tsx` is a shared component; it already receives `isCA`, `isIL` etc. as props.
**How to avoid:** Check how `isIL` is currently passed to `PayrollWeekForm.tsx` as a prop — add `isMA` in the same location and with the same prop threading pattern.
**Warning signs:** MA fields section never appears in the UI even when project.state === 'MA'.

### Pitfall 6: getPayrollEntriesWithWorkerDetails Select Missing New Columns
**What goes wrong:** New columns are in the DB and in the upsert path but not in the `getPayrollEntriesWithWorkerDetails` select — Phase 50 generator cannot access them.
**Why it happens:** The select list in `payrollService.ts` is explicit, not `SELECT *`.
**How to avoid:** Add all 6 new columns (isWoman, isMinority, oshaTraining, checkNumber, allOtherHours, totalWeekGrossWages) to the select in Phase 49 so the data flows to the generator in Phase 50 without a schema diff.
**Warning signs:** Phase 50 TypeScript type error when accessing `e.checkNumber` on the entry object.

---

## Code Examples

### Verified Pattern: IL schema migration (0025_il_schema.sql — direct read)

```sql
ALTER TABLE workers ADD COLUMN race TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN ethnicity TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN gender TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN veteran_status TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN skill_level TEXT;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN non_pw_hours REAL;
```

MA migration has 9 statements (vs IL's 6), so 8 separators.

### Verified Pattern: Drizzle boolean (schema.ts Phase 40)

```typescript
// Non-nullable (Phase 40 — nysRegisteredApprentice)
nysRegisteredApprentice: integer('nys_registered_apprentice', { mode: 'boolean' }).notNull().default(false),

// Nullable (Phase 42 — IL demographics use text not boolean, but the nullable pattern is)
race: text('race'),  // nullable by omission — same for integer mode: boolean
```

MA boolean pattern (omit .notNull() and .default()):
```typescript
isWoman: integer('is_woman', { mode: 'boolean' }),
```

### Verified Pattern: TX migration (0028_tx_schema.sql — direct read)

```sql
ALTER TABLE projects ADD COLUMN txdot_project_id TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN tx_contractor_license TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN tx_awarding_agency TEXT;
--> statement-breakpoint
ALTER TABLE payroll_weeks ADD COLUMN tx_cpr_submitted_at TEXT;
```

MA migration follows identical structure for project fields and `maCprSubmittedAt`.

### Verified Pattern: IL demographics gate in WorkersPage.tsx (direct read)

```typescript
// Line 181 in WorkersPage.tsx
const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL';

// Line 199 — mutation payload gate
...(isIL ? {
  race: f.race || undefined,
  ethnicity: f.ethnicity || undefined,
  gender: f.gender || undefined,
  veteranStatus: f.veteranStatus || undefined,
  skillLevel: f.skillLevel || undefined,
} : {}),

// Line 519 — edit form JSX gate
{isIL && (
  <details className="rounded-lg border border-purple-200 bg-purple-50 p-3" open>
    <summary className="cursor-pointer text-sm font-medium text-purple-800">IL Compliance Demographics</summary>
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Race</label>
          <input className="w-full rounded border px-2 py-1 text-sm" value={editForm.race}
            onChange={e => setEditForm(f => ({ ...f, race: e.target.value }))} placeholder="Optional" />
        </div>
        ...
```

MA gate replaces `isIL` with `(isMA || isNJ)` and uses checkboxes not text inputs.

### Verified Pattern: STATE_FORMS registry current state (PayrollWeekDetailPage.tsx direct read)

```typescript
// Lines 461-466
const isCA = projectData?.data?.project?.state?.toUpperCase() === 'CA';
const isWA = projectData?.data?.project?.state?.toUpperCase() === 'WA';
const isNY = projectData?.data?.project?.state?.toUpperCase() === 'NY';
const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL';
const isTX = projectData?.data?.project?.state?.toUpperCase() === 'TX';
const isFL = projectData?.data?.project?.state?.toUpperCase() === 'FL';

// Lines 470-481
const STATE_FORMS: Record<string, { downloadLabel: string; route: string; buttonVariant?: string }> = {
  TX: { downloadLabel: 'Download WH-347 (TX)', route: 'wh347' },
  FL: { downloadLabel: 'Download WH-347 (FL)', route: 'wh347' },
};
const stateFormConfig = STATE_FORMS[projectData?.data?.project?.state?.toUpperCase() ?? ''] ?? null;
```

Phase 49 adds `isMA` at line ~467, `isNJ` at ~468, and `MA: { downloadLabel: 'Download MA DLS Payroll', route: 'ma-cpr' }` to the registry.

### Verified Pattern: _journal.json entry structure

```json
{
  "idx": 24,
  "version": "7",
  "when": 1744070400000,
  "tag": "0028_tx_schema",
  "breakpoints": true
}
```

Phase 49 entry: `{ "idx": 25, "version": "7", "when": <timestamp>, "tag": "0029_ma_schema", "breakpoints": true }`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-state booleans for download buttons | STATE_FORMS registry | Phase 47 | MA entry goes directly in registry — no separate button block needed |
| `project.state === 'XX'` exact match | `project.state?.toUpperCase() === 'XX'` | Phase 47 | All new state comparisons use optional-chained toUpperCase |
| State-specific columns not on projects | Phase-tagged additive columns on `projects` | Phase 24+ | MA gets `maDlsProjectId`, `maSicCode`, `maCprSubmittedAt` directly on existing tables |

---

## Open Questions

1. **totalWeekGrossWages stored or derived?**
   - What we know: MA-03 specifies `totalWeekGrossWages` as a column on payroll entries. This is "gross wages from all employers" — a user-entered value that cannot be computed from project data.
   - What's unclear: Should it be stored on `payrollEntries` (per-worker per-week) or on `payrollWeeks` (week-level)? MA form Column H is a per-worker row value.
   - Recommendation: Store on `payrollEntries` (per-worker per-week) — that matches Column H semantics (per-worker row). A week-level total would require aggregation; the MA form shows it per worker.

2. **oshaTraining column name**
   - What we know: MA-02 uses `oshaTraining` in the requirements doc.
   - What's unclear: The SUMMARY.md uses `isOsha10Certified` as the column name.
   - Recommendation: Use `oshaTraining` (matching the requirements ID directly) unless the planner prefers `isOsha10Certified` for consistency with `isWoman`/`isMinority` naming — both are reasonable. Lock one before migration.

3. **isNJ boolean in Phase 49**
   - What we know: MA-02 requires the UI gate to be `(isMA || isNJ)`.
   - What's unclear: Should `isNJ` be declared in Phase 49 even though NJ is Phase 51 scope?
   - Recommendation: Yes — declare `isNJ = false-evaluating boolean` in Phase 49 to write the gate correctly from day one. This is a one-line add at the boolean declaration block.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 49 is purely code and DB migration changes. No external tools, services, or CLIs beyond the project's own Node.js/npm stack. The Node.js runtime, npm, and SQLite (better-sqlite3) are already confirmed operational from prior phases.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/routes/export.test.ts tests/routes/workers.test.ts tests/routes/payroll.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MA-01 | `GET /api/export/ma-cpr/:weekId` on non-MA project returns 400 | integration | `npx vitest run tests/routes/export.test.ts` | Yes — add test case |
| MA-01 | `GET /api/export/ma-cpr/:weekId` on MA project returns 200 with PDF content-type | integration | `npx vitest run tests/routes/export.test.ts` | Yes — add test case |
| MA-02 | `PATCH /api/projects/:id/workers/:wid` accepts `isWoman`, `isMinority`, `oshaTraining` nullable booleans | integration | `npx vitest run tests/routes/workers.test.ts` | Yes — add test case |
| MA-02 | Worker with `isWoman: null` can be patched to `isWoman: true` and back to `null` | integration | `npx vitest run tests/routes/workers.test.ts` | Yes — add test case |
| MA-03 | `POST /api/payroll-entries` accepts `checkNumber`, `allOtherHours`, `totalWeekGrossWages` | integration | `npx vitest run tests/routes/payroll.test.ts` | Yes — add test case |
| MA-03 | `getPayrollEntriesWithWorkerDetails` returns MA columns in select | integration | `npx vitest run tests/services/payrollService.test.ts` | Yes — add test case |
| NFR-01 | Migration file `0029_ma_schema.sql` uses correct `--> statement-breakpoint` separator | manual/smoke | Inspect file content; run migrate | N/A — file inspection |

Note: MA-01 requires the export route `ma-cpr` to exist. Phase 49 adds the STATE_FORMS registry entry (frontend) and the route stub that returns 400 for wrong-state projects. The full generator implementation is Phase 50. The Phase 49 export test verifies the state gate only — it does not require a valid PDF to be generated.

**Route stub approach for MA-01:** Phase 49 can add a minimal `router.get('/ma-cpr/:weekId', ...)` to `export.ts` that performs `assertProjectAccess` + state gate (`project.state?.toUpperCase() !== 'MA'` → 400) + returns a `501 Not Implemented` for MA projects. This makes the state gate testable in Phase 49 and lets Phase 50 fill in the generator body.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/routes/export.test.ts tests/routes/workers.test.ts tests/routes/payroll.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. Test cases need to be added to existing files (export.test.ts, workers.test.ts, payroll.test.ts, payrollService.test.ts), but no new test files or framework config are required.

---

## Sources

### Primary (HIGH confidence — direct code reads)

- `src/server/db/schema.ts` — current workers, payrollEntries, payrollWeeks, projects column shape; Drizzle boolean pattern
- `src/server/db/migrations/meta/_journal.json` — current highest idx is 24; next is 25
- `src/server/db/migrations/0025_il_schema.sql` — exact migration SQL template for MA (6 statements, `--> statement-breakpoint` separators)
- `src/server/db/migrations/0028_tx_schema.sql` — project fields + payroll_weeks submission column pattern
- `src/client/pages/WorkersPage.tsx` — IL demographics section JSX (lines 519, 900); `isIL` gate pattern; `(isMA || isNJ)` gate must replace
- `src/client/pages/PayrollWeekDetailPage.tsx` — STATE_FORMS registry (lines 470–481); `isCA`–`isFL` boolean declarations (lines 461–466)
- `src/client/components/projects/ProjectForm.tsx` — `isTX` block with `txdotProjectId`/`txContractorLicense`; Zod schema pattern; MA follows identical structure
- `src/client/components/PayrollWeekForm.tsx` — `nonPwHours` / IL pattern (lines 47, 87, 161, 237–248)
- `src/server/services/payrollService.ts` — `UpsertPayrollEntry` interface; upsert insert/update paths; `getPayrollEntriesWithWorkerDetails` select
- `src/server/routes/payroll.ts` — `UpsertPayrollEntrySchema` Zod definition; `nonPwHours` as template
- `.planning/STATE.md` — Phase 42/43 IL decisions; Phase 47/48 TX/FL decisions; v5.0 locked decisions
- `.planning/REQUIREMENTS.md` — MA-01/02/03/04 and NFR-01 requirement text
- `.planning/research/SUMMARY.md` — v5.0 MA schema column inventory; IL pattern recommendation
- `.planning/research/PITFALLS.md` — state gate, case normalization, PDF coordinate pitfalls

### Secondary (MEDIUM confidence — cross-referenced)

- `.planning/research/SUMMARY.md` MA architecture section — `isOsha10Certified`/`isMinority`/`isWoman` column names (requirement doc uses `oshaTraining`; this is an open question to resolve)

---

## Metadata

**Confidence breakdown:**
- Migration structure: HIGH — direct read of 0025 and 0028 migrations; journal idx confirmed
- Drizzle schema patterns: HIGH — direct read of schema.ts; boolean nullable vs non-nullable pattern confirmed
- WorkersPage IL gate as MA template: HIGH — direct read of WorkersPage.tsx lines 181, 199, 519
- STATE_FORMS registry MA entry: HIGH — direct read of PayrollWeekDetailPage.tsx lines 461–481
- ProjectForm MA block: HIGH — direct read of ProjectForm.tsx isTX/isNY blocks
- PayrollWeekForm MA fields: HIGH — direct read of PayrollWeekForm.tsx nonPwHours pattern
- payrollService.ts touch points: HIGH — direct read of interface, upsert paths, select
- `(isMA || isNJ)` dual gate: HIGH — explicit v5.0 SUMMARY.md decision + REQUIREMENTS.md MA-02 text
- oshaTraining vs isOsha10Certified: MEDIUM — requirement doc vs SUMMARY.md disagree; planner must lock

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable patterns; no external dependencies that change)
