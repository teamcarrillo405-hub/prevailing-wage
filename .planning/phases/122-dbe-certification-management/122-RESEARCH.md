# Phase 122: DBE Certification Management — Research

**Researched:** 2026-04-29
**Domain:** Subcontractor DBE/MBE/WBE certification lifecycle (schema, routes, UI, email alerts, upload gate)
**Confidence:** HIGH — all findings verified directly from source files

---

## Summary

Phase 122 is substantially pre-built. The ROADMAP describes it as three task plans (122-01, 122-02, 122-03) that together implement DBE-01 through DBE-06. Investigation of the actual codebase shows that all six requirements are implemented and live across schema, migrations, server routes, client UI, and background jobs. The work was done across Phases 71, 82 (Gap-2), and integrated into existing Phase 54/55/56 subcontractor infrastructure.

The ROADMAP task list was written before implementation occurred. Phase 122 as written in ROADMAP.md describes work that is already done. The planner's job is to verify each criterion from the ROADMAP acceptance criteria, write tests for any untested paths, and close any genuine gaps rather than re-implement things that exist.

**Primary recommendation:** Phase 122 is a verification and gap-close phase, not a build phase. The planner should scope tasks as: (1) verify each DBE-01 through DBE-06 acceptance criterion against the actual code, (2) add tests for the cert CRUD routes and expiry job (zero test coverage found), and (3) fix the one confirmed gap: no PATCH (edit) route for certifications exists on the server.

---

## What EXISTS vs. What NEEDS Building

### DBE-01: `subcontractor_certifications` table

**Status: COMPLETE**

- Table created in migration `0039_same_the_leader.sql` (all columns from spec: id, subcontractor_id FK, cert_types text, certifying_agency, cert_number, naics_codes, issue_date, expires_date, owner_race, owner_gender, personal_net_worth_usd, reevaluation_status default 'not_required', self_certified boolean, document_path, created_at, updated_at).
- Indexes: `idx_sub_certs_sub` on subcontractor_id, `idx_sub_certs_expires` on (expires_date, reevaluation_status).
- SAM.gov columns (uei, cage_code, sam_registration_status, sam_last_verified_at) added in migration `0053_session_version_sam_gov.sql`.
- Drizzle schema definition at `src/server/db/schema.ts` lines 524-550 — fully in sync with migrations.

**Gap:** None. Next migration would be `0066_*.sql`.

---

### DBE-02: Certification CRUD on SubcontractorPanel

**Status: MOSTLY COMPLETE — one gap (no PATCH/edit route)**

Confirmed present:
- `GET /api/projects/:id/subcontractors/:subId/certifications` — list certs, ordered by createdAt desc (subcontractors.ts line 427).
- `POST /api/projects/:id/subcontractors/:subId/certifications` — create cert with full schema validation via `CreateCertSchema` (subcontractors.ts line 461). Accepts certTypes, certifyingAgency, certNumber, naicsCodes, issueDate, expiresDate, reevaluationStatus, selfCertified, uei, cageCode, samRegistrationStatus.
- `DELETE /api/projects/:id/subcontractors/:subId/certifications/:certId` — hard delete (subcontractors.ts line 519).
- Client UI: `CertificationsSubPanel` component inside `ProjectDetailPage.tsx` (lines ~477-884). Renders cert badges, cert table with DOT IFR Status column, delete per row, "+ Add Certification" form with cert type toggle buttons, expiration date input, DOT IFR status select, and SAM.gov verify-and-import panel.
- Multiple certs per sub supported; form supports comma-separated cert types.

**Confirmed gap:** No `PATCH /api/projects/:id/subcontractors/:subId/certifications/:certId` route. Users can delete and re-add, but cannot edit an existing cert record in place. The client UI also has no "Edit" path in the cert table (only "Remove"). This is a missing CRUD endpoint per DBE-02 spec ("Edit and delete within panel").

---

### DBE-03: Certification expiration alerts (90/60/30 days via Resend)

**Status: COMPLETE**

- Job file: `src/server/jobs/certificationExpiryAlerts.ts`
- Logic: iterates thresholds [90, 60, 30], computes target date, finds certs where `expiresDate = alertDateStr` (exact-day match to prevent duplicate sends), fetches project owners via projectMembers JOIN users, sends Resend email per owner with sub name, cert type, expiry date, and project URL.
- Cron registration: `src/server/index.ts` lines 267-277 — `cron.schedule('0 8 * * *', ...)` with `timezone: 'America/New_York'`, wrapping `runCertificationExpiryAlerts()` in try/catch (non-fatal per NFR-02).
- Resend lazy-init pattern mirrors `emailService.ts` exactly.

**Gap:** No tests for `runCertificationExpiryAlerts`. The job has zero test coverage.

