---
phase: 39-worker-profile-depth
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/server/db/migrations/0022_worker_profile_depth.sql
  - src/server/db/migrations/meta/_journal.json
  - src/server/db/schema.ts
  - src/server/services/workerService.ts
  - src/server/routes/workers.ts
  - src/server/services/payrollService.ts
  - src/server/routes/payrollWeekClassifications.ts
  - src/server/index.ts
autonomous: true
requirements: [WORKER-01, WORKER-02, WORKER-03, WORKER-04, NFR-01, NFR-05]

must_haves:
  truths:
    - "Workers table has 8 new columns (addressStreet, addressCity, addressState, addressZip, unionLocal, unionBookNumber, apprenticeshipCommittee, apprenticeshipRegNumber)"
    - "Existing address values are backfilled into addressStreet"
    - "payroll_week_classifications table exists with unique constraint on (payrollWeekId, workerId)"
    - "Worker create/update API accepts the 8 new fields and writes them to the database"
    - "getPayrollEntriesWithWorkerDetails returns concatenated address from the 4 structured fields"
    - "POST/DELETE endpoints exist for payroll week classification overrides"
  artifacts:
    - path: "src/server/db/migrations/0022_worker_profile_depth.sql"
      provides: "SQL migration with 8 ADD COLUMN + backfill UPDATE + CREATE TABLE + CREATE UNIQUE INDEX"
      contains: "ALTER TABLE workers ADD COLUMN"
    - path: "src/server/db/schema.ts"
      provides: "Drizzle schema with 8 new worker columns + payrollWeekClassifications table"
      contains: "payrollWeekClassifications"
    - path: "src/server/services/workerService.ts"
      provides: "Updated CreateWorkerInput/UpdateWorkerInput with new fields"
      contains: "addressStreet"
    - path: "src/server/routes/workers.ts"
      provides: "Updated Zod schemas with 4 address fields replacing single address field"
      contains: "addressStreet"
    - path: "src/server/services/payrollService.ts"
      provides: "Updated getPayrollEntriesWithWorkerDetails with concatenated address and LEFT JOIN for classification override"
      contains: "addressStreet"
    - path: "src/server/routes/payrollWeekClassifications.ts"
      provides: "POST and DELETE routes for classification overrides"
      exports: ["default (router)"]
  key_links:
    - from: "src/server/db/migrations/0022_worker_profile_depth.sql"
      to: "src/server/db/migrations/meta/_journal.json"
      via: "journal registration at idx 18"
      pattern: "0022_worker_profile_depth"
    - from: "src/server/db/schema.ts"
      to: "src/server/services/workerService.ts"
      via: "Drizzle column references in insert/update"
      pattern: "workers\\.addressStreet"
    - from: "src/server/routes/payrollWeekClassifications.ts"
      to: "src/server/index.ts"
      via: "router registration with app.use"
      pattern: "payrollWeekClassifications"
---

<objective>
Add structured address fields, union info, apprenticeship fields to the workers table; create the payroll_week_classifications junction table; update all server-side services and routes to use the new schema.

Purpose: Establish the complete backend data model and API surface for Phase 39 so the React UI (Plan 02) can build against stable endpoints.
Output: Migration file, updated schema, updated services, updated routes, new classification override endpoints.
</objective>

<execution_context>
@C:/Users/glcar/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/glcar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Users/glcar/prevailing-wage/.planning/PROJECT.md
@C:/Users/glcar/prevailing-wage/.planning/ROADMAP.md
@C:/Users/glcar/prevailing-wage/.planning/STATE.md
@C:/Users/glcar/prevailing-wage/.planning/phases/39-worker-profile-depth/39-RESEARCH.md

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From src/server/db/schema.ts (lines 71-100):
```typescript
export const workers = sqliteTable('workers', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ssnLast4: text('ssn_last4'),
  ssnEncrypted: text('ssn_encrypted'),
  tradeUnion: text('trade_union'),
  address: text('address'),   // keep for backward compat — stop writing for new records
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const workerClassifications = sqliteTable('worker_classifications', {
  id: text('id').primaryKey(),
  workerId: text('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tradeCode: text('trade_code').notNull(),
  tradeDescription: text('trade_description').notNull(),
  laborType: text('labor_type').notNull().$type<'journeyworker' | 'apprentice' | 'foreman'>(),
  apprenticePercent: integer('apprentice_percent'),
  programName: text('program_name'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  waManualRate: real('wa_manual_rate'),
  waTradeCode: text('wa_trade_code'),
  createdAt: text('created_at').notNull(),
});
```

