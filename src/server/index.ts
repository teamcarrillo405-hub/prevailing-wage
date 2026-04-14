import 'dotenv/config';
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
import { auditRouter } from './routes/audit.js';
import { payrollWeekClassificationsRouter } from './routes/payrollWeekClassifications.js';
import subcontractorsRouter from './routes/subcontractors.js';
import { runWageSync } from './services/wdolSync.js';
import { runDueSoonScan } from './services/dueSoonService.js';
import './services/stateWageAdapter.js'; // side-effect import — calls registerAdapters(WAGE_ADAPTERS) at startup
import './services/cryptoService.js'; // side-effect import — startup key assertion + self-test
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
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

// Production: serve Vite-built React app as static files with SPA catch-all (per D-12)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../../dist/client')));
  app.get('*', (_req, res) => {
    res.sendFile(join(__dirname, '../../dist/client/index.html'));
  });
}

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
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
});
export { app };
