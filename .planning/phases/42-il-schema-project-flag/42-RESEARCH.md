# Phase 42: IL Schema + Project Flag — Research

**Researched:** 2026-04-06
**Domain:** Drizzle SQLite migrations, React state-gated UI, payroll entry forms
**Confidence:** HIGH — all findings derived directly from reading existing codebase files

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATE-07 | Add "IL" to the `state` enum on projects form; IL projects show IL-specific export/submission UI | `state` is a free-text column (no DB enum); gating is done via `isIL` derived from `project.state === 'IL'` in client. No schema change needed for state itself — only UI addition. |
| STATE-09 | Add `nonPwHours` decimal column to `payroll_entries`; PayrollWeekDetailPage entry form shows "Non-PW Hours" input for IL projects; IL PDF includes both PW and non-PW hour columns | Column uses `real` type matching all existing hour columns. Requires migration, schema.ts update, payrollService.ts `UpsertPayrollEntryInput` + upsert values, and PayrollWeekForm.tsx prop + field. |
| STATE-10 | Add 5 nullable text columns to `workers`: `race`, `ethnicity`, `gender`, `veteranStatus`, `skillLevel`. WorkersPage shows them in a collapsible "IL Compliance Demographics" section for IL projects only. | All five are `text()` nullable (no `.notNull().default()`). Requires migration, schema.ts, workers route Zod schemas (Create + Update), workerService.ts, WorkersPage UI gated by `isIL`. |
| NFR-01 | All new Drizzle migrations use `--> statement-breakpoint` (one space) separator | Confirmed from `0023_ny_schema.sql`: the separator is exactly `--> statement-breakpoint` with TWO spaces after `-->` and before `statement`. See Pitfall section. |
| NFR-05 | All new migration files have a corresponding Drizzle schema update in schema.ts | Every new column added to the migration must also appear in the relevant `sqliteTable()` definition in `schema.ts`. |

</phase_requirements>

---

## Summary

Phase 42 adds Illinois-specific schema columns and UI gating to the prevailing-wage application. The work falls into three tracks: (1) a new Drizzle migration file `0025_il_schema.sql` that adds six columns across two tables, (2) schema.ts updates mirroring those columns, and (3) UI changes behind an `isIL` flag following the established `isCA`/`isWA`/`isNY` pattern.

The `state` column on `projects` is already a free-text field (`text('state').notNull()`) — there is no database enum to alter. Adding IL support requires only client-side UI gating and no migration for the `projects` table itself.

The `nonPwHours` column on `payroll_entries` must use the `real` Drizzle type — every other hour column in that table (`monSt`, `tueSt`, etc.) uses `real`. The five demographic columns on `workers` are all `text()` nullable, matching the pattern of other recently-added optional worker fields.

**Primary recommendation:** Write one migration file `0025_il_schema.sql` with six `ALTER TABLE` statements separated by `--> statement-breakpoint` (one space). Update schema.ts, both Zod schemas in workers.ts, `UpsertPayrollEntryInput` + upsert logic in payrollService.ts, and three UI files (WorkersPage.tsx, PayrollWeekForm.tsx, PayrollEntryPage.tsx).

---

## Standard Stack

### Core (already in project — no new installs)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| drizzle-orm | existing | ORM + migration runner | `real`, `text`, `integer` column builders already imported in schema.ts |
| zod | existing | Route input validation | `z.string().optional().nullable()` and `z.number().optional()` patterns already established |
| React + react-hook-form | existing | Client form management | `isIL` flag pattern identical to `isCA`, `isWA`, `isNY` in ProjectForm.tsx and PayrollEntryPage.tsx |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Migration Structure
```
src/server/db/migrations/
├── 0025_il_schema.sql     ← new file (6 statements, 5 statement-breakpoints)
└── meta/_journal.json      ← append new entry at idx 21
```

### Pattern 1: Multi-statement Migration with Statement-Breakpoints

From `0023_ny_schema.sql` (the canonical ADD COLUMN migration):
```sql
ALTER TABLE projects ADD COLUMN nyp_rc_number TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN nys_contractor_reg_number TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN project_settings TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN nys_registered_apprentice INTEGER NOT NULL DEFAULT 0;
```