---

### DBE-04: CPR upload gate (expired or suspended cert blocks CPR)

**Status: COMPLETE — both gate points implemented**

Gate point 1 — internal CPR week creation (`POST /api/projects/:id/subcontractors/:subId/cpr-weeks`, subcontractors.ts lines 319-339):
- Fetches subcontractor's certs, checks `reevaluationStatus === 'suspended'` or `expiresDate < today`.
- Returns 422 with `code: 'CERT_EXPIRED_OR_SUSPENDED'` and human-readable error message.

Gate point 2 — public upload portal (`POST /api/sub-upload/:token`, subUpload.ts lines 101-123):
- Same cert check on the `subcontractors.id` from the token lookup row.
- Same 422 + `code: 'CERT_EXPIRED_OR_SUSPENDED'` pattern.

Client-side warning in SubcontractorPanel: The GET /subcontractors response already attaches `certSummary: { certCount, isCertified, hasExpiredCert, hasSuspendedCert, hasPendingCert }` for every sub (subcontractors.ts lines 74-102). The client uses `certSummary.hasExpiredCert` and `certSummary.hasSuspendedCert` to render the amber warning banner in the CPR weeks table (ProjectDetailPage.tsx line 274).

Public upload portal client (`SubUploadPage.tsx`): The page displays the server's 422 error string via `setError(e.error)` — the human-readable message "Sub's DBE certification expired — resolve before accepting CPR" surfaces to the sub on the public page.

**Gap:** None for the gate logic itself. No server tests for the 422 path.

---

### DBE-05: DBE participation summary card on ProjectDetailPage

**Status: COMPLETE**

- `activeCertifiedCount`, `expiredCount`, `pendingCount` computed from the `certSummary` attached to each sub in the GET /subcontractors response (ProjectDetailPage.tsx lines 978-983).
- Participation card rendered at lines 998-1029: 3-column grid (Active Certified / Expired Certs / DOT IFR Review), only shown when `subs.some(s => s.certSummary?.isCertified)`.
- Amber advisory shown when expiredCount > 0 or pendingCount > 0.
- "Clicking opens the sub certification detail view" — card does NOT currently have an onClick that expands to sub cert detail. The ROADMAP criterion says "Clicking opens the sub certification detail view." The card is static display only — clicking a sub in the panel below expands their cert detail, but the card itself has no click handler. This is a gap.

---

### DBE-06: DOT IFR 2025 label + reevaluation_status default for pre-Oct-3-2025 certs

**Status: PARTIALLY COMPLETE**

Confirmed present:
- `REEVAL_OPTIONS` array (ProjectDetailPage.tsx line 479) includes `{ value: 'pending', label: 'Under DOT Oct 2025 IFR review' }`.
- Form field labeled "DOT IFR Status" with tooltip "The DOT Interim Final Rule (Oct 3, 2025) requires individual reevaluation of all DBE certifications..." (lines 847-851).
- DOT IFR Status column in cert table (line 650).

**Confirmed gap:** The ROADMAP criterion states "certs imported/created before Oct 3, 2025 default to `reevaluation_status = 'pending'` with advisory to verify current status." The server `POST /certifications` route uses `reevaluationStatus: z.enum([...]).default('not_required')` — it does NOT auto-set `pending` for certs where `issueDate < '2025-10-03'`. This server-side defaulting rule is not implemented.

---

## Architecture Patterns

### Cert routes follow the existing subcontractors.ts pattern exactly

All cert endpoints are registered inside `subcontractors.ts` router (not a separate file). Pattern for all routes:
1. `assertProjectAccess(db, projectId, userId)` — IDOR guard.
2. Second-level check: verify sub belongs to project via `and(eq(subcontractors.id, subId), eq(subcontractors.projectId, projectId))`.
3. Business logic.
4. Return `{ data: { ... } }` envelope.

The PATCH cert route to add must follow this exact pattern. Example from PATCH sub (lines 161-206): fetch existing, apply body fields with `!== undefined` guards to allow partial updates, re-select updated row.

### Cert expiry job pattern

`src/server/jobs/certificationExpiryAlerts.ts` — standalone async function `runCertificationExpiryAlerts()`, registered in index.ts cron block. Mirrors `scheduledReports.ts` pattern. Best-effort (never rethrows). Lazy Resend init at module level.

### certSummary attachment in GET /subcontractors

The GET list route (subcontractors.ts lines 74-104) attaches `certSummary` to each sub with a per-sub inner query. This is an N+1 query — one cert query per sub. Acceptable for the expected sub counts (< 50 per project). Do not refactor to a single JOIN unless subs-per-project grows substantially.

### DBE-04 gate: both write paths must guard independently

