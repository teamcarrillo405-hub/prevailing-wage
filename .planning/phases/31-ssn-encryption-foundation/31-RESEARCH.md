# Phase 31: SSN Encryption Foundation — Research

**Researched:** 2026-03-27
**Domain:** AES-256-GCM field-level encryption in Node.js + Express + SQLite; SSN input UX; server startup assertions; Vitest service testing
**Confidence:** HIGH — all findings derived from direct source code inspection of the project, confirmed against locked decisions in CONTEXT.md and existing STACK/ARCHITECTURE/PITFALLS research

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Encryption Algorithm (SEC-01)**
- D-01: AES-256-GCM via `node:crypto` built-in — no third-party crypto package
- D-02: Per-record random 12-byte IV (`crypto.randomBytes(12)`) — never reused across records
- D-03: Versioned JSON envelope stored in `ssnEncrypted` column: `{"v":"1","iv":"<base64>","tag":"<base64>","ct":"<base64>"}`
- D-04: Encryption key stored as `ENCRYPTION_KEY_V1` env var — 32-byte value encoded as 64-char hex string, same pattern as `JWT_SECRET` and `INVITE_CODE`
- D-05: Server startup assertion — process exits immediately if `ENCRYPTION_KEY_V1` is missing or self-test fails

**Schema (SEC-01)**
- D-06: Add `ssn_encrypted` nullable text column to `workers` table via SQL-only migration, manually registered in `src/server/db/migrations/meta/_journal.json`
- D-07: `ssn_last4` column is NOT dropped or modified; kept as derived convenience column written at create/update time from the last 4 digits of the full SSN

**Existing Worker Migration (SEC-01)**
- D-08: For existing workers with non-null `ssn_last4`, migration encrypts the 4-digit value into `ssnEncrypted`; CA eCPR generator checks decrypted length: 4 digits = partial/placeholder fallback, 9 digits = real SSN
- D-09: Workers with `ssn_last4 IS NULL` get `ssnEncrypted = NULL`

**Worker Input UX (SEC-03)**
- D-10: Existing `ssnLast4` 4-digit input replaced with a single full 9-digit SSN input field — no side-by-side dual fields
- D-11: `CreateWorkerSchema` and `UpdateWorkerSchema` change from `ssnLast4: z.string().length(4)` to `ssn: z.string().length(9).optional()`. On write: encrypt full SSN → `ssnEncrypted`; derive last 4 → `ssnLast4`
- D-12: All UI views display SSN as `***-**-1234`; workers with only 4-digit encrypted partial show "Full SSN not on file" badge
- D-13: Raw SSN value never returned in any API response; `ssnEncrypted` never sent to client; server routes return `ssnLast4` only

**cryptoService.ts (SEC-01)**
- D-14: Create `src/server/services/cryptoService.ts` — pure module, no I/O; exports `encryptSsn(plaintext: string): string` and `decryptSsn(envelope: string): string`
- D-15: `decryptSsn()` called ONLY from CA eCPR XML generator and WA PWIA XML generator in `export.ts` — never from list/detail routes

**CA eCPR and WA PWIA XML Generators (SEC-02)**
- D-16: CA eCPR (~line 584 in export.ts): replace `ssn10 = '000000' + ssnLast4` with decrypt call; null or non-9-digit fallback to placeholder
- D-17: WA PWIA (~line 775 in export.ts): replace `ssn9 = '00000' + ssnLast4` with decrypt call; same fallback
- D-18: `getPayrollEntriesWithWorkerDetails()` extended to join `ssn_encrypted` from `workers` alongside `workerSsnLast4`

### Claude's Discretion
- Exact input field type for SSN entry (password-type to mask while typing, or text with a show/hide toggle)
- Exact wording for the "Full SSN not on file" badge (vs "Partial SSN only")
- Placement of startup assertion code (server entry point vs a dedicated `startup.ts` module)
- Whether "Full SSN not on file" badge appears on the worker card list or only on the worker detail/edit view
- Key validation: whether to include a `GET /health` endpoint that reports encryption status without revealing the key

### Deferred Ideas (OUT OF SCOPE)
- Full SSN on WH-347 — federal standard uses last-4 only; permanently out of scope
- KMS-backed key management — Render.com env var sufficient; v4+ SOC 2 milestone
- SSN field show/hide toggle in UI — Claude's discretion on input type
- Key rotation tooling — runbook document is sufficient for v3.0; automated rotation is v4+
- Audit log of every decrypt event — deferred to v4+ compliance milestone
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | System collects and stores full SSNs (9 digits) encrypted at rest with AES-256; existing `ssn_last4` plain-text values are encrypted in the migration | cryptoService.ts pattern (D-14), migration pattern (D-06, D-08), schema change (D-07), workers.ts route update (D-11) |
| SEC-02 | Full SSN used exclusively for CA eCPR XML pre-fill and WA L&I PWIA portal pre-fill; CA eCPR XML generator updated to write real SSN replacing the v2.5 placeholder | export.ts exact line numbers identified (584, 775); getPayrollEntriesWithWorkerDetails() extension pattern confirmed (D-18) |
| SEC-03 | SSN is masked in all UI views (`***-**-1234`); full value only decrypted server-side at export time | WorkersPage.tsx exact lines identified; both form inputs (add + edit) located; display pattern confirmed |
</phase_requirements>