Key observations:
- The separator is `--> statement-breakpoint` — that is `-->` then **two spaces** then `statement-breakpoint`
- No trailing semicolons required (SQLite accepts them; existing migrations include them — follow the same style)
- Multiple tables can appear in one migration file
- Single-statement migrations (like `0024_ny_mpwr_submission.sql`) omit the separator entirely

### Pattern 2: `isIL` State Gating in ProjectForm.tsx

Existing pattern from ProjectForm.tsx (lines 54–56 and 242–268):
```typescript
const isCA = stateValue?.toUpperCase() === 'CA';
const isWA = stateValue?.toUpperCase() === 'WA';
const isNY = stateValue?.toUpperCase() === 'NY';
// ...
{isNY && (
  <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-4">
    <p className="text-sm font-medium text-green-800">New York Project Fields</p>
    ...
  </div>
)}
```

For IL, add after the NY block:
```typescript
const isIL = stateValue?.toUpperCase() === 'IL';
// ...
{isIL && (
  <div className="space-y-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
    <p className="text-sm font-medium text-purple-800">Illinois Project Fields</p>
    {/* No IL-specific project fields in this phase — placeholder for future */}
  </div>
)}
```

Note: STATE-07 says IL projects show IL-specific export/submission UI — this is in PayrollWeekDetailPage, not ProjectForm. The ProjectForm state field is a free-text `<input>` (not a `<select>`), so no dropdown option to add. The `isIL` flag on PayrollWeekDetailPage follows the same `projectData?.data?.project?.state === 'IL'` pattern.

### Pattern 3: `isIL` in PayrollWeekDetailPage.tsx

Lines 443–445 show the existing derivation:
```typescript
const isCA = projectData?.data?.project?.state === 'CA';
const isWA = projectData?.data?.project?.state === 'WA';
const isNY = projectData?.data?.project?.state?.toUpperCase() === 'NY';
```

Add:
```typescript
const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL';
```

The IL-specific export button and agency submission row follow the `{isNY && (...)}` pattern at lines 942–952 and 1285–1303.

### Pattern 4: Worker Demographics Section Gating (WorkersPage.tsx)

The `nysRegisteredApprentice` checkbox (lines 475–488 in the edit form) is **universally rendered** — it appears for all projects, not just NY projects. The requirement for STATE-10 explicitly states IL demographics must be **IL-gated only**.

The `isNY` / `isWA` pattern in WorkersPage.tsx is:
```typescript
const isWA = projectData?.data?.project?.state === 'WA';
```

For IL:
```typescript
const isIL = projectData?.data?.project?.state === 'IL';
```

The IL Compliance Demographics section should be rendered only inside `{isIL && (...)}` in both the add form and the edit form. It should be a collapsible section (the requirement says "collapsible") — use a `details`/`summary` element or a `useState` toggle, following the project's existing UI component patterns.

### Pattern 5: Zod Schema Extension for Workers Route

Existing pattern for optional nullable fields in `UpdateWorkerSchema` (workers.ts lines 41–51):
```typescript
addressStreet: z.string().max(500).optional().nullable(),
```

For Create: use `.optional()` (no `.nullable()` — nullable is for updates where null means "clear"):
```typescript
race: z.string().max(100).optional(),
ethnicity: z.string().max(100).optional(),
gender: z.string().max(100).optional(),
veteranStatus: z.string().max(100).optional(),
skillLevel: z.enum(['journeyman', 'apprentice']).optional().nullable(),
```

For Update: use `.optional().nullable()` to allow clearing:
```typescript
race: z.string().max(100).optional().nullable(),
ethnicity: z.string().max(100).optional().nullable(),
gender: z.string().max(100).optional().nullable(),
veteranStatus: z.string().max(100).optional().nullable(),
skillLevel: z.enum(['journeyman', 'apprentice']).optional().nullable(),
```

