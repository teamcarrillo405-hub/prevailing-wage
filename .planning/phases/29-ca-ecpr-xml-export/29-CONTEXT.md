# Phase 29: CA eCPR XML Export — Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate and download a CA DIR eCPR-compliant XML file from existing CA project payroll data. Deliver 4 disaggregated fringe contribution columns per payroll entry (CA only), a pre-generation modal collecting missing required fields, a post-download portal upload checklist, and correct amendment marker in the XML for amended payroll weeks.

This phase does NOT include: direct portal submission (no public API), full SSN storage, persistent DB columns for WA fields, or any WA-specific functionality (Phase 30).

</domain>

<decisions>
## Implementation Decisions

### Fringe Disaggregation DB + Entry UI (CAE-01)

- **D-01:** Add 4 new nullable `real` columns to `payrollEntries` via SQL migration:
  - `fringe_health_welfare` — per-hour H&W contribution rate
  - `fringe_pension` — per-hour pension contribution rate
  - `fringe_vacation` — per-hour vacation contribution rate
  - `fringe_training` — per-hour training contribution rate
  - All nullable (null = non-CA entry; 0 = entered as zero for CA)
- **D-02:** For CA projects, the payroll entry form shows 4 per-hour rate fields (H&W, Pension, Vacation, Training) instead of the single combined fringe field. Non-CA entry form is completely unchanged.
- **D-03:** `fringeRateSnapshot` = auto-sum of the 4 sub-fields for CA entries (`healthWelfare + pension + vacation + training`). The existing compliance engine continues using `fringeRateSnapshot` for wage floor checks — no changes needed in `complianceService.ts`.
- **D-04:** Migration is SQL-only (`ALTER TABLE payroll_entries ADD COLUMN ...`). Must be manually registered in `meta/_journal.json` per project convention (see PROJECT.md: "SQL-only migrations must be manually registered in meta/_journal.json").

### Extended Payroll Join (Shared Prerequisite)

- **D-05:** Add `getPayrollEntriesWithWorkerDetails()` to `payrollService.ts`. Extends the existing `getPayrollEntries()` join to include:
  - `workers.ssn_last4`
  - `workers.address`
  - `worker_classifications.trade_code`
  - `worker_classifications.wa_trade_code` (also resolves existing `(row as any).waTradeCode` cast hack in F700 handler)
  - New fringe sub-columns: `fringe_health_welfare`, `fringe_pension`, `fringe_vacation`, `fringe_training`
  - Build and prove this first — both CA eCPR (Phase 29) and WA assist (Phase 30) depend on it.

### CA eCPR XML Generator (CAE-02)

- **D-06:** Create `src/server/services/ecprXmlGenerator.ts` — pure function `generateEcprXml(data: EcprData): string`. Uses xmlbuilder2@4.0.3. CA CPR.xsd v1.3 compliant. No I/O. Unit-testable without Express.
  - `npm install xmlbuilder2@4.0.3` is the first action before any generator code is written.
  - Namespace URI: `http://www.dir.ca.gov/dlse/CPR-Prod-Test/CPR.xsd` — use `CPR:` prefix on all elements (required by CA portal, handled cleanly by xmlbuilder2).
  - SSN: output `000000XXX` placeholder (last 4 digits from `ssnLast4` field) — never zero-padded fake 9-digit SSN; prominent modal disclosure added.
  - No runtime XSD validation — use `xmllint` CLI during dev only; rely on portal error messages in production.
- **D-07:** Add `GET /api/export/ecpr-xml/:weekId` to `export.ts` following the existing 8-step pattern (load week → verify ownership → state gate → load entries → map data → call generator → set headers → send response). State gate: `project.state !== 'CA'` → 400.
- **D-08:** Filename convention: `[last4FEIN]_[dirProjectId]_[weekEnding].xml` (e.g., `1234_99012345678_2026-03-27.xml`).

### Pre-Generation Modal (CAE-02)

- **D-09:** Pre-generation modal collects and **persists** these fields to the project record (nullable columns on `projects`):
  - `contractorFein` — 9-digit FEIN, strip dashes on save (display with dashes if already stored with dashes)
  - `dirProjectId` — CA DIR Public Works Online System project number; explicitly labeled "CA DIR Project ID (from DIR portal)" — NOT the app's internal `project.id`
  - `awardingAgency` — agency name (e.g., "Caltrans", "City of Los Angeles")
  - `contractNumber` — CA contract/purchase order number (distinct from `wdIdentifier` which is the federal WD number)
  - All 4 are new nullable `text` columns on `projects` — DB migration required.
  - On first export: modal shows empty fields. After save, values persist to project. On subsequent exports: modal pre-fills from project record. User can edit in modal before generating.
