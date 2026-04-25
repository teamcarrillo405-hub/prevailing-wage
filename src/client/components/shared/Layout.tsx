import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: team } = useQuery<TeamData>({
    queryKey: ['team'],
    queryFn: () =>
      fetch('/api/team', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => d.data),
    enabled: isAuthenticated,
  });

  const isOwner = team?.isOwner ?? false;

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface-page">
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
            <NavLink to="/dashboard" className={navCls}>Projects</NavLink>
            <NavLink to="/wages" className={navCls}>Wage Lookup</NavLink>
            <NavLink to="/team" className={navCls}>Team</NavLink>
            {isOwner && (
              <>
                <NavLink to="/billing" className={navCls}>Billing</NavLink>
                <NavLink to="/admin/coverage" className={navCls}>Coverage</NavLink>
              </>
            )}
            <div className="w-px h-4 bg-white/15" aria-hidden="true" />
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
                Projects
              </NavLink>
              <NavLink
                to="/wages"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Wage Lookup
              </NavLink>
              <NavLink
                to="/team"
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) => mobileNavCls(isActive)}
              >
                Team
              </NavLink>
              {isOwner && (
                <>
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

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
        {children}
      </main>
    </div>
  );
}
