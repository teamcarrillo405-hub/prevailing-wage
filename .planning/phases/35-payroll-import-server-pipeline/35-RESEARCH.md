# Phase 35: Payroll Import — Server Pipeline — Research

**Researched:** 2026-03-30
**Domain:** CSV parsing, multipart file upload, payroll provider format detection, Drizzle ORM insert
**Confidence:** MEDIUM — QB/ADP column headers are LOW confidence (no official machine-readable spec found); all Node.js/library APIs are HIGH confidence from installed source

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Target QuickBooks "Time by Employee Detail" report (CSV). Daily hours per employee per job. Researcher confirms exact column headers below.
- **D-02:** ADP target format confirmed by researcher (see ADP section below).
- **D-03:** Auto-detect provider by column signature. `detectProvider(headers: string[]): 'quickbooks' | 'adp' | 'unknown'`. Unknown → 400 with message: "Could not detect payroll provider. Upload a QuickBooks Time by Employee Detail or ADP payroll export."
- **D-04:** Case-insensitive exact string match. Trim whitespace. Three buckets: `matched`, `unmatched`, `conflict`.
- **D-05:** Rates from worker's active classification snapshot — NEVER from CSV.
- **D-06:** Conflict = matched worker already has a `payrollEntry` for this week. Returns as `conflicts[]`, not committed. Message: "Worker already has a manual entry for this week. Delete it before importing."
- **D-07:** Preview response shape: `{ provider, weekId, matched: ImportedRow[], unmatched: UnmatchedRow[], conflicts: ConflictRow[] }`.
- **D-08/D-09:** Commit route accepts resolved rows from client — does NOT re-parse the file.
- **D-10:** Both routes check `week.submittedAt` → 423 if set.
- **D-11:** `payroll_imports` table — event-level only (one row per commit).
- **D-12:** Migration `0020_payroll_imports.sql`, idx 16 in `_journal.json`.
- **D-13:** Two routes on new `import` router mounted at `/api/payroll/import`.
- **D-14:** multer memoryStorage, 5 MB limit, CSV MIME types only.
- **D-15:** `importService.ts` + `qbMapper.ts` + `adpMapper.ts` + `import.ts` route.

### Claude's Discretion

- Exact QB "Time by Employee Detail" column header names — researcher confirms
- ADP column headers — researcher confirms
- Error message copy for malformed CSV (non-payroll file uploaded)
- Use papaparse (not csv-parse) for consistency with existing csvExporter.ts

### Deferred Ideas (OUT OF SCOPE)

- Row-level `payroll_imports` audit (entry traceability + undo-import)
- Fuzzy worker name matching
- Re-upload same file detection
- ADP Workforce Now enterprise format (if rare among small contractors)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PI-01 | User can upload a QuickBooks payroll export file to pre-populate a payroll week's entries — worker names, trade classifications, base rates, fringe rates, and hours by day (ST/OT) | QB column headers documented below; papaparse Buffer API verified; multer memoryStorage API verified from installed source |
| PI-02 | User can upload an ADP payroll export file with the same pre-population behavior as PI-01 | ADP Run column headers documented (LOW confidence); daily breakdown limitation flagged; fallback design specified |
</phase_requirements>

---

## Summary

Phase 35 builds the pure server-side pipeline for payroll CSV import. The two routes (`preview` and `commit`) are the first new routes in the v3.0 milestone that handle file uploads. All library dependencies are already installed (multer 2.1.1, papaparse 5.5.3). The primary implementation risk is the QB and ADP column format uncertainty — both formats are confirmed from secondary sources but neither Intuit nor ADP publishes a machine-readable CSV schema, so the mapper code must be written defensively with clear column constants and graceful degradation.

**QuickBooks "Time by Employee Detail"** is a time-tracking report (not a payroll register). Each row is one time activity: one employee, one date, one customer/job, one duration in hours. This means the QB mapper must aggregate rows by employee across the week to produce the day-by-day ST/OT breakdown that `payrollEntries` expects. One CSV may have 5–35 rows per employee (one per working day per job). The QB CSV is the correct source because it provides daily granularity; the payroll register does not.

