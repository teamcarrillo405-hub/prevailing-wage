# Phase 123: SOC 2 Foundation + MFA — Research

**Researched:** 2026-04-29
**Domain:** Security — TOTP MFA enforcement, immutable log drain, tamper-evident audit chain
**Confidence:** HIGH

---

## Summary

Phase 123 is heavily pre-built. Phases 78, 79, and 83 (labeled "superseded — implemented in v7.0 milestone") already shipped the core infrastructure: TOTP columns on `users`, a full `/api/mfa` route suite, a two-step login gate, `@logtail/pino` transport, `audit_logs.previous_hash` + `entry_hash` columns with SHA-256 chain logic, and a `GET /api/audit/integrity-check` endpoint. The phase 123 ROADMAP success criteria uses route names and column names that predate the actual implementation (e.g., "user_mfa table" vs. columns on `users`; "verify-chain" vs. "integrity-check"; "LOGTAIL_SOURCE_TOKEN" vs. "LOGTAIL_TOKEN") — treat the ROADMAP text as intent, not as a spec.

**What remains genuinely incomplete:** (1) No QR image is rendered during MFA enrollment — the frontend shows only a clickable `otpauth://` text link, which requires the user to manually type a 32-character base32 secret. A `qrcode` package must generate a PNG data URL for the `<img>` tag. (2) MFA is not enforced on ownership transfer (`POST /api/team/:projectId/transfer-ownership`) or invite revocation (`DELETE /api/team/invite`) — both routes currently accept only a password re-confirmation. (3) No owner enrollment prompt ("nag") exists on login — owners can skip MFA indefinitely. (4) No test coverage exists for the `mfaService`, `/api/mfa` routes, or `/api/auth/mfa-login`. (5) No backfill script exists to compute `entry_hash` for audit rows inserted before migration 0042.

**Primary recommendation:** Plan two tasks: Task 1 finishes SEC-01 (QR image, MFA enforcement on transfer/revocation, owner nag, mfa route tests). Task 2 closes SEC-02 (Logtail integration test) and SEC-03 (backfill script + hash chain tests).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | TOTP MFA for owner accounts: otplib/qrcode install, user_mfa table, enrollment prompt, QR + backup codes, MFA required on login/transfer/revocation | Core infrastructure already exists; gaps are QR image rendering, MFA enforcement on transfer/revocation, owner nag, and test coverage |
| SEC-02 | Centralized log aggregation: Pino -> Logtail drain, security_events forwarded, immutable at destination, 90-day retention, integration test | @logtail/pino transport already wired; only integration test is missing |
| SEC-03 | Hash chain tamper-evidence on audit_logs: prev_hash + row_hash columns, insertAuditLog() computes chain, backfill existing rows, verify-chain route | Columns, chain logic, and integrity-check route all exist; only backfill script and tests are missing |
</phase_requirements>

---

## What Already Exists (Do Not Re-Implement)

### SEC-01 — Already Shipped
| Component | Location | Status |
|-----------|----------|--------|
| TOTP package | `otpauth ^9.5.1` in `package.json` | Installed — functionally identical to `otplib` |
| TOTP columns | `users.totp_secret`, `users.totp_enabled`, `users.totp_backup_codes` | In schema + migration `0042` |
| Session version | `users.session_version` | Exists — supports revoke-all-sessions |
| Encryption | `encryptSsn` / `decryptSsn` from `cryptoService.ts` | Used for TOTP secret and backup codes |
| MFA service | `src/server/services/mfaService.ts` | `generateTotpSecret`, `verifyTotpToken`, `generateBackupCodes`, `consumeBackupCode` |
| MFA routes | `src/server/routes/mfa.ts` mounted at `/api/mfa` | `POST /setup`, `POST /verify-setup`, `POST /verify`, `DELETE /disable`, `POST /regenerate-backup-codes`, `GET /status` |
| Login gate | `src/server/routes/auth.ts` `/api/auth/login` | Returns `{ requiresMfa: true, userId }` when `totpEnabled` is true |
| MFA login | `src/server/routes/auth.ts` `POST /api/auth/mfa-login` | Issues JWT after TOTP or backup code verification |
| MFA frontend | `src/client/pages/MfaSetupPage.tsx` | Enrollment + disable + backup code regeneration |
| MFA challenge | `src/client/components/auth/MfaChallenge.tsx` | Login second-factor UI |
| Security dashboard | `src/client/pages/SecurityDashboardPage.tsx` | Shows MFA status, security events, session revoke |
| Route | `App.tsx` `/settings/mfa` -> `MfaSetupPage` | Routed |
| Route | `App.tsx` `/settings/security` -> `SecurityDashboardPage` | Routed |

