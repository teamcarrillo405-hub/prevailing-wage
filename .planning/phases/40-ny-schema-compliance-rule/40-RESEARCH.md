# Phase 40: NY Schema + Compliance Rule — Research

**Researched:** 2026-04-02
**Domain:** Database migration, React form pattern, compliance engine extension
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

Phase 40 adds New York as a selectable project state, writes the NY-specific DB columns (project-level PRC number + contractor reg number, worker-level `nysRegisteredApprentice`), and extends `computeCompliance()` to enforce the NY 8-hours/day OT rule.

All three workstreams are independent of each other and can be planned as separate waves: (1) migration + schema.ts, (2) React form + server Zod schemas, (3) compliance engine extension. There are no external dependencies; everything is internal code.

The daily hours data required for the NY OT rule already exists in `payroll_entries`. The columns `monSt`…`sunSt` and `monOt`…`sunOt` are already stored per-day. The compliance engine already sums them. NY daily OT detection requires comparing each day's `*St + *Ot` total against 8.0 — no new DB columns are needed for the compliance rule itself.

**Primary recommendation:** Three-wave plan: Wave 1 = migration 0023 + schema.ts, Wave 2 = server routes (projects Zod, workers Zod) + React forms (ProjectForm isNY block, WorkersPage nysRegisteredApprentice field), Wave 3 = compliance engine NY OT logic + tests.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATE-01 | Add `"NY"` as a selectable state in the project creation/edit form. NY projects show NY-specific export/submission UI. | `ProjectForm.tsx` uses a free-text input with `isCA`/`isWA` watch pattern. Add `isNY` constant and conditional section using the same amber/blue panel pattern. Server `CreateProjectSchema` accepts `state: z.string().length(2)` — no change needed. |
| STATE-06 | Add `nyprcNumber` (text), `nysContractorRegNumber` (text), and `projectSettings` JSON column to `projects`. Add `nysRegisteredApprentice` boolean to `workers`. | Migration 0023 adds 4 columns; schema.ts needs corresponding additions. `projectSettings` is a JSON text column (nullable); `nysRegisteredApprentice` is `integer({ mode: 'boolean' })` with `.default(false)`. |
| STATE-04 | NY projects enforce 8 hours/day OT threshold in `computeCompliance()`. | `payroll_entries` already has `monSt`…`sunSt` and `monOt`…`sunOt`. Compliance engine must load the project's `state` and branch on `=== 'NY'` to apply per-day violation detection. Currently `computeCompliance()` only receives `weekId`; it must also fetch the project to read `state`. |
| NFR-01 | All new Drizzle migrations use `--> statement-breakpoint` (one space) separator. | Verified in 0022_worker_profile_depth.sql — the separator is exactly `--> statement-breakpoint` with one leading space. |
| NFR-05 | All new migration files have a corresponding Drizzle schema update in `schema.ts`. | Pattern confirmed across all 19 journal entries: every migration column has a matching Drizzle column definition in `src/server/db/schema.ts`. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

### Migrations
- Plain SQL `ALTER TABLE ... ADD COLUMN` files in `src/server/db/migrations/`
- **Always register in `meta/_journal.json`** — Drizzle silently skips files not in the journal
- Next idx: **19**, next tag: `0023_ny_schema`
- Never drop or rename columns — add-only migrations only
- Statement separator: `--> statement-breakpoint` (one space before `statement-breakpoint`)

### DB Column Types
- Text columns: `text('column_name')` — no length enforcement in SQLite
- Boolean columns: `integer('column_name', { mode: 'boolean' })` — stored as 0/1
- JSON columns: `text('column_name')` with no special type — JSON stored as text string

### React Patterns
- `useRef` for synchronous guards (double-click prevention)
- TanStack Query: include all variable state in query key
- State-specific form sections: `const isCA = stateValue?.toUpperCase() === 'CA'` pattern; render conditionally as `{isNY && (<div className="...border-green-200 bg-green-50 p-4">...)}`

### Design Tokens
- Brand tokens from `@theme` in `src/client/index.css`
- State section panels follow existing pattern: CA uses `border-amber-200 bg-amber-50`, WA uses `border-blue-200 bg-blue-50`
- NY panel should use a distinct color — `border-green-200 bg-green-50` is unused and appropriate

