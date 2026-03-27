# Feature Research

**Domain:** Prevailing Wage Compliance SaaS — v3.0 New Features
**Researched:** 2026-03-27
**Confidence:** MEDIUM-HIGH (invite flow HIGH, CSV formats MEDIUM, API availability HIGH, SSN encryption HIGH)

---

## Research Questions Answered

### Q1: Email-Based Invite Flows — Table-Stakes Behaviors

**Confidence: HIGH** — Multiple authoritative sources cross-verified.

Standard SaaS invite flows for team onboarding converge on the following behaviors:

#### Token Design
- Generate a **cryptographically secure token** (minimum 32 bytes of randomness, URL-safe base64 encoded)
- Store the token **hashed** in the database, not plaintext — treat like a password hash
- Token must encode or reference: invitee email, team/account ID, role, inviter identity, expiration timestamp
- Tokens must be **opaque** (not JWTs) for invite flows — easier to revoke, no key management overhead

#### Expiry Windows
- Industry consensus for team invites: **7 days** is the most common default
- Acceptable range: 24 hours (high security) to 14 days (low-friction)
- For a flat-model compliance tool with a single invite slot, 72 hours is defensible and balances security with construction contractor realities (they may not check email daily)

#### Resend Behavior (Table Stakes)
- Resending **invalidates all prior tokens** for that invitee email — prevents forwarded-link confusion
- Rate limiting required: 60-second cooldown per re-send action, daily cap of 5–10 sends per address
- UI must show: "We just sent to [email]. You can resend in 60 seconds"
- System should prevent resend if an invite was accepted within the last session

#### Revocation (Table Stakes)
- Owner must be able to **revoke a pending invite** before it is accepted
- Revocation immediately invalidates the token in the database
- If the invitee clicks a revoked link, show "This invite is no longer valid" — not a 500 error
- Revoked invites should not count toward member slots

#### Edge Cases (Table Stakes)
- **Already-registered email**: If the invitee already has an account, show "This email is already registered — sign in to accept" rather than requiring a new registration
- **Already-accepted token**: Show "Invite already used" and route to sign-in
- **Double-click protection**: Consume token atomically on first success; later clicks are safe, expected states — return 200 or redirect gracefully
- **Clock skew**: Allow 1–2 minute grace window to reduce false failures

#### 1-Year Retention Behavior (Project-Specific)
- When owner removes a member, **do not hard-delete** their data immediately
- Tag records with `removed_at` timestamp; mark as read-only for removed user
- After 365 days, data eligible for purge or archival per retention policy
- Owner must be notified in the UI that removed member data is retained for 1 year

#### Owner Transfer (Project-Specific)
- Must require explicit confirmation step (not a single-click action)
- Transfer should invalidate the old owner's elevated permissions atomically
- Consider requiring the new owner to accept the transfer (invitation pattern) vs. forced assignment

---

### Q2: QuickBooks and ADP Payroll CSV Export Fields

**Confidence: MEDIUM** — Official ADP field list confirmed via ADP Marketplace integration docs. QuickBooks field list confirmed via community docs and third-party integration references. Exact column headers vary by product version and report type; mapping screen is mandatory.

#### QuickBooks Payroll CSV Export

QuickBooks does not offer a single fixed CSV export format for payroll. The data is exported via **Payroll Summary Reports** (Reports > Employees & Payroll > Payroll Summary) or custom reports exported to Excel/CSV. The columns are user-configurable.

**Typical columns available in a QuickBooks Payroll Summary CSV:**

| Column | Notes |
|--------|-------|
| Employee Name | First Last or Last, First |
| Employee ID / SSN | Configurable; SSN may appear depending on version |
| Pay Period Start Date | |
| Pay Period End Date | Also called "Check Date" |
| Job / Customer:Job | Used for job costing; key for prevailing wage project mapping |
| Work Classification | Trade/craft code (Carpenter, Electrician, etc.) |
| Regular Hours | Numeric, 2 decimal places |
| Overtime Hours (1.5x) | |
| Double Overtime Hours (2x) | QuickBooks Desktop supports; QBO may not |
| Regular Pay Rate | Hourly rate |
| Regular Earnings | Dollar amount |
| Overtime Earnings | Dollar amount |
| Gross Pay | Total before deductions |
| Federal Income Tax | Deduction |
| State Income Tax | Deduction |
| FICA (SS + Medicare) | Deduction |
| Other Deductions | Union dues, benefits, etc. |
| Net Pay | |

