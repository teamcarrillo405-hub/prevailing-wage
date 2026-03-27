# Stack Research — v2.5 Additions Only

**Project:** HCC Prevailing Wage
**Milestone:** v2.5 — State Portal Integration (CA eCPR XML export + WA PWIA submission assist)
**Researched:** 2026-03-26
**Confidence:** HIGH (CA schema — fetched live XSD and sample XML from dir.ca.gov; WA schema — fetched live XSD from lni.wa.gov; xmlbuilder2 version — confirmed from GitHub changelog; Node.js compatibility — verified against package.json engines field)

> This file covers NEW stack requirements for v2.5 only. The existing stack (Node.js + Express + TypeScript, React 18 + Vite + TailwindCSS v4, SQLite + Drizzle ORM, pdf-lib, JWT httpOnly cookie auth, csv-stringify, Render.com deployment) is documented in prior STACK.md files and is NOT re-researched here.

---

## Executive Summary

| Feature | Verdict |
|---------|---------|
| CA eCPR XML export | Add `xmlbuilder2@4.0.3` — generates namespace-prefixed `CPR:eCPR` XML per schema v1.3 confirmed at dir.ca.gov/Public-Works/CPR/CPR.xsd |
| WA L&I XML CPR upload | Same `xmlbuilder2@4.0.3` — generates `WaPWCPR` XML per schema confirmed at lni.wa.gov/licensing-permits/_docs/xmlschema.xsd |
| WA PWIA submission assist | No file format — PWIA (intents and affidavits) is web form entry only; app provides pre-populated data summary for manual entry |
| XSD runtime validation | Skip — both schemas are known at build time; use xmllint CLI during dev; rely on portal error messages for production |

**One new library. One install command.**

---

## CA DIR eCPR — Submission Context

**Finding (HIGH confidence):** CA DIR eCPR electronic submission is mandatory for most public works projects under SB 854. Contractors either:
1. Enter payroll data manually in the eCPR portal at `https://efiling.dir.ca.gov/eCPR/`
2. Upload a compliant XML file per CPR XML Schema v1.3

The XML upload is a **manual file upload through the web portal**, not an API. The app generates the XML file; the contractor downloads it and uploads it to the portal themselves.

**Schema status:** The v1.3 schema has been stable since 2016. No XML format changes were required when DIR launched its new Public Works website in June 2024 or the April 2025 platform enhancement. The current authoritative XSD is at `https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd`.

**File naming convention (from DIR guidelines):** `[last4FEIN]_[projectID]_[weekEndingDate].xml`

---

## CA DIR eCPR XML Schema v1.3 — Complete Field Reference

**Sources:** `https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd` (live fetch), `https://www.dir.ca.gov/Public-Works/CPR/CPRSample.xml` (live fetch)
**Namespace prefix in output:** `CPR:`
**Root element:** `CPR:eCPR`

### CPR:contractorInfo (Required)

| Element | Required | Type / Constraint |
|---------|----------|------------------|
| contractorName | Yes | string, max 56 chars |
| contractorLicense/licenseType | Yes | enum: CSLB \| PL \| OTHER |
| contractorLicense/licenseNum | Yes | string, max 56 chars |
| contractorPWCR | Yes | string: 10 digits or literal "NA" |
| contractorFEIN | Yes | string: exactly 9 digits |
| contractorAddress/street | Yes | string, max 40 chars |
| contractorAddress/city | Yes | string, max 25 chars |
| contractorAddress/state | Yes | string: 2 uppercase letters |
| contractorAddress/zip | Yes | string: exactly 5 digits |
| insuranceNum | Yes | string, max 40 chars (workers comp policy number) |
| contractorEmail | Yes | email format, max 60 chars |

### CPR:projectInfo (Required)

