import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { logger } from './logger.js';
import { pingDb } from './db/index.js';
import pinoHttp from 'pino-http';

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
import mfaRouter from './routes/mfa.js';
import { payrollWeekClassificationsRouter } from './routes/payrollWeekClassifications.js';
import subcontractorsRouter from './routes/subcontractors.js';
import subUploadRouter from './routes/subUpload.js';
import { auditExportRouter } from './routes/auditExport.js';
import { projectWdRouter } from './routes/projectWageDeterminations.js';
import { integrationsRouter } from './routes/integrations.js';
import timePunchesRouter, { fillFromPunchesRouter } from './routes/timePunches.js';
import photosRouter, { photoFileRouter } from './routes/photos.js';
import apiKeysRouter from './routes/apiKeys.js';
import webhooksRouter from './routes/webhooks.js';
import publicApiRouter from './routes/publicApi.js';
import notificationsRouter from './routes/notifications.js';
import { dashboardRouter } from './routes/dashboard.js';
import samGovRouter from './routes/samGov.js';
import securityRouter from './routes/security.js';
import { runWageSync } from './services/wdolSync.js';
import { runDueSoonScan } from './services/dueSoonService.js';
import { checkWdChanges } from './services/wdChangeDetector.js';
import { runCertificationExpiryAlerts } from './jobs/certificationExpiryAlerts.js';
import { runScheduledReports } from './jobs/scheduledReports.js';
import './services/stateWageAdapter.js'; // side-effect import — calls registerAdapters(WAGE_ADAPTERS) at startup
import './services/cryptoService.js'; // side-effect import — startup key assertion + self-test
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure upload and photos directories exist at startup
mkdirSync(process.env.UPLOAD_DIR || './uploads', { recursive: true });
mkdirSync(process.env.PHOTOS_DIR || './var/data/photos', { recursive: true });

const app = express();
app.set('trust proxy', 1);

// Phase 80 — Helmet hardening (SOC 2 SEC-05).
// CSP is explicit because Helmet's default blocks inline styles (Tailwind
// runtime injects a few) and blob: URLs (camera preview + service worker).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],            // Tailwind runtime needs inline styles
      imgSrc:     ["'self'", 'data:', 'blob:'],             // camera preview + favicons
      connectSrc: ["'self'"],
      mediaSrc:   ["'self'", 'blob:'],                      // getUserMedia uses blob URLs
      workerSrc:  ["'self'"],                               // PWA service worker
      objectSrc:  ["'none'"],
      frameAncestors: ["'none'"],                           // anti-clickjacking
      baseUri:    ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'same-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// Phase 80 — security.txt (SEC-06). Served before helmet's noSniff would
// override the content-type so that the well-known path renders as text.
app.get('/.well-known/security.txt', (_req, res) => {
  res.type('text/plain').send(
    [
      'Contact: mailto:security@prevailingwage.app',
      'Expires: 2027-01-01T00:00:00.000Z',
      'Preferred-Languages: en',
      'Policy: https://prevailingwage.app/security-policy',
      '',
    ].join('\n'),
  );
});

app.use(pinoHttp({
  logger,
  // Skip health checks from access log — too noisy for uptime pings
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customLogLevel: (_req, res) => res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
}));

// Phase 83 SEC-07 — non-fatal startup warning if external log drain not configured.
// Mirrors RESEND_API_KEY / SENTRY_DSN handling: app continues to run, logs stay on stdout.
if (process.env.NODE_ENV !== 'test' && !process.env.LOGTAIL_TOKEN) {
  logger.warn('LOGTAIL_TOKEN not set — logs will not be sent to external drain (Better Stack). App will continue with stdout logging.');
}

// Phase 80 — CORS tightening (SEC-05). Single allow-listed origin from env.
// CORS_ORIGIN (preferred) and ALLOWED_ORIGIN are both honored to avoid
// breaking existing deployments while migrating to the SOC 2 nomenclature.
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true,
}));
// Stripe webhook needs raw body — must be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cookieParser());

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:4200';