---

## Summary

Phase 31 adds AES-256-GCM encryption for worker SSNs in the prevailing-wage app. It is purely additive — one new column, one new service, updates to two routes and two export generators — with zero risk to existing WH-347, compliance, or CSV export flows. All decisions are locked in CONTEXT.md and verified against the live source code.

The research is authoritative because it comes from direct inspection of the project's actual files, not from external documentation. Every integration point, line number, and exact method signature referenced below was read from source. The planner can write tasks directly from this document without further investigation.

**Primary recommendation:** Execute in 5 waves — (1) migration + schema, (2) cryptoService.ts + startup assertion, (3) workers.ts route updates, (4) payrollService.ts + export.ts fixes, (5) WorkersPage.tsx UI changes. Each wave is independently testable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` | Built-in (Node.js 20+) | AES-256-GCM cipher operations | Zero new dependencies; GCM provides authenticated encryption; confirmed in STACK.md and Node.js docs |
| `drizzle-orm/better-sqlite3` | Installed (existing) | Schema type extension for new column | Already in use; add-only column migration is the established project pattern |
| `zod` | Installed (existing) | Input validation schema update in workers.ts | Already in use for all route validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `better-sqlite3` | Installed (existing) | Test DB via `tests/helpers/db.ts` | In-memory SQLite for cryptoService unit tests that need DB verification |
| `vitest` | Installed (existing) | Test framework | All test files use `describe/it/expect` from vitest |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:crypto` AES-256-GCM | `crypto-js` npm package | Never for server-side Node.js 20+; `crypto-js` is browser-targeted; built-in is zero-dependency and battle-tested |
| Versioned JSON envelope `{"v":"1",...}` | Colon-delimited `iv:tag:ct` string | STACK.md documents the colon-delimited pattern, CONTEXT.md locks the JSON envelope — JSON envelope is correct per decisions |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/server/
├── services/
│   └── cryptoService.ts        # NEW — pure module, encryptSsn / decryptSsn
├── routes/
│   └── workers.ts              # MODIFIED — schema + POST/PUT handlers
│   └── export.ts               # MODIFIED — CA eCPR line 584, WA PWIA line 775
├── services/
│   └── payrollService.ts       # MODIFIED — getPayrollEntriesWithWorkerDetails()
└── index.ts                    # MODIFIED — startup assertion before app.listen()

src/server/db/
├── schema.ts                   # MODIFIED — ssnEncrypted column on workers
└── migrations/
    ├── meta/_journal.json      # MODIFIED — register new migration at idx 12
    └── 0016_workers_ssn_encrypted.sql   # NEW

src/client/pages/
└── WorkersPage.tsx             # MODIFIED — SSN form fields (add + edit)

.env.example                    # MODIFIED — add ENCRYPTION_KEY_V1= placeholder

tests/services/
└── cryptoService.test.ts       # NEW
```

### Pattern 1: Migration Convention (SQL-only, manually registered)

**What:** Every migration is a plain SQL file with `ALTER TABLE ... ADD COLUMN` statements. Multiple statements use `--> statement-breakpoint` between them. After writing the SQL file, the `_journal.json` is updated manually with the next `idx` and a descriptive `tag`.

**When to use:** Any schema change — this project never uses `drizzle-kit push` in production.

**Current last migration:** `idx: 11`, `tag: "0015_wa_pwia_intent_id"` — next is `idx: 12`.

**Example from `0014_ca_ecpr_fringe_columns.sql`:**
```sql
ALTER TABLE payroll_entries ADD COLUMN fringe_health_welfare REAL;
--> statement-breakpoint
ALTER TABLE payroll_entries ADD COLUMN fringe_pension REAL;
```

**New migration `0016_workers_ssn_encrypted.sql`:**
```sql
ALTER TABLE workers ADD COLUMN ssn_encrypted TEXT;
```

**Note:** The backfill of existing `ssn_last4` values into `ssn_encrypted` CANNOT be done in SQL — the encryption happens in Node.js. The backfill must be a separate migration script (run once via `npm run migrate:backfill` or equivalent) that: reads all workers with non-null `ssn_last4`, calls `encryptSsn(worker.ssnLast4)`, and writes the result to `ssn_encrypted`. This is NOT inline in the SQL migration file.

**Journal entry for `_journal.json`:**
```json
{
  "idx": 12,
  "version": "6",
  "when": 1774950000000,
  "tag": "0016_workers_ssn_encrypted",
  "breakpoints": true
}
```

**Test DB note:** `tests/helpers/db.ts` runs `migrate(db, { migrationsFolder: './src/server/db/migrations' })` — so the new migration SQL file is automatically picked up in tests once the journal is updated.

### Pattern 2: cryptoService.ts — Pure Module

**What:** A pure TypeScript service with no I/O or side effects. Reads key from env at module init. Exports two functions.

**When to use:** Any route that needs to encrypt or decrypt an SSN.

**Confirmed TypeScript code:**
```typescript
// src/server/services/cryptoService.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_HEX = process.env.ENCRYPTION_KEY_V1;
if (!KEY_HEX || KEY_HEX.length !== 64) {
  // Startup assertion fires here — see Pattern 5
}
const KEY = Buffer.from(KEY_HEX!, 'hex');

