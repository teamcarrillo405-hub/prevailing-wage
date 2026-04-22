// Calibration server — serves the drag/resize UI at http://localhost:4199
//
//   npx tsx scripts/calibrate/server.mts
//
// Endpoints:
//   GET  /                → index.html
//   GET  /widgets.json    → layout (reloads from disk each request)
//   POST /widgets.json    → overwrite layout on disk
//   POST /rebuild         → run build-wh347-template.mts
//   GET  /bg-page1.png, /bg-page2.png → page backgrounds

import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const PORT = 4199;
const DIR = path.join(process.cwd(), 'scripts', 'calibrate');
const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/', (_req, res) => res.sendFile(path.join(DIR, 'index.html')));
app.get('/widgets.json', (_req, res) => {
  res.type('application/json').send(readFileSync(path.join(DIR, 'widgets.json'), 'utf8'));
});
app.post('/widgets.json', (req, res) => {
  writeFileSync(path.join(DIR, 'widgets.json'), JSON.stringify(req.body, null, 2));
  res.json({ ok: true, saved: req.body.widgets?.length ?? 0 });
});
app.post('/rebuild', (_req, res) => {
  const r = spawnSync('npx', ['tsx', 'scripts/build-wh347-template.mts'], {
    cwd: process.cwd(), encoding: 'utf8', shell: true,
  });
  res.json({
    ok: r.status === 0,
    stdout: r.stdout,
    stderr: r.stderr,
  });
});
app.get('/bg-page1.png', (_req, res) => res.sendFile(path.join(DIR, 'bg-page1.png')));
app.get('/bg-page2.png', (_req, res) => res.sendFile(path.join(DIR, 'bg-page2.png')));

app.listen(PORT, () => {
  console.log(`\n  WH-347 calibration UI: http://localhost:${PORT}\n`);
});
