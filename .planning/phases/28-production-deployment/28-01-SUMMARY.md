---
phase: 28-production-deployment
plan: 01
status: complete
completed: 2026-03-26
wave: 1
---

# Plan 28-01 Summary — Production-Ready Code Changes

## What Was Built

All server-side code and configuration changes required for Render.com deployment:

1. **Wave 0 tests** (`tests/routes/auth.test.ts`): 3 invite code gating tests added — run RED initially, turned GREEN after Task 2 implementation. Total auth tests: 10→13.

2. **tsconfig.server.json** (new): Server-only TypeScript config. `rootDir: "src"`, `outDir: "dist"` — compiles `src/server/index.ts` → `dist/server/index.js` and `src/shared/**` → `dist/shared/**`. Includes shared types because server routes import from `../../shared/`.

3. **package.json**: Build script updated to `tsc -p tsconfig.server.json && vite build`. Added `engines.node >=20.0.0` for Render's Node version detection. Reverted agent-introduced drizzle-kit downgrade and playwright addition.

4. **src/server/db/index.ts**: `mkdirSync('./data', ...)` → `mkdirSync(dirname(dbPath), ...)`. Ensures `/var/data/` is created when `DATABASE_PATH=/var/data/prevailing-wage.db` on Render disk. Migrate call also added for startup migrations.

5. **src/server/index.ts**: Added ESM `__dirname` shim (`fileURLToPath + import.meta.url`). Added production-only static file block after all `/api/` routes and before `errorHandler` — serves React app with SPA catch-all.

6. **src/server/routes/auth.ts**: `inviteCode: z.string().optional()` added to `RegisterSchema`. Invite code guard returns 403 when `INVITE_CODE` env var is set and code doesn't match. Open registration when env var is absent.

7. **.env.example**: PORT `3001→4099`, CORS_ORIGIN `localhost:3000→localhost:4200`, added `INVITE_CODE=` line.

8. **render.yaml** (new): Render Blueprint — native Node.js web service, 1GB disk at `/var/data`, `JWT_SECRET` auto-generated, `INVITE_CODE` manual/sync:false, `NODE_ENV=production`.

## Key Decisions

- `rootDir: "src"` (not `"src/server"`) in tsconfig.server.json — required because `src/server/**` imports from `../../shared/types.js` which is outside `src/server`
- `outDir: "dist"` — produces `dist/server/index.js`, matching `node dist/server/index.js` start command
- `startCommand: node dist/server/index.js` in render.yaml — ESM, no tsx, compiled output only
- `join(__dirname, '../../dist/client')` — from `dist/server/`, going up 2 levels reaches project root, then `dist/client/` ✓

## Verification

- `npm run build` exits 0 — produces `dist/server/index.js` + `dist/client/index.html`
- `npx vitest run --exclude ".claude/**"` — 22 files, 278 tests pass, 0 failures
- `grep "dirname(dbPath)" src/server/db/index.ts` ✓
- `grep "express.static" src/server/index.ts` ✓
- `grep "INVITE_CODE" src/server/routes/auth.ts` ✓
- `test -f tsconfig.server.json && test -f render.yaml` ✓

## Self-Check: PASSED

key-files:
  created:
    - tsconfig.server.json
    - render.yaml
  modified:
    - package.json
    - src/server/db/index.ts
    - src/server/index.ts
    - src/server/routes/auth.ts
    - .env.example
    - tests/routes/auth.test.ts