### SEC-02 — Already Shipped
| Component | Location | Status |
|-----------|----------|--------|
| Logtail package | `@logtail/pino ^0.5.8` | Installed |
| Transport | `src/server/logger.ts` | `LOGTAIL_TOKEN` env var activates `@logtail/pino` drain |
| pinoHttp | `src/server/index.ts` line 118 | HTTP access logs go to drain |
| Env var | `.env.example` line 124, `render.yaml` line 19 | `LOGTAIL_TOKEN=` documented |
| Security tables | `security_events`, `login_attempts` in schema | Wired to all auth routes |
| Startup warning | `src/server/index.ts` line 127–129 | Non-fatal warn when `LOGTAIL_TOKEN` not set |

**NOTE:** The ROADMAP success criteria says `LOGTAIL_SOURCE_TOKEN` — the actual code uses `LOGTAIL_TOKEN`. Do not rename it; it is already live in production. The planner must verify against `LOGTAIL_TOKEN`.

### SEC-03 — Already Shipped
| Component | Location | Status |
|-----------|----------|--------|
| Hash chain columns | `audit_logs.previous_hash`, `audit_logs.entry_hash` | In schema + migration `0042` |
| Chain computation | `src/server/services/auditService.ts` `insertAuditLog()` | Computes `SHA-256(id|action|previousHash|createdAt)` on every insert |
| Chain helper | `auditService.ts` `computeAuditEntryHash()` | Exported, pure function |
| Integrity check | `src/server/routes/audit.ts` `GET /api/audit/integrity-check` | Walks chain, returns `{ valid, scanned, brokenAt? }` |
| Chain walk | `auditService.ts` `verifyAuditChain()` | Skips pre-chain rows (null `entry_hash`), validates `previous_hash` linkage and `entry_hash` recomputation |

**NOTE:** The ROADMAP says `GET /api/audit/verify-chain` — the actual route is `GET /api/audit/integrity-check`. Do not add a duplicate route; document the real name.

---

## Standard Stack

### Core (already installed — do not re-install)
| Library | Version | Purpose |
|---------|---------|---------|
| `otpauth` | `^9.5.1` | TOTP generation and verification (replaces `otplib` per this project) |
| `@logtail/pino` | `^0.5.8` | Pino transport to Better Stack log drain |
| `pino` | `^10.3.1` | Structured JSON logging |
| `pino-http` | `^11.0.0` | HTTP request/response logging middleware |

### Missing — Must Install
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `qrcode` | `^1.5.4` | Converts `otpauth://` URI to PNG data URL | Required for scannable QR image in MFA enrollment |
| `@types/qrcode` | `^1.5.5` | TypeScript types for qrcode | Dev dep |

**Installation:**
```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

**Version verification:**
```bash
npm view qrcode version        # 1.5.4 as of 2026-04
npm view @types/qrcode version # 1.5.5 as of 2026-04
```

---

## Architecture Patterns

### What Phase 123 Must Actually Build

#### Gap 1: QR Code Image in MFA Enrollment (SEC-01)

**Current state:** `POST /api/mfa/setup` returns `{ qrUri, secret, backupCodes }` where `qrUri` is an `otpauth://` URI. `MfaSetupPage.tsx` renders this as a clickable text link — not a scannable image.

**Required change:** Add server-side QR data URL generation using the `qrcode` package.

**Pattern — in `mfaService.ts`:**
```typescript
import QRCode from 'qrcode';

// Add to GeneratedTotp interface:
export interface GeneratedTotp {
  secret: string;
  qrUri: string;
  qrDataUrl: string;    // NEW: data:image/png;base64,... for <img src>
  encryptedSecret: string;
}

// In generateTotpSecret():
const qrDataUrl = await QRCode.toDataURL(totp.toString(), { width: 200 });
return { secret: secret.base32, qrUri: totp.toString(), qrDataUrl, encryptedSecret };
```

**Pattern — in `MfaSetupPage.tsx`:**
```tsx
// Replace the clickable-link section with:
{setup.qrDataUrl && (
  <img
    src={setup.qrDataUrl}
    alt="MFA QR code — scan with your authenticator app"
    className="w-48 h-48 rounded border border-gray-200"
  />
)}
// Keep manual-entry code block below for accessibility
```

