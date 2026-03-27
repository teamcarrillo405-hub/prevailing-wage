# Phase 28: Production Deployment - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the app to Render.com — a single-host deployment where Express serves both the API and the Vite-built React static files. Deliver persistent SQLite storage on a Render Disk, invite-only registration gated by an env var, proper secrets configuration, and a GitHub-connected auto-deploy pipeline.

This phase does NOT include: database migration to a cloud DB, Vercel/Netlify hosting, custom domain configuration, or any new application features.

</domain>

<decisions>
## Implementation Decisions

### Hosting Platform (OPS-01)

- **D-01:** **Render.com Web Service** — single host for the full stack. Express serves both `/api/*` routes and the Vite-built React static files from `dist/client/`. GitHub repo connected to Render for auto-deploy on push to `main`.
- **D-02:** **Free tier to start** — Render free Web Service (spins down after 15 min inactivity). Upgrade to Starter ($7/month) when ready for production traffic. No changes required to upgrade.
- **D-03:** **Service name:** `hcc-prevailing-wage` → URL: `https://hcc-prevailing-wage.onrender.com`
- **D-04:** **Render service type:** Native Node.js (not Docker). Render auto-detects Node.js from `package.json`.
  - **Build command:** `npm run build` (runs `tsc -p tsconfig.server.json && vite build`)
  - **Start command:** `node dist/server/index.js`
  - **Node version:** match `.node-version` or `engines.node` in `package.json`

### Persistent SQLite Disk (OPS-01)

- **D-05:** **Render Disk — 1 GB at `/var/data`** (~$1/month). SQLite database lives at `/var/data/prevailing-wage.db`.
- **D-06:** Set `DATABASE_PATH=/var/data/prevailing-wage.db` as a Render environment variable. The server's `db/index.ts` already reads `process.env.DATABASE_PATH` — no code change needed for the path itself.
- **D-07:** The `mkdirSync('./data', { recursive: true })` in `db/index.ts` must be updated to create the parent directory of `DATABASE_PATH`, not the hardcoded `./data`. This ensures the disk mount point exists before opening the DB.

### TypeScript Server Build

- **D-08:** Add `tsconfig.server.json` — a separate TypeScript config that targets Node.js:
  - `outDir: "dist/server"`, `rootDir: "src/server"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `exclude: ["src/client/**"]`
- **D-09:** Update `package.json` build script: `"build": "tsc -p tsconfig.server.json && vite build"` (replaces the current `tsc && vite build` which uses the root tsconfig and may mix client/server output).
- **D-10:** Start command uses compiled output: `node dist/server/index.js` (ESM, no tsx).
- **D-11:** Keep ESM throughout — `package.json` already has `"type": "module"`, existing `.js` import extensions in server code are correct.

### Static File Serving in Production (OPS-04)

- **D-12:** In `src/server/index.ts`, add a production-only static file block **after all `/api/` route registrations and before the error handler**:
  ```typescript
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, '../../dist/client')));
    app.get('*', (_req, res) => {
      res.sendFile(join(__dirname, '../../dist/client/index.html'));
    });
  }
  ```
  The catch-all `app.get('*')` enables React Router to handle all client-side routes on hard refresh.
- **D-13:** `__dirname` is not available in ESM — use `import.meta.url` + `fileURLToPath` to derive the equivalent:
  ```typescript
  import { fileURLToPath } from 'url';
  import { dirname, join } from 'path';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  ```
- **D-14:** In development, the Vite dev server (port 4200) with its proxy handles static serving — the production block is completely skipped. No changes to dev workflow.

### Invite-Only Registration (OPS-02)

- **D-15:** Add `INVITE_CODE` as a Render environment variable. Value is a shared secret that you distribute to allowed users.
- **D-16:** Registration check logic in `src/server/routes/auth.ts`:
  - Add `inviteCode?: string` to `RegisterSchema`
  - At top of the register handler: `if (process.env.INVITE_CODE && req.body.inviteCode !== process.env.INVITE_CODE)` → return `{ error: 'Invalid invitation code' }` (403)
  - When `INVITE_CODE` env var is absent (local dev): registration is open — no code required
- **D-17:** Update `src/client/pages/RegisterPage.tsx`: add an "Invitation Code" text field that submits with the register form. Field is always rendered (registration is blocked server-side without it in production).

### Secrets and Environment Variables (OPS-03)

- **D-18:** Update `.env.example` to document all required variables:
  ```
  JWT_SECRET=change-me-in-production-min-32-chars
  DATABASE_PATH=./data/prevailing-wage.db
  PORT=3001
  CORS_ORIGIN=http://localhost:4200
  NODE_ENV=development
  INVITE_CODE=                    # Required in production; leave blank for open local dev
  ```
- **D-19:** SAM.gov WDOL API (`wdolFetcher.ts`) requires **no API key** — confirmed in code comment ("No authentication required"). OPS-03's "SAM.gov API key" requirement is satisfied: no secret needed, no `VITE_`-prefixed variable exists.
- **D-20:** All sensitive values (`JWT_SECRET`, `INVITE_CODE`) are set as Render **runtime** env vars (not build-time). `VITE_`-prefixed vars don't exist in this project — no secrets leak into the client bundle.
- **D-21:** Set `NODE_ENV=production` as a Render env var — this activates the `secure: true` cookie flag in `auth.ts` (line 16) and the static file serving block (D-12).

### GitHub Integration

- **D-22:** Connect the GitHub repo to Render via the Render dashboard (GitHub OAuth). On every push to `main`, Render automatically runs the build command and restarts the service.
- **D-23:** No GitHub Actions workflow needed — Render's native GitHub integration handles CI/CD.
- **D-24:** Add a `render.yaml` service config file (Render Blueprint) so the service definition is code-controlled:
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
        - key: JWT_SECRET
          generateValue: true
        - key: INVITE_CODE
          sync: false
      disk:
        name: data
        mountPath: /var/data
        sizeGB: 1
  ```

