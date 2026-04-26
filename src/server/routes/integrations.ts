import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getQboConnection, deleteQboTokens, saveQboTokens, getValidAccessToken } from '../services/qboService.js';
import { insertSecurityEvent } from '../db/auditHelpers.js';
import { logger } from '../logger.js';
import { getDb } from '../db/index.js';
import { workers, payrollWeeks } from '../db/schema.js';
import { upsertPayrollEntry } from '../services/payrollService.js';

const integrationsRouter = Router();

// GET /api/integrations/qbo/status
// Returns QBO connection status for the authenticated user.
integrationsRouter.get('/qbo/status', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const status = await getQboConnection(userId);
  res.json({ data: status });
});

// GET /api/integrations/qbo/connect
// Initiates OAuth flow — redirects to Intuit authorization URL.
integrationsRouter.get('/qbo/connect', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const clientId = process.env.QBO_CLIENT_ID;
  const redirectUri = process.env.QBO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    res.status(503).json({ error: 'QuickBooks integration not configured' });
    return;
  }

  // State parameter encodes userId for callback validation
  const state = Buffer.from(JSON.stringify({ userId, nonce: Math.random().toString(36) })).toString('base64url');

  const authUrl =
    `https://appcenter.intuit.com/connect/oauth2?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&scope=com.intuit.quickbooks.accounting` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}`;

  res.redirect(authUrl);
});

// GET /api/integrations/qbo/callback
// OAuth callback — exchanges code for tokens and saves encrypted to DB.
integrationsRouter.get('/qbo/callback', async (req, res) => {
  const { code, realmId, state } = req.query as Record<string, string>;

  if (!code || !realmId || !state) {
    res.status(400).send('Missing OAuth parameters');
    return;
  }

  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString()) as { userId: string };
    userId = decoded.userId;
    if (!userId || typeof userId !== 'string') throw new Error('invalid userId in state');
  } catch {
    res.status(400).send('Invalid state parameter');
    return;
  }

  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    res.status(503).send('QuickBooks integration not configured');
    return;
  }

  try {
    // Exchange authorization code for access + refresh tokens
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      logger.error({ status: tokenResponse.status, body }, '[qbo-callback] token exchange failed');
      res.status(502).send('Token exchange failed');
      return;
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      x_refresh_token_expires_in: number;
    };

    const now = Date.now();
    await saveQboTokens(userId, {
      realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
      refreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
    });

    void insertSecurityEvent({ userId, eventType: 'connect_qbo', metadata: { realmId } });

    // Redirect back to integrations page
    res.redirect('/settings/integrations?connected=true');
  } catch (err) {
    logger.error({ err }, '[qbo-callback] unexpected error');
    res.status(500).send('Internal error during QuickBooks connection');
  }
});

// DELETE /api/integrations/qbo
// Disconnects QBO — removes stored tokens for the authenticated user.
integrationsRouter.delete('/qbo', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  await deleteQboTokens(userId);
  void insertSecurityEvent({ userId, eventType: 'disconnect_qbo' });
  res.json({ data: { disconnected: true } });
});

// GET /api/integrations/qbo/employees
// Pulls the Employee roster from QB Online and returns a preview list.
integrationsRouter.get('/qbo/employees', requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const tokenData = await getValidAccessToken(userId);
  if (!tokenData) {
    res.status(401).json({ error: 'QuickBooks not connected' });
    return;
  }

  const { accessToken, realmId } = tokenData;

  const qboResp = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent('SELECT * FROM Employee MAXRESULTS 200')}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    },
  );

  if (!qboResp.ok) {
    const text = await qboResp.text();
    logger.error({ status: qboResp.status, body: text.slice(0, 400) }, '[qbo-employees] QB API error');
    res.status(502).json({ error: 'QB API error', detail: text.slice(0, 200) });
    return;
  }

  const data = await qboResp.json() as { QueryResponse?: { Employee?: unknown[] } };
  const employees = (data.QueryResponse?.Employee ?? []) as Array<Record<string, unknown>>;

  const preview = employees.map((emp) => {
    const addr = emp['PrimaryAddr'] as Record<string, string> | undefined;
    const emailObj = emp['PrimaryEmailAddr'] as { Address?: string } | undefined;
    const ssn = emp['SSN'] as string | undefined;
    return {
      qboId: emp['Id'] as string,
      displayName: (emp['DisplayName'] as string | undefined) ||
        `${(emp['GivenName'] as string) ?? ''} ${(emp['FamilyName'] as string) ?? ''}`.trim(),
      email: emailObj?.Address ?? null,
      address: addr
        ? [addr['Line1'], addr['City'], addr['CountrySubDivisionCode'], addr['PostalCode']]
            .filter(Boolean)
            .join(', ')
        : null,
      hasSsn: !!ssn,
      ssnLast4: ssn ? ssn.slice(-4) : null,
    };
  });

  res.json({ data: { employees: preview } });
});

// GET /api/integrations/qbo/timeactivities?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Pulls TimeActivity records from QB Online for the given date range.
integrationsRouter.get('/qbo/timeactivities', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { startDate, endDate } = req.query as Record<string, string>;

  if (!startDate || !endDate) {
    res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
    return;
  }

  const tokenData = await getValidAccessToken(userId);
  if (!tokenData) {
    res.status(401).json({ error: 'QuickBooks not connected' });
    return;
  }

  const { accessToken, realmId } = tokenData;

  const query = `SELECT * FROM TimeActivity WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' MAXRESULTS 500`;

  const qboResp = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    },
  );

  if (!qboResp.ok) {
    const text = await qboResp.text();
    logger.error({ status: qboResp.status, body: text.slice(0, 400) }, '[qbo-timeactivities] QB API error');
    res.status(502).json({ error: 'QB API error', detail: text.slice(0, 200) });
    return;
  }

  const data = await qboResp.json() as { QueryResponse?: { TimeActivity?: unknown[] } };
  const activities = (data.QueryResponse?.TimeActivity ?? []) as Array<Record<string, unknown>>;

  const rows = activities.map((act) => {
    const hours = (act['Hours'] as number | undefined) ?? 0;
    const minutes = (act['Minutes'] as number | undefined) ?? 0;
    const totalHours = hours + minutes / 60;
    const empRef = act['EmployeeRef'] as { value?: string; name?: string } | undefined;
    const custRef = act['CustomerRef'] as { name?: string } | undefined;

    return {
      qboId: act['Id'] as string,
      employeeRef: empRef?.name ?? (act['NameOf'] as string | undefined) ?? 'Unknown',
      employeeId: empRef?.value ?? null,
      date: act['TxnDate'] as string,
      hours: totalHours,
      description: (act['Description'] as string | undefined) ?? null,
      customerRef: custRef?.name ?? null,
      // QB Online stores per-day breakdowns in Hours_Mon etc. if absent, totals need daily split
      needsDailySplit: totalHours > 0 && !(act['Hours_Mon'] as number | undefined),
    };
  });

  const needsSplitWarning = rows.some((r) => r.needsDailySplit);

  res.json({
    data: {
      activities: rows,
      count: rows.length,
      note: needsSplitWarning
        ? 'Some entries need daily hour split confirmation'
        : null,
    },
  });
});

