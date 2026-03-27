# Project Research Summary

**Project:** HCC Prevailing Wage v2.5 — CA eCPR XML Export + WA PWIA Submission Assist
**Domain:** Prevailing wage compliance SaaS — state portal integration layer
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

v2.5 adds state portal integration to an already-shipped compliance stack (Node/Express/TypeScript, React 18/Vite/TailwindCSS v4, SQLite/Drizzle, pdf-lib, JWT auth). The scope is deliberately narrow: CA DIR eCPR generates a downloadable XML file the contractor manually uploads to the DIR portal; WA L&I produces a JSON prefill guide the contractor copies into the PWIA web form. Neither state offers a documented machine-to-machine API — direct submission is not feasible and must not be attempted. One new npm dependency (`xmlbuilder2@4.0.3`) covers both XML outputs. No new pages, no new router files, no DB migrations are required under the baseline approach.

The principal technical challenge is not code complexity — it is data gaps. Both XML schemas require a full 9-digit SSN (the app stores only `ssnLast4`), and CA additionally needs the DIR-assigned project registration number, contractor FEIN, PWCR registration number, and contract agency name — none of which are in the current database. The recommended mitigation for v2.5 is runtime collection via a pre-generation modal (no DB schema changes needed), with placeholder values and prominent contractor disclosures where data is missing. Full SSN storage requires a privacy and security review and is deferred past v2.5.

The critical risk is scope creep: once XML download is working, the next request will be "submit directly to the portal." This must be locked out of v2.5 scope explicitly in each phase's acceptance criteria. A secondary risk is the CA DIR portal's documented instability since its June 2024 relaunch — valid XML files can be silently mis-processed. The export UX must include a post-upload verification checklist, not just a download button.

---

## Key Findings

### Recommended Stack

The existing stack handles v2.5 with a single new library. `xmlbuilder2@4.0.3` (Node >= 20 required, already satisfied by project `package.json`) provides a fluent DOM-conformant API with namespace prefix support — required for CA eCPR's `CPR:` prefix on every element. Template-string XML is viable for simple flat schemas but fails silently when data contains `&`, `<`, or `>`, which is unacceptable for contractor name and project fields. No alternative library handles CA's namespace requirement as cleanly. TypeScript types are bundled; no `@types/` package needed.

XSD validation at runtime is explicitly excluded. Both schemas are fixed and known at build time. Use `xmllint` CLI against downloaded XSD files during development; rely on portal error messages in production. Do not install `libxmljs2-xsd` or any native node-gyp XSD binding — the build friction on Windows outweighs the benefit for a dev-only validation step.

**Core new technology:**
- `xmlbuilder2@4.0.3`: XML document generation for CA eCPR and WA L&I CPR — handles `CPR:` namespace prefix cleanly; TypeScript types bundled; actively maintained (v4.0.3 released November 2025)

**Existing stack (unchanged):**
- Node.js/Express/TypeScript: server-side XML generation and download route
- React 18/TanStack Query: client download handler (fetch → Blob → anchor) and WA assist modal
- SQLite/Drizzle ORM: data source for all generated content
- pdf-lib: unchanged — XML export is a separate code path with zero overlap

See STACK.md for the full CA CPR.xsd v1.3 and WA xmlschema.xsd field reference tables fetched live from official portals 2026-03-26.

### Expected Features

**Must have (table stakes for v2.5):**
- CA eCPR XML download — server-side generation of CPR.xsd v1.3 compliant file, filename `[last4FEIN]_[projectID]_[weekEnding].xml`, state-gated to CA projects only
- Pre-generation readiness check modal — list missing required data (DIR Project ID, FEIN, PWCR number, check numbers) and block generation until contractor acknowledges gaps
- Post-download verification checklist — inline steps in the export modal: verify submission appears in DIR history, confirm all workers listed, follow up if submission shows "draft" status; link to `publicworks@dir.ca.gov`
- WA submission assist panel — JSON prefill modal showing per-worker trade code, hours by day, rates, and gross pay; labeled gaps where SSN and intentId must be supplied manually
- WA prerequisite checklist — display `intentId` input labeled "WA L&I Intent ID" with link to `secure.lni.wa.gov/wagelookup/` before the prefill panel is shown; gate the panel on intentId being entered

