const router = require('express').Router();
const { fetchSIRHData, getAdapter, computeManual } = require('../services/sirh/index');
const { encrypt } = require('../services/encryption');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan } = require('../middleware/requirePlan');

// GET /api/sirh/:provider/auth
router.get('/:provider/auth', requireAuth, requirePlan('croissance'), (req, res, next) => {
  try {
    const adapter = getAdapter(req.params.provider);
    res.json({ authUrl: adapter.getAuthUrl(uuid()), state: uuid() });
  } catch (err) { next(err); }
});

// GET /api/sirh/:provider/callback — flux OAuth externe
router.get('/:provider/callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?sirh_error=${error}`);
    await getAdapter(req.params.provider).exchangeCode(code);
    res.redirect(`${process.env.FRONTEND_URL}/mon-espace.html?sirh_success=${req.params.provider}`);
  } catch (err) { next(err); }
});

// GET /api/sirh/:provider/data
router.get('/:provider/data', requireAuth, requirePlan('croissance'), async (req, res, next) => {
  try {
    const accessToken = req.headers['x-sirh-token'];
    if (!accessToken) return res.status(400).json({ error: 'x-sirh-token manquant.' });

    const result = await fetchSIRHData(req.params.provider, accessToken);
    if (!result.ok) return res.status(502).json({ error: result.error });

    res.json({ success: true, data: result.data, _encrypted: encrypt(result.data) });
  } catch (err) { next(err); }
});

// POST /api/sirh/manual
router.post('/manual', requireAuth, requirePlan('croissance'), (req, res, next) => {
  try {
    const { effectif, ancienneteMoyenneMois, turnover12mois, hasDirectionN1 } = req.body;
    if (effectif == null) return res.status(400).json({ error: 'effectif requis.' });
    const data = computeManual({ effectif, ancienneteMoyenneMois, turnover12mois, hasDirectionN1 });
    res.json({ success: true, data, _encrypted: encrypt(data) });
  } catch (err) { next(err); }
});

module.exports = router;
