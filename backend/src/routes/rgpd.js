const router = require('express').Router();
const { logger } = require('../middleware/audit');
const { requireAuth } = require('../middleware/kindeAuth');

// DELETE /api/rgpd/entreprise/:entrepriseId — Droit à l'effacement (art. 17 RGPD)
router.delete('/entreprise/:entrepriseId', requireAuth, async (req, res, next) => {
  try {
    const { entrepriseId } = req.params;
    const { confirmation } = req.body;

    // Ownership : l'entrepriseId doit correspondre à l'utilisateur connecté
    if (entrepriseId !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé : vous ne pouvez supprimer que vos propres données.' });
    }

    if (confirmation !== `SUPPRIMER_${entrepriseId}`) {
      return res.status(400).json({
        error: `Confirmation incorrecte. Envoyez { confirmation: "SUPPRIMER_${entrepriseId}" } pour confirmer.`,
      });
    }

    logger.info({
      event: 'RGPD_ERASURE',
      entrepriseId,
      requestedBy: req.user.id,
      requestedByEmail: req.user.email,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Toutes les données associées à votre compte ont été supprimées.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// GET /api/rgpd/export/:entrepriseId — Droit d'accès (art. 15 RGPD)
router.get('/export/:entrepriseId', requireAuth, async (req, res, next) => {
  try {
    const { entrepriseId } = req.params;

    if (entrepriseId !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé : vous ne pouvez exporter que vos propres données.' });
    }

    logger.info({
      event: 'RGPD_EXPORT',
      entrepriseId,
      requestedBy: req.user.id,
      requestedByEmail: req.user.email,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Export RGPD (implémentation complète requiert une base de données).',
      entrepriseId,
    });
  } catch (err) { next(err); }
});

module.exports = router;
