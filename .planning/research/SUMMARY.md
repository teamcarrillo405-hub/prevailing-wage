# Research Summary -- v9.0 Construction ERP Integrations

**Project:** HCC Prevailing Wage
**Domain:** Bidirectional ERP sync for prevailing wage compliance (Procore, Sage 300 CRE, Viewpoint Vista)
**Researched:** 2026-05-11
**Confidence:** MEDIUM-HIGH -- Procore is HIGH (working code exists), Sage/Vista are MEDIUM (APIs gated or absent)

---

## Executive Summary

The v9.0 milestone adds bidirectional sync with three construction ERPs to an existing compliance tool. The critical finding that reframes the entire effort: significant Procore infrastructure already exists in the codebase. The OAuth2 connect/callback/token-refresh flow is production-grade in routes/integrations.ts (lines 609-727), and the timesheet pull and worker upsert patterns live at lines 732-868. Phases 127-129 are extraction, formalization, and extension of working code into the IErpAdapter interface -- not greenfield development. This substantially de-risks the Procore track.

The two other ERPs present a starkly different picture. Sage 300 CRE has no public REST API -- it is an on-premise Windows application with ODBC-only programmatic access. The only viable integration path for cloud-hosted contractors is a file-based adapter: generate Sage-compatible .txt payroll import files and parse Sage CSV exports. Viewpoint Vista (Trimble) does have a REST API (AppXchange) but it requires purchasing a Trimble developer account and a sales/onboarding relationship -- it is not self-service. Build the file adapter first and gate the REST path behind a feature flag requiring customer-provided AppXchange credentials.

Net new package footprint is deliberately minimal: only openid-client (PKCE utilities for Procore OAuth hardening) and chokidar (file watching for the Sage/Vista on-premise adapter). Everything else -- scheduling, credential encryption, CSV parsing, audit logging -- reuses existing stack. Two architectural requirements must be in place before any sync work: WAL mode must be enabled in Phase 126 to prevent SQLITE_BUSY errors when the nightly sync job overlaps with user payroll entry, and the Vista API async 202 Accepted + polling pattern requires a vista_pending_actions table from Phase 132 forward. SSN data must never appear in any outbound ERP payload -- enforce via explicit inclusion lists on all sync payloads, not exclusion lists.

---

## Key Findings

### Recommended Stack

The stack for v9.0 is almost entirely additive configuration on the existing codebase. The only new runtime dependencies are openid-client ^6.8 for PKCE code verifier/challenge generation, and chokidar ^4 for file watching. Both are ESM-only packages. axios and csv-parse are likely already installed; verify in package.json before adding.

node-cron is already installed and running 5 scheduled jobs. The nightly ERP sync is job #6. No Redis, no BullMQ, no external queue service.

**Core technologies:**
- openid-client ^6.8: PKCE code verifier + challenge generation -- NEW package
- chokidar ^4: File watcher for Sage/Vista on-premise adapter; awaitWriteFinish prevents reads mid-write -- NEW package
- node-cron (already installed): Nightly sync job #6; existing pattern is canonical
- drizzle-orm (already installed): 3 new tables via add-only migrations (integration_connections, integration_field_mappings, integration_sync_runs)
- crypto (Node.js built-in): AES-256-GCM token encryption via existing cryptoService.ts
- axios (verify installed): ERP HTTP client; one axios instance per provider with token interceptor
- csv-parse (verify installed): Streaming CSV/TXT parser for Sage and Vista file adapters

**Explicit non-additions:** No BullMQ/Redis, no Passport.js, no @procore/js-sdk, no external secrets manager, no separate microservice.

### Expected Features

**Must have (table stakes) -- v9.0:**
- Pull workers from Procore -- eliminates re-keying; Procore is authoritative on worker roster
- Pull timesheets/hours from Procore daily -- primary value driver; eliminates duplicate time entry
- Sage 300 CRE file-based adapter -- reaches majority of Sage contractors who cannot expose on-premise Sage
- Vista file-based adapter -- universal fallback covering both cloud and on-premise Vista
- Connection status UI per ERP -- silent broken connections cause compliance gaps
- AES-256-GCM encrypted credential storage -- reuse existing SSN encryption pattern
- Sync history log -- auditors need to see when data last synced
- Manual Sync Now trigger -- nightly-only is insufficient before payroll runs
- Worker deduplication by erp_external_id + erp_source -- not by name

