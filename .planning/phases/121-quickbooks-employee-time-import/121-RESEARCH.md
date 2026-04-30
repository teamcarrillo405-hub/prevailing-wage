# Phase 121: QuickBooks Employee + Time Import - Research

**Researched:** 2026-04-29
**Domain:** QuickBooks Online REST API, payroll import pipeline, React import UI
**Confidence:** HIGH — all findings from direct source-code inspection of this repo

---

## Summary

Phase 121 is predominantly a UI wiring + endpoint-completion phase, not a greenfield build. The server
layer already has every QB route the requirements call for: the employee list endpoint, the time-activity
endpoint, fuzzy-match sync, and an approved-hours commit endpoint. What is missing is (1) the
`IntegrationsPage.tsx` "Import Employees" section that actually creates workers from QB data, (2) the
"Sync Timesheet" UI section with date-range pickers and project selector, and (3) Vitest coverage for the
two new interaction patterns.

The existing `POST /api/payroll/import/commit` route is the canonical commit path for the import
pipeline. The QB-specific `POST /api/integrations/qbo/push-approved-hours` route bypasses it in favor of
`upsertPayrollEntry`. Phase 121 must decide which path "Sync Timesheet" commits through. The ROADMAP
success criterion says "Commit Import button uses existing import commit endpoint" — meaning `POST
/api/payroll/import/commit` is the required target for QB-03.

**Primary recommendation:** Build minimal server additions (a POST worker-import endpoint scoped inside
integrations.ts) and two focused UI sections in IntegrationsPage.tsx. Reuse existing patterns exactly:
`createWorker` service for QB-02, `POST /api/payroll/import/commit` with `provider: 'quickbooks'` for
QB-03.

---

## What Already Exists (Do Not Re-Build)

### Server Routes in `src/server/routes/integrations.ts`

| Route | Lines | Status | Notes |
|-------|-------|--------|-------|
| `GET /api/integrations/qbo/status` | 16–20 | COMPLETE | Returns `QboConnectionStatus` |
| `GET /api/integrations/qbo/connect` | 24–46 | COMPLETE | OAuth redirect |
| `GET /api/integrations/qbo/callback` | 50–124 | COMPLETE | Token exchange + save |
| `DELETE /api/integrations/qbo` | 128–133 | COMPLETE | Disconnect + security event |
| `GET /api/integrations/qbo/employees` | 137–188 | COMPLETE | Returns preview list (qboId, displayName, email, address, hasSsn, ssnLast4) |
| `GET /api/integrations/qbo/timeactivities` | 192–262 | COMPLETE | Returns activities with `needsDailySplit` flag |
| `POST /api/integrations/qbo/sync-time` | 267–373 | COMPLETE | Fuzzy-matches QB employees to project workers; returns `matched[]` + `unmatched[]` keyed to dayKey |
| `POST /api/integrations/qbo/sync-employees` | 379–416 | COMPLETE | POST variant of employee list (for mapping flow) |
| `POST /api/integrations/qbo/push-approved-hours` | 421–501 | COMPLETE | Commits matched entries via `upsertPayrollEntry` |

### Service Layer in `src/server/services/qboService.ts`

| Export | Lines | Purpose |
|--------|-------|---------|
| `getQboConnection(userId)` | 15–30 | Returns `QboConnectionStatus` including `nearExpiry` |
| `saveQboTokens(userId, params)` | 32–67 | AES-256-GCM encrypt + upsert to `qbo_tokens` |
| `deleteQboTokens(userId)` | 69–72 | Hard delete |
| `getDecryptedTokens(userId)` | 74–83 | Raw decrypted tokens (internal use) |
| `getValidAccessToken(userId)` | 90–139 | Transparent refresh; returns `{accessToken, realmId}` or null |

All token operations use `encryptSsn`/`decryptSsn` from `cryptoService.ts` — same AES-256-GCM
envelope as SSN storage.

### Import Commit Pipeline in `src/server/routes/import.ts`

- `POST /api/payroll/import/preview` (lines 36–90): multipart CSV upload → `parseImportFile()` → `ImportPreviewResult`
- `POST /api/payroll/import/commit` (lines 104–249): JSON body `{weekId, provider, matched: ImportedRow[], unmatchedCount, sourceFilename}` → inserts `payrollEntries` rows + `payrollImports` audit row + `audit_logs` row

