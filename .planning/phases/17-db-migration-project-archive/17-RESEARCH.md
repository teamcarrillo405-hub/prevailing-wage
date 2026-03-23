# Phase 17: DB Migration + Project Archive — Research

**Researched:** 2026-03-23
**Domain:** SQLite schema migration (Drizzle), Express REST route extension, React query mutation + UI state
**Confidence:** HIGH

## Summary

Phase 17 has two independent deliverables. First, it runs a DB migration that adds four columns to
`payrollWeeks` (`submitted_at`, `submitted_to`, `amendment_number`, `original_week_id`) — columns
that later phases (19 Submission Tracking, 21 Amendment Workflow) depend on. Second, it implements
the full project archive / restore feature using the `projects.status` column that already exists in
`schema.ts` as `'active' | 'closed'`.

The archive half is almost entirely plumbing work: the server already has a `DELETE /api/projects/:id`
route that soft-deletes (sets `status = 'closed'`) and a `PATCH /api/projects/:id` route that can
restore it. The `GET /api/projects` list route does not yet filter by status — that is the main server
change needed. The client needs an Archive button on `ProjectDetailPage`, an "Archived" badge on
`ProjectCard`, a "Show Archived" toggle on `DashboardPage`, and a compliance pre-check advisory before
confirming archive.

The migration is the higher-risk deliverable. The journal has 5 entries (idx 0-4). The next tag must
be registered at `idx: 5`. If the journal entry is omitted, Drizzle silently skips the migration, and
new columns are present in TypeScript types but absent at runtime.

**Primary recommendation:** Write the migration first, verify columns in sqlite_master, then implement
archive UI. Keep the archive flow as advisory-only: never block based on compliance violations, only
show a warning confirmation modal.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRJ-01 | User can archive a project, removing it from the active dashboard view | `GET /api/projects` needs `?status=active` default filter; `DELETE /api/projects/:id` already soft-deletes; Dashboard re-fetches on mutation invalidation |
| PRJ-02 | User can toggle display of archived projects on the dashboard | Client-side `showArchived` toggle; pass `?status=all` or `?status=active` query param to existing list endpoint; `Badge` variant for archived state |
| PRJ-03 | System warns if a project has open compliance violations before archiving (advisory, not a hard block) | Reuse existing `GET /api/compliance/project/:projectId` endpoint response (`badge === 'violations'`) to gate confirmation modal |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | ORM + migration runner | Already used throughout; `migrate()` called in test helper |
| better-sqlite3 | ^12.8.0 | SQLite driver | Only driver in use; no change needed |
| React + TanStack Query | 19 / ^5.91.0 | Client state + data fetching | `useMutation` + `invalidateQueries` already used for all server writes |
| React Router DOM | ^7.13.1 | Routing | Existing; no new routes needed for archive |
| Zod + Express | ^3.x / ^4.x | Input validation | `validate(schema)` middleware already applied to projects routes |

### No New Dependencies

This phase requires zero new packages. All UI primitives needed (`Badge`, `Button`, `Card`,
`PageHeader`, `EmptyState`) are already installed and used in the codebase.

**Installation:** none required.

---

## Architecture Patterns

### Recommended Project Structure — Files Modified

```
src/server/
  db/
    migrations/
      0009_payroll_week_submission_amendment.sql   ← NEW migration file
      meta/_journal.json                           ← ADD entry at idx:5
    schema.ts                                      ← ADD 4 columns to payrollWeeks
  routes/
    projects.ts                                    ← MODIFY GET /api/projects list filter
src/client/
  pages/
    DashboardPage.tsx                              ← ADD showArchived toggle, archive-aware list
  components/projects/
    ProjectCard.tsx                                ← ADD "Archived" badge for status=closed
  pages/
    ProjectDetailPage.tsx                          ← ADD Archive / Restore button + compliance advisory
```

### Pattern 1: Drizzle Add-Only Migration

