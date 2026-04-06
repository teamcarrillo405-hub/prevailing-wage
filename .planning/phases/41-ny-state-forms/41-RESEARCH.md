# Phase 41: NY State Forms - Research

**Researched:** 2026-04-02
**Domain:** PDF generation (pdf-lib), XML generation (xmlbuilder2), multi-step modal UI (React), Express route pattern
**Confidence:** HIGH — all findings grounded in direct codebase inspection + existing `.planning/research/state-forms-research.md` which was compiled from official NYSDOL sources

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATE-02 | NY PW-12 PDF generator: pdf-lib programmatic layout; header fields (contractor name/FEIN/address, week-ending, project/contract number); per-employee rows (name + last4 SSN, withholdings, classification ST/OT, daily hours Mon–Sun, total hours, rate of pay, gross earned, FICA/withholding/other deductions, net wages); Statement of Compliance with fringe benefit sub-clauses (b) and (c). | pdf-lib pattern confirmed from wh347Generator.ts; PW-12 field layout documented in state-forms-research.md; no template PDF exists — must build programmatic layout |
| STATE-03 | NY MPWR XML generator: xmlbuilder2 pattern; NYSDOL MPWR Bulk Upload XSD schema; PRC Number, NYS Contractor Registration Number, nysRegisteredApprentice boolean, supplement type rates (Health/Welfare, Vacation/Holiday, Apprenticeship/Training, Pension, Other) with ST/OT hourly rates, dateOfBirth alternative to SSN, 000000+last4 placeholder. | xmlbuilder2 pattern confirmed from ecprXmlGenerator.ts; MPWR XSD element structure documented in state-forms-research.md §3 |
| STATE-05 | NY MPWR submission modal: 3-step modal on PayrollWeekDetailPage (NY-gated, `project.state === 'NY'`). Step 1: collect/persist PRC Number + NYS Contractor Reg Number. Step 2: download XML + PW-12 PDF. Step 3: MPWR portal upload checklist. "Mark as Submitted to NY MPWR" button. | Multi-step modal pattern confirmed from WA CPR modal in PayrollWeekDetailPage.tsx; `setNyMpwrSubmitted` service function does not yet exist — needs to be created following setCaEcprSubmitted pattern; nyMpwrSubmittedAt column missing from payrollWeeks schema (migration needed) |
| NFR-03 | All new routes apply `assertProjectAccess` before any data access. | Confirmed — all existing export routes call assertProjectAccess immediately after resolving projectId from weekId |
</phase_requirements>

---

## Summary

Phase 41 adds the final NY-specific output layer: a PW-12 PDF for offline records and an MPWR-compliant XML for portal upload, surfaced through a 3-step submission modal on PayrollWeekDetailPage. The database schema additions (nyprcNumber, nysContractorRegNumber, nysRegisteredApprentice) were completed in Phase 40. Phase 41 is generation + UI only, with one exception: a `nyMpwrSubmittedAt` column is missing from `payrollWeeks` — it must be added in a new migration (idx 20, following the 0023_ny_schema pattern).

**PDF approach:** The PW-12 has no official fillable PDF template available for programmatic use. The implementation must draw the form layout programmatically using pdf-lib's `drawText` / `drawRectangle` / `drawLine` primitives, similar to how wh347Generator.ts overlays text onto the WH-347 flat PDF template. However, unlike WH-347, there is no asset template — the PW-12 must create a blank page and draw column headers, borders, and data all from scratch. Page dimensions should match WH-347's landscape orientation (792x612 pt) or use a standard letter portrait (612x792 pt) depending on how the PW-12 form reads.

**XML approach:** The MPWR XML generator follows the same xmlbuilder2 pattern as ecprXmlGenerator.ts. The MPWR schema uses plain unqualified XML elements (no namespace prefix) and a specific element hierarchy: `ProjectRollup > employeeWorkWeeks > employeeWorkWeek > employee + workWeeks`. Each `workWeek` contains daily `day[]` elements, `deductions`, and `supplementalPayments`.

**Primary recommendation:** Build the MPWR XML generator first (pure TypeScript, easily unit-tested), then the PW-12 PDF generator (visual coordinates require iteration), then wire both into export routes and the 3-step modal.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | already installed | PW-12 PDF generation: draw lines, text, rectangles | Same library used for WH-347, A-1-131, F700 — zero new dependencies |
| xmlbuilder2 | already installed | MPWR XML generation | Same library used for CA eCPR and WA CPR XML generators |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| StandardFonts.Helvetica | built into pdf-lib | Body text on PW-12 | Same as WH-347 — Helvetica and HelveticaBold already embedded |
| node:crypto (randomUUID) | built-in | No new IDs needed this phase | N/A — existing pattern if needed |

