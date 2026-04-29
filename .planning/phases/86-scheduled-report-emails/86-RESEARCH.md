# Phase 86: Scheduled Report Emails — Research

**Researched:** 2026-04-26
**Domain:** Scheduled email jobs (Resend + node-cron), projectSettings JSON extension, ProjectSettingsPage UI extension
**Confidence:** HIGH

---

## Summary

Phase 86 adds a scheduled compliance summary email feature: per-project cron-driven reports on daily/weekly/monthly cadences, user-configurable via the existing ProjectSettingsPage at `/projects/:projectId/settings`, with an unsubscribe mechanism linked from email footers.

The infrastructure is already 100% in place. Resend (`^6.9.4`) is the project email provider, used in `emailService.ts` with a proven lazy-init pattern. `node-cron` (`^4.2.1`) is registered in `src/server/index.ts` with four active jobs — the cadence for adding a fifth is well established. `projectSettings` is a `text('project_settings')` nullable column on the `projects` table (schema line 72), already storing notification prefs and other per-project JSON blobs. No DB migration is required unless an unsubscribe token column is added (see Open Questions).

NOTIF-05 in the original Phase 46 definition referred to the notification preferences UI panel — that was already delivered (ProjectDetailPage gear icon + panel). For Phase 86, NOTIF-05 means extending `projectSettings` with `reportSchedule` and `reportEmail` fields, and NOTIF-06 means the cron job itself plus the unsubscribe endpoint. The ROADMAP Phase 86 success criteria are the authoritative definition.

The compliance summary content (compliance rate %, open violations count, weeks due in next 7 days) is derivable using existing functions: `getBatchProjectCompliance()` covers violation counts, and `listPayrollWeeks()` with `dateDiffDays()` covers due-in-7-days logic. No new service logic needs to be invented.

**Primary recommendation:** Create `src/server/jobs/scheduledReports.ts` mirroring `certificationExpiryAlerts.ts` structure. Extend `projectSettings` JSON (no migration). Add one `cron.schedule()` call in `index.ts` that runs daily at 08:00 UTC and dispatches based on each project's `reportSchedule` field and current day/date. Add a report schedule section to `ProjectSettingsPage.tsx`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-05 | `projectSettings` JSON gains `reportSchedule: 'daily' \| 'weekly' \| 'monthly' \| 'off'` and `reportEmail: string` fields; ProjectSettingsPage has a report schedule selector and email input | `projectSettings` is `text('project_settings')` at schema.ts line 72; server-side merge already implemented in PATCH /api/projects/:id (`resolvedProjectSettings` pattern); ProjectSettingsPage is the correct target page (route: `/projects/:projectId/settings`) |
| NOTIF-06 | Cron job in `src/server/jobs/scheduledReports.ts` runs at 08:00 UTC daily; dispatches to each project based on schedule; sends compliance summary via Resend; unsubscribe endpoint at `POST /api/notifications/unsubscribe` | Resend lazy-init in `emailService.ts` is the source of truth; `certificationExpiryAlerts.ts` is the structural pattern for a standalone job file; `listPayrollWeeks` + `dateDiffDays` are available for due-in-7-days data; `getBatchProjectCompliance` or a lighter per-project query can supply compliance rate |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

