# Feature Landscape: ERP Integrations for Prevailing Wage Compliance

**Domain:** Bidirectional construction ERP integration (Procore, Sage 300 CRE, Viewpoint Vista) for prevailing wage compliance
**Researched:** 2026-05-11
**Milestone:** v9.0 — Construction ERP Integrations
**Downstream consumer:** Requirements writer scoping Phases 126-134

---

## API Reality: What Each ERP Actually Exposes

This section is the foundation for all feature decisions. Build only against what the APIs actually provide.

### Procore

**Authentication:** OAuth 2.0. Two grant types: Authorization Code (user-facing) and Client Credentials (machine-to-machine). Base URL: `https://api.procore.com/rest/v1.0`. No SCIM endpoint — all lifecycle management is raw REST. Permission model is tool-based, not scope strings: the app must be granted Admin on the Company Timecard tool to create/update timecard entries. Webhooks API is available and supports Create/Update/Delete event subscriptions on most resources including timecards.

**Workers / Employees (Directory):**
- `GET/POST /companies/{company_id}/users` — list, create company-level users
- `GET/PATCH /companies/{company_id}/users/{id}` — read, update individual user
- `GET /projects/{project_id}/users` — list project members; separate call from company-level creation
- Core fields: `id`, `login` (email), `first_name`, `last_name`, `job_title`, `business_phone`, `mobile_phone`, `is_active`, `is_employee` (boolean), `permission_template_id`, `created_at`, `updated_at`
- Gap: No native SSN field, no union affiliation field, no apprentice status flag in the core user record. Trade classification is a separate entity.
- Classifications (trade/craft codes): Managed via Company Admin tool as a distinct entity. Fields: name (e.g., "Electrician", "Bricklayer"), `class_code` (wage/craft code that maps to payroll system). Classification is only surfaced on timesheets when the Timesheets tool is enabled at the project level.

**Timecards / Timesheets:**
- Two distinct tools exist in Procore: the older Timecard (project-level, Daily Log) and the newer Timesheets (company-level). Both are API-accessible.
- `POST /projects/{project_id}/timecard_entries` — create timecard entry
- Timecard entry fields: `cost_code_id`, `line_item_type_id` (must be labor base type), `hours` (total hours mode) OR `time_in`/`time_out`/`lunch_time` (start/stop mode), employee reference, date, notes
- Classification field (`classification_id`) available on timesheets when Timesheets tool is project-enabled
- Gap: No raw hourly pay rate, no fringe benefit amount, no prevailing wage rate on the timecard record itself. Procore does not store wage rates on time entries.
- Gap: Regular vs. overtime hour distinction depends on entry configuration. Procore does not natively compute CWHSSA OT — it records hours against cost codes.
- Webhooks available for timecard create/update events — enables event-driven sync rather than polling.

**Custom Fields (Compliance Push Path):**
- Custom fields are supported on: Timesheets, T&M Tickets, Observations, Inspections, RFIs, Punch List, Submittals, Change Events, Daily Log, and more.
- API respects custom fields created in the web application — GET/PATCH on the parent resource includes custom field values.
- Supported field types include text, number, date, dropdown — sufficient for pushing compliance status string or violation count.
- Viable push path for WH-347 status: Create a custom text field on Timesheets or Daily Log at the company level, then PATCH the timesheet record with compliance status and violation summary via API.
- Viable push path for violations: Observations tool supports custom fields and has its own Create endpoint (`POST /projects/{project_id}/observations`) — a compliance violation can be created as an Observation record linked to the relevant project, surfacing inside Procore's issue tracking workflow.

**Projects:**
- `GET /projects` (company scope) — lists all projects with `id`, `name`, `status`, `address`, `start_date`, `completion_date`, `project_number`, `stage`
- No federal contract number or wage determination ID field natively. These would need custom fields or be stored externally.

**Confidence:** MEDIUM — Procore's developer documentation is actively maintained. Findings above are from verified tutorial pages, the Stitchflow user management API guide (confirmed OAuth and endpoint list), Procore's own Sage 300 CRE export documentation (confirms field names), and classification documentation. Exact JSON schemas require sandbox API access.

