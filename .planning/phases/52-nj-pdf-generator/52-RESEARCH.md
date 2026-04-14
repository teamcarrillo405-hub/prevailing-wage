# Phase 52: NJ PDF Generator - Research

**Researched:** 2026-04-13
**Domain:** pdf-lib programmatic PDF generation, NJ MW-562 form structure, Express route completion
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NJ-03 | NJ MW-562 PDF generator (`njPdfGenerator.ts`): contractor header with NJ contractor reg number, per-worker rows with EEO columns (sex/race/ethnicity using standard NJ 6-code race system), FICA/federal income tax/state income tax deduction columns, statement of compliance with NJ-specific certification language. | Full generator file following `maPdfGenerator.ts` pattern. Deduction columns require three new DB columns (see Open Questions). `workerSex`/`race`/`ethnicity` must be added to `getPayrollEntriesWithWorkerDetails` select. |
| NFR-03 | All new routes apply `assertProjectAccess` before any data access. | Already satisfied in the Phase 51 stub — assertProjectAccess is called before the state gate. Phase 52 preserves this ordering when replacing the 501 stub. |
</phase_requirements>

---

## Summary

Phase 52 is a pure generator phase — all DB schema, routes, and client UI were completed in Phases 49–51. The entire deliverable is: (1) a new `njPdfGenerator.ts` service file following the `maPdfGenerator.ts` pattern exactly, (2) completing the export route stub (replacing the 501 with real PDF generation), and (3) adding `workerSex`, `race`, and `ethnicity` to the `getPayrollEntriesWithWorkerDetails` query.

The NJ MW-562 (February 2025 revision) is drawn from scratch using `PDFDocument.create()` — no fillable NJ PDF template exists for pdf-lib overlay. The form is structurally similar to the IL/MA generators: header block on page 1, per-worker rows with hours/rates/fringes, and a dedicated Statement of Compliance on page 2 (always a separate addPage call, never sharing with worker rows).

The key differences from the MA generator are: (a) EEO columns (workerSex M/F/N, race W/B/A/N/I/M, ethnicity H/N) per worker row instead of isWoman/isMinority booleans, (b) three separate deduction columns (FICA, federal income tax, state income tax) instead of a single aggregate `deductions` field, and (c) the contractor header must include the NJ Public Works Contractor Registration Number (`njPwcNumber`).

**Critical gap:** `workerSex`, `race`, and `ethnicity` are NOT currently selected in `getPayrollEntriesWithWorkerDetails`. Phase 52 must add them to the Drizzle select in `payrollService.ts`. Additionally, the three separate deduction columns (ficaTax, federalIncomeTax, stateIncomeTax) do not exist in `payroll_entries` — this phase needs a DB migration to add them.

**Primary recommendation:** Follow `maPdfGenerator.ts` structure exactly — same file layout, same DrawCtx pattern, same addPage flow, same unconditional page 2 for compliance statement. Add three new nullable REAL columns to `payroll_entries` for NJ deduction breakdown.

---

## Project Constraints (from CLAUDE.md)

- DB migrations are plain SQL `ALTER TABLE ... ADD COLUMN` files in `src/server/db/migrations/`
- Always register in `meta/_journal.json` — Drizzle silently skips files not in the journal
- Never drop or rename columns — add-only migrations only
- `--> statement-breakpoint` (one space, arrow format) between SQL statements in multi-statement migrations; single-statement migrations need no separator
- Design tokens via `@theme` tokens in `src/client/index.css` — not relevant for server-side PDF generation
- assertProjectAccess(projectId, userId, db) is the centralized IDOR guard across all route files
- `state?.toUpperCase() === 'NJ'` is the canonical pattern for state comparisons (Phase 47 lock)

---

## Standard Stack

