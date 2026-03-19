// src/client/pages/PayrollEntryPage.tsx
// Route: /projects/:projectId/payroll/new
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PayrollWeekForm } from '../components/PayrollWeekForm';

interface WorkerClassification {
  id: string;
  workerId: string;
  projectId: string;
  tradeCode: string;
  tradeDescription: string;
  laborType: string;
  baseRate?: number;
  fringeRate?: number;
}

interface Worker {
  id: string;
  name: string;
  classifications: WorkerClassification[];
}

interface WorkersResponse {
  data: {
    workers: Worker[];
  };
}

export function PayrollEntryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: () =>
      api.get<WorkersResponse>(`/projects/${projectId}/workers`),
    enabled: !!projectId,
  });

  // Flatten workers × classifications into rows for the form
  const workerRows = (data?.data?.workers ?? []).flatMap((w) =>
    (w.classifications ?? []).map((c) => ({
      workerId: w.id,
      classificationId: c.id,
      workerName: w.name,
      tradeDescription: c.tradeDescription,
      // baseRate and fringeRate come from wageClassifications lookup in Phase 2.
      // For CPAY-01 we use 0 defaults; Phase 4-02 will wire these up from the WD.
      baseRate: c.baseRate ?? 0,
      fringeRate: c.fringeRate ?? 0,
    })),
  );

  function handleSave(weekId: string) {
    navigate(`/projects/${projectId}/payroll`);
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate(`/projects/${projectId}/payroll`)}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            &larr; Back to Payroll Weeks
          </button>
          <h1 className="text-2xl font-headline text-gray-900">New Payroll Week</h1>
        </div>

        {isLoading && <LoadingSpinner />}

        {isError && (
          <p className="text-sm text-red-600">
            Failed to load workers. Please try refreshing.
          </p>
        )}

        {!isLoading && !isError && (
          <PayrollWeekForm
            projectId={projectId!}
            workers={workerRows}
            onSave={handleSave}
          />
        )}
      </div>
    </Layout>
  );
}
