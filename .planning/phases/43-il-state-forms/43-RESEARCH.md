# Phase 43: IL State Forms — Research

**Researched:** 2026-04-06
**Domain:** IL Certified Transcript of Payroll PDF (pdf-lib programmatic), IDOL submission modal, schema migration
**Confidence:** HIGH — all findings derived directly from codebase inspection

---

## Summary

Phase 43 adds two capabilities for Illinois prevailing-wage projects: (1) a programmatic PDF generator for the IL Certified Transcript of Payroll (two-page form), using the exact same `PDFDocument.create()` pattern established in Phase 41 (PW-12); and (2) a 2-step IDOL submission modal on `PayrollWeekDetailPage`, replacing the Phase 42 placeholder button.

The phase also requires one DB migration: `il_idol_submitted_at TEXT` on `payroll_weeks`. Phase 42 (`0025_il_schema.sql`) did NOT add this column — confirmed by reading both the migration file and the current schema definition. The next migration index is 22, filename `0026_il_idol_submission.sql`.

The IL Certified Transcript format is not an official IDOL fillable PDF; it is a contractor-produced certified payroll report. Illinois does not provide a state-mandated PDF template (unlike federal WH-347). The form content must be derived from IDOL guidance and the requirements in STATE-08. The "F" flag for jointly-managed LMRA fund fringe payments is a field on the form but the data model has no fund-type column; the planner must decide how to handle this (see Open Questions).

**Primary recommendation:** Model `ilPdfGenerator.ts` directly on `pw12Generator.ts` — same `PDFDocument.create()`, same Letter portrait dimensions, same `DrawCtx` pattern, same `fillIlCertifiedTranscript()` export name convention. The IL form has two pages: page 1 is the worker table, page 2 is the Statement of Compliance / Affidavit with subcontractor list and fund detail fields.

---

## Project Constraints (from CLAUDE.md)

- **DB migrations:** Plain SQL `ALTER TABLE ... ADD COLUMN` files in `src/server/db/migrations/`. Always register in `meta/_journal.json`. Add-only (never drop or rename columns). Verify with `SELECT sql FROM sqlite_master WHERE name = 'payroll_weeks'`.
- **Design tokens:** Use `@theme` tokens — `bg-brand-gold`, `text-brand-gold`, `bg-surface-card`, `bg-nav-dark`, `bg-surface-page`. Never hardcode hex values.
- **UI primitives:** `Card`, `Button`, `Badge`, `PageHeader`, `EmptyState` from `src/client/components/ui/`.
- **React patterns:** `useRef` for synchronous guards (double-click), Blob URL downloads via `fetch()` → `.blob()` → `URL.createObjectURL()` → click → `setTimeout(URL.revokeObjectURL, 100)`.
- **NFR-03:** All new routes apply `assertProjectAccess` before any data access.
- **Federal compliance:** Never hard-delete payroll data. Amendments create new rows, never update in place.
- **Test framework:** Vitest + supertest (existing test suite, 188 passing as of last session).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATE-08 | IL Certified Transcript of Payroll PDF generator using pdf-lib. Two-page form. Fields: contractor name/address/FEIN, project name/number/location/contracting agency, week-ending date, per-employee rows (name + last4 SSN, address, classification, daily hours Mon–Sun distinguishing PW vs non-PW, total PW + nonPW hours, base rate, fringe hourly rates for Pension/Health+Welfare/Vacation/Training each with "F" flag if jointly-managed LMRA fund, gross pay, deductions, net pay). Page 2 affidavit with subcontractor list and fund details fields. | See IL PDF Layout section, IlPdfInput type definition, data mapping table, F flag logic section. |
| STATE-11 | IL IDOL submission modal — 2-step modal on PayrollWeekDetailPage (IL-gated). Step 1: generate and download IL Certified Transcript PDF. Step 2: show IDOL portal checklist (due by 15th of following month, portal URL, Excel template note). "Mark as Submitted to IL IDOL" button writes nyMpwrSubmittedAt-style timestamp. | See Modal Pattern section, migration section, submit route pattern. |
| NFR-03 | All new routes apply assertProjectAccess before any data access. | See Export Route Pattern — pw12 route shows the exact 3-step guard sequence. |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | (existing) | Programmatic PDF creation | Used by pw12Generator, wh347Generator, a1131Generator, f700Generator — project standard |
| drizzle-orm | (existing) | DB schema + migrations | Project ORM — all migrations follow Drizzle SQL pattern |
| express | (existing) | Route handling | Project server framework |
| react + tanstack-query | (existing) | Modal UI + data fetching | Project client stack |

