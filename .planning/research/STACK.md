# Stack Research — v3.0 Team & Integration Additions Only

**Project:** HCC Prevailing Wage
**Milestone:** v3.0 — Team & Integration (multi-user team accounts, payroll provider import, AES-256 SSN encryption, agency portal auto-submit research gate)
**Researched:** 2026-03-27
**Confidence:** HIGH (nodemailer version — confirmed GitHub releases live 2026-03-27; multer/papaparse — confirmed in package.json; Node.js crypto AES-256-GCM — official Node.js docs; CA DIR / WA L&I API status — confirmed no public API via current search 2026-03-27)

> This file covers NEW stack requirements for v3.0 only. The existing stack — Node.js + Express + TypeScript, React + Vite + TailwindCSS v4, SQLite + Drizzle ORM, pdf-lib, xmlbuilder2, JWT httpOnly cookie auth, Render.com deployment — is documented in prior STACK.md files and is NOT re-researched here.

---

## Executive Summary

| Feature | Verdict | New Library Needed |
|---------|---------|-------------------|
| Multi-user team accounts (invite by email) | Add nodemailer | `nodemailer@8.0.4` — NOT currently in package.json |
| QuickBooks + ADP CSV import | Already installed | `multer@2.1.1` + `papaparse@5.5.3` — both in package.json |
| AES-256 SSN encryption at rest | No new library | Node.js built-in `crypto` module (AES-256-GCM) |
| Agency portal auto-submit — CA DIR eCPR | NOT FEASIBLE as auto-submit | No public API exists; XML file generation + manual portal upload is the confirmed pattern |
| Agency portal auto-submit — WA L&I CPR | NOT FEASIBLE as auto-submit | No public API exists; XML file generation + manual portal upload is the confirmed pattern |

**One new library. One install command. Two features reuse existing deps. Two features require no action beyond v2.5 shipping.**

---

## Feature 1: Multi-User Team Accounts (Invite by Email)

### What's Needed

Invite-by-email requires sending a transactional email with a secure one-time token link. The token must be:
- Cryptographically random (not guessable)
- Time-bounded (expiry stored in DB)
- Single-use (invalidated on accept)

### New Library: nodemailer

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| nodemailer | 8.0.4 | SMTP email delivery from Express server | Zero-dependency transactional email for Node.js; the standard choice for SMTP-delivered email in Express apps; TypeScript types bundled since v8 (no `@types/` package needed); `"type": "module"` ESM project — v8 supports ESM imports natively; active maintenance (v8.0.4 released 2026-03-25, confirmed GitHub releases) |

**Breaking change from v7 → v8 (if upgrading from prior version):** Error code `'NoAuth'` renamed to `'ENOAUTH'`. Minimal impact — only affects explicit error code string comparisons. Since nodemailer is NOT currently installed in this project (confirmed absent from package.json), this is a clean install with no migration needed.

**What nodemailer does NOT provide:** Template rendering, queuing, retry logic, or deliverability analytics. For this app (small contractor teams, low volume), plain SMTP is sufficient. A transactional email service (Resend, SendGrid, Postmark) is used as the SMTP relay — nodemailer handles the Node.js-to-SMTP protocol layer only.

### Invite Token Generation

**No new library needed.** Use `crypto.randomBytes(32).toString('hex')` from Node.js built-in `crypto`. This generates a 64-character hex token (256 bits of entropy) that is URL-safe and cryptographically secure. Do NOT use `nanoid` for invite tokens — Node.js built-in `crypto` is simpler and avoids an extra dependency for this use case.

### DB Schema Additions

Invite flow requires a new `team_invitations` table and an `organizations` table:

```sql
-- New tables needed for multi-user
CREATE TABLE organizations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  owner_id   INTEGER NOT NULL,     -- FK to users.id
  created_at INTEGER NOT NULL
);

CREATE TABLE team_invitations (
  id          TEXT PRIMARY KEY,            -- uuid/random PK
  org_id      INTEGER NOT NULL,            -- FK to organizations.id
  email       TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,        -- crypto.randomBytes(32).toString('hex')
  invited_by  INTEGER NOT NULL,            -- FK to users.id
  expires_at  INTEGER NOT NULL,            -- Unix timestamp; 72-hour window recommended
  accepted_at INTEGER                      -- NULL until accepted; set on registration
);
```