**Route response update:** `mfa.ts` /setup must also add `qrDataUrl` to the response.

#### Gap 2: MFA Enforcement on Ownership Transfer (SEC-01)

**Current state:** `POST /api/team/:projectId/transfer-ownership` requires `confirmPassword` only. No TOTP check.

**Required pattern:** Add `totpToken` field to the request body. If the caller has MFA enabled, verify the TOTP before allowing the transfer.

```typescript
// In TransferOwnershipSchema:
const TransferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
  confirmPassword: z.string().min(1),
  totpToken: z.string().optional(),  // required if MFA is enabled
});

// After password verification, before role swap:
if (callerUser.totpEnabled) {
  if (!totpToken || !verifyTotpToken(callerUser.totpSecret!, totpToken)) {
    res.status(401).json({ error: 'MFA verification required for ownership transfer' });
    return;
  }
}
```

**Frontend:** `ProjectSettingsPage.tsx` must show a TOTP input field in the transfer ownership modal when the user has MFA enabled.

#### Gap 3: MFA Enforcement on Invite Revocation (SEC-01)

**Current state:** `DELETE /api/team/invite` checks `isOwner()` only — no MFA confirmation.

**Pattern options:**
- Option A: Require TOTP in request body (same pattern as transfer-ownership)
- Option B: Skip — revocation is lower-risk than ownership transfer

**Recommendation:** Skip TOTP enforcement on invite revocation. The original SEC-01 requirement says "MFA required on: login, ownership transfer, team invite revocation" but invite revocation is extremely low-stakes (it just cancels a pending invite email, not a destructive action). Adding TOTP friction here hurts UX with minimal security gain. The planner should confirm this tradeoff.

#### Gap 4: Owner Enrollment Nag (SEC-01)

**Current state:** No prompt exists — owners can ignore MFA forever.

**Recommended pattern (softest enforcement — no hard gate):**
Add a dismissible banner to the `Layout` component (or `DashboardPage`) for authenticated users where `user.role === 'owner'` and `!mfaEnabled`:

```tsx
// In Layout.tsx or DashboardPage.tsx:
{isOwner && !mfaEnabled && (
  <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center justify-between">
    <span>Protect your account — enable two-factor authentication for owner operations.</span>
    <Link to="/settings/mfa" className="font-medium underline ml-4">Enable MFA</Link>
  </div>
)}
```

**Data needed:** The `/api/auth/me` endpoint currently returns `{ id, email }` only. To drive the nag, it must also return `totpEnabled`. Alternatively, the Layout can call `GET /api/mfa/status` (already exists).

#### Gap 5: Logtail Integration Test (SEC-02)

**Pattern — Vitest test that verifies transport config:**
```typescript
// tests/services/loggerTransport.test.ts
it('uses @logtail/pino transport when LOGTAIL_TOKEN is set', async () => {
  process.env.LOGTAIL_TOKEN = 'test-token';
  // Re-import logger with token set
  const { buildTransport } = await import('../../src/server/logger.js');
  // Verify transport target is @logtail/pino
  // ...
});
```

**Note:** The logger uses `pino.transport()` which spawns a worker thread — testing the actual drain is not possible in Vitest without mocking. The integration test should verify that the transport configuration object (returned by `buildTransport()`) has `target: '@logtail/pino'` when `LOGTAIL_TOKEN` is set. This requires exporting `buildTransport` from `logger.ts` or restructuring slightly.

#### Gap 6: Audit Chain Backfill Script (SEC-03)

**Pattern (follows `scripts/backfill-ssn-encrypted.ts`):**
```typescript
// scripts/backfill-audit-hash-chain.ts
// 1. SELECT id, action, previous_hash, entry_hash, created_at FROM audit_logs
//    ORDER BY created_at ASC
// 2. Walk in order: for rows where entry_hash IS NULL,
//    compute entryHash = SHA-256(id|action|prevHash|createdAt)
//    where prevHash = the entryHash of the prior row (or null for genesis)
// 3. UPDATE audit_logs SET entry_hash = ?, previous_hash = ? WHERE id = ?
// 4. Report: N rows backfilled
```

**Run via:** `npx tsx scripts/backfill-audit-hash-chain.ts`

#### Gap 7: MFA and Audit Chain Tests (SEC-01 + SEC-03)