### Core (already installed — no new packages)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| pdf-lib | 1.17.1 | Programmatic PDF generation | `PDFDocument.create()` pattern — verified installed |
| TypeScript / Express | installed | Route + type layer | No changes needed |
| Drizzle ORM (better-sqlite3) | installed | DB query for new columns | `getPayrollEntriesWithWorkerDetails` extension |
| Vitest | installed | Test framework | Pattern from `ecprXmlGenerator.test.ts` |

No new packages required. pdf-lib 1.17.1 is already installed and used by MA/IL generators.

**Version verification:** `npm view pdf-lib version` returns `1.17.1` (confirmed 2026-04-13).

---

## Architecture Patterns

### Established Pattern: Programmatic PDF Generator (maPdfGenerator.ts is canonical)

Phase 52 follows `maPdfGenerator.ts` structure with NJ-specific differences. The pattern is:

```
src/server/services/njPdfGenerator.ts   NEW
  ├── Layout constants (PAGE_WIDTH=612, PAGE_HEIGHT=792, MARGIN=36)
  ├── NjPdfInput interface (contractor, project, week, entries[])
  ├── Helper functions (fmtDollar, fmtHours, fmtOptional, fmtEeo)
  ├── DrawCtx interface (pdfDoc, font, boldFont, black)
  ├── addPage() — reuses exact MA pattern
  ├── NJ_COL object — column x-positions for NJ worker table
  ├── drawHeader() — includes njPwcNumber in contractor block
  ├── drawTableHeaders() — EEO columns, day columns, deduction columns
  ├── drawWorkerRow() — renders EEO codes, hours, rates, deductions
  ├── drawStatementOfCompliance() — NJ-specific legal language
  └── fillNjCertifiedPayroll() — main export; unconditional addPage() for page 2
```

### Recommended Project Structure (files modified)

```
src/
├── server/
│   ├── db/
│   │   └── migrations/
│   │       ├── 0031_nj_deductions.sql         NEW — 3 new payroll_entry columns
│   │       └── meta/_journal.json             EDIT — add idx 27
│   ├── services/
│   │   ├── njPdfGenerator.ts                  NEW — full generator
│   │   └── payrollService.ts                  EDIT — workerSex/race/ethnicity in select
│   └── routes/
│       └── export.ts                          EDIT — replace 501 stub with real PDF generation
tests/
└── services/
    └── njPdfGenerator.test.ts                 NEW — unit tests (ecprXmlGenerator.test.ts pattern)
```

### Pattern 1: NjPdfInput Interface

NJ-specific fields versus the MA generator:

```typescript
// Source: maPdfGenerator.ts interface adapted for NJ MW-562
export interface NjPdfInput {
  contractor: {
    name: string;
    fein: string;
    address: string;
    njPwcNumber: string | null;   // NJ Public Works Contractor Registration Number
  };
  project: {
    name: string;
    njContractId: string | null;  // NJ contract ID — goes in "Contract No." header field
    location: string;
    awardingAuthority: string;
  };
  week: {
    weekEndingDate: string;       // ISO YYYY-MM-DD
    payrollNumber: string;        // e.g., "1" or "5 (AMENDED 1)"
  };
  entries: Array<{
    workerName: string;
    workerSsnLast4: string | null;
    workerAddress: string;
    classification: string;
    // NJ EEO columns — legally required on MW-562
    workerSex: string | null;     // M / F / N / null (stored as text per Phase 51)
    race: string | null;          // W/B/A/N/I/M (6-code NJ system — existing IL column reused)
    ethnicity: string | null;     // H/N (existing IL column reused)
    // ST hours — NJ form is Monday-first (Mo-Tu-We-Th-Fr-Sa-Su)
    monSt: number;
    tueSt: number;
    wedSt: number;
    thuSt: number;
    friSt: number;
    satSt: number;
    sunSt: number;
    baseRate: number;
    fringeHealthWelfare: number | null;
    fringePension: number | null;
    fringeVacation: number | null;
    fringeTraining: number | null;
    grossWages: number | null;
    // NJ deduction breakdown (new columns — null if not entered)
    ficaTax: number | null;
    federalIncomeTax: number | null;
    stateIncomeTax: number | null;
    netPay: number | null;
  }>;
}
```

