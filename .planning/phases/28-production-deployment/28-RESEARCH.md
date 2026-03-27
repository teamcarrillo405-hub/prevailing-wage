# Phase 28: Production Deployment - Research

**Researched:** 2026-03-26
**Domain:** Render.com deployment, Express static serving, ESM Node.js, TypeScript build configuration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Render.com Web Service — single host for the full stack. Express serves both `/api/*` routes and the Vite-built React static files from `dist/client/`. GitHub repo connected to Render for auto-deploy on push to `main`.
- **D-02:** Free tier to start. Upgrade to Starter ($7/month) when ready for production traffic. No changes required to upgrade.
- **D-03:** Service name: `hcc-prevailing-wage` → URL: `https://hcc-prevailing-wage.onrender.com`
- **D-04:** Native Node.js (not Docker). Build command: `npm run build`. Start command: `node dist/server/index.js`. Node version: match `.node-version` or `engines.node` in `package.json`.
- **D-05:** Render Disk — 1 GB at `/var/data` (~$1/month). SQLite at `/var/data/prevailing-wage.db`.
- **D-06:** Set `DATABASE_PATH=/var/data/prevailing-wage.db` as Render env var. No code change for path reading.
- **D-07:** `mkdirSync('./data', { recursive: true })` in `db/index.ts` must use `path.dirname(dbPath)` instead.
- **D-08:** Add `tsconfig.server.json` targeting Node.js: `outDir: "dist/server"`, `rootDir: "src/server"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `exclude: ["src/client/**"]`.
- **D-09:** Update `package.json` build script: `"build": "tsc -p tsconfig.server.json && vite build"`.
- **D-10:** Start command: `node dist/server/index.js` (ESM, no tsx).
- **D-11:** Keep ESM throughout — `"type": "module"` already set.
- **D-12:** Static file block in `src/server/index.ts` after all `/api/` route registrations, before error handler, production-only.
- **D-13:** Use `import.meta.url` + `fileURLToPath` for ESM `__dirname` equivalent.
- **D-14:** Dev workflow unchanged — Vite dev server handles static serving in development.
- **D-15:** Add `INVITE_CODE` as Render env var (shared secret).
- **D-16:** Invite code check in `src/server/routes/auth.ts`: add `inviteCode?: string` to `RegisterSchema`; check at top of handler; absent env var = open registration.
- **D-17:** Add "Invitation Code" text field to `src/client/pages/RegisterPage.tsx` (via `RegisterForm`).
- **D-18:** Update `.env.example` with all vars including `INVITE_CODE`.
- **D-19:** SAM.gov WDOL API requires no API key — OPS-03 satisfied.
- **D-20:** All sensitive values set as Render runtime env vars. No `VITE_`-prefixed secrets exist.
- **D-21:** Set `NODE_ENV=production` as Render env var.
- **D-22:** Connect GitHub repo via Render dashboard OAuth. Auto-deploy on push to `main`.
- **D-23:** No GitHub Actions workflow needed.
- **D-24:** Add `render.yaml` Blueprint file defining service, disk, and env vars.

### Claude's Discretion

- Exact `tsconfig.server.json` compiler options (target, lib, strict) — match existing tsconfig.json strictness
- Whether to add a `postbuild` script to verify `dist/server/index.js` exists
- Error message wording for invalid invite code (keep short and not revealing)
- Whether to add a `CORS_ORIGIN` env var update for production URL in render.yaml

### Deferred Ideas (OUT OF SCOPE)

- Custom domain (e.g. wage.hcctx.com)
- GitHub Actions CI workflow
- Turso/serverless DB migration
- Vercel/Netlify for frontend

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | App deployed to a live HTTPS URL on Render.com with SQLite on a persistent disk volume (`/var/data/prevailing-wage.db`); Drizzle migrations run at app startup | render.yaml Blueprint, mkdirSync fix, `engines.node` addition, Node 24 availability on Render |
| OPS-02 | Registration requires a valid invitation code — open registration disabled in production | RegisterSchema extension, handler check, RegisterForm field addition |
| OPS-03 | SAM.gov API key and all secrets configured via environment variables; `.env.example` documents every required variable | Confirmed: no SAM.gov key needed. `.env.example` needs `INVITE_CODE` added |
| OPS-04 | Vite production build served as static files by Express in production mode | `tsconfig.server.json`, build script update, static serving block in `index.ts`, ESM `__dirname` shim |

</phase_requirements>

---

## Summary

This is a pure deployment and configuration phase — no new application features. All changes are code configuration, a new build target, and Render platform setup. The existing codebase is well-prepared: `DATABASE_PATH` env var already drives the DB path, `PORT` is already env-driven, `secure` cookies already gate on `NODE_ENV === 'production'`, and `better-sqlite3` is already in `dependencies`.

Six surgical code changes are required before Render will function correctly: fix the hardcoded `mkdirSync` call, add the ESM `__dirname` shim to `index.ts`, insert the production static file serving block, update the build script to use a server-specific tsconfig, add invite code gating to the auth route, and add the invitation code field to `RegisterForm`. Two new files must be created: `tsconfig.server.json` and `render.yaml`.

One critical pre-deploy concern flagged in STATE.md — WAL pragma on Render NFS volumes — has been investigated and resolved: Render persistent disks are **block storage** (not NFS), so `journal_mode = WAL` is fully safe and must NOT be removed. The `engines.node` field is missing from `package.json` and must be added so Render selects the correct Node.js version.

**Primary recommendation:** Complete all six code changes and create `tsconfig.server.json` and `render.yaml` as a single coordinated wave before touching the Render dashboard.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^5.2.1 (already installed) | HTTP server + static file serving | Already in use |
| better-sqlite3 | ^12.8.0 (already installed) | SQLite driver | Already in use, in `dependencies` |
| drizzle-orm | ^0.45.1 (already installed) | ORM + migration runner | Already in use |

### Build Tooling

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| tsc | ^5.9.3 (typescript, already installed) | Compile server TypeScript to JS | New `tsconfig.server.json` needed |
| vite | ^8.0.0 (already installed) | Bundle React client | `outDir: ../../dist/client` already configured |

### No New Dependencies

This phase adds zero npm packages. All required functionality exists in the current stack.

**Version verification:** No new packages to verify.

---

## Architecture Patterns

### Recommended Project Structure (post-build)

```
dist/
├── server/          # tsc -p tsconfig.server.json output
│   └── index.js     # Start command target: node dist/server/index.js
└── client/          # vite build output (already configured)
    ├── index.html
    └── assets/