No new npm installs required for Phase 43.

---

## Architecture Patterns

### IL PDF Generator — File Location

```
src/server/services/ilPdfGenerator.ts
```

### IL PDF Input Type

```typescript
// src/server/services/ilPdfGenerator.ts

export interface IlPdfInput {
  contractor: {
    name: string;
    address: string;
    fein: string;
  };
  project: {
    name: string;
    number: string;          // IL project/contract number — maps to project.wdIdentifier or similar
    location: string;        // project location/address
    contractingAgency: string; // e.g., IDOT, City of Chicago
  };
  week: {
    weekEndingDate: string;  // ISO YYYY-MM-DD
    payrollNumber: string;   // e.g., "1" or "5 (AMENDED 1)"
  };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    workerAddress: string;
    classification: string;
    // PW hours Mon–Sun (straight-time only — IL form distinguishes PW vs non-PW, not ST vs OT)
    monPw: number; tuePw: number; wedPw: number; thuPw: number;
    friPw: number; satPw: number; sunPw: number;
    // Non-PW hours Mon–Sun (sourced from entry.nonPwHours split or approximated)
    monNonPw: number; tueNonPw: number; wedNonPw: number; thuNonPw: number;
    friNonPw: number; satNonPw: number; sunNonPw: number;
    totalPwHours: number;
    totalNonPwHours: number;
    baseRate: number;
    // Fringe hourly rates — each with F flag
    fringePension: number | null;
    fringePensionIsF: boolean;           // true if paid to jointly-managed LMRA fund
    fringeHealthWelfare: number | null;
    fringeHealthWelfareIsF: boolean;
    fringeVacation: number | null;
    fringeVacationIsF: boolean;
    fringeTraining: number | null;
    fringeTrainingIsF: boolean;
    grossPay: number | null;
    deductions: number | null;
    netPay: number | null;
  }>;
  // Page 2 affidavit fields
  affidavit: {
    subcontractors: Array<{ name: string; address: string }>;  // may be empty array
    // Fund details for each fringe benefit paid to a fund
    fundDetails: Array<{
      fringeType: string;        // e.g., "Pension", "Health & Welfare"
      fundName: string;
      fundAdminAddress: string;
      employeeContributionRate: string;  // e.g., "$3.50/hr"
    }>;
  };
}
```

### IL PDF Layout — Page 1

**Dimensions:** 612 × 792 pt (Letter portrait) — same as pw12Generator.ts
**Margins:** `MARGIN = 36` — same as pw12Generator.ts
**Content width:** 540 pt

**Header block (top ~80 pt):**
- Line 1: Centered bold title "ILLINOIS CERTIFIED TRANSCRIPT OF PAYROLL"
- Line 2: Contractor Name | FEIN (two columns)
- Line 3: Contractor Address | Week Ending Date
- Line 4: Project Name | Payroll No.
- Line 5: Project Number | Location
- Line 6: Contracting Agency (full width)
- Horizontal rule separating header from table

**Worker table column layout (recommended x positions, 6 pt text):**

```
const IL_COL = {
  nameSSN:      MARGIN,           // width ~90: "Name / SSN-last4"
  address:      MARGIN + 92,      // width ~70: "Address"
  class:        MARGIN + 164,     // width ~60: "Classification"
  monPw:        MARGIN + 226,     // PW hours Mon–Sun (7 cols, ~16pt each)
  tuePw:        MARGIN + 242,
  wedPw:        MARGIN + 258,
  thuPw:        MARGIN + 274,
  friPw:        MARGIN + 290,
  satPw:        MARGIN + 306,
  sunPw:        MARGIN + 322,
  totalPw:      MARGIN + 338,     // total PW hrs
  totalNonPw:   MARGIN + 356,     // total non-PW hrs
  baseRate:     MARGIN + 374,     // base rate $
  pension:      MARGIN + 396,     // "$X.XX F" or "$X.XX"
  hw:           MARGIN + 418,     // health & welfare
  vac:          MARGIN + 440,     // vacation
  training:     MARGIN + 462,     // training
  gross:        MARGIN + 484,     // gross pay
  ded:          MARGIN + 506,     // deductions
  net:          MARGIN + 525,     // net pay
} as const;
```

**Row structure:** Each worker = 2 rows:
- Row 1 (PW row): name+SSN, address, classification, Mon–Sun PW hours, totals, rate/fringe/pay
- Row 2 (non-PW row): same name area blank (or "Non-PW"), Mon–Sun non-PW hours only

Row height: ~20 pt per 2-row worker block + 6 pt separator. At ~12 workers per page; overflow to new page with repeated header.