### Pattern 2: EEO Code Rendering

NJ uses 6-code race system. Values are stored as raw text from the existing `race` column (established for IL in Phase 42). The PDF renders them as-is (already single character codes):

```typescript
// Source: pattern from maPdfGenerator.ts fmtBoolean() — adapted for NJ EEO
function fmtEeo(v: string | null): string {
  if (v === null || v === undefined || v === '') return '\u2014'; // em dash
  return v; // Already stored as M/F/N, W/B/A/N/I/M, H/N
}
```

**NJ 6-code race system (from NJ MW-562 February 2025 form legend):**
- W = White
- B = Black or African American
- A = Asian
- N = Native Hawaiian or Other Pacific Islander
- I = American Indian or Alaskan Native
- M = Two or More Races

**NJ ethnicity codes:**
- H = Hispanic or Latino
- N = Not Hispanic or Latino

**NJ workerSex codes:**
- M = Male
- F = Female
- N = Non-binary / Decline to state

### Pattern 3: Column Layout Strategy

The NJ worker table must fit on a letter-portrait page (612pt wide, MARGIN=36 on each side = 540pt content width). The NJ form has more columns than MA because of EEO + separate deduction breakdown. Use font size 5-6pt and narrow column widths — same strategy as `maPdfGenerator.ts`:

```typescript
// Source: maPdfGenerator.ts NJ_COL adaptation
const NJ_COL = {
  nameSSN:        36,   // width ~82
  address:       120,   // width ~60
  class:         182,   // width ~50
  workerSex:     234,   // EEO: Sex (M/F/N) — width 14
  race:          250,   // EEO: Race (W/B/A/N/I/M) — width 14
  ethnicity:     266,   // EEO: Eth (H/N) — width 14
  monSt:         282,   // day cols 7 x 15pt = 105pt
  tueSt:         297,
  wedSt:         312,
  thuSt:         327,
  friSt:         342,
  satSt:         357,
  sunSt:         372,
  baseRate:      389,   // width ~22
  hw:            413,   // H&W fringe
  pension:       431,
  vacation:      449,
  training:      467,
  grossWages:    485,   // width ~20
  ficaTax:       507,   // NJ deduction 1
  fedTax:        524,   // NJ deduction 2
  stateTax:      541,   // NJ deduction 3
  netPay:        558,   // width to right margin
} as const;
```

Note: these x-positions are initial estimates. The executor must verify all columns fit within 576pt (MARGIN=36, PAGE_WIDTH=612) before finalizing. Adjust widths if columns overflow.

### Pattern 4: Export Route Completion

Replace the Phase 51 stub body (after the state gate) with the full generator call:

```typescript
// Source: maPdfGenerator.ts route pattern in export.ts
// 4. Load payroll entries with worker details
const entries = await getPayrollEntriesWithWorkerDetails(weekId);

// 5. Map to NjPdfInput
const njData: NjPdfInput = {
  contractor: {
    name: project.name,
    fein: (project as any).contractorFein ?? '',
    address: (project.county || '') + ', ' + (project.state || ''),
    njPwcNumber: (project as any).njPwcNumber ?? null,
  },
  project: {
    name: project.name,
    njContractId: (project as any).njContractId ?? null,
    location: (project.county || '') + ', ' + (project.state || ''),
    awardingAuthority: (project as any).contractingAgency ?? '',
  },
  week: {
    weekEndingDate: week.weekEndingDate,
    payrollNumber: week.amendmentNumber != null && week.originalWeekId != null
      ? `${week.payrollNumber} (AMENDED ${week.amendmentNumber})`
      : String(week.payrollNumber),
  },
  entries: entries.map((e: any) => ({
    workerName: e.workerName,
    workerSsnLast4: e.workerSsnLast4 ?? null,
    workerAddress: e.workerAddress ?? '',
    classification: e.tradeDescription ?? '',
    workerSex: e.workerSex ?? null,
    race: e.race ?? null,
    ethnicity: e.ethnicity ?? null,
    monSt: e.entry?.monSt ?? 0,
    tueSt: e.entry?.tueSt ?? 0,
    wedSt: e.entry?.wedSt ?? 0,
    thuSt: e.entry?.thuSt ?? 0,
    friSt: e.entry?.friSt ?? 0,
    satSt: e.entry?.satSt ?? 0,
    sunSt: e.entry?.sunSt ?? 0,
    baseRate: e.entry?.baseRateSnapshot ?? 0,
    fringeHealthWelfare: e.entry?.fringeHealthWelfare ?? null,
    fringePension: e.entry?.fringePension ?? null,
    fringeVacation: e.entry?.fringeVacation ?? null,
    fringeTraining: e.entry?.fringeTraining ?? null,
    grossWages: e.entry?.grossWages ?? null,
    ficaTax: e.entry?.ficaTax ?? null,
    federalIncomeTax: e.entry?.federalIncomeTax ?? null,
    stateIncomeTax: e.entry?.stateIncomeTax ?? null,
    netPay: e.entry?.netPay ?? null,
  })),
};

// 6. Generate PDF
const filledPdf = await fillNjCertifiedPayroll(njData);

// 7. Send as PDF download
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename="nj-mw562-${weekId}.pdf"`);
res.end(Buffer.from(filledPdf));

// 8. Best-effort audit log
try {
  const { insertAuditLog } = await import('../services/auditService.js');
  await insertAuditLog({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    ipAddress: req.ip ?? null,
    projectId: week.projectId,
    entityType: 'payroll_week',
    entityId: weekId,
    action: 'nj_pdf.downloaded',
    meta: { payrollNumber: week.payrollNumber, weekEnding: week.weekEndingDate, format: 'pdf' },
  });
} catch (auditErr) { console.error('[audit]', auditErr); }
```

### Pattern 5: Migration for Deduction Columns

Three new nullable REAL columns on `payroll_entries`. Migration follows NFR-01: three statements need two `--> statement-breakpoint` separators.

```sql
-- 0031_nj_deductions.sql
ALTER TABLE payroll_entries ADD COLUMN fica_tax REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN federal_income_tax REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN state_income_tax REAL;
```

Register in `meta/_journal.json` at idx 27, tag `0031_nj_deductions`.

### Pattern 6: payrollService.ts Extension

Add `workerSex`, `race`, `ethnicity`, and the three new deduction columns to `getPayrollEntriesWithWorkerDetails`:

```typescript
// Source: payrollService.ts — add after Phase 49 MA fields in the .select() block
// Phase 52 — NJ EEO worker fields (for njPdfGenerator)
workerSex: workers.workerSex,
race: workers.race,
ethnicity: workers.ethnicity,
// Phase 52 — NJ deduction breakdown fields
ficaTax: payrollEntries.ficaTax,
federalIncomeTax: payrollEntries.federalIncomeTax,
stateIncomeTax: payrollEntries.stateIncomeTax,
```

The Drizzle schema additions for these columns follow the same pattern as the existing `fringeHealthWelfare: real('fringe_health_welfare')` columns.

### Pattern 7: Statement of Compliance — NJ-specific Language

NJ MW-562 Statement of Compliance must reference NJ Prevailing Wage Act (N.J.S.A. 34:11-56.25 et seq.), not MA or IL law. Pattern mirrors `maPdfGenerator.ts` drawStatementOfCompliance() structure:

```typescript
// NJ-specific compliance paragraph 1
const para1 =
  `I do hereby certify that the payroll records for the payroll period ending ${data.week.weekEndingDate} are correct and complete, ` +
  `and that the wage rate paid to each worker was not less than the applicable prevailing wage rate required by the ` +
  `New Jersey Prevailing Wage Act (N.J.S.A. 34:11-56.25 et seq.). Workers employed as apprentices were registered ` +
  `in accordance with applicable apprenticeship registration requirements.`;

