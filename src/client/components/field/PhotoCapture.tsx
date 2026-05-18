// Phase 76 — Field Photo Capture (MOB-09)
// Camera capture + file upload for job-site photos linked to a payroll week.
import { useRef, useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface WeekPhoto {
  id: string;
  projectId: string;
  payrollWeekId: string;
  uploadedBy: string;
  filePath: string;
  caption: string | null;
  takenAt: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

interface PhotoCaptureProps {
  projectId: string;
  weekId: string;
  onUploaded?: (photo: WeekPhoto) => void;
}

// Offline IDB store name
const OFFLINE_STORE = 'offline-photos';

async function getOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('prevailing-wage-offline', 2);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        db.createObjectStore(OFFLINE_STORE, { keyPath: 'localId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePhotoOffline(record: {
  localId: string;
  projectId: string;
  weekId: string;
  dataUrl: string;
  caption: string;
  takenAt: string;
}) {
  const db = await getOfflineDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function PhotoCapture({ projectId, weekId, onUploaded }: PhotoCaptureProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<'idle' | 'camera' | 'preview'>('idle');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // GPS coordinates captured at photo time
  const [capturedLat, setCapturedLat] = useState<number | null>(null);
  const [capturedLng, setCapturedLng] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'acquiring' | 'captured' | 'denied'>('idle');

  // Fetch existing photos for this week
  const { data: photosData, isLoading: photosLoading } = useQuery({
    queryKey: ['week-photos', projectId, weekId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/weeks/${weekId}/photos`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load photos');
      const body = await res.json() as { data: { photos: WeekPhoto[] } };
      return body.data.photos;
    },
  });

  const photos = photosData ?? [];

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // Start camera
  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode('camera');
    } catch {
      setError('Camera not available. Use "Choose File" to upload a photo.');
    }
  }

  // Stop camera stream
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  // Capture frame from video — also requests GPS coordinates
  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Reset location state and start acquiring
    setCapturedLat(null);
    setCapturedLng(null);
    setLocationStatus('acquiring');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCapturedLat(pos.coords.latitude);
          setCapturedLng(pos.coords.longitude);
          setLocationStatus('captured');
        },
        () => {
          setLocationStatus('denied');
        },
        { timeout: 8000, maximumAge: 30_000 },
      );
    } else {
      setLocationStatus('denied');
    }

    canvas.toBlob((blob) => {
      if (!blob) { setError('Failed to capture image'); return; }
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setCapturedUrl(url);
      stopCamera();
      setMode('preview');
    }, 'image/jpeg', 0.85);
  }

  // Cancel preview
  function cancelPreview() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setCaption('');
    setCapturedLat(null);
    setCapturedLng(null);
    setLocationStatus('idle');
    setMode('idle');
  }

  // Handle file input selection — also requests GPS coordinates
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCapturedBlob(file);
    setCapturedUrl(url);
    setMode('preview');
    // Reset input so same file can be re-selected
    e.target.value = '';

    // Acquire GPS on file pick (best effort)
    setCapturedLat(null);
    setCapturedLng(null);
    setLocationStatus('acquiring');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCapturedLat(pos.coords.latitude);
          setCapturedLng(pos.coords.longitude);
          setLocationStatus('captured');
        },
        () => { setLocationStatus('denied'); },
        { timeout: 8000, maximumAge: 30_000 },
      );
    } else {
      setLocationStatus('denied');
    }
  }

  // Upload the captured/chosen photo
  async function handleUpload() {
    if (!capturedBlob) return;
    setUploading(true);
    setError(null);

    const takenAt = new Date().toISOString();

    // Offline path
    if (!navigator.onLine) {
      const localId = crypto.randomUUID();
      const reader = new FileReader();
      reader.onload = async () => {
        await savePhotoOffline({
          localId,
          projectId,
          weekId,
          dataUrl: reader.result as string,
          caption,
          takenAt,
        });
        showToast('Photo saved offline. Will sync when online.');
        cancelPreview();
        setUploading(false);
      };
      reader.onerror = () => {
        setError('Failed to save photo offline');
        setUploading(false);
      };
      reader.readAsDataURL(capturedBlob);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('photo', capturedBlob, 'photo.jpg');
      if (caption.trim()) formData.append('caption', caption.trim());
      formData.append('takenAt', takenAt);
      if (capturedLat !== null) formData.append('latitude', String(capturedLat));
      if (capturedLng !== null) formData.append('longitude', String(capturedLng));

      const res = await fetch(`/api/projects/${projectId}/weeks/${weekId}/photos`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Upload failed: ${res.status}`);
      }

      const body = await res.json() as { data: { photo: WeekPhoto } };
      queryClient.invalidateQueries({ queryKey: ['week-photos', projectId, weekId] });
      onUploaded?.(body.data.photo);
      showToast('Photo uploaded successfully.');
      cancelPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  // Delete a photo
  async function handleDelete(photoId: string) {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    setDeletingId(photoId);
    try {
      const res = await fetch(`/api/projects/${projectId}/weeks/${weekId}/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete failed');
      queryClient.invalidateQueries({ queryKey: ['week-photos', projectId, weekId] });
    } catch {
      showToast('Failed to delete photo.');
    } finally {
      setDeletingId(null);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {toast && (
        <div className="rounded bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800">
          {toast}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Idle — show action buttons */}
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {'mediaDevices' in navigator && (
            <button
              onClick={startCamera}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-sm bg-brand-navy text-white text-sm font-semibold px-4 py-2 hover:bg-brand-navy/90 transition-colors"
            >
              Take Photo
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-gray-300 bg-white text-gray-700 text-sm font-semibold px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* Camera preview */}
      {mode === 'camera' && (
        <div className="space-y-3">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg border border-gray-200 bg-black max-h-72 object-contain"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <button
              onClick={captureFrame}
              className="min-h-[44px] flex-1 rounded-sm bg-brand-gold text-black text-sm font-semibold px-4 py-2 hover:bg-brand-gold/90 transition-colors"
            >
              Capture
            </button>
            <button
              onClick={() => { stopCamera(); setMode('idle'); }}
              className="min-h-[44px] rounded-sm border border-gray-300 text-gray-700 text-sm px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          {locationStatus === 'acquiring' && (
            <p className="text-xs text-gray-500">Acquiring location...</p>
          )}
          {locationStatus === 'captured' && (
            <p className="text-xs text-emerald-600">Location captured</p>
          )}
          {locationStatus === 'denied' && (
            <p className="text-xs text-amber-600">No location available</p>
          )}
        </div>
      )}

      {/* Preview captured photo before upload */}
      {mode === 'preview' && capturedUrl && (
        <div className="space-y-3">
          <img
            src={capturedUrl}
            alt="Preview"
            className="w-full rounded-lg border border-gray-200 max-h-72 object-contain bg-gray-100"
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Caption (optional)</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. West wall progress, Day 3"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-brand-gold focus:outline-none"
              maxLength={200}
            />
          </div>
          {locationStatus === 'acquiring' && (
            <p className="text-xs text-gray-500">Acquiring location...</p>
          )}
          {locationStatus === 'captured' && (
            <p className="text-xs text-emerald-600">
              Location captured ({capturedLat!.toFixed(5)}, {capturedLng!.toFixed(5)})
            </p>
          )}
          {locationStatus === 'denied' && (
            <p className="text-xs text-amber-600">No location — allow GPS for geotagged photos</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="min-h-[44px] flex-1 rounded-sm bg-brand-gold text-black text-sm font-semibold px-4 py-2 hover:bg-brand-gold/90 disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload Photo'}
            </button>
            <button
              onClick={cancelPreview}
              disabled={uploading}
              className="min-h-[44px] rounded-sm border border-gray-300 text-gray-700 text-sm px-4 py-2 hover:bg-gray-50"
            >
              Retake
            </button>
          </div>
        </div>
      )}

      {/* Thumbnail grid of existing photos */}
      {!photosLoading && photos.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} this week
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group rounded overflow-hidden border border-gray-200 aspect-square bg-gray-100">
                <img
                  src={`/api/photos/${photo.id}/file`}
                  alt={photo.caption ?? 'Job site photo'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {photo.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs px-1 py-0.5 truncate">
                    {photo.caption}
                  </div>
                )}
                <button
                  onClick={() => handleDelete(photo.id)}
                  disabled={deletingId === photo.id}
                  className="absolute right-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm bg-black/80 px-2 py-2 text-sm font-semibold text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 focus:opacity-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-gold"
                  title="Delete photo"
                  aria-label="Delete photo"
                >
                  {deletingId === photo.id ? '...' : 'X'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!photosLoading && photos.length === 0 && (
        <p className="text-xs text-gray-400">No photos yet for this week.</p>
      )}
    </div>
  );
}
