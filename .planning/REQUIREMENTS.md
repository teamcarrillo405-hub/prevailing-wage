# Requirements: v4.0 — Compliance Depth + Operations

**Milestone goal:** Deepen compliance coverage with NY and IL state-specific certified payroll submissions, richer worker profiles, three additional payroll import providers with ID-based worker mapping, a DOL-audit-ready activity log, and contractor email notifications for violations, due dates, team activity, and submissions.

**Research artifacts:** `.planning/research/state-forms-research.md`, `.planning/research/payroll-providers-research.md`, `.planning/research/audit-trail-research.md`

---

## Feature Area 1: Notifications (NOTIF)

Email notifications via nodemailer (already installed). Non-fatal — email failure falls back to console log per existing pattern.

- [ ] **NOTIF-01** — Compliance violation notification: when `computeCompliance()` detects a new violation on a payroll week, send an email to all project members (owner + member) listing the affected worker(s), violation type (under-wage / CWHSSA OT), and a link to the PayrollWeekDetailPage.
- [ ] **NOTIF-02** — Payroll due-soon reminder: a configurable threshold (default: 3 days before week-ending date) triggers an email to the project owner reminding them to submit the payroll week. Threshold stored per-project in a new `settings` JSON column on `projects` table.
- [ ] **NOTIF-03** — Team member activity notification: when a team member (non-owner) creates or modifies a payroll entry or worker record, send a summary email to the project owner (digest: one email per save action, not per row).
- [ ] **NOTIF-04** — Submission confirmation: when "Mark as Submitted" is toggled for CA DIR, WA L&I, NY MPWR, or IL IDOL, send a confirmation email to the acting user with the submission date, agency name, and project name.
- [ ] **NOTIF-05** — Notification preferences UI: per-project settings panel (gear icon on ProjectDetailPage) where the owner can enable/disable each notification type and set the due-soon threshold (1–7 days). Settings persisted in `projects.settings` JSON column.

---

## Feature Area 2: Additional State Forms (STATE)

### New York DOL (MPWR portal, Article 8)

**Research key finding:** As of January 1, 2026, NY mandates electronic XML submission via MPWR portal. PDF (PW-12) is for offline records only. OT threshold: 8 hours/day (not 40/week).

- [ ] **STATE-01** — NY project flag: add `state` enum value `"NY"` alongside existing `"CA"` and `"WA"` options in the projects form. NY projects show the NY-specific export and submission UI.
- [ ] **STATE-02** — NY PW-12 PDF generator: generate a NY-formatted PW-12 weekly payroll PDF using pdf-lib. Fields: contractor name/FEIN/address, week-ending date, project/contract number, per-employee rows (name + last4 SSN, withholdings, classification ST/OT, daily hours Mon–Sun, total hours, rate of pay, gross earned, FICA/withholding/other deductions, net wages). Statement of Compliance certification text with fringe benefit sub-clauses (b) and (c).
- [ ] **STATE-03** — NY MPWR XML generator: generate an XML file conforming to the NYSDOL MPWR Bulk Upload XSD schema. Required fields beyond WH-347: PRC Number (project identifier stored in `projects` table), NYS Contractor Registration Number, `nysRegisteredApprentice` boolean per worker, supplement type rates (Health/Welfare, Vacation/Holiday, Apprenticeship/Training, Pension, Other) with separate ST/OT hourly rates, `dateOfBirth` as alternative to SSN. Fall back to `000000+last4` placeholder for workers without full SSN on file (same pattern as CA eCPR).
- [ ] **STATE-04** — NY daily OT compliance: NY projects enforce an 8-hours/day overtime threshold in `computeCompliance()` instead of the federal 40-hours/week rule. Compliance engine detects daily OT violations and surfaces them in the PayrollWeekDetailPage violation badges.
- [ ] **STATE-05** — NY MPWR submission modal: 3-step modal on PayrollWeekDetailPage (NY-gated). Step 1: collect/persist PRC Number + NYS Contractor Registration Number with field hints. Step 2: generate and download XML + PW-12 PDF. Step 3: show MPWR portal upload checklist (portal URL, file format reminder, 30-day submission deadline). "Mark as Submitted to NY MPWR" button writes `agency_submissions` row.
- [ ] **STATE-06** — NY schema additions: add `nyprcNumber` (text), `nysContractorRegNumber` (text), and `projectSettings` JSON column to `projects` table. Add `nysRegisteredApprentice` boolean to `workers` table.

### Illinois DOL (IDOL portal, monthly filing)

**Research key finding:** IL requires non-prevailing wage hours per day alongside PW hours. OT threshold: 40 hours/week. Demographic fields required by 820 ILCS 130 (but nullable). Submission due monthly via IDOL portal (Excel import accepted).

