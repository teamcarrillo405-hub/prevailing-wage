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

function navCls({ isActive }: { isActive: boolean }) {
  return `text-sm font-medium transition-colors ${
    isActive
      ? 'text-brand-gold'
      : 'text-gray-400 hover:text-white'
  }`;
}

function mobileNavCls(isActive: boolean) {
  return `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
    isActive
      ? 'bg-brand-gold text-nav-dark'
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
        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-brand-gold focus:text-nav-dark focus:font-semibold focus:rounded focus:text-sm"
      >
        Skip to main content
      </a>

      <nav className="bg-nav-dark sticky top-0 z-40" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-[68px]">
          {/* Logo + wordmark */}
          <Link to="/dashboard" className="flex items-center gap-3 group" aria-label="HCC Prevailing Wage — home">
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
          <div className="hidden sm:flex items-center gap-6">
            <NavLink to="/dashboard" className={navCls}>Dashboard</NavLink>
            <NavLink to="/field" className={({ isActive }) =>
              `flex items-center gap-1.5 text-sm font-medium transition-colors ${isActive ? 'text-brand-gold' : 'text-gray-400 hover:text-white'}`
            }>
              <Clock className="w-3.5 h-3.5" />
              Field
            </NavLink>
            <NavLink to="/wages" className={navCls}>Wage Lookup</NavLink>
            <NavLink to="/reports" className={navCls}>Reports</NavLink>
            <NavLink to="/compliance-methodology" className={navCls}>Methodology</NavLink>
            <NavLink to="/team" className={navCls}>Team</NavLink>
            <NavLink to="/settings/integrations" className={navCls}>Integrations</NavLink>
            <details className="relative group">
              <summary className="list-none cursor-pointer text-sm font-medium text-gray-400 transition-colors hover:text-white">
                Settings
              </summary>
              <div className="absolute right-0 mt-3 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                <Link to="/settings/security" className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Security</Link>
                <Link to="/settings/api-keys" className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">API Keys</Link>
                <Link to="/settings/webhooks" className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Webhooks</Link>
                <Link to="/settings/sso" className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">SSO</Link>
                <Link to="/settings/mfa" className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">MFA</Link>
                {isOwner && (
                  <>
                    <div className="my-2 border-t border-gray-100" />
                    <Link to="/billing" className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Billing</Link>
                    <Link to="/admin/coverage" className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Coverage Admin</Link>
                    <Link to="/admin/copilot" className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Copilot Audit</Link>
                  </>
                )}
              </div>
            </details>
            <div className="w-px h-4 bg-white/15" aria-hidden="true" />
            <OfflineBadge />
            <SyncStatusIndicator status={syncStatus} />
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
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
                to="/wages"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Wage Lookup
              </NavLink>
              <NavLink
                to="/reports"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Reports
              </NavLink>
              <NavLink
                to="/compliance-methodology"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Methodology
              </NavLink>
              <NavLink
                to="/team"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Team
              </NavLink>
              <NavLink
                to="/settings/integrations"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Integrations
              </NavLink>
              <div className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Settings
              </div>
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
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter pb-14 md:pb-8"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {projectId ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <ProjectWorkspaceNav projectId={projectId} />
            <div className="min-w-0">{children}</div>
          </div>
        ) : (
          children
        )}
      </main>

      <CopilotWidget />

      {/* Phase 97: Mobile bottom tab bar */}
      <BottomTabBar />

      {/* Footer — public links */}
      <footer className="border-t border-gray-200 mt-12 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-xs text-gray-400">&copy; 2026 PrevWage</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              PrevWage prepares and reviews certified payroll records. Final certification, legal classification decisions,
              and agency submission remain the responsibility of the authorized reviewer.
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link to="/case-studies" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Case Studies</Link>
            <Link to="/government" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Government</Link>
            <Link to="/contact" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Contact</Link>
            <Link to="/reviews" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Reviews</Link>
            <Link to="/security" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Security Policy</Link>
            <Link to="/pricing" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Pricing</Link>
            <Link to="/api-docs" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">API Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
