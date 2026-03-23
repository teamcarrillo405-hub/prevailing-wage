# Pitfalls Research

**Domain:** Davis-Bacon compliance payroll system — adding workflow efficiency + audit readiness features to existing app
**Researched:** 2026-03-23
**Confidence:** HIGH (direct codebase audit of schema, services, routes, tests; compliance-domain analysis; migration pattern review)

---

## Critical Pitfalls

### Pitfall 1: Copy Previous Week Carries Stale Rate Snapshots Instead of Current Live Rates

**What goes wrong:**

The copy operation queries the previous week's `payrollEntries` and clones them into a new week. If `baseRateSnapshot` and `fringeRateSnapshot` are copied as-is from the old entries, the new week's entries carry the rate from when the source week was entered — not the current prevailing wage rate. For auditors, each payroll week's certification asserts that workers were paid no less than the prevailing wage at the time of that week's work. If a wage determination was updated between the copied week and the new week, the copied snapshot is stale and the certification is incorrect.

This is not a hypothetical. SAM.gov wage determinations are revised on 30-day cache cycles in this app (`wdolSync.ts`). A revision could have landed since the prior week. The copy feature makes it trivially easy to enter a month of payroll using a stale rate — and the compliance engine (`complianceService.ts`) will not flag it, because it only compares `grossWages` against the stored snapshots, never against live wage determinations.

**Why it happens:**

The copy operation is a database clone. Every field that makes a payroll entry complete is in the source row. Developers naturally copy all fields. Rate snapshots look like metadata, not like fields with compliance meaning.

**How to avoid:**

The copy route must NOT copy `baseRateSnapshot` or `fringeRateSnapshot`. Instead, the copy operation must perform a fresh rate lookup via `wageLookup.ts` for each worker's trade classification, using the project's locked WD identifier (`projects.wdIdentifier`). The new week's entries get fresh snapshots. If the rate lookup fails for any classification, that entry must be omitted from the pre-fill (not defaulted to zero or copied from the old week) and the UI must display a clear warning: "Rate not found for [classification] — enter manually."

**Warning signs:**

The copy endpoint returns 201 with entries that have identical `baseRateSnapshot` values to the prior week. The new week's compliance check passes even though the wage determination was updated the prior month. The test for copy passes but does not assert that rate snapshots were re-fetched.

**Phase to address:** Phase for Copy Previous Week — the rate re-fetch must be in the first implementation. No copy-and-fix-later; stale snapshots corrupt the audit trail from the moment of copy.

---

### Pitfall 2: Copy Previous Week Copies Submitted or Locked Data — User Unknowingly Creates a New Submitted Week

**What goes wrong:**

When WH-347 submission tracking is added, a payroll week will gain a `submittedAt` timestamp and `submissionAgency` field (or similar). If the copy operation does not explicitly exclude these fields, the new week is created already marked as submitted. The user opens the new week, sees "Submitted," assumes the prior week was referenced, and does not re-enter or verify the new week's hours. A week with copied hours and a fake submission timestamp goes unreported.

Even without a `submittedAt` field being copied, there is a second risk: if the source week is locked for editing (a natural constraint on submitted weeks), the copy API must verify ownership and lock status of the source week before reading from it, not just the destination project.

**Why it happens:**

The copy route reads the entire prior week record and its entries. A bulk insert of those fields into a new week row will include any status/submission fields added alongside the copy feature in the same milestone unless explicitly excluded.

**How to avoid:**

The copy operation must use a strict allowlist of fields to carry forward — never a `SELECT *` clone. Allowlisted fields: `workerId`, `classificationId`, daily hours (`monSt`…`sunOt`). Explicitly excluded: `id`, `payrollWeekId`, `grossWages`, `netPay`, `deductions`, any submission-related fields. Document the allowlist as a comment in the copy service function. Write a test asserting that the new week has `submittedAt: null` regardless of the source week's submission state.

**Warning signs:**

A newly created week via copy shows "Submitted" status. The payroll list shows two weeks with the same submission date. The compliance engine skips checking the new week because it appears already certified.

**Phase to address:** Phase for Copy Previous Week — coordinate with the WH-347 Submission Tracking phase to finalize which fields exist before the copy allowlist is written.

---

### Pitfall 3: Submission Tracking Has No Edit Lock — Submitted Weeks Remain Editable

**What goes wrong:**

