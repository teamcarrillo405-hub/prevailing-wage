# Pitfalls Research

**Domain:** Prevailing wage compliance app (v2.5) — adding CA eCPR XML export and WA PWIA submission assist to existing system
**Researched:** 2026-03-26
**Confidence:** HIGH (CA eCPR XSD obtained directly from dir.ca.gov/Public-Works/CPR/CPR.xsd; WA PWIA XSD obtained directly from lni.wa.gov/licensing-permits/_docs/xmlschema.xsd; portal failure patterns from United Contractors, Sunburst Software, CA DIR official communications)

---

## Critical Pitfalls

### Pitfall 1: CA eCPR Requires Full 9-Digit SSN — Existing System Stores Only Last 4

**What goes wrong:**

The existing app stores `ssnLast4` (4 digits) for each worker, which is sufficient for the federal WH-347 and the CA A-1-131 PDF forms. The CA DIR eCPR XML schema (CPR.xsd v1.3) requires the full 9-digit SSN in the `<ssn>` element with pattern `[0-9]{9}`, and the same value must appear in the `name` element's `id` attribute formatted as `SSN::NAME`. There is no partial-SSN accommodation in the schema.

**Why it happens:**

The app was intentionally designed to avoid storing full SSNs for privacy and security reasons. The WH-347 and A-1-131 forms only require last 4 digits. When eCPR XML is added, it is tempting to generate the file with the same truncated data already in the database — either by zero-padding the last 4 to fake a 9-digit value or by leaving the field empty.

**How to avoid:**

Do not fake or pad SSNs. The correct resolution is one of two paths: (1) Add an optional `ssnFull` encrypted column to workers for CA-specific use, entered only by contractors who opt into eCPR export, or (2) Add an inline SSN entry step to the eCPR export flow that captures the full SSN at generation time without persisting it. Option 2 is simpler and avoids database schema changes and the security implications of storing full SSNs. The export flow UI should clearly explain why the full SSN is needed and that it is not stored.

**Warning signs:**

If the eCPR XML generator references `worker.ssnLast4` and pads or zero-fills it to 9 digits, this is the pitfall occurring. Any test XML that passes schema validation with a fake SSN like `000000XXXX` will fail portal upload because the DIR portal validates SSN format against federal ITIN/SSN rules (no `000`, no `666`, no all-zeros in positions 6-9).

**Phase to address:** CA eCPR XML generator phase — the SSN collection strategy must be decided before any generator code is written.

---

### Pitfall 2: DIR Project ID Is an External Identifier Not in the Existing Database

**What goes wrong:**

The CA DIR eCPR XML `<projectID>` field requires the numeric Project ID assigned by the CA DIR Public Works Online System (pattern: `[0-9]{1,18}`). This is completely separate from the `projectId` primary key in the local database. No existing data model field holds this value. If the XML generator uses the local `projectId` (a small integer like `42`) in the `<projectID>` element, the portal will reject the file immediately with no useful error — the uploaded file will be unassociated with any registered DIR project.

**Why it happens:**

Both identifiers are called "project ID." The local database has a `projectId` column. Developers building the XML generator see the schema requires a `projectID` and populate it from the field that sounds right.

**How to avoid:**

Add a `dirProjectId` nullable varchar column to the `projects` table via a Drizzle migration. Surface a labeled input field in the CA eCPR export modal or project settings labeled "CA DIR Project ID (from DIR portal)" with a link to the DIR Public Works search. The XML generator must gate generation on this field being present. If it is null, display a pre-generation warning that instructs the user to look up their DIR Project ID before continuing.

**Warning signs:**

Any XML generator code that references `project.id`, `project.projectId`, or any numeric primary key for the `<projectID>` element. The DIR Project ID for real projects is typically 14-18 digits long; any short integer signals the wrong field is being used.

**Phase to address:** CA eCPR XML generator phase — the DB migration for `dirProjectId` must be the first task in the phase.

---

### Pitfall 3: CA eCPR Requires Contractor PWCR Registration Number (10 Digits) — Not in Existing System

**What goes wrong:**

The `<contractorPWCR>` element in the eCPR schema requires either a 10-digit Public Works Contractor Registration number (pattern: `[0-9]{10}`) or the literal string `NA`. The app currently stores no PWCR number. New registrations in the DIR system now carry a `PW-LR-` prefix before the 10 digits (e.g., `PW-LR-1001032751`). If the full prefixed form is placed into the XML field, it fails the `[0-9]{10}` pattern validation. If the field is simply left as `NA`, the submission is technically valid but may trigger additional scrutiny from DIR auditors since a registered contractor should have this number.