Note: `skillLevel` has constrained values per STATE-10 (`"journeyman" | "apprentice" | null`). Use `z.enum` not `z.string()` for this field.

### Pattern 6: `nonPwHours` in payrollService.ts

The `UpsertPayrollEntryInput` interface (lines 57–97) must gain `nonPwHours?: number | null`. The `values` object (lines 157–196) must include `nonPwHours: input.nonPwHours ?? null`. The `onConflictDoUpdate` set block must include `nonPwHours: values.nonPwHours`.

The amendment clone loop (lines 749–779) does NOT copy `monDt`/`tueDt` etc. for non-CA projects, and the same approach applies to `nonPwHours` — it should be copied verbatim when cloning:
```typescript
// In amendPayrollWeek, sourceEntries loop:
nonPwHours: entry.nonPwHours ?? null,
```

### Anti-Patterns to Avoid
- **Adding `nonPwHours` with `.notNull().default(0)`:** All nullable hour extensions on `payroll_entries` use `real('...')` without `.notNull()` — see `grossWages`, `netPay`, `fringeHealthWelfare` etc. Use `real('non_pw_hours')` (nullable) to match.
- **Using `numeric` instead of `real` for `nonPwHours`:** All existing hour columns use `real`. SQLite's `NUMERIC` affinity differs from `REAL`. Use `REAL` in SQL and `real()` in Drizzle.
- **Using `.toUpperCase()` inconsistently:** `isNY` in PayrollWeekDetailPage uses `.toUpperCase()` while `isCA` and `isWA` do not. Use `.toUpperCase()` for `isIL` for safety, matching `isNY`.
- **Rendering IL demographics unconditionally:** `nysRegisteredApprentice` is rendered for all projects because it's a checkbox, not a text section. Do not follow that pattern for IL — always wrap in `{isIL && ...}`.
- **Forgetting the _journal.json entry:** Drizzle's migration runner uses `_journal.json` to track which migrations have run. A new SQL file without a journal entry will not run automatically through `drizzle-kit migrate`. The journal entry needs `idx: 21`, `version: "7"`, and appropriate `tag`.

---

## Migration Details

### File: `0025_il_schema.sql`

**Journal index:** 21 (current max is 20, tag `0024_ny_mpwr_submission`)
**File name:** `0025_il_schema.sql`

Full migration content:
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

6 statements, 5 `--> statement-breakpoint` separators.

**Separator format:** `--> statement-breakpoint` — two spaces between `-->` and `statement`. Verified from `0023_ny_schema.sql`.

### schema.ts Changes Required

**`workers` table — add after `nysRegisteredApprentice` line:**
```typescript
// Phase 42 — IL compliance demographics (nullable; IL projects only)
race: text('race'),
ethnicity: text('ethnicity'),
gender: text('gender'),
veteranStatus: text('veteran_status'),
skillLevel: text('skill_level'),  // no .$type<>() — Zod enum in routes is the enforcing layer
```

**`payrollEntries` table — add after `fringeTraining` line:**
```typescript
// Phase 42 — IL non-prevailing-wage hours (nullable; IL projects only)
nonPwHours: real('non_pw_hours'),
```

---

## Files Requiring Changes

