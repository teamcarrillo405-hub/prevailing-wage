# Phase 50: MA PDF Generator — Research

**Researched:** 2026-04-13
**Domain:** Massachusetts DLS Weekly Certified Payroll Report — pdf-lib programmatic PDF generation
**Confidence:** HIGH (code patterns verified from codebase; MA form fields confirmed from official sources and existing Phase 49 schema; certification language from official MA DLS documentation)

---

## Summary

Phase 50 replaces the 501 stub in `GET /api/export/ma-cpr/:weekId` with a working PDF generator. The generator must produce a two-page PDF: Page 1 is the MA DLS Weekly Certified Payroll Report with contractor header, project header, and per-worker rows; Page 2 is the Statement of Compliance with MA-specific certification language.

All infrastructure from Phase 49 is complete and confirmed: the database columns (`isWoman`, `isMinority`, `oshaTraining`, `checkNumber`, `allOtherHours`, `totalWeekGrossWages`, `maDlsProjectId`, `maSicCode`) are live in schema.ts, and `getPayrollEntriesWithWorkerDetails` already selects all six MA-specific fields. The export route already does `assertProjectAccess` before the MA state gate. The stub returns 501 and awaits the generator.

The implementation pattern is exactly `ilPdfGenerator.ts`: `PDFDocument.create()`, letter portrait (612×792 pt), pdf-lib origin at bottom-left, `StandardFonts.Helvetica`/`HelveticaBold`, helper functions for header/table/worker-row/compliance-page. MA adds three new drawing primitives not used in IL: a small checkbox square for OSHA 10 (use `drawRectangle` filled black — same as `wh347Generator.ts`), a "Y/N/—" display for woman/minority (text only), and a supplemental unemployment fringe sub-column in the fringe band.

**Primary recommendation:** Create `src/server/services/maPdfGenerator.ts` following the `ilPdfGenerator.ts` structure exactly. Wire it into the existing stub in `export.ts` (steps 4 onward after the 501). Add `maPdfGenerator.test.ts` following the `ecprXmlGenerator.test.ts` pattern.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MA-04 | MA DLS Weekly Certified Payroll PDF generator (`maPdfGenerator.ts`): contractor header (name, FEIN, address, license), project header (name, location, contract number, week ending), per-worker rows with OSHA 10 checkbox, woman/minority columns, supplemental unemployment fringe sub-column, project gross pay column, total-week gross pay column, check number, statement of compliance with MA-specific certification language. | All fields confirmed in schema.ts and getPayrollEntriesWithWorkerDetails; ilPdfGenerator.ts provides the exact implementation pattern; MA DLS form structure confirmed via official sources; MA certification language verified from official DLS documents. |
| NFR-03 | All new routes apply `assertProjectAccess` before any data access. | Already enforced in the Phase 49 stub (line 1224 in export.ts). Phase 50 fills in steps 4+ of the existing route handler — `assertProjectAccess` and the state gate are already correct and must not be moved. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | ^1.17.1 | Programmatic PDF generation | Already installed; used by ilPdfGenerator, pw12Generator, wh347Generator, unionAllocationPdf, variancePdf |
| StandardFonts (Helvetica/HelveticaBold) | built-in pdf-lib | Text rendering | Already used in ilPdfGenerator — no font embedding step needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.0.18 | Unit tests | One test file for maPdfGenerator, following ecprXmlGenerator.test.ts pattern |

**No new dependencies required.** pdf-lib is already installed.

**Version verification:** `npm view pdf-lib version` → confirmed 1.17.1 is the installed version already present in package.json.

---

## Architecture Patterns

### File Structure
```
src/server/services/
├── maPdfGenerator.ts          # NEW — MA DLS Weekly Certified Payroll Report
├── maPdfGenerator.test.ts     # NEW — unit tests
├── ilPdfGenerator.ts          # PATTERN TO FOLLOW (do not modify)
└── wh347Generator.ts          # CHECKBOX PATTERN SOURCE
src/server/routes/
└── export.ts                  # MODIFY — replace 501 stub with generator call
```

### Pattern 1: PDFDocument.create() — Programmatic Draw (ilPdfGenerator.ts)
**What:** Create a blank PDF from scratch using pdf-lib. Draw every line, text, and shape manually using coordinate math. No template overlay.
**When to use:** When no official fillable PDF template is available (MA has no official fillable form for pdf-lib overlaying).