**What:** SQL file with `ALTER TABLE ... ADD COLUMN` statements plus a matching journal entry.
**When to use:** Adding nullable or defaulted columns to an existing table. Never dropping or renaming.
**Example:**
```sql
-- 0009_payroll_week_submission_amendment.sql
ALTER TABLE payroll_weeks ADD COLUMN submitted_at TEXT;
ALTER TABLE payroll_weeks ADD COLUMN submitted_to TEXT;
ALTER TABLE payroll_weeks ADD COLUMN amendment_number INTEGER;
ALTER TABLE payroll_weeks ADD COLUMN original_week_id TEXT REFERENCES payroll_weeks(id);
```

Journal entry (append to `entries` array in `meta/_journal.json`):
```json
{
  "idx": 5,
  "version": "6",
  "when": 1774100000000,
  "tag": "0009_payroll_week_submission_amendment",
  "breakpoints": true
}
```

Post-migration verification query (run against the live DB, not just test DB):
```sql
SELECT sql FROM sqlite_master WHERE name = 'payroll_weeks';
```
Confirm all four columns appear in the `CREATE TABLE` output.

### Pattern 2: Status-Filtered List Route

**What:** The `GET /api/projects` route currently returns all projects for the user. It needs a
`?status=` query param defaulting to `active`.
**When to use:** Any time a list endpoint needs to support filtered vs. full views without breaking
existing consumers (existing calls without the param get the active-only default).

```typescript
// Source: existing projects.ts pattern — extend GET / route
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  const statusFilter = req.query.status as string | undefined;

  // Default to active-only; pass 'all' to include closed projects
  const conditions = [eq(projects.userId, userId)];
  if (!statusFilter || statusFilter === 'active') {
    conditions.push(eq(projects.status, 'active'));
  }
  // statusFilter === 'all' → no additional status condition

  const userProjects = await db
    .select()
    .from(projects)
    .where(and(...conditions));

  res.json({ data: { projects: userProjects } });
});
```

### Pattern 3: Archive / Restore with Compliance Advisory

**What:** Archive = `DELETE /api/projects/:id` (already exists, sets `status = 'closed'`).
Restore = `PATCH /api/projects/:id` with `{ status: 'active' }` (already exists in `UpdateProjectSchema`).
Advisory = client-side compliance check before surfacing the confirmation modal.

**When to use:** Any destructive-feeling action that has downstream compliance implications.

```typescript
// Client-side advisory pattern (ProjectDetailPage.tsx)
// Step 1: user clicks "Archive"
// Step 2: fetch GET /api/compliance/project/:id — check badge === 'violations'
// Step 3: if violations exist, show advisory modal ("This project has open violations...")
//         with two options: "Archive Anyway" | "Cancel"
//         if no violations, show simple confirmation: "Archive this project?"
// Step 4: on confirm — call DELETE /api/projects/:id, invalidate ['projects'] query key

const archiveMutation = useMutation({
  mutationFn: () => api.delete(`/projects/${id}`),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    navigate('/');
  },
});
```

Key point: the advisory is NEVER a server-side 409 block. PRJ-03 says "advisory, not a hard block."
The existing `complianceRouter.get('/project/:projectId')` returns `{ badge, weekCount, lastWeekNumber }` —
`badge === 'violations'` is sufficient to gate the advisory modal.

### Pattern 4: Dashboard showArchived Toggle

**What:** A client-side boolean toggle in `DashboardPage.tsx` that changes the `status` query
parameter sent to `GET /api/projects`.
**When to use:** Simple include/exclude toggle over a list that the server already supports filtering.

```typescript
// DashboardPage.tsx — extends existing useQuery
const [showArchived, setShowArchived] = useState(false);

const { data, isLoading, isError } = useQuery({
  queryKey: ['projects', showArchived ? 'all' : 'active'],
  queryFn: () =>
    api.get<{ data: { projects: Project[] } }>(
      showArchived ? '/projects?status=all' : '/projects'
    ),
});
```

Note: the query key must include the `showArchived` flag so TanStack Query uses two separate cache
slots — one for active-only, one for all. Without this, toggling off archived would show stale
all-projects data.

### Anti-Patterns to Avoid

