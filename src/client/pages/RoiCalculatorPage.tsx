import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

// ── Constants ─────────────────────────────────────────────────────────────────
const HOURS_PER_WORKER_PER_WEEK = 2.5;
const WEEKS_PER_YEAR = 52;
const HOURLY_RATE = 45;

const PROJECTS_MIN = 1;
const PROJECTS_MAX = 50;
const PROJECTS_DEFAULT = 5;
const WORKERS_MIN = 1;
const WORKERS_MAX = 200;
const WORKERS_DEFAULT = 20;

// ── Pure formula — exported for tests ─────────────────────────────────────────
export function calcRoi(projects: number, workers: number): { annualHours: number; annualSavings: number } {
  const annualHours = workers * HOURS_PER_WORKER_PER_WEEK * WEEKS_PER_YEAR;
  const annualSavings = annualHours * HOURLY_RATE;
  return { annualHours, annualSavings };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

type SubmitStatus = 'idle' | 'sending' | 'sent' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────
export function RoiCalculatorPage() {
  const [searchParams] = useSearchParams();

  const [projects, setProjects] = useState<number>(() => {
    const p = parseInt(searchParams.get('projects') ?? String(PROJECTS_DEFAULT), 10);
    return clamp(isNaN(p) ? PROJECTS_DEFAULT : p, PROJECTS_MIN, PROJECTS_MAX);
  });

  const [workers, setWorkers] = useState<number>(() => {
    const w = parseInt(searchParams.get('workers') ?? String(WORKERS_DEFAULT), 10);
    return clamp(isNaN(w) ? WORKERS_DEFAULT : w, WORKERS_MIN, WORKERS_MAX);
  });

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');

  const { annualHours, annualSavings } = calcRoi(projects, workers);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/roi-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          projectCount: projects,
          workerCount: workers,
          estimatedSavings: annualSavings,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  const isSubmitting = status === 'sending';
  const canSubmit = email.trim().length > 0 && !isSubmitting;

  return (
    <div className="min-h-screen bg-gray-50 font-body">
      {/* ── Hero banner ───────────────────────────────────────────────────── */}
      <section
        className="relative min-h-[40vh] flex flex-col items-center justify-center overflow-hidden"
        style={{ backgroundImage: 'linear-gradient(135deg, #1a2744 0%, #2d4a8a 50%, #1a3a5c 100%)' }}
      >
        <div className="absolute inset-0 bg-nav-dark/40" />

        {/* Floating nav */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5 z-10">
          <Link to="/" className="text-brand-gold font-headline text-xl font-bold tracking-wide">
            HCC Prevailing Wage
          </Link>
          <Link
            to="/login"
            className="text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            Log In
          </Link>
        </div>

        {/* Hero text */}
        <div className="relative z-10 text-center px-4 mt-16">
          <h1 className="font-headline text-white font-bold leading-tight mb-4"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
            Calculate Your ROI
          </h1>
          <p className="text-white/75 text-lg max-w-xl mx-auto">
            See exactly how much time and money you save on prevailing wage compliance
          </p>
        </div>
      </section>

      {/* ── Main card ─────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto -mt-16 relative z-10 px-4 pb-16">
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* Section: Your Project Profile */}
          <h2 className="font-headline text-nav-dark text-2xl font-bold mb-6">
            Your Project Profile
          </h2>

          {/* Projects slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="projects-slider" className="font-medium text-gray-700">
                Active Projects
              </label>
              <span className="bg-nav-dark text-white text-sm font-semibold px-3 py-1 rounded-full">
                {projects}
              </span>
            </div>
            <input
              id="projects-slider"
              type="range"
              min={PROJECTS_MIN}
              max={PROJECTS_MAX}
              value={projects}
              onChange={e => setProjects(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[theme(colors.brand.gold)]"
              style={{ accentColor: '#F5C518' }}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{PROJECTS_MIN}</span>
              <span>{PROJECTS_MAX}</span>
            </div>
          </div>

          {/* Workers slider */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="workers-slider" className="font-medium text-gray-700">
                Workers per Project
              </label>
              <span className="bg-nav-dark text-white text-sm font-semibold px-3 py-1 rounded-full">
                {workers}
              </span>
            </div>
            <input
              id="workers-slider"
              type="range"
              min={WORKERS_MIN}
              max={WORKERS_MAX}
              value={workers}
              onChange={e => setWorkers(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: '#F5C518' }}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{WORKERS_MIN}</span>
              <span>{WORKERS_MAX}</span>
            </div>
          </div>

          <hr className="border-gray-100 mb-8" />

          {/* Section: Estimated Annual Savings */}
          <h2 className="font-headline text-brand-gold text-2xl font-bold mb-6">
            Your Estimated Annual Savings
          </h2>

          <div className="flex flex-col sm:flex-row gap-6 mb-4">
            <div className="flex-1 text-center">
              <div className="font-headline text-nav-dark font-bold text-5xl leading-none mb-1">
                {fmt(annualHours)}
              </div>
              <div className="text-gray-500 text-sm mt-2">hours saved per year</div>
            </div>
            <div className="hidden sm:block w-px bg-gray-100" />
            <div className="flex-1 text-center">
              <div className="font-headline text-brand-gold font-bold text-5xl leading-none mb-1">
                ${fmt(annualSavings)}
              </div>
              <div className="text-gray-500 text-sm mt-2">in compliance labor costs</div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mb-8">
            Based on 2.5 hrs/worker/week x 52 weeks x $45/hr compliance labor
          </p>

          <hr className="border-gray-100 mb-8" />

          {/* Section: Get Full ROI Report */}
          <h2 className="font-headline text-nav-dark text-xl font-bold mb-4">
            Get Your Full ROI Report
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            We will email you a detailed breakdown tailored to your project profile — free, no commitment.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 mb-4"
              disabled={isSubmitting || status === 'sent'}
            />

            <button
              type="submit"
              disabled={!canSubmit || status === 'sent'}
              className="w-full bg-brand-gold text-black font-semibold text-base px-8 py-4 rounded-lg
                         hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Sending...' : 'Send My Free Report'}
            </button>
          </form>

          {/* Status messages */}
          {status === 'sent' && (
            <p className="mt-4 text-center text-green-600 font-medium text-sm">
              Report sent! Check your inbox.
            </p>
          )}
          {status === 'error' && (
            <p className="mt-4 text-center text-red-500 text-sm">
              Something went wrong — please try again or email us directly.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