- [ ] **STATE-07** — IL project flag: add `"IL"` to the `state` enum. IL projects show IL-specific export and submission UI.
- [ ] **STATE-08** — IL Certified Transcript of Payroll PDF generator: generate the two-page IL DOL Certified Transcript of Payroll using pdf-lib. Fields: contractor name/address/FEIN, project name/number/location/contracting agency, week-ending date, per-employee rows (name + last4 SSN, address, classification, daily hours Mon–Sun distinguishing PW vs non-PW, total PW + non-PW hours, base rate, fringe hourly rates for Pension/Health+Welfare/Vacation/Training each with "F" flag if jointly-managed LMRA fund, gross pay, deductions, net pay). Page 2 affidavit with subcontractor list and fund details fields.
- [ ] **STATE-09** — IL non-prevailing wage hours: add `nonPwHours` decimal column to `payroll_entries` table. PayrollWeekDetailPage entry form shows "Non-PW Hours" input for IL projects. IL PDF includes both PW and non-PW hour columns.
- [ ] **STATE-10** — IL demographic fields: add nullable columns to `workers` table: `race` (text), `ethnicity` (text), `gender` (text), `veteranStatus` (text), `skillLevel` (text: `"journeyman"` | `"apprentice"` | `null`). WorkersPage shows these fields in a collapsible "IL Compliance Demographics" section for IL projects only. All fields nullable (workers may decline).
- [ ] **STATE-11** — IL IDOL submission modal: 2-step modal on PayrollWeekDetailPage (IL-gated). Step 1: generate and download IL Certified Transcript of Payroll PDF. Step 2: show IDOL portal checklist (submission due by 15th of following month, portal URL, Excel template note). "Mark as Submitted to IL IDOL" button writes `agency_submissions` row.

---

## Feature Area 3: Additional Payroll Import Providers (IMPORT)

Extend the existing preview-then-commit pipeline (built in Phases 35–36) to support 3 new providers. Gusto uses name matching (like QB/ADP). Paychex and Sage use numeric worker IDs requiring a `payroll_provider_mappings` table and a one-time mapping UI step.

- [ ] **IMPORT-01** — Gusto CSV parser: detect Gusto Payroll Journal Report by presence of `Employee first name` + `Employee last name` columns. Concatenate to `"First Last"`. Parse `Regular hours` and `Overtime hours` as decimals. Parse `Payroll end date` as week-ending date (MM/DD/YYYY, manual parse to avoid timezone bugs). Error if required columns are missing. Map `Double overtime hours` to OT bucket if present.
- [ ] **IMPORT-02** — Paychex Flex CSV parser: detect Paychex format by presence of `Pay Component` and `Worker ID` columns. Aggregate rows per `Worker ID`: sum `Hours` where `Pay Component = "Regular"` → regular hours; sum where `Pay Component = "Overtime"` → OT hours. `Line Date` → week-ending date. No name in export — requires ID mapping.
- [ ] **IMPORT-03** — Sage 300 CRE parser: detect Sage format by column order `Employee, Date, Job, Extra, Cost Code, Category, Certified, PayID, Units`. Employee field is a numeric code. `PayID` (e.g., `REG`, `OT`, `DT`) maps to regular/OT/double-time buckets — classification step required. Also support Sage 100 Contractor Check Register format (named columns including employee name). No ID mapping needed for Sage 100 Check Register.
- [ ] **IMPORT-04** — Provider mappings table: create `payroll_provider_mappings` table: `(id, projectId, provider, providerWorkerId, workerId, createdAt)`. Stores the user-confirmed link between a provider's worker ID and our internal worker. Mappings persist across imports — once mapped, auto-match on subsequent imports.
- [ ] **IMPORT-05** — ID mapping step in import modal: for Paychex and Sage 300 CRE imports, add a "Map Employees" step (Step 2b) between preview parse and the existing preview table. Shows a table of `providerWorkerId` → dropdown of existing workers (or "Skip"). Confirmed mappings are written to `payroll_provider_mappings`. Rows with no mapping are treated as unmatched (same skip behavior as unmatched names in QB/ADP flow).
- [ ] **IMPORT-06** — Provider detection in import modal: auto-detect provider type from CSV column signatures during preview parse. Show a provider badge (Gusto/Paychex/Sage/QB/ADP) in Step 2 header. For Paychex/Sage 300, insert the ID mapping step. For Gusto, proceed directly to the existing matched/unmatched table.

---

## Feature Area 4: Audit Trail (AUDIT)

DOL-audit-ready append-only activity log. Retention: 3 years federal minimum (6 years for NY projects, 5 years for IL — enforced by display, not auto-delete).