WH-347 submission tracking adds a `submittedAt` field to `payrollWeeks`. If the existing `PUT /api/payroll/entries/:id` route does not check for submission status, contractors can continue editing entries on submitted weeks. An auditor who received a WH-347 for Week 5 can be shown a different set of hours on the app's screen than what was submitted. This is a federal form falsification risk, not just a data integrity issue.

The existing `upsertPayrollEntry()` function in `payrollService.ts` has no gate: it accepts any `payrollWeekId` and upserts immediately. No check for week status, no check for whether the week is final.

**Why it happens:**

The submission tracking feature is implemented as a status column, and developers assume "visible status" is sufficient. The enforcement — blocking writes on submitted weeks — is a separate, easy-to-miss step that lives in the route layer, not in the UI.

**How to avoid:**

Add a `checkWeekEditable()` guard in `payrollService.ts` or as middleware on the payroll entry routes. This function checks `payrollWeeks.submittedAt IS NULL` and throws a 409 Conflict if the week is submitted. The guard must fire on: `PUT /api/payroll/entries/:id`, `POST /api/payroll/entries`, and any future amendment routes before the amendment flow is established. The UI edit form must also be disabled/hidden when the week is submitted, but the server-side guard is non-negotiable — UI state is not a security boundary.

**Warning signs:**

Automated tests for entry upsert pass without a submitted-week fixture. The compliance check shows different data than what was included in the submitted PDF. Manual test: mark a week submitted, then call `PUT /api/payroll/entries/:id` directly — if it returns 200, the guard is missing.

**Phase to address:** Phase for WH-347 Submission Tracking — the edit lock must ship in the same phase as the submission flag, not deferred to a later phase.

---

### Pitfall 4: Payroll Amendment Corrupts the Original Audit Trail

**What goes wrong:**

The amendment workflow corrects a submitted week. The most dangerous implementation pattern is updating the original `payrollEntries` rows in place: the original snapshot is gone, and there is no record of what was submitted vs. what was corrected. DOL investigation procedures require the original certified payroll and the amendment to both be preserved, clearly labeled, and traceable to each other.

A secondary corruption risk: if the amendment re-uses the original `payrollWeekId` with a flag like `isAmended: true`, any future query that joins on `payrollWeekId` may return the amended values in contexts where the original values are expected (e.g., the reports page showing the fringe benefit summary for the original submission period).

**Why it happens:**

Updating in place is the simplest code path. `upsertPayrollEntry()` already uses `onConflictDoUpdate` — it is one call away from overwriting the original data.

**How to avoid:**

Amendments must be a new `payrollWeeks` row, not an update to the existing row. The schema should have:
- `payrollWeeks.amendedFromWeekId TEXT REFERENCES payroll_weeks(id)` — nullable; set on amendment weeks
- `payrollWeeks.amendmentNumber INTEGER NOT NULL DEFAULT 0` — 0 for original, 1 for first amendment, etc.

The original week row must be made read-only at the DB layer (via the edit lock guard from Pitfall 3) when an amendment exists. The amended week contains entirely new `payrollEntries` rows with fresh rate snapshots. The WH-347 generator reads from the amendment week and places "AMENDMENT" prominently on the form header. The original PDF artifact is never regenerated or replaced.

**Warning signs:**

The amendment flow calls `upsertPayrollEntry()` with the original `payrollWeekId`. After amendment, the original week's `grossWages` values differ from what was included in the submitted PDF. The reports page shows amended values for the original submission date.

**Phase to address:** Phase for Payroll Amendment Workflow — design the amendment schema before any route implementation. Write a migration that adds `amendedFromWeekId` and `amendmentNumber` columns before any amendment logic is coded.

---

### Pitfall 5: Amendment Numbering Conflicts When Multiple Amendments Exist

**What goes wrong:**

If amendment numbering is computed at query time (`SELECT MAX(amendmentNumber) FROM payroll_weeks WHERE amendedFromWeekId = ?`) rather than enforced by a database constraint, two concurrent amendment creation requests (or a re-try on timeout) can both read `MAX = 0` and both insert `amendmentNumber = 1`. The result is two Amendment #1 rows for the same original week. The audit trail has a numbering conflict that cannot be resolved without knowing which amendment was filed with the agency.

For a single-user app (no concurrency from multiple sessions), this is low probability — but the amendment creation flow may include a user double-clicking the "Create Amendment" button, which is exactly the scenario the existing `useRef` double-click guard was built to prevent for WH-347 download.

**Why it happens:**

