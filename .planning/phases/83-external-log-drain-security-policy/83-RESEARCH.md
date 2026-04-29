# Phase 83: External Log Drain + Security Policy — Research

**Researched:** 2026-04-26
**Domain:** Pino transport configuration, Better Stack/Logtail integration, security documentation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-07 | Pino HTTP logs flow to external drain (Logtail/Better Stack) via HTTPS transport; every request emits { method, url, status, responseTime }; LOGTAIL_TOKEN env var in .env.example; startup warns if missing (non-fatal); NODE_ENV=test guard prevents external calls in tests | @logtail/pino 0.5.8 supports pino 10.x; pino-http already installed and wired; transport branching pattern established in logger.ts |
| SEC-08 | SECURITY_POLICY.md exists at repo root; served at /security as static page or React route; covers supported versions, reporting email, 72h ack SLA, responsible disclosure | /security React route already exists (SecurityPolicyPage.tsx); SECURITY_POLICY.md missing at repo root; footers already link to /security |

</phase_requirements>

---

## Summary

Phase 83 ships two independent SOC 2 evidence artifacts. Both are low-risk surgical changes with no schema migrations, no new database tables, and no UI screen creation.

**Log drain (SEC-07):** The Pino logger lives in `src/server/logger.ts` — a single 13-line file. The pattern for dev vs. production branching is already established there (`isDev` guard picks `pino-pretty` in dev). Adding a third branch for `LOGTAIL_TOKEN`-present sends logs to Better Stack via `@logtail/pino` 0.5.8. The `pino-http` middleware is already installed (`^11.0.0`) and wired in `src/server/index.ts` — it uses the same `logger` export, so transport changes in `logger.ts` flow through automatically to HTTP request/response logging. The `NODE_ENV=test` guard pattern is used in 5 places across the codebase already.

**Security policy document (SEC-08):** The `/security` React route (`SecurityPolicyPage.tsx`) already exists and is linked from all footers. The `SECURITY_POLICY.md` markdown file at repo root is missing — it must be created. The success criterion requires the file at repo root AND served at `/security`. The React page satisfies the "served at /security" criterion. The repo-root markdown file is the conventional location for GitHub's security policy display and SOC 2 auditor inspection of the repo.

**Primary recommendation:** Modify `src/server/logger.ts` to branch on `LOGTAIL_TOKEN`, add `.env.example` entry, add startup warning in `src/server/index.ts`, and write `SECURITY_POLICY.md` at repo root. Two files modified (logger.ts, index.ts, .env.example) + one file created (SECURITY_POLICY.md).

---

## Current Codebase State (Verified)

### Pino Setup

| File | Current state |
|------|--------------|
| `src/server/logger.ts` | Pino 10.3.1; `pino-pretty` transport in dev (`NODE_ENV !== 'production'`); plain pino in production (no transport) |
| `src/server/index.ts` | `pino-http ^11.0.0` already imported and wired as middleware; uses `logger` export from `logger.ts`; HTTP access log with `autoLogging: { ignore: /api/health }` and custom log levels by status code |
| `package.json` | `"pino": "^10.3.1"`, `"pino-http": "^11.0.0"`, `"pino-pretty": "^13.1.3"` (devDep) — all installed |

### /security Route

| Item | State |
|------|-------|
| `src/client/pages/SecurityPolicyPage.tsx` | Exists — public page, no auth, linked from all footers |
| `src/client/App.tsx` | Route `<Route path="/security" element={<SecurityPolicyPage />} />` registered |
| `SECURITY_POLICY.md` at repo root | Does NOT exist — must be created |
| `.well-known/security.txt` | Exists — served by `src/server/index.ts` (Phase 80) pointing to `https://prevailingwage.app/security-policy` |

### ENV Pattern