// POST /api/integrations/qbo/sync-time?weekId=&projectId=
// Queries QB TimeActivity for the payroll week date range, fuzzy-matches employees
// to our workers by name, and returns suggestions (does NOT auto-create entries).
integrationsRouter.post('/qbo/sync-time', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { weekId, projectId } = req.query as Record<string, string>;

  if (!weekId || !projectId) {
    res.status(400).json({ error: 'weekId and projectId are required query params' });
    return;
  }

  const tokenData = await getValidAccessToken(userId);
  if (!tokenData) {
    res.status(401).json({ error: 'QuickBooks not connected' });
    return;
  }

  const { accessToken, realmId } = tokenData;
  const db = getDb();

  // Look up the payroll week to get week-ending date (we derive week-start from it)
  const [week] = await db.select().from(payrollWeeks).where(eq(payrollWeeks.id, weekId)).limit(1);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  // Derive Mon–Sun range from week-ending date (assumed Sunday)
  const endDate = week.weekEndingDate;
  const end = new Date(endDate + 'T00:00:00Z');
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  const startDate = start.toISOString().slice(0, 10);

  // Query QB TimeActivity
  const query = `SELECT * FROM TimeActivity WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' MAXRESULTS 500`;
  const qboResp = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
  );

  if (!qboResp.ok) {
    const text = await qboResp.text();
    logger.error({ status: qboResp.status, body: text.slice(0, 400) }, '[qbo-sync-time] QB API error');
    res.status(502).json({ error: 'QB API error', detail: text.slice(0, 200) });
    return;
  }

  const data = await qboResp.json() as { QueryResponse?: { TimeActivity?: unknown[] } };
  const activities = (data.QueryResponse?.TimeActivity ?? []) as Array<Record<string, unknown>>;

  // Load project workers for fuzzy matching
  const projectWorkers = await db
    .select({ id: workers.id, name: workers.name })
    .from(workers)
    .where(eq(workers.projectId, projectId));

  // Simple fuzzy match: normalize names to lowercase, strip punctuation
  function normalize(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Build a day-key map from ISO date to column prefix
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

  // Group QB activities by employee name
  const byEmployee = new Map<string, { employeeRef: string; entries: Array<{ date: string; hours: number; description: string | null }> }>();

  for (const act of activities) {
    const empRef = act['EmployeeRef'] as { value?: string; name?: string } | undefined;
    const empName = empRef?.name ?? (act['NameOf'] as string | undefined) ?? 'Unknown';
    const hours = ((act['Hours'] as number | undefined) ?? 0) + ((act['Minutes'] as number | undefined) ?? 0) / 60;
    const date = act['TxnDate'] as string;
    const description = (act['Description'] as string | undefined) ?? null;

    if (!byEmployee.has(empName)) byEmployee.set(empName, { employeeRef: empName, entries: [] });
    byEmployee.get(empName)!.entries.push({ date, hours, description });
  }

  type ProjectWorker = { id: string; name: string };

  const matched: Array<{ workerId: string; workerName: string; qboEmployeeRef: string; entries: Array<{ date: string; hours: number; dayKey: string }> }> = [];
  const unmatched: Array<{ employeeRef: string; totalHours: number }> = [];

  for (const [empName, group] of byEmployee) {
    const normEmp = normalize(empName);
    const worker = (projectWorkers as ProjectWorker[]).find((w) => normalize(w.name) === normEmp)
      ?? (projectWorkers as ProjectWorker[]).find((w) => {
        // partial match: all words of emp name appear in worker name or vice versa
        const empWords = normEmp.split(' ');
        const wNorm = normalize(w.name);
        return empWords.every((word) => wNorm.includes(word));
      });

    if (worker) {
      const entryRows = group.entries.map((e) => {
        const d = new Date(e.date + 'T00:00:00Z');
        const dayKey = DAY_KEYS[d.getUTCDay()];
        return { date: e.date, hours: e.hours, dayKey: `${dayKey}St` };
      });
      matched.push({ workerId: worker.id, workerName: worker.name, qboEmployeeRef: empName, entries: entryRows });
    } else {
      const totalHours = group.entries.reduce((s, e) => s + e.hours, 0);
      unmatched.push({ employeeRef: empName, totalHours });
    }
  }

  res.json({ data: { weekId, startDate, endDate, matched, unmatched } });
});

