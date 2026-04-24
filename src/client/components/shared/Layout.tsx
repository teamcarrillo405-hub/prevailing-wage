import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

function navCls({ isActive }: { isActive: boolean }) {
  return `text-sm transition-colors ${
    isActive
      ? 'text-brand-gold font-semibold border-b-2 border-brand-gold pb-0.5'
      : 'text-gray-300 hover:text-brand-gold'
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
    <div className="min-h-screen bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-brand-gold focus:text-nav-dark focus:font-semibold focus:rounded-sm focus:text-sm"
      >
        Skip to main content
      </a>
      <nav className="bg-nav-dark border-b-4 border-brand-gold">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/dashboard" className="font-headline text-xl text-white tracking-wide hover:text-brand-gold transition-colors">
            HCC Prevailing Wage
          </Link>
          <div className="flex items-center gap-4">
            <NavLink to="/dashboard" className={navCls}>Projects</NavLink>
            <NavLink to="/wages" className={navCls}>Wage Lookup</NavLink>
            <NavLink to="/team" className={navCls}>Team</NavLink>
            {isOwner && (
              <>
                <NavLink to="/billing" className={navCls}>Billing</NavLink>
                <NavLink to="/admin/coverage" className={navCls}>Coverage</NavLink>
              </>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-300 hover:text-white px-3 py-1.5 border border-gray-600 hover:border-gray-400 rounded transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