Developers compute the next amendment number in application code before insert, which is a read-then-write with no atomicity guarantee.

**How to avoid:**

Add a database-level unique constraint: `UNIQUE(amendedFromWeekId, amendmentNumber)`. The insert will fail with a constraint error if a duplicate number is attempted. The route layer catches the constraint error and returns 409. The UI disables the "Create Amendment" button after first click, using the same `useRef` pattern already proven in `PayrollWeekDetailPage.tsx`.

**Warning signs:**

Two rows with `amendedFromWeekId = 'abc123'` and `amendmentNumber = 1` exist in the database. The amendment list for a week shows "Amendment #1" twice. The WH-347 generator selects the wrong amendment to render because `ORDER BY amendmentNumber` returns ambiguous results.

**Phase to address:** Phase for Payroll Amendment Workflow — add the unique constraint to the migration, not as an afterthought.

---

### Pitfall 6: Project Archive Breaks Dashboard Compliance Roll-Up

**What goes wrong:**

The dashboard currently fetches compliance status per project. If archived projects are soft-filtered client-side only (e.g., a React state toggle), every compliance query still runs for all projects including archived ones. The bigger risk: if archiving hard-deletes the project (or if a future cleanup script prunes `status = 'closed'` projects), all child records (`payrollWeeks`, `payrollEntries`, `workers`) are cascade-deleted because of the existing `ON DELETE CASCADE` foreign keys defined in `schema.ts`. The audit trail for a completed federal project is destroyed.

For Davis-Bacon compliance, federal regulation (29 CFR Part 3) requires certified payroll records to be maintained for three years after project completion. Hard-deleting an archived project is a federal records retention violation.

**Why it happens:**

The `status` field already exists on `projects` table (`'active' | 'closed'`). A developer implementing "archive" may assume that setting `status = 'closed'` is archive, not realizing the field exists but the filter does not, and then add a DELETE endpoint as an alternative. The cascade behavior is invisible unless the schema comment flags it.

**How to avoid:**

Archive is exclusively a status update: `UPDATE projects SET status = 'closed'`. No DELETE route should exist for projects. The `status = 'closed'` filter must be enforced server-side on the `GET /api/projects` route — not client-side — so that archived projects never appear in dashboard queries, compliance roll-ups, or the payroll list. Write a test asserting that a closed project does not appear in the projects list response. Add a comment to the projects route and schema: "Projects are NEVER deleted — status = 'closed' is the archive state. Federal records retention: 3 years post-completion."

**Warning signs:**

A DELETE endpoint for projects exists or is planned. The `GET /api/projects` route does not filter by `status`. Archived project compliance data appears in the dashboard badge count. The cascade behavior is exercised by any test that deletes a project.

**Phase to address:** Phase for Project Completion / Archive — server-side filter on projects list must be the first implementation step, before any UI toggle is built.

---

### Pitfall 7: Archived Project With Active Violations Silently Disappears From Compliance View

**What goes wrong:**

A project is archived with unresolved compliance violations (under-wage flags, CWHSSA OT mismatches). After archiving, the dashboard no longer shows the project. The violations exist in the database but are invisible. If a DOL investigator requests records for that project, the contractor has no awareness that violations were unresolved at archive time — and the app gave no warning.

**Why it happens:**

The archive action is a status field update. No pre-condition check fires. The UI confirms "Project archived" without surfacing compliance state.

**How to avoid:**

The archive route must run a compliance check across all payroll weeks for the project before updating status. If any week has `hasViolations: true`, the API returns a 409 with a payload listing the weeks and violation counts. The UI presents a blocking modal: "This project has [N] compliance violations across [M] weeks. Archive anyway?" with an explicit acknowledgment checkbox. The archive proceeds only after the user confirms. The acknowledgment timestamp is stored on the project row (`archivedWithViolations: boolean`, `archivedAt: text`). This creates an explicit audit record that the contractor knowingly archived a project with open violations.

**Warning signs:**

The archive endpoint does not call `computeCompliance()`. The archive confirmation dialog has no mention of open violations. Archiving a project with violation entries does not produce any warning.

**Phase to address:** Phase for Project Completion / Archive — implement the compliance pre-check before the archive action is user-accessible.

---

### Pitfall 8: Per-Worker Compliance History Mixes Snapshot Data With Live Data

**What goes wrong:**

The per-worker compliance history view shows violations across all payroll weeks. Each violation record in `complianceService.ts` is computed by comparing `grossWages` against the snapshot-based expected wage. If the history view re-computes compliance at query time using a live wage lookup instead of the frozen snapshots, the displayed violation status will differ from the status at the time of the original payroll entry.