// NJ-specific perjury paragraph
const para2 =
  'The undersigned hereby certifies under penalty of perjury that the above information is true and correct.';
```

### Anti-Patterns to Avoid

- **Sharing compliance page with worker rows:** Statement of Compliance MUST be on a dedicated page 2 via unconditional `addPage()` — established in Phase 43 (IL) and Phase 50 (MA). Never conditional.
- **Guessing column coordinates:** Letter portrait is 612pt wide with MARGIN=36. Content width is 540pt. With ~23 columns, each column averages ~23pt. Use size 5-6pt fonts and verify total width does not exceed 576pt before finalizing.
- **Using `PDFDocument.load()` instead of `PDFDocument.create()`:** No NJ fillable template exists for pdf-lib overlay. All drawing is programmatic from scratch.
- **Omitting the audit log:** All PDF download routes write a best-effort audit log entry (try/catch, non-fatal). Use action key `'nj_pdf.downloaded'` matching the `'ma_pdf.downloaded'` / `'il_pdf.downloaded'` pattern.
- **Forgetting to import `fillNjCertifiedPayroll` in export.ts:** The import must be added to the import block at the top of `export.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom PDF byte builder | pdf-lib `PDFDocument.create()` | Already installed; MA/IL generators verified working |
| State gate | Manual project.state check | Exact `project.state?.toUpperCase() !== 'NJ'` pattern | Phase 47 canonical; handles null/undefined safely |
| IDOR check | Manual userId === projectUserId comparison | `assertProjectAccess(db, week.projectId, userId)` | Centralized guard with 403 response; cross-tenant tested |
| Audit log | Custom logger | `insertAuditLog` via dynamic import pattern | Non-fatal try/catch; consistent with all other export routes |
| Worker detail query | Custom JOIN | `getPayrollEntriesWithWorkerDetails(weekId)` (extended) | Already joins workers + classifications + overrides correctly |

---

## Critical Gap: Missing DB Columns for Deduction Breakdown

**Finding (HIGH confidence — verified from schema.ts):**

The `payroll_entries` table has a single aggregate `deductions: real('deductions').notNull().default(0)` column. The NJ MW-562 requires three separate columns on the form: FICA, Federal Income Tax, and State Income Tax.

**Options:**
1. **Add three new columns** (`fica_tax`, `federal_income_tax`, `state_income_tax` REAL nullable) — migration required, PayrollEntryPage UI must expose these fields for NJ projects. This is the correct approach for accurate certified payroll.
2. **Render single aggregate** — show the existing `deductions` total in the FICA column and leave the other two blank. This is legally insufficient for NJ MW-562 but avoids new UI work.

**Recommendation:** Option 1. The NJ MW-562 requirement explicitly states "FICA, federal income tax, state income tax deduction columns" (NJ-03). Rendering a single aggregate in the FICA column and leaving the others blank would produce a non-compliant form. Phase 52 should add the migration and Drizzle schema columns; the UI for entering these values needs to be added to `PayrollEntryPage` for NJ projects (gated behind `isNJ`). This is a small scope addition that prevents rework.

**Plan scope implication:** Phase 52 has THREE deliverable areas, not one:
1. Migration + schema for three new deduction columns + PayrollEntryPage NJ UI fields
2. `payrollService.ts` extension (workerSex, race, ethnicity, new deduction columns)
3. `njPdfGenerator.ts` + `export.ts` route completion

---

## Common Pitfalls

