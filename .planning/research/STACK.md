# Stack Research — v2.4 Additions Only

**Project:** HCC Prevailing Wage
**Milestone:** v2.4 — Ship-Ready + Design Elevation
**Researched:** 2026-03-24
**Confidence:** HIGH (verified against official sources, live package registry, platform docs)

> This file covers NEW stack requirements only. The existing stack (Node.js + Express + TypeScript, React 18 + Vite + TailwindCSS v4, SQLite + Drizzle ORM, pdf-lib, JWT httpOnly cookie auth, Vitest + supertest) is documented in the v2.3 STACK.md and is not re-researched here.

---

## Executive Summary

| Feature | Verdict |
|---------|---------|
| CA DIR certified payroll form | No new library — pdf-lib coordinate overlay (same WH-347 pattern). CA requires XML upload to eCPR portal, not a PDF artifact. |
| WA L&I Intent/Affidavit form | No new library — pdf-lib coordinate overlay on downloadable blank PDF. WA primary path is online PWIA portal. |
| CSV export | Add `csv-stringify` ^6.7.0 — already in the `csv` monorepo ecosystem, minimal API surface, streaming-native for Express. |
| Cloud hosting + SQLite persistence | Render.com — persistent disk at `/var/data`, `$7/month` Starter service + `$0.25/GB/month` disk. Simplest operational model for this stack. |
| Invite-only auth | No new library — `crypto.randomBytes()` (Node built-in) + one new `invitations` DB table. Thin layer on top of existing JWT/argon2 auth. |
| Env var patterns | No new library — existing `dotenv` + Vite's `VITE_` prefix convention. Platform env injection at runtime for server vars. |

---

## Q1: State PDF Forms — CA DIR + WA L&I

### California DIR — What the State Actually Requires

**Finding (HIGH confidence):** California DIR does NOT accept contractor-generated PDFs for certified payroll reporting. Electronic submission through DIR's online eCPR portal is mandatory for most public works projects (California Labor Code SB 854). The DAS-140 form (Designation of Apprenticeship Committee — apprentice notification) IS a downloadable fillable AcroForm PDF at `https://www.dir.ca.gov/DAS/DASForm140.pdf`, but it is an administrative notification form, not a weekly payroll form.

The relevant weekly payroll forms are:
- **Form A-1-131 (Public Works Payroll Reporting Form)** — a reference/sample format, not the submission vehicle. The actual submission is electronic via the eCPR portal at `https://efiling.dir.ca.gov/eCPR/`.
- **XML upload option** — contractors who use payroll software can generate XML per the CPR XML Schema V1.3 and upload to the eCPR portal instead of manual entry.

**Implication for v2.4:** "California DIR prevailing wage form" in the requirements most likely means generating the **Form A-1-131 formatted PDF** as a local record or pre-submission draft — not a state-submitted artifact. This is a practical approach: contractors use the PDF to review/sign before eCPR entry, or for awarding agency submission where eCPR is not required.

Alternatively, if the feature intent is XML export for eCPR portal upload, that is a text export (no PDF library needed — pure XML string generation from existing payroll data).

**Recommendation:** Implement Form A-1-131 as a **pdf-lib coordinate overlay** on the official blank form PDF, identical to the WH-347 pattern already working. The A-1-131 PDF has AcroForm fields (confirmed: `/AcroForm` dictionary present), so pdf-lib's `PDFForm` API can fill fields by name instead of coordinate math. Use `form.getTextField('fieldName').setText(value)` + `form.flatten()` to lock the appearance. If field names are unresolvable, fall back to coordinate overlay.

### Washington L&I — What the State Actually Requires

**Finding (HIGH confidence):** Washington L&I's Intent to Pay Prevailing Wages and Affidavit of Wages Paid are filed through the online **PWIA (Prevailing Wage Intent and Affidavit)** portal at `secure.lni.wa.gov`. Paper forms were discontinued. The system issues an "Intent ID" per contractor per project.