The commit body shape (`ImportedRow`) requires:
```
workerId, classificationId,
monSt, tueSt, wedSt, thuSt, friSt, satSt, sunSt,
monOt, tueOt, wedOt, thuOt, friOt, satOt, sunOt,
baseRateSnapshot, fringeRateSnapshot,
workerName (display only), csvName (display only)
```

Mounted at: `app.use('/api/payroll/import', importRouter)` in `src/server/index.ts` line 192.
Integrations router mounted at: `app.use('/api/integrations', integrationsRouter)` line 199.

### Existing UI in `src/client/pages/IntegrationsPage.tsx`

- Lines 1–161: `EmployeeMappingSection` component — loads QB employees via `POST sync-employees`, lets user type a worker name per QB employee, persists to `localStorage` under key `qbo_employee_mapping`
- Lines 163–390: `IntegrationsPage` — QB connected/disconnected card, conditional `<EmployeeMappingSection />` when connected, Procore card, SSO card

**What is missing from the UI:**
1. "Import Employees from QB" section: a preview table with QB employee rows, checkboxes, "Import Selected" button that calls a server endpoint to create workers — the current `EmployeeMappingSection` only saves a name mapping to localStorage, it does not call `createWorker`
2. "Sync Timesheet" section: date range pickers, project selector, "Preview Import" button, preview table with worker + day-by-day hours, "Commit Import" button

---

## What Needs to Be Built

### Plan 121-01 Scope: Employee Import

**Server** — New route needed:
```
POST /api/integrations/qbo/import-employees
Body: { projectId: string; employees: Array<{ qboId, displayName, email, address, hasSsn, ssnLast4 }> }
```
This route calls `createWorker(db, {...})` for each selected employee, skipping duplicates by name
(case-insensitive match against existing `workers` for the project). Returns `{created, skipped, errors}`.

The existing `createWorker` service (imported in workers.ts line 13 from `workerService.ts`) accepts:
`{userId, userEmail, ipAddress, projectId, name, ssn, tradeUnion, addressStreet, addressCity, addressState, addressZip, ...}`.

QB field mapping for the server route:
| QB field | worker column |
|----------|--------------|
| `DisplayName` | `name` |
| `SSN` (if present) | passed as `ssn` param → stored in `ssnEncrypted` via `cryptoService` |
| `PrimaryAddr.Line1` | `addressStreet` |
| `PrimaryAddr.City` | `addressCity` |
| `PrimaryAddr.CountrySubDivisionCode` | `addressState` |
| `PrimaryAddr.PostalCode` | `addressZip` |
| `PrimaryEmailAddr.Address` | no workers column for email — omit |

Note: the `GET /api/integrations/qbo/employees` endpoint already parses SSN as `hasSsn` (boolean) + `ssnLast4` but does NOT pass the raw SSN to the client (correct — never expose in API response). The import-employees route will need to re-fetch the raw SSN from QB for each selected employee, OR the GET endpoint needs to be extended to optionally return the raw SSN server-side only when committing. Simplest pattern: import-employees endpoint re-queries QB for each employee by `Id` to retrieve SSN at commit time (matches `push-approved-hours` pattern of re-calling QB during commit).

**UI** — Add to `IntegrationsPage.tsx` below the existing `EmployeeMappingSection`:
- A new `EmployeeImportSection` component (keep same card style as `EmployeeMappingSection`)
- "Load QB Employees" button → calls `GET /api/integrations/qbo/employees`
- Preview table: checkbox | QB name | email | address | SSN | status badge ("New" / "Exists")
- "Import Selected" button → calls new `POST /api/integrations/qbo/import-employees`
- Success: inline count "3 workers created, 1 already exists"
- Duplicate detection: compare `displayName` lowercase against existing workers list (fetch from `GET /api/projects/:id/workers` — needs project selector first, or scope to a selected project)

**Key constraint:** worker creation requires a `projectId`. The UI needs a project selector (reuse the same `<select>` + projects query pattern used in the Sync Timesheet section). Both sections should share a single project selector at the top of the QB connected state.

### Plan 121-02 Scope: Timesheet Sync UI

**Server** — No new routes needed. The `POST /api/integrations/qbo/sync-time` route (lines 267–373) already does the fuzzy match and returns `matched[]` + `unmatched[]` with `{workerId, workerName, qboEmployeeRef, entries: [{date, hours, dayKey}]}`. The commit goes through `POST /api/payroll/import/commit`.