### Pitfall 1: workerSex/race/ethnicity not in getPayrollEntriesWithWorkerDetails
**What goes wrong:** The export route calls `getPayrollEntriesWithWorkerDetails` but `workerSex`, `race`, and `ethnicity` are not in the Drizzle select — the EEO columns come back as `undefined` on every entry, producing blank cells in the PDF.
**Why it happens:** Phase 49 added `isWoman`, `isMinority`, `oshaTraining` to the select, but `workerSex` (Phase 51) and `race`/`ethnicity` (Phase 42 IL) were never added.
**How to avoid:** Add `workerSex: workers.workerSex`, `race: workers.race`, `ethnicity: workers.ethnicity` to the `.select()` block in `getPayrollEntriesWithWorkerDetails` in `payrollService.ts` before writing the export route mapping.
**Warning signs:** PDF renders em-dashes in all EEO columns for every worker even when data was entered.

### Pitfall 2: Column coordinate overflow
**What goes wrong:** The NJ table has ~23 columns squeezed into 540pt of content width. If any column x-position goes past 576pt (PAGE_WIDTH - MARGIN), text is clipped or overflows off the page.
**Why it happens:** pdf-lib does not throw when text is drawn outside page bounds — it silently clips.
**How to avoid:** Sum all column positions and their maxWidth before writing the generator. Verify last column ends at or before x=576. Use font size 5pt for the tightest columns.
**Warning signs:** Right-most columns (netPay) appear blank or truncated in the generated PDF.

### Pitfall 3: Deduction columns missing from DB
**What goes wrong:** Generator maps `e.entry?.ficaTax ?? null` but the column doesn't exist in `payroll_entries` — TypeScript types don't catch this if payrollEntries is selected with `entry: payrollEntries` (star select pattern), and runtime returns undefined.
**Why it happens:** The three deduction columns require a DB migration that hasn't been applied.
**How to avoid:** Write and register the `0031_nj_deductions.sql` migration first, add the Drizzle schema columns, then write the generator.
**Warning signs:** `e.entry?.ficaTax` is always undefined even after data entry; TypeScript may or may not flag this depending on how payrollEntries type is inferred.

### Pitfall 4: Compliance page shares with worker rows
**What goes wrong:** addPage() for the compliance statement is placed inside a conditional check (e.g., `if (y < 100) addPage()`), which means if there's room on the last worker page, compliance text is appended there.
**Why it happens:** Developer tries to save paper by reusing remaining page space.
**How to avoid:** Call `const compliancePage = addPage(pdfDoc)` unconditionally after the worker loop — exactly as in `maPdfGenerator.ts` line 561 and `ilPdfGenerator.ts` line 513.
**Warning signs:** PDF has compliance text starting partway down a page that also has worker rows.

### Pitfall 5: Audit log action key inconsistency
**What goes wrong:** Audit log uses `action: 'nj_mw562.downloaded'` instead of `'nj_pdf.downloaded'` — breaks any analytics queries that look for the `_pdf.downloaded` suffix pattern.
**Why it happens:** Developer invents a new action key name without checking the pattern.
**How to avoid:** Use `'nj_pdf.downloaded'` to match `'ma_pdf.downloaded'` and `'il_pdf.downloaded'`.

