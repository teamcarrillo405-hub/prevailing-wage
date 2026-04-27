// Phase 96 — Project-level site photo gallery (MOB-20)
// Camera upload with inline EXIF GPS extraction (no external library).
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from './Card';
import { Button } from './Button';
import { useToast } from '../../contexts/ToastContext';

interface PhotoGalleryProps {
  projectId: string;
}

interface ProjectPhoto {
  id: string;
  projectId: string;
  filePath: string;
  caption: string | null;
  takenAt: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  dataUrl?: string;
}

// ── Inline EXIF GPS extractor (no external library) ──────────────────────────
function extractExifGps(file: File): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
      resolve({ lat: null, lng: null });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target!.result as ArrayBuffer;
        const view = new DataView(buf);
        if (view.getUint16(0) !== 0xffd8) {
          resolve({ lat: null, lng: null });
          return;
        }
        let offset = 2;
        while (offset < buf.byteLength - 4) {
          const marker = view.getUint16(offset);
          if (marker === 0xffe1) {
            // APP1 — EXIF
            const exifOffset = offset + 10; // skip marker + length + "Exif\0\0"
            const littleEndian = view.getUint16(exifOffset) === 0x4949;
            const ifdOffset = exifOffset + view.getUint32(exifOffset + 4, littleEndian);
            const ifdCount = view.getUint16(ifdOffset, littleEndian);
            let gpsIfdOffset: number | null = null;
            for (let i = 0; i < ifdCount; i++) {
              const tag = view.getUint16(ifdOffset + 2 + i * 12, littleEndian);
              if (tag === 0x8825) {
                gpsIfdOffset =
                  exifOffset + view.getUint32(ifdOffset + 2 + i * 12 + 8, littleEndian);
              }
            }
            if (gpsIfdOffset == null) {
              resolve({ lat: null, lng: null });
              return;
            }
            const gpsCount = view.getUint16(gpsIfdOffset, littleEndian);
            let latDms: number[] | null = null;
            let lngDms: number[] | null = null;
            let latRef = 'N';
            let lngRef = 'E';
            for (let i = 0; i < gpsCount; i++) {
              const entryOff = gpsIfdOffset + 2 + i * 12;
              const tag = view.getUint16(entryOff, littleEndian);
              if (tag === 0x0001) latRef = String.fromCharCode(view.getUint8(entryOff + 8));
              if (tag === 0x0003) lngRef = String.fromCharCode(view.getUint8(entryOff + 8));
              if (tag === 0x0002 || tag === 0x0004) {
                const valOffset =
                  exifOffset + view.getUint32(entryOff + 8, littleEndian);
                const dms = [0, 1, 2].map(
                  (j) =>
                    view.getUint32(valOffset + j * 8, littleEndian) /
                    view.getUint32(valOffset + j * 8 + 4, littleEndian),
                );
                if (tag === 0x0002) latDms = dms;
                else lngDms = dms;
              }
            }
            if (!latDms || !lngDms) {
              resolve({ lat: null, lng: null });
              return;
            }
            const toDecimal = (dms: number[]) => dms[0] + dms[1] / 60 + dms[2] / 3600;
            resolve({
              lat: latRef === 'S' ? -toDecimal(latDms) : toDecimal(latDms),
              lng: lngRef === 'W' ? -toDecimal(lngDms) : toDecimal(lngDms),
            });
            return;
          }
          offset += 2 + view.getUint16(offset + 2);
        }
        resolve({ lat: null, lng: null });
      } catch {
        resolve({ lat: null, lng: null });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function PhotoGallery({ projectId }: PhotoGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['project-photos', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/photos`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load photos');
      const json = await res.json() as { data: { photos: ProjectPhoto[] } };
      return json.data.photos;
    },
  });

  const photos = data ?? [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { lat, lng } = await extractExifGps(file);
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('takenAt', new Date().toISOString());
      if (lat !== null) formData.append('latitude', lat.toString());
      if (lng !== null) formData.append('longitude', lng.toString());

      const res = await fetch(`/api/projects/${projectId}/photos`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Upload failed');
      await queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      toast.success('Photo uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(photoId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove photo');
      await queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      toast.success('Photo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove photo');
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline text-base text-gray-900">Site Photos</h3>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload Site Photo'}
        </Button>
      </div>

      {/* Hidden file input with camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Upload site photo"
      />

      {isLoading && (
        <p className="text-sm text-text-secondary">Loading photos...</p>
      )}

      {!isLoading && photos.length === 0 && (
        <p className="text-sm text-text-secondary">
          No site photos yet. Upload from your phone camera.
        </p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="flex flex-col gap-1">
              <img
                src={photo.dataUrl ?? ''}
                alt={photo.caption ?? 'Site photo'}
                className="w-full h-24 object-cover rounded border border-border-default"
              />
              {photo.latitude !== null && photo.longitude !== null && (
                <p className="text-xs text-text-secondary">
                  {photo.latitude.toFixed(4)}, {photo.longitude.toFixed(4)}
                </p>
              )}
              {photo.caption && (
                <p className="text-xs text-text-primary">{photo.caption}</p>
              )}
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                className="text-xs text-red-600 hover:underline text-left"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