### No New Packages Needed
All required libraries are already installed. Phase 41 adds no new npm dependencies.

---

## Architecture Patterns

### Recommended File Structure

```
src/server/services/
├── pw12Generator.ts         # NEW — PW-12 PDF programmatic generator
├── mpwrXmlGenerator.ts      # NEW — MPWR XML generator (xmlbuilder2)
src/server/routes/
├── export.ts                # MODIFY — add GET /api/export/pw12/:weekId and GET /api/export/ny-mpwr-xml/:weekId
├── payroll.ts               # MODIFY — add PATCH /api/payroll/weeks/:id/ny-submit
src/server/services/
├── payrollService.ts        # MODIFY — add setNyMpwrSubmitted / clearNyMpwrSubmitted
src/server/db/
├── schema.ts                # MODIFY — add nyMpwrSubmittedAt to payrollWeeks
├── migrations/
│   └── 0024_ny_mpwr_submission.sql  # NEW — idx 20
tests/services/
├── pw12Generator.test.ts    # NEW — unit tests for PDF generation (field layout)
├── mpwrXmlGenerator.test.ts # NEW — unit tests for XML structure
tests/routes/
├── export.test.ts           # MODIFY — add NY route tests
```

### Pattern 1: Programmatic PDF — No Template Asset

The WH-347 generator loads a flat PDF template (`readFileSync(templatePath)`) and overlays text. The PW-12 does NOT have a usable flat PDF template from NYSDOL. The generator must create a blank document:

```typescript
// Source: pdf-lib API — same package as wh347Generator.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function fillPw12(data: Pw12Data): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();  // NOT PDFDocument.load()
  const page = pdfDoc.addPage([612, 792]);    // letter portrait
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Draw table borders, headers, data — all programmatic
  page.drawLine({ start: { x: 36, y: 700 }, end: { x: 576, y: 700 }, thickness: 1, color: rgb(0,0,0) });
  page.drawText('WEEKLY PAYROLL', { x: 36, y: 750, size: 12, font: boldFont, color: rgb(0,0,0) });
  // ... field placements using PW-12 column layout from state-forms-research.md
  return pdfDoc.save();
}
```

Key difference from WH-347 pattern: `PDFDocument.create()` instead of `PDFDocument.load(templateBytes)`. Route handler returns `Buffer.from(filledPdf)` — same streaming pattern.

### Pattern 2: XML Generator — MPWR Schema

```typescript
// Source: ecprXmlGenerator.ts pattern + MPWR XSD (state-forms-research.md §3)
import { create } from 'xmlbuilder2';

export function generateMpwrXml(data: MpwrData): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('ProjectRollup');                    // No namespace — plain elements

  root.ele('prcNumber').txt(data.prcNumber);
  root.ele('weekEndingDate').txt(data.weekEndingDate);  // YYYY-MM-DD

  const eww = root.ele('employeeWorkWeeks');
  for (const emp of data.employees) {
    const ewwEl = eww.ele('employeeWorkWeek');
    const empEl = ewwEl.ele('employee');
    empEl.ele('firstName').txt(emp.firstName);
    empEl.ele('lastName').txt(emp.lastName);
    // ssnLast4 OR dateOfBirth — prefer ssnLast4 when available
    if (emp.ssnLast4) {
      empEl.ele('ssnLast4').txt(emp.ssnLast4);
    } else {
      empEl.ele('dateOfBirth').txt(emp.dateOfBirth ?? '');
    }
    empEl.ele('nysRegisteredApprentice').txt(emp.nysRegisteredApprentice ? 'true' : 'false');
    const addr = empEl.ele('address');
    addr.ele('address1').txt(emp.address.street);
    addr.ele('city').txt(emp.address.city);
    addr.ele('state').txt(emp.address.state);
    addr.ele('postalCode').txt(emp.address.zip);

    ewwEl.ele('deductionGrossEarnings').txt(emp.grossEarnings.toFixed(2));
    ewwEl.ele('netWages').txt(emp.netWages.toFixed(2));

    const wws = ewwEl.ele('workWeeks');
    for (const ww of emp.workWeeks) {
      const wwEl = wws.ele('workWeek');
      wwEl.ele('workCategory').txt(ww.workCategory);
      wwEl.ele('stHourlyRate').txt(ww.stHourlyRate.toFixed(2));
      wwEl.ele('otHourlyRate').txt(ww.otHourlyRate.toFixed(2));

      const daysEl = wwEl.ele('days');
      for (const day of ww.days) {
        const dayEl = daysEl.ele('day');
        dayEl.ele('day').txt(day.date);
        dayEl.ele('standardTimeHours').txt(day.stHours.toFixed(2));
        dayEl.ele('overTimeHours').txt(day.otHours.toFixed(2));
      }

      // Deductions (max 10)
      if (ww.deductions.length > 0) {
        const deducEl = wwEl.ele('deductions');
        for (const d of ww.deductions) {
          const dEl = deducEl.ele('deduction');
          dEl.ele('type').txt(d.type);
          dEl.ele('amount').txt(d.amount.toFixed(2));
        }
      }

      // Supplements (Health/Welfare, Vacation/Holiday, Apprenticeship/Training, Pension, Other)
      if (ww.supplements.length > 0) {
        const suppEl = wwEl.ele('supplementalPayments');
        for (const s of ww.supplements) {
          const sEl = suppEl.ele('supplementalPayment');
          sEl.ele('type').txt(s.type);
          if (s.type === 'Other Benefit (Type)') sEl.ele('explanation').txt(s.explanation ?? '');
          sEl.ele('standardHourlyRate').txt(s.standardHourlyRate.toFixed(2));
          sEl.ele('overtimeHourlyRate').txt(s.overtimeHourlyRate.toFixed(2));
        }
      }
    }
  }
  return root.end({ prettyPrint: true });
}
```

