# Audit Trail Research: DOL-Audit-Ready Activity Log

**Project:** HCC Prevailing Wage
**Feature domain:** Audit trail / activity log for compliance
**Researched:** 2026-04-01
**Overall confidence:** HIGH (DOL retention rules), MEDIUM (diff vs snapshot tradeoffs), HIGH (SQLite patterns)

---

## 1. Minimum Schema for a DOL-Audit-Ready Audit Log Table

### Recommended Schema (Drizzle ORM / SQLite)

```typescript
export const auditLogs = sqliteTable('audit_logs', {
  id:          text('id').primaryKey(),                    // UUIDv4 — never AUTOINCREMENT (see note)
  createdAt:   text('created_at').notNull(),               // ISO 8601 UTC — the only timestamp that matters

  // Actor
  userId:      text('user_id').references(() => users.id), // null = system action (e.g., scheduled job)
  userEmail:   text('user_email'),                         // denormalized snapshot — survives user deletion
  ipAddress:   text('ip_address'),                         // from req.ip; useful for DOL investigator

  // Scope
  projectId:   text('project_id').references(() => projects.id, { onDelete: 'set null' }),

  // Subject
  entityType:  text('entity_type').notNull(),              // 'worker' | 'payroll_entry' | 'payroll_week' | ...
  entityId:    text('entity_id').notNull(),                // ID of the affected row

  // Action
  action:      text('action').notNull(),                   // see Action Taxonomy below

  // Payload — stored as JSON text
  diff:        text('diff'),                               // JSON: { before: {...}, after: {...} } for updates
  snapshot:    text('snapshot'),                           // JSON: full entity state for creates/deletes
  meta:        text('meta'),                               // JSON: free-form context (e.g., import filename, submission target)
});
```

**Why UUIDv4 for `id`, not AUTOINCREMENT:** Audit log rows are insert-only. AUTOINCREMENT integer PKs reveal row count and insertion order externally (a minor but real information leak). UUID strings are opaque and safe to expose in API responses and React queries without leaking DB internals.

**Why `userEmail` is denormalized:** Users can be removed from a project (soft-delete in `project_members`), but the audit trail must survive. If you join to `users` at query time and the user has been deleted, the actor is invisible. Snapshot the email at write time. Storage cost is negligible.

**Why `projectId` uses `onDelete: 'set null'`:** Audit logs must be retained even if a project is deleted. Cascading delete would destroy evidence. Set null and filter nullable `projectId` rows in the UI separately.

**Why `diff` and `snapshot` are separate columns, not one `payload` column:** The query pattern differs. For an update to a payroll entry, you want `SELECT diff WHERE entityType='payroll_entry' AND entityId=?`. For a full history reconstruction, you want the creation snapshot. Having them distinct avoids a JSON-parsing step in the query layer.

### Indexes Required

```sql
CREATE INDEX idx_audit_project_time ON audit_logs(project_id, created_at DESC);
CREATE INDEX idx_audit_entity       ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user         ON audit_logs(user_id, created_at DESC);
```

Three indexes cover the three UI views: per-project activity feed, per-entity history drawer, and per-user action history.

### Immutability Enforcement

Do not use SQLite triggers to enforce immutability — trigger code lives outside the Drizzle schema and version control, creating a maintenance gap.

**Use application-level enforcement instead:**

1. No `DELETE` or `UPDATE` route should touch `audit_logs`. The service layer never exports a delete function for this table.
2. In the `auditService.ts`, export only `insertAuditLog()` — no update or delete functions. Any accidental import of a delete function will fail at the TypeScript level if the function doesn't exist.
3. Optionally, add a SQLite `BEFORE UPDATE` and `BEFORE DELETE` trigger at migration time via a raw SQL migration file (not a Drizzle table definition) as a belt-and-suspenders guard. This is a one-time raw migration, not ongoing trigger maintenance.

---

## 2. Actions to Log — Priority Taxonomy

### Tier 1: Must Log (DOL Audit-Critical)

These are the events a DOL investigator will ask about first. Missing these creates an audit gap.

