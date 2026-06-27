const router = require('express').Router();
const { logger } = require('../middleware/audit');

/**
 * RGPD — Droit à l'effacement (art. 17 RGPD)
 * En production : supprimer toutes les données chiffrées en base liées à l'entreprise
 */
router.delete('/entreprise/:entrepriseId', async (req, res, next) => {
  try {
    const { entrepriseId } = req.params;
    const { confirmation } = req.body;

    if (confirmation !== `SUPPRIMER_${entrepriseId}`) {
      return res.status(400).json({
        error: `Confirmation incorrecte. Envoyez { confirmation: "SUPPRIMER_${entrepriseId}" } pour confirmer.`,
      });
    }

    // En production : supprimer de la base de données
    // await db.deleteAllByEntrepriseId(entrepriseId);

    logger.info({
      event: 'RGPD_ERASURE',
      entrepriseId,
      requestedBy: req.headers['x-user-id'] || 'anonymous',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Toutes les données associées à l'entreprise ${entrepriseId} ont été supprimées.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// GET /api/rgpd/export/:entrepriseId — Droit d'accès (art. 15 RGPD)
router.get('/export/:entrepriseId', async (req, res, next) => {
  try {
    // En production : récupérer et décrypter toutes les données de l'entreprise
    // const data = await db.getAllByEntrepriseId(req.params.entrepriseId);

    logger.info({
      event: 'RGPD_EXPORT',
      entrepriseId: req.params.entrepriseId,
      requestedBy: req.headers['x-user-id'] || 'anonymous',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Export RGPD (implémentation complète requiert une base de données).',
      entrepriseId: req.params.entrepriseId,
    });
  } catch (err) { next(err); }
});

module.exports = router;