export function encryptSsn(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: '1',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
  });
}

export function decryptSsn(envelope: string): string {
  const { v, iv: ivB64, tag: tagB64, ct: ctB64 } = JSON.parse(envelope) as {
    v: string; iv: string; tag: string; ct: string;
  };
  if (v !== '1') throw new Error(`Unknown SSN envelope version: ${v}`);
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
```

### Pattern 3: workers.ts Route Integration

**Current state (exact code read from source):**

`CreateWorkerSchema` (line 17–22):
```typescript
const CreateWorkerSchema = z.object({
  name: z.string().min(1).max(200),
  ssnLast4: z.string().length(4).optional(),
  tradeUnion: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
});
```

`UpdateWorkerSchema` (line 24–29):
```typescript
const UpdateWorkerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ssnLast4: z.string().length(4).optional().nullable(),
  tradeUnion: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});
```

**POST handler DB write (line 161–171):**
```typescript
await db.insert(workers).values({
  id,
  projectId,
  name: body.name,
  ssnLast4: body.ssnLast4 ?? null,
  tradeUnion: body.tradeUnion ?? null,
  address: body.address ?? null,
  isActive: true,
  createdAt: now,
  updatedAt: now,
});
```

**PUT handler updates object (line 192–196):**
```typescript
const updates: Record<string, unknown> = { updatedAt: now };
if (body.name !== undefined) updates.name = body.name;
if ('ssnLast4' in body) updates.ssnLast4 = body.ssnLast4 ?? null;
if ('tradeUnion' in body) updates.tradeUnion = body.tradeUnion ?? null;
if ('address' in body) updates.address = body.address ?? null;
```

**Changes required:**
- Schema: replace `ssnLast4: z.string().length(4)` with `ssn: z.string().length(9).regex(/^\d{9}$/).optional()` in both schemas
- POST handler: when `body.ssn` present, call `encryptSsn(body.ssn)` → `ssnEncrypted`; set `ssnLast4 = body.ssn.slice(-4)`; when absent, both remain null
- PUT handler: same logic with `'ssn' in body` guard
- GET response (line 131): The `...w` spread returns all worker columns — must strip `ssnEncrypted` from the response. Options: (a) use a typed select that omits the column, or (b) delete from result object before `res.json()`
- POST response (line 174): `const [worker] = await db.select()...` — same stripping needed

**Exact field name decision:** Use `ssn` as the API input field name (not `ssnFull` or `ssnInput`). The Zod schema accepts `ssn`, strips hyphens if needed, encrypts, derives last-4.

### Pattern 4: getPayrollEntriesWithWorkerDetails() Extension

**Current function (payrollService.ts line 259–281):**
```typescript
export async function getPayrollEntriesWithWorkerDetails(weekId: string) {
  const db = getDb();
  const rows = await db
    .select({
      entry: payrollEntries,
      workerName: workers.name,
      workerSsnLast4: workers.ssnLast4,
      workerAddress: workers.address,
      tradeDescription: workerClassifications.tradeDescription,
      tradeCode: workerClassifications.tradeCode,
      waTradeCode: workerClassifications.waTradeCode,
      laborType: workerClassifications.laborType,
      programName: workerClassifications.programName,
    })
    .from(payrollEntries)
    .innerJoin(workers, eq(payrollEntries.workerId, workers.id))
    .innerJoin(
      workerClassifications,
      eq(payrollEntries.classificationId, workerClassifications.id),
    )
    .where(eq(payrollEntries.payrollWeekId, weekId));
  return rows;
}
```

**Change required:** Add one field to the `.select()` object:
```typescript
workerSsnEncrypted: workers.ssnEncrypted,
```

This requires `workers.ssnEncrypted` to exist in the Drizzle schema first (Wave 1 prerequisite).

### Pattern 5: Export.ts SSN Replacement

**CA eCPR (lines 584–585):**
```typescript
// CURRENT:
const ssnLast4 = row.workerSsnLast4 || '0000';
const ssn10 = '000000' + ssnLast4;