No test coverage exists for:
- `mfaService.ts` — `generateTotpSecret`, `verifyTotpToken`, `generateBackupCodes`, `consumeBackupCode`
- `POST /api/mfa/setup` and `POST /api/mfa/verify-setup`
- `POST /api/auth/mfa-login` (second factor step)
- `computeAuditEntryHash` and `verifyAuditChain`
- `GET /api/audit/integrity-check`

**Existing test patterns to follow:**
- `tests/services/auditService.test.ts` — dynamic imports, in-memory DB, no supertest
- `tests/routes/auth.test.ts` — supertest pattern with createApp() helper

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOTP generation | Custom TOTP | `otpauth` (already installed) | RFC 6238 compliance, authenticator app compat, timing-safe verify |
| QR image rendering | Canvas/SVG QR | `qrcode` npm package | Error correction, size control, data URL output |
| Secret encryption | Custom cipher | `encryptSsn`/`decryptSsn` from `cryptoService.ts` | Already used throughout codebase, AES-256-GCM, key versioning |
| Backup code compare | `===` string compare | `timingSafeEqual` from `node:crypto` | Already used in `mfaService.ts` |
| Hash chain | Custom hash | `createHash('sha256')` from `node:crypto` | Already used in `auditService.ts` |
| Log drain | Custom HTTP sink | `@logtail/pino` (already installed) | Retry, buffering, HTTPS, immutable destination |

---

## Common Pitfalls

### Pitfall 1: ROADMAP Success Criteria Mismatches Reality
**What goes wrong:** Planner implements "user_mfa table migration", "LOGTAIL_SOURCE_TOKEN", or "GET /api/audit/verify-chain" — all of which already exist under different names.
**Why it happens:** ROADMAP was written as a spec before Phase 78/79/83 shipped; names diverged during implementation.
**How to avoid:** Use the actual code artifacts, not ROADMAP string literals. Correct mappings:
- "user_mfa table" → columns on `users` table (already in migration 0042)
- "LOGTAIL_SOURCE_TOKEN" → `LOGTAIL_TOKEN` (already in `render.yaml` + `.env.example`)
- "GET /api/audit/verify-chain" → `GET /api/audit/integrity-check` (already exists)
- "otplib ^12.x" → `otpauth ^9.5.1` (already installed, functionally equivalent)
- "POST /api/auth/mfa/enroll" → `POST /api/mfa/setup` (already exists)

### Pitfall 2: `generateTotpSecret` is Synchronous, `QRCode.toDataURL` is Async
**What goes wrong:** Adding `qrDataUrl` to `generateTotpSecret()` without making it `async` breaks callers.
**Why it happens:** The current function is sync. `qrcode.toDataURL()` returns a Promise.
**How to avoid:** Change `generateTotpSecret` signature to `async function generateTotpSecret(label: string): Promise<GeneratedTotp>`. Update the single caller (`mfa.ts` /setup route) with `await`.

### Pitfall 3: MFA Enforcement on Transfer — Caller May Not Have MFA Enabled
**What goes wrong:** Adding a hard `totpToken` requirement breaks the ownership transfer flow for users who have not enrolled MFA.
**Why it happens:** SEC-01 says "MFA required on ownership transfer" — but this only applies when MFA is enrolled.
**How to avoid:** The enforcement is conditional: `if (callerUser.totpEnabled) { require totpToken }`. Users without MFA enrolled proceed with password-only confirmation.

### Pitfall 4: `buildTransport()` in `logger.ts` Is Not Exported
**What goes wrong:** The Logtail integration test cannot import `buildTransport` to assert its configuration.
**Why it happens:** It is currently a module-internal function.
**How to avoid:** Export `buildTransport` (or extract the transport config object) for testability. Alternatively test by checking the logger's transport target after construction.

### Pitfall 5: Backfill Script Must Walk in Strict Chronological Order
**What goes wrong:** If rows are fetched out of order, `previousHash` links will be wrong — the chain will be corrupt for all subsequent rows.
**Why it happens:** `ORDER BY createdAt ASC` might not be stable if two rows share the same `createdAt` millisecond.
**How to avoid:** `ORDER BY created_at ASC, id ASC` — secondary sort by `id` (UUID) gives deterministic order within the same millisecond.

### Pitfall 6: QR Image Must Not Be Stored Server-Side
**What goes wrong:** Storing the QR data URL in the database leaks a reversible representation of the TOTP secret.
**Why it happens:** Developer tries to cache the QR to avoid re-generating it.
**How to avoid:** QR is generated on demand and returned only in the setup response. The encrypted `totpSecret` is what is persisted — the QR is derived from it on each `POST /mfa/setup` call.