| Action Constant | Entity Type | Trigger | Why Critical |
|-----------------|-------------|---------|--------------|
| `worker.created` | `worker` | POST /workers | Workers on the payroll must be traceable to when they were added |
| `worker.updated` | `worker` | PATCH /workers/:id | Name, SSN, address, classification changes directly affect WH-347 accuracy |
| `worker.deactivated` | `worker` | isActive = false | Worker removal from active roster must be timestamped |
| `payroll_entry.created` | `payroll_entry` | POST /payroll/entries | Every hour logged affects wage compliance calculation |
| `payroll_entry.updated` | `payroll_entry` | PATCH /payroll/entries/:id | Hour or rate changes after initial entry are the #1 audit red flag |
| `payroll_entry.deleted` | `payroll_entry` | DELETE /payroll/entries/:id | Deleted entries are suspicious; must be preserved in audit trail |
| `payroll_week.submitted` | `payroll_week` | submittedAt set | WH-347 certification event — the legal attestation moment |
| `payroll_week.amended` | `payroll_week` | amendmentNumber incremented | Amendments to submitted payroll are high-scrutiny events |
| `payroll_week.ca_ecpr_submitted` | `payroll_week` | caEcprSubmittedAt set | CA DIR eCPR submission marked — state compliance event |
| `payroll_week.wa_lni_submitted` | `payroll_week` | waLniSubmittedAt set | WA L&I PWIA submission marked — state compliance event |
| `export.wh347_downloaded` | `payroll_week` | WH-347 PDF/CSV generated | DOL investigators look for who accessed certified payroll reports |
| `export.ca_ecpr_downloaded` | `payroll_week` | CA eCPR XML generated | XML export is the file submitted to CA DIR |
| `export.wa_pwia_downloaded` | `payroll_week` | WA PWIA XML generated | XML export is the file submitted to WA L&I |

### Tier 2: Should Log (Compliance Context)

These provide context that makes Tier 1 events interpretable to an auditor.

| Action Constant | Entity Type | Trigger | Why Useful |
|-----------------|-------------|---------|------------|
| `worker_classification.created` | `worker_classification` | Classification assigned | Classification determines wage rate — traceability required |
| `worker_classification.updated` | `worker_classification` | Trade code or rate changed | Rate changes affect compliance calculations retroactively |
| `payroll_week.created` | `payroll_week` | New week started | Establishes when the week was opened |
| `payroll_week.copied` | `payroll_week` | copyPayrollWeek used | Copied weeks can carry over errors — log the source week ID in meta |
| `payroll_import.committed` | `payroll_import` | CSV import committed | Who imported, from what provider, how many rows — already in payroll_imports table but cross-reference here |
| `project.member_added` | `project` | Team invite accepted | New user gaining access to payroll PII |
| `project.member_removed` | `project` | Member access revoked | Access removal — important for PII chain of custody |

### Tier 3: Log If Low Cost (Operational Completeness)

| Action Constant | Trigger |
|-----------------|---------|
| `auth.login` | Successful login |
| `auth.logout` | Logout |
| `auth.login_failed` | Failed login attempt (rate limiting correlation) |
| `project.created` | New project |
| `project.updated` | Project metadata changed |
| `project.closed` | Project status = closed |

### Do NOT Log

- `export.wh347_previewed` — intermediate preview renders are noise; log download only
- Password changes or hash values — never in audit log
- Full SSN — never in any log, audit or otherwise; log `ssn_encrypted` column changed: true/false only
- Internal wage sync operations (`wage_sync_meta`) — operational log, not compliance record

---

## 3. Diff vs. Snapshot: Tradeoffs and Recommendation

### Option A: Full Snapshot Only

Store the complete entity JSON at each audit event.

**Pros:**
- Trivial to implement: `snapshot: JSON.stringify(entityRow)`
- No before/after computation needed at write time
- Easy point-in-time reconstruction: just read the snapshot column

**Cons:**
- 20-30x more storage than diff (a payroll entry row is ~50 columns)
- Reading "what changed" requires fetching two consecutive rows and computing diff at query time
- Redundant data makes the audit log harder to read in the UI

### Option B: Diff Only

Store only the fields that changed: `{ before: { monSt: 6 }, after: { monSt: 8 } }`

**Pros:**
- Minimal storage
- Instantly human-readable: "Monday ST hours: 6 → 8"
- Ideal for activity feed UI

**Cons:**
- Reconstructing full state at a point in time requires replaying all diffs from creation — complex query
- If a create event has no `before`, the initial field values must still be captured somewhere
- Array/nested fields (not common in this schema, but possible) require special representation