**ADP Run** is the most common ADP tier for small/mid construction contractors (1–49 employees). The ADP Run timesheet import/export format provides weekly totals only (Reg Hours + O/T Hours) with no daily breakdown. This is a confirmed limitation — daily hour breakdown is not available in any standard ADP Run export. The `adpMapper` must populate all hours into a single day (Friday or the week-ending date) or distribute evenly, and the preview must surface a clear warning. ADP Workforce Now (larger contractors) may have daily breakdowns via custom reports but is deferred.

**Primary recommendation:** Build QB mapper with row-aggregation logic (date → day-of-week → ST/OT bucket) and ADP mapper with weekly-totals-only fallback. The provider detection signature difference is clear and reliable.

---

## Standard Stack

### Core (all already installed)

| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| multer | 2.1.1 | Multipart file upload | Already in package.json; memoryStorage avoids disk |
| papaparse | 5.5.3 | CSV parsing (server + client) | Already used in csvExporter.ts — consistency |
| drizzle-orm | 0.45.1 | DB insert for audit table | All DB writes use Drizzle in this project |
| zod | 4.3.6 | Request body validation | All routes use validate(ZodSchema) middleware |
| @types/multer | 2.1.0 | TypeScript types for multer | Already installed |

### No New Packages Required

All dependencies for Phase 35 are already installed. No `npm install` step.

---

## Architecture Patterns

### Recommended File Structure

```
src/server/
├── routes/
│   └── import.ts               # Express router — POST /preview, POST /commit
├── services/
│   ├── importService.ts         # Orchestrator: detect → map → match → preview
│   ├── qbMapper.ts              # QB "Time by Employee Detail" → ImportedRow[]
│   └── adpMapper.ts             # ADP Run → ImportedRow[] (weekly totals)
└── db/
    └── migrations/
        └── 0020_payroll_imports.sql
```

### Pattern 1: multer memoryStorage Configuration

**What:** Use `multer.memoryStorage()` so the uploaded file is stored as `Buffer` in `req.file.buffer`. No disk writes. No temp file cleanup needed.

**Verified from:** `node_modules/multer/README.md` (HIGH confidence — installed source)

```typescript
// Source: multer README (installed node_modules/multer/README.md)
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

// In route:
router.post('/preview', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const buffer = req.file.buffer; // Buffer — ready to pass to papaparse
  const originalname = req.file.originalname;
  // ...
});
```

**Key facts from multer source:**
- `req.file.buffer` contains the entire file as a Buffer when using MemoryStorage
- `req.file.originalname` is the filename from the user's computer
- `req.file.mimetype` is the MIME type detected from the upload
- `req.file.size` is the file size in bytes
- `limits.fileSize` accepts bytes (5 MB = 5 * 1024 * 1024)
- `fileFilter` receives `(req, file, cb)` — call `cb(null, true)` to accept, `cb(null, false)` to reject, `cb(new Error(...))` to error
- `multer.MulterError` class available for `err instanceof multer.MulterError` checks
- For Express 5 (this project uses express ^5.2.1): multer middleware still works the same way; the error-handling signature is compatible

### Pattern 2: papaparse Server-Side Buffer Parsing

**What:** Convert the Buffer to a string, then pass to `Papa.parse()`. PapaParse on Node.js accepts a string as the first argument when not in browser context. Do NOT pass the raw Buffer — convert first with `.toString('utf-8')`.

**Verified from:** `node_modules/papaparse/papaparse.js` internal source (HIGH confidence)

From the papaparse source, the input-routing logic is:
```
if (typeof _input === 'string') → StringStreamer
else if (_input.readable && _input.read && _input.on) → ReadableStreamStreamer
else if (File or Object) → FileStreamer
```

A `Buffer` is an Object, NOT a string — so passing a raw Buffer triggers the FileStreamer (browser File API), which fails on Node.js. The correct server-side pattern is:

```typescript
// Source: papaparse internals (node_modules/papaparse/papaparse.js)
import Papa from 'papaparse';

function parseCsvBuffer(buffer: Buffer): Papa.ParseResult<Record<string, string>> {
  const csvString = buffer.toString('utf-8');
  return Papa.parse<Record<string, string>>(csvString, {
    header: true,       // first row becomes field names
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(), // strip whitespace from headers
  });
}
// result.data — array of row objects
// result.meta.fields — array of header strings (use for detectProvider)
// result.errors — parse errors (empty for well-formed CSV)
```

The `papaparse` library is the same one used in `csvExporter.ts` (`import Papa from 'papaparse'`). The existing service uses `Papa.unparse()` for output; this phase uses `Papa.parse()` for input.

### Pattern 3: Provider Detection by Column Signature

**What:** Inspect `result.meta.fields` after parsing to identify which provider produced the file.

```typescript
// Distinguishing header signatures (see QB/ADP column research below)
const QB_SIGNATURE_COLUMNS = ['Employee', 'Duration']; // QB-specific: "Duration" not in ADP
const ADP_SIGNATURE_COLUMNS = ['Co Code', 'File #'];   // ADP-specific: not in QB

export function detectProvider(headers: string[]): 'quickbooks' | 'adp' | 'unknown' {
  const normalized = headers.map(h => h.trim());
  const hasQb = QB_SIGNATURE_COLUMNS.every(col => normalized.includes(col));
  const hasAdp = ADP_SIGNATURE_COLUMNS.every(col => normalized.includes(col));
  if (hasQb) return 'quickbooks';
  if (hasAdp) return 'adp';
  return 'unknown';
}
```

### Pattern 4: Drizzle Insert for Audit Table

**What:** Single `.insert()` call after all entries committed. Mirrors existing payrollService.ts pattern.

```typescript
// Source: payrollService.ts upsertPayrollEntry pattern (verified HIGH confidence)
import { randomUUID } from 'crypto';
import { payrollImports } from '../db/schema.js';

await db.insert(payrollImports).values({
  id: randomUUID(),
  payrollWeekId: weekId,
  importedByUserId: userId,
  provider,
  sourceFilename: originalname ?? null,
  committedCount: matched.length,
  unmatchedCount: unmatched.length,
  createdAt: new Date().toISOString(),
});
```

### Pattern 5: Route Auth Pattern (from payroll.ts)

Replicate exactly from `src/server/routes/payroll.ts`:

```typescript
// Source: src/server/routes/payroll.ts (verified HIGH confidence)
const userId = req.user!.userId;
const week = await getPayrollWeek(weekId);
if (!week) return res.status(404).json({ error: 'Payroll week not found' });

const db = getDb();
try {
  await assertProjectAccess(db, week.projectId, userId);
} catch (err: any) {
  return res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
}

if (week.submittedAt) {
  return res.status(423).json({ error: 'This payroll week is submitted and cannot be modified.' });
}
```

### Pattern 6: Migration SQL Format

Verified from `0019_agency_submission.sql` — statement-breakpoint is `--> statement-breakpoint` (one space before `-->`, two after it). For a `CREATE TABLE` with a single statement, no breakpoint is needed:

```sql
CREATE TABLE payroll_imports (
  id TEXT PRIMARY KEY,
  payroll_week_id TEXT NOT NULL REFERENCES payroll_weeks(id),
  imported_by_user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  source_filename TEXT,
  committed_count INTEGER NOT NULL,
  unmatched_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
```

### Anti-Patterns to Avoid

- **Passing raw Buffer to Papa.parse():** Will trigger FileStreamer (browser API) — convert to string first with `buffer.toString('utf-8')`.
- **Using `csv-parse` instead of `papaparse`:** Decision locked to papaparse for consistency.
- **Deriving rates from CSV columns:** Rates MUST come from `getCachedClassifications()` / worker's active classification. Never from CSV.
- **Relying on DB unique constraint to catch conflicts:** Pre-check `payrollEntries` for existing rows before any insert attempt — do not rely on the DB error.
- **Re-parsing the CSV in the commit route:** The commit route receives resolved rows as JSON body. No file re-upload.
- **Catching multer errors inside the route body:** multer errors propagate via `next(err)`. Wrap in error-handling middleware or call `upload(req, res, (err) => { if (err instanceof multer.MulterError) ... })`.