### Testing
- Framework: **vitest** (`npm test` = `vitest run`)
- Pattern: supertest against live app, seed via API calls (register → create project → create worker → create payroll week → upsert entry)
- Existing compliance tests live in `tests/services/complianceService.test.ts` and `tests/routes/compliance.test.ts`

---

## Standard Stack

### Core (already installed — no new packages needed)
| Library | Purpose | Notes |
|---------|---------|-------|
| drizzle-orm/better-sqlite3 | ORM for SQLite migrations | Existing pattern, no changes to drizzle config |
| zod | Request validation | Server-side schemas in `src/server/routes/projects.ts` and `workers.ts` |
| react-hook-form + zodResolver | Client-side form validation | Already wired in `ProjectForm.tsx` |
| vitest + supertest | Testing | `npm test` runs full suite |

**No new npm packages required for this phase.**

---

## Architecture Patterns

### Migration Numbering — VERIFIED

Current state after Phase 39:
- Highest file: `0022_worker_profile_depth.sql`
- Highest journal idx: **18** (tag `0022_worker_profile_depth`)
- **Next migration: file `0023_ny_schema.sql`, journal idx 19**

### Migration File Pattern (from 0022_worker_profile_depth.sql)

```sql
ALTER TABLE workers ADD COLUMN nys_registered_apprentice INTEGER DEFAULT 0;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN nyp_rc_number TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN nys_contractor_reg_number TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN project_settings TEXT;
```

Note: `nysRegisteredApprentice` maps to SQLite column `nys_registered_apprentice INTEGER DEFAULT 0` (boolean stored as 0/1 in SQLite).

### Journal Entry Pattern (from _journal.json)

```json
{
  "idx": 19,
  "version": "7",
  "when": 1743638400000,
  "tag": "0023_ny_schema",
  "breakpoints": true
}
```

The `when` timestamp should be set to a value after the 0022 entry's timestamp (`1743552000000`).

### Schema.ts Column Additions

**projects table** — add after the `pwiaIntentId` column (last Phase 30 field):

```typescript
// Phase 40 — New York-specific fields
nyprcNumber: text('nyp_rc_number'),
nysContractorRegNumber: text('nys_contractor_reg_number'),
projectSettings: text('project_settings'),  // JSON string; nullable
```

**workers table** — add after `apprenticeshipRegNumber` (last Phase 39 field):

```typescript
// Phase 40 — NYS registered apprentice flag
nysRegisteredApprentice: integer('nys_registered_apprentice', { mode: 'boolean' }).notNull().default(false),
```

### ProjectForm.tsx State-Gated Section Pattern

Current pattern (exact code — follow this):

```typescript
const isCA = stateValue?.toUpperCase() === 'CA';
const isWA = stateValue?.toUpperCase() === 'WA';
```

Add:
```typescript
const isNY = stateValue?.toUpperCase() === 'NY';
```

Then add Zod fields to `CreateProjectSchema`:
```typescript
nyprcNumber: z.string().max(50).optional(),
nysContractorRegNumber: z.string().max(50).optional(),
```

Render the conditional section:
```tsx
{isNY && (
  <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-4">
    <p className="text-sm font-medium text-green-800">New York Project Fields</p>
    {/* nyprcNumber + nysContractorRegNumber inputs */}
  </div>
)}
```

### Server Route Updates

**`src/server/routes/projects.ts` — `CreateProjectSchema`:** Add two optional fields:
```typescript
nyprcNumber: z.string().max(50).optional(),
nysContractorRegNumber: z.string().max(50).optional(),
```

**`POST /api/projects` handler:** Map in the `.values({...})` call:
```typescript
nyprcNumber: body.nyprcNumber ?? null,
nysContractorRegNumber: body.nysContractorRegNumber ?? null,
```

**`UpdateProjectSchema`:** Add the same two optional fields (so they can be edited post-creation via PATCH).

### WorkersPage — nysRegisteredApprentice Field

The workers form in `WorkersPage.tsx` follows a section-based pattern. The `nysRegisteredApprentice` boolean should appear in a conditional section visible for NY projects. The WorkersPage receives the project from context/props.

