# Phase 13: Landing Page + Routing — Research

**Researched:** 2026-03-20
**Domain:** React Router v7, marketing page composition, auth-aware routing
**Confidence:** HIGH — all findings verified against direct codebase inspection; patterns confirmed against prior milestone architecture research

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LANDING-01 | Hero section — outcome-focused headline, 1-2 sentence subhead, "Create Free Account" primary CTA, secondary "See How It Works" anchor link, product screenshot (no hardhat stock photos) | LandingPage.tsx new file; hero naming WH-347 / Davis-Bacon / SAM.gov; Button primitive (primary variant) from Phase 11 |
| LANDING-02 | Problem section — 3 contractor pain points framed as problems the user already feels (manual rate lookup, WH-347 errors, late violation discovery) | LandingPage.tsx section; uses design tokens + Card primitive from Phase 11 |
| LANDING-03 | How It Works section — 3-step workflow with icons: Create project → Enter payroll → Generate WH-347 | LandingPage.tsx section; lucide-react for step icons (needs npm install) |
| LANDING-04 | Feature highlights — 4-6 benefits-framed features | LandingPage.tsx section; lucide-react icons; Card primitive |
| LANDING-05 | Trust signals section — compliance currency, regulatory alignment, specificity statement, product screenshot | LandingPage.tsx section; no data fetching, static copy + design tokens |
| LANDING-06 | CTA close + footer — repeated primary CTA, footer with login link, HCC logo, contact | LandingPage.tsx bottom; Link to /login; Button primary from Phase 11 |
| LANDING-07 | Public route "/" serves LandingPage.tsx — authenticated users redirected to /dashboard; wildcard catches unknown routes auth-aware | App.tsx routing changes; PublicRoute guard component |
</phase_requirements>

---

## Summary

Phase 13 builds two things that are tightly coupled: a marketing landing page (LANDING-01 through LANDING-06) and the routing logic that controls who sees what (LANDING-07). The two are best split into separate plans — routing correctness gates the landing page being accessible at all.

The current App.tsx is simple: one public route (`/login`), one protected group, and a `*` wildcard that unconditionally redirects to `/dashboard`. This must change in three ways: (1) add `/` as a public route serving LandingPage.tsx, (2) add `/register` as a public route pointing to a RegisterPage, and (3) make the `*` wildcard auth-aware so logged-in users go to `/dashboard` and guests go to `/`.

The existing auth infrastructure (`AuthContext`, `useAuth`, `ProtectedRoute`) already provides `isAuthenticated` and `isLoading`. A new `PublicRoute` component that mirrors `ProtectedRoute` is the correct pattern — it redirects authenticated users to `/dashboard` and renders its children for guests. This covers both the `/` and `/register` routes.

The landing page content is static JSX. All design tokens from Phase 10, all UI primitives from Phase 11, and the app shell patterns from Phase 12 are ready to use. The one gap is `lucide-react` — it was recommended in STACK.md but not installed. It must be installed before the landing page icons can be built. `motion` (Framer Motion v12) is also not installed; it is optional for scroll animations, but the phase requirements do not call for animations — defer unless the planner decides it adds value without scope creep.

**Primary recommendation:** Plan 01 handles routing surgery (PublicRoute guard + App.tsx + RegisterPage). Plan 02 builds the landing page hero and problem/how-it-works sections. Plan 03 completes the page with feature highlights, trust signals, CTA close, and footer. This three-plan split keeps each plan independently verifiable.

---

## Standard Stack

### Core (All Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | ^7.13.1 | Client routing, `<Navigate>`, `<Outlet>`, `<Route>` | Already installed; v7 uses the same composable route patterns as v6 |
| AuthContext / useAuth | project code | `isAuthenticated`, `isLoading` from cookie-based JWT | Already established; ProtectedRoute uses it correctly |
| Button (Phase 11) | project code | Primary CTA styling — `bg-brand-gold` variant | Already implemented in `src/client/components/ui/Button.tsx` |
| Card (Phase 11) | project code | Section and feature card containers | Already implemented in `src/client/components/ui/Card.tsx` |
| clsx + tailwind-merge / cn() | installed | Class merging utility | Already installed, already in `src/client/lib/utils.ts` |