---

### Sage 300 CRE

**Architecture reality:** Sage 300 CRE is an on-premise Windows application. The "Sage 300 CRE Web API" is a server-side component that must be installed in the customer's environment — it is not a cloud SaaS API. Authentication uses Windows authentication or forms-based custom auth. The API includes Swagger/OpenAPI documentation accessible post-installation.

**On-premise integration paths (two options):**
1. Customer installs Sage 300 CRE Web API on their Windows server; integration connects over their local network or VPN-exposed endpoint.
2. Connector agent approach (e.g., Agave Connector): install a small Windows app on the customer's machine that maintains an outbound tunnel to the integration service, eliminating the need to expose Sage 300 directly to the internet. The connector must remain running continuously.

**Employee data:**
- CP Employee API and UP Employee API exist (payroll and HR employee data). Standard fields via Agave unified model: Read and Write on an `/employees` endpoint.
- Known field sync: employee ID, name, trade/certified class, department, union code, job-extra assignments.
- Sage 300 CRE natively handles union wages, certified payroll, multi-state tracking, direct deposit — these are first-class data in the system.

**Timesheet / Payroll:**
- Timecard entries (daily payroll) available via the Web API — Agave maps these to a `timecard_entries` endpoint with Read and Write.
- Procore's own Sage 300 CRE payroll export confirms the field names that exist in the Sage data model: Employee ID, Classification (certified or union class), Pay ID, Time Type, Job, JC Extra (Sub Job), JC Cost Code.
- Sage 300 payroll model includes: job cost assignments, cost codes, certified class, union codes, earnings codes, deduction codes.

**Compliance push:**
- No native compliance violation concept in Sage 300 CRE. Most viable path is custom fields on employee or job records, or notes fields if exposed via the installed Web API version. Needs testing against actual installed version.
- Reliable fallback push pattern: generate a compliance summary report and place it in a shared folder or custom Sage 300 CRE report location.