Pattern to follow: the apprenticeship section in Phase 39 is conditionally shown via `w.classifications?.some(c => c.laborType === 'apprentice')`. For `nysRegisteredApprentice`, show for all workers on NY projects (not conditional on classification).

The requirement text from STATE-06 says "add `nysRegisteredApprentice` boolean to `workers` table" — the UI should let users set it. The workers route Zod schema needs to accept this field.

### Compliance Engine: NY Daily OT Rule

**Current `computeCompliance()` signature:**
```typescript
export async function computeCompliance(
  _db: BetterSQLite3Database<typeof schema>,
  weekId: string,
): Promise<ComplianceResult | null>
```

**Current flow:**
1. `getPayrollWeek(weekId)` → returns `{ id, projectId, weekEndingDate, ... }` — does NOT include project state
2. `getPayrollEntries(weekId)` → returns entries with daily St/Ot columns

**What must change for NY:**
- After loading `week`, fetch the project to read `project.state`
- Add branching logic: if `project.state === 'NY'`, apply daily 8-hour check; otherwise, apply existing weekly/CWHSSA logic

**NY daily OT detection logic:**
The NY rule is: any day where a worker's total hours (St + Ot) exceed 8 constitutes an OT violation. The existing `*Ot` columns store user-entered OT hours. The compliance check should detect when a worker has `*St + *Ot > 8` on any single day — meaning the user entered more than 8 hours of combined ST+OT for that day. This indicates a violation because the worker should have been paid at OT rate for hours >8.

The violation type to emit: `'cwhssa-ot'` — this reuses the existing `ComplianceViolation.violationType` union, which is `'under-wage' | 'cwhssa-ot'`. A new violation type `'ny-daily-ot'` is an option, but reusing `'cwhssa-ot'` is simpler and consistent with how the ROADMAP describes it ("flags a CWHSSA OT violation").

**Decision required:** Use `'cwhssa-ot'` or add `'ny-daily-ot'`?
- ROADMAP says "flags a CWHSSA OT violation" — use `'cwhssa-ot'`
- SUCCESS CRITERIA says "PayrollWeekDetailPage shows the violation badge" — existing badge rendering handles `'cwhssa-ot'`
- Recommendation: reuse `'cwhssa-ot'` for Phase 40; Phase 41 can add granularity if needed

**Implementation pattern:**
```typescript
// After loading week, fetch project for state check
const db_ref = _db; // parameter is actually the db
const [project] = await db_ref.select().from(schema.projects)
  .where(eq(schema.projects.id, week.projectId)).limit(1);

const isNY = project?.state === 'NY';

// Inside the per-entry loop, add NY check before existing OT check:
if (isNY) {
  const days = [
    { st: e.monSt, ot: e.monOt }, { st: e.tueSt, ot: e.tueOt },
    { st: e.wedSt, ot: e.wedOt }, { st: e.thuSt, ot: e.thuOt },
    { st: e.friSt, ot: e.frOt },  { st: e.satSt, ot: e.satOt },
    { st: e.sunSt, ot: e.sunOt },
  ];
  const hasNyDailyOt = days.some(d => (d.st ?? 0) + (d.ot ?? 0) > 8);
  if (hasNyDailyOt) {
    violations.push({ ..., violationType: 'cwhssa-ot', ... });
    continue; // skip the weekly CWHSSA check for this entry
  }
}
```

Note: The `_db` parameter is currently underscore-prefixed (unused) because `complianceService.ts` calls `getDb()` inside `getPayrollWeek`. To fetch the project, we need to use the `db` parameter or call `getDb()` inline. The safest approach: call `getDb()` inside `computeCompliance` as all other service functions do.

**Important edge case:** The ROADMAP success criterion says "a worker with exactly 8 hours/day has no OT violation flagged." The check must be `> 8`, not `>= 8`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| State-specific form sections | Custom state management | `watch('state')` + `isNY` derived boolean (existing CA/WA pattern) |
| Boolean DB column | Custom string encoding | `integer({ mode: 'boolean' })` in Drizzle (existing pattern: `isActive`, `isFinal`) |
| JSON column | Custom serialization | Drizzle `text()` — JSON.stringify/parse at application layer (existing `diff`, `snapshot`, `meta` pattern in audit_logs) |
| Per-day OT detection | New DB columns or separate table | Existing `monSt`…`sunSt`, `monOt`…`sunOt` columns already capture per-day data |