`users` table needs `org_id INTEGER` FK added. `projects` table needs `org_id INTEGER` FK added.

### SMTP Configuration

nodemailer uses environment variables for SMTP credentials — no new config file format needed. Add to `.env` and Render.com environment settings:

```
SMTP_HOST=smtp.resend.com        # or smtp.sendgrid.net, smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=re_xxxxxxxxxx
SMTP_FROM=noreply@hccprevailingwage.com
APP_URL=https://hccprevailingwage.com
```

### Integration Pattern

```typescript
// src/server/lib/email.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,  // STARTTLS on port 587
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

export async function sendInviteEmail(to: string, token: string, inviterName: string) {
  const link = `${process.env.APP_URL}/invite/accept?token=${token}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${inviterName} invited you to HCC Prevailing Wage`,
    text: `Accept your invitation: ${link}\n\nThis link expires in 72 hours.`,
    html: `<p>${inviterName} invited you to join HCC Prevailing Wage.</p>
           <p><a href="${link}">Accept Invitation</a></p>
           <p>This link expires in 72 hours.</p>`
  });
}
```

---

## Feature 2: QuickBooks + ADP CSV Import

### What's Needed

CSV file upload from the browser → Express parses the multipart form → server reads CSV rows → maps columns to payroll entry fields.

### Already Installed — No New Libraries

Both required libraries are confirmed in `package.json`:

| Library | Version in package.json | Purpose | Status |
|---------|------------------------|---------|--------|
| multer | ^2.1.1 | Multipart form-data handling in Express (file upload) | INSTALLED |
| papaparse | ^5.5.3 | CSV parsing — header detection, type coercion, empty row handling | INSTALLED |
| @types/multer | ^2.1.0 | TypeScript types for multer | INSTALLED |
| @types/papaparse | ^5.5.2 | TypeScript types for papaparse | INSTALLED |

**Why multer for upload:** Handles `multipart/form-data` file uploads in Express with memory or disk storage. Use `memoryStorage()` for CSV files — they are small (typically < 1 MB per payroll week), avoiding temp file cleanup. multer v2.1.1 is specifically compatible with Express 5.x.

**Why papaparse for parsing:** Its `header: true` mode returns named-column objects rather than positional arrays, which is essential for column-name-based mapping against QuickBooks and ADP's varying header names. `skipEmptyLines: true` handles QuickBooks's common trailing blank rows without additional code.

**Why NOT csv-parse (also installed):** `csv-parse@6.2.0` is also in `package.json` and would work. However, papaparse's combination of `header: true` + `skipEmptyLines: true` + `dynamicTyping: false` handles QuickBooks and ADP's quirks with less glue code. Use papaparse for CSV import; csv-parse is retained for existing uses elsewhere in the codebase.

### QuickBooks Payroll Export Format

QuickBooks Time and QuickBooks Online Payroll export time activity reports as CSV. Relevant columns:

| Column Name | Maps To | Notes |
|-------------|---------|-------|
| Employee / Vendor Name | `workers.name` (match by name) | Fuzzy match needed; contractor must confirm |
| Date | Date within payroll week | Parse to determine day-of-week |
| Duration (HH:MM) | Hours — parse to decimal | QuickBooks format: "1:30" = 1.5h |
| Payroll Item | Trade classification hint | Not a direct match; display for contractor review |

**Important caveat (LOW confidence — no official QB API spec):** QuickBooks does NOT export a per-day ST/OT split in a single download. The time activity export gives total hours per date. The import flow must reconstruct day-by-day entries and flag OT classification as "needs contractor review" — it cannot auto-classify straight time vs overtime without knowing the worker's running weekly hours total. This means imports are pre-population only, not push-button complete entries.