```

### Pattern 1: ESM `__dirname` Shim for Node.js

**What:** `import.meta.url` replaces `__dirname` in ESM modules. Required because `"type": "module"` is set in `package.json` and the compiled output will run as ESM.

**When to use:** Any server file that needs `__dirname`-style path resolution — specifically `src/server/index.ts` for serving `dist/client`.

**Exact pattern (copy verbatim into `src/server/index.ts`):**

```typescript
// Source: CONTEXT.md D-13 (verified pattern for ESM Node.js)
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### Pattern 2: Production Static File Serving Block

**What:** After all API route registrations and before the error handler, insert a production-only block that serves the Vite build and enables React Router catch-all.

**When to use:** Exactly once, in `src/server/index.ts`.

**Insertion point:** Between line 42 (`app.use('/api/reports', reportsRouter)`) and line 43 (`app.use(errorHandler)`) — confirmed by reading `src/server/index.ts`.

```typescript
// Source: CONTEXT.md D-12
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../../dist/client')));
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, '../../dist/client/index.html'));
  });
}
```

**Path math:** Compiled `index.js` lands at `dist/server/index.js`. `../../dist/client` from there resolves to `dist/client`. Correct.

### Pattern 3: `tsconfig.server.json` — Server-Only TypeScript Config

**What:** Separate tsconfig that compiles only `src/server/**` to `dist/server/`, excluding client code and DOM types.