### Supporting (Need Install)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 | SVG icons for How It Works steps and Feature Highlights | Required — project memory rule bans emojis/emoticons; SVG icons are the required alternative |

### Explicitly NOT Needed

| Library | Why Not |
|---------|---------|
| motion / framer-motion | Requirements do not specify scroll animations. Static sections with CSS hover states are sufficient. Install only if planner explicitly adds animation tasks. |
| react-intersection-observer | Same rationale — no animation requirements in LANDING-01 through LANDING-07 |
| shadcn/ui | STACK.md explicitly rejected — Tailwind v4 transparency bugs, project forbids new UI frameworks |

### Installation

```bash
npm install lucide-react@^0.577.0
```

---

## Architecture Patterns

### Recommended File Structure for Phase 13

```
src/client/
├── App.tsx                             MODIFY — add "/" public route, /register, auth-aware wildcard
├── pages/
│   ├── LandingPage.tsx                 CREATE — six-section marketing page (public)
│   └── RegisterPage.tsx                CREATE — thin wrapper around existing RegisterForm component
└── components/
    └── shared/
        └── PublicRoute.tsx             CREATE — mirrors ProtectedRoute, redirects authenticated users to /dashboard
```

### Pattern 1: PublicRoute Guard Component

**What:** A route wrapper that reads `isAuthenticated` from `useAuth()`. If loading, shows nothing or a minimal spinner. If authenticated, redirects to `/dashboard`. If not authenticated, renders `<Outlet />`.

**When to use:** Wrap `"/"` and `"/register"` routes. Prevents authenticated users from seeing the marketing page or registration form.

**Example:**
```tsx
// src/client/components/shared/PublicRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // or <LoadingSpinner /> — brief, not a full page
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
```

**Why this over inline logic:** Mirrors the existing `ProtectedRoute` pattern exactly. Same hook, same shape. Planner and developer can reason about both guards the same way.

### Pattern 2: Auth-Aware Wildcard Using PublicRoute Logic

**What:** The current `*` wildcard always redirects to `/dashboard`. After Phase 13, authenticated users hitting an unknown URL should still go to `/dashboard`, but unauthenticated users should go to `/` (the landing page, not `/login`).

**Implementation:** Replace the unconditional `<Navigate to="/dashboard" replace />` with a small inline component that reads auth state, OR use a dedicated `WildcardRedirect` component.

**Example (inline component in App.tsx):**
```tsx
function WildcardRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
}

// In Routes:
<Route path="*" element={<WildcardRedirect />} />
```

**Note:** `useAuth()` can only be called inside components rendered within `<AuthProvider>`. `WildcardRedirect` lives inside `<BrowserRouter>` and `<AuthProvider>` in the JSX tree, so this works correctly.

### Pattern 3: RegisterPage as a Thin Wrapper

**What:** `RegisterPage.tsx` simply renders the existing `RegisterForm` inside the same card/layout shell that `LoginPage.tsx` uses. The `RegisterForm` component already exists at `src/client/components/auth/RegisterForm.tsx` and already navigates to `/dashboard` after success.

**When to use:** The current `LoginPage` embeds a mode toggle between login and register. After Phase 13, `/register` is its own route — the mode toggle on LoginPage can be replaced with a `<Link to="/register">` link, or left as-is. The planner should decide; both work.

**Why a separate route matters:** The landing page CTA ("Create Free Account") must navigate directly to `/register`. If `/register` does not exist as a route, clicking the CTA dead-ends at `/login` with the login form shown — the user must find and click the "No account? Register instead" toggle. LANDING-07 explicitly requires `/register` to be a valid destination.

