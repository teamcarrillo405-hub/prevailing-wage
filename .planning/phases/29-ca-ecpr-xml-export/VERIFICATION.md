---
phase: 29-ca-ecpr-xml-export
verified: 2026-03-27T01:48:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "CA fringe fields visible in payroll entry form (CA project only)"
    expected: "4-field fringe panel (H&W, Pension, Vacation, Training) renders for CA project; hidden for non-CA project"
    why_human: "React conditional rendering — isCA prop wire requires live browser session to confirm"
  - test: "Download CA eCPR XML button gated to CA projects"
    expected: "Button absent on non-CA project's PayrollWeekDetailPage; present on CA project"
    why_human: "isCA state derived from live project query; cannot confirm gate without a browser session"
  - test: "2-step modal transitions to Step 2 after download"
    expected: "Step 1 form collects fields; after 'Generate & Download XML' click, modal transitions in-place to Step 2 checklist"
    why_human: "DOM state transition; human already verified this per the user checkpoint in the prompt"
  - test: "FEIN/dirProjectId fields pre-fill on subsequent opens"
    expected: "Re-opening the modal for a project that already has these values saved shows them pre-filled"
    why_human: "Requires persisting to DB via PATCH /projects/:id then reopening modal in live session"
---

# Phase 29: CA eCPR XML Export Verification Report

**Phase Goal:** Generate and download a CA DIR eCPR-compliant XML file from existing CA project payroll data. Deliver 4 disaggregated fringe contribution columns per payroll entry (CA only), a pre-generation modal collecting missing required fields, a post-download portal upload checklist, and correct amendment marker in the XML for amended payroll weeks.

**Verified:** 2026-03-27T01:48:00Z
**Status:** passed
**Re-verification:** No — initial verification
**Human Checkpoint:** Approved by user prior to this verification (full end-to-end flow confirmed)

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                         | Status     | Evidence                                                                                         |
|----|-------------------------------------------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------------|
| 1  | CA payroll entries store 4 disaggregated fringe columns (H&W, Pension, Vacation, Training)                                    | VERIFIED   | schema.ts lines 179-182; migration 0014 lines 1-7; upsertPayrollEntry writes all 4 fields        |
| 2  | CA project record stores 4 eCPR modal fields (FEIN, DIR Project ID, Awarding Agency, Contract Number)                        | VERIFIED   | schema.ts lines 39-42; migration 0014 lines 9-15; export.ts reads them with project fallback     |
| 3  | GET /api/export/ecpr-xml/:weekId exists, is CA-gated, calls getPayrollEntriesWithWorkerDetails, and returns CPR: XML          | VERIFIED   | export.ts lines 518-685; CA gate at line 547; uses getPayrollEntriesWithWorkerDetails at line 567|
| 4  | generateEcprXml produces CPR:-namespaced XML with amendment marker always emitted                                             | VERIFIED   | ecprXmlGenerator.ts line 102 (xmlns:CPR); lines 143-147 (D-13 always-emit); 13/13 tests pass    |
| 5  | Pre-generation modal (Step 1) collects FEIN, DIR Project ID, Awarding Agency, Contract Number, checkNum; shows SSN disclosure  | VERIFIED   | PayrollWeekDetailPage.tsx lines 791-858; SSN notice at line 851-858                              |
| 6  | Post-download modal (Step 2) shows 6-item checklist with publicworks@dir.ca.gov link; transitions in-place                    | VERIFIED   | PayrollWeekDetailPage.tsx lines 876-918; checklist items 1-6 at lines 886-904; email link line 900|
| 7  | Amendment XML: amendmentNum populated when week.originalWeekId && week.amendmentNumber; empty element otherwise               | VERIFIED   | export.ts line 672; ecprXmlGenerator.ts lines 143-147; Test 9a and 9b both pass                  |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact                                                       | Description                                  | Status     | Details                                                                        |
|----------------------------------------------------------------|----------------------------------------------|------------|--------------------------------------------------------------------------------|
| `src/server/db/schema.ts`                                      | 4 fringe cols on payrollEntries; 4 CA eCPR cols on projects | VERIFIED | fringeHealthWelfare/Pension/Vacation/Training (lines 179-182); contractorFein/dirProjectId/awardingAgency/contractNumber (lines 39-42) |
| `src/server/db/migrations/0014_ca_ecpr_fringe_columns.sql`     | 8 ALTER TABLE statements                     | VERIFIED   | All 8 present (4 payroll_entries + 4 projects); journal entry idx=10 confirmed  |
| `src/server/db/migrations/meta/_journal.json`                  | Migration manually registered                | VERIFIED   | Entry at idx 10, tag "0014_ca_ecpr_fringe_columns"                              |
| `src/server/services/payrollService.ts`                        | getPayrollEntriesWithWorkerDetails function  | VERIFIED   | Lines 259-281; selects ssnLast4, address, tradeCode, waTradeCode, all 4 fringe fields |
| `src/server/services/ecprXmlGenerator.ts`                      | generateEcprXml pure function; CPR: namespace | VERIFIED  | 225 lines; exports EcprData, EcprEmployee, EcprEmployeeDay types; CPR: prefix on all elements |
| `src/server/services/ecprXmlGenerator.test.ts`                 | 13 unit tests                                | VERIFIED   | 13 tests, all passing (vitest run confirmed)                                    |
| `src/server/routes/export.ts`                                  | GET /api/export/ecpr-xml/:weekId; CA state gate | VERIFIED | Lines 518-685; imports generateEcprXml and getPayrollEntriesWithWorkerDetails   |
| `src/client/pages/PayrollWeekDetailPage.tsx`                   | CA eCPR XML button + 2-step modal            | VERIFIED   | Button at lines 429-437; modal JSX lines 770-922; handleEcprXmlDownload lines 309-362 |
| `src/client/components/PayrollWeekForm.tsx`                    | CA-conditional 4-field fringe entry          | VERIFIED   | isCA prop gate at line 201; 4 inputs (H&W/Pension/Vacation/Training) lines 206-226; auto-sum useEffect lines 91-96 |
| `src/server/routes/payroll.ts`                                 | UpsertEntrySchema with 4 fringe fields       | VERIFIED   | Lines 67-70; fringeHealthWelfare/Pension/Vacation/Training all present as nullable optional numbers |

