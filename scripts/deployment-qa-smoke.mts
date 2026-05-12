const baseUrl = (process.env.QA_BASE_URL ?? 'http://localhost:4200').replace(/\/$/, '');

const checks = [
  { label: 'App shell', path: '/' },
  { label: 'API health', path: '/api/health' },
  { label: 'API readiness', path: '/api/ready', allowNotReady: true },
  { label: 'Methodology center', path: '/methodology' },
  { label: 'Security policy', path: '/security' },
  { label: 'API docs', path: '/api-docs' },
];

let failed = false;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  try {
    const response = await fetch(url, { redirect: 'manual' });
    const ok = response.status >= 200 && response.status < 400 || (check.allowNotReady && response.status === 503);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${check.label}: ${response.status} ${url}`);
    if (!ok) failed = true;
  } catch (err) {
    failed = true;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`FAIL ${check.label}: ${message} ${url}`);
  }
}

if (failed) {
  process.exitCode = 1;
}