// REPLACEMENT:
let ssn10: string;
if (row.workerSsnEncrypted) {
  try {
    const plain = decryptSsn(row.workerSsnEncrypted);
    ssn10 = plain.length === 9 ? plain : ('000000' + (row.workerSsnLast4 || '0000'));
  } catch {
    ssn10 = '000000' + (row.workerSsnLast4 || '0000');
  }
} else {
  ssn10 = '000000' + (row.workerSsnLast4 || '0000');
}
```

**WA PWIA (line 775):**
```typescript
// CURRENT:
const ssn9 = '00000' + (row.workerSsnLast4 || '0000');

// REPLACEMENT:
let ssn9: string;
if (row.workerSsnEncrypted) {
  try {
    const plain = decryptSsn(row.workerSsnEncrypted);
    ssn9 = plain.length === 9 ? plain : ('00000' + (row.workerSsnLast4 || '0000'));
  } catch {
    ssn9 = '00000' + (row.workerSsnLast4 || '0000');
  }
} else {
  ssn9 = '00000' + (row.workerSsnLast4 || '0000');
}
```

**Note:** The CA eCPR `ssn10` is used at line 624: `ssn: ssn10`. The WA PWIA `ssn9` is used at line 789: `ssn: ssn9`. The surrounding code is unchanged.

### Pattern 6: Server Entry Point Startup Assertion

**Server entry point:** `src/server/index.ts` — confirmed. The server calls `app.listen(PORT, ...)` at line 59.

**Placement options (Claude's discretion):**
- Option A: Inline at top of `index.ts` — before any `import` side effects complete. Simplest.
- Option B: Import from `cryptoService.ts` — the module-level key validation in `cryptoService.ts` throws on import if the key is missing. The `import './services/cryptoService.js'` in `index.ts` causes the process to throw before `app.listen()`.
- Option C: `startup.ts` helper module imported in `index.ts` before `app.listen()`

**Recommendation:** Option B is the cleanest — `cryptoService.ts` validates the key at module load time. The startup assertion is co-located with the crypto code. No separate call needed in `index.ts`; the module import is the assertion. Add a known-plaintext self-test in the module body:

```typescript
// Module-level assertion in cryptoService.ts
const KEY_HEX = process.env.ENCRYPTION_KEY_V1;
if (!KEY_HEX || KEY_HEX.length !== 64) {
  console.error('[startup] ENCRYPTION_KEY_V1 missing or invalid (must be 64-char hex)');
  process.exit(1);
}
const KEY = Buffer.from(KEY_HEX, 'hex');
// Self-test
try {
  const testCt = encryptSsn('123456789');
  const testPt = decryptSsn(testCt);
  if (testPt !== '123456789') throw new Error('round-trip mismatch');
} catch (err) {
  console.error('[startup] Encryption self-test failed:', err);
  process.exit(1);
}
```

**Ensure `cryptoService.ts` is imported in `index.ts`** — even if not called directly, the module-level assertion fires. This is consistent with the existing pattern: `import './services/stateWageAdapter.js'; // side-effect import` at line 22.

### Pattern 7: WorkersPage.tsx UI Changes

**Both SSN input fields confirmed in source. Exact locations:**

Add Worker form (line 606–612):
```tsx
<div>
  <label className="block text-xs text-gray-600 mb-1">SSN Last 4 (optional)</label>
  <input type="text" maxLength={4} value={form.ssnLast4}
    onChange={e => setForm(p => ({ ...p, ssnLast4: e.target.value.replace(/\D/g, '') }))}
    placeholder="e.g. 4321"
    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
  />
</div>
```

Edit Worker form (line 328–335):
```tsx
<div>
  <label className="block text-xs text-gray-600 mb-1">SSN Last 4</label>
  <input type="text" maxLength={4} value={editForm.ssnLast4}
    onChange={e => setEditForm(p => ({ ...p, ssnLast4: e.target.value.replace(/\D/g, '') }))}
    placeholder="optional"
    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold"
  />
</div>
```

**SSN display in worker card (line 384):**
```tsx
{w.ssnLast4 && <span className="mr-3">SSN: ***-**-{w.ssnLast4}</span>}
```

**Worker interface (line 41–48):**
```tsx
interface Worker {
  id: string;
  name: string;
  ssnLast4: string | null;
  tradeUnion: string | null;
  address: string | null;
  classifications: Classification[];
}
```

**Changes required:**
1. `blankWorkerForm()` at line 66: rename `ssnLast4: ''` to `ssn: ''`
2. `Worker` interface: keep `ssnLast4` as-is (returned from API); no `ssn` or `ssnEncrypted` field needed
3. Add Worker form: change label to "SSN (optional)", type to `"password"` or `"text"`, `maxLength={9}`, `value={form.ssn}`, validation to `form.ssn.length !== 9`
4. Edit Worker form: same changes, field name `editForm.ssn`; placeholder shows masked value hint
5. API calls: change `ssnLast4: f.ssnLast4` to `ssn: f.ssn` in `addWorker.mutationFn` (line 146) and remove from `updateWorker.mutationFn` (line 179) in favor of `ssn: data.ssn || undefined`
6. Validation in `handleSubmit` (line 232): change to `form.ssn && form.ssn.replace(/-/g, '').length !== 9`
7. Display: `{w.ssnLast4 && <span>SSN: ***-**-{w.ssnLast4}</span>}` unchanged — still reads from `ssnLast4` which server derives
8. "Full SSN not on file" badge: the `w.ssnLast4` condition at line 387 already handles the case; for workers migrated from 4-digit `ssnLast4`, the badge is unchanged

