# State-Specific Certified Payroll Form Research: NY DOL and IL DOL

**Project:** prevailing-wage (Node.js/Express/TypeScript + React/Vite + SQLite/Drizzle + pdf-lib)
**Researched:** 2026-04-01
**Scope:** NY DOL and IL DOL certified payroll form field layouts, submission requirements, and compliance rules
**Confidence:** HIGH — primary sources include official DOL PDFs, official MPWR/XML schema guide, and official IL IDOL form extractions

---

## Table of Contents

1. [New York DOL — Form Overview](#ny-dol-form-overview)
2. [New York DOL — Field Layout (PW-12 and PW-18.1)](#ny-field-layout)
3. [New York DOL — MPWR XML Bulk Upload Schema](#ny-xml-schema)
4. [New York DOL — Submission Requirements](#ny-submission-requirements)
5. [New York DOL — Compliance Rules Unique to NY](#ny-compliance-rules)
6. [Illinois DOL — Form Overview](#il-dol-form-overview)
7. [Illinois DOL — Field Layout (Certified Transcript of Payroll)](#il-field-layout)
8. [Illinois DOL — Affidavit / Statement of Compliance](#il-affidavit)
9. [Illinois DOL — Submission Requirements](#il-submission-requirements)
10. [Illinois DOL — Compliance Rules Unique to IL](#il-compliance-rules)
11. [Fillable PDF Availability](#fillable-pdf-availability)
12. [Delta vs WH-347: Fields Required Beyond Federal](#delta-vs-wh347)
13. [Implementation Guidance for pdf-lib](#implementation-guidance)
14. [Gaps / Unknowns](#gaps-unknowns)
15. [Sources](#sources)

---

## 1. NY DOL — Form Overview {#ny-dol-form-overview}

**Governing law:** Article 8, NYS Labor Law (Sections 220–220-e)
**Primary form for state-agency projects:** PW-12 "Weekly Payroll" (NYSDOL Bureau of Public Work)
**Supplemental certification form:** PW-18.1 "Certification of Payroll Record" (used when contractor does not use PW-12)
**NYC projects only:** NYC Comptroller Bureau of Labor Law "Certified Payroll Report" (separate form)
**Form revision dates:** PW-12 last revised 1-09; PW-18.1 last revised 03-07

### Key change as of January 1, 2026 (HIGH confidence — official announcement)

All contractors and subcontractors on Article 8 public work projects **must** submit certified payrolls electronically via the **MPWR Certified Payroll portal** (https://mpwr-public.labor.ny.gov). Paper PW-12 is no longer the primary submission mechanism for Article 8 projects. The portal replaced the legacy paper/PDF workflow.

- Portal URL: https://mpwr-public.labor.ny.gov/en
- Bulk XML upload supported; no API
- CSV/spreadsheet not accepted — XML only
- Payrolls due every 30 days (not weekly filing, but weekly records must exist)
- Penalty: $100/day after a 14-day grace period

**For your app:** You should generate a PW-12 PDF for offline/agency use AND generate an XML file per the NYSDOL XSD schema for MPWR portal upload.

---

## 2. NY DOL — Field Layout (PW-12 and PW-18.1) {#ny-field-layout}

### PW-12 "Weekly Payroll" Header Fields

| Field | Notes |
|-------|-------|
| Name of Contractor | Company name |
| FEIN | Federal Employer Identification Number |
| Subcontractor (checkbox) | Whether filer is a subcontractor |
| Address | Contractor address |
| Week Ending Date | Pay period end date |
| Project and Location | Project name and site address |
| Project or Contract Number | Contracting agency's number |

### PW-12 Per-Employee Row Columns

| Column # | Field Name | Notes |
|----------|-----------|-------|
| (1) | Name, Address, Last 4 Digits of SSN | Combined field per row |
| (2) | No. of Withholdings | Tax exemptions claimed |
| (3) | Work Classification (ST or OT) | Trade/craft classification + straight/overtime indicator |
| (4) | Day and Date — Hours Worked Each Day | 7 day columns (Mon–Sun presumably) |
| (5) | Total Hours | Sum of daily hours |
| (6) | Rate of Pay | Hourly rate |
| (7) | Gross Amount Earned | Total gross pay |
| (8a) | Deductions — FICA | Social Security/Medicare |
| (8b) | Deductions — Withholding Tax | Federal/state income tax |
| (8c) | Deductions — Other Deductions | itemized other |
| (8d) | Deductions — Total | Sum of all deductions |
| (9) | Net Wages Paid for Week | Gross minus deductions |

**Note:** PW-12 does NOT have a dedicated supplements/fringe benefit column. Fringe benefits are addressed in the statement of compliance certification section (see below).

### PW-12 Certification (Statement of Compliance) Text

Signed by name + title. Affirms:
1. Employees were paid full weekly wages earned
2. No rebates made directly or indirectly
3. No impermissible deductions taken
4. Wage rates are not less than applicable prevailing rates from the wage determination
5. Classifications conform to work actually performed
6. All apprentices are duly registered in a bona fide apprenticeship program

Fringe benefit sub-clauses:
- **(b) WHERE FRINGE BENEFITS ARE PAID IN CASH** — affirms each worker paid at least base rate + required fringe as listed in contract
- **(c) EXCEPTIONS** — space for noting any craft/employee exceptions with explanations

Warning: "THE WILLFUL FALSIFICATION OF ANY OF THE ABOVE STATEMENTS MAY SUBJECT THE CONTRACTOR OR SUBCONTRACTOR TO CIVIL OR CRIMINAL PROSECUTION. SEE ARTICLES 8 AND 9."

### PW-18.1 "Certification of Officer of Contractor or Subcontractor"

Used as a standalone certification when payroll records are on file but need to be certified separately. Contains:

| Field | Value |
|-------|-------|
| Case ID # | Bureau use only |
| PRC # | Prevailing Rate Case number (key project identifier) |
| Name of Officer (signatory) | Full name |
| Title of Officer | Title at firm |
| Name of Firm | Company name |
| Payroll period commencing date | Start of pay period |
| Payroll period ending date | End of pay period |
| Project name | |
| Address of firm | |
| Notary / Sworn statement | Must be notarized OR signed before authorized official |

**Certification text affirms:**
1. All laborers/workers/mechanics were paid wages and supplements recorded on attached payroll records
2. No impermissible deductions
3. Payroll records are correct and complete; hours reflect actual hours; classifications are accurate

Form number: PW-18.1 (03-07)

### NYC Comptroller Bureau of Labor Law "Certified Payroll Report" (NYC projects only)

| Field | Notes |
|-------|-------|
| Employer Name | |
| Employer Address | |
| Employer Email Address | NYC-specific |
| Employer Phone # | |
| Employer Tax I.D. # | |
| Check if Project Labor Agreement (PLA) | Checkbox |
| Payroll # | Sequential payroll number |
| Project Name | |
| Week Ending Date | |
| Name of Prime Contractor, Building Owner or Utility | |
| Contract Registration # | NYC-specific |
| Agency | NYC agency name |
| Agency PIN # | NYC procurement ID |
| Project or Building Address | |

Per-employee columns:
| Column # | Field |
|----------|-------|
| (1) | Worker Name, Address, Last Four Digits of SSN |
| (2) | Trade Classification |
| (3) | Union Local # |
| (3) | Journeyperson or Apprentice (NYS DOL Registered) |
| (3) | T/I/M/E/S/T indicator (time type codes) |
| (4) | Day and Date — Hours Worked Each Day |
| (5) | Total Hours (this project) |
| (6) | Hourly Rate of Pay |
| (7) | Gross Pay (This Project) |
| (8) | Total Gross Pay (All Work) — public and private combined |
| (8) | Withholdings and Deductions |
| (9) | Net Pay |
| (10) | Bona Fide Fringe Benefits — Hourly Contributions to Benefit Funds or Individual Accounts |
| (10) | All Other Bona Fide Fringe Benefits — Employer Projected Annual Cost, Employee Projected Annual Hours, Annualized Hourly Rate |

**NYC Certification Text:** "I certify that the above information represents the hours worked by, wages paid to and bona fide fringe benefits provided to all of the workers employed by the above named employer on this project, contract or building during the period shown. I understand that falsification of this statement is a punishable offense."

Signed by: Officer or Principal of Employer (printed name + title + signature + date)

---

## 3. NY DOL — MPWR XML Bulk Upload Schema {#ny-xml-schema}

Source: Official NYSDOL Bulk Upload Formatting Guide (January 2026 version, extracted from official PDF)

**XSD download:** https://dol.ny.gov/nydolcertpayrollxsd
**Sample XML:** https://dol.ny.gov/certpayrollsamplexml
**Max records per file:** 500 employee work weeks

### XML Element Structure

```
ProjectRollup                           (Level 1)
  prcNumber                             Required — Prevailing Rate Case number (ISO date: 2025-09-01T12:00:00.000Z format for weekEndingDate)
  weekEndingDate                        Required
  employeeWorkWeeks                     Required
    employeeWorkWeek[]                  (Level 3, max 500)
      employee                          (Level 4)
        firstName                       Required, max 45 chars
        middleName                      Optional, max 45 chars
        lastName                        Required, max 45 chars
        dateOfBirth                     Conditional — required if ssnLast4 not provided
        ssnLast4                        Conditional — required if dateOfBirth not provided
        nysRegisteredApprentice         Required — "true" or "false"
        address
          address1                      Required, max 42 chars
          address2                      Optional, max 42 chars
          city                          Required, max 40 chars
          state                         Required, max 50 chars
          postalCode                    Required, 5 digits
          postalCodeExt                 Optional, 4 digits
          country                       Optional, max 50 chars
      deductionGrossEarnings            Required, max 999,999.99
      netWages                          Required, max 999,999.99
      workWeeks                         Required
        workWeek[]
          workCategory                  Required, max 300 chars (must match portal dropdown)
          stHourlyRate                  Required, max 9,999.99
          otHourlyRate                  Required, max 9,999.99
          days
            day[]                       Max 7 days
              day                       Required, YYYY-MM-DD format
              standardTimeHours         Required, max 24.00
              overTimeHours             Required, max 24.00
          deductions
            deduction[]                 Max 10
              type                      Required if deduction, max 50 chars
              amount                    Required if deduction
          supplementalPayments
            supplementalPayment[]
              type                      Valid values: Health/Welfare, Vacation/Holiday,
                                        Apprenticeship/Training, Pension, Other Benefit (Type)
              explanation               Conditional — only if type = "Other Benefit (Type)"
              standardHourlyRate        Required, max 9,999.99
              overtimeHourlyRate        Required, max 9,999.99
```

**Key notes for implementation:**
- `workCategory` must match dropdown values in the MPWR portal exactly (classification names from NY wage schedule)
- Either `ssnLast4` OR `dateOfBirth` must be provided, not both
- `nysRegisteredApprentice` is a boolean string field ("true"/"false"), not a numeric level
- No API available — XML file upload only
- One project per file, one week per file
- Portal URL for submission: https://mpwr-public.labor.ny.gov

---

## 4. NY DOL — Submission Requirements {#ny-submission-requirements}

| Requirement | Details |
|-------------|---------|
| Submission method | Electronic via MPWR portal (mandatory as of Jan 1, 2026) |
| Portal URL | https://mpwr-public.labor.ny.gov/en |
| Account requirement | NY.gov account (free) |
| Frequency | At least every 30 days; up to 5 weekly payrolls per 30-day cycle |
| Project identifier | PRC (Prevailing Rate Case) number — issued by NYSDOL Bureau of Public Work |
| Contractor registration | NYS Contractor Registry number required |
| FEIN required | Yes, at project setup |
| Payment bond | Required for public improvement projects (upload at setup) |
| Record retention | 6 years minimum (Article 8, Section 220) |
| Penalty for late filing | $100/day after 14-day grace period |
| Penalty for falsification | Civil or criminal prosecution, up to 15 years imprisonment |
| Debarment | 5 years for two willful violations within 6-year period |
| Wage schedule effective date | July 1 annually; contractor responsible for updated rates |
| NYC exception | NYC projects submit to NYC Comptroller Bureau of Labor Law separately |

---

## 5. NY DOL — Compliance Rules Unique to NY {#ny-compliance-rules}

### Overtime

- **Daily threshold:** 8 hours/day triggers overtime (NOT purely a 40-hour/week test)
- Rate: 1.5x basic hourly wage rate
- Maximum standard workweek: 5 days/week, 8 hours/day unless Bureau grants dispensation (Form PW-30)
- Four-day/10-hour workweek requires explicit Bureau approval — not automatically allowed

### Supplements (Fringe Benefits)

NY uses the term "supplements" (not "fringe benefits").

- Supplements are **per hour worked** unless the wage schedule states otherwise
- Supplements for overtime hours: typically time-and-one-half of the hourly supplement rate for overtime hours (9th & 10th hours on weekdays, first 8 hours Saturdays)
- Employers may pay supplements as:
  1. Cash in wages, or
  2. Contributions to bona fide benefit plans, or
  3. Combination
- Annualization required if contributions not made on per-hour-worked basis: annual contributions ÷ total annual hours worked = hourly credit
- Non-qualifying items (cannot count toward supplement requirement): travel pay, meal allowances, vehicle reimbursements, uniforms, tools

### Apprenticeships

- Apprentices **must** be individually registered with NYSDOL Commissioner of Labor
- No other state or federal agency registration accepted for NY
- Ratio of apprentices to journeyworkers: statewide building trade ratios set by NYSDOL (published with wage schedule)
- Unregistered apprentice must be paid journeyworker rate for all work performed
- Verification of registration: written request to NYS DOL Office of Employability Development/Apprenticeship Training, Albany

### Wage Rate Determination

- County-by-county wage schedules issued by NYSDOL Bureau of Public Work
- Updated annually July 1; errors corrected on first business day of each month
- "Higher wage rule": where federal and state rates conflict, pay the higher rate
- PRC number uniquely identifies a project's applicable wage schedule

### Record Retention

- 6 years (longer than federal's 3-year WH-347 requirement)
- Records must be maintained at the worksite if contractor has no NY place of business and contract exceeds $25,000

### Withholding

- Up to 25% of contract withheld (not to exceed $100,000) if payroll records not furnished within 10 days of Commissioner request

---

## 6. IL DOL — Form Overview {#il-dol-form-overview}

**Governing law:** Illinois Prevailing Wage Act, 820 ILCS 130 (as amended by PA 100-1177)
**Form name:** "Certified Transcript of Payroll" (no standardized form number visible on face of form; internal code IL452CM02 on page 1, IL452CM01 on affidavit page 2)
**Current version:** Not explicitly dated on form; Excel import template last updated July 1, 2025 per portal
**Submission portal:** https://webapps.illinois.gov/DOL/PayrollCertification/
**Account requirement:** Illinois Public ID Account (https://accounts.illinois.gov)

The form is **two pages**:
- Page 1: Employee payroll detail table
- Page 2: Affidavit / Statement of Compliance + fringe benefit fund details + subcontractor list

---

## 7. IL DOL — Field Layout (Certified Transcript of Payroll) {#il-field-layout}

### Page 1 Header Fields

| Field | Notes |
|-------|-------|
| IDOL Case File Number | Department use only |
| Payroll Start Date | Pay period start |
| Payroll End Date | Pay period end |
| Contractor and/or Subcontractor — Company Name | |
| Contractor Contact Name | |
| Contractor Street Address | |
| Contractor City | |
| Contractor State | |
| Contractor Zip Code | |
| Public Body Name | Contracting government agency |
| Public Body Contact Name | |
| Public Body Street Address | |
| Public Body City | |
| Public Body State | |
| Public Body Zip Code | |
| Public Body Telephone Number | |
| Contract Number | |
| Project Number | |
| Project Location | |
| Agency | |
| State Capital Fund or Rebuild Illinois Project | Checkbox |
| No Work Report | Checkbox |

### Page 1 Per-Employee Row Columns

Each worker occupies one or more rows (one row per classification per pay period).

| Column | Field | Notes |
|--------|-------|-------|
| Worker Name | Full name | |
| Worker Address | Street address | |
| Last Four of SSN | Last 4 digits | |
| Worker Telephone Number | | |
| Labor Classification | Trade/craft title | |
| PW / N indicator | "PW" = Prevailing Wage hours; "N" = Non-Prevailing Wage hours | **IL-unique: both must be reported** |
| SUN | Sunday hours | |
| MON | Monday hours | |
| TUE | Tuesday hours | |
| WED | Wednesday hours | |
| THR | Thursday hours | |
| FRI | Friday hours | |
| SAT | Saturday hours | |
| Total Straight Time Hours | Sum of straight-time hours | |
| Total OT Hours | Overtime hours | |
| Hourly Wage Rate | Base hourly rate | |
| OT Wage Rate | Overtime hourly rate | |
| Gross (Per Pay Period) | Total gross pay | |
| Net (Per Pay Period) | Total net pay | |
| Hourly Fringe Benefit — Pension | Per-hour pension contribution | |
| Hourly Fringe Benefit — Health/Welfare | Per-hour H&W contribution | |
| Hourly Fringe Benefit — Vacation | Per-hour vacation contribution | |
| Hourly Fringe Benefit — Training | Per-hour training contribution | |
| "F" flag | Placed next to hourly rate when contributions paid to jointly-managed fund under LMRA | |

### IL-Unique Field: Demographic Information (required by 820 ILCS 130)

The IDOL online portal captures per-employee demographic fields **not present on the paper form face**:

| Field | Values |
|-------|--------|
| Race | Categories per federal EEO standards |
| Ethnicity | Hispanic/Latino or Not Hispanic/Latino |
| Gender | Male / Female / Non-binary |
| Military Veteran Status | Veteran / Non-veteran |
| Skill Level | Journey Worker / Apprentice |

These fields are required by the Illinois Prevailing Wage Act (PA 100-1177). Contractors must ask employees for this information; employees may decline. The IDOL publishes quarterly public reports on workforce demographics by trade and county.

---

## 8. IL DOL — Affidavit / Statement of Compliance {#il-affidavit}

Page 2 of the Certified Transcript of Payroll is the **"Weekly Statement of Compliance"** affidavit (form code IL452CM01).

### Affidavit Text

> I, [name signatory party], [Title], do hereby state: that I pay or supervise the payment of the persons employed on the public works project [name of project]; that during the payroll period commencing on the [day] of [month], [year], all persons employed on said project have been paid the full weekly wages earned, that no rebates have been or will be made either directly or indirectly to or on behalf of said [name of contractor or subcontractor] from the full weekly wages earned by any person, and that no deductions have been made either directly or indirectly from the full weekly wages earned by any persons, other than permissible deductions as defined by Federal and/or State Law. I further certify that this payroll is correct and complete; that the wage rates contained therein are not less than the actual rates herein stated and that the classification set forth for each laborers or mechanic conform to the work he/she performed.

### Fringe Benefit Fund Details (Page 2) — Required if NOT paying to jointly-managed LMRA fund

For each fringe benefit type (Health, Pension, 401k, Vacation), contractor must provide:
- Fund Name
- Fund Address
- Plan Sponsor
- Plan Administrator

### Subcontractor Section (Page 2)

Up to 4 subcontractors listed per page:
- Company Name
- Contact Person
- Address
- City, State, Zip
- Telephone Number

### Signature

Digital signature accepted. Form must be submitted with every certified payroll.

---

## 9. IL DOL — Submission Requirements {#il-submission-requirements}

| Requirement | Details |
|-------------|---------|
| Submission method | Electronic via portal (mandatory) |
| Portal URL | https://webapps.illinois.gov/DOL/PayrollCertification/ |
| Account requirement | Illinois Public ID Account (https://accounts.illinois.gov) |
| Frequency | Monthly — no later than the 15th of the calendar month following the month work was performed |
| Batch upload | Excel/XLS template upload available (updated July 1, 2025) |
| Correction window | Submissions can be withdrawn/corrected until the 15th of the following month |
| Record retention | 5 years (per instructions; 3 years also cited in some sources — use 5 to be safe) |
| Trigger | Contract terms "subject to the Illinois Prevailing Wage Act and other applicable laws" |
| Contact | dol.certifiedpayroll@illinois.gov / 312-793-3600 |
| Penalty — first violation | Up to 20% of unpaid wages owed to IDOL |
| Penalty — repeat violation | Up to 50% of unpaid wages |
| Debarment | 4 years for two violations within 5 years |
| Falsification | Criminal offense; debarment from all public works up to 4 years |

---

## 10. IL DOL — Compliance Rules Unique to IL {#il-compliance-rules}

### Overtime

- **Threshold:** Overtime is triggered by hours exceeding 40 in a workweek (standard Illinois rule)
- The IL Prevailing Wage Act requires prevailing wage rates for holiday and overtime work
- Unlike NY, there is no explicit daily 8-hour overtime trigger in the statute (it follows the workweek model)
- However, each county's prevailing wage schedule specifies the applicable overtime rates per craft

### Non-Prevailing Wage Hours — IL-Unique Requirement

**This is the single most important IL-vs-federal difference:**
Contractors must report **all hours worked** by each employee — both prevailing wage hours (work on the public works project) **and** non-prevailing wage hours (work on other projects during the same pay period).

This is used to calculate the annualized fringe benefit credit. The form has a "PW" and "N" column for each hour entry.

### Fringe Benefits

- Four categories tracked on form: Pension, Health/Welfare, Vacation, Training
- Fund details (name, address, sponsor, administrator) required for non-LMRA funds
- Credit for fringe benefits **cannot exceed** the sum of hourly rates for all fringe benefits in the wage schedule
- Excess fringe credit cannot offset required wage payments
- Training credit: only for contributions to DOL Bureau of Apprenticeship and Training-approved programs
- Fringe rates that are not paid on a per-hour-worked basis must be annualized: total contributions ÷ total hours worked (PW + non-PW) over prior 12 months

### Apprenticeships

- Apprentices must be in U.S. DOL Bureau of Apprenticeship and Training-approved programs
- Unregistered apprentice = must receive full journeyworker prevailing rate

### Wage Rate Updates

- County-specific rates; each county sets rates separately
- Rates can update monthly (more frequent than NY's annual July 1 update)
- Effective date for current rates: rates effective as of March 2, 2026 for current cycle
- Rates posted at job site or, if not possible, at place of business; or written notice to each worker

### Record Retention

- 5 years for original payroll/time records (per instructions; some statutory sources say 3 years — store 5 to be safe)
- Original time cards showing start and end time each day must be kept

---

## 11. Fillable PDF Availability {#fillable-pdf-availability}

| Form | Available as Fillable PDF? | pdf-lib Usable as Template? | Notes |
|------|---------------------------|----------------------------|-------|
| NY PW-12 | Yes — available from dol.ny.gov | YES — standard form, scrapable fields | Form created 2009; Adobe-based |
| NY PW-18.1 | Yes — available from dol.ny.gov | YES — simple 1-page certification | Form created 2007; simple layout |
| NYC Comptroller CPR | Yes — fillable PDF at comptroller.nyc.gov | YES but complex | Has digital signature fields; 2019 version |
| IL Certified Transcript of Payroll | Yes — PDF at labor.illinois.gov | YES — Adobe LiveCycle 9.0 base | IL452CM01/02; two-page form |
| IL Affidavit (page 2) | Yes — separate PDF at labor.illinois.gov | YES | Simple affidavit layout |

**Recommendation for pdf-lib implementation:**

For NY, the paper PW-12 PDF can be replicated from scratch using pdf-lib (as done with WH-347). The MPWR XML file is the actual submission mechanism — the PDF is for contractor records and agency requirements that don't use the portal.

For IL, the portal requires online entry or Excel upload — there is no XML standard. The PDF form is for contractor records and for agencies that require a paper copy. Recreate it with pdf-lib.

**Important:** Neither state's official PDF form is an official government-locked template that must be used as the exact file — both states accept the data in the required fields regardless of whether the paper matches their template exactly, as long as content is correct. The official forms are guides for field layout.

---

## 12. Delta vs WH-347: Fields Required Beyond Federal {#delta-vs-wh347}

### NY-Specific Fields NOT on Federal WH-347

| Field | Form | Notes |
|-------|------|-------|
| PRC Number (Prevailing Rate Case) | PW-12, PW-18.1, MPWR XML | Project-level identifier; must obtain from NYSDOL |
| NYS Contractor Registration Number | MPWR | From Certificate of Contractor Registration |
| Notarization (PW-18.1 only) | PW-18.1 | Must be sworn before notary or authorized official |
| Payment bond (portal setup) | MPWR | For public improvement projects |
| `nysRegisteredApprentice` flag | MPWR XML | Boolean per employee per work week |
| `dateOfBirth` (alternate to SSN) | MPWR XML | Alternative identifier if SSN not available |
| Supplement types (enumerated) | MPWR XML | Health/Welfare, Vacation/Holiday, Apprenticeship/Training, Pension, Other |
| Supplement rates — both ST and OT | MPWR XML | Separate `standardHourlyRate` and `overtimeHourlyRate` per supplement type |
| `workCategory` (dropdown-matched) | MPWR XML | Must match NYSDOL classification dropdown — not free text |
| Per-day hours (7 daily columns) | PW-12 | WH-347 also has daily columns but NY form is more explicit |

### IL-Specific Fields NOT on Federal WH-347

| Field | Form | Notes |
|-------|------|-------|
| Non-Prevailing Wage (N) hours | IL CTP | All non-PW hours must be reported alongside PW hours |
| PW / N column per day | IL CTP | Each day has two hour entries: prevailing and non-prevailing |
| OT Wage Rate (separate column) | IL CTP | Explicit OT rate column; WH-347 handles this differently |
| Fringe Benefit — Pension (per hour) | IL CTP | Separate column for each fringe category |
| Fringe Benefit — Health/Welfare (per hour) | IL CTP | |
| Fringe Benefit — Vacation (per hour) | IL CTP | |
| Fringe Benefit — Training (per hour) | IL CTP | |
| "F" flag on fringe rates | IL CTP | Marks jointly-managed LMRA funds |
| Fund name/address/sponsor/admin | IL Affidavit | For non-LMRA funds, 4 fund types each require 4 sub-fields |
| Subcontractor list (page 2) | IL Affidavit | Up to 4 subs with contact info |
| Race | IL portal | Not on paper form but required in portal |
| Ethnicity | IL portal | Not on paper form but required in portal |
| Gender | IL portal | Not on paper form but required in portal |
| Veteran status | IL portal | Not on paper form but required in portal |
| Skill level (journey/apprentice) | IL portal | Portal-only field |
| IDOL Case File Number | IL CTP | Assigned by IDOL |
| Agency | IL CTP | Public body's agency name |
| State Capital Fund flag | IL CTP | Checkbox for Rebuild Illinois projects |
| No Work Report flag | IL CTP | Monthly submission required even with no work |
| Public Body contact details | IL CTP | Full contact info for the contracting public body |
| Contractor telephone/email fields | IL CTP | Both primary and secondary phone/email |
| Project County | IL CTP | For county-specific wage rate lookup |
| Project Zip Code | IL CTP | |

---

## 13. Implementation Guidance for pdf-lib {#implementation-guidance}

### NY Implementation

**Approach A — Generate PW-12 PDF (for records/agencies not using MPWR):**
Recreate PW-12 layout with pdf-lib. Relatively simple tabular layout similar to WH-347. Key differences from WH-347:
- Remove "WH-347" branding; add NYSDOL Bureau of Public Work header
- PRC # field in header
- Column (3) is a single combined column for classification + ST/OT indicator
- No dedicated supplements column in the row data (WH-347 has column 6 for rate + supplements)
- Statement of compliance has NY-specific text (Articles 8 and 9 reference)
- Fringe benefit clauses (b) and (c) differ from WH-347

**Approach B — Generate MPWR XML file:**
This is the actual mandatory submission mechanism. Map app data to the XML schema above. Key decisions:
- `workCategory` must be looked up or matched against NYSDOL classification names
- Employee identifier is either last-4 SSN or DOB — design UI to capture DOB as alternative
- Supplement types are an enum: `["Health/Welfare", "Vacation/Holiday", "Apprenticeship/Training", "Pension", "Other Benefit (Type)"]`
- One XML file per project per week, max 500 employees per file

**Recommended:** Generate both. The PW-12 PDF for offline agency submissions; the XML for MPWR portal.

### IL Implementation

**Approach — Generate IL CTP PDF:**
Recreate the two-page IDOL CTP form with pdf-lib. Key layout notes:
- Header: two-column layout (contractor info left, public body info right)
- Employee rows: wide table with 14+ columns across landscape orientation
- Fringe benefit sub-rows per employee: 4 categories (Pension, H&W, Vacation, Training)
- Affidavit page: text-heavy, single-column, with fund details table and subcontractor list
- No-work report: handled by checkbox in header

**IL Portal Upload:**
IL accepts an Excel/XLS template import (updated July 1, 2025). The app could generate a compliant XLS file for bulk upload, but this is lower priority than PDF generation. Portal URL: https://webapps.illinois.gov/DOL/PayrollCertification/

**IL demographic fields:**
The portal captures race, ethnicity, gender, and veteran status that are not on the paper form. If targeting portal compliance (not just PDF), these must be captured in the app's worker profile. Currently the app stores `ssnLast4` (being migrated to full SSN in Phase 31) — add a worker demographics table or fields for IL-portal use cases.

---

## 14. Gaps / Unknowns {#gaps-unknowns}

### HIGH PRIORITY gaps

| Gap | Impact | How to Resolve |
|-----|--------|---------------|
| **NYSDOL workCategory dropdown values** | XML upload fails if classification name doesn't exactly match portal dropdown | Download from MPWR portal after creating an account, or request list from NYSDOL at (518) 457-5589 |
| **MPWR XSD file (current)** | Need exact schema for code generation | Download from https://dol.ny.gov/nydolcertpayrollxsd |
| **NY PRC # data source** | PRC # is required for every NY project; app needs a field to store it | Add `nyprcNumber` column to `projects` table |
| **IL portal Excel template column order** | If building XLS export, columns must match template exactly | Download from IL portal after login |

### MEDIUM PRIORITY gaps

| Gap | Impact | How to Resolve |
|-----|--------|---------------|
| **IL record retention — 3 vs 5 years** | Instructions say 5 years; statute may say 3 years; other sources say 3 | Check 820 ILCS 130/5 directly at https://www.ilga.gov |
| **IL apprentice ratio rules** | App needs to validate apprentice-to-journeyworker ratios per trade | Check 820 ILCS 130 and consult IDOL |
| **NY apprentice ratio by trade** | Ratios vary by trade and are in the wage schedule | Pull from specific county wage schedules; not static data |
| **NYC Comptroller form vs state MPWR** | NYC projects have separate submission requirements; do we need NYC form? | Confirm scope — if app targets NYC public work, NYC Comptroller form required |
| **NY 4-day/10-hour alternative workweek** | Some projects get Bureau dispensation; app needs to handle non-standard schedules | Add `workScheduleType` to project settings |
| **IL demographic data — employee consent** | Workers may decline to provide race/ethnicity data | App UI must capture refusal/unknown, not force a selection |

### LOW PRIORITY gaps

| Gap | Impact | How to Resolve |
|-----|--------|---------------|
| **IL monthly vs weekly reporting** | IL is monthly but app currently models weekly payrolls | IL portal accepts monthly batch; confirm whether app aggregates weeks for IL or submits weekly |
| **IL "Rebuild Illinois / State Capital Fund" checkbox** | Needed for specific project types | Add project-level checkbox in IL project settings |
| **NY payment bond upload** | MPWR portal requires bond upload at project setup; app cannot do this | Out of scope for Phase — document as manual step |
| **IL fringe annualization calculation** | Complex annualization math needed for non-per-hour contributions | Define calculation function in Phase implementation |

---

## 15. Sources {#sources}

All sources verified as of 2026-04-01.

### Official Government Sources (HIGH confidence)

- [NY DOL — Electronic Payroll Submission page](https://dol.ny.gov/Electronic-Payroll) — MPWR portal overview, requirements, links to guides
- [NY DOL — MPWR Bulk Upload Formatting Guide PDF](https://dol.ny.gov/system/files/documents/2026/01/certified-payroll-bulk-upload-formatting-guide_1.pdf) — Full XML schema, element table, validation rules (January 2026)
- [NY DOL — Contractor User Guide PDF](https://dol.ny.gov/system/files/documents/2026/01/certified-payroll-contractor-user-guide_2.pdf) — Portal workflow, submission process (January 2026)
- [NY DOL — Public Work and Prevailing Wage Enforcement Forms](https://dol.ny.gov/public-work-and-prevailing-wage-enforcement-forms) — All official NY forms list
- [NY DOL — Electronic Certified Payroll FAQ](https://dol.ny.gov/electronic-payroll-faq) — Submission FAQ
- [NY DOL — Article 8 FAQ](https://dol.ny.gov/article-8-frequently-asked-questions) — Overtime, supplements, apprenticeship rules
- [PW-18.1 form text](https://www.york.cuny.edu/administrative/financial-planning-and-budget/purchasing/forms/pw18-1/@@download/file/PW18-1-ua.pdf) — Extracted via pdftotext; includes full certification text and General Provisions
- [PW-12 form text](https://online.ogs.ny.gov/purchase/spg/pdfdocs/2060023200DOLPayrollForm.pdf) — Extracted via pdftotext; full column layout
- [NYC Comptroller Certified Payroll Report](https://comptroller.nyc.gov/wp-content/uploads/documents/Certified_Payroll_Report_formfillable_2019.pdf) — Extracted via pdftotext; full column layout (2019 version)
- [IL DOL — Certified Transcript of Payroll main page](https://labor.illinois.gov/laws-rules/conmed/certifiedtranscriptofpayroll.html) — Portal access, Excel template info
- [IL DOL — Certified Transcript of Payroll PDF](https://labor.illinois.gov/content/dam/soi/en/web/idol/forms/documents/certified-transcript-of-payroll.pdf) — Extracted via pdftotext; full page 1 field layout (form IL452CM02)
- [IL DOL — CTP Affidavit PDF](https://labor.illinois.gov/content/dam/soi/en/web/idol/forms/documents/certified-transcript-of-payroll-affidavit.pdf) — Extracted via pdftotext; full affidavit text and fringe fund fields (form IL452CM01)
- [IL DOL — CTP Instructions PDF](https://labor.illinois.gov/content/dam/soi/en/web/idol/laws-rules/conmed/documents/certaff.pdf) — Extracted via pdftotext; full filing instructions including annualization rules and deadlines
- [IL DOL — Certified Transcript of Payroll FAQ](https://labor.illinois.gov/faqs/certifiedpayrollfaq.html) — Demographic fields, correction window, fringe rules
- [IL Prevailing Wage Act — 820 ILCS 130](https://labor.illinois.gov/laws-rules/conmed/prevailing-wage-act.html) — Statutory reference

### NY DOL Announcement

- [NY DOL — Electronic Certified Payroll Announcement](https://dol.ny.gov/news/new-york-state-department-labor-announces-new-electronic-certified-payroll-submission) — Official notice of Jan 1, 2026 mandate

### Secondary Sources (MEDIUM confidence — corroborated by official sources)

- [Grassi Advisors — NY Electronic Certified Payroll Requirements 2026](https://www.grassiadvisors.com/blog/new-york-electronic-certified-payroll-requirements-what-contractors-need-to-know-for-2026/)
- [Couch White — NYSDOL Electronic Certified Payroll System](https://www.couchwhite.com/important-information-on-the-nysdol-electronic-certified-payroll-system/)
- [Points North — Prevailing Wages and Certified Payroll for New York](https://www.points-north.com/state-by-state-certified-payroll-reporting/new-york)
- [Points North — Prevailing Wages and Certified Payroll for Illinois](https://www.points-north.com/state-by-state-certified-payroll-reporting/illinois)
- [Premier Payroll NY — New York Prevailing Wage Certified Payroll 2025](https://premierpayrollny.com/blog/new-york-prevailing-wage-certified-payroll-2025/)
- [IL DOL CTP Slides via slidetodoc](https://slidetodoc.com/certified-transcript-of-payroll-illinois-department-of-labor/) — Portal field walkthrough