### Pattern 4: App.tsx Route Structure After Phase 13

```tsx
<Routes>
  {/* Public routes — redirect to /dashboard if already authenticated */}
  <Route element={<PublicRoute />}>
    <Route path="/" element={<LandingPage />} />
    <Route path="/register" element={<RegisterPage />} />
  </Route>

  {/* Login — currently public, stays public (no redirect for now) */}
  <Route path="/login" element={<LoginPage />} />

  {/* Protected routes — redirect to /login if not authenticated */}
  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<DashboardPage />} />
    {/* ... all existing protected routes unchanged ... */}
  </Route>

  {/* Auth-aware wildcard */}
  <Route path="*" element={<WildcardRedirect />} />
</Routes>
```

**Note on `/login`:** LoginPage currently handles both login and register via a mode toggle. It is NOT wrapped in `PublicRoute` above. This is intentional to avoid scope creep. The planner should note this as a Phase 14 (PAGE-07) concern — LoginPage visual polish is a Phase 14 task. For Phase 13, `/login` stays unwrapped.

### Pattern 5: Landing Page Section Structure

**What:** `LandingPage.tsx` is a single file composed of six named sections rendered top-to-bottom. No sub-component files required (they would add import overhead without reuse value since no other page uses these sections). A `<nav>` at the top for the logo and login link, followed by the six sections, then `<footer>`.

**Section order matches requirements:**
1. `<HeroSection>` — LANDING-01 (above-fold, WH-347/Davis-Bacon/SAM.gov named)
2. `<ProblemSection>` — LANDING-02 (3 pain points)
3. `<HowItWorksSection>` — LANDING-03 (3-step workflow, lucide-react icons)
4. `<FeatureHighlightsSection>` — LANDING-04 (4-6 benefit cards)
5. `<TrustSignalsSection>` — LANDING-05 (compliance currency, specificity)
6. `<CTACloseSection>` + `<Footer>` — LANDING-06

**Recommended approach:** Define all six as inline functions within `LandingPage.tsx`, NOT as separate imported components. This keeps the file self-contained and eliminates cross-file coordination overhead for a single-use page.

### Anti-Patterns to Avoid

- **Mode-toggle login page as register destination:** CTA must link to `/register` explicitly. Linking to `/login` is not acceptable for LANDING-01 — it dead-ends new users.
- **`useAuth()` called outside `<AuthProvider>` in tree:** `WildcardRedirect` and `PublicRoute` must be rendered inside `<AuthProvider>`. In the current App.tsx, `<AuthProvider>` wraps `<BrowserRouter>`, which means all `<Route>` elements are inside both — this is correct. Do not restructure the provider nesting.
- **Landing page wrapping in `<Layout>`:** `Layout.tsx` renders the dark nav with a "Log Out" button. The landing page has its own public nav. Do NOT wrap `<LandingPage />` in `<Layout />`.
- **Hardcoded hex values in landing page JSX:** All existing tokens are available (`bg-brand-gold`, `bg-nav-dark`, `text-brand-gold`, etc.). Use tokens; do not introduce new inline hex values.
- **Unconditional `*` redirect to `/dashboard`:** The current wildcard redirects unauthenticated users to `/dashboard`, which then hits `ProtectedRoute`, which redirects to `/login`. This is a redirect chain, not a redirect to landing. The wildcard must be fixed in this phase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth check in route | Inline `if` in JSX | `PublicRoute` component (new) / `ProtectedRoute` (existing) | Consistency — one place to update auth redirect logic |
| SVG icons | `<svg>` inline paths in JSX | `lucide-react` | Tree-shakeable, typed, 577 icons; inline SVG paths are brittle and verbose |
| CTA button styling | Inline Tailwind class string | `Button` primitive (variant="primary") | Phase 11 built exactly this; use it |
| Card containers | Raw `<div className="bg-white border...">` | `Card` primitive | Phase 11 built exactly this; use it |
| Class merging | Manual template literals | `cn()` from `src/client/lib/utils.ts` | Already in the project; all Phase 11/12 components use it |

