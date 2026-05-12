// Phase 75 — Field Clock Page (MOB-08)
// Route: /projects/:projectId/field
// Mobile-optimized clock-in/clock-out page for field workers.
import { useState } from 'react';
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

  // Selected day's punches
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
          <p className="text-sm text-gray-500">Field Clock — {formatDate(selectedDate)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <label htmlFor="field-clock-date" className="block text-xs font-semibold text-gray-600 mb-1">
            Work date
          </label>
          <input
            id="field-clock-date"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setEditingPunchId(null);
              setCorrectionError(null);
            }}
            className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
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

        {/* Selected day's punches list */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h2 className="font-headline text-base font-semibold text-gray-900 mb-3">
            Punches for {formatDate(selectedDate)}
          </h2>
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">Admin correction</p>
            <p className="mt-1 text-xs text-amber-800">
              Use this when someone forgot to clock in/out or selected the wrong time. Corrections use the work date above.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
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
          </div>
          {punchesLoading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : punches.length === 0 ? (
            <p className="text-sm text-gray-400">No punches recorded for this date.</p>
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
                    className={`text-sm px-2 py-3 min-h-[56px] rounded-lg border ${
                      punch.punchType === 'in'
                        ? 'border-green-100 bg-green-50 text-green-700'
                        : 'border-red-100 bg-red-50 text-red-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
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
                      <div className="text-right">
                        <span className="text-gray-500 text-xs">
                          {formatTime(punch.punchedAt)}
                          {acc != null && (
                            <span className="block text-gray-400">
                              {Math.round(acc)}m
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPunchId(punch.id);
                            setEditPunchType(punch.punchType);
                            setEditTime(timeInputValue(punch.punchedAt));
                            setCorrectionError(null);
                          }}
                          className="mt-1 block text-xs font-semibold text-brand-navy hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                    {editingPunchId === punch.id && (
                      <div className="mt-3 space-y-2 rounded border border-gray-200 bg-white/80 p-2">
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