// POST /api/integrations/qbo/sync-employees
// Returns QB employee list for use in the employee mapping UI.
// (The GET /qbo/employees route already exists for preview; this POST variant
//  is the sync entry point used by the mapping flow.)
integrationsRouter.post('/qbo/sync-employees', requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const tokenData = await getValidAccessToken(userId);
  if (!tokenData) {
    res.status(401).json({ error: 'QuickBooks not connected' });
    return;
  }

  const { accessToken, realmId } = tokenData;

  const qboResp = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent('SELECT * FROM Employee MAXRESULTS 200')}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
  );

  if (!qboResp.ok) {
    const text = await qboResp.text();
    logger.error({ status: qboResp.status, body: text.slice(0, 400) }, '[qbo-sync-employees] QB API error');
    res.status(502).json({ error: 'QB API error', detail: text.slice(0, 200) });
    return;
  }

  const data = await qboResp.json() as { QueryResponse?: { Employee?: unknown[] } };
  const employees = (data.QueryResponse?.Employee ?? []) as Array<Record<string, unknown>>;

  const preview = employees.map((emp) => {
    const emailObj = emp['PrimaryEmailAddr'] as { Address?: string } | undefined;
    return {
      qboId: emp['Id'] as string,
      displayName: (emp['DisplayName'] as string | undefined) ||
        `${(emp['GivenName'] as string) ?? ''} ${(emp['FamilyName'] as string) ?? ''}`.trim(),
      email: emailObj?.Address ?? null,
    };
  });

  res.json({ data: { employees: preview, count: preview.length } });
});

