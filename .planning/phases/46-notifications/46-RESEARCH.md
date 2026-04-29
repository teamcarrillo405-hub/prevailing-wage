# Phase 46: Notifications - Research

**Researched:** 2026-04-06
**Domain:** Email notifications (Resend SDK), node-cron scheduling, project settings JSON, React preferences UI
**Confidence:** HIGH

---

## Summary

Phase 46 introduces five notification types plus a preferences UI for the prevailing-wage app. The project already has **Resend** installed (`^6.9.4`, current: `6.10.0`) and a fully working lazy-init pattern in `inviteService.ts` — Phase 46 must follow the same pattern rather than invent a new one. The `projectSettings` column exists in `projects` table as `text('project_settings')` (raw JSON string, no Drizzle JSON helper), already writeable via `PATCH /api/projects/:id`. The `node-cron` package (`^4.2.1`) is already installed and actively used in `index.ts` for the monthly wage sync, providing a proven cron registration pattern.

The hardest requirement is NOTIF-02 (due-soon reminder), which cannot be triggered by a user request. Research finds that the cron approach fits the existing architecture without any new infrastructure — a second `cron.schedule()` call is all that is needed. NOTIF-01 (violation notification) requires a careful design: `computeCompliance()` recomputes from scratch every call and has no "previous state" concept, so the email must fire on every compliance check that produces violations (not only on "new" violations). The planner must decide whether to scope the trigger to save/upsert actions only (to avoid re-sending on repeated GETs).

The `projectMembers` table joined with `users` gives all member emails for a project. The exact query pattern is already demonstrated in `team.ts`. No migration is needed — `projectSettings` exists and is already plumbed through PATCH.

**Primary recommendation:** Build a single `emailService.ts` that mirrors the `inviteService.ts` lazy-init pattern. Wire each notification as a best-effort `try/catch` call immediately after the relevant service/route action succeeds. Use `node-cron` for NOTIF-02 (daily scan at 7:00 AM). No new DB tables or columns needed.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-01 | Compliance violation email to all project members when `computeCompliance()` detects violations | `computeCompliance()` returns `ComplianceResult` with `violations[]` and `weekViolations[]`; project members queryable via `projectMembers` JOIN `users` |
| NOTIF-02 | Payroll due-soon reminder to project owner; configurable threshold (default 3 days) in `projects.settings` | `node-cron` already in use in `index.ts`; `listPayrollWeeks()` returns `weekEndingDate`; owner queryable via `projectMembers` |
| NOTIF-03 | Team member activity notification to project owner when non-owner creates/modifies payroll entry or worker record | `upsertPayrollEntry` and `createWorker`/`updateWorker` pass `userId`; owner email queryable from `projectMembers` JOIN `users` |
| NOTIF-04 | Submission confirmation to acting user for CA DIR / WA L&I / NY MPWR / IL IDOL toggles | Four routes already in `payroll.ts`: `/ca-submit`, `/wa-submit`, `/ny-submit`, `/il-submit`; `req.user.email` available |
| NOTIF-05 | Notification preferences UI on ProjectDetailPage; settings persisted to `projects.settings` JSON column | `projectSettings` column: `text('project_settings')` (nullable); `PATCH /api/projects/:id` already accepts `projectSettings` string |
| NFR-02 | All email triggers are non-fatal (log on failure, never 500) | Matches existing `auditService` pattern — `try { await sendX() } catch (err) { console.error(...) }` |
| NFR-05 | New migration files have corresponding schema.ts update (only if migration needed) | No migration needed — `projectSettings` column already exists in schema.ts at line 48 |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | ^6.9.4 (current: 6.10.0) | Transactional email delivery | Already installed; used in `inviteService.ts` with proven lazy-init pattern |
| node-cron | ^4.2.1 | NOTIF-02 daily due-soon scan | Already installed; used in `index.ts` for monthly wage sync |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | ^0.45.1 | DB queries for member lookup, project settings read | Already the project ORM for all queries |
| zod | ^4.3.6 | Validate notification preferences shape from client | Already used for all route schemas |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | nodemailer | nodemailer requires SMTP credentials; Resend already installed and used |
| node-cron daily scan | Opportunistic check on GET project | Cron is reliable and fits established pattern; GET-based approach fires too frequently and could spam |
| node-cron daily scan | node-schedule | node-schedule not installed; node-cron already in package.json with types |