The PWIA step-by-step instructions PDF at `lni.wa.gov/licensing-permits/_docs/pwia-step-by-step-instructions.pdf` describes the online workflow (multi-screen form). A legacy blank PDF exists for reference (`water19.com/wp-content/uploads/2019/03/L-I-Affidavit-and-Intent.pdf`) but is not the official submission vehicle.

**Implication for v2.4:** Same interpretation as CA: generate a **local PDF record** of the Intent data so contractors have a pre-filled document for their files or awarding agency submission. This is a coordinate overlay on the blank WA L&I form PDF, following the existing WH-347 pattern.

### pdf-lib Is Sufficient for Both

pdf-lib 1.17.1 is already installed. Its `PDFForm` API handles AcroForm field filling:

```typescript
// AcroForm field fill (preferred where field names are known)
const form = pdfDoc.getForm();
form.getTextField('contractor_name').setText('ABC Construction');
form.getCheckBox('check_new').check();
form.flatten(); // locks appearance for consistent rendering

// Coordinate overlay (fallback, same as WH-347 pattern)
page.drawText('ABC Construction', { x: 142, y: 680, size: 10 });
```

**No new PDF library needed.** Coordinate mapping work is required to locate form fields — plan for 4-6 hours of calibration per form.

**Recommended approach for both forms:**
1. Download official blank PDF (DIR A-1-131, WA L&I Intent blank)
2. Bundle in `src/server/assets/forms/`
3. If the PDF has readable AcroForm fields, use `PDFForm.getTextField()` API
4. If fields are obfuscated/compressed, fall back to coordinate overlay (identical to `fillWh347()`)
5. New service files: `fillDirA1131.ts`, `fillWaIntent.ts` — mirror structure of `wh347Service.ts`

**Confidence:** HIGH — pdf-lib AcroForm API is documented at `https://pdf-lib.js.org/docs/api/classes/pdfform`. WH-347 coordinate overlay pattern already proven in this codebase.

### What NOT to Add

| Library | Why Not |
|---------|---------|
| `pdfmake` | Template-based, not overlay-based. Can't preserve official government form appearance required for legal compliance. |
| `puppeteer` / headless Chrome PDF | 200MB+ binary, overkill for form filling, adds significant deploy complexity |
| `pdf.js` (pdfjs-dist) | Read-only viewer library, not a generator |
| Any commercial PDF SDK | License cost, unnecessary for this use case |

---

## Q2: CSV Export

### Recommendation: `csv-stringify` ^6.7.0

**Why this, not alternatives:**

`csv-stringify` is the stringify module from the `csv` monorepo (`adaltas/node-csv`). The project already has `csv-parse` ^6.2.0 installed (same monorepo, same version line). Adding `csv-stringify` is a natural extension — same API design, same version cadence, zero friction.

```typescript
// Express route pattern — streams response directly
import { stringify } from 'csv-stringify';

router.get('/api/workers/:id/compliance-history/export', requireAuth, async (req, res) => {
  const rows = await getComplianceHistoryRows(db, req.params.id);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="compliance-history.csv"');

  const stringifier = stringify({ header: true, columns: [...] });
  stringifier.pipe(res);
  rows.forEach(row => stringifier.write(row));
  stringifier.end();
});
```

**Alternatives considered:**

| Library | Weekly Downloads | Bundle Size | Verdict |
|---------|-----------------|-------------|---------|
| `csv-stringify` ^6.7.0 | ~12M | ~42KB | **Recommended** — already in monorepo with `csv-parse` |
| `fast-csv` | ~2M | ~85KB | More API surface, streaming-native, but heavier and no existing monorepo tie |
| Native `Array.join(',')` | — | 0 | Fragile — breaks on quotes, commas in values, unicode. Do not use. |
| `json2csv` | ~1.5M | ~65KB | Parse-only friendly API but not Node.js-stream-native |
| `papaparse` | already installed | — | Client-side library; already in project for client parsing, but server-side CSV generation is not its purpose |

