const express = require('express');
const router = express.Router();
const { login, register, logout, callback, getKindeSession } = require('@kinde-oss/kinde-node-express');
const { getUserPlan } = require('../services/subscriptionDb');

// ── Kinde auth routes ──────────────────────────────────────
// Ces routes sont montées à la racine (/login, /register, etc.)
// via setupKinde() dans index.js

/**
 * GET /api/auth/me
 * Retourne l'utilisateur connecté + son plan.
 * Appelé par le frontend pour savoir si l'utilisateur est authentifié.
 */
router.get('/me', async (req, res) => {
  try {
    const session = await getKindeSession(req, res);
    if (!session || !session.isAuthenticated) {
      return res.json({ authenticated: false });
    }
    const { id, email, given_name, family_name, picture } = session.user;
    const planInfo = getUserPlan(id);
    return res.json({
      authenticated: true,
      user: { id, email, given_name, family_name, picture },
      subscription: planInfo,
    });
  } catch (err) {
    return res.json({ authenticated: false });
  }
});

module.exports = router;
