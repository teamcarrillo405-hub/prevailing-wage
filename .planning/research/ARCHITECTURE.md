# Architecture Research

**Domain:** State-portal export integration — CA eCPR XML and WA PWIA submission assist (v2.5)
**Researched:** 2026-03-26
**Confidence:** HIGH — existing code directly inspected; CA CPR.xsd and WA xmlschema.xsd fetched from official portals

---

## v2.5 Integration Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  React Client (PayrollWeekDetailPage.tsx)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ CA eCPR      │  │ WA Submit    │  │ Existing PDF buttons   │  │
│  │ XML button   │  │ Assist button│  │ WH-347, A-1-131, F700  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────────┘  │
│         │  updated CA     │  new WA                               │
│         ▼  disclosure     ▼  assist modal                         │
│  handleCaEcprDownload  handleWaAssistClick                        │
│  → fetch /api/export/  → fetch /api/export/                       │
│    ecpr-xml/:weekId      wa-assist/:weekId                        │
└──────────────────────┬───────────────────────────────────────────┘
                       │ HTTP (fetch→Blob→anchor for XML;
                       │       fetch→JSON→setState for WA assist)
┌──────────────────────▼───────────────────────────────────────────┐
│  Express  src/server/routes/export.ts  (existing router)         │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ GET /api/export/ecpr-xml/:weekId   NEW — CA XML download │    │
│  │ GET /api/export/wa-assist/:weekId  NEW — WA JSON prefill │    │
│  │ GET /api/export/wh347/:weekId      existing              │    │
│  │ GET /api/export/a1131/:weekId      existing              │    │
│  │ GET /api/export/f700/:weekId       existing              │    │
│  └───────────────────┬──────────────────────────────────────┘    │
│                      │                                           │
│  ┌───────────────────▼──────────────────────────────────────┐    │
│  │  Services (src/server/services/)                         │    │
│  │  ecprXmlGenerator.ts  NEW — pure XML builder             │    │
│  │  waAssistFormatter.ts NEW — pure PWIA data assembler     │    │
│  │  a1131Generator.ts    existing — NOT modified            │    │
│  │  f700Generator.ts     existing — NOT modified            │    │
│  └───────────────────┬──────────────────────────────────────┘    │
│                      │                                           │
└──────────────────────┼───────────────────────────────────────────┘
                       │ Drizzle ORM
┌──────────────────────▼───────────────────────────────────────────┐
│  SQLite                                                          │
│  payroll_entries  workers  worker_classifications  projects       │
│  No schema changes required — all fields already present         │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Integrates With |
|-----------|---------------|-----------------|
| `ecprXmlGenerator.ts` (NEW) | Build CA eCPR v1.3 XML string from typed EcprData — pure function, no I/O | `export.ts` route |
| `waAssistFormatter.ts` (NEW) | Assemble WA PWIA prefill data object — pure function, returns typed JSON | `export.ts` route |
| `export.ts` route (MODIFIED) | Two new GET handlers following identical 8-step ownership/load/generate/respond pattern | Both services, `payrollService` |
| `payrollService.ts` (MODIFIED) | Add `getPayrollEntriesWithWorkerDetails()` — extends join to include `ssnLast4`, `address`, `waTradeCode`, `tradeCode` | Both new routes |
| `PayrollWeekDetailPage.tsx` (MODIFIED) | CA: new XML download handler + updated CA modal; WA: new assist button + prefill panel modal | TanStack Query / fetch |

---

## Recommended Project Structure

```
src/
├── server/
│   ├── routes/
│   │   └── export.ts              # ADD: /ecpr-xml/:weekId, /wa-assist/:weekId
│   └── services/
│       ├── ecprXmlGenerator.ts    # NEW: CA eCPR v1.3 XML builder
│       ├── waAssistFormatter.ts   # NEW: WA PWIA submission data assembler
│       ├── payrollService.ts      # ADD: getPayrollEntriesWithWorkerDetails()
│       ├── a1131Generator.ts      # UNCHANGED
│       └── f700Generator.ts       # UNCHANGED
└── client/
    └── pages/
        └── PayrollWeekDetailPage.tsx  # MODIFY: CA XML button, WA assist modal
```

No new route files. No new pages. No DB migrations.

### Structure Rationale

- **ecprXmlGenerator.ts as a sibling service:** Follows the same pattern as `a1131Generator.ts`. The PDF generator does PDF rendering; the XML generator does XML building. Same module boundary, different output format. Both are pure functions testable without Express.
- **waAssistFormatter.ts separate from f700Generator.ts:** F700 is a PDF form renderer. PWIA submission assist is a data assembly task — it returns a JSON-serializable object, not file bytes. Mixing these concerns into one file would require two different import shapes in the route.
- **No new router file:** All export endpoints share auth middleware and the ownership guard pattern already in `export.ts`. Adding ~150 lines to an existing 510-line file is appropriate. Splitting into a new router adds an `index.ts` import for minimal benefit.
- **getPayrollEntriesWithWorkerDetails() in payrollService.ts:** Both new routes need fields not selected by the existing `getPayrollEntries()`. Adding a new exported function is cleaner than the `(row as any).waTradeCode` cast already in the F700 handler — and this is the moment to resolve that existing hack as a side effect.

---

## New vs Modified Files — Explicit List

### New Files

| File | Purpose |
|------|---------|
| `src/server/services/ecprXmlGenerator.ts` | CA eCPR v1.3 XML builder — `generateEcprXml(data: EcprData): string` |
| `src/server/services/waAssistFormatter.ts` | WA PWIA prefill assembler — `formatWaAssistData(input: WaAssistInput): WaAssistOutput` |

### Modified Files