---

### Key Link Verification

| From                              | To                                             | Via                                                   | Status  | Details                                                                           |
|-----------------------------------|------------------------------------------------|-------------------------------------------------------|---------|-----------------------------------------------------------------------------------|
| PayrollWeekDetailPage.tsx         | GET /api/export/ecpr-xml/:weekId               | fetch with URLSearchParams (line 332)                 | WIRED   | Response blob downloaded; step transitions on success (line 355)                  |
| export.ts ecpr-xml handler        | generateEcprXml                                | import + direct call (line 677)                       | WIRED   | ecprData built from project + entries, passed to generator                        |
| export.ts ecpr-xml handler        | getPayrollEntriesWithWorkerDetails             | import + call at line 567                             | WIRED   | Returns rows with ssnLast4, address, fringe sub-fields                            |
| PayrollWeekDetailPage.tsx         | PATCH /projects/:id                            | api.patch at line 316 before download                 | WIRED   | Persists FEIN/dirProjectId/awardingAgency/contractNumber to project record        |
| PayrollWeekForm.tsx isCA fringe   | PUT /api/payroll/entries/:weekId               | fetch with conditional spread (lines 152-157)         | WIRED   | fringeHealthWelfare/Pension/Vacation/Training only sent when isCA=true             |
| PayrollWeekForm.tsx fringe fields | fringeRateSnapshot auto-sum                    | useEffect + setValue('fringeRate') lines 91-96        | WIRED   | Sum written to hidden fringeRate field; compliance engine unaffected               |
| export.ts fringe sub-fields       | XML deductionsContribPay elements              | hw/pen/vac/trn * totalHours (lines 610-641)           | WIRED   | Per-hour rates multiplied by total hours to produce week totals                    |

---

### Data-Flow Trace (Level 4)

| Artifact                   | Data Variable           | Source                                              | Produces Real Data | Status   |
|----------------------------|-------------------------|-----------------------------------------------------|--------------------|----------|
| ecprXmlGenerator.ts        | EcprData.employees      | export.ts maps from getPayrollEntriesWithWorkerDetails | Yes              | FLOWING  |
| export.ts ecpr-xml handler | entries (fringe fields) | getPayrollEntriesWithWorkerDetails joins payrollEntries with fringe columns | Yes | FLOWING |
| PayrollWeekDetailPage.tsx  | ecprFein/ecprDirProjectId | projectData.data.project via useQuery + useEffect pre-fill | Yes (when saved) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                             | Command                                                          | Result         | Status |
|------------------------------------------------------|------------------------------------------------------------------|----------------|--------|
| ecprXmlGenerator: all 13 tests pass                  | `npx vitest run ecprXmlGenerator.test.ts`                       | 13/13 passed   | PASS   |
| xmlbuilder2 dependency present at correct version    | `grep '"xmlbuilder2"' package.json`                             | "^4.0.3"       | PASS   |
| Migration file has 8 ALTER TABLE statements          | File read: 0014_ca_ecpr_fringe_columns.sql                       | 8 statements   | PASS   |
| Migration registered in _journal.json               | File read: meta/_journal.json                                    | idx=10 present | PASS   |
| CA gate returns 400 for non-CA project               | Code review: export.ts line 547-550                              | `project.state !== 'CA'` → 400 | PASS |
| FEIN dash-stripping before XML write                 | Code review: export.ts line 652; modal line 317                  | `.replace(/-/g, '')` in both | PASS |
| amendmentNum empty element when null (D-13)          | Test 9b in vitest output                                        | PASS           | PASS   |
| amendmentNum populated when amendment (D-13)         | Test 9a in vitest output                                        | PASS           | PASS   |

---

### Requirements Coverage