**Should have (differentiators) -- v9.0:**
- Push WH-347 compliance status back to Procore custom fields -- closes the bidirectional loop
- Push compliance violations as Procore Observations -- surfaces inside native Procore issue tracking
- Nightly automatic sync at 02:00 UTC with configurable schedule
- Integration Dashboard with sync health banners -- Phase 134 is compliance-critical, not optional polish

**Defer to v10.0:**
- Vista AppXchange REST adapter (gated -- requires Trimble developer account purchase)
- Procore webhooks-driven sync (nightly + manual trigger ships first)
- Vista ODBC fallback for on-premise (high complexity, narrow market)
- Per-project ERP connection override (single company-level connection covers v9.0)

**Explicit anti-features:**
- No SSN sync from any ERP (PHI exposure; use ERP employee ID as sync key only)
- No writing wage rates or net pay back to ERP (regulatory liability)
- No creating workers in ERP from this app (data ownership inversion)
- No deprecating existing CSV import pipeline (additive only)

### Architecture Approach

The architecture centers on an IErpAdapter interface in src/server/services/erpAdapter.ts that all three ERP adapters implement. The syncOrchestrator.ts calls only interface methods. The Procore adapter wraps already-working code from procoreService.ts and routes/integrations.ts -- it is a formalization step, not a rewrite.

**Major components:**
1. integrationVault.ts -- Unified encrypt/decrypt for multi-provider credentials; wraps existing cryptoService.ts
2. erpAdapter.ts + provider implementations (procoreAdapter.ts, sageAdapter.ts, viewpointAdapter.ts) -- IErpAdapter interface; each adapter handles credential retrieval internally
3. syncOrchestrator.ts -- Pull/push cycle for one connection; sequential DB writes (never Promise.all against SQLite)
4. erpSync.ts (cron job) -- Nightly job registered in index.ts as cron job #6; iterates active connections sequentially; writes integration_sync_runs on every exit path
5. IntegrationsPage.tsx + IntegrationDashboard.tsx -- Connection management UI + sync health/history; persistent failure banner on main Dashboard after 2+ consecutive failures

**Procore classification authority rule:** Procore tradeClassification (cost code) wins when pulling workers. Other ERPs set classification only for new workers, never overwrite existing local classification. Implement via classification_source column: erp | manual | compliance_app.

**Rate snapshot policy (non-negotiable):** ERP pay rates are never used as baseRateSnapshot. The orchestrator always calls classificationRates.getRate(projectId, classificationId) from wage_determinations. ERP rates reflect what the contractor paid; compliance requires the Davis-Bacon rate.

### Critical Pitfalls

1. **SQLite write lock during nightly sync** -- Enable PRAGMA journal_mode=WAL and PRAGMA busy_timeout=5000 in DB init at Phase 126. Use BEGIN IMMEDIATE for sync writes. Commit every 50-100 rows. Must happen in Phase 126 before any sync code runs. (CRITICAL-4)

2. **SSN in outbound ERP payloads** -- Build all worker payloads using explicit inclusion lists, never by spreading the full worker row. Write unit tests asserting no /ssn/i field appears in any serialized payload. Add outbound request middleware that regex-checks for 9-digit SSN patterns before dispatch. (CRITICAL-2)

3. **Duplicate workers on re-sync** -- Add erp_external_id + erp_source columns to workers in Phase 126 migration with unique constraint. Upsert via ON CONFLICT (erp_external_id, erp_source) DO UPDATE. Name-based dedup breaks on shared names and name changes. (CRITICAL-3)

4. **Vista 202 Accepted treated as success** -- Vista AppXchange writes are async: 202 Accepted + queue ID immediately; actual DB write happens 30-40 seconds later via Xchange Agent. A vista_pending_actions table must exist from Phase 132 day one. Never report a Vista write as successful until polling confirms it. (HIGH-6)

5. **Silent sync failures invisible to contractors** -- Phase 134 Integration Dashboard is compliance-critical. Persistent banner when consecutive_failure_count >= 2. Email notification via existing nodemailer after 2nd consecutive failure. Contractors must see failures before submitting WH-347 with missing hours. (HIGH-7)

