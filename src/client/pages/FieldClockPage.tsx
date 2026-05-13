// Phase 75 - Field Clock Page (MOB-08)
// Route: /projects/:projectId/field
// Mobile-optimized clock-in/clock-out page for field workers.
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Camera, Clock3, MapPin, PencilLine } from 'lucide-react';
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

function dateTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function timeInputValue(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function FieldClockPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [editingPunchId, setEditingPunchId] = useState<string | null>(null);
  const [editPunchType, setEditPunchType] = useState<'in' | 'out'>('in');
  const [editTime, setEditTime] = useState('08:00');
  const [manualWorkerId, setManualWorkerId] = useState('');
  const [manualPunchType, setManualPunchType] = useState<'in' | 'out'>('in');
  const [manualTime, setManualTime] = useState('08:00');
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionBusy, setCorrectionBusy] = useState(false);

  const { data: weekListData } = useQuery({
    queryKey: ['payroll-weeks', projectId],
    queryFn: () =>
      api.get<{ weeks: Array<{ id: string; weekEndingDate: string; submittedAt: string | null }> }>(
        `/payroll/weeks?projectId=${projectId}`,
      ),
    enabled: !!projectId,
  });

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

  const { data: punchesData, isLoading: punchesLoading } = useQuery({
    queryKey: ['time-punches', projectId, selectedDate],
    queryFn: () =>
      api.get<{ data: { punches: TimePunch[] } }>(
        `/time-punches?projectId=${projectId}&weekStart=${selectedDate}&weekEnd=${selectedDate}`,
      ),
    enabled: !!projectId,
  });

  const project = projectData?.data?.project;
  const workers = (workersData?.data?.workers ?? []).filter((w) => w.isActive);
  const punches = punchesData?.data?.punches ?? [];
  const sortedPunches = [...punches].sort((a, b) => new Date(b.punchedAt).getTime() - new Date(a.punchedAt).getTime());
  const latestPunch = sortedPunches[0] ?? null;
  const inPunches = punches.filter((punch) => punch.punchType === 'in').length;
  const outPunches = punches.filter((punch) => punch.punchType === 'out').length;

  const isLoading = projectLoading || workersLoading;

  function handlePunchSuccess(_punch: TimePunch) {
    queryClient.invalidateQueries({ queryKey: ['time-punches', projectId, selectedDate] });
  }

  async function savePunchCorrection(punchId: string) {
    setCorrectionError(null);
    setCorrectionBusy(true);
    try {
      await api.patch(`/time-punches/${punchId}`, {
        punchType: editPunchType,
        punchedAt: dateTimeToIso(selectedDate, editTime),
      });
      setEditingPunchId(null);
      queryClient.invalidateQueries({ queryKey: ['time-punches', projectId, selectedDate] });
    } catch (err) {
      setCorrectionError(err instanceof Error ? err.message : 'Failed to save punch correction');
    } finally {
      setCorrectionBusy(false);
    }
  }

  async function addManualPunch() {
    setCorrectionError(null);
    if (!manualWorkerId) {
      setCorrectionError('Select a worker before adding a missed punch.');
      return;
    }
    setCorrectionBusy(true);
    try {
      await api.post('/time-punches', {
        projectId,
        workerId: manualWorkerId,
        punchType: manualPunchType,
        punchedAt: dateTimeToIso(selectedDate, manualTime),
      });
      setManualTime(manualPunchType === 'in' ? '17:00' : '08:00');
      setManualPunchType((current) => current === 'in' ? 'out' : 'in');
      queryClient.invalidateQueries({ queryKey: ['time-punches', projectId, selectedDate] });
    } catch (err) {
      setCorrectionError(err instanceof Error ? err.message : 'Failed to add missed punch');
    } finally {
      setCorrectionBusy(false);
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <p className="mt-8 text-center text-gray-500">Project not found.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl pb-10">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-gold">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Field Clock
            </p>
            <h1 className="mt-1 font-headline text-2xl font-bold text-gray-950">{project.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{formatDate(selectedDate)}</p>
          </div>
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex min-h-10 items-center text-xs font-semibold text-gray-500 transition-colors hover:text-brand-gold"
          >
            Back to project
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
          <div className="space-y-5">
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-headline text-base font-semibold text-gray-950">Clock In / Out</h2>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Select the worker, confirm status, then record the punch.</p>
                </div>
                <span className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-600">
                  {workers.length} active
                </span>
              </div>
              {workers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  <p>No active workers on this project.</p>
                  <Link
                    to={`/projects/${projectId}/workers`}
                    className="mt-2 inline-block font-semibold text-brand-gold hover:underline"
                  >
                    Add workers
                  </Link>
                </div>
              ) : (
                <GpsClockIn
                  project={project}
                  workers={workers}
                  onSuccess={handlePunchSuccess}
                />
              )}
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                <h2 className="font-headline text-base font-semibold text-gray-950">Work Date</h2>
              </div>
              <input
                id="field-clock-date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setEditingPunchId(null);
                  setCorrectionError(null);
                }}
                className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-gold"
              />
            </section>

            <details className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-amber-950">Admin correction</span>
                  <span className="mt-1 block text-xs leading-5 text-amber-800">Add or edit a missed punch when needed.</span>
                </span>
                <PencilLine className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-2">
                <select
                  value={manualWorkerId}
                  onChange={(e) => setManualWorkerId(e.target.value)}
                  className="w-full rounded border border-amber-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-gold"
                >
                  <option value="">Select worker</option>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>{worker.name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={manualPunchType}
                    onChange={(e) => setManualPunchType(e.target.value as 'in' | 'out')}
                    className="w-full rounded border border-amber-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  >
                    <option value="in">Clock in</option>
                    <option value="out">Clock out</option>
                  </select>
                  <input
                    type="time"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    className="w-full rounded border border-amber-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  />
                </div>
                <button
                  type="button"
                  onClick={addManualPunch}
                  disabled={correctionBusy}
                  className="rounded bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-50"
                >
                  Add missed punch
                </button>
              </div>
              {correctionError && <p className="mt-2 text-xs text-red-600">{correctionError}</p>}
            </details>
          </div>

          <div className="space-y-5">
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                    <h2 className="font-headline text-base font-semibold text-gray-950">Today's Activity</h2>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{formatDate(selectedDate)}</p>
                </div>
                <span className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-600">
                  {punches.length} punches
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">In</p>
                  <p className="mt-1 text-lg font-semibold text-gray-950">{inPunches}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Out</p>
                  <p className="mt-1 text-lg font-semibold text-gray-950">{outPunches}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Latest</p>
                  <p className="mt-1 text-sm font-semibold text-gray-950">{latestPunch ? formatTime(latestPunch.punchedAt) : 'None'}</p>
                </div>
              </div>

              <div className="mt-4">
                {punchesLoading ? (
                  <p className="rounded border border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-400">Loading punches...</p>
                ) : sortedPunches.length === 0 ? (
                  <p className="rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-8 text-center text-sm text-gray-400">No punches recorded for this date.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded border border-gray-200">
                    {sortedPunches.map((punch) => {
                      const worker = workers.find((w) => w.id === punch.workerId);
                      const acc = punch.accuracyMeters;
                      const ringColor = acc == null
                        ? 'bg-gray-300'
                        : acc <= 50
                        ? 'bg-green-500'
                        : acc <= 500
                        ? 'bg-amber-400'
                        : 'bg-red-500';

                      return (
                        <li key={punch.id} className="bg-white px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${ringColor}`}
                                  title={acc != null ? `GPS accuracy: ${Math.round(acc)}m` : 'No GPS data'}
                                  aria-hidden="true"
                                />
                                <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                                  punch.punchType === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {punch.punchType === 'in' ? 'IN' : 'OUT'}
                                </span>
                                <span className="truncate text-sm font-semibold text-gray-950">
                                  {worker?.name ?? punch.workerId}
                                </span>
                              </div>
                              {acc != null && (
                                <p className="mt-1 pl-4 text-xs text-gray-400">GPS accuracy {Math.round(acc)}m</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-gray-950">{formatTime(punch.punchedAt)}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPunchId(punch.id);
                                  setEditPunchType(punch.punchType);
                                  setEditTime(timeInputValue(punch.punchedAt));
                                  setCorrectionError(null);
                                }}
                                className="mt-1 text-xs font-semibold text-brand-navy hover:underline"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                          {editingPunchId === punch.id && (
                            <div className="mt-3 space-y-2 rounded border border-gray-200 bg-gray-50 p-2">
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  value={editPunchType}
                                  onChange={(e) => setEditPunchType(e.target.value as 'in' | 'out')}
                                  className="rounded border border-gray-300 px-2 py-2 text-base"
                                >
                                  <option value="in">Clock in</option>
                                  <option value="out">Clock out</option>
                                </select>
                                <input
                                  type="time"
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="rounded border border-gray-300 px-2 py-2 text-base"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => savePunchCorrection(punch.id)}
                                  disabled={correctionBusy}
                                  className="rounded bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  Save correction
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPunchId(null)}
                                  className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            {currentWeekId && projectId && (
              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                  <h2 className="font-headline text-base font-semibold text-gray-950">Job-Site Photos</h2>
                </div>
                <PhotoCapture
                  projectId={projectId}
                  weekId={currentWeekId}
                />
              </section>
            )}

            <div className="text-center">
              <Link
                to={`/projects/${projectId}/settings`}
                className="text-xs text-gray-400 transition-colors hover:text-brand-gold"
              >
                GPS Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
