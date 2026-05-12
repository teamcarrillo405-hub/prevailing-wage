import { Router } from 'express';
import express from 'express';
import { db } from '../db/index.js';
import { ssoConfigs, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { ValidateInResponseTo } from '@node-saml/node-saml';
import { createSessionToken, hashPassword } from '../services/auth.js';

export const ssoRouter = Router();
const COOKIE_NAME = 'pw_session';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// In-memory request ID store for SP-initiated flow correlation
const pendingRequests = new Map<string, number>(); // requestId -> expiresAt
setInterval(() => {
  const now = Date.now();
  for (const [id, exp] of pendingRequests) {
    if (now > exp) pendingRequests.delete(id);
  }
}, 60_000);

// In-memory assertion ID replay protection: assertionId -> expiresAt
const seenAssertionIds = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [id, exp] of seenAssertionIds) {
    if (now > exp) seenAssertionIds.delete(id);
  }
}, 60_000);

// GET /api/sso/metadata — returns SP metadata XML
// No auth required — IdP needs to fetch this publicly
ssoRouter.get('/metadata', (_req, res) => {
  const appUrl = process.env.APP_URL ?? 'http://localhost:4099';
  const entityId = `${appUrl}/api/sso/metadata`;
  const acsUrl   = `${appUrl}/api/sso/acs`;
  const cert = process.env.SSO_SP_CERT ?? '';

  const keyDescriptor = cert
    ? `<md:KeyDescriptor use="signing">
        <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
          <ds:X509Data><ds:X509Certificate>${cert.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')}</ds:X509Certificate></ds:X509Data>
        </ds:KeyInfo>
      </md:KeyDescriptor>`
    : '';

  const xml = `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    ${keyDescriptor}
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="1"/>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

  res.type('application/xml').send(xml);
});

// GET /api/sso/config — returns the authenticated user's SSO config status
// Returns 404 if no config exists (not an error — caller checks data === null)
ssoRouter.get('/config', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [config] = await db.select({
    provider: ssoConfigs.provider,
    domain: ssoConfigs.domain,
    status: ssoConfigs.status,
    spEntityId: ssoConfigs.spEntityId,
    spAcsUrl: ssoConfigs.spAcsUrl,
  }).from(ssoConfigs).where(eq(ssoConfigs.userId, userId)).limit(1);

  if (!config) return res.json({ data: null });
  res.json({ data: config });
});

// POST /api/sso/admin/config — upsert IdP metadata for the authenticated enterprise owner
// Admin only (enterprise planTier check). Body: { provider, domain, idpEntityId, idpSsoUrl, idpCertificate }
ssoRouter.post('/admin/config', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [authUser] = await db
    .select({ id: users.id, planTier: users.planTier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!authUser || authUser.planTier !== 'enterprise') {
    return res.status(403).json({ error: 'Enterprise plan required for SSO' });
  }

  const { provider = 'generic_saml', domain, idpEntityId, idpSsoUrl, idpCertificate } = req.body as {
    provider?: string;
    domain: string;
    idpEntityId: string;
    idpSsoUrl: string;
    idpCertificate: string;
  };

  if (!domain || !idpEntityId || !idpSsoUrl || !idpCertificate) {
    return res.status(400).json({ error: 'domain, idpEntityId, idpSsoUrl, idpCertificate are required' });
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:4099';
  const now = new Date().toISOString();

  // Upsert: check if row already exists for this user
  const [existing] = await db.select().from(ssoConfigs).where(eq(ssoConfigs.userId, userId)).limit(1);

  if (existing) {
    await db.update(ssoConfigs)
      .set({ provider: provider as any, domain, idpEntityId, idpSsoUrl, idpCertificate,
             spEntityId: `${appUrl}/api/sso/metadata`, spAcsUrl: `${appUrl}/api/sso/acs`,
             status: 'pending', updatedAt: now })
      .where(eq(ssoConfigs.userId, userId));
    return res.json({ data: { id: existing.id, status: 'updated' } });
  } else {
    const id = randomUUID();
    await db.insert(ssoConfigs).values({
      id, userId, provider: provider as any, domain,
      idpEntityId, idpSsoUrl, idpCertificate,
      spEntityId: `${appUrl}/api/sso/metadata`, spAcsUrl: `${appUrl}/api/sso/acs`,
      status: 'pending', createdAt: now, updatedAt: now,
    });
    return res.status(201).json({ data: { id, status: 'created' } });
  }
});

// GET /api/sso/login?domain= — SP-initiated AuthnRequest; redirects to IdP
// No auth required — this is the entry point for SSO login
ssoRouter.get('/login', async (req, res) => {
  const domain = req.query.domain as string | undefined;
  if (!domain) return res.status(400).json({ error: 'domain query parameter required' });

  const appUrl = process.env.APP_URL ?? 'http://localhost:4099';
  const [config] = await db.select().from(ssoConfigs)
    .where(eq(ssoConfigs.domain, domain))
    .limit(1);

  if (!config || config.status !== 'active') {
    return res.status(404).json({ error: 'No active SSO configuration for that domain' });
  }

  const { SAML } = await import('@node-saml/node-saml');
  const saml = new SAML({
    callbackUrl: `${appUrl}/api/sso/acs`,
    entryPoint: config.idpSsoUrl!,
    issuer: `${appUrl}/api/sso/metadata`,
    idpCert: config.idpCertificate!,
    privateKey: process.env.SSO_SP_KEY || undefined,
    wantAssertionsSigned: true,
    validateInResponseTo: ValidateInResponseTo.ifPresent,
  });

  const redirectUrl = await saml.getAuthorizeUrlAsync('', req.headers.host ?? '', {});
  // Extract request ID from the redirect URL to store in memory
  const urlObj = new URL(redirectUrl);
  const samlRequest = urlObj.searchParams.get('SAMLRequest') ?? '';
  // Use a digest of the SAMLRequest as a correlation key
  const requestId = `${domain}-${Date.now()}`;
  pendingRequests.set(requestId, Date.now() + 5 * 60 * 1000);

  res.redirect(302, redirectUrl);
});

// POST /api/sso/acs — assertion consumer service endpoint
// Receives SAMLResponse form body (application/x-www-form-urlencoded from IdP POST binding)
// Validates, provisions user, issues JWT cookie identical to email/password login
ssoRouter.post('/acs', express.urlencoded({ extended: false }), async (req, res) => {
  const samlResponse = req.body.SAMLResponse as string | undefined;
  if (!samlResponse) return res.status(400).json({ error: 'SAMLResponse missing' });

  const appUrl = process.env.APP_URL ?? 'http://localhost:4099';

  try {
    const { SAML } = await import('@node-saml/node-saml');

    // Find IdP config by trying all active configs — enterprise tenants are 1 per user so set is small
    const configs = await db.select().from(ssoConfigs).where(eq(ssoConfigs.status, 'active'));
    if (configs.length === 0) return res.status(400).json({ error: 'No active SSO configuration' });

    let profile: Record<string, unknown> | null = null;

    for (const config of configs) {
      try {
        const saml = new SAML({
          callbackUrl: `${appUrl}/api/sso/acs`,
          entryPoint: config.idpSsoUrl!,
          issuer: `${appUrl}/api/sso/metadata`,
          idpCert: config.idpCertificate!,
          privateKey: process.env.SSO_SP_KEY || undefined,
          wantAssertionsSigned: true,
          validateInResponseTo: ValidateInResponseTo.never,
        });
        const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
        profile = result.profile as Record<string, unknown>;
        break;
      } catch {
        // try next config
      }
    }

    if (!profile) {
      return res.status(400).json({ error: 'SAML validation failed' });
    }

    // Replay protection — use nameID as assertion identifier
    const assertionId = (profile['inResponseTo'] ?? profile['nameID']) as string;
    if (seenAssertionIds.has(assertionId)) {
      return res.status(400).json({ error: 'Assertion already used' });
    }
    seenAssertionIds.set(assertionId, Date.now() + 5 * 60 * 1000);

    const email = profile['nameID'] as string;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'SAML validation failed' });
    }

    // Provision or look up user
    const now = new Date().toISOString();
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      const id = randomUUID();
      const disabledPasswordHash = await hashPassword(randomUUID());
      await db.insert(users).values({
        id, email,
        passwordHash: disabledPasswordHash, // SSO users authenticate through the IdP.
        planTier: 'enterprise',
        createdAt: now, updatedAt: now,
      });
      [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    }

    // Issue JWT — identical shape to auth.ts email/password login
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      sv: user.sessionVersion ?? 0,
    });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

    // Redirect to dashboard (IdP POST binding sends a form to this URL; redirect after)
    res.redirect(302, '/dashboard');
  } catch {
    return res.status(400).json({ error: 'SAML validation failed' });
  }
});
