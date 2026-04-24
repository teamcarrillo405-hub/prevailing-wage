// src/client/pages/PayrollWizardPage.tsx
// Route: /projects/:projectId/payroll/new        (create mode)
// Route: /projects/:projectId/payroll/:weekId/edit (edit mode — :weekId present)
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { PayrollWizard } from '../components/payrollWizard/PayrollWizard';

export function PayrollWizardPage() {
  const { projectId, weekId } = useParams<{ projectId: string; weekId?: string }>();
  if (!projectId) return (
    <Layout>
      <div className="text-center py-16">
        <p className="text-gray-500 text-sm mb-4">No project selected. Please open a project first.</p>
        <Link to="/dashboard" className="text-sm font-semibold text-brand-gold hover:underline">← Back to Projects</Link>
      </div>
    </Layout>
  );
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <PageHeader title={weekId ? 'Edit Payroll Week' : 'New Payroll Week'} />
        <PayrollWizard projectId={projectId} weekId={weekId ?? null} />
      </div>
    </Layout>
  );
}