The cert gate must exist in both:
- `POST /cpr-weeks` (internal GC creation) — currently implemented.
- `POST /sub-upload/:token` (public portal) — currently implemented.

If a PATCH/edit route for certs is added that can clear an expiry date, neither gate needs changing — they always re-query the live cert state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending | Custom SMTP client | `resend` (already installed, lazy-init pattern established) | Resend configured globally; FROM_EMAIL env var set |
| Cron scheduling | `setInterval` | `node-cron` (already used in index.ts) | Already registered for cert-expiry at 8am ET |
| UUID generation | `uuid` package | `randomUUID` from `node:crypto` | Project-wide pattern (Phase 39-01 decision) |
| Request validation | Manual type checks | `zod` + `validate()` middleware | All routes use this pattern |
| Project access guard | Inline ownership checks | `assertProjectAccess(db, projectId, userId)` | Centralized IDOR guard (Phase 32) |

---

## Common Pitfalls

### Pitfall 1: PATCH cert — apply `!== undefined` guards, not truthiness checks

The PATCH sub route (lines 185-197) uses `body.field !== undefined ? body.field : existing.field` not `body.field || existing.field`. This is critical: a PATCH to clear `certifyingAgency` to null would fail with a truthiness check because `null` is falsy. Use strict `!== undefined` throughout the cert PATCH route.

### Pitfall 2: The DBE-06 issueDate default must not break existing certs

The auto-set-to-pending rule (certs with issueDate before 2025-10-03) should only fire at CREATE time, not be applied retroactively via migration. Existing rows already have user-chosen reevaluationStatus values. Only new POST requests need the conditional default. Server logic: `if (body.issueDate && body.issueDate < '2025-10-03' && body.reevaluationStatus === 'not_required') { reevaluationStatus = 'pending'; }`.

### Pitfall 3: certSummary cache invalidation after cert add/delete

The GET `/subcontractors` response includes `certSummary` derived from the certs table. After a cert mutation, the client must invalidate BOTH `['certifications', projectId, subId]` AND `['subcontractors', projectId]` so the participation card counts update. The current `addCertMutation.onSuccess` only invalidates `['certifications', ...]`. This is a latent bug — after adding a cert, the participation card shows stale counts until page refresh.

### Pitfall 4: Migration number

Latest migration is `0065_payroll_entry_sub_fk.sql`. The next migration must be numbered `0066_`. Do not reuse or skip numbers.

### Pitfall 5: certSummary N+1 is not a bug

The N+1 query in GET /subcontractors (one cert query per sub) is intentional and documented — it matches the project's pattern for attaching related counts. Do not refactor it as part of Phase 122.

---

## Gap Summary (What Phase 122 Actually Needs to Build)

| Gap | Requirement | Where | Effort |
|-----|-------------|-------|--------|
| `PATCH /certifications/:certId` route | DBE-02 ("Edit and delete within panel") | `src/server/routes/subcontractors.ts` | Small — copy PATCH sub pattern |
| Edit cert UI in CertificationsSubPanel | DBE-02 | `src/client/pages/ProjectDetailPage.tsx` | Small — add edit toggle to cert table row |
| DBE-06 auto-pending default for pre-Oct-3-2025 issueDate | DBE-06 | `POST /certifications` route | 3 lines in route handler |
| DBE-05 participation card click handler | DBE-05 ("Clicking opens the sub certification detail view") | `src/client/pages/ProjectDetailPage.tsx` | Small — scroll to sub or expand first certified sub |
| `['subcontractors', projectId]` invalidation after cert mutations | DBE-05 count correctness | `CertificationsSubPanel` mutations | 1 line per mutation's onSuccess |
| Tests: cert CRUD routes | All DBE | `src/server/routes/__tests__/` | Medium — new test file needed |
| Tests: cert expiry job | DBE-03 | `src/server/jobs/` | Medium — mock Resend, in-memory DB |
| Tests: DBE-04 upload gate (422 path) | DBE-04 | existing subcontractor + subUpload tests | Small — add cases to existing route tests |

**Nothing requires a new DB migration.** The `subcontractor_certifications` table and all its columns are fully migrated and in sync with schema.ts.

---

## Code Examples

### PATCH certification route (to add)

```typescript
// Source: PATCH subcontractors/:subId pattern — subcontractors.ts lines 161-206
const UpdateCertSchema = z.object({
  certTypes: z.string().min(1).optional(),
  certifyingAgency: z.string().optional().nullable(),
  certNumber: z.string().optional().nullable(),
  naicsCodes: z.string().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  expiresDate: z.string().optional().nullable(),
  reevaluationStatus: z.enum(['not_required', 'pending', 'cleared', 'suspended']).optional(),
  selfCertified: z.boolean().optional(),
  uei: z.string().optional().nullable(),
  cageCode: z.string().optional().nullable(),
  samRegistrationStatus: z.string().optional().nullable(),
});

router.patch('/:id/subcontractors/:subId/certifications/:certId',
  validate(UpdateCertSchema),
  async (req, res) => {
    // 1. assertProjectAccess
    // 2. verify sub.projectId === projectId
    // 3. fetch existing cert, verify cert.subcontractorId === subId
    // 4. db.update with !== undefined guards
    // 5. return updated cert
  }
);
```

