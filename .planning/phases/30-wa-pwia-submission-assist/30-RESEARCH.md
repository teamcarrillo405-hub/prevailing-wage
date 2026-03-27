# Phase 30: WA PWIA Submission Assist — Research

**Researched:** 2026-03-27
**Domain:** WA L&I PWIA XML certified payroll, prevailing wage portal submission
**Confidence:** HIGH (schema verified from official XSD; codebase fully read)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add nullable `text` column `pwia_intent_id` to `projects` table via SQL migration. Same pattern as `dir_project_id`. Persisted from pre-generation modal on first export, pre-fills on subsequent exports.
- **D-02:** SQL-only migration, manually registered in `src/server/db/migrations/meta/_journal.json`.
- **D-03:** Before pre-generation modal opens, perform server-side and client-side gate check: if any worker on the payroll week has `wa_trade_code IS NULL`, block XML generation entirely.
- **D-04:** Gate surfaces as a blocking screen (not a modal) listing each affected worker by name with a direct link to edit their worker classification. No bypass — generation is impossible until all NULL codes are resolved.
- **D-05:** A non-null `wa_trade_code` value passes the gate regardless of whether it appears in the `WA_TRADE_CODES` map. Null-only check.
- **D-06:** Create `src/server/services/waCprXmlGenerator.ts` — pure function, no I/O, xmlbuilder2-based, same pattern as Phase 29's `ecprXmlGenerator.ts`.
- **D-07:** Add `GET /api/export/wa-cpr-xml/:weekId` to `export.ts` following the established 8-step pattern. State gate: `project.state !== 'WA'` → 400. intentId read from project record.
- **D-08:** Amendment handling: researcher to confirm. (See findings below — WA L&I CPR XML uses `amendedFlag` boolean + `amendReason` string, not a numeric counter like CA.)
- **D-09:** Reuse `getPayrollEntriesWithWorkerDetails()` from Phase 29. No new service function needed.
- **D-10:** Pre-generation modal collects `pwiaIntentId` labeled clearly as "PWIA Intent ID — issued by L&I after Statement of Intent approval". Pre-fills if already stored. User can edit before generating.
- **D-11:** Existing WA PWIA disclosure modal in `PayrollWeekDetailPage.tsx` (~line 718) should be extended or refactored — not duplicated.
- **D-12:** Panel lives on `PayrollWeekDetailPage.tsx`, displayed below or alongside WA CPR XML download button — no new route.
- **D-13:** Panel has two labeled subsections: Intent to Pay (per-classification: trade code, job class, hours, base rate, fringe rate; plus project-level UBI, L&I cert, WC account) and Affidavit of Wages Paid (per-worker: name, trade code, ST/OT hours by day M–Su, totals, base rate, fringe rate, gross pay).
- **D-14:** Panel labeled as "data-entry guide for PWIA portal" — not a submission mechanism. No HTTP calls to PWIA portal domains from app backend.
- **D-15:** Panel is WA-gated only. Does NOT require intentId to be present — display-only.

### Claude's Discretion

- Exact filename convention for WA CPR XML download (researcher to confirm or follow same pattern as CA: `[field]_[weekEnding].xml`)
- Whether to show step indicators in the UI flow
- Error message wording for the trade code gate screen
- Whether the WAL-04 Intent to Pay section shows estimated or actual hours (use actual payroll hours since this is post-entry)
- Panel styling: whether to use a Card component consistent with existing app primitives

### Deferred Ideas (OUT OF SCOPE)

- Direct PWIA portal submission — no confirmed public API; portal upload only
- WA Affidavit of Wages Paid as a generated PDF — portal-only submission; no fillable PDF exists
- WA Intent to Pay as a generated PDF — same reason
- Full SSN storage for WA XML — deferred to v3+
- Amendment marker in WA CPR XML — deferred to researcher to confirm (see findings below)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WAL-03 | User can generate and download a WA L&I CPR XML file for upload to the My L&I PWIA portal; export is gated on the contractor providing their PWIA intentId and on all workers having non-null WA trade codes | XSD schema confirmed at lni.wa.gov — root element `WaPWCPR`, intentId is `unsignedInt`, trade is 4-letter code, county is required per tradeHoursWage entry |
| WAL-04 | User can view a pre-populated submission summary for WA Intent to Pay and Affidavit of Wages filings — all required field values drawn from project/worker/payroll data — formatted for manual entry into the PWIA portal | Intent to Pay fields and Affidavit fields confirmed from official PWIA documentation |
</phase_requirements>

---

## Summary

WA L&I publishes an official XSD schema for CPR XML uploads at `https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd`. The root element is `WaPWCPR` — structurally different from CA's `CPR:eCPR` namespace-prefixed format. WA XML has no namespace prefix; elements are unqualified. The schema is organized around a single `intentId` (unsigned integer) at the root, then a `payrollWeek` block with `endOfWeekDate`, optional `amendedFlag`/`amendedDate`/`amendReason`, and an `employees` collection. Each employee has personal info, pay info, and a `tradeHoursWages` collection that maps the daily hours to a specific trade code + county combination.

The key structural difference from CA eCPR: WA XML puts daily hours (regularDay1Hours through regularDay7Hours for ST, overtimeDay1Hours through overtimeDay7Hours for OT) inside a `tradeHoursWage` element that also carries the `trade` code and `county`. This means a single employee may have multiple `tradeHoursWage` entries if they worked multiple trades — the app must group by classification. SSN is required by the schema (9-digit format with validation rules) but the app stores only last-4; the same `000000XXXX` placeholder strategy from Phase 29 applies.