- **D-10:** Pre-generation modal also collects:
  - `checkNumber` — single field applying to all workers for the week. Default: `DIRECT DEPOSIT`. User can override (e.g., `101`). NOT persisted — ephemeral per export.
  - SSN disclosure notice — explains that `000000XXX` placeholder is used; contractor must enter full SSNs directly in the DIR eCPR portal.
- **D-11:** Existing CA eCPR disclosure modal in `PayrollWeekDetailPage.tsx` (around line 574) should be refactored/extended — not duplicated. The new eCPR XML export button/flow replaces or augments the existing "Download via eCPR portal" disclosure.

### Post-Download Checklist (CAE-03)

- **D-12:** After the XML file downloads, the pre-generation modal **transitions to step 2** — a post-download portal upload checklist. Same modal, in-place transition (no separate modal, no page reload). Checklist includes:
  1. Log in to `efiling.dir.ca.gov/eCPR`
  2. Select your project (must match DIR Project ID you provided)
  3. Upload the downloaded XML file
  4. Verify all workers appear in the submission preview
  5. Enter full SSNs for each worker directly in the portal (app uses placeholder `000000XXX`)
  6. Submit and confirm status — if "Draft", follow up at `publicworks@dir.ca.gov`
  - Include `publicworks@dir.ca.gov` contact link in the checklist.

### Amendment XML Marker (CAE-04)

- **D-13:** `<CPR:amendmentNum>` element is ALWAYS emitted in the XML (required by CA DIR portal — element absence triggers portal validation error). Non-amendment weeks: empty element `<CPR:amendmentNum/>`. Amendment weeks: `<CPR:amendmentNum>N</CPR:amendmentNum>` where N = `week.amendmentNumber`. Amendment detection: `week.originalWeekId != null && week.amendmentNumber != null`.

### SSN Strategy

- **D-14:** No full SSN storage in v2.5. `ssnLast4` is the only SSN data available. CA XML `<ssn>` element gets `000000XXX` where XXX = `ssnLast4` (e.g., `0000001234` for worker with `ssnLast4 = '1234'`). This will fail portal SSN validation — that is intentional and disclosed; contractor enters full SSNs in the portal UI directly.

### Claude's Discretion

- Exact column names in Drizzle schema (match snake_case DB convention: `fringe_health_welfare` etc.)
- Whether the pre-generation modal shows step indicators (Step 1: Configure / Step 2: Checklist)
- Error message wording for missing CA state gate
- Whether `checkNum` field label is "Check/Direct Deposit Number" or similar
- FEIN display format (XX-XXXXXXX) vs storage format (9 raw digits)
- Whether to show a "CA eCPR XML" badge/button separately from the existing "Download CA A-1-131" button, or in the same UI section

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB Schema
- `src/server/db/schema.ts` — add 4 nullable `real` fringe columns to `payrollEntries`; add 4 nullable `text` columns to `projects` (contractorFein, dirProjectId, awardingAgency, contractNumber)
- `drizzle/migrations/meta/_journal.json` — manual migration registration required

### Server
- `src/server/routes/export.ts` — add new `GET /api/export/ecpr-xml/:weekId` handler; follow existing 8-step pattern from WH-347, A-1-131, F700 handlers
- `src/server/services/payrollService.ts` — add `getPayrollEntriesWithWorkerDetails()` extended join
- `src/server/services/ecprXmlGenerator.ts` — NEW pure function; no existing file
- `src/server/services/a1131Generator.ts` — reference for existing CA service patterns

### Client
- `src/client/pages/PayrollWeekDetailPage.tsx` — add CA eCPR XML download button and modal flow; existing CA eCPR disclosure modal at ~line 574 should be extended/refactored
- `src/client/pages/PayrollEntryPage.tsx` — add CA-conditional 4-field fringe entry UI

### Schema / Spec
- `https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd` — CA DIR eCPR XML Schema v1.3 (fetched 2026-03-26, documented in .planning/research/STACK.md)
- `https://www.dir.ca.gov/Public-Works/CPR/CPRSample.xml` — CA DIR eCPR sample XML; namespace URI confirmed as `http://www.dir.ca.gov/dlse/CPR-Prod-Test/CPR.xsd`
- `.planning/research/STACK.md` — full field reference table for CPR.xsd v1.3

### Requirements
- `.planning/REQUIREMENTS.md` §CAE-01, CAE-02, CAE-03, CAE-04

</canonical_refs>

<code_context>
## Existing Code Insights

