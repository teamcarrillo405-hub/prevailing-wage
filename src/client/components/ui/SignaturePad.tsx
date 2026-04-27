// Phase 96 — Contractor digital signature capture component (MOB-19)
// Pure HTML5 canvas, no external library.
import { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from './Card';
import { Button } from './Button';
import { useToast } from '../../contexts/ToastContext';

interface SignaturePadProps {
  projectId: string;
}

interface SigRecord {
  id: string;
  projectId: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
  dataUrl: string;
}

export function SignaturePad({ projectId }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sigData, isLoading } = useQuery({
    queryKey: ['signature', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/signature`, { credentials: 'include' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to load signature');
      const json = await res.json() as { data: { signature: SigRecord } };
      return json.data.signature;
    },
    retry: false,
  });

  // Canvas drawing helpers
  function getCtx() {
    return canvasRef.current?.getContext('2d') ?? null;
  }

  function getPos(e: MouseEvent | Touch, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  const startDraw = useCallback((x: number, y: number) => {
    const ctx = getCtx();
    if (!ctx) return;
    isDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsEmpty(false);
  }, []);

  const draw = useCallback((x: number, y: number) => {
    if (!isDrawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  }, []);

  const stopDraw = useCallback(() => {
    isDrawing.current = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    // Mouse events
    function onMouseDown(e: MouseEvent) {
      const pos = getPos(e, canvas!);
      startDraw(pos.x, pos.y);
    }
    function onMouseMove(e: MouseEvent) {
      const pos = getPos(e, canvas!);
      draw(pos.x, pos.y);
    }
    function onMouseUp() { stopDraw(); }

    // Touch events
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const pos = getPos(e.touches[0], canvas!);
      startDraw(pos.x, pos.y);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const pos = getPos(e.touches[0], canvas!);
      draw(pos.x, pos.y);
    }
    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      stopDraw();
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [startDraw, draw, stopDraw]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }

  async function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to create image blob');
      const formData = new FormData();
      formData.append('signature', blob, 'signature.png');
      const res = await fetch(`/api/projects/${projectId}/signature`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to save signature');
      await queryClient.invalidateQueries({ queryKey: ['signature', projectId] });
      toast.success('Signature saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save signature');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeSignature() {
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/signature`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove signature');
      await queryClient.invalidateQueries({ queryKey: ['signature', projectId] });
      clearCanvas();
      toast.success('Signature removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove signature');
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <Card>
      <h3 className="font-headline text-base text-gray-900 mb-4">Contractor Signature</h3>

      <p className="text-xs text-text-secondary mb-2">Sign here</p>
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        className="w-full border border-border-default rounded bg-white touch-none"
        style={{ height: '160px' }}
        aria-label="Signature pad"
      />

      <div className="flex gap-2 mt-3">
        <Button variant="secondary" onClick={clearCanvas} disabled={isSaving}>
          Clear
        </Button>
        <Button
          onClick={saveSignature}
          disabled={isEmpty || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Signature'}
        </Button>
      </div>

      {isLoading && (
        <p className="text-xs text-text-secondary mt-4">Loading saved signature...</p>
      )}

      {sigData && (
        <div className="mt-4 border-t border-border-default pt-4">
          <p className="text-xs text-text-secondary mb-2">Saved signature:</p>
          <img
            src={sigData.dataUrl}
            alt="Saved contractor signature"
            className="max-w-full border border-border-default rounded bg-white"
            style={{ height: '80px' }}
          />
          <div className="mt-2">
            <Button variant="secondary" onClick={removeSignature} disabled={isRemoving}>
              {isRemoving ? 'Removing...' : 'Remove Signature'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
