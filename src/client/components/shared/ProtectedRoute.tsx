import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from './LoadingSpinner';

export function ProtectedRoute() {
  const { user, isAuthenticated, isLoading, hasCheckedSession, refreshUser } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!hasCheckedSession && !isLoading) {
      void refreshUser();
    }
  }, [hasCheckedSession, isLoading, refreshUser]);

  if (isLoading || !hasCheckedSession) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !user.onboardingCompletedAt && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
