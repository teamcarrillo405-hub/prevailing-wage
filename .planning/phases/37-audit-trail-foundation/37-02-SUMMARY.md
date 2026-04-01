---
phase: 37-audit-trail-foundation
plan: "02"
subsystem: audit-service
tags: [audit-trail, ssn-redaction, append-only, tdd]
dependency_graph:
  requires: [37-01]
  provides: [insertAuditLog, diffObjects, InsertAuditLogInput]
  affects: [future Phase 38 route instrumentation]
tech_stack:
  added: []
  patterns: [append-only service, SSN redaction at write boundary, TDD red-green]
key_files:
  created:
    - src/server/services/auditService.ts
    - tests/services/auditService.test.ts
  modified: []
decisions:
  - "redactSensitiveFields is NOT exported — it is an internal write-side guard, not a reusable utility"
  - "diffObjects IS exported — callers in Phase 38+ will use it before calling insertAuditLog"
  - "hasSensitiveNonNull checks key presence with 'ssnEncrypted' in obj — never inspects the encrypted ciphertext value"
  - "Zero imports from cryptoService.ts — avoids process.exit startup assertion in test environment"
  - "SSN detection fires on both diff.before and diff.after independently — either side triggers hasFullSsn"
metrics:
  duration: 8m
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
requirements: [AUDIT-02, NFR-04]
---

# Phase 37 Plan 02: auditService.ts — insertAuditLog, diffObjects, SSN Redaction Summary

**One-liner:** Append-only audit service with SSN redaction at the write boundary and hasFullSsn meta enrichment using TDD red-green cycle.

## What Was Built

`src/server/services/auditService.ts` — the single entry point for all audit logging in the application.

### Exported API

| Export | Type | Purpose |
|--------|------|---------|
| `insertAuditLog(input)` | `async function → void` | Write one immutable row to audit_logs (AUDIT-02) |
| `diffObjects(before, after, omitFields?)` | `function → DiffResult \| null` | Compute changed fields between two objects for callers |
| `InsertAuditLogInput` | `interface` | TypeScript contract for insertAuditLog callers |

### Key Behaviors

**Append-only enforcement (AUDIT-02):** No `updateAuditLog` or `deleteAuditLog` exported — TypeScript module boundary enforces this at compile time.

**SSN redaction (NFR-04):** `redactSensitiveFields()` runs on every `snapshot` and every `diff.before`/`diff.after` before the row is written. `ssnEncrypted` (and `passwordHash`) are replaced with `"[REDACTED]"`. Null values remain null.

**hasFullSsn meta enrichment (NFR-04):** When a non-null `ssnEncrypted` is detected in snapshot or diff, `hasFullSsn: true` is merged into the meta JSON column. Callers can pass additional meta fields — they are preserved alongside `hasFullSsn`.

**diffObjects helper:** Omits `updatedAt`, `createdAt`, `updated_at`, `created_at` by default. Returns `null` when objects are identical. Callers pass `omitFields` to extend the exclusion list.

## Tests

`tests/services/auditService.test.ts` — 9 tests, all green.

| Test | Description |
|------|-------------|
| diffObjects: returns changed fields only | {a:1,b:2} vs {a:1,b:3} → {before:{b:2},after:{b:3}} |
| diffObjects: returns null when no changes | {a:1} vs {a:1} → null |
| diffObjects: omits updatedAt and created_at | Timestamp fields excluded from diff |
| insertAuditLog: inserts a row readable from the DB | Basic insert + select verification |
| insertAuditLog: redacts ssnEncrypted in snapshot | Ciphertext replaced with "[REDACTED]" |
| insertAuditLog: preserves null ssnEncrypted | null remains null, not "[REDACTED]" |
| insertAuditLog: adds hasFullSsn: true to meta | Non-null SSN triggers hasFullSsn flag |
| insertAuditLog: redacts ssnEncrypted in diff before/after | Both sides of diff redacted |
| module exports: no update/delete | updateAuditLog and deleteAuditLog absent from module |

## Verification

- `npx vitest run tests/services/auditService.test.ts` — 9/9 tests pass
- `npx vitest run --exclude ".claude/**"` — 396/396 tests pass, 31 test files
- `npx tsc --noEmit` — pre-existing error in projects.ts(110,49) only (out of scope)
- `grep updateAuditLog|deleteAuditLog src/server/services/auditService.ts` — no matches
- `grep cryptoService src/server/services/auditService.ts` — no matches

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 (RED) | c442dd0 | test(37-02): add failing tests for auditService (RED) |
| Task 2 (GREEN) | d549587 | feat(37-02): implement auditService.ts — insertAuditLog, diffObjects, SSN redaction |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is wired and tested. No placeholder data or TODO stubs in created files.

## Self-Check: PASSED