**Key mapping challenges for import:**
- "Job" column maps to project in the app — will require matching screen if project names differ
- Worker name format is inconsistent (First Last vs Last, First vs Last,First)
- QuickBooks Desktop vs QBO exports have different column layouts
- Craft/trade codes are free-text in QuickBooks — will require normalization mapping

#### ADP Payroll CSV Export

ADP has multiple products (RUN Powered by ADP, Workforce Now, ADP PC/Payroll). The export formats differ. For prevailing wage integration, the relevant data points (confirmed via ADP Marketplace listing for Points North Certified Payroll Reporting) are:

**ADP Workforce Now — employee fields exported:**

| Field | Notes |
|-------|-------|
| First Name | |
| Last Name | |
| Social Security Number | Full SSN — requires handling in import pipeline |
| Employment Status | Active/Terminated |
| Legal Address | Street, City, State, ZIP |
| Hourly Rate / Pay Rate | |
| EEO Code | Job classification |
| Union Code | |
| Gender | |
| Original Hire Date | |

**ADP Workforce Now — payroll data fields exported:**

| Field | Notes |
|-------|-------|
| Cost Number | Maps to project/job code |
| Pay Period End Date | |
| Hours Worked | Total hours |
| Earnings Data | Broken out by pay code |
| Deductions Withheld | |
| Taxes Withheld | |

**ADP RUN (small business product) — CSV timesheet import/export columns:**

| Column # | Column Name | Notes |
|----------|-------------|-------|
| 1 | Co Code | 3-character company code |
| 2 | Batch ID | YYMMDD date stamp, auto-increments |
| 3 | File # | Unique employee ID (ADP Payroll System ID) |
| 7 | Reg Hours | Regular paid hours, 2 decimal places |
| 8 | O/T Hours | Overtime hours (includes double OT) |

**Key mapping challenges for ADP import:**
- ADP File # (employee ID) will not match worker IDs in the app — name + last-4 SSN matching required
- ADP exports full SSN — import pipeline must hash/encrypt immediately on ingest, never persist plaintext
- "Cost Number" (project code) must be mapped to app projects — mapping screen required
- ADP RUN and ADP Workforce Now produce different file formats; v3.0 should target **both** but treat them as separate parsers

---

### Q3: CA DIR eCPR and WA L&I PWIA Public API Availability

**Confidence: HIGH** — Multiple official sources, vendor confirmations, and direct portal inspection all converge on the same finding.

#### CA DIR eCPR — VERDICT: NO PUBLIC REST API EXISTS

**Finding: The CA DIR eCPR system does NOT offer a public REST API or programmatic submission endpoint.**

Evidence:
- Official CA DIR submission page (`dir.ca.gov/public-works/certified-payroll-reporting.html`) documents only two methods: (1) online iForm portal, (2) XML file upload through the web interface
- All third-party software vendors (Quantum Project Manager, Sunburst Software Solutions) generate XML files that users manually upload through the eCPR web portal — none have programmatic API access
- The eCPR system has an XML schema (v1.3, published at `dir.ca.gov`) but uploading the XML requires authenticated web browser interaction, not an API call
- No developer portal, API documentation, OAuth flow, or API key mechanism was found in any official or third-party source
- The eCPR portal URL is `https://efiling.dir.ca.gov/eCPR/pages/home.jsp` — a JSP web application, not an API endpoint

**Implication for AS-01 (CA eCPR Auto-Submit):** The conditional requirement "direct API submission — conditional on public API existing" evaluates to **FALSE**. The CA eCPR auto-submit feature (AS-01) **cannot be built** as a direct API integration. The current app's existing XML export feature is already the correct and complete integration pattern for CA DIR.

