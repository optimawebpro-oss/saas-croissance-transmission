const express = require('express');
const router = express.Router();
const { getKindeUser } = require('../middleware/kindeAuth');
const { getUserPlan } = require('../services/subscriptionDb');

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const user = await getKindeUser(req, res);
    if (!user) return res.json({ authenticated: false });
    const subscription = getUserPlan(user.id);
    return res.json({
      authenticated: true,
      user: {
        id:          user.id,
        email:       user.email,
        given_name:  user.given_name,
        family_name: user.family_name,
        picture:     user.picture,
      },
      subscription: subscription || { plan: 'gratuit', billing: null, status: 'active' },
    });
  } catch (err) {
    console.error('[/api/auth/me]', err.message);
    return res.json({ authenticated: false });
  }
});

module.exports = router;
