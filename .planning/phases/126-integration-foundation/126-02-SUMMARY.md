---
phase: 126-integration-foundation
plan: 02
subsystem: api
tags: [typescript, interfaces, crypto, oauth, erp, aes-256-gcm, security]

requires:
  - phase: 126-01
    provides: DB migration 0070 (integration_connections + integration_sync_runs) + schema + WAL busy_timeout

provides:
  - IErpAdapter TypeScript interface with SyncResult type (3 methods)
  - integrationVault.ts — pure re-export of encryptSsn/decryptSsn as encryptCredential/decryptCredential
  - erpSerializer.ts — SEC-01 compliant stub using explicit inclusion list (no SSN in output)
  - Math.random() OAuth nonce security fix in integrations.ts (both QBO + Procore)
  - 9 unit tests covering vault round-trip, identity assertion, crypto-import absence, SSN exclusion, no-spread, nonce hardening

affects: [127-procore-adapter, 128-sage300-adapter, 129-vista-adapter, 130-qbo-employee-sync]

tech-stack:
  added: []
  patterns:
    - "IErpAdapter interface: every ERP adapter implements exactly pullWorkers, pullTimesheets, pushComplianceStatus"
    - "integrationVault.ts: pure re-export pattern — adapters import encryptCredential/decryptCredential from this file only"
    - "erpSerializer.ts: explicit inclusion list (no spread) — SEC-01 contract for all outbound ERP payloads"
    - "TDD red-green-commit cycle: test files written first, verified failing, then implementation written"

key-files:
  created:
    - src/server/integrations/IErpAdapter.ts
    - src/server/integrations/integrationVault.ts
    - src/server/integrations/erpSerializer.ts
    - tests/server/integrationVault.test.ts
    - tests/server/erp-serializer-ssn.test.ts
    - tests/server/integrations-nonce.test.ts
  modified:
    - src/server/routes/integrations.ts

key-decisions:
  - "integrationVault.ts is a pure re-export — no new crypto logic, no node:crypto import, same function references as cryptoService.ts (Pitfall 4 prevention)"
  - "erpSerializer.ts uses explicit inclusion list — spread operator on worker rows is forbidden per SEC-01"
  - "Math.random() at lines 36 and 526 of integrations.ts replaced with crypto.randomBytes(16).toString('hex') — eliminates CSRF predictability in QBO + Procore OAuth flows"
  - "JSDoc comments must not contain forbidden patterns (createCipheriv, spread syntax) to pass source-file grep tests"

patterns-established:
  - "All ERP adapters (127-134) must import encryptCredential/decryptCredential from integrationVault.ts, never cryptoService.ts directly"
  - "All ERP serializers must use explicit field lists — no object spread or Object.assign on worker input"
  - "OAuth state nonces use randomBytes(16).toString('hex') — not Math.random()"

requirements-completed: [INTG-04, INTG-05, SEC-01, SEC-02]

duration: 11min
completed: 2026-05-12
---

# Phase 126 Plan 02: Integration Foundation — Adapter Interface + Vault + Security Fix Summary

**IErpAdapter TypeScript interface, AES-256-GCM credential vault re-export, SSN-safe ERP serializer stub, and Math.random() OAuth nonce security fix — 9 tests proving all contracts**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-12T15:34:59Z
- **Completed:** 2026-05-12T15:45:44Z
- **Tasks:** 2
- **Files modified/created:** 7

## Accomplishments

- Created `src/server/integrations/` directory with 3 contract-establishing files that all Phases 127-134 depend on
- Fixed CSRF predictability vulnerability: both QBO (line 36) and Procore (line 526) OAuth nonces now use `randomBytes(16).toString('hex')` instead of `Math.random().toString(36)`
- 9 tests across 3 new test files proving: vault round-trip, same-function-reference identity (Pitfall 4), no-crypto-import in vault, SSN exclusion, no-spread in serializer, nonce hardening — all green

## Task Commits

1. **Task 1: Create src/server/integrations/ with IErpAdapter, integrationVault, erpSerializer** - `50857b1` (feat)
2. **Task 2: Fix Math.random() OAuth nonce at lines 36 and 526 of integrations.ts** - `baa2850` (fix)

