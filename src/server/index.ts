import 'dotenv/config';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN, // no-op if undefined — safe to deploy without it
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1,
});

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cron from 'node-cron';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import workersRouter from './routes/workers.js';
import { wagesRouter } from './routes/wages.js';
import { adminWagesRouter } from './routes/adminWages.js';
import { payrollRouter } from './routes/payroll.js';
import { otRouter } from './routes/ot.js';
import { exportRouter } from './routes/export.js';
import { gsaRouter } from './routes/gsa.js';
import { unionRouter } from './routes/union.js';
import { varianceRouter } from './routes/variance.js';
import { complianceRouter } from './routes/compliance.js';
import { reportsRouter } from './routes/reports.js';
import { teamRouter } from './routes/team.js';
import { importRouter } from './routes/import.js';
import { billingRouter } from './routes/billing.js';
import { auditRouter } from './routes/audit.js';
import { payrollWeekClassificationsRouter } from './routes/payrollWeekClassifications.js';
import subcontractorsRouter from './routes/subcontractors.js';
import subUploadRouter from './routes/subUpload.js';
import { auditExportRouter } from './routes/auditExport.js';
import { projectWdRouter } from './routes/projectWageDeterminations.js';
import { runWageSync } from './services/wdolSync.js';
import { runDueSoonScan } from './services/dueSoonService.js';
import { checkWdChanges } from './services/wdChangeDetector.js';
import './services/stateWageAdapter.js'; // side-effect import — calls registerAdapters(WAGE_ADAPTERS) at startup
import './services/cryptoService.js'; // side-effect import — startup key assertion + self-test
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure upload directory exists at startup
mkdirSync(process.env.UPLOAD_DIR || './uploads', { recursive: true });

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
// Stripe webhook needs raw body — must be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cookieParser());

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use((req, res, next) => {
  // Only check mutating methods — GET/HEAD/OPTIONS are safe
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Skip webhook endpoint — Stripe sends without browser Origin
  if (req.path.startsWith('/api/billing/webhook')) return next();
  // Skip health check
  if (req.path === '/api/health') return next();

  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/sub-upload', subUploadRouter); // public — no auth required
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', workersRouter);
app.use('/api/wages', wagesRouter);
app.use('/api/admin/wages', adminWagesRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/ot-thresholds', otRouter);
app.use('/api/export', exportRouter);
app.use('/api/gsa', gsaRouter);
app.use('/api/union', unionRouter);
app.use('/api/variance', varianceRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/team', teamRouter);
app.use('/api/payroll/import', importRouter);
app.use('/api/audit', auditRouter);
app.use('/api/projects', payrollWeekClassificationsRouter);
app.use('/api/projects', subcontractorsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/audit-export', auditExportRouter);
app.use('/api/projects/:projectId/wage-determinations', projectWdRouter);

// Production: serve Vite-built React app as static files with SPA catch-all (per D-12)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../../dist/client')));
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, '../../dist/client/index.html'));
  });
}

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  // Register monthly wage sync — MUST be inside listen() callback so getDb() is initialized
  // Cron: 2:00 AM on the 1st of every month
  cron.schedule('0 2 1 * *', async () => {
    console.log('[wage-sync] Starting monthly sync');
    try {
      await runWageSync();
    } catch (err) {
      console.error('[wage-sync] Failed:', err);
      // Never rethrow — cron failures must not crash Express
    }
  }, { timezone: 'America/New_York' });

  // Register daily payroll due-soon scan — NOTIF-02
  // Runs at 7:00 AM Eastern every day
  cron.schedule('0 7 * * *', async () => {
    console.log('[due-soon] Running daily payroll due-soon scan');
    try {
      await runDueSoonScan();
    } catch (err) {
      console.error('[due-soon] Scan failed:', err);
      // Never rethrow — cron failures must not crash Express
    }
  }, { timezone: 'America/New_York' });

  // Register daily WD change detector — NOTIF-07
  // Runs at 3:00 AM Eastern every day (after wage sync window)
  cron.schedule('0 3 * * *', async () => {
    console.log('[wd-detector] Running daily WD change detector');
    try {
      await checkWdChanges();
    } catch (err) {
      console.error('[wd-detector] Failed:', err);
      // Never rethrow — cron failures must not crash Express
    }
  }, { timezone: 'America/New_York' });
});

// Graceful shutdown — give in-flight requests 10s to complete
function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received — closing server`);
  server.close(() => {
    console.log('[shutdown] All connections closed. Exiting.');
    process.exit(0);
  });
  // Force exit after 10s if connections hang
  setTimeout(() => {
    console.error('[shutdown] Forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
export { app };