**No installation needed** — all required packages are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure

New files to create:
```
src/server/services/
└── emailService.ts      # Resend lazy-init + all send functions
```

Existing files to modify:
```
src/server/index.ts                          # Add NOTIF-02 cron job
src/server/services/complianceService.ts     # NOTIF-01 hook in computeCompliance()
src/server/services/workerService.ts         # NOTIF-03 hook in createWorker/updateWorker
src/server/services/payrollService.ts        # NOTIF-03 hook in upsertPayrollEntry
src/server/routes/payroll.ts                 # NOTIF-04 hooks in ca/wa/ny/il-submit routes
src/server/routes/projects.ts               # NOTIF-05 settings endpoint already exists
src/client/pages/ProjectDetailPage.tsx       # NOTIF-05 preferences panel
```

### Pattern 1: Resend Lazy-Init (matches inviteService.ts)

The existing codebase already establishes this exact pattern. Mirror it precisely.

```typescript
// src/server/services/emailService.ts
import { getDb } from '../db/index.js';
import { projectMembers, users, projects } from '../db/schema.js';
import { eq, isNull, and } from 'drizzle-orm';

let resendInstance: any = null;
async function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    const { Resend } = await import('resend');
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@hccprevailingwage.com';
```

### Pattern 2: Non-Fatal Email Call (NFR-02)

Every email call in routes and services follows this exact pattern:

```typescript
try {
  await sendViolationEmail(projectId, weekId, violations);
} catch (err) {
  console.error('[email] violation notification failed:', err);
}
```

This matches the existing `[audit]` best-effort pattern throughout the codebase.

### Pattern 3: Querying Project Members' Emails

The query to get all active member emails for a project (proven in `team.ts`):

```typescript
// Source: src/server/routes/team.ts lines 104-121
const rows = await db
  .select({
    userId: projectMembers.userId,
    role: projectMembers.role,
    email: users.email,
  })
  .from(projectMembers)
  .innerJoin(users, eq(projectMembers.userId, users.id))
  .where(
    and(
      eq(projectMembers.projectId, projectId),
      isNull(projectMembers.removedAt),
    ),
  );
// Filter owners: rows.filter(r => r.role === 'owner')
// All members: rows.map(r => r.email)
```

### Pattern 4: Reading projectSettings JSON

`projectSettings` is `text('project_settings')` — a nullable raw JSON string. Parse defensively:

```typescript
function getNotifSettings(rawSettings: string | null): NotifSettings {
  const DEFAULT: NotifSettings = {
    notifyViolations: true,
    notifyDueSoon: true,
    dueSoonDays: 3,
    notifyActivity: true,
    notifySubmission: true,
  };
  if (!rawSettings) return DEFAULT;
  try {
    const parsed = JSON.parse(rawSettings);
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}
```

**Critical:** When saving notification preferences, you must merge with any existing projectSettings content — not overwrite it. Other fields (NY-specific, etc.) are stored in the same column.

### Pattern 5: node-cron Registration (matches index.ts wage-sync)

```typescript
// Inside app.listen() callback — MUST be inside callback so getDb() is initialized
// Source: src/server/index.ts lines 72-81
cron.schedule('0 7 * * *', async () => {
  console.log('[due-soon] Running daily payroll due-soon scan');
  try {
    await runDueSoonScan();
  } catch (err) {
    console.error('[due-soon] Scan failed:', err);
    // Never rethrow — cron failures must not crash Express
  }
}, { timezone: 'America/New_York' });
```

### NOTIF-02 Due-Soon Scan Algorithm

The scan must iterate all active projects, check their `projectSettings.dueSoonDays` threshold, compare `weekEndingDate` of the latest payroll week against today, and email the owner if the week is within threshold and no submission has been recorded.