**Missing data badge (line 387–389):**
```tsx
{(!w.address || !w.ssnLast4) && (
  <Badge variant="warning" className="mt-1">Missing data — WH-347 blocked</Badge>
)}
```
This badge checks `!w.ssnLast4`. Migrated workers retain their `ssnLast4`, so the badge is not affected. New workers with no SSN entered get `ssnLast4 = null` → badge fires as before.

### Pattern 8: SSN Input Masking (Claude's Discretion — Recommendation)

**Recommendation:** Use `type="password"` for the SSN input fields. This provides:
- Native browser masking while typing (circles/dots)
- No dependencies on a specialized input masking library
- Password manager auto-fill suppression (desirable for SSN)
- No "show/hide" toggle (which is listed as deferred)

**Accept hyphens or digits-only:** Add a `replace(/\D/g, '')` normalizer on `onChange` so `123-45-6789` becomes `123456789` before validation and API call. The Zod schema on the server validates `z.string().length(9).regex(/^\d{9}$/)`.

### Anti-Patterns to Avoid

- **Encrypting `ssnLast4` column:** Keep `ssnLast4` plaintext — it drives compliance history cross-project matching (`name + ssnLast4` identity key) and WH-347 display. Only `ssnEncrypted` is the new column (Pitfall 15 from PITFALLS.md).
- **Returning `ssnEncrypted` in API response:** All GET routes use `...w` spread from `db.select()` — must explicitly strip `ssnEncrypted` from the workers list and worker detail responses before sending JSON.
- **Static IV:** `randomBytes(12)` is called inside `encryptSsn()` on every invocation — never derived from worker ID, timestamp, or any deterministic input (Pitfall 14).
- **Backfilling in SQL:** The migration adds the column; the backfill runs as a Node.js script using `encryptSsn()`. Do not attempt crypto in SQLite triggers.
- **Calling `decryptSsn()` from any route other than export.ts:** Confirmed call sites are only the CA eCPR and WA PWIA generators.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM cipher | Custom cipher, XOR, or CBC wrapper | `node:crypto` `createCipheriv('aes-256-gcm', ...)` | GCM provides authentication tag; CBC requires separate HMAC; built-in is audited |
| Per-record IV | Sequential counter, timestamp, worker ID hash | `crypto.randomBytes(12)` | Random IV is the only IV that guarantees ciphertext non-determinism |
| Envelope format | Column per component (`iv_col`, `tag_col`, `ct_col`) | Single `ssn_encrypted TEXT` column with JSON `{"v","iv","tag","ct"}` | Simpler migration; version field enables future key rotation without schema change |
| Key validation | Manual hex string checks | Module-level assertion + self-test in `cryptoService.ts` | Catches misconfigured deploy before first user request; co-located with crypto code |
| Input masking | Third-party `react-input-mask` or `imask` | `type="password"` + `replace(/\D/g, '')` | Zero dependencies; native browser behavior handles masking |

**Key insight:** Every component of this phase has a direct built-in or existing solution. The work is integration, not invention.

---

## Common Pitfalls

### Pitfall 1: ssnEncrypted column leaks into API responses via `...w` spread
**What goes wrong:** `GET /api/projects/:projectId/workers` at line 113–131 of workers.ts uses `...w` to spread the worker row into the result. Once `ssnEncrypted` is added to the schema, it is included in every `db.select()` call that selects all columns, which then spreads into the response.
**Why it happens:** Drizzle `db.select()` with no field restriction returns all columns. The `...w` spread in the result map passes them all to `res.json()`.
**How to avoid:** In the GET workers route, either (a) use a typed select that explicitly omits `ssnEncrypted`, or (b) destructure to omit: `const { ssnEncrypted: _omit, ...safeWorker } = w`. Same fix needed in the POST response (line 173–174) and PUT response (line 199–200) that re-fetch the worker after write.
**Warning signs:** Browser devtools network tab shows `ssnEncrypted` field in any `/workers` response.

### Pitfall 2: Migration backfill runs before ENCRYPTION_KEY_V1 is set
**What goes wrong:** If the backfill script is run before the `ENCRYPTION_KEY_V1` env var is configured on Render.com, `cryptoService.ts` exits the process. The column exists but all `ssn_encrypted` values are NULL, and no error is visible in the DB.
**Why it happens:** Render.com env var changes require a redeploy to take effect in some configurations. A deploy that adds the SQL migration may run before the env var is set.
**How to avoid:** Document the deployment order: (1) set `ENCRYPTION_KEY_V1` in Render.com dashboard, (2) trigger redeploy, (3) run backfill script. Never reverse this order. The startup assertion catches the wrong order — server will not start without the key.
**Warning signs:** Server logs show `[startup] ENCRYPTION_KEY_V1 missing or invalid` after deploy.

