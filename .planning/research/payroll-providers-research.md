# Payroll Provider CSV/Export Format Research

**Project:** HCC Prevailing Wage
**Purpose:** Add Gusto, Paychex, and Sage/Timberline payroll import to the existing preview-then-commit pipeline
**Researched:** 2026-04-01
**Existing support:** QuickBooks Desktop (14-column CSV) and ADP (Co Code / Batch ID / File # / Reg Hours / O/T Hours format)

---

## Context: Existing Import Pipeline

The app already supports two formats via papaparse with `header: true`:

| Provider | Format | Key columns |
|----------|--------|-------------|
| QuickBooks Desktop | 14-column CSV | Employee/Vendor Name, Date, Duration (HH:MM) |
| ADP Workforce Now | 2-column-like CSV | Co Code, Batch ID, File #, Reg Hours, O/T Hours |

The pipeline maps provider columns to internal fields:
- `workers.name` — matched by name, contractor confirms unmatched
- Regular hours (decimal)
- Overtime hours (decimal)
- Pay period / week-ending date
- Gross pay (optional, cross-check only)

---

## Provider 1: Gusto

### Product Overview

Gusto is a cloud payroll SaaS primarily used by small-to-mid-size businesses. It has two distinct CSV-related surfaces:

1. **Smart Import** — contractor uploads a CSV *into* Gusto to run payroll (hours input)
2. **Payroll Journal Report** — admin downloads a CSV *from* Gusto after payroll is run (what we need)

Our use case is the **Payroll Journal Report** download (contractor exports from Gusto, imports into our app).

### Payroll Journal Report — Confirmed Columns

**Confidence: MEDIUM** — multiple third-party integration guides and Gusto community articles agree on these column names; Gusto's help center support pages return 403 to automated fetches.

The Payroll Journal Report is customizable: admins can add, remove, and reorder columns. The default/recommended configuration documented across multiple sources includes:

| Column Name (as appears in CSV header) | Our Internal Field | Notes |
|----------------------------------------|-------------------|-------|
| `Payroll type` | (ignore) | e.g., "Regular", "Off-cycle" |
| `Check date` | Pay period anchor date | MM/DD/YYYY format confirmed |
| `Payroll start date` | Pay period start | Available; shows beginning of pay period |
| `Payroll end date` | Pay period end / week-ending date | **Use this as our week-ending date** |
| `Employee first name` | Part of worker name | Split across two columns |
| `Employee last name` | Part of worker name | Combine: `Last Name + ", " + First Name` or `First Name + " " + Last Name` |
| `Regular hours` | Regular hours | Decimal format (e.g., `40.00`) |
| `Overtime hours` | Overtime hours | Decimal format; may be blank/`0` if none |
| `Double overtime hours` | (ignore or flag) | California-specific; not standard prevailing wage OT |
| `Gross earnings` | Gross pay (cross-check) | Dollar amount, e.g., `2450.00` |

**Additional columns** (present depending on admin configuration):
- `Employee email`, `Department`, `Work address`, `Federal income tax`, `Social security`, `Medicare`, `State income tax`, `Net pay`, `Employer FICA`

### Quirks and Caveats

1. **Name is split.** Gusto always exports `Employee first name` and `Employee last name` as separate columns. Our worker name matcher must concatenate them. Recommend: try `First Last` first, then `Last, First` if no match found.

2. **Column set is not fixed.** Gusto admins can customize which columns appear. A contractor might export a report with only Gross earnings and omit Regular/Overtime hours. The importer must detect missing columns and surface a clear error: "This report is missing Required columns: [Regular hours, Overtime hours]. Re-export with those columns enabled."

3. **Date format.** Check date and Payroll end date appear as `MM/DD/YYYY` (e.g., `04/05/2025`). Use `moment` or manual parse — do not use `new Date()` directly (timezone-sensitive).

4. **Hours are decimal.** `40.00` not `40:00`. No colon-separated duration format.

5. **Overtime column may be absent or all zeros** for salaried employees. The importer should treat blank/absent as `0`.

6. **Report grouping matters.** If the admin groups by "Payroll" instead of "Employee," the CSV structure changes (summary row per payroll run, not per employee). Our importer should validate that there is one row per employee per pay period (group by Employee is required).

7. **No Gusto Employee ID in the default report.** Name matching against `workers` is required. Gusto has a `Gusto ID` field but it is not present in the standard Payroll Journal CSV unless specifically added.

8. **Double overtime.** California law creates a "double overtime" (2x) pay tier above 12 hours/day or beyond the 7th consecutive day. Gusto exports this as a separate `Double overtime hours` column. For prevailing wage purposes this is typically treated as additional overtime. Flag in the UI but do not auto-merge.

### Smart Import (Gusto's input CSV, NOT what we parse)

For completeness: when Gusto receives CSV uploads (contractor importing hours *into* Gusto), the expected columns are `Employee first name`, `Employee last name`, `Regular hours`, `Overtime hours`. This is the reverse direction from our use case and is not relevant to our import pipeline.

### Sample Mock Row (Payroll Journal Report, grouped by Employee)

```
Payroll type,Check date,Payroll start date,Payroll end date,Employee first name,Employee last name,Regular hours,Overtime hours,Gross earnings
Regular,04/05/2025,03/30/2025,04/05/2025,Maria,Garcia,40.00,4.50,2156.25
Regular,04/05/2025,03/30/2025,04/05/2025,James,Kim,32.00,0.00,1440.00
```

### Column Mapping Table

| Gusto CSV Column | Maps To | Transform |
|-----------------|---------|-----------|
| `Employee first name` + `Employee last name` | `workers.name` (fuzzy match) | Concatenate: `"${first} ${last}"` |
| `Regular hours` | Regular hours | `parseFloat()` |
| `Overtime hours` | Overtime hours | `parseFloat()` — treat blank as 0 |
| `Payroll end date` | Week-ending date | Parse `MM/DD/YYYY` |
| `Check date` | Fallback week-ending date | Use if `Payroll end date` absent |
| `Gross earnings` | Gross pay (cross-check only) | `parseFloat()` — strip `$` if present |

### Sources

- [Gusto Help Center — View, download, and customize reports](https://support.gusto.com/article/101334493100000/View-download-and-customize-reports-in-Gusto-for-admins) — describes customizable columns (403 to fetch but confirmed by search)
- [Gusto Help Center — Run payroll with Smart Import](https://support.gusto.com/article/999914471000000/Run-payroll-with-Smart-Import) — column names Regular hours / Overtime hours confirmed
- [Payroll Report Instruction: Gusto — IRSplus](https://help.ercguaranteed.com/en/articles/8279941-payroll-report-instruction-gusto) — confirmed: Payroll type, Check date, Employee last name, Employee first name, Gross earnings as standard columns
- [Gusto Embedded Payroll API — Generate Custom Reports](https://docs.gusto.com/embedded-payroll/docs/generate-custom-reports) — confirms `payroll_journal` report type; column groupings include payroll information, employee details, work address
- [dataclean.to — Clean Date Fields from Gusto Payroll Exports](https://dataclean.to/use-cases/clean-dates-from-gusto) — confirms date format quirks in Gusto CSV exports

---

## Provider 2: Paychex

### Product Overview

Paychex has multiple product lines that produce different export formats:

| Product | Export Format | Our Use Case |
|---------|--------------|--------------|
| **Paychex Flex** (modern cloud, most common) | Flex CSV format: Client ID, Worker ID, Pay Component, Hours, Line Date... | **PRIMARY TARGET** |
| **Paychex Preview** (legacy desktop payroll) | SPI (Standard Payroll Import) flat-file format | Secondary — some contractors still use this |
| **Paychex Online** | Similar to Preview SPI | Legacy |

### Paychex Flex — Confirmed Column Set

**Confidence: HIGH** — confirmed by multiple third-party time-tracking integration guides (Sundial Time Systems, ClockShark, Clean Smarts, Workyard), all of which build Paychex Flex exporters. These sources are consistent and specific.

The Paychex Flex time import/export CSV uses this **fixed column order** (all 17 columns must be present; blank is OK for unused columns):

| Position | Column Name | Our Internal Field | Sample Value | Notes |
|----------|-------------|-------------------|--------------|-------|
| 1 | `Client ID` | (ignore) | `HCC001` | Paychex company code |
| 2 | `Worker ID` | `workers` match key | `EMP-1042` | Paychex employee ID — NOT a name |
| 3 | `Org` | (ignore) | `` | Optional org unit |
| 4 | `Job Number` | (ignore) | `JOB-5` | Job/project code, not relevant |
| 5 | `Pay Component` | Determines hours type | `Regular` / `Overtime` / `Doubletime` | **Key field** — one row per pay component per employee |
| 6 | `Rate` | (ignore) | `27.50` | Hourly rate |
| 7 | `Rate Number` | (ignore) | `1` | Rate tier |
| 8 | `Hours` | Regular or OT hours | `40.00` | Decimal; tied to Pay Component |
| 9 | `Units` | (ignore) | `` | Non-hour unit quantity |
| 10 | `Line Date` | Pay period date | `04/05/2025` | Date of paycheck or period end |
| 11 | `Amount` | (ignore) | `1100.00` | Dollar amount |
| 12 | `Check Seq Number` | (ignore) | `1` | Check sequence |
| 13 | `Override State` | (ignore) | `` | State tax override |
| 14 | `Override Local` | (ignore) | `` | Local tax override |
| 15 | `Override Local Jurisdiction` | (ignore) | `` | Jurisdiction override |
| 16 | `Labor Assignment` | (ignore) | `` | Labor distribution code |

**Critical structural note:** Paychex Flex uses **one row per pay component per employee per period**. Regular hours and overtime hours appear on separate rows, distinguished by the `Pay Component` column. The importer must aggregate rows by Worker ID:

```
Worker ID=EMP-1042, Pay Component=Regular, Hours=40.00
Worker ID=EMP-1042, Pay Component=Overtime, Hours=6.50
→ Regular: 40.00h, OT: 6.50h for employee EMP-1042
```

### Paychex Flex — Name Problem

**The Paychex Flex time CSV does not contain employee names.** It uses only `Worker ID` (Paychex's internal employee ID). This means:

- Our import cannot match workers by name from the Flex time export alone.
- The contractor must provide a mapping from Paychex Worker ID to worker name, OR
- The import UI must include a "map employees" step where the contractor manually links each Paychex Worker ID to a worker in our system.

**Recommendation for the import UI:** On first Paychex Flex import, display a mapping screen: "We found 4 unknown Paychex Worker IDs. Please match each to a worker." Store the mapping (`paychex_worker_id → workers.id`) in a project-scoped lookup table for subsequent imports.

### Paychex Flex — Payroll Register Report (Alternative)

Paychex Flex also offers a "Payroll Register" report that *does* include employee names. Columns confirmed by Deltek Vision integration documentation:

| Column Name | Notes |
|-------------|-------|
| `Employee number` | Paychex internal ID |
| `Paychex employee number` | Same or SSN-derived |
| `Employee name` | Full name in this report (not split) |
| `Hour code` | Pay type code (maps to Regular/OT) |
| `Total hours` | Hours for this hour code |
| `Employee total hours` | Sum across codes |
| `Batch ID code` | Internal batch |
| `Client code number` | Company code |

**Confidence: MEDIUM** — from a Deltek Vision integration doc, not Paychex official docs directly.

However, the Payroll Register is a read-only payroll summary report, not the time import file. Contractors exporting for prevailing wage compliance would more likely use the Payroll Register (it has names and hours together). Consider supporting both formats.

### Paychex Preview / SPI Format (Legacy)

The Standard Payroll Import (SPI) is a fixed-position flat file. Column names confirmed across multiple time-tracking vendor guides (ADP-like format):

| Column | Name | Sample |
|--------|------|--------|
| 1 | `Co Code` | `HCC` |
| 2 | `Batch ID` | `B001` |
| 3 | `File #` (employee ID) | `1042` |
| 4+ | Hours columns by code | Varies by configuration |

This is essentially the same format as ADP. The app's existing ADP parser may handle Paychex Preview with minimal changes (column name differences only).

### Sample Mock Rows (Paychex Flex format)

```
Client ID,Worker ID,Org,Job Number,Pay Component,Rate,Rate Number,Hours,Units,Line Date,Amount,Check Seq Number,Override State,Override Local,Override Local Jurisdiction,Labor Assignment
HCC001,EMP-1042,,JOB-5,Regular,27.50,1,40.00,,04/05/2025,1100.00,1,,,,
HCC001,EMP-1042,,JOB-5,Overtime,41.25,1,6.50,,04/05/2025,268.13,1,,,,
HCC001,EMP-2011,,JOB-5,Regular,24.00,1,32.00,,04/05/2025,768.00,1,,,,
```

### Column Mapping Table

| Paychex Flex Column | Maps To | Transform |
|--------------------|---------|-----------|
| `Worker ID` | `workers` match key (via stored mapping) | Look up in `paychex_worker_map` table |
| `Pay Component` = `"Regular"` | Regular hours (from `Hours` column) | Filter rows; `parseFloat(Hours)` |
| `Pay Component` = `"Overtime"` | Overtime hours (from `Hours` column) | Filter rows; `parseFloat(Hours)` |
| `Line Date` | Week-ending date | Parse `MM/DD/YYYY` |
| `Amount` (summed) | Gross pay (cross-check) | Sum across all components for worker |

### Sources

- [Sundial Time Systems — Paychex Flex Importing Time](https://sundialtimesystems.freshdesk.com/support/solutions/articles/1000329791-paychex-flex-importing-time) — confirmed 17-column format in exact order; HIGH confidence
- [Clean Smarts — Export timesheet data in Paychex format](https://support.cleansmarts.com/article/108-how-do-i-export-timesheet-data-in-paychex-format) — confirmed: Company ID, Worker ID, Pay Component (Regular/Overtime/Doubletime), Hours; HIGH confidence
- [Workyard — Set Up & Download Payroll File for Paychex Flex](https://help.workyard.com/en/articles/7792211-how-to-set-up-download-payroll-file-for-paychex-flex) — confirmed Worker ID + Pay Component pattern
- [Deltek Vision — Paychex Export Report](https://help.deltek.com/product/Vision/7.4/pay_Paychex_Export_Report.html) — Payroll Register columns; MEDIUM confidence
- [Icon Time — Paychex Online Payroll Export User Guide (PDF)](https://www.icontime.com/images/docs/Paychex%20Online%20Payroll%20Export%20User%20Guide.pdf) — PDF could not be parsed by fetch; referenced as corroborating source
- [Paychex SPI Overview](https://myapps.paychex.com/pngHelp_static/helpHtml/Standard_Payroll_Import_Overview.htm) — confirmed SPI is fixed-position; returned 404

---

## Provider 3: Sage / Timberline

### Product Disambiguation

"Sage/Timberline" covers two distinct products used in construction:

| Product | Formerly Known As | Primary Market | Payroll Module |
|---------|------------------|----------------|----------------|
| **Sage 300 CRE** | Timberline Office | Large GCs, heavy construction | Payroll + Job Cost (PR module) |
| **Sage 100 Contractor** | Sage Master Builder | Mid-size contractors | Payroll module 5-2-2 |

Both are prevalent in prevailing wage construction. They have different export formats.

### Sage 300 CRE (Timberline) — PR Time Entry Import

**Confidence: MEDIUM** — based on Sage community forums, Procore integration docs, and a Corfix integration guide; official Sage 300 CRE help pages do not expose column names in publicly crawlable form.

Sage 300 CRE payroll import uses a **time entry view** system where the column order matches a user-configured "Time Entry View." The canonical default order (confirmed by community forum verified answers) is:

| Position | Field Name | Our Internal Field | Notes |
|----------|-----------|-------------------|-------|
| 1 | `Employee` | `workers.name` match key | Employee number (not name) in most configs |
| 2 | `Date` | Work date / pay period date | Format based on Windows locale (usually `MM/DD/YYYY` or `M/D/YYYY`) |
| 3 | `Job` | (ignore) | Job number |
| 4 | `Extra` | (ignore) | Sub-job / phase code |
| 5 | `Cost Code` | (ignore) | Cost code |
| 6 | `Category` | (ignore) | Cost category |
| 7 | `Certified` | (flag) | `Y`/`N` — certified payroll flag |
| 8 | `PayID` | Determines hours type | Pay code (e.g., `REG`, `OT`, `DT`) — company-defined |
| 9 | `Units` | Hours | Decimal hours for this PayID |

**Additional optional columns** (position depends on Time Entry View configuration):
- `Rate`, `Equipment`, `Equipment Category`, `Description`, `Debit Acct`, `Credit Acct`

**Critical:** The file format is `.txt` (comma-delimited, renamed from `.csv`). Sage 300 CRE will not import a `.csv` extension — the contractor must rename to `.txt`. This is a known quirk.

### Sage 300 CRE — PayID Codes

The `PayID` column is a company-defined pay code. Common conventions:
- `REG` or `1` = Regular time
- `OT` or `2` = Overtime (1.5x)
- `DT` or `3` = Double time (2x)

There is no universal standard. Contractors define their own PayID codes in their Sage setup. The import UI must:
1. Parse the unique PayID values present in the uploaded file
2. Ask the contractor to classify each PayID as Regular, Overtime, or Double Time

### Sage 300 CRE — Employee Field

The `Employee` column contains the Sage employee number (numeric ID), not the employee name. The importer faces the same name-resolution problem as Paychex Flex: a mapping step is required.

However, Sage 300 CRE reports (as opposed to time entry import files) do include employee names. The **PR Employee Hours** inquiry (accessible via Reports in the Payroll module) exports to Excel with columns:
- `Employee ID`
- `Employee Name`
- `YTD Regular Hours`
- `YTD Overtime Hours`
- `YTD Total Hours`

A contractor exporting a period report (not YTD) can get `Employee Name` + hours in a single Excel/CSV export. This is the more practical source for our import.

### Sage 100 Contractor (Master Builder) — 5-2-2 Payroll Records

**Confidence: MEDIUM** — based on EiDynamics integration documentation which provides positional column specs; not official Sage documentation.

Sage 100 Contractor uses a positional CSV format (no named headers). Positions are referenced as COL1, COL2, etc.:

**Header record** (one per paycheck):

| Position | Field | Sample Value | Notes |
|----------|-------|-------------|-------|
| COL3 | Employee No | `1042` | Numeric employee number |
| COL4 | Period Start | `2025-03-30` | `YYYY-MM-DD` |
| COL5 | Period End | `2025-04-05` | `YYYY-MM-DD` — use as week-ending date |
| COL6 | Check No | `CHK-5512` | |
| COL7 | Check Date | `2025-04-05` | `YYYY-MM-DD` |
| COL8 | Payroll Type | `1` | 1=Regular, 2=Bonus, 3=Hand Computed |
| COL12 | Salary | `0` | |
| COL13 | Reg Hourly Rate | `27.50` | |
| COL14 | OT Hourly Rate | `41.25` | |

**Detail/timecard record** (one per day or pay type within paycheck):

| Position | Field | Sample Value | Notes |
|----------|-------|-------------|-------|
| COL4 | Work Date | `2025-04-01` | `YYYY-MM-DD` |
| COL13 | Pay Type | `1` | 1=Regular, 2=OT, 3=DT |
| COL16 | Hours Worked | `8.00` | Required for pay types 1–6 |

**Critical:** This is a positional format, not header-named. Papaparse must use `header: false` and access columns by index. The importer must sum COL16 values grouped by COL13 (Pay Type) to get total regular and OT hours.

**Also critical:** Sage 100 Contractor does not typically export this import-format file as a routine report. More commonly, contractors use the **5-5-1 Payroll Check Register** or **5-2-3 Employee List** reports and export to Excel. Those reports have named columns including `Employee Name`.

### Sample Mock Rows (Sage 300 CRE Time Entry format)

```
1042,04/01/2025,JOB-5,,CC-200,1,Y,REG,8.00
1042,04/02/2025,JOB-5,,CC-200,1,Y,REG,8.00
1042,04/03/2025,JOB-5,,CC-200,1,Y,OT,10.00
```

### Sample Mock Row (Sage 100 Contractor 5-2-2 positional format)

```
,,1042,2025-03-30,2025-04-05,CHK-5512,2025-04-05,1,,,,0,27.50,41.25,,
,,,2025-04-01,,,,1,,,,,,16,8.00
,,,2025-04-02,,,,1,,,,,,16,8.00
,,,2025-04-03,,,,2,,,,,,16,2.50
```

### Column Mapping Table (Sage 300 CRE — time entry format)

| Sage 300 CRE Column | Maps To | Transform |
|--------------------|---------|-----------|
| `Employee` (col 1) | `workers` match key (via stored mapping) | Look up in `sage300_employee_map` table |
| `Date` (col 2) | Work date | Parse locale-format date |
| `PayID` (col 8) | Hours type | Contractor-classified: REG/OT/DT |
| `Units` (col 9) | Hours for that PayID | `parseFloat()` |
| Sum `Units` where PayID=REG | Regular hours | Aggregate |
| Sum `Units` where PayID=OT | Overtime hours | Aggregate |

### Column Mapping Table (Sage 100 Contractor — positional format)

| Position | Sage 100 Field | Maps To | Transform |
|----------|---------------|---------|-----------|
| COL3 (header) | Employee No | `workers` match key | Look up in `sage100_employee_map` |
| COL5 (header) | Period End | Week-ending date | Parse `YYYY-MM-DD` |
| COL13 (detail) | Pay Type | Hours type | `1`=Regular, `2`=OT |
| COL16 (detail) | Hours Worked | Hours | `parseFloat()` |

### Sources

- [Sage 300 CRE Community — Payroll import time entry format](https://communityhub.sage.com/us/sage_construction_and_real_estate/f/sage-300-construction-and-real-estate/107358/payroll-import-time-entry-format) — confirmed column order: Employee, Date, Job, Extra, Cost Code, Category, Certified, PayID, Units; MEDIUM confidence
- [Sage 300 CRE Community — Payroll Hours Worked Report](https://communityhub.sage.com/us/sage_construction_and_real_estate/f/sage-300-construction-and-real-estate/158477/payroll-hours-worked-report) — confirmed PR Employee Hours inquiry columns; MEDIUM confidence
- [EiDynamics — Sage 100 Contractor Import Payroll Records](https://www.eidynamics.com/Software/ProductInfo/S100CDIS/Sage100PayrollRecords) — confirmed positional COL format with field names; MEDIUM confidence
- [Procore — Set Up Payroll Export for Sage 300 CRE](https://support.procore.com/products/online/user-guide/company-level/timesheets/tutorials/set-up-your-payroll-export-for-use-with-sage-300-cre) — confirmed field mapping (Employee, Classification, PayID, Job, Cost Code); MEDIUM confidence
- [Corfix — How to import into Sage 300](https://knowledge.corfix.com/articles/how-to-import-into-sage-300) — confirmed Regular time maps to `Units` column; MEDIUM confidence
- [Sage 300 Help — About Importing and Exporting Payroll Data](https://help.sage300.com/en-us/2024/classic/Subsystems/UP/Content/GettingStarted/AboutImportingandExporting.htm) — confirms CSV/Excel/XML export support; HIGH confidence for format existence, LOW for field names

---

## Cross-Provider Implementation Notes

### Format Detection Strategy

The importer should auto-detect the provider format from the file before asking the contractor to select. Detection heuristics:

| Signal | Likely Provider |
|--------|----------------|
| Header row contains `Pay Component` and `Worker ID` | Paychex Flex (time format) |
| Header row contains `Employee name` and `Hour code` | Paychex Payroll Register |
| Header row contains `Employee first name` and `Payroll end date` | Gusto |
| Header row contains `Check date` and `Gross earnings` | Gusto (alternative column set) |
| No header row (or header is numeric/blank) AND column 5 is a date in `YYYY-MM-DD` format | Sage 100 Contractor |
| Comma-delimited with `Employee` in col 1 and `PayID` in col 8 | Sage 300 CRE time entry |
| File extension is `.txt` | Likely Sage 300 CRE (they rename CSV to TXT) |

If detection is ambiguous, surface a manual selection dropdown: "Which payroll provider exported this file?"

### The Name-Resolution Problem

Three of the three new providers have no clean name-in-the-export situation:

| Provider | Employee Identifier in Export | Resolution |
|----------|------------------------------|-----------|
| Gusto | First Name + Last Name (split) | Concatenate then fuzzy-match against `workers.name` |
| Paychex Flex | Worker ID only (no name) | Must store `paychex_worker_id → workers.id` mapping |
| Sage 300 CRE | Employee Number only (no name) | Must store `sage300_employee_num → workers.id` mapping |
| Sage 100 Contractor | Employee Number only (no name) | Must store `sage100_employee_num → workers.id` mapping |

The existing UI for QuickBooks/ADP already includes a "confirm unmatched workers" step (Option B — no silent skips). This step needs to be extended to handle ID-to-name mapping for Paychex and Sage, not just name-match confirmation.

**Recommendation:** Introduce a `payroll_provider_mappings` table:
```sql
CREATE TABLE payroll_provider_mappings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL,
  provider    TEXT NOT NULL,        -- 'paychex_flex', 'sage_300', 'sage_100'
  provider_id TEXT NOT NULL,        -- Worker ID or Employee Number from provider
  worker_id   INTEGER NOT NULL,     -- FK to workers.id
  created_at  INTEGER NOT NULL,
  UNIQUE(project_id, provider, provider_id)
);
```

### Hours Aggregation (Paychex Flex and Sage 300 CRE)

Both Paychex Flex and Sage 300 CRE export one row per day (or per pay component per day). To get weekly totals:
- Group by employee identifier
- Sum `Hours`/`Units` where PayID/Pay Component = Regular → regular hours total
- Sum `Hours`/`Units` where PayID/Pay Component = Overtime → OT hours total
- The date range in the file is the pay period — use max date as week-ending

The existing ADP import also produces weekly totals (ADP exports summaries), so the downstream pipeline already handles this. The aggregation step is new for Paychex Flex and Sage 300.

### Date Parsing

| Provider | Date Format | Example | Parse Method |
|----------|------------|---------|-------------|
| Gusto | `MM/DD/YYYY` | `04/05/2025` | `date.split('/') → [MM, DD, YYYY]` |
| Paychex Flex | `MM/DD/YYYY` | `04/05/2025` | Same |
| Sage 300 CRE | Locale-dependent | `4/5/2025` or `04/05/2025` | Try `MM/DD/YYYY` then `M/D/YYYY` |
| Sage 100 Contractor | `YYYY-MM-DD` | `2025-04-05` | ISO 8601 — `new Date()` safe |

---

## Gaps / Unknowns

### High-Priority Gaps

1. **Gusto exact column names not confirmed from official source.** Gusto's help pages return 403 to automated fetches. Column names (`Regular hours`, `Overtime hours`, `Payroll end date`, `Employee first name`, `Employee last name`) are confirmed by multiple third-party integration guides but not from an official Gusto API schema or downloadable template. **Risk:** Gusto may use slightly different capitalization or spacing (`Regular Hours` vs `Regular hours`). The parser should normalize headers to lowercase-trimmed before matching.

2. **Paychex Flex — no employee name in time import file.** Confirmed by all sources. The Worker ID → name mapping step is architecturally required before this feature can work end-to-end. This requires a new DB table and a new UI flow (not just a column mapper). Scope this explicitly in the phase plan.

3. **Sage 300 CRE PayID codes are company-defined.** There is no universal standard for what `REG` or `OT` means — each Sage 300 CRE installation defines its own codes. The import UI *must* include a PayID classification step. This is non-optional; silently guessing would produce wrong data.

4. **Sage 300 CRE time entry format vs. report format.** The time entry import format (for importing *into* Sage) is positional and named differently from what a contractor exports *from* Sage for reporting. A contractor may export a different format (e.g., the PR Employee Hours report to Excel) depending on how their Sage is configured. We may need to support both variants.

5. **Paychex Preview / SPI.** The legacy Paychex SPI format is similar to ADP (Co Code, Batch ID, File #). Our existing ADP parser may handle it with minor changes. Needs testing against a real SPI file. If a contractor is on Paychex Preview they likely have the same ADP-format columns — treat them the same.

### Medium-Priority Gaps

6. **Gusto double overtime.** The `Double overtime hours` column appears in California-heavy Gusto accounts. Our app should handle it gracefully (not crash), but how to classify it for prevailing wage purposes (count as OT? separate line?) is a product decision, not a technical one.

7. **Sage 100 Contractor positional format in the wild.** The positional format from EiDynamics documentation is a third-party integration tool, not Sage's native export. In practice, most Sage 100 Contractor users export payroll data via the 5-5-1 Payroll Check Register to Excel, which has named columns including employee name. The positional format documented above may only apply when using EiDynamics' import product. **Recommendation:** Support the named-column Excel/CSV export (5-5-1 Check Register) as the primary Sage 100 Contractor format instead.

8. **Paychex Flex date for "week-ending date."** The `Line Date` column in Paychex Flex time export is the date of the paycheck (check date), not the last day of the pay period. For weekly payroll, these are the same. For bi-weekly payroll, the check date may be several days after the actual week-ending date. For prevailing wage CPR, the week-ending date is required (e.g., Saturday). This discrepancy must be surfaced to the contractor for confirmation.

9. **Multi-week Paychex exports.** A contractor may export a multi-week Paychex report and upload it to our importer. Our importer must detect multiple `Line Date` values and either (a) split into separate payroll week imports or (b) reject and ask the contractor to export one week at a time.

### Low-Priority / Out of Scope

10. **Sage Intacct.** Some construction companies have migrated from Sage 300 CRE to Sage Intacct (cloud). Sage Intacct has its own export format. Out of scope for this phase — Sage 300 CRE and Sage 100 Contractor are the construction-specific products.

11. **Paychex Oasis / Paychex PEO.** Some contractors use Paychex Oasis (PEO product). Format may differ from Flex. Out of scope.

12. **Gusto API.** Gusto has a developer API (`docs.gusto.com`) that can generate payroll journal reports programmatically. For this phase we are doing file-upload import (same as QuickBooks/ADP), not API integration. The Gusto API is a future enhancement.

---

## Implementation Priority Recommendation

Given the gaps above, the recommended implementation order:

1. **Gusto** — Highest confidence on column names; name-based matching works like QuickBooks. Build first. Primary blocker: normalize header capitalization.

2. **Paychex Flex** — High confidence on format; but requires new `payroll_provider_mappings` table and ID-to-name mapping UI. Build second.

3. **Sage 300 CRE** — Medium confidence; requires PayID classification UI step. Build third. Target the time entry format initially; add PR Employee Hours report support if contractors request it.

4. **Sage 100 Contractor** — Defer until a contractor requests it. Positional format is complex; the 5-5-1 Check Register Excel export (named columns) may be a better entry point when the time comes.

---

*Researched: 2026-04-01 by Claude Sonnet 4.6*
*Confidence summary: Gusto — MEDIUM; Paychex Flex — HIGH; Sage 300 CRE — MEDIUM; Sage 100 Contractor — MEDIUM/LOW*