---

## Common Pitfalls

### Pitfall 1: Journal Not Updated
**What goes wrong:** Migration file created but not added to `_journal.json`. Drizzle silently skips the migration on startup.
**Why it happens:** CLAUDE.md explicitly calls this out as a known gotcha.
**How to avoid:** Manually add the journal entry with `idx: 19`, matching the file tag exactly.
**Warning signs:** Column missing from schema after server restart; no migration error logged.

### Pitfall 2: `_db` Parameter Is Unused in complianceService
**What goes wrong:** `computeCompliance(_db, weekId)` has `_db` underscore-prefixed, meaning it's conventionally unused. All internal calls use `getDb()`. Adding a project lookup requires either removing the underscore and using the parameter, or calling `getDb()` inline.
**Why it happens:** Original author chose not to thread db through sub-calls.
**How to avoid:** Call `const db = getDb()` inside `computeCompliance` for the project fetch, consistent with `getPayrollWeek` and other service functions. Do NOT rename `_db` to `db` because that would break the function signature callers pass in (some tests pass `null` or a mock).

### Pitfall 3: NY OT Violation Must Use Correct Threshold
**What goes wrong:** Using `>= 8` instead of `> 8` causes a worker with exactly 8 hours to be flagged.
**Why it happens:** Off-by-one in the daily check.
**How to avoid:** The success criterion explicitly says "a worker with exactly 8 hours/day has no OT violation." Threshold is strictly greater than 8.

### Pitfall 4: `projectSettings` Column Type
**What goes wrong:** Using a Drizzle `json()` type that doesn't exist in drizzle-orm SQLite, or using a custom type that breaks migrations.
**Why it happens:** Developers assume Drizzle SQLite has a native json() type.
**How to avoid:** Use `text('project_settings')` — same as how `auditLogs.diff`, `auditLogs.snapshot`, `auditLogs.meta` are defined. JSON is stored/retrieved as a string and parsed at the application layer.

### Pitfall 5: Workers Route Zod Schema
**What goes wrong:** Adding `nysRegisteredApprentice` to the workers table but forgetting to add it to the `CreateWorkerSchema` or `UpdateWorkerSchema` in `src/server/routes/workers.ts`.
**Why it happens:** Three places to update: migration, schema.ts, and route Zod schemas.
**How to avoid:** The checklist for this phase is: (1) migration SQL, (2) schema.ts, (3) server route Zod schemas, (4) React form components.

### Pitfall 6: UpdateProjectSchema Missing NY Fields
**What goes wrong:** NY fields can be set at creation but not edited later because `UpdateProjectSchema` in `projects.ts` is a separate Zod object that doesn't include them.
**Why it happens:** The pattern for CA/WA fields only added them to `CreateProjectSchema`, not `UpdateProjectSchema`. Checking the PATCH handler is essential.
**How to avoid:** Add `nyprcNumber` and `nysContractorRegNumber` to both `CreateProjectSchema` and `UpdateProjectSchema`.

---

## Code Examples

### Example: Existing boolean column (from schema.ts)
```typescript
// Source: src/server/db/schema.ts line 90
isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
```

### Example: Existing JSON text column (from schema.ts)
```typescript
// Source: src/server/db/schema.ts line 342
diff:     text('diff'),
snapshot: text('snapshot'),
meta:     text('meta'),
```

### Example: State-conditional form section (from ProjectForm.tsx)
```typescript
// Source: src/client/components/projects/ProjectForm.tsx lines 51-52, 196-236
const isCA = stateValue?.toUpperCase() === 'CA';
const isWA = stateValue?.toUpperCase() === 'WA';
// ...
{isWA && (
  <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
    <p className="text-sm font-medium text-blue-800">Washington Project Fields</p>
    {/* inputs */}
  </div>
)}
```

### Example: Migration SQL separator pattern (from 0022_worker_profile_depth.sql)
```sql
ALTER TABLE workers ADD COLUMN address_street TEXT;
--> statement-breakpoint
ALTER TABLE workers ADD COLUMN address_city TEXT;
```