1. **Design tokens:** All brand colors via `@theme` tokens — never hardcode `#F5C518` or `#1a1a1a` in JSX. Tokens: `bg-nav-dark`, `border-brand-gold`, `text-brand-gold`, `bg-brand-gold`, `bg-surface-card`, `bg-surface-page`.
2. **Typography:** `font-headline` (Oswald) for h1–h4, `font-body` (Inter) for body text.
3. **UI Primitives:** Use `Card`, `Button`, `Badge`, `PageHeader`, `EmptyState` from `src/client/components/ui/` — never inline equivalents.
4. **Migration pattern:** Migrations are plain SQL `ALTER TABLE ... ADD COLUMN` in `src/server/db/migrations/`. **Always register in `meta/_journal.json`**. Next migration index is **55**. (Phase 86 does NOT require a migration — reportSchedule/reportEmail live in the existing `projectSettings` JSON blob.)
5. **Non-fatal pattern:** Email errors follow `try { await sendX() } catch (err) { logger.error({ err }, '[tag]') }` — never rethrow.
6. **React patterns:** `useRef` for synchronous guards; TanStack Query keys must include all variable state.
7. **Server port:** 4099 (dev). `PORT` env var in production.
8. **Cron registration:** MUST be inside `app.listen()` callback in `index.ts` so `getDb()` is initialized.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | ^6.9.4 (installed) | Transactional email delivery | Already installed and in use; `emailService.ts` is the source of truth |
| node-cron | ^4.2.1 (installed) | Scheduled job trigger | Already installed; 4 active cron jobs in `index.ts`; proven pattern |
| drizzle-orm | ^0.45.1 (installed) | DB queries (project scan, member lookup) | Project ORM — all queries use this |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | built-in | UUID for unsubscribe tokens (`randomUUID()`) | No uuid package needed; matches Phase 39+ pattern |
| zod | ^4.3.6 (installed) | Validate unsubscribe endpoint body | Already used for all route schemas |

**No installation needed.** All required packages are in `package.json`.

---

## Architecture Patterns

### New Files
```
src/server/jobs/
└── scheduledReports.ts      # Phase 86 cron job — mirrors certificationExpiryAlerts.ts

src/server/routes/
└── notifications.ts          # POST /api/notifications/unsubscribe — new route
```

### Existing Files to Modify
```
src/server/index.ts                          # Register scheduledReports cron job inside listen()
src/client/pages/ProjectSettingsPage.tsx     # Add "Report Schedule" section
```

### Pattern 1: Standalone Job File (matches certificationExpiryAlerts.ts exactly)

`certificationExpiryAlerts.ts` is the canonical pattern for Phase 86. Key characteristics:
- Lazy-init Resend at top of file (private to the module)
- `export async function runScheduledReports(): Promise<void>` — the only export
- Full try/catch per-project — one failure never aborts the scan
- Uses `logger.info` / `logger.error` from `../logger.js`
- Uses `getDb()` inside the exported function body

```typescript
// src/server/jobs/scheduledReports.ts
import { logger } from '../logger.js';
import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, projectMembers, users } from '../db/schema.js';

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
const APP_URL    = process.env.APP_URL    || 'http://localhost:3000';

export async function runScheduledReports(): Promise<void> { ... }
```

### Pattern 2: Cron Registration (matches index.ts existing jobs)

The fifth cron job follows the exact same block pattern as the four already registered. Key constraint: 08:00 UTC per ROADMAP success criterion 2.

```typescript
// Inside app.listen() callback — after the cert-expiry block
cron.schedule('0 8 * * *', async () => {
  logger.info('scheduled-reports: running daily report dispatch');
  try {
    await runScheduledReports();
  } catch (err) {
    logger.error({ err }, 'scheduled-reports: failed');
    // Never rethrow — cron failures must not crash Express
  }
}, { timezone: 'UTC' });  // 08:00 UTC per ROADMAP spec
```

### Pattern 3: Schedule Dispatch Logic

The daily job runs for all projects. For each project it checks `reportSchedule` and the current day to decide whether to send:

```typescript
const today = new Date();
const todayISO = today.toISOString().slice(0, 10);
const dayOfWeek = today.getUTCDay(); // 0=Sunday, 1=Monday...
const dayOfMonth = today.getUTCDate(); // 1-31

// For each project with reportSchedule !== 'off':
if (settings.reportSchedule === 'daily') { send(); }
if (settings.reportSchedule === 'weekly' && dayOfWeek === 1) { send(); }  // Mondays
if (settings.reportSchedule === 'monthly' && dayOfMonth === 1) { send(); }  // 1st of month
```

