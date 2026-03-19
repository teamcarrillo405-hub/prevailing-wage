// src/client/pages/PayrollListPage.tsx
// Route: /projects/:projectId/payroll
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';

interface PayrollWeek {
  id: string;
  projectId: string;
  weekEndingDate: string;
  payrollNumber: number;
  isFinal: boolean;
  createdAt: string;
}

interface PayrollWeeksResponse {
  weeks: PayrollWeek[];
}

export function PayrollListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['payroll-weeks', projectId],
    queryFn: () =>
      api.get<PayrollWeeksResponse>(`/payroll/projects/${projectId}/weeks`),
    enabled: !!projectId,
  });

  const weeks = data?.weeks ?? [];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              &larr; Back to Project
            </button>
            <h1 className="text-2xl font-headline text-gray-900">Payroll Weeks</h1>
          </div>
          <Link
            to={`/projects/${projectId}/payroll/new`}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
          >
            + New Week
          </Link>
        </div>

        {isLoading && <LoadingSpinner />}

        {isError && (
          <p className="text-sm text-red-600">
            Failed to load payroll weeks.
          </p>
        )}

        {!isLoading && !isError && weeks.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm">No payroll weeks yet.</p>
            <Link
              to={`/projects/${projectId}/payroll/new`}
              className="mt-3 inline-block text-sm font-medium text-gray-900 underline"
            >
              Create the first week
            </Link>
          </div>
        )}

        {weeks.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {weeks.map((week) => (
              <div key={week.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Week Ending {week.weekEndingDate}
                  </span>
                  <span className="ml-3 text-xs text-gray-500">
                    Payroll #{week.payrollNumber}
                  </span>
                  {week.isFinal && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      Final
                    </span>
                  )}
                </div>
                <Link
                  to={`/projects/${projectId}/payroll/${week.id}`}
                  className="text-xs text-gray-500 hover:text-gray-900 underline"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
