// src/client/pages/OtScenarioPage.tsx
// Route: /projects/:projectId/ot-scenarios
// Loads existing OT threshold via GET /api/ot-thresholds/:projectId (TanStack Query).
// Renders OtThresholdForm and OtScenarioComparison.
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { OtThresholdForm } from '../components/OtThresholdForm';
import { OtScenarioComparison } from '../components/OtScenarioComparison';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpCallout } from '../components/ui/HelpCallout';

// ── Types ──────────────────────────────────────────────────────────────────

interface OtThresholdRecord {
  id: string;
  projectId: string;
  weeklyOtThreshold: number;
  dailyOtThreshold: number | null;
  dailyDtThreshold: number | null;
  otMultiplier: number;
  dtMultiplier: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface OtThresholdResponse {
  threshold: OtThresholdRecord | null;
}

// ── Page ───────────────────────────────────────────────────────────────────

export function OtScenarioPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ot-threshold', projectId],
    queryFn: () =>
      api.get<OtThresholdResponse>(`/ot-thresholds/${projectId}`),
    enabled: !!projectId,
  });

  const threshold = data?.threshold ?? null;
  const weeklyThreshold = threshold?.weeklyOtThreshold ?? 40;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            &larr; Back to Project
          </button>
          <PageHeader title="Schedule & Overtime Cost Planner" className="mb-0" />
        </div>

        {isLoading && <LoadingSpinner />}

        {isError && (
          <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            Failed to load OT threshold settings.
          </div>
        )}

        {!isLoading && (
          <div className="space-y-6">
            <HelpCallout
              icon={Calculator}
              title="How this works"
              body="Compare different work schedules to see how overtime costs change. Enter your hourly rates and daily hours to calculate total weekly labor cost under Davis-Bacon rules."
            />

            {/* Threshold form — persists to DB */}
            <OtThresholdForm
              projectId={projectId!}
              existingThreshold={threshold}
            />

            {/* Side-by-side comparison — pure client-side, no server call */}
            <OtScenarioComparison
              defaultThreshold={weeklyThreshold}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
