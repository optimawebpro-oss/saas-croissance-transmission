const router = require('express').Router();
const { fetchJuridique } = require('../services/infogreffe');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan } = require('../middleware/requirePlan');

// GET /api/juridique/:siren
router.get('/:siren', requireAuth, async (req, res, next) => {
  try {
    const result = await fetchJuridique(req.params.siren);
    if (!result.ok) return res.status(422).json({ error: result.error });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