### Example: complianceService.ts — db access pattern
```typescript
// Source: src/server/services/complianceService.ts line 159
// getDb() is called inline inside service functions, not threaded from caller:
const membershipRows = await db
  .select({ project: schema.projects })
  .from(schema.projectMembers)
  // ...
// (db is the _db parameter passed in, used directly)
```

Note: In `getBatchProjectCompliance`, the `db` parameter IS used directly. In `computeCompliance`, the `_db` parameter is currently unused. The safest pattern: call `const db = getDb();` inside the function for the new project lookup, matching how `getPayrollWeek` works internally.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | vitest.config.ts (root) |
| Quick run command | `npm test -- tests/services/complianceService.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-01 | POST /api/projects accepts `state: "NY"` without error | Integration (route) | `npm test -- tests/routes/projects.test.ts` | Yes (existing) |
| STATE-01 | NY project persisted with state="NY" in DB | Integration (route) | `npm test -- tests/routes/projects.test.ts` | Yes (add test case) |
| STATE-06 | NY project row has nyprcNumber + nysContractorRegNumber columns | Integration (route) | `npm test -- tests/routes/projects.test.ts` | Yes (add test case) |
| STATE-06 | Worker row has nysRegisteredApprentice boolean | Integration (route) | `npm test -- tests/routes/workers.test.ts` | Yes (add test case) |
| STATE-04 | NY project: worker with 9 ST hours on Monday flags cwhssa-ot violation | Unit (service) | `npm test -- tests/services/complianceService.test.ts` | Yes (add test case) |
| STATE-04 | NY project: worker with exactly 8 hours/day has no violation | Unit (service) | `npm test -- tests/services/complianceService.test.ts` | Yes (add test case) |
| STATE-04 | Non-NY project: 9 hours/day does NOT flag daily OT (weekly rule applies) | Unit (service) | `npm test -- tests/services/complianceService.test.ts` | Yes (add test case) |
| NFR-01 | Migration file contains `--> statement-breakpoint` with correct spacing | Manual inspection | `grep "statement-breakpoint" src/server/db/migrations/0023_ny_schema.sql` | No — Wave 0 |
| NFR-05 | schema.ts has all 4 new columns | Manual inspection | `grep "nyprcNumber\|nysContractorRegNumber\|projectSettings\|nysRegisteredApprentice" src/server/db/schema.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/services/complianceService.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `tests/services/complianceService.test.ts` — covers STATE-04 (NY daily OT rule, boundary condition, non-NY passthrough)
- [ ] New test cases in `tests/routes/projects.test.ts` — covers STATE-01 (NY state accepted) and STATE-06 (NY project columns persisted)
- [ ] New test cases in `tests/routes/workers.test.ts` — covers STATE-06 (nysRegisteredApprentice field accepted and returned)

*(Existing test files need new `describe` blocks or `it` cases; no new files required.)*

---

## Current Codebase State (direct inspection findings)

### projects table — current columns
`id, user_id, name, state, county, contract_type, award_date, funding_type, wd_identifier, wd_mod_number, wd_locked_at, status, cslb_license, wc_policy_number, ubi_number, lni_certificate, wc_account, contractor_fein, dir_project_id, awarding_agency, contract_number, pwia_intent_id, created_at, updated_at`

**Missing (Phase 40 adds):** `nyp_rc_number`, `nys_contractor_reg_number`, `project_settings`

### workers table — current columns (after Phase 39)
`id, project_id, name, ssn_last4, ssn_encrypted, trade_union, address, address_street, address_city, address_state, address_zip, union_local, union_book_number, apprenticeship_committee, apprenticeship_reg_number, is_active, created_at, updated_at`

**Missing (Phase 40 adds):** `nys_registered_apprentice`

### state column — current implementation
`state: text('state').notNull()` — plain text, no enum constraint. Any 2-character string is accepted by the DB. The Zod schema validates `.length(2)`. **No enum change needed** in Drizzle to add NY — it just works. The `isNY` conditional in the React form is purely UI-gating.

### computeCompliance() — current project-state access
The function receives `(_db, weekId)`. It calls `getPayrollWeek(weekId)` which returns a `payrollWeeks` row (has `projectId` but NOT `project.state`). There is **no current mechanism** to get project state inside `computeCompliance`. The function must add a DB call to fetch the project after loading the week.