**Should have (UX quality for v2.5):**
- PWCR number normalization — if contractor enters `PW-LR-XXXXXXXXXX`, strip prefix; store only the 10-digit numeric portion
- WA trade code gate — block WA XML generation for any worker without a confirmed 4-letter `waTradeCode`; surface a field-completion prompt listing affected workers
- WA county normalization — TypeScript const mapping free-text county values to the exact 39-county WA XSD enumeration, explicitly covering "Grays Harbor", "Pend Oreille", "San Juan", "Walla Walla"
- Amendment fields wired — CA `<amendmentNum>` and WA `<amendedFlag>/<amendReason>` correctly populated from v2.3 amendment model when exporting an amended week

**Defer (v3+):**
- Full 9-digit SSN storage — requires privacy review and AES-256 at-rest encryption design
- Persistent DB columns for `dirProjectId`, `contractorFein`, `dirContractAgency`, `waIntentId` — v2.5 collects at runtime; v3 persists across sessions
- WA full CPR XML upload — blocked by SSN gap (Gap #2) and intentId gap (Gap #4); present approach is JSON assist only
- Direct portal submission for any state — no public API exists; portal session automation is a multi-week trap with ongoing maintenance risk

### Architecture Approach

v2.5 extends `src/server/routes/export.ts` with two new GET handlers following the established 8-step pattern (load week, verify ownership, state gate, load entries, map data, call generator, set headers, send response). Two new pure service files are created as siblings to `a1131Generator.ts`: `ecprXmlGenerator.ts` returns an XML string; `waAssistFormatter.ts` returns a typed JSON object. A new `getPayrollEntriesWithWorkerDetails()` function is added to `payrollService.ts` to extend the existing join with `ssnLast4`, `workerAddress`, `tradeCode`, and `waTradeCode`. This resolves the existing `(row as any).waTradeCode` cast hack in the F700 handler as a side effect. No new pages, no new router files, no DB schema changes are required.

**Major components:**
1. `ecprXmlGenerator.ts` (NEW) — pure function `generateEcprXml(data: EcprData): string`; uses xmlbuilder2; CA CPR.xsd v1.3 compliant; no I/O; unit-testable without Express
2. `waAssistFormatter.ts` (NEW) — pure function `formatWaAssistData(week, project, entries): WaAssistOutput`; returns JSON-serializable prefill object; no I/O; unit-testable without Express
3. `export.ts` GET handlers (MODIFIED) — two new routes following identical auth + ownership + state-gate + generate + respond pattern; ~75 lines for CA, ~60 lines for WA
4. `payrollService.ts` (MODIFIED) — `getPayrollEntriesWithWorkerDetails()` extends existing join with worker address, trade codes, and ssnLast4
5. `PayrollWeekDetailPage.tsx` (MODIFIED) — CA XML download handler with new `caEcprGeneratingRef` (third dedicated ref, per existing comment at line 128); WA assist button with `showWaAssistModal` state + prefill panel modal

Build order: Step 1 (extended join) unlocks Steps 2-4 (CA path) and Steps 5-7 (WA path) which can proceed in parallel after the join is proven.

### Critical Pitfalls

1. **Full SSN required but only last-4 stored** — CA and WA both need 9-digit SSN. Zero-padding `ssnLast4` to produce `000000XXXX` fails portal validation (DIR checks against federal SSN rules: no `000` prefix, no `0000` in last 4 positions). Mitigation: output `000000XXX` placeholder in CA XML with a prominent modal disclosure; show `XXX-XX-XXXX` masked in WA assist panel; document that contractor must supply full SSNs before uploading to portal.

2. **DIR Project ID is not the app's `projectId`** — CA XML `<projectID>` is the CA DIR Public Works Online System's numeric identifier (14-18 digits), not the app's internal integer PK. Populating it from `project.id` causes immediate portal rejection with no useful error message. Mitigation: collect in pre-generation modal labeled explicitly "CA DIR Project ID (from DIR portal)"; gate generation on this value being present.

3. **WA intentId is a prerequisite external filing** — The `intentId` required by WA XML is issued only after the contractor files a Statement of Intent through the PWIA portal — a separate step that must happen before work begins. It cannot be auto-generated or inferred. Mitigation: surface as a prerequisite step in the WA submission assist entry point with a link to the PWIA portal; gate the prefill panel on intentId being entered.

4. **WA trade codes are a fixed 4-letter enumeration** — The `<trade>` element requires an exact code (ELEC, CARP, LABO, etc.) from the XSD enumeration. Fuzzy string matching or `toLowerCase().includes()` against existing `workClass` descriptions will fail silently for ambiguous classifications (INDE vs INDP; RESA through RESZ). Mitigation: `waTradeCode` column introduced in v2.4 stores the correct value; verify it is populated for all workers on WA projects before allowing XML generation; block with a field-completion prompt if null.

5. **CA DIR portal instability since June 2024** — Schema-valid XML can be accepted and then silently mis-processed (stuck as "draft", employee records not associated with the project). The XML generator has no visibility into portal processing. Mitigation: include a post-download verification checklist in the export modal; do not imply that a successful download equals a successful submission.

6. **Scope creep to direct portal submission** — Once XML download works, pressure to "just submit directly" is predictable. Neither CA DIR nor WA L&I provides a public contractor submission API. Portal session automation (Playwright/headless browser) is 3-5x the work of XML generation plus ongoing maintenance risk every time portals change. Mitigation: acceptance criteria for both phases explicitly prohibit HTTP calls to portal domains from app backend; UI copy uses "Download" not "Submit" throughout.

---

## Implications for Roadmap

Based on the combined research, v2.5 has a clean two-phase structure. The shared data layer must be built first; CA and WA can then proceed in parallel with CA having higher technical priority due to schema complexity.

### Phase 1: Extended Data Layer + CA eCPR XML Export

**Rationale:** The extended payroll entry join (`getPayrollEntriesWithWorkerDetails`) is a prerequisite for both CA and WA features and should be proven once before either generator is built. CA eCPR has a more complex XML mapping (40+ required fields, namespace prefixes, 13 deduction fields, 7-day arrays per worker) and higher-stakes failure modes (DIR portal instability, fund admin misclassification). Building CA first surfaces implementation issues before WA adds new unknowns.

**Delivers:** Downloadable CA CPR.xsd v1.3 compliant XML for CA projects; pre-generation modal for runtime data collection; post-download verification checklist; `ecprXmlGenerator.ts` unit-tested against CPR.xsd structure.

**Addresses:** CA eCPR table stakes feature; pre-generation readiness check; PWCR strip logic; amendment field wiring for CA; xmlbuilder2 install and namespace usage pattern established.

**Avoids:**
- Full SSN pitfall: `000000XXX` placeholder with disclosure, never zero-padded fake
- DIR Project ID pitfall: runtime modal collection, labeled explicitly with DIR portal link
- String injection pitfall: xmlbuilder2 handles entity encoding for `&` and `<` in contractor/project names
- CA portal instability pitfall: post-download checklist with `publicworks@dir.ca.gov` contact in modal
- Scope creep: acceptance criteria prohibit any HTTP call to `efiling.dir.ca.gov`
- `checkNum` omission: CA schema requires minLength=1; add check number input to export flow with "DIRECT DEPOSIT" default

**Key tasks in order:**
1. `npm install xmlbuilder2@4.0.3`
2. Add `getPayrollEntriesWithWorkerDetails()` to `payrollService.ts` — also resolves `(row as any).waTradeCode` hack in F700 handler
3. Build and unit-test `ecprXmlGenerator.ts` against CPR.xsd structure
4. Add `GET /api/export/ecpr-xml/:weekId` to `export.ts`
5. Update CA disclosure modal in `PayrollWeekDetailPage.tsx` with XML option, gap disclosures, post-download checklist

### Phase 2: WA L&I Submission Assist + CPR JSON Prefill

**Rationale:** Depends on Phase 1's extended join and proven route pattern. WA submission assist is architecturally simpler (JSON response, no file download) but has more prerequisite UX gates (intentId, WA trade code validation, county normalization). Sequencing after CA ensures both the data layer and the modal pattern are stable before WA adds its own UX complexity.

**Delivers:** WA submission assist modal in `PayrollWeekDetailPage.tsx` showing per-worker prefill data; `waAssistFormatter.ts` unit-tested against xmlschema.xsd field list; `GET /api/export/wa-assist/:weekId` returning structured JSON; prerequisite checklist for intentId.

**Addresses:** WA submission assist table stakes; intentId prerequisite flow; 39-county normalization const; WA trade code gate; amendment field wiring for WA.

**Avoids:**
- intentId pitfall: prerequisite step shown before prefill panel; link to `secure.lni.wa.gov/wagelookup/`
- WA trade code pitfall: gate on `waTradeCode` being populated; surface actionable warning for workers with null `waTradeCode`
- County normalization pitfall: TypeScript const covering all 39 counties with multi-word edge cases tested explicitly
- WA apprentice field pitfall: `<apprenticeFlg>true</apprenticeFlg>` requires all 6 companion fields — surface gap for `apprenticeId` (app stores `programName`, not individual reg ID)
- `noWorkPerformFlag` pitfall: when true, `<employees>` element must be absent entirely, not empty
- Scope creep: acceptance criteria prohibit any HTTP call to `secure.lni.wa.gov`; label is "WA Submission Assist" not "Submit to L&I"

**Key tasks in order:**
1. Build and unit-test `waAssistFormatter.ts` against xmlschema.xsd field list
2. Add `GET /api/export/wa-assist/:weekId` to `export.ts`
3. Add WA assist button + prefill panel modal to `PayrollWeekDetailPage.tsx`

### Phase Ordering Rationale

- Phase 1 before Phase 2 because `getPayrollEntriesWithWorkerDetails()` is a shared prerequisite — build it once, test it once
- CA before WA because CA has higher XML complexity (namespace prefixes, 40+ fields, deduction mapping) and higher portal risk (June 2024 instability) — resolving CA first de-risks the release
- No DB migrations in either phase — all missing CA fields collected at runtime in pre-generation modal; WA intentId shown as a labeled blank with external link
- `xmlbuilder2` install is the first action in Phase 1 before any generator code is written

### Research Flags

Phases with well-documented patterns (no additional research needed):
- **Phase 1 (CA XML):** CA CPR.xsd v1.3 fetched live; all 40+ fields documented in STACK.md; xmlbuilder2 API is straightforward; existing export.ts route pattern proven across 3 prior handlers (WH-347, A-1-131, F700)
- **Phase 2 (WA Assist):** WA xmlschema.xsd fetched live; all fields documented in STACK.md; JSON route pattern is simpler than Phase 1; PWIA portal-only distinction confirmed

Areas to verify at implementation start (not blocking, but confirm before writing generator code):
- **CA FEIN format in DB:** May be stored with dashes (XX-XXXXXXX); generator must strip to 9 digits. Confirm format at Phase 1 task 2.
- **CA XML namespace URI:** Must match portal's expected value exactly: `http://www.dir.ca.gov/dlse/CPR-Prod-Test/CPR.xsd`. Verify against live `CPRSample.xml` before finalizing the generator constant.
- **WA `waTradeCode` data completeness:** Workers assigned before v2.4 may have null `waTradeCode`. Include a data audit in Phase 2 acceptance criteria.
- **Amendment week detection logic:** Confirm `payroll_weeks.parent_week_id` and `submission_status = 'amended'` are the correct signals for populating `<amendmentNum>` (CA) and `<amendedFlag>` (WA) before writing generator code.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | CA CPR.xsd v1.3 and WA xmlschema.xsd fetched directly from official portals; xmlbuilder2 v4.0.3 changelog confirmed on GitHub; Node.js compatibility verified against project `package.json` engines field |
| Features | HIGH | CA eCPR field requirements confirmed from live XSD and sample XML; WA PWIA field requirements confirmed from live XSD and RCW 39.12.040; PWIA portal-only distinction confirmed from multiple sources |
| Architecture | HIGH | Existing codebase directly inspected (`export.ts`, `payrollService.ts`, `PayrollWeekDetailPage.tsx`, `schema.ts`, `a1131Generator.ts`, `f700Generator.ts`, `index.ts`) — no inference needed; patterns are established and repeatable |
| Pitfalls | HIGH | Critical pitfalls grounded in official XSD constraints (SSN pattern, enumeration types, required fields); CA DIR portal instability documented by United Contractors and Sunburst Software; scope creep risk is structural |

**Overall confidence:** HIGH

### Gaps to Address

- **Full SSN strategy for v3+:** v2.5 uses placeholder output with disclosures. Before adding persistent SSN storage, conduct a privacy review and design AES-256 encryption at rest. Do not shortcut with a plain `TEXT` column.
- **FEIN format in DB:** Confirm whether `projects.contractorFein` (if it exists) stores raw digits or formatted with dashes. The CA XML generator must call `.replace(/-/g, '')` before writing `<contractorFEIN>`. Verify at Phase 1 task 2 during codebase inspection.
- **`allWork` gross wages:** CA XML `<grossAmountEarned><allWork>` should reflect worker's total gross across all jobs that week. The app only has per-project data. v2.5 mitigation is to use `thisProject` value and add a disclosure. This is a known limitation, not a code bug — document it in the modal.
- **WA apprentice `apprenticeId` vs `programName`:** App stores `programName` (the program name); WA XML needs the individual apprentice registration ID. WA assist panel shows `programName` with a note explaining the distinction. If apprentice ID tracking is needed, add a new worker-level field in a future milestone.
- **`waTradeCode` null handling:** Phase 2 acceptance criteria must include a test for the case where one or more workers on a WA project have `waTradeCode = null` — verify the assist panel surfaces an actionable list of affected workers, not a silent blank or a crash.

---

## Sources

### Primary (HIGH confidence)

- `https://www.dir.ca.gov/Public-Works/CPR/CPR.xsd` — CA DIR eCPR XML Schema v1.3, live fetch 2026-03-26; full field reference in STACK.md
- `https://www.dir.ca.gov/Public-Works/CPR/CPRSample.xml` — CA DIR eCPR sample XML, namespace URI confirmed
- `https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd` — WA L&I CPR XML Schema, live fetch 2026-03-26; full field reference in STACK.md
- `https://github.com/oozcitak/xmlbuilder2/blob/master/CHANGELOG.md` — xmlbuilder2 v4.0.3 release date (November 2025) and Node >= 20 requirement confirmed
- Existing codebase (directly inspected): `export.ts`, `payrollService.ts`, `PayrollWeekDetailPage.tsx`, `schema.ts`, `a1131Generator.ts`, `f700Generator.ts`, `index.ts`
- `package.json` (`engines.node >= 20.0.0`) — Node compatibility confirmed

### Secondary (MEDIUM confidence)

- `https://www.dir.ca.gov/public-works/certified-payroll-reporting.html` — v1.3 schema confirmed current; links to XSD and sample XML
- `https://lni.wa.gov/licensing-permits/public-works-projects/contractors-employers/` — WA weekly CPR filing via My L&I confirmed official requirement
- `https://www.points-north.com/state-by-state-certified-payroll-reporting/washington` — PWIA vs CPR distinction confirmed; PWIA is web form only, CPR accepts XML upload
- `https://sunburstsoftwaresolutions.com/washington-state-l-i-electronic-xml-upload-available.htm` — WA L&I XML as portal file upload (not API) confirmed; effective January 2020
- `https://bayareabx.com/news/html/public-works-online-system-enhancement-update` — CA DIR April 2025 platform update; XML format unchanged from v1.3
- `https://www.sunburstsoftwaresolutions.com/2024-ca-dir.htm` — CA DIR June 2024 portal instability and fund admin misclassification as known DIR system bug
- `https://www.unitedcontractors.org/news/contractor-guidance-during-dir-website-system-failures` — June 2024 portal launch failures documented; draft submission behavior confirmed
- `https://lni.wa.gov/licensing-permits/_docs/xml%20payroll%20guide.pdf` — WA XML Payroll Upload Guide (existence confirmed; content not extracted from binary PDF)
- DOL WH-347 (Rev. Jan 2025), 29 CFR Part 5, 29 CFR 3.9, RCW 39.12.040 — regulatory basis for all compliance feature context

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
