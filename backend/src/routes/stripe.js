const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error('SESSION_SECRET manquant dans les variables d\'environnement.');
const { setUserPlan, findUserByStripeSubscription, findUserByStripeCustomer } = require('../services/subscriptionDb');
const { logger } = require('../middleware/audit');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

// Map plan+billing → Stripe Price ID (configuré dans .env)
function getPriceId(plan, billing) {
  const map = {
    croissance_monthly: process.env.STRIPE_PRICE_CROISSANCE_MONTHLY,
    croissance_annual:  process.env.STRIPE_PRICE_CROISSANCE_ANNUAL,
    cession_monthly:    process.env.STRIPE_PRICE_CESSION_MONTHLY,
    cession_annual:     process.env.STRIPE_PRICE_CESSION_ANNUAL,
  };
  return map[`${plan}_${billing}`] || null;
}

/**
 * GET /api/stripe/checkout?plan=croissance&billing=monthly
 * Crée une Stripe Checkout Session et redirige l'utilisateur.
 */
router.get('/checkout', async (req, res) => {
  try {
    // Authentification via JWT (token passé en query param)
    const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.redirect(`${FRONTEND_URL}/tarifs.html?error=login_required`);
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); }
    catch { return res.redirect(`${FRONTEND_URL}/tarifs.html?error=login_required`); }

    const { plan, billing = 'monthly' } = req.query;
    if (!['croissance', 'cession'].includes(plan)) {
      return res.status(400).json({ error: 'Plan invalide.' });
    }

    const priceId = getPriceId(plan, billing);
    if (!priceId) {
      return res.status(400).json({ error: `Prix Stripe non configuré pour ${plan}/${billing}.` });
    }

    const kindeUserId = payload.id;
    const email = payload.email;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/mon-espace.html?subscription=success&plan=${plan}`,
      cancel_url: `${FRONTEND_URL}/tarifs.html?subscription=cancelled`,
      metadata: { kindeUserId, plan, billing },
      subscription_data: {
        metadata: { kindeUserId, plan, billing },
      },
    });

    logger.info({ event: 'STRIPE_CHECKOUT_CREATED', kindeUserId, plan, billing, sessionId: checkoutSession.id });
    res.redirect(303, checkoutSession.url);
  } catch (err) {
    logger.error({ event: 'STRIPE_CHECKOUT_ERROR', error: err.message });
    res.redirect(`${FRONTEND_URL}/tarifs.html?error=checkout_failed`);
  }
});

/**
 * POST /api/stripe/webhook
 * Reçoit les événements Stripe (raw body requis).
 * Événements gérés :
 *   - checkout.session.completed → activation de l'abonnement
 *   - customer.subscription.updated → changement de plan
 *   - customer.subscription.deleted → annulation
 *   - invoice.payment_failed → échec de paiement
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ event: 'STRIPE_WEBHOOK_INVALID_SIG', error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  logger.info({ event: 'STRIPE_WEBHOOK', type: event.type });

  switch (event.type) {

    case 'checkout.session.completed': {
      const s = event.data.object;
      if (s.mode !== 'subscription') break;
      const { kindeUserId, plan, billing } = s.metadata || {};
      if (!kindeUserId || !plan) break;
      setUserPlan(kindeUserId, {
        plan,
        billing,
        status: 'active',
        stripeSubscriptionId: s.subscription,
        stripeCustomerId: s.customer,
      });
      logger.info({ event: 'SUBSCRIPTION_ACTIVATED', kindeUserId, plan, billing });
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const match = findUserByStripeSubscription(sub.id);
      if (!match) break;
      const [kindeUserId, current] = match;
      const newStatus = sub.status === 'active' ? 'active' : sub.status;
      setUserPlan(kindeUserId, { ...current, status: newStatus, stripeSubscriptionId: sub.id });
      logger.info({ event: 'SUBSCRIPTION_UPDATED', kindeUserId, status: newStatus });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const match = findUserByStripeSubscription(sub.id);
      if (!match) break;
      const [kindeUserId] = match;
      setUserPlan(kindeUserId, { plan: 'gratuit', billing: null, status: 'cancelled', stripeSubscriptionId: null });
      logger.info({ event: 'SUBSCRIPTION_CANCELLED', kindeUserId });
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object;
      const match = findUserByStripeCustomer(inv.customer);
      if (!match) break;
      const [kindeUserId, current] = match;
      setUserPlan(kindeUserId, { ...current, status: 'past_due' });
      logger.warn({ event: 'PAYMENT_FAILED', kindeUserId, invoiceId: inv.id });
      break;
    }
  }

  res.json({ received: true });
});

module.exports = router;
