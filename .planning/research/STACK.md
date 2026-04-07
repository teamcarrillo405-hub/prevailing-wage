# Stack Research — v5.0 State Coverage + Subcontractors + Reporting

**Project:** HCC Prevailing Wage
**Milestone:** v5.0 — State Coverage (TX, FL, MA, NJ) + Subcontractor Tracking + Enhanced Reporting
**Researched:** 2026-04-07
**Confidence:** HIGH (state form findings verified via official state government pages + third-party compliance sources; package versions confirmed against package.json; pdf-lib patterns confirmed against existing ilPdfGenerator.ts)

> This file covers NEW stack requirements for v5.0 only. The existing stack — Node.js + Express + TypeScript, React + Vite + TailwindCSS v4, SQLite + Drizzle ORM, pdf-lib for all PDF generation, xmlbuilder2 for XML, multer for file upload, csv-parse + csv-stringify for CSV, Resend for email, node-cron for scheduling — is NOT re-researched here.

---

## Executive Summary

| Feature | Verdict | New Library Needed |
|---------|---------|-------------------|
| TX certified payroll PDF | Federal WH-347 only — no TX state form exists | None. Use existing WH-347 generator. |
| FL certified payroll PDF | Federal WH-347 only — no FL state law | None. Use existing WH-347 generator. |
| MA certified payroll PDF | MA-specific state form required — programmatic draw | None. pdf-lib `PDFDocument.create()` (IL pattern). |
| NJ certified payroll PDF | NJ-specific state form (MW-562) required | None. pdf-lib `PDFDocument.create()` (IL pattern). |
| Subcontractor tracking — CPR metadata | Metadata-only in DB is sufficient for v5.0 | None. Drizzle schema addition only. |
| Subcontractor tracking — document upload | Out of scope for v5.0; multer already installed if needed | None for v5.0. |
| Multi-project compliance PDF | pdf-lib programmatic draw (existing IL pattern) | None. |
| Enhanced fringe report PDF | pdf-lib programmatic draw (existing IL pattern) | None. |
| Audit log CSV export | csv-stringify already installed | None. Already at ^6.7.0. |

**Zero new npm packages needed for v5.0.**

---

## Question 1: TX and FL — Do They Have State Forms?

### Texas

**Verdict: No Texas state certified payroll form exists. Use WH-347.**

Texas Government Code Chapter 2258 requires prevailing wages on public works but does not mandate a state-specific certified payroll form. The standard practice confirmed by TxDOT, TDHCA, and TWC is to use the federal WH-347. TxDOT's own forms page links directly to the federal WH-347.

For TxDOT projects specifically, electronic certified payroll is submitted via LCPtracker — but this is a third-party portal submission tool (not an API), equivalent to CA DIR's eCPR portal. The underlying form content is WH-347 data. No programmatic API to LCPtracker or TxDOT exists that would change this assessment.

**Implementation path:** TX projects get the same WH-347 generation as federal projects. State-gate TX in the UI to show WH-347 download. No new PDF generator file needed.

**Confidence: HIGH** — confirmed via TxDOT manuals page, TDHCA forms page, TWC prevailing wage page, multiple compliance guides (2025–2026 search).

### Florida

**Verdict: Florida has no state prevailing wage law. WH-347 applies to federally funded FL projects only.**

Florida repealed its "Little Davis-Bacon" state prevailing wage act in 1979. As of July 2024 (HB 705), any local prevailing wage ordinances (e.g., Miami-Dade) were also preempted by state law. For FL-gated features, only federally funded projects invoke Davis-Bacon/WH-347. There is no FL-specific certified payroll form to generate.

**Implementation path:** FL projects get WH-347 only. State-gate FL the same as TX — show WH-347 download. Optionally surface a UI note: "Florida has no state prevailing wage law. WH-347 applies to federally funded projects." No new PDF generator file needed.

**Confidence: HIGH** — confirmed via Florida labor law guides, eMars prevailing wage FL page, workyard.com FL guide (all consistent, 2025–2026 search).

---

## Question 2: MA and NJ — State-Specific Forms

### Massachusetts

