# Requirements — v9.0 Construction ERP Integrations

**Milestone:** v9.0 Construction ERP Integrations
**Last updated:** 2026-05-11
**Status:** Draft

---

## Integration Foundation

- [ ] **INTG-01**: User can view an IntegrationsPage showing available ERP connections (Procore, Sage 300 CRE, Viewpoint Vista) with connect/disconnect controls and sync status
- [x] **INTG-02**: System stores ERP connection state, encrypted credentials, and sync metadata in `integration_connections` table
- [x] **INTG-03**: System enables SQLite WAL mode and `busy_timeout=5000` at startup so payroll entry is never blocked by a running sync job
- [ ] **INTG-04**: System defines an `IErpAdapter` TypeScript interface that all three ERP adapters implement (pull workers, pull timesheets, push compliance status)
- [ ] **INTG-05**: System stores OAuth tokens and API keys encrypted at rest using the existing AES-256-GCM vault pattern
- [ ] **INTG-06**: System runs a nightly ERP sync automatically (node-cron, sequential per connection, no additional infrastructure)
- [ ] **INTG-07**: User can trigger a manual sync for any connected ERP from the IntegrationsPage

## Procore Integration

- [ ] **PRO-01**: User can connect their Procore account via OAuth2 PKCE flow; OAuth state nonce uses `crypto.randomBytes` (not `Math.random`)
- [ ] **PRO-02**: System pulls employees from Procore and creates or updates workers in the app; Procore `employee_id` stored as `erp_external_id` for idempotent upserts
- [ ] **PRO-03**: System pulls daily timesheets from Procore and upserts payroll hour entries with timezone-aware date handling
- [ ] **PRO-04**: System pushes WH-347 submission status back to Procore as a custom field on the relevant timecard or project resource
- [ ] **PRO-05**: System pushes compliance violation summary (count, type, week) to Procore via custom fields or the Observations API
- [ ] **PRO-06**: On classification conflict between Procore and app data, Procore classification is treated as authoritative and the app record is updated

## Sage 300 CRE Integration

- [ ] **SAGE-01**: User can configure Sage 300 CRE file exchange paths (import directory, export directory) in the connection settings UI
- [ ] **SAGE-02**: System imports Sage 300 employee and timesheet data from CSV/TXT files placed in the configured import directory; uses existing `sage300Mapper.ts` parser
- [ ] **SAGE-03**: System generates a Sage-compatible compliance status export file when the user triggers a compliance push for Sage connections
- [ ] **SAGE-04**: IntegrationsPage displays clear UI messaging that Sage 300 CRE sync is file-based (not live) and explains the file exchange workflow to the user

## Viewpoint Vista Integration

- [ ] **VISTA-01**: User can configure Viewpoint Vista file exchange paths (import directory, export directory) in the connection settings UI
- [ ] **VISTA-02**: System imports Vista employee and timesheet data from CSV files placed in the configured import directory
- [ ] **VISTA-03**: System generates a Vista-compatible compliance status export file when the user triggers a compliance push for Vista connections

## Integration Dashboard

- [ ] **DASH-01**: Integration Dashboard shows per-ERP sync run history: timestamp, records synced, errors encountered, and duration
- [ ] **DASH-02**: Main app Dashboard displays a failure alert banner when any connected ERP sync fails 2 or more consecutive times
- [ ] **DASH-03**: System sends an email notification when a connected ERP sync fails consecutively, using the existing nodemailer infrastructure
- [ ] **DASH-04**: User can configure field mappings between ERP fields and prevailing wage fields (e.g., Procore `classification_id` → app `tradeClassification`) from the IntegrationsPage

## Security & Data Integrity

- [ ] **SEC-01**: No outbound ERP payload ever includes SSN, decrypted SSN, or any SSN-derived value; all sync serializers use explicit inclusion lists
- [ ] **SEC-02**: All OAuth access tokens and refresh tokens are encrypted before storage using AES-256-GCM; tokens are decrypted only at the sync call site
- [ ] **SEC-03**: OAuth PKCE `code_verifier` is stored in the database (not in-memory session) to survive server restarts; `state` nonce is verified against the stored value before token exchange

---

## Future Requirements (Deferred)

- Procore webhooks for real-time sync (vs nightly polling) — deferred to v10.0
- Sage 300 CRE cloud REST adapter via Sage Web API — deferred; MEDIUM confidence, requires customer-hosted API endpoint setup
- Viewpoint Vista AppXchange REST adapter — deferred; requires Trimble developer account and customer App Xchange purchase
- Vista ODBC on-premise direct DB adapter — deferred to v10.0 (HIGH complexity)
- chokidar file-directory watcher for on-premise auto-import (Sage/Vista) — deferred; manual trigger sufficient for v9.0
- Multi-company Procore support (one app account → multiple Procore companies) — deferred
- ERP sync webhook outbound (notify contractor's other systems when HCC sync completes) — deferred

## Out of Scope

- **Wage rate push to any ERP** — compliance app is downstream of payroll; pushing calculated rates back would create circular dependency and potential falsification risk
- **SSN sync to or from any ERP** — SSN stays in the app's encrypted vault; ERP employee ID is the sync key
- **Net pay or gross pay write-back** — app does not own payroll processing for any ERP
- **Vista ODBC / on-premise DB access** — direct DB access to customer Windows installations is outside the security boundary

---

## Traceability

| Requirement | Phase |
|-------------|-------|
| INTG-01 | 126 |
| INTG-02 | 126 |
| INTG-03 | 126 |
| INTG-04 | 126 |
| INTG-05 | 126 |
| INTG-06 | 126 |
| INTG-07 | 126 |
| PRO-01 | 127 |
| PRO-02 | 127 |
| PRO-03 | 128 |
| PRO-04 | 129 |
| PRO-05 | 129 |
| PRO-06 | 127 |
| SAGE-01 | 130 |
| SAGE-02 | 130 |
| SAGE-03 | 131 |
| SAGE-04 | 130 |
| VISTA-01 | 132 |
| VISTA-02 | 132 |
| VISTA-03 | 133 |
| DASH-01 | 134 |
| DASH-02 | 134 |
| DASH-03 | 134 |
| DASH-04 | 134 |
| SEC-01 | 126 |
| SEC-02 | 126 |
| SEC-03 | 127 |