For example: Week 5 had no violation at the time of entry because the prevailing rate was $28/hr. The rate was later updated to $31/hr. A live re-computation shows a violation for Week 5. The contractor now believes they have a violation that did not exist — or worse, a violation that existed is no longer shown because the rate dropped.

Audit responses require point-in-time accuracy: "What was the compliance status when this payroll was certified?"

**Why it happens:**

Developers writing a "history" query naturally use the most current data available. The distinction between snapshot-time compliance and current-rate compliance is non-obvious and undocumented in the route layer.

**How to avoid:**

The per-worker compliance history must call `computeCompliance()` for each relevant week with the week's frozen entry data — exactly as `complianceService.ts` already does. It must never call `wageLookup.ts` or read from `wageDeterminations`. Add a comment to the compliance history route: "Compliance is always computed from snapshot data in payrollEntries — NEVER re-read from live wage determinations." Consider adding a `snapshotBaseRate`/`snapshotFringeRate` to the displayed violation record so auditors can see the exact rate that was used in the compliance check.

**Warning signs:**

The worker history route imports `wageLookup.ts` or `wdolFetcher.ts`. The displayed violation status for a completed week changes when viewed on different dates. Test fixtures that hardcode rates and then check violation status fail intermittently.

**Phase to address:** Phase for Per-Worker Compliance History — establish the data source contract (snapshots only) before writing any query logic.

---

### Pitfall 9: Per-Worker History Has N+1 Query Problem at Scale

**What goes wrong:**

A worker compliance history view that loads all payroll weeks for a worker, then runs a separate compliance query for each week, produces N+1 database queries. For a worker on a year-long project (52 weeks) working on two projects simultaneously (104 weeks total), this is 105+ SQLite queries per page load. SQLite is synchronous and single-threaded in this stack — this will block the server process for a noticeable duration.

The existing compliance route already has a pattern that runs one compliance computation per week, which is acceptable for a single-week view. That pattern does not scale to a multi-week history view.

**Why it happens:**

The natural implementation loops over weeks and calls `computeCompliance(weekId)` for each one. It works in development with 3-5 weeks of test data and fails in production with 52+ weeks.

**How to avoid:**

The per-worker history query must fetch all relevant payroll entries in a single query, grouped by week. The compliance computation must be done in memory over the batched result set, not by calling `computeCompliance()` per week. Write the batch query first, before the computation loop. Add a test fixture with at least 20 weeks for the same worker and assert the response time is under 500ms. For the dashboard compliance roll-up (which already exists), verify it uses `staleTime: 60_000` caching (the `ProjectCard` pattern documented in PROJECT.md) — the same approach should be used for the worker history query.

**Warning signs:**

The worker history route calls `getPayrollWeek(weekId)` inside a loop. The response time for a worker with 20+ weeks is measurably slower than for a worker with 2 weeks. SQLite `EXPLAIN QUERY PLAN` shows repeated full-table scans on `payroll_entries`.

**Phase to address:** Phase for Per-Worker Compliance History — write the batch query before the computation logic.

---

### Pitfall 10: Worker Disambiguation Is Ignored — Same Name Across Projects Creates History Confusion

**What goes wrong:**

The per-worker compliance history view is scoped to a worker record (`workers.id`). Workers are project-scoped in the schema: `workers.projectId` is not null. A contractor who works on two concurrent federal projects is entered as two separate worker records with the same name and SSN last 4. The history view for `workerId = 'abc'` on Project A has no relationship to `workerId = 'def'` on Project B.

The UI feature is "per-worker compliance history across all projects." If the implementation queries by `workerId` only, it silently gives a project-scoped view while the UX implies a worker-scoped view. The contractor believes they are seeing Carlos Rivera's full compliance record; they are seeing only his record for one project.

**Why it happens:**

The worker entity in this schema is inherently project-scoped. There is no global worker identity table. A "across all projects" query requires joining on worker name + SSN last 4, not on worker ID.

**How to avoid:**

The per-worker history query must join `workers` records by `(name, ssnLast4, userId)` — matching the authenticated user's projects, the same worker name, and the same SSN last 4. This produces a cross-project view. The query must deduplicate and label entries by project name so the user can see that "Week 5, Project A" and "Week 3, Project B" belong to the same physical person. Document the join logic in a comment: "Workers are project-scoped; cross-project identity is matched on (name, ssnLast4)." Add a unique case: a test with the same worker on two projects confirms the history view includes both.

