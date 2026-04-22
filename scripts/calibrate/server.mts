// Calibration server — serves the drag/resize UI for any form.
//
//   npx tsx scripts/calibrate/server.mts
//
// URLs:
//   /             → form picker
//   /:form        → calibration UI for scripts/calibrate/<form>/
//
// Endpoints per form:
//   GET  /api/:form/widgets         → current layout
//   POST /api/:form/widgets         → save layout
//   POST /api/:form/rebuild              → runs `npx tsx scripts/build-<form>-template.mts`
//   GET  /api/:form/bg-page:N.png        → background image for page N
//
// To add a new form: create scripts/calibrate/<form>/ with bg-page*.png and
// widgets.json, then create scripts/build-<form>-template.mts.

import express from 'express';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const PORT = 4199;
const BASE = path.join(process.cwd(), 'scripts', 'calibrate');
const app = express();
app.use(express.json({ limit: '4mb' }));

function listForms(): string[] {
  return readdirSync(BASE)
    .filter(n => {
      const p = path.join(BASE, n);
      return statSync(p).isDirectory() && existsSync(path.join(p, 'widgets.json'));
    })
    .sort();
}

// Form picker at /
app.get('/', (_req, res) => {
  const forms = listForms();
  const links = forms.map(f => `<li><a href="/${f}">${f}</a></li>`).join('');
  res.send(`<!DOCTYPE html><html><head><title>Calibration Forms</title>
<style>body{font-family:sans-serif;background:#222;color:#eee;padding:40px;}
a{color:#ffd866;font-size:18px;}ul{line-height:2;}</style></head>
<body><h1>Widget Calibration — Available Forms</h1><ul>${links}</ul>
<p style="color:#888">To add a form: create scripts/calibrate/&lt;form&gt;/ with
widgets.json and bg-page*.png, then reload.</p></body></html>`);
});

// Calibration UI for a form
app.get('/:form', (req, res) => {
  const form = req.params.form;
  if (!listForms().includes(form)) return res.status(404).send(`form not found: ${form}`);
  // Serve index.html but inject the form name via a query string the UI reads
  res.sendFile(path.join(BASE, 'index.html'));
});

// Per-form data endpoints
app.get('/api/:form/widgets', (req, res) => {
  const f = path.join(BASE, req.params.form, 'widgets.json');
  if (!existsSync(f)) return res.status(404).json({ error: 'not found' });
  res.type('application/json').send(readFileSync(f, 'utf8'));
});

app.post('/api/:form/widgets', (req, res) => {
  const f = path.join(BASE, req.params.form, 'widgets.json');
  if (!existsSync(f)) return res.status(404).json({ error: 'not found' });
  writeFileSync(f, JSON.stringify(req.body, null, 2));
  res.json({ ok: true, saved: req.body.widgets?.length ?? 0 });
});

app.get('/api/:form/bg/:n', (req, res) => {
  const f = path.join(BASE, req.params.form, `bg-page${req.params.n}.png`);
  if (!existsSync(f)) return res.status(404).send('not found');
  res.sendFile(f);
});

app.post('/api/:form/rebuild', (req, res) => {
  const script = `scripts/build-${req.params.form}-template.mts`;
  if (!existsSync(path.join(process.cwd(), script))) {
    return res.json({ ok: false, stderr: `No build script: ${script}` });
  }
  const r = spawnSync('npx', ['tsx', script], {
    cwd: process.cwd(), encoding: 'utf8', shell: true,
  });
  res.json({ ok: r.status === 0, stdout: r.stdout, stderr: r.stderr });
});

app.listen(PORT, () => {
  const forms = listForms();
  console.log(`\n  Calibration server: http://localhost:${PORT}`);
  console.log(`  Available forms: ${forms.join(', ')}\n`);
});