### Option C: Hybrid (Recommended)

This is the standard pattern for compliance applications:

| Event Type | Store | Rationale |
|------------|-------|-----------|
| `*.created` | `snapshot` (full JSON) | Initial state is the baseline; no "before" exists |
| `*.updated` | `diff` (before/after changed fields only) | Auditor needs to see exactly what changed; storage efficiency |
| `*.deleted` | `snapshot` (full JSON of deleted row) | The deleted row may not be recoverable from main tables |
| `*.submitted` / `*.downloaded` | `meta` only (no diff/snapshot) | State-change actions have no payload; capture meta like `{ payrollNumber: 7, weekEnding: '2026-03-28' }` |

**Sensitive field handling:**

- `ssnEncrypted`: Log the column name changed but never the value. In the diff: `{ before: { ssnEncrypted: "[ENCRYPTED]" }, after: { ssnEncrypted: "[ENCRYPTED]" } }` — auditor sees the field was changed, not the value.
- `passwordHash`: Never appear in audit log at all.
- `address`: May appear in `worker.created` snapshot since it's required on WH-347.

**Payload size guard:** Payroll entry rows are wide (28+ daily hour columns). For `payroll_entry.updated`, compute the diff server-side before writing — only include columns that actually changed. A typical hour edit touches 1-4 columns, not all 28.

---

## 4. UI Display Patterns

### 4a. Per-Project Activity Timeline (Primary View)

**Location:** Project Settings or a dedicated "Activity" tab accessible from the project sidebar.

**Layout:**
- Reverse-chronological list (newest first)
- Grouped by calendar day: "Today", "Yesterday", "March 28", etc.
- Each row: `[actor avatar/initials] [verb phrase] [entity link] — [relative timestamp]`
- Example rows:
  - "You updated payroll entry for Maria Santos (Week 7) — 2 hours ago"
  - "Alex Kim downloaded WH-347 for Week 6 — Yesterday at 4:15 PM"
  - "System committed QuickBooks import (14 entries) — March 28"

**Filters (sidebar or top bar):**
- Actor (dropdown of project members)
- Entity type (worker, payroll entry, week, export)
- Action category (edits, exports, submissions, access changes)
- Date range (calendar picker)

**Pagination:** Offset pagination is acceptable for project-scoped logs at this scale (a 52-week project with 20 workers logging 3 actions/day = ~3,000 rows/year). Cursor-based is better if the same endpoint is used for unlimited date range queries, but for project-scoped views with a date range filter, offset + 25-per-page is sufficient.

### 4b. Per-Entity History Drawer (Secondary View)

**Location:** Slide-out drawer or expandable section on any entity's detail page.

**When to show:**
- Worker detail page: history of name/address/classification changes
- Payroll entry row: history of hour edits and who made them
- Payroll week detail: submission, amendment, and download history

**Layout:**
- Timeline of changes for that specific entity
- For updates: render diff as labeled field pairs: `Hours Monday ST: 6 → 8`
- For creates/deletes: show a summary of key fields
- Link back to full project activity log filtered to this entity

**Component:** A `<EntityAuditDrawer entityType="payroll_entry" entityId={id} />` component that calls `GET /audit-logs?entityType=payroll_entry&entityId={id}&limit=50`.

### 4c. Recommended API Shape

```
GET /api/projects/:projectId/audit-logs
  ?entityType=payroll_entry        (optional filter)
  &entityId=abc123                 (optional filter, requires entityType)
  &userId=user456                  (optional filter)
  &action=payroll_entry.updated    (optional filter)
  &from=2026-01-01                 (optional ISO date)
  &to=2026-03-31                   (optional ISO date)
  &page=1                          (default: 1)
  &limit=25                        (default: 25, max: 100)

Response:
{
  "items": [...],
  "total": 342,
  "page": 1,
  "limit": 25
}
```

The `assertProjectAccess` middleware must gate this endpoint — non-members must receive 403.

### 4d. Verb Phrase Templates

The UI should translate action constants to human-readable sentences. Maintain a client-side map:

```typescript
const ACTION_LABELS: Record<string, (log: AuditLog) => string> = {
  'worker.created':              (l) => `added worker ${l.meta?.workerName}`,
  'worker.updated':              (l) => `updated worker ${l.meta?.workerName}`,
  'worker.deactivated':          (l) => `deactivated worker ${l.meta?.workerName}`,
  'payroll_entry.created':       (l) => `added payroll entry for ${l.meta?.workerName} (Week ${l.meta?.payrollNumber})`,
  'payroll_entry.updated':       (l) => `edited payroll entry for ${l.meta?.workerName} (Week ${l.meta?.payrollNumber})`,
  'payroll_entry.deleted':       (l) => `deleted payroll entry for ${l.meta?.workerName} (Week ${l.meta?.payrollNumber})`,
  'payroll_week.submitted':      (l) => `certified payroll Week ${l.meta?.payrollNumber} as submitted`,
  'payroll_week.amended':        (l) => `filed amendment #${l.meta?.amendmentNumber} for Week ${l.meta?.payrollNumber}`,
  'export.wh347_downloaded':     (l) => `downloaded WH-347 for Week ${l.meta?.payrollNumber}`,
  'export.ca_ecpr_downloaded':   (l) => `downloaded CA eCPR XML for Week ${l.meta?.payrollNumber}`,
  'export.wa_pwia_downloaded':   (l) => `downloaded WA PWIA XML for Week ${l.meta?.payrollNumber}`,
  'payroll_import.committed':    (l) => `imported ${l.meta?.committedCount} entries from ${l.meta?.provider}`,
  'project.member_added':        (l) => `added ${l.meta?.memberEmail} to the project`,
  'project.member_removed':      (l) => `removed ${l.meta?.memberEmail} from the project`,
};
```

The `meta` column (JSON) on each audit log row should include the display-ready fields (worker name, payroll number, etc.) so the UI does not need to join to source tables. The source tables may be updated or deleted by the time the log is rendered.

---

## 5. SQLite-Specific Pitfalls for Append-Only Audit Tables

### Pitfall 1: WAL Mode Checkpoint Stalls

**What:** SQLite in WAL mode allows concurrent readers and one writer, which is good for an audit log. However, the WAL file grows indefinitely until a checkpoint flushes it back to the main DB file. If your app does not call `PRAGMA wal_checkpoint(PASSIVE)` periodically, the WAL file can grow to hundreds of MB over time, causing read slowdowns (SQLite must search both the DB file and WAL file for each read).

**Prevention:** Run `PRAGMA wal_checkpoint(PASSIVE)` in a periodic job (e.g., every 1,000 audit inserts, or on a 10-minute interval). This is a passive checkpoint — it does not block writers.

**Status:** This app already runs on Render.com with WAL mode (standard best practice for Render SQLite deployments). Add a checkpoint call to the existing scheduled job infrastructure.

### Pitfall 2: Triggers Are Outside Drizzle Version Control

**What:** SQLite triggers written via raw SQL in a migration file are not tracked in the Drizzle schema. If a developer regenerates migrations or creates a new DB from scratch (e.g., for tests), the immutability trigger is silently missing.

**Prevention:** If you add `BEFORE UPDATE` / `BEFORE DELETE` triggers on `audit_logs`, add them in a dedicated migration file (`0XXX_audit_immutability_triggers.sql`) and reference it in the migration runner. Comment the migration file as "manual triggers — not managed by Drizzle push". For test environments, the migration runner must execute this file.

**Recommendation:** For this project's scale, skip the SQLite-level immutability trigger. Enforce immutability in the application service layer only (export `insertAuditLog` only; no update/delete). The risk of trigger drift exceeds the benefit.

### Pitfall 3: JSON Columns Are Not Indexed

**What:** The `diff` and `snapshot` columns are stored as JSON text in SQLite. SQLite's JSON functions (`json_extract`) are available but slow on large tables. You cannot index inside a JSON column in SQLite without a generated column.

**Prevention:**
- Keep the most-queried fields (`entityType`, `entityId`, `projectId`, `userId`, `createdAt`, `action`) as first-class columns — they are all indexed.
- Reserve `diff`, `snapshot`, and `meta` for display rendering only, never for filtering.
- If you ever need to filter by a `meta` value (e.g., all imports of provider = 'quickbooks'), promote that field to a real column. For now, the `action` column (`payroll_import.committed`) is sufficient to identify import events without JSON filtering.

### Pitfall 4: AUTOINCREMENT Integer PKs Leak Row Count

**What:** If you use `INTEGER PRIMARY KEY AUTOINCREMENT`, the ID is sequential and reveals the total number of audit log entries to anyone who sees an ID. This is a minor but real information exposure.

**Prevention:** Use UUIDv4 text PKs (consistent with the rest of this codebase, which uses `text('id').primaryKey()` everywhere).

### Pitfall 5: Timezone Stored Incorrectly

**What:** If `createdAt` is stored in local time or with a timezone offset, audit records from different timezones become non-comparable. DOL investigators reviewing logs will see apparent gaps or reversals.

**Prevention:** Always store `createdAt` as UTC ISO 8601 (`new Date().toISOString()`). Display in local time in the React UI using `Intl.DateTimeFormat`. The rest of this codebase already follows this pattern.

### Pitfall 6: Application-Level Logging Can Be Bypassed

**What:** If audit logging is inserted at the route level, any service that directly calls DB insert functions (e.g., the import service, the CSV commit pipeline) will bypass it unless explicitly wired.

**Prevention:** Create a single `auditService.ts` with an `insertAuditLog()` function. Wrap all DB write operations that need audit logs in a service layer — not raw Drizzle inserts in route files. The service calls the main DB operation and then calls `insertAuditLog()` within the same transaction where possible, or immediately after in a best-effort fashion where transactions are impractical.

**Transaction note:** If the main operation and the audit insert are in the same SQLite transaction, a failure in the audit insert will roll back the main operation. This is too strict — a failed audit log should not block a valid payroll save. Use best-effort: commit the main operation first, then insert the audit log. Log failures to the application error log (not silently swallowed) but do not surface them to the user.

---

## 6. DOL Retention Requirements

### Federal Davis-Bacon (29 CFR § 5.5(a)(3))

- **Retention period:** 3 years after all work on the prime contract is complete.
- **What must be kept:** Name, address, SSN (or last 4 digits on public-facing reports), job classification, hourly wage rates, daily and weekly hours, deductions, actual wages paid, fringe benefit documentation.
- **Accessibility:** Records must be made available to DOL investigators or the contracting officer upon request. Failure to produce records can result in suspension of contract payments.
- **Weekly submissions:** The WH-347 itself must be submitted weekly to the contracting officer. App's existing `submittedAt` + `payrollNumber` fields satisfy this tracking requirement.

Source: [FAR 52.222-8](https://www.acquisition.gov/far/52.222-8), [DOL WHD Fact Sheet #66](https://www.dol.gov/agencies/whd/fact-sheets/66-dbra)

### State Variations

| State | Minimum Retention | Notes |
|-------|-------------------|-------|
| California | 3 years | CA Labor Code § 1776 extends to "all records" including classifications; DIR can audit up to 3 years post-project |
| Washington | 3 years | WA Dept. of Labor & Industries aligns with federal 3-year standard |
| Some states | Up to 6 years | The pivla.com expert guide notes some state agencies extend to 6 years; app should support configurable retention |

**Practical implication for this app:** The audit log must be retained for the life of the app subscription plus 3 years after project closure. If a user closes a project, do not delete audit logs immediately. A project `closedAt` timestamp + a scheduled job that deletes audit logs only after `closedAt + 3 years` would satisfy this — but that is a future feature. For now, never auto-delete audit logs.

### What Must Be Audit-Logged vs. What the WH-347 Already Captures

The WH-347 form itself is the primary compliance artifact. The audit log supplements it by answering:
- Who created or changed a payroll entry (the WH-347 shows the final values, not the edit history)
- When a WH-347 was generated (download event)
- Whether any entries were changed after initial submission (the critical fraud-detection signal)

The audit log does not replace the WH-347 — it provides the provenance chain around it.

---

## 7. Filtering and Pagination Patterns in React

### Recommended Component Structure

```
<ProjectActivityPage>
  ├── <AuditLogFilters>          — actor, entity type, action, date range
  ├── <AuditLogTimeline>         — grouped by day, reverse-chronological
  │   └── <AuditLogRow>          — single event row with actor, verb, timestamp
  │       └── <AuditLogDiffDrawer> — expandable detail: shows before/after diff
  └── <AuditLogPagination>       — page controls (offset-based, 25/page)
