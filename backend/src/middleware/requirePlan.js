const { getUserPlan } = require('../services/subscriptionDb');

// Plans ordonnés du plus bas au plus haut
const PLAN_RANK = { gratuit: 0, croissance: 1, cession: 2 };

/**
 * Fabrique un middleware qui exige un plan minimum actif.
 * Doit être utilisé APRÈS requireAuth (req.user doit exister).
 *
 * @param {'croissance'|'cession'} minPlan
 */
function requirePlan(minPlan) {
  return (req, res, next) => {
    const subscription = getUserPlan(req.user.id);
    const plan = subscription?.plan || 'gratuit';
    const status = subscription?.status || 'active';

    // Abonnement expiré ou impayé
    if (status === 'cancelled' || status === 'past_due') {
      return res.status(403).json({
        error: 'Abonnement inactif. Veuillez renouveler votre abonnement.',
        code: 'SUBSCRIPTION_INACTIVE',
      });
    }

    if ((PLAN_RANK[plan] ?? 0) < (PLAN_RANK[minPlan] ?? 1)) {
      return res.status(403).json({
        error: `Cette fonctionnalité nécessite le plan "${minPlan}" ou supérieur.`,
        code: 'PLAN_REQUIRED',
        required: minPlan,
        current: plan,
      });
    }

    next();
  };
}

module.exports = { requirePlan };