**Warning signs:**

The worker history route query uses `WHERE worker_id = ?` with a single ID. The history for a worker who appears on three projects only shows one project's data. There is no "project" label on each week row in the history view.

**Phase to address:** Phase for Per-Worker Compliance History — define the cross-project join strategy before any route implementation.

---

### Pitfall 11: Dashboard Filter State Lost on Navigation — Users Lose Context Mid-Workflow

**What goes wrong:**

A contractor filters the dashboard to "violation only, federal funding" and clicks into a project to investigate a violation. When they press the browser back button, the dashboard resets to the unfiltered state. They must re-apply the filter to continue reviewing the other projects in the set. For a contractor reconciling payroll before a DOL audit, losing filter state on every navigation break means re-filtering 5-10 times per session — a friction point that increases the chance of missing a project.

**Why it happens:**

React state for filters is local to the component and resets on unmount. The back navigation unmounts `DashboardPage` and remounts it with initial state.

**How to avoid:**

Persist filter state via URL query parameters: `?status=violation&funding=federal`. React Router's `useSearchParams()` reads and writes these params. On mount, the filter state is initialized from the URL. Filter changes update the URL (no page navigation, just param update). When the user presses back from a project page, the dashboard URL restores its params and the filter re-applies automatically. This also makes the filtered view bookmarkable and shareable. Test: navigate to a project from a filtered dashboard, press back, assert filter params are preserved.

**Warning signs:**

Filter state is managed with `useState`, not `useSearchParams`. The dashboard URL never includes query parameters when filters are active. Pressing back resets all filters.

**Phase to address:** Phase for Dashboard Search + Filter — use URL params from the first implementation.

---

### Pitfall 12: Dashboard Search Triggers a Query on Every Keystroke — Performance on Large Project Lists

**What goes wrong:**

A dashboard with 50+ projects that fetches a filtered list from the server on every character of a search input will send a query on every keypress. At 50 projects this is cosmetically acceptable but creates multiple in-flight requests that can resolve out of order (stale results rendering after fresh results). At 200 projects it creates server load spikes during typing.

The existing dashboard already fetches compliance per ProjectCard with a `staleTime: 60_000` pattern. Search-triggered fetches bypass this cache.

**Why it happens:**

The search input's `onChange` handler calls `refetch()` or modifies a query key directly. This is the natural pattern when discovering React Query.

**How to avoid:**

Debounce the search input: 300ms delay before the query key updates. Use `useDeferredValue()` from React 18 for the input value that feeds the query. For a project list at current scale (SQLite, single user), client-side filtering of the full project list fetch is simpler and avoids server round-trips entirely: fetch all projects once (with `staleTime: 60_000`), filter in memory. Server-side search is only needed if the project count exceeds ~500. Document which approach is in use and why.

**Warning signs:**

Network tab shows a request per character typed. Multiple in-flight requests have overlapping response times. The project list flickers during typing as responses arrive out of order.

**Phase to address:** Phase for Dashboard Search + Filter — decide client-side vs. server-side filtering at the start, before building the input component.

---

### Pitfall 13: Migration Not Registered in _journal.json — New Columns Are Invisible to Drizzle

**What goes wrong:**

The project's migration workflow requires manual registration of new SQL migration files in `meta/_journal.json`. The existing journal has 5 entries mapping to 8 migration files (files 0005, 0006, 0007 are not in the journal — they appear to be applied directly or via another mechanism). If a new migration for v2.3 schema changes (submission tracking columns, amendment columns, archive columns) is written as a SQL file but not registered, Drizzle will not apply it on next startup. The schema TypeScript definitions will include the new columns; the actual SQLite tables will not. Runtime will throw column-not-found errors.

**Why it happens:**

The migration file is created and looks correct. The developer runs the app, sees it start, and assumes migrations ran. Drizzle only runs migrations registered in the journal.

**How to avoid:**

Every new migration file must have a corresponding entry in `meta/_journal.json` with the correct `idx` (next sequential integer), `version: "6"`, `when` (current timestamp in ms), `tag` (filename without .sql extension), and `breakpoints: true`. After adding, restart the server and verify the new columns exist: `SELECT sql FROM sqlite_master WHERE name = 'payroll_weeks'` should include the new column names. Add a step to the definition of done for every phase that touches the schema: "Run column verification query, confirm new columns present."