**Why it happens:**

PWCR is a CA-specific identifier that has no analog in the federal WH-347 workflow. When building the XML generator, developers will not know this number is needed and it has no natural source in existing data.

**How to avoid:**

Add a `caContractorPWCR` nullable varchar(10) field to the user profile or account settings. Strip the `PW-LR-` prefix when storing, keeping only the 10-digit numeric portion. Surface the input in the CA eCPR export modal with a helper link to the DIR PWCR lookup. Document in the UI that `NA` is permitted if the contractor is exempt from registration (e.g., certain small contracts under Labor Code 1771.1 threshold), but this is rare and should not be the default.

**Warning signs:**

XML generation that populates `<contractorPWCR>` with anything other than exactly 10 digits or `NA`. Any code that passes the full `PW-LR-XXXXXXXXXX` string through without stripping the prefix.

**Phase to address:** CA eCPR XML generator phase — add to same settings modal that collects DIR Project ID.

---

### Pitfall 4: CA eCPR Fund Admin Is a Fringe Contribution, Not a Deduction — Schema Has No Dedicated Contribution Fields

**What goes wrong:**

The existing app's fringe benefit model (used for WH-347 and A-1-131) treats fund administration, pension, health/welfare, and vacation as employer contributions. The CA DIR eCPR XML schema v1.3 places all of these in the `<deductionsContribPay>` element alongside actual worker deductions (fedTax, FICA, stateTax, SDI). There is no structural distinction in the XML between employer contributions and worker deductions — all are sibling decimal elements.

The DIR portal processing code (as of June 2024 system update) now treats `<fundAdmin>` as a worker deduction, not an employer contribution, regardless of how it was classified in the submitter's intent. This causes fringe benefits to be understated in the DIR's report view and gross-to-net reconciliation to fail for auditors reviewing the submission.

Additionally, the schema has only one `<other>` element for the combined deductions section. The post-2024 portal now expects two "Other" categories — one for contributions and one for withholdings — but the schema has not been updated. Any amount placed in `<other>` will be ambiguously classified by the portal.

**Why it happens:**

The XSD does not signal the deduction/contribution distinction — all fields are `decimal` elements. Developers map fringe data to the numerically corresponding schema fields without knowing how the portal back-end interprets each field.

**How to avoid:**

When building the XML generator, use the `<notes>` field (up to 256 characters) to clarify fringe classification for items placed in `<other>`. For `<fundAdmin>`, `<vacationHoliday>`, `<healthWelfare>`, `<pension>`, and `<training>`: map from the app's `fringeRateSnapshot` multiplied by total hours. Document in code comments that these fields are dual-purpose and the portal may display them as deductions. Do not attempt to move these amounts to `<other>` to work around the schema — the portal will mishandle `<other>` even more badly. File is correct to the schema even though the portal display is a known DIR system bug.

**Warning signs:**

Any attempt to "fix" fringe display by routing contributions through `<other>` or by duplicating amounts across multiple schema fields to force the portal to show the correct total.

**Phase to address:** CA eCPR XML generator phase — document this as a known DIR portal limitation, not a code bug.

---

### Pitfall 5: WA PWIA XML Upload Requires an intentId That Must Be Filed Separately Before Any XML Can Be Submitted

**What goes wrong:**

The WA PWIA XML schema (`WaPWCPR`) has a required `<intentId>` element (xs:unsignedInt) at the top level. This is the Intent ID issued by WA L&I when the contractor files a Statement of Intent to Pay Prevailing Wages — a separate form that must be filed before work begins and before any certified payroll can be submitted. No existing field in the app stores this identifier. If a contractor tries to use the WA submission assist without having filed their Statement of Intent first, the XML will either be left blank (schema violation) or populated with a fabricated value (portal rejection).

**Why it happens:**

The Statement of Intent filing is a prerequisite step that happens outside the app entirely. Contractors who are new to WA public works may not have filed this yet when they first encounter the eCPR feature. The `intentId` is an unsigned integer that looks like it could be auto-generated, tempting developers to try to generate or guess it.

**How to avoid:**