```typescript
// Source: src/server/services/ilPdfGenerator.ts (lines 486-517)
export async function fillMaCertifiedPayroll(data: MaPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const ctx: DrawCtx = { pdfDoc, font, boldFont, black };

  let page = addPage(pdfDoc);
  let y = drawHeader(page, data, ctx);
  y = drawTableHeaders(page, y, ctx);
  for (const entry of data.entries) {
    if (y < 80) {
      page = addPage(pdfDoc);
      y = drawHeader(page, data, ctx);
      y = drawTableHeaders(page, y, ctx);
    }
    y = drawWorkerRow(page, entry, y, ctx);
  }
  // Always a dedicated compliance page
  const compliancePage = addPage(pdfDoc);
  drawStatementOfCompliance(compliancePage, data, ctx);
  return pdfDoc.save();
}
```

### Pattern 2: Checkbox via drawRectangle (wh347Generator.ts)
**What:** Simulate a checkbox by drawing a filled black 7×7 pt rectangle at the target position. Draw an unfilled outline rectangle when unchecked (or simply skip drawing).
**When to use:** OSHA 10 certified column — checked when `entry.oshaTraining === true`.

```typescript
// Source: src/server/services/wh347Generator.ts (lines 218-233)
function drawCheckbox(page: PDFPage, x: number, y: number, checked: boolean | null): void {
  // Outer box always drawn
  page.drawRectangle({ x, y, width: 8, height: 8, borderColor: rgb(0,0,0), borderWidth: 0.5 });
  if (checked === true) {
    // Filled inner square = checked
    page.drawRectangle({ x: x + 1, y: y + 1, width: 6, height: 6, color: rgb(0, 0, 0) });
  }
  // null/false = empty box only (worker declined or not trained)
}
```

### Pattern 3: State Gate + assertProjectAccess (export.ts lines 1220-1237)
**What:** The existing stub already has the correct gate order. Phase 50 ONLY replaces the 501 line with steps 4-7 (load entries, map to MaPdfInput, generate, send).
**When to use:** Never move or repeat the assertProjectAccess call — it is already correctly placed before the state gate.

```typescript
// DO NOT MODIFY lines 1209-1234 of export.ts — already correct
// Phase 50 replaces ONLY this line:
res.status(501).json({ error: 'MA DLS Payroll generator not yet implemented' });
// With: steps 4-7 (load entries, map, generate, send + audit log)
```

### Pattern 4: Entry Mapping (IL route, export.ts lines 1153-1177)
**What:** Map `getPayrollEntriesWithWorkerDetails` rows to the generator input type using `??` fallbacks for nullable fields.
**When to use:** All MA-specific fields must use `?? null` not `?? 0` for optional monetary/hour fields (they are nullable by spec).

```typescript
// IL mapping pattern (export.ts lines 1153-1177) adapted for MA:
entries: entries.map((e: any) => ({
  workerName: e.workerName,
  workerSsnLast4: e.workerSsnLast4 ?? null,
  workerAddress: e.workerAddress ?? '',
  classification: e.tradeDescription ?? '',
  // Hours (Mon-Sun ST and OT)
  monSt: e.entry?.monSt ?? 0,
  monOt: e.entry?.monOt ?? 0,
  // ... etc
  // MA-specific
  oshaTraining: e.oshaTraining ?? null,
  isWoman: e.isWoman ?? null,
  isMinority: e.isMinority ?? null,
  checkNumber: e.checkNumber ?? null,
  allOtherHours: e.allOtherHours ?? null,
  totalWeekGrossWages: e.totalWeekGrossWages ?? null,
  // Fringes
  fringeHealthWelfare: e.entry?.fringeHealthWelfare ?? null,
  fringePension: e.entry?.fringePension ?? null,
  fringeVacation: e.entry?.fringeVacation ?? null,
  fringeTraining: e.entry?.fringeTraining ?? null,
  grossWages: e.entry?.grossWages ?? null,
  deductions: e.entry?.deductions ?? null,
  netPay: e.entry?.netPay ?? null,
})),
```

### MA-Specific Column Layout
The MA form has significantly more columns than IL. At 6pt font on letter portrait, the available content width is 540pt (MARGIN=36). Column allocation (approximate, requiring tuning):