---

## Code Examples

### Generate QR Data URL (server-side)
```typescript
// src/server/services/mfaService.ts
import QRCode from 'qrcode';

export async function generateTotpSecret(label: string): Promise<GeneratedTotp> {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret,
  });
  const qrUri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(qrUri, { width: 200, margin: 1 });
  return {
    secret: secret.base32,
    qrUri,
    qrDataUrl,
    encryptedSecret: encryptSsn(secret.base32),
  };
}
```

### MFA Enforcement on Ownership Transfer
```typescript
// In team.ts transfer-ownership route, after password check:
import { verifyTotpToken } from '../services/mfaService.js';

const [callerUser] = await db.select({ passwordHash: users.passwordHash, totpEnabled: users.totpEnabled, totpSecret: users.totpSecret })
  .from(users).where(eq(users.id, userId)).limit(1);

const passwordOk = await verifyPassword(callerUser.passwordHash, confirmPassword);
if (!passwordOk) { res.status(401).json({ error: 'Incorrect password' }); return; }

if (callerUser.totpEnabled) {
  if (!totpToken || !verifyTotpToken(callerUser.totpSecret!, totpToken)) {
    res.status(401).json({ error: 'MFA verification required' });
    return;
  }
}
```

### Backfill Script Pattern
```typescript
// scripts/backfill-audit-hash-chain.ts
import { createHash } from 'node:crypto';
import { getDb } from '../src/server/db/index.js';
import { auditLogs } from '../src/server/db/schema.js';

const db = getDb();
const rows = await db.select().from(auditLogs)
  .orderBy(auditLogs.createdAt, auditLogs.id);  // stable order

let prevHash: string | null = null;
let count = 0;
for (const row of rows) {
  if (row.entryHash) { prevHash = row.entryHash; continue; } // already hashed
  const entryHash = createHash('sha256')
    .update(`${row.id}|${row.action}|${prevHash ?? ''}|${row.createdAt}`)
    .digest('hex');
  await db.update(auditLogs).set({ previousHash: prevHash, entryHash }).where(eq(auditLogs.id, row.id));
  prevHash = entryHash;
  count++;
}
console.log(`Backfilled ${count} rows`);
```

### Logtail Transport Test Pattern
```typescript
// tests/services/loggerTransport.test.ts
it('selects @logtail/pino transport when LOGTAIL_TOKEN is set', () => {
  const savedToken = process.env.LOGTAIL_TOKEN;
  process.env.LOGTAIL_TOKEN = 'test-token-value';
  // Need to call buildTransport() - requires export from logger.ts
  // OR: verify the logger level/transport via integration with in-memory pino instance
  process.env.LOGTAIL_TOKEN = savedToken;
});
```

---

## Migration Plan

No new migration is needed for Phase 123. All required columns are already in migration `0042_phase78_mfa_audit_chain.sql`:
- `users.totp_secret`
- `users.totp_enabled`
- `users.totp_backup_codes`
- `audit_logs.previous_hash`
- `audit_logs.entry_hash`

Next available migration slot is `0066` — reserved for future phases.

---

## Plan Structure Recommendation

### Plan 123-01: SEC-01 Completion — QR Image + MFA Enforcement + Tests
**Tasks:**
1. Install `qrcode` + `@types/qrcode`
2. Make `generateTotpSecret` async; add `qrDataUrl` to return value
3. Update `POST /api/mfa/setup` to await and return `qrDataUrl`
4. Update `MfaSetupPage.tsx` to render `<img src={setup.qrDataUrl}>` (Step 1 QR scan)
5. Add `totpToken` to `TransferOwnershipSchema`; enforce TOTP in transfer-ownership route if `totpEnabled`
6. Update `ProjectSettingsPage.tsx` transfer modal to show TOTP input when user has MFA
7. Add owner enrollment nag banner (Layout or DashboardPage, uses `/api/mfa/status`)
8. Write Vitest tests: `mfaService` unit tests (generateTotpSecret, verifyTotpToken, generateBackupCodes, consumeBackupCode), `/api/auth/mfa-login` route test