The WA submission assist flow must begin with a clear prerequisite checklist that includes "Have you filed your Statement of Intent with WA L&I and received your Intent ID?" Add a `waIntentId` nullable varchar column to the projects table. Surface the input labeled "WA L&I Intent ID" with a link to secure.lni.wa.gov/wagelookup/ and a note that this number is issued only after filing the Statement of Intent. Gate XML generation on this field being present. This is the same pattern used for the CA DIR Project ID.

**Warning signs:**

Any WA XML generation that omits `<intentId>` or generates it from local data. Any UI that proceeds to XML generation without first verifying the user has an Intent ID entered.

**Phase to address:** WA submission assist phase — the prerequisite UX must be designed before any XML generator code is written.

---

### Pitfall 6: WA PWIA Requires 4-Letter Trade Codes That Do Not Match CA or Federal Trade Classifications

**What goes wrong:**

The WA PWIA XML `<trade>` element requires an exact 4-letter code from a fixed enumeration of 100+ values (ELEC, CARP, LABO, PAIN, PLUM, etc.). The existing app stores trade classifications as free-text `workClass` strings entered by the user when assigning workers to trades (e.g., "Electrician - Inside", "Carpenter", "Laborer - Group 1"). These strings will not match the WA enumeration.

CA eCPR XML uses a freetext `<workClass>` element (1-300 characters), so CA mapping is trivially solved. WA requires an exact code. If the mapping fails or defaults to a single code for all workers, the portal will either reject the XML or accept it with all workers assigned to a single incorrect trade — which creates an inaccurate affidavit and potential L&I audit.

**Why it happens:**

The WA trade code system is opaque. The enumeration is documented only in the XSD, not in any user-facing guide. Developers building the mapping logic often see the 100+ codes and attempt to create an automated string-matching algorithm, which works for obvious cases (CARP/Carpenter) but fails silently for ambiguous classifications (INDE vs INDP, RESA through RESZ for residential work).

**How to avoid:**

Do not attempt automatic string matching. Build a WA trade code selection UI element: a required dropdown or search-select populated from the full WA trade code enumeration, shown when a user adds a worker to a WA project. Store the selected WA code as a separate column (`waTrade` varchar(4)) on worker-project assignments or on the payroll entry. The XML generator reads `waTrade` directly. If `waTrade` is null for a worker on a WA project, block XML generation with a field-completion prompt. Include the full enumeration as a TypeScript constant in the codebase, sourced directly from the XSD.

**Warning signs:**

Any fuzzy string matching, `toLowerCase().includes()`, or `switch` statements attempting to derive WA trade codes from existing `workClass` strings. Any XML generator that uses a single default trade code for all workers.

**Phase to address:** WA submission assist phase — requires a DB migration and UI before the XML generator can be built.

---

### Pitfall 7: WA PWIA Requires WA County Names as Exact Enumerated Strings — Existing County Field Is Free-Text Lowercase

**What goes wrong:**

The WA PWIA XML `<county>` element requires the county name as an exact match against a fixed enumeration (ADAMS, ASOTIN, BENTON, ... YAKIMA — 39 WA counties, uppercase). The existing app stores `county` as a user-entered lowercase string with no validation or normalization (stored as "king", "pierce", etc. — used only for SAM.gov wage determination lookups with a statewide fallback). The existing value cannot be directly placed in the WA XML without transformation, and minor variations ("Grays Harbor" vs "GRAYS HARBOR") will fail XSD validation.

**Why it happens:**

The county field looks like it can just be uppercased — `county.toUpperCase()` — and passed through. This works for most single-word counties but breaks for multi-word counties: "GRAYS HARBOR" and "PEND OREILLE" and "SAN JUAN" and "WALLA WALLA" are the most common failure cases. Also, if the user typed "gray's harbor" or "pend orielle" at project creation, uppercasing alone produces an invalid string.

**How to avoid:**

Build a WA county normalization mapping: a TypeScript const that maps common lowercase variations to the exact XSD enumeration value. Do not rely on the existing free-text county field alone — surface a WA county selector (dropdown pre-populated from the 39-county enumeration) when creating a project in WA, or add a WA county correction step to the submission assist pre-generation checklist. Include multi-word counties explicitly in the mapping.

**Warning signs:**

Any XML generator that calls `county.toUpperCase()` without normalization. Any code that does not have the full 39-county WA enumeration as a constant. Test cases that only cover single-word counties and miss the multi-word edge cases.