```
MA_COL = {
  nameSSN:     36,   // width ~80 (Name + SSN-last4)
  address:     118,  // width ~65 (worker address)
  class:       185,  // width ~55 (classification)
  oshaCheck:   242,  // width ~16 (OSHA 10 checkbox — 8pt square)
  isWoman:     260,  // width ~12 (Y/N/-)
  isMinority:  274,  // width ~12 (Y/N/-)
  monSt:       288,  // width ~13 (Mon ST)
  tueSt:       303,  // width ~13 (Tue ST)
  wedSt:       318,  // width ~13 (Wed ST)
  thuSt:       333,  // width ~13 (Thu ST)
  friSt:       348,  // width ~13 (Fri ST)
  satSt:       363,  // width ~13 (Sat ST)
  sunSt:       378,  // width ~13 (Sun ST)
  baseRate:    393,  // width ~18 (base rate)
  hw:          413,  // width ~16 (H&W fringe)
  pension:     431,  // width ~16 (pension)
  vacation:    449,  // width ~16 (vacation)
  training:    467,  // width ~16 (training)
  suppUnemp:   485,  // width ~16 (supplemental unemployment fringe)
  projectGross:503,  // width ~20 (project gross pay)
  totalGross:  524,  // width ~20 (total week gross wages)
  checkNum:    546,  // width ~30 (check number — right edge)
}
```

**Note on column widths:** These are starting-x positions only. Actual widths must be tuned so no column overflows its neighbor. The MA form is wider than IL because of the extra OSHA/woman/minority/suppUnemp/totalGross/checkNum columns. Font size 6pt is the correct floor (same as IL).

### Anti-Patterns to Avoid
- **Template overlay for MA:** MA has no official fillable PDF. Never use `PDFDocument.load()` for this generator.
- **Fabricating unknown values:** `allOtherHours` and `totalWeekGrossWages` may be null — show blank, never compute or default to 0 in the PDF display.
- **Moving the state gate:** `assertProjectAccess` and the `!== 'MA'` check are already in the stub. Never re-order them.
- **Skipping the audit log:** IL route has a best-effort audit log after send (lines 1190-1202). MA must follow the same pattern with `ma_pdf.downloaded` action.
- **Inline affidavit content:** Statement of Compliance must always be on a dedicated page 2 (unconditional `addPage()` after worker rows, same as IL Phase 43 decision).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checkbox rendering | Custom checkbox widget | `page.drawRectangle()` 8×8 pt with filled inner square | wh347Generator.ts already established this pattern; pdf-lib has no built-in checkbox widget |
| Font loading | Custom font | `StandardFonts.Helvetica` / `StandardFonts.HelveticaBold` | Already embedded in all other generators; zero extra bundle size |
| Page overflow detection | Custom pagination | `if (y < 80) { page = addPage(); y = drawHeader(); y = drawTableHeaders(); }` | IL generator pattern; threshold 80pt ensures room for worker row |
| Dollar formatting | Custom sprintf | `(n ?? 0).toFixed(2)` with null guard returning `''` | Same `fmtDollar` helper as ilPdfGenerator |

**Key insight:** Every PDF rendering primitive this phase needs already exists in the codebase (`drawRectangle`, `drawText`, `drawLine`, `addPage`). The task is mapping data and placing text correctly — not building new rendering infrastructure.

---

## Data Flow: getPayrollEntriesWithWorkerDetails Fields

`getPayrollEntriesWithWorkerDetails` returns (confirmed from payrollService.ts lines 443-496):

| Field | Source | MA Usage |
|-------|--------|----------|
| `entry.monSt` … `entry.sunSt` | payrollEntries | Daily ST hours Mon-Sun |
| `entry.monOt` … `entry.sunOt` | payrollEntries | Daily OT hours Mon-Sun |
| `entry.baseRateSnapshot` | payrollEntries | Base rate column |
| `entry.fringeHealthWelfare` | payrollEntries | H&W fringe column |
| `entry.fringePension` | payrollEntries | Pension fringe column |
| `entry.fringeVacation` | payrollEntries | Vacation fringe column |
| `entry.fringeTraining` | payrollEntries | Training fringe column |
| `entry.grossWages` | payrollEntries | Project gross pay column |
| `entry.deductions` | payrollEntries | Deductions |
| `entry.netPay` | payrollEntries | Net pay |
| `entry.checkNumber` | payrollEntries (Phase 49) | Check number column |
| `entry.allOtherHours` | payrollEntries (Phase 49) | All other hours column |
| `entry.totalWeekGrossWages` | payrollEntries (Phase 49) | Total week gross wages column |
| `workerName` | workers.name | Worker name |
| `workerSsnLast4` | workers.ssnLast4 | SSN display (XXX-XX-XXXX) |
| `workerAddress` | SQL COALESCE of addressStreet/City/State/Zip | Worker address |
| `tradeDescription` | COALESCE(override, classification) | Trade classification |
| `isWoman` | workers.isWoman (Phase 49) | Woman column |
| `isMinority` | workers.isMinority (Phase 49) | Minority column |
| `oshaTraining` | workers.oshaTraining (Phase 49) | OSHA 10 checkbox |