This approach requires a single cron schedule at 08:00 UTC daily and avoids three separate cron expressions.

### Pattern 4: projectSettings Extension (no migration needed)

`projectSettings` is `text('project_settings')` (nullable raw JSON string). Phase 46 already established the read-modify-write merge pattern in `projects.ts` PATCH handler (`resolvedProjectSettings`). Phase 86 adds two new keys to the same JSON blob:

```typescript
// New keys added to the existing NotifSettings-like blob:
interface ReportSettings {
  reportSchedule: 'daily' | 'weekly' | 'monthly' | 'off';  // default: 'off'
  reportEmail: string;                                        // default: '' (uses owner email if blank)
}
```

**Critical:** When the client PATCHes only `{ projectSettings: JSON.stringify({ reportSchedule: 'weekly', reportEmail: 'x@y.com' }) }`, the server-side read-modify-write merge in `projects.ts` (already implemented as `resolvedProjectSettings`) will preserve all sibling keys (notif prefs, NY form data, lastDueSoonNotifiedAt, etc.). This merge is already in place and working — no changes needed to `projects.ts`.

### Pattern 5: Compliance Summary Data Assembly

The email body requires:
1. **Compliance rate %** — computed per-project: `compliantWeeks / totalWeeks * 100`
2. **Open violations count** — from `getBatchProjectCompliance()` or a lighter per-project scan
3. **Payroll weeks due in next 7 days** — reuse `listPayrollWeeks()` + `dateDiffDays()` from `dueSoonService.ts`

For the scheduled report job, a lightweight per-project query is more appropriate than calling `getBatchProjectCompliance()` which requires a `userId` and iterates all user projects. The job should query the project's weeks directly:

```typescript
const allWeeks = await listPayrollWeeks(projectId);
const totalWeeks = allWeeks.length;
// For each week: call computeCompliance() to get violation status
// Track compliant/violation counts and unsubmitted weeks within 7 days
```

**Performance note:** `listPayrollWeeks()` + per-week `computeCompliance()` is an N+1 query per project. At current scale (small team app, <100 projects), this is acceptable. Flag for optimization if project count exceeds 50.

### Pattern 6: Unsubscribe Token

The ROADMAP specifies "unsubscribe token appended to footer links to `POST /api/notifications/unsubscribe`". The simplest implementation that avoids a new DB table:

- Token = `randomUUID()` stored in `projectSettings` JSON as `reportUnsubscribeToken`
- Generated when the user first saves a `reportSchedule !== 'off'` setting
- `POST /api/notifications/unsubscribe` body: `{ token: string }` — scans projects for matching token, sets `reportSchedule: 'off'`
- No expiry needed for unsubscribe tokens (they persist until the user re-enables)

This avoids a migration entirely. Token lives in the same `projectSettings` blob.

### Pattern 7: ProjectSettingsPage Extension

`ProjectSettingsPage.tsx` is the correct UI target (not `ProjectDetailPage.tsx`). The page currently has:
- GPS Clock-In section (card)
- Transfer Ownership section (card)

Phase 86 adds a third card: "Compliance Report Schedule". The `Project` interface in this page needs two new fields (`reportSchedule` and `reportEmail` are read from `projectSettings` JSON, not direct DB columns — parse the same way `parseNotifSettings` does in `ProjectDetailPage.tsx`).

```typescript
// Parse helper (local to ProjectSettingsPage.tsx)
function parseReportSettings(raw: string | null | undefined): ReportSettings {
  const DEFAULT: ReportSettings = { reportSchedule: 'off', reportEmail: '' };
  if (!raw) return DEFAULT;
  try {
    const parsed = JSON.parse(raw);
    return {
      reportSchedule: parsed.reportSchedule ?? 'off',
      reportEmail: parsed.reportEmail ?? '',
    };
  } catch {
    return DEFAULT;
  }
}
```

The save mutation calls `api.patch('/projects/:projectId', { projectSettings: JSON.stringify({ reportSchedule, reportEmail }) })` — server-side merge preserves GPS and notification prefs.