**Why needed:** Current `tsconfig.json` has `lib: ["ESNext", "DOM", "DOM.Iterable"]` and `rootDir: src` covering all source. Running `tsc` with it would either fail (conflicting client JSX types vs server-only output) or produce mixed output in `dist/`. A server-only config isolates the compilation.

**Exact file to create at `tsconfig.server.json`:**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist/server",
    "rootDir": "src/server"
  },
  "include": ["src/server/**/*"],
  "exclude": ["node_modules", "dist", "src/client/**"]
}
```

**Key differences from root `tsconfig.json`:**
- No `"DOM"` or `"DOM.Iterable"` in `lib` — server code should not reference browser APIs
- No `"jsx": "react-jsx"` — server has no JSX
- No `"paths"` aliases — server imports use `.js` extensions directly
- `rootDir: "src/server"` instead of `"src"` — tighter scope

### Pattern 4: `mkdirSync` Fix for Arbitrary `DATABASE_PATH`

**What:** Current code hardcodes `./data` as the directory to create. When `DATABASE_PATH=/var/data/prevailing-wage.db`, `mkdirSync('./data')` creates a useless local `./data/` directory and never creates `/var/data/` (which the Render Disk provides). However, `path.dirname()` is still needed in case Render Disk does not pre-create subdirectories.

**Current code (`src/server/db/index.ts:8`):**
```typescript
mkdirSync('./data', { recursive: true });
```

**Replacement (requires adding `import { dirname } from 'path'` or using the already-imported `path` module):**
```typescript
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = process.env.DATABASE_PATH || './data/prevailing-wage.db';
mkdirSync(dirname(dbPath), { recursive: true });
```

**Note:** `path` is not currently imported in `db/index.ts`. The import must be added. The `mkdirSync` import already exists on line 5.

### Pattern 5: Invite Code Check in `auth.ts`

**RegisterSchema change** (current schema at lines 22-25):

```typescript
// Current:
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

