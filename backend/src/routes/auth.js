const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getUser } = require('@kinde-oss/kinde-node-express');
const { getUserPlan } = require('../services/subscriptionDb');

const JWT_SECRET = process.env.SESSION_SECRET || 'evoluty-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

// Helper : tente de lire l'utilisateur Kinde sans rediriger
function getKindeUser(req, res) {
  return new Promise((resolve) => {
    const orig = res.redirect.bind(res);
    res.redirect = () => { res.redirect = orig; resolve(null); };
    getUser(req, res, () => { res.redirect = orig; resolve(req.user || null); });
  });
}

// /post-auth — appelé après le callback Kinde, génère un JWT et redirige vers le frontend
router.get('/post-auth', async (req, res) => {
  try {
    const user = await getKindeUser(req, res);
    if (!user) return res.redirect(FRONTEND_URL + '?auth=error');
    const subscription = getUserPlan(user.id) || { plan: 'gratuit', status: 'active' };
    const token = jwt.sign(
      { id: user.id, email: user.email, given_name: user.given_name, family_name: user.family_name, plan: subscription.plan, billing: subscription.billing },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(FRONTEND_URL + '?auth_token=' + token);
  } catch (err) {
    console.error('[/auth/post-auth]', err.message);
    res.redirect(FRONTEND_URL + '?auth=error');
  }
});

// /api/auth/me — vérifie le Bearer token JWT
router.get('/me', (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.json({ authenticated: false });
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const subscription = getUserPlan(payload.id) || { plan: payload.plan || 'gratuit', billing: payload.billing || null, status: 'active' };
    return res.json({
      authenticated: true,
      user: { id: payload.id, email: payload.email, given_name: payload.given_name, family_name: payload.family_name },
      subscription,
    });
  } catch (err) {
    return res.json({ authenticated: false });
  }
});

module.exports = router;
module.exports.getKindeUser = getKindeUser;