- **Logging `status=closed` projects as hard-deleted:** The DELETE route already does a soft-delete.
  Never add a real `DELETE FROM projects` code path. 29 CFR Part 3 records retention applies.
- **Blocking archive on server when violations exist:** PRJ-03 is advisory only. A server-side 409
  block would prevent legitimate project closures. The advisory lives entirely on the client.
- **Using `useState` for query key without the status flag:** Causes stale cache reads when toggling
  the show-archived state. Always include the flag in the query key array.
- **Skipping the journal entry:** If `_journal.json` does not include idx:5, Drizzle's migrator
  skips `0009_*` silently. The TypeScript types will include the new columns, but all runtime
  reads will return `undefined`. This is the highest-risk pitfall for this phase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compliance pre-check | Custom compliance query | `GET /api/compliance/project/:id` (already exists) | Returns `badge` field; `badge === 'violations'` is the only signal needed |
| Status-based filtering | Custom filter middleware | Extend existing `GET /api/projects` with `?status=` param | Route already has ownership check and correct response shape |
| Archive badge | New Badge variant | `Badge variant="neutral"` with "Archived" label | Neutral variant matches visual hierarchy; closed ≠ violation |
| Restore action | New endpoint | `PATCH /api/projects/:id` with `{ status: 'active' }` | `UpdateProjectSchema` already accepts `status` field |
| Migration | Drizzle `db:generate` command | Handwritten SQL + manual journal entry | `db:generate` diffs schema.ts — works correctly, but manual SQL is the established project pattern (see 0003_workers_address.sql, 0008_program_name.sql) |

**Key insight:** Every server primitive this phase needs already exists. The work is wiring UI state
to existing endpoints and running one migration.

---

## Common Pitfalls

### Pitfall 1: Migration Journal Not Updated

**What goes wrong:** New SQL file exists in `migrations/` but `_journal.json` has no entry for it.
Drizzle's `migrate()` ignores files not in the journal. Test DB (in-memory) runs migrations fresh on
every test run — if the journal entry is missing, tests also fail to pick up the new columns.

**Why it happens:** Developers write the SQL file and forget the JSON.

**How to avoid:** Always update both files atomically. Immediately after running tests, verify with
`SELECT sql FROM sqlite_master WHERE name = 'payroll_weeks'` against the development DB.

**Warning signs:** TypeScript reports the new column is available on the type, but a console.log of
the fetched row shows `undefined` for the new fields at runtime.

### Pitfall 2: Query Cache Stale After Archive / Restore

**What goes wrong:** User archives a project. Dashboard still shows it. User restores it. Project
detail page shows it as still closed.

**Why it happens:** TanStack Query caches by query key. Mutations that change project status must
invalidate both `['projects']` and `['projects', id]` cache entries.

**How to avoid:** In `onSuccess` of archive/restore mutations, call:
```typescript
queryClient.invalidateQueries({ queryKey: ['projects'] });
// if staying on detail page after restore:
queryClient.invalidateQueries({ queryKey: ['projects', id] });
```

### Pitfall 3: Archive Blocks on Server (Incorrectly)

**What goes wrong:** Developer adds a 409 check server-side to prevent archiving projects with open
violations. PRJ-03 requires advisory only — a server block would fail the requirement.

**Why it happens:** Conflating "warn before dangerous action" with "prevent action."

**How to avoid:** Compliance advisory lives only in the client confirmation modal. Server `DELETE`
route remains a simple soft-delete with no compliance check.

### Pitfall 4: showArchived Toggle Breaks New Project Form

**What goes wrong:** User creates a project with the "Show Archived" toggle on. New project is
`status=active` but current query fetches `?status=all`, so the new project appears correctly.
But if toggle is off after creation, new project appears missing until refresh.

**Why it happens:** The `onSuccess` callback in `ProjectForm` invalidates `['projects']` but the
dashboard query key is now `['projects', 'all']` or `['projects', 'active']` depending on toggle.

**How to avoid:** Use a consistent query key shape — `['projects', showArchived ? 'all' : 'active']`
— and in `ProjectForm.onSuccess`, invalidate both: `queryClient.invalidateQueries({ queryKey: ['projects'] })`.
TanStack Query's `invalidateQueries` with a partial key prefix invalidates all matching keys.