### Pattern 3: Export Routes — NY-Gated

Follow the exact CA A-1-131 and WA CPR XML route patterns from export.ts:

```typescript
// GET /api/export/pw12/:weekId — NY-gated, follows a1131 pattern
router.get('/pw12/:weekId', async (req, res) => {
  const week = await getPayrollWeek(weekId);
  if (!week) { res.status(404).json({ error: 'Payroll week not found' }); return; }

  const db = getDb();
  let project: Project;
  try { project = await assertProjectAccess(db, week.projectId, userId); }
  catch (err: any) { res.status(err.status ?? 500).json({ error: err.message }); return; }

  // State gate — PW-12 is NY-only
  if (project.state?.toUpperCase() !== 'NY') {
    res.status(400).json({ error: 'PW-12 is only available for New York projects' });
    return;
  }

  const entries = await getPayrollEntriesWithWorkerDetails(weekId);
  // ... map entries, generate PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="pw12-${week.payrollNumber}.pdf"`);
  res.end(Buffer.from(filledPdf));

  // Audit log — ny_pw12.downloaded (AUDIT-03)
  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({ ... action: 'ny_pw12.downloaded' ... });
  } catch (auditErr) { console.error('[audit]', auditErr); }
});
```

### Pattern 4: NY Submit Route — Follows CA/WA Pattern

```typescript
// PATCH /api/payroll/weeks/:id/ny-submit — toggles nyMpwrSubmittedAt
// payrollService.ts: setNyMpwrSubmitted / clearNyMpwrSubmitted
// Audit action: 'agency_submission.created' with meta: { agency: 'NY_MPWR' }
```

### Pattern 5: NY Submission Modal — 3-Step State Machine

Follow the WA CPR modal pattern in PayrollWeekDetailPage.tsx (showWaCprModal + waCprStep):

```typescript
// State variables following WA pattern:
const [showNyMpwrModal, setShowNyMpwrModal] = useState(false);
const [nyMpwrStep, setNyMpwrStep] = useState(1);
const [nyPrcNumber, setNyPrcNumber] = useState('');
const [nysContractorRegNumber, setNysContractorRegNumber] = useState('');
const isNY = projectData?.data?.project?.state?.toUpperCase() === 'NY';

// Buttons in action bar:
{isNY && weekId && (
  <Button onClick={() => { setNyMpwrStep(1); setShowNyMpwrModal(true); }}>
    NY MPWR Submission
  </Button>
)}

