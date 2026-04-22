import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { PublicRoute } from './components/shared/PublicRoute';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { WageLookupPage } from './pages/WageLookupPage.js';
import { CostEstimationPage } from './pages/CostEstimationPage.js';
import { WageCoveragePage } from './pages/WageCoveragePage.js';
import { AdminStateWagePage } from './pages/AdminStateWagePage.js';
import { PayrollEntryPage } from './pages/PayrollEntryPage.js';
import { PayrollListPage } from './pages/PayrollListPage.js';
import { OtScenarioPage } from './pages/OtScenarioPage.js';
import { WorkersPage } from './pages/WorkersPage.js';
import { PayrollWeekDetailPage } from './pages/PayrollWeekDetailPage.js';
import { VarianceReportPageRoute } from './pages/VarianceReportPageRoute';
import { ReportsPage } from './pages/ReportsPage';
import { WorkerComplianceHistoryPage } from './pages/WorkerComplianceHistoryPage';
import { ProjectActivityPage } from './pages/ProjectActivityPage';
import { TeamPage } from './pages/TeamPage.js';
import { AcceptInvitePage } from './pages/AcceptInvitePage.js';

const queryClient = new QueryClient();

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
              <Route path="/projects/:projectId/payroll/new" element={<PayrollEntryPage />} />
              <Route path="/projects/:projectId/payroll/:weekId" element={<PayrollWeekDetailPage />} />
              <Route path="/projects/:projectId/ot-scenarios" element={<OtScenarioPage />} />
              <Route path="/projects/:projectId/workers" element={<WorkersPage />} />
              <Route path="/projects/:projectId/workers/:workerId/compliance-history" element={<WorkerComplianceHistoryPage />} />
              <Route path="/projects/:projectId/variance" element={<VarianceReportPageRoute />} />
              <Route path="/projects/:projectId/reports" element={<ReportsPage />} />
              <Route path="/projects/:id/activity" element={<ProjectActivityPage />} />
              <Route path="/team" element={<TeamPage />} />
            </Route>

            {/* Public accept-invite route — no auth wrapper per D-09 */}
            <Route path="/accept-invite" element={<AcceptInvitePage />} />

            {/* Auth-aware wildcard */}
            <Route path="*" element={<WildcardRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