### Pitfall 3: Drizzle schema not updated before running Vitest tests
**What goes wrong:** `tests/helpers/db.ts` runs `migrate(db, { migrationsFolder: './src/server/db/migrations' })`. The schema.ts is also imported. If `ssnEncrypted` is added to the SQL migration but not to `schema.ts` (or vice versa), tests fail with a "column does not exist" error or TypeScript type error.
**Why it happens:** Two places must be updated in sync: the SQL migration file and `schema.ts`. Missing either breaks either runtime or TypeScript.
**How to avoid:** Always update both in the same wave. The schema.ts change is a one-liner: `ssnEncrypted: text('ssn_encrypted'),` on the `workers` table definition.
**Warning signs:** Test suite fails with `no such column: ssn_encrypted` or TypeScript reports `Property 'ssnEncrypted' does not exist`.

### Pitfall 4: Export.ts decryptSsn import not added
**What goes wrong:** The export route file currently has no import from `cryptoService.ts`. If the planner writes tasks that reference `decryptSsn(row.workerSsnEncrypted)` in export.ts without including the import, TypeScript compilation fails.
**Why it happens:** The integration point is clear in CONTEXT.md but easy to miss in the task action list.
**How to avoid:** The export.ts task must include `import { decryptSsn } from '../services/cryptoService.js';` at the top of the file as an explicit step.

### Pitfall 5: 9-digit SSN hyphen handling mismatch between UI and server
**What goes wrong:** The UI `onChange` strips non-digits before sending (producing `"123456789"`). But if the user pastes `123-45-6789` with hyphens into the field and the `replace(/\D/g, '')` is accidentally omitted, the server receives `"123-45-6789"` (11 chars), which fails `z.string().length(9)` validation with a 422 error.
**Why it happens:** The existing pattern for the 4-digit field already uses `replace(/\D/g, '')` — this must be preserved in the new 9-digit field.
**How to avoid:** Keep `onChange={e => setForm(p => ({ ...p, ssn: e.target.value.replace(/\D/g, '').slice(0, 9) }))}` — replace non-digits and hard-cap at 9.

---

## Code Examples

Verified patterns from direct source code inspection:

### Migration file format (from 0014_ca_ecpr_fringe_columns.sql)
```sql
ALTER TABLE workers ADD COLUMN ssn_encrypted TEXT;
```
Single `ALTER TABLE ... ADD COLUMN` — no `--> statement-breakpoint` needed for a single statement.

### Journal entry format (from _journal.json)
```json
{
  "idx": 12,
  "version": "6",
  "when": 1774950000000,
  "tag": "0016_workers_ssn_encrypted",
  "breakpoints": true
}
```

### Drizzle schema addition (matching workers table pattern in schema.ts)
```typescript
// In the workers sqliteTable definition, after the isActive line:
ssnEncrypted: text('ssn_encrypted'),   // nullable; AES-256-GCM JSON envelope {"v":"1","iv":"...","tag":"...","ct":"..."}
```

### Stripping ssnEncrypted from GET response (workers.ts)
```typescript
// In the result map:
return {
  ...w,
  ssnEncrypted: undefined,  // or: const { ssnEncrypted: _, ...safeW } = w; return { ...safeW, ... }
  classifications: classifications.map(...)
};
```