**Phase to address:** WA submission assist phase — county normalization must be addressed before XML validation tests are written.

---

### Pitfall 8: Scope Creep From "XML Download" to "Direct Portal Submission" Is a Multi-Week Trap

**What goes wrong:**

Once XML export is working and contractors are using it, the natural next request is "can the app just submit directly to the portal so I don't have to log in separately?" This sounds like a small addition but it is a fundamentally different integration: it requires OAuth or session-based authentication with the CA DIR or WA L&I portals, handling CSRF tokens, maintaining session state, managing 2FA flows, and dealing with portals that have no documented public API. The CA DIR portal has had severe reliability issues (went down for weeks after June 2024 relaunch). The WA PWIA portal has no confirmed programmatic submission API for third-party software.

**Why it happens:**

The XML generation step feels like 80% of the work. Clicking "Upload" on the portal manually feels like a minor friction point. The temptation to close that gap is strong, especially when a contractor requests it. The work is actually 3-5x more effort than the XML generation itself and introduces ongoing maintenance risk every time the portal changes.

**How to avoid:**

The scope for v2.5 is explicit: XML download (CA) and guided data entry / structured export (WA). Lock the UI language to "Download XML for manual upload" and "Copy data for portal entry." Do not add a "Submit directly" button even as a placeholder. If a contractor requests direct submission, log the request for a future milestone and explain that the portal does not provide a public API. Any work on portal session automation should require a dedicated milestone with feasibility research first.

**Warning signs:**

Any code that makes HTTP requests to efiling.dir.ca.gov or secure.lni.wa.gov from the app backend. Any discussion of Playwright/Puppeteer or browser automation to "click submit" on behalf of the user. Any "Submit to DIR" button that does more than trigger a file download.

**Phase to address:** Both CA and WA phases — scope boundaries must be stated explicitly in each phase's acceptance criteria.

---

### Pitfall 9: CA DIR Portal Instability Since June 2024 — XML That Validates May Still Be Rejected

**What goes wrong:**

The CA DIR relaunched its Public Works Online System on June 24, 2024. The new system had severe reliability failures for months: it rejected valid XML submissions by marking them as "drafts" that never posted, failed to associate uploaded records with projects, and lost employee data (names, addresses, SSNs) after upload despite the XML being structurally valid. DIR manually combed the system daily to fix stuck draft submissions. The portal's internal processing logic changed how it classifies fringe benefit fields without updating the XSD.

This means: a contractor can generate a schema-valid XML file, upload it to the portal, receive a success confirmation, and still have an incorrectly processed or missing submission. The XML generator has no visibility into this.

**Why it happens:**

Developers testing against the XSD assume schema validity equals portal acceptance. The portal's back-end processing is a separate layer that can mishandle valid files.

**How to avoid:**

Build the export UI to include a post-download checklist: "After uploading to DIR: (1) Verify the submission appears in your DIR project history, (2) Check that all workers are listed, (3) Confirm week ending date is correct, (4) If submission shows 'draft' status, contact publicworks@dir.ca.gov." Document in-app that the app is responsible for generating a valid XML file but cannot verify portal processing. Add a note in the export modal linking to the DIR support page. Advise contractors to keep the downloaded XML as a local backup.

**Warning signs:**

Any assumption in code or UX copy that a successful download equals a successful submission. Any missing post-submission verification guidance in the UI.