6. **OAuth token rot undetected** -- Store refresh_token_acquired_at. Surface proactive re-auth warning after 25 days. On 401 from refresh endpoint, mark integration credential_expired and show banner on next dashboard load. (CRITICAL-1)

---

## Implications for Roadmap

### Phase 126: Integration Foundation
**Rationale:** Every subsequent phase depends on the credential vault, adapter interface, and new DB tables. WAL mode must be enabled here before any sync writes occur.
**Delivers:** integration_connections, integration_field_mappings, integration_sync_runs tables; IErpAdapter interface; integrationVault.ts; IntegrationsPage.tsx with per-ERP ConnectionCard; PRAGMA journal_mode=WAL + busy_timeout=5000; Dashboard sync failure banner infrastructure
**Must address:** CRITICAL-4 (WAL mode), CRITICAL-2 (outbound payload contracts with explicit inclusion lists), CRITICAL-3 (schema: erp_external_id, erp_source, classification_source columns on workers table), MIN-1 (AES-256-GCM from day one), CRITICAL-1 (credential vault columns: token_expires_at, refresh_token_acquired_at, consecutive_failure_count, last_successful_at)
**Research flag:** None -- patterns established from existing codebase

### Phase 127: Procore OAuth + Worker Sync
**Rationale:** Procore has highest market penetration and working code exists -- lowest risk, highest value first. Worker sync must precede timesheet sync.
**Delivers:** procoreAdapter.ts wrapping existing procoreService.ts; OAuth nonce upgrade from Math.random() to crypto.randomBytes(16); Procore company selection UI; worker upsert via erp_external_id conflict target; nightly ERP sync cron registration in index.ts as job #6; POST /api/integrations/procore/sync-now
**Important:** OAuth connect/callback/token-refresh in routes/integrations.ts lines 609-727 is working production code. Extract into procoreAdapter.ts and harden -- do not rewrite.
**Must address:** MOD-1 (store code_verifier in DB not session), MOD-3 (company selection dropdown), CRITICAL-3 (worker upsert idempotency), HIGH-5 (per-tenant OAuth tokens)
**Research flag:** None -- working code confirmed in codebase

### Phase 128: Procore Timesheet Pull
**Rationale:** Primary value driver -- eliminating duplicate time entry. Prototype exists in integrations.ts lines 732-868. Depends on Phase 127 workers.
**Delivers:** listTimeEntries() in procoreAdapter.ts (extract from lines 732-789); timezone-aware week bucketing; sequential upsert loop via upsertPayrollEntry(); exponential backoff with X-Rate-Limit-Reset header on 429
**Must address:** MOD-4 (timezone mismatch -- test Sunday 11 PM edge case), HIGH-5 (rate limit backoff), sequential writes only
**Research flag:** None -- prototype confirmed in existing code

### Phase 129: Procore Compliance Push
**Rationale:** Closes the bidirectional loop. Custom fields on Timesheets or Observations confirmed viable.
**Delivers:** pushComplianceStatus() in procoreAdapter.ts; run_configurable_validations: true on all custom field writes; post-write re-fetch verification; push phase in syncOrchestrator.ts
**Must address:** HIGH-1 (re-fetch verification after custom field write), MIN-3 (filter webhook events by source_application_id to prevent re-sync loop)
**Research flag:** None -- Procore custom fields API confirmed

### Phase 130: Sage 300 CRE Adapter Foundation
**Rationale:** Second-highest GC market penetration. File-based adapter covers majority of Sage shops.
**Delivers:** sageAdapter.ts implementing IErpAdapter; chokidar ^4 file watching with awaitWriteFinish; wraps existing sage300Mapper.ts; sync_file_log table for file hash deduplication; Sage connect routes
**Critical finding:** Sage 300 CRE has NO public REST API. File format: comma-delimited .txt (not .csv), no extra spaces between commas, blank fields as adjacent commas.
**Must address:** HIGH-4 (file path injection -- allowlist validation + path.resolve() prefix check), HIGH-4 (stale file dedup via file hash), HIGH-2 (parse by column header name not index), MOD-2 (health check before sync)
**Research flag:** Validate exact Sage 300 CRE payroll import .txt field order against a live test import before Phase 130 ships

