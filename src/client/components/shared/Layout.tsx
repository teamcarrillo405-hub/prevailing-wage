import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 border-b-4 border-[#F5C518]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <span className="font-headline text-xl text-white tracking-wide">
            HCC Prevailing Wage
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-300 hover:text-white px-3 py-1.5 border border-gray-600 hover:border-gray-400 rounded transition-colors"
          >
            Log Out
          </button>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