**Possible alternative (LOW confidence, unverified):** Browser automation (Puppeteer/Playwright) could theoretically automate the web upload. This is fragile, may violate CA DIR terms of service, and is not a supported integration pattern. Not recommended.

#### WA L&I PWIA — VERDICT: NO PUBLIC REST API EXISTS

**Finding: The WA L&I PWIA system does NOT offer a public REST API or programmatic submission endpoint.**

Evidence:
- Official WA L&I documentation (`lni.wa.gov/licensing-permits/_docs/xml%20payroll%20guide.pdf`) describes only XML file upload through the PWIA web portal
- The PWIA XML schema is public (`lni.wa.gov/licensing-permits/_docs/xmlschema.xsd`) but submission requires authenticated web session at `secureaccess.wa.gov/lni/pwia/CertifiedPayroll.aspx`
- Third-party tools (LCPtracker, documented in Tacoma guide v1.3) generate XML and guide users to upload manually — no API integration path exists
- SecureAccess Washington login page (`secureaccess.wa.gov`) is a standard forms-based authentication portal, not an OAuth/API gateway
- No WA L&I developer portal, API documentation, or REST endpoint was found in any source

**Implication for AS-02 (WA PWIA Auto-Submit):** The conditional requirement "direct API submission — conditional on public API existing" evaluates to **FALSE**. The WA PWIA auto-submit feature (AS-02) **cannot be built** as a direct API integration. The current app's existing WA PWIA XML export feature is the correct and complete integration.

**Summary for Planner:** Both AS-01 and AS-02 are **blocked on API non-existence**. These features should be re-scoped or removed from v3.0. The existing XML export workflow (download XML, manually upload to portal) is the industry-standard pattern used by all certified payroll software vendors.

---

### Q4: SSN Encryption Table-Stakes Behaviors

**Confidence: HIGH** — Multiple authoritative sources (Skyflow, Strac, SOC 2 guidance, pgcrypto docs) cross-verified.

#### Encryption Standard
- **AES-256-GCM** is the industry standard for SSN encryption at the field/column level (GCM mode preferred over CBC — provides authenticated encryption, detects tampering)
- AES-SIV is an alternative when deterministic (searchable) encryption is needed — maintains consistent ciphertext for the same input, enabling lookups without decryption
- For this app, **AES-256-GCM with a random IV per record** is correct — SSNs are not searched by value, only retrieved for display/pre-fill

#### What to Encrypt
- **Full SSN** (9 digits) for newly captured records
- **Existing last-4 SSN** values: these are partial data, not full SSNs — they should be encrypted at rest using the same AES-256 key, but they remain last-4 only (do not need to be upgraded to full SSN unless the user provides the full SSN)
- Plaintext SSN must never be stored; it must never appear in logs, error messages, or API responses

#### Key Management (Table Stakes)
- Encryption key must NOT be stored in the database alongside encrypted data
- Correct storage options (in order of preference):
  1. Cloud KMS (AWS KMS, Google Cloud KMS, Azure Key Vault) — key never leaves the KMS, encryption/decryption calls are audited
  2. Environment variable at runtime (acceptable for solo/small deployments, not ideal)
  3. Never: hardcoded in source code, stored in `.env` committed to git, stored in the same database as encrypted data
- For this app's scale: **environment variable stored in Railway/Vercel secrets** with a documented rotation procedure is the pragmatic minimum
- Key should be a 32-byte (256-bit) random value, base64-encoded for storage as env var

#### Key Rotation (Table Stakes)
- Rotation procedure must exist even if not automated: generate new key, re-encrypt all SSN fields, retire old key
- Each encrypted record should store the **key version** alongside the ciphertext (e.g., `{v:1, iv:"...", ct:"..."}`) so re-encryption can be done record-by-record without downtime
- Rotation frequency: annually at minimum for compliance software; immediately upon suspected compromise