**Warning signs:**

Server starts without errors but `payrollWeeks.submittedAt` is undefined at runtime. Drizzle select on `payrollWeeks` does not include the new column in results. TypeScript types include the field but runtime values are always `undefined`.

**Phase to address:** Every phase that adds schema columns — establish the journal registration step as a checklist item in the phase definition.

---

### Pitfall 14: WH-347 Amendment PDF Prints "AMENDMENT" Incorrectly — DOL Form Requirements Not Met

**What goes wrong:**

The DOL WH-347 form has a specific header structure. For amendment submissions, DOL expects the certified payroll to be clearly marked as a correction. The existing `wh347Generator.ts` uses coordinate overlay on a flat PDF — there is no AcroForm field to check or uncheck. If the amendment marker is added as an overlay at approximate coordinates without measurement verification, it may print over existing form text, outside the printable area, or at a scale that is illegible.

The existing `checkboxFinal` field at `{ page: 0, x: 39, y: 497 }` shows the coordinate precision required. An "AMENDMENT" marker at the wrong position invalidates the form for DOL submission.

**Why it happens:**

The amendment PDF generation is treated as a "just add a label" task. The coordinate system requires measurement against the actual PDF grid, which was done once at the start of the project and not revisited.

**How to avoid:**

Before implementing amendment PDF generation: open `wh347-grid.pdf` (if it exists from the original coordinate measurement session) or create a new annotated grid for the amendment form area. Measure the exact coordinates for the amendment marker. The DOL WH-347 instructions say to mark "AMENDED" in the certified payroll number box or at the top of the form — identify the exact field this corresponds to in the coordinate map and add it as a named constant in `WH347_FIELDS`. Test by generating an amendment PDF and visually confirming the marker position does not overlap any existing field text.

**Warning signs:**

The amendment PDF "AMENDMENT" label is visible in the PDF viewer but overlaps the payroll number or contractor name field. The label is clipped at the page margin. The label is rendered in the wrong font size relative to the surrounding form text.