**The `Project` interface in `ProjectSettingsPage.tsx` does NOT currently include `projectSettings`** — it must be added (currently only has GPS fields).

### Anti-Patterns to Avoid

- **Calling `getBatchProjectCompliance(db, userId)` from the job:** Requires a userId parameter and iterates all user's projects. Wrong tool for a server-side scan. Query the project directly using `listPayrollWeeks()` + `computeCompliance()`.
- **Overwriting projectSettings without merging:** The existing server-side merge in `projects.ts` PATCH handler handles this correctly. Do not bypass it by writing directly from the job (the job does its own read-modify-write when updating `lastReportSentAt`).
- **Running cron outside `app.listen()` callback:** `getDb()` is not initialized until after `app.listen()` fires. All 4 existing jobs are registered inside the callback for this reason.
- **Using `nodemailer` instead of Resend:** Resend is the established email provider for this project. The ROADMAP says "nodemailer" but this is an error in the ROADMAP text — the project uses Resend exclusively. Phase 46 decisions locked this.
- **Three separate cron expressions for daily/weekly/monthly:** Use a single daily cron and dispatch logic inside the job. Simpler and matches the "one job per concern" pattern.
- **Storing unsubscribe token in a new table:** Unnecessary migration. Token fits cleanly in `projectSettings` JSON.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP transport | Resend SDK (`emailService.ts`) | Already wired; handles SPF/DKIM/retries |
| Cron scheduling | setInterval / setTimeout | `node-cron` (installed + in use) | Timezone-aware; non-crashing; proven |
| Compliance rate calculation | New service method | `computeCompliance()` per week + aggregate | Function exists, handles all state-specific rules |
| Due-soon week detection | New date logic | `listPayrollWeeks()` + `dateDiffDays()` from `dueSoonService.ts` | Already imported/tested in the project |
| UUID for unsubscribe token | `uuid` package | `crypto.randomUUID()` (built-in) | No new dependency; matches Phase 39+ pattern |

---

## Common Pitfalls

### Pitfall 1: ROADMAP says "nodemailer" — project uses Resend

**What goes wrong:** Planner reads "same nodemailer dual-format pattern" in the ROADMAP success criteria and imports `nodemailer`. This project has never used nodemailer; `emailService.ts` uses Resend.

**Why it happens:** ROADMAP text error. The decisions log in STATE.md (line 58) explicitly states: "nodemailer@8.0.4 installed for invite email (available for notification emails in v4.0)" — this was a pre-Phase 46 note that was superseded when Phase 46 chose Resend. Current `package.json` has `resend`, not `nodemailer`.

**How to avoid:** All email in Phase 86 uses the Resend lazy-init pattern from `emailService.ts`. Plain text fallback is achieved via the Resend `text` field alongside `html`.

### Pitfall 2: NOTIF-05 is Already Partially Delivered

**What goes wrong:** Planner tries to re-implement the notification preferences gear button on `ProjectDetailPage.tsx` (Phase 46 work) instead of extending `ProjectSettingsPage.tsx`.

**Why it happens:** NOTIF-05 in Phase 46 referred to the notification prefs UI. For Phase 86, NOTIF-05 means adding `reportSchedule` / `reportEmail` to `projectSettings` and surfacing it in the Settings page.

**How to avoid:** Phase 86 target is `ProjectSettingsPage.tsx` (route `/projects/:projectId/settings`), NOT `ProjectDetailPage.tsx`. There is a "Settings" link from `ProjectDetailPage.tsx` line 1379 that navigates to this page — users will naturally reach it.

### Pitfall 3: ProjectSettingsPage Project Interface Missing projectSettings

**What goes wrong:** The `Project` interface in `ProjectSettingsPage.tsx` only has `id`, `name`, `gpsClockInEnabled`, `gpsLatitude`, `gpsLongitude`, `gpsRadiusMeters`. It does NOT include `projectSettings`. The component will silently use `undefined` when parsing report settings.

