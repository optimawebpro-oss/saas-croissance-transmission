const router = require('express').Router();
const bridge = require('../services/banking/bridge');
const { encrypt } = require('../services/encryption');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan } = require('../middleware/requirePlan');

// POST /api/banking/connect
router.post('/connect', requireAuth, requirePlan('croissance'), async (req, res, next) => {
  try {
    const userId = req.user.id; // userId toujours depuis le JWT, jamais du client
    const result = await bridge.createAuthUrl(userId);
    if (!result.ok) return res.status(502).json({ error: result.error });
    res.json({ success: true, authUrl: result.authUrl, expiresAt: result.expiresAt });
  } catch (err) { next(err); }
});

// GET /api/banking/callback — redirect OAuth Bridge (pas de JWT requis ici, flux OAuth externe)
router.get('/callback', async (req, res, next) => {
  try {
    const { error } = req.query;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?banking_error=${error}`);
    res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?banking_success=1`);
  } catch (err) { next(err); }
});

// GET /api/banking/data
router.get('/data', requireAuth, requirePlan('croissance'), async (req, res, next) => {
  try {
    const userId = req.user.id; // ownership : on utilise l'ID du token, jamais d'un header
    const result = await bridge.fetchBankData(userId);
    if (!result.ok) return res.status(502).json({ error: result.error });
    const encrypted = encrypt(result.data);
    res.json({ success: true, data: result.data, _encrypted: encrypted });
  } catch (err) { next(err); }
});

// DELETE /api/banking/revoke
router.delete('/revoke', requireAuth, requirePlan('croissance'), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await bridge.revokeAccess(userId);
    if (!result.ok) return res.status(502).json({ error: result.error });
    res.json({ success: true, message: 'Accès bancaire révoqué. Données supprimées.' });
  } catch (err) { next(err); }
});

module.exports = router;
