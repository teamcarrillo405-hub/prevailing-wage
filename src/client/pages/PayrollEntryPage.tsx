// src/client/pages/PayrollEntryPage.tsx
// Route: /projects/:projectId/payroll/new
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { TermTooltip } from '../components/ui/TermTooltip';

const PW_DEF = "The minimum hourly pay rate for each trade and location, determined by the DOL based on what most workers in that area earn. Paying below this rate is a federal violation.";
const WH347_DEF = "The Department of Labor's official certified payroll form. Contractors must submit it weekly to the contracting officer as proof that workers were paid the correct prevailing wage.";

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

  const isCA = projectData?.data?.project?.state?.toUpperCase() === 'CA';
  const isIL = projectData?.data?.project?.state?.toUpperCase() === 'IL';

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
          body={<>Log straight-time, overtime, and fringe benefits for each worker. The system checks rates against the <TermTooltip term="prevailing wage" definition={PW_DEF} /> — fix any flags before downloading your <TermTooltip term="WH-347" definition={WH347_DEF} />.</>}
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
            message="Add workers to this project before entering payroll. Each worker must have a trade classification on file for WH-347 compliance."
            action={
              <Link
                to={`/projects/${projectId}/workers`}
                className="inline-flex items-center justify-center font-semibold rounded-sm transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 bg-brand-gold text-nav-dark hover:bg-brand-gold/90 border border-transparent text-sm px-4 py-2"
              >
                Add Workers
              </Link>
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
            isIL={isIL}
          />
        )}
      </div>
    </Layout>
  );
}