---

## Common Pitfalls

### Pitfall 1: /register Route Missing Before Landing Page CTA Is Wired

**What goes wrong:** Landing page's "Create Free Account" button navigates to `/register`. If the `/register` route isn't declared in `App.tsx`, React Router renders nothing (or the wildcard catches it and redirects). The user sees a blank page or gets redirected back to `/`.

**Why it happens:** The route and the CTA link are easy to treat as two separate concerns. The route gets deferred; the CTA is wired in; the link silently breaks.

**How to avoid:** Plan 01 must create BOTH the `/register` route AND `RegisterPage.tsx` BEFORE the landing page CTA is built in Plan 02. This is noted in STATE.md Research Flags.

**Warning signs:** Clicking "Create Free Account" on the landing page sends the URL to `/register` but the page is blank or redirects.

### Pitfall 2: WildcardRedirect Renders Before Auth State Is Known

**What goes wrong:** On first load, `isLoading` is `true` while the `/auth/me` cookie check is in flight. If `WildcardRedirect` renders immediately with `isAuthenticated: false`, it redirects to `/` before the session is confirmed. An authenticated user hitting an unknown URL flickers to `/` then immediately to `/dashboard`.

**Why it happens:** `isLoading` guard omitted from the wildcard component.

**How to avoid:** Always return `null` (or a spinner) when `isLoading` is `true` in both `PublicRoute` and `WildcardRedirect`. The existing `ProtectedRoute` already models this correctly.

### Pitfall 3: PublicRoute Used on /login Causes Login Redirect Loop

**What goes wrong:** If `/login` is wrapped in `PublicRoute`, an authenticated user navigating to `/login` is redirected to `/dashboard`. But `DashboardPage` has a "Log Out" button that navigates to `/login` after logout. After logout, `isAuthenticated` is `false`, so the redirect doesn't fire — this actually works correctly. However, if session expiry causes an authenticated user to be sent to `/login` by the server, the redirect loop risk is low but the behavior is now different from before.

**Why it happens:** Over-aggressive wrapping of public routes.

**How to avoid:** Only wrap `"/"` and `"/register"` in `PublicRoute`. Leave `/login` as an unwrapped public route. This matches the current `ProtectedRoute` design where `/login` is already outside the protected group.

### Pitfall 4: Landing Page Without Proper Viewport Meta or Scroll Anchors

**What goes wrong:** The "See How It Works" secondary CTA is a scroll anchor link (`href="#how-it-works"`). If the target section doesn't have `id="how-it-works"`, the anchor link silently does nothing (no error, no scroll).

**Why it happens:** Section IDs are easy to forget when composing inline functions in a large component.

**How to avoid:** Every section that is a scroll target must have an explicit `id` attribute. Define the anchor IDs as constants at the top of `LandingPage.tsx`.

### Pitfall 5: "Create Free Account" CTA Uses Button Without Link Wrapper

**What goes wrong:** Using `<Button onClick={() => navigate('/register')}>` works but breaks right-click "Open in new tab" and keyboard navigation. Screen reader users also lose context.

**Why it happens:** The `Button` component renders a `<button>` element. For navigation, it should be wrapped in a React Router `<Link>` or use `<a>`.

**How to avoid:** Use `<Link to="/register"><Button>Create Free Account</Button></Link>` or create an `asChild` prop on the Button. The simpler pattern for a landing page is `<Link>` wrapping `<Button>`.

---

## Code Examples

### PublicRoute (complete, verified against ProtectedRoute pattern)

```tsx
// src/client/components/shared/PublicRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
```

### WildcardRedirect (complete, auth-aware)

```tsx
// Inline in App.tsx or extracted to components/shared/WildcardRedirect.tsx
function WildcardRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
}
```

### RegisterPage (thin wrapper — reuses RegisterForm)

