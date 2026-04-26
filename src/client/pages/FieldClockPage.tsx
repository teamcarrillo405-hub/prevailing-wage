// Phase 75 — Field Clock Page (MOB-08)
// Route: /projects/:projectId/field
// Mobile-optimized clock-in/clock-out page for field workers.
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { GpsClockIn } from '../components/field/GpsClockIn';
import type { TimePunch } from '../components/field/GpsClockIn';
import { PhotoCapture } from '../components/field/PhotoCapture';

interface Project {
  id: string;
  name: string;
  gpsClockInEnabled: boolean;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsRadiusMeters: number | null;
}

interface Worker {
  id: string;
  name: string;
  isActive: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function FieldClockPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  // Fetch the most recent non-submitted payroll week for this project (for photo linking)
  const { data: weekListData } = useQuery({
    queryKey: ['payroll-weeks', projectId],
    queryFn: () =>
      api.get<{ weeks: Array<{ id: string; weekEndingDate: string; submittedAt: string | null }> }>(
        `/payroll/weeks?projectId=${projectId}`,
      ),
    enabled: !!projectId,
  });
  // Use the most recent open (non-submitted) week, or the latest week if all submitted
  const currentWeekId = (() => {
    const weeks = weekListData?.weeks ?? [];
    const open = weeks.filter((w) => !w.submittedAt);
    if (open.length > 0) return open[open.length - 1].id;
    if (weeks.length > 0) return weeks[weeks.length - 1].id;
    return null;
  })();

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<{ data: { project: Project } }>(`/projects/${projectId}`),
    enabled: !!projectId,
  });

  const { data: workersData, isLoading: workersLoading } = useQuery({
    queryKey: ['workers', projectId],
    queryFn: () => api.get<{ data: { workers: Worker[] } }>(`/projects/${projectId}/workers`),
    enabled: !!projectId,
  });

  // Today's punches
  const today = new Date().toISOString().slice(0, 10);
  const { data: punchesData, isLoading: punchesLoading } = useQuery({
    queryKey: ['time-punches', projectId, today],
    queryFn: () =>
      api.get<{ data: { punches: TimePunch[] } }>(
        `/time-punches?projectId=${projectId}&weekStart=${today}&weekEnd=${today}`,
      ),
    enabled: !!projectId,
  });

  const project = projectData?.data?.project;
  const workers = (workersData?.data?.workers ?? []).filter((w) => w.isActive);
  const punches = punchesData?.data?.punches ?? [];

  const isLoading = projectLoading || workersLoading;

  function handlePunchSuccess(_punch: TimePunch) {
    queryClient.invalidateQueries({ queryKey: ['time-punches', projectId, today] });
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-64">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <p className="text-center text-gray-500 mt-8">Project not found.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Single-column max-w-sm intentional — field use on phone portrait.
          Landscape orientation: content scrolls vertically; no layout change needed.
          landscape: {} — no breakpoint override; portrait layout stays correct in landscape
          because max-w-sm centers nicely at any viewport width. */}
      <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex items-center min-h-[44px] text-xs text-gray-500 hover:text-brand-gold transition-colors"
          >
            &larr; Back to project
          </Link>
          <h1 className="font-headline text-xl font-bold text-brand-navy mt-1">{project.name}</h1>
          <p className="text-sm text-gray-500">Field Clock — {formatDate(new Date().toISOString())}</p>
        </div>

        {/* Clock-in component */}
        {workers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No active workers on this project.</p>
            <Link
              to={`/projects/${projectId}/workers`}
              className="text-brand-gold hover:underline mt-2 inline-block"
            >
              Add workers
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h2 className="font-headline text-base font-semibold text-gray-900 mb-3">Clock In / Out</h2>
            <GpsClockIn
              project={project}
              workers={workers}
              onSuccess={handlePunchSuccess}
            />
          </div>
        )}

        {/* Today's punches list */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h2 className="font-headline text-base font-semibold text-gray-900 mb-3">
            Today&apos;s Punches
          </h2>
          {punchesLoading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : punches.length === 0 ? (
            <p className="text-sm text-gray-400">No punches recorded today.</p>
          ) : (
            <ul className="space-y-1">
              {punches.map((punch) => {
                const worker = workers.find((w) => w.id === punch.workerId);
                // MOB-14: GPS accuracy ring color
                const acc = punch.accuracyMeters;
                const ringColor = acc == null
                  ? 'bg-gray-300'
                  : acc <= 50
                  ? 'bg-green-500'
                  : acc <= 500
                  ? 'bg-amber-400'
                  : 'bg-red-500';

                return (
                  <li
                    key={punch.id}
                    className={`flex items-center justify-between text-sm px-2 py-3 min-h-[56px] rounded-lg border ${
                      punch.punchType === 'in'
                        ? 'border-green-100 bg-green-50 text-green-700'
                        : 'border-red-100 bg-red-50 text-red-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* MOB-14: GPS accuracy ring */}
                      <span
                        className={`w-3 h-3 rounded-full shrink-0 ${ringColor}`}
                        title={acc != null ? `GPS accuracy: ${Math.round(acc)}m` : 'No GPS data'}
                        aria-hidden="true"
                      />
                      <span className="font-semibold">
                        {punch.punchType === 'in' ? 'IN' : 'OUT'}
                      </span>
                      <span className="font-normal text-gray-700">
                        {worker?.name ?? punch.workerId}
                      </span>
                    </div>
                    <span className="text-gray-500 text-xs text-right">
                      {formatTime(punch.punchedAt)}
                      {acc != null && (
                        <span className="block text-gray-400">
                          {Math.round(acc)}m
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Photo capture section — shown when an open payroll week exists */}
        {currentWeekId && projectId && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h2 className="font-headline text-base font-semibold text-gray-900 mb-3">
              Job-Site Photos
            </h2>
            <PhotoCapture
              projectId={projectId}
              weekId={currentWeekId}
            />
          </div>
        )}

        {/* Link to settings */}
        <div className="text-center">
          <Link
            to={`/projects/${projectId}/settings`}
            className="text-xs text-gray-400 hover:text-brand-gold transition-colors"
          >
            GPS Settings
          </Link>
        </div>
      </div>
    </Layout>
  );
}
