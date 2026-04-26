// src/server/services/stripeService.ts
// Stripe billing integration — checkout sessions, billing portal, webhook event construction.
// Mirrors lazy-init pattern from emailService.ts: no SDK init at import time.

import Stripe from 'stripe';

// ── Lazy init — avoids requiring STRIPE_SECRET_KEY at import time during tests ──

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  }
  return _stripe;
}

// ── Plan price IDs — override via env vars in production ─────────────────────

export const PLANS = {
  pro: process.env.STRIPE_PRICE_PRO ?? 'price_pro_placeholder',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? 'price_enterprise_placeholder',
} as const;

// ── createCheckoutSession ─────────────────────────────────────────────────────
// Creates a Stripe Checkout session for a subscription plan.
// userId is stored in session metadata to link the Stripe customer back to our
// users table (stripeCustomerId) after the checkout.session.completed webhook.

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: returnUrl,
    metadata: { userId },
  });
  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { url: session.url };
}

// ── createPortalSession ───────────────────────────────────────────────────────
// Creates a Stripe Billing Portal session so an existing subscriber can manage
// their subscription (upgrade, downgrade, cancel). Requires users.stripeCustomerId.

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

// ── constructWebhookEvent ─────────────────────────────────────────────────────
// Verifies the Stripe-Signature header and parses the raw payload into a
// typed Stripe.Event. Caller must pass the raw Buffer (not parsed JSON) and
// the endpoint's webhook signing secret.

export function constructWebhookEvent(
  payload: Buffer,
  sig: string,
  secret: string,
): Stripe.Event {
  return getStripe().webhooks.constructEvent(payload, sig, secret);
}