**Bridge needed:** `sync-time` returns entries in format `{date, hours, dayKey: 'monSt'}`. The commit endpoint expects `ImportedRow` with separate `monSt`, `tueSt`, etc. fields. The client must aggregate `sync-time` results into `ImportedRow` shape before calling commit. This aggregation logic mirrors what `push-approved-hours` already does server-side (lines 463–483 of integrations.ts) — implement client-side for the commit path.

**UI** — Add `SyncTimesheetSection` to `IntegrationsPage.tsx`:
- Project selector (shared with EmployeeImportSection or repeated)
- `weekId` picker (list of payroll weeks for the selected project, from `GET /api/projects/:id/payroll-weeks`)
- "Preview from QB" button → calls `POST /api/integrations/qbo/sync-time?weekId=&projectId=`
- Preview table: worker name | QB source | Mon | Tue | Wed | Thu | Fri | Sat | Sun | total hours
- Unmatched section: "X employees in QB could not be matched to workers. Import them first."
- Daily split warning (if `needsDailySplit` from timeactivities): amber callout "QB stores weekly totals — hours split evenly Mon-Fri. Confirm before importing."
- "Commit Import" button → assembles `ImportedRow[]` from preview and calls `POST /api/payroll/import/commit` with `provider: 'quickbooks'`
- Success toast: "X payroll entries created"

---

## Architecture Patterns

### Pattern: QB Employee Import (new route)

```typescript
// In integrations.ts — new endpoint
integrationsRouter.post('/qbo/import-employees', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { projectId, employees } = req.body as { projectId: string; employees: QboEmployee[] };

  // 1. assertProjectAccess(db, projectId, userId)
  // 2. Fetch existing worker names for the project (case-insensitive dedup)
  // 3. For each selected employee: check duplicate, then call createWorker(db, {...})
  // 4. Return { created: N, skipped: N }
});
```

Import `createWorker` from `'../services/workerService.js'` — the same import workers.ts line 13 uses.

### Pattern: Sync-Time → Commit Bridge (client-side)

```typescript
// Client aggregates sync-time matched[] into ImportedRow[] for /api/payroll/import/commit
function buildImportRows(matched: SyncTimeMatch[]): ImportedRow[] {
  const map = new Map<string, ImportedRow>();
  for (const m of matched) {
    const key = `${m.workerId}`;
    if (!map.has(key)) {
      map.set(key, { workerId: m.workerId, workerName: m.workerName, classificationId: '?',
        monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0,
        monOt: 0, tueOt: 0, wedOt: 0, thuOt: 0, friOt: 0, satOt: 0, sunOt: 0,
        baseRateSnapshot: 0, fringeRateSnapshot: 0, csvName: m.qboEmployeeRef });
    }
    const row = map.get(key)!;
    for (const e of m.entries) {
      (row as any)[e.dayKey] = ((row as any)[e.dayKey] ?? 0) + e.hours;
    }
  }
  return [...map.values()];
}
```

Note: `classificationId` is not returned by `sync-time`. The worker must already have an active
classification in the project (from QB-02 employee import + manual classification assignment). The UI must
surface a warning if matched workers lack a classification.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| AES token storage | Custom crypto | `encryptSsn`/`decryptSsn` from `cryptoService.ts` (already used by qboService) |
| Access token refresh | Manual refresh logic | `getValidAccessToken(userId)` — already handles 5-min pre-expiry refresh transparently |
| Worker creation | Custom insert | `createWorker(db, {...})` from `workerService.ts` — handles SSN encryption, audit log, webhook |
| Payroll entry commit | Custom insert loop | `POST /api/payroll/import/commit` — handles conflict detection, `payrollImports` audit row, `audit_logs` |
| Project access guard | Raw DB query | `assertProjectAccess(db, projectId, userId)` — IDOR guard, must be called before any project data op |
| Submitted-week guard | Manual check | `if (week.submittedAt) → 423` — use exactly this pattern, already in import.ts line 129 |

---

## Common Pitfalls