**Phase to address:** Phase for Payroll Amendment Workflow — coordinate measurement must precede any PDF generation code.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Copy rate snapshots from source week instead of re-fetching | Copy endpoint is simpler, no rate lookup required | Stale rates in new weeks; compliance engine silently accepts incorrect snapshots; audit trail is compromised | Never — rate re-fetch is mandatory |
| Enforce submission lock only in the UI (disabled form) | Faster to implement | Server routes remain writable; any API call (including tests, curl) bypasses the lock; submitted records are mutated | Never — server-side guard is required |
| Store amendment as a flag on the original week (`isAmended: true`) | No new table rows or migration | Original entry data is overwritten; audit trail is destroyed; DOL compliance is violated | Never |
| Filter archived projects client-side only | No server change needed | Archived projects still appear in compliance roll-up counts; dashboard badge counts are inflated | Never — server-side filter is required |
| Compute worker cross-project history by name-string match with no SSN deduplication | Simpler join | Workers with identical names but different SSNs are merged; workers with different formatting of the same name are split | Never — SSN last 4 is required for disambiguation |
| Use `useState` for dashboard filter instead of URL params | Simpler code | Filter state lost on navigation; back-button breaks workflow; URL is not shareable | Acceptable only if filter is a single toggle with low re-use frequency — not acceptable for a multi-filter dashboard |
| Skip `_journal.json` registration and apply migrations manually in development | Faster iteration | Migration is not applied in any other environment; production startup fails | Never — always register |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `upsertPayrollEntry()` for amendment creation | Calling `upsertPayrollEntry()` with the original `payrollWeekId` — the `onConflictDoUpdate` silently overwrites the original entry | Create a new `payrollWeeks` row with `amendedFromWeekId` set, then insert new `payrollEntries` rows for the new week |
| `computeCompliance()` in worker history | Calling per-week in a loop, one DB round-trip per week | Batch-load all weeks' entries in a single query, run compliance computation in memory |
| `wageLookup.ts` in copy route | Calling rate lookup per classification sequentially | Batch all classifications for the project in one lookup; fail gracefully per classification without blocking the copy |
| `payrollWeeks.status` filter in existing route | `GET /api/payroll/projects/:projectId/weeks` does not filter by project status — returning weeks for archived projects | Add a project status check at the route level; or query-join `payrollWeeks` through `projects` and include `WHERE projects.status = 'active'` |
| pdf-lib coordinate overlay for amendment marker | Using `page.drawText('AMENDMENT', { x: approx, y: approx })` without measurement | Measure against the actual form PDF grid at the specific position DOL expects; add to `WH347_FIELDS` as a named constant |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 compliance computation in worker history | Page load time scales linearly with week count; 52 weeks = 52+ DB queries | Batch entry load + in-memory computation | Visible at 10+ weeks per worker; painful at 30+ |
| Dashboard search on every keystroke with server fetch | Network tab shows a request per character; results flicker | 300ms debounce + client-side filtering for lists under 500 items | Immediately noticeable on any network latency |
| Compliance roll-up for all projects including archived | Dashboard load time grows as project count grows | Server-side `WHERE status = 'active'` filter on projects list | Noticeable at 20+ archived projects |
| Amendment history query without index on `amendedFromWeekId` | Amendment chain lookup is a full table scan on `payroll_weeks` | Add index: `CREATE INDEX idx_payroll_weeks_amended_from ON payroll_weeks(amended_from_week_id)` | Visible at 100+ weeks total |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No server-side edit lock on submitted weeks | Any API caller (including automated scripts or test suites) can overwrite submitted payroll data; submitted certification is meaningless | `checkWeekEditable()` guard on all payroll entry write routes; returns 409 if `submittedAt IS NOT NULL` |
| Project ownership not checked on amendment source week | A user could submit a `POST /api/payroll/amendments` with a `sourceWeekId` from another user's project and read/copy that project's entries | `assertProjectOwner()` must be called on the source week's `projectId`, not just the destination project |
| Amendment creation not idempotent — double-submit creates two amendment rows | Two Amendment #1 records exist; audit trail is ambiguous | Unique constraint on `(amendedFromWeekId, amendmentNumber)` + `useRef` double-click guard in the UI |
| Submission timestamp is client-supplied | Client sends `submittedAt: "2025-01-01"` (backdated submission) — creates a false audit timestamp | `submittedAt` must be set server-side as `new Date().toISOString()` — never accepted from the request body |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Mark Submitted" is a single click with no confirmation | Contractors click it accidentally mid-edit; week is locked; they must file an amendment to correct a premature submission | Require a confirmation modal with the submission date and agency name before marking submitted |
| Submission status is only visible on the week detail page | Contractor cannot see at a glance which weeks are submitted from the payroll list | Add a "Submitted" badge to each row in the payroll weeks list; include submission date in the list view |
| Copy Previous Week shows a success state but does not warn about workers with no rates | Contractor starts the new week with missing entries; discovers the gap on payday | Copy result response must include `{ copied: N, skipped: M, skippedWorkers: [...] }` and the UI must show a dismissible warning if any workers were skipped |
| Archive confirmation has no record count summary | Contractor archives a project without realizing it had 30 weeks of payroll records that are now hidden | Archive confirmation modal must show: "This will archive [N] payroll weeks and [M] workers. Records are preserved and accessible via [link]." |
| Per-worker history shows violations without the snapshot rate used | Contractor cannot explain to an auditor why a violation was flagged — was the rate $28 or $31? | Display `baseRateSnapshot` and `fringeRateSnapshot` alongside each violation record in the history view |

---

## "Looks Done But Isn't" Checklist

