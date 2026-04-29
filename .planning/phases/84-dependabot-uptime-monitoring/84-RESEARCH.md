# Phase 84: Dependabot + Uptime Monitoring - Research

**Researched:** 2026-04-26
**Domain:** GitHub Dependabot automation, external uptime monitoring, public status pages, React badge embedding
**Confidence:** HIGH (all critical claims verified against official docs or confirmed pricing pages)

---

## Summary

Phase 84 adds two SOC 2 evidence controls: (1) automated dependency update PRs via GitHub Dependabot, and (2) a public uptime status page with an embeddable badge in the LandingPage footer.

The Dependabot work is pure YAML configuration — no code changes. A single `.github/dependabot.yml` file activates weekly PR generation for both the npm ecosystem (68 packages) and GitHub Actions ecosystem (2 actions pinned at `@v4`). PRs target `main`, are labeled `dependencies`, and the `groups` feature can batch all npm updates into a single weekly PR to reduce noise.

The uptime monitoring work has a critical constraint: **Uptime Robot's free tier is non-commercial as of December 2024.** For a commercial SaaS product, Uptime Robot Solo ($7/mo) or Better Stack's free tier (10 monitors, 3-minute checks, includes public status page — no explicit commercial restriction found) are the viable options. The ROADMAP.md references "Uptime Robot (or equivalent)" — Better Stack is the recommended equivalent given the commercial use issue. Better Stack provides an embeddable iframe badge, which works cleanly in the `LandingFooter` React component.

The `/api/health` endpoint already exists in `src/server/index.ts` (returns `{ status: 'ok', db: 'ok' }`, pings SQLite, returns 503 on error). No server-side changes are needed for monitoring.

**Primary recommendation:** Use Better Stack free tier for uptime monitoring and status page; use Dependabot v2 YAML with `groups` to batch npm PRs; embed Better Stack iframe badge in `LandingFooter`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-09 | Dependabot enabled: `dependabot.yml` for npm weekly updates; PRs target main, labeled `dependencies` | Dependabot v2 YAML syntax verified against GitHub official docs; groups field reduces PR count |
| SEC-10 | Uptime monitoring: public status page monitors `/api/health` at 5-min interval; status page URL and badge linked from `LandingPage.tsx` footer | `/api/health` confirmed in `src/server/index.ts`; Better Stack free tier confirmed (10 monitors, 3-min checks, public status page, iframe badge); Uptime Robot free plan is non-commercial per ToS updated Dec 2024 |
</phase_requirements>

---

## Standard Stack

### Core
| Tool | Version/Tier | Purpose | Why Standard |
|------|-------------|---------|--------------|
| GitHub Dependabot | Built-in (v2 config) | Automated dependency update PRs | Native GitHub feature, no external service needed, zero cost |
| Better Stack Uptime | Free tier (10 monitors, 3-min checks) | HTTP monitoring + public status page | No explicit commercial restriction; includes embeddable iframe badge; 1 status page on free tier |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better Stack | Uptime Robot Solo ($7/mo) | Uptime Robot has SOC 2 certification itself; 5-min free interval; but free tier is non-commercial as of Dec 2024 — Solo plan required for SaaS |
| Better Stack | Freshping | Freshping shut down March 6, 2026 — not viable |
| Better Stack iframe badge | Shields.io `img.shields.io/uptimerobot/status/{key}` | Shields.io badge requires Uptime Robot monitor-specific key; simpler than iframe but depends on Uptime Robot specifically |
| Better Stack | Instatus | Better design/Jamstack; $15/mo for pro; free tier is more limited for monitoring |

**Note on Shields.io badge:** If the team uses Uptime Robot Solo, the badge URL format is:
`https://img.shields.io/uptimerobot/status/{MONITOR_SPECIFIC_KEY}` — uses monitor-specific API key (not account API key). This is an `<img>` tag, not an iframe, which is simpler for React.

---

## Architecture Patterns

