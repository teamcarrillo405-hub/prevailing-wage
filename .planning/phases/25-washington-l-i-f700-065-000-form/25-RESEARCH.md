# Phase 25: Washington L&I F700-065-000 Form - Research

**Researched:** 2026-03-25
**Domain:** Washington state public works certified payroll — F700-065-000 form, WA L&I trade codes, manual prevailing wage rate entry, state-gated UI
**Confidence:** MEDIUM (WA form field layout must be measured from the official PDF at execution time; WA trade code list is partially confirmed from secondary sources; overall architecture pattern is HIGH confidence as it mirrors the proven CA Phase 24 pattern)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WAL-01 | User can enter prevailing wage rates manually for WA projects (SAM.gov does not cover WA state wages) | DB migration adds `waManualRate` column to `workerClassifications`; ProjectForm conditionally renders manual rate field for WA; baseRateSnapshot is populated from `waManualRate` when project is WA |
| WAL-02 | System generates a Washington F700-065-000 certified payroll PDF (local record) with WA trade code mapping and WA-specific project fields (UBI number, L&I cert, WC account) | New `fillF700()` generator mirroring `a1131Generator.ts`; new export route `/api/export/f700/:weekId`; WA-specific project fields migration; state-gated download button on `PayrollWeekDetailPage`; WA L&I trade code mapping table; PWIA portal disclosure modal |
</phase_requirements>

---

## Summary

Phase 25 adds Washington state certified payroll support. It is structurally parallel to Phase 24 (CA A-1-131), which established the two-layer pattern: (1) state-specific project fields captured at project creation and (2) a PDF generator with a state-gated export route. Phase 25 reuses that same layering for WA.

The core complexity that is unique to WA (compared to CA) has two dimensions. First, SAM.gov wage determinations do not cover Washington state prevailing wages — WA L&I publishes its own rates by county and trade. This means workers on WA projects cannot have their `baseRateSnapshot` populated from a SAM.gov lookup. A manual rate entry field is required per worker classification, stored as a separate column and used as the snapshot when building payroll entries. Second, the F700-065-000 form uses WA-specific 4-letter trade codes (CARP, ELEC, LABO, OPER, etc.) that are different from the free-text trade descriptions stored in the app. A mapping from `workerClassifications.tradeCode` to the WA L&I codes must be applied at PDF generation time, with a fallback dropdown for unmatched codes.