**Field not in getPayrollEntriesWithWorkerDetails (must come from `project`):**
- `project.name` — contractor name (same as project, per existing IL pattern)
- `project.contractorFein` — FEIN for header
- `project.county`, `project.state` — address approximation (same IL pattern)
- `project.cslbLicense` / `project.lniCertificate` — no MA equivalent column; `maDlsProjectId` is the MA project ID for the project header, NOT a contractor license
- `project.maDlsProjectId` — MA DLS Project ID (goes in "Contract No." / project header field)
- `project.maSicCode` — MA SIC code (may appear in project header or omit if not shown on form)
- `week.weekEndingDate` — week ending date
- `week.payrollNumber` / amendment — payroll number

**MA Contractor License gap:** There is no `maContractorLicense` column in the projects table (schema.ts lines 11-58 reviewed). The REQUIREMENTS.md MA-04 says the header includes "license." The closest analogues (`cslbLicense` for CA, `lniCertificate` for WA) are state-specific. For MA, there is no pre-existing license column. Resolution options:
1. Use `contractorFein` for the license field (fallback — FEIN is always present)
2. Map `maDlsProjectId` as the "DLS Registration" identifier in the header
3. Leave the license line blank with a labeled placeholder

**Recommendation (HIGH confidence):** Display `maDlsProjectId` as the "DLS Project ID" in the project header, and show `contractorFein` as "FEIN / License" in the contractor header. The MA DLS form asks for "Tax Payer ID No." (= FEIN) and "Contract No." (= project contract number). No separate MA contractor license number column exists; do not add one in Phase 50 (scope: generator only, no new schema changes).

---

## MA DLS Form Structure (Confirmed from Official Sources)

### Page 1: Header Block

```
MASSACHUSETTS WEEKLY CERTIFIED PAYROLL REPORT AND WORKFORCE PARTICIPATION
─────────────────────────────────────────────────────────────────────────────
Company's Name:          | Address:              | Phone No.:
Payroll No.:             | Tax Payer ID No.:     | Work Week Ending:
Awarding Authority:      | Public Works Project: | Location:
Contract No.:            | Min. Wage Rate Sheet: |
```

### Page 1: Worker Table (per-worker row)

Columns confirmed from official SRTABUS form and DLS documentation:

| Col | Header | Data Source |
|-----|--------|-------------|
| 1 | Name / SSN | workerName + workerSsnLast4 |
| 2 | Address | workerAddress |
| 3 | Classification | tradeDescription |
| 4 | OSHA 10 (checkbox) | oshaTraining (boolean/null — draw box; filled if true) |
| 5 | W (Woman) | isWoman (Y/N/-) |
| 6 | M (Minority) | isMinority (Y/N/-) |
| 7-13 | Su Mo Tu We Th Fr Sa (hours) | entry.sunSt … entry.satSt |
| 14 | Base Rate (B) | baseRateSnapshot |
| 15 | H&W | fringeHealthWelfare |
| 16 | Pension | fringePension |
| 17 | Vacation | fringeVacation |
| 18 | Training | fringeTraining |
| 19 | Supp. Unemp. (E) | No direct DB field — display as blank or "N/A" |
| 20 | Project Gross (G) | grossWages |
| 21 | Total Gross Wages | totalWeekGrossWages |
| 22 | All Other Hours | allOtherHours |
| 23 | Check No. | checkNumber |

**Supplemental Unemployment fringe (column E):** No dedicated database column exists (not added in Phase 49 and not in schema). This column must be rendered blank (no value) with the column header present to preserve form conformance. Do NOT add a new DB column in Phase 50 — this is a generator-only phase with no schema changes. Confirmed by reviewing schema.ts and REQUIREMENTS.md MA-04 scope.