---

## QuickBooks "Time by Employee Detail" — Column Format

**Confidence: LOW-MEDIUM** — No official machine-readable schema from Intuit. Derived from: community posts, third-party import tool documentation, QB timesheet import template requirements.

### Background

The "Time by Employee Detail" report is under Reports > Jobs, Time & Mileage in QB Desktop (and Reports > Time & Mileage in QB Online). It shows individual time activity entries — one row per time entry, not one row per day per employee. A single employee working 5 days produces 5+ rows (one per time entry per day/job).

### Confirmed Column Headers (QB Desktop — Time by Employee Detail export)

The QB Desktop export produces a flat CSV where **each row is one time entry**:

| Column Name | Content | Notes |
|-------------|---------|-------|
| `Employee` | Employee full name (e.g., "John Smith") | Primary match key |
| `Date` | Date of time entry (e.g., "12/15/2024") | Used to derive day-of-week |
| `Customer:Job` | Job/project name | Not used for matching — filtering by project done upstream |
| `Service Item` | Payroll item / service item | May be "Regular Time", "Overtime", "Double Time" |
| `Payroll Item` | Payroll item code | Often same as Service Item |
| `Duration` | Hours as decimal (e.g., "8.00") | Total hours for this entry |
| `Billable` | "Yes"/"No" or "true"/"false" | Not used |
| `Notes` | Free-text notes | Not used |

**QB Desktop identifier columns:** `Employee` + `Duration` (no "Co Code" or "File #")

**QB Online / QuickBooks Time:** Exports "Time Activities by Employee Detail" — similar structure but column names may vary slightly:
- `Employee Name` (instead of `Employee`)
- `Hours` (instead of `Duration`)
- `Date` — same
- `Customer/Project` (instead of `Customer:Job`)

### QB Mapper Logic

Because each row is one time entry (not one day), the mapper must:
1. Group rows by `Employee` (case-insensitive after trim)
2. For each employee, iterate rows and map `Date` → day-of-week → ST/OT bucket
3. Detect OT from `Payroll Item` / `Service Item` value:
   - `"Regular Time"` or `"Straight Time"` → ST hours
   - `"Overtime"` or `"OT"` → OT hours
   - `"Double Time"` → OT hours (no double-time field in `payrollEntries` for import phase)
4. Sum hours per day per type → populate `monSt`, `monOt`, etc.

**Date parsing:** QB Desktop exports dates as MM/DD/YYYY. Use `new Date(dateStr)` or a manual parser — do NOT assume ISO format.

### Week-Ending Date Derivation

The QB export does not include a "week ending date" column. The planner must decide how `weekId` is passed to the preview route:
- The route accepts `weekId` as a query param or body field (not from the CSV)
- The mapper does not need to derive the week — it only maps hours by day-of-week

---

## ADP Export Format

**Confidence: LOW** — ADP does not publish a public CSV schema. Confirmed from: third-party integration documentation (Clean Smarts, Timesheets.com, Connecteam), community posts. Subject to change per ADP account configuration.

### ADP Product Tier for Small/Mid Contractors

**ADP Run** (marketed as "RUN Powered by ADP") is the standard tier for 1–49 employees. Most small and mid-size prevailing wage contractors use ADP Run. ADP Workforce Now is for 50+ employees — less common in small construction shops.

**Recommendation:** Target ADP Run. Defer Workforce Now.

### ADP Run Timesheet Export — Column Headers

The ADP Run export (from Wage and Tax Register → export icon → "ADP RUN" format) produces a CSV with these columns:

| Column Name | Content | Notes |
|-------------|---------|-------|
| `Co Code` | Company code from ADP account | **ADP signature column** — use for detection |
| `Batch ID` | Counter for each payroll run | Not used |
| `File #` | Employee's Payroll System ID in ADP | **ADP signature column** — use for detection |
| `First Name` | Employee first name | Combined with Last Name for matching |
| `Last Name` | Employee last name | Combined with First Name for matching |
| `Week` | Pay period identifier | Not used (weekId from route param) |
| `Temp Cost Number` | Cost center / job code | Not used |
| `Reg Hours` | Weekly regular hours total | **No daily breakdown** |
| `O/T Hours` | Weekly overtime hours total | **No daily breakdown** |
| `Hours 3 Code` | Code for additional pay type | Not used |
| `Hours 3 Amount` | Hours for additional pay type | Not used |
| `Reg Earnings` | Not used (left to ADP) | Not used |
| `O/T Earnings` | Not used (left to ADP) | Not used |

**Key constraint: NO daily breakdown.** ADP Run exports weekly totals only. This is a confirmed limitation, not a configuration issue.

### ADP Mapper — Daily Breakdown Fallback

Since ADP provides only weekly totals, the adpMapper must make a design decision on how to populate the 14 day columns (Mon-Sun ST + OT):

**Recommended approach (implement, flag in preview):**
- Populate all hours into the **week-ending day** (derive from `weekEndingDate` on the payroll week record)
- Set all other days to 0
- Add a warning flag in the preview: `{ adpWarning: "ADP export does not include daily breakdown. All hours assigned to [day]. Edit entries after import to adjust." }`

**Alternative:** Planner may choose to distribute hours equally across 5 weekdays — but this is less predictable and harder to audit.

**ADP employee name:** ADP exports `First Name` + `Last Name` separately. Concatenate as `${row['First Name'].trim()} ${row['Last Name'].trim()}` for matching against project worker names.

### ADP Identifier Columns for Detection

`Co Code` and `File #` are unique to ADP Run. Neither appears in QB exports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom string split / line-by-line parser | papaparse | Quote escaping, BOM stripping, multi-line values |
| File upload buffering | Manual busboy configuration | multer memoryStorage | multer wraps busboy correctly; handles multipart boundaries |
| UUID generation | Custom ID generator | `randomUUID()` from `node:crypto` | Already used throughout project |
| DB insertion | Raw SQL string | Drizzle `.insert().values()` | Type safety, FK validation |

---

## Common Pitfalls

### Pitfall 1: Raw Buffer to Papa.parse()
**What goes wrong:** `Papa.parse(req.file.buffer, { header: true })` — papaparse sees an Object (not a string) and tries to use FileStreamer (browser API), which fails on Node.js with a confusing error.
**Why it happens:** papaparse's input routing checks `typeof _input === 'string'` first; Buffer fails this check.
**How to avoid:** Always convert first: `Papa.parse(req.file.buffer.toString('utf-8'), { ... })`
**Warning signs:** "FileReader is not defined" or "undefined is not a constructor" errors in server-side parse.

### Pitfall 2: QB Date Format (MM/DD/YYYY not ISO)
**What goes wrong:** `new Date("12/15/2024").getDay()` returns wrong result on some Node.js versions because date parsing of locale strings is implementation-defined.
**Why it happens:** QB Desktop exports MM/DD/YYYY, not ISO 8601. `new Date()` parsing of non-ISO dates is unreliable.
**How to avoid:** Parse the date manually: split on `/`, construct `new Date(year, month-1, day)` using numeric parts.
**Warning signs:** Wrong day-of-week assignment in preview rows.

### Pitfall 3: Unique Constraint — Pre-Check Required
**What goes wrong:** Inserting payrollEntries without checking for existing rows first. The `payrollEntryUnique` index on `(payroll_week_id, worker_id, classification_id)` will throw a DB error at insert time — after some rows have already been inserted (partial commit).
**Why it happens:** Assuming DB constraint is sufficient; the preview was supposed to catch this but didn't check correctly.
**How to avoid:** In the preview step, query `payrollEntries` for all `(weekId, workerId, classificationId)` combinations. Any match → `conflicts[]` bucket. The commit route receives only the already-screened `matched[]` from client, but should re-validate before inserting.
**Warning signs:** Partial inserts where some rows succeed before the constraint fires.