### Backfill script pattern (Node.js, not SQL)
```typescript
// scripts/backfill-ssn-encrypted.ts — run once
import { getDb } from '../src/server/db/index.js';
import { workers } from '../src/server/db/schema.js';
import { encryptSsn } from '../src/server/services/cryptoService.js';
import { isNotNull, isNull } from 'drizzle-orm';

const db = getDb();
const rows = await db.select({ id: workers.id, ssnLast4: workers.ssnLast4 })
  .from(workers)
  .where(isNotNull(workers.ssnLast4));

for (const row of rows) {
  const encrypted = encryptSsn(row.ssnLast4!);
  await db.update(workers).set({ ssnEncrypted: encrypted }).where(eq(workers.id, row.id));
}
console.log(`Backfilled ${rows.length} workers`);
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts, globals: true, environment: node) |
| Config file | `vitest.config.ts` at project root |
| Setup file | `tests/helpers/db.ts` — creates in-memory SQLite + runs all migrations |
| Quick run command | `npx vitest run tests/services/cryptoService.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | `encryptSsn()` returns valid JSON envelope with `v`, `iv`, `tag`, `ct` | unit | `npx vitest run tests/services/cryptoService.test.ts` | ❌ Wave 0 |
| SEC-01 | `decryptSsn(encryptSsn(ssn))` round-trips correctly | unit | `npx vitest run tests/services/cryptoService.test.ts` | ❌ Wave 0 |
| SEC-01 | Two calls to `encryptSsn()` with same input produce different ciphertext (random IV) | unit | `npx vitest run tests/services/cryptoService.test.ts` | ❌ Wave 0 |
| SEC-01 | `decryptSsn()` throws on tampered auth tag | unit | `npx vitest run tests/services/cryptoService.test.ts` | ❌ Wave 0 |
| SEC-01 | `decryptSsn()` throws on unknown version `v` | unit | `npx vitest run tests/services/cryptoService.test.ts` | ❌ Wave 0 |
| SEC-02 | CA eCPR XML contains full 9-digit SSN when `workerSsnEncrypted` has a 9-digit value | unit | `npx vitest run tests/services/ecprXmlGenerator.test.ts` | ❌ Wave 0 |
| SEC-02 | CA eCPR XML falls back to placeholder when `ssnEncrypted` is null | unit | same | ❌ Wave 0 |
| SEC-02 | WA PWIA XML contains full 9-digit SSN when encrypted 9-digit SSN available | unit | `npx vitest run tests/services/waCprXmlGenerator.test.ts` | exists (needs extension) |
| SEC-03 | `GET /workers` response never contains `ssnEncrypted` field | route integration | `npx vitest run tests/routes/workers.test.ts` | exists (needs extension) |
| SEC-03 | `POST /workers` with valid `ssn` field stores encrypted value; returns `ssnLast4` only | route integration | same | exists (needs extension) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/services/cryptoService.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work 31`

### Wave 0 Gaps
- [ ] `tests/services/cryptoService.test.ts` — covers SEC-01 (5 tests above)
- [ ] `tests/services/ecprXmlGenerator.test.ts` — covers SEC-02 CA eCPR path (new file; the export route test at `tests/routes/export.test.ts` exists but tests the HTTP layer; a unit test for the XML generator with mocked `decryptSsn` is cleaner)
- [ ] Extensions to `tests/routes/workers.test.ts` — covers SEC-03 API response stripping

*(Note: `waCprXmlGenerator.test.ts` already exists at `tests/services/waCprXmlGenerator.test.ts` — it uses fixture data with a hardcoded SSN string. It should be extended to test the decrypt path.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4-digit `ssnLast4` plaintext input field | 9-digit full SSN encrypted field | Phase 31 | Workers can now have full SSN for XML export; last-4 derived server-side |
| CA eCPR XML uses `000000` + last-4 placeholder | CA eCPR XML uses real decrypted SSN | Phase 31 | eCPR XML no longer requires manual SSN entry in DIR portal |
| WA PWIA XML uses `00000` + last-4 placeholder | WA PWIA XML uses real decrypted SSN | Phase 31 | PWIA XML is fully pre-populated |

**Deprecated/outdated after Phase 31:**
- `ssnLast4` as primary SSN input — still exists as a derived field for WH-347 display; no longer the input mechanism
- The v2.5 "SSN caveat" in CAE-03 (users must enter SSN directly in portal) — superseded by real SSN in XML

---

## Open Questions

1. **Backfill script placement and invocation**
   - What we know: the backfill cannot be in SQL; must run as Node.js after ENCRYPTION_KEY_V1 is set
   - What's unclear: whether to put it in `scripts/` with a `package.json` script entry, or as a one-off run instruction in the plan
   - Recommendation: create `scripts/backfill-ssn-encrypted.ts` with a `package.json` `"migrate:backfill"` script entry; document in the plan's deployment steps

2. **SSN Regex validation — hyphens allowed in Zod schema?**
   - What we know: the UI strips hyphens before sending; the server schema should enforce digits-only
   - What's unclear: whether to accept `123-45-6789` (11 chars, strip hyphens) or require `123456789` (9 digits) at the server boundary
   - Recommendation: server schema validates 9 digits only (`z.string().length(9).regex(/^\d{9}$/)`) — the UI normalizes before sending; cleaner server validation

3. **"Full SSN not on file" badge scope**
   - What we know: the current "Missing data" badge at line 387 fires when `!w.ssnLast4` — after migration, all workers with prior `ssnLast4` retain it
   - What's unclear: whether a new worker with no SSN entered should show a distinct badge vs the existing "Missing data — WH-347 blocked" badge
   - Recommendation (Claude's discretion): Add a separate `ssnEncrypted`-awareness badge only for workers where `ssnLast4 = null` (no SSN at all). Workers with a `ssnLast4` but no full 9-digit SSN (migrated from 4-digit backfill) don't need a special badge — their XML exports fall back gracefully.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node:crypto` | cryptoService.ts | ✓ | Node.js 20+ (built-in) | — |
| `ENCRYPTION_KEY_V1` env var | cryptoService.ts, backfill script | Must be set by operator | 64-char hex string | None — blocks server start |
| Drizzle ORM | schema.ts extension | ✓ | Installed | — |
| Vitest | test suite | ✓ | Installed | — |
| better-sqlite3 | test helper db.ts | ✓ | Installed | — |

