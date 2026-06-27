const router = require('express').Router();
const bridge = require('../services/banking/bridge');
const { encrypt } = require('../services/encryption');

// POST /api/banking/connect — démarre la session Bridge
router.post('/connect', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (!userId) return res.status(400).json({ error: 'userId requis.' });

    const result = await bridge.createAuthUrl(userId);
    if (!result.ok) return res.status(502).json({ error: result.error });

    res.json({ success: true, authUrl: result.authUrl, expiresAt: result.expiresAt });
  } catch (err) { next(err); }
});

// GET /api/banking/callback — redirect OAuth Bridge
router.get('/callback', async (req, res, next) => {
  try {
    const { state, error } = req.query;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?banking_error=${error}`);
    res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?banking_success=1`);
  } catch (err) { next(err); }
});

// GET /api/banking/data — récupère soldes + flux
router.get('/data', async (req, res, next) => {
  try {
    const bridgeUserId = req.headers['x-bridge-user-id'];
    if (!bridgeUserId) return res.status(400).json({ error: 'x-bridge-user-id manquant.' });

    const result = await bridge.fetchBankData(bridgeUserId);
    if (!result.ok) return res.status(502).json({ error: result.error });

    const encrypted = encrypt(result.data);
    res.json({ success: true, data: result.data, _encrypted: encrypted });
  } catch (err) { next(err); }
});

// DELETE /api/banking/revoke — révocation RGPD/PSD2
router.delete('/revoke', async (req, res, next) => {
  try {
    const bridgeUserId = req.headers['x-bridge-user-id'] || req.body.bridgeUserId;
    if (!bridgeUserId) return res.status(400).json({ error: 'bridgeUserId requis.' });

    const result = await bridge.revokeAccess(bridgeUserId);
    if (!result.ok) return res.status(502).json({ error: result.error });

    res.json({ success: true, message: 'Accès bancaire révoqué. Données supprimées.' });
  } catch (err) { next(err); }
});

module.exports = router;