**How to avoid:** Add `projectSettings: string | null` to the interface in `ProjectSettingsPage.tsx` before reading it. The server already returns this field in `GET /api/projects/:id`.

### Pitfall 4: Per-Project computeCompliance is N+1 — Use Week Count Only If Needed

**What goes wrong:** Calling `computeCompliance()` for every week of every project in the scheduled job makes the scan O(projects * weeks). For a project with 50 weeks, this is 50 compliance computations per report cycle.

**How to avoid:** For the summary email, compute compliance rate by counting `payrollWeeks` rows with `submittedAt IS NOT NULL` as "completed" and checking violation status via a single SQL join if possible. Alternatively, accept the N+1 at current scale (ROADMAP does not mandate query optimization). Document the accepted tradeoff.

**Recommended approach:** Keep `computeCompliance()` per week for accuracy. Add a comment noting the N+1 and the 50-project scaling threshold.

### Pitfall 5: reportSchedule Cadence Dispatch Off-By-One

**What goes wrong:** Using `getDay()` (local time) instead of `getUTCDay()` when determining "is today Monday?" causes the weekly email to fire on different days depending on the server timezone.

**How to avoid:** The cron fires at 08:00 UTC. Use `getUTCDay()` and `getUTCDate()` for dispatch logic. This is consistent with the cron `timezone: 'UTC'`.

### Pitfall 6: reportEmail Blank — Must Fall Back to Owner Email

**What goes wrong:** User saves `reportEmail: ''` (left blank). The job tries to send to an empty string and Resend rejects it.

**How to avoid:** In the job, if `reportEmail` is blank or missing, fall back to the project owner's email (same lookup as `dueSoonService.ts` owner query). Document this fallback in the email footer: "Sending to [ownerEmail]. Change in Project Settings."

### Pitfall 7: Missing `notifications` Route Import in index.ts

**What goes wrong:** `POST /api/notifications/unsubscribe` route is written but not registered in `index.ts`, so it returns 404.

**How to avoid:** Add `import notificationsRouter from './routes/notifications.js'` and `app.use('/api/notifications', notificationsRouter)` to `index.ts`. Pattern matches all other route registrations.

---

## Code Examples

### Resend dual-format (html + text) send — matches ROADMAP "dual-format" spec

```typescript
// Source: emailService.ts pattern, extended with text field
const { error } = await resend.emails.send({
  from: FROM_EMAIL,
  to: [recipientEmail],
  subject: `Compliance Report — ${projectName}`,
  html: `<p>...</p>`,
  text: `Compliance Report for ${projectName}\n\n...`,  // plain-text fallback
});
```

### Cron registration (5th job in index.ts)

```typescript
// Source: matches existing pattern at index.ts lines 213-258
import { runScheduledReports } from './jobs/scheduledReports.js';

// Inside app.listen() callback:
cron.schedule('0 8 * * *', async () => {
  logger.info('scheduled-reports: running daily report dispatch');
  try {
    await runScheduledReports();
  } catch (err) {
    logger.error({ err }, 'scheduled-reports: failed');
  }
}, { timezone: 'UTC' });
```

### projectSettings read-modify-write in job (dedup + token generation)

```typescript
// Pattern from dueSoonService.ts lines 96-101 — adapted for scheduled reports
const rawParsed: Record<string, unknown> = project.projectSettings
  ? (() => { try { return JSON.parse(project.projectSettings); } catch { return {}; } })()
  : {};

// After successful send:
const updatedSettings = { ...rawParsed, lastReportSentAt: todayISO };
await db
  .update(projects)
  .set({ projectSettings: JSON.stringify(updatedSettings), updatedAt: new Date().toISOString() })
  .where(eq(projects.id, project.id));
```

### Unsubscribe token lookup (new notifications.ts route)

