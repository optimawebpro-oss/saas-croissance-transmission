const { getKindeSession } = require('@kinde-oss/kinde-node-express');

/**
 * Middleware — vérifie que l'utilisateur est connecté via Kinde.
 * Attache req.user si valide, sinon renvoie 401.
 */
async function requireAuth(req, res, next) {
  try {
    const session = await getKindeSession(req, res);
    if (!session || !session.isAuthenticated) {
      return res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
    }
    req.user = session.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide.' });
  }
}

/**
 * Middleware optionnel — attache req.user si connecté, continue sinon.
 */
async function optionalAuth(req, res, next) {
  try {
    const session = await getKindeSession(req, res);
    if (session && session.isAuthenticated) req.user = session.user;
  } catch (_) {}
  next();
}

module.exports = { requireAuth, optionalAuth };