Key data points available:
- `payrollWeeks.weekEndingDate` — ISO date string, compare to `new Date().toISOString().slice(0,10)`
- `payrollWeeks.submittedAt` — null if not yet submitted (reminder is only relevant if not submitted)
- `projects.projectSettings` — contains `dueSoonDays`
- Owner email from `projectMembers JOIN users WHERE role = 'owner'`

```typescript
// Pseudo-logic for due-soon scan
async function runDueSoonScan(): Promise<void> {
  const db = getDb();
  const allActiveProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.status, 'active'));

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const project of allActiveProjects) {
    const settings = getNotifSettings(project.projectSettings);
    if (!settings.notifyDueSoon) continue;

    const weeks = await listPayrollWeeks(project.id);
    // Most recent unsubmitted week
    const unsubmitted = weeks.find(w => !w.submittedAt);
    if (!unsubmitted) continue;

    const daysUntilDue = dateDiffDays(today, unsubmitted.weekEndingDate);
    if (daysUntilDue >= 0 && daysUntilDue <= settings.dueSoonDays) {
      // Send to owner
      await sendDueSoonEmail(project, unsubmitted, settings.dueSoonDays);
    }
  }
}
```

### NOTIF-01 Placement Decision

`computeCompliance()` is called from:
1. `GET /api/compliance/weeks/:weekId` route
2. `getBatchProjectCompliance()` (dashboard)
3. `getWorkerComplianceHistory()` (audit page)

**Correct placement:** Do NOT hook inside `computeCompliance()` itself — it is called on every read including batch/dashboard scans. Instead, hook the email trigger in the **route handler** that calls `computeCompliance()` after a **write action** — specifically after `upsertPayrollEntry` succeeds (in `payrollService.ts` or the route). The email fires once per save, using the compliance result of the week that was just modified.

**Alternative approach (simpler):** Hook directly in `POST /api/payroll/entries` and `PUT /api/payroll/entries/:id` route handlers — after the upsert succeeds, call `computeCompliance()` and if `result.hasViolations`, send email. This is the recommended approach as it scopes the trigger to user-initiated saves only.

### NOTIF-05 UI Structure

`ProjectDetailPage.tsx` currently has:
- No gear icon, no settings tab, no modal for project settings
- A flat layout: PageHeader + HelpCallout + WorkflowProgress + Card (project details) + Button row + nav links

The notification preferences panel should be added as a collapsible section or modal triggered by a gear/settings button in the action button row (line 203 area). It should use the existing `Card` UI primitive and project `PATCH` mutation pattern. The page currently reads project as a narrow `Project` interface — it must be extended to include `projectSettings: string | null`.

The `useMutation` pattern for saving settings follows `restoreMutation` (line 113): `api.patch('/projects/${id}', { projectSettings: JSON.stringify(newSettings) })`.

### Anti-Patterns to Avoid

- **Hooking email inside `computeCompliance()` directly:** It is called on GET reads and batch scans — would spam every dashboard load.
- **Overwriting `projectSettings` without merging:** The column stores other fields (NY form data, etc.); always merge with existing parsed object.
- **Initializing Resend at module load time:** Will throw if `RESEND_API_KEY` not set. Use lazy init exactly as `inviteService.ts` does.
- **Using `nodemailer` or any SMTP approach:** Resend is already installed and in use; adding a second email provider creates confusion.
- **Running cron job outside `app.listen()` callback:** `getDb()` is not initialized until the server starts listening. Wage sync cron is inside the callback for this exact reason.
- **Sending NOTIF-02 without checking `submittedAt`:** A submitted week does not need a reminder.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP transport | Resend SDK (already installed) | Handles retries, deliverability, SPF/DKIM |
| Cron scheduling | setTimeout loop or manual interval | node-cron (already installed and used) | Timezone-aware, crontab syntax, non-crashing |
| HTML email templates | Inline JSX renderer | Plain HTML strings (matches inviteService pattern) | No template engine needed at this scale |

---

## Common Pitfalls

### Pitfall 1: NOTIF-02 Double-Sending on Server Restart

**What goes wrong:** If the server restarts mid-day, the daily cron fires again at the next scheduled time. If the scan ran before the restart, the owner receives two emails on the same day.

**Why it happens:** No "sent today" flag is stored; the cron just re-evaluates state.