### Pitfall 6: Missing import in export.ts
**What goes wrong:** `fillNjCertifiedPayroll` is called in the route but not imported at the top of `export.ts`, causing a runtime `ReferenceError`.
**Why it happens:** The export.ts imports were set up in Phase 51 for the stub (which didn't need the generator import).
**How to avoid:** Add `import { fillNjCertifiedPayroll } from '../services/njPdfGenerator.js';` to the import block at the top of `export.ts` alongside the existing `fillMaCertifiedPayroll` import.

### Pitfall 7: Day order mismatch
**What goes wrong:** NJ form uses Monday-first column order (Mo-Tu-We-Th-Fr-Sa-Su) while the MA form uses Sunday-first (Su-Mo-Tu-We-Th-Fr-Sa). If developer copies MA column order, days are shifted by one in the PDF.
**Why it happens:** MA is an exception — most US certified payroll forms are Monday-first. Developer assumes MA order applies to NJ.
**How to avoid:** NJ MW-562 is Monday-first. Map `monSt` to the first day column. Verify against the actual NJ MW-562 form.

---

## Code Examples

### Generator file skeleton (pattern from maPdfGenerator.ts)
```typescript
// Source: maPdfGenerator.ts structure — adapt for NJ
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export interface NjPdfInput { /* ... see Pattern 1 above ... */ }

function fmtDollar(n: number | null): string {
  if (n === null || n === undefined) return '';
  return n.toFixed(2);
}

function fmtHours(n: number): string {
  return n > 0 ? String(n) : '';
}

function fmtEeo(v: string | null): string {
  if (v === null || v === undefined || v === '') return '\u2014';
  return v;
}

interface DrawCtx {
  pdfDoc: PDFDocument;
  font: PDFFont;
  boldFont: PDFFont;
  black: ReturnType<typeof rgb>;
}

function addPage(pdfDoc: PDFDocument): PDFPage {
  return pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

// drawHeader, drawTableHeaders, drawWorkerRow, drawStatementOfCompliance
// ... (follow maPdfGenerator.ts structure)

export async function fillNjCertifiedPayroll(data: NjPdfInput): Promise<Uint8Array> {
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

  // ALWAYS dedicated page 2 — unconditional (Phase 43/50 pattern)
  const compliancePage = addPage(pdfDoc);
  drawStatementOfCompliance(compliancePage, data, ctx);

  return pdfDoc.save();
}
```

### payrollService.ts extension
```typescript
// Source: payrollService.ts getPayrollEntriesWithWorkerDetails — add to .select()
// Phase 52 — NJ EEO worker fields
workerSex: workers.workerSex,
race: workers.race,
ethnicity: workers.ethnicity,
// Phase 52 — NJ deduction breakdown
ficaTax: payrollEntries.ficaTax,
federalIncomeTax: payrollEntries.federalIncomeTax,
stateIncomeTax: payrollEntries.stateIncomeTax,
```

### Drizzle schema additions (payroll_entries)
```typescript
// Source: schema.ts — payrollEntries table, after Phase 49 MA fields
// Phase 52 — NJ deduction breakdown columns (nullable; NJ projects only)
ficaTax: real('fica_tax'),
federalIncomeTax: real('federal_income_tax'),
stateIncomeTax: real('state_income_tax'),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pdf-lib template overlay (`PDFDocument.load()`) | `PDFDocument.create()` programmatic draw | Phase 41 (NY PW-12) | No NJ fillable template exists; programmatic draw is the only viable approach |
| Per-state boolean download button blocks | STATE_FORMS registry lookup | Phase 47 | NJ button already wired in STATE_FORMS via Phase 51; no PayrollWeekDetailPage changes needed in Phase 52 |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.14.1 | — |
| pdf-lib | PDF generation | Yes | 1.17.1 | — |
| Vitest | Tests | Yes | installed | — |
| SQLite (better-sqlite3) | DB migrations | Yes | installed | — |

No missing dependencies. All tools confirmed available.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/services/njPdfGenerator.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NJ-03 | `fillNjCertifiedPayroll` returns a non-empty Uint8Array | unit | `npx vitest run tests/services/njPdfGenerator.test.ts` | No — Wave 0 |
| NJ-03 | PDF contains contractor name and njPwcNumber in header | unit | same | No — Wave 0 |
| NJ-03 | PDF contains EEO codes (M, W, H) for a worker with all fields set | unit | same | No — Wave 0 |
| NJ-03 | PDF renders em-dash for null EEO fields | unit | same | No — Wave 0 |
| NJ-03 | Statement of Compliance references N.J.S.A. 34:11-56.25 | unit | same | No — Wave 0 |
| NFR-03 | GET /api/export/nj-mw562/:weekId returns 400 for non-NJ project | integration | `npx vitest run tests/routes/export.test.ts` | Partially — 501 stub test exists; must update to 200 PDF test |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/services/njPdfGenerator.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/njPdfGenerator.test.ts` — covers NJ-03 unit tests (pattern: `ecprXmlGenerator.test.ts`)
- [ ] Update `tests/routes/export.test.ts` — change the 501 stub test to expect 200 + PDF content-type for valid NJ project

---

## Open Questions

1. **Day order: Monday-first or Sunday-first for NJ?**
   - What we know: MA form is Sunday-first (documented in `maPdfGenerator.ts` comment). IL is Monday-first. Federal WH-347 is Monday-first.
   - What's unclear: NJ MW-562 form column order — need to verify against the actual February 2025 form.
   - Recommendation: Assume Monday-first (standard US certified payroll convention) unless the executor can retrieve the actual NJ MW-562 PDF to confirm. The NJ_COL definition should use Mo-Tu-We-Th-Fr-Sa-Su order.

2. **PayrollEntryPage UI for new deduction columns**
   - What we know: Phase 52 adds `ficaTax`, `federalIncomeTax`, `stateIncomeTax` columns to `payroll_entries`. These need to be enterable.
   - What's unclear: Whether Phase 52 should include the PayrollEntryPage UI changes, or defer to a follow-on micro-phase.
   - Recommendation: Include in Phase 52 — without the UI, contractors cannot enter the data and the deduction columns will always be null (defeating the purpose). Gate behind `isNJ` in PayrollEntryPage. Follow the Phase 49 pattern for MA optional payroll entry fields (`checkNumber`, `allOtherHours`, `totalWeekGrossWages`).

3. **njContractId vs njPwcNumber header placement**
   - What we know: Both fields exist on projects table (Phase 51). NJ MW-562 header has "Contract No." and "Contractor Reg. No." fields.
   - What's unclear: Exact label text and position on the February 2025 NJ MW-562 form.
   - Recommendation: Map `njPwcNumber` → "NJ PWC Reg. No." and `njContractId` → "Contract No." in the header. Verify against the actual form if the executor can download it.

---

## Sources

### Primary (HIGH confidence)
- `src/server/services/maPdfGenerator.ts` — canonical generator pattern (verified this session)
- `src/server/services/ilPdfGenerator.ts` — original programmatic draw pattern (verified this session)
- `src/server/services/payrollService.ts` lines 443–497 — `getPayrollEntriesWithWorkerDetails` (verified: workerSex/race/ethnicity NOT selected)
- `src/server/db/schema.ts` — payrollEntries table (verified: single `deductions` column, no FICA breakdown)
- `src/server/routes/export.ts` lines 1310–1343 — Phase 51 NJ stub (verified: assertProjectAccess before state gate, returns 501)
- `.planning/REQUIREMENTS.md` NJ-03 — authoritative requirement (verified this session)
- `.planning/STATE.md` accumulated decisions — locked decisions for Phase 52 (verified this session)

### Secondary (MEDIUM confidence)
- NJ MW-562 February 2025 form structure — inferred from REQUIREMENTS.md NJ-03 description ("6-code NJ system", "FICA/federal income tax/state income tax"); not directly verified against the actual form PDF
- NJ Prevailing Wage Act citation (N.J.S.A. 34:11-56.25 et seq.) — standard legal citation for NJ prevailing wage compliance language; should be verified against the actual MW-562 form

---

## Metadata

**Confidence breakdown:**
- Generator structure: HIGH — direct pattern transfer from maPdfGenerator.ts (verified)
- Column gap (workerSex/race/ethnicity not in query): HIGH — verified by reading payrollService.ts
- Deduction column gap: HIGH — verified by reading schema.ts
- NJ EEO code system (W/B/A/N/I/M, H/N): MEDIUM — inferred from REQUIREMENTS.md; verify against actual NJ MW-562 form
- Compliance statement legal text: MEDIUM — standard NJ PWA citation; verify wording against actual MW-562 form
- Day order (Monday-first): MEDIUM — assumed standard; verify against actual MW-562 form

**Research date:** 2026-04-13
**Valid until:** 2026-07-13 (stable — NJ MW-562 form revision unlikely in 90 days; verify if a new form revision is published)