From src/server/services/workerService.ts (lines 17-30):
```typescript
export interface CreateWorkerInput extends AuditContext {
  name: string;
  ssn?: string;
  tradeUnion?: string | null;
  address?: string | null;
}

export interface UpdateWorkerInput extends AuditContext {
  workerId: string;
  name?: string;
  ssn?: string | null;
  tradeUnion?: string | null;
  address?: string | null;
}
```

From src/server/routes/workers.ts (lines 20-32):
```typescript
const CreateWorkerSchema = z.object({
  name: z.string().min(1).max(200),
  ssn: z.string().length(9).regex(/^\d{9}$/, 'SSN must contain only digits').optional(),
  tradeUnion: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
});

const UpdateWorkerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ssn: z.string().length(9).regex(/^\d{9}$/, 'SSN must contain only digits').optional().nullable(),
  tradeUnion: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});
```

From src/server/services/payrollService.ts (lines 379-402):
```typescript
export async function getPayrollEntriesWithWorkerDetails(weekId: string) {
  const db = getDb();
  const rows = await db
    .select({
      entry: payrollEntries,
      workerName: workers.name,
      workerSsnLast4: workers.ssnLast4,
      workerSsnEncrypted: workers.ssnEncrypted,
      workerAddress: workers.address,
      tradeDescription: workerClassifications.tradeDescription,
      tradeCode: workerClassifications.tradeCode,
      waTradeCode: workerClassifications.waTradeCode,
      laborType: workerClassifications.laborType,
      programName: workerClassifications.programName,
    })
    .from(payrollEntries)
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .innerJoin(
      workerClassifications,
      eq(payrollEntries.classificationId, workerClassifications.id),
    )
    .where(eq(payrollEntries.payrollWeekId, weekId));
  return rows;
}
```

