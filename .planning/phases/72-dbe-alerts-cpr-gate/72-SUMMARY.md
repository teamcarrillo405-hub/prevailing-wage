---
phase: 72
plan: 1
subsystem: dbe-compliance
tags: [dbe, mbe, wbe, certifications, email-alerts, cpr-gate, participation-card]
requirements: [DBE-03, DBE-04, DBE-05]
dependency-graph:
  requires: [phase-71-subcontractor-certifications]
  provides: [cert-expiry-email-alerts, cpr-cert-gate, dbe-participation-card]
  affects: [subcontractors-panel, sub-upload-route, cpr-week-creation]
tech-stack:
  added: []
  patterns: [node-cron-daily-job, drizzle-orm-join-query, resend-best-effort-email, react-query-derived-state]
key-files:
  created:
    - src/server/jobs/certificationExpiryAlerts.ts
  modified:
    - src/server/index.ts
    - src/server/routes/subcontractors.ts
    - src/server/routes/subUpload.ts
    - src/client/lib/cprStatus.ts
    - src/client/pages/ProjectDetailPage.tsx
decisions:
  - Extended GET /subcontractors to attach certSummary per sub rather than N+1 frontend fetches for participation card
  - Used exact-date match (expiresDate === alertDate) in cron job to prevent duplicate email sends across runs
  - Suspended cert takes priority over expired in error message for clarity
metrics:
  duration: ~20 minutes
  completed: 2026-04-25
  tasks: 3
  files: 5
---

# Phase 72: DBE Alerts, CPR Gate, and Participation Card Summary

DBE certification expiry email alerts at 90/60/30 days, CPR upload block when cert expired or suspended, and live DBE participation summary card on the project detail page.

## Tasks Completed

### DBE-03: Certification expiry email alerts

Created `src/server/jobs/certificationExpiryAlerts.ts`. Runs daily at 8:00 AM Eastern via node-cron in `src/server/index.ts`. Scans for certs expiring in exactly 90, 60, or 30 days (exact-day match prevents duplicate sends). Emails all active project owners per expiring cert using the Resend lazy-init pattern from `emailService.ts`. Best-effort — catches and logs all errors, never rethrows.

- Commit: `0c29136`
- Files: `src/server/jobs/certificationExpiryAlerts.ts`, `src/server/index.ts`

### DBE-04: Block CPR upload when cert expired or suspended

Added a pre-insert cert check to two routes:

1. **Authenticated route** — `POST /:id/subcontractors/:subId/cpr-weeks` in `subcontractors.ts`: queries `subcontractorCertifications` for the sub, returns `422 CERT_EXPIRED_OR_SUSPENDED` if any cert is suspended (priority message) or has `expiresDate < today`.

2. **Public upload route** — `POST /api/sub-upload/:token` in `subUpload.ts`: same gate before the file is written. Suspended cert error message takes priority over expired.

- Commit: `3c7dc0b`
- Files: `src/server/routes/subcontractors.ts`, `src/server/routes/subUpload.ts`

### DBE-05: DBE participation summary card

Extended `GET /:id/subcontractors` to attach a `certSummary` object per sub (computed server-side via parallel cert queries). The summary includes `certCount`, `isCertified`, `hasExpiredCert`, `hasSuspendedCert`, `hasPendingCert`.

Frontend changes:
- Added `SubcontractorCertSummary` interface and optional `certSummary` field to `Subcontractor` in `cprStatus.ts`
- Imported `Shield` icon in `ProjectDetailPage.tsx`
- Added DBE Participation Summary card inside `SubcontractorsPanel`, visible only when at least one sub has certifications — shows Active Certified / Expired Certs / DOT IFR Review counts with amber warning banner when issues exist

- Commit: `73dd5aa`
- Files: `src/client/lib/cprStatus.ts`, `src/client/pages/ProjectDetailPage.tsx`

## Test Results

- 724 tests passed, 56 test files green, 0 failures
- Server typecheck: 0 errors
- Client typecheck: 0 errors

## Deviations from Plan

**1. [Rule 2 - Auto-fix] Extended GET /subcontractors for cert data**
- The plan referenced `s.certifications?.some(...)` implying certs would already be on the sub object
- The existing endpoint did not include cert data; fetching per-sub on the frontend would cause N+1 requests
- Fix: extended the server-side GET to attach a computed `certSummary` object per sub in a `Promise.all` batch
- Files modified: `src/server/routes/subcontractors.ts`

**2. [Rule 1 - Bug] Fixed implicit `any` TypeScript errors**
- Found during typecheck: arrow function parameters in `.some()` callbacks inferred as `any` under strict mode
- Fix: added explicit `type CertRow = typeof certs[number]` local type aliases and annotated callback parameters
- Files modified: `src/server/routes/subcontractors.ts`, `src/server/routes/subUpload.ts`

## Known Stubs

None — all three features are fully wired to live data.

## Self-Check: PASSED

- `src/server/jobs/certificationExpiryAlerts.ts` — FOUND
- Commit `0c29136` — FOUND
- Commit `3c7dc0b` — FOUND
- Commit `73dd5aa` — FOUND
- 724 tests passed — VERIFIED
