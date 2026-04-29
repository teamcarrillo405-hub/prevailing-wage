# Phase 30: WA PWIA Submission Assist — Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Contractors on Washington projects can:
1. **WAL-03** — Generate and download a WA L&I CPR XML file, gated on (a) the contractor providing their PWIA intentId and (b) all workers having a non-null WA trade code. XML generation blocked until both conditions are met.
2. **WAL-04** — View a pre-populated submission summary panel on `PayrollWeekDetailPage` with two labeled sections (Intent to Pay + Affidavit of Wages Paid) showing all data needed for manual PWIA portal entry.

This phase does NOT include: direct PWIA portal submission, file generation for Intent to Pay or Affidavit PDFs (portal-only submission, no fillable PDF), any CA-specific changes, or full SSN storage.

</domain>

<decisions>
## Implementation Decisions

### PWIA intentId — Persistence (WAL-03)

- **D-01:** Add a new nullable `text` column `pwia_intent_id` to the `projects` table via SQL migration. Collected in the pre-generation modal; persists to the project record on first export; pre-fills on all subsequent WA CPR XML exports for this project. Same pattern as CA's `dir_project_id`.
- **D-02:** SQL-only migration, manually registered in `src/server/db/migrations/meta/_journal.json` per project convention.

### Trade Code Gate (WAL-03)

- **D-03:** Before the pre-generation modal opens, perform a server-side and client-side gate check: if any worker on the payroll week has `wa_trade_code IS NULL`, block XML generation entirely.
- **D-04:** The gate surfaces as a blocking screen (not a modal) listing each affected worker by name with a direct link to edit their worker classification. No way to bypass — generation is impossible until all NULL codes are resolved.
- **D-05:** A non-null `wa_trade_code` value passes the gate regardless of whether it appears in the `WA_TRADE_CODES` map. Null-only check avoids blocking valid custom trade codes not yet in the local dictionary.

### WA CPR XML Generator (WAL-03)

- **D-06:** Create `src/server/services/waCprXmlGenerator.ts` — pure function, no I/O, xmlbuilder2-based, same pattern as Phase 29's `ecprXmlGenerator.ts`. Researcher must determine the exact WA L&I PWIA CPR XML schema/format required by the My L&I portal (no XSD URL known at discuss time).
- **D-07:** Add `GET /api/export/wa-cpr-xml/:weekId` to `export.ts` following the established 8-step pattern. State gate: `project.state !== 'WA'` → 400. Requires intentId from project record (not query param — already persisted from modal).
- **D-08:** Amendment handling: researcher to confirm whether WA L&I CPR XML requires an amendment marker analogous to CA's `<CPR:amendmentNum>`. If confirmed, follow same pattern (always emitted, empty for non-amendments).
- **D-09:** Reuse `getPayrollEntriesWithWorkerDetails()` from Phase 29 — already includes `wa_trade_code`, `ssn_last4`, daily hours, rates. No new service function needed for data access.

### Pre-Generation Modal (WAL-03)

- **D-10:** Pre-generation modal collects `pwiaIntentId` (labeled clearly as "PWIA Intent ID — issued by L&I after Statement of Intent approval"). If already stored on the project, pre-fills. User can edit before generating.
- **D-11:** The existing WA PWIA disclosure modal in `PayrollWeekDetailPage.tsx` (~line 283, ~line 718) should be extended or refactored — not duplicated. The new WA CPR XML download button/flow replaces or augments the existing "Download WA F700" PWIA disclosure flow.

### WAL-04 — Submission Summary Panel

- **D-12:** The panel lives on `PayrollWeekDetailPage.tsx`, displayed below (or alongside) the WA CPR XML download button — no new route or page.
- **D-13:** Panel has two clearly labeled subsections:
  - **Intent to Pay** — shows per-classification: WA trade code, job classification description, estimated/actual hours, prevailing wage base rate, fringe rate. Project-level data (contractor UBI, L&I cert, WC account already on `projects`).
  - **Affidavit of Wages Paid** — shows per-worker: worker name, WA trade code, ST hours by day (M–Su), OT hours by day, total ST hours, total OT hours, base rate, fringe rate, gross pay.
- **D-14:** Panel is explicitly labeled as a "data-entry guide for PWIA portal" — not a submission mechanism. No HTTP calls to PWIA portal domains from the app backend.
- **D-15:** The panel is WA-gated (only rendered for WA projects). It does not require intentId to be present — it is display-only and always shows whatever data the project/payroll entries contain.

### Claude's Discretion

- Exact filename convention for WA CPR XML download (researcher to confirm or follow same pattern as CA: `[field]_[weekEnding].xml`)
- Whether to show step indicators (Step 1: Gate check / Step 2: Configure / Step 3: Panel) in the UI flow
- Error message wording for the trade code gate screen
- Whether the WAL-04 Intent to Pay section shows estimated or actual hours (use actual payroll hours since this is post-entry)
- Panel styling: whether to use a Card component consistent with existing app primitives

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DB Schema
- `src/server/db/schema.ts` — add `pwia_intent_id` nullable text to `projects`; existing `ubi_number`, `lni_certificate`, `wc_account` are already there from Phase 25
- `src/server/db/migrations/meta/_journal.json` — manual migration registration required