**Performance note:** Compliance history export will never exceed a few hundred rows per worker (single-user SQLite app). Performance difference between all libraries is unmeasurable at this scale. Pick based on ecosystem fit, not benchmarks.

**Installation:**
```bash
npm install csv-stringify
```

No type declaration package needed — `csv-stringify` ships its own TypeScript types.

**Confidence:** HIGH — verified current version (6.7.0, last published within days of research date) at `https://www.npmjs.com/package/csv-stringify`.

---

## Q3: Cloud Hosting + SQLite Persistence

### Recommendation: Render.com

**Why Render over alternatives:**

| Platform | SQLite Persistence | Pricing | Operational Complexity | Verdict |
|----------|-------------------|---------|----------------------|---------|
| **Render** | Persistent disk at user-defined mount path (`/var/data`) — straightforward | $7/mo service + $0.25/GB/mo disk | Low — web UI configuration, no CLI required | **Recommended** |
| Fly.io | Persistent volumes at `/data` — well-documented for SQLite | ~$5/mo machine + volume cost | Higher — requires `fly.toml`, CLI, Dockerfile, optional Litestream setup | Good option but more DevOps overhead |
| Railway | Persistent volumes at `/app/data` or `/data` — works but community reports edge cases with SQLite | Usage-based (unpredictable cost) | Medium — similar to Render but less mature persistent disk support | Avoid for SQLite — cost unpredictability and documented edge cases |

**SQLite persistence pattern on Render:**

1. Attach a persistent disk to the web service (Render dashboard)
2. Set mount path to `/var/data`
3. Set `DATABASE_URL` environment variable to `/var/data/prevailing-wage.db`
4. Update `src/server/db/index.ts` to read `process.env.DATABASE_URL` (fallback to local dev path)

```typescript
// src/server/db/index.ts — change for production persistence
const dbPath = process.env.DATABASE_URL ?? './prevailing-wage.db';
export const db = drizzle(new Database(dbPath));
```

**Critical constraint:** Only filesystem changes under the disk mount path survive deploys. If the current code writes the SQLite file to the project root (`./prevailing-wage.db`), it will be wiped on every deploy. The env var approach above resolves this with zero other changes.

**Render-specific notes:**
- Free web services cannot attach a persistent disk — the $7/month Starter plan (512 MB RAM, 0.5 CPU) is required
- Disk starts at $0.25/GB/month; 1 GB = $0.25/month for a single-user SQLite app
- No `sudo` or volume command required — disk is attached via dashboard and appears at the mount path automatically
- Free tier spins down after inactivity (not acceptable for a production app) — Starter plan stays live

**Total estimated cost:** ~$7.25/month (service + 1 GB disk)

**Fly.io as backup:** If Render is unacceptable, Fly.io is the second choice. Mount volume at `/data`, point `DATABASE_URL` to `/data/prevailing-wage.db`. Fly.io docs explicitly support this pattern for Node.js/Prisma + SQLite apps. Optional Litestream replication to S3 for point-in-time recovery. Adds Dockerfile + `fly.toml` authoring overhead.

**What about Litestream on Render?** Not needed for v2.4. Litestream is a streaming replication tool for SQLite to S3. Valuable for disaster recovery but adds complexity. The Render persistent disk is backed by their infrastructure. Add Litestream in a future operational hardening milestone if needed.

**Confidence:** HIGH — Render persistent disk pricing confirmed at `https://render.com/pricing` ($0.25/GB/month). SQLite + Render pattern confirmed via official docs (`https://render.com/docs/disks`) and community examples.

---

## Q4: Controlled/Invite-Only Auth

### Recommendation: No New Library — `crypto.randomBytes()` + `invitations` DB Table

The existing auth stack (JWT in httpOnly cookie + argon2 password hashing via `jose` + `argon2` packages) is complete. Invite-only registration is a thin gate added in front of the existing `POST /api/auth/register` route.

**Pattern:**

