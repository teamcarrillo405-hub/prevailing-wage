# Stack Research — v3.0 Team & Integration Additions Only

**Project:** HCC Prevailing Wage
**Milestone:** v3.0 — Team & Integration (multi-user team accounts, payroll provider import, AES-256 SSN encryption, agency portal auto-submit research gate)
**Researched:** 2026-03-27
**Confidence:** HIGH (nodemailer version — fetched GitHub releases live; multer/papaparse — confirmed in package.json; Node.js crypto AES-256-GCM — official Node.js docs; CA DIR / WA L&I API status — confirmed no public API via v2.5 research + current search)

> This file covers NEW stack requirements for v3.0 only. The existing stack — Node.js + Express + TypeScript, React + Vite + TailwindCSS v4, SQLite + Drizzle ORM, pdf-lib, xmlbuilder2, JWT httpOnly cookie auth, Render.com deployment — is documented in prior STACK.md files and is NOT re-researched here.

---

## Executive Summary

| Feature | Verdict | New Library Needed |
|---------|---------|-------------------|
| Multi-user team accounts (invite by email) | Add nodemailer | `nodemailer@8.0.4` — NOT yet installed |
| QuickBooks + ADP CSV import | Already installed | `multer@2.1.1` + `papaparse@5.5.3` — both in package.json |
| AES-256 SSN encryption at rest | No new library | Node.js built-in `crypto` module (AES-256-GCM) |
| Agency portal auto-submit — CA DIR eCPR | NOT FEASIBLE as auto-submit | No public API exists; XML file generation + manual portal upload is the confirmed pattern (per v2.5 research) |
| Agency portal auto-submit — WA L&I CPR | NOT FEASIBLE as auto-submit | No public API exists; XML file generation + manual portal upload is the confirmed pattern (per v2.5 research) |

**One new library. One install command. Two features reuse existing deps. One feature gates to "not feasible."**

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
| nodemailer | 8.0.4 | SMTP email delivery from Express server | Zero-dependency transactional email for Node.js; the standard choice for SMTP-delivered email in Express apps; TypeScript types bundled (no `@types/` package needed since v8); `"type": "module"` ESM project — v8 supports ESM imports natively; active maintenance (v8.0.4 released 2026-03-25) |

**Breaking change from v7 → v8 (if upgrading from prior version):** Error code `'NoAuth'` renamed to `'ENOAUTH'`. Minimal impact — only affects explicit error code string comparisons. Since nodemailer is NOT currently installed in this project, this is a clean install with no migration needed.

**What nodemailer does NOT provide:** Template rendering, queuing, retry logic, or deliverability analytics. For this app (small contractor teams, low volume), plain SMTP is sufficient. A transactional email service (Resend, SendGrid, Postmark) is used as the SMTP relay — nodemailer handles the Node.js-to-SMTP protocol.

### Invite Token Generation

**No new library needed.** Use `crypto.randomBytes(32).toString('hex')` from Node.js built-in `crypto`. This generates a 64-character hex token (256 bits of entropy) that is URL-safe and cryptographically secure. Do NOT use `nanoid` for invite tokens — nanoid v5 is ESM-only and while the project uses ESM (`"type": "module"`), using Node.js built-in `crypto` is simpler and avoids an extra dependency.

### DB Schema Additions

Invite flow requires a new `invitations` table (or columns on `users`):

```sql
-- Add to schema: team_invitations table
CREATE TABLE team_invitations (
  id          TEXT PRIMARY KEY,           -- nanoid/uuid for record PK
  org_id      INTEGER NOT NULL,           -- FK to organizations table (new)
  email       TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,       -- crypto.randomBytes(32).toString('hex')
  invited_by  INTEGER NOT NULL,           -- FK to users.id
  expires_at  INTEGER NOT NULL,           -- Unix timestamp; 72-hour window
  accepted_at INTEGER                     -- NULL until accepted
);
```

### SMTP Configuration

nodemailer uses environment variables for SMTP credentials — no new config file format needed. Add to `.env`:

```
SMTP_HOST=smtp.resend.com        # or smtp.sendgrid.net, etc.
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=re_xxxxxxxxxx
SMTP_FROM=noreply@hccprevailingwage.com
```