```tsx
// src/client/pages/RegisterPage.tsx
import { RegisterForm } from '../components/auth/RegisterForm';

export function RegisterPage() {
  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-headline text-3xl text-text-primary border-b-4 border-brand-gold inline-block pb-1">
            HCC Prevailing Wage
          </h1>
          <p className="text-sm text-text-secondary mt-3">Create a new account</p>
        </div>
        <Card>
          <RegisterForm />
        </Card>
      </div>
    </div>
  );
}
```

### LandingPage hero section skeleton (verified token usage)

```tsx
// Inside LandingPage.tsx
function HeroSection() {
  return (
    <section className="bg-nav-dark text-white py-24 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="font-headline text-5xl font-bold leading-tight mb-6">
          WH-347 Certified Payroll.<br />
          Davis-Bacon Rates, Automated.
        </h1>
        <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
          Pull SAM.gov prevailing wage rates, enter payroll, and generate
          compliant WH-347 forms — in minutes, not hours.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/register">
            <Button variant="primary" size="md">Create Free Account</Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="secondary" size="md">See How It Works</Button>
          </a>
        </div>
      </div>
    </section>
  );
}
```

### Lucide-react icon usage (How It Works section)

```tsx
import { FolderPlus, ClipboardList, FileCheck } from 'lucide-react';

function HowItWorksSection() {
  const steps = [
    { icon: FolderPlus, title: 'Create Project', desc: 'Enter your project location and pull wage rates from SAM.gov automatically.' },
    { icon: ClipboardList, title: 'Enter Payroll', desc: 'Log hours and classifications for each worker each week.' },
    { icon: FileCheck, title: 'Generate WH-347', desc: 'Download a certified payroll PDF that meets DOL requirements.' },
  ];

  return (
    <section id="how-it-works" className="py-20 px-4 bg-surface-page">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-headline text-3xl text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-3 gap-8">
          {steps.map(({ icon: Icon, title, desc }) => (
            <Card key={title}>
              <Icon className="w-8 h-8 text-brand-gold mb-4" />
              <h3 className="font-headline text-xl mb-2">{title}</h3>
              <p className="text-text-secondary text-sm">{desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Wildcard `*` always → `/dashboard` | Auth-aware wildcard → `/dashboard` or `/` | Unauthenticated users hitting unknown URL land on landing page, not login |
| No public route at `/` | `PublicRoute` guard + `LandingPage` at `/` | Marketing homepage accessible; authenticated users skip it |
| RegisterForm only accessible via LoginPage toggle | Dedicated `/register` route + `RegisterPage` | Direct link from CTA works; no dead-end for new users |
| `motion` and `lucide-react` not installed | `lucide-react` installed for icons | Icons available for How It Works and Feature Highlights sections |

**Not changed in this phase:**
- `LoginPage.tsx` mode toggle — stays as-is; Phase 14 (PAGE-07) adds visual polish
- All 11 protected routes — no changes needed
- `AuthContext`, `useAuth`, `ProtectedRoute` — no changes needed

---

## Open Questions

1. **Should LoginPage be wrapped in PublicRoute?**
   - What we know: LoginPage is currently unwrapped. Authenticated users CAN visit `/login` and see the form.
   - What's unclear: This is minor UX friction (authenticated user seeing login page), but wrapping it adds risk of redirect loops during session edge cases.
   - Recommendation: Leave `/login` unwrapped in Phase 13. Phase 14 (PAGE-07) can address it if needed.

2. **Product screenshot for hero section (LANDING-01, LANDING-05)**
   - What we know: Requirements specify "product screenshot (no hardhat stock photos)."
   - What's unclear: Where does the screenshot asset come from? Must someone take it? What format/dimensions?
   - Recommendation: Planner should note this as a human deliverable. If no screenshot is provided, use a styled code/data mock as a placeholder (e.g., a `<div>` styled to look like the dashboard). Do not block implementation on a real screenshot.

3. **Should RegisterForm in RegisterPage retain auto-login after registration?**
   - What we know: `RegisterForm.tsx` currently calls `login()` then `navigate('/dashboard')` after registration. This behavior is correct.
   - What's unclear: Nothing — this works as-is. No changes needed to `RegisterForm`.
   - Recommendation: No change. RegisterPage is a thin wrapper only.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run --reporter=verbose 2>&1 \| tail -5` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LANDING-01 | Hero section renders with WH-347, Davis-Bacon, SAM.gov text and CTA | manual-only | Browser visual inspection | N/A — React component, no server test |