1. Admin generates an invite token via a protected endpoint
2. Token stored (as SHA-256 hash) in new `invitations` table with expiry and `used_at` column
3. Registration form accepts `inviteToken` field alongside email/password
4. `POST /api/auth/register` validates token exists, is unused, and is not expired before proceeding
5. On successful registration, mark token `used_at = NOW()`

**Token generation (no new library):**
```typescript
import { randomBytes, createHash } from 'crypto'; // Node built-in

function generateInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex'); // 64-char URL-safe hex
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}
```

**DB schema (add-only migration):**
```sql
CREATE TABLE invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT,           -- optional: pre-assign to specific email
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Route change:**
```typescript
// POST /api/auth/register — add token validation before existing logic
const { email, password, inviteToken } = req.body;
const tokenHash = hash(inviteToken);
const invite = db.prepare('SELECT * FROM invitations WHERE token_hash = ?').get(tokenHash);
if (!invite || invite.used_at || invite.expires_at < new Date().toISOString()) {
  return res.status(403).json({ error: 'Invalid or expired invite' });
}
// ... existing registration logic ...
db.prepare('UPDATE invitations SET used_at = ? WHERE token_hash = ?').run(new Date().toISOString(), tokenHash);
```

**Admin route (generate invite link):**
```
POST /api/admin/invitations  →  returns { inviteUrl: 'https://app.com/register?token=abc123' }
```
This route requires a separate admin guard (e.g., check `req.user.role === 'admin'` from JWT payload, or protect behind a static `ADMIN_SECRET` env var for v2.4 simplicity).

**What NOT to add:**

| Library | Why Not |
|---------|---------|
| `nodemailer` | Email delivery for invite links adds SMTP setup, testing complexity. For v2.4 (invite-only, small user base), copy-paste the invite URL from the admin endpoint response. Defer email to a future milestone. |
| Any OAuth/SSO library | Auth model is JWT cookie — do not change |
| `passport.js` | Overkill; the existing auth middleware is already working |
| `uuid` package | `crypto.randomBytes(32).toString('hex')` is cryptographically stronger than UUID v4 and requires no package |

**Confidence:** HIGH — `crypto.randomBytes` is a Node.js built-in (no install), pattern is well-established for invite/password-reset flows. The `invitations` table follows the same add-only migration pattern as all prior schema changes.

---

## Q5: Env Var Patterns for Production

### Pattern: Two-Layer Env Vars (Server + Client)

**Server-side (Express):** Standard `dotenv` is already installed. All server env vars are loaded from `.env` in dev. In production on Render, set env vars directly in the Render dashboard — they are injected at runtime via `process.env`. Do NOT commit `.env` to git.

**Client-side (Vite):** Vite exposes only variables prefixed with `VITE_` to the browser bundle at build time via `import.meta.env.VITE_*`. Do not put secrets in `VITE_` vars — they are bundled into the JS served to browsers.

**Variable separation:**

| Variable | Layer | Set Where | Example |
|----------|-------|-----------|---------|
| `DATABASE_URL` | Server | Render env dashboard | `/var/data/prevailing-wage.db` |
| `JWT_SECRET` | Server | Render env dashboard | (random 64-char hex) |
| `SAM_GOV_API_KEY` | Server | Render env dashboard | (production key from SAM.gov) |
| `ADMIN_SECRET` | Server | Render env dashboard | (for admin invite endpoint guard) |
| `NODE_ENV` | Server | Render env dashboard | `production` |
| `PORT` | Server | Render env dashboard | `4099` (or `10000` per Render default) |
| `VITE_API_BASE_URL` | Client (build-time) | `.env.production` file | `https://your-app.onrender.com` |

**Important Render-specific note:** Render injects `PORT` automatically for web services. The Express server should read `process.env.PORT ?? 4099` — do not hardcode 4099 for production.

**File structure:**
```
.env                   # dev secrets — gitignored
.env.production        # VITE_ vars for production build — safe to commit if no secrets
.env.example           # template — committed to git
```

