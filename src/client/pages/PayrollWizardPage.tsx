// src/client/pages/PayrollWizardPage.tsx
// Route: /projects/:projectId/payroll/new        (create mode)
// Route: /projects/:projectId/payroll/:weekId/edit (edit mode — :weekId present)
import { useParams } from 'react-router-dom';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { PayrollWizard } from '../components/payrollWizard/PayrollWizard';

export function PayrollWizardPage() {
  const { projectId, weekId } = useParams<{ projectId: string; weekId?: string }>();
  if (!projectId) return null;
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <PageHeader title={weekId ? 'Edit Payroll Week' : 'New Payroll Week'} />
        <PayrollWizard projectId={projectId} weekId={weekId ?? null} />
      </div>
    </Layout>
  );
}
