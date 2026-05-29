/**
 * Load test suite for AVERO Prevailing Wage API
 * Self-contained: spawns the server, runs tests, kills it.
 *
 * Run: npm run load:test
 * Aggressive: CONNECTIONS=50 DURATION=60 npm run load:test
 */
import autocannon from 'autocannon';
import { spawn, type ChildProcess } from 'child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:4099';
const CONNECTIONS = parseInt(process.env.CONNECTIONS ?? '10');
const DURATION = parseInt(process.env.DURATION ?? '15');

// ── Server lifecycle ─────────────────────────────────────────────────────────

async function startServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['tsx', 'src/server/index.ts'], {
      env: { ...process.env, NODE_ENV: 'production', PORT: '4099' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;
    const onData = (data: Buffer) => {
      if (!started && data.toString().includes('API running')) {
        started = true;
        resolve(proc);
      }
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('error', reject);
    setTimeout(() => {
      if (!started) reject(new Error('Server did not start in 15s'));
    }, 15000);
  });
}

async function waitForServer(ms = 8000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      await fetch(`${BASE}/health`);
      return;
    } catch {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  throw new Error(`Server not responding after ${ms}ms`);
}

// ── Benchmark helper ─────────────────────────────────────────────────────────

type BenchResult = {
  title: string;
  rps: number;
  latAvg: number;
  latP99: number;
  errors: number;
  timeouts: number;
};

async function bench(title: string, url: string, opts: Partial<autocannon.Options> = {}): Promise<BenchResult> {
  process.stdout.write(`  ${title}... `);
  return new Promise((resolve) => {
    autocannon(
      { url, connections: CONNECTIONS, duration: DURATION, pipelining: 1, ...opts },
      (_err, result) => {
        if (!result) {
          process.stdout.write('FAILED\n');
          resolve({ title, rps: 0, latAvg: 0, latP99: 0, errors: -1, timeouts: 0 });
          return;
        }
        process.stdout.write(`${result.requests.average.toFixed(0)} req/s  p99=${result.latency.p99}ms\n`);
        resolve({
          title,
          rps: result.requests.average,
          latAvg: result.latency.average,
          latP99: result.latency.p99,
          errors: result.errors,
          timeouts: result.timeouts,
        });
      },
    );
  });
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthCookie(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.DEMO_EMAIL ?? 'demo@prevwage.local',
        password: process.env.DEMO_PASSWORD ?? 'Password123!',
      }),
    });
    const cookie = res.headers.get('set-cookie');
    const match = cookie?.match(/(?:session|pw-session)=([^;]+)/);
    return match ? `session=${match[1]}` : null;
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(65)}`);
  console.log('AVERO Prevailing Wage — Load Test');
  console.log(`connections=${CONNECTIONS}  duration=${DURATION}s per route`);
  console.log(`${'═'.repeat(65)}\n`);

  let proc: ChildProcess | null = null;
  const serverAlreadyUp = await fetch(`${BASE}/health`).then(() => true).catch(() => false);

  if (!serverAlreadyUp) {
    console.log('Starting server...');
    proc = await startServer();
    await waitForServer();
    console.log('Server ready.\n');
  } else {
    console.log('Using existing server.\n');
  }

  const results: BenchResult[] = [];

  // ── Public routes ─────────────────────────────────────────────────────────
  console.log('Public routes:');
  results.push(await bench('GET /health', `${BASE}/health`));
  results.push(await bench('GET /wages/lookup CA', `${BASE}/api/wages/lookup?state=CA&county=Los+Angeles`));
  results.push(await bench('GET /wages/lookup NY', `${BASE}/api/wages/lookup?state=NY&county=New+York`));
  results.push(await bench('GET /wages/state-sources', `${BASE}/api/wages/state-sources`));
  results.push(await bench('GET /wages/local-ordinances', `${BASE}/api/wages/local-ordinances?state=CA`));

  // ── Authenticated routes ──────────────────────────────────────────────────
  const cookie = await getAuthCookie();
  if (cookie) {
    console.log('\nAuthenticated routes:');
    const h = { Cookie: cookie };
    results.push(await bench('GET /projects', `${BASE}/api/projects`, { headers: h }));
    results.push(await bench('GET /dashboard', `${BASE}/api/dashboard`, { headers: h }));
    results.push(await bench('GET /wages/coverage', `${BASE}/api/wages/coverage`, { headers: h }));
    results.push(await bench('GET /wages/county-coverage', `${BASE}/api/wages/county-coverage`, { headers: h }));
  } else {
    console.log('\n[skip] Auth routes — no demo session (run npm run demo:seed first)');
  }

  // ── Results table ─────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(65)}`);
  console.log('SUMMARY');
  console.log(`${'─'.repeat(65)}`);
  console.log(`${'Route'.padEnd(38)} ${'RPS'.padStart(8)}  ${'Avg ms'.padStart(8)}  ${'P99 ms'.padStart(8)}  Err`);
  console.log(`${'─'.repeat(65)}`);
  for (const r of results) {
    const flag = r.errors > 0 ? ' !' : r.latP99 > 500 ? ' ⚠' : ' ✓';
    console.log(
      `${r.title.padEnd(38)} ${r.rps.toFixed(0).padStart(8)}  ${r.latAvg.toFixed(1).padStart(8)}  ${r.latP99.toString().padStart(8)}  ${r.errors}${flag}`,
    );
  }
  console.log(`${'─'.repeat(65)}`);

  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  const worstP99 = Math.max(...results.map(r => r.latP99));
  const minRPS = Math.min(...results.filter(r => r.rps > 0).map(r => r.rps));

  console.log(`\nTotal errors: ${totalErrors}  Worst P99: ${worstP99}ms  Min RPS: ${minRPS.toFixed(0)}`);

  if (totalErrors === 0 && worstP99 < 500) {
    console.log('✓ PASS — all routes within SLA (p99<500ms, 0 errors)');
  } else {
    console.log('✗ FAIL — SLA violations detected');
  }
  console.log(`${'═'.repeat(65)}\n`);

  if (proc) {
    proc.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Load test error:', err.message);
  process.exit(1);
});
