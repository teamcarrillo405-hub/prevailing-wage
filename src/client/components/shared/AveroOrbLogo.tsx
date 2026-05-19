import { useEffect, useRef } from 'react';

interface Props {
  size?: number;
}

export function AveroOrbLogo({ size = 40 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.38;       // cluster radius
    const br = size * 0.048;     // ball radius
    const N = 60;

    // Fibonacci sphere positions
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const restPos: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const t = goldenAngle * i;
      restPos.push({ x: R * r * Math.cos(t), y: R * y, z: R * r * Math.sin(t) });
    }

    // State
    const pos = restPos.map(p => ({ ...p }));
    const vel = restPos.map(() => ({ x: 0, y: 0, z: 0 }));
    const phase = new Float32Array(N);

    const COLORS = ['#B85042', '#D17A52', '#F5C518', '#ffffff'];

    let rotY = 0;
    let lastT = 0;

    function lerpColor(a: string, b: string, t: number) {
      const pa = parseInt(a.slice(1), 16);
      const pb = parseInt(b.slice(1), 16);
      const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
      const br2 = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
      const r = Math.round(ar + (br2 - ar) * t);
      const g = Math.round(ag + (bg - ag) * t);
      const b2 = Math.round(ab + (bb - ab) * t);
      return `rgb(${r},${g},${b2})`;
    }

    function draw(ts: number) {
      const dt = Math.min((ts - lastT) / 16.67, 3);
      lastT = ts;
      rotY += 0.008 * dt;

      ctx.clearRect(0, 0, size, size);

      // Sort back-to-front by z for painter's algorithm
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

      const projected = pos.map((p, i) => {
        // rotate around Y axis
        const rx = p.x * cosY - p.z * sinY;
        const rz = p.x * sinY + p.z * cosY;
        const ry = p.y;
        const scale = 1 + rz / (R * 2.5);
        return { sx: cx + rx * scale, sy: cy - ry * scale, z: rz, i, scale };
      });

      projected.sort((a, b) => a.z - b.z);

      // Mouse influence
      const mx = mouseRef.current.active ? mouseRef.current.x - cx : -9999;
      const my = mouseRef.current.active ? mouseRef.current.y - cy : -9999;

      for (let idx = 0; idx < N; idx++) {
        const { i } = projected[idx];
        const p = pos[i];
        const v = vel[i];

        // Mouse push (in unrotated space)
        const cosNY = Math.cos(-rotY), sinNY = Math.sin(-rotY);
        const lmx = mx * cosNY - 0 * sinNY;
        const lmy = my;
        const dist = Math.sqrt((p.x - lmx) ** 2 + (p.y - lmy) ** 2);
        if (dist < R * 0.6 && mouseRef.current.active) {
          const str = (1 - dist / (R * 0.6)) * 0.12;
          const nx = dist > 0.01 ? (p.x - lmx) / dist : 1;
          const ny2 = dist > 0.01 ? (p.y - lmy) / dist : 0;
          v.x += nx * str;
          v.y += ny2 * str;
          phase[i] = Math.min(phase[i] + str * 6, COLORS.length - 1);
        }

        // Spring back
        v.x += (restPos[i].x - p.x) * 0.06 * dt;
        v.y += (restPos[i].y - p.y) * 0.06 * dt;
        v.z += (restPos[i].z - p.z) * 0.06 * dt;
        v.x *= 0.85; v.y *= 0.85; v.z *= 0.85;
        p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
        phase[i] = Math.max(0, phase[i] - 0.025 * dt);
      }

      // Draw
      for (const { sx, sy, z, i, scale } of projected) {
        const cp = phase[i];
        const from = Math.floor(cp) % COLORS.length;
        const to = (from + 1) % COLORS.length;
        const color = lerpColor(COLORS[from], COLORS[to], cp - from);

        // depth-based brightness
        const depth = (z + R) / (R * 2);
        const ballR = br * (0.7 + depth * 0.5) * scale;
        const alpha = 0.45 + depth * 0.55;

        const grad = ctx.createRadialGradient(sx - ballR * 0.3, sy - ballR * 0.3, 0, sx, sy, ballR);
        grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.6})`);
        grad.addColorStop(0.3, color);
        grad.addColorStop(1, `rgba(0,0,0,${alpha * 0.3})`);

        ctx.beginPath();
        ctx.arc(sx, sy, ballR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame((ts) => { lastT = ts; rafRef.current = requestAnimationFrame(draw); });

    return () => cancelAnimationFrame(rafRef.current);
  }, [size]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, cursor: 'default', display: 'block' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { mouseRef.current.active = false; }}
    />
  );
}
