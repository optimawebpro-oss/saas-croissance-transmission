const router = require('express').Router();
const { fetchCRMData, getAdapter } = require('../services/crm/index');
const { encrypt } = require('../services/encryption');
const { v4: uuid } = require('uuid');

// GET /api/crm/:provider/auth — URL OAuth
router.get('/:provider/auth', (req, res, next) => {
  try {
    const adapter = getAdapter(req.params.provider);
    const state = uuid();
    const url = adapter.getAuthUrl(state);
    res.json({ authUrl: url, state });
  } catch (err) { next(err); }
});

// GET /api/crm/:provider/callback — OAuth callback
router.get('/:provider/callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?crm_error=${error}`);

    const adapter = getAdapter(req.params.provider);
    const tokens = await adapter.exchangeCode(code);

    // En prod : stocker tokens chiffrés en base, associés au userId
    const encrypted = encrypt(tokens);
    res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?crm_success=${req.params.provider}`);
  } catch (err) { next(err); }
});

// GET /api/crm/:provider/data — données normalisées
router.get('/:provider/data', async (req, res, next) => {
  try {
    const accessToken = req.headers['x-crm-token'];
    if (!accessToken) return res.status(400).json({ error: 'x-crm-token manquant.' });

    const result = await fetchCRMData(req.params.provider, accessToken);
    if (!result.ok) return res.status(502).json({ error: result.error });

    const encrypted = encrypt(result.data);
    res.json({ success: true, data: result.data, _encrypted: encrypted });
  } catch (err) { next(err); }
});

module.exports = router;