### ADP Payroll Export Format (Workforce Now / ADP Run)

ADP Workforce Now payroll export columns (MEDIUM confidence — multiple third-party integration guides agree; official ADP docs are behind login wall):

| Column Name | Maps To | Notes |
|-------------|---------|-------|
| File # (employee ID) | Must be pre-mapped to `workers` record | Contractor maps ADP File# to worker name at import |
| Reg Hours | Regular hours total | Weekly total, not per-day |
| O/T Hours | Overtime hours total | Weekly total |
| Hours 3/4 Code + Amount | Additional pay type / doubletime | Only if configured in ADP account |
| Co Code | Ignored | ADP internal identifier |
| Batch ID | Ignored | ADP internal batch counter |

**Important caveat:** ADP exports weekly totals, not per-day distribution. The import creates a single-lump payroll entry per worker per week. Since the existing payroll entry model expects per-day hours (Mon–Sun), the import UI must either: (a) spread total hours across days evenly as a contractor-editable starting point, or (b) use a "total hours" simplified mode. This is a product decision, not a library decision.

### Import Integration Pattern

```typescript
// src/server/routes/payrollImport.ts
import multer from 'multer';
import Papa from 'papaparse';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/api/projects/:projectId/payroll-import',
  requireAuth,
  upload.single('csvFile'),
  async (req, res) => {
    const csvText = req.file!.buffer.toString('utf-8');
    const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false   // keep as strings; do explicit type conversion
    });
    // Map rows to payroll entries, return preview for PI-03 review & match screen
  }
);
```

---

## Feature 3: AES-256 SSN Encryption at Rest

### What's Needed

Full 9-digit SSNs are required for CA eCPR and WA CPR XML exports. They must be stored encrypted in SQLite with decryption only at export time, never in JSON API responses.

### No New Library Needed

Node.js built-in `crypto` module (available in all Node.js >= 10) provides AES-256-GCM. This is the correct cipher:

- **AES-256:** 256-bit key — meets the "AES-256" requirement in SEC-01
- **GCM mode:** Authenticated encryption — provides both confidentiality and integrity; detects tampering via auth tag
- **Not CBC:** AES-256-CBC lacks an authentication tag; a separate HMAC would be required; GCM is strictly superior for field-level encryption

### Implementation Pattern

```typescript
// src/server/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Key must be exactly 32 bytes (256 bits). Store as 64-char hex string in env:
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encryptSsn(ssn: string): string {
  const iv = randomBytes(12);                         // 96-bit IV — required for GCM
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(ssn, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();                    // 16-byte authentication tag
  // Store format: iv:tag:ciphertext (all base64, colon-delimited)
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptSsn(stored: string): string {
  const [ivB64, tagB64, encB64] = stored.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
```

### Key Generation and Management

Generate the key once. Store it only in environment variables — never commit to the repository:

```bash
# Generate a 32-byte key as a 64-character hex string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env` (local) and to Render.com environment variable settings:

```
ENCRYPTION_KEY=<64-char hex string>
```

**If the key is lost, all encrypted SSNs are permanently unrecoverable.** Store the key in a password manager or secrets vault (1Password, AWS Secrets Manager, etc.) in addition to Render.com env vars.

### DB Column

Add `ssn_encrypted TEXT` to the `workers` table. The existing `ssn_last4` plain-text column is KEPT — it is used for worker identity matching across projects (v2.3 decision, add-only migration constraint). The `ssn_encrypted` column is nullable: NULL for workers where full SSN has not yet been entered.

```sql
-- Migration: add encrypted SSN column (add-only, no drop)
ALTER TABLE workers ADD COLUMN ssn_encrypted TEXT;
```

Drizzle schema addition:

```typescript
// In schema.ts workers table definition:
ssnEncrypted: text('ssn_encrypted'),  // nullable; AES-256-GCM format: base64(iv):base64(tag):base64(ciphertext)
```