```

### Filter State Pattern

Use URL search params for filter state so that filter configurations are shareable and deep-linkable:

```
/projects/abc123/activity?entityType=payroll_entry&from=2026-03-01&page=2
```

Use `useSearchParams` (React Router) or equivalent. On filter change, reset `page` to 1.

### Data Fetching

Use `react-query` (`useQuery`) for the audit log list. The query key should include all filter params so cache invalidation is automatic when filters change:

```typescript
const { data } = useQuery({
  queryKey: ['auditLogs', projectId, filters],
  queryFn: () => fetchAuditLogs(projectId, filters),
  staleTime: 30_000,  // 30s — audit logs don't change under you; fresh enough
});
```

### Diff Rendering

For `payroll_entry.updated` events, render the diff as a two-column table rather than raw JSON. Parse the `diff` JSON column and display field names with before/after values:

```
┌──────────────────────┬─────────┬─────────┐
│ Field                │ Before  │ After   │
├──────────────────────┼─────────┼─────────┤
│ Monday ST hours      │ 6.0     │ 8.0     │
│ Gross wages          │ $420.00 │ $560.00 │
└──────────────────────┴─────────┴─────────┘
```

Use a `FIELD_LABELS` map on the client to translate column names (e.g., `mon_st`) to human-readable labels ("Monday ST hours").

### Pagination Approach

**Use offset pagination** for this feature. Rationale:
- Audit logs are project-scoped, not unbounded global feeds
- A 52-week project with 25 workers making 2 edits/week = ~2,600 rows/year max
- Date range filters keep most queries well under 500 rows per filter window
- Offset pagination is simpler to implement and supports "jump to page N" which users expect in compliance workflows
- Cursor pagination is warranted only if audit logs become unbounded (multi-year, no date filter) — flag for v4

**Query pattern:**
```sql
SELECT * FROM audit_logs
WHERE project_id = ?
  AND created_at >= ?
  AND created_at <= ?
