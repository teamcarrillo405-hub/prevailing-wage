import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { PublicRoute } from './components/shared/PublicRoute';
import { LoadingSpinner } from './components/shared/LoadingSpinner';

// Lazy-loaded page components (route-based code splitting)
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const LandingPage = React.lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProjectDetailPage = React.lazy(() => import('./pages/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const WageLookupPage = React.lazy(() => import('./pages/WageLookupPage.js').then(m => ({ default: m.WageLookupPage })));
const CostEstimationPage = React.lazy(() => import('./pages/CostEstimationPage.js').then(m => ({ default: m.CostEstimationPage })));
const WageCoveragePage = React.lazy(() => import('./pages/WageCoveragePage.js').then(m => ({ default: m.WageCoveragePage })));
const AdminStateWagePage = React.lazy(() => import('./pages/AdminStateWagePage.js').then(m => ({ default: m.AdminStateWagePage })));
const PayrollWizardPage = React.lazy(() => import('./pages/PayrollWizardPage.js').then(m => ({ default: m.PayrollWizardPage })));
const PayrollListPage = React.lazy(() => import('./pages/PayrollListPage.js').then(m => ({ default: m.PayrollListPage })));
const OtScenarioPage = React.lazy(() => import('./pages/OtScenarioPage.js').then(m => ({ default: m.OtScenarioPage })));
const WorkersPage = React.lazy(() => import('./pages/WorkersPage.js').then(m => ({ default: m.WorkersPage })));
const PayrollWeekDetailPage = React.lazy(() => import('./pages/PayrollWeekDetailPage.js').then(m => ({ default: m.PayrollWeekDetailPage })));
const VarianceReportPageRoute = React.lazy(() => import('./pages/VarianceReportPageRoute').then(m => ({ default: m.VarianceReportPageRoute })));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const WorkerComplianceHistoryPage = React.lazy(() => import('./pages/WorkerComplianceHistoryPage').then(m => ({ default: m.WorkerComplianceHistoryPage })));
const ProjectActivityPage = React.lazy(() => import('./pages/ProjectActivityPage').then(m => ({ default: m.ProjectActivityPage })));
const TeamPage = React.lazy(() => import('./pages/TeamPage.js').then(m => ({ default: m.TeamPage })));
const BillingPage = React.lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })));
const AcceptInvitePage = React.lazy(() => import('./pages/AcceptInvitePage.js').then(m => ({ default: m.AcceptInvitePage })));
const SubUploadPage = React.lazy(() => import('./pages/SubUploadPage').then(m => ({ default: m.SubUploadPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // 1 minute — matches per-query defaults already set
      gcTime: 5 * 60_000,          // 5 minutes garbage collection
      retry: 1,                     // retry once on failure
      refetchOnWindowFocus: false,  // don't refetch when user alt-tabs
    },
  },
});

function WildcardRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ToastProvider>
          <ErrorBoundary>
          <ToastContainer />
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
            <Routes>
              {/* Public routes — authenticated users redirected to /dashboard */}
              <Route element={<PublicRoute />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>

              {/* Login — unwrapped public route (stays as-is, Phase 14 polishes it) */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected routes — unauthenticated users redirected to /login */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/wages" element={<WageLookupPage />} />
                <Route path="/cost-estimation" element={<CostEstimationPage />} />
                <Route path="/admin/coverage" element={<WageCoveragePage />} />
                <Route path="/admin/wages" element={<AdminStateWagePage />} />
                <Route path="/projects/:projectId/payroll" element={<PayrollListPage />} />
                <Route path="/projects/:projectId/payroll/new" element={<PayrollWizardPage />} />
                <Route path="/projects/:projectId/payroll/:weekId/edit" element={<PayrollWizardPage />} />
                <Route path="/projects/:projectId/payroll/:weekId" element={<PayrollWeekDetailPage />} />
                <Route path="/projects/:projectId/ot-scenarios" element={<OtScenarioPage />} />
                <Route path="/projects/:projectId/workers" element={<WorkersPage />} />
                <Route path="/projects/:projectId/workers/:workerId/compliance-history" element={<WorkerComplianceHistoryPage />} />
                <Route path="/projects/:projectId/variance" element={<VarianceReportPageRoute />} />
                <Route path="/projects/:projectId/reports" element={<ReportsPage />} />
                <Route path="/projects/:id/activity" element={<ProjectActivityPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/billing" element={<BillingPage />} />
              </Route>

              {/* Public accept-invite route — no auth wrapper per D-09 */}
              <Route path="/accept-invite" element={<AcceptInvitePage />} />

              {/* Public sub upload route — token-based, no auth required */}
              <Route path="/sub-upload/:token" element={<SubUploadPage />} />

              {/* Auth-aware wildcard */}
              <Route path="*" element={<WildcardRedirect />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
          </ToastProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