**Rule:** The full SSN is decrypted server-side only, at XML export time, placed directly into the XML string — never returned in any JSON API response, never written to WH-347 PDFs, never included in CSV exports (SEC-02 requirement).

---

## Feature 4: Agency Portal Auto-Submit (CA DIR + WA L&I)

### Finding: NOT FEASIBLE — No Public API Exists for Either Agency

**Confidence: HIGH** — confirmed via current live search 2026-03-27, consistent with prior v2.5 research.

| Agency | Submission Method | Public API |
|--------|------------------|-----------|
| CA DIR eCPR | Manual XML file upload at `efiling.dir.ca.gov` | No public REST API or machine-to-machine endpoint documented. Portal requires authenticated contractor session. The third-party compliance software (LCPtracker, eMars, Sunburst) all generate XML and guide the contractor to upload manually — none claim a programmatic API. |
| WA L&I CPR | Manual XML file upload through My L&I / SecureAccess Washington | No public API. Portal accepts XML file upload via SAW (SecureAccess Washington) authenticated contractor login. No developer documentation found on lni.wa.gov. |

### What This Means for v3.0

The AS-01 and AS-02 requirements include the gate: "build only if public API confirmed by researcher." The gate fails for both agencies.

**Deliverable for both:** XML file generation + portal upload guide. Both are already shipped in v2.5:
- CA DIR: XML generation (Phase 29) + post-download portal checklist (CAE-03, Phase 29)
- WA L&I: XML generation (Phase 30, WAL-03) + submission guide panel (WAL-04, Phase 30)

**No additional stack or development work needed for AS-01 or AS-02.** These phases drop from v3.0 scope per the conditional gate.

**Explicitly do not build:** Headless browser automation (Playwright/Puppeteer) to log into portals on the contractor's behalf. Reasons:
1. Requires storing contractor portal credentials — high security risk
2. Almost certainly violates portal terms of service
3. Breaks on any portal UI change without warning
4. Unsupportable maintenance burden for a small-team app

---

## Installation

```bash
# One new production dependency
npm install nodemailer@8.0.4
```

No `@types/nodemailer` needed — TypeScript types are bundled in nodemailer v8.

