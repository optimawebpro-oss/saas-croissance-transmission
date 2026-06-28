const { getUser } = require('@kinde-oss/kinde-node-express');

/**
 * Récupère l'utilisateur Kinde depuis la session sans rediriger.
 * Retourne l'objet user ou null si non authentifié.
 */
function getKindeUser(req, res) {
  return new Promise((resolve) => {
    const origRedirect = res.redirect.bind(res);
    // Intercepte la redirection que getUser fait si non connecté
    res.redirect = () => {
      res.redirect = origRedirect;
      resolve(null);
    };
    getUser(req, res, () => {
      res.redirect = origRedirect;
      resolve(req.user || null);
    });
  });
}

/**
 * Middleware — vérifie que l'utilisateur est connecté via Kinde.
 * Retourne 401 JSON si non authentifié (pas de redirection).
 */
async function requireAuth(req, res, next) {
  try {
    const user = await getKindeUser(req, res);
    if (!user) {
      return res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
    }
    req.user = user;
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
    const user = await getKindeUser(req, res);
    if (user) req.user = user;
  } catch (_) {}
  next();
}

module.exports = { requireAuth, optionalAuth, getKindeUser };