**Verdict: MA has its own required state form — must be generated from scratch like IL.**

Massachusetts MGL c. 149 s. 27B requires contractors to submit a Weekly Certified Payroll Report to the awarding authority. The Massachusetts Department of Labor Standards (DLS) provides an official form. This form is MA-specific — WH-347 does not satisfy the MA requirement.

**Form structure** (confirmed via official MA form download from mass.gov and srtabus.com mirror):

Header block:
- Company name, address, phone
- Payroll number
- Employer's signature, title
- Contract number, Taxpayer ID (FEIN)
- Work week ending date
- Awarding Authority name
- Public Works project name, location
- Minimum Wage Rate Sheet number
- General/Prime Contractor name
- Subcontractor name

Employee rows (repeating):
- OSHA 10 Certification status (yes/no)
- Work Classification
- Daily hours: Sunday through Saturday (7 columns)
- "All Other Hours" (non-PW hours)
- Hourly Base Wage (Column B)
- Supplemental Unemployment (Column E — MA-specific fringe type)
- Project Gross Wages (Column G)
- Total Gross Wages

Plus a separate Weekly Statement of Compliance form (Statement of Compliance signature page — analogous to IL's affidavit page).

**Generating the MA form:** Use `PDFDocument.create()` with coordinate-based drawing, exactly as `ilPdfGenerator.ts` does. MA does not publish an interactive/fillable PDF template suitable for `loadPdf()` + field-fill — the official form is a blank PDF that must be replicated programmatically.

**Key MA-specific fields absent from IL/WH-347:**
- OSHA 10 Certification column per worker (boolean flag)
- "Supplemental Unemployment" as a distinct fringe column (MA-specific benefit category)
- "All Other Hours" column for non-prevailing wage work hours
- Awarding Authority and Min. Wage Rate Sheet fields

**Integration:** New file `src/server/services/maPdfGenerator.ts`. MA-gated in UI. Companion `src/server/services/maStatementOfCompliance.ts` or combine into single generator (two-page output like IL).

**Confidence: MEDIUM-HIGH** — form structure confirmed from official MA form download (mass.gov + third-party mirror). Field column names confirmed from srtabus.com PDF (official-looking mirror). Column B/E/G naming convention requires validation against current official download before coding.

### New Jersey

**Verdict: NJ has its own required state form (MW-562) — must be generated from scratch.**

New Jersey requires the "Payroll Certification for Public Works Projects" form MW-562. As of August 15, 2024, submission is mandatory via the NJ Wage Hub (njwages.nj.gov). The MW-562 is the official form; WH-347 does not satisfy NJ requirements.

**Current form version:** MW-562 (February 2025 revision) — confirmed current via NJ DOL forms page (nj.gov/labor/wageandhour/tools-resources/forms-publications/).

**Form structure** (confirmed via NJ DOL forms page + construction-business-forms.com + templateroller.com MW-562 preview):

Header block:
- Payroll number, Week ending date
- Project name, Contract ID, Project ID
- Contractor and subcontractor name and address
- Public body awarding the contract

Employee rows (repeating):
- Employee name and address
- Job title (classification)
- Sex (M/F/N), Race, Ethnicity (EEO data — NJ-specific)
- Daily hours: Sunday through Saturday
- Hourly rate of pay
- FICA, Federal Tax, State Tax withholding
- Other deductions (specify)

Certification block:
- Contractor/subcontractor signature, title, date
- Final/weekly certification checkbox

**NJ-specific fields absent from WH-347/IL:**
- Sex/Race/Ethnicity columns (EEO demographic fields — legally required in NJ)
- FICA, Federal Tax, State Tax as separate deduction columns (WH-347 uses a single deductions total)
- No "fringe benefit" sub-columns in the same format as WH-347 (NJ uses straight pay rate + deductions model)

**NJ Wage Hub:** This is a web portal for electronic submission — no public API exists. The MW-562 PDF is generated locally and submitted manually via the portal, same pattern as CA DIR eCPR and WA L&I CPR. Do NOT attempt portal automation.

**Generating the NJ form:** Use `PDFDocument.create()` with coordinate-based drawing (IL pattern). Do not attempt to use a downloaded NJ MW-562 PDF as a template — the form fields are NJ-portal-specific and may not render correctly under pdf-lib's `loadPdf()` + AcroForm fill approach. Programmatic draw is the established safe path for this codebase.

**Integration:** New file `src/server/services/njPdfGenerator.ts`. NJ-gated in UI.

**Confidence: MEDIUM** — field structure confirmed from NJ DOL forms page + templateroller preview + NJ Wage Hub instructions document (MW-564 10/23). Exact column widths/positions require test rendering. EEO fields (sex/race/ethnicity) are confirmed as NJ-specific requirements by NJDOL compliance documentation.

---

## Question 3: Multi-Project Compliance PDF and Report-Style PDFs

### Can pdf-lib handle report-style PDFs?

**Yes. Use pdf-lib with the IL pattern. No new library needed.**

The `ilPdfGenerator.ts` already demonstrates the full pattern needed for report-style PDFs:
- `PDFDocument.create()` — blank document from scratch
- `pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])` — add pages dynamically
- Column-based table drawing with `page.drawText()` + `page.drawLine()`
- Automatic page breaks when `y < threshold`
- Multi-page output with repeated headers per page
- Helvetica/HelveticaBold from `StandardFonts` — no font embedding required

A multi-project compliance summary PDF needs: a cover/summary page, then one section per project showing compliance status, violation counts, and submission status. This maps directly onto the IL pattern.

**Why not pdfmake?** PROJECT.md constraint: "pdf-lib already installed; use it for all PDF generation." pdfmake's declarative table syntax would be syntactically cleaner for report-style output, but adding it is explicitly out of scope per project constraints. The IL pattern is sufficient — it is already proven to produce readable tabular PDFs at production quality.

**Why not jsPDF?** Same constraint. Also, jsPDF is browser-side; this app generates PDFs server-side in Express and streams bytes to the client.

**Multi-project compliance PDF implementation approach:**
- Page 1: Summary header (date, total projects, counts of compliant/violation/pending weeks)
- Pages 2+: One section per active project — project name, state, week count, violation summary table
- Page break logic: track `y` position, add new page + section header when `y < MIN_Y_THRESHOLD`
- No new files needed beyond `src/server/services/complianceReportGenerator.ts`

**Enhanced fringe report implementation approach:**
- Same PDF pattern — table with fund type, union local, J/RA classification as row dimensions
- No new files beyond `src/server/services/fringeReportGenerator.ts`

**Confidence: HIGH** — pattern confirmed in existing `ilPdfGenerator.ts` (direct file read 2026-04-07).

---

## Question 4: Audit Log CSV Export

### Is csv-stringify already installed?

**Yes. csv-stringify ^6.7.0 is already in package.json `dependencies`.**

Confirmed from `package.json` (direct read 2026-04-07):
```json
"csv-stringify": "^6.7.0"
```

Current published version is 6.7.0 (confirmed npm, last published April 2026). No update needed.

**Usage pattern for audit log export** (consistent with existing CSV export in v2.4 Phase 23):

```typescript
import { stringify } from 'csv-stringify/sync';

const csvContent = stringify(rows, {
  header: true,
  columns: [
    { key: 'timestamp', header: 'Timestamp' },
    { key: 'userId', header: 'User' },
    { key: 'action', header: 'Action' },
    { key: 'detail', header: 'Detail' },
    { key: 'projectId', header: 'Project ID' },
    // ... additional audit log columns
  ],
  bom: true,  // UTF-8 BOM — required for Excel compatibility (existing pattern from v2.4)
});

res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
res.send(csvContent);
```

The BOM (`bom: true`) is the existing established pattern from v2.4 Phase 23 CSV export. Follow that pattern exactly.

**Confidence: HIGH** — package.json confirmed directly (2026-04-07). csv-stringify sync API confirmed via npm docs.

---

## Question 5: Subcontractor Tracking — Document Upload vs Metadata-Only

### Verdict: Metadata-only is correct for v5.0. No file storage needed.

**What v5.0 needs:** GC tracks which subcontractors are on a project, and records whether each sub has submitted their CPR for each payroll week. This is a compliance receipt-tracking problem, not a document archival problem.

**Metadata-only approach covers the v5.0 requirements:**
- `subcontractors` table: id, project_id, name, trade, contact_email, license_number, created_at
- `subcontractor_cpr_submissions` table: id, subcontractor_id, payroll_week_id, received_at, notes, status (pending/received/compliant/flagged)
- GC marks a sub's CPR as received; system tracks receipt date and compliance status
- No physical CPR document needs to be stored in the app

**Why not file upload for v5.0:**
- Document storage on Render.com persistent disk (/var/data) works but adds complexity: file naming, storage path management, serving files via Express, size limits, disk quota
- The v5.0 requirement is CPR compliance tracking, not document archival — "did the sub submit their CPR?" not "store a copy of the sub's CPR"
- multer (already installed at ^2.1.1) can be added to a future milestone if file storage becomes a hard requirement from users

**If file upload is needed later (not v5.0):** multer is already installed. Pattern established in Phase 35–36 (PayrollImportModal). Use `memoryStorage()` for small documents or `diskStorage()` to `/var/data/uploads/` for persistent storage. No new library needed.

**Confidence: HIGH** — multer already installed (confirmed package.json); metadata-only approach aligns with v5.0 feature scope per PROJECT.md.

---

## CA A-1-131 Gap (Pre-planned Phase 24 gap)

The CA A-1-131 PDF is already shipped (v2.4 Phase 24, confirmed in PROJECT.md). The "gap" noted in PROJECT.md v5.0 goals appears to reference the CA A-1-131 eCPR submission modal gap, not the PDF itself. No new stack required — existing pdf-lib + xmlbuilder2 covers any CA-side work.

---

## Installation

**No new npm packages needed for v5.0.**

All required capabilities are provided by already-installed packages:
- pdf-lib ^1.17.1 — MA and NJ PDF generation (programmatic draw)
- csv-stringify ^6.7.0 — audit log CSV export
- multer ^2.1.1 — subcontractor document upload if added to a future milestone
- drizzle-orm ^0.45.1 + better-sqlite3 ^12.8.0 — subcontractor tracking schema additions

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `pdfmake` | PROJECT.md explicit constraint: "pdf-lib already installed; use it for all PDF generation." pdfmake's declarative tables are ergonomic but a second PDF library is unnecessary weight. | pdf-lib with `PDFDocument.create()` + coordinate drawing (IL pattern) |
| `jsPDF` | Same constraint. Also browser-side; app generates PDFs server-side. | pdf-lib |
| `@pdfme/generator` | Same constraint. Third-party template format, no established pattern in codebase. | pdf-lib |
| `multer-s3` / S3 file storage | Render.com persistent disk is sufficient; S3 adds AWS credentials, IAM, costs. Not needed for v5.0 metadata-only tracking. | Metadata-only in SQLite for v5.0 |
| `sharp` / image processing | Not required for any v5.0 feature. | N/A |
| State portal automation (NJ Wage Hub, LCPtracker) | No public API. Portal automation violates ToS, breaks on UI changes, requires credential storage. Same finding as CA DIR / WA L&I (v3.0 research). | PDF generation + manual portal upload guide |
| `exceljs` / `xlsx` for audit export | CSV export is the stated requirement. Excel binary format adds complexity with no compliance benefit. | csv-stringify ^6.7.0 (already installed) |

---

## New Service Files to Create

Based on the stack findings, v5.0 requires these new files following the IL generator pattern:

| File | Purpose | Pattern |
|------|---------|---------|
| `src/server/services/maPdfGenerator.ts` | MA Weekly Certified Payroll Report + Statement of Compliance | `PDFDocument.create()` — two pages, IL pattern |
| `src/server/services/njPdfGenerator.ts` | NJ MW-562 Payroll Certification for Public Works Projects | `PDFDocument.create()` — IL pattern, EEO columns |
| `src/server/services/complianceReportGenerator.ts` | Multi-project compliance snapshot PDF | `PDFDocument.create()` — multi-section, IL pattern |
| `src/server/services/fringeReportGenerator.ts` | Enhanced fringe report by fund type / union / J-RA | `PDFDocument.create()` — tabular, IL pattern |

TX and FL do NOT need new PDF generator files — they use the existing WH-347 generator.

---

## Version Compatibility Summary

| Package | Version in package.json | v5.0 Usage | Status |
|---------|------------------------|-----------|--------|
| pdf-lib | ^1.17.1 | MA + NJ + report PDFs | INSTALLED — no update needed |
| csv-stringify | ^6.7.0 | Audit log CSV export | INSTALLED — no update needed |
| multer | ^2.1.1 | Sub document upload (future) | INSTALLED — no v5.0 usage |
| drizzle-orm | ^0.45.1 | Subcontractor schema | INSTALLED — add-only migrations |
| better-sqlite3 | ^12.8.0 | Subcontractor schema | INSTALLED — no update needed |
| xmlbuilder2 | ^4.0.3 | No new v5.0 XML needed (TX/FL/MA/NJ are PDF-only) | INSTALLED — no new usage |

---

## Sources

- `package.json` (C:/Users/glcar/prevailing-wage/package.json) — pdf-lib@^1.17.1, csv-stringify@^6.7.0, multer@^2.1.1, drizzle-orm@^0.45.1 confirmed installed; `"type": "module"` ESM; engines.node >= 20 — HIGH confidence (direct file read 2026-04-07)
- `src/server/services/ilPdfGenerator.ts` — confirms `PDFDocument.create()` programmatic draw pattern for state-specific forms; confirms two-page (worker table + affidavit) structure — HIGH confidence (direct file read 2026-04-07)
- Texas Government Code Chapter 2258 + TxDOT Statements and Payrolls page (txdot.gov/manuals/tpd/lgp/construction) — TX uses WH-347; LCPtracker is portal submission tool (no API) — HIGH confidence (WebSearch 2026-04-07)
- TDHCA Davis-Bacon page (tdhca.texas.gov/davis-bacon-and-related-acts) — WH-347 linked as the TX certified payroll form — HIGH confidence (WebSearch 2026-04-07)
- eMars FL prevailing wage page + workyard.com FL prevailing wage guide + points-north.com FL state-by-state — FL has no state prevailing wage law (repealed 1979, local ordinances preempted HB 705 July 2024) — HIGH confidence (multiple sources consistent, 2025–2026 search)
- mass.gov/info-details/prevailing-wage-for-contractors + mass.gov/doc/weekly-certified-payroll-report/download — MA requires DLS state form, not WH-347; form structure confirmed — MEDIUM-HIGH confidence (official state source; direct form mirror read via WebFetch)
- srtabus.com/wp-content/uploads/Weekly-Certified-Payroll.pdf — MA form field inventory (OSHA-10, daily hours Sun-Sat, Column B base wage, Column E supplemental unemployment, Column G project gross) — MEDIUM confidence (third-party mirror of official form; field naming requires validation against current mass.gov download)
- nj.gov/labor/wageandhour/tools-resources/forms-publications/ — NJ MW-562 (February 2025 revision) is the required form; NJ Wage Hub (njwages.nj.gov) is mandatory submission portal as of August 15, 2024 — HIGH confidence (official NJ DOL page, direct fetch 2026-04-07)
- construction-business-forms.com/nj-certified-payroll-forms.html + templateroller.com MW-562 — NJ form structure (EEO columns, FICA/federal/state tax deductions, daily hours) — MEDIUM confidence (third-party form resellers; consistent with official NJ DOL description)
- njwages.nj.gov/assets/MW_564_10_23_Instructions.pdf — NJ Wage Hub submission instructions; confirms portal-only submission, no programmatic API — HIGH confidence (official NJ DOL document)
- npm (npmjs.com/package/csv-stringify) — csv-stringify v6.7.0 current as of April 2026, sync API confirmed — HIGH confidence

---

*Stack research for: HCC Prevailing Wage v5.0 — State Coverage + Subcontractors + Reporting*
*Researched: 2026-04-07*