Amendment handling in WA uses `amendedFlag` (boolean true/false) and optionally `amendReason` (string) and `amendedDate` — not a numeric counter. The planner can implement this simply: if `week.originalWeekId` is not null, emit `<amendedFlag>true</amendedFlag>` and a reason string; otherwise `<amendedFlag>false</amendedFlag>` or omit the element.

**Primary recommendation:** Build `waCprXmlGenerator.ts` targeting the official XSD schema using the `WaPWCPR` root element with unqualified elements (no namespace prefix), mirroring the xmlbuilder2 pure-function pattern from `ecprXmlGenerator.ts` but with WA-specific structure. Next migration number is `0015`.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 30 |
|-----------|-------------------|
| NEVER hard-delete projects or payroll weeks | Not applicable — read-only export phase |
| Amendments must create new `payrollWeeks` rows — never update in place | XML generator reads `week.originalWeekId` and `week.amendmentNumber` for `amendedFlag` |
| DB migrations are plain SQL `ALTER TABLE ... ADD COLUMN` files | `0015_wa_pwia_intent_id.sql`: `ALTER TABLE projects ADD COLUMN pwia_intent_id TEXT;` |
| Always register in `meta/_journal.json` — Drizzle silently skips files not in journal | Next `idx` is 11, tag `0015_wa_pwia_intent_id` |
| Design tokens: use `bg-nav-dark`, `border-brand-gold`, etc. — never hardcode hex | Trade code gate screen + submission panel must use design tokens |
| Typography: `font-headline` (Oswald) for h1–h4, `font-body` (Inter) for body | Panel section headings use `font-headline` |
| UI Primitives: `Card`, `Button`, `Badge`, `PageHeader`, `EmptyState` from `src/client/components/ui/` | Panel uses `Card`; gate screen uses `EmptyState` or custom blocking view |
| `useRef` for synchronous guards — `useState` is async/batched | WA CPR XML download uses `useRef` guard (same pattern as `waGeneratingRef`) |
| Blob URL downloads: `fetch()` → `.blob()` → `createObjectURL()` → click → `setTimeout(revokeObjectURL, 100)` | WA CPR XML download handler follows this pattern |
| Export route: new routes must be registered before `/:weekId` wildcard | `GET /api/export/wa-cpr-xml/:weekId` follows same ordering as `ecpr-xml/:weekId` |
| Add-only migrations (never drop or rename columns) | Phase 30 adds one column only |
| Migration files 0005, 0006, 0007 exist but are not in `_journal.json` — known gap | Confirmed — do not add them; only register the new `0015` entry |

---

## WA L&I PWIA CPR XML Schema (HIGH confidence — official XSD)

**Schema URL:** `https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd`
**Guide URL:** `https://lni.wa.gov/licensing-permits/_docs/xml%20payroll%20guide.pdf`

### Root Element

```xml
<WaPWCPR>
  <intentId>12345</intentId>
  <payrollWeek>
    ...
  </payrollWeek>
</WaPWCPR>
```