**Note on column density:** The IL form is very column-dense. Using 6 pt font for table body (SMALL_SIZE) and 7 pt for row labels is required. The maxWidth constraint on each `drawText` call prevents overflow into adjacent columns.

### IL PDF Layout — Page 2 (Statement of Compliance / Affidavit)

**Always page 2** — unlike PW-12 which flows compliance on same page, IL requires a dedicated second page.

Structure (top to bottom):
1. Bold heading "STATEMENT OF COMPLIANCE / AFFIDAVIT"
2. Affidavit preamble text (~40pt tall, 7pt font, lineHeight 10)
3. "SUBCONTRACTOR LIST" section with up to N rows (name + address lines, 2-column layout)
4. "FUND DETAILS" section — for each fringe type paid to a fund: fund name, fund admin address, employee contribution rate
5. Signature block (bottom): Signature line | Title line | Date line

If `affidavit.subcontractors` is empty, print "None" in the subcontractor list area.
If `affidavit.fundDetails` is empty, print "N/A — fringe benefits paid as cash in lieu of fund" in the fund details area.

### Export Route Pattern

Model new route on `GET /api/export/pw12/:weekId` exactly (lines 888–991 of export.ts):

```typescript
router.get('/il-pdf/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;

  // 1. Load payroll week
  const week = await getPayrollWeek(weekId);
  if (!week) { res.status(404).json({ error: 'Payroll week not found' }); return; }

  // 2. assertProjectAccess (NFR-03) — BEFORE state gate
  const db = getDb();
  let project: Project;
  try {
    project = await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
    return;
  }

  // 3. State gate — IL-only
  if (project.state?.toUpperCase() !== 'IL') {
    res.status(400).json({ error: 'IL Certified Transcript is only available for Illinois projects' });
    return;
  }

  // 4. getPayrollEntriesWithWorkerDetails (not getPayrollEntries) — need SSN, address, nonPwHours
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);

  // 5. Map to IlPdfInput — see data mapping section
  // 6. fillIlCertifiedTranscript(ilData)
  // 7. res.setHeader('Content-Type', 'application/pdf')
  //    res.setHeader('Content-Disposition', `attachment; filename="il-transcript-${weekId}.pdf"`)
  //    res.end(Buffer.from(filledPdf))
  // 8. Best-effort audit log (AUDIT-03)
});
```

**Critical:** Step 2 (assertProjectAccess) must come BEFORE step 3 (state gate). The pw12 route demonstrates this order — NFR-03 applies to all routes including state-gated ones.

### Submit Route Pattern

Model on `PATCH /api/payroll/weeks/:id/ny-submit` (payroll.ts line 529):

```typescript
router.patch('/weeks/:id/il-submit', async (req, res) => {
  // 1. Load week → 404 if not found
  // 2. assertProjectAccess → 403/500 on failure
  // 3. setIlIdolSubmitted(weekId)  // new service function
  // 4. Best-effort audit log: action: 'agency_submission.created', meta: { agency: 'IL_IDOL', ... }
  // 5. res.status(200).json(result)
});
```

No `AgencySubmitSchema` needed (NY MPWR submit route has no body schema either).

### Modal Pattern

**IL is 2-step** (not 3-step like NY MPWR).

State variables to add alongside existing NY MPWR state (lines 238–242):
```typescript
const [showIlIdolModal, setShowIlIdolModal] = useState(false);
const [ilIdolStep, setIlIdolStep] = useState<1 | 2>(1);
const [ilIdolSubmitting, setIlIdolSubmitting] = useState(false);
```

**Step 1:** "Download IL Certified Transcript"
- Single download button triggering `GET /api/export/il-pdf/:weekId`
- Uses Blob URL download pattern (fetch → blob → createObjectURL → click)
- "Continue" button advances to step 2