### Files Touched
```
.github/
└── dependabot.yml                    (NEW — Plan 84-01)

README.md                             (EDIT — add CI badge, Plan 84-01)

src/client/pages/LandingPage.tsx      (EDIT — LandingFooter function, Plan 84-02)
```

### Pattern 1: Dependabot v2 YAML — Two Ecosystems with Grouping

**What:** Single `dependabot.yml` configures both `npm` and `github-actions` ecosystems. The `groups` field batches all npm updates into one weekly PR instead of one PR per package.

**When to use:** Always — grouping is essential for a repo with 68 packages (39 prod + 29 dev) to avoid PR flood.

**Exact YAML (verified against GitHub official docs):**
```yaml
# Source: https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "03:00"
      timezone: "America/Chicago"
    labels:
      - "dependencies"
    open-pull-requests-limit: 5
    groups:
      npm-all:
        patterns:
          - "*"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "03:00"
      timezone: "America/Chicago"
    labels:
      - "dependencies"
```

**Key notes:**
- `package-ecosystem: "github-actions"` monitors `uses:` lines in `.github/workflows/*.yml`. Currently 2 actions pinned: `actions/checkout@v4`, `actions/setup-node@v4`.
- The `groups.npm-all` group with `patterns: ["*"]` consolidates all npm updates into one PR. Without this, 68 packages = up to 68 PRs per week.
- `labels` overrides the default label set. The success criterion requires the label `dependencies` — this config applies it explicitly.
- `target-branch` defaults to the default branch (`main`) when omitted — no need to specify.
- The `dependencies` label must exist in the GitHub repo before Dependabot runs. It must be created in repo Settings → Labels.

### Pattern 2: Better Stack iframe Badge in React

**What:** Better Stack provides a pre-built iframe badge. The `src` URL is specific to your status page subdomain.

**When to use:** After creating the status page in Better Stack UI, copy the iframe code from Advanced settings → Embeddable badge.

**Example (verified against Better Stack docs):**
```tsx
// Source: https://betterstack.com/docs/uptime/working-with-status-pages/embeddable-status-badge/
// In LandingFooter() function — add after the copyright line or alongside nav links
<iframe
  src="https://YOUR-SUBDOMAIN.betteruptime.com/badge?theme=dark"
  width="250"
  height="30"
  frameBorder="0"
  scrolling="no"
  title="Service status"
  style={{ colorScheme: 'none' }}
/>
```

**React notes:**
- Use `frameBorder` (camelCase) not `frameborder` in JSX
- Use `style={{ colorScheme: 'none' }}` to prevent Tailwind dark mode from breaking badge rendering
- The `src` URL is unique to each status page — it is not a generic URL; the planner must note that this value is set after the Better Stack account is configured (it is a human step, not code-deterministic)

### Pattern 3: CI Badge in README

**What:** A Markdown image link to the GitHub Actions workflow status badge. Already supported natively by GitHub Actions.

**Format:**
```markdown
[![CI](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/ci.yml/badge.svg)](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/ci.yml)
```

**Note:** No README.md currently exists at the project root. Plan 84-01 will need to create it.

### Anti-Patterns to Avoid
- **One PR per npm package:** Not using `groups` on a 68-package repo creates up to 68 concurrent PRs per week — PR flood, guaranteed to be ignored.
- **Using Uptime Robot free tier for a commercial SaaS:** Terms of Service updated December 1, 2024 explicitly prohibit commercial use. Violating this risks account suspension and loss of monitoring data.
- **Hardcoding a placeholder badge URL:** The iframe `src` URL includes the Better Stack subdomain chosen at account creation time. The planner must note this as a human setup step with a placeholder, not a committed constant.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency update automation | Script to watch npm outdated and open PRs | GitHub Dependabot | Handles security advisories, semver parsing, PR lifecycle, conflict detection |
| Uptime monitoring | Express cron pinging own endpoint | Better Stack / Uptime Robot | External monitoring from outside the process is required — internal pings don't detect server crashes |
| Status badge | Custom SVG generated server-side | Better Stack iframe badge | Real-time data, zero server load, maintained by monitoring service |