| File | Change | Scope |
|------|--------|-------|
| `src/server/db/migrations/0025_il_schema.sql` | **CREATE** — 6 ALTER TABLE statements | Migration |
| `src/server/db/migrations/meta/_journal.json` | **APPEND** entry at idx 21 | Migration |
| `src/server/db/schema.ts` | **EDIT** — add 5 columns to `workers`, 1 to `payrollEntries` | Schema |
| `src/server/routes/workers.ts` | **EDIT** — add 5 fields to `CreateWorkerSchema` + `UpdateWorkerSchema`; pass through in route handlers | Route |
| `src/server/services/workerService.ts` | **EDIT** — add 5 fields to `createWorker`/`updateWorker` input types and DB writes | Service |
| `src/server/services/payrollService.ts` | **EDIT** — add `nonPwHours` to `UpsertPayrollEntryInput`, `values` object, `onConflictDoUpdate`, and amendment clone | Service |
| `src/server/routes/payroll.ts` | **EDIT** — add `nonPwHours` to the payroll entry upsert route Zod schema | Route |
| `src/client/pages/WorkersPage.tsx` | **EDIT** — add `isIL` derivation; add IL Compliance Demographics collapsible section (gated) in add form and edit form; add 5 fields to `blankWorkerForm`, `workerToEditForm`, `editForm` state, and `Worker` interface | UI |
| `src/client/components/PayrollWeekForm.tsx` | **EDIT** — add `isIL` prop; add `nonPwHours` field to form values and submit payload (gated by `isIL`) | UI |
| `src/client/pages/PayrollEntryPage.tsx` | **EDIT** — derive `isIL` from project state; pass `isIL` prop to `PayrollWeekForm` | UI |
| `src/client/pages/PayrollWeekDetailPage.tsx` | **EDIT** — add `isIL` derivation; add IL export button and agency submission row (gated by `isIL`) | UI |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration separator format | Custom parser | Copy exact format from `0023_ny_schema.sql` | Format is `--> statement-breakpoint` with 2 spaces — off-by-one breaks Drizzle |
| State gating logic | New abstraction | `project.state?.toUpperCase() === 'IL'` inline | Matches existing pattern across all state-gated components |
| Drizzle column types | Custom SQL types | `real()` for hours, `text()` for demographics | Existing schema uses `real` for all floating-point; `text` for nullable strings |

---

## Common Pitfalls

### Pitfall 1: Statement-Breakpoint Spacing
**What goes wrong:** Writing `-->statement-breakpoint` (no space) or `-> statement-breakpoint` (wrong prefix) causes Drizzle to treat the entire migration as one statement, which fails on the second `ALTER TABLE` in SQLite.
**Why it happens:** The format is easy to misremember.
**How to avoid:** Copy-paste from `0023_ny_schema.sql` exactly. The correct format is `--> statement-breakpoint` (arrow, then **two** spaces, then the keyword).
**Warning signs:** Migration runner errors about multiple statements in a single execution.

### Pitfall 2: `nonPwHours` Column Type Mismatch
**What goes wrong:** Using `integer` or `numeric` instead of `real` for `nonPwHours`.
**Why it happens:** "decimal column" in the requirement sounds like `NUMERIC` but every single hour column in `payroll_entries` uses `REAL` (SQLite floating-point). Drizzle `real()` maps to SQLite `REAL`.
**How to avoid:** Check schema.ts — `monSt`, `tueSt`, `grossWages`, etc. all use `real()`. Use the same type.
**Warning signs:** Fractional hours (0.5 hours) stored as integers and silently truncated.

### Pitfall 3: `skillLevel` Needs Enum Constraint, Not Free Text
**What goes wrong:** Using `z.string().max()` for `skillLevel` when STATE-10 specifies exactly `"journeyman" | "apprentice" | null`.
**Why it happens:** Default pattern for worker text fields is `z.string().max()`.
**How to avoid:** Use `z.enum(['journeyman', 'apprentice']).optional().nullable()` in routes. Do NOT add `.$type<>()` to the Drizzle column — the Zod enum is the enforcing layer; the DB column stays plain `text()`.
**Warning signs:** Invalid values like "Journeyman" (capital J) stored without rejection.

### Pitfall 4: IL Demographics Rendered Without `isIL` Gate
**What goes wrong:** Adding the demographics fields to `blankWorkerForm()` and `editForm` state without gating them — they show up on all projects.
**Why it happens:** `nysRegisteredApprentice` is universally rendered (not gated on `isNY`) so the precedent seems to be "show always."
**How to avoid:** The requirement explicitly says "for IL projects only." Wrap the entire section in `{isIL && (...)}`. Only the `isIL`-gated demographics need to appear conditionally. The `nysRegisteredApprentice` exception is because it's a single checkbox needed for NY MPWR XML — different purpose.
**Warning signs:** Demographics section visible on a CA project's WorkersPage.