#### Audit Logging (Table Stakes)
- Log every SSN decryption event: timestamp, user ID, worker ID, action context (e.g., "PDF generation," "eCPR pre-fill")
- Do NOT log the decrypted value itself
- Audit log must be append-only and protected from modification
- Compliance software should retain audit logs for at least 3 years (aligns with prevailing wage record retention)

#### UI Masking (Table Stakes)
- SSN must **never appear unmasked in the UI** — display as `XXX-XX-1234` (last 4 only) at all times
- The existing last-4 display pattern is correct; the upgrade path is: store full SSN encrypted, continue to display last-4 in UI
- CA eCPR and WA PWIA XML pre-fill: full SSN is written into the XML file at generation time (decrypt → write to file → file is discarded after download/upload). The SSN is never returned to the browser.

#### Migration of Existing last-4 Data
- Existing `ssn_last4` fields cannot be "upgraded" to full SSN without re-collecting from users — partial data cannot be reconstructed
- Correct migration: add new `ssn_encrypted` column; encrypt it using AES-256-GCM when full SSN is provided; keep `ssn_last4` for workers where only partial data exists
- Migration script must encrypt existing `ssn_last4` values at rest (they are currently plaintext partials)
- Use a **data migration transaction**: encrypt all records in a single migration, verify count, then commit — never leave database in mixed encrypted/plaintext state

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Invite token expiry (7 days) | Industry standard; security baseline | LOW | Opaque token, hashed in DB, expires at creation + 7 days |
| Resend invite with token invalidation | Users miss emails; must be recoverable | LOW | Invalidate old tokens on resend; 60s cooldown |
| Revoke pending invite | Owner mistakes happen before acceptance | LOW | Single DB update + UI button |
| Graceful expired-link UX | Construction contractors check email infrequently | LOW | Show clear "expired" message + resend CTA |
| Already-registered email handling | Invitees may already have accounts | LOW | Detect on token claim; route to login |
| QuickBooks CSV import with mapping screen | QB is dominant in construction SMB; users expect import not manual entry | HIGH | Field names vary by QB version; mapping screen is mandatory |
| ADP CSV import with mapping screen | ADP is #2 payroll provider in construction | HIGH | Two separate parsers (RUN vs WFN); mapping screen mandatory |
| Worker name matching on import | Imported names won't exactly match stored workers | MEDIUM | Fuzzy match + manual resolution screen for unmatched |
| SSN encryption at rest (AES-256) | Regulatory expectation; CA/WA compliance context | MEDIUM | AES-256-GCM; env var key storage at minimum |
| SSN masked in UI (XXX-XX-XXXX) | Users expect SSNs are never exposed in browser | LOW | Already displaying last-4; extend to mask full SSN |
| Audit log for SSN access | Compliance software audit expectations | MEDIUM | Append-only log: timestamp + user + worker + action |
| Key version stored per record | Required for non-breaking key rotation | LOW | Store `{v, iv, ct}` JSON blob per encrypted field |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Smart worker matching on CSV import | Reduces manual mapping friction vs competitors that require exact name match | MEDIUM | Levenshtein distance + last-4 SSN as tiebreaker |
| Import preview before commit | Lets users catch bad data before it enters the system | LOW | Show diff: matched workers, unmatched, skipped rows |
| Owner transfer with acceptance flow | Most tools do forced transfer; acceptance flow prevents accidents | LOW | Invitation pattern: new owner must click to accept |
| 1-year retention visibility | Owners can see what removed-member data is retained and when it purges | LOW | Simple UI: "Member removed. Data retained until [date]." |
| Per-record key versioning | Enables zero-downtime key rotation — a differentiator vs naive encryption | LOW | JSON envelope pattern; enables rotation without re-collecting SSNs |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| CA DIR eCPR direct API auto-submit | Saves manual upload step | No public API exists; browser automation is fragile and may violate ToS | Keep existing XML download + manual portal upload; document the workflow clearly |
| WA L&I PWIA direct API auto-submit | Saves manual upload step | No public API exists; same issues as above | Keep existing XML download + manual portal upload |
| Full SSN display in UI | Power users want to verify SSN | PII exposure risk; regulatory liability; browser caching | Show last-4 only; provide masked confirm field on collection |
| Automatic SSN upgrade migration | Backfill full SSNs from last-4 | Mathematically impossible; last-4 cannot be reconstructed | Prompt users to re-enter full SSN on next worker edit; last-4 stays for unupdated workers |
| Multi-role team model | Enterprise customers want granular permissions | Flat model is the specified scope; role complexity multiplies QA surface | Deliver flat owner/member model; defer roles to v4+ |
| Bulk CSV import without review screen | Faster for power users | Silent data corruption risk; unmatched workers create compliance gaps | Always show preview + mapping screen; cannot skip |