### Pitfall 4: multer Error Propagation (Express 5)
**What goes wrong:** multer's `LIMIT_FILE_SIZE` error does not reach the route handler — it propagates via `next(err)`. If the route just calls `upload.single('file')` as middleware without a wrapper, the error surfaces as a 500 from the global error handler.
**Why it happens:** multer errors bypass the route body entirely.
**How to avoid:** Either: (a) wrap in manual invocation `upload.single('file')(req, res, (err) => { if (err instanceof multer.MulterError) return res.status(400).json(...) })`, or (b) catch `MulterError` in the errorHandler middleware already in `src/server/middleware/errorHandler.js`.
**Warning signs:** 500 errors on file-too-large uploads instead of 400.

### Pitfall 5: MIME Type Spoofing
**What goes wrong:** Filtering on `file.mimetype` only — a user renames `malware.txt` to `data.csv` and the browser sends `text/csv`. The content may still be unparseable.
**Why it happens:** MIME type in multipart headers is set by the client/browser, not server-verified.
**How to avoid:** The fileFilter is a first-pass sanity check, not a security guarantee. PapaParse will return `result.errors` for malformed content. The mapper's column detection (provider signature) is the real guard.
**Warning signs:** Upload accepted, then 500 during parse.

### Pitfall 6: ADP Name Matching — Separate Name Columns
**What goes wrong:** Matching on `Last Name` alone or failing to concatenate `First Name` + `Last Name` with correct spacing.
**Why it happens:** ADP stores names in two separate columns; QB stores them in one.
**How to avoid:** ADP mapper concatenates: `const fullName = \`${row['First Name'].trim()} ${row['Last Name'].trim()}\``. Worker matching normalizes both sides to lowercase before comparing.
**Warning signs:** Zero matches on ADP imports where names clearly exist in the project.

### Pitfall 7: migration idx Out of Sequence
**What goes wrong:** Registering migration at wrong idx in `_journal.json` — Drizzle skips it silently or runs it out of order.
**Why it happens:** Last entry in `_journal.json` is idx 15 (tag: `0019_agency_submission`). Next must be idx 16.
**How to avoid:** Always verify by reading `_journal.json` before adding new entry. The `when` timestamp should be newer than idx 15 (1775100000000).
**Warning signs:** `payroll_imports` table doesn't exist at runtime; no error thrown by Drizzle.

---

## Code Examples

### multer setup for import route

```typescript
// Source: node_modules/multer/README.md (HIGH confidence)
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    cb(null, allowed.includes(file.mimetype));
  },
});
```

### papaparse Buffer parsing

```typescript
// Source: papaparse source analysis (HIGH confidence)
import Papa from 'papaparse';

const result = Papa.parse<Record<string, string>>(
  buffer.toString('utf-8'),
  {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  }
);

const headers = result.meta.fields ?? [];
const rows = result.data;
```

### QB date to day-of-week (safe parsing)

```typescript
// Parse MM/DD/YYYY safely — do not rely on Date() locale parsing
function parseMdyDate(dateStr: string): Date {
  const [month, day, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

// 0=Sunday, 1=Monday, ..., 6=Saturday
const DAY_KEYS: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] =
  ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const dayKey = DAY_KEYS[parseMdyDate(row['Date']).getDay()];
```

### QB payroll item to ST/OT detection

```typescript
function isOvertimeItem(payrollItem: string): boolean {
  const lower = payrollItem.toLowerCase().trim();
  return lower.includes('overtime') || lower === 'o/t' || lower === 'ot';
}
```

### Route skeleton — preview