**How to avoid:** Accept this edge case at current scale (solo/small-team app). Alternatively, record a `lastDueSoonSentAt` field inside `projectSettings`. The planner should decide — document the chosen approach in the plan.

**Warning signs:** Users report duplicate emails after deployments.

### Pitfall 2: projectSettings Merge Corruption

**What goes wrong:** Client sends `{ notifyViolations: true }` and the PATCH replaces the entire `projectSettings` string, wiping NY form data stored alongside.

**Why it happens:** `projectSettings` is a single JSON blob; naive overwrite drops sibling keys.

**How to avoid:** Server-side merge: `PATCH /api/projects/:id` already passes `projectSettings` as a string — the client must send the full merged object, OR the server must read-modify-write the column.

**Recommended approach:** Have the preferences endpoint (`PATCH /api/projects/:id`) merge on the server: read current `projectSettings`, parse, spread notification prefs over it, stringify back. The existing `PATCH` handler does a direct set — add server-side merge logic for the `projectSettings` key specifically.

### Pitfall 3: NOTIF-01 Fires on Every Compliance Read (Not Just Saves)

**What goes wrong:** Email sent on every GET to the compliance endpoint, not just when user saves payroll data.

**Why it happens:** `computeCompliance()` is called on reads too; hooking inside the function fires indiscriminately.

**How to avoid:** Only call the notification email from write-path routes (POST/PUT on payroll entries), never from GET-only paths.

### Pitfall 4: NOTIF-03 Fires for Owner's Own Edits

**What goes wrong:** Owner edits their own payroll entries and receives an activity notification about themselves.

**Why it happens:** NOTIF-03 spec says "when a non-owner creates/modifies". If the check is omitted, owner self-notifications fire.

**How to avoid:** In the email helper, compare `actingUserId` against the owner's userId; skip if equal. The `userId` is available as `input.userId` in `createWorker`/`updateWorker`/`upsertPayrollEntry`.

### Pitfall 5: Resend Sends to `undefined` When Email Missing

**What goes wrong:** `resend.emails.send({ to: [undefined] })` throws or silently fails.

**Why it happens:** `users.email` should always be non-null, but defensive checks are cheap.

**How to avoid:** Filter out null/undefined from the `to` array before calling `resend.emails.send`. Add a guard: `if (!recipients.length) return;`.

### Pitfall 6: node-cron NOTIF-02 Scan Hitting All Projects at Scale

**What goes wrong:** Scanning every active project with every payroll week every day becomes slow as data grows.

**Why it happens:** `listPayrollWeeks()` fetches all weeks per project; a scan over many projects makes N+1 queries.

**How to avoid:** At current scale (small-team app) this is acceptable. If needed, add a single SQL query joining `payroll_weeks`, `projects`, `project_members`, and `users` to fetch all relevant data in one pass.

---

## Code Examples

### Resend lazy-init (from inviteService.ts — source of truth)

```typescript
// Source: src/server/services/inviteService.ts lines 7-17
let resendInstance: any = null;
async function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    const { Resend } = await import('resend');
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}
```

### Resend send call (from inviteService.ts)

```typescript
// Source: src/server/services/inviteService.ts lines 25-34
const { error } = await resend.emails.send({
  from: FROM_EMAIL,
  to: [to],
  subject: 'Your subject',
  html: `<p>Your html body</p>`,
});
if (error) {
  console.error('[email] Resend error:', error);
  // Non-fatal — log and continue
}
```

### node-cron registration (from index.ts — source of truth)

```typescript
// Source: src/server/index.ts lines 73-81
cron.schedule('0 2 1 * *', async () => {
  console.log('[wage-sync] Starting monthly sync');
  try {
    await runWageSync();
  } catch (err) {
    console.error('[wage-sync] Failed:', err);
    // Never rethrow — cron failures must not crash Express
  }
}, { timezone: 'America/New_York' });
```

### Project member email query (from team.ts)