app.use((req, res, next) => {
  // Only check mutating methods — GET/HEAD/OPTIONS are safe
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Skip webhook endpoint — Stripe sends without browser Origin
  if (req.path.startsWith('/api/billing/webhook')) return next();
  // Skip health check
  if (req.path === '/api/health') return next();
  // Skip public REST API — uses Bearer token auth, no browser origin
  if (req.path.startsWith('/v1/')) return next();

  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
});

app.get('/api/health', (_req, res) => {
  try {
    pingDb();
    res.json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'error' });
  }
});
app.use('/api/sub-upload', subUploadRouter); // public — no auth required
app.use('/api/auth', authRouter);
app.use('/api/mfa', mfaRouter);
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
app.use('/api/integrations', integrationsRouter);
app.use('/api/time-punches', timePunchesRouter);
app.use('/api/projects', photosRouter);
app.use('/api/photos', photoFileRouter);
app.use('/api/projects', fillFromPunchesRouter);
app.use('/api/keys', apiKeysRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/dashboard', dashboardRouter);
// Phase 82 (Gap-2) — SAM.gov DBE verification proxy + SOC 2 user security dashboard
app.use('/api/sam-gov', samGovRouter);
app.use('/api/security', securityRouter);
app.use('/api/notifications', notificationsRouter);
// /v1 — public REST API, Bearer token auth (no CSRF check needed — API key, no browser origin)
app.use('/v1', publicApiRouter);

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
  logger.info({ port: PORT }, 'API running');
  // Register monthly wage sync — MUST be inside listen() callback so getDb() is initialized
  // Cron: 2:00 AM on the 1st of every month
  cron.schedule('0 2 1 * *', async () => {
    logger.info('wage-sync: starting monthly sync');
    try {
      await runWageSync();
    } catch (err) {
      logger.error({ err }, 'wage-sync: failed');
      // Never rethrow — cron failures must not crash Express
    }
  }, { timezone: 'America/New_York' });

  // Register daily payroll due-soon scan — NOTIF-02
  // Runs at 7:00 AM Eastern every day
  cron.schedule('0 7 * * *', async () => {
    logger.info('due-soon: running daily payroll due-soon scan');
    try {
      await runDueSoonScan();
    } catch (err) {
      logger.error({ err }, 'due-soon: scan failed');
      // Never rethrow — cron failures must not crash Express
    }
  }, { timezone: 'America/New_York' });

  // Register daily WD change detector — NOTIF-07
  // Runs at 3:00 AM Eastern every day (after wage sync window)
  cron.schedule('0 3 * * *', async () => {
    logger.info('wd-detector: running daily WD change detector');
    try {
      await checkWdChanges();
    } catch (err) {
      logger.error({ err }, 'wd-detector: failed');
      // Never rethrow — cron failures must not crash Express
    }
  }, { timezone: 'America/New_York' });

  // Register daily certification expiry alerts — DBE-03
  // Runs at 8:00 AM Eastern every day
  cron.schedule('0 8 * * *', async () => {
    logger.info('cert-expiry: running daily certification expiry alert scan');
    try {
      await runCertificationExpiryAlerts();
    } catch (err) {
      logger.error({ err }, 'cert-expiry: scan failed');
      // Never rethrow — cron failures must not crash Express
    }
  }, { timezone: 'America/New_York' });

  // Register daily scheduled compliance reports — NOTIF-06 (Phase 86)
  // Runs at 8:00 AM UTC every day; job dispatches per-project based on reportSchedule.
  // WHY UTC (not America/New_York): ROADMAP author specified 08:00 UTC for deterministic
  // region-agnostic dispatch. Cert-expiry runs 08:00 ET (4-5h later) — no conflict.
  cron.schedule('0 8 * * *', async () => {
    logger.info('scheduled-reports: running daily report dispatch');
    try {
      await runScheduledReports();
    } catch (err) {
      logger.error({ err }, 'scheduled-reports: failed');
      // Never rethrow — cron failures must not crash Express
    }
  }, { timezone: 'UTC' });
});

// Graceful shutdown — give in-flight requests 10s to complete
function shutdown(signal: string) {
  logger.info({ signal }, 'shutdown: received signal');
  server.close(() => {
    logger.info('shutdown: all connections closed');
    process.exit(0);
  });
  // Force exit after 10s if connections hang
  setTimeout(() => {
    logger.error('shutdown: forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
export { app };