### Phase 131: Sage 300 Payroll Sync + Compliance Push
**Rationale:** Worker sync (Phase 130) must exist first.
**Delivers:** listTimeEntries() in sageAdapter.ts; compliance push for file mode generates compliance-report.csv to SFTP drop directory (structured stub noting manual import required -- no programmatic push without ODBC)
**Must address:** HIGH-3 (classification conflict: this app is authoritative for trade classification, not Sage)
**Research flag:** None for file mode; Sage REST mode deferred to v10.0

### Phase 132: Viewpoint Vista Adapter Foundation
**Rationale:** File mode first -- most mid-market Vista customers will not have AppXchange REST API access.
**Delivers:** viewpointAdapter.ts implementing IErpAdapter with file mode; Vista CSV/tab-delimited parser (no existing mapper -- implement in adapter); vista_pending_actions table (required infrastructure even before REST writes ship); Vista connect routes
**Critical finding:** Vista AppXchange REST requires registering as a Trimble developer -- not self-service. REST mode gated behind connection_type: rest feature flag.
**Critical finding:** Vista API is async -- 202 Accepted + queue ID on all writes. vista_pending_actions table must exist from day one of this phase.
**Must address:** HIGH-6 (polling harness for 202 Accepted), MOD-5 (1-hour cache lag -- document in Dashboard)
**Research flag:** Vista CSV export format documented but not locally verified -- validate against an actual Vista export before Phase 132 ships; AppXchange REST endpoint schemas require Trimble developer account

### Phase 133: Viewpoint Vista Timesheet + Compliance Push
**Rationale:** Worker sync (Phase 132) must exist first.
**Delivers:** listTimeEntries() in viewpointAdapter.ts; pushComplianceStatus() using vista_pending_actions polling harness; syncOrchestrator.ts registered for Viewpoint provider
**Must address:** HIGH-6 (always poll action queue; never report 202 as success), MOD-5 (cache lag documented in Dashboard tooltip)
**Research flag:** AppXchange REST endpoints require Trimble developer account; file mode ships first; REST mode validated against actual AppXchange access

### Phase 134: Integration Dashboard
**Rationale:** Compliance-critical, not optional UI polish. Contractors must detect silent sync failures before submitting WH-347 forms with missing hours.
**Delivers:** IntegrationDashboard.tsx; SyncHistoryTable.tsx (paginated integration_sync_runs); FieldMappingEditor.tsx; persistent failure banner on main Dashboard when consecutive_failure_count >= 2; email notification via nodemailer after 2nd consecutive failure; last-sync timestamp warning badge when >26 hours old
**Must address:** HIGH-7 (sync failure visibility), HIGH-3 (classification conflict resolution UI)
**Research flag:** None -- standard UI patterns

### Phase Ordering Rationale

- Phase 126 must be first: DB schema, adapter interface, WAL mode, and credential vault are prerequisites for all other phases.
- Phases 127-129 (Procore) run second: working code already exists, reducing risk and delivering value fastest.
- Phases 130-131 (Sage) run third: file adapter is independently developable after Phase 126 with no Procore dependency.
- Phases 132-133 (Vista) run last: no existing code, REST API requires third-party access to validate, highest risk.
- Phase 134 (Dashboard) runs last for full feature display, but sync_health infrastructure and failure banner must be wired incrementally as each sync job phase ships.

### Research Flags

Phases needing deeper research during planning:
- **Phase 130 (Sage file adapter):** Validate exact Sage 300 CRE payroll import .txt field order against a live test import before implementation.
- **Phase 132-133 (Vista):** Vista CSV export format documented but not locally verified. AppXchange REST endpoint schemas require Trimble developer account -- flag as a dependency gate before Phase 133 REST work begins.

