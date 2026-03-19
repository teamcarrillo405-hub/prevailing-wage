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
import { runWageSync } from './services/wdolSync.js';
import './services/stateWageAdapter.js'; // side-effect import — calls registerAdapters(WAGE_ADAPTERS) at startup

const app = express();
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
});
export { app };