---

## Existing Infrastructure (Verified)

### /api/health endpoint — CONFIRMED EXISTS
```typescript
// src/server/index.ts, lines 154-161
app.get('/api/health', (_req, res) => {
  try {
    pingDb();
    res.json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'error' });
  }
});
```
- Returns HTTP 200 + `{ status: 'ok', db: 'ok' }` on success
- Returns HTTP 503 + `{ status: 'degraded', db: 'error' }` on SQLite failure
- Already excluded from pino access logs (`autoLogging.ignore`) and auth middleware — uptime pings will not generate noise
- No changes needed to this endpoint

### LandingFooter — CONFIRMED STRUCTURE
```tsx
// src/client/pages/LandingPage.tsx, lines 1014-1051
function LandingFooter() {
  const footerLinks = [
    { label: 'Pricing', to: '/pricing' },
    { label: 'Case Studies', to: '/case-studies' },
    { label: 'Contact', to: '/contact' },
    { label: 'Reviews', to: '/reviews' },
    { label: 'Security Policy', to: '/security' },
    { label: 'API Docs', to: '/api-docs' },
    { label: 'Log In', to: '/login' },
  ];
  return (
    <footer className="bg-nav-dark text-gray-400 py-10 px-6">
      ...copyright line at bottom...
    </footer>
  );
}
```
- The status badge iframe goes between the nav link row and the copyright line, OR as a new row below the nav links
- The status page text link (e.g., "System Status") can be added to `footerLinks` array pointing to the external Better Stack URL

### GitHub Actions — Current actions pinned
- `actions/checkout@v4` (in ci.yml and security.yml)
- `actions/setup-node@v4` (in ci.yml and security.yml)
- Dependabot `github-actions` ecosystem will monitor these for updates

---

## Common Pitfalls

### Pitfall 1: Uptime Robot Free Tier for Commercial Use
**What goes wrong:** Account suspended or terminated; loss of monitoring history and status page
**Why it happens:** ToS updated December 1, 2024 — free plan non-commercial only. SaaS products violate this.
**How to avoid:** Use Better Stack free tier (no explicit commercial restriction found in ToS as of April 2026) or pay for Uptime Robot Solo ($7/mo)
**Warning signs:** UptimeRobot "Who Should Use" help article explicitly calls out: "business, institutional, or revenue-generating activities" as prohibited

### Pitfall 2: Missing `dependencies` Label in GitHub Repo
**What goes wrong:** Dependabot PRs fail to apply the label; GitHub logs an error like "Label 'dependencies' does not exist"
**Why it happens:** Dependabot does not create labels — they must exist before the first run
**How to avoid:** Create the label in GitHub repo Settings → Labels before or immediately after merging `dependabot.yml`
**Warning signs:** First Dependabot PR shows label application failure in the PR timeline

### Pitfall 3: Badge iframe `src` URL is Hardcoded Placeholder
**What goes wrong:** The badge URL contains the Better Stack subdomain chosen at account creation. It cannot be known before the service account exists.
**Why it happens:** Plan 84-02 must note this as a two-step process: (a) human creates Better Stack account and monitor, (b) code is updated with real URL
**How to avoid:** Planner must create a placeholder constant (e.g., `STATUS_PAGE_URL`) with a TODO comment; the human step must produce the real URL before final commit
**Warning signs:** Badge iframe with a non-functional URL silently shows nothing in the browser

### Pitfall 4: Dependabot PR Flood Without Groups
**What goes wrong:** 68 weekly PRs open simultaneously — CI queue overloaded, PRs ignored, team abandons process
**Why it happens:** Default Dependabot behavior creates one PR per package
**How to avoid:** Use `groups` with `patterns: ["*"]` to consolidate all npm updates into one PR per week
**Warning signs:** After first Dependabot run, 20+ PRs open at once

