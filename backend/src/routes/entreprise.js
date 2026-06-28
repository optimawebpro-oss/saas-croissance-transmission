const router = require('express').Router();
const { searchBySiret } = require('../services/pappers');
const { encrypt } = require('../services/encryption');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan } = require('../middleware/requirePlan');

// GET /api/entreprise/siret/:siret
router.get('/siret/:siret', requireAuth, requirePlan('croissance'), async (req, res, next) => {
  try {
    const result = await searchBySiret(req.params.siret);
    if (!result.ok) return res.status(422).json({ error: result.error });

    // Chiffrer les données avant stockage (simulation — en prod: persister en base)
    const encrypted = encrypt(result.data);

    res.json({
      success: true,
      data: result.data,
      source: result.source,
      _encrypted: encrypted, // À stocker en base, ne jamais renvoyer en prod
    });
  } catch (err) { next(err); }
});

module.exports = router;
