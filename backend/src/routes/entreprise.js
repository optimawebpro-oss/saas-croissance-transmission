const router = require('express').Router();
const { searchBySiret } = require('../services/pappers');

const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan } = require('../middleware/requirePlan');

// GET /api/entreprise/siret/:siret
router.get('/siret/:siret', requireAuth, requirePlan('croissance'), async (req, res, next) => {
  try {
    const result = await searchBySiret(req.params.siret);
    if (!result.ok) return res.status(422).json({ error: result.error });

    res.json({ success: true, data: result.data, source: result.source });
  } catch (err) { next(err); }
});

module.exports = router;