**Phase to address:** CA eCPR XML generator phase — the download UX must include the post-upload checklist.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Zero-pad ssnLast4 to 9 digits for CA XML | No schema change needed | Produces invalid SSNs; portal rejects all submissions | Never |
| Use local projectId for DIR Project ID | No new DB field needed | Every CA XML upload rejected immediately | Never |
| Auto-derive WA trade code from workClass string | No new UI needed | Silent misclassification for ambiguous trades; creates inaccurate affidavit | Never |
| Use `county.toUpperCase()` without normalization map | One-liner in generator | Fails for "Grays Harbor", "Pend Oreille", "San Juan", "Walla Walla" | Never |
| Single `waIntentId` per project stored as text | Simple | Fine for v2.5; becomes a problem if multi-contract-per-project scenarios arise later | Acceptable for v2.5 |
| Freetext CSLB license number with no format validation | No validation code needed | User enters wrong format; portal rejects XML | Acceptable for v2.5 with UI hint |
| Reuse CA A-1-131 fringe data directly for XML deductions | No recalculation needed | Portal misclassifies fund admin; known DIR bug, not code bug | Acceptable with in-app documentation |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CA DIR eCPR portal | Using schema-validated XML and assuming it will post correctly | Validate against XSD locally, then add post-upload verification checklist |
| CA DIR eCPR portal | Placing `<fundAdmin>` contribution in `<other>` to correct portal display | Accept portal misclassification; use `<notes>` field to clarify; this is a DIR bug |
| CA DIR eCPR portal | Populating `<contractorFEIN>` from DB field that stores dashes (XX-XXXXXXX) | Strip dashes before writing XML: `fein.replace(/-/g, '')` → 9 digits |
| CA DIR eCPR portal | Encoding dates as MM/DD/YYYY or YYYY/MM/DD | `<forWeekEnding>` and per-day `<date>` elements must be yyyy-mm-dd (ISO 8601) |
| CA DIR eCPR portal | Omitting `<checkNum>` because it is not tracked in the app | `<checkNum>` is required (1-20 chars); use `CASH` for cash-paid workers; add check number input to eCPR export flow for check-paid workers |
| CA DIR eCPR portal | Setting `<grossAmountEarned><allWork>` same as `<thisProject>` | `<allWork>` should reflect wages across all projects that week, not just this project; the app has no multi-project pay data — use `<thisProject>` value and note the limitation |
| WA PWIA portal | Using WA XML upload for filing Statements of Intent | XML upload is only for certified payroll (weekly reports); Statements of Intent and Affidavits must be filed manually through PWIA portal |
| WA PWIA portal | Assuming XML upload replaces the Affidavit of Wages Paid | Affidavit must be filed separately at project completion; XML is weekly payroll reporting only |
| WA PWIA portal | Submitting without consistent `<endOfWeekDate>` day-of-week across weeks | WA schema requires weekday to remain consistent across all amendments; changing end-of-week day between submissions triggers validation failure |
| WA PWIA portal | Omitting `<apprenticeFlg>` or setting it without all required companion fields | `<apprenticeFlg>true</apprenticeFlg>` requires: apprenticeId, apprenticeState (WA/OR/MT/AK only), apprenticeOccpnName, apprenticeStepName, apprenticeStepBeginHours, apprenticeStepEndHours — all must be present |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Generating XML server-side by string concatenation instead of a DOM builder | XSS-style injection if any text field contains `<` or `&` characters; character encoding errors | Use a proper XML builder library (fast-xml-parser, xmlbuilder2, or Node.js DOMParser) that handles entity encoding | First contractor with an ampersand in their company name |
| Re-fetching all payroll entries per-worker during XML generation instead of a joined query | 10-worker week generates 10+ queries; 50-worker week generates 50+ | Use a single JOIN query to load all entries for the week, then group in-memory | Any project with more than 20 workers/week |
| Loading all historical payroll weeks to find payroll number for auto-increment | Slow for projects with many weeks | Query only `COUNT(*)` of submitted weeks for the project to determine the next payroll number | Projects that have been running for 6+ months with weekly submissions |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full SSN entered in CA eCPR export flow | PII exposure in server logs, error tracking | Ensure the SSN field never appears in Express request logging; use a dedicated non-logged endpoint or strip the SSN field before any log middleware fires |
| Storing full SSN if the app ever persists it for CA eCPR | PII breach risk; app is not currently designed for full-SSN storage | If full SSN must be stored, encrypt at rest with AES-256 and store separately from other worker fields; evaluate whether storage is necessary vs. per-session collection |
| Passing CA FEIN in URL query parameters for XML generation | FEIN visible in server access logs | Keep FEIN in POST body only; XML generation endpoint must be POST, not GET |
| Including full SSN in the XML download filename | SSN visible in file system / download history | Name files by project name + week ending date only, e.g., `ecpr-ProjectName-2026-03-28.xml` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Generating CA XML without explaining what to do with it | Contractor downloads file and doesn't know where to upload it | Include step-by-step post-download instructions in the modal: link to efiling.dir.ca.gov, screenshot guidance, and support contact |
| Presenting WA "submission assist" as equivalent to WA XML upload without clarifying manual steps remain | Contractor believes submission is complete when it is not | Label the feature "WA Submission Checklist" or "WA Payroll Export" — never "Submit to L&I" or "File with L&I" |
| No indication of which fields are CA-eCPR-specific vs always required | Contractors on non-CA projects see confusing CA fields | Gate CA eCPR export UI behind project state === 'CA' check (same pattern as A-1-131 CA gate in v2.4) |
| No pre-generation validation showing missing fields | Contractor downloads XML, portal rejects it, contractor doesn't know what was wrong | Run a "readiness check" before generating XML that lists missing required data (DIR Project ID, PWCR number, worker SSNs, check numbers) and blocks generation until complete |
| WA trade code selector buried in settings vs shown at time of need | Contractor doesn't populate WA codes until they try to generate XML and hit an error | Surface WA trade code as a required field during worker assignment on WA projects, not at export time |

