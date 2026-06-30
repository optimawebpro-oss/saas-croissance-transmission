'use strict';

const router  = require('express').Router();
const https   = require('https');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan }  = require('../middleware/requirePlan');

const stripeKeys = {};

function stripeGet(path, secretKey) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.stripe.com',
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { reject(new Error('JSON parse error')); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// POST /api/facturation/stripe/apikey — enregistre la clé API Stripe restreinte
router.post('/stripe/apikey', requireAuth, async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith('rk_')) {
    return res.status(400).json({ error: 'Clé API Stripe restreinte invalide (doit commencer par rk_).' });
  }
  // Valider la clé en appelant Stripe
  const check = await stripeGet('/v1/customers?limit=1', apiKey).catch(() => null);
  if (!check || check.status !== 200) {
    return res.status(400).json({ error: 'Clé API Stripe invalide ou permissions insuffisantes.' });
  }
  stripeKeys[req.user.id] = apiKey;
  res.json({ success: true, message: 'Clé Stripe enregistrée et vérifiée.' });
});

// GET /api/facturation/stripe/data — récupère MRR, abonnements actifs
router.get('/stripe/data', requireAuth, async (req, res) => {
  const key = stripeKeys[req.user.id];
  if (!key) return res.status(400).json({ error: 'Stripe non connecté. Enregistrez votre clé API d\'abord.' });

  const [subs, charges] = await Promise.all([
    stripeGet('/v1/subscriptions?status=active&limit=100', key),
    stripeGet('/v1/charges?limit=100', key),
  ]);

  if (subs.status !== 200) return res.status(502).json({ error: 'Erreur Stripe.' });

  const activeSubs = subs.body.data || [];
  const mrr = activeSubs.reduce((sum, s) => {
    const amount = s.items?.data?.[0]?.price?.unit_amount || 0;
    const interval = s.items?.data?.[0]?.price?.recurring?.interval;
    return sum + (interval === 'year' ? amount / 12 : amount);
  }, 0) / 100;

  res.json({
    success: true,
    data: {
      abonnementsActifs: activeSubs.length,
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
    },
  });
});

// GET /api/facturation/stripe/status
router.get('/stripe/status', requireAuth, (req, res) => {
  res.json({ connected: !!stripeKeys[req.user.id] });
});

// DELETE /api/facturation/stripe — révocation
router.delete('/stripe', requireAuth, (req, res) => {
  delete stripeKeys[req.user.id];
  res.json({ success: true });
});

module.exports = router;