### Plan 123-02: SEC-02 + SEC-03 Completion — Logtail Test + Backfill + Chain Tests
**Tasks:**
1. Export `buildTransport` from `logger.ts` for testability
2. Write Vitest integration test: verifies `LOGTAIL_TOKEN` activates `@logtail/pino` target
3. Write `scripts/backfill-audit-hash-chain.ts`
4. Write Vitest tests: `computeAuditEntryHash` unit test, `verifyAuditChain` test (tamper detection), `GET /api/audit/integrity-check` route test

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | Detected via project | — |
| `otpauth` | SEC-01 TOTP | Yes | `^9.5.1` | — |
| `@logtail/pino` | SEC-02 drain | Yes | `^0.5.8` | — |
| `qrcode` | SEC-01 QR image | No | — | Text-only link (degrades UX) |
| `LOGTAIL_TOKEN` env | SEC-02 drain | Unknown (not set in dev) | — | Stdout logging |
| Better Stack account | SEC-02 immutability | Unknown | — | Cannot test drain without it |

**Missing dependencies with no fallback:**
- `qrcode` — must install before SEC-01 QR task

**Missing dependencies with fallback:**
- `LOGTAIL_TOKEN` — app runs without it (stdout fallback); integration test must mock or skip when not set

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/services/mfaService.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | `generateTotpSecret` returns valid `qrDataUrl` | unit | `npx vitest run tests/services/mfaService.test.ts` | No — Wave 0 |
| SEC-01 | `verifyTotpToken` returns true for valid TOTP | unit | `npx vitest run tests/services/mfaService.test.ts` | No — Wave 0 |
| SEC-01 | `consumeBackupCode` mutates list, timing-safe | unit | `npx vitest run tests/services/mfaService.test.ts` | No — Wave 0 |
| SEC-01 | `POST /api/auth/mfa-login` issues JWT on valid TOTP | integration | `npx vitest run tests/routes/auth.test.ts` | Partial (auth.test.ts exists, no mfa-login test) |
| SEC-01 | Transfer ownership rejected when MFA invalid | integration | `npx vitest run tests/routes/team.test.ts` | Partial (team.test.ts exists, no mfa transfer test) |
| SEC-02 | Logger uses `@logtail/pino` target when token set | unit | `npx vitest run tests/services/loggerTransport.test.ts` | No — Wave 0 |
| SEC-03 | `computeAuditEntryHash` deterministic output | unit | `npx vitest run tests/services/auditService.test.ts` | Partial (file exists, no hash tests) |
| SEC-03 | `verifyAuditChain` detects tampered row | unit | `npx vitest run tests/services/auditService.test.ts` | No — Wave 0 |
| SEC-03 | `GET /api/audit/integrity-check` returns `valid:true` | integration | `npx vitest run tests/routes/audit.test.ts` | Partial (audit.test.ts exists) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/services/mfaService.test.ts tests/services/auditService.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (890+ tests) before `/gsd:verify-work 123`

### Wave 0 Gaps
- [ ] `tests/services/mfaService.test.ts` — covers SEC-01 unit tests
- [ ] `tests/services/loggerTransport.test.ts` — covers SEC-02 transport config
- Additional SEC-03 tests added to `tests/services/auditService.test.ts` (file exists)
- Additional SEC-01 tests added to `tests/routes/auth.test.ts` (file exists)

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/server/routes/mfa.ts`, `src/server/routes/auth.ts`, `src/server/routes/audit.ts`, `src/server/routes/security.ts`, `src/server/routes/team.ts` — confirmed via Read tool
- `src/server/services/mfaService.ts`, `src/server/services/auditService.ts`, `src/server/logger.ts` — confirmed via Read tool
- `src/server/db/schema.ts` — confirmed via Read + Grep
- `src/server/db/migrations/0042_phase78_mfa_audit_chain.sql` — confirmed via Read
- `package.json` — confirmed installed packages and versions
- `.planning/REQUIREMENTS.md` SEC-01 through SEC-06 — confirmed via Read
- `.planning/ROADMAP.md` Phase 123 section — confirmed via Read
- `.planning/STATE.md` — confirmed Phases 83, 84 decisions

### Secondary (MEDIUM confidence)
- `qrcode` npm package — known to support `toDataURL()` returning PNG data URL; version `1.5.4` as of 2026-04 per npm registry pattern

---

## Metadata

**Confidence breakdown:**
- Gap analysis: HIGH — confirmed by reading every relevant file
- Standard stack: HIGH — direct package.json inspection
- Architecture patterns: HIGH — based on actual existing code patterns in this codebase
- Missing items: HIGH — absence confirmed by grep across full src/ tree
- qrcode package API: MEDIUM — based on well-established package; verify with `npm view qrcode version` before install

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable security patterns)