### Pitfall 5: DashboardPage Shows Archived Projects With No Visual Distinction

**What goes wrong:** "Show Archived" reveals archived projects but they look identical to active ones.
User cannot tell which are archived.

**Why it happens:** `ProjectCard` renders all projects the same regardless of `status` field.

**How to avoid:** `ProjectCard` must check `project.status === 'closed'` and render an "Archived"
badge. The `project.status` field is already on the `Project` interface returned by the API.

---

## Code Examples

### Add-Only Migration (verified pattern from existing codebase)

```sql
-- Source: src/server/db/migrations/0003_workers_address.sql (established pattern)
-- 0009_payroll_week_submission_amendment.sql
ALTER TABLE payroll_weeks ADD COLUMN submitted_at TEXT;
ALTER TABLE payroll_weeks ADD COLUMN submitted_to TEXT;
ALTER TABLE payroll_weeks ADD COLUMN amendment_number INTEGER;
ALTER TABLE payroll_weeks ADD COLUMN original_week_id TEXT REFERENCES payroll_weeks(id);
```

### schema.ts — payrollWeeks Extended

```typescript
// Source: src/server/db/schema.ts — current table, extend with 4 columns
export const payrollWeeks = sqliteTable('payroll_weeks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  weekEndingDate: text('week_ending_date').notNull(),
  payrollNumber: integer('payroll_number').notNull(),
  isFinal: integer('is_final', { mode: 'boolean' }).notNull().default(false),
  // Phase 17 migration columns — nullable, for Phases 19 and 21
  submittedAt: text('submitted_at'),
  submittedTo: text('submitted_to'),
  amendmentNumber: integer('amendment_number'),
  originalWeekId: text('original_week_id').references((): AnySQLiteColumn => payrollWeeks.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

Note: self-referencing FK on `originalWeekId` requires `AnySQLiteColumn` type import from
`drizzle-orm/sqlite-core` — the pattern used in the existing schema for forward references.

### Compliance Advisory Modal Pattern

```typescript
// ProjectDetailPage.tsx — advisory-only archive flow
const [archiveModalOpen, setArchiveModalOpen] = useState(false);
const [complianceWarning, setComplianceWarning] = useState(false);

