// src/client/pages/ApprenticeshipPage.tsx
// Phase 117 (APP-01): Deep-linkable page wrapper for ApprenticeshipDashboard.
// Route: /projects/:projectId/apprenticeship

import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/shared/Layout';
import { PageHeader } from '../components/ui/PageHeader';
import { ApprenticeshipDashboard } from '../components/ApprenticeshipDashboard';

export function ApprenticeshipPage() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return (
      <Layout>
        <p className="text-sm text-red-600 p-8">Project ID missing.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <PageHeader
          title="Apprenticeship Ratios"
          subtitle="Per-trade ratios, IRA/IIJA 15% compliance check, and 12-week trend"
          action={
            <Link
              to={`/projects/${projectId}`}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Project
            </Link>
          }
        />
        <ApprenticeshipDashboard projectId={projectId} />
      </div>
    </Layout>
  );
}