| File | Change |
|------|--------|
| `src/server/routes/export.ts` | Add `GET /ecpr-xml/:weekId` (~75 lines) and `GET /wa-assist/:weekId` (~60 lines) after existing F700 handler |
| `src/server/services/payrollService.ts` | Add `getPayrollEntriesWithWorkerDetails()` — same join as `getPayrollEntries()` plus `workers.ssnLast4`, `workers.address`, `workerClassifications.waTradeCode`, `workerClassifications.tradeCode` |
| `src/client/pages/PayrollWeekDetailPage.tsx` | Add CA XML download handler + `caEcprGeneratingRef`; update CA disclosure modal to offer XML option; add WA assist button + `showWaAssistModal` state + prefill panel |

### No Changes Required

| File | Why untouched |
|------|--------------|
| `src/server/services/a1131Generator.ts` | CA eCPR XML is a different output — A-1-131 PDF is unaffected |
| `src/server/services/f700Generator.ts` | WA submission assist is separate from F700 PDF rendering |
| `src/server/index.ts` | `exportRouter` already mounted at `/api/export` — no new mount needed |
| `src/server/db/schema.ts` | All required fields already present as of v2.4 |

---

## Architectural Patterns

### Pattern 1: New Route Handler in Existing export.ts

**What:** Each new export follows the identical 8-step pattern already established by `/a1131/:weekId` and `/f700/:weekId`:
1. Load payroll week by `weekId`
2. Verify project ownership (`project.userId === req.user.userId`)
3. State gate (`project.state === 'CA'` or `'WA'`)
4. Load entries with extended join
5. Map to typed data object
6. Call generator/formatter function
7. Set response headers
8. Send response

**When to use:** Any new export that shares this auth + ownership model — always true for payroll exports.

**Trade-offs:** Handlers are 60-80 lines each. All duplication is in the auth/guard preamble, which is intentional — the ownership check must not be abstracted away in a way that makes it easy to skip.

**Example (eCPR XML handler shape):**
```typescript
router.get('/ecpr-xml/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const userId = req.user!.userId;
  const week = await getPayrollWeek(weekId);
  if (!week) { res.status(404).json({ error: 'Payroll week not found' }); return; }
  const db = getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, week.projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.userId !== userId) { res.status(403).json({ error: 'Access denied' }); return; }
  if (project.state !== 'CA') { res.status(400).json({ error: 'eCPR XML is only available for California projects' }); return; }
  const entries = await getPayrollEntriesWithWorkerDetails(weekId);
  const ecprData: EcprData = mapToEcprData(week, project, entries);
  const xmlString = generateEcprXml(ecprData);
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="ecpr-${week.payrollNumber}.xml"`);
  res.end(xmlString);
});
```

### Pattern 2: Pure Service — ecprXmlGenerator.ts

**What:** `generateEcprXml(data: EcprData): string` — builds a CA eCPR v1.3 XML document as a string. No PDF library needed. Uses template literals or simple string concatenation — the XSD has no conditional nesting; all 500 possible employee records are structurally identical.

**Why server-side (not client-side):** (1) SSN data — even the 4-digit placeholder — must not be sent to the client. (2) All existing exports are server-side — consistency. (3) XSD validation belongs server-side. The client already omits `ssnLast4` from its `PayrollWeekDetailResponse`.

**Trade-offs:** String concatenation is brittle but the CA eCPR schema is shallow (3 levels max). A library like `xmlbuilder2` would be cleaner but violates the "no new libraries" constraint. The schema is fixed by DIR — it does not change frequently enough to justify a builder dependency.

**CA eCPR v1.3 data mapping (from CPR.xsd, fetched 2026-03-26):**

| eCPR XML Element | DB Source | Gap |
|-----------------|-----------|-----|
| `contractorName` | `projects.name` | — |
| `contractorFEIN` | Not in DB | Gap #1 |
| `contractorPWCR` | Not in DB (output "NA") | Gap #1 |
| `contractorLicense.licenseNum` | `projects.cslbLicense` | — |
| `contractorLicense.licenseType` | "CSLB" | — |
| `insuranceNum` | `projects.wcPolicyNumber` | — |
| `contractorEmail` | Not in DB (output empty string) | Gap #1 |
| `contractorAddress.street/city/state/zip` | `projects.county + state` (partial) | Gap #1 |
| `contractAgency` | Not in DB — must be user-entered | Gap #1 |
| `projectID` | Not in DB — DIR-assigned numeric ID | Gap #1 |
| `forWeekEnding` | `payrollWeeks.weekEndingDate` (YYYY-MM-DD) | — |
| `payrollNum` | `payrollWeeks.payrollNumber` | — |
| `statementOfNP` | "false" (always — this route only runs if entries exist) | — |
| `employee.ssn` | `workers.ssnLast4` as "000000XXX" placeholder | Gap #2 |
| `employee.address.street` | `workers.address` (full string, truncate to 40 chars) | partial |
| `employee.workClass` | `workerClassifications.tradeDescription` | — |
| `employee.numWithholdingExemp` | "0" — not collected | Gap #3 |
| `payroll.hrsWorkedEachDay.day[1-7].date` | derive from `weekEndingDate` — 7 days back | — |
| `payroll.hrsWorkedEachDay.day[n].straightTime` | `payrollEntries.monSt`...`sunSt` | — |
| `payroll.hrsWorkedEachDay.day[n].overtime` | `payrollEntries.monOt`...`sunOt` | — |
| `payroll.hrsWorkedEachDay.day[n].doubletime` | `payrollEntries.monDt`...`sunDt` | — |
| `payroll.totHrs.totHrsStraightTime` | sum of daily ST | — |
| `payroll.totHrs.totHrsOvertime` | sum of daily OT | — |
| `payroll.totHrs.totHrsDoubletime` | sum of daily DT | — |
| `payroll.hrlyPayRate.hrlyPayRateStraightTime` | `payrollEntries.baseRateSnapshot` | — |
| `payroll.hrlyPayRate.hrlyPayRateOvertime` | `baseRateSnapshot * 1.5` | — |
| `payroll.hrlyPayRate.hrlyPayRateDoubletime` | `baseRateSnapshot * 2.0` | — |
| `payroll.grossAmountEarned.thisProject` | `payrollEntries.grossWages ?? 0` | — |
| `payroll.grossAmountEarned.allWork` | same as thisProject (single-project app) | — |
| `payroll.deductionsContribPay.fedTax` | 0 — not collected | Gap #3 |
| `payroll.deductionsContribPay.FICA` | 0 | Gap #3 |
| `payroll.deductionsContribPay.stateTax` | 0 | Gap #3 |
| `payroll.deductionsContribPay.SDI` | 0 | Gap #3 |
| `payroll.deductionsContribPay.total` | `payrollEntries.deductions` | — |
| `payroll.netWagePaidWeek` | `payrollEntries.netPay ?? 0` | — |
| `payroll.checkNum` | "DIRECT DEPOSIT" — default | — |

### Pattern 3: WA Submission Assist as JSON Response

**What:** `GET /api/export/wa-assist/:weekId` returns JSON (not a file). The client renders a read-only prefill panel inside a modal — the contractor copies values into the PWIA portal manually. No Blob download needed.

**Why JSON rather than a downloadable XML file:** The WA PWIA XML upload path (`xmlschema.xsd`) requires a full 9-digit SSN, a previously-filed `intentId`, and separately-parsed address components. These gaps (Gap #2, Gap #4) make a valid uploadable XML impossible with current data. A JSON prefill guide is honest about what the app can supply and what the contractor must provide.

**WA PWIA data mapping (from xmlschema.xsd, fetched 2026-03-26):**

| PWIA XML Field | DB Source | Gap |
|---------------|-----------|-----|
| `intentId` | Not in DB — contractor must supply their PWIA intent filing number | Gap #4 |
| `endOfWeekDate` | `payrollWeeks.weekEndingDate` | — |
| `employee.firstName/lastName` | `workers.name` (split on last space) | — |
| `employee.ssn` | `workers.ssnLast4` shown as "XXX-XX-XXXX" masked — user must supply full SSN in portal | Gap #2 |
| `employee.address1` | `workers.address` (truncate) | partial |
| `employee.city/state/zip` | Not parsed from address string | partial |
| `employee.grossPay` | `payrollEntries.grossWages ?? 0` | — |
| `tradeHoursWage.trade` | `workerClassifications.waTradeCode ?? workerClassifications.tradeCode` | — |
| `tradeHoursWage.county` | `projects.county` (must match WA county enum — already stored as entered) | — |
| `tradeHoursWage.regularHourRateAmt` | `payrollEntries.baseRateSnapshot` | — |
| `tradeHoursWage.overtimeHourRateAmt` | `baseRateSnapshot * 1.5` | — |
| `tradeHoursWage.regularDay1-7Hours` | `payrollEntries.monSt`...`sunSt` | — |
| `tradeHoursWage.overtimeDay1-7Hours` | `payrollEntries.monOt`...`sunOt` | — |
| `tradeHoursWage.hourlyPensionRateAmt` | `payrollEntries.fringeRateSnapshot` (mapped to pension; can't split fringe by type) | partial |
| `tradeHoursWage.hourlyMedicalAmt` | 0 — fringe not broken down | partial |
| `tradeHoursWage.apprenticeFlg` | `workerClassifications.laborType === 'apprentice'` | — |
| `tradeHoursWage.apprenticeId` | `workerClassifications.programName` (program name, not individual reg ID) | Gap #5 |
| `ubiNumber` (project-level) | `projects.ubiNumber` | — |
| `lniCertificate` (project-level) | `projects.lniCertificate` | — |
| `wcAccount` (project-level) | `projects.wcAccount` | — |

---

## Data Flow

### CA eCPR XML Export Flow

```
User clicks "Download CA eCPR XML"
    ↓