ORDER BY created_at DESC
LIMIT 25 OFFSET (page - 1) * 25;
```

With the `idx_audit_project_time` index on `(project_id, created_at DESC)`, this query is fast for any project-scoped result set.

---

## 8. Implementation Approach for This Stack

### Where to Insert Audit Logs

**Do not** add `insertAuditLog()` calls directly in Express route handlers. Route handlers are already responsible for request validation, auth checking, DB operations, and response formatting. Adding audit logic here creates duplication and makes it easy to miss.

**Do** create a thin service layer for audited operations:

```
src/server/services/
  auditService.ts         — insertAuditLog(), listAuditLogs(), diffObjects()
  workerService.ts        — createWorker(), updateWorker(), deactivateWorker() — each calls auditService
  payrollEntryService.ts  — createEntry(), updateEntry(), deleteEntry() — each calls auditService
```

Routes call the service; the service calls the DB and then calls `auditService.insertAuditLog()`.

### diff Computation Helper

```typescript
// In auditService.ts
export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  omitFields: string[] = ['updatedAt', 'createdAt']
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter:  Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (omitFields.includes(key)) continue;
    if (before[key] !== after[key]) {
      changedBefore[key] = before[key];
      changedAfter[key]  = after[key];
    }
  }
  if (Object.keys(changedBefore).length === 0) return null; // nothing changed
  return { before: changedBefore, after: changedAfter };
}
```

Call this before writing the update to DB, using the fetched current row as `before` and the update payload as `after`. If `diffObjects` returns null (no actual change), skip the DB write entirely — this is a free no-op guard against "save with no changes" events.

### SSN Field Masking in Diffs

```typescript
const MASKED_FIELDS = ['ssnEncrypted', 'passwordHash'];

function maskSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result = { ...obj };
  for (const field of MASKED_FIELDS) {
    if (field in result) {
      result[field] = result[field] !== null ? '[REDACTED]' : null;
    }
  }
  return result;
}
```

Apply `maskSensitiveFields` to both `before` and `after` before calling `JSON.stringify()` for the `diff` column.

### Schema Migration

Add `audit_logs` as a new Drizzle migration. No existing tables need to be modified. The table is purely additive. Drizzle `push` or a migration file (`0XXX_add_audit_logs.ts`) both work.

---

## 9. Gaps / Unknowns

### Gap 1: State-Specific Retention Beyond 3 Years (MEDIUM confidence)

The federal standard is 3 years (confirmed). Some states require longer — the source cited 6 years for unnamed states. California and Washington have not been confirmed to exceed 3 years in official statutory text. **Action needed:** Before implementing any auto-delete or data retention job, review CA Labor Code § 1776 and WAC 296-127 for the exact retention period. Do not implement any audit log deletion until this is confirmed.

### Gap 2: DOL E-Audit Specific Format Requirements (LOW confidence)

This research found no evidence that the DOL requires audit logs to be in a specific machine-readable format (e.g., a specific CSV or XML schema for electronic audit submission). The requirement is that records be available for inspection — a PDF export of the activity log or direct database access would satisfy this. **If you ever face a formal DOL investigation**, consult legal counsel about whether the audit log export format needs to meet any specific standard.

### Gap 3: express-session `req.ip` Accuracy Behind Render.com Proxy (MEDIUM confidence)

The `ipAddress` column recommended above is useful but requires `app.set('trust proxy', 1)` in Express when deployed behind Render.com's reverse proxy. Without this setting, `req.ip` returns the proxy's IP, not the client's. **Verify this is set** in the existing Express app configuration before relying on `ipAddress` for audit purposes.

### Gap 4: Multi-User Concurrent Edit Conflicts (MEDIUM confidence)

With two project members editing payroll entries simultaneously, the diff-before-after approach can produce incorrect diffs if both users fetch the same "before" state. This is a last-write-wins race condition. At the current scale (owner + 1 member, low traffic), this is unlikely in practice. For a future v4 with larger teams, consider optimistic locking (version column on `payroll_entries`) or a pessimistic lock on week editing. Flag this but do not implement now.

### Gap 5: Audit Log Export for Auditor Delivery (NOT YET RESEARCHED)

DOL investigators may request records in a specific format. A CSV or PDF export of audit logs filtered by project and date range is a useful feature for compliance delivery. This was not scoped in this research pass. Flag for a future phase: `GET /api/projects/:id/audit-logs/export.csv` with the same filter params as the UI endpoint.

---

## Sources

### HIGH Confidence (Official / Authoritative)

- [FAR 52.222-8 — Payrolls and Basic Records](https://www.acquisition.gov/far/52.222-8) — 3-year retention, SSN usage, weekly submission requirements
- [DOL WHD Fact Sheet #66 — Davis-Bacon and Related Acts](https://www.dol.gov/agencies/whd/fact-sheets/66-dbra) — Recordkeeping overview
- [SQLite Write-Ahead Logging](https://www.sqlite.org/wal.html) — WAL mode behavior, checkpoint mechanics
- [DOL PII Guidance](https://www.dol.gov/general/ppii) — SSN handling in federal contractor context

### MEDIUM Confidence (Verified Technical Sources)

- [How to Build a Useful Service Data Change Audit Log](https://www.technowizardry.net/2022/05/how-to-build-a-useful-service-data-change-audit-log/) — Snapshot vs. diff tradeoffs, actor type, immutability principles
- [Audit Logging for Internal Tools](https://appmaster.io/blog/audit-logging-internal-tools-activity-feed) — Hybrid diff/snapshot recommendation, UI activity feed patterns
- [Database Audit Logging Best Practices](https://www.bytebase.com/blog/database-audit-logging/) — Index strategy, immutability, PII masking
- [Creating Audit Tables with SQLite and SQL Triggers](https://medium.com/@dgramaciotti/creating-audit-tables-with-sqlite-and-sql-triggers-751f8e13cf73) — SQLite trigger mechanics and pitfalls
- [Cursor vs. Offset Pagination](https://dev.to/jacktt/comparing-limit-offset-and-cursor-pagination-1n81) — Pagination tradeoff analysis
- [Prevailing Wage Record Keeping](https://blog.pivla.com/how-to-master-prevailing-wage-record-keeping-according-to-audit-experts) — Audit expert perspective on what investigators examine
- [Davis-Bacon 2026 Compliance Guide](https://www.lumberfi.com/blog/certified-payroll-requirements) — 3-year retention confirmation, weekly reporting requirements
- [Masking PII in Audit Logs](https://hoop.dev/blog/masking-pii-in-production-logs-for-iso-27001-compliance/) — PII masking requirements in compliance logs

---

*Research completed: 2026-04-01*
*Scope: Audit trail domain only — does not supersede SUMMARY.md, STACK.md, ARCHITECTURE.md, or PITFALLS.md*