| File | Current env vars | Pattern |
|------|-----------------|---------|
| `.env.example` | 15 vars documented with section headers + comments | Optional vars show `# Optional — [feature] disabled if unset.` |
| `src/server/db/index.ts` | `if (process.env.NODE_ENV !== 'test')` pattern for DB path branch | Direct `process.env.NODE_ENV` check |
| `src/server/routes/auth.ts` | `process.env.NODE_ENV === "test" ? 100_000 : 10` | Inline ternary guard |
| `src/server/logger.ts` | `process.env.NODE_ENV !== 'production'` | Module-level const `isDev` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@logtail/pino` | 0.5.8 | Pino transport that POSTs JSON batches to Better Stack HTTPS ingestion endpoint | Official Better Stack package; peerDep supports pino ^7.0.0 to ^10.0.0 (matches installed pino 10.3.1); used by Better Stack docs |
| `pino` | 10.3.1 (installed) | Structured JSON logger | Already installed |
| `pino-http` | 11.0.0 (installed) | Express HTTP access log middleware | Already installed and wired |

### No New Runtime Dependencies Needed
The `@logtail/pino` package is the only addition. It brings `@logtail/node ^0.5.8`, `@logtail/types ^0.5.8`, and `pino-abstract-transport ^1.0.0` as transitive dependencies.

**Installation:**
```bash
npm install @logtail/pino
```

**Version verification (confirmed 2026-04-26):**
- `@logtail/pino`: 0.5.8 (latest)
- peerDependency: `pino: "^7.0.0 || ^8.0.0 || ^9.0.0 || ^10.0.0"` — compatible with installed pino 10.3.1

### Why NOT @logtail/node
`@logtail/node` is the generic Node.js transport. `@logtail/pino` is the purpose-built Pino transport that implements `pino-abstract-transport` — it integrates with Pino's async transport worker thread model correctly and does not require manual `.flush()` calls. Use `@logtail/pino`.

---

## Architecture Patterns

### Recommended logger.ts Transport Branching
```typescript
// src/server/logger.ts
import pino from 'pino';

const isDev  = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';
const token  = process.env.LOGTAIL_TOKEN;

function buildTransports(): pino.TransportMultiOptions | pino.TransportSingleOptions | undefined {
  if (isTest) {
    // No transport in test — suppress all output, avoid external calls
    return undefined;
  }
  if (isDev && !token) {
    // Dev without drain token: pino-pretty to console
    return {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    };
  }
  if (isDev && token) {
    // Dev WITH drain token: multi-transport (pretty to console + drain)
    return {
      targets: [
        { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } },
        { target: '@logtail/pino', options: { sourceToken: token } },
      ],
    };
  }
  if (token) {
    // Production with token: drain only
    return { target: '@logtail/pino', options: { sourceToken: token } };
  }
  // Production without token: no transport (pino writes JSON to stdout — Render captures it)
  return undefined;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
}, buildTransports() ? pino.transport(buildTransports()!) : undefined);
```

**Simpler alternative (2-branch):** If multi-transport in dev is overkill, use the minimal pattern:

```typescript
// src/server/logger.ts — minimal version
import pino from 'pino';

const isDev  = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';
const token  = process.env.LOGTAIL_TOKEN;

const transport = (() => {
  if (isTest || !isDev && !token) return undefined;
  if (isDev && !token) return pino.transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } });
  return pino.transport({ target: '@logtail/pino', options: { sourceToken: token! } });
})();

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info') },
  transport,
);
```

**Recommendation:** Use the minimal 2-branch version (isDev-or-token only). The full multi-transport is nice but adds complexity the planner must test. The phase goal is verified log drain, not local drain mirroring.

### Startup Warning Pattern (matches existing codebase style)

Add to `src/server/index.ts`, right after `logger` is imported and Sentry is initialized:

```typescript
// Warn if drain token missing — non-fatal (local dev works without it)
if (!process.env.LOGTAIL_TOKEN) {
  logger.warn('LOGTAIL_TOKEN not set — logs will not be sent to external drain');
}
```

This matches the non-fatal pattern established for `RESEND_API_KEY` and `SENTRY_DSN`.

### pino-http Already Emits the Required Fields

The existing `pinoHttp` middleware in `src/server/index.ts` already emits structured logs for every request. The default serializer includes `method`, `url`, `status`, and `responseTime` — no additional configuration is needed beyond the transport. The `autoLogging.ignore` on `/api/health` is already set.

Verify what the default pino-http output includes:
```json
{
  "level": 30,
  "time": 1714123456789,
  "req": { "method": "GET", "url": "/api/projects", "remoteAddress": "::1" },
  "res": { "statusCode": 200 },
  "responseTime": 12
}
```

The `method`, `url`, `status`, `responseTime` requirement is satisfied by the existing middleware. No changes to the `pinoHttp` call in `index.ts` are needed.

### SECURITY_POLICY.md Structure

The file must satisfy: supported versions, reporting email, 72h ack SLA, responsible disclosure policy. The `/security` React page already covers these visually. The markdown file at repo root is for GitHub's "Security policy" tab display and auditor inspection.

Canonical sections based on GitHub's recommended security.md format:

```markdown
# Security Policy

