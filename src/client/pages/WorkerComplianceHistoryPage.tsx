// src/client/pages/WorkerComplianceHistoryPage.tsx
// Route: /projects/:projectId/workers/:workerId/compliance-history
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

// Client-side mirror of server types — DO NOT import from server
interface WorkerViolationHistoryEntry {
  projectId: string;
  projectName: string;
  weekId: string;
  weekEndingDate: string;
  payrollNumber: number;
  violationType: 'under-wage' | 'cwhssa-ot' | 'apprentice-ratio';
  detail?: string;
  expected?: number;
  actual?: number;
  delta?: number;
  apprenticeHours?: number;
  journeyworkerHours?: number;
  maxAllowedApprenticeHours?: number;
}

interface WorkerComplianceHistory {
  workerId: string;
  workerName: string;
  ssnLast4: string | null;
  totalViolations: number;
  entries: WorkerViolationHistoryEntry[];
}

function violationLabel(type: string): string {
  switch (type) {
    case 'under-wage': return 'Under-wage';
    case 'cwhssa-ot': return 'CWHSSA OT';
    case 'apprentice-ratio': return 'Apprentice Ratio';
    default: return type;
  }
}

function fmt(n?: number): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function WorkerComplianceHistoryPage() {
  const { projectId, workerId } = useParams<{ projectId: string; workerId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['worker-compliance-history', workerId],
    queryFn: () => api.get<WorkerComplianceHistory>(`/compliance/worker/${workerId}/history`),
    enabled: !!workerId,
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        <Link
          to={`/projects/${projectId}/workers`}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
        >
          &larr; Back to Workers
        </Link>

        {isLoading && <LoadingSpinner />}

        {isError && (
          <p className="text-red-600 text-center py-8">Failed to load compliance history</p>
        )}

        {data && (
          <>
            <PageHeader
              title={`Compliance History: ${data.workerName}`}
              subtitle={[
                data.ssnLast4 ? `SSN: ***-**-${data.ssnLast4}` : null,
                `${data.totalViolations} violation${data.totalViolations !== 1 ? 's' : ''} found`,
              ].filter(Boolean).join(' | ')}
            />

            {data.totalViolations === 0 ? (
              <EmptyState
                heading="No violations found"
                message="This worker has no compliance violations across any project."
              />
            ) : (
              <div className="space-y-3">
                {data.entries.map((v, idx) => (
                  <Card key={`${v.weekId}-${v.violationType}-${idx}`} padding="default">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={v.violationType === 'apprentice-ratio' ? 'warning' : 'violation'}>
                        {violationLabel(v.violationType)}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900">{v.projectName}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      Week ending {v.weekEndingDate} | Payroll #{v.payrollNumber}
                    </p>
                    {v.violationType === 'apprentice-ratio' ? (
                      <p className="text-xs text-gray-700">{v.detail}</p>
                    ) : (
                      <p className="text-xs text-gray-700">
                        Expected: {fmt(v.expected)} | Actual: {fmt(v.actual)} | Delta: {fmt(v.delta)}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </Layout>
  );
}
