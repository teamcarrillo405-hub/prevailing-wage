// Phase 75 — GPS Clock-In / Clock-Out component (MOB-08 + MOB-09)
// CA AB 1355 compliant: location collected only for job site verification.
// GPS is opt-in per project. Clock-in is never hard-blocked on poor accuracy.
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { enqueueRequest } from '../../lib/offlineQueue';

export interface TimePunch {
  id: string;
  projectId: string;
  workerId: string;
  punchType: 'in' | 'out';
  punchedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  createdBy: string;
  createdAt: string;
}

interface GpsClockInProps {
  project: {
    id: string;
    gpsClockInEnabled: boolean;
    gpsLatitude?: number | null;
    gpsLongitude?: number | null;
    gpsRadiusMeters?: number | null;
  };
  workers: Array<{ id: string; name: string }>;
  onSuccess: (punch: TimePunch) => void;
}

interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

type GpsState =
  | { status: 'idle' }
  | { status: 'acquiring' }
  | { status: 'ok'; position: GpsPosition }
  | { status: 'poor'; position: GpsPosition }
  | { status: 'denied' }
  | { status: 'unavailable' };

const POOR_ACCURACY_THRESHOLD_M = 500;

function getDistanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function GpsClockIn({ project, workers, onSuccess }: GpsClockInProps) {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(
    workers.length === 1 ? workers[0].id : '',
  );
  const [gpsState, setGpsState] = useState<GpsState>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: openPunchData, isLoading: openPunchLoading } = useQuery({
    queryKey: ['time-punches-open', project.id, selectedWorkerId],
    queryFn: () =>
      api.get<{ data: { openPunch: TimePunch | null } }>(
        `/time-punches/open?projectId=${project.id}&workerId=${selectedWorkerId}`,
      ),
    enabled: !!selectedWorkerId,
  });

  const openPunch = openPunchData?.data?.openPunch ?? null;
  const isClockedIn = openPunch !== null;

  const punchMutation = useMutation({
    mutationFn: async (body: {
      projectId: string;
      workerId: string;
      punchType: 'in' | 'out';
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
    }) => {
      if (!navigator.onLine) {
        await enqueueRequest('/api/time-punches', 'POST', body);
        // Return a synthetic offline punch so the UI can update optimistically
        return {
          data: {
            punch: {
              id: crypto.randomUUID(),
              ...body,
              punchedAt: new Date().toISOString(),
              latitude: body.latitude ?? null,
              longitude: body.longitude ?? null,
              accuracyMeters: body.accuracyMeters ?? null,
              createdBy: '',
              createdAt: new Date().toISOString(),
            } satisfies TimePunch,
          },
        };
      }
      return api.post<{ data: { punch: TimePunch } }>('/time-punches', body);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['time-punches-open', project.id, selectedWorkerId] });
      queryClient.invalidateQueries({ queryKey: ['time-punches', project.id] });
      onSuccess(result.data.punch);
      setGpsState({ status: 'idle' });
    },
    onError: () => {
      setError('Failed to record punch. Please try again.');
    },
  });

  function acquireGps(): Promise<GpsPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
          });
        },
        (err) => {
          if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
            reject(new Error('denied'));
          } else {
            reject(new Error('unavailable'));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }

  async function handleClockAction() {
    if (!selectedWorkerId) {
      setError('Please select a worker.');
      return;
    }
    setError(null);
    const punchType: 'in' | 'out' = isClockedIn ? 'out' : 'in';

    if (!project.gpsClockInEnabled) {
      // No GPS — simple punch
      punchMutation.mutate({ projectId: project.id, workerId: selectedWorkerId, punchType });
      return;
    }

    // GPS enabled — acquire position
    setGpsState({ status: 'acquiring' });
    try {
      const position = await acquireGps();
      const isPoor = position.accuracyMeters > POOR_ACCURACY_THRESHOLD_M;
      setGpsState(isPoor ? { status: 'poor', position } : { status: 'ok', position });
    } catch (err: any) {
      if (err.message === 'denied') {
        setGpsState({ status: 'denied' });
      } else {
        setGpsState({ status: 'unavailable' });
      }
    }
  }

  function submitPunch(position?: GpsPosition) {
    const punchType: 'in' | 'out' = isClockedIn ? 'out' : 'in';
    punchMutation.mutate({
      projectId: project.id,
      workerId: selectedWorkerId,
      punchType,
      latitude: position?.latitude,
      longitude: position?.longitude,
      accuracyMeters: position?.accuracyMeters,
    });
  }

  function handleConfirmWithGps() {
    const pos =
      gpsState.status === 'ok' || gpsState.status === 'poor'
        ? gpsState.position
        : undefined;
    submitPunch(pos);
  }

  function handleProceedWithoutGps() {
    submitPunch();
    setGpsState({ status: 'idle' });
  }

  const workerName = workers.find((w) => w.id === selectedWorkerId)?.name ?? '';
  const isSubmitting = punchMutation.isPending;

  // Distance from job site (if site coords configured)
  let distanceWarning: string | null = null;
  if (
    project.gpsLatitude != null &&
    project.gpsLongitude != null &&
    project.gpsRadiusMeters != null &&
    (gpsState.status === 'ok' || gpsState.status === 'poor')
  ) {
    const dist = getDistanceMeters(
      project.gpsLatitude,
      project.gpsLongitude,
      gpsState.position.latitude,
      gpsState.position.longitude,
    );
    if (dist > project.gpsRadiusMeters) {
      distanceWarning = `You appear to be ${Math.round(dist)}m from the job site (radius: ${project.gpsRadiusMeters}m). Clock-in is still allowed.`;
    }
  }

  return (
    <div className="space-y-4">
      {/* CA AB 1355 disclosure — shown when GPS is enabled */}
      {project.gpsClockInEnabled && (
        <p className="text-xs text-gray-500 border border-gray-200 rounded p-2 bg-gray-50">
          Location is collected only for job site verification and is not used for continuous tracking.
        </p>
      )}

      {/* MOB-14: Worker selector — large tap-target, text-base prevents iOS zoom */}
      {workers.length > 1 && (
        <div>
          <label htmlFor="gps-clock-worker" className="block text-sm font-medium text-gray-700 mb-1">Worker</label>
          {/* Segmented control for ≤ 5 workers, select for more */}
          {workers.length <= 5 ? (
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(workers.length, 2)}, 1fr)` }}>
              {workers.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => { setSelectedWorkerId(w.id); setGpsState({ status: 'idle' }); setError(null); }}
                  className={`min-h-[52px] px-3 py-3 rounded-lg border text-sm font-medium transition-colors text-left truncate ${
                    selectedWorkerId === w.id
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-brand-gold'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          ) : (
            <select
              id="gps-clock-worker"
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base min-h-[52px] bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold"
              value={selectedWorkerId}
              onChange={(e) => {
                setSelectedWorkerId(e.target.value);
                setGpsState({ status: 'idle' });
                setError(null);
              }}
            >
              <option value="">Select worker...</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Current status indicator */}
      {selectedWorkerId && !openPunchLoading && (
        <div className={`text-sm font-medium px-3 py-2 rounded ${isClockedIn ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
          {workerName
            ? isClockedIn
              ? `${workerName} is clocked IN since ${new Date(openPunch!.punchedAt).toLocaleTimeString()}`
              : `${workerName} is clocked OUT`
            : isClockedIn
            ? 'Clocked IN'
            : 'Clocked OUT'}
        </div>
      )}

      {/* MOB-14: GPS accuracy colored ring indicator */}
      {gpsState.status === 'acquiring' && (
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {/* Amber pulsing ring — acquiring */}
          <span className="relative flex h-5 w-5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-500" />
          </span>
          Acquiring location...
        </div>
      )}

      {/* GPS ok — green ring + confirm */}
      {(gpsState.status === 'ok' || gpsState.status === 'poor') && (
        <div className="space-y-3">
          <div className={`text-sm rounded-lg p-3 border flex items-start gap-3 ${gpsState.status === 'poor' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
            {/* Colored ring */}
            <span className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 ${gpsState.status === 'poor' ? 'bg-amber-400 border-amber-600' : 'bg-green-400 border-green-600'}`} aria-hidden="true" />
            <div>
              <p className="font-medium">
                {gpsState.status === 'poor'
                  ? 'Poor GPS accuracy — location recorded with warning'
                  : 'Location acquired'}
              </p>
              <p className="text-xs mt-0.5">
                Accuracy: {Math.round(gpsState.position.accuracyMeters)}m
                {gpsState.status === 'poor' && ' — iOS/Android may report 3,000–9,000m indoors. You may still clock in.'}
              </p>
              {distanceWarning && (
                <p className="text-xs mt-1 text-amber-700">{distanceWarning}</p>
              )}
            </div>
          </div>
          {/* MOB-14: 60px confirm button */}
          <button
            className="w-full min-h-[60px] rounded-xl font-bold text-lg text-white bg-brand-navy hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
            onClick={handleConfirmWithGps}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Recording...'
              : `Confirm Clock ${isClockedIn ? 'Out' : 'In'}`}
          </button>
          <button
            className="w-full min-h-[44px] py-2 rounded-lg text-sm text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
            onClick={handleProceedWithoutGps}
            disabled={isSubmitting}
          >
            Proceed without location
          </button>
        </div>
      )}

      {/* GPS denied — red ring */}
      {gpsState.status === 'denied' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-red-500 border-2 border-red-700 shrink-0" aria-hidden="true" />
            <p className="text-sm text-amber-800">
              Location permission denied. You can still clock in without GPS.
            </p>
          </div>
          <button
            className="w-full min-h-[60px] rounded-xl font-bold text-lg text-white bg-brand-navy hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
            onClick={handleProceedWithoutGps}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Recording...' : `Clock ${isClockedIn ? 'Out' : 'In'} Without Location`}
          </button>
        </div>
      )}

      {/* GPS unavailable — gray ring */}
      {gpsState.status === 'unavailable' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-gray-400 border-2 border-gray-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-gray-600">
              Location unavailable. You can still clock in without GPS.
            </p>
          </div>
          <button
            className="w-full min-h-[60px] rounded-xl font-bold text-lg text-white bg-brand-navy hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
            onClick={handleProceedWithoutGps}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Recording...' : `Clock ${isClockedIn ? 'Out' : 'In'} Without Location`}
          </button>
        </div>
      )}

      {/* MOB-14: Primary clock-in/out button — 60px height, primary CTA */}
      {gpsState.status === 'idle' && selectedWorkerId && (
        <button
          className={`w-full min-h-[60px] rounded-xl font-bold text-xl tracking-wide transition-colors disabled:opacity-50 shadow-sm ${
            isClockedIn
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
          onClick={handleClockAction}
          disabled={isSubmitting || openPunchLoading || !selectedWorkerId}
        >
          {openPunchLoading
            ? 'Loading...'
            : isClockedIn
            ? 'Clock Out'
            : 'Clock In'}
        </button>
      )}

      {/* Offline indicator */}
      {typeof navigator !== 'undefined' && !navigator.onLine && (
        <p className="text-xs text-amber-600 text-center">
          Offline — punch will be submitted when connectivity is restored.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