---

## "Looks Done But Isn't" Checklist

- [ ] **CA XML namespace:** Verify `xmlns` attribute matches the schema namespace exactly: `http://www.dir.ca.gov/dlse/CPR-Prod-Test/CPR.xsd` — a missing or wrong namespace causes silent rejection at the portal
- [ ] **CA XML decimal format:** All decimal values must have exactly 2 decimal places (e.g., `1250.00` not `1250` or `1250.5`) — the XSD enforces fractionDigits=2
- [ ] **CA day-of-week IDs:** The 7 `<day>` elements must have `id` attributes `"1"` through `"7"` and dates that correspond to the correct calendar days of the payroll week — ID `"1"` is always the first day of the week configured for the project
- [ ] **CA `<allWork>` gross pay:** Must reflect worker's gross pay across ALL projects that week — app only knows about this project; the UI should instruct contractors to verify this field or expose an input for multi-project workers
- [ ] **CA `<checkNum>` required:** Missing from the current app's data model — must be added to the XML export flow; schema enforces minLength=1
- [ ] **WA `<noWorkPerformFlag>`:** When this is `true`, the `<employees>` element must be absent entirely (not empty) — sending an empty employees container when noWorkPerformFlag=true fails WA XSD validation
- [ ] **WA SSN validation:** WA schema enforces additional SSN rules beyond format: must not start with `9` (ITIN range), must not equal `666` or `000` in first 3 digits, must not have `00` in positions 4-5, must not have `0000` in positions 6-9 — these will fail portal validation even if 9 digits
- [ ] **WA apprentice fields:** Setting `<apprenticeFlg>true</apprenticeFlg>` without all 6 required companion elements (apprenticeId, apprenticeState, apprenticeOccpnName, apprenticeStepName, apprenticeStepBeginHours, apprenticeStepEndHours) causes XSD validation failure
- [ ] **WA `<jobClass>` required for non-apprentices:** When `apprenticeFlg=false`, `<jobClass>` becomes required (1-500 chars) — it is optional-looking in the schema but the conditional makes it effectively required for journeyworkers
- [ ] **Amendment tracking:** Both CA and WA have amendment flows in their schemas (`<amendmentNum>` for CA, `<amendedFlag>/<amendReason>` for WA) — the app's existing amendment workflow (v2.3) must correctly populate these fields when exporting an amended week, not just re-export the week as if it were original

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Full SSNs not collected, XML rejected | MEDIUM | Add SSN collection step to export flow; existing generated XML files must be regenerated with corrected SSNs |
| Wrong DIR Project ID used in submitted XML | LOW | Re-generate XML with correct ID and re-upload; DIR portal supports multiple submissions per project week |
| XML rejected due to namespace mismatch | LOW | Fix namespace string constant in generator; regenerate and re-upload |
| WA XML submitted without intentId, portal rejected | LOW | Contractor files Statement of Intent first, adds intentId in app, regenerates XML |
| WA trade codes not set, XML generation blocked | MEDIUM | Contractor must revisit each worker assignment and select WA trade code; add a bulk-edit UI if many workers affected |
| CA portal marked submission as "draft" (June 2024 bug class) | LOW | Contractor contacts publicworks@dir.ca.gov; DIR manually processes draft; provide email template in-app help |
| Amendment week exported as original (missing amendedFlag/amendmentNum) | MEDIUM | Re-generate XML with amendment fields set; re-upload with explanation to DIR; may require DIR support contact |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Full SSN required for CA XML | CA eCPR generator phase (first task) | Test: generate XML for a worker; verify `<ssn>` is 9 digits and matches `name id` attribute |
| DIR Project ID not in DB | CA eCPR generator phase (DB migration first) | Test: project without `dirProjectId` cannot generate XML; UI shows blocking prompt |
| PWCR number missing | CA eCPR generator phase | Test: PWCR field accepts 10 digits or `NA`; strips `PW-LR-` prefix if entered |
| Fund admin misclassification (portal display bug) | CA eCPR generator phase (document as known DIR issue) | Test: verify `<fundAdmin>` populated with correct hourly rate × hours; add code comment citing DIR system bug |
| intentId not in DB for WA | WA submission assist phase (first task) | Test: WA project without intentId cannot generate XML; UI shows blocking prompt with L&I link |
| WA trade code missing | WA submission assist phase (requires DB migration + UI) | Test: worker without `waTrade` on WA project blocks XML generation; dropdown populated from full enumeration |
| WA county normalization | WA submission assist phase | Test: "king" → "KING", "grays harbor" → "GRAYS HARBOR", "pend oreille" → "PEND OREILLE" all pass |
| Scope creep to direct submission | Both phases (in acceptance criteria) | Verify no HTTP calls to portal domains in backend code; "Download" not "Submit" in all UI copy |
| XML string injection | Both phases (XML builder library selection) | Test: worker with name "John & Jane <Test>" produces valid escaped XML |
| Post-download verification gap | CA eCPR generator phase (UX) | Verify export modal includes post-upload checklist and DIR support contact |
| check number missing from CA XML | CA eCPR generator phase | Test: `<checkNum>` present in output; UI captures check number or displays CASH option |
| Amendment fields not set on amended weeks | Both phases (wire to existing amendment model) | Test: export of amended week has `<amendmentNum>` > 0 (CA) and `<amendedFlag>true</amendedFlag>` (WA) |

