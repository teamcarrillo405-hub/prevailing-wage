---
phase: 28-production-deployment
verified: 2026-03-26T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
human_verification:
  - test: "Visit https://hcc-prevailing-wage.onrender.com — landing page loads without errors"
    expected: "Landing page renders with no JS console errors"
    why_human: "Live URL; cannot verify programmatically from local machine"
  - test: "Hard refresh /dashboard on live Render URL"
    expected: "React app loads (SPA catch-all), not a 404"
    why_human: "Requires live server request to verify Express sendFile behavior"
  - test: "Register without invite code at live URL"
    expected: "403 error displayed in RegisterForm"
    why_human: "Requires INVITE_CODE set in Render Dashboard to be present at runtime"
  - test: "Project data persists after Render redeploy"
    expected: "Projects created before redeploy still visible after redeploy"
    why_human: "Requires two sequential deploys to a live environment"
  - test: "Inspect JS bundle in browser devtools — search for JWT_SECRET and INVITE_CODE"
    expected: "Neither string appears in any downloaded JS file"
    why_human: "Runtime network inspection required; cannot grep compiled client bundles for env vars that are never written to client code"
---

# Phase 28: Production Deployment Verification Report

**Phase Goal:** Deploy the app to Render.com with persistent SQLite, invite-only registration, secrets via env vars, and Express serving the Vite-built React static files.
**Verified:** 2026-03-26
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Server TypeScript compiles to `dist/server/index.js` via `tsc -p tsconfig.server.json` | VERIFIED | `dist/server/index.js` exists; `package.json` build script: `tsc -p tsconfig.server.json && vite build` |
| 2 | Vite client build produces `dist/client/index.html` | VERIFIED | `dist/client/index.html` exists; same build script drives Vite |
| 3 | Express serves static files from `dist/client` in production mode with SPA catch-all | VERIFIED | `src/server/index.ts` lines 49–54: `NODE_ENV === 'production'` block with `express.static` + `app.get('*', sendFile)` |
| 4 | `mkdirSync` creates the parent directory of `DATABASE_PATH`, not hardcoded `./data` | VERIFIED | `src/server/db/index.ts` line 9: `mkdirSync(dirname(dbPath), { recursive: true })` |
| 5 | Register with wrong invite code returns 403 when `INVITE_CODE` env var is set | VERIFIED | `src/server/routes/auth.ts` lines 37–40: guard present; `auth.test.ts` lines 48–58: test confirmed |
| 6 | Register without invite code succeeds when `INVITE_CODE` env var is absent | VERIFIED | Same guard: only fires `if (process.env.INVITE_CODE && ...)`; test at line 73–79 |
| 7 | `.env.example` documents all required environment variables including `INVITE_CODE` | VERIFIED | `.env.example` contains `JWT_SECRET`, `DATABASE_PATH`, `PORT=4099`, `CORS_ORIGIN=http://localhost:4200`, `NODE_ENV=development`, `INVITE_CODE=` |
| 8 | `render.yaml` defines the Render service with disk, env vars, and build/start commands | VERIFIED | `render.yaml` has `name: hcc-prevailing-wage`, `disk.mountPath: /var/data`, `JWT_SECRET generateValue: true`, `INVITE_CODE sync: false`, `buildCommand: npm run build`, `startCommand: node dist/server/index.js` |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tsconfig.server.json` | Server-only TypeScript compilation config | VERIFIED | Exists; `outDir: "dist"`, `rootDir: "src"` — compiles `src/server/**` → `dist/server/` (includes shared types; intentional deviation from plan which specified `src/server` as rootDir; SUMMARY documents the reason) |
| `render.yaml` | Render Blueprint service definition | VERIFIED | Contains `hcc-prevailing-wage`, disk, all required env vars |
| `src/server/index.ts` | Production static file serving + ESM `__dirname` shim | VERIFIED | `fileURLToPath` shim at lines 23–26; `express.static(join(__dirname, '../../dist/client'))` at line 50; SPA catch-all at lines 51–53 |
| `src/server/db/index.ts` | Dynamic parent directory creation for `DATABASE_PATH` | VERIFIED | `dirname` imported from `path`; `mkdirSync(dirname(dbPath), { recursive: true })` at line 9 |
| `src/server/routes/auth.ts` | Invite code registration gate | VERIFIED | `inviteCode: z.string().optional()` in schema; guard at lines 37–40 returning 403 with `{ error: 'Invalid invitation code' }` |
| `src/client/components/auth/RegisterForm.tsx` | Invite code field + brand-gold button | VERIFIED | `inviteCode` in schema, destructure, payload, and JSX; `id="reg-invite"`; `bg-brand-gold`; zero occurrences of `#F5C518` |
| `package.json` | `build` references `tsconfig.server.json`; `engines.node` present | VERIFIED | Line 11: `tsc -p tsconfig.server.json && vite build`; lines 20–22: `"engines": { "node": ">=20.0.0" }` |
| `.env.example` | Documents all required env vars with correct ports | VERIFIED | `PORT=4099`, `CORS_ORIGIN=http://localhost:4200`, `INVITE_CODE=` all present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` | `tsconfig.server.json` | build script `-p tsconfig.server.json` | WIRED | Line 11: `"build": "tsc -p tsconfig.server.json && vite build"` |
| `src/server/index.ts` | `dist/client/index.html` | `express.static` + `sendFile` catch-all | WIRED | `join(__dirname, '../../dist/client')` — from `dist/server/index.js`, `../../` resolves to project root, then `dist/client/` — path math correct |
| `render.yaml` | `package.json` | `buildCommand: npm run build` | WIRED | `buildCommand: npm run build` at render.yaml line 5 |
| `src/client/components/auth/RegisterForm.tsx` | `src/server/routes/auth.ts` | `api.post('/auth/register', { inviteCode })` | WIRED | RegisterForm line 31: payload includes `inviteCode: data.inviteCode`; server schema accepts `inviteCode: z.string().optional()` |

---

### Data-Flow Trace (Level 4)

Static-file serving and invite-code gating are infrastructure/middleware patterns, not data-rendering components. Level 4 trace not applicable here — no state variables rendering dynamic fetched data are introduced in this phase. (The invite code is a form field value; its flow from input → payload → server guard is verified at the wiring level above.)

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `dist/server/index.js` exists after build | `ls dist/server/index.js` | File found | PASS |
| `dist/client/index.html` exists after build | `ls dist/client/index.html` | File found | PASS |
| `express.static` block gated on `NODE_ENV=production` | `grep "NODE_ENV.*production" src/server/index.ts` | Line 49 confirmed | PASS |
| `mkdirSync` uses `dirname(dbPath)` not hardcoded path | `grep "dirname(dbPath)" src/server/db/index.ts` | Line 9 confirmed | PASS |
| 403 guard in auth.ts fires before DB access | Code inspection — guard at line 37 precedes `getDb()` at line 42 | Guard is first statement after destructure | PASS |
| No `VITE_`-prefixed secrets in source | `grep -rn "VITE_JWT\|VITE_SECRET\|VITE_INVITE" src/` | No matches | PASS |
| No hardcoded `#F5C518` in RegisterForm | `grep -n "F5C518" src/client/components/auth/RegisterForm.tsx` | No matches | PASS |
| `engines.node` declared in package.json | `grep '"engines"' package.json` | Lines 20–22 confirmed | PASS |

Live Render smoke tests (landing page load, SPA routing on hard refresh, invite gate in production, persistence across redeploys): APPROVED BY HUMAN (documented in 28-02-SUMMARY.md, Task 2 checkpoint).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OPS-01 | 28-01 | App deployed to live HTTPS URL on Render.com with SQLite on persistent disk; Drizzle migrations at startup | SATISFIED (manual) | `render.yaml` disk at `/var/data`; `db/index.ts` calls `migrate()` on startup (line 17); human smoke test approved live URL + persistence |
| OPS-02 | 28-01, 28-02 | Registration requires valid invitation code; open registration disabled in production | SATISFIED | `auth.ts` 403 guard; `RegisterForm.tsx` enforces `inviteCode` field; 3 invite code tests pass |
| OPS-03 | 28-01 | SAM.gov API key and all secrets via env vars; `.env.example` documents every required variable | SATISFIED | `JWT_SECRET generateValue: true` in `render.yaml`; `INVITE_CODE sync: false`; `.env.example` has all 6 vars; no `VITE_`-prefixed secrets found in source |
| OPS-04 | 28-01, 28-02 | Vite production build served as static files by Express in production mode | SATISFIED | `express.static(join(__dirname, '../../dist/client'))` inside `NODE_ENV=production` block; SPA catch-all present |

**Note on REQUIREMENTS.md status:** As of the latest file read, `OPS-01` and `OPS-03` are still marked `- [ ]` (Pending) and `OPS-02`/`OPS-04` marked `[x]` (Complete). The code changes for OPS-01 and OPS-03 are fully implemented; the Pending status reflects that REQUIREMENTS.md has not been updated to mark them complete. This is a documentation gap, not a code gap. The live deployment has been human-verified (28-02-SUMMARY.md), satisfying OPS-01. The secrets/env-var implementation satisfies OPS-03. REQUIREMENTS.md should be updated to check these off.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/server/index.ts` | 30 | `CORS_ORIGIN` fallback: `|| 'http://localhost:3000'` — not `localhost:4200` | Info | In production `CORS_ORIGIN` is set via Render env var (render.yaml line 13), so the fallback is only reached in local dev without a `.env` file. `.env.example` documents `localhost:4200`. Low risk. |

No blocker or warning anti-patterns found. No hardcoded hex colors, no TODO/FIXME stubs, no empty implementations, no `VITE_`-prefixed secrets.

---

### Note on tsconfig.server.json outDir Deviation

The PLAN specified `outDir: "dist/server"` and `rootDir: "src/server"`. The actual file has `outDir: "dist"` and `rootDir: "src"`. This was an intentional implementation decision documented in 28-01-SUMMARY.md: server routes import from `../../shared/types.js` (outside `src/server`), which requires `rootDir: "src"` to include the shared directory. With `rootDir: "src"` and `outDir: "dist"`, `src/server/index.ts` compiles to `dist/server/index.js` — the same output path the `startCommand` and `express.static` path math depend on. The build artifacts confirm this is correct.

---

### Human Verification Required

#### 1. Live URL Load

**Test:** Visit https://hcc-prevailing-wage.onrender.com in a browser.
**Expected:** Landing page renders with no JS console errors; app is accessible over HTTPS.
**Why human:** Cannot verify a live external URL programmatically from the local machine. Status: APPROVED — documented in 28-02-SUMMARY.md.

#### 2. SPA Catch-All on Hard Refresh

**Test:** Hard-refresh `/dashboard` at the live Render URL (or navigate directly to `/dashboard`).
**Expected:** React app loads and redirects to login; no 404 from server.
**Why human:** Requires a live HTTPS request to verify Express's `sendFile` catch-all behavior. Status: APPROVED — documented in 28-02-SUMMARY.md.

#### 3. Invite Code Gate in Production

**Test:** Attempt registration at the live URL without the correct `INVITE_CODE`.
**Expected:** 403 error displayed in the form.
**Why human:** Requires `INVITE_CODE` to be set in the live Render dashboard. Status: APPROVED — documented in 28-02-SUMMARY.md.

#### 4. SQLite Persistence Across Redeploys

**Test:** Create a project, trigger a Render redeploy (or push a change), verify the project still exists after deploy completes.
**Expected:** Project data survives the redeploy (persistent disk at `/var/data` mounted correctly).
**Why human:** Requires two sequential live deploys. Status: APPROVED — documented in 28-02-SUMMARY.md.

#### 5. No Secrets in Client JS Bundle

**Test:** Open browser devtools Network tab on the live URL; inspect any `.js` bundle file; search for `JWT_SECRET` and `INVITE_CODE`.
**Expected:** Neither string appears in any downloaded JS file.
**Why human:** Runtime network inspection required. Status: APPROVED — documented in 28-02-SUMMARY.md.

---

### Gaps Summary

No gaps. All 8 must-have truths are verified by direct code inspection. All 5 human verification items were pre-approved by the user during Plan 28-02 Task 2 (human-verify checkpoint, resume signal "approved"). The single informational anti-pattern (CORS fallback value) does not affect production behavior.

The only outstanding action item is a documentation update: REQUIREMENTS.md should have OPS-01 and OPS-03 changed from `- [ ]` to `- [x]`.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