// POST /api/integrations/qbo/push-approved-hours
// Body: { weekId, projectId, entries: [{workerId, date, hours, classificationId}] }
// Creates/updates payroll entries in our DB from confirmed QB time suggestions.
integrationsRouter.post('/qbo/push-approved-hours', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const body = req.body as {
    weekId: string;
    projectId: string;
    entries: Array<{
      workerId: string;
      classificationId: string;
      date: string;
      hours: number;
      baseRateSnapshot?: number;
      fringeRateSnapshot?: number;
    }>;
  };

  if (!body.weekId || !body.projectId || !Array.isArray(body.entries) || body.entries.length === 0) {
    res.status(400).json({ error: 'weekId, projectId, and entries[] are required' });
    return;
  }

  // Verify QB is connected (confirms the user intends a QB-originated import)
  const tokenData = await getValidAccessToken(userId);
  if (!tokenData) {
    res.status(401).json({ error: 'QuickBooks not connected' });
    return;
  }

  const db = getDb();

  // Verify week exists
  const [week] = await db.select().from(payrollWeeks).where(eq(payrollWeeks.id, body.weekId)).limit(1);
  if (!week) {
    res.status(404).json({ error: 'Payroll week not found' });
    return;
  }

  if (week.submittedAt) {
    res.status(423).json({ error: 'This payroll week is submitted and cannot be modified.' });
    return;
  }

  // Group entries by workerId+classificationId to aggregate daily hours
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

  type DayHours = { monSt: number; tueSt: number; wedSt: number; thuSt: number; friSt: number; satSt: number; sunSt: number };
  const grouped = new Map<string, { workerId: string; classificationId: string; baseRate: number; fringeRate: number; days: DayHours }>();

  for (const entry of body.entries) {
    const key = `${entry.workerId}::${entry.classificationId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        workerId: entry.workerId,
        classificationId: entry.classificationId,
        baseRate: entry.baseRateSnapshot ?? 0,
        fringeRate: entry.fringeRateSnapshot ?? 0,
        days: { monSt: 0, tueSt: 0, wedSt: 0, thuSt: 0, friSt: 0, satSt: 0, sunSt: 0 },
      });
    }
    const group = grouped.get(key)!;
    const d = new Date(entry.date + 'T00:00:00Z');
    const dayKey = `${DAY_KEYS[d.getUTCDay()]}St` as keyof DayHours;
    group.days[dayKey] += entry.hours;
  }

  // Commit grouped entries — caller provides baseRateSnapshot/fringeRateSnapshot
  // from the sync-time response; default to 0 if omitted (scheduler will re-compute).
  let committed = 0;
  for (const [, group] of grouped) {
    await upsertPayrollEntry({
      payrollWeekId: body.weekId,
      workerId: group.workerId,
      classificationId: group.classificationId,
      baseRateSnapshot: group.baseRate,
      fringeRateSnapshot: group.fringeRate,
      userId,
      ...group.days,
    });
    committed++;
  }

  res.json({ data: { committed, weekId: body.weekId } });
});

export { integrationsRouter };
