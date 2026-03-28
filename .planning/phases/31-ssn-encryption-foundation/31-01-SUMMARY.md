---
phase: 31-ssn-encryption-foundation
plan: 01
subsystem: database
tags: [aes-256-gcm, encryption, node:crypto, drizzle, sqlite, migration]

# Dependency graph
requires: []
provides:
  - AES-256-GCM encryptSsn/decryptSsn functions in cryptoService.ts
  - workers.ssn_encrypted nullable text column via migration 0016
  - Startup assertion that exits if ENCRYPTION_KEY_V1 missing/invalid
  - One-time backfill script for existing ssnLast4 values
affects:
  - 31-02 (worker routes — encrypt on write, derive last-4)
  - 31-03 (CA eCPR and WA PWIA XML export — decrypt SSN for XML)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Versioned JSON envelope for encrypted fields: {"v":"1","iv":"<base64>","tag":"<base64>","ct":"<base64>"}
    - Module-level startup assertion pattern for required env vars (mirrors stateWageAdapter side-effect import)
    - TDD: test file sets env var via process.env before dynamic import of module under test

key-files:
  created:
    - src/server/services/cryptoService.ts
    - src/server/db/migrations/0016_workers_ssn_encrypted.sql
    - scripts/backfill-ssn-encrypted.ts
    - tests/services/cryptoService.test.ts
  modified:
    - src/server/db/schema.ts
    - src/server/db/migrations/meta/_journal.json
    - src/server/index.ts
    - .env.example

key-decisions:
  - "AES-256-GCM via node:crypto built-in — no third-party crypto package; GCM provides authenticated encryption"
  - "Per-record random 12-byte IV via randomBytes(12) — never reuse IV across records"
  - "Versioned JSON envelope in ssn_encrypted column — key version embedded for future rotation without full re-encrypt"
  - "ENCRYPTION_KEY_V1 env var as 64-char hex (32 bytes) — same pattern as JWT_SECRET on Render.com"
  - "ssnLast4 column kept unchanged — WH-347, compliance CSV, cross-project history all read ssnLast4 exclusively"
  - "Backfill script encrypts existing ssnLast4 (4-digit) values — CA eCPR can check length to detect partial SSN"

patterns-established:
  - "cryptoService.ts is a pure module — all node:crypto calls isolated here; no I/O"
  - "Dynamic import in test file allows process.env to be set before module-level assertion fires"
  - "Migration SQL manually registered in _journal.json at next sequential idx"

requirements-completed: [SEC-01]

# Metrics
duration: 15min
completed: 2026-03-28
---

# Phase 31 Plan 01: SSN Encryption Foundation Summary

**AES-256-GCM cryptoService module with versioned JSON envelope, workers migration adding ssn_encrypted column, startup key assertion, and backfill script for existing ssnLast4 data**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-28T08:46:00Z
- **Completed:** 2026-03-28T08:49:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- cryptoService.ts exports encryptSsn/decryptSsn using AES-256-GCM with random 12-byte IV per record, versioned JSON envelope, and module-level startup assertion that exits on missing/invalid key or self-test failure
- Workers table extended with ssn_encrypted nullable text column via migration 0016, registered at idx 12 in _journal.json, schema.ts updated
- Backfill script ready to run on production: reads all workers with non-null ssnLast4, encrypts each 4-digit value into ssnEncrypted column by worker id
- index.ts updated with side-effect import of cryptoService so startup assertion fires before app.listen()

## Task Commits

Each task was committed atomically:

1. **Task 1: cryptoService AES-256-GCM + 6 unit tests** - `bd1e137` (feat - TDD green)
2. **Task 2: Schema migration + journal + schema + startup import + backfill + .env.example** - `fb992d2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/server/services/cryptoService.ts` - AES-256-GCM encrypt/decrypt, versioned JSON envelope, startup assertion + self-test
- `tests/services/cryptoService.test.ts` - 6 unit tests: round-trip, JSON shape, random IV, tamper detection, version error, 4-digit partial
- `src/server/db/migrations/0016_workers_ssn_encrypted.sql` - ALTER TABLE workers ADD COLUMN ssn_encrypted TEXT
- `src/server/db/migrations/meta/_journal.json` - idx 12 entry for 0016_workers_ssn_encrypted
- `src/server/db/schema.ts` - ssnEncrypted nullable text column added to workers table definition
- `src/server/index.ts` - side-effect import of cryptoService.js for startup key assertion
- `scripts/backfill-ssn-encrypted.ts` - one-time backfill: encrypt ssnLast4 -> ssnEncrypted for all workers
- `.env.example` - ENCRYPTION_KEY_V1 placeholder added

## Decisions Made
- Used dynamic import (`await import(...)`) in test file so `process.env.ENCRYPTION_KEY_V1` is set before the module-level assertion fires. Static top-level import would run before `process.env` assignment.
- No refactor phase was needed — implementation was clean from green phase.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — cryptoService is fully wired. The backfill script is a run-once operational tool, not a stub. Workers with only ssnLast4 (no full SSN) will have 4-digit encrypted values; Plans 31-02 and 31-03 handle the UI and XML export layers respectively.

## User Setup Required

Before starting the server, add to `.env`:
```
ENCRYPTION_KEY_V1=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

Run backfill after migration:
```
npx tsx scripts/backfill-ssn-encrypted.ts
```

## Next Phase Readiness
- cryptoService.ts is the foundation for Plans 31-02 (worker routes — full SSN input) and 31-03 (CA eCPR / WA PWIA decrypt)
- Migration must be applied to production DB before deploying any code that reads ssn_encrypted
- ENCRYPTION_KEY_V1 must be set in Render.com env before deploy

---
*Phase: 31-ssn-encryption-foundation*
*Completed: 2026-03-28*