```typescript
// Source: pattern from src/server/routes/payroll.ts (HIGH confidence)
router.post('/preview', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const userId = req.user!.userId;
  const { weekId } = req.body as { weekId: string };

  const week = await getPayrollWeek(weekId);
  if (!week) return res.status(404).json({ error: 'Payroll week not found' });

  const db = getDb();
  try {
    await assertProjectAccess(db, week.projectId, userId);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  }

  if (week.submittedAt) {
    return res.status(423).json({ error: 'This payroll week is submitted and cannot be modified.' });
  }

  try {
    const preview = await parseImportFile(req.file.buffer, weekId, week.projectId);
    return res.json(preview);
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? 'Failed to parse import file' });
  }
});
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase is purely code/config changes using already-installed Node.js packages. No external services, databases (other than the app's own SQLite), or CLI tools are introduced. All libraries (multer, papaparse, drizzle-orm) are already installed and verified above.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test -- --reporter=verbose tests/routes/import.test.ts tests/services/importService.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PI-01 | QB CSV upload returns structured preview with matched/unmatched/conflict | integration | `npm run test -- tests/routes/import.test.ts` | ❌ Wave 0 |
| PI-01 | QB mapper correctly aggregates daily rows, parses MM/DD/YYYY dates, maps ST/OT | unit | `npm run test -- tests/services/importService.test.ts` | ❌ Wave 0 |
| PI-01 | Submitted week returns 423 on preview | integration | `npm run test -- tests/routes/import.test.ts` | ❌ Wave 0 |
| PI-01 | Commit route inserts payrollEntries + audit row | integration | `npm run test -- tests/routes/import.test.ts` | ❌ Wave 0 |
| PI-02 | ADP CSV upload returns preview with weekly-total warning | integration | `npm run test -- tests/routes/import.test.ts` | ❌ Wave 0 |
| PI-02 | ADP mapper concatenates First Name + Last Name for matching | unit | `npm run test -- tests/services/importService.test.ts` | ❌ Wave 0 |
| PI-01/PI-02 | Unknown provider returns 400 with user-facing message | integration | `npm run test -- tests/routes/import.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- tests/routes/import.test.ts tests/services/importService.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work 35`

### Wave 0 Gaps

- [ ] `tests/routes/import.test.ts` — covers route-level PI-01, PI-02 (multipart upload, 423 lock, 400 unknown provider, commit)
- [ ] `tests/services/importService.test.ts` — covers QB mapper date parsing, ST/OT detection, ADP name concatenation, provider detection, conflict pre-check
- [ ] `tests/fixtures/qb-time-by-employee-detail.csv` — sample QB CSV fixture for tests
- [ ] `tests/fixtures/adp-run-payroll.csv` — sample ADP Run CSV fixture for tests

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Disk storage for uploads (multer `dest`) | Memory storage (`memoryStorage()`) | No temp file cleanup; buffer directly available |
| Global parse error on unknown CSV | 400 with user-facing message | Better UX; not a 500 crash |
| Trust client-sent rate values | Rates from WD cache / classification snapshot only | Compliance invariant preserved |

---

## Open Questions

1. **QB Online vs QB Desktop column name differences**
   - What we know: QB Desktop uses `Employee` and `Duration`; QB Online / QuickBooks Time uses `Employee Name` and `Hours`
   - What's unclear: Whether any contractor uses QB Online for prevailing wage reporting (most use QB Desktop for job costing)
   - Recommendation: Handle both in the QB mapper via a column-alias normalization step: `const employeeCol = headers.includes('Employee') ? 'Employee' : 'Employee Name'`

2. **QB "Payroll Item" vs "Service Item" for OT detection**
   - What we know: QB has both fields; their exact values depend on how the contractor configured QB time items
   - What's unclear: Whether "Regular Time" / "Overtime" are standard default values or contractor-customized
   - Recommendation: Make QB overtime detection configurable via a simple check — prefer `Payroll Item` column if present; fall back to `Service Item`. Allow any value containing "overtime" (case-insensitive) to route to OT bucket.

3. **ADP hours distribution — single-day vs. uniform spread**
   - What we know: ADP provides weekly totals only (no daily breakdown)
   - What's unclear: Whether the planner wants all-hours-on-Friday or an even Mon-Fri spread
   - Recommendation: Document the decision in `adpMapper.ts` constants. All-on-Friday is simpler and easier for the contractor to audit/edit. Include this choice in the preview `adpWarning` field.

4. **multer MIME type filtering — `text/plain` inclusion**
   - What we know: Some systems export CSV with `text/plain` MIME type instead of `text/csv`
   - What's unclear: Whether including `text/plain` creates an unacceptable security surface
   - Recommendation: Include `text/plain` in the allowed list (the provider detection acts as content-level validation). A non-CSV `text/plain` will fail provider detection and return 400.

---

## Project Constraints (from CLAUDE.md)

These directives from `CLAUDE.md` apply to Phase 35 and must be honored by the planner:

| Constraint | Applies To |
|------------|------------|
| NEVER hard-delete payroll weeks or projects | Not applicable — import only inserts, never deletes |
| Amendments must create new payrollWeeks rows — never update in place | Not applicable — import creates new entries, not weeks |
| Rate snapshots must NEVER be cloned from CSV columns — always re-fetch from WD cache | Critical for adpMapper and qbMapper — enforced by D-05 |
| Server-side edit lock on submitted weeks is non-negotiable | Both import routes must check `week.submittedAt` before any action |
| Migrations: always register in `meta/_journal.json` | Migration idx 16 must be registered in `_journal.json` |
| Statement separator: `--> statement-breakpoint` (single space) | Applies to `0020_payroll_imports.sql` if multiple statements |
| Design tokens via `@theme` — no hardcoded colors | N/A — Phase 35 is server-only |
| Use existing auth pattern: `req.user!.userId` + `assertProjectAccess` | Both import routes |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/multer/README.md` (installed v2.1.1) — memoryStorage API, fileFilter, limits.fileSize
- `node_modules/papaparse/papaparse.js` (installed v5.5.3) — Buffer vs string input routing, parse options
- `src/server/routes/payroll.ts` — assertProjectAccess + 423 lock pattern
- `src/server/services/csvExporter.ts` — Papa.unparse() precedent; confirms `import Papa from 'papaparse'`
- `src/server/services/payrollService.ts` — Drizzle insert pattern for payrollEntries
- `src/server/db/migrations/meta/_journal.json` — confirmed idx 15 is last; idx 16 is next
- `src/server/db/migrations/0019_agency_submission.sql` — confirmed breakpoint format `--> statement-breakpoint`
- `src/server/db/schema.ts` — payrollEntries unique index, payrollWeeks.submittedAt

