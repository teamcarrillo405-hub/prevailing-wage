import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { WageLookupPage } from './pages/WageLookupPage.js';
import { AdminStateWagePage } from './pages/AdminStateWagePage.js';
import { PayrollEntryPage } from './pages/PayrollEntryPage.js';
import { PayrollListPage } from './pages/PayrollListPage.js';
import { OtScenarioPage } from './pages/OtScenarioPage.js';
import { WorkersPage } from './pages/WorkersPage.js';
import { PayrollWeekDetailPage } from './pages/PayrollWeekDetailPage.js';
import { VarianceReportPageRoute } from './pages/VarianceReportPageRoute';
import { ReportsPage } from './pages/ReportsPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/wages" element={<WageLookupPage />} />
              <Route path="/admin/wages" element={<AdminStateWagePage />} />
              <Route path="/projects/:projectId/payroll" element={<PayrollListPage />} />
              <Route path="/projects/:projectId/payroll/new" element={<PayrollEntryPage />} />
              <Route path="/projects/:projectId/payroll/:weekId" element={<PayrollWeekDetailPage />} />
              <Route path="/projects/:projectId/ot-scenarios" element={<OtScenarioPage />} />
              <Route path="/projects/:projectId/workers" element={<WorkersPage />} />
              <Route path="/projects/:projectId/variance" element={<VarianceReportPageRoute />} />
              <Route path="/projects/:projectId/reports" element={<ReportsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
