// src/client/pages/FieldHubPage.tsx
// Route: /field
// Hub page listing all projects with direct "Clock In" links to field clock.
// Includes PWA install banner when available (Gap 1 — Mobile/Field Discoverability).

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Wifi, WifiOff, Download } from 'lucide-react';
import { api } from '../lib/api';
import { Layout } from '../components/shared/Layout';
import { SkeletonGrid } from '../components/ui/SkeletonCard';
import { usePwaInstall } from '../hooks/usePwaInstall';

interface Project {
  id: string;
  name: string;
  state: string;
  county: string;
  status: string;
  gpsClockInEnabled: boolean;
}

function getCurrentWeekLabel(): string {
  const now = new Date();
  // Find the Friday of this week
  const day = now.getDay(); // 0=Sun, 5=Fri
  const daysToFriday = (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + daysToFriday);
  const monday = new Date(friday);
  monday.setDate(friday.getDate() - 4);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(friday)}`;
}

export function FieldHubPage() {
  const { canInstall, isIos, isDismissed, promptInstall, dismiss } = usePwaInstall();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', 'active'],
    queryFn: () => api.get<{ data: { projects: Project[] } }>('/projects'),
  });

  const projects = (data?.data?.projects ?? []).filter(p => p.status !== 'archived');
  const currentWeek = getCurrentWeekLabel();

  const showInstallBanner = !isDismissed && (canInstall || isIos);

  return (
    <Layout>
      {/* PWA install banner */}
      {showInstallBanner && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              {isIos
                ? 'Install PrevWage on your device for the best field experience — tap Share then "Add to Home Screen"'
                : 'Install PrevWage on your device for the best field experience'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isIos && (
              <button
                onClick={promptInstall}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors min-h-[36px]"
              >
                Install
              </button>
            )}
            <button
              onClick={dismiss}
              className="text-xs text-amber-600 hover:text-amber-800 transition-colors min-h-[36px] px-2"
              aria-label="Dismiss install banner"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-headline text-3xl font-bold text-gray-900">Field Clock</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select a project to clock workers in or out from the job site.
        </p>
      </div>

      {isLoading && <SkeletonGrid count={4} />}

      {isError && (
        <p className="text-center text-sm text-red-600 py-12">
          Failed to load projects. Please refresh.
        </p>
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <p className="text-gray-500 text-sm mb-4">
            Create a project to start field time tracking.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-brand-gold/90 transition-colors min-h-[44px]"
          >
            Go to Projects
          </Link>
        </div>
      )}

      {!isLoading && !isError && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map(project => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4"
            >
              {/* Project name + state */}
              <div>
                <h2 className="font-semibold text-gray-900 text-base leading-snug">
                  {project.name}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {project.county ? `${project.county}, ` : ''}{project.state}
                </p>
              </div>

              {/* Current week label */}
              <p className="text-xs text-gray-400">
                Week: <span className="text-gray-600 font-medium">{currentWeek}</span>
              </p>

              {/* GPS badge */}
              <div className="flex items-center gap-1.5">
                {project.gpsClockInEnabled ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-600">GPS Enabled</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400">GPS Disabled</span>
                  </>
                )}
              </div>

              {/* Clock In CTA */}
              <Link
                to={`/projects/${project.id}/field`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gold px-4 py-3 text-sm font-semibold text-black hover:bg-brand-gold/90 transition-colors min-h-[44px] mt-auto"
              >
                <MapPin className="h-4 w-4" />
                Clock In
              </Link>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