| LANDING-02 | Problem section renders 3 pain points | manual-only | Browser visual inspection | N/A |
| LANDING-03 | How It Works section renders 3 steps with icons | manual-only | Browser visual inspection | N/A |
| LANDING-04 | Feature highlights render 4-6 benefit cards | manual-only | Browser visual inspection | N/A |
| LANDING-05 | Trust signals section renders | manual-only | Browser visual inspection | N/A |
| LANDING-06 | CTA close and footer render with login link | manual-only | Browser visual inspection | N/A |
| LANDING-07 (routing) | GET "/" while logged out → LandingPage; GET "/" while logged in → /dashboard; wildcard while logged in → /dashboard; wildcard while logged out → "/" | smoke (browser) | Manual browser verification with logged-in and logged-out sessions | N/A |

**Rationale for manual-only:** The test suite is Vitest in `node` environment — it has no DOM renderer (no jsdom, no React Testing Library). All 181 existing tests are server-side API tests. Adding client-side component tests would require a separate Vitest config with jsdom — that is out of scope for Phase 13.

**Regression protection:** All 181 existing server tests must remain green after routing changes. App.tsx changes are client-only and do not touch server routes, so no regressions are expected.

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot` (confirms no server regressions)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + browser verification of all 5 routing success criteria before marking Phase 13 complete

### Wave 0 Gaps

- [ ] `lucide-react` not installed — install before Plan 02: `npm install lucide-react@^0.577.0`

*(No test files need to be created — existing server test infrastructure covers regression checking; React component tests are out of scope)*

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `src/client/App.tsx` — current route structure confirmed (no `/` route, `*` always → `/dashboard`)
- Direct codebase inspection: `src/client/contexts/AuthContext.tsx` — `isAuthenticated`, `isLoading`, `user` shape confirmed
- Direct codebase inspection: `src/client/components/shared/ProtectedRoute.tsx` — `PublicRoute` should mirror this exactly
- Direct codebase inspection: `src/client/components/auth/RegisterForm.tsx` — already functional, navigates to `/dashboard` on success
- Direct codebase inspection: `src/client/components/ui/Button.tsx`, `Card.tsx` — primitives available, API confirmed
- Direct codebase inspection: `src/client/index.css` — all design tokens confirmed present
- `.planning/STATE.md` Research Flags for Phase 13 — `/register` route gap and `useAuth` hook extraction noted
- `.planning/research/ARCHITECTURE.md` — Pattern 3 (public route before ProtectedRoute) confirmed
- `.planning/research/STACK.md` — `lucide-react` recommendation and `motion` deferral confirmed

### Secondary (MEDIUM confidence)

- `package.json` inspection — `lucide-react` and `motion` confirmed NOT installed
- `.planning/phases/12-app-shell-global-layout/12-03-SUMMARY.md` — Phase 12 complete, all Card/PageHeader/Button primitives ready

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Routing patterns: HIGH — direct code inspection of App.tsx, AuthContext, ProtectedRoute
- Landing page content: HIGH — requirements are specific; design tokens and primitives are verified available
- lucide-react API: HIGH — confirmed in STACK.md research (2026-03-20), same session
- Test coverage: HIGH — vitest.config.ts inspected directly; DOM test gap is a known constraint

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable libraries, no fast-moving dependencies in scope)