---

## Feature Dependencies

```
[Multi-user invite flow]
    └──requires──> [Existing JWT auth system]
    └──requires──> [Email sending infrastructure (SMTP/transactional email)]
    └──requires──> [Invite token DB table (pending_invites)]

[Payroll CSV import]
    └──requires──> [Existing worker records] (for name matching)
    └──requires──> [Existing project records] (for job code mapping)
    └──requires──> [Existing payroll week entry model] (to pre-populate)
    └──requires──> [Worker mapping screen] (for unmatched workers)

[SSN encryption]
    └──requires──> [Key management decision] (env var or KMS — must precede migration)
    └──requires──> [DB migration: add ssn_encrypted column]
    └──requires──> [Data migration: encrypt existing ssn_last4 values]
    └──blocks──>   [CA/WA eCPR/PWIA pre-fill] (XML generation needs decryption access)

[SSN encryption] ──enhances──> [CA eCPR XML export] (enables full SSN pre-fill)
[SSN encryption] ──enhances──> [WA PWIA XML export] (enables full SSN pre-fill)

[CSV import] ──enhances──> [Payroll week entry] (pre-populates fields)
[Multi-user] ──enhances──> [All existing features] (adds access scope per user)

[CA DIR eCPR auto-submit] — BLOCKED (no public API)
[WA L&I PWIA auto-submit] — BLOCKED (no public API)
```

### Dependency Notes

- **SSN encryption requires key decision first:** Key management strategy (env var vs KMS) must be locked before writing any migration code. A wrong choice here requires re-migration.
- **CSV import requires worker matching before import can commit:** The mapping screen is not optional — it is the mechanism that prevents silent data corruption.
- **Auto-submit features are dependency-free because they are eliminated:** No engineering time should be allocated to AS-01 or AS-02 for v3.0.

---

## MVP Definition (v3.0 Scope)

### Launch With (v3.0)

- [x] Multi-user invite: owner invites 1 member by email, flat model, token expiry, resend, revoke, 1-year retention on removal, owner transfer
- [x] QuickBooks CSV import: parser + worker name matching + mapping screen + payroll week pre-population
- [x] ADP CSV import: separate parsers for RUN and Workforce Now + same mapping/matching flow
- [x] SSN encryption: AES-256-GCM, env var key, key version per record, encrypt existing last-4, audit log, UI masking unchanged

### Deferred (not v3.0)

- [ ] CA DIR eCPR direct API auto-submit — no public API exists; cannot be built
- [ ] WA L&I PWIA direct API auto-submit — no public API exists; cannot be built
- [ ] Multi-role team model (owner/admin/viewer) — scope is flat model only
- [ ] KMS (cloud key management) upgrade — env var is sufficient for v3.0; document upgrade path
- [ ] Automated key rotation — document manual rotation procedure; automate in v4+

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| SSN encryption (AES-256) | HIGH | MEDIUM | P1 — security baseline; blocks XML pre-fill |
| Multi-user invite flow | HIGH | MEDIUM | P1 — core v3.0 value prop |
| QuickBooks CSV import | HIGH | HIGH | P1 — dominant payroll tool in construction |
| ADP CSV import | HIGH | HIGH | P1 — #2 payroll tool in construction |
| Owner transfer flow | MEDIUM | LOW | P2 — needed for completeness; low cost |
| 1-year retention on member removal | MEDIUM | LOW | P2 — compliance expectation |
| Audit log for SSN access | MEDIUM | MEDIUM | P2 — compliance expectation |
| CA eCPR auto-submit | LOW (blocked) | N/A | REMOVED — no public API |
| WA PWIA auto-submit | LOW (blocked) | N/A | REMOVED — no public API |

