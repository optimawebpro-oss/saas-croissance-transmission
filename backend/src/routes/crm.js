const router = require('express').Router();
const { fetchCRMData, getAdapter } = require('../services/crm/index');

const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan } = require('../middleware/requirePlan');

// GET /api/crm/:provider/auth
router.get('/:provider/auth', requireAuth, (req, res, next) => {
  try {
    const adapter = getAdapter(req.params.provider);
    const state = uuid();
    res.json({ authUrl: adapter.getAuthUrl(state), state });
  } catch (err) { next(err); }
});

// GET /api/crm/:provider/callback — flux OAuth externe, pas de JWT
router.get('/:provider/callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?crm_error=${error}`);
    const adapter = getAdapter(req.params.provider);
    await adapter.exchangeCode(code);
    res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?crm_success=${req.params.provider}`);
  } catch (err) { next(err); }
});

// GET /api/crm/:provider/data
router.get('/:provider/data', requireAuth, async (req, res, next) => {
  try {
    // Le token CRM doit être lié à l'utilisateur en base (en prod) — ici on valide a minima le JWT
    const accessToken = req.headers['x-crm-token'];
    if (!accessToken) return res.status(400).json({ error: 'x-crm-token manquant.' });

    const result = await fetchCRMData(req.params.provider, accessToken);
    if (!result.ok) return res.status(502).json({ error: result.error });

    res.json({ success: true, data: result.data });
  } catch (err) { next(err); }
});

module.exports = router;