// Updated:
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  inviteCode: z.string().optional(),
});
```

**Handler insertion point** (after line 33 `authRouter.post('/register', validate(RegisterSchema), async (req, res) => {`):

```typescript
// Insert as FIRST check inside the handler body, before duplicate email check:
const { email, password, inviteCode } = req.body as z.infer<typeof RegisterSchema>;
if (process.env.INVITE_CODE && inviteCode !== process.env.INVITE_CODE) {
  res.status(403).json({ error: 'Invalid invitation code' });
  return;
}
```

**Current handler extracts** `const { email, password } = req.body` at line 34 — this destructure must be updated to include `inviteCode`.

### Pattern 6: `RegisterForm` Invite Code Field

**Context:** `RegisterPage.tsx` delegates all form logic to `RegisterForm` component at `src/client/components/auth/RegisterForm.tsx`. Changes go in `RegisterForm`, not `RegisterPage`.

**Current form state:** Uses `react-hook-form` + zod resolver. Schema has `email` and `password` fields. Submit calls `api.post('/auth/register', { email, password })`.

**Changes required:**

1. Add `inviteCode: z.string().min(1, 'Invitation code required')` to the client-side `RegisterSchema`
2. Add `inviteCode` to the `useForm` type
3. Add the field to the JSX (between password and submit button)
4. Include `inviteCode` in the `api.post` payload

**Field JSX pattern (follow existing field structure):**
```tsx
<div>
  <label htmlFor="reg-invite" className="block text-sm font-medium text-gray-700 mb-1">
    Invitation Code
  </label>
  <input
    id="reg-invite"
    type="text"
    autoComplete="off"
    {...register('inviteCode')}
    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-gold focus:border-transparent"
  />
  {errors.inviteCode && (
    <p className="text-red-600 text-xs mt-1">{errors.inviteCode.message}</p>
  )}
</div>
```

**Also fix:** Submit button at line 79 uses hardcoded `bg-[#F5C518]` — CLAUDE.md requires `bg-brand-gold`. Fix this during the same edit.

### Pattern 7: `render.yaml` Blueprint

**Exact content (per CONTEXT.md D-24, with `CORS_ORIGIN` addition for production):**

```yaml
services:
  - type: web
    name: hcc-prevailing-wage
    runtime: node
    buildCommand: npm run build
    startCommand: node dist/server/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_PATH
        value: /var/data/prevailing-wage.db
      - key: CORS_ORIGIN
        value: https://hcc-prevailing-wage.onrender.com
      - key: JWT_SECRET
        generateValue: true
      - key: INVITE_CODE
        sync: false
    disk:
      name: data
      mountPath: /var/data
      sizeGB: 1
```

**Notes on `render.yaml` behavior:**
- `generateValue: true` — Render auto-generates a cryptographically strong `JWT_SECRET` on first deploy. Never committed to git.
- `sync: false` — `INVITE_CODE` must be set manually in Render dashboard. Render will NOT sync it from `render.yaml`, protecting it from accidental git exposure.
- Disk definition in `render.yaml` requires a Render paid plan for the disk add-on ($1/month). The web service itself can remain on free tier.

### Anti-Patterns to Avoid

- **Running `tsc` with the root `tsconfig.json` for server build:** Produces output that mixes client/server paths and may fail due to DOM vs. Node.js type conflicts. Always use `tsc -p tsconfig.server.json`.
- **Committing `INVITE_CODE` to `render.yaml`:** Use `sync: false` so it is never in git. Set it only in the Render dashboard.
- **Removing WAL pragma before deploy:** WAL mode is safe on Render persistent disk (block storage, not NFS). Removing it would be a regression.
- **Placing the static file catch-all before API routes:** `app.get('*', ...)` must come AFTER all `app.use('/api/...')` registrations or it will intercept API requests.
- **Using `__dirname` directly in ESM:** Not available in ESM context. Must use `fileURLToPath(import.meta.url)` pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node.js version specification | Manual Render dashboard selection | `engines.node` in `package.json` | Render reads this automatically; avoids version drift across deploys |
| Static file serving | Custom route handlers per file | `express.static()` | Handles ETags, cache headers, range requests, MIME types correctly |
| Secret generation | Manually typed random strings | `generateValue: true` in render.yaml | Render generates cryptographically strong secrets; eliminates weak secrets |
| Production environment detection | Custom flags or config files | `NODE_ENV=production` env var | Universal Node.js convention; already gates `secure` cookie in `auth.ts` |

**Key insight:** This phase is entirely about wiring existing capabilities together correctly, not building new solutions.

---

## Runtime State Inventory

> Included because this phase involves deployment configuration changes that affect runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | SQLite DB at `./data/prevailing-wage.db` (local dev) → moves to `/var/data/prevailing-wage.db` on Render | No migration needed — fresh deploy starts with empty DB; Drizzle `migrate()` runs on startup |
| Live service config | No external services configured yet | None |
| OS-registered state | None — no Task Scheduler, pm2, or systemd involved | None |
| Secrets/env vars | `JWT_SECRET` not in `.env.example` as "required", `INVITE_CODE` missing entirely | Add `INVITE_CODE` to `.env.example`; document `JWT_SECRET` minimum length |
| Build artifacts | `dist/` in `.gitignore` (confirmed line 2) — build runs fresh on each Render deploy | None |

---

## Common Pitfalls

### Pitfall 1: WAL Mode on Render Disk (Investigated — NOT a problem)

**What goes wrong:** STATE.md flags "Audit db/index.ts for PRAGMA journal_mode=WAL before deploy (must disable for Render NFS volume)". This concern was for NFS-based storage.

**Resolution:** Render persistent disks are **block storage** (EBS-equivalent), not NFS. WAL mode works correctly on block storage — it requires file locking, which block storage supports. The `journal_mode = WAL` pragma at `db/index.ts:10` must remain in place.

**Confidence:** MEDIUM — based on Render's documented disk type as "SSD-backed block storage". WAL is safe.

**Warning sign:** If the DB opens with `SQLITE_IOERR` errors on Render, that would indicate NFS; diagnose via Render logs.

### Pitfall 2: `engines.node` Missing — Render May Use Wrong Node Version

**What goes wrong:** `package.json` has no `engines` field and no `.node-version` file. Render defaults to its own internal LTS default, which may not match the Node 24.x used locally.

**Why it happens:** `better-sqlite3` ships pre-compiled native binaries. If Render builds with a different Node major version than expected, the binary may need recompilation. Mismatched versions can also affect ESM behavior.

**How to avoid:** Add `"engines": { "node": ">=20.0.0" }` to `package.json`. This signals to Render which major version to use. Node 20+ is LTS and fully supports ESM, `import.meta.url`, and `better-sqlite3` 12.x.

**Warning signs:** Build error mentioning "was compiled against a different Node.js version" or native addon errors.

### Pitfall 3: Migrations Path — Relative to CWD, Not `dist/server/`

**What goes wrong:** `db/index.ts:16` calls `migrate(_db, { migrationsFolder: './src/server/db/migrations' })`. This path is relative to the **current working directory** when Node starts, not to `dist/server/index.js`.

**Why it works:** Render's start command runs from the repo root, so `./src/server/db/migrations` correctly resolves to the migrations folder (which exists in source, not in `dist/`). Migrations are NOT compiled — they are SQL files that live in `src/`.

**How to confirm it won't break:** The source tree `src/server/db/migrations/` must be present at runtime. Since Render clones the full git repo before building, `src/` is always present at the repo root. This is fine.

**Warning sign:** "no such file or directory: ./src/server/db/migrations" in Render logs = CWD is wrong; add `cd /opt/render/project/src` to start command.

### Pitfall 4: `CORS_ORIGIN` Still Points to `localhost`

**What goes wrong:** `.env.example` has `CORS_ORIGIN=http://localhost:3000`. `index.ts` line 26 reads `process.env.CORS_ORIGIN || 'http://localhost:3000'`. In production, if `CORS_ORIGIN` is not set, all browser requests from `https://hcc-prevailing-wage.onrender.com` will be blocked by CORS policy.

**Note:** `vite.config.ts` dev proxy points to port 4099, but `.env.example` still shows port 3000. This is a separate inconsistency — `.env.example` should show 4200 for `CORS_ORIGIN` in dev.

**How to avoid:** Set `CORS_ORIGIN=https://hcc-prevailing-wage.onrender.com` in `render.yaml` `envVars` block (already included in Pattern 7 above). Update `.env.example` to use correct dev port.

**Warning signs:** Browser console shows "CORS policy: No 'Access-Control-Allow-Origin' header" on API calls.

### Pitfall 5: `dist/` Exists Locally but Is Gitignored — Render Builds Fresh

**What goes wrong:** Local `dist/` directory exists (confirmed by `ls` output). Render does NOT have this — it runs `npm run build` from a fresh clone. If the updated build script (`tsc -p tsconfig.server.json && vite build`) is not correct, the deploy fails.

**How to avoid:** Test the build locally with `npm run build` after updating `package.json` and creating `tsconfig.server.json`. Verify `dist/server/index.js` exists after the build.

**Warning signs:** Render deploy log shows "Error: Cannot find module" or tsc compile errors.

### Pitfall 6: `PORT` Default Mismatch

**What goes wrong:** `index.ts` defaults to port 3001 (`process.env.PORT || 3001`). `vite.config.ts` dev proxy targets port 4099. STATE.md records "Server on port 4099" as a v1 decision.

**Resolution for Render:** Render **always** injects `PORT` as an environment variable. The `|| 3001` fallback never activates in production. No code change needed. The mismatch between 3001 and 4099 only affects local dev (where 4099 is set separately).

---

## Code Examples

### Complete `tsconfig.server.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist/server",
    "rootDir": "src/server"
  },
  "include": ["src/server/**/*"],
  "exclude": ["node_modules", "dist", "src/client/**"]
}
```

### Updated `package.json` `scripts.build`

```json
"build": "tsc -p tsconfig.server.json && vite build"
```

### Updated `package.json` `engines` field (add at root level)

```json
"engines": {
  "node": ">=20.0.0"
}
```

### Updated `db/index.ts` imports + mkdirSync fix

```typescript
// Add to imports:
import { dirname } from 'path';

// Replace line 8:
mkdirSync(dirname(dbPath), { recursive: true });
```

### `index.ts` additions (ESM shim + static block)

Add to top-level imports in `src/server/index.ts`:

```typescript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

Insert between line 42 and line 43 (between `reportsRouter` registration and `errorHandler`):

```typescript
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../../dist/client')));
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, '../../dist/client/index.html'));
  });
}
```

### Updated `.env.example`

```
JWT_SECRET=change-me-in-production-min-32-chars
DATABASE_PATH=./data/prevailing-wage.db
PORT=4099
CORS_ORIGIN=http://localhost:4200
NODE_ENV=development
INVITE_CODE=                    # Required in production; leave blank for open local dev
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CJS `__dirname` global | `fileURLToPath(import.meta.url)` ESM pattern | Node.js 12+ with `"type": "module"` | Must use new pattern; `__dirname` is undefined in ESM |
| `tsx` for production server run | `tsc` compile + `node` | Phase 28 | `tsx` is a dev dependency; compiled JS is required for production |
| Separate frontend host (Netlify/Vercel) | Single host, Express serves static | Phase 28 architectural decision | Simplifies ops; no CORS between frontend and API |

---

## Open Questions

1. **WAL Mode on Render Disk — Final Verification**
   - What we know: Render docs describe persistent disks as "SSD-backed block storage". WAL requires file locking. Block storage supports file locking.
   - What's unclear: Whether Render's disk implementation has any non-standard POSIX locking behavior (e.g., concurrent read replicas on the same disk).
   - Recommendation: Keep WAL mode. Monitor Render deploy logs for any SQLite IOERR on first deploy. If errors appear, add `PRAGMA journal_mode = DELETE` as a fallback.

2. **`argon2` Native Binary Compatibility on Render**
   - What we know: `argon2` (^0.44.0) is in `dependencies` and uses a native Node.js addon, same as `better-sqlite3`.
   - What's unclear: Whether Render's build environment has the necessary build tools (Python, GCC) to compile native addons, or whether pre-built binaries ship for Render's Linux version.
   - Recommendation: If the first deploy fails at `npm install` with `argon2` or `better-sqlite3` compilation errors, add a `.npmrc` with `--build-from-source=false` or switch to `@node-rs/argon2` (pure WASM fallback). Monitor first deploy log carefully.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime | ✓ (local) | 24.13.1 | — |
| npm | Package install | ✓ (local) | 11.8.0 | — |
| Render.com account | Hosting platform | Not verified (external) | — | Must create account |
| Render Disk add-on | SQLite persistence | Not verified (billing) | — | No fallback — required for OPS-01 |
| GitHub repository | Auto-deploy pipeline | Not verified (external) | — | Manual deploys via Render CLI |

**Missing dependencies with no fallback:**
- Render.com account with billing enabled (for Disk add-on at $1/month) — must be set up manually before deploy

**Missing dependencies with fallback:**
- GitHub connection — if not configured, manual deploy via `render.yaml` push still works

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` (exists at project root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | Drizzle migrations run at startup without error | smoke | Manual — Render deploy log verification | N/A (deploy-time) |
| OPS-01 | `mkdirSync` uses `dirname(dbPath)` not hardcoded `./data` | unit | Not automated — verify by code review | N/A |
| OPS-02 | Register with wrong invite code returns 403 | integration | `npm test` (new test needed) | ❌ Wave 0 |
| OPS-02 | Register without `INVITE_CODE` env var allows open registration | integration | `npm test` (new test needed) | ❌ Wave 0 |
| OPS-03 | `.env.example` includes all required vars | manual | Code review | N/A |
| OPS-04 | `tsc -p tsconfig.server.json` produces `dist/server/index.js` | build smoke | `npm run build` | N/A |
| OPS-04 | Static files served correctly at `/` in production mode | integration | Manual browser test post-deploy | N/A (deploy-time) |

### Sampling Rate

- **Per task commit:** `npm test` (existing suite must remain green)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + successful Render deploy before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] New test for invite code enforcement in `tests/routes/auth.test.ts` (or equivalent) — covers OPS-02
  - Test: `INVITE_CODE` set → register without code → expect 403
  - Test: `INVITE_CODE` set → register with correct code → expect 201
  - Test: `INVITE_CODE` not set → register without code → expect 201 (open registration)

*(Existing test infrastructure covers the rest — auth route tests already exist; the new invite code behavior should integrate into the existing auth test file)*

---

## Project Constraints (from CLAUDE.md)

All directives from `CLAUDE.md` that affect this phase:

| Directive | Impact on Phase 28 |
|-----------|-------------------|
| Design tokens: never hardcode `#F5C518` — use `bg-brand-gold` | `RegisterForm.tsx` submit button at line 79 uses `bg-[#F5C518]` — MUST be updated to `bg-brand-gold` during the invite code field edit |
| Never hard-delete projects or payroll weeks (29 CFR Part 3) | Not applicable to this phase |
| Migrations: always register in `meta/_journal.json` | Not applicable — no new migrations in this phase |
| `focus:outline-hidden` is the correct TailwindCSS v4 rename | New `inviteCode` field in `RegisterForm` must use `focus:outline-hidden` (already used on existing fields — follow the pattern) |
| `useRef` for synchronous guards | Not applicable to this phase |
| Server port: 4099 (moved from 3001 due to port conflicts) | `.env.example` `PORT` should be updated to 4099 to match actual dev setup |

---

## Sources

### Primary (HIGH confidence)

- Direct code audit: `src/server/index.ts` — confirmed exact line numbers for insertion point
- Direct code audit: `src/server/db/index.ts` — confirmed hardcoded `mkdirSync('./data')` at line 8 and WAL pragma at line 10
- Direct code audit: `src/server/routes/auth.ts` — confirmed `RegisterSchema` shape and handler structure
- Direct code audit: `src/client/components/auth/RegisterForm.tsx` — confirmed form fields, zod schema, submit payload
- Direct code audit: `package.json` — confirmed `"type": "module"`, no `engines` field, `better-sqlite3` in `dependencies`, current build script
- Direct code audit: `tsconfig.json` — confirmed all compiler options for `tsconfig.server.json` derivation
- Direct code audit: `vite.config.ts` — confirmed `outDir: ../../dist/client` and dev port 4099
- Direct code audit: `.gitignore` — confirmed `dist/` on line 2
- Direct code audit: `.env.example` — confirmed missing `INVITE_CODE` and PORT/CORS_ORIGIN inconsistencies
- CONTEXT.md (CONTEXT.md D-01 through D-24) — locked implementation decisions

### Secondary (MEDIUM confidence)

- Render.com documentation (general knowledge): Persistent disks are block storage, not NFS — WAL safe
- Render.com documentation (general knowledge): `PORT` env var is always injected; `engines.node` is read from `package.json`

### Tertiary (LOW confidence)

- `argon2` native binary compatibility on Render Linux — flagged as open question, not verified against Render's specific build environment

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing
- Architecture: HIGH — exact line numbers and file contents verified by direct code read
- Pitfalls: HIGH (WAL/mkdirSync/CORS) / MEDIUM (argon2 native binary)
- Render platform behavior: MEDIUM — based on documented behavior, not live environment verification

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable — Render.com and Node.js/ESM patterns are not fast-moving)