## Supported Versions
## Reporting a Vulnerability
## Response SLA
## Responsible Disclosure
## Scope
```

The `.well-known/security.txt` already references `security@prevailingwage.app` as the contact email and `https://prevailingwage.app/security-policy` as the policy URL. The SECURITY_POLICY.md must be consistent with these values.

### .env.example Addition

The existing `.env.example` uses section headers with `# ---` dividers. Add a new section after the `SENTRY_DSN` block:

```bash
# ------------------------------------------------------------
# Logging (Better Stack / Logtail — betterstack.com)
# ------------------------------------------------------------

# Source token for piping Pino logs to Better Stack (Logtail).
# Obtain from: https://logs.betterstack.com → Sources → your source → Token
# Optional — startup warns if unset; logs stay on stdout (Render captures them).
LOGTAIL_TOKEN=
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTPS log batching to external endpoint | Custom `fetch` loop in logger | `@logtail/pino` transport | Handles batching, backpressure, retry, pino-abstract-transport worker thread model; custom solution will drop logs on shutdown |
| Log transport multiplexing | Custom EventEmitter or stream fork | `pino.transport({ targets: [...] })` | Built-in Pino multi-transport since v7; no custom code needed |

---

## Common Pitfalls

### Pitfall 1: Pino transport() called on already-created logger
**What goes wrong:** Calling `pino.transport(...)` returns a writable stream, not a logger. The `logger` must be created with the transport stream passed as the second argument to `pino()`: `pino({ level }, pino.transport(...))`. Mutating an existing logger instance does not work.
**How to avoid:** Always construct the logger with transport in a single `pino(options, transport)` call. See recommended pattern above.
**Warning sign:** TypeScript error `Argument of type 'ThreadStream' is not assignable to parameter of type 'LoggerOptions'`.

### Pitfall 2: Transport in test environment causes external network calls
**What goes wrong:** If `@logtail/pino` transport is active during `vitest run`, each test file that imports `app` (and therefore `logger.ts`) will attempt to connect to Better Stack. This causes network errors or hangs in CI.
**How to avoid:** Gate the transport behind `process.env.NODE_ENV !== 'test'`. The `isTest` const in `logger.ts` makes this explicit. Vitest already sets `NODE_ENV=test` when tests set it at the top of the test file (`auth.test.ts` does `process.env.NODE_ENV = 'test'` before any imports).
**Warning sign:** Tests pass locally but timeout in CI, or "fetch failed" errors in test output.

### Pitfall 3: Startup warning logs before logger is fully constructed
**What goes wrong:** If the `LOGTAIL_TOKEN` warning is emitted before the Pino transport worker thread is initialized, the warning may be dropped or appear on the wrong sink.
**How to avoid:** Place the warning after `const app = express()` in `index.ts`, not at module top-level, and after the `pinoHttp` middleware is registered. The logger is synchronously usable once the `pino()` call completes; the transport worker starts in the background but the synchronous logger API is available immediately.

### Pitfall 4: pino-http middleware uses a different logger instance
**What goes wrong:** Creating a new `pino()` instance inside the `pinoHttp()` call instead of passing the shared `logger` export. This means application logs and HTTP access logs go to different transports.
**How to avoid:** The current code already passes `logger` to `pinoHttp({ logger })`. No change needed here — just verify it remains after the transport change.

### Pitfall 5: SECURITY_POLICY.md conflicts with SecurityPolicyPage.tsx
**What goes wrong:** The repo-root `SECURITY_POLICY.md` lists a different contact email or SLA than the React page `SecurityPolicyPage.tsx`.
**How to avoid:** Use the same contact email (`security@prevailingwage.app`) and SLA (72h ack, 7d resolution) in both files. The `.well-known/security.txt` in `index.ts` also uses `security@prevailingwage.app` — all three must be consistent.

---

## Environment Availability

Step 2.6: SKIPPED for external npm registry checks (already probed above via `npm view`). The only new external dependency is `@logtail/pino` from the npm registry — available. No runtime services are required for this phase (the LOGTAIL_TOKEN is optional/non-fatal at startup).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@logtail/pino` npm package | SEC-07 transport | Yes (npm registry) | 0.5.8 | — |
| Better Stack account + source token | SEC-07 production verification | External (George's account) | — | Local dev works without token; warning logged |

**Missing dependencies with no fallback:** None — `LOGTAIL_TOKEN` is explicitly non-fatal by spec.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/server/routes/auth.test.ts` |
| Full suite command | `npx vitest run --exclude ".worktrees/**" --exclude ".claude/worktrees/**"` |
| Current test count | 724 passing, 42 todo |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-07 | LOGTAIL_TOKEN absent → startup warning logged, no crash | unit | `npx vitest run src/server/routes/auth.test.ts` (app import covers logger init) | Auth test covers app import; logger branch needs dedicated test |
| SEC-07 | NODE_ENV=test → no external transport instantiated | unit | Implicit — any test that imports app verifies no crash when NODE_ENV=test | Covered by existing 56 test files |
| SEC-07 | pino-http emits method/url/status/responseTime | integration | Covered by existing HTTP route tests via supertest | Existing tests |
| SEC-08 | SECURITY_POLICY.md exists at repo root | manual | `ls SECURITY_POLICY.md` — file existence check | ❌ Wave 0 — file must be created |

### Sampling Rate
- **Per task commit:** `npx vitest run --exclude ".worktrees/**" --exclude ".claude/worktrees/**"`
- **Phase gate:** Full 724-test suite green

### Wave 0 Gaps
- [ ] `SECURITY_POLICY.md` at repo root — must be created as part of plan execution (it is the deliverable, not a test file)
- No new test files required — existing test suite coverage is sufficient if the `NODE_ENV=test` guard is correctly implemented; the transport branch must not run any external code when `NODE_ENV=test`

---

## Open Questions

1. **pino-http autoLogging format in Better Stack**
   - What we know: pino-http serializes `req` and `res` as nested objects; Better Stack indexes top-level fields.
   - What's unclear: Does Better Stack auto-flatten `req.method` → `method` for indexing, or must the serializer be customized?
   - Recommendation: Use Better Stack's default ingestion (it handles Pino's nested format); verify in drain dashboard after first deployment. If flattening is needed, add a custom serializer to `pinoHttp` in Wave 1.

2. **LOGTAIL_TOKEN vs BETTERSTACK_TOKEN naming**
   - What we know: ROADMAP.md mentions both `LOGTAIL_TOKEN` and `BETTERSTACK_TOKEN`; the `@logtail/pino` package uses `sourceToken` as the option key.
   - What's unclear: Better Stack rebranded from Logtail; some docs use one name, some use the other.
   - Recommendation: Use `LOGTAIL_TOKEN` (ROADMAP.md success criterion specifies this name explicitly). Add a comment in `.env.example` noting it may also be called `BETTERSTACK_TOKEN` in some dashboard UIs.

---

## Sources

### Primary (HIGH confidence)
- npm registry `npm view @logtail/pino` — version 0.5.8, peerDeps, dependencies confirmed
- `src/server/logger.ts` (read directly) — current Pino setup, exact branching pattern
- `src/server/index.ts` (read directly) — pinoHttp wiring, middleware order, existing NODE_ENV guards
- `package.json` (read directly) — pino 10.3.1, pino-http 11.0.0 installed
- `.env.example` (read directly) — section format, comment style for new env var
- `src/client/pages/SecurityPolicyPage.tsx` (read directly) — /security route exists, no repo-root .md
- Better Stack official docs (WebFetch) — `@logtail/pino` transport API confirmed

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 83 detail section — plan breakdown, exact env var name `LOGTAIL_TOKEN`
- `.github/workflows/ci.yml` — test command for CI

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package version confirmed from npm registry, peerDep compatibility verified
- Architecture: HIGH — logger.ts pattern read directly; branching approach matches existing codebase conventions
- Pitfalls: HIGH — derived from reading actual code (import order, test NODE_ENV setting)
- SECURITY_POLICY.md: HIGH — route exists, file missing confirmed by file system check

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable ecosystem; @logtail/pino changes infrequently)