### What's Already There
- `export.ts` — 3 proven export handlers (WH-347, A-1-131, F700) following identical 8-step auth+gate+generate+respond pattern; new ecpr-xml handler slots in as the 4th
- `payrollEntries` schema — has `fringeRateSnapshot` (single real column); needs 4 new nullable real columns for CA fringe disaggregation
- `projects` schema — has `cslbLicense`, `wcPolicyNumber` (CA Phase 24), `ubiNumber`, `lniCertificate`, `wcAccount` (WA Phase 25) as nullable text; new CA eCPR fields follow same pattern
- `PayrollWeekDetailPage.tsx:574` — existing CA eCPR disclosure modal (persistent, shown on every CA A-1-131 download click); new XML flow refactors/extends this
- `PayrollEntryPage.tsx` — fringe rate auto-populated from `wageClassifications.fringeRate`; for CA, replaced by the 4-field auto-sum model
- `(row as any).waTradeCode` cast hack in F700 handler (~export.ts:371) — resolved as a side effect when `getPayrollEntriesWithWorkerDetails()` properly types the join

### What Needs Code Changes
- `schema.ts` — add 4 fringe sub-columns to `payrollEntries`, add 4 CA eCPR project columns to `projects`
- `drizzle/migrations/` — new SQL-only migration file + `_journal.json` entry
- `payrollService.ts` — add `getPayrollEntriesWithWorkerDetails()` (new function, doesn't replace existing `getPayrollEntries()`)
- `ecprXmlGenerator.ts` — new file
- `export.ts` — new route handler
- `PayrollEntryPage.tsx` — CA-conditional 4-field fringe entry (replaces single fringe display for CA projects)
- `PayrollWeekDetailPage.tsx` — CA eCPR XML download button + 2-step modal (configure → checklist)

### Critical Pitfalls (from research)
- DIR Project ID ≠ app's `project.id` — CA DIR's numeric portal ID (14-18 digits); wrong value = immediate portal rejection with no useful error
- Zero-padded SSN (`000000XXXX`) fails portal SSN regex; use `000000XXX` (last 3 digits of ssnLast4 as 3 chars, no zero-pad of last 4)
  - Wait — re-check: `ssnLast4` is 4 digits. Placeholder should be `000000` + last 4 → `0000001234`. Research says this also fails portal validation. The placeholder IS wrong on purpose — contractor must enter real SSNs in portal. Just ensure the modal disclosure is prominent.
- FEIN format: if stored as `XX-XXXXXXX`, strip dashes before writing to XML `<contractorFEIN>` element
- CA DIR portal instability since June 2024 — valid XML can get stuck as "draft"; post-download checklist must advise portal verification

</code_context>

<specifics>
## Specific Implementation Details

- New dependency: `xmlbuilder2@4.0.3` — first action before any generator code
- Namespace prefix: `CPR:` on every element; namespace URI: `http://www.dir.ca.gov/dlse/CPR-Prod-Test/CPR.xsd`
- CA fringe DB columns: `fringe_health_welfare`, `fringe_pension`, `fringe_vacation`, `fringe_training` — all nullable real on `payroll_entries`
- CA project DB columns: `contractor_fein`, `dir_project_id`, `awarding_agency`, `contract_number` — all nullable text on `projects`
- Migration workflow: SQL ALTER TABLE statements → new migration file in `src/server/db/migrations/` → manual entry in `src/server/db/migrations/meta/_journal.json`
- Route: `GET /api/export/ecpr-xml/:weekId` — state-gated to CA; streams XML as `application/xml` attachment
- Amendment marker: `<CPR:amendmentNum>` element is ALWAYS emitted (required by CA DIR portal). Non-amendment weeks: empty element `<CPR:amendmentNum/>`. Amendment weeks: `<CPR:amendmentNum>N</CPR:amendmentNum>` where N = `week.amendmentNumber`. Detection: `week.originalWeekId != null && week.amendmentNumber != null`.
- SSN placeholder: `000000` + `ssnLast4` (4 digits) → 10-digit string (e.g., `0000001234`); disclosure required in modal
- checkNum: single field, default `DIRECT DEPOSIT`, applies to all workers in the week's XML
- Pre-generation modal persists FEIN/dirProjectId/awardingAgency/contractNumber to project record; checkNum is ephemeral
- Post-download modal step 2 includes `publicworks@dir.ca.gov` contact for portal issues
- No HTTP calls to `efiling.dir.ca.gov` from the app backend — XML download only

</specifics>

<deferred>
## Deferred Ideas

- Full SSN storage — requires AES-256 at-rest encryption design + privacy review; deferred to v3+
- Persistent check number per project or per classification — v2.5 keeps it ephemeral per export
- Direct CA DIR portal submission — no public API exists; portal session automation is explicitly out of scope
- XSD runtime validation — use xmllint CLI during dev; not a production feature

</deferred>

---

*Phase: 29-ca-ecpr-xml-export*
*Context gathered: 2026-03-27*