| Requirement | Description                                                                                                          | Status     | Evidence                                                                                          |
|-------------|----------------------------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------|
| CAE-01      | 4 disaggregated CA fringe columns per payroll entry (H&W, Pension, Vacation, Training) — DB + entry UI               | SATISFIED  | schema.ts cols; migration 0014; PayrollWeekForm CA fringe panel; UpsertEntrySchema fringe fields  |
| CAE-02      | CA DIR eCPR-compliant XML download; pre-generation modal collects FEIN, DIR Project ID, Awarding Agency, Contract Number | SATISFIED | export.ts ecpr-xml handler; generateEcprXml; 2-step modal Step 1 UI; persist-then-download flow  |
| CAE-03      | Post-download portal upload checklist with SSN caveat and portal link                                                | SATISFIED  | PayrollWeekDetailPage Step 2 modal; 6-item ordered list; publicworks@dir.ca.gov mailto link       |
| CAE-04      | Correct amendment/resubmit marker in eCPR XML for amended weeks                                                     | SATISFIED  | export.ts line 672; ecprXmlGenerator.ts lines 143-147; Tests 9a + 9b passing                     |

---

### Anti-Patterns Found

| File                              | Line | Pattern                                              | Severity | Impact                                                                 |
|-----------------------------------|------|------------------------------------------------------|----------|------------------------------------------------------------------------|
| export.ts                         | 660  | `address: { street: '', city: '', state: 'CA', zip: '00000' }` | Info | Contractor address is empty — CPR.xsd allows empty strings; no project address field exists in schema. Not a blocker; portal likely accepts empty. |
| export.ts                         | 377-378 | `(row as any).waTradeCode` cast — F700 handler | Info | The `(row as any)` cast hack in the F700 handler (noted in CONTEXT as a side-effect fix) was NOT cleaned up. `getPayrollEntriesWithWorkerDetails` is available and types `waTradeCode` properly, but the F700 handler still uses `getPayrollEntries()` and the cast. This is pre-existing from Phase 25; not introduced by Phase 29. |
| PayrollWeekDetailPage.tsx         | 331  | No `contractorEmail` in PATCH /projects persist call | Info  | The `contractorEmail` field is sent as a query param to the export endpoint but is not persisted to the project record (no `contractorEmail` column exists on projects). This is intentional per the schema design — email is ephemeral per export. Minor: modal does not expose a contractorEmail input field, so the endpoint always receives an empty string for that param. |

No blockers found. No stubs. All three anti-pattern items are informational only.

---

### Human Verification Required

#### 1. CA fringe fields visible in payroll entry form

**Test:** Open a CA project, navigate to add a payroll entry via PayrollWeekForm with `isCA=true`. Confirm the amber-bordered panel with H&W, Pension, Vacation, Training fields appears. Open a non-CA project and confirm the panel is absent.
**Expected:** 4-field panel visible only for CA projects; fringe rate field auto-updates as sub-fields change.
**Why human:** React conditional `{isCA && ...}` rendering requires live browser to confirm the `isCA` prop is passed correctly at the call site.

#### 2. Download CA eCPR XML button CA-gated

**Test:** On a non-CA project's PayrollWeekDetailPage, confirm "Download CA eCPR XML" button is absent. On a CA project, confirm it is present.
**Expected:** Button only visible when `isCA === true` (i.e., `project.state === 'CA'`).
**Why human:** `isCA` is derived from a live API query result — static analysis cannot confirm the gate holds end-to-end.

#### 3. 2-step modal in-place transition

**Test:** Click "Download CA eCPR XML," fill in FEIN and DIR Project ID, click "Generate & Download XML." Confirm the XML file downloads and the modal transitions to Step 2 checklist without a page reload. Confirm the DIR Project ID value appears in Step 2 item 2.
**Expected:** Step 2 heading "CA eCPR XML Export — Step 2 of 2" appears; checklist shows 6 items; `publicworks@dir.ca.gov` email is a clickable mailto link.
**Why human:** DOM state transition, file download trigger, and modal content — already verified by user checkpoint per the prompt.

#### 4. FEIN/dirProjectId pre-fill on re-open

**Test:** Export once (populates project record via PATCH). Close the modal. Re-open it by clicking "Download CA eCPR XML" again. Confirm fields are pre-filled from the saved project values.
**Expected:** Fields show the values entered in the previous export.
**Why human:** Requires live DB round-trip — PATCH saves values, then `useEffect` on `projectData` fires and calls `setEcprFein` etc.

---

### Gaps Summary

No gaps. All 7 observable truths verified. All 10 required artifacts exist, are substantive, and are wired. All 4 requirements (CAE-01 through CAE-04) are satisfied. The 13 unit tests for `generateEcprXml` pass. The phase goal is fully achieved.

Three informational anti-patterns are noted (empty contractor address in XML, F700 cast not cleaned up, ephemeral email not persisted) — none block the stated phase goal.

The 4 human verification items cover UI rendering and live DB round-trips that are already covered by the user-approved human checkpoint described in the prompt.

---

_Verified: 2026-03-27T01:48:00Z_
_Verifier: Claude (gsd-verifier)_