**Key limitation:** Because Sage 300 CRE requires on-premise installation, a file-based adapter (CSV import/export using Sage's native import formats) is a valid and lower-risk path for contractors who have not installed or cannot expose the Web API. This is the rationale for Phase 130 including both a cloud REST adapter and an on-premise file-based adapter.

**Confidence:** MEDIUM — confirmed via Agave API integration documentation, Procore's Sage 300 CRE export documentation, and Sage community forum disclosures. Specific Web API endpoint schemas require access to a live Sage 300 CRE installation with Web API module enabled.

---

### Viewpoint Vista (Trimble)

**Architecture reality:** Vista is sold as Trimble Construction One (cloud-hosted). The Vista REST API is available only to cloud-hosted Vista customers who purchase App Xchange API access. On-premise Vista customers do NOT get the REST API — they must use ODBC (direct SQL database, requires VPN) or file-based CSV templates via Vista's native import screens.

**Authentication:** App Xchange API uses OAuth 2.0 or API key via the `xchange.trimble.com` gateway. Developer documentation is at `direct-api.xchange.trimble.com`.

**Employee / HR data (cloud REST):**
- Vista HR module (PR_Employee records) stores: employee ID, name, craft code, class code, shift, earnings codes, union affiliation, apprentice level (levels 1-9), prevailing wage flags, certified payroll flag.
- App Xchange connectors include "Vista (Human Resources) Connector OpenAPI" and "Vista (Payroll) Connector OpenAPI" — confirming REST endpoints exist for both domains.
- PR_Employee record fields relevant to prevailing wage: Craft, Class (apprentice levels 1 through 9), certified payroll flag, union code, prevailing wage job assignment.

**Timesheet / Timecard data (cloud REST):**
- PR Timecard Entry captures: Employee, JC Company, Job, Craft, Class, Shift, Earnings Code, hours, certified flag, job cost distribution.
- Vista has an explicit "Include on Certified Reports" checkbox per timecard line — timecards are already certified-payroll-aware at the data level.
- Third-party time tracking tools (hh2, SmartBarrel, ExakTime) integrate directly with Vista's App Xchange API, confirming the timecard write path works in production.

**Compliance / Certified Payroll data in Vista:**
- Vista natively generates certified payroll reports from its own PR data. Trimble has a partnership with LCPtracker for certified payroll submission.
- Fringe benefit types are classified per earnings code and liability — all first-class data.
- No native compliance status field that would accept a push from an external compliance app. Most viable path: write to a custom field on the PR_Job or HR_Employee record, or create a Vista note record if the App Xchange API supports notes creation.

**On-premise Vista path:**
- ODBC direct database access (requires VPN to customer environment) — gives full read/write to all Vista SQL tables including PR_Employee, PR_TimeCard, etc.
- CSV template imports via Vista's standard import screens.
- No REST API available for on-premise.

**Confidence:** MEDIUM — confirmed via Trimble App Xchange marketplace listing, Trimble help documentation for PR Timecard Entry fields, Vista certified payroll report documentation, and HCM TradeSeal integration disclosures. Exact App Xchange endpoint schemas require API access purchase.

---

## Table Stakes Features

Features contractors expect from a "connected" prevailing wage tool. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Pull workers from Procore into app | Eliminates re-keying worker profiles; Procore is authoritative on who works the job | Medium | Procore OAuth, worker profile schema match |
| Pull timesheets/hours from Procore daily | Time data lives in Procore; certified payroll must reflect actual field time | Medium | Procore timecard API, date-range query |
| Pull workers from Sage 300 CRE | Sage holds the payroll record of truth; worker IDs must match for compliance audit trail | Medium-High | Sage 300 CRE adapter (cloud REST or file-based) |
| Pull timesheets from Sage 300 CRE | Sage is the payroll system of record; time data should flow forward, not be re-entered | Medium-High | Sage CP payroll module, timecard entries endpoint |
| Pull workers from Viewpoint Vista | Vista HR is authoritative for Vista shops; craft/class data is defined there | High | Vista App Xchange API or ODBC adapter |
| Pull timesheets from Viewpoint Vista | PR Timecard is Vista's authoritative time record; already has certified payroll flags | High | Vista App Xchange API, PR_TimeCard access |
| Connection status UI (connect/disconnect) | Contractors need to know if the link is live; silent broken connections cause compliance gaps | Low | Credential vault, health check per ERP |
| Credential storage (encrypted at rest) | API keys and OAuth tokens cannot be plaintext; SOC 2 expectation | Low | Extend existing AES-256-GCM encryption pattern |
| Sync history log | Auditors and contractors ask "when did data last sync?" — must be answerable | Low | Sync log table, per-connection last-sync timestamp |
| Manual sync trigger | "Sync now" button before payroll run is expected; nightly-only is insufficient | Low | Queue/trigger mechanism |
| Field mapping UI (ERP field to app field) | ERP trade codes never perfectly match app classification names; mapping is always required | Medium | Field mapping config table, per-ERP mapping rules |
| Worker deduplication / conflict detection | Same person across two ERPs or re-imported must not create duplicates | Medium | Worker identity resolution (app's existing name + ssnLast4 pattern) |

---

## Differentiators

Features that set this product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| Push WH-347 submission status back to Procore | Procore becomes single source of truth for project status; compliance closes the loop without leaving Procore | Medium | Procore custom fields API on Timesheets or Daily Log |
| Push compliance violations back to Procore as Observations | Violations surface inside Procore's native issue tracking workflow — no context switch to separate tool | Medium | Procore Observations API, violation-to-observation schema mapping |
| Procore as authoritative source on worker classification | Solves "who owns the classification" conflict explicitly; eliminates re-classification disputes | Low-Medium | Conflict resolution rule in sync engine; surfaced in field mapping UI |
| Nightly automatic sync with configurable schedule | Reduces manual effort; acceptable for most certified payroll workflows | Low | Cron/scheduler, per-connection sync config table |
| Webhooks-driven sync for Procore (event-based) | Procore webhooks fire on timecard create/update — data arrives in seconds, not overnight | Medium-High | Procore webhooks subscription, inbound webhook endpoint on app server |
| Sage 300 CRE file-based adapter | Reaches contractors who cannot expose on-premise Sage to internet; zero server requirement | Medium | CSV template matching Sage native import format |
| Vista ODBC adapter fallback | Reaches on-premise Vista customers who have no App Xchange API access | High | VPN-tolerant ODBC connection, Vista SQL schema |
| Sync conflict audit trail | Every conflict and resolution decision logged with source, field, before/after values | Low | Extends existing activity_log table pattern |
| Per-project ERP connection override | Large GCs use Procore for project A, Sage for project B — per-project ERP assignment | Medium | Connection-to-project join table |

---

## Anti-Features

Features to explicitly not build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time sub-second sync | Impossible for on-premise Sage/Vista; unnecessary for weekly certified payroll cycle | Nightly + manual trigger + webhooks-on-demand for Procore |
| Writing payroll values back to ERP (wages, rates, net pay) | App is downstream of payroll processing; writing calculated wages back risks double-processing and regulatory liability | Push compliance status flags and violation summaries only |
| Creating new workers in ERP from the app | App is the consumer of ERP worker data, not the source; inverting data ownership creates conflicts and audit exposure | Pull only for workers; manual worker creation remains available in the compliance app |
| Replacing existing CSV import pipeline | Contractors without ERP connections still need CSV import (QB, ADP, Gusto, Paychex) | ERP connectors are additive; CSV import is not deprecated |
| Supporting Procore on-premise | Procore is cloud-only SaaS; no on-premise version exists | OAuth cloud flow is the only path |
| Generic ERP adapter (arbitrary ERP support) | 10x scope for 10% adoption; three named ERPs cover the majority of mid-market GC market share | Build named adapters only; generic adapter is a future milestone |
| Full payroll processing via ERP integration | Certified payroll compliance and payroll tax processing are separate domains | App outputs WH-347 and violation status; payroll processing stays in the ERP |
| Worker SSN sync from ERP | Full SSNs in Procore/Sage/Vista are payroll-sensitive PHI; pulling them adds PHI exposure surface | Use ERP employee ID as the sync key; app's SSN capture remains via worker onboarding flow |
| Replacing Sage or Vista as payroll system of record | These ERPs own payroll tax, direct deposit, GL — compliance app has no business touching that | App is read-only on payroll data; write-only on compliance status |

---

## Feature Dependencies (v9.0 on Existing App)

```
Existing infrastructure (already shipped):
  - Worker profiles (trade classification, SSN last 4, apprentice/journeyworker status)
  - Payroll entry schema (ST/OT hours, fringe, base rate snapshot)
  - Compliance engine (under-wage, CWHSSA OT, apprentice ratio violations)
  - WH-347 export (PDF, XML)
  - AES-256-GCM encrypted credential storage (SSN encryption pattern)
  - Audit trail (activity_log table)
  - CSV import pipeline (QuickBooks, ADP, Gusto, Paychex, Sage file-based)

Phase 126 (Foundation) must land before any sync work:
  - connection_configs table (ERP type, encrypted credentials, last_sync_at, status)
  - IntegrationsPage UI (connect/disconnect/status per ERP)
  - Credential vault (encrypt/decrypt API keys, OAuth tokens at rest using existing AES-GCM pattern)
  - Sync log table (per-connection sync events with row counts and error summaries)

Phase 127 (Procore OAuth + workers) requires Phase 126
Phase 128 (Procore timesheet pull) requires Phase 127 — workers must exist to attach time records
Phase 129 (Procore compliance push) requires Phase 128 + compliance engine output
Phase 130 (Sage 300 CRE adapter) requires Phase 126 — independent of Procore phases
Phase 131 (Sage payroll sync + push) requires Phase 130
Phase 132 (Vista adapter) requires Phase 126 — independent of Procore and Sage phases
Phase 133 (Vista timesheet + push) requires Phase 132
Phase 134 (Integration Dashboard) requires Phases 127-133 — needs data to display
```

---

## MVP Recommendation for v9.0

**Build in v9.0:**
1. Phase 126 — Foundation (connection management, credential vault) — prerequisite for everything else.
2. Phase 127 — Procore OAuth + worker/employee pull — highest-penetration ERP among GCs; OAuth is well-documented; worker sync is lower risk than timesheet sync.
3. Phase 128 — Procore timesheet pull — primary value driver; eliminating duplicate time entry is the top contractor complaint about certified payroll workflows.
4. Phase 129 — Procore compliance push — closes the loop; makes integration bidirectional. Custom fields on Timesheets or Observations are the confirmed viable push mechanism.
5. Phase 130 — Sage 300 CRE adapter — second-highest market penetration. File-based adapter (CSV) should ship alongside cloud REST adapter to cover on-premise shops.
6. Phase 131 — Sage payroll sync + compliance push.
7. Phase 132 — Vista adapter (cloud REST via App Xchange).
8. Phase 133 — Vista timesheet + compliance push.
9. Phase 134 — Integration Dashboard — required for contractors to self-diagnose sync issues; also surfaces sync history for auditors.

**Defer to v10.0:**
- Vista ODBC fallback (on-premise): High complexity, narrow market. Only needed for on-premise Vista customers without App Xchange.
- Webhooks-driven sync for Procore: Nightly + manual trigger ships first; webhooks are a v10 upgrade path.
- Per-project ERP connection override: Single company-level ERP connection covers the vast majority of contractors in v9.0.
- Generic ERP adapter: Out of scope entirely.

---

## Complexity Reference

| Label | Meaning |
|-------|---------|
| Low | Under 1 day; straightforward CRUD or config table addition |
| Medium | 1-3 days; involves OAuth flow OR schema mapping OR new UI page |
| Medium-High | 3-5 days; involves external API discovery + mapping + error handling |
| High | 5+ days; involves on-premise infrastructure, VPN, or novel protocol |

---

## Sources

- Procore Developer Documentation: https://developers.procore.com/documentation/introduction
- Procore Timecard Entries Tutorial: https://developers.procore.com/documentation/tutorial-timecard-entries
- Procore Timesheets API Reference: https://developers.procore.com/reference/rest/timesheets
- Procore User Management API (Stitchflow): https://www.stitchflow.com/user-management/procore/api
- Procore Custom Fields FAQ: https://support.procore.com/faq/what-are-custom-fields-and-which-procore-tools-support-them
- Procore Classification documentation: https://support.procore.com/products/online/user-guide/company-level/admin/tutorials/add-a-classification
- Procore Timesheets to Sage 300 CRE Export: https://support.procore.com/products/online/user-guide/company-level/timesheets/tutorials/set-up-your-payroll-export-for-use-with-sage-300-cre
- Procore Webhooks API: https://developers.procore.com/documentation/webhooks-api
- Sage 300 CRE via Agave API: https://useagave.com/integrations/sage-300-cre
- Sage 300 CRE Agave Authentication: https://docs.agaveapi.com/source-systems/sage-300-cre
- Sage 300 Integration Guide (Rhumbix): https://www.rhumbix.com/blog/sage-300-integration-guide-field-data-construction-erp
- Sage Community Forum on On-Premise API: https://communityhub.sage.com/us/sage300/f/general-discussion/171117/sage-300-on-premise-integration-api
- Vista API Documentation Resources: https://help.trimble.com/en/vista/vista/vista-api-documentation/vista-api-documentation-resources
- Vista App Xchange Connectors: https://appxchange.trimble.com/connectors/viewpoint-vista
- Vista Cloud FAQ (APIs): https://sites.google.com/trimble.com/vista-cloud-faq/home/integration-technology/vista-apis
- Vista Certified Payroll Report Fields: https://help.trimble.com/en/vista/vista/hr-and-payroll/payroll/payroll-processing/payroll/generating-certified-payroll-reports
- HCM TradeSeal Prevailing Wage Software Guide: https://hcmtradeseal.com/what-to-look-for-in-a-prevailing-wage-software-and-how-hcm-tradeseal-can-help/
- HCM TradeSeal Viewpoint Vista Integration: https://hcmtradeseal.com/erp-systems/viewpoint-certified-payroll-integration/