```typescript
// Source: src/server/routes/team.ts lines 105-121
const rows = await db
  .select({ userId: projectMembers.userId, role: projectMembers.role, email: users.email })
  .from(projectMembers)
  .innerJoin(users, eq(projectMembers.userId, users.id))
  .where(and(eq(projectMembers.projectId, projectId), isNull(projectMembers.removedAt)));
const allEmails = rows.map(r => r.email);
const ownerEmail = rows.find(r => r.role === 'owner')?.email;
const ownerUserId = rows.find(r => r.role === 'owner')?.userId;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nodemailer + SMTP | Resend SDK | Phase 33 (invite flow) | Resend is the established standard for this project |
| No cron | node-cron in index.ts | Phase 2 (wage sync) | Cron infrastructure exists; add jobs inside listen() callback |

---

## Open Questions

1. **NOTIF-01 trigger frequency: per-save or per-week-change?**
   - What we know: `computeCompliance()` runs from scratch every call; it does not track "new vs existing" violations
   - What's unclear: Should the email fire every time the user saves an entry (even if violations existed before), or only once per unique violation detection?
   - Recommendation: Fire on every save that produces violations (simplest implementation, matches NFR-02 non-fatal intent). Add a note to the plan that this may result in repeated emails if the user saves without fixing the violation.

2. **NOTIF-02 deduplication: accept duplicate on restart or add `lastSentAt`?**
   - What we know: No dedup mechanism currently exists in the codebase
   - What's unclear: Whether the user wants exactly-once semantics for due-soon emails
   - Recommendation: Add `lastDueSoonNotifiedAt` as a key inside `projectSettings` JSON. Set it when the email sends; skip if already sent today. This avoids a migration.

3. **APP_URL for email links (NOTIF-01, PayrollWeekDetailPage link)**
   - What we know: `process.env.APP_URL` is used in `team.ts` (line 165) for invite URLs; it is not in `.env.example`
   - What's unclear: Whether `APP_URL` is set in production
   - Recommendation: Use `process.env.APP_URL || 'http://localhost:3000'` as the base for all notification links. Add `APP_URL` to `.env.example`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| resend npm package | All NOTIF email sends | Yes | ^6.9.4 (6.10.0 current) | Graceful no-op if `RESEND_API_KEY` not set |
| RESEND_API_KEY env var | Actual email delivery | Unknown (not in .env.example) | — | Log to console, skip send |
| RESEND_FROM_EMAIL env var | Sender address | Unknown (not in .env.example) | — | Default: `notifications@hccprevailingwage.com` |
| APP_URL env var | Email links back to app | Unknown (used in team.ts but not in .env.example) | — | Default: `http://localhost:3000` |
| node-cron | NOTIF-02 daily scan | Yes (in package.json + index.ts) | ^4.2.1 | — |
| @types/node-cron | TypeScript types for cron | Yes (in devDependencies) | ^3.0.11 | — |

**Missing dependencies with no fallback:** None — all are either present or have graceful fallbacks.

**Missing dependencies with fallback:**
- `RESEND_API_KEY` not in `.env.example`: If absent, lazy-init returns `null` and all send functions log the message and return early. Email silently skipped. This is intentional (NFR-02 compliant).

---

## Migration Assessment

**No migration needed.** The `projectSettings` column already exists:

```typescript
// src/server/db/schema.ts line 48
projectSettings: text('project_settings'),
```

It is already:
- Included in the `projects` table definition
- Accepted by `CreateProjectSchema` and `UpdateProjectSchema` in `routes/projects.ts` (lines 34, 51)
- Handled in `PATCH /api/projects/:id` (line 174)
- Returned by `GET /api/projects/:id`

No `ALTER TABLE` migration file is required for Phase 46. NFR-05 is satisfied by confirming the column already exists.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `package.json` (scripts: `"test": "vitest run"`) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| NOTIF-01 | Violation email called when `computeCompliance()` returns violations after entry save | unit (mock Resend) | `npm test` | Test emailService with mocked resend |
| NOTIF-02 | Due-soon scan emails owner when unsubmitted week within threshold | unit (mock Resend + DB) | `npm test` | Test `runDueSoonScan()` directly |
| NOTIF-03 | Activity email skips owner's own edits; fires for member edits | unit (mock Resend) | `npm test` | Test actor-vs-owner check |
| NOTIF-04 | Submission confirmation email sent to `req.user.email` on agency submit toggle | integration or unit | `npm test` | Can use supertest for route test |
| NOTIF-05 | Preferences saved to `projectSettings` without corrupting sibling keys | unit | `npm test` | Test merge logic in isolation |
| NFR-02 | Email failure does not propagate to route handler (no 500) | unit | `npm test` | Mock Resend to throw; assert response is still 200/201 |