| Element | Required | Type / Constraint |
|---------|----------|------------------|
| awardingBody | Yes | string (fixed/empty in schema — DIR populates from projectID) |
| contractAgencyID | Yes | string (fixed/empty in schema — DIR populates) |
| contractAgency | Yes | string, max 56 chars (awarding agency name) |
| projectName | Yes | string (fixed/empty — DIR populates) |
| projectID | Yes | string: 1-18 digits (DIR-assigned project registration number) |
| awardingBodyID | No | string, max 9 chars |
| projectNum | No | string, max 50 chars |
| contractID | No | string, max 25 chars |
| projectLocation/* | Yes | fixed/empty per XSD — DIR populates all sub-fields |

### CPR:payrollInfo (Required)

| Element | Required | Type / Constraint |
|---------|----------|------------------|
| statementOfNP | Yes | string: "true" \| "false" (no-payroll week flag) |
| payrollNum | Yes | string (fixed — DIR auto-increments; submit empty) |
| amendmentNum | Yes | string (fixed — DIR auto-increments; submit empty) |
| forWeekEnding | Yes | date: yyyy-mm-dd |
| employees/employee | Yes | 0-500 occurrences, nillable |

### CPR:employee — Per Worker (Required when statementOfNP = false)

| Element | Required | Type / Constraint |
|---------|----------|------------------|
| name (attr: id="SSN::NAME") | Yes | string; id attribute format: "123456789::John Smith" |
| address/street | Yes | string, max 40 chars |
| address/city | Yes | string, max 25 chars |
| address/state | Yes | 2 uppercase letters |
| address/zip | Yes | 5 digits |
| ssn | Yes | string: exactly 9 digits (full SSN — not last-4) |
| numWithholdingExemp | Yes | string: 1-2 digits |
| workClass | Yes | string, max 300 chars (trade classification) |
| payroll/hrsWorkedEachDay/day[id=1-7] | Yes | 7 day elements required; each has: date (yyyy-mm-dd), straightTime, overtime, doubletime (decimal, max < 100, 2 decimals) |
| payroll/totHrs/totHrsStraightTime | Yes | decimal, max < 1000, 2 decimals |
| payroll/totHrs/totHrsOvertime | Yes | decimal |
| payroll/totHrs/totHrsDoubletime | Yes | decimal |
| payroll/hrlyPayRate/hrlyPayRateStraightTime | Yes | decimal, max < 10000, 2 decimals |
| payroll/hrlyPayRate/hrlyPayRateOvertime | Yes | decimal |
| payroll/hrlyPayRate/hrlyPayRateDoubletime | Yes | decimal |
| payroll/grossAmountEarned/thisProject | Yes | decimal, max < 100M, 2 decimals |
| payroll/grossAmountEarned/allWork | Yes | decimal, max < 100M, 2 decimals (gross across ALL jobs this week) |
| payroll/deductionsContribPay/fedTax | Yes | decimal |
| payroll/deductionsContribPay/FICA | Yes | decimal |
| payroll/deductionsContribPay/stateTax | Yes | decimal |
| payroll/deductionsContribPay/SDI | Yes | decimal |
| payroll/deductionsContribPay/vacationHoliday | Yes | decimal |
| payroll/deductionsContribPay/healthWelfare | Yes | decimal |
| payroll/deductionsContribPay/pension | Yes | decimal |
| payroll/deductionsContribPay/training | Yes | decimal |
| payroll/deductionsContribPay/fundAdmin | Yes | decimal |
| payroll/deductionsContribPay/dues | Yes | decimal |
| payroll/deductionsContribPay/travelSubs | Yes | decimal |
| payroll/deductionsContribPay/savings | Yes | decimal |
| payroll/deductionsContribPay/other | Yes | decimal |
| payroll/deductionsContribPay/total | Yes | decimal (sum of all above) |
| payroll/deductionsContribPay/notes | No | string, max 256 chars |
| payroll/netWagePaidWeek | Yes | decimal, max < 100M, 2 decimals |
| payroll/checkNum | Yes | string, max 20 chars |

---

## WA L&I Certified Payroll — Submission Context

**Finding (HIGH confidence):** WA L&I requires weekly certified payroll reports for all public works projects (mandatory since January 1, 2020). Contractors file through My L&I / SecureAccess Washington. The portal accepts XML file upload — this is NOT form-only entry. Contractors upload the XML file and L&I validates it and creates the certified payroll records.

**PWIA vs CPR — distinct filings:**
- **PWIA (Statement of Intent + Affidavit of Wages Paid):** Filed once per contractor per project; web form entry only through the PWIA portal at `secure.lni.wa.gov`. No file upload format for PWIA. After the Intent is approved, an `intentId` is issued.
- **Certified Payroll Report (CPR):** Filed weekly; XML upload supported. The `intentId` from the PWIA approval is a required field in every CPR XML file.

**Implication for "WA submission assist":** The PWIA component (intent/affidavit) cannot be pre-populated via file upload — it must be entered manually in the portal. The app's role is to display a pre-filled data summary so contractors can copy values into the portal form. The CPR component CAN be XML-exported for direct portal upload.

**Schema source:** `https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd` (live fetch 2026-03-26)

---

## WA L&I XML CPR Schema — Complete Field Reference

**Root element:** `WaPWCPR`
**No namespace prefix** (unlike CA's `CPR:` prefix)

### WaPWCPR top level

| Element | Required | Type / Constraint |
|---------|----------|------------------|
| projectIntent/intentId | Yes | xs:unsignedInt — issued by PWIA portal after intent approval |
| payroll/payrollWeek (unbounded) | Yes | one per week |

### payrollWeek

| Element | Required | Type / Constraint |
|---------|----------|------------------|
| endOfWeekDate | Yes | xs:date: yyyy-mm-dd |
| noWorkPerformFlag | No | xs:boolean |
| amendedFlag | No | xs:boolean, default false |
| amendedDate | No | date or empty string |
| amendReason | No | string, max 1000 chars |
| employees/employee (unbounded) | Conditional | Required when noWorkPerformFlag = false |

### employee (per worker)

| Element | Required | Type / Constraint |
|---------|----------|------------------|
| firstName | Yes | string, 1-50 chars |
| midName | No | string, max 50 chars |
| lastName | Yes | string, 1-50 chars |
| ssn | Yes | string: exactly 9 digits |
| ethnicity | No | enum: 8 values + empty |
| gender | No | enum: F \| M \| ? \| empty |
| veteranStatus | No | enum: Y \| N \| ? \| empty |
| address1 | Yes | string, 1-500 chars |
| address2 | No | string, max 500 chars |
| city | Yes | string, 1-100 chars |
| state | Yes | string: exactly 2 chars |
| zip | Yes | string: 5-10 chars |
| grossPay | Yes | decimal >= 0, 2 decimals |
| fica | No | decimal >= 0, 2 decimals |
| taxWitholding | No | decimal >= 0, 2 decimals (note: schema spells it "Witholding" with one 'h') |
| otherDeductions/otherDeduction/deductionName | Conditional | string 1-50 chars, required if deductionHourlyAmt present |
| otherDeductions/otherDeduction/deductionHourlyAmt | Conditional | decimal > 0, 2 decimals |
| tradeHoursWages/tradeHoursWage (unbounded) | Yes | required — at least one |

### tradeHoursWage (per trade classification)

| Element | Required | Type / Constraint |
|---------|----------|------------------|
| trade | Yes | enum: 4-letter code (ASBA, BOIL, BRIC, CARP, ELEC, IRON, LABO, PAIN, PLUM, TEAM, etc.) — case-insensitive in schema |
| jobClass | Conditional | string max 500 chars — required when apprenticeFlg = false |
| tradeNotes | No | string, max 100 chars |
| county | Yes | enum: one of 39 WA county values (e.g., "King", "Pierce", "Snohomish", "Grays Harbor") |
| regularHourRateAmt | Yes | decimal > 0, 2 decimals |
| overtimeHourRateAmt | No | decimal > 0 if included |
| doubletimeHourRateAmt | No | decimal > 0 if included |
| hourlyPensionRateAmt | Yes | decimal >= 0, 2 decimals (default 0) |
| hourlyMedicalAmt | Yes | decimal >= 0, 2 decimals (default 0) |
| hourlyVacationAmt | Yes | decimal >= 0, 2 decimals (default 0) |
| hourlyHolidayAmt | Yes | decimal >= 0, 2 decimals (default 0) |
| apprenticeBenefitAmt | Yes | decimal >= 0, 2 decimals (default 0) |
| apprenticeFlg | Yes | xs:boolean |
| apprenticeId | Conditional | string max 50 chars — required if apprenticeFlg = true |
| apprenticeState | Conditional | 2-char string (WA \| OR \| MT \| AK) — required if apprentice |
| apprenticeOccpnName | Conditional | string max 255 chars — required if apprentice |
| apprenticeStepName | Conditional | string max 50 chars — required if apprentice |
| apprenticeStepBeginHours | Conditional | integer >= 0 — required if apprentice |
| apprenticeStepEndHours | Conditional | integer >= 0 — required if apprentice |
| regularDay[1-7]Hours | No | decimal 0-24, 2 decimals |
| overtimeDay[1-7]Hours | No | decimal 0-24, 2 decimals |
| doubletimeDay[1-7]Hours | No | decimal 0-24, 2 decimals |

**Obsolete elements (do NOT include):** `WageId`, `apprenticePgmOccpnId`, `apprenticePgmName`, `apprenticePgmOccpnStepCalcId` — schema marks these deprecated.

---

## Data Gaps vs. Existing Data Model

Both CA and WA XML require data the current app does not store. These gaps drive schema migrations.

| Required Field | CA | WA | Currently Stored | Gap |
|---------------|----|----|-----------------|-----|
| Full 9-digit SSN | Yes | Yes | `ssnLast4` only | Must add `ssn` (encrypted) to `workers` table |
| Contractor FEIN (9 digits) | Yes | — | In A-1-131 modal fields (verify DB column) | Verify `projects.contractorFein` exists |
| Contractor workers comp policy | Yes | — | In A-1-131 modal fields (verify DB column) | Verify `projects.wcPolicyNum` exists |
| Contractor email | Yes | — | Not in current schema | Add to `projects` or `users` |
| Contractor PWCR number | Yes | — | In A-1-131 modal as `pwcrNumber` | Verify DB column exists |
| Contractor address | Yes | — | Not in current schema | Add contractor address fields to `projects` |
| Withholding exemptions count | Yes | — | Not stored | Add to `workers` or capture per-export |
| Check number per payroll week | Yes | — | Not stored | Add to `payroll_weeks` |
| Gross wages — all jobs (allWork) | Yes | — | Not stored (project-specific only) | Manual input in export flow or additional field |
| Deduction line items (13 fields: fedTax, FICA, SDI, etc.) | Yes | — | Not stored | New `payroll_deductions` table or JSONB column |
| DIR project registration number (projectID) | Yes | — | Not stored | Add to `projects.dirProjectId` |
| Contract agency name | Yes | — | Not stored | Add to `projects.contractAgency` |
| intentId (PWIA intent number) | — | Yes | Not stored | Add to `projects.waIntentId` |
| WA trade 4-letter code | — | Yes | WA trade codes captured in Phase 25 | Verify `waTradeCode` column in workers/classifications |

---

## Recommended Stack Addition

### Core New Library

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| xmlbuilder2 | 4.0.3 | XML document generation (server-side only) for both CA eCPR and WA L&I CPR exports | Fluent chainable API with full namespace support (required for CA's `CPR:` prefix); fully DOM-conformant per XML spec; TypeScript types bundled (no `@types/` package needed); actively maintained (v4.0.3 released November 2025); Node.js >= 20 required — project already mandates >= 20 in package.json engines |

### Nothing Else

No additional libraries are needed. Both XML exports are server-side string generation from data already in SQLite. There is no client-side XML work, no new UI framework, no new auth change.

---

## Installation

```bash
# One new production dependency
npm install xmlbuilder2@4.0.3
```

---

## Implementation Pattern

```typescript
// CA eCPR XML generation — server-side route
import { create } from 'xmlbuilder2';

export function buildCaEcprXml(data: EcprExportData): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('CPR:eCPR', {
      'xmlns:CPR': 'http://www.dir.ca.gov/PWCR/CPR',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    })
      .ele('CPR:contractorInfo')
        .ele('CPR:contractorName').txt(data.contractorName).up()
        // ... all required fields
      .up()
      .ele('CPR:projectInfo')
        // ...
      .up()
      .ele('CPR:payrollInfo')
        // ...
      .up()
    .up();

  return doc.end({ prettyPrint: true });
}
```

```typescript
// WA CPR XML generation — server-side route
export function buildWaCprXml(data: WaCprExportData): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('WaPWCPR')
      .ele('projectIntent')
        .ele('intentId').txt(String(data.intentId)).up()
      .up()
      .ele('payroll')
        // payrollWeek elements...
      .up()
    .up();

  return doc.end({ prettyPrint: true });
}
```

**Express route pattern (both exports):**
```typescript
// Returns XML as downloadable file
router.get('/api/projects/:projectId/payroll-weeks/:weekId/ecpr-xml',
  requireAuth,
  async (req, res) => {
    const xml = await buildCaEcprXml(/* assembled data */);
    const filename = `${last4Fein}_${dirProjectId}_${weekEnding}.xml`;
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
  }
);
```

---

## Development Tooling (No npm install)

| Tool | Purpose | Notes |
|------|---------|-------|
| xmllint (system CLI) | Validate generated XML against CPR.xsd and xmlschema.xsd during development | `xmllint --schema CPR.xsd output.xml --noout`; NOT an npm dep; `brew install libxml2` (mac) or `choco install libxml2` (windows) |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| xmlbuilder2@4.0.3 | fast-xml-parser (XMLBuilder) | If fast-xml-parser were already installed as a project dependency. Its XMLBuilder builds XML from plain JS objects and is fine for flat schemas. However CA eCPR uses `CPR:` namespace prefix on every element, and fast-xml-parser's namespace handling in builder mode is awkward. xmlbuilder2 handles this cleanly. |
| xmlbuilder2@4.0.3 | xmlbuilder (legacy, no "2") | Never — `xmlbuilder` (the v1 package by the same author) is unmaintained since 2021 and lacks DOM conformance. Always use `xmlbuilder2`. |
| xmlbuilder2@4.0.3 | Template string XML | Acceptable for 3-5 field documents. For CA eCPR (40+ required fields, 7-day arrays, 13 deduction fields, namespace prefixes on every element) and WA CPR (conditional apprentice fields, unbounded trade elements), template strings create silent bugs (whitespace, encoding, angle brackets in data) and are hard to audit against schema. Worth the dependency. |
| Server-side XML generation | Client-side XML generation | Do not generate XML in the browser. The user needs a downloadable file, not in-browser XML. Server generation avoids shipping full 9-digit SSNs to the React client. |
| XML file download + manual portal upload | Direct API submission to CA DIR or WA L&I | Neither CA DIR eCPR nor WA L&I provides a documented machine-to-machine API for contractor CPR submission. Both are manual web portal uploads. Direct API integration is not feasible. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| xsd-schema-validator / libxmljs2-xsd / libxml-xsd | Requires node-gyp native compilation; adds CI/build friction (Windows especially) for a dev-only validation step. Portal error messages serve the same purpose in production. | xmllint CLI during development |
| Any email library (nodemailer etc.) | Not in scope — the export is a file download, not an email attachment | Nothing |
| Any new UI library or XML preview component | No requirement for in-browser XML preview; file download is sufficient | Existing React + TailwindCSS |
| puppeteer / headless browser | No PDF work involved in this milestone | pdf-lib (already installed, not needed for XML) |
| xml2js | Parse-oriented; awkward for generation; older design | xmlbuilder2 |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| xmlbuilder2@4.0.3 | Node.js >= 20.0.0 | Project `package.json` already specifies `"engines": {"node": ">=20.0.0"}` — confirmed compatible |
| xmlbuilder2@4.0.3 | TypeScript 5.x | Types bundled in package — no `@types/xmlbuilder2` needed |
| xmlbuilder2@4.0.3 | Express 4.x | No framework coupling — pure string output from server route |

---

## Sources

- `https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd` — CA DIR eCPR XML Schema v1.3 (live fetch 2026-03-26) — HIGH confidence
- `https://www.dir.ca.gov/Public-Works/CPR/CPRSample.xml` — CA DIR eCPR sample XML showing `CPR:` namespace (live fetch 2026-03-26) — HIGH confidence
- `https://www.dir.ca.gov/public-works/certified-payroll-reporting.html` — confirms v1.3 is current schema, links to XSD and sample (2026-03-26) — HIGH confidence
- `https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd` — WA L&I CPR XML Schema (live fetch 2026-03-26) — HIGH confidence
- `https://lni.wa.gov/licensing-permits/_docs/xml%20payroll%20guide.pdf` — WA XML Payroll Upload Guide (PDF exists, binary-only render) — MEDIUM confidence (existence confirmed; content not extracted)
- `https://github.com/oozcitak/xmlbuilder2/blob/master/CHANGELOG.md` — xmlbuilder2 v4.0.3 release date Nov 2025, Node >= 20 requirement confirmed — HIGH confidence
- `https://bayareabx.com/news/html/public-works-online-system-enhancement-update` — CA DIR April 2025 platform update with no XML format change — MEDIUM confidence
- `https://lni.wa.gov/licensing-permits/public-works-projects/contractors-employers/` — WA requires weekly CPR filing via My L&I (official) — HIGH confidence
- `https://sunburstsoftwaresolutions.com/washington-state-l-i-electronic-xml-upload-available.htm` — WA L&I XML upload confirmed as file-upload-to-portal (not API), effective Jan 2020 — MEDIUM confidence
- `https://www.points-north.com/state-by-state-certified-payroll-reporting/washington` — PWIA vs CPR distinction, PWIA is web form only, CPR accepts XML upload — MEDIUM confidence
- `package.json` (`engines.node >= 20.0.0`) — confirmed Node version compatibility — HIGH confidence

---

*Stack research for: HCC Prevailing Wage v2.5 — CA eCPR XML export + WA PWIA submission assist*
*Researched: 2026-03-26*