**Vite production build note:** `VITE_API_BASE_URL` must be set at build time, not runtime, because Vite bakes `import.meta.env.VITE_*` values into the bundle during `vite build`. On Render, set it as a build-time environment variable in the service configuration, not the runtime env section.

**Existing `dotenv` usage:** Already installed (`^17.3.1`) and presumably initialized in `src/server/index.ts`. No changes needed. The only additions are new variable names.

**Confidence:** HIGH — Vite env var behavior verified at `https://vite.dev/guide/env-and-mode`. Render build vs runtime env distinction confirmed at Render docs.

---

## New Libraries to Install

| Library | Version | Install Command | Purpose |
|---------|---------|-----------------|---------|
| `csv-stringify` | ^6.7.0 | `npm install csv-stringify` | Server-side CSV generation for compliance history export |

**That's the complete list.** One library. Everything else uses existing installed packages or Node.js built-ins.

---

## New DB Schema Changes

Two new additions for v2.4:

```sql
-- 1. Invite-only auth gate
CREATE TABLE invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Any new columns needed for state form tracking (TBD per implementation)
-- e.g., if tracking which state form was generated per project:
ALTER TABLE projects ADD COLUMN state_form_generated_at TEXT;
```

Register all new migrations in `src/server/db/migrations/meta/_journal.json` per existing pattern. Current highest idx is noted in PROJECT.md as idx 4 (tag `0008_program_name`) — next idx is 5.

---

## Deployment Checklist (New for v2.4)

Items that have no parallel in prior milestones:

1. **Render service creation** — new web service, link to GitHub repo
2. **Persistent disk attachment** — mount at `/var/data` via Render dashboard
3. **Runtime env vars** — `DATABASE_URL`, `JWT_SECRET`, `SAM_GOV_API_KEY`, `NODE_ENV`, `ADMIN_SECRET`
4. **Build env var** — `VITE_API_BASE_URL` set to Render service URL (build-time)
5. **Port config** — Express reads `process.env.PORT ?? 4099`
6. **Static file serving** — Express must serve `dist/` (Vite build output) in production; Vite dev proxy only works in dev mode
7. **Drizzle migrations** — run `drizzle-kit migrate` in Render build command or as a startup script

---

## Sources

- `package.json` — confirmed installed versions (HIGH confidence, read directly)
- pdf-lib AcroForm API: `https://pdf-lib.js.org/docs/api/classes/pdfform` (HIGH confidence)
- CA DIR eCPR requirements: `https://www.dir.ca.gov/public-works/certified-payroll-reporting.html` (HIGH confidence — official source)
- CA DIR DAS-140 form: `https://www.dir.ca.gov/DAS/DASForm140.pdf` — confirmed AcroForm present (HIGH confidence)
- CA DIR Form A-1-131: `https://www.dir.ca.gov/dlse/forms/pw/dlseforma-1-131.pdf` — confirmed AcroForm present (HIGH confidence)
- WA L&I PWIA online requirement: `https://lni.wa.gov/licensing-permits/public-works-projects/awarding-agencies/` (HIGH confidence — official source)
- csv-stringify npm: `https://www.npmjs.com/package/csv-stringify` — version 6.7.0 confirmed (HIGH confidence)
- Render pricing: `https://render.com/pricing` — $7/month Starter, $0.25/GB/month disk (HIGH confidence — official source, fetched live)
- Render persistent disks: `https://render.com/docs/disks` (HIGH confidence — official docs)
- Fly.io SQLite volumes: `https://fly.io/docs/js/prisma/sqlite/` (HIGH confidence — official docs)
- Railway volumes: `https://docs.railway.com/volumes` (HIGH confidence — official docs)
- Vite env vars: `https://vite.dev/guide/env-and-mode` (HIGH confidence — official docs)
- Node.js `crypto.randomBytes`: built-in — no source needed (HIGH confidence)

---

*Stack research for: HCC Prevailing Wage v2.4 — Ship-Ready + Design Elevation*
*Researched: 2026-03-24*
