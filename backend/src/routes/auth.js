const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getUserPlan } = require('../services/subscriptionDb');

const JWT_SECRET = process.env.SESSION_SECRET || 'evoluty-secret';

// GET /api/auth/me — vérifie le token JWT envoyé en Authorization header
router.get('/me', (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.json({ authenticated: false });
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const subscription = getUserPlan(payload.id) || { plan: payload.plan || 'gratuit', billing: payload.billing || null, status: 'active' };
    return res.json({
      authenticated: true,
      user: { id: payload.id, email: payload.email, given_name: payload.given_name, family_name: payload.family_name },
      subscription,
    });
  } catch {
    return res.json({ authenticated: false });
  }
});

module.exports = router;