### Pattern

```typescript
// server/src/email.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,  // STARTTLS on 587
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

Both required libraries are already in `package.json`:

| Library | Version in package.json | Purpose | Status |
|---------|------------------------|---------|--------|
| multer | ^2.1.1 | Multipart form-data handling in Express (file upload) | INSTALLED |
| papaparse | ^5.5.3 | CSV parsing — header detection, type coercion, streaming | INSTALLED |

**Why multer for upload:** The app already uses multer (installed in v2.4 Phase 28 or earlier). It handles `multipart/form-data` file uploads in Express with memory or disk storage. Use `memoryStorage()` for CSV files — they are small (typically < 1 MB per payroll week), avoiding temp file cleanup.

**Why papaparse for parsing:** papaparse is already installed and handles CSV dialect differences (QuickBooks uses comma-separated with quoted fields; ADP Workforce Now uses similar but with different column names and a required `Co Code` + `Batch ID` prefix). Its `header: true` mode returns named objects rather than positional arrays, which is essential for column-name-based mapping.

**Why NOT csv-parse (also installed):** `csv-parse@6.2.0` is also in `package.json` and would work. However, papaparse's `header: true` + `skipEmptyLines: true` + `dynamicTyping: true` combination handles QuickBooks and ADP's quirks (trailing blank rows, mixed types) with less glue code. Use papaparse for CSV import.

### QuickBooks Payroll Export Format

QuickBooks Time and QuickBooks Online Payroll export time activity reports as CSV with these relevant columns:

| Column Name | Maps To |
|-------------|---------|
| Employee / Vendor Name | `workers.name` (match by name) |
| Date | Date within payroll week |
| Duration (HH:MM) | Hours — parse to decimal |
| Payroll Item | Trade classification hint (not a direct match) |

**Important caveat:** QuickBooks does NOT export per-day ST/OT split in a single download. The time activity export gives total hours per date. The import flow must reconstruct day-by-day entries and flag OT calculation as "needs review" — it cannot auto-classify straight time vs overtime without knowing the worker's trade and that week's hours running total.

### ADP Payroll Export Format (Workforce Now / ADP Run)

ADP Workforce Now payroll export columns relevant to import:

| Column Name | Maps To |
|-------------|---------|
| File # (employee ID) | Must be pre-mapped to `workers` record by contractor |
| Reg Hours | Regular hours total |
| O/T Hours | Overtime hours total |
| Hours 3/4 Code + Amount | Additional pay type / doubletime if configured |
| Co Code | Ignored (ADP internal) |
| Batch ID | Ignored (ADP internal) |

**Important caveat:** ADP exports weekly totals (not per-day). The import creates a single-lump payroll entry per worker per week, not per-day hour distribution. The existing payroll entry model expects per-day hours (Mon–Sun). Import must either: (a) spread total hours across days evenly as a starting point the contractor edits, or (b) use a simplified "total hours this week" import mode that bypasses per-day entry.

### Import Pattern

```typescript
// server/src/routes/payrollImport.ts
import multer from 'multer';
import Papa from 'papaparse';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/api/projects/:projectId/payroll-import',
  requireAuth,
  upload.single('csvFile'),
  async (req, res) => {
    const csvText = req.file!.buffer.toString('utf-8');
    const { data, errors } = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false  // keep as strings; do explicit parsing
    });
    // Map rows to payroll entries...
  }
);
```

---

## Feature 3: AES-256 SSN Encryption at Rest

### What's Needed

Full 9-digit SSNs are required for CA eCPR and WA CPR XML exports (per v2.5 schema research). They must be stored encrypted in SQLite with decryption only at export time.

### No New Library Needed

Node.js built-in `crypto` module provides AES-256-GCM. This is the correct cipher:
- **AES-256:** 256-bit key — meets "AES-256" requirement
- **GCM mode:** Provides authenticated encryption (integrity + confidentiality) — detects tampering
- **Not CBC:** AES-256-CBC lacks authentication tag; a separate HMAC would be needed; GCM is strictly better for this use case

### Implementation Pattern

```typescript
// server/src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Key must be exactly 32 bytes (256 bits). Derive from env var:
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 64-char hex = 32 bytes