## Files Created/Modified

- `src/server/integrations/IErpAdapter.ts` — SyncResult type + IErpAdapter interface (3 methods); Phase 127-134 adapters implement this
- `src/server/integrations/integrationVault.ts` — Pure re-export of encryptSsn/decryptSsn as encryptCredential/decryptCredential; zero node:crypto imports
- `src/server/integrations/erpSerializer.ts` — SEC-01 compliant stub using explicit inclusion list; WorkerRowForErp input → ErpWorkerPayload output with no SSN
- `src/server/routes/integrations.ts` — Added `import { randomBytes } from 'node:crypto'`; replaced both Math.random() nonces with randomBytes(16).toString('hex')
- `tests/server/integrationVault.test.ts` — 3 tests: round-trip, same-reference identity, no-crypto-import assertion
- `tests/server/erp-serializer-ssn.test.ts` — 3 tests: no SSN/9-digit in output, no spread in source, field preservation
- `tests/server/integrations-nonce.test.ts` — 3 tests: no Math.random, 2+ randomBytes(16) nonces, import assertion

## Decisions Made

- **integrationVault.ts comment wording:** Avoided the words `createCipheriv`, `randomBytes`, `createDecipheriv` in JSDoc comments because the test reads the source file and matches forbidden patterns — revised to "native crypto primitives" as safe alternative
- **erpSerializer.ts comment wording:** Avoided `{ ...worker }` spread syntax in JSDoc by writing "spread operator on worker rows is forbidden" instead — test greps source for the spread pattern
- **Nonce fix line numbers:** Plan cited lines 37/626 but actual worktree has them at lines 36/526 (minor line-count difference from worktree state) — fixed both regardless of exact line number

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test-matching forbidden patterns in JSDoc comments**
- **Found during:** Task 1 (integrationVault.ts first run)
- **Issue:** The plan's verbatim content for both integrationVault.ts and erpSerializer.ts included the exact forbidden strings (`createCipheriv` in vault comment, `{ ...worker }` spread in serializer comment) that the source-reading tests grep for — causing test failures even though code was correct
- **Fix:** Rewrote JSDoc comments to describe forbidden patterns without using the forbidden pattern text itself
- **Files modified:** src/server/integrations/integrationVault.ts, src/server/integrations/erpSerializer.ts
- **Verification:** All 6 Task 1 tests pass green
- **Committed in:** 50857b1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's verbatim content)
**Impact on plan:** Minor wording change to JSDoc comments. All test assertions and security contracts preserved exactly as specified.

## Issues Encountered

None beyond the JSDoc comment fix above.

## Nonce Fix Line Numbers

Post-edit locations in integrations.ts (worktree):
- QBO OAuth nonce: line 37 (after comment added)
- Procore OAuth nonce: line 527 (after comment added)

Confirmed: `grep -c "Math.random" src/server/routes/integrations.ts` returns 0.

## integrationVault.ts Verification

- `grep -c "node:crypto" src/server/integrations/integrationVault.ts` returns 0
- `grep -c "createCipheriv\|randomBytes" src/server/integrations/integrationVault.ts` returns 0
- File contains exactly one line: the re-export from cryptoService.js

## Test Results

Total tests across 3 new test files: **9 passing, 0 failing**

| File | Tests | Status |
|------|-------|--------|
| tests/server/integrationVault.test.ts | 3 | PASS |
| tests/server/erp-serializer-ssn.test.ts | 3 | PASS |
| tests/server/integrations-nonce.test.ts | 3 | PASS |

## Next Phase Readiness

- Phase 127 (Procore adapter) can now implement `IErpAdapter` interface from `src/server/integrations/IErpAdapter.ts`
- Phase 127+ adapters must import `encryptCredential`/`decryptCredential` from `src/server/integrations/integrationVault.ts`
- All serializers must follow the explicit-inclusion-list pattern established in `erpSerializer.ts`
- No blockers. 0 TypeScript errors. 9 new tests passing.

---
*Phase: 126-integration-foundation*
*Completed: 2026-05-12*