### Claude's Discretion

- Exact `tsconfig.server.json` compiler options (target, lib, strict) — match existing tsconfig.json strictness
- Whether to add a `postbuild` script to verify `dist/server/index.js` exists
- Error message wording for invalid invite code (keep short and not revealing)
- Whether to add a `CORS_ORIGIN` env var update for production URL in render.yaml

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Server Entry & DB
- `src/server/index.ts` — Express app; static file block goes here after all API routes
- `src/server/db/index.ts` — DB path from env var; `mkdirSync` call needs update for arbitrary path
- `src/server/routes/auth.ts` — RegisterSchema and handler; invite code check goes here
- `src/server/services/wdolFetcher.ts` — Confirms no SAM.gov API key needed

### Client
- `src/client/pages/RegisterPage.tsx` — Add invitation code field

### Build Config
- `package.json` — Current build script (`tsc && vite build`); update to use tsconfig.server.json
- `vite.config.ts` — `root: 'src/client'`, `outDir: '../../dist/client'`; unchanged
- `tsconfig.json` — Existing root tsconfig; reference when creating tsconfig.server.json
- `.env.example` — Update with all required vars including INVITE_CODE

### Render Blueprint
- `render.yaml` — New file; defines service type, build/start commands, disk, env vars

### Requirements
- `.planning/REQUIREMENTS.md` §OPS-01, OPS-02, OPS-03, OPS-04

</canonical_refs>

<code_context>
## Existing Code Insights

### What's Already Production-Ready
- `AUTH_SECRET` cookie: `secure: process.env.NODE_ENV === 'production'` already in `auth.ts:16`
- `DATABASE_PATH` env var already drives the SQLite path in `db/index.ts:7`
- `PORT` env var already drives the server listen port in `index.ts:45`
- WDOL API: no API key required (unauthenticated public endpoint)
- Drizzle migrations: `migrate()` already called at startup in `db/index.ts:15` (skipped in test env)

### What Needs Code Changes
- `db/index.ts:8`: `mkdirSync('./data', { recursive: true })` — hardcoded; must use `path.dirname(dbPath)` instead so it works for `/var/data/prevailing-wage.db`
- `index.ts`: no static file serving block yet — production block must be added
- `index.ts`: no ESM `__dirname` shim yet — must add `import.meta.url` pattern
- `routes/auth.ts`: no invite code check — add to RegisterSchema + handler
- `RegisterPage.tsx`: no invitation code field
- `package.json`: `build` script uses root `tsconfig.json` — update to `tsconfig.server.json`
- `.env.example`: missing `INVITE_CODE`
- `render.yaml`: doesn't exist yet

### ESM __dirname Pattern (copy verbatim)
```typescript
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

</code_context>

<specifics>
## Specific Implementation Details

- Database mount: `/var/data/prevailing-wage.db` (Render disk at `/var/data`)
- Static file serving order in index.ts: API routes → (production) static middleware → (production) catch-all → error handler
- Invite code env var name: `INVITE_CODE` (not `REGISTRATION_CODE` or `ACCESS_CODE`)
- Service URL: `https://hcc-prevailing-wage.onrender.com`
- `render.yaml` uses `generateValue: true` for `JWT_SECRET` so Render auto-generates a strong secret on first deploy
- `INVITE_CODE` uses `sync: false` in render.yaml so it's never committed to git — set manually in Render dashboard

</specifics>

<deferred>
## Deferred Ideas

- Custom domain (e.g. wage.hcctx.com) — can be configured in Render dashboard after launch without any code changes
- GitHub Actions CI workflow — not needed; Render's native GitHub integration handles deploy on push
- Turso/serverless DB migration — not needed with Render's persistent disk
- Vercel/Netlify for frontend — not applicable for this single-host deployment

</deferred>

---

*Phase: 28-production-deployment*
*Context gathered: 2026-03-27*