handleCaEcprDownload() [new handler in PayrollWeekDetailPage.tsx]
    ↓ (uses updated CA disclosure modal — adds XML option alongside PDF button)
if (caEcprGeneratingRef.current) return;  ← double-click guard (same as existing)
caEcprGeneratingRef.current = true;
    ↓
fetch('/api/export/ecpr-xml/' + weekId, { credentials: 'include' })
    ↓
export.ts: GET /ecpr-xml/:weekId
  1. getPayrollWeek(weekId)
  2. verify project.userId === req.user.userId
  3. project.state === 'CA' or 400
  4. getPayrollEntriesWithWorkerDetails(weekId)
  5. mapToEcprData(week, project, entries) → EcprData
  6. generateEcprXml(ecprData) → string
  7. Content-Type: application/xml
  8. res.end(xmlString)
    ↓
Client: res.blob() → URL.createObjectURL → hiddenAnchorRef.current.download = 'ecpr-N.xml'
→ hiddenAnchorRef.current.click() → setTimeout(revokeObjectURL, 100)
← Same hiddenAnchorRef used by all existing downloads — no second anchor element
```

### WA Submission Assist Flow

```
User clicks "WA Submission Assist" button (new, alongside existing "Download WA F700")
    ↓
handleWaAssistClick() → setShowWaAssistModal(true)
    ↓ (modal opens immediately; fetch happens inside modal on mount or button confirm)
fetch('/api/export/wa-assist/' + weekId, { credentials: 'include' })
    ↓
export.ts: GET /wa-assist/:weekId
  1. getPayrollWeek(weekId)
  2. verify ownership
  3. project.state === 'WA' or 400
  4. getPayrollEntriesWithWorkerDetails(weekId)
  5. formatWaAssistData(week, project, entries) → WaAssistOutput
  6. res.json(assistOutput)
    ↓
Client: setWaAssistData(json)
→ modal renders prefill panel:
    - Project fields (UBI, L&I cert, WA account, county)
    - Per-worker rows: name, trade code, hours by day (Mon-Sun), rates, gross pay, fringe
    - Gap warnings: SSN masked, intentId must be supplied, address components