---

## Sources

- CA DIR eCPR XML Schema (XSD): [https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd](https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd) — obtained directly, schema version 1.3
- WA LNI PWIA XML Schema (XSD): [https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd](https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd) — obtained directly
- CA DIR eCPR XML Guidelines: [https://www.dir.ca.gov/Public-Works/CPR/eCPRXMLGuideline.pdf](https://www.dir.ca.gov/Public-Works/CPR/eCPRXMLGuideline.pdf)
- CA DIR XML Upload User Guide: [https://www.dir.ca.gov/Public-Works/documents/CPR-XML-Upload-User-Guide.pdf](https://www.dir.ca.gov/Public-Works/documents/CPR-XML-Upload-User-Guide.pdf)
- CA DIR Certified Payroll Reporting Page: [https://www.dir.ca.gov/public-works/certified-payroll-reporting.html](https://www.dir.ca.gov/public-works/certified-payroll-reporting.html)
- Sunburst Software 2024 CA DIR System Issues: [https://www.sunburstsoftwaresolutions.com/2024-ca-dir.htm](https://www.sunburstsoftwaresolutions.com/2024-ca-dir.htm) — documents fund admin misclassification, fringes displayed as deductions, schema unchanged since 2016
- United Contractors DIR System Failures Guidance: [https://www.unitedcontractors.org/news/contractor-guidance-during-dir-website-system-failures](https://www.unitedcontractors.org/news/contractor-guidance-during-dir-website-system-failures) — June 2024 portal launch failures
- CA DIR Public Works Online System Enhancement Update (April 2025): [https://bayareabx.com/news/html/public-works-online-system-enhancement-update](https://bayareabx.com/news/html/public-works-online-system-enhancement-update)
- WA PWIA XML Payroll Upload Guide: [https://lni.wa.gov/licensing-permits/_docs/xml%20payroll%20guide.pdf](https://lni.wa.gov/licensing-permits/_docs/xml%20payroll%20guide.pdf)
- WA Prevailing Wage Apprenticeship Tracking and Craft Codes: [https://www.certifiedpayrollreporting.com/prevailing-wage-washington](https://www.certifiedpayrollreporting.com/prevailing-wage-washington)
- LCPtracker WA L&I Export Guide v1.3: [https://cms.tacoma.gov/cedd/SBE/Equity%20in%20Contracting%20FAQ/LCPtracker_Guide%20to%20WA%20LNI%20Features%20_V1.3.pdf](https://cms.tacoma.gov/cedd/SBE/Equity%20in%20Contracting%20FAQ/LCPtracker_Guide%20to%20WA%20LNI%20Features%20_V1.3.pdf)

---
*Pitfalls research for: CA eCPR XML export and WA PWIA submission assist — HCC Prevailing Wage v2.5*
*Researched: 2026-03-26*