```typescript
// POST /api/notifications/unsubscribe — public (no auth required)
router.post('/unsubscribe', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  const db = getDb();
  const allProjects = await db.select().from(projects);
  for (const project of allProjects) {
    const settings = JSON.parse(project.projectSettings ?? '{}');
    if (settings.reportUnsubscribeToken === token) {
      const merged = { ...settings, reportSchedule: 'off' };
      await db.update(projects)
        .set({ projectSettings: JSON.stringify(merged), updatedAt: new Date().toISOString() })
        .where(eq(projects.id, project.id));
      return res.json({ message: 'Unsubscribed successfully' });
    }
  }
  return res.status(404).json({ error: 'Token not found' });
});
```

### ProjectSettingsPage interface extension

```typescript
interface Project {
  id: string;
  name: string;
  gpsClockInEnabled: boolean;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsRadiusMeters: number | null;
  projectSettings: string | null;  // ADD — needed for report schedule section
}
```

---

## Migration Assessment

**No migration needed.** `reportSchedule` and `reportEmail` are new keys within the existing `projectSettings` text column (nullable JSON string, schema.ts line 72). The unsubscribe token (`reportUnsubscribeToken`) also lives in this blob.

**Next migration index (if ever needed):** 55 (current max is 54, tag `0054_workers_fts`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| resend npm package | Email delivery | Yes | ^6.9.4 | Graceful no-op if `RESEND_API_KEY` not set |
| RESEND_API_KEY env var | Actual delivery | Unknown (not in .env.example) | — | Log, skip send — same as existing emails |
| RESEND_FROM_EMAIL env var | Sender address | Unknown | — | Default: `notifications@hccprevailingwage.com` |
| APP_URL env var | Email links | Unknown | — | Default: `http://localhost:3000` |
| node-cron npm package | Cron trigger | Yes | ^4.2.1 | — |
| @types/node-cron | TypeScript types | Yes | ^3.0.11 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** RESEND_API_KEY — if absent, lazy-init returns `null` and job logs a skip message. This is NFR-02 compliant and matches all other email jobs.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npx tsc --noEmit` |
| Full suite command | `npx vitest run --exclude ".claude/**"` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-05 | `parseReportSettings` returns defaults for null/malformed input | unit | `npx vitest run --exclude ".claude/**"` | No — Wave 0 |
| NOTIF-05 | Settings save PATCHes projectSettings without wiping GPS/notif prefs | unit (mock PATCH) | same | No — Wave 0 |
| NOTIF-06 | `runScheduledReports` skips projects with `reportSchedule: 'off'` | unit (mock DB) | same | No — Wave 0 |
| NOTIF-06 | Weekly job only dispatches on UTC Monday | unit | same | No — Wave 0 |
| NOTIF-06 | Monthly job only dispatches on UTC day 1 | unit | same | No — Wave 0 |
| NOTIF-06 | Dedup: skips if `lastReportSentAt === todayISO` | unit | same | No — Wave 0 |
| NOTIF-06 | Unsubscribe endpoint sets `reportSchedule: 'off'` for matching token | unit or supertest | same | No — Wave 0 |

### Wave 0 Gaps
- [ ] `tests/jobs/scheduledReports.test.ts` — covers dispatch logic, dedup, skip-when-off
- [ ] `tests/routes/notifications.test.ts` — covers unsubscribe endpoint token matching and not-found case

*(Existing vitest + supertest infrastructure covers Phase 86 needs. No new framework install required.)*

---

## Sources

### Primary (HIGH confidence)
- `src/server/services/emailService.ts` — Resend lazy-init pattern, `FROM_EMAIL`, `APP_URL` constants, `getNotifSettings` helper (source of truth for email)
- `src/server/jobs/certificationExpiryAlerts.ts` — canonical structure for a standalone job file (source of truth for job pattern)
- `src/server/index.ts` — four existing cron registrations; 08:00 UTC slot is free (current jobs: 02:00 UTC, 07:00 ET, 03:00 ET, 08:00 ET)
- `src/server/services/dueSoonService.ts` — `runDueSoonScan()` and `dateDiffDays()` pattern for per-project week scanning
- `src/server/db/schema.ts` line 72 — `projectSettings: text('project_settings')` confirmed nullable text column
- `src/server/routes/projects.ts` — confirmed server-side read-modify-write merge (`resolvedProjectSettings`) in PATCH handler
- `src/client/pages/ProjectSettingsPage.tsx` — current page structure; `Project` interface confirmed missing `projectSettings`; GPS + TransferOwnership sections are the layout model
- `src/server/db/migrations/meta/_journal.json` — confirmed max idx = 54; next migration = 55
- `package.json` — confirmed `resend: ^6.9.4` (not nodemailer), `node-cron: ^4.2.1`

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 86 section — defines success criteria including 08:00 UTC schedule, content requirements, unsubscribe endpoint path
- `.planning/phases/46-notifications/46-RESEARCH.md` — NOTIF-05 context; projectSettings JSON merge pattern; node-cron registration pattern

---

## Open Questions

1. **Resend vs "nodemailer" in ROADMAP text**
   - What we know: ROADMAP success criterion 2 says "nodemailer template" and success criterion 3 says "same nodemailer dual-format pattern as existing emails." `package.json` has `resend`, not `nodemailer`. All existing emails use Resend.
   - What's unclear: Whether "nodemailer" in the ROADMAP is a copy-paste error or intentional.
   - Recommendation: Use Resend. STATE.md decisions log line 58 confirms Resend is the locked email provider. "nodemailer" in the ROADMAP text is an artifact from early planning and was superseded by Phase 46. Planner should proceed with Resend and note the discrepancy in the plan.

2. **reportEmail field: required or optional?**
   - What we know: ROADMAP says `reportEmail: string`. If blank, no email target is defined.
   - What's unclear: Whether the UI should require a valid email before enabling a schedule, or silently fall back to the owner's email.
   - Recommendation: Fall back to owner email if `reportEmail` is blank — this is the least-friction path and avoids blocking users who just want the report at their account email. Show the fallback address in the UI ("Sending to: [owner email] — change above to use a different address").

3. **Compliance rate computation: full `computeCompliance()` per week or lighter approach?**
   - What we know: `computeCompliance()` is accurate but creates N queries per project. `getBatchProjectCompliance()` needs a userId.
   - What's unclear: Whether the summary needs exact violation counts or an approximation is acceptable.
   - Recommendation: Use `listPayrollWeeks()` to get week counts, then call `computeCompliance()` only for unsubmitted weeks (these are the actionable ones). Skip archived/submitted weeks for the violation check to keep the scan efficient.

4. **Unsubscribe token: scan-all-projects or indexed lookup?**
   - What we know: Token lives in `projectSettings` JSON blob, not a dedicated indexed column. A scan requires parsing every project's JSON.
   - What's unclear: Whether token lookup latency matters (unsubscribe is a user-facing one-time action).
   - Recommendation: Scan-all-projects is acceptable for the current scale. Add a comment noting that if project count exceeds 10,000 a dedicated `report_unsubscribe_tokens` table would be warranted.

---

## Metadata

**Confidence breakdown:**
- Email transport (Resend): HIGH — `emailService.ts` is the established source of truth; job pattern confirmed by `certificationExpiryAlerts.ts`
- Cron scheduling: HIGH — `index.ts` provides exact registration pattern; 08:00 UTC slot is free
- `projectSettings` extension: HIGH — no migration needed; server-side merge already in place
- UI target (ProjectSettingsPage): HIGH — file confirmed, structure confirmed, interface gap confirmed
- Unsubscribe token: MEDIUM — JSON-blob approach is correct but the route doesn't exist yet; scan-all approach is acceptable at current scale
- Compliance data assembly: MEDIUM — `computeCompliance()` is correct but N+1 query pattern; acceptable at scale

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable packages; Resend API unlikely to change in 30 days)