→ No file download — contractor copies values into PWIA portal manually
```

### Extended Join — getPayrollEntriesWithWorkerDetails

The existing `getPayrollEntries()` at `payrollService.ts` line 226 selects:
```
entry, workerName, tradeDescription, laborType, programName
```

The new `getPayrollEntriesWithWorkerDetails()` adds:
```
ssnLast4: workers.ssnLast4
workerAddress: workers.address
tradeCode: workerClassifications.tradeCode
waTradeCode: workerClassifications.waTradeCode
```

This also resolves the `(row as any).waTradeCode` cast hack currently in the F700 handler (export.ts line 371) as a side effect — the F700 handler can be updated to use the typed version.

---

## Identified Gaps (with mitigations)

### Gap #1: Missing CA eCPR required fields — FEIN, PWCR, contractAgency, projectID

The CA CPR.xsd requires `contractorFEIN` (9-digit), `contractorPWCR` (DIR registration, 10-digit or "NA"), `contractAgency` (awarding body name), and `projectID` (DIR-assigned numeric ID). None are in the `projects` table.

**v2.5 mitigation:** Collect the three most critical fields (`contractorFEIN`, `contractAgency`, `projectID`) in the CA disclosure modal at download time as a one-time form — no DB change. Output `contractorPWCR = "NA"` (schema allows). Add prominent modal warning that these fields must be filled correctly before uploading to the DIR portal. The contractor must edit `contractorFEIN` in the downloaded XML if supplying a real FEIN is required.

**Future enhancement:** Add `contractorFein`, `dirContractAgency`, `dirProjectId` as optional columns on `projects` (add-only migration) so they persist across downloads.

### Gap #2: Full SSN not stored — blocks validated XML upload to both portals

Both CA eCPR and WA PWIA XML schemas require 9-digit SSN. The app stores only `ssnLast4`. This is intentional.

**v2.5 mitigation:** In CA XML: output `000000XXX` where XXX = `ssnLast4`. In WA assist JSON: show `XXX-XX-XXXX` masked display. Both are accompanied by a disclosure warning that contractors must supply full SSNs manually before uploading to the portal. Do not collect full SSNs in v2.5 — this requires a privacy review and encrypted storage at rest.

### Gap #3: Deduction breakdown not captured — eCPR wants itemized deductions

CA eCPR schema has 13 itemized deduction fields (fedTax, FICA, stateTax, SDI, vacationHoliday, healthWelfare, pension, training, fundAdmin, dues, travelSubs, savings, other). The app stores one `deductions` total.

**v2.5 mitigation:** Output 0 for all line items except `other` (set to `deductions` total) and `total` (set to `deductions`). Add disclosure in modal that itemized breakdown is not available and contractor should verify before uploading.

### Gap #4: WA intentId not stored — required for PWIA XML upload

The PWIA XML schema root requires `intentId` — the ID from the contractor's previously-filed Statement of Intent to Pay Prevailing Wages. Not in DB.

**v2.5 mitigation:** Display `intentId` as a prominently labeled blank field in the WA assist panel with instructions on where to find it. Future: add `waIntentId` as optional column on `projects`.

### Gap #5: WA apprentice registration ID not stored

PWIA XML `apprenticeId` (individual apprentice program registration number) differs from `programName`. App stores `programName` only.

**v2.5 mitigation:** In WA assist panel, show `programName` as the apprentice program field with a label clarifying the PWIA portal needs the individual apprentice registration number from the approved apprenticeship program. Leave the `apprenticeId` assist field blank with an inline note.

---

## Anti-Patterns

### Anti-Pattern 1: Extending a1131Generator.ts to produce XML

**What people do:** Add XML output to the existing CA export service since it's already CA-specific.
**Why it's wrong:** `a1131Generator.ts` is a pdf-lib PDF renderer with coordinate constants. Mixing in XML string generation creates a module with two unrelated responsibilities and different import shapes. The PDF generator imports pdf-lib; the XML generator imports nothing. They have zero code overlap.
**Do this instead:** `ecprXmlGenerator.ts` as a sibling service file.

### Anti-Pattern 2: Client-side XML generation

**What people do:** Use the payroll data already in TanStack Query cache on the client to build the XML in the browser.
**Why it's wrong:** (1) The client data shape intentionally omits `ssnLast4` and `address`. (2) XSD validation is a server concern. (3) All 5 existing exports are server-side — breaking that pattern without a strong reason is a maintenance liability. (4) Content-Disposition and Content-Type headers must come from the server for reliable browser download behavior.
**Do this instead:** Server-side generation, identical download UX (fetch → Blob → anchor) as all existing exports.

### Anti-Pattern 3: Full PWIA XML upload as the v2.5 WA feature

**What people do:** Build a complete PWIA XML upload route because the XSD is available.
**Why it's wrong:** Requires full SSN (Gap #2), `intentId` (Gap #4), and individual `apprenticeId` (Gap #5). None are in the DB. Generating a structurally valid but data-invalid XML file (with placeholder SSNs) and presenting it as ready for upload creates compliance risk. A contractor who uploads it without replacing SSNs submits invalid certified payroll records.
**Do this instead:** "Submission assist" — a JSON prefill guide. The contractor has all the data in front of them to enter into the PWIA portal manually. XML upload is a v3+ feature dependent on the privacy review for full SSN storage.

### Anti-Pattern 4: Reusing caGeneratingRef for the eCPR XML download

**What people do:** Reuse the existing `caGeneratingRef` (which guards the A-1-131 PDF download) for the eCPR XML download.
**Why it's wrong:** If a user clicks both CA buttons in rapid succession, the shared ref will block one download mid-flight. Each download button must have its own `useRef` guard — as established by the comment in `PayrollWeekDetailPage.tsx` line 128 ("MUST be new ref — do not reuse generatingRef or caGeneratingRef").
**Do this instead:** `const caEcprGeneratingRef = useRef(false)` — a third ref dedicated to the XML download.

---

## Download UX Pattern (confirmed from PayrollWeekDetailPage.tsx)

The established pattern for all file downloads — to be followed identically for CA eCPR XML:

```typescript
// 1. Dedicated useRef for double-click guard
const caEcprGeneratingRef = useRef(false);