// Step 1: Collect PRC Number + NYS Contractor Reg Number
// Step 2: Generate & download MPWR XML + PW-12 PDF
// Step 3: Upload checklist (portal URL, 30-day deadline reminder)
// Mark as submitted button: calls PATCH /api/payroll/weeks/:id/ny-submit
```

### Anti-Patterns to Avoid

- **Drawing text without maxWidth on PW-12:** Long classification names will overflow column bounds. Set `maxWidth` on every drawText call, matching the wh347Generator pattern.
- **Using PDFDocument.load() for PW-12:** No template PDF exists. Use `PDFDocument.create()`.
- **Omitting NY state gate on export routes:** The `project.state?.toUpperCase() !== 'NY'` check is mandatory per NFR-03/pattern. Note: Phase 40 confirmed NY uses `stateValue?.toUpperCase() === 'NY'` — match exactly.
- **Emitting namespace prefix on MPWR XML:** The MPWR XSD uses plain unqualified elements (no `xmlns:MPWR:` prefix), unlike CA eCPR which uses `CPR:` namespace. Do not add namespace attributes.
- **Providing both ssnLast4 AND dateOfBirth:** The MPWR schema is conditional — provide one or the other, prefer `ssnLast4` when available.
- **Missing `-->  statement-breakpoint`:** CLAUDE.md requires exactly one space before `statement-breakpoint` in migration files.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML serialization | Custom string concatenation | xmlbuilder2 (already installed) | Auto-escapes special chars; matching pattern for CA eCPR and WA CPR |
| PDF text layout | Custom canvas/SVG | pdf-lib (already installed) | Already used for WH-347, A-1-131, F700 — team knows the API |
| SSN placeholder format | Custom logic | `resolveEcprSsn` from export.ts | Already exported and tested; reuse or follow same pattern |
| State gate check | Inline string comparison | Follow `project.state?.toUpperCase() !== 'NY'` pattern | Matches Phase 40 decision for `isNY` exact pattern |

---

## Migration State

**Current highest migration:** idx 19, tag `0023_ny_schema` (Phase 40 — nyprcNumber, nysContractorRegNumber, projectSettings, nysRegisteredApprentice).

**What Phase 40 added to schema:**
- `projects.nyprcNumber` (text, nullable)
- `projects.nysContractorRegNumber` (text, nullable)
- `projects.projectSettings` (text, nullable)
- `workers.nysRegisteredApprentice` (integer boolean, NOT NULL, default 0)

**What is MISSING for Phase 41:**
- `payrollWeeks.nyMpwrSubmittedAt` (text, nullable) — needed for the NY MPWR submission tracking, following `caEcprSubmittedAt` and `waLniSubmittedAt` pattern.

**Required new migration:** `0024_ny_mpwr_submission.sql` at idx 20.

```sql
ALTER TABLE payroll_weeks ADD COLUMN ny_mpwr_submitted_at TEXT;
```

No `-->  statement-breakpoint` needed for single-statement migrations, but must register in `meta/_journal.json` at idx 20.

---

## Data Available from `getPayrollEntriesWithWorkerDetails`

After Phase 39 changes, this function returns:

| Field | Available | Notes |
|-------|-----------|-------|
| `entry.*` | Yes | All payroll_entries columns including Mon–Sun ST/OT/DT, grossWages, deductions, netPay, fringeHealthWelfare, fringePension, fringeVacation, fringeTraining |
| `workerName` | Yes | Full name string |
| `workerSsnLast4` | Yes | For MPWR XML ssnLast4 field |
| `workerSsnEncrypted` | Yes | Not needed for NY (NY uses last4 only, no full SSN) |
| `workerAddress` | Yes | Concatenated from structured fields: `addressStreet, addressCity, addressState, addressZip` (Phase 39 WORKER-01) |
| `tradeDescription` | Yes | COALESCE with override classification (Phase 39 WORKER-04) |
| `laborType` | Yes | journeyworker / apprentice / foreman |
| `programName` | Yes | Apprenticeship program name |
| `nysRegisteredApprentice` | **NOT in this query** | Must JOIN `workers` separately or add to select |

**Critical gap:** `nysRegisteredApprentice` is on the `workers` table but `getPayrollEntriesWithWorkerDetails` does not currently select it. The MPWR XML generator needs it. Two options:
1. Add `workers.nysRegisteredApprentice` to the existing select in `getPayrollEntriesWithWorkerDetails`.
2. Create a separate query function in mpwrXmlGenerator.ts.

**Recommendation:** Add `nysRegisteredApprentice: workers.nysRegisteredApprentice` to the existing select — it's a simple additive change that benefits future callers.

**Worker address parsing for MPWR:** After Phase 39, `workerAddress` is a SQL-concatenated string in `"street, city, state zip"` format. The existing CA eCPR and WA CPR routes parse this string with `split(',')`. The MPWR XML generator should follow the same address-parsing pattern.

**Fringe fields for supplements:** `fringeHealthWelfare`, `fringePension`, `fringeVacation`, `fringeTraining` are on `payroll_entries` (added in Phase 29). These map directly to MPWR supplementalPayment types. However, they represent total fringe paid (not hourly rates). To get hourly supplement rates, divide by total hours. If null (non-NY projects may not have entered them), default to 0.

---

## PW-12 Field-to-Data Mapping

| PW-12 Field | Source | Notes |
|-------------|--------|-------|
| Name of Contractor | `project.name` | Same pattern as WH-347 |
| FEIN | `project.contractorFein` | Already on projects table |
| Address | Concatenate `project.county + ', ' + project.state` | Same as WH-347; no street address on project |
| Week Ending Date | `week.weekEndingDate` → formatDate() | MM/DD/YYYY format |
| Project and Location | `project.name + ', ' + project.county` | |
| Project or Contract Number | `project.nyprcNumber` | Phase 40 column |
| Employee Name | `row.workerName` | |
| Last 4 SSN | `row.workerSsnLast4` | Display as "XXX-XX-XXXX" or just last 4 |
| No. of Withholdings | 0 (user does not enter this) | Default zero |
| Work Classification | `row.tradeDescription` + "ST"/"OT" label | Two rows per worker |
| Daily Hours Mon–Sun | `entry.monSt` through `entry.sunSt`, `entry.monOt` through `entry.sunOt` | ST row and OT row |
| Total Hours | Sum of daily ST / Sum of daily OT | |
| Rate of Pay | `entry.baseRateSnapshot` | ST rate; OT rate = base * 1.5 |
| Gross Amount Earned | `entry.grossWages` | Nullable — use 0 if null |
| FICA | 0 (not stored) | User doesn't enter breakdown |
| Withholding Tax | 0 (not stored) | User doesn't enter breakdown |
| Other Deductions | `entry.deductions` | Total deductions |
| Net Wages | `entry.netPay` | Nullable — use 0 if null |

---

## Common Pitfalls

### Pitfall 1: PW-12 Page Dimensions
**What goes wrong:** Choosing wrong page size causes text to be cut off or misaligned with printed form expectations.
**Why it happens:** pdf-lib supports any page size; PW-12 form is typically letter-size portrait (612x792 pt) or landscape.
**How to avoid:** The PW-12 is a portrait form (unlike landscape WH-347 at 792x612). Use `pdfDoc.addPage([612, 792])`. Origin is bottom-left; first row of data starts near y=700 and decrements downward.
**Warning signs:** Test by opening generated PDF — if fields appear in wrong position, measure actual coordinate with grid overlay.

### Pitfall 2: MPWR `workCategory` Must Match Portal Dropdown Exactly
**What goes wrong:** An XML that validates against the XSD may still be rejected by the portal if `workCategory` values don't match the portal's enumeration.
**Why it happens:** NYSDOL MPWR portal has a dropdown of recognized classification names; the XSD only enforces string length (max 300 chars), not the specific values.
**How to avoid:** Use `row.tradeDescription` directly from the wage determination. Requirements note this is OUT OF SCOPE for v4.0 (see STATE-02 out-of-scope note in REQUIREMENTS.md). The XML should use `row.tradeDescription` as-is; the submission modal Step 3 checklist should include a manual verification reminder.
**Warning signs:** Portal returns upload error referencing unrecognized work category.

### Pitfall 3: `nysRegisteredApprentice` Not Returned by Existing Query
**What goes wrong:** MPWR XML emits `<nysRegisteredApprentice>false</nysRegisteredApprentice>` for all workers even when workers have it set to true.
**Why it happens:** `getPayrollEntriesWithWorkerDetails` does not currently select `workers.nysRegisteredApprentice`.
**How to avoid:** Add `nysRegisteredApprentice: workers.nysRegisteredApprentice` to the select object in `getPayrollEntriesWithWorkerDetails`. This is a backwards-compatible additive change.
**Warning signs:** Unit test using a worker with `nysRegisteredApprentice=true` produces `false` in XML.

### Pitfall 4: Missing `nyMpwrSubmittedAt` Column in Schema
**What goes wrong:** `setNyMpwrSubmitted` service function fails at runtime with "no such column" error.
**Why it happens:** Phase 40 added `nyprcNumber`, `nysContractorRegNumber`, `projectSettings`, and `nysRegisteredApprentice` — but did NOT add `nyMpwrSubmittedAt` to `payrollWeeks`.
**How to avoid:** Migration `0024_ny_mpwr_submission.sql` at idx 20 must be created and registered before writing the service function.
**Warning signs:** SQLite error on PATCH /api/payroll/weeks/:id/ny-submit.

### Pitfall 5: Modal State Leak on Close
**What goes wrong:** Opening the NY MPWR modal after a previous failed download leaves stale state (prcNumber field empty, step reset needed).
**Why it happens:** WA CPR modal resets step to 1 on close: `setShowWaCprModal(false); setWaCprStep(1)`. Omitting this causes the user to see a stale step on reopen.
**How to avoid:** All modal close/cancel handlers must reset both `setShowNyMpwrModal(false)` and `setNyMpwrStep(1)`.

### Pitfall 6: `-->  statement-breakpoint` Single Space
**What goes wrong:** Migration fails at runtime or is silently skipped.
**Why it happens:** CLAUDE.md requires exactly `-->  statement-breakpoint` (one space before `statement-breakpoint`). Extra or missing spaces break Drizzle parsing.
**How to avoid:** For single-statement migrations, no breakpoint is needed. For multi-statement migrations, include exactly `-->  statement-breakpoint` between statements.

---

## Code Examples

### Routing — NY MPWR XML (verified from ecpr-xml pattern)

```typescript
// Source: src/server/routes/export.ts — ecpr-xml route (lines 528–702)
router.get('/ny-mpwr-xml/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;
  const week = await getPayrollWeek(weekId);
  if (!week) { res.status(404).json({ error: 'Payroll week not found' }); return; }

  const db = getDb();
  let project: Project;
  try { project = await assertProjectAccess(db, week.projectId, userId); }
  catch (err: any) { res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' }); return; }

  if (project.state?.toUpperCase() !== 'NY') {
    res.status(400).json({ error: 'NY MPWR XML export is only available for New York projects' });
    return;
  }

  const prcNumber = project.nyprcNumber || '';
  if (!prcNumber) {
    res.status(400).json({ error: 'PRC Number is required for MPWR XML export' });
    return;
  }

  const entries = await getPayrollEntriesWithWorkerDetails(weekId);
  const xml = generateMpwrXml({ ... });
  const filename = `mpwr-${week.payrollNumber}-${week.weekEndingDate}.xml`;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);

  try {
    const { insertAuditLog } = await import('../services/auditService.js');
    await insertAuditLog({ ..., action: 'ny_mpwr_xml.downloaded', meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'xml' } });
  } catch (auditErr) { console.error('[audit]', auditErr); }
});
```

### Service — setNyMpwrSubmitted (verified from setCaEcprSubmitted pattern)

```typescript
// Source: src/server/services/payrollService.ts lines 479–486
export async function setNyMpwrSubmitted(weekId: string): Promise<{ nyMpwrSubmittedAt: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.update(payrollWeeks)
    .set({ nyMpwrSubmittedAt: now, updatedAt: now })
    .where(eq(payrollWeeks.id, weekId));
  return { nyMpwrSubmittedAt: now };
}
```

### Migration — 0024_ny_mpwr_submission.sql

```sql
ALTER TABLE payroll_weeks ADD COLUMN ny_mpwr_submitted_at TEXT;
```

### NY MPWR XML SSN Handling

MPWR uses `ssnLast4` (not a 000000+last4 placeholder like CA eCPR). The MPWR schema provides `ssnLast4` OR `dateOfBirth`. Since `workers.ssnLast4` is stored in the database, use it directly. No decryption needed. If `ssnLast4` is null, omit the element and emit `dateOfBirth` if available; if neither is available, omit both (the portal will reject, which is the correct behavior — do not fabricate a placeholder).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 41 is pure code/service additions. No new external tools, databases, or CLI utilities are required. pdf-lib and xmlbuilder2 are already installed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose tests/services/mpwrXmlGenerator.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-02 | PW-12 PDF generator emits valid PDF buffer with correct header text and worker rows | unit | `npm test -- tests/services/pw12Generator.test.ts` | No — Wave 0 |
| STATE-02 | PW-12 PDF includes ST and OT rows per worker | unit | (same file) | No — Wave 0 |
| STATE-03 | MPWR XML has `<ProjectRollup>` root element (no namespace) | unit | `npm test -- tests/services/mpwrXmlGenerator.test.ts` | No — Wave 0 |
| STATE-03 | MPWR XML emits `<ssnLast4>` when available | unit | (same file) | No — Wave 0 |
| STATE-03 | MPWR XML emits `<nysRegisteredApprentice>true</nysRegisteredApprentice>` when flag set | unit | (same file) | No — Wave 0 |
| STATE-03 | MPWR XML emits supplementalPayments for fringe fields | unit | (same file) | No — Wave 0 |
| STATE-05 | GET /api/export/pw12/:weekId returns 400 for non-NY project | integration | `npm test -- tests/routes/export.test.ts` | Partial — file exists, add test |
| STATE-05 | GET /api/export/ny-mpwr-xml/:weekId returns 400 for non-NY project | integration | `npm test -- tests/routes/export.test.ts` | Partial — file exists, add test |
| STATE-05 | PATCH /api/payroll/weeks/:id/ny-submit sets nyMpwrSubmittedAt | integration | `npm test -- tests/routes/payroll.test.ts` | Partial — file exists, add test |
| NFR-03 | All NY export routes return 403 without project access | integration | (same export.test.ts) | Partial |

### Per-Requirement Validation Methods

**STATE-02 (PW-12 PDF):** Pure unit test — call `fillPw12(sampleData)`, assert result is a Uint8Array with length > 0, and that `PDFDocument.load(result)` succeeds (round-trip). Assert page count is 1 for 1 worker, multi-page for >N workers. Visual verification: open generated PDF and confirm field positions.

**STATE-03 (MPWR XML):** Pure unit test — call `generateMpwrXml(sampleData)`, assert XML string contains `<ProjectRollup>`, `<prcNumber>`, `<workCategory>`, `<nysRegisteredApprentice>`, `<supplementalPayment>`. Assert no namespace prefix (`xmlns:` not present). Assert `ssnLast4` vs `dateOfBirth` conditional logic.

**STATE-05 (Submission Modal):** Integration tests for the route; UI testing is manual (confirm 3 steps render, PRC persists to project, Mark as Submitted sets nyMpwrSubmittedAt badge).

**NFR-03:** Integration test asserts 401/403 when `assertProjectAccess` would fail (wrong user or no auth) — follows existing export.test.ts pattern for A-1-131 and WA routes.

### Sampling Rate
- **Per task commit:** `npm test -- tests/services/mpwrXmlGenerator.test.ts tests/services/pw12Generator.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work 41`

### Wave 0 Gaps
- [ ] `tests/services/mpwrXmlGenerator.test.ts` — covers STATE-03 XML structure
- [ ] `tests/services/pw12Generator.test.ts` — covers STATE-02 PDF generation

*(Existing tests/routes/export.test.ts and tests/routes/payroll.test.ts exist and will be extended — no new files needed for route tests.)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies To Phase 41 |
|-----------|---------------------|
| NEVER hard-delete projects or payroll weeks | Not applicable (no deletes in this phase) |
| Amendments must create new payrollWeeks rows | Not applicable |
| Server-side edit lock on submitted weeks | NY submit route: no submittedAt guard (same as CA/WA — independent tracking per D-05) |
| Migrations are plain SQL ALTER TABLE ADD COLUMN in src/server/db/migrations/ | YES — 0024_ny_mpwr_submission.sql |
| Always register in meta/_journal.json | YES — new migration must be registered at idx 20 |
| Next migration idx: highest is idx 19 (0023_ny_schema); next is idx 20 | CONFIRMED |
| Design tokens: all brand values via @theme tokens | YES — modal UI follows existing CA/WA modal styling |
| UI Primitives: Card, Button, Badge, PageHeader, EmptyState | YES — NY modal uses Button, Badge variants |
| React patterns: useRef for sync guards, Blob URL downloads | YES — download handlers in modal Step 2 |
| randomUUID from crypto (not uuid package) | YES — if any IDs generated in this phase |
| assertProjectAccess before any data access | YES — NFR-03, confirmed for all export routes |
| Dynamic import for auditService to avoid circular dependency | YES — best-effort audit log at end of each export handler |
| isNY uses stateValue?.toUpperCase() === 'NY' | YES — confirmed Phase 40 decision |

---

## Open Questions

1. **PW-12 page layout coordinates**
   - What we know: The PW-12 form is a portrait letter-size form; column positions are described in state-forms-research.md §2 but no pixel/point measurements exist (no template PDF to measure from).
   - What's unclear: Exact x/y coordinates for each column header and data cell must be determined empirically during implementation. Unlike WH-347 which had a measurable grid PDF, PW-12 must be designed from scratch.
   - Recommendation: During implementation, generate a draft PDF with a labeled grid (draw lines every 50 pts), measure visually, then finalize coordinates. Budget one iteration for coordinate calibration.

2. **MPWR `workCategory` value matching**
   - What we know: REQUIREMENTS.md explicitly marks this as OUT OF SCOPE for v4.0 ("NY MPWR workCategory dropdown value resolution (MPWR portal requires exact classification name match; deferred until official value list is obtained)").
   - What's unclear: The portal may reject XML with unrecognized workCategory values.
   - Recommendation: Use `row.tradeDescription` as-is. Include a warning note in the Step 3 modal checklist that the contractor should verify work category names match the portal's dropdown. Do not block generation.

3. **Multi-worker-entry-per-week aggregation for MPWR**
   - What we know: A worker may have multiple `payroll_entries` rows in a week if they worked under multiple classifications (Phase 39 WORKER-04). Each `payroll_entries` row has its own `classificationId`.
   - What's unclear: MPWR schema groups by employee, then has multiple `workWeek` elements per employee (one per classification). The MPWR generator must group entries by `workerId` and emit one `employeeWorkWeek` per worker with multiple `workWeek` children — matching how WA CPR XML groups using a `workerMap`.
   - Recommendation: Follow the `workerMap` pattern from export.ts WA CPR XML route (lines 767–800) exactly.

4. **Supplement rates (hourly vs. total)**
   - What we know: `fringeHealthWelfare`, `fringePension`, `fringeVacation`, `fringeTraining` on `payroll_entries` store total fringe paid for the week, not hourly rates.
   - What's unclear: MPWR `standardHourlyRate` and `overtimeHourlyRate` for supplements require hourly rates.
   - Recommendation: Derive hourly rate by dividing total supplement by total ST hours (for standardHourlyRate) and total OT hours (for overtimeHourlyRate). If total hours are zero, default to 0. If fringe fields are null (non-NY projects), default to 0.

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/state-forms-research.md` — NYSDOL PW-12 field layout, MPWR XSD element structure, submission requirements; compiled 2026-04-01 from official NYSDOL PDFs and Bulk Upload Formatting Guide
- `src/server/services/wh347Generator.ts` — pdf-lib coordinate system, PDFDocument.load() + drawText pattern, page dimensions, template asset pattern
- `src/server/services/ecprXmlGenerator.ts` — xmlbuilder2 pattern, SSN placeholder format, namespace approach
- `src/server/routes/export.ts` — assertProjectAccess ordering, state gate pattern, audit log pattern, ecpr_xml.downloaded action string, `getPayrollEntriesWithWorkerDetails` usage
- `src/server/routes/payroll.ts` — setCaEcprSubmitted / setWaLniSubmitted pattern, AgencySubmitSchema, audit log with agency meta
- `src/server/services/payrollService.ts` — setCaEcprSubmitted/clearCaEcprSubmitted implementation, getPayrollEntriesWithWorkerDetails select (Phase 39 address concatenation confirmed)
- `src/server/db/schema.ts` — confirmed nyprcNumber, nysContractorRegNumber, nysRegisteredApprentice present; confirmed nyMpwrSubmittedAt ABSENT
- `src/server/db/migrations/meta/_journal.json` — confirmed highest idx is 19 (0023_ny_schema); next migration must be idx 20
- `src/client/pages/PayrollWeekDetailPage.tsx` — isCA/isWA gating pattern, multi-step modal state machine pattern, submission button pattern

### Secondary (MEDIUM confidence)
- NYSDOL Electronic Payroll Submission page: https://dol.ny.gov/Electronic-Payroll — confirms MPWR portal mandatory as of Jan 1, 2026
- NYSDOL Certified Payroll Contractor User Guide (Jan 2026 PDF): https://dol.ny.gov/system/files/documents/2026/01/certified-payroll-contractor-user-guide_0.pdf — confirms XSD URL and sample XML URL

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; verified in package.json
- Architecture: HIGH — direct codebase inspection of every referenced file
- MPWR XML schema: HIGH — documented in state-forms-research.md §3 from official NYSDOL sources
- PW-12 field layout: HIGH for field names/types; MEDIUM for exact coordinate positions (empirical calibration required during implementation)
- Migration state: HIGH — confirmed by direct inspection of _journal.json and 0023_ny_schema.sql
- Missing nyMpwrSubmittedAt column: HIGH — confirmed by grep of schema.ts returning no matches

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable domain; MPWR schema changes possible if NYSDOL updates XSD)
