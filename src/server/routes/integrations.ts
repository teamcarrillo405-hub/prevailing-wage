import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getQboConnection, deleteQboTokens, saveQboTokens, getValidAccessToken } from '../services/qboService.js';
import { insertSecurityEvent } from '../db/auditHelpers.js';
import { logger } from '../logger.js';

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

export { integrationsRouter };
