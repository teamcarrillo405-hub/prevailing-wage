---
phase: 31-ssn-encryption-foundation
plan: 02
subsystem: api+ui
tags: [aes-256-gcm, encryption, workers-route, zod, react, ssn-masking]

# Dependency graph
requires:
  - 31-01 (cryptoService.ts, ssn_encrypted column)
provides:
  - Workers API accepts full 9-digit SSN; encrypts on write; never returns ssnEncrypted
  - hasFullSsn boolean in all worker API responses (derived from envelope len field)
  - WorkersPage.tsx 9-digit SSN input (type=password), masked display, partial SSN badge
affects:
  - 31-03 (CA eCPR and WA PWIA XML export — decrypt SSN for XML)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - encryptSsn envelope includes len field — hasFullSsn derivable without decrypting
    - Worker API responses always destructure ssnEncrypted before returning (three response paths)
    - SSN input uses type=password + inputMode=numeric + maxLength=9 + autoComplete=off
    - Edit form never pre-populates SSN field (server-side encrypted; client never has raw value)

key-files:
  created: []
  modified:
    - src/server/routes/workers.ts
    - src/server/services/cryptoService.ts
    - src/client/pages/WorkersPage.tsx

key-decisions:
  - "encryptSsn envelope now includes len field — GET handler reads len without decrypting to derive hasFullSsn, avoiding D-15 violation"
  - "UpdateWorkerSchema uses ssn as optional nullable — omitting ssn from PUT body preserves existing encrypted value unchanged"
  - "Edit form SSN field never pre-populated — encrypted server-side; client never holds raw SSN"
  - "Full SSN not on file badge shown in edit view when ssnLast4 present and !hasFullSsn — informational prompt to enter full SSN"

requirements-completed: [SEC-01, SEC-03]

# Metrics
duration: 10min
completed: 2026-03-28
---

# Phase 31 Plan 02: Workers Route + UI — SSN Encrypt on Write and Masked Display Summary

**Worker routes accept full 9-digit SSN, encrypt via cryptoService on write, derive ssnLast4, strip ssnEncrypted from all three response paths, add hasFullSsn boolean. WorkersPage.tsx collects 9-digit SSN with password masking and shows "Full SSN not on file" badge on edit view for partial-only workers.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-28T15:50:00Z
- **Completed:** 2026-03-28T15:56:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `cryptoService.ts` envelope updated to include `len: plaintext.length` — allows GET handler to derive `hasFullSsn` by reading `len` from JSON without calling `decryptSsn` (avoids D-15 violation)
- `CreateWorkerSchema` and `UpdateWorkerSchema` replaced `ssnLast4` with `ssn` (9-digit, digits-only regex, optional)
- POST handler: encrypts `body.ssn` via `encryptSsn`, derives `ssnLast4` from `body.ssn.slice(-4)`, strips `ssnEncrypted` from response, adds `hasFullSsn`
- PUT handler: same encrypt-on-update pattern, strips `ssnEncrypted`, adds `hasFullSsn`
- GET list handler: derives `hasFullSsn` from envelope `len` field, destructures `ssnEncrypted` out before returning
- `WorkersPage.tsx` Worker interface extended with `hasFullSsn: boolean`
- Add worker form: `type="password"`, `inputMode="numeric"`, `maxLength={9}`, `autoComplete="off"`, placeholder `123456789`, label "Social Security Number (optional)"
- Edit worker form: same input + helper text "Enter 9-digit SSN to update. Leave blank to keep current value." + `<Badge variant="neutral">Full SSN not on file</Badge>` shown when `ssnLast4 && !hasFullSsn`
- `workerToEditForm` never pre-populates SSN (always blank)
- `handleSubmit`/`handleEditSave`: validate digits-only and exactly-9-length with per-spec error messages
- `addWorker` mutation sends `ssn` field; `updateWorker` mutation omits `ssn` when blank (preserves existing)

## Task Commits

1. **Task 1: workers.ts + cryptoService.ts** — `4659f13` (feat)
2. **Task 2: WorkersPage.tsx** — `541a315` (feat)

## Files Created/Modified

- `src/server/routes/workers.ts` — Zod schemas updated, encrypt on write, hasFullSsn derived, ssnEncrypted stripped from all three response paths
- `src/server/services/cryptoService.ts` — `len` field added to JSON envelope; `decryptSsn` type assertion updated with optional `len?`
- `src/client/pages/WorkersPage.tsx` — 9-digit SSN input (type=password), masked display already present, partial SSN badge on edit view, validation updated

## Decisions Made

- **len field in envelope:** The cleanest approach to derive `hasFullSsn` server-side without decrypting. Envelope JSON is already stored; adding `len` metadata is zero-cost and backward compatible (field is optional in `decryptSsn` type assertion).
- **omit ssn from PUT when blank:** Sending `ssn: undefined` means the `'ssn' in body` check in workers.ts is false, so existing `ssnEncrypted` and `ssnLast4` are preserved. This is the correct UX for the edit form where the user may leave SSN blank to keep the existing value.
- **Badge placement in edit form only:** Per D-12 and UI-SPEC.md, the badge appears only on the edit view. Card list is a scanning view; badge adds noise without actionability there.

## Deviations from Plan

### Minor additions (not deviations — part of Task 2 as specified)

**1. [Enhancement] cryptoService.ts len field added in Task 1 commit (not Task 2)**
- The plan described the `len` field change under Task 2 steps 5-6 but it is logically coupled to Task 1 (workers.ts GET handler needs it). Both changes were committed in Task 1 for atomicity.
- No functional impact — all tests pass.

## Issues Encountered

None.

## Known Stubs

None — all SSN fields are fully wired. The `hasFullSsn` boolean is derived from the envelope `len` field (set correctly at encrypt time in both new entries and the backfill script from Plan 01 — backfilled 4-digit values get `len: 4`, new 9-digit entries get `len: 9`).

## Self-Check

Files exist and commits present — verified below.

## Self-Check: PASSED

- `src/server/routes/workers.ts` — modified (contains `encryptSsn` import and `ssn` field in schemas)
- `src/server/services/cryptoService.ts` — modified (contains `len: plaintext.length` in envelope)
- `src/client/pages/WorkersPage.tsx` — modified (contains `type="password"` and `hasFullSsn`)
- Commit `4659f13` — Task 1
- Commit `541a315` — Task 2