From src/server/index.ts — route registration pattern:
```typescript
import workersRouter from './routes/workers.js';
app.use('/api/projects', workersRouter);
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write SQL migration + register in journal</name>
  <files>src/server/db/migrations/0022_worker_profile_depth.sql, src/server/db/migrations/meta/_journal.json</files>
  <action>
Create `src/server/db/migrations/0022_worker_profile_depth.sql` with these statements separated by `--> statement-breakpoint` (one space before `statement-breakpoint`, per NFR-01):

1. `ALTER TABLE workers ADD COLUMN address_street TEXT;`
2. `ALTER TABLE workers ADD COLUMN address_city TEXT;`
3. `ALTER TABLE workers ADD COLUMN address_state TEXT;`
4. `ALTER TABLE workers ADD COLUMN address_zip TEXT;`
5. `ALTER TABLE workers ADD COLUMN union_local TEXT;`
6. `ALTER TABLE workers ADD COLUMN union_book_number TEXT;`
7. `ALTER TABLE workers ADD COLUMN apprenticeship_committee TEXT;`
8. `ALTER TABLE workers ADD COLUMN apprenticeship_reg_number TEXT;`
9. `UPDATE workers SET address_street = address WHERE address IS NOT NULL;`
10. `CREATE TABLE payroll_week_classifications (id TEXT PRIMARY KEY NOT NULL, payroll_week_id TEXT NOT NULL REFERENCES payroll_weeks(id) ON DELETE CASCADE, worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE, classification_id TEXT NOT NULL REFERENCES worker_classifications(id) ON DELETE CASCADE, created_at TEXT NOT NULL);`
11. `CREATE UNIQUE INDEX pwc_unique ON payroll_week_classifications(payroll_week_id, worker_id);`

Each statement separated by a newline, then `--> statement-breakpoint`, then a newline. No trailing statement-breakpoint after the last statement.

Then read `src/server/db/migrations/meta/_journal.json` and add a new entry at the end of the `entries` array:
```json
{ "idx": 18, "version": "7", "when": 1743552000000, "tag": "0022_worker_profile_depth", "breakpoints": true }
```
Use a `when` timestamp consistent with the current date (2026-04-02). The exact ms value is not critical but should be reasonable (e.g., `1743552000000`).
  </action>
  <verify>
    <automated>cd C:/Users/glcar/prevailing-wage && cat src/server/db/migrations/0022_worker_profile_depth.sql | head -30 && node -e "const j=require('./src/server/db/migrations/meta/_journal.json'); const e=j.entries[j.entries.length-1]; console.log(e.idx===18 && e.tag==='0022_worker_profile_depth' ? 'PASS' : 'FAIL: '+JSON.stringify(e))"</automated>
  </verify>
  <done>Migration file exists with 11 SQL statements separated by `--> statement-breakpoint`. Journal entry at idx 18 with tag `0022_worker_profile_depth` and `breakpoints: true`.</done>
</task>

<task type="auto">
  <name>Task 2: Update Drizzle schema with new columns + payrollWeekClassifications table</name>
  <files>src/server/db/schema.ts</files>
  <action>
Read `src/server/db/schema.ts`. In the `workers` table definition (after the existing `address` column, before `isActive`), add these 8 new columns:

```typescript
addressStreet: text('address_street'),
addressCity: text('address_city'),
addressState: text('address_state'),
addressZip: text('address_zip'),
unionLocal: text('union_local'),
unionBookNumber: text('union_book_number'),
apprenticeshipCommittee: text('apprenticeship_committee'),
apprenticeshipRegNumber: text('apprenticeship_reg_number'),
```

Keep the existing `address` column in place (add-only policy per CLAUDE.md).

After the `workerClassifications` table definition (around line 100), add the new `payrollWeekClassifications` table:

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

Ensure `uniqueIndex` is imported from `drizzle-orm/sqlite-core` (check existing imports — if only `index` is imported, add `uniqueIndex`). Also ensure `payrollWeeks` is referenced correctly (it should already be defined above in the schema file).
  </action>
  <verify>
    <automated>cd C:/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>`npx tsc --noEmit` passes with zero errors. Schema file contains all 8 new worker columns and the `payrollWeekClassifications` table with `uniqueIndex`.</done>
</task>

<task type="auto">
  <name>Task 3: Update workerService.ts input types + create/update functions</name>
  <files>src/server/services/workerService.ts</files>
  <action>
Read `src/server/services/workerService.ts`. Update `CreateWorkerInput` to add 8 new optional fields:

```typescript
export interface CreateWorkerInput extends AuditContext {
  name: string;
  ssn?: string;
  tradeUnion?: string | null;
  address?: string | null;  // keep for type compat but stop writing
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  unionLocal?: string | null;
  unionBookNumber?: string | null;
  apprenticeshipCommittee?: string | null;
  apprenticeshipRegNumber?: string | null;
}
```

Update `UpdateWorkerInput` similarly (add the same 8 optional fields).

In `createWorker()` function: find the `db.insert(workers).values({...})` call. Add the 8 new fields to the values object:
- `addressStreet: input.addressStreet ?? null`
- `addressCity: input.addressCity ?? null`
- `addressState: input.addressState ?? null`
- `addressZip: input.addressZip ?? null`
- `unionLocal: input.unionLocal ?? null`
- `unionBookNumber: input.unionBookNumber ?? null`
- `apprenticeshipCommittee: input.apprenticeshipCommittee ?? null`
- `apprenticeshipRegNumber: input.apprenticeshipRegNumber ?? null`

**Stop writing the old `address` column** — remove `address: input.address ?? null` from the insert values (or set it to `null`). New records should only use the structured fields.

In `updateWorker()` function: find the `db.update(workers).set({...})` call. Add the 8 new fields to the set object, following the existing pattern (only include if defined):
- `...(input.addressStreet !== undefined && { addressStreet: input.addressStreet })`
- Same pattern for all 8 fields.

Remove the `address` field from the update set (stop writing it).

Import `workers` table reference if not already imported (it should be via existing schema import).
  </action>
  <verify>
    <automated>cd C:/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>`npx tsc --noEmit` passes. `CreateWorkerInput` and `UpdateWorkerInput` have 8 new fields. `createWorker()` writes new fields and stops writing `address`. `updateWorker()` writes new fields and stops writing `address`.</done>
</task>

<task type="auto">
  <name>Task 4: Update workers.ts route Zod schemas</name>
  <files>src/server/routes/workers.ts</files>
  <action>
Read `src/server/routes/workers.ts`. Update `CreateWorkerSchema`:
- Remove `address: z.string().max(500).optional()`
- Add:
  - `addressStreet: z.string().max(500).optional()`
  - `addressCity: z.string().max(200).optional()`
  - `addressState: z.string().max(50).optional()`
  - `addressZip: z.string().max(20).optional()`
  - `unionLocal: z.string().max(200).optional()`
  - `unionBookNumber: z.string().max(100).optional()`
  - `apprenticeshipCommittee: z.string().max(200).optional()`
  - `apprenticeshipRegNumber: z.string().max(100).optional()`

Update `UpdateWorkerSchema` similarly:
- Remove `address: z.string().max(500).optional().nullable()`
- Add the same 8 fields but with `.optional().nullable()` (matching the update pattern).

In the POST handler (around line 153 where `body` is used to call the service), ensure the new fields from `body` are passed through to the service. The existing pattern passes the full `body` object — verify this still works. If the handler destructures specific fields, add the 8 new ones.

In the PUT handler (around line 181), same — ensure new fields pass through to `updateWorker()`.

Also update the GET handler that returns worker data (the route that fetches workers and assembles classifications). Ensure the response includes the new columns from the workers table. If the handler selects specific columns, add the 8 new ones. If it uses `select()` without column restrictions (selecting all), no change needed.
  </action>
  <verify>
    <automated>cd C:/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>`npx tsc --noEmit` passes. Zod schemas accept 8 new fields. Route handlers pass new fields to service. GET response includes new fields.</done>
</task>

<task type="auto">
  <name>Task 5: Update payrollService.ts getPayrollEntriesWithWorkerDetails</name>
  <files>src/server/services/payrollService.ts</files>
  <action>
Read `src/server/services/payrollService.ts`, specifically the `getPayrollEntriesWithWorkerDetails` function (line 379).

**Address concatenation (WORKER-01):** Replace `workerAddress: workers.address` in the select with a computed concatenation of the 4 structured address fields. Since Drizzle ORM does not have a built-in `CONCAT_WS` for SQLite, use `sql` tagged template:

```typescript
import { sql } from 'drizzle-orm';
```

Replace:
```typescript
workerAddress: workers.address,
```
With a raw SQL expression that concatenates non-null address parts:
```typescript
workerAddress: sql<string>`COALESCE(${workers.addressStreet}, '') || CASE WHEN ${workers.addressCity} IS NOT NULL THEN ', ' || ${workers.addressCity} ELSE '' END || CASE WHEN ${workers.addressState} IS NOT NULL THEN ', ' || ${workers.addressState} ELSE '' END || CASE WHEN ${workers.addressZip} IS NOT NULL THEN ' ' || ${workers.addressZip} ELSE '' END`.as('worker_address'),
```

Alternatively, a simpler approach: select all 4 fields individually and let the caller concatenate. Check how `workerAddress` is consumed downstream — if it is used as a single string in export.ts or XML generators, the SQL concatenation is cleaner. If the downstream code can be updated, individual fields are simpler. Given that the research confirms `workerAddress` is used in CA eCPR XML as a single string, use the SQL concatenation approach.

**Classification override LEFT JOIN (WORKER-04):** This is the most delicate change. Add a LEFT JOIN on `payrollWeekClassifications` and a second LEFT JOIN on `workerClassifications` (aliased) for the override classification. Use Drizzle's `alias` function or raw SQL.

Recommended approach using Drizzle `alias`:
```typescript
import { alias } from 'drizzle-orm/sqlite-core';