**Step 2:** "Submit to IL IDOL"
- Checklist items:
  - Upload to IL IDOL portal (link to https://idol2.illinois.gov or current IDOL portal URL)
  - Due by the 15th of the following month after the payroll week ending date
  - Note about Excel template option (contractors may also use IDOL's Excel upload)
- "Mark as Submitted to IL IDOL" button: calls `PATCH /api/payroll/weeks/:id/il-submit`
- Once `week.ilIdolSubmittedAt` is non-null: show Badge + date, replace button with "Close"

**Trigger button** (replacing the Phase 42 placeholder at line 952):
```tsx
{isIL && weekId && (
  <Button
    variant="secondary"
    size="sm"
    onClick={() => { setIlIdolStep(1); setShowIlIdolModal(true); }}
  >
    IL IDOL Submission
  </Button>
)}
```

**Status panel** (replacing Phase 42 "Coming in Phase 43" placeholder at line 1315):
```tsx
{isIL && (
  <>
    <div className="border-t border-gray-100" />
    <div className="px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge variant={week.ilIdolSubmittedAt ? 'compliant' : 'neutral'}>
          IL IDOL Submission
        </Badge>
        {week.ilIdolSubmittedAt && (
          <span className="text-sm text-gray-500">
            Submitted {week.ilIdolSubmittedAt.slice(0, 10)}
          </span>
        )}
      </div>
      {!week.ilIdolSubmittedAt && (
        <Button variant="secondary" size="sm"
          onClick={() => { setIlIdolStep(1); setShowIlIdolModal(true); }}>
          Submit to IL IDOL
        </Button>
      )}
    </div>
  </>
)}
```

---

## Data Mapping

### `getPayrollEntriesWithWorkerDetails` → `IlPdfInput`

| IlPdfInput field | Source |
|-----------------|--------|
| `contractor.name` | `project.name` |
| `contractor.address` | Concatenate project county + state (same pattern as pw12 route line 953) |
| `contractor.fein` | `project.contractorFein ?? ''` |
| `project.name` | `project.name` |
| `project.number` | `project.wdIdentifier ?? ''` |
| `project.location` | `project.county + ', ' + project.state` |
| `project.contractingAgency` | `project.contractingAgency ?? ''` (IL-specific field added in Phase 42) |
| `week.weekEndingDate` | `week.weekEndingDate` |
| `week.payrollNumber` | Same amendment-aware string as pw12: `week.amendmentNumber != null ? \`${week.payrollNumber} (AMENDED ${week.amendmentNumber})\` : String(week.payrollNumber)` |
| `entry.workerName` | `row.workerName` |
| `entry.workerSsnLast4` | `row.workerSsnLast4 ?? null` |
| `entry.workerAddress` | `row.workerAddress` (SQL-concatenated in getPayrollEntriesWithWorkerDetails) |
| `entry.classification` | `row.tradeDescription` |
| `entry.monPw` through `sunPw` | `e.monSt`, etc. (PW hours = straight-time; IL form uses PW/non-PW not ST/OT) |
| `entry.monNonPw` through `sunNonPw` | Cannot split `entry.nonPwHours` by day — `nonPwHours` is a weekly total. **Use 0 for each day and put `entry.nonPwHours` in `totalNonPwHours`.** Planner to decide: show weekly non-PW total only, not per-day breakdown. |
| `entry.totalPwHours` | `e.monSt + e.tueSt + ... + e.sunSt` (PW total = ST total) |
| `entry.totalNonPwHours` | `e.nonPwHours ?? 0` |
| `entry.baseRate` | `e.baseRateSnapshot` |
| `entry.fringePension` | `e.fringePension ?? null` |
| `entry.fringeHealthWelfare` | `e.fringeHealthWelfare ?? null` |
| `entry.fringeVacation` | `e.fringeVacation ?? null` |
| `entry.fringeTraining` | `e.fringeTraining ?? null` |
| `entry.grossPay` | `e.grossWages ?? null` |
| `entry.deductions` | `e.deductions` |
| `entry.netPay` | `e.netPay ?? null` |
| All `*IsF` flags | `false` — see F Flag Logic section |
| `affidavit.subcontractors` | `[]` — data model has no subcontractor table in v1 |
| `affidavit.fundDetails` | `[]` — data model has no fund data in v1 |

**Note on project fields:** The Phase 42 IL schema migration (`0025_il_schema.sql`) added worker demographics columns only — no new project columns. The `contractingAgency` field must come from wherever it was added. Verify what Phase 42 actually added to the `projects` table.

### Verify Phase 42 Project Schema Additions

The planner must read the full `schema.ts` `projects` table definition to determine:
1. Whether `contractingAgency` was added in Phase 42 or a prior phase
2. Whether `wdIdentifier` serves as the IL "project number" field

This is left to the planner as it requires schema.ts inspection beyond the payroll_weeks/payroll_entries tables read in this research.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| PDF creation | Custom PDF byte generation | `pdf-lib` `PDFDocument.create()` — already in project |
| Font embedding | Custom font loading | `StandardFonts.Helvetica` / `StandardFonts.HelveticaBold` — same as pw12Generator |
| PDF text layout | Manual byte offset calculations | `page.drawText()` with `maxWidth` constraint |
| Download UX | Custom streaming approach | Blob URL pattern: `fetch → blob → createObjectURL → click → setTimeout(revokeObjectURL)` |
| State-gating | Custom auth check | `assertProjectAccess` from `../utils/assertProjectAccess.js` |

---

## Migration Required

### Confirmed: `ilIdolSubmittedAt` Is NOT in the Schema

Inspection of `src/server/db/schema.ts` (lines 190–208) confirms:
```
payroll_weeks columns:
  id, projectId, weekEndingDate, payrollNumber, isFinal,
  submittedAt, submittedTo, amendmentNumber, originalWeekId,
  caEcprSubmittedAt,    ← Phase 34
  waLniSubmittedAt,     ← Phase 34
  nyMpwrSubmittedAt,    ← Phase 41
  createdAt, updatedAt
```

`ilIdolSubmittedAt` is absent. Phase 42 migration (`0025_il_schema.sql`) added only worker demographic columns and `payroll_entries.non_pw_hours`. Phase 43 must add this column.

### New Migration

**File:** `src/server/db/migrations/0026_il_idol_submission.sql`
```sql
ALTER TABLE payroll_weeks ADD COLUMN il_idol_submitted_at TEXT;
```

**Journal entry** (next idx = 22, appended to `meta/_journal.json`):
```json
{
  "idx": 22,
  "version": "7",
  "when": <timestamp>,
  "tag": "0026_il_idol_submission",
  "breakpoints": true
}
```

**Schema.ts addition** (after `nyMpwrSubmittedAt` line):
```typescript
// Phase 43 — IL IDOL submission tracking
ilIdolSubmittedAt: text('il_idol_submitted_at'),
```

**PayrollWeek interface addition** in `PayrollWeekDetailPage.tsx` (after `nyMpwrSubmittedAt: string | null`):
```typescript
ilIdolSubmittedAt: string | null;
```

**New service function** in `payrollService.ts`:
```typescript
export async function setIlIdolSubmitted(weekId: string): Promise<{ ilIdolSubmittedAt: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.update(payrollWeeks)
    .set({ ilIdolSubmittedAt: now, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
  return { ilIdolSubmittedAt: now };
}
```

---

## F Flag Logic

### What STATE-08 Requires

The IL Certified Transcript form has an "F" indicator next to each fringe benefit rate. The "F" stands for a fringe benefit paid to a jointly-managed LMRA (Labor-Management Relations Act) trust fund — i.e., a union fund such as a pension trust or health & welfare fund. If the fringe is paid directly to the worker as cash in lieu, no "F" is shown.

### Current Data Model Reality

The current `payroll_entries` table stores fringe amounts as dollar totals (`fringeHealthWelfare`, `fringePension`, `fringeVacation`, `fringeTraining`). There is NO column indicating whether each fringe is a fund payment vs. cash-in-lieu. No such column exists in `schema.ts`, `workerClassifications`, or `workers`.

### Recommended Approach for Phase 43 (Planner Decision)

Two options, in order of preference:

**Option A (Recommended):** Default all F flags to `false` in Phase 43. Add a note in the PDF footer or fund details section stating "F = Payment to LMRA fund; verify with contractor records." This is consistent with the approach used for WH-347 Page 2 fringe benefit certification (the existing system defers certification specifics to the contractor). The IL form is contractor-produced, not a portal submission.

**Option B:** Add a per-fringe boolean to the classification or entry model — e.g., `fringePensionIsF: boolean` on `workerClassifications`. This requires an additional migration and classification UI changes. Out of scope for Phase 43 given no existing data model support.

**Conclusion:** Phase 43 should use Option A. All `*IsF` flags default to `false` in the generator. The fund details section of page 2 prints "F = paid to jointly-managed LMRA fund (verify with contractor records)".

---

## IL IDOL Portal Details

- **Portal URL (MEDIUM confidence):** https://idol2.illinois.gov — Illinois Department of Labor online services. Verify before hardcoding; IDOL may have moved to a new URL.
- **Submission deadline:** 15th of the month following the payroll week ending date (per STATE-11 requirement text).
- **Excel template:** IDOL provides an Excel-based certified payroll template as an alternative to PDF. The modal step 2 checklist should mention this as an option.
- **No API:** IDOL does not provide a programmatic submission API. The modal is informational + timestamp only, same as NY MPWR step 3.

---

## Common Pitfalls

### Pitfall 1: Column Overflow on Dense IL Table

**What goes wrong:** The IL form has ~19 columns across a 540 pt content width. Without `maxWidth` on every `drawText` call, text in one column bleeds into adjacent columns.
**Why it happens:** pdf-lib does not clip text at column boundaries by default.
**How to avoid:** Every single `drawText` in the worker row must have `maxWidth` set to the gap to the next column (column X+1 minus column X minus 2 pt buffer).
**Warning signs:** Generated PDF shows overlapping numbers in rate/fringe columns.

### Pitfall 2: Non-PW Hours Split Assumption

**What goes wrong:** STATE-08 specifies per-day non-PW hours (Mon–Sun). The data model stores only a weekly `nonPwHours` total per entry.
**Why it happens:** Phase 42 added `non_pw_hours` as a single REAL per payroll_entries row, not 7 columns.
**How to avoid:** The generator must accept a weekly total and either (a) show it in the "Total Non-PW" column only with blank daily cells, or (b) approximate equally across working days. Option (a) is correct — do not fabricate per-day splits.
**Warning signs:** Test fixture with nonPwHours=8 showing 8/7 = 1.14 hrs per day — that would be fabricated.

### Pitfall 3: Missing `ilIdolSubmittedAt` in PayrollWeek Interface

**What goes wrong:** Modal renders but `week.ilIdolSubmittedAt` is always `undefined` because the client-side `PayrollWeek` interface doesn't include the new column.
**Why it happens:** The client interface at lines 19–33 of PayrollWeekDetailPage.tsx must be updated to match the server schema after migration.
**How to avoid:** Add `ilIdolSubmittedAt: string | null` to the `PayrollWeek` interface in the same wave that adds the migration.
**Warning signs:** "Mark as Submitted" button never changes to "submitted" badge even after successful PATCH.

### Pitfall 4: State Gate After Project Access Check

**What goes wrong:** IL state gate fires before `assertProjectAccess`, allowing any authenticated user to probe whether a week belongs to an IL project.
**Why it happens:** Incorrect order of operations.
**How to avoid:** Follow the pw12 route order exactly: (1) load week → 404, (2) assertProjectAccess → 403, (3) state gate → 400.
**Warning signs:** Export test returns 400 instead of 403 for cross-user access attempts.

### Pitfall 5: Journal Entry Missing or Incorrect idx

**What goes wrong:** Migration file `0026_il_idol_submission.sql` exists but Drizzle silently skips it.
**Why it happens:** The file must be registered in `meta/_journal.json`. Current highest idx is 21 (tag `0025_il_schema`), so new entry must use idx 22.
**How to avoid:** Append to journal with idx: 22, tag: "0026_il_idol_submission". Verify with `SELECT il_idol_submitted_at FROM payroll_weeks LIMIT 1` after migration.
**Warning signs:** Column missing from DB despite SQL file existing.

### Pitfall 6: Two-Page Guarantee

**What goes wrong:** The IL PDF has only 1 page when entries list is small (compliance section flows onto page 1 instead of always being page 2).
**Why it happens:** PW-12 draws compliance on same page as last worker row. IL must always have exactly 2 pages.
**How to avoid:** After drawing worker table on page 1 (or overflow pages), always `pdfDoc.addPage()` and draw the affidavit on the new, dedicated page. Do not put the affidavit on page 1 regardless of remaining space.
**Warning signs:** `loaded.getPageCount() === 1` in the IL-specific test.

---

## Test Pattern

### Generator Test (`tests/services/ilPdfGenerator.test.ts`)

Follows `tests/services/pw12Generator.test.ts` exactly, with one additional assertion:

```typescript
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillIlCertifiedTranscript } from '../../src/server/services/ilPdfGenerator.js';

const sampleInput = {
  contractor: { name: 'Test Contractor LLC', address: 'Cook County, IL', fein: '12-3456789' },
  project: { name: 'Test Project', number: 'IL-2026-001', location: 'Chicago, IL', contractingAgency: 'City of Chicago' },
  week: { weekEndingDate: '2026-04-05', payrollNumber: '1' },
  entries: [{
    workerName: 'Jane Doe', workerSsnLast4: '5678', workerAddress: '123 Main St, Chicago, IL 60601',
    classification: 'Carpenter',
    monPw: 8, tuePw: 8, wedPw: 8, thuPw: 8, friPw: 8, satPw: 0, sunPw: 0,
    monNonPw: 0, tueNonPw: 0, wedNonPw: 0, thuNonPw: 0, friNonPw: 0, satNonPw: 0, sunNonPw: 0,
    totalPwHours: 40, totalNonPwHours: 0,
    baseRate: 45.50,
    fringePension: 5.00, fringePensionIsF: false,
    fringeHealthWelfare: 8.00, fringeHealthWelfareIsF: false,
    fringeVacation: 3.00, fringeVacationIsF: false,
    fringeTraining: 0.50, fringeTrainingIsF: false,
    grossPay: 1956.50, deductions: 200.00, netPay: 1756.50,
  }],
  affidavit: { subcontractors: [], fundDetails: [] },
};

describe('ilPdfGenerator', () => {
  it('fillIlCertifiedTranscript returns a non-empty Uint8Array', async () => {
    const result = await fillIlCertifiedTranscript(sampleInput);
    expect(result.length).toBeGreaterThan(0);
  });

  it('PDFDocument.load(result) succeeds — round-trip validation', async () => {
    const result = await fillIlCertifiedTranscript(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded).toBeDefined();
  });

  it('Generated PDF has exactly 2 pages', async () => {
    const result = await fillIlCertifiedTranscript(sampleInput);
    const loaded = await PDFDocument.load(result);
    expect(loaded.getPageCount()).toBe(2);  // IL-specific: always 2 pages
  });
});
```

### Export Route Test (`tests/routes/export.test.ts` — append new describe block)

Follows the f700/a1131 pattern in the existing file:

```typescript
describe('GET /api/export/il-pdf/:weekId - STATE-08', () => {
  it('should return 400 for non-IL project', async () => { ... }); // state='TX'
  it('should return PDF for IL project', async () => { ... });     // state='IL', content-type: application/pdf
  it('should return 403 for unauthorized access', async () => { ... });
  it('should return 404 for non-existent week', async () => { ... });
  it('should return 401 when not authenticated', async () => { ... });
});
```

For the IL project helper, use `state: 'IL'` in `createProject`. No extra IL-specific project fields are required for the generator (FEIN defaults to empty string).

---

## Wave Structure Recommendation

### Wave 0 — Test Stubs (failing tests first)

1. Create `tests/services/ilPdfGenerator.test.ts` with 3 failing tests (import will fail until generator exists)
2. Add IL-specific describe block to `tests/routes/export.test.ts` (5 failing tests)

### Wave 1 — Migration + Schema

1. Create `src/server/db/migrations/0026_il_idol_submission.sql`
2. Register in `meta/_journal.json` (idx: 22)
3. Add `ilIdolSubmittedAt` to `schema.ts` payrollWeeks table definition
4. Add `setIlIdolSubmitted` service function to `payrollService.ts`

### Wave 2 — IL PDF Generator

1. Create `src/server/services/ilPdfGenerator.ts` with `IlPdfInput` type and `fillIlCertifiedTranscript()` function
2. Tests in Wave 0 should now pass (3 generator tests green)

### Wave 3 — Export Route

1. Add `GET /api/export/il-pdf/:weekId` to `src/server/routes/export.ts`
2. Add `PATCH /api/payroll/weeks/:id/il-submit` to `src/server/routes/payroll.ts`
3. Export route tests should now pass (5 route tests green)

### Wave 4 — Frontend Modal

1. Update `PayrollWeek` interface in `PayrollWeekDetailPage.tsx` to add `ilIdolSubmittedAt`
2. Add IL modal state variables (`showIlIdolModal`, `ilIdolStep`, `ilIdolSubmitting`)
3. Add `handleIlMarkSubmitted()` function (mirrors `handleNyMarkSubmitted`)
4. Replace disabled placeholder button at line 952 with active IL IDOL Submission button
5. Replace "Coming in Phase 43" status panel at line 1315 with live IL IDOL status panel
6. Add IL 2-step modal JSX (after closing tag of NY MPWR modal at line 2145)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/services/ilPdfGenerator.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-08 | Generator returns valid 2-page PDF | unit | `npx vitest run tests/services/ilPdfGenerator.test.ts` | Wave 0 |
| STATE-11 | Export route returns 400 for non-IL | integration | `npx vitest run tests/routes/export.test.ts` | Exists (append) |
| STATE-11 | Export route returns PDF for IL project | integration | `npx vitest run tests/routes/export.test.ts` | Exists (append) |
| STATE-11 | Export route returns 403 for cross-user | integration | `npx vitest run tests/routes/export.test.ts` | Exists (append) |
| NFR-03 | assertProjectAccess before state gate | integration | `npx vitest run tests/routes/export.test.ts` | Exists (append) |

### Wave 0 Gaps

- [ ] `tests/services/ilPdfGenerator.test.ts` — covers STATE-08 (3 tests: non-empty, round-trip, page count === 2)
- [ ] New describe block in `tests/routes/export.test.ts` — covers STATE-08/STATE-11/NFR-03 (5 tests)

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all libraries already installed, no new tools or services required).

---

## Open Questions

1. **`contractingAgency` field on project**
   - What we know: STATE-08 requires "contracting agency" in the PDF header. Phase 42 may or may not have added this to the `projects` table.
   - What's unclear: The `0025_il_schema.sql` migration only added worker demographics + `non_pw_hours`. No project-level IL fields are visible in that file.
   - Recommendation: Planner reads `schema.ts` projects table definition to verify. If absent, use `project.county + ', ' + project.state` as a fallback or leave empty string. Do NOT add a new project field in Phase 43 unless already present.

2. **IL IDOL portal URL**
   - What we know: STATE-11 mentions "portal URL" in checklist.
   - What's unclear: IDOL's self-service portal URL is https://idol2.illinois.gov but may have changed. The existing WA modal hardcodes `https://secure.lni.wa.gov/pwia/`.
   - Recommendation: Use `https://idol2.illinois.gov` as the link. Add a note in source code comment to verify URL at execution time.

3. **OT hours on IL form**
   - What we know: The IL Certified Transcript in STATE-08 specifies "daily hours Mon–Sun distinguishing PW vs non-PW" — not ST vs OT.
   - What's unclear: Whether overtime hours should be shown separately or combined into PW total.
   - Recommendation: Show PW hours as ST hours only (no OT row). The IL form tracks PW/nonPW distinction, not ST/OT. Overtime is a pay calculation, not a reporting column on the IL transcript. This differs from WH-347 and PW-12 which have separate ST/OT rows.

4. **Multi-worker overflow pages**
   - What we know: PW-12 adds new pages when `y < 150` and repeats the header.
   - What's unclear: Should IL overflow pages repeat the header on page 1 overflow (before page 2)?
   - Recommendation: Yes — same pattern as PW-12. If workers overflow page 1, add continuation page(s) with header repeated, then always add a final dedicated affidavit page.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `src/server/services/pw12Generator.ts` — confirmed PDFDocument.create() pattern, Letter dimensions, MARGIN=36, DrawCtx pattern, fmtDollar/fmtHours helpers
- Direct inspection of `src/server/db/schema.ts` lines 190–208 — confirmed `ilIdolSubmittedAt` is absent
- Direct inspection of `src/server/db/migrations/0025_il_schema.sql` — confirmed Phase 42 only added worker demographics + `non_pw_hours`, no `il_idol_submitted_at`
- Direct inspection of `src/server/db/migrations/meta/_journal.json` — confirmed next idx = 22
- Direct inspection of `src/server/routes/export.ts` lines 888–991 — confirmed exact route pattern (assertProjectAccess order, state gate, getPayrollEntriesWithWorkerDetails, PDF response headers)
- Direct inspection of `src/server/routes/payroll.ts` lines 528–566 — confirmed NY MPWR submit route pattern for IL submit route
- Direct inspection of `src/client/pages/PayrollWeekDetailPage.tsx` — confirmed Phase 42 placeholder locations (lines 952–961, 1315–1325), NY MPWR 3-step modal structure (lines 1963–2145)
- Direct inspection of `tests/services/pw12Generator.test.ts` — confirmed 3-test pattern for generator tests
- Direct inspection of `tests/routes/export.test.ts` — confirmed 5-test pattern for state-gated route tests
- Direct inspection of `src/server/services/payrollService.ts` — confirmed `getPayrollEntriesWithWorkerDetails` returns `nonPwHours`, `workerSsnLast4`, `workerAddress`, all fringe fields

### Secondary (MEDIUM confidence)
- IDOL portal URL (https://idol2.illinois.gov) — from prior knowledge, not verified against live site in this research session
- IL Certified Transcript form layout — derived from STATE-08 requirements text; no official IDOL PDF template was located (Illinois does not mandate a specific PDF form, only the data elements)

---

## Metadata

**Confidence breakdown:**
- Migration required: HIGH — confirmed by schema inspection
- Generator pattern: HIGH — directly modeled on inspected pw12Generator.ts
- Route pattern: HIGH — directly modeled on inspected export.ts pw12 route
- Modal pattern: HIGH — directly modeled on inspected NY MPWR modal
- Test pattern: HIGH — directly modeled on inspected pw12Generator.test.ts and export.test.ts
- F flag logic: MEDIUM — based on STATE-08 text + absence of fund-type field in data model
- IL PDF layout dimensions: HIGH (Letter, MARGIN=36) + MEDIUM (column x positions — approximated for dense form)
- IDOL portal URL: MEDIUM — requires verification

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable platform; only IDOL URL may change)