Phases with standard patterns (skip research-phase):
- **Phase 126:** Drizzle add-only migrations, AES-256-GCM credential vault -- established codebase patterns
- **Phase 127:** Procore OAuth is working code -- extraction and hardening only
- **Phase 128:** Procore timesheet prototype confirmed in integrations.ts lines 732-868
- **Phase 129:** Procore custom fields API confirmed; standard PATCH pattern
- **Phase 134:** Standard table + dashboard UI; no novel technical elements

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 2 net-new packages. ESM compatibility friction known and solvable. Existing patterns cover 95% of the work. |
| Features (Procore) | HIGH | Working code in codebase + official Procore docs confirmed. |
| Features (Sage 300 CRE) | MEDIUM | No public REST API confirmed (HIGH). File format confirmed but field order needs live test validation. |
| Features (Vista) | LOW-MEDIUM | AppXchange REST gated behind Trimble developer account. File mode is HIGH confidence. |
| Architecture | HIGH | IErpAdapter interface derived from existing QBO/Procore patterns. SQLite single-writer constraint well-documented. |
| Pitfalls | HIGH | Critical pitfalls sourced from official docs: SQLite WAL, Procore rate limits, RFC 9700 OAuth, Trimble Vista async API. |

**Overall confidence:** MEDIUM-HIGH -- Procore track is high confidence end-to-end. Sage and Vista file adapters are medium confidence. Vista REST adapter is low confidence pending Trimble developer access.

### Gaps to Address

- **Vista AppXchange endpoint schemas:** Not publicly documented. Obtain Trimble developer account before Phase 133 REST implementation. File mode ships first.
- **Sage 300 CRE .txt field order:** Confirm exact field positions against a live test import before Phase 130 ships. Parse by column header name, not index, to be resilient.
- **ESM compatibility:** Both openid-client ^6 and chokidar ^4 are ESM-only. Verify package.json for "type": "module". If absent, use await import(). Resolve at Phase 126 start.
- **axios and csv-parse installation status:** Check package.json before Phase 126 -- likely already installed. Do not add duplicates.
- **WAL mode already enabled?** Confirm PRAGMA journal_mode=WAL is not already set in existing DB init before applying in Phase 126.

---

## Sources

### Primary (HIGH confidence)
- Procore OAuth Authorization Code Grant Flow -- procore.github.io/documentation/oauth-auth-grant-flow
- Procore REST API Timesheets -- developers.procore.com/reference/rest/timesheets
- Procore Rate Limiting -- procore.github.io/documentation/rate-limiting
- Procore Sage 300 CRE Payroll Export -- support.procore.com/products/online/user-guide/company-level/timesheets/tutorials/set-up-your-payroll-export-for-use-with-sage-300-cre
- Trimble Vista Cloud FAQ (APIs) -- sites.google.com/trimble.com/vista-cloud-faq/home/integration-technology/vista-apis
- Trimble Vista API Concepts -- direct-api.xchange.trimble.com/docs/vista-api-concepts
- Sage Community Hub (no REST API confirmation) -- communityhub.sage.com/us/sage_construction_and_real_estate/f/sage-300-construction-and-real-estate/194254
- SQLite WAL Mode -- sqlite.org/wal.html
- RFC 9700 OAuth 2.0 Best Current Practice -- datatracker.ietf.org/doc/rfc9700/
- openid-client npm v6.8.4 -- npmjs.com/package/openid-client
- Existing codebase: routes/integrations.ts (lines 609-868), services/procoreService.ts, services/cryptoService.ts, db/migrations/0056_procore_connections.sql, index.ts (lines 267-350)

### Secondary (MEDIUM confidence)
- Vista AppXchange Connectors -- appxchange.trimble.com/connectors/viewpoint-vista
- Sage 300 CRE via Agave API -- useagave.com/integrations/sage-300-cre
- Sage 300 CRE Payroll Import Format (Workyard) -- help.workyard.com/en/articles/7282899-how-to-set-up-download-payroll-file-for-sage-300-cre
- Procore User Management API (Stitchflow) -- stitchflow.com/user-management/procore/api
- chokidar npm v4.x -- npmjs.com/package/chokidar
- Enterprise Integration Patterns -- Idempotent Receiver -- enterpriseintegrationpatterns.com

### Tertiary (LOW confidence -- needs validation)
- Vista AppXchange API overview -- direct-api.xchange.trimble.com/docs/vista-api-overview (requires Trimble account for full reference)
- Sage 300 CRE Web API REST endpoints -- described in Agave and Greytrix docs; exact schemas require live Sage 300 CRE installation

---

*Research completed: 2026-05-11*
*Ready for roadmap: yes*
