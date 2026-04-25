import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getQboConnection, deleteQboTokens, saveQboTokens } from '../services/qboService.js';
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

export { integrationsRouter };