### Pitfall 1: classificationId gap in sync-time
**What goes wrong:** `POST /api/integrations/qbo/sync-time` returns `matched[]` with `workerId` but no
`classificationId`. `POST /api/payroll/import/commit` requires `classificationId` on every `ImportedRow`.
**Why it happens:** sync-time does fuzzy name matching against workers, not worker classifications.
**How to avoid:** After preview, look up each matched worker's active `classificationId` from the
`workerClassifications` table via a client-side fetch of `GET /api/projects/:id/workers` (which includes
classification data). If a worker has multiple active classifications, surface a picker per worker row.
**Warning signs:** TypeScript will require classificationId on ImportedRow — don't use empty string.

### Pitfall 2: Duplicate worker creation on re-import
**What goes wrong:** User clicks "Import Employees" twice; duplicate workers created with same name.
**How to avoid:** Server-side dedup in `import-employees` route — fetch existing workers by projectId,
normalize names to lowercase, skip any QB employee whose displayName matches an existing worker name.
Return `skipped` count in the response. Never rely on client-side dedup alone.

### Pitfall 3: SSN exposure in employee preview
**What goes wrong:** Returning raw SSN in `GET /api/integrations/qbo/employees` response exposes PII.
**How to avoid:** Existing endpoint already returns only `hasSsn: boolean` and `ssnLast4`. If the
import-employees route needs the raw SSN, it must re-query QB directly server-side at import time (not
pass SSN through client). The `ssnLast4` field is UI display only.

### Pitfall 4: Daily split creates incorrect OT
**What goes wrong:** QB `TimeActivity` stores weekly hour totals when no per-day breakdown exists (field
`needsDailySplit: true` in timeactivities response). Splitting weekly hours evenly Mon–Fri is a
heuristic — compliance engine will compute OT based on daily totals (8hr/day threshold).
**How to avoid:** Show amber callout when `needsDailySplit === true`. Require user confirmation before
commit. Do NOT auto-split silently.

### Pitfall 5: Missing `assertProjectAccess` in new import-employees route
**What goes wrong:** IDOR — user can import workers into any project by guessing `projectId`.
**How to avoid:** Call `assertProjectAccess(db, projectId, userId)` before any DB write. This is
NFR-03 and is non-negotiable per STATE.md accumulated decisions.

### Pitfall 6: `push-approved-hours` vs. `import/commit` conflict
**What goes wrong:** Using `POST /api/integrations/qbo/push-approved-hours` for the timesheet sync
commit bypasses the `payrollImports` audit row and the server-side conflict re-check in the canonical
commit route.
**How to avoid:** Use `POST /api/payroll/import/commit` with `provider: 'quickbooks'` as specified in
the ROADMAP success criterion 3. The `push-approved-hours` route exists for a different flow (direct
hour push without preview); do not use it for the "Sync Timesheet" commit path.

---

## Code Examples

### Call `getValidAccessToken` (established pattern)
```typescript
// Source: src/server/routes/integrations.ts lines 140-144
const tokenData = await getValidAccessToken(userId);
if (!tokenData) {
  res.status(401).json({ error: 'QuickBooks not connected' });
  return;
}
const { accessToken, realmId } = tokenData;
```

### QB API query call (established pattern)
```typescript
// Source: src/server/routes/integrations.ts lines 148-157
const qboResp = await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  },
);
```

### `createWorker` call (from workers.ts line 279)
```typescript
// Source: src/server/routes/workers.ts lines 279-307
const result = await createWorker(db, {
  userId,
  userEmail: req.user!.email,
  ipAddress: req.ip ?? null,
  projectId,
  name: body.name,
  ssn: body.ssn,           // raw SSN string — createWorker handles encryption
  addressStreet: body.addressStreet,
  addressCity: body.addressCity,
  addressState: body.addressState,
  addressZip: body.addressZip,
  // ... remaining optional fields
});
```

### Commit body shape for `POST /api/payroll/import/commit`
```typescript
// Source: src/server/routes/import.ts lines 96-102
interface CommitBody {
  weekId: string;
  provider: ImportProvider;   // use 'quickbooks'
  matched: ImportedRow[];
  unmatchedCount?: number;
  sourceFilename?: string;    // use 'QuickBooks TimeActivity' or similar
}
```