All other features use packages already in `package.json` or Node.js built-ins.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@sendgrid/mail` / `resend` SDK / `postmark` client | Vendor-locked API clients. nodemailer + SMTP relay is transport-agnostic — change SMTP provider with an env var swap, no code change. | `nodemailer@8` + SMTP env vars |
| `nanoid` (for invite tokens) | `crypto.randomBytes(32).toString('hex')` generates equivalent entropy (256 bits) with zero dependencies. nanoid adds no value for server-side token generation. | `crypto.randomBytes(32).toString('hex')` (Node.js built-in) |
| `bcrypt` / `crypto-js` / additional crypto libs | argon2 is already installed for passwords. For SSN storage, Node.js built-in `crypto` AES-256-GCM is battle-tested and requires no third-party dependency. | Existing argon2 (passwords) + `node:crypto` (SSN encryption) |
| `aes-256-gcm` npm packages | Third-party wrappers add no value over the built-in `crypto` module. Some have security issues (CryptoJS uses Math.random() in older versions). | `node:crypto` built-in |
| Playwright / Puppeteer for portal automation | No public API exists; headless browser automation against government portals breaks on UI changes, risks ToS violation, and requires credential storage. | XML file generation + manual upload guide (already implemented in v2.5) |
| `xlsx` / `exceljs` | QuickBooks and ADP exports are CSV for this use case. If contractors have XLSX, they save as CSV in Excel first. Avoid binary Excel parsing server-side. | `papaparse` + CSV |
| A new ORM or DB driver | Team accounts require only a new `organizations` table and `org_id` FK on `users`/`projects`. SQLite + Drizzle handles this with a migration. | Existing Drizzle ORM |
| JWT middleware rewrite for team scoping | The flat team model (all members see all projects for their org) is a single `WHERE org_id = ?` join. No RBAC system needed. | Add `org_id` to existing auth middleware context |
| `react-email` / email template libraries | One invite email type, plain text + simple HTML. Adding a template rendering pipeline for a single template is over-engineering. | Inline HTML string in `sendInviteEmail()` |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `nodemailer@8` + SMTP relay | Resend SDK, SendGrid SDK directly | If the team wants provider-native features: bounce webhooks, template management UI, send analytics. For an Express app with one email type and low volume, nodemailer SMTP is simpler and provider-agnostic. |
| `node:crypto` AES-256-GCM | `crypto-js` npm package | Never for server-side Node.js. `crypto-js` targets browsers where Web Crypto API may not be available. On Node.js >= 20, always use the built-in module. |
| `papaparse` (already installed) | `csv-parse` (also installed) | `csv-parse` is fine and also installed. Choose it if streaming large files becomes a requirement. For the QuickBooks/ADP import use case (< 1 MB files), papaparse's `header: true` ergonomics are preferable. |
| XML generation + portal upload guide | Playwright/Puppeteer portal automation | Only if CA DIR or WA L&I publish a documented public API. Monitor `dir.ca.gov` and `lni.wa.gov` developer pages for future announcements. |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| nodemailer | 8.0.4 | Node.js >= 20.0.0 | Project mandates Node.js >= 20 (`engines` in package.json). v8 supports ESM (`import nodemailer from 'nodemailer'`). `"type": "module"` — confirmed compatible. |
| multer | 2.1.1 | Express 5.x | Already installed. multer v2 was updated specifically for Express 5 compatibility. v2.1.1 is a security patch (2025-03-04). |
| papaparse | 5.5.3 | Node.js ESM | Already installed. `import Papa from 'papaparse'` — ESM-compatible. |
| node:crypto (built-in) | Node.js 20+ | All platforms | AES-256-GCM available in Node.js >= 10 without polyfills. GCM auth tag support solid since Node.js 6. |

---

## Sources

- `https://github.com/nodemailer/nodemailer/releases` — nodemailer v8.0.4 confirmed released 2026-03-25; TypeScript types bundled; ESM support confirmed — HIGH confidence (live fetch 2026-03-27)
- `https://nodejs.org/api/crypto.html` — Node.js built-in crypto module AES-256-GCM documentation — HIGH confidence
- `package.json` (project root, `/c/Users/glcar/prevailing-wage/package.json`) — multer@^2.1.1, papaparse@^5.5.3, @types/multer@^2.1.0, @types/papaparse@^5.5.2, csv-parse@^6.2.0, argon2@^0.44.0 confirmed installed; nodemailer absent; `"type": "module"` ESM; engines.node >= 20 — HIGH confidence (direct file read 2026-03-27)
- `https://efiling.dir.ca.gov/eCPR/pages/home.jsp` — CA DIR eCPR portal (web form + XML file upload; no REST API) — HIGH confidence (confirmed via support center fetch + WebSearch 2026-03-27)
- `https://lni.wa.gov/licensing-permits/_docs/xml%20payroll%20guide.pdf` — WA L&I XML payroll upload guide; portal-only submission (no API) — HIGH confidence (WebSearch 2026-03-27)
- `https://quickbooks.intuit.com/learn-support/en-us/employees-and-payroll/csv-file-export-for-payroll/00/700576` — QuickBooks CSV export column structure — MEDIUM confidence (community article; no official API schema doc available publicly)
- ADP Workforce Now export format (Co Code, Batch ID, File #, Reg Hours, O/T Hours) — MEDIUM confidence (multiple third-party integration guides consistent; official ADP docs behind login wall)
- `https://sunburstsoftwaresolutions.com/california-dir-ecpr-prism-lcptracker-upload-feature-for-quickbooks.htm` — Third-party CPR software (LCPtracker, PRISM) all use manual XML upload, none claim programmatic API to CA DIR — MEDIUM confidence, corroborates no-API finding

---

*Stack research for: HCC Prevailing Wage v3.0 — Team & Integration*
*Researched: 2026-03-27*