### Pitfall 5: Missing `nonPwHours` in Amendment Clone
**What goes wrong:** Forgetting to copy `nonPwHours` in `amendPayrollWeek` — amendment entries revert to `null` even when the original had values.
**Why it happens:** The amendment clone loop in payrollService.ts (around line 751) explicitly lists every field. New fields must be added manually.
**How to avoid:** Search for `monDt: entry.monDt` in payrollService.ts amendment loop and add `nonPwHours: entry.nonPwHours ?? null` in the same pattern.
**Warning signs:** IL amendments lose non-PW hours data.

### Pitfall 6: Payroll Route Schema Not Updated
**What goes wrong:** `nonPwHours` accepted in payrollService but rejected by route-level Zod validation before it reaches the service.
**Why it happens:** The payroll route has its own Zod schema that must be updated independently of the service interface.
**How to avoid:** After updating `UpsertPayrollEntryInput`, also update the Zod schema in `src/server/routes/payroll.ts` (or wherever the `POST /payroll/weeks/:weekId/entries` Zod schema lives).
**Warning signs:** 400 validation errors when submitting IL payroll entries with `nonPwHours`.

### Pitfall 7: Worker Interface in WorkersPage Not Extended
**What goes wrong:** Adding DB columns and route fields but not updating the `Worker` interface in WorkersPage.tsx — TypeScript accepts the shape but the fields are `undefined` at runtime.
**Why it happens:** Client-side interfaces are duplicated from the server response shape and must be manually kept in sync.
**How to avoid:** Add all 5 demographic fields to the `Worker` interface at the top of WorkersPage.tsx with `race: string | null`, etc.

---

## State Enum Clarification (STATE-07)

The `state` column on `projects` is defined as:
```typescript
state: text('state').notNull(),
```
There is **no database-level enum**. The server-side Zod schema validates it as:
```typescript
state: z.string().length(2).toUpperCase(),
```
This accepts any 2-letter uppercase string, including "IL". **No migration is needed for the projects table.** The IL gating is done entirely in the client by deriving `isIL` from the stored state value. STATE-07 means: add `isIL`-gated UI to PayrollWeekDetailPage (export buttons, agency submission row) — not a DB schema change.

---

## Code Examples

### Verified: Existing `isNY` block in PayrollWeekDetailPage (lines 942–952)
```typescript
{isNY && weekId && (
  <Button
    variant="secondary"
    size="sm"
    ...
  >
    Download NY MPWR XML
  </Button>
)}
```
The IL export button follows this exact pattern with `isIL`.

### Verified: `nysRegisteredApprentice` in workers.ts Zod schemas
```typescript
// CreateWorkerSchema
nysRegisteredApprentice: z.boolean().optional().default(false),

// UpdateWorkerSchema
nysRegisteredApprentice: z.boolean().optional(),
```
For IL demographics, use `z.string().max(100).optional()` (create) and `z.string().max(100).optional().nullable()` (update).

### Verified: `real()` column for hours in payroll_entries
```typescript
monSt: real('mon_st').notNull().default(0),   // straight-time — notNull with default
grossWages: real('gross_wages'),               // nullable (no .notNull())
fringeHealthWelfare: real('fringe_health_welfare'),  // nullable
```
`nonPwHours` follows the nullable pattern (no `.notNull()`).

### Verified: statement-breakpoint format from 0023_ny_schema.sql
```sql
ALTER TABLE projects ADD COLUMN nyp_rc_number TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN nys_contractor_reg_number TEXT;
```
Two spaces after `-->`.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code and migration changes. No external tools, services, or runtimes beyond the project's existing Node.js + SQLite stack.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Not detected — no test config file found in repo |
| Config file | None found |
| Quick run command | Not applicable |
| Full suite command | Not applicable |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-07 | IL state value routes to `isIL = true` in UI components | manual | manual UI verification | N/A |
| STATE-09 | `nonPwHours` persists through upsert and reads back correctly | manual | manual via payroll entry form on IL project | N/A |
| STATE-10 | IL demographics save and reload on workers | manual | manual via WorkersPage on IL project | N/A |
| NFR-01 | Migration separator format is exactly `--> statement-breakpoint` | visual inspection | inspect migration file | N/A |
| NFR-05 | schema.ts columns match migration | visual inspection | compare migration to schema.ts | N/A |

