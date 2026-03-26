// src/client/pages/PayrollEntryPage.tsx
// Route: /projects/:projectId/payroll/new
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PayrollWeekForm } from '../components/PayrollWeekForm';
import { SamplePayrollForm } from '../components/SamplePayrollForm';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';

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

interface ProjectResponse {
  data: {
    project: {
      id: string;
      state: string;
    };
  };
}

export function PayrollEntryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [useMock, setUseMock] = useState(false);

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () =>
      api.get<ProjectResponse>(`/projects/${projectId}`),
    enabled: !!projectId,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: () =>
      api.get<WorkersResponse>(`/projects/${projectId}/workers`),
    enabled: !!projectId,
  });

  const isCA = projectData?.data?.project?.state === 'CA';

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
        <button
          onClick={() => navigate(`/projects/${projectId}/payroll`)}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4 inline-block"
        >
          &larr; Back to Payroll Weeks
        </button>
        <PageHeader title="New Payroll Week" />

        <HelpCallout
          icon={ClipboardList}
          title="Enter This Week's Hours"
          body="Log straight-time, overtime, and fringe benefits for each worker. The system checks rates against the prevailing wage — fix any flags before downloading your WH-347."
        />

        {isLoading && <LoadingSpinner />}

        {isError && (
          <p className="text-sm text-red-600">
            Failed to load workers. Please try refreshing.
          </p>
        )}

        {!isLoading && !isError && workerRows.length === 0 && !useMock && (
          <EmptyState
            heading="No workers assigned yet"
            message="Add workers to this project first, or run a quick check with sample data to preview calculations."
            action={
              <Button onClick={() => setUseMock(true)}>
                Try with sample workers
              </Button>
            }
          />
        )}

        {!isLoading && !isError && useMock && (
          <SamplePayrollForm
            onAddRealWorkers={() => navigate(`/projects/${projectId}/workers`)}
          />
        )}

        {!isLoading && !isError && !useMock && workerRows.length > 0 && (
          <PayrollWeekForm
            projectId={projectId!}
            workers={workerRows}
            onSave={handleSave}
            isCA={isCA}
          />
        )}
      </div>
    </Layout>
  );
}