### Pitfall 5: Monitor Targeting Wrong URL
**What goes wrong:** Monitoring the root URL `/` which returns the React app HTML; if the Express process dies but Vite serves static files, the monitor shows "up" even though the API is down
**Why it happens:** Naive monitor setup uses the homepage URL
**How to avoid:** Monitor the exact URL `https://prevailingwage.app/api/health` — this hits Express directly and validates the SQLite connection
**Warning signs:** Monitor shows uptime even when the backend is unreachable

---

## Code Examples

### Complete dependabot.yml
```yaml
# Source: https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "03:00"
      timezone: "America/Chicago"
    labels:
      - "dependencies"
    open-pull-requests-limit: 5
    groups:
      npm-all:
        patterns:
          - "*"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "03:00"
      timezone: "America/Chicago"
    labels:
      - "dependencies"
```

### LandingFooter with Status Badge (Better Stack)
```tsx
// Source: https://betterstack.com/docs/uptime/working-with-status-pages/embeddable-status-badge/
// Replace YOUR-SUBDOMAIN with actual Better Stack subdomain after account creation
const STATUS_PAGE_URL = 'https://YOUR-SUBDOMAIN.betteruptime.com'; // TODO: set after Better Stack setup

function LandingFooter() {
  const footerLinks = [
    { label: 'Pricing', to: '/pricing' },
    { label: 'Case Studies', to: '/case-studies' },
    { label: 'Contact', to: '/contact' },
    { label: 'Reviews', to: '/reviews' },
    { label: 'Security Policy', to: '/security' },
    { label: 'API Docs', to: '/api-docs' },
    { label: 'Log In', to: '/login' },
  ];

  return (
    <footer className="bg-nav-dark text-gray-400 py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
          <span className="text-white font-headline text-sm">HCC Prevailing Wage</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {footerLinks.map(({ label, to }) => (
              <Link key={label} to={to} className="text-gray-400 hover:text-brand-gold transition-colors">
                {label}
              </Link>
            ))}
            <a
              href={STATUS_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-brand-gold transition-colors"
            >
              System Status
            </a>
          </div>
        </div>
        {/* Better Stack embeddable status badge */}
        <div className="mb-4">
          <iframe
            src={`${STATUS_PAGE_URL}/badge?theme=dark`}
            width="250"
            height="30"
            frameBorder="0"
            scrolling="no"
            title="Service status"
            style={{ colorScheme: 'none' }}
          />
        </div>
        <p className="text-xs text-gray-600 text-center border-t border-white/5 pt-6">
          Davis-Bacon and Related Acts compliance software for federal construction contractors.
          &copy; 2026 PrevWage. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
```