- [ ] **Copy Previous Week:** New week's entries have `baseRateSnapshot` and `fringeRateSnapshot` values that differ from the source week when a rate update occurred between the two weeks — verify this case explicitly in tests
- [ ] **Copy Previous Week:** New week has `submittedAt: null` regardless of source week submission state — assert in the copy test
- [ ] **Submission Tracking:** Call `PUT /api/payroll/entries/:id` directly on a submitted week and confirm a 409 response — do not rely on the UI being disabled
- [ ] **Amendment Workflow:** After creating an amendment, read the original week's entries and confirm they are unchanged — assert original snapshots match pre-amendment values
- [ ] **Amendment Numbering:** Create two amendments for the same source week via two rapid API calls and confirm only one succeeds (constraint error on second)
- [ ] **Project Archive:** Call `DELETE /api/projects/:id` (if endpoint exists) — confirm it returns 405 Method Not Allowed or 404
- [ ] **Project Archive:** Archive a project, then call `GET /api/projects` — confirm the archived project does not appear in the response
- [ ] **Archive With Violations:** Archive a project with an unresolved violation week — confirm the API returns a warning/confirmation prompt, not a silent 200
- [ ] **Worker History Cross-Project:** Add the same worker (same name, same SSN last 4) to two projects, enter payroll on both — confirm the history view shows weeks from both projects
- [ ] **Dashboard Filter URL Params:** Apply a filter, navigate to a project, press back — confirm filter params are present in the URL and filter is re-applied
- [ ] **Migration Registration:** Run `SELECT sql FROM sqlite_master WHERE name = 'payroll_weeks'` after startup and confirm new v2.3 columns are present in the output

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale rate snapshots copied into new week | HIGH | Identify all weeks created via copy; for each, determine the correct rate at the week-ending date; issue amendment weeks with correct rates; regenerate WH-347s; notify affected agencies |
| Original entry data overwritten by amendment | HIGH | Restore from database backup if available; if no backup, reconstruct from the submitted PDF (if saved); manually re-enter original values into a corrected audit log |
| Submitted week edited without lock | HIGH | Cross-reference against the submitted WH-347 PDF; determine which changes occurred post-submission; file amendments for any affected weeks |
| Hard-deleted project data | HIGH | No recovery without backup; SQLite WAL file may have pre-delete state if caught quickly; otherwise data is gone — enforce the no-delete rule before this scenario occurs |
| Worker history shows wrong cross-project data | MEDIUM | Re-query with corrected join logic; no data was mutated, only displayed incorrectly; fix the query and re-render |
| Dashboard filter lost on navigation | LOW | Add URL param persistence; no data affected, pure UX fix |
| Migration not registered in journal | LOW | Add journal entry, restart server, columns appear; no data loss if caught before production use |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stale rate snapshots in copy | Copy Previous Week phase | Test: copy a week after updating the project WD; new week entries have different snapshot values than source week |
| Submission flags copied to new week | Copy Previous Week phase (coordinate with Submission Tracking) | Test: copy a submitted week; new week has `submittedAt: null` |
| No edit lock on submitted weeks | WH-347 Submission Tracking phase | Integration test: PUT on submitted week returns 409 |
| Amendment corrupts original audit trail | Payroll Amendment Workflow phase — migration first | Test: original week entries are unchanged after amendment creation |
| Amendment numbering conflict | Payroll Amendment Workflow phase — unique constraint in migration | Test: double-submit amendment creation returns constraint error |
| Hard-delete of archived projects | Project Completion / Archive phase | Test: no DELETE route exists; GET /projects omits closed projects |
| Archive with open violations — no warning | Project Completion / Archive phase | Test: archive a project with violation week returns 409 or warning payload |
| Mixed snapshot/live data in worker history | Per-Worker Compliance History phase | Code review: history route imports must not include wageLookup.ts |
| N+1 queries in worker history | Per-Worker Compliance History phase | Test fixture with 20 weeks; assert response time < 500ms |
| Worker disambiguation across projects | Per-Worker Compliance History phase | Test: same worker on two projects appears in history with both project labels |
| Filter state lost on navigation | Dashboard Search + Filter phase | Test: apply filter, navigate, back-button, assert URL params preserved |
| Per-keystroke search requests | Dashboard Search + Filter phase | Network tab shows single request per debounce period, not per character |
| Migration not registered in journal | Every schema-change phase | Post-migration: `SELECT sql FROM sqlite_master` shows new columns |
| Amendment PDF coordinate mismatch | Payroll Amendment Workflow phase | Visual review of generated amendment PDF against DOL form layout |

---

## Sources

- Direct codebase audit: `src/server/db/schema.ts`, `src/server/services/payrollService.ts`, `src/server/services/complianceService.ts`, `src/server/services/wh347Generator.ts`, `src/server/routes/payroll.ts`, `src/server/db/migrations/meta/_journal.json` (2026-03-23)
- `.planning/PROJECT.md` — key decisions, stack constraints, migration workflow documentation
- Test suite structure: `tests/routes/compliance.test.ts`, `tests/routes/payroll.test.ts`, `tests/services/complianceService.test.ts` — fixture patterns used to identify test coverage gaps
- 29 CFR Part 3 — Contractors and Subcontractors on Public Building or Public Work Financed in Whole or in Part by Loans or Grants from the United States (3-year records retention requirement)
- DOL WH-347 Instructions (January 2025 revision) — amendment marking requirements
- Drizzle ORM migration documentation — journal registration requirement for SQLite migrations

---
*Pitfalls research for: Davis-Bacon compliance payroll system — v2.3 contractor workflow efficiency + audit readiness features*
*Researched: 2026-03-23*