**OT hours:** The MA form tracks daily hours (the official form shows one row per day or combined ST/OT). The existing payroll entries store `monSt`/`monOt` through `sunSt`/`sunOt`. For the MA form, display total daily hours (ST + OT) per day, or show ST hours only per the IL pattern. **Recommendation:** Show ST hours per day in the daily columns (same as IL); OT is already factored into grossWages.

**Daily hour column ordering:** The MA form uses Su-Mo-Tu-We-Th-Fr-Sa order (Sunday first, Saturday last), confirmed from the SRTABUS form. The IL form uses Mo-Su. This is a **critical difference** from IL — the column order must be Sun, Mon, Tue, Wed, Thu, Fri, Sat in maPdfGenerator.ts.

### Page 2: Statement of Compliance

**MA-specific certification language** (HIGH confidence — confirmed from official DLS sources including ccmilcp.com and prevailing wage guides):

```
STATEMENT OF COMPLIANCE

I do hereby certify that I am [name and title] of [company name], and that:
(1) The payroll records for the payroll period beginning [date] and ending [date] are
    correct and complete;
(2) The wage rate paid to each worker in the above-mentioned payroll period was not less
    than the applicable prevailing wage rate required by Massachusetts General Laws,
    Chapter 149, Section 27 and Chapter 149, Section 27F (apprentices only); and
(3) Each laborer, worker, or mechanic employed in the execution of the contract has
    been paid in accordance with the provisions of the applicable schedule of wage rates.

The undersigned hereby certifies under the pains and penalties of perjury that the
above information is true and correct.

[OSHA 10 CERTIFICATION NOTE: Documentation of OSHA 10 certification must be
provided for each employee the first time they appear on a weekly payroll record.]
```

**Key MA-specific language elements:**
- "pains and penalties of perjury" (MA statutory phrase — NOT "penalty of perjury" as in federal/IL forms)
- Citation: MGL Chapter 149, Section 27 and Section 27F
- OSHA 10 note about first-appearance documentation requirement

**Implementation approach for Page 2:** Since the form is generated (not signed electronically), the compliance page should show the certification language as a block of text with blank signature/date/title lines — same pattern as IL `drawAffidavit`. No actual signature is expected from the PDF generator.

---

## Export Route: What Changes in Phase 50

The existing stub in `export.ts` (lines 1205-1238) has the correct skeleton. Phase 50 replaces only the 501 response line. The full wired handler should follow the IL route pattern (lines 1104-1202):

```
Steps already complete (do not touch):
  1. Load payroll week (getPayrollWeek)
  2. Verify project access (assertProjectAccess) — NFR-03 BEFORE state gate
  3. State gate (project.state?.toUpperCase() !== 'MA' → 400)

Steps Phase 50 adds (replacing the 501):
  4. Load payroll entries (getPayrollEntriesWithWorkerDetails)
  5. Map entries to MaPdfInput
  6. Generate PDF (fillMaCertifiedPayroll(maData))
  7. Send as PDF download (Content-Type: application/pdf, filename: ma-cpr-{weekId}.pdf)
  8. Best-effort audit log (action: 'ma_pdf.downloaded')
```

**Import to add to export.ts:**
```typescript
import { fillMaCertifiedPayroll } from '../services/maPdfGenerator.js';
```

---

## Common Pitfalls

### Pitfall 1: Column Overflow at 6pt Font
**What goes wrong:** MA has 23 columns vs IL's 19. At 6pt font on 540pt content width, columns average 23pt each. If text exceeds its `maxWidth`, pdf-lib silently truncates — no error.
**Why it happens:** Worker names, addresses, and classifications can be long. Dollar values like "1234.56" are 6-7 chars at 6pt ≈ 20pt wide.
**How to avoid:** Always pass `maxWidth` to every `page.drawText()` call. Test with a long worker name (30+ chars). Truncation is acceptable; overflow is not.
**Warning signs:** Visual inspection of test PDF shows text bleeding into adjacent columns.

### Pitfall 2: Day Column Order (Sunday-first vs Monday-first)
**What goes wrong:** Copying IL's `Mo-Su` column order for MA produces an incorrect form. MA uses `Su-Mo-Tu-We-Th-Fr-Sa`.
**Why it happens:** IL and MA differ on week-start convention. The entry fields in the DB are always `monSt` through `sunSt` (Monday-indexed), regardless of display order.
**How to avoid:** In MA column constants, map `sunSt` to the first daily column, then `monSt` through `satSt`.
**Warning signs:** Hours appear one column to the right of where they belong, and Sunday hours display in the wrong slot.