// Inside the function:
const overrideClassifications = alias(workerClassifications, 'override_classifications');
```

Then add to the query chain:
```typescript
.leftJoin(
  payrollWeekClassifications,
  and(
    eq(payrollWeekClassifications.payrollWeekId, payrollEntries.payrollWeekId),
    eq(payrollWeekClassifications.workerId, payrollEntries.workerId),
  ),
)
.leftJoin(
  overrideClassifications,
  eq(payrollWeekClassifications.classificationId, overrideClassifications.id),
)
```

Update the select to use COALESCE for overridable fields:
```typescript
tradeDescription: sql<string>`COALESCE(${overrideClassifications.tradeDescription}, ${workerClassifications.tradeDescription})`.as('trade_description'),
tradeCode: sql<string>`COALESCE(${overrideClassifications.tradeCode}, ${workerClassifications.tradeCode})`.as('trade_code'),
laborType: sql<string>`COALESCE(${overrideClassifications.laborType}, ${workerClassifications.laborType})`.as('labor_type'),
programName: sql<string | null>`COALESCE(${overrideClassifications.programName}, ${workerClassifications.programName})`.as('program_name'),
```

Keep `waTradeCode` with COALESCE too:
```typescript
waTradeCode: sql<string | null>`COALESCE(${overrideClassifications.waTradeCode}, ${workerClassifications.waTradeCode})`.as('wa_trade_code'),
```

Also add the override classification ID to the select (useful for Plan 02 UI):
```typescript
overrideClassificationId: payrollWeekClassifications.classificationId,
```

Ensure `and` is imported from `drizzle-orm` (check existing imports). Ensure `payrollWeekClassifications` is imported from the schema.

**CRITICAL:** Use LEFT JOIN (not INNER JOIN) for `payrollWeekClassifications` — most entries will NOT have an override. An INNER JOIN would exclude all non-override entries from the result set.
  </action>
  <verify>
    <automated>cd C:/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>`npx tsc --noEmit` passes. `workerAddress` is computed from 4 structured fields. Classification fields use COALESCE with override LEFT JOIN. `overrideClassificationId` included in select.</done>
</task>

<task type="auto">
  <name>Task 6: Create payrollWeekClassifications route + register in index.ts</name>
  <files>src/server/routes/payrollWeekClassifications.ts, src/server/index.ts</files>
  <action>
**Create `src/server/routes/payrollWeekClassifications.ts`:**

Follow the existing route pattern (see workers.ts, audit.ts). Structure:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { assertProjectAccess } from '../middleware/projectAccess.js';
import { validate } from '../middleware/validate.js';
import { getDb } from '../db/index.js';
import { payrollWeekClassifications } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
```