// 2. Handler
async function handleCaEcprDownload() {
  if (caEcprGeneratingRef.current) return;
  caEcprGeneratingRef.current = true;
  try {
    const res = await fetch(`/api/export/ecpr-xml/${weekId}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    hiddenAnchorRef.current!.href = url;
    hiddenAnchorRef.current!.download = `ecpr-${weekData?.week.payrollNumber || weekId}.xml`;
    hiddenAnchorRef.current!.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (err) {
    console.error('CA eCPR XML download failed:', err);
  } finally {
    caEcprGeneratingRef.current = false;
  }
}
```

The WA submission assist fetch pattern is different — JSON response, render in-page:

```typescript
const [waAssistData, setWaAssistData] = useState(null);

async function fetchWaAssist() {
  const res = await fetch(`/api/export/wa-assist/${weekId}`, { credentials: 'include' });
  if (!res.ok) return;
  const data = await res.json();
  setWaAssistData(data);
}
```

No `hiddenAnchorRef` needed for WA assist. No file is downloaded.

---

## Build Order (v2.5 specific)

| Step | Work | Dependency |
|------|------|-----------|
| 1 | Add `getPayrollEntriesWithWorkerDetails()` to `payrollService.ts` | None — pure DB layer |
| 2 | Build `ecprXmlGenerator.ts` with unit tests against CPR.xsd structure | Step 1 types |
| 3 | Add `GET /api/export/ecpr-xml/:weekId` to `export.ts` | Steps 1-2 |
| 4 | Update CA disclosure modal — add XML download button and gap disclosures | Step 3 (route must exist to test) |
| 5 | Build `waAssistFormatter.ts` with unit tests against xmlschema.xsd field list | Step 1 types |
| 6 | Add `GET /api/export/wa-assist/:weekId` to `export.ts` | Step 5 |
| 7 | Add WA assist button + prefill panel modal to `PayrollWeekDetailPage.tsx` | Step 6 |

Steps 2-4 (CA) and 5-7 (WA) can proceed in parallel after Step 1.

---

## Sources

- CA CPR.xsd (v1.3): [https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd](https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd) — HIGH confidence (fetched directly 2026-03-26, full schema extracted)
- CA eCPR XML Guidelines: [https://www.dir.ca.gov/Public-Works/CPR/eCPRXMLGuideline.pdf](https://www.dir.ca.gov/Public-Works/CPR/eCPRXMLGuideline.pdf) — HIGH confidence
- WA PWIA xmlschema.xsd: [https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd](https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd) — HIGH confidence (fetched directly 2026-03-26, all elements and types extracted)
- Existing codebase — directly inspected: `export.ts`, `a1131Generator.ts`, `f700Generator.ts`, `payrollService.ts`, `PayrollWeekDetailPage.tsx`, `schema.ts`, `index.ts`

---

*Architecture research for: CA eCPR XML export and WA PWIA submission assist (v2.5)*
*Researched: 2026-03-26*

---
---

# Prior Architecture Research (v2.4 — preserved for reference)

**Domain:** HCC Prevailing Wage v2.4 — Ship-Ready + Design Elevation
**Researched:** 2026-03-24
**Confidence:** HIGH — based on direct codebase analysis of all affected files

---

## System Overview (as of v2.3)

```
┌────────────────────────────────────────────────────────────────────────┐
│                         React Client (Vite)                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐   │
│  │ DashboardPage│  │PayrollWeekDetail  │  │ WorkerCompliance       │   │
│  │  (+ compliance│  │  (+ PDF generate) │  │ HistoryPage            │   │
│  │   status filt)│  │                  │  │  (+ CSV export)        │   │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬─────────────┘  │
│         │                   │                        │                 │
│  ┌──────┴───────────────────┴────────────────────────┴──────────────┐ │
│  │              TanStack Query (cache + invalidation)                │ │
│  └──────────────────────────────┬───────────────────────────────────┘ │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │ fetch /api/*
┌─────────────────────────────────┼──────────────────────────────────────┐
│                          Express Server                                 │
│  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │/api/export    │  │/api/compliance   │  │/api/projects             │ │
│  │  /wh347/:id   │  │  /project/:id    │  │  GET /?status=           │ │
│  │  /csv/lcp/:id │  │  /worker/:id/    │  │  PATCH /:id              │ │
│  │  /csv/emars/:id│  │    history       │  │                          │ │
│  │  [+ state PDFs]│  │  /:weekId        │  │                          │ │
│  │               │  │  [+ /projects/   │  │                          │ │
│  │               │  │    summary]      │  │                          │ │
│  └───────┬───────┘  └────────┬─────────┘  └────────────┬─────────────┘ │
│          │                   │                          │               │
│  ┌───────┴───────────────────┴──────────────────────────┴────────────┐ │
│  │   Services: payrollService, complianceService, wh347Generator,    │ │
│  │             stateFormGenerator (NEW), csvExporter                  │ │
│  └──────────────────────────────┬────────────────────────────────────┘ │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │ Drizzle ORM
┌─────────────────────────────────┼──────────────────────────────────────┐
│  SQLite                                                                 │
│  projects (status, userId, state, county, fundingType, ...)            │
│  payrollWeeks (submitted_at, submitted_to, amendment_number, ...)      │
│  payrollEntries (baseRateSnapshot, fringeRateSnapshot, grossWages,...) │
│  workers │ workerClassifications │ wageDeterminations                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Q1: State Form Route Design

### Recommendation: Single parametric route with a form-type enum

Register one route:

```
GET /api/export/state-form/:weekId?form=ca-dir|wa-li
```

This sits alongside the existing routes in `export.ts`:

```typescript
// Existing:
router.get('/wh347/:weekId', ...)
router.get('/csv/lcptracker/:weekId', ...)
router.get('/csv/emars/:weekId', ...)

// New:
router.get('/state-form/:weekId', ...)
```

**Why one route, not two separate routes:**

The ownership check, week/project load, and entry fetch are identical for both CA DIR and WA L&I. The only difference between them is which generator function is called and which PDF filename is returned. A form-type query param keeps that differentiation at the generation layer without duplicating 30 lines of auth/data-loading boilerplate.

The alternative — `/api/export/ca-dir/:weekId` and `/api/export/wa-li/:weekId` — would produce two routes that are structurally identical up to the generator call. The `?form=` param makes the branching point explicit and leaves room for future state forms (NY DOL, etc.) without adding a new route per form.

**Implementation shape:**

```typescript
// routes/export.ts — new handler at end of file before export
router.get('/state-form/:weekId', async (req, res) => {
  const weekId = req.params.weekId as string;
  const formType = req.query.form as string;
  const userId = req.user!.userId;

  if (!['ca-dir', 'wa-li'].includes(formType)) {
    res.status(400).json({ error: 'Invalid form type. Use: ca-dir or wa-li' });
    return;
  }

  // Same ownership check + data load as /wh347/:weekId
  // ...

  // Branch on formType:
  if (formType === 'ca-dir') {
    const pdf = await fillCaDirForm(data, templateBytes);
    res.setHeader('Content-Disposition', `attachment; filename="ca-dir-${weekId}.pdf"`);
    res.end(Buffer.from(pdf));
  } else {
    const pdf = await fillWaLiForm(data, templateBytes);
    res.setHeader('Content-Disposition', `attachment; filename="wa-li-${weekId}.pdf"`);
    res.end(Buffer.from(pdf));
  }
});
```

**New files (server-side):**

- `src/server/services/caDirGenerator.ts` (NEW) — mirrors `wh347Generator.ts` structure: exports `fillCaDirForm(data, templateBytes): Promise<Uint8Array>`, uses `pdf-lib` coordinate overlay on the CA DIR official template
- `src/server/services/waLiGenerator.ts` (NEW) — same pattern for WA L&I form
- `assets/ca-dir-official.pdf` (NEW) — CA DIR PWC 100 or equivalent official template
- `assets/wa-li-official.pdf` (NEW) — WA L&I Certified Payroll Report template

**Modified files (server-side):**

- `src/server/routes/export.ts` (MODIFIED) — add single `/state-form/:weekId` handler

**Client trigger:** Add "Download CA DIR" / "Download WA L&I" buttons in `PayrollWeekDetailPage.tsx` using the same fetch-driven Blob download pattern as the existing WH-347 button (confirmed working pattern from v2.2). Only show the button when the project's `state` matches the form's jurisdiction (`project.state === 'CA'` for CA DIR, `project.state === 'WA'` for WA L&I).

**State data note:** `stateWageAdapter.ts` already defines `CaDirAdapter` and `WaLiAdapter` for wage lookups. The CA/WA states are fully supported in the wage determination layer. State form generation is a new output concern only.

---

## Q2: Contractor Guidance System Architecture

### Recommendation: HelpText primitive + inline prose. No sidebar, no feature tour.

The existing UI primitive set (`Card`, `Button`, `Badge`, `PageHeader`, `EmptyState`) already handles the structural layer. The guidance system needs only one new primitive.

**New primitive: `HelpText.tsx`**

```typescript
// src/client/components/ui/HelpText.tsx
// Renders contextual guidance inline with form fields or section headers.
// Two variants:
//   inline — small muted text below a form field label
//   callout — slightly elevated block with an icon, for multi-sentence guidance

interface HelpTextProps {
  children: React.ReactNode;
  variant?: 'inline' | 'callout';
}
```

This is a dumb display component — no state, no context, no provider. That is the correct call for this scope.

**Pattern: guidance is co-located with the feature it describes.**

Do not use a context provider, a help sidebar, or a tooltip system. Those patterns assume the guidance content is decoupled from the UI element — appropriate for multi-user SaaS with role-based help. For a single-user compliance workflow tool, the guidance lives on the page near the action it explains.

Specific application per page:

| Page | Guidance type | Where |
|------|--------------|-------|
| `LandingPage.tsx` | Prose explainer (already has sections) | Existing marketing sections — no new component needed |
| `ProjectDetailPage.tsx` | `HelpText` callout on 4-step workflow indicator | Below step labels, explaining what each step requires |
| `PayrollEntryPage.tsx` | `HelpText` inline under classification selector | Explains rate snapshot behavior, fringe credit |
| `WorkersPage.tsx` | `EmptyState` with action (already exists) | Update message copy to explain why workers come first |
| `PayrollWeekDetailPage.tsx` | `HelpText` callout above WH-347 download | Explains what the form is and when to submit |
| `DashboardPage.tsx` | `EmptyState` with action (already exists) | Update action label to "Create Your First Project" with subtitle |

**Tooltips: use sparingly, only for icon-only controls.**

Tooltips require hover, which is problematic on touch devices. The existing compliance badges have enough visual affordance. Use `title` attribute for brief hover labels on icon buttons where no text label fits — do not introduce a tooltip library.

**No sidebar guidance panel.** A sidebar would occupy permanent horizontal real estate on every page to serve content a contractor only needs the first three times. The compliance software is used repeatedly by trained users. Guidance should fade into the background, not be permanently prominent.

**New files:**
- `src/client/components/ui/HelpText.tsx` (NEW) — single primitive, ~30 lines

**Modified files:**
- `src/client/pages/ProjectDetailPage.tsx` — add callout HelpText under workflow steps
- `src/client/pages/PayrollEntryPage.tsx` — add inline HelpText under key fields
- `src/client/pages/PayrollWeekDetailPage.tsx` — add callout HelpText above WH-347 download
- `src/client/pages/DashboardPage.tsx` — update EmptyState message copy
- `src/client/pages/WorkersPage.tsx` — update EmptyState message copy

---

## Q3: UI/UX Overhaul Build Order

### Recommendation: tokens → components → pages. Photography via CSS custom property, loaded from `public/`.

**Build order and rationale:**

1. **Design tokens first (`src/client/index.css`)**

   Add new tokens to the existing `@theme` block. The existing token architecture is correct — this is an extension, not a replacement:

   ```css
   /* New tokens for v2.4 */
   --color-surface-dark: #1a1a1a;        /* full dark surface */
   --color-surface-dark-alt: #242424;    /* card on dark background */
   --color-brand-gold-dim: #c9a10e;      /* hover state for gold buttons */
   --color-gold-gradient-start: #F5C518;
   --color-gold-gradient-end: #c9a10e;
   --shadow-card-elevated: 0 4px 12px 0 rgb(0 0 0 / 0.12), 0 2px 4px -1px rgb(0 0 0 / 0.08);
   ```

   Do not hardcode gradient values in JSX. Define them as CSS custom properties and reference them in component styles. This preserves the existing constraint: all brand values via `@theme` tokens.

2. **Update `Card.tsx` and `Button.tsx` for depth/shadow variants**

   The Card component needs an `elevated` variant that applies `shadow-card-elevated` and slightly stronger border. Do not change existing variant behavior — add the new variant alongside.

   The Button component may need a `gold` variant (filled gold background, dark text) for primary CTAs on dark surfaces. Verify against current `primary` variant behavior before adding.

3. **Pages last — apply tokens and photograph backgrounds page by page**

   Start with `LandingPage.tsx` (highest visual impact, not behind auth). Then `DashboardPage.tsx`. Auth pages last (least visible to returning users).

**Photography integration: `public/` directory + CSS background-image**

There is currently no `public/` directory. Create it. Vite serves `public/` at the root path with no bundling — the correct approach for large static assets like photographs.

```
/public/
  hero-construction.jpg      (LandingPage hero section)
  dashboard-bg.jpg           (DashboardPage header band, optional)
```

Reference in CSS, not in JSX:

```css
/* In index.css or a page-specific <style> block */
.hero-section {
  background-image: url('/hero-construction.jpg');
  background-size: cover;
  background-position: center;
}
```

Do not import images via `import heroImg from './hero-construction.jpg'` in React components unless you need Vite's asset hashing (which is not needed for manually managed brand photography). Direct `/public` paths are simpler, cacheable, and swappable without a rebuild.

**Dark gold gradient pattern:**

```css
.gradient-gold {
  background: linear-gradient(135deg, var(--color-gold-gradient-start), var(--color-gold-gradient-end));
}
```

Applied as a Tailwind utility via `@layer utilities` in `index.css`, not as an inline style. This keeps the constraint: no hardcoded hex in JSX.

**New files:**
- `public/` directory (NEW)
- `public/hero-construction.jpg` (NEW — sourced externally)
- Potentially `public/dashboard-bg.jpg` (NEW — optional)

**Modified files:**
- `src/client/index.css` — new tokens, new utility classes
- `src/client/components/ui/Card.tsx` — elevated variant
- `src/client/components/ui/Button.tsx` — verify if gold variant needed
- `src/client/pages/LandingPage.tsx` — apply hero background, gradient sections
- `src/client/pages/DashboardPage.tsx` — apply elevated card styling

---

## Q4: Dashboard Compliance Status Filter Endpoint

### Recommendation: `GET /api/compliance/projects/summary` returns per-project status keyed by projectId.

**Route design:**

Add to `src/server/routes/compliance.ts` — must be registered before `/:weekId` to avoid wildcard capture (the existing file already documents this pattern and applies it for `/project/:projectId` and `/worker/:workerId/history`):

```
GET /api/compliance/projects/summary
Response: {
  projects: Array<{
    projectId: string,
    status: 'compliant' | 'violations' | 'no-payroll'
  }>
}
```

The three status values map cleanly to the filter UI:
- `compliant` — at least one week exists, no violations found in any week
- `violations` — at least one week has `hasViolations: true`
- `no-payroll` — `listPayrollWeeks(projectId)` returns empty array

**Why this shape (not `badge: string`):**

The existing `/api/compliance/project/:projectId` returns `{ badge: 'violations' | 'clean', weekCount, lastWeekNumber }`. That endpoint is per-project and called inside `ProjectCard`. The summary endpoint is dashboard-level and batches all projects at once. Using `status` instead of `badge` avoids confusion between the two endpoints and gives the filter the clean enum it needs.

**Server implementation sketch:**

```typescript
// In compliance.ts — before /:weekId handler
complianceRouter.get('/projects/summary', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  // Fetch all active projects for this user
  const userProjects = await db.select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId));

  const results = await Promise.all(
    userProjects.map(async (project) => {
      const weeks = await listPayrollWeeks(project.id);
      if (weeks.length === 0) {
        return { projectId: project.id, status: 'no-payroll' as const };
      }
      for (const week of weeks) {
        const result = await computeCompliance(db, week.id);
        if (result?.hasViolations) {
          return { projectId: project.id, status: 'violations' as const };
        }
      }
      return { projectId: project.id, status: 'compliant' as const };
    })
  );

  res.json({ projects: results });
});
```

**Performance note:** `computeCompliance()` is fast (reads snapshots, no live lookups) but it is called per-week per-project. For a contractor with 20 projects × 30 weeks each, this is 600 synchronous computations. Use `Promise.all` across projects (as shown) to parallelize at the project level. Document this as a known O(projects × weeks) operation — acceptable for a single-user app. If a contractor builds up hundreds of projects over years, add a `?projectIds=` param to allow the client to batch only visible projects.

**Client-side filter integration in `DashboardPage.tsx`:**

```typescript
// Fetch summary once on mount alongside project list
const { data: complianceSummary } = useQuery({
  queryKey: ['compliance-summary'],
  queryFn: () => fetch('/api/compliance/projects/summary').then(r => r.json()),
  staleTime: 60_000,
});

// Build a lookup map
const complianceByProject = useMemo(() =>
  Object.fromEntries(
    (complianceSummary?.projects ?? []).map(p => [p.projectId, p.status])
  ), [complianceSummary]);

// Add compliance filter state
const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'violations' | 'no-payroll'>('all');

// Extend existing filteredProjects useMemo
const filteredProjects = useMemo(() =>
  projects
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(p => fundingTypeFilter === 'all' || p.fundingType === fundingTypeFilter)
    .filter(p => complianceFilter === 'all' || complianceByProject[p.id] === complianceFilter),
  [projects, searchTerm, fundingTypeFilter, complianceFilter, complianceByProject]
);
```

This does not pass the compliance badge as a prop to `ProjectCard` — `ProjectCard` continues to fetch its own compliance badge via its existing `useQuery` for display purposes. The summary endpoint is only for filter gating in `DashboardPage`. This avoids prop threading through `ProjectCard`.

**Modified files:**
- `src/server/routes/compliance.ts` (MODIFIED) — add `/projects/summary` before `/:weekId`
- `src/client/pages/DashboardPage.tsx` (MODIFIED) — add compliance filter state + useMemo extension

---

## Q5: Production Deployment — SQLite Persistence

### Recommendation: Volume mount on Railway or Fly.io. Do not migrate to Postgres. Do not use Turso yet.

**Decision: volume mount is the right call for a single-user app at this stage.**

The three options evaluated:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Volume mount (Railway/Fly.io) | Zero code change, SQLite stays, simple ops | Volume must be configured manually, container restarts can lose ephemeral state if volume path misconfigured | USE THIS |
| Turso (libSQL cloud) | Replicated, no volume needed, branching for dev/prod | Requires replacing `better-sqlite3` with `@libsql/client`, rewriting Drizzle config, async driver vs sync driver mismatch | Defer to v3 if multi-device needed |
| Postgres (Neon/Supabase) | Standard production DB, no volume management | Full migration of all Drizzle schema and queries, JSON/text type differences, `better-sqlite3` removed, full test suite re-run | Out of scope |

**Why Postgres migration is wrong for v2.4:**

The app has 1,522 passing tests as of v2.3. A Postgres migration would require rewriting the Drizzle schema (`sqliteTable` → `pgTable`), auditing every raw query, updating the test setup, and re-validating all tests. This is a 2–3 day effort that produces no user-visible value. The Postgres migration is a future milestone, not a v2.4 item.

**Why Turso is premature:**

Turso requires switching from `better-sqlite3` (synchronous) to `@libsql/client` (async). Drizzle supports both drivers but the adapter is different. All `db.get()` calls in the codebase (there are several in `stateWageAdapter.ts`) use the synchronous API. This is a non-trivial driver swap. Worth doing when multi-device or collaborative access is needed. Not now.

**Volume mount implementation:**

```
# Railway: attach a persistent volume to /app/data
# Set environment variable:
DATABASE_PATH=/app/data/prevailing-wage.sqlite

# In src/server/db/index.ts — read from env:
const dbPath = process.env.DATABASE_PATH ?? './prevailing-wage.sqlite';
```

The current `getDb()` likely uses a hardcoded path. The only required code change is making the path configurable via environment variable.

**Fly.io is the preferred host over Railway for volume stability.** Railway's volume mount is newer and has documented edge cases around IOPS limits. Fly.io volumes are mature and well-documented for SQLite workloads. Either works; Fly.io is lower risk.

**Env config required for production:**

```
DATABASE_PATH=/app/data/prevailing-wage.sqlite
JWT_SECRET=<strong random value>
SAM_GOV_API_KEY=<production key>
NODE_ENV=production
PORT=4099
```

**Auth hardening note:** The existing JWT-in-httpOnly-cookie pattern is correct for production. The constraint from `PROJECT.md` ("do not change auth model") is right. The only hardening needed is ensuring `JWT_SECRET` is a strong value from environment, not a hardcoded fallback.

---

## Component Map: New vs. Modified (v2.4)

| File | Status | Change |
|------|--------|--------|
| `src/server/routes/export.ts` | MODIFIED | Add `GET /state-form/:weekId?form=` handler |
| `src/server/routes/compliance.ts` | MODIFIED | Add `GET /projects/summary` before `/:weekId` |
| `src/server/services/caDirGenerator.ts` | NEW | CA DIR form filler using pdf-lib coordinate overlay |
| `src/server/services/waLiGenerator.ts` | NEW | WA L&I form filler using pdf-lib coordinate overlay |
| `src/server/db/index.ts` | MODIFIED | Read `DATABASE_PATH` from env |
| `src/client/components/ui/HelpText.tsx` | NEW | Inline and callout guidance primitive |
| `src/client/components/ui/Card.tsx` | MODIFIED | Add `elevated` shadow variant |
| `src/client/components/ui/Button.tsx` | MODIFIED | Verify/add gold variant for dark surface CTAs |
| `src/client/index.css` | MODIFIED | New @theme tokens (dark surface, gold gradient, elevated shadow), new utility classes |
| `src/client/pages/DashboardPage.tsx` | MODIFIED | Compliance status filter, complianceSummary fetch, filter useMemo extension |
| `src/client/pages/PayrollWeekDetailPage.tsx` | MODIFIED | State form download buttons (conditional on project.state), HelpText callout |
| `src/client/pages/LandingPage.tsx` | MODIFIED | Hero photography, gradient sections |
| `src/client/pages/ProjectDetailPage.tsx` | MODIFIED | HelpText callouts on workflow steps |
| `src/client/pages/PayrollEntryPage.tsx` | MODIFIED | HelpText inline on key fields |
| `src/client/pages/WorkersPage.tsx` | MODIFIED | EmptyState copy update |
| `src/client/pages/WorkerComplianceHistoryPage.tsx` | MODIFIED | CSV export button |
| `assets/ca-dir-official.pdf` | NEW | CA DIR official form template |
| `assets/wa-li-official.pdf` | NEW | WA L&I official form template |
| `public/hero-construction.jpg` | NEW | Hero photography asset |

---

*Architecture research for: HCC Prevailing Wage v2.4 — Ship-Ready + Design Elevation*
*Researched: 2026-03-24*