The WA form is a flat (non-AcroForm) PDF — exactly like the WH-347 and A-1-131 — requiring coordinate-based text overlay via pdf-lib. The exact coordinates must be measured from the official form at execution time (Wave 0 prerequisite). WA-specific project fields are UBI number (Washington's 9-digit business identifier issued by the Secretary of State), L&I contractor certificate number, and workers' compensation account number. These are captured at project creation for WA projects only and populate the form header.

**Primary recommendation:** Mirror `a1131Generator.ts` + the A-1-131 export route + the CA download button pattern exactly. Migrate `projects` for three WA fields and `workerClassifications` for `waManualRate`. Gate the "Download WA F700-065-000" button on `project.state === 'WA'`. Disclose PWIA portal requirement unconditionally on every WA download.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | already installed | PDF coordinate overlay for F700-065-000 | Same library used for WH-347 and A-1-131; established pattern |
| drizzle-orm | already installed | Schema migration + queries | Project ORM; add-only migrations |
| zod | already installed | Schema validation for new WA fields | Existing validation pattern |
| react-hook-form | already installed | WA-specific project fields in ProjectForm | Existing form library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| better-sqlite3 | already installed | Test DB (in-memory) | Test infrastructure for WA route tests |

### No New Dependencies Required
Phase 25 uses only existing project dependencies. No npm installs needed.

---

## Architecture Patterns

### Recommended File Structure (new files only)
```
src/server/
  db/
    migrations/
      0012_wa_project_fields.sql          # ubiNumber + lniCertificate + wcAccount on projects
      0013_wa_manual_rate.sql             # wa_manual_rate on workerClassifications
  services/
    f700Generator.ts                      # new — mirrors a1131Generator.ts
  routes/
    export.ts                             # modified — add GET /api/export/f700/:weekId

src/client/
  components/projects/
    ProjectForm.tsx                       # modified — WA conditional fields
  pages/
    PayrollWeekDetailPage.tsx             # modified — WA download button + PWIA modal
  components/
    WorkersPage.tsx (or WorkerClassificationForm) # modified — WA manual rate field per classification
```

### Pattern 1: Schema Migration for WA Project Fields (idx 8)
**What:** Three nullable columns on `projects` for WA-specific header fields
**Migration index:** Next idx is 8 (current highest: idx 7, tag `0011_payroll_entries_double_time`)
**When to use:** Always add-only SQL migrations; always register in `meta/_journal.json`

Migration `0012_wa_project_fields.sql`:
```sql
ALTER TABLE projects ADD COLUMN ubi_number TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN lni_certificate TEXT;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN wc_account TEXT;
```

`schema.ts` additions to `projects` table:
```typescript
// Phase 25 — Washington-specific fields
ubiNumber: text('ubi_number'),
lniCertificate: text('lni_certificate'),
wcAccount: text('wc_account'),
```

Journal entry: idx 8, tag `0012_wa_project_fields`.

### Pattern 2: Schema Migration for WA Manual Rate (idx 9)
**What:** One nullable column on `workerClassifications` to store the manually entered WA prevailing wage rate
**Why separate from baseRate:** `workerClassifications` currently has no `baseRate` column — the rate snapshot lives on `payrollEntries.baseRateSnapshot`. The `waManualRate` is the source of truth for building that snapshot on WA projects.

Migration `0013_wa_manual_rate.sql`:
```sql
ALTER TABLE worker_classifications ADD COLUMN wa_manual_rate REAL;
```

`schema.ts` additions to `workerClassifications` table:
```typescript
// Phase 25 — WA manual prevailing wage rate (SAM.gov not used for WA)
waManualRate: real('wa_manual_rate'),
```

Journal entry: idx 9, tag `0013_wa_manual_rate`.

### Pattern 3: F700-065-000 PDF Generator (mirrors a1131Generator.ts)
**What:** New service file `f700Generator.ts` using pdf-lib coordinate overlay on the blank WA L&I form
**When to use:** WA project F700-065-000 download

Key structural differences from A-1-131:
- Form dimensions: must be measured from `assets/f700-official.pdf` at execution time (the official form URL is `https://lni.wa.gov/forms-publications/F700-065-000.pdf` — however this returned 404 in research; the form is available from third-party sources. Wave 0 must locate and save the current official version)
- Hours grid: Mon-Sun (standard; no DT column — WA does not require a separate DT hours grid on the F700-065-000, WA OT is 1.5x after 40 hours/week per RCW 49.28.010)
- WA trade code (4-letter): populated from the `waTradeCode` mapping lookup
- WA-specific header fields: UBI number, L&I certificate, WC account
- No CSLB equivalent; no SDI
- Certification section: certifying official signs under RCW 39.12.020 penalty of perjury
- PWIA disclosure: unconditional modal required (Intent to Pay and Affidavit of Wages must be filed at `secure.lni.wa.gov`)

```typescript
// Source: Pattern match to a1131Generator.ts
export interface F700WorkerRow {
  entryNo: number;
  workerName: string;
  identifyingNo: string;   // SSN last 4 — privacy default
  laborType: 'journeyworker' | 'apprentice';
  waTradeCode: string;     // 4-letter WA L&I code (CARP, ELEC, LABO, etc.)
  classification: string;  // human-readable description
  // Daily hours: Mon-Sat-Sun (standard)
  monSt: number; monOt: number;
  tueSt: number; tueOt: number;
  wedSt: number; wedOt: number;
  thuSt: number; thuOt: number;
  friSt: number; friOt: number;
  satSt: number; satOt: number;
  sunSt: number; sunOt: number;
  totalSt: number;
  totalOt: number;
  baseRate: number;
  otRate: number;
  grossWages: number;
  deductions: number;
  netPay: number;
  fringeCredit: number;
}

export interface F700Data {
  contractorName: string;
  contractorAddress: string;
  ubiNumber: string;
  lniCertificate: string;
  wcAccount: string;
  projectName: string;
  projectLocation: string;
  contractNo: string;
  weekEndingDate: string;
  payrollNumber: string;
  workers: F700WorkerRow[];
}
```

NOTE: Exact field coordinates must be measured from the actual PDF at execution time (same process used for A-1-131 — apply CTM if rotated, use pdfminer or visual grid to measure each field).

### Pattern 4: WA Trade Code Mapping
**What:** A static lookup table mapping the app's `tradeCode` / `tradeDescription` values to WA L&I 4-letter codes
**Where:** Inline constant in `f700Generator.ts`

Confirmed WA L&I 4-letter codes (MEDIUM confidence — from multiple secondary sources):
```typescript
// Source: points-north.com, workyard.com, construction-business-forms.com
// Confidence: MEDIUM — confirmed from multiple secondary sources;
// full official list must be validated against lni.wa.gov/licensing-permits/public-works-projects/prevailing-wage-rates/
export const WA_TRADE_CODES: Record<string, string> = {
  'BOIL': 'Boilermakers',
  'CARP': 'Carpenters',
  'ELEC': 'Electricians (Inside)',
  'GLAZ': 'Glaziers',
  'IRON': 'Ironworkers',
  'LABO': 'Laborers',
  'PAIN': 'Painters',
  'PLUM': 'Plumbers and Pipefitters',
  'ROOF': 'Roofers',
  // Additional codes confirmed from prevailing wage determinations:
  'OPER': 'Operating Engineers',
  'MASO': 'Masons (Brick/Block)',
  'PLAS': 'Plasterers',
  'TEAM': 'Teamsters',
  'SHEE': 'Sheet Metal Workers',
  'ELCO': 'Electricians (Outside)',
  'PFRT': 'Pile Drivers',
};
```

**Auto-match logic:** When `workerClassifications.tradeCode` exactly matches a key in `WA_TRADE_CODES`, use it directly. When not matched, the UI shows a dropdown per worker for the user to select the correct WA code — stored on the `workerClassifications` row via a new `waTradeCode` nullable column (or captured as a query param at download time).

**CRITICAL open question:** The WA trade code dropdown requirement (Success Criterion 4) means the app needs a way to store a WA-specific override code per worker classification. The simplest approach is to add a `wa_trade_code` nullable column to `workerClassifications` (part of the `0013_wa_manual_rate.sql` migration), defaulting to the value of `tradeCode` when it matches a known WA code.

### Pattern 5: Export Route for F700 (mirrors a1131 route)
**What:** New route in `export.ts` following the `GET /api/export/a1131/:weekId` pattern exactly
**Key differences from A-1-131 route:**
- State gate: `project.state !== 'WA'` returns 400
- Maps `project.ubiNumber`, `project.lniCertificate`, `project.wcAccount`
- Uses `waTradeCode` per worker row (from `workerClassifications.waTradeCode ?? workerClassifications.tradeCode`)
- No DT field mapping needed (WA F700 does not have a DT column)
- Filename: `f700-${week.payrollNumber}.pdf`
- PWIA disclosure is in the UI modal, not in the PDF content

```typescript
// Source: Pattern from export.ts a1131 route
router.get('/f700/:weekId', async (req, res) => {
  // ... ownership check (identical to wh347/a1131 routes)
  if (project.state !== 'WA') {
    res.status(400).json({ error: 'F700-065-000 is only available for Washington projects' });
    return;
  }
  const templatePath = path.join(process.cwd(), 'assets', 'f700-official.pdf');
  // ...
});
```

### Pattern 6: WA-Conditional Project Fields (mirrors CA pattern in ProjectForm)
**What:** `ProjectForm.tsx` shows UBI number, L&I certificate, and WC account fields only when `state === 'WA'`
**Implementation:** Same `watch('state')` pattern already used for CA:

```typescript
// Source: ProjectForm.tsx CA pattern (Phase 24)
const stateValue = watch('state');
const isWA = stateValue?.toUpperCase() === 'WA';

// In JSX — new block alongside the CA block:
{isWA && (
  <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
    <p className="text-sm font-medium text-blue-800">Washington Project Fields</p>
    <div>
      <label>UBI Number</label>
      <input {...register('ubiNumber')} placeholder="9-digit UBI, e.g. 123456789" />
    </div>
    <div>
      <label>L&I Contractor Certificate #</label>
      <input {...register('lniCertificate')} />
    </div>
    <div>
      <label>Workers' Compensation Account #</label>
      <input {...register('wcAccount')} />
    </div>
  </div>
)}
```

Server: `CreateProjectSchema` adds optional `ubiNumber`, `lniCertificate`, `wcAccount`; `projects.ts` route inserts them.

### Pattern 7: WA Manual Rate Entry in WorkersPage
**What:** WA projects need a manual prevailing wage rate entry field per worker classification. This is the primary WAL-01 requirement.
**Where:** `WorkersPage.tsx` — the worker classification form/table needs a rate input for WA projects
**How:** Similar to how `isCA` is derived from project state in `PayrollEntryPage`, derive `isWA` and show a "WA Prevailing Rate ($/hr)" input when creating or editing a worker classification.

Current classification create form sends: `{ tradeCode, tradeDescription, laborType }` — no rate fields.
For WA projects, the form also sends `waManualRate: number`.

On the server, `workers.ts` route already accepts classification creation. It needs to:
1. Accept `waManualRate` in the classification create/update Zod schema
2. Store it in `workerClassifications.waManualRate`

On payroll entry (in `payrollService.ts` `upsertPayrollEntry`), when the project is WA, use `workerClassification.waManualRate` as the `baseRateSnapshot` default — the user should not need to re-enter the rate at payroll time.

**Note on WA compliance:** The compliance engine checks `baseRateSnapshot >= requiredRate`. For WA projects, since there is no SAM.gov lookup, the required rate is effectively whatever `waManualRate` the user entered. The existing compliance check will still run but will compare snapshot against itself (or against 0 if no rate is entered). This is the correct behavior for Phase 25 — no custom WA compliance logic is needed.

### Pattern 8: State-Gated WA Download Button (mirrors CA button)
**What:** "Download WA F700-065-000" button appears only on WA projects; CA/federal projects have no WA button
**Where:** `PayrollWeekDetailPage.tsx` — same location as the CA button
**How:** `isWA = projectData?.data?.project?.state === 'WA'`

Separate state variables to avoid WH-347/CA/WA interference:
- `showWaDisclosure` useState (new, for WA PWIA modal)
- `waGeneratingRef` useRef (new, mirrors `caGeneratingRef`)

```typescript
// Source: CA pattern in PayrollWeekDetailPage.tsx (Phase 24)
{isWA && weekId && (
  <Button variant="secondary" size="sm" onClick={handleWaDownloadClick}>
    Download WA F700-065-000
  </Button>
)}
```

### Pattern 9: PWIA Portal Disclosure Modal (mirrors eCPR modal)
**What:** Unconditional modal shown on every WA F700 download click disclosing that Intent to Pay and Affidavit of Wages MUST be filed via PWIA portal
**Persistent:** Same as CA eCPR modal — shown on every click, not just on violations
**Portal URL:** `secure.lni.wa.gov`
**Advisory warnings when WA project fields are missing:** Same pattern as CA advisory for CSLB/WC

```typescript
// Source: Pattern from PayrollWeekDetailPage.tsx handleCaDownloadClick
function handleWaDownloadClick() {
  setShowWaDisclosure(true);  // always show
}
```

Modal text must include:
- "This PDF is a local reference copy of the F700-065-000 certified payroll form."
- "Washington public works contractors must file Statement of Intent to Pay Prevailing Wages and Affidavit of Wages Paid through the PWIA portal:"
- Link: `secure.lni.wa.gov`
- Advisory if UBI/L&I cert/WC account are missing (non-blocking)

### Anti-Patterns to Avoid
- **Using SAM.gov lookup for WA rate:** WA prevailing wages are not in SAM.gov. Never call the SAM.gov API for WA projects.
- **Hardcoding rate as 0 for WA projects:** Without a manual rate entry, all WA payroll entries will have `baseRateSnapshot: 0`, which will trip the compliance engine.
- **Assuming WA form has same PDF rotation as A-1-131:** The A-1-131 was portrait with 90-degree rotation, requiring a CTM. The WA F700 form must be physically inspected and measured. Do not assume orientation.
- **Skipping `_journal.json` registration:** Migrations not in the journal are silently skipped — already burned twice on this project.
- **Reusing the `generatingRef` or `caGeneratingRef`:** WA needs its own `waGeneratingRef` to avoid cross-download interference.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text overlay | Custom canvas/SVG rendering | pdf-lib `drawText()` | Already proven for WH-347 and A-1-131 |
| Form state watching | Manual `onChange` handlers | `watch()` from react-hook-form | Already installed; CA pattern proven |
| Download trigger | `window.open()` | Blob + `URL.createObjectURL()` | Already used for WH-347 and A-1-131; handles auth cookies |
| Double-click guard | `setTimeout` debounce | `useRef(false)` guard | Existing `generatingRef`/`caGeneratingRef` pattern |
| WA trade code list | Dynamic API call | Static constant `WA_TRADE_CODES` | Closed set; rarely changes; no API needed |
| WA wage determination | SAM.gov API call | Manual rate input from user | SAM.gov explicitly does not cover WA state wages |

---

## Common Pitfalls

### Pitfall 1: Migration Journal Not Updated
**What goes wrong:** Migration SQL files added, schema.ts updated, but `meta/_journal.json` not updated — Drizzle silently skips both migrations; columns do not exist at runtime, queries crash
**Why it happens:** Drizzle only runs migrations registered in the journal
**How to avoid:** After writing the SQL files, immediately add entries to `_journal.json` with correct `idx` (8 for WA project fields, 9 for WA manual rate), `when`, and `tag`
**Warning signs:** No error at startup; INSERT/SELECT queries return "table X has no column Y"

### Pitfall 2: F700 Template PDF Missing at Runtime
**What goes wrong:** Route crashes with `ENOENT: no such file or directory 'assets/f700-official.pdf'` at download time
**Why it happens:** Template PDF must be manually downloaded from L&I and committed to assets/
**How to avoid:** Wave 0 Task 1 must locate the official F700-065-000 PDF and save it to `assets/f700-official.pdf`. Note: the direct URL `https://lni.wa.gov/forms-publications/F700-065-000.pdf` returned 404 in research; the form may be found at the L&I forms/publications page or the PWIA system. Alternative reliable sources: construction-business-forms.com, pdffiller.com, templateroller.com — but the official L&I version should be used.
**Warning signs:** Test for `existsSync('assets/f700-official.pdf')` fails; download endpoint 500s

### Pitfall 3: WA Form PDF Orientation Unknown
**What goes wrong:** Generator writes text at wrong coordinates because the PDF uses a different page rotation than assumed
**Why it happens:** The A-1-131 appeared portrait (612x1008) but was actually rotated 90-degrees and required a CTM. The WA form must be independently measured.
**How to avoid:** Wave 0 Task 1 must measure the WA form dimensions and detect any /Rotate value in the page dictionary. Use pdfminer or the same `screenshot-pdf.mjs` tooling already in `assets/`.
**Warning signs:** Text appears at wrong angle or position in generated PDF

### Pitfall 4: WA Trade Code Not Matched — No Dropdown Provided
**What goes wrong:** Worker with a non-standard trade code gets an empty WA trade code on the F700, producing an invalid form
**Why it happens:** The `WA_TRADE_CODES` lookup does not cover every possible `tradeCode` value in `workerClassifications`
**How to avoid:** When `workerClassifications.tradeCode` is not in `WA_TRADE_CODES`, either (a) use the `waTradeCode` override column if the user set one, or (b) leave blank and show an advisory warning in the PWIA modal listing workers with unmatched codes
**Warning signs:** PDF shows blank trade code for a worker

### Pitfall 5: WA Manual Rate Not Flowing to `baseRateSnapshot`
**What goes wrong:** Payroll entries for WA workers have `baseRateSnapshot: 0` even though the user entered a WA manual rate on the classification
**Why it happens:** `upsertPayrollEntry` in `payrollService.ts` accepts `baseRateSnapshot` from the POST body, not from the classification record
**How to avoid:** `PayrollWeekForm` or `PayrollEntryPage` must pre-fill the rate from `workerClassification.waManualRate` when `isWA`; alternatively, the server upsert can look up `waManualRate` from the classification when `baseRateSnapshot` is 0 on a WA project
**Warning signs:** Compliance check shows all WA workers as under-wage violations (0 rate)

### Pitfall 6: PWIA Disclosure Not Shown Every Time
**What goes wrong:** User downloads WA F700 without seeing the PWIA portal URL
**Why it happens:** Copying WH-347 conditional preflight logic (violation-conditional, not always-on)
**How to avoid:** `handleWaDownloadClick` always calls `setShowWaDisclosure(true)` — no compliance condition check
**Warning signs:** User can download without seeing `secure.lni.wa.gov` link

### Pitfall 7: WA Button Appears on CA Projects (or Vice Versa)
**What goes wrong:** User on a CA project sees the WA button, or WA project sees the CA button
**Why it happens:** Using `isCA` variable for WA button logic, or vice versa
**How to avoid:** `isWA = projectData?.data?.project?.state === 'WA'` derived from the same `projectData` query already in `PayrollWeekDetailPage`. Both buttons coexist in the header area, each gated on their own state check.
**Warning signs:** CA project shows WA button; WA project shows CA button

---

## Code Examples

### Existing A-1-131 export route to mirror for WA (source pattern)
```typescript
// Source: src/server/routes/export.ts lines 200-311
// The WA route follows this EXACT pattern with these changes:
//   1. project.state !== 'WA' instead of 'CA'
//   2. Maps ubiNumber, lniCertificate, wcAccount from project
//   3. Maps waTradeCode from each workerClassification
//   4. No DT fields needed (WA form has ST/OT only)
//   5. templatePath = 'assets/f700-official.pdf'
//   6. Filename: f700-${week.payrollNumber}.pdf
router.get('/f700/:weekId', async (req, res) => {
  // ... same ownership check as a1131 route ...
  if (project.state !== 'WA') {
    res.status(400).json({ error: 'F700-065-000 is only available for Washington projects' });
    return;
  }
  // ...
});
```

### WA PWIA disclosure modal (mirrors CA eCPR modal)
```typescript
// Source: PayrollWeekDetailPage.tsx showCaDisclosure modal (Phase 24)
// Mirror this structure with WA-specific text:
{showWaDisclosure && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
       onClick={() => setShowWaDisclosure(false)}>
    <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl"
         onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-headline font-bold text-gray-900">
        Washington F700-065-000 — Important Notice
      </h3>
      <div className="mt-3 space-y-3 text-sm text-gray-700">
        <p>This PDF is a local reference copy of the L&I F700-065-000 certified payroll form.</p>
        <p className="font-medium text-blue-800">
          Washington public works contractors must file Statement of Intent to Pay Prevailing
          Wages and Affidavit of Wages Paid through the PWIA portal:
        </p>
        <a href="https://secure.lni.wa.gov" target="_blank" rel="noopener noreferrer"
           className="block text-center font-medium text-blue-600 underline">
          secure.lni.wa.gov
        </a>
        {/* Advisory if WA fields missing — non-blocking */}
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button onClick={() => setShowWaDisclosure(false)}>Cancel</button>
        <Button onClick={handleWaConfirmedDownload}>Download PDF</Button>
      </div>
    </div>
  </div>
)}
```

### WA manual rate in ProjectData interface (PayrollWeekDetailPage)
```typescript
// Extend existing ProjectData interface in PayrollWeekDetailPage.tsx:
interface ProjectData {
  id: string;
  state: string;
  name: string;
  cslbLicense: string | null;
  wcPolicyNumber: string | null;
  // Phase 25 additions:
  ubiNumber: string | null;
  lniCertificate: string | null;
  wcAccount: string | null;
}
```

---

## WA L&I Form Field Inventory

Based on research from multiple secondary sources (MEDIUM confidence — coordinates require measurement at execution time against `assets/f700-official.pdf`).

### Header Fields
| Field | Notes |
|-------|-------|
| Contractor Name | |
| Contractor Address | |
| **UBI Number** | Washington 9-digit Unified Business Identifier — WA-specific |
| **L&I Contractor Certificate #** | WA-specific |
| **Workers' Compensation Account #** | WA-specific (L&I industrial insurance account) |
| Project Name | |
| Project Location | |
| Contract / Bid # | |
| Week Ending Date | |
| Payroll Number | |

### Worker Grid (per worker row)
| Column | Notes |
|--------|-------|
| Worker Name | |
| Address | |
| SSN / ID | SSN last 4 (privacy-safe default) |
| J / RA | Journeyworker or Registered Apprentice |
| **Trade Code** | 4-letter WA L&I code (CARP, ELEC, LABO, etc.) — WA-specific |
| Straight Time Rate | Base prevailing wage rate |
| Hourly Rate of Usual Benefits | Fringe rate |
| Mon ST | |
| Tue ST | |
| Wed ST | |
| Thu ST | |
| Fri ST | |
| Sat ST | |
| Sun ST | (if applicable) |
| OT Hours | Total overtime (1.5x after 40 hrs/week) |
| Gross Wages This Project | |
| Deductions (itemized) | Federal tax, state tax, other |
| Net Pay | |

### Certification Section
| Field | Notes |
|-------|-------|
| Certifying signature | RCW 39.12.020 penalty of perjury |
| Title | |
| Date | |
| **PWIA portal disclosure** | Required: `secure.lni.wa.gov` — Intent to Pay and Affidavit of Wages |

---

## WA L&I Trade Code Reference

Confirmed from multiple secondary sources (MEDIUM confidence). Full official list must be validated from WA L&I prevailing wage determinations at `lni.wa.gov/licensing-permits/public-works-projects/prevailing-wage-rates/`.

| Code | Trade | Source |
|------|-------|--------|
| BOIL | Boilermakers | points-north.com |
| CARP | Carpenters | points-north.com, workyard.com |
| ELCO | Electricians (Outside/Line) | points-north.com |
| ELEC | Electricians (Inside) | points-north.com, workyard.com |
| GLAZ | Glaziers | points-north.com |
| IRON | Ironworkers | points-north.com, workyard.com |
| LABO | Laborers | points-north.com, workyard.com |
| MASO | Masons | prevailing wage determinations (common) |
| OPER | Operating Engineers | prevailing wage determinations (common) |
| PAIN | Painters | points-north.com, workyard.com |
| PFRT | Pile Drivers | prevailing wage determinations |
| PLAS | Plasterers | prevailing wage determinations |
| PLUM | Plumbers and Pipefitters | points-north.com, workyard.com |
| ROOF | Roofers | points-north.com, workyard.com |
| SHEE | Sheet Metal Workers | prevailing wage determinations |
| TEAM | Teamsters | prevailing wage determinations |

**Note on auto-match vs. manual select:** The `workerClassifications.tradeCode` field in the app is a free-text field set when the worker is classified. On WA projects, this code may or may not match a WA L&I 4-letter code. The app should:
1. Check if `tradeCode` exactly matches a key in `WA_TRADE_CODES`
2. If matched, use it directly as the WA trade code on the F700
3. If not matched, use `waTradeCode` override from the DB if set, or leave blank and warn

---

## WA-Specific Business Definitions

| Term | Definition | Required On Form |
|------|------------|-----------------|
| UBI Number | Washington 9-digit Unified Business Identifier (Unified Business Identifier) — issued by WA Secretary of State; required for all businesses operating in WA | Yes — header |
| L&I Contractor Certificate | Washington Department of Labor & Industries contractor registration certificate number | Yes — header |
| WC Account | Workers' Compensation industrial insurance account number issued by L&I | Yes — header |
| PWIA | Prevailing Wage Intent and Affidavit system — the online portal at `secure.lni.wa.gov` used to file Intent to Pay and Affidavit of Wages; weekly certified payroll reports are also filed here | Disclosure required |
| WA OT Rule | Overtime at 1.5x after 40 hours/week (RCW 49.28.010); no daily OT trigger in WA public works; no DT row needed on F700 | Informs form design |

---

## Phase 24 Pattern Reuse Summary

The following elements from Phase 24 (CA A-1-131) are reused verbatim in Phase 25 (WA F700):

| CA Pattern | WA Reuse | Difference |
|-----------|----------|------------|
| `isCA = project.state === 'CA'` | `isWA = project.state === 'WA'` | State check |
| CA conditional fields in `ProjectForm.tsx` | WA conditional fields in `ProjectForm.tsx` | Different fields (UBI/cert/WC vs CSLB/WC) |
| `showCaDisclosure` + `caGeneratingRef` | `showWaDisclosure` + `waGeneratingRef` | Parallel, non-interfering |
| `GET /api/export/a1131/:weekId` state gate | `GET /api/export/f700/:weekId` state gate | State === 'WA' |
| `fillA1131()` with CTM and landscape layout | `fillF700()` — layout TBD from measurement | Coordinates differ |
| eCPR modal always-on | PWIA modal always-on | Same pattern; WA-specific text and URL |
| `assets/a1131-official.pdf` | `assets/f700-official.pdf` | Different template |
| Migrations idx 6/7 | Migrations idx 8/9 | Next available indices |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Paper F700-065-000 / mail submission | PWIA portal (`secure.lni.wa.gov`) for Intent + Affidavit; PDF for records | Effective 2020 (mandatory online filing) | Generated PDF is contractor local record only; portal is mandatory |
| SAM.gov rate lookups for state projects | Manual rate entry from WA L&I determinations | N/A — SAM.gov never covered WA state wages | WAL-01 design: manual input required |

**Deprecated/outdated:**
- Paper-only F700-065-000 submission: WA now requires online PWIA portal filing. The generated PDF serves as the contractor's working copy.
- Pre-2020 paper Intent to Pay forms: Mandatory online filing since January 1, 2020.

---

## Open Questions

1. **Official F700-065-000 PDF location**
   - What we know: The direct URL `https://lni.wa.gov/forms-publications/F700-065-000.pdf` returned 404. The form is referenced extensively online but the canonical L&I download link is unclear.
   - What's unclear: Current form version, exact URL on lni.wa.gov
   - Recommendation: Wave 0 Task 1 — search `lni.wa.gov/forms-publications/` for the form; check L&I's forms A-Z index; failing that, use the version from construction-business-forms.com or pdffiller.com (both reference the official form). The form must be saved to `assets/f700-official.pdf` before any generator code runs.

2. **F700 form PDF rotation / AcroForm status**
   - What we know: WH-347 is a flat PDF. A-1-131 was portrait with 90-degree rotation requiring CTM. WA form is unknown.
   - What's unclear: Whether the WA form is landscape/portrait, whether it has AcroForm fields, exact page dimensions.
   - Recommendation: Wave 0 Task 1 must open the PDF, check `/Rotate` in page dictionary, measure dimensions. If AcroForm fields exist (unlike WH-347 and A-1-131), consider using `pdfDoc.getForm()` — but coordinate overlay is still preferred for visual reliability.

3. **WA trade code dropdown — stored in DB or passed as query param?**
   - What we know: Success Criterion 4 requires a dropdown for unmatched trade codes. Two implementation options: (a) store `waTradeCode` on `workerClassifications` as a persistent override, or (b) accept it as a query param on the download route.
   - What's unclear: Which approach the planner will prefer.
   - Recommendation: Store `waTradeCode` in the DB (add to migration `0013_wa_manual_rate.sql`) — this is more consistent with how classifications work and avoids complex URL parameter passing. Add `wa_trade_code TEXT` to the same migration as `wa_manual_rate`.

4. **WA manual rate entry location — Workers page or Payroll Entry page?**
   - What we know: Workers have classifications with trade codes. The rate needs to be per-classification (different trades have different prevailing rates).
   - What's unclear: Which page is the right UX location.
   - Recommendation: `WorkersPage.tsx` when adding/editing a classification (same place where `tradeCode` and `tradeDescription` are entered). Show the rate field only when the parent project is WA.

5. **Full list of WA L&I trade codes**
   - What we know: 16 codes identified from secondary sources (see table above). May not be exhaustive.
   - What's unclear: Whether the full list matches what appears in WA prevailing wage determinations.
   - Recommendation: Use the 16 confirmed codes as the initial `WA_TRADE_CODES` constant. Add a comment noting the list should be validated against current L&I determinations. The dropdown for unmatched codes (Success Criterion 4) handles any gap.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (version from vitest.config.ts) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/routes/export.test.ts tests/services/a1131.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WAL-01 | POST /api/projects/:id/workers/:id/classifications accepts waManualRate for WA project | route/integration | `npx vitest run tests/routes/workers.test.ts` | Existing file; add describe block |
| WAL-01 | WorkerClassification row stores waManualRate when created on WA project | route/integration | `npx vitest run tests/routes/workers.test.ts` | Wave 0 additions needed |
| WAL-02 | `fillF700()` returns valid PDF bytes when given valid F700Data | service/unit | `npx vitest run tests/services/f700.test.ts` | Wave 0 new file |
| WAL-02 | GET /api/export/f700/:weekId returns 400 for non-WA project | route/integration | `npx vitest run tests/routes/export.test.ts` | Existing file; add describe block |
| WAL-02 | GET /api/export/f700/:weekId returns PDF for WA project | route/integration | `npx vitest run tests/routes/export.test.ts` | Existing file; add describe block |
| WAL-02 | GET /api/export/f700/:weekId returns 403 for unauthorized access | route/integration | `npx vitest run tests/routes/export.test.ts` | Existing file; add describe block |
| WAL-02 | GET /api/export/f700/:weekId returns 404 for non-existent week | route/integration | `npx vitest run tests/routes/export.test.ts` | Existing file; add describe block |
| WAL-02 | CA project has no WA button (state gate) | route/integration | `npx vitest run tests/routes/export.test.ts` | Existing file |
| WAL-02 | WA project fields (ubiNumber, lniCertificate, wcAccount) saved and returned | route/integration | `npx vitest run tests/routes/projects.test.ts` | Existing file; add describe block |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/routes/export.test.ts tests/routes/projects.test.ts tests/services/wh347.test.ts tests/services/a1131.test.ts` (regression check — verifies WH-347 and CA A-1-131 flows unbroken)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/f700.test.ts` — new file covering `fillF700()` for WAL-02 (mirrors `a1131.test.ts` structure exactly)
- [ ] `tests/routes/export.test.ts` — add `describe('GET /api/export/f700/:weekId - WAL-02', ...)` block (5 tests mirroring the a1131 describe block at lines 90-152)
- [ ] `tests/routes/projects.test.ts` — add describe block for WAL-02 WA project fields (ubiNumber, lniCertificate, wcAccount)
- [ ] `tests/routes/workers.test.ts` — add WAL-01 tests for waManualRate on classification create
- [ ] `assets/f700-official.pdf` — download from lni.wa.gov (see Open Question 1 for URL investigation steps)

---

## Sources

### Primary (HIGH confidence)
- `src/server/services/a1131Generator.ts` — established PDF overlay pattern for state forms; WA generator mirrors this exactly
- `src/server/routes/export.ts` — established export route pattern; WA route added here
- `src/client/pages/PayrollWeekDetailPage.tsx` — CA download button + eCPR modal pattern; WA mirrors this
- `src/client/components/projects/ProjectForm.tsx` — CA conditional field pattern; WA `isWA` mirrors `isCA`
- `src/server/db/schema.ts` — current schema; confirmed no WA columns exist; next migration idx is 8
- `src/server/db/migrations/meta/_journal.json` — current highest idx is 7 (`0011_payroll_entries_double_time`); WA takes idx 8 and 9
- `.planning/phases/24-california-dir-a-1-131-form/24-03-SUMMARY.md` — Phase 24 implementation summary; confirms CA patterns are proven

### Secondary (MEDIUM confidence)
- [points-north.com — Washington Prevailing Wage: Apprenticeship Tracking and Craft Codes](https://www.points-north.com/state-by-state-certified-payroll-reporting/washington) — confirmed trade codes BOIL, CARP, ELEC, GLAZ, IRON, LABO, PAIN, PLUM, ROOF; F700-065-000 required field list
- [lni.wa.gov — Contractors / Employers](https://lni.wa.gov/licensing-permits/public-works-projects/contractors-employers/) — confirmed UBI number and industrial insurance coverage requirements; PWIA portal at `secure.lni.wa.gov`
- [procore.com — Prevailing Wages Washington](https://www.procore.com/library/prevailing-wages-washington) — confirmed PWIA portal for Intent to Pay / Affidavit; weekly filing since Jan 1, 2020
- [informedcontractors.com — F700-065-000](https://www.informedcontractors.com/F700-065-000-washington-certified-payroll-report.html) — confirmed required fields (name, address, SSN, trade/occupation, ST rate, benefits rate, hours/OT); governed by RCW 39.04.010, 39.12.010, 39.12.020
- REQUIREMENTS.md / ROADMAP.md — WAL-01/WAL-02 definitions and success criteria (authoritative for this project)

### Tertiary (LOW confidence)
- [construction-business-forms.com — F700-065-000](https://www.construction-business-forms.com/70cepareforw.html) — confirms form prints on 8.5x11; form structure partially described; not authoritative for field coordinates
- Various certified payroll software vendor pages — general WA trade code mentions; not verified against official L&I list

---

## Metadata

**Confidence breakdown:**
- Architecture patterns: HIGH — mirrors proven Phase 24 CA pattern; same stack, same approach
- Schema migration: HIGH — current schema fully examined; next idx confirmed as 8
- WA trade codes: MEDIUM — 16 codes confirmed from multiple secondary sources; full official list not verified
- F700 form structure: MEDIUM — field types confirmed from multiple sources; exact PDF coordinates and page orientation are LOW until form is physically inspected
- PWIA portal disclosure requirement: HIGH — confirmed from multiple authoritative sources; mandatory since 2020
- WA OT rules (no DT): MEDIUM — RCW 49.28.010 does not have a DT threshold; confirmed no DT column needed on F700

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (stable government form; WA L&I trade codes updated annually with prevailing wage determinations)

**Critical pre-execution blockers:**
1. The blank `assets/f700-official.pdf` must be located and downloaded before `f700Generator.ts` can be written or tested.
2. The PDF must be inspected for rotation (`/Rotate` value) and page dimensions before writing any coordinate constants.
3. The `WA_TRADE_CODES` constant should be validated against at least one current WA L&I prevailing wage determination before the phase ships.
