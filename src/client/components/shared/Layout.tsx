import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

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
      <nav className="bg-nav-dark border-b-4 border-brand-gold">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/dashboard" className="font-headline text-xl text-white tracking-wide hover:text-brand-gold transition-colors">
            HCC Prevailing Wage
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/team" className="text-sm text-gray-300 hover:text-brand-gold transition-colors">
              Team
            </Link>
            {isOwner && (
              <Link to="/billing" className="text-sm text-gray-300 hover:text-brand-gold transition-colors">
                Billing
              </Link>
            )}
            <Link to="/wages" className="text-sm text-gray-300 hover:text-brand-gold transition-colors">
              Wage Lookup
            </Link>
            <Link to="/cost-estimation" className="text-sm text-gray-300 hover:text-brand-gold transition-colors">
              Cost Estimator
            </Link>
            <Link to="/admin/coverage" className="text-sm text-gray-300 hover:text-brand-gold transition-colors">
              Coverage
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-300 hover:text-white px-3 py-1.5 border border-gray-600 hover:border-gray-400 rounded transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