### Pitfall 3: Null vs Zero for Optional MA Fields
**What goes wrong:** Using `e.allOtherHours ?? 0` causes "0.00" to appear in cells that should be blank when the worker has no other hours.
**Why it happens:** MA fields are nullable by spec (workers may not have other-employer hours or total-week wages).
**How to avoid:** Use `fmtOptional(e.allOtherHours)` that returns `''` for null/undefined, and `e.allOtherHours?.toFixed(2) ?? ''` pattern.
**Warning signs:** "0.00" appears in check number or total week gross wages cells for workers where no data was entered.

### Pitfall 4: OSHA Checkbox for Null (Declined)
**What goes wrong:** Treating `null` oshaTraining as "unchecked" misrepresents the data — null means "not recorded," not "not trained."
**Why it happens:** The column is nullable because workers may decline to self-identify.
**How to avoid:** Draw an empty box outline for both `false` and `null`. Only draw the filled black square for `true`. Optionally show "?" text for null to distinguish it visually.
**Warning signs:** The PDF shows an empty checkbox for workers who declined OSHA confirmation, which is correct — just don't show a check mark.

### Pitfall 5: No Schema Changes in Phase 50
**What goes wrong:** Adding a new column (e.g., `maContractorLicense`) because the form header says "license."
**Why it happens:** The temptation to fully satisfy the form spec by adding data.
**How to avoid:** Phase 50 is generator-only. All required data exists. Use `contractorFein` for the tax ID field (it IS the correct field — the MA form calls it "Tax Payer ID No."). Use `maDlsProjectId` for the project contract number field.
**Warning signs:** Any `db.insert` or schema migration in Phase 50 plans is out of scope.

### Pitfall 6: Affidavit Not on Dedicated Page
**What goes wrong:** The Statement of Compliance prints on the bottom of Page 1 when the worker table has few entries.
**Why it happens:** Conditional `if (y < threshold) addPage()` logic applied to the affidavit when it should be unconditional.
**How to avoid:** Always call `addPage()` unconditionally before `drawStatementOfCompliance()` — same as IL Phase 43 decision.
**Warning signs:** A single-worker payroll week produces a one-page PDF.

---

## Code Examples

### MaPdfInput Interface (to define in maPdfGenerator.ts)
```typescript
// Source: derived from ilPdfGenerator.ts IlPdfInput pattern + MA-specific fields
export interface MaPdfInput {
  contractor: {
    name: string;
    fein: string;         // "Tax Payer ID No." on MA form
    address: string;      // city, state approximation (same as IL)
  };
  project: {
    name: string;
    dlsProjectId: string; // "Contract No." field
    location: string;
    awardingAuthority: string;
  };
  week: {
    weekEndingDate: string;
    payrollNumber: string;
  };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    workerAddress: string;
    classification: string;
    oshaTraining: boolean | null;
    isWoman: boolean | null;
    isMinority: boolean | null;
    // Daily ST hours (Sun-first for display ordering)
    sunSt: number; monSt: number; tueSt: number; wedSt: number;
    thuSt: number; friSt: number; satSt: number;
    baseRate: number;
    fringeHealthWelfare: number | null;
    fringePension: number | null;
    fringeVacation: number | null;
    fringeTraining: number | null;
    // suppUnemployment: intentionally absent — no DB column, column rendered blank
    projectGross: number | null;    // grossWages
    totalWeekGross: number | null;  // totalWeekGrossWages
    allOtherHours: number | null;
    checkNumber: string | null;
  }>;
}
```

### fmtBoolean Helper (MA-specific: Y / N / — display)
```typescript
// Source: pattern derived from ilPdfGenerator.ts fmtDollar/fmtHours helpers
function fmtBoolean(v: boolean | null): string {
  if (v === true) return 'Y';
  if (v === false) return 'N';
  return '\u2014'; // em dash for null (declined / not recorded)
}
```