### Server
- `src/server/routes/export.ts` — add new `GET /api/export/wa-cpr-xml/:weekId` handler; follow established 8-step pattern from WH-347, A-1-131, F700, and CA eCPR handlers
- `src/server/services/payrollService.ts` — `getPayrollEntriesWithWorkerDetails()` already built in Phase 29; reuse as-is
- `src/server/services/waCprXmlGenerator.ts` — NEW pure function; researcher must confirm WA L&I CPR XML schema
- `src/server/services/ecprXmlGenerator.ts` — reference for xmlbuilder2 pure function pattern
- `src/server/services/f700Generator.ts` — reference for WA trade code handling (`WA_TRADE_CODES` map, `waTradeCode` field)

### Client
- `src/client/pages/PayrollWeekDetailPage.tsx` — add WA CPR XML download button + trade code gate screen + intentId modal + WAL-04 summary panel; existing PWIA disclosure modal at ~line 718 should be extended/refactored
- `src/client/pages/WorkerClassificationPage.tsx` (or equivalent) — trade code gate links must point to the correct edit page for each affected worker

### Requirements
- `.planning/REQUIREMENTS.md` §WAL-03, WAL-04

### WA L&I Reference (researcher must verify)
- WA L&I PWIA portal: `https://secure.lni.wa.gov/wagelookup/` — researcher to find CPR XML schema/format requirements for My L&I PWIA portal upload
- `src/server/services/f700Generator.ts` — existing `WA_TRADE_CODES` map and `F700Data` shape define WA-specific field names already in use

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getPayrollEntriesWithWorkerDetails()` (payrollService.ts) — Phase 29 extended join; includes `wa_trade_code`, `ssn_last4`, address, daily hours, rates. Ready to use without modification.
- `xmlbuilder2@4.0.3` — already installed in Phase 29. No new dependency needed.
- `WA_TRADE_CODES` map (f700Generator.ts) — 4-letter WA L&I codes; referenced for context, not for gate logic (gate uses NULL check only).
- PWIA disclosure modal (PayrollWeekDetailPage.tsx:718) — existing WA modal to extend/refactor.
- 8-step export route pattern (`export.ts`) — CA eCPR handler is the most recent reference; WA CPR slots in as the 5th handler.
- `ubiNumber`, `lniCertificate`, `wcAccount` on `projects` — already available for WAL-04 Intent to Pay section.

### Established Patterns
- State gate: `if (project.state !== 'WA') return res.status(400).json({ error: '...' })` — consistent with CA gate.
- Nullable text columns on `projects` for portal-specific fields — Phase 24 (CA) and Phase 25 (WA) both follow this pattern; Phase 30 adds `pwia_intent_id`.
- Pre-generation modal flow: collect fields → persist to project → generate → confirm/checklist — Phase 29 pattern applies.

### Integration Points
- `PayrollWeekDetailPage.tsx` — all WA-specific UI (gate screen, modal, XML button, WAL-04 panel) goes here
- `export.ts` — new route registers before `/:weekId` wildcard (Route ordering constraint from PROJECT.md)
- `projects` table — `pwia_intent_id` is the only new DB column for this phase

### Critical Pitfalls
- PWIA intentId format: researcher to confirm expected format (numeric? alphanumeric? length?). Display as-is from portal; no formatting normalization needed.
- `(row as any).waTradeCode` cast hack in F700 handler was resolved in Phase 29 by `getPayrollEntriesWithWorkerDetails()` — confirm the new function's return type properly types `waTradeCode` before building the WA XML mapper.
- WA L&I PWIA XML schema is UNKNOWN at discuss time — researcher must find the schema specification. If no public XSD exists, researcher should find a sample XML from the PWIA portal documentation.

</code_context>

<specifics>
## Specific Implementation Details

- New DB column: `pwia_intent_id` nullable text on `projects` — follows same pattern as `dir_project_id` (CA Phase 29)
- Trade code gate: NULL check only on `wa_trade_code`; gate fires before modal, shows affected worker names with edit links; hard block
- WA CPR XML: `waCprXmlGenerator.ts` pure function using xmlbuilder2; schema format TBD by researcher
- Route: `GET /api/export/wa-cpr-xml/:weekId` — WA-gated; intentId read from project record
- WAL-04 panel: on `PayrollWeekDetailPage`, two sections (Intent to Pay + Affidavit), per-worker with daily hours breakdown; display-only, no submission
- Reuses `getPayrollEntriesWithWorkerDetails()` from Phase 29 — no new service function

</specifics>

<deferred>
## Deferred Ideas

- Direct PWIA portal submission — no confirmed public API; portal upload only
- WA Affidavit of Wages Paid as a generated PDF — portal-only submission; no fillable PDF exists
- WA Intent to Pay as a generated PDF — same reason
- Full SSN storage for WA XML — deferred to v3+ (same as CA)
- Amendment marker in WA CPR XML — deferred to researcher to confirm; Claude has discretion to implement if WA portal requires it

</deferred>

---

*Phase: 30-wa-pwia-submission-assist*
*Context gathered: 2026-03-27*
