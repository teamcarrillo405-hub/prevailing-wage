import { useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';
import { useQuery } from '@tanstack/react-query';
import { Menu, X, Clock } from 'lucide-react';
import { CopilotWidget } from '../copilot/CopilotWidget';
import { useAuth } from '../../hooks/useAuth';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { OfflineBanner, OfflineBadge } from '../ui/OfflineBanner';
import { SyncStatusIndicator } from '../ui/SyncStatusIndicator';
import { PwaInstallBanner } from '../ui/PwaInstallBanner';
import { ProjectWorkspaceNav } from '../projects/ProjectWorkspaceNav';
import { HelpCenterPanel } from '../help/HelpCenterPanel';

function navCls({ isActive }: { isActive: boolean }) {
  return `inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-medium transition-colors ${
    isActive
      ? 'text-brand-gold'
      : 'text-gray-400 hover:text-white'
  }`;
}

const dropdownLinkCls = 'flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50';

function mobileNavCls(isActive: boolean) {
  return `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
    isActive
      ? 'bg-brand-gold text-black'
      : 'text-gray-700 hover:bg-gray-100'
  }`;
}

interface LayoutProps {
  children: ReactNode;
}

interface TeamData {
  members: { id: string; email: string; role: string; joinedAt: string }[];
  pendingInvite: { id: string; email: string; expiresAt: string } | null;
  isOwner: boolean;
}

export function Layout({ children }: LayoutProps) {
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // ── Swipe gesture routing (MOB-21) ────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);
  const TAB_ROUTES = ['/field', '/dashboard', '/reports', '/team'] as const;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 60) return;
    const currentIdx = TAB_ROUTES.indexOf(pathname as typeof TAB_ROUTES[number]);
    if (currentIdx === -1) return;
    if (deltaX < 0) {
      const next = TAB_ROUTES[currentIdx + 1];
      if (next) navigate(next);
    } else {
      const prev = TAB_ROUTES[currentIdx - 1];
      if (prev) navigate(prev);
    }
  }

  const { data: team } = useQuery<TeamData>({
    queryKey: ['team'],
    queryFn: () =>
      fetch('/api/team', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => d.data),
    enabled: isAuthenticated,
  });

  const isOwner = team?.isOwner ?? false;
  const syncStatus = useSyncStatus();
  const projectId = (() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] !== 'projects') return null;
    return segments[1] ?? null;
  })();
  const showCopilot = ![
    '/classification-assist',
    '/compliance-methodology',
    '/competitive-readiness',
  ].includes(pathname);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <OfflineBanner />
      <PwaInstallBanner />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-brand-gold focus:text-black focus:font-semibold focus:rounded focus:text-sm"
      >
        Skip to main content
      </a>

      <nav className="bg-nav-dark sticky top-0 z-40" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 2xl:px-10 flex items-center justify-between h-[68px]">
          {/* Logo + wordmark */}
          <Link to="/dashboard" className="group flex min-h-11 min-w-11 items-center gap-3" aria-label="HCC Prevailing Wage home">
            <img
              src="/images/hcc-logo.svg"
              alt="HCC"
              className="h-8 w-auto opacity-95 group-hover:opacity-100 transition-opacity"
              style={{ filter: 'brightness(1)' }}
            />
            <div className="h-5 w-px bg-white/20" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors tracking-wide">
              Prevailing Wage
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden sm:flex items-center gap-5">
            <NavLink to="/dashboard" className={navCls}>Dashboard</NavLink>
            <NavLink to="/field" className={({ isActive }) =>
              `inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 text-sm font-medium transition-colors ${isActive ? 'text-brand-gold' : 'text-gray-400 hover:text-white'}`
            }>
              <Clock className="w-3.5 h-3.5" />
              Field
            </NavLink>
            <NavLink to="/reports" className={navCls}>Reports</NavLink>
            <NavLink to="/team" className={navCls}>Team</NavLink>
            <details className="relative group">
              <summary className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center text-sm font-medium text-gray-400 transition-colors hover:text-white" aria-label="Open tools menu">
                Tools
              </summary>
              <div className="absolute right-0 mt-3 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                <Link to="/wages" aria-label="Open wage lookup" className={dropdownLinkCls}>Wage Lookup</Link>
                <Link to="/state-support" aria-label="Open state coverage" className={dropdownLinkCls}>State Coverage</Link>
                <Link to="/compliance-methodology" aria-label="Open compliance methodology" className={dropdownLinkCls}>Methodology</Link>
                <Link to="/competitive-readiness" aria-label="Open readiness plan" className={dropdownLinkCls}>Readiness Plan</Link>
                <Link to="/pilot-intake" aria-label="Open pilot intake" className={dropdownLinkCls}>Pilot Intake</Link>
              </div>
            </details>
            <details className="relative group">
              <summary className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center text-sm font-medium text-gray-400 transition-colors hover:text-white" aria-label="Open settings menu">
                Settings
              </summary>
              <div className="absolute right-0 mt-3 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                <Link to="/settings/integrations" aria-label="Open integrations settings" className={dropdownLinkCls}>Integrations</Link>
                <Link to="/settings/security" aria-label="Open security settings" className={dropdownLinkCls}>Security</Link>
                <Link to="/settings/api-keys" aria-label="Open API keys settings" className={dropdownLinkCls}>API Keys</Link>
                <Link to="/settings/webhooks" aria-label="Open webhooks settings" className={dropdownLinkCls}>Webhooks</Link>
                <Link to="/settings/sso" aria-label="Open SSO settings" className={dropdownLinkCls}>SSO</Link>
                <Link to="/settings/mfa" aria-label="Open MFA settings" className={dropdownLinkCls}>MFA</Link>
                {isOwner && (
                  <>
                    <div className="my-2 border-t border-gray-100" />
                    <Link to="/billing" aria-label="Open billing" className={dropdownLinkCls}>Billing</Link>
                    <Link to="/admin/coverage" aria-label="Open coverage admin" className={dropdownLinkCls}>Coverage Admin</Link>
                    <Link to="/admin/copilot" aria-label="Open copilot audit" className={dropdownLinkCls}>Copilot Audit</Link>
                  </>
                )}
              </div>
            </details>
            <div className="w-px h-4 bg-white/15" aria-hidden="true" />
            <OfflineBadge />
            <SyncStatusIndicator status={syncStatus} />
            <button
              onClick={handleLogout}
              className="inline-flex min-h-11 items-center text-sm text-gray-400 transition-colors hover:text-white"
            >
              Log out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 rounded-md text-gray-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 sm:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 sm:hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-nav-dark">
              <span className="font-bold text-white text-sm tracking-wide">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <NavLink
                to="/dashboard"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/field"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                <Clock className="w-4 h-4" />
                Field Clock
              </NavLink>
              <NavLink
                to="/reports"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Reports
              </NavLink>
              <NavLink
                to="/team"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Team
              </NavLink>
              <div className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Tools
              </div>
              {[
                ['/wages', 'Wage Lookup'],
                ['/state-support', 'State Coverage'],
                ['/compliance-methodology', 'Methodology'],
                ['/competitive-readiness', 'Readiness Plan'],
                ['/pilot-intake', 'Pilot Intake'],
              ].map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) => mobileNavCls(isActive)}
                >
                  {label}
                </NavLink>
              ))}
              <div className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Settings
              </div>
              <NavLink
                to="/settings/integrations"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Integrations
              </NavLink>
              <NavLink
                to="/settings/security"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Security
              </NavLink>
              <NavLink
                to="/settings/api-keys"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                API Keys
              </NavLink>
              <NavLink
                to="/settings/webhooks"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Webhooks
              </NavLink>
              <NavLink
                to="/settings/sso"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                SSO
              </NavLink>
              <NavLink
                to="/settings/mfa"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                MFA
              </NavLink>
              {isOwner && (
                <>
                  <div className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Owner Admin
                  </div>
                  <NavLink
                    to="/billing"
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) => mobileNavCls(isActive)}
                  >
                    Billing
                  </NavLink>
                  <NavLink
                    to="/admin/coverage"
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) => mobileNavCls(isActive)}
                  >
                    Coverage
                  </NavLink>
                  <NavLink
                    to="/admin/copilot"
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) => mobileNavCls(isActive)}
                  >
                    Copilot
                  </NavLink>
                </>
              )}
            </nav>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => { setDrawerOpen(false); handleLogout(); }}
                className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 min-h-[44px] transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </>
      )}

      <main
        id="main-content"
        className="w-full px-4 sm:px-6 lg:px-8 2xl:px-10 py-8 page-enter pb-20 md:pb-8"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {projectId ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="hidden lg:block">
              <ProjectWorkspaceNav projectId={projectId} />
            </div>
            <div className="min-w-0">{children}</div>
          </div>
        ) : (
          children
        )}
      </main>

      {showCopilot && <CopilotWidget />}

      {/* Help FAB */}
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 h-10 w-10 rounded-full bg-surface-card border border-brand-gold text-brand-gold flex items-center justify-center shadow-lg z-30 hover:bg-brand-gold hover:text-black transition-colors"
        title="Help Center"
      >
        <span className="font-bold text-sm">?</span>
      </button>
      <HelpCenterPanel open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Phase 97: Mobile bottom tab bar */}
      <BottomTabBar />

      {/* Footer — public links */}
      <footer className="border-t border-gray-200 mt-12 py-6 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 2xl:px-10 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs text-gray-400">&copy; 2026 PrevWage</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              PrevWage prepares and reviews certified payroll records. Final certification, legal classification decisions,
              and agency submission remain the responsibility of the authorized reviewer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link to="/case-studies" className="inline-flex min-h-11 items-center px-1 text-xs text-gray-500 transition-colors hover:text-gray-800">Case Studies</Link>
            <Link to="/government" className="inline-flex min-h-11 items-center px-1 text-xs text-gray-500 transition-colors hover:text-gray-800">Government</Link>
            <Link to="/state-support" className="inline-flex min-h-11 items-center px-1 text-xs text-gray-500 transition-colors hover:text-gray-800">State Support</Link>
            <Link to="/contact" className="inline-flex min-h-11 items-center px-1 text-xs text-gray-500 transition-colors hover:text-gray-800">Contact</Link>
            <Link to="/reviews" className="inline-flex min-h-11 items-center px-1 text-xs text-gray-500 transition-colors hover:text-gray-800">Reviews</Link>
            <Link to="/security" className="inline-flex min-h-11 items-center px-1 text-xs text-gray-500 transition-colors hover:text-gray-800">Security Policy</Link>
            <Link to="/pricing" className="inline-flex min-h-11 items-center px-1 text-xs text-gray-500 transition-colors hover:text-gray-800">Pricing</Link>
            <Link to="/api-docs" className="inline-flex min-h-11 items-center px-1 text-xs text-gray-500 transition-colors hover:text-gray-800">API Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