### `ImportedRow` shape (from `src/server/services/importTypes.ts`)
```typescript
// Each row must include all 14 daily hour fields (St + Ot) plus:
// workerId, classificationId, workerName, csvName, baseRateSnapshot, fringeRateSnapshot
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 121 is purely code/config changes within the existing Node.js/Express/React stack. No new external services, CLIs, or databases introduced. QB OAuth credentials (`QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`) are already required by Phase 68 and are present in the environment.

---

## Test Coverage Gap

No `integrations.test.ts` file exists in `tests/routes/`. Phase 121 ROADMAP success criterion 2 requires
"at least 2 Vitest tests for the route (auth 401, shape)". Tests must be created.

**Minimum test file:** `tests/routes/integrations.test.ts`

| Test | Type | Command |
|------|------|---------|
| `GET /api/integrations/qbo/employees` returns 401 when not connected | auth guard | `vitest run tests/routes/integrations.test.ts` |
| `GET /api/integrations/qbo/timeactivities` returns 401 when not connected | auth guard | same |
| `POST /api/integrations/qbo/import-employees` returns 401 without auth | auth guard | same |
| `POST /api/integrations/qbo/import-employees` returns 400 without projectId | validation | same |

Pattern: follow `tests/routes/import.test.ts` for setup (in-memory DB, `supertest` app, `requireAuth` mock).

---

## Phase Requirements

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QB-02 | `GET /api/integrations/qbo/employees` — pulls QB Employee list into preview table; user selects employees to import as Workers; maps DisplayName/SSN/address; duplicate detection by name | Route exists (lines 137-188); missing: import-employees commit route + UI section |
| QB-03 | `GET /api/integrations/qbo/timeactivities?startDate=&endDate=&projectId=` — pulls TimeActivity records, routes through existing importService.ts pipeline; daily M-Su split with user confirmation for weekly totals | Route exists (lines 192-262); sync-time route exists (267-373); missing: UI section + classificationId resolution + commit wiring to /api/payroll/import/commit |
</phase_requirements>

---

## Open Questions

1. **classificationId resolution for Sync Timesheet commit**
   - What we know: `sync-time` matched rows have `workerId` but no `classificationId`; commit requires it
   - What's unclear: Should the UI auto-select the worker's first active classification, or force user selection?
   - Recommendation: Auto-select first active classification with a per-row override picker. If worker has exactly one active classification, proceed silently. If multiple, require selection before commit is enabled.

2. **SSN retrieval at employee import time**
   - What we know: `GET /api/integrations/qbo/employees` returns `hasSsn` boolean + `ssnLast4`, not raw SSN
   - What's unclear: Should the import-employees route re-query QB for each employee's full SSN?
   - Recommendation: Yes — re-query QB at import time server-side using each employee's `Id`. The UI sends `qboId[]` in the commit body; the server fetches SSN fresh from QB rather than trusting client. This is the correct security posture.

3. **Project selector scope**
   - What we know: Both employee import and timesheet sync need a `projectId`; the page currently has no project selector
   - What's unclear: Should one project selector be shared between both sections?
   - Recommendation: Single shared project selector in the QB "connected" state, above both sections.

---

## Sources

### Primary (HIGH confidence)
- `src/server/routes/integrations.ts` — complete route inventory, lines 1-768 (direct read)
- `src/server/services/qboService.ts` — complete service inventory, lines 1-139 (direct read)
- `src/server/services/importService.ts` — full import pipeline, lines 1-443 (direct read)
- `src/server/routes/import.ts` — commit endpoint, lines 1-249 (direct read)
- `src/client/pages/IntegrationsPage.tsx` — full UI, lines 1-390 (direct read)
- `src/server/db/schema.ts` — workers table columns, lines 112-151 (direct read)
- `src/server/routes/workers.ts` — createWorker call shape, lines 236-307 (direct read)
- `.planning/ROADMAP.md` — Phase 121 success criteria, lines 2471-2488 (direct read)
- `.planning/REQUIREMENTS.md` — QB-02, QB-03 spec, lines 54-56 (direct read)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — accumulated decisions on assertProjectAccess pattern, submitted-week guard, import pipeline shape (direct read)

---

## Metadata

**Confidence breakdown:**
- What exists vs. what's missing: HIGH — direct line-number inventory of all relevant files
- QB API field shapes: HIGH — confirmed from existing route code that already calls QB successfully
- Import commit body shape: HIGH — direct read of import.ts CommitBody interface
- classificationId gap: HIGH — code-verified gap between sync-time response and commit requirement

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable codebase, no external API changes expected)
