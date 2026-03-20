import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