async function handleArchiveClick() {
  // Fetch compliance summary — reuse cached result if available
  const summary = await queryClient.fetchQuery({
    queryKey: ['compliance-summary', id],
    queryFn: async () => {
      const res = await fetch(`/api/compliance/project/${id}`);
      return res.json();
    },
    staleTime: 60_000,
  });
  setComplianceWarning(summary?.badge === 'violations');
  setArchiveModalOpen(true);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-delete projects | Soft-delete (`status='closed'`) | Baked into v1.0 schema | Correct per 29 CFR Part 3 — this phase exposes the existing mechanism to the user |
| Fetch all projects, filter client-side | `?status=` server-side param with active-only default | Phase 17 | Keeps dashboard clean without fetching closed project data by default |

**Deprecated/outdated:**
- None for this phase. The archive mechanism has always been present; Phase 17 exposes it.

---

## Open Questions

1. **Self-referencing FK syntax for `originalWeekId` in schema.ts**
   - What we know: Drizzle supports self-referencing FKs via a function form: `.references((): AnySQLiteColumn => payrollWeeks.id)`
   - What's unclear: Whether the existing `drizzle-orm` version installed (^0.45.1) needs the full `AnySQLiteColumn` import or accepts a simpler form
   - Recommendation: Add `originalWeekId` as a plain `text()` column without FK enforcement in schema.ts; add the REFERENCES clause only in the SQL migration. The FK is enforced at the DB level regardless.

2. **Restore from DashboardPage vs. ProjectDetailPage**
   - What we know: The success criteria says "user can restore an archived project back to active status" but does not specify where the Restore button lives
   - What's unclear: Whether the restore button should appear on the dashboard (in the archived project card) or only on the detail page
   - Recommendation: Place the Restore button on `ProjectDetailPage` only — navigating to an archived project and restoring it is a deliberate two-step action that prevents accidental restores.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | package.json (`"test": "vitest run"`) |
| Quick run command | `npx vitest run tests/routes/projects.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRJ-01 | `GET /api/projects` returns only active projects by default | unit/route | `npx vitest run tests/routes/projects.test.ts` | ✅ (extend existing test file) |
| PRJ-01 | Archive action sets status to closed and project disappears from active list | route | `npx vitest run tests/routes/projects.test.ts` | ✅ Wave 0 new describe block |
| PRJ-02 | `GET /api/projects?status=all` returns both active and closed projects | route | `npx vitest run tests/routes/projects.test.ts` | ✅ Wave 0 new describe block |
| PRJ-02 | `PATCH /api/projects/:id` with `{ status: 'active' }` restores a closed project | route | `npx vitest run tests/routes/projects.test.ts` | ✅ existing PATCH test covers status mutation |
| PRJ-03 | Advisory only — no 409 from archive route when violations exist | route | `npx vitest run tests/routes/projects.test.ts` | ✅ Wave 0 (verify DELETE does not check compliance) |
| Migration | `payrollWeeks` has all 4 new columns post-migration | DB | `npx vitest run` (in-memory DB runs migrate() in beforeAll) | ✅ Wave 0 new migration test |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/routes/projects.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/routes/projects.test.ts` — add describe block: `GET /api/projects?status=active|all` — covers PRJ-01, PRJ-02
- [ ] `tests/routes/projects.test.ts` — add describe block: `DELETE /api/projects/:id` advisory (no compliance block) — covers PRJ-03
- [ ] Migration columns test: verify `submitted_at`, `submitted_to`, `amendment_number`, `original_week_id` exist post-migrate — can be a lightweight test in a new `tests/db/migration.test.ts` or inline in existing payroll route tests

---

## Sources

### Primary (HIGH confidence)

- `src/server/db/schema.ts` — confirmed `projects.status` column exists as `'active' | 'closed'`; `payrollWeeks` has no submission or amendment columns today
- `src/server/db/migrations/meta/_journal.json` — current highest idx is 4 (tag: `0008_program_name`); next migration must use idx 5
- `src/server/routes/projects.ts` — confirmed `DELETE` does soft-delete; `PATCH` accepts `status`; `GET /` has no status filter yet; `UpdateProjectSchema` already includes `status: z.enum(['active', 'closed'])`
- `src/server/routes/compliance.ts` — confirmed `GET /api/compliance/project/:projectId` returns `{ badge, weekCount, lastWeekNumber }` — exactly the advisory signal needed for PRJ-03
- `src/client/pages/DashboardPage.tsx` — current query fetches `/projects` without status filter; `Project` interface includes `status` field
- `src/client/pages/ProjectDetailPage.tsx` — renders `project.status` as plain text; no archive/restore controls yet
- `src/client/components/projects/ProjectCard.tsx` — renders compliance badge but no status badge; `project.status` is in the `Project` interface
- `tests/helpers/db.ts` — in-memory SQLite test DB runs `migrate()` from `migrationsFolder`; migration journal update is required for tests to pick up new columns
- `tests/routes/projects.test.ts` — existing test patterns confirmed; test helpers are inline (no shared fixture file needed)

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` — cross-project research confirming zero new libraries needed, `status` column pre-existing, migration idx 5 as next
- `package.json` — Vitest ^4.1.0, `"test": "vitest run"` confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions read from package.json directly
- Migration pattern: HIGH — existing migration files and journal read directly; pattern is plain SQL ALTER TABLE
- Archive route pattern: HIGH — all relevant routes read; existing soft-delete confirmed
- Client UI patterns: HIGH — DashboardPage, ProjectCard, ProjectDetailPage all read; TanStack Query invalidation pattern well-established in codebase
- Advisory-only compliance check: HIGH — compliance route returns exactly the `badge` signal needed; PRJ-03 confirmed as client-side only

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable stack, no fast-moving dependencies)
