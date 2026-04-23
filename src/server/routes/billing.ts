import { Router } from 'express';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  PLANS,
} from '../services/stripeService.js';

const router = Router();

// ── GET /api/billing/status — requires auth ───────────────────────────────────
router.get('/status', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const [row] = await db
    .select({
      stripeCustomerId: users.stripeCustomerId,
      stripeSubscriptionId: users.stripeSubscriptionId,
      stripeSubscriptionStatus: users.stripeSubscriptionStatus,
      planTier: users.planTier,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    customerId: row.stripeCustomerId ?? null,
    subscriptionId: row.stripeSubscriptionId ?? null,
    subscriptionStatus: row.stripeSubscriptionStatus ?? null,
    planTier: row.planTier,
  });
});

// ── POST /api/billing/checkout — requires auth ────────────────────────────────
router.post('/checkout', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { priceId } = req.body as { priceId?: unknown };

  if (!priceId || typeof priceId !== 'string' || priceId.trim() === '') {
    res.status(400).json({ error: 'priceId is required and must be a non-empty string' });
    return;
  }

  const returnUrl = `${req.protocol}://${req.get('host')}/billing`;

  try {
    const { url } = await createCheckoutSession(userId, priceId, returnUrl);
    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    res.status(500).json({ error: message });
  }
});

// ── POST /api/billing/portal — requires auth ──────────────────────────────────
router.post('/portal', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();

  const [row] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.stripeCustomerId) {
    res.status(400).json({ error: 'No Stripe customer associated with this account' });
    return;
  }

  const returnUrl = `${req.protocol}://${req.get('host')}/billing`;

  try {
    const { url } = await createPortalSession(row.stripeCustomerId, returnUrl);
    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create portal session';
    res.status(500).json({ error: message });
  }
});

// ── POST /api/billing/webhook — PUBLIC (no auth) ──────────────────────────────
// express.raw() is applied in index.ts before express.json() for this path.
router.post('/webhook', async (req, res) => {
  const rawBody = req.body as Buffer;
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  if (!sig || typeof sig !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, sig, secret);
  } catch {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const db = getDb();
  const now = new Date().toISOString();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.userId;

        if (userId) {
          await db
            .update(users)
            .set({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripeSubscriptionStatus: 'active',
              planTier: getPlanTierFromPriceId(session),
              updatedAt: now,
            })
            .where(eq(users.id, userId));
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const status = sub.status;
        const planTier = getPlanTierFromSubscription(sub);

        await db
          .update(users)
          .set({
            stripeSubscriptionStatus: status,
            planTier,
            updatedAt: now,
          })
          .where(eq(users.stripeCustomerId, customerId));
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await db
          .update(users)
          .set({
            stripeSubscriptionStatus: 'canceled',
            planTier: 'starter',
            updatedAt: now,
          })
          .where(eq(users.stripeCustomerId, customerId));
        break;
      }

      default:
        // Unrecognized event — acknowledge and move on (Stripe best practice)
        break;
    }
  } catch (err) {
    console.error('[billing/webhook] DB update failed:', err);
    // Still return 200 to prevent Stripe from retrying; log the error for ops
  }

  res.json({ received: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPlanTierFromPriceId(
  session: Stripe.Checkout.Session,
): 'starter' | 'pro' | 'enterprise' {
  // Try to derive from line_items price id if present on the session object.
  // Stripe embeds this only when the session is expanded; fall back to metadata.
  const metaTier = session.metadata?.planTier as string | undefined;
  if (metaTier === 'pro' || metaTier === 'enterprise') return metaTier;
  return 'pro'; // default upgrade tier for checkout.session.completed
}

function getPlanTierFromSubscription(
  sub: Stripe.Subscription,
): 'starter' | 'pro' | 'enterprise' {
  const priceId = sub.items.data[0]?.price.id;
  if (priceId === PLANS.enterprise) return 'enterprise';
  if (priceId === PLANS.pro) return 'pro';
  return 'starter';
}

export { router as billingRouter };