### Daily hours — CONFIRMED AVAILABLE
`payroll_entries` has `monSt, tueSt, wedSt, thuSt, friSt, satSt, sunSt` and `monOt, tueOt, wedOt, thuOt, friOt, satOt, sunOt`. These are already used in `complianceService.ts` lines 62–67 (summed for totalSt/totalOt). **No new columns needed** for the NY daily OT rule — per-day data is already captured.

### PayrollWeekDetailPage — violation rendering
Line 432–433: `const isCA = projectData?.data?.project?.state === 'CA';` and `const isWA = ...`. The `isNY` constant follows the same pattern. Violation badges are rendered at lines 977–979 via `violationsByEntryId` map — `cwhssa-ot` is already handled by `violationLabel()`. The NY OT violation will surface automatically once `computeCompliance` emits it.

---

## Open Questions

1. **`nysRegisteredApprentice` — show for all workers or NY projects only?**
   - REQUIREMENTS say "add `nysRegisteredApprentice` boolean to `workers` table" — it's a workers column
   - ROADMAP success criterion 3: "Workers on any project have a `nysRegisteredApprentice` boolean field visible in their profile"
   - This implies the field is on all workers (not just NY projects) — the UI shows it universally
   - Recommendation: Show the field in WorkersPage for all projects (keep it simple; Phase 41 uses it for XML output regardless of project state filter)

2. **`projectSettings` JSON column — what shape?**
   - STATE-06 says add it; NOTIF-02 says it stores notification threshold settings
   - Phase 40 only needs to add the column (nullable text); no read/write logic required for Phase 40
   - Recommendation: Add as `text('project_settings')` nullable; leave parsing/writing to NOTIF phases

3. **Violation type for NY daily OT: `'cwhssa-ot'` or new type `'ny-daily-ot'`?**
   - ROADMAP says "flags a CWHSSA OT violation"
   - SUCCESS CRITERIA says "PayrollWeekDetailPage shows the violation badge"
   - `violationLabel('cwhssa-ot')` already renders correctly in the UI
   - Recommendation: Use `'cwhssa-ot'` for Phase 40. The `WorkerViolationHistoryEntry.violationType` union is `'under-wage' | 'cwhssa-ot' | 'apprentice-ratio'` — adding `'ny-daily-ot'` would require touching the history types too. Keep it simple.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — purely DB migration + service code change + React form)

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/server/db/schema.ts` — verified all current column definitions for `projects` and `workers`
- `src/server/services/complianceService.ts` — verified `computeCompliance()` signature, daily hours summation, violation emission, absence of project-state awareness
- `src/client/components/projects/ProjectForm.tsx` — verified `isCA`/`isWA` watch pattern, CA/WA conditional section markup
- `src/server/routes/projects.ts` — verified `CreateProjectSchema`, `UpdateProjectSchema`, DB insert mapping
- `src/server/db/migrations/0022_worker_profile_depth.sql` — verified statement-breakpoint format
- `src/server/db/migrations/meta/_journal.json` — verified highest idx=18, next is idx=19
- `tests/services/complianceService.test.ts` and `tests/routes/compliance.test.ts` — verified test seeding pattern and vitest framework

### Secondary (HIGH confidence — project documentation)
- `.planning/REQUIREMENTS.md` — STATE-01, STATE-06, STATE-04, NFR-01, NFR-05 requirements verbatim
- `.planning/ROADMAP.md` — Phase 40 success criteria (lines 694–699)
- `CLAUDE.md` — migration rules, design token rules, React patterns

---

## Metadata

**Confidence breakdown:**
- DB migration pattern: HIGH — verified from existing migration files and journal
- Schema additions: HIGH — verified current column state by reading schema.ts
- ProjectForm pattern: HIGH — verified from direct file read; isCA/isWA pattern exact
- Compliance engine change: HIGH — verified computeCompliance() currently has no project.state access; daily columns confirmed present
- Violation type decision: MEDIUM — ROADMAP says "CWHSSA OT" but a new type is feasible; recommended `'cwhssa-ot'` reuse pending planner confirmation

**Research date:** 2026-04-02
**Valid until:** Stable codebase — valid until schema.ts or complianceService.ts changes