**Missing dependencies with no fallback:**
- `ENCRYPTION_KEY_V1` — must be generated and set in `.env` (local) and Render.com environment before any encrypted write. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Missing dependencies with fallback:**
- None.

---

## Project Constraints (from CLAUDE.md)

These directives from `./CLAUDE.md` are mandatory and take precedence over any general recommendations:

| Directive | Impact on Phase 31 |
|-----------|-------------------|
| **NEVER hard-delete projects or payroll weeks** | Not applicable to this phase — no deletions |
| **DB Migration Pattern:** Plain SQL `ALTER TABLE ... ADD COLUMN` files in `src/server/db/migrations/`; always register in `meta/_journal.json`; next idx is 12 | Phase 31 migration is `0016_workers_ssn_encrypted.sql` at idx 12 |
| **Never drop or rename columns — add-only migrations only** | `ssnLast4` is kept; `ssnEncrypted` is added; no drops |
| **Design Tokens via `@theme` in `src/client/index.css`** | Any new badge in WorkersPage.tsx must use `text-brand-gold`, `bg-surface-card` etc., not hardcoded colors |
| **UI Primitives:** `Badge` variants: `compliant`, `violation`, `warning`, `neutral` | "Full SSN not on file" badge uses `variant="warning"` (same as existing "Missing data" badge) |
| **GSD Workflow:** Plans in `.planning/phases/NN-slug/NN-PP-PLAN.md` | Planner writes `31-01-PLAN.md`, `31-02-PLAN.md`, etc. |
| **Server port: 4099** | Smoke tests should hit `http://localhost:4099` |

**CLAUDE.md note on migration idx:** The CLAUDE.md was written when the highest idx was 4. Current source confirms the highest registered idx is 11 (`0015_wa_pwia_intent_id`). The next migration is idx 12, not "5" as CLAUDE.md's outdated reference suggests. The `_journal.json` source is authoritative.

---

## Sources

### Primary (HIGH confidence)
- `src/server/db/schema.ts` — read directly; workers table definition confirmed; `ssnLast4` plaintext; no `ssnEncrypted` yet
- `src/server/db/migrations/meta/_journal.json` — read directly; 12 entries, highest idx 11; next is idx 12
- `src/server/db/migrations/0014_ca_ecpr_fringe_columns.sql` — migration format with breakpoints confirmed
- `src/server/db/migrations/0015_wa_pwia_intent_id.sql` — single-statement migration format confirmed
- `src/server/routes/workers.ts` — read directly; Zod schemas at lines 17–29; DB writes at lines 161–171 and 192–196; full file reviewed
- `src/server/routes/export.ts` — Grepped for SSN patterns; confirmed line 584–585 (CA eCPR) and line 774–775 (WA PWIA); surrounding context read
- `src/server/services/payrollService.ts` — `getPayrollEntriesWithWorkerDetails()` at line 259–281 read directly
- `src/server/index.ts` — read directly; `app.listen()` at line 59; cron setup inside callback; side-effect import pattern at line 22
- `src/client/pages/WorkersPage.tsx` — SSN fields at lines 606–612 (add) and 328–335 (edit); display at line 384; mutations at lines 142–198; validation at lines 232, 241
- `vitest.config.ts` — read directly; globals true, environment node, setupFiles `./tests/helpers/db.ts`
- `tests/helpers/db.ts` — read directly; in-memory SQLite + migrate pattern
- `tests/services/waCprXmlGenerator.test.ts` — read directly; pure unit test pattern with fixture data
- `.planning/phases/31-ssn-encryption-foundation/31-CONTEXT.md` — locked decisions D-01 through D-18 read directly
- `.planning/REQUIREMENTS.md` — SEC-01, SEC-02, SEC-03 requirements read directly
- `.planning/research/STACK.md` — AES-256-GCM implementation pattern confirmed; colon-delimited alternative noted; JSON envelope is CONTEXT.md decision
- `.planning/research/ARCHITECTURE.md` — cryptoService design, decrypt-on-demand policy confirmed
- `.planning/research/PITFALLS.md` — Pitfalls 13–15 directly relevant to Phase 31
- `./CLAUDE.md` — project-specific constraints including migration pattern and UI primitives
- `Node.js docs` — `node:crypto` AES-256-GCM — built-in module, confirmed HIGH confidence

### Secondary (MEDIUM confidence)
- None required — all findings from direct source inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed; `node:crypto` is built-in
- Architecture: HIGH — all integration points confirmed from direct source code inspection
- Pitfalls: HIGH — derived from project source code analysis and existing PITFALLS.md
- Line numbers: HIGH for the specific grep/read results; line numbers stable until next edit

**Research date:** 2026-03-27
**Valid until:** 2026-04-26 (stable — no third-party libraries; code changes slowly)