### DBE-06 auto-pending logic (in POST /certifications)

```typescript
// After parsing body, before db.insert:
let finalReevalStatus = body.reevaluationStatus;
if (
  body.issueDate &&
  body.issueDate < '2025-10-03' &&
  body.reevaluationStatus === 'not_required'
) {
  finalReevalStatus = 'pending';
}
```

### certSummary double-invalidation (in CertificationsSubPanel)

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['certifications', projectId, subId] });
  queryClient.invalidateQueries({ queryKey: ['subcontractors', projectId] }); // fix DBE-05 stale counts
  toast.success('Certification added');
  ...
}
```

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely code changes within the existing Express/SQLite/Resend stack. No new external dependencies are introduced. Resend is already installed and configured. `node-cron` is already installed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DBE-01 | subcontractor_certifications table columns and FK | schema validation | `npm test -- --run` (migration integration) | Implicitly covered by schema compile |
| DBE-02 | GET/POST/DELETE cert routes — happy path and auth guard | unit (route) | `npm test -- --run src/server/routes/__tests__/subcontractors.cert.test.ts` | No — Wave 0 gap |
| DBE-02 | PATCH cert route — partial update, 404 on missing | unit (route) | same file | No — Wave 0 gap |
| DBE-03 | runCertificationExpiryAlerts sends at 90/60/30 thresholds | unit (job) | `npm test -- --run src/server/jobs/certificationExpiryAlerts.test.ts` | No — Wave 0 gap |
| DBE-03 | No send when RESEND_API_KEY unset | unit (job) | same file | No — Wave 0 gap |
| DBE-04 | POST /cpr-weeks returns 422 on expired cert | unit (route) | included in subcontractors.cert.test.ts | No — Wave 0 gap |
| DBE-04 | POST /sub-upload/:token returns 422 on suspended cert | unit (route) | `npm test -- --run src/server/routes/__tests__/subUpload.test.ts` | No — Wave 0 gap |
| DBE-05 | GET /subcontractors attaches certSummary with correct counts | unit (route) | included in subcontractors.cert.test.ts | No — Wave 0 gap |
| DBE-06 | POST /certifications auto-sets pending for pre-Oct-3-2025 issueDate | unit (route) | included in subcontractors.cert.test.ts | No — Wave 0 gap |

### Sampling Rate
- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/server/routes/__tests__/subcontractors.cert.test.ts` — covers DBE-02 CRUD, DBE-04 gate, DBE-05 certSummary, DBE-06 auto-pending
- [ ] `src/server/jobs/certificationExpiryAlerts.test.ts` — covers DBE-03 thresholds and skip-on-no-key
- [ ] `src/server/routes/__tests__/subUpload.cert.test.ts` (or extend existing subUpload tests) — covers DBE-04 public portal gate

---

## Sources

### Primary (HIGH confidence)
- `src/server/db/schema.ts` — subcontractorCertifications table definition verified (lines 524-550)
- `src/server/db/migrations/0039_same_the_leader.sql` — CREATE TABLE confirmed
- `src/server/db/migrations/0053_session_version_sam_gov.sql` — SAM.gov columns confirmed
- `src/server/db/migrations/0064_dbe_classification.sql` — dbeClassification on subcontractors confirmed
- `src/server/routes/subcontractors.ts` — all cert routes and certSummary logic verified (lines 74-538)
- `src/server/routes/subUpload.ts` — DBE-04 public portal gate verified (lines 101-123)
- `src/server/jobs/certificationExpiryAlerts.ts` — DBE-03 job fully implemented
- `src/server/index.ts` — cron registration at 8am ET confirmed (lines 267-277)
- `src/client/pages/ProjectDetailPage.tsx` — CertificationsSubPanel and participation card verified (lines 477-1029)
- `src/client/pages/SubUploadPage.tsx` — public upload portal error surface confirmed

---

## Metadata

**Confidence breakdown:**
- What exists vs. what gaps: HIGH — all verified by direct file reads
- Gap analysis: HIGH — absence of PATCH route confirmed by grep across subcontractors.ts; absence of tests confirmed by find across all *.test.ts files
- DBE-06 gap: HIGH — route handler uses Zod default('not_required'), no issueDate comparison logic present

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable domain — no external dependencies to drift)
