import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function PublicRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to={user?.onboardingCompletedAt ? '/dashboard' : '/onboarding'} replace />;
  return <Outlet />;
}