No namespace prefix. No `xmlns:` declaration required (unlike CA's `xmlns:CPR=...`). Elements are plain unqualified names.

### intentId

- Type: `unsignedInt` (positive integer, no decimals)
- Required: yes
- Format: numeric only (portal issues a numeric ID after Statement of Intent approval)
- App storage: `pwia_intent_id TEXT` column on `projects` (stored as string, converted to integer in XML output)
- Confidence: HIGH — confirmed from official XSD

### payrollWeek Structure

| Element | Type | Required | Notes |
|---------|------|----------|-------|
| `endOfWeekDate` | date (yyyy-mm-dd) | yes | Last day of payroll week — matches `week.weekEndingDate` |
| `noWorkPerformFlag` | boolean | no | True if no work performed that week |
| `amendedFlag` | boolean | no | True if this is a resubmission/amendment |
| `amendedDate` | date | no | Date amendment was made |
| `amendReason` | string | no | Reason for amendment |
| `employees` | collection | no | Required when work was performed |

### Employee Structure

| Element | Type | Required | Notes |
|---------|------|----------|-------|
| `firstName` | string, max 50 | yes | Split from `workerName` |
| `lastName` | string, max 50 | yes | Split from `workerName` |
| `midName` | string, max 50 | no | Omit |
| `ssn` | 9-digit string | yes | Validation: cannot start with 9, 666, or 000; no "00" in positions 4-5; no "0000" in positions 6-9. Use `000000000` + `ssnLast4` pattern, but WA validator may reject `000-00-XXXX`. See Pitfall #1 below. |
| `address1` | string, max 500 | yes | From `workerAddress` |
| `address2` | string, max 500 | no | Omit |
| `city` | string, max 100 | yes | Parse from `workerAddress` |
| `state` | 2-char | yes | From `workerAddress` parsed state |
| `zip` | 5-10 chars | yes | From `workerAddress` parsed zip |
| `grossPay` | decimal ≥0, 2dp | yes | From `e.grossWages` |
| `fica` | decimal ≥0, 2dp | no | Omit (not stored) |
| `taxWithholding` | decimal ≥0, 2dp | no | Omit (not stored) |
| `ethnicity` | enum | no | Omit |
| `gender` | F/M/? | no | Omit |
| `veteranStatus` | Y/N/? | no | Omit |

### tradeHoursWage Structure (inside employee)

One entry per classification row (worker may have multiple if multiple trades):

| Element | Type | Required | Notes |
|---------|------|----------|-------|
| `trade` | 4-letter code | yes | From `waTradeCode` on classification |
| `jobClass` | string, max 500 | yes (unless apprentice) | From `tradeDescription` |
| `county` | string | yes | Washington State county name — from `project.county` |
| `regularHourRateAmt` | decimal >0, 2dp | yes | From `baseRateSnapshot` |
| `overtimeHourRateAmt` | decimal >0, 2dp | no | `baseRateSnapshot * 1.5` |
| `doubletimeHourRateAmt` | decimal >0, 2dp | no | Omit (WA uses 1.5x OT; DT not standard) |
| `hourlyPensionRateAmt` | decimal, 2dp | no | From `fringeRateSnapshot` (or omit) |
| `hourlyMedicalAmt` | decimal, 2dp | no | Omit |
| `hourlyVacationAmt` | decimal, 2dp | no | Omit |
| `hourlyHolidayAmt` | decimal, 2dp | no | Omit |
| `regularDay1Hours` through `regularDay7Hours` | decimal 0-24, 2dp | no | ST hours, Mon=Day1 through Sun=Day7 |
| `overtimeDay1Hours` through `overtimeDay7Hours` | decimal 0-24, 2dp | no | OT hours |
| `doubletimeDay1Hours` through `doubletimeDay7Hours` | decimal 0-24, 2dp | no | Omit |
| `apprenticeFlg` | boolean | yes | `true` if `laborType === 'apprentice'` |
| `apprenticeId` | string, max 50 | no | Omit (not stored) |
| `apprenticeState` | 2-char | no | Omit |
| `apprenticeOccpnName` | string, max 255 | no | Omit |
| `apprenticeStepName` | string, max 50 | no | Omit |
| `apprenticeStepBeginHours` | non-negative int | no | Omit |
| `apprenticeStepEndHours` | non-negative int | no | Omit |

**Day numbering (WA):** `regularDay1Hours` = Monday, `regularDay7Hours` = Sunday. This is Monday-first, unlike CA which uses Sunday-first (id=1=Sun).

### No-namespace Comparison: WA vs CA

| Dimension | WA L&I PWIA | CA DIR eCPR |
|-----------|-------------|-------------|
| Root element | `<WaPWCPR>` | `<CPR:eCPR>` |
| Namespace | None | `xmlns:CPR=...` |
| Element prefix | None | `CPR:` prefix on all elements |
| intentId / projectId type | `unsignedInt` | string (DIR-assigned) |
| Amendment marker | `<amendedFlag>true/false</amendedFlag>` + `<amendReason>` | `<CPR:amendmentNum>N</CPR:amendmentNum>` |
| SSN format | 9-digit (strict validation rules) | 10-char with 000000 prefix |
| Daily hours location | Inside `tradeHoursWage` element | Inside `employee > payroll > hrsWorkedEachDay` |
| Day ordering | Day1=Mon through Day7=Sun | id=1=Sun through id=7=Sat |
| Trade code location | Inside `tradeHoursWage` | `workClass` on employee |
| County required | Yes (per tradeHoursWage) | No |
| Deductions in XML | Optional (fica, taxWithholding, otherDeductions) | Required (13 deduction fields) |

---

## Standard Stack

### Core (no new dependencies needed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| xmlbuilder2 | 4.0.3 | XML generation | Already installed in Phase 29. `create()` from `xmlbuilder2`. |
| TypeScript | (project) | Type safety | All interfaces follow ecprXmlGenerator.ts pattern |
| Drizzle ORM | (project) | DB access | `getPayrollEntriesWithWorkerDetails()` already built |

**No new npm installs required for Phase 30.**

---

## Architecture Patterns

### Recommended New File Structure

```
src/server/services/waCprXmlGenerator.ts   NEW — pure function, xmlbuilder2
src/server/db/migrations/0015_wa_pwia_intent_id.sql  NEW — one ALTER TABLE
```

Modified files:
```
src/server/routes/export.ts                ADD wa-cpr-xml route (8-step pattern)
src/server/db/schema.ts                    ADD pwiaIntentId column to projects
src/server/db/migrations/meta/_journal.json  ADD idx 11 entry
src/client/pages/PayrollWeekDetailPage.tsx  ADD gate screen + modal + button + panel
```

### Pattern 1: waCprXmlGenerator.ts Structure

```typescript
// Source: modeled on ecprXmlGenerator.ts + official WA XSD
import { create } from 'xmlbuilder2';

export interface WaCprTradeDay {
  regularHours: number;
  overtimeHours: number;
}

export interface WaCprTradeEntry {
  trade: string;           // 4-letter WA trade code from waTradeCode
  jobClass: string;        // tradeDescription
  county: string;          // project.county
  regularHourRateAmt: number;
  overtimeHourRateAmt: number;
  fringeRateAmt?: number;  // optional pension/fringe rate
  days: WaCprTradeDay[];   // 7 entries: Day1=Mon through Day7=Sun
  apprenticeFlg: boolean;
}

export interface WaCprEmployee {
  firstName: string;
  lastName: string;
  ssn: string;             // 9-digit placeholder (see SSN pitfall)
  address1: string;
  city: string;
  state: string;
  zip: string;
  grossPay: number;
  tradeHoursWages: WaCprTradeEntry[];
}

export interface WaCprData {
  intentId: number;        // parsed from pwiaIntentId string
  payrollWeek: {
    endOfWeekDate: string; // yyyy-mm-dd
    noWorkPerformFlag: boolean;
    amendedFlag: boolean;
    amendReason?: string;
  };
  employees: WaCprEmployee[];
}

export function generateWaCprXml(data: WaCprData): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('WaPWCPR');

  root.ele('intentId').txt(String(data.intentId));

  const pwEl = root.ele('payrollWeek');
  pwEl.ele('endOfWeekDate').txt(data.payrollWeek.endOfWeekDate);
  pwEl.ele('noWorkPerformFlag').txt(data.payrollWeek.noWorkPerformFlag ? 'true' : 'false');
  pwEl.ele('amendedFlag').txt(data.payrollWeek.amendedFlag ? 'true' : 'false');
  if (data.payrollWeek.amendedFlag && data.payrollWeek.amendReason) {
    pwEl.ele('amendReason').txt(data.payrollWeek.amendReason);
  }

  const empsEl = pwEl.ele('employees');
  for (const emp of data.employees) {
    const empEl = empsEl.ele('employee');
    empEl.ele('firstName').txt(emp.firstName);
    empEl.ele('lastName').txt(emp.lastName);
    empEl.ele('ssn').txt(emp.ssn);
    const addrEl = empEl.ele('address');
    addrEl.ele('address1').txt(emp.address1);
    addrEl.ele('city').txt(emp.city);
    addrEl.ele('state').txt(emp.state);
    addrEl.ele('zip').txt(emp.zip);
    empEl.ele('grossPay').txt(emp.grossPay.toFixed(2));

    const thwEl = empEl.ele('tradeHoursWages');
    for (const trade of emp.tradeHoursWages) {
      const twEl = thwEl.ele('tradeHoursWage');
      twEl.ele('trade').txt(trade.trade);
      twEl.ele('jobClass').txt(trade.jobClass);
      twEl.ele('county').txt(trade.county);
      twEl.ele('regularHourRateAmt').txt(trade.regularHourRateAmt.toFixed(2));
      twEl.ele('overtimeHourRateAmt').txt(trade.overtimeHourRateAmt.toFixed(2));
      twEl.ele('apprenticeFlg').txt(trade.apprenticeFlg ? 'true' : 'false');
      // Daily hours: Day1=Mon ... Day7=Sun
      for (let i = 0; i < 7; i++) {
        const d = trade.days[i]!;
        twEl.ele(`regularDay${i + 1}Hours`).txt(d.regularHours.toFixed(2));
        twEl.ele(`overtimeDay${i + 1}Hours`).txt(d.overtimeHours.toFixed(2));
      }
    }
  }

  return root.end({ prettyPrint: true });
}
```

### Pattern 2: Export Route Handler (8-step pattern)

```typescript
// Source: export.ts — follows ecpr-xml handler pattern exactly
router.get('/wa-cpr-xml/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  // 2. Verify project ownership
  // 3. State gate — WA only
  if (project.state !== 'WA') {
    return res.status(400).json({ error: 'WA CPR XML is only available for Washington projects' });
  }
  // 4. Validate intentId on project record
  if (!project.pwiaIntentId) {
    return res.status(400).json({ error: 'PWIA Intent ID is required' });
  }
  // 5. Load entries with getPayrollEntriesWithWorkerDetails(weekId)
  // 6. Map entries to WaCprEmployee[] — split name, placeholder SSN, county from project
  // 7. Build WaCprData and call generateWaCprXml()
  // 8. Send XML response
  const filename = `wa-cpr-${project.pwiaIntentId}_${week.weekEndingDate}.xml`;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);
});
```

**File naming recommendation (Claude's discretion):** `wa-cpr-{intentId}_{weekEndingDate}.xml` — analogous to CA's `{last4FEIN}_{dirProjectId}_{weekEnding}.xml` but using intentId as the project discriminator.

### Pattern 3: Trade Code Gate Screen (client-side)

The gate check runs client-side first (prevent modal from opening), then server enforces (400 if any null trade code). Gate screen is a full-page block, not a modal:

```typescript
// Client-side gate: check payroll entries for null waTradeCode before opening modal
// Entries data already loaded by the PayrollWeekDetailPage query
const nullTradeWorkers = entries
  .filter(e => !e.waTradeCode)
  .map(e => ({ name: e.workerName, workerId: e.workerId }));

if (nullTradeWorkers.length > 0) {
  setShowTradeCodeGate(true); // blocking screen, not modal
  return;
}
```

Gate screen shows a list of workers with links to `/projects/${projectId}/workers` (the WorkersPage where `waTradeCode` can be set per classification).

**Note:** The `PayrollWeekDetailPage` uses `getPayrollEntries()` (not `getPayrollEntriesWithWorkerDetails()`) for its main data load. The trade code gate needs `waTradeCode` which is only in `getPayrollEntriesWithWorkerDetails()`. The planner must decide: either use a separate client-side API call to get `waTradeCode` data for the gate, or the gate check happens server-side only (the route returns a 422 with the list of workers missing trade codes). Server-side gate is safer and avoids a second API call.

### Pattern 4: Pre-Generation Modal (WAL-03)

Extends/refactors the existing `showWaDisclosure` modal at line 718. The new flow:

1. User clicks "Download WA CPR XML"
2. Client-side: trade code gate check (or server-side on route call)
3. If gate passes: show intentId modal (collect/confirm `pwiaIntentId`)
4. On confirm: PATCH project to persist `pwiaIntentId`, then fetch XML
5. On success: in-place step 2 (download complete, brief checklist or confirmation)

State variables needed: `showWaCprModal`, `waCprIntentId`, `waCprGenerating`, `waCprGeneratingRef`, `waCprStep`.

The existing `showWaDisclosure` / `handleWaDownloadClick` / `handleWaConfirmedDownload` covers F700 PDF. The new WA CPR XML flow is a separate UI state — do not reuse `waGeneratingRef` or `showWaDisclosure` (CLAUDE.md explicitly notes `waGeneratingRef` must be a new ref — the same applies here).

### Pattern 5: WAL-04 Submission Summary Panel

Two-section panel using `Card` component, rendered below the WA CPR XML button. WA-gated via `isWA`. Display-only — no mutations.

**Intent to Pay section** (per-classification aggregate across all workers):
- Project-level: Contractor Name, UBI Number, L&I Certificate, WC Account (already on `projects`)
- Per trade class: WA trade code, job classification description, total actual ST hours, total actual OT hours, base rate, fringe rate

**Affidavit of Wages Paid section** (per-worker detail):
- Worker name, WA trade code, Mon–Sun ST hours, Mon–Sun OT hours, total ST, total OT, base rate, fringe rate, gross pay

Data source: the existing `entries` data already loaded by `PayrollWeekDetailPage` (from `getPayrollEntries()` join). The `waTradeCode` field is returned by `getPayrollEntriesWithWorkerDetails()` — the page currently uses `getPayrollEntries()` for the main table. The planner must decide whether to switch the page's primary data query to `getPayrollEntriesWithWorkerDetails()` (which includes `waTradeCode`) or add a second query. Given the WAL-03 gate also needs `waTradeCode`, switching the primary query is cleaner.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML generation | Custom string concatenation | xmlbuilder2 (already installed) | Automatic escaping, encoding, pretty-print |
| WA trade code lookup | Custom regex/parser | `waTradeCode` column already stored per classification (Phase 25, migration 0013) | Already exists — gate is a NULL check on this column |
| Name splitting (first/last) | Manual regex | Simple `.split(' ')` with `slice(0,-1).join(' ')` / `slice(-1)[0]` for last | WA XML requires separate firstName/lastName; worker name is stored as full name |
| Worker address parsing | Custom parser | Reuse same `addrParts` pattern from CA eCPR handler in export.ts lines 582-587 | Already tested in production code |

---

## Common Pitfalls

### Pitfall 1: SSN Validation in WA L&I XML Schema
**What goes wrong:** The WA XSD validates SSN format. The CA strategy of prepending `000000` to ssnLast4 produces `000-00-XXXX` which violates the WA rule: "no `00` in positions 4-5". The schema also rejects SSNs starting with `000`.
**Why it happens:** WA L&I added realistic SSN validation to catch placeholder values, unlike CA which accepts the `000000XXXX` pattern.
**How to avoid:** Two approaches — (1) use the same `000000XXXX` approach as CA and accept that WA portal upload may prompt the contractor to correct SSNs manually (low risk since contractors enter SSN directly in portal anyway), or (2) omit the SSN element and rely on the portal's "missing SSN" prompt. The WA XML guide states contractors submit and fix validation errors interactively. Recommend approach (1) with a clear modal disclosure mirroring Phase 29's pattern.
**Warning signs:** WA portal upload validation step 1 fails with "invalid SSN" — expected; contractor fixes in portal.
**Confidence:** MEDIUM — XSD rules confirmed, but portal's actual rejection behavior is untested.

### Pitfall 2: Day Ordering is Monday-First in WA (Opposite of CA)
**What goes wrong:** CA eCPR uses Sunday-first (id=1=Sun). WA uses Monday-first (`regularDay1Hours` = Monday, `regularDay7Hours` = Sunday). Copying the CA day-mapping array verbatim produces shifted hours.
**Why it happens:** Different standards between agencies.
**How to avoid:** In `waCprXmlGenerator.ts`, day array must be `['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']` (7 entries, Day1=Mon). The existing `payrollEntries` schema stores Mon–Sun columns directly, so the mapping is straightforward.
**Warning signs:** Saturday/Sunday hours appear on Friday/Saturday in XML output.

### Pitfall 3: Route Registration Order (Route Ordering Constraint)
**What goes wrong:** Express routes are matched in declaration order. If `/:weekId` (wildcard) is registered before `/wa-cpr-xml/:weekId`, the wildcard captures the `wa-cpr-xml` path and the route is never reached.
**Why it happens:** Express wildcard segments match anything including named path segments.
**How to avoid:** Register `router.get('/wa-cpr-xml/:weekId', ...)` before the generic `/:weekId` wildcard. In `export.ts` the CA `ecpr-xml/:weekId` route is already registered correctly. Add the new WA route after the CA route, before any `/:weekId` wildcard (currently no wildcard exists — the pattern is all named, so this is low risk but worth confirming).

### Pitfall 4: `waTradeCode` Typed vs. Cast
**What goes wrong:** In the old F700 handler (`export.ts` line 377), `waTradeCode` was accessed with `(row as any).waTradeCode` cast because the old `getPayrollEntries()` join didn't select it. The new `getPayrollEntriesWithWorkerDetails()` correctly types `waTradeCode: workerClassifications.waTradeCode` — no cast needed.
**Why it happens:** Phase 25 added `waTradeCode` to the classification table, but Phase 29 extended the function to properly select it.
**How to avoid:** In `waCprXmlGenerator.ts` route handler, always use `getPayrollEntriesWithWorkerDetails()` (not `getPayrollEntries()`). Confirm the function's inferred return type includes `waTradeCode: string | null`.

### Pitfall 5: intentId Must Be Integer in XML
**What goes wrong:** `pwiaIntentId` is stored as `TEXT` in SQLite (nullable). Passing the string directly to the XML without conversion produces `<intentId>12345</intentId>` which works, but the XSD type is `unsignedInt`. Non-numeric strings (e.g., `"ABC-123"`) would fail portal validation.
**Why it happens:** The app stores intentId as text (for display and flexibility), but WA XSD requires unsigned integer.
**How to avoid:** In the export route, validate that `project.pwiaIntentId` parses to a positive integer (`Number.isInteger(parseInt(id)) && parseInt(id) > 0`). Return 400 with a clear message if invalid. In the modal, display a placeholder hint "e.g., 12345" and validate numeric-only on the client.

### Pitfall 6: County Name Case Sensitivity
**What goes wrong:** The WA XSD notes trade codes and county names are "case-insensitive pattern-restricted." The `project.county` column stores the county as entered by the user (e.g., "king county" vs "King" vs "KING COUNTY"). WA L&I validates county against its published list.
**Why it happens:** User-entered data vs. L&I's canonical county list.
**How to avoid:** The route handler should pass `project.county` as-is. The portal's 5-step validation will catch invalid county names. Consider title-casing the county before insertion into XML (`county.trim().split(' ').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ')`).

### Pitfall 7: WAL-04 Panel Data Source
**What goes wrong:** `PayrollWeekDetailPage.tsx` currently queries entries using `getPayrollEntries()` (via `/api/payroll/weeks/:weekId/entries`). This function does NOT return `waTradeCode`. The WAL-04 panel and the WAL-03 trade code gate both need `waTradeCode`.
**Why it happens:** Two different service functions with different join shapes.
**How to avoid:** Either (a) switch the page's primary entry query to `getPayrollEntriesWithWorkerDetails()`, or (b) check if the existing entries API endpoint already calls `getPayrollEntriesWithWorkerDetails` and returns `waTradeCode`. Inspect the entries route to confirm. If not, the cleanest fix is to add `waTradeCode` to the standard entries response, or use a separate WA-only query for the panel.

---

## DB Migration

### Next Migration

| Field | Value |
|-------|-------|
| File | `src/server/db/migrations/0015_wa_pwia_intent_id.sql` |
| SQL | `ALTER TABLE projects ADD COLUMN pwia_intent_id TEXT;` |
| Journal idx | 11 (current highest: idx 10, tag `0014_ca_ecpr_fringe_columns`) |
| Journal tag | `0015_wa_pwia_intent_id` |
| Schema update | Add `pwiaIntentId: text('pwia_intent_id')` to `projects` table in `schema.ts`, following `contractNumber` (line 43) |

**Migration SQL:**
```sql
ALTER TABLE projects ADD COLUMN pwia_intent_id TEXT;
```

**Journal entry (add after idx 10):**
```json
{
  "idx": 11,
  "version": "6",
  "when": 1774900100000,
  "tag": "0015_wa_pwia_intent_id",
  "breakpoints": true
}
```

### Verify Post-Migration
```sql
SELECT sql FROM sqlite_master WHERE name = 'projects';
-- Expect: ... pwia_intent_id TEXT
```

---

## WAL-04 Panel: PWIA Form Fields Research

### Intent to Pay Prevailing Wages Form — Required Fields (HIGH confidence — verified from official PWIA docs + WA prevailing wage law)

Per RCW 39.12 and official PWIA portal documentation:

**Project-Level (already on `projects` table):**
- Contractor name
- UBI Number (`project.ubiNumber`)
- L&I Contractor Registration Certificate (`project.lniCertificate`)
- Workers' Compensation Account Number (`project.wcAccount`)
- Project name/location (`project.name`, `project.county`, `project.state`)
- Contract/Bid number (`project.wdIdentifier`)
- Awarding agency name

**Per Trade Classification:**
- Trade code (4-letter WA code, e.g., CARP, ELEC)
- Job classification description
- Wage rate (prevailing wage base rate)
- Fringe benefit rate
- Number of workers in that classification
- Estimated total hours (the portal accepts "estimated" at intent time; at affidavit time, actual hours are used)

**Intent Panel — Display actual hours** (per D-57 Claude's discretion): Since this panel is generated post-payroll-entry, display actual hours from the payroll week. Label as "Actual Hours (this payroll week)" to avoid confusion with the portal's "Estimated Hours" field on the Intent form.

### Affidavit of Wages Paid Form — Required Fields (HIGH confidence)

Per RCW 39.12.040 and certified payroll reporting requirements:

**Per Worker:**
- Worker name
- Worker address
- Trade/occupation
- WA trade code
- Straight-time (regular) hours worked by day (M–Su)
- Overtime hours worked by day (M–Su)
- Straight-time hourly rate (prevailing wage base rate)
- Prevailing wage fringe benefit rate (hourly)
- Gross wages paid for this project
- Itemized deductions
- Net pay

**Week-Level:**
- Week ending date
- Payroll number

Note: Full SSN is required by the Affidavit form but not stored in the app. The panel should show `***-**-XXXX` (masked with last 4) and note that the contractor must enter the full SSN directly in the PWIA portal.

---

## Amendment Handling (WAL-03, D-08)

WA L&I CPR XML uses:
- `<amendedFlag>true</amendedFlag>` — boolean, marks the entire payroll week as an amendment
- `<amendReason>` — optional string reason (e.g., "Correction to worker hours")
- `<amendedDate>` — optional date of amendment

**Recommendation (Claude's discretion — implementing since schema confirms the mechanism):**

```typescript
// In route handler:
const isAmendment = week.originalWeekId != null && week.amendmentNumber != null;
const amendedFlag = isAmendment;
const amendReason = isAmendment ? `Amendment ${week.amendmentNumber}` : undefined;
```

This follows the same `week.originalWeekId` check used in the CA eCPR handler. The WA approach is simpler (boolean + string reason) vs. CA's numeric counter. Always emit `amendedFlag` (either true or false) per the XSD's optional-but-well-defined pattern.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 30 is code/config-only changes. Dependencies (`xmlbuilder2`, `vitest`, `supertest`, `drizzle-orm`) are all confirmed installed from Phase 29. No new external tools required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --reporter=verbose tests/services/waCprXmlGenerator.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAL-03 | `generateWaCprXml()` produces valid XML with correct root element `WaPWCPR` | unit | `npm test -- tests/services/waCprXmlGenerator.test.ts` | Wave 0 |
| WAL-03 | `generateWaCprXml()` emits `intentId` as integer element | unit | `npm test -- tests/services/waCprXmlGenerator.test.ts` | Wave 0 |
| WAL-03 | `generateWaCprXml()` maps Mon–Sun correctly as Day1–Day7 | unit | `npm test -- tests/services/waCprXmlGenerator.test.ts` | Wave 0 |
| WAL-03 | `generateWaCprXml()` sets `amendedFlag=true` for amendment weeks | unit | `npm test -- tests/services/waCprXmlGenerator.test.ts` | Wave 0 |
| WAL-03 | `GET /api/export/wa-cpr-xml/:weekId` returns 400 for non-WA project | route | `npm test -- tests/routes/export.test.ts` | Exists (add test) |
| WAL-03 | `GET /api/export/wa-cpr-xml/:weekId` returns 400 when intentId missing | route | `npm test -- tests/routes/export.test.ts` | Exists (add test) |
| WAL-03 | `GET /api/export/wa-cpr-xml/:weekId` returns 400 when worker has null waTradeCode | route | `npm test -- tests/routes/export.test.ts` | Exists (add test) |
| WAL-03 | `GET /api/export/wa-cpr-xml/:weekId` returns XML for valid WA project with intentId and trade codes | route | `npm test -- tests/routes/export.test.ts` | Exists (add test) |
| WAL-03 | `GET /api/export/wa-cpr-xml/:weekId` returns 403 for unauthorized access | route | `npm test -- tests/routes/export.test.ts` | Exists (add test) |
| WAL-04 | Submission panel renders for WA project | manual (UI) | n/a | n/a |

### Sampling Rate

- **Per task commit:** `npm test -- tests/services/waCprXmlGenerator.test.ts tests/routes/export.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (188+ tests passing) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/services/waCprXmlGenerator.test.ts` — unit tests for XML generator (covers WAL-03 unit behaviors above)
- [ ] Add WA CPR XML test cases to `tests/routes/export.test.ts` (WAL-03 route behaviors)

*(Existing `tests/routes/export.test.ts` infrastructure is reusable — same helper functions `registerUser`, `createProject`, `createWorkerWithClassification`, `createPayrollWeek`, `createPayrollEntry` apply)*

---

## Code Examples

### Worker Name Splitting (WA XML requires firstName + lastName)

```typescript
// Source: convention for WA L&I XML — worker name stored as "First Last" in app
function splitWorkerName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
}
```

### Address Parsing (reuse CA eCPR pattern from export.ts lines 582-587)

```typescript
// Source: export.ts line 582 — already in production
const addrParts = (row.workerAddress || '').split(',').map((s: string) => s.trim());
const street = addrParts[0] || '';
const city = addrParts[1] || '';
const stateZip = (addrParts[2] || '').split(' ').filter(Boolean);
const addrState = stateZip[0] || 'WA';
const zip = stateZip[1] || '00000';
```

### Day Array (WA: Mon=Day1 through Sun=Day7)

```typescript
// Source: WA XSD schema — regularDay1Hours = Monday
const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
// CA (for comparison): ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
```

### intentId Validation

```typescript
// In route handler — validate before XML generation
const intentIdStr = project.pwiaIntentId;
if (!intentIdStr) {
  return res.status(400).json({ error: 'PWIA Intent ID is required. Please enter your Intent ID from the L&I PWIA portal.' });
}
const intentIdNum = parseInt(intentIdStr, 10);
if (!Number.isInteger(intentIdNum) || intentIdNum <= 0) {
  return res.status(400).json({ error: 'PWIA Intent ID must be a positive integer as shown in the L&I PWIA portal.' });
}
```

### Trade Code Gate (server-side — 422 with worker list)

```typescript
// In route handler — gate before XML generation
const nullTradeEntries = entries.filter(row => !row.waTradeCode);
if (nullTradeEntries.length > 0) {
  return res.status(422).json({
    error: 'WA trade code required for all workers',
    workers: nullTradeEntries.map(row => ({ name: row.workerName, workerId: row.workerId })),
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `(row as any).waTradeCode` cast in F700 handler | Properly typed in `getPayrollEntriesWithWorkerDetails()` | Phase 29 | WA CPR XML route uses typed access, no cast needed |
| No WA XML export | WA L&I PWIA portal accepts XML uploads since Jan 1, 2020 | Jan 2020 | Full XML CPR submission path now available |
| CA-only fringe disaggregation | CA columns only (`fringe_health_welfare` etc. nullable) | Phase 29 | WA XML uses single `fringeRateSnapshot` — no disaggregation needed for WA |

---

## Open Questions

1. **SSN Validation Behavior at WA Portal**
   - What we know: XSD rules reject SSNs starting with `000`, and the `000000XXXX` placeholder violates the "no `00` in positions 4-5" rule
   - What's unclear: Whether the WA portal upload step 1 hard-rejects the file or prompts the contractor to correct SSNs interactively
   - Recommendation: Use same placeholder strategy as CA, include prominent modal disclosure. If portal hard-rejects, contractor must edit SSNs in the portal's correction UI. Document this in the pre-generation modal.

2. **`waTradeCode` Availability on PayrollWeekDetailPage**
   - What we know: `PayrollWeekDetailPage` uses `getPayrollEntries()` for its main data; this function does NOT return `waTradeCode`. The `getPayrollEntriesWithWorkerDetails()` does return it.
   - What's unclear: Whether the entries API endpoint `/api/payroll/weeks/:weekId/entries` already calls the extended function. Need to check `payrollRoutes.ts`.
   - Recommendation: Planner should check the route handler and either (a) switch to `getPayrollEntriesWithWorkerDetails()` in the endpoint, or (b) add a separate WA-specific query on the client. Option (a) is cleaner.

3. **County Name Format Accepted by WA Portal**
   - What we know: WA XSD is case-insensitive for county. `project.county` is user-entered (could be "King County", "King", "KING", etc.)
   - What's unclear: Does the portal normalize county names, or must they match exactly a canonical list?
   - Recommendation: Pass `project.county` as stored. Title-case it before XML emission as a best-effort normalization.

---

## Sources

### Primary (HIGH confidence)
- `https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd` — Official WA L&I XSD schema for CPR XML upload. Confirmed root element `WaPWCPR`, `intentId` as `unsignedInt`, `tradeHoursWage` structure, day numbering, amendment fields, SSN validation rules.
- `src/server/services/ecprXmlGenerator.ts` — Phase 29 xmlbuilder2 pattern (read directly)
- `src/server/services/f700Generator.ts` — WA trade codes, F700Data shape (read directly)
- `src/server/routes/export.ts` — 8-step export pattern, existing WA gate, existing CA eCPR pattern (read directly)
- `src/server/db/schema.ts` — current `projects` table schema, all existing nullable columns (read directly)
- `src/server/db/migrations/meta/_journal.json` — last migration idx=10 confirmed (read directly)
- `src/server/services/payrollService.ts` — `getPayrollEntriesWithWorkerDetails()` return type confirmed (read directly)
- `src/client/pages/PayrollWeekDetailPage.tsx` — existing WA disclosure modal at line 718 (read directly)

### Secondary (MEDIUM confidence)
- `https://lni.wa.gov/licensing-permits/_docs/xml%20payroll%20guide.pdf` — Official WA L&I XML Payroll Upload Guide (PDF, binary; referenced but content not fully extracted)
- `https://lni.wa.gov/licensing-permits/public-works-projects/contractors-employers/` — Official WA L&I contractors page confirming Intent to Pay / Affidavit fields
- `https://lni.wa.gov/licensing-permits/_docs/February2017PWIAInstructions.pdf` — PWIA Instructions PDF (binary; referenced, confirms Intent to Pay / Affidavit structure)
- WA L&I AGC announcement confirming XML upload available since Jan 1, 2020: `https://www.agcwa.com/l-i-says-contractors-can-now-submit-certified-payrolls-electronically/`

### Tertiary (LOW confidence — secondary sources, not independently verified)
- `https://www.points-north.com/state-by-state-certified-payroll-reporting/washington` — trade code list (matches `WA_TRADE_CODES` map already in codebase)
- Intent ID confirmed as numeric, per-project, per-contractor — cited by LCPtracker documentation and multiple vendor guides

---

## Metadata

**Confidence breakdown:**
- WA CPR XML schema: HIGH — official XSD fetched and parsed
- DB migration: HIGH — journal read directly, current idx confirmed
- Amendment handling: HIGH — WA XSD fields confirmed (`amendedFlag`, `amendReason`)
- intentId format: HIGH — XSD type `unsignedInt` confirmed; MEDIUM on exact display format (numeric only, no dashes)
- WAL-04 Intent to Pay fields: MEDIUM — confirmed from secondary official docs (PDF parse failed but content verified from web search + RCW 39.12)
- WAL-04 Affidavit fields: MEDIUM — same as above
- SSN portal behavior: LOW — XSD rules confirmed, portal validation behavior untested

**Research date:** 2026-03-27
**Valid until:** 2026-07-01 (stable WA L&I schema; portal improvements ongoing but schema unlikely to change without notice)