---

## API Availability Decision Record

This section is provided for the planner as a definitive record for AS-01 and AS-02 conditional requirements.

| Agency | System | Public REST API? | Evidence | Verdict |
|--------|--------|-----------------|----------|---------|
| CA DIR | eCPR | NO | Official submission page documents only iForm portal + XML upload; all third-party vendors (Quantum, Sunburst) confirm XML-upload-only integration; no developer portal found | Feature NOT buildable |
| WA L&I | PWIA | NO | Official XML upload guide describes web portal submission only; SecureAccess WA is a forms portal not an API gateway; LCPtracker integration guide (v1.3) confirms manual upload workflow; no developer portal found | Feature NOT buildable |

Both AS-01 and AS-02 should be removed from v3.0 scope. The existing XML export features for both portals represent the correct and complete integration pattern that the entire industry uses.

---

## Sources

- [CA DIR Certified Payroll Reporting](https://www.dir.ca.gov/public-works/certified-payroll-reporting.html) — official submission methods, HIGH confidence
- [CA DIR eCPR XML Upload User Guide (PDF)](https://www.dir.ca.gov/Public-Works/documents/CPR-XML-Upload-User-Guide.pdf) — XML schema documentation
- [Sunburst Software — 2024 CA DIR eCPR New Website](https://www.sunburstsoftwaresolutions.com/2024-ca-dir.htm) — third-party vendor confirming XML-upload-only pattern
- [WA L&I XML Payroll Upload Guide](https://lni.wa.gov/licensing-permits/_docs/xml%20payroll%20guide.pdf) — official XML upload documentation
- [WA L&I PWIA XML Schema](https://lni.wa.gov/licensing-permits/_docs/xmlschema.xsd) — schema definition only, not an API
- [LCPtracker WA L&I Export Guide v1.3](https://cms.tacoma.gov/cedd/SBE/Equity%20in%20Contracting%20FAQ/LCPtracker_Guide%20to%20WA%20LNI%20Features%20_V1.3.pdf) — confirms manual upload workflow
- [ADP Marketplace — Points North Certified Payroll for WFN](https://apps.adp.com/en-US/apps/248331/points-north-certified-payroll-reporting-for-adp-workforce-now/features) — ADP WFN payroll field list, HIGH confidence
- [AppMaster — Transactional Email Flows, Tokens, Expiration](https://appmaster.io/blog/transactional-email-flows-tokens-expiration-deliverability) — invite flow best practices, HIGH confidence
- [Sequenzy — Team Invitation Emails for SaaS](https://www.sequenzy.com/blog/how-to-create-team-invitation-emails-saas) — SaaS invite UX patterns
- [Skyflow — How to Securely Store Social Security Numbers](https://www.skyflow.com/post/how-to-securely-store-social-security-numbers) — SSN encryption best practices, HIGH confidence
- [Strac — Securing SSNs: Best Practices for Enterprise Data Protection](https://www.strac.io/blog/how-to-protect-ssn) — SSN key management guidance
- [PostgreSQL pgcrypto documentation](https://www.postgresql.org/docs/current/pgcrypto.html) — AES encryption implementation reference
- [QuickBooks Community — CSV payroll export](https://quickbooks.intuit.com/learn-support/en-us/employees-and-payroll/csv-file-export-for-payroll/00/700576) — QB export field reference
- [Auth0 Token Best Practices](https://auth0.com/docs/secure/tokens/token-best-practices) — token security reference

---

*Feature research for: Prevailing Wage Compliance SaaS — v3.0 Multi-User, CSV Import, SSN Encryption, Portal Auto-Submit*
*Researched: 2026-03-27*