- [x] **AUDIT-01** — `audit_logs` table: columns: `id` (UUIDv4), `createdAt` (ISO 8601 UTC), `userId` (FK → users, nullable), `userEmail` (denormalized snapshot), `ipAddress`, `projectId` (FK → projects, onDelete: 'set null'), `entityType`, `entityId`, `action`, `diff` (JSON text: before/after for updates), `snapshot` (JSON text: full state for creates/deletes), `meta` (JSON text: free-form context). Three indexes: `(project_id, created_at DESC)`, `(entity_type, entity_id, created_at DESC)`, `(user_id, created_at DESC)`.
- [x] **AUDIT-02** — `auditService.ts`: exports only `insertAuditLog()` — no update or delete functions. Hybrid payload strategy: full snapshot on create/delete, field-level diff on update, meta-only on export/submission events. Always redact `ssnEncrypted` → `"[REDACTED]"` before writing diff. Called from service layer (workerService, payrollEntryService), not route handlers.
- [x] **AUDIT-03** — Tier-1 logged actions: `worker.created`, `worker.updated`, `worker.deleted`, `payroll_entry.created`, `payroll_entry.updated`, `payroll_entry.deleted`, `payroll_week.submitted`, `payroll_week.unsubmitted`, `wh347.downloaded`, `ecpr_xml.downloaded`, `wa_pwia_xml.downloaded`, `ny_mpwr_xml.downloaded`, `il_pdf.downloaded`, `payroll_import.committed`, `agency_submission.created`.
- [x] **AUDIT-04** — Project activity feed: GET `/api/audit/:projectId` returns paginated audit log (25 rows/page, offset pagination, optional `entityType` filter). Response includes actor name, action label (human-readable), entity description, timestamp.
- [x] **AUDIT-05** — Activity log UI: `ProjectActivityPage` (route: `/projects/:id/activity`) showing a reverse-chronological timeline of project events. Each row: timestamp, actor email, human-readable action description (e.g., "Updated worker Maria Garcia — classification changed from Laborer to Carpenter"), affected entity link. Date-range filter. Link from ProjectDetailPage nav.

---

## Feature Area 5: Worker Profile Depth (WORKER)

- [ ] **WORKER-01** — Structured address: replace the `address` text field on `workers` with separate columns: `addressStreet`, `addressCity`, `addressState`, `addressZip`. WorkersPage form shows 4 address inputs. WH-347 PDF concatenates them for the address column. Migration backfills existing `address` value into `addressStreet`.
- [ ] **WORKER-02** — Union local + book number: add `unionLocal` (text) and `unionBookNumber` (text) columns to `workers`. WorkersPage shows these fields in a "Union Information" section (optional for non-union workers). Shown on worker detail view.
- [ ] **WORKER-03** — Apprenticeship details: add `apprenticeshipCommittee` (text) and `apprenticeshipRegNumber` (text) columns to `workers`. WorkersPage shows in "Apprenticeship" section (shown only when `laborType = "apprentice"`). Populated values display in WH-347 apprentice rows.
- [ ] **WORKER-04** — Multiple trade classifications per payroll week: allow a worker to have different classifications in different payroll weeks. Currently, `workers.classifications` is a static array. Add a `payroll_week_classifications` table: `(id, payrollWeekId, workerId, classificationId, hours)` for weeks where the worker's active classification differs from their default. PayrollWeekDetailPage entry form shows a "Change Classification for This Week" override dropdown per worker row. WH-347 uses the week-specific classification if set, otherwise falls back to the worker's default.

---

## Non-Functional Requirements

- [x] **NFR-01** — All new Drizzle migrations use `-->  statement-breakpoint` (one space) separator between SQL statements.
- [ ] **NFR-02** — All new email triggers are non-fatal: log to console on failure, do not 500 the request.
- [x] **NFR-03** — All new routes apply `assertProjectAccess` before any data access.
- [x] **NFR-04** — Audit log `ssnEncrypted` field is always redacted before write; `hasFullSsn` boolean carries SSN-present signal in place of encrypted value.
- [x] **NFR-05** — All new migration files have a corresponding Drizzle schema update in `src/server/db/schema.ts`.

---

## Out of Scope (v4.0)

- TX prevailing wage forms (TX is narrowly scoped to state-funded projects only; deferred pending further research)
- NY MPWR `workCategory` dropdown value resolution (MPWR portal requires exact classification name match; deferred until official value list is obtained)
- Audit log export (CSV/PDF export of logs for DOL investigators; deferred to v4.1+)
- CA/WA state-specific audit retention enforcement (federal 3-year minimum applied; CA Labor Code §1776 / WAC 296-127 review deferred)
- SSN audit log exposure (ssnEncrypted is always redacted in audit trail payloads)
- Inline worker creation in payroll import (workers must be created on WorkersPage first; import maps to existing workers only — D-10)