export function encryptSsn(ssn: string): string {
  const iv = randomBytes(12);                        // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(ssn, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();                   // 16-byte auth tag
  // Store as: iv:tag:ciphertext (all base64)
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

### Key Management

Generate key once, store in environment variable — never commit to repo:

```bash
# Generate a 32-byte key, store the hex string in .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env` and to Render.com environment variables:
```
ENCRYPTION_KEY=<64-char hex string>
```

### DB Column

Add `ssn_encrypted TEXT` to the `workers` table (existing `ssn_last4` column is kept — it's used for worker identity matching across projects per the v2.3 decision). The `ssn_encrypted` column is nullable: NULL for workers where full SSN has not been entered.

```sql
-- Migration: add encrypted SSN column
ALTER TABLE workers ADD COLUMN ssn_encrypted TEXT;
```

Drizzle schema addition:
```typescript
ssnEncrypted: text('ssn_encrypted'),  // nullable; AES-256-GCM base64 encoded iv:tag:ciphertext
```

**Decryption is server-side only.** The full SSN never travels to the React client. It is decrypted in the Express route handler at XML export time and placed directly into the XML string — not returned in any JSON API response.

---

## Feature 4: Agency Portal Auto-Submit (CA DIR + WA L&I)

### Finding: NOT FEASIBLE as machine-to-machine auto-submit

**Confidence: HIGH** — confirmed in v2.5 research (2026-03-26) and verified again in current search (2026-03-27).

| Agency | Submission Method | API Available |
|--------|------------------|---------------|
| CA DIR eCPR | Manual XML file upload at `https://efiling.dir.ca.gov/eCPR/pages/home.jsp` | No public API documented. Portal accepts XML file upload by authenticated contractor. No machine-to-machine endpoint. |
| WA L&I CPR | Manual XML file upload through My L&I / SecureAccess Washington | No public API documented. Portal accepts XML file upload by authenticated contractor via SAW login. No machine-to-machine endpoint. |

**What "auto-submit" means in practice for v3.0:**

The research gate yields this answer: the v3.0 milestone's "auto-submit if public APIs are confirmed" condition is NOT met for either agency. The deliverable is:

1. CA DIR: XML file generation (already shipped in v2.5) + post-download checklist modal guiding contractor to `efiling.dir.ca.gov`
2. WA L&I: XML file generation (already shipped in v2.5) + portal submission guide (WAL-04 panel)

Both of these are already implemented in v2.5. There is no additional stack needed for this feature.

**Do not build:** Headless browser automation (Playwright/Puppeteer) to programmatically log into the portal and upload the file on the contractor's behalf. This approach would:
- Require storing contractor portal credentials (high security risk)
- Violate the portal's terms of service
- Break whenever the portal UI changes
- Not be supportable without a dedicated maintenance burden

---

## Installation

```bash
# One new production dependency (email only)
npm install nodemailer@8.0.4
```

All other features use existing installed packages or Node.js built-ins.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@sendgrid/mail` / `resend` SDK / `postmark` | These are vendor-specific API clients. nodemailer + SMTP relay is transport-agnostic — swap SMTP provider without changing code. | nodemailer + SMTP env vars |
| `nanoid` (for invite tokens) | nanoid v5 is ESM-only, and while this project is ESM, `crypto.randomBytes(32).toString('hex')` generates equivalent entropy (256 bits) with zero dependencies | `crypto.randomBytes(32).toString('hex')` (built-in) |
| `bcrypt` / additional password libs | argon2 is already installed and superior. The invite token is NOT a password — store the raw token hashed with argon2 or store as plaintext (it has 256-bit entropy and is single-use; argon2 hashing for lookup is also valid) | Existing argon2 |
| `aes-256-gcm` npm packages | Third-party wrappers add no value over the built-in crypto module, which is battle-tested and maintained by the Node.js core team | `node:crypto` built-in |
| Playwright / Puppeteer for portal automation | No public API exists; headless browser automation against government portals breaks on UI changes, risks ToS violation, and requires credential storage | XML file generation + manual portal upload guide (already implemented) |
| `xlsx` / `exceljs` | QuickBooks and ADP exports are CSV, not XLSX for this use case. If contractors export `.xlsx`, they can save as CSV in Excel. Avoid binary Excel parsing in server code. | papaparse + CSV |
| A new ORM or DB driver | Team accounts need only a new `organizations` table and an `org_id` FK on `users` and `projects`. SQLite + Drizzle handles this. | Existing Drizzle ORM |
| JWT team-scoping middleware rewrite | The flat team model (all members see all projects) means the org check is a single `WHERE org_id = ?` join, not a new RBAC system | Add `org_id` to existing auth middleware context |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| nodemailer@8 + SMTP | Resend/SendGrid SDK directly | If the team is already committed to one specific provider and wants provider-native features (bounce webhooks, template management). For an Express app on Render with one email type (invite), nodemailer SMTP is simpler. |
| Node.js built-in crypto AES-256-GCM | `crypto-js` npm package | Never for server-side Node.js. crypto-js is designed for browser environments where Web Crypto API may not be available. Node.js >= 20 has excellent built-in crypto. No reason to add a dependency. |
| papaparse (already installed) | csv-parse (also installed) | csv-parse is fine. Both are installed. Papaparse's `header: true` mode with `skipEmptyLines` is more ergonomic for the QuickBooks/ADP mapping use case where column names vary by product. |
| XML file generation + portal upload guide | Playwright/Puppeteer portal automation | Only if CA DIR or WA L&I publish a documented public API in the future. Monitor their developer portals and WDOL/SAM.gov for announcements. |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| nodemailer | 8.0.4 | Node.js >= 20.0.0 | Project already mandates >= 20. v8 supports ESM (`import nodemailer from 'nodemailer'`). `"type": "module"` in package.json — confirmed compatible. |
| multer | 2.1.1 | Express 5.x | Already installed and used. multer v2 was specifically updated for Express 5 compatibility (v2.1.1 is a security patch, March 2025). |
| papaparse | 5.5.3 | Node.js ESM | Already installed. Use `import Papa from 'papaparse'` — ESM-compatible. |
| node:crypto (built-in) | Node.js 20+ | All platforms | AES-256-GCM available in all Node.js >= 10; no polyfills needed. |

---

## Sources

- `https://github.com/nodemailer/nodemailer/releases` — nodemailer v8.0.4 released 2026-03-25; one breaking change (error code rename); ESM support confirmed — HIGH confidence (live fetch 2026-03-27)
- `https://nodejs.org/api/crypto.html` — Node.js crypto module AES-256-GCM documentation — HIGH confidence
- `package.json` (project root) — multer@^2.1.1, papaparse@^5.5.3, csv-parse@^6.2.0, argon2@^0.44.0 confirmed installed; "type": "module" ESM; engines.node >= 20 — HIGH confidence (direct file read 2026-03-27)
- `https://github.com/expressjs/multer/releases` — multer v2.1.1 released 2025-03-04 (security patch CVE-2026-3520) — HIGH confidence (live fetch 2026-03-27)
- `.planning/research/STACK.md` (v2.5) — CA DIR eCPR and WA L&I confirmed no public API; XML file upload to portal is the only submission method — HIGH confidence (prior research 2026-03-26)
- `https://efiling.dir.ca.gov/eCPR/pages/home.jsp` — CA DIR eCPR submission portal (web form + XML file upload, no REST API) — HIGH confidence (confirmed v2.5 research)
- `https://quickbooks.intuit.com/learn-support/en-us/employees-and-payroll/csv-file-export-for-payroll/00/700576` — QuickBooks CSV export column structure (Employee Name, Date, Duration, Payroll Item) — MEDIUM confidence (community support article, not official API docs)
- ADP Workforce Now export format — Co Code, Batch ID, File #, Reg Hours, O/T Hours column structure — MEDIUM confidence (multiple third-party integration guides agree; official ADP docs behind login wall)

---

*Stack research for: HCC Prevailing Wage v3.0 — Team & Integration*
*Researched: 2026-03-27*