(Verify exact import paths by reading an existing route file like `workers.ts` for `assertProjectAccess` import path and `validate` middleware import path.)

Router setup:
```typescript
const router = Router();
router.use(requireAuth);
```

**POST `/:projectId/payroll-week-classifications`:**
- Zod schema: `{ payrollWeekId: z.string().uuid(), workerId: z.string().uuid(), classificationId: z.string().uuid() }`
- Call `assertProjectAccess(req.params.projectId, req.user.id, db)` (per NFR-03)
- DELETE existing override for this worker+week pair: `db.delete(payrollWeekClassifications).where(and(eq(payrollWeekClassifications.payrollWeekId, body.payrollWeekId), eq(payrollWeekClassifications.workerId, body.workerId)))`
- INSERT new row: `db.insert(payrollWeekClassifications).values({ id: uuidv4(), payrollWeekId: body.payrollWeekId, workerId: body.workerId, classificationId: body.classificationId, createdAt: new Date().toISOString() })`
- Return 201 with the inserted row

**DELETE `/:projectId/payroll-week-classifications/:id`:**
- Call `assertProjectAccess(req.params.projectId, req.user.id, db)` (per NFR-03)
- `db.delete(payrollWeekClassifications).where(eq(payrollWeekClassifications.id, req.params.id))`
- Return 204

Export default router.

**Update `src/server/index.ts`:**
- Add import: `import { payrollWeekClassificationsRouter } from './routes/payrollWeekClassifications.js';`
  (Use named export if that's what the route file exports, or default import — match the pattern used by other routes. Check if existing routes use named or default exports. Workers uses default, most others use named. Use named export for consistency with the majority.)
- Add registration: `app.use('/api/projects', payrollWeekClassificationsRouter);`
  (Placed after the workersRouter registration line since it's project-scoped.)

**Note on assertProjectAccess import:** Check how other route files import it. In audit.ts or workers.ts, find the exact import path. It may be a function in a shared module like `src/server/middleware/projectAccess.ts` or defined inline in route files. Read the actual import to get the correct path.
  </action>
  <verify>
    <automated>cd C:/Users/glcar/prevailing-wage && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>`npx tsc --noEmit` passes. POST endpoint creates/replaces classification overrides. DELETE endpoint removes overrides. Both routes call assertProjectAccess before data access. Router registered in index.ts.</done>
</task>

</tasks>

<verification>
After all 6 tasks complete:
1. `npx tsc --noEmit` — zero TypeScript errors
2. Migration file has 11 SQL statements with correct `--> statement-breakpoint` separators
3. Journal entry at idx 18 with tag `0022_worker_profile_depth`
4. Schema.ts has 8 new worker columns + payrollWeekClassifications table
5. workerService writes 8 new fields, stops writing old `address`
6. Route Zod schemas accept 8 new fields
7. payrollService concatenates 4 address fields and LEFT JOINs override classification
8. New route file registered and type-checks
</verification>

<success_criteria>
- `npx tsc --noEmit` passes with zero errors after every task
- All 8 new columns defined in migration, schema, service, and route layers
- payroll_week_classifications table fully defined in migration and schema
- getPayrollEntriesWithWorkerDetails uses structured address fields and COALESCE override pattern
- POST/DELETE classification override endpoints exist and are project-access-guarded
- Old `address` column retained in schema but no longer written by service
</success_criteria>

<output>
After completion, create `.planning/phases/39-worker-profile-depth/39-01-SUMMARY.md`
</output>