### README.md CI Badge
```markdown
# HCC Prevailing Wage

[![CI](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/ci.yml/badge.svg)](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/ci.yml)
[![Security Audit](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/security.yml/badge.svg)](https://github.com/teamcarrillo405-hub/prevailing-wage/actions/workflows/security.yml)

Certified payroll compliance software for federal construction contractors.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Uptime Robot free tier for commercial | Uptime Robot Solo ($7/mo) or Better Stack free | Dec 1, 2024 | Free tier non-commercial only per updated ToS |
| Freshping free (50 monitors, 1-min) | Freshping shut down | March 6, 2026 | Freshping is gone — not an option |
| One Dependabot PR per npm package | Groups feature batches into 1 PR | Dependabot v2 (GA 2023) | Massively reduces PR noise; essential for repos with 50+ deps |

---

## Open Questions

1. **Better Stack commercial use ToS**
   - What we know: No explicit commercial restriction found in Better Stack pricing/ToS as of April 2026; used by publicly traded companies per their marketing
   - What's unclear: Terms were not exhaustively audited — could have a clause not surfaced in research
   - Recommendation: Proceed with Better Stack free tier; if account gets flagged, upgrade to paid tier ($24/mo)

2. **Better Stack subdomain for badge URL**
   - What we know: The badge iframe `src` includes the subdomain chosen at account creation; not deterministic from code
   - What's unclear: Exact subdomain pattern before account is created
   - Recommendation: Plan 84-02 uses a `STATUS_PAGE_URL` constant with a TODO comment; the human setup step documents what to replace

3. **No README.md at project root**
   - What we know: The file does not exist; `ls` shows no README in project root
   - What's unclear: Whether there is an intentional reason for no README (new repo created today per context)
   - Recommendation: Plan 84-01 creates a minimal `README.md` with the CI badge as its primary content

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GitHub Dependabot | SEC-09 | Implicit (public repo, GitHub.com) | Built-in | None needed |
| Better Stack account | SEC-10 | Requires human signup | Free tier | Uptime Robot Solo $7/mo |
| `/api/health` endpoint | SEC-10 monitoring | Confirmed in src/server/index.ts | Exists | N/A — exists |

**Missing dependencies with no fallback:**
- Better Stack account (or Uptime Robot account) — human must sign up before the badge URL is known; this blocks the final commit of Plan 84-02's badge URL

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

> `workflow.nyquist_validation` status unknown — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --exclude ".worktrees/**" --exclude ".claude/worktrees/**"` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-09 | `.github/dependabot.yml` exists with correct schema | manual-only (file inspection) | `cat .github/dependabot.yml` | ❌ Wave 0 (file created in 84-01) |
| SEC-10 | LandingPage footer contains iframe with `betteruptime.com/badge` src | manual-only (browser + visual) | N/A | N/A |
| SEC-10 | LandingPage footer contains anchor href to status page URL | unit (component render test) | `npx vitest run --reporter verbose` | ❌ optional |

**Note:** Both SEC-09 and SEC-10 success criteria are primarily verified by file existence and browser visual inspection, not by automated unit tests. The Dependabot YAML is validated by GitHub's own schema linter when pushed. The badge render is validated visually.

### Wave 0 Gaps
- No new test files needed — phase is configuration + minor UI edit
- Vitest infrastructure already exists and covers existing code

*(Existing test infrastructure covers all automated phase requirements; SEC-09 and SEC-10 acceptance criteria are infrastructure/configuration artifacts, not unit-testable logic)*

---

## Sources

### Primary (HIGH confidence)
- GitHub Docs — Configuration options for dependabot.yml — https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file
- Better Stack Docs — Embeddable status badge — https://betterstack.com/docs/uptime/working-with-status-pages/embeddable-status-badge/
- UptimeRobot Pricing page — https://uptimerobot.com/pricing/ (50 monitors, 5-min interval, 1 basic status page, "hobby projects" language)
- Shields.io — Uptime Robot status badge — https://shields.io/badges/uptime-robot-status

### Secondary (MEDIUM confidence)
- UptimeRobot ToS commercial restriction confirmed by LowEndTalk community discussion + help center article citing "business, institutional, or revenue-generating activities" — https://lowendtalk.com/discussion/199126/ and https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan
- Better Stack Uptime free tier features (10 monitors, 3-min checks, status page) — https://betterstack.com/uptime
- Freshping shutdown confirmed — March 6, 2026 — https://notifier.so/guides/freshping-shutdown/

### Tertiary (LOW confidence)
- Better Stack commercial use ToS — not exhaustively verified; extrapolated from marketing language ("works with publicly traded companies")

---

## Metadata

**Confidence breakdown:**
- Dependabot YAML syntax: HIGH — verified against official GitHub docs
- Uptime Robot commercial restriction: HIGH — confirmed by official help center article and ToS language
- Better Stack free tier capabilities: HIGH — confirmed against betterstack.com/uptime and official badge docs
- Better Stack commercial ToS: LOW — not exhaustively verified
- Freshping shutdown: HIGH — multiple sources confirm March 2026 shutdown

**Research date:** 2026-04-26
**Valid until:** 2026-07-26 (stable — monitoring service pricing/terms change infrequently; verify Uptime Robot ToS before using free tier)