### MA Statement of Compliance Text (page.drawText with lineHeight)
```typescript
// Source: derived from ilPdfGenerator.ts drawAffidavit pattern + MA DLS official language
const complianceText =
  'I do hereby certify that the payroll records for the payroll period ending ' +
  data.week.weekEndingDate + ' are correct and complete, and that the wage rate ' +
  'paid to each worker was not less than the applicable prevailing wage rate required ' +
  'by Massachusetts General Laws, Chapter 149, Section 27. ' +
  'Workers employed as apprentices were registered in accordance with Chapter 149, ' +
  'Section 27F.\n\n' +
  'The undersigned hereby certifies under the pains and penalties of perjury that ' +
  'the above information is true and correct.\n\n' +
  'Note: Documentation of OSHA 10 certification must be provided for each employee ' +
  'the first time they appear on a weekly payroll record.';

page.drawText(complianceText, {
  x: MARGIN,
  y,
  size: 7,
  font,
  color: black,
  maxWidth: CONTENT_WIDTH,
  lineHeight: 10,
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| 501 stub (Phase 49) | Working generator (Phase 50) | MA download button becomes functional |
| No supplemental unemployment column | Blank column rendered in form | Form is structurally compliant; field can be added later if DB column added |

**Confirmed in Phase 49 decisions:**
- `integer({ mode: 'boolean' })` with no `.notNull()` for `isWoman`, `isMinority`, `oshaTraining` — nullable per self-identification rules
- `assertProjectAccess` before MA state gate (NFR-03) already in stub
- Amendment clone copies `checkNumber`/`allOtherHours`/`totalWeekGrossWages` verbatim (user-entered, not computed)

---

## Environment Availability

Step 2.6: Environment audit — this phase has no external dependencies. pdf-lib is already installed. No new services, CLIs, or runtimes required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pdf-lib | maPdfGenerator.ts | Yes | ^1.17.1 (installed) | — |
| Node.js | Server runtime | Yes | v24.14.1 | — |
| vitest | Tests | Yes | ^4.0.18 (installed) | — |

---

## Validation Architecture

`workflow.nyquist_validation` is not explicitly set to `false` in `.planning/config.json` (key is absent) — validation architecture section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/server/services/maPdfGenerator.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MA-04 | `fillMaCertifiedPayroll()` returns a non-empty Uint8Array | unit | `npx vitest run src/server/services/maPdfGenerator.test.ts` | Wave 0 |
| MA-04 | PDF contains contractor header fields (name, FEIN) | unit | same file | Wave 0 |
| MA-04 | PDF is at least 2 pages (worker table + compliance page) | unit | same file | Wave 0 |
| MA-04 | Worker with `oshaTraining: true` renders checkbox correctly (smoke — not visually, just runs without error) | unit | same file | Wave 0 |
| MA-04 | `fmtBoolean(true)` returns 'Y', `fmtBoolean(false)` returns 'N', `fmtBoolean(null)` returns em dash | unit | same file | Wave 0 |
| MA-04 | Empty entries array does not crash generator | unit | same file | Wave 0 |
| NFR-03 | Non-MA weekId returns 400 (state gate) | manual (route handler — DB required) | manual | N/A |

**Note on PDF content testing:** pdf-lib's `save()` returns a Uint8Array. The bytes can be checked for known markers (PDF header `%PDF-`, page count via parsing), but full visual verification requires downloading and opening the PDF in a viewer. The unit tests verify the generator runs without throwing and returns a valid PDF buffer — visual accuracy is a manual verification step.

### Sampling Rate
- **Per task commit:** `npx vitest run src/server/services/maPdfGenerator.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/server/services/maPdfGenerator.test.ts` — covers MA-04 unit tests (generator output, fmtBoolean, null safety, multi-page structure)

*(All other test infrastructure exists — vitest config and helpers are already in place.)*

---

## Open Questions

1. **Supplemental Unemployment Fringe sub-column value**
   - What we know: The MA DLS form has a "Supplemental Unemployment" (E) column in the fringe section. No database column for this value was added in Phase 49. REQUIREMENTS.md MA-03 only added health/pension/vacation/training fringe disaggregation (same fields as CA eCPR). The REQUIREMENTS.md MA-04 spec says "supplemental unemployment fringe sub-column."
   - What's unclear: Should this column be rendered as blank (no data), or should it use an existing field as a proxy?
   - Recommendation: Render as always-blank for Phase 50. The column header must be present for form completeness, but no value is populated. This is correct and consistent with the scope of MA-03 (which did not add this column). If a future phase adds a `fringeSuppUnemployment` column, the generator can be updated.

2. **Contractor license number for MA header**
   - What we know: The MA DLS form header has fields for company name, address, and "Tax Payer ID No." (= FEIN). There is no separate "MA contractor license number" column in the schema. The REQUIREMENTS.md says the header includes "license."
   - What's unclear: Whether "license" in MA-04 refers to a FEIN-equivalent or a separate OCCS or HIC license number.
   - Recommendation: Use `project.contractorFein` for "Tax Payer ID No." in the header. Do not add a new schema column in Phase 50. The planner should note this as a design decision and document it in the PLAN summary.

3. **OT hours display in daily columns**
   - What we know: The MA form shows daily hours. The DB stores both `monSt`/`monOt` pairs. The IL form showed only PW hours per day.
   - What's unclear: Whether the MA form's daily column shows ST only, or total (ST+OT).
   - Recommendation: Show total hours per day (ST + OT summed) in the daily cell — this is the most common interpretation for MA CPR forms and matches the spirit of "hours worked per day."

---

## Sources

### Primary (HIGH confidence)
- `src/server/services/ilPdfGenerator.ts` — complete implementation pattern for PDFDocument.create() programmatic draw; all drawing primitives confirmed
- `src/server/services/wh347Generator.ts` — checkbox drawing pattern via drawRectangle (lines 218-233)
- `src/server/db/schema.ts` — MA columns confirmed: `isWoman`, `isMinority`, `oshaTraining` on workers (lines 109-112); `checkNumber`, `allOtherHours`, `totalWeekGrossWages` on payrollEntries (lines 269-271); `maDlsProjectId`, `maSicCode` on projects (lines 53-54)
- `src/server/services/payrollService.ts` — `getPayrollEntriesWithWorkerDetails` returns all 6 MA-specific fields (lines 469-475): `isWoman`, `isMinority`, `oshaTraining`, `checkNumber`, `allOtherHours`, `totalWeekGrossWages`
- `src/server/routes/export.ts` — existing MA stub (lines 1205-1238) with correct assertProjectAccess and state gate; IL route (lines 1104-1202) as mapping/response pattern
- `.planning/STATE.md` — Phase 49 decisions confirming nullable boolean pattern, assertProjectAccess ordering, stub returns 501

### Secondary (MEDIUM confidence)
- [Massachusetts Weekly Certified Payroll Report (SRTABUS PDF)](https://www.srtabus.com/wp-content/uploads/Weekly-Certified-Payroll.pdf) — confirmed form columns: OSHA 10 checkbox, Project Hours rows (A1-A4), Hourly Base Wage (B), Supplemental Unemployment (E), Project Gross Wages (G), Total Gross Wages, All Other Hours, day-of-week columns in Su-Mo-Tu-We-Th-Fr-Sa order
- [Mass.gov Certified Payroll Reporting](https://www.mass.gov/how-to/certified-payroll-reporting-construction) — confirmed weekly submission to awarding authority, OSHA 10 first-appearance requirement, woman/minority tracking per workforce participation goals
- [CCMILCP Massachusetts Page](https://www.ccmilcp.com/massachusetts.html) — confirmed "pains and penalties of perjury" as MA statutory phrase in Statement of Compliance
- [Mass.gov Prevailing Wage for Contractors](https://www.mass.gov/info-details/prevailing-wage-for-contractors) — confirmed MGL Chapter 149 Section 27 and Section 27F (apprentices) as the applicable statutory citations

### Tertiary (LOW confidence — use as supporting context only)
- WebSearch results confirming OSHA 10 documentation on "first time employee appears on weekly payroll record" — consistent with official sources but not verified from the DLS form itself
- WebSearch results confirming "check number" and "all other hours" field names on MA form — consistent with schema names added in Phase 49

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pdf-lib version verified in package.json; no new dependencies needed
- Architecture: HIGH — ilPdfGenerator.ts is the exact pattern; all fields confirmed in schema and payrollService
- MA form structure: MEDIUM-HIGH — core columns confirmed from official form; supplemental unemployment column confirmed present but value is blank; day order (Sunday-first) confirmed from official form PDF extraction
- MA certification language: MEDIUM — "pains and penalties of perjury" and MGL Chapter 149 §27 confirmed from multiple official sources; exact verbatim text from the 07/23 DLS Statement of Compliance form not successfully retrieved (403 on direct PDF download), but key elements confirmed
- Pitfalls: HIGH — all pitfalls derived from existing codebase patterns and Phase 43 IL decisions

**Research date:** 2026-04-13
**Valid until:** 2026-07-13 (stable domain; MA form structure changes rarely)