### Wave 0 Gaps
- [ ] `src/server/services/emailService.test.ts` — unit tests for all send functions with mocked Resend
- [ ] `src/server/services/dueSoonScan.test.ts` — unit test for due-soon scan algorithm with mocked DB

*(Existing test infrastructure — vitest, supertest — covers Phase 46 needs. No new framework install required.)*

---

## Sources

### Primary (HIGH confidence)
- `src/server/services/inviteService.ts` — Resend lazy-init and send pattern (source of truth for email)
- `src/server/index.ts` — node-cron registration pattern inside `app.listen()` callback (source of truth for scheduling)
- `src/server/db/schema.ts` — confirms `projectSettings: text('project_settings')` at line 48
- `src/server/routes/projects.ts` — confirms `projectSettings` in `UpdateProjectSchema` and PATCH handler
- `src/server/routes/team.ts` — confirms `projectMembers JOIN users` query pattern for member emails
- `src/server/routes/payroll.ts` — confirms four agency submit routes: `/ca-submit`, `/wa-submit`, `/ny-submit`, `/il-submit`
- `src/server/services/complianceService.ts` — confirms `computeCompliance()` return shape: `ComplianceResult`
- `src/server/services/workerService.ts` — confirms `createWorker`/`updateWorker` hook points with `userId`
- `src/server/services/payrollService.ts` — confirms `upsertPayrollEntry` hook point with `userId`
- `package.json` — confirms `resend: ^6.9.4`, `node-cron: ^4.2.1`, `@types/node-cron: ^3.0.11`
- npm registry — `resend` current version 6.10.0 (within ^6.9.4 range)

### Secondary (MEDIUM confidence)
- `src/client/pages/ProjectDetailPage.tsx` — current UI structure; no gear icon or settings tab exists; addition point identified at action button row (line 203)

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply to Phase 46 implementation:

1. **Design tokens**: All brand colors via `@theme` tokens — never hardcode `#F5C518` or `#1a1a1a` in JSX. Use `bg-nav-dark`, `border-brand-gold`, `text-brand-gold`, `bg-brand-gold`, `bg-surface-card`, `bg-surface-page`.
2. **Typography**: `font-headline` (Oswald) for h1–h4, `font-body` (Inter) for body text.
3. **UI Primitives**: Use `Card`, `Button`, `Badge`, `PageHeader`, `EmptyState` from `src/client/components/ui/` — never inline equivalents.
4. **Migration pattern**: Migrations are plain SQL `ALTER TABLE ... ADD COLUMN` in `src/server/db/migrations/`. **Always register in `meta/_journal.json`**. (Phase 46 does not require a migration.)
5. **Non-fatal pattern**: Email errors must follow the existing `[audit]` pattern — `try { await sendX() } catch (err) { console.error('[email]', err) }` — never rethrow.
6. **React patterns**: `useRef` for synchronous guards; TanStack Query keys must include all variable state.
7. **Server port**: 4099.
8. **GSD workflow**: Plans at `.planning/phases/NN-slug/NN-PP-PLAN.md`.

---

## Metadata

**Confidence breakdown:**
- Email transport (Resend): HIGH — `inviteService.ts` provides the exact pattern; same package version
- Cron scheduling (NOTIF-02): HIGH — `index.ts` provides the exact registration pattern
- `projectSettings` column: HIGH — confirmed in `schema.ts` line 48 and routes
- Member email query: HIGH — `team.ts` provides the exact Drizzle query
- NOTIF-01 trigger placement: MEDIUM — the "fire on save, not on read" recommendation is architecturally sound but the spec is ambiguous about whether repeat-send is acceptable
- UI (NOTIF-05 preferences panel): MEDIUM — exact component structure is planner's decision; UI primitives are confirmed

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable packages; Resend API unlikely to change in 30 days)