### Secondary (MEDIUM confidence)
- [SaasAnt QB Desktop timesheet import columns](https://support.saasant.com/support/solutions/articles/14000096952) — confirms `Date`, `Name`, `Duration`, `Customer: Job`, `Billable Status`, `Service Item`, `Payroll Item` fields
- [Clean Smarts ADP export format](https://support.cleansmarts.com/article/103-how-do-i-export-timesheet-data-in-adp-format) — confirms `Co Code`, `Batch ID`, `File #`, `First Name`, `Last Name`, `Week`, `Reg Hours`, `O/T Hours` columns
- ADP marketplace listing for "Points North Certified Payroll Reporting for RUN Powered by ADP" — confirms ADP Run is the correct tier for small construction contractors

### Tertiary (LOW confidence)
- WebSearch synthesis for QB Desktop "Time by Employee Detail" column structure — no official Intuit CSV schema found; `Employee` column name and `Duration` format from community posts and third-party import tool docs
- ADP daily breakdown absence — confirmed by multiple third-party sources (Connecteam, Timesheets.com) but no official ADP statement

---

## Metadata

**Confidence breakdown:**
- Standard stack (libraries/APIs): HIGH — verified from installed node_modules source
- Architecture patterns (route auth, Drizzle insert): HIGH — verified from existing project files
- QB column headers: LOW-MEDIUM — no official Intuit CSV schema; derived from third-party tools and community posts
- ADP column headers: LOW — no official ADP CSV schema; derived from third-party integration docs
- Conflict detection / migration: HIGH — verified from schema.ts and existing migration files

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (QB/ADP formats are stable; library APIs are stable)