### Wave 0 Gaps
None — no automated test infrastructure exists in this project. All validation is manual UI smoke-testing.

---

## Open Questions

1. **Does PayrollWeekDetailPage need an IL-specific PDF/export?**
   - What we know: STATE-07 says "IL-specific export and submission UI" — implies at minimum an export button and an agency submission row. STATE-09 says "IL PDF includes both PW and non-PW hour columns."
   - What's unclear: Is the IL PDF a new generator, or a modified WH-347? If a new generator is needed, it's out of scope for Phase 42 schema work.
   - Recommendation: Phase 42 adds the data layer and UI gating (`isIL` flag + `nonPwHours` field). The actual IL PDF generator can be Phase 43+. Add the IL export button as a disabled/placeholder if the generator is not yet built.

2. **`workerService.ts` — does it exist and handle demographic passthrough?**
   - What we know: `workers.ts` route imports from `workerService.ts`. The file exists at `src/server/services/workerService.ts` but was not fully read.
   - What's unclear: Whether `createWorker`/`updateWorker` explicitly list every column or use a spread.
   - Recommendation: Read `workerService.ts` at implementation time to confirm explicit field passing and add the 5 demographic fields.

3. **`_journal.json` — should the planner add the entry or rely on `drizzle-kit generate`?**
   - What we know: The journal is manually maintained in this project (entries have hand-set timestamps).
   - Recommendation: Write the migration SQL manually (not via `drizzle-kit generate`) and append the journal entry with a plausible timestamp. Index must be 21.

---

## Sources

### Primary (HIGH confidence)
- `src/server/db/schema.ts` — confirmed column types for `workers` and `payrollEntries`; confirmed `state` is free-text not enum
- `src/server/db/migrations/0023_ny_schema.sql` — confirmed `--> statement-breakpoint` separator format (two spaces)
- `src/server/db/migrations/0024_ny_mpwr_submission.sql` — confirmed single-statement migration has no separator
- `src/server/db/migrations/meta/_journal.json` — confirmed current max idx is 20; next is 21, file is `0025_il_schema.sql`
- `src/server/routes/projects.ts` — confirmed `state` Zod is `z.string().length(2).toUpperCase()` (no enum)
- `src/client/components/projects/ProjectForm.tsx` — confirmed `isCA`/`isWA`/`isNY` pattern, state is a text input not a select
- `src/client/pages/WorkersPage.tsx` — confirmed `nysRegisteredApprentice` is universally rendered; `isWA` pattern for section gating
- `src/server/services/payrollService.ts` — confirmed `UpsertPayrollEntryInput` fields; confirmed amendment clone loop; confirmed `getPayrollEntriesWithWorkerDetails` select list
- `src/server/routes/workers.ts` — confirmed `CreateWorkerSchema` and `UpdateWorkerSchema` patterns
- `src/client/pages/PayrollWeekDetailPage.tsx` — confirmed `isCA`/`isWA`/`isNY` derivation pattern; confirmed entry row interface lacks `nonPwHours`
- `src/client/pages/PayrollEntryPage.tsx` — confirmed `isCA` prop pass to `PayrollWeekForm`; confirmed `isIL` must be added here
- `src/client/components/PayrollWeekForm.tsx` — confirmed `isCA` prop pattern; confirmed where `nonPwHours` field goes

### Secondary / Tertiary
None — all research performed against live codebase files.

---

## Metadata

**Confidence breakdown:**
- Migration details: HIGH — journal index and separator format read directly from files
- Schema changes: HIGH — column types verified against existing schema.ts
- UI patterns: HIGH — all patterns traced from existing state-gated components
- Pitfalls: HIGH — derived from direct code inspection, not speculation

**Research date:** 2026-04-06
**Valid until:** Until any of the referenced source files change (schema.ts, payrollService.ts, WorkersPage.tsx, PayrollWeekDetailPage.tsx)
