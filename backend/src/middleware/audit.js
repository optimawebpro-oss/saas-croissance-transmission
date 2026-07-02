'use strict';

/**
 * audit.js — Middleware d'audit RGPD (art. 32)
 *
 * Couvre TOUTES les routes /api/* après réponse (hook sur res.end).
 * Exclut : /health, assets statiques, options CORS.
 *
 * Ne logue PAS le body des requêtes (données personnelles brutes).
 * Logue uniquement : qui, quand, quelle action, quelle ressource, code HTTP.
 */

const jwt    = require('jsonwebtoken');
const audit  = require('../services/auditTrail');

const JWT_SECRET = process.env.SESSION_SECRET || '';

// Routes non pertinentes à journaliser
const SKIP_PATHS = ['/health', '/favicon'];
const SKIP_METHODS = ['OPTIONS'];

function extractUserFromReq(req) {
  if (req.user) return req.user; // déjà décodé par requireAuth
  try {
    const header = req.headers?.authorization;
    if (header?.startsWith('Bearer ')) {
      return jwt.verify(header.slice(7), JWT_SECRET);
    }
  } catch { /* token invalide ou absent */ }
  return null;
}

function auditMiddleware(req, res, next) {
  // Ignorer les routes non pertinentes
  if (SKIP_METHODS.includes(req.method)) return next();
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/login') && !req.path.startsWith('/logout') && !req.path.startsWith('/callback')) {
    return next();
  }
  if (SKIP_PATHS.some(p => req.path.startsWith(p))) return next();

  // Extraire l'utilisateur au plus tôt (avant requireAuth éventuel)
  const user = extractUserFromReq(req);
  if (user) req.user = req.user || user;

  // Hook sur res.end pour capturer le statusCode réel
  const originalEnd = res.end.bind(res);
  let logged = false;
  res.end = function (...args) {
    const result = originalEnd(...args);
    if (!logged) {
      logged = true;
      const details = buildDetails(req);
      audit.fromRequest(req, res.statusCode, details);
    }
    return result;
  };

  next();
}

/**
 * buildDetails() — extrait les métadonnées pertinentes selon la route.
 * Ne lit JAMAIS le body complet — uniquement ce qui est safe à logger.
 */
function buildDetails(req) {
  const p = req.path;
  const m = req.method.toUpperCase();

  // Profil : quels champs ont été soumis (pas leurs valeurs)
  if (p.startsWith('/api/profil') && (m === 'PATCH' || m === 'PUT')) {
    const fields = req.body ? Object.keys(req.body).filter(k => k !== 'password') : [];
    return { champsModifies: fields };
  }

  // Documents : type de document
  if (p.startsWith('/api/documents') && m === 'POST') {
    return { type: req.body?.type || 'inconnu' };
  }

  // RGPD : type d'opération
  if (p.startsWith('/api/rgpd')) {
    if (p.includes('/compte') && m === 'DELETE') return { operation: 'suppression_compte' };
    if (p.includes('/export'))                   return { operation: 'export_donnees' };
    if (p.includes('/download'))                 return { operation: 'telechargement_export' };
    if (p.includes('/purge'))                    return { operation: 'purge_manuelle' };
  }

  // Mistral : on note juste qu'une requête IA a eu lieu (pas le prompt)
  if (p.startsWith('/api/mistral')) {
    return { module: req.body?.module || 'ia' };
  }

  // Auth : login/logout
  if (p.startsWith('/callback')) return { operation: 'oauth_callback' };
  if (p.startsWith('/login'))    return { operation: 'login_redirect' };
  if (p.startsWith('/logout'))   return { operation: 'logout' };

  return null;
}

// ── Logger Winston conservé pour rétro-compatibilité ─────
// (stripe.js et quelques routes l'importent encore directement)
const { createLogger, format, transports } = require('winston');
const { LOGS_DIR } = require('../config/storage');
const path = require('path');

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), format.json()),
  transports: [
    new transports.File({ filename: path.join(LOGS_DIR, 'app.log') }),
    new transports.Console({ format: format.simple() }),
  ],
});

// Wrapper : toutes les écritures via logger.info/warn/error vont aussi dans l'audit trail
const originalInfo = logger.info.bind(logger);
logger.info = function (entry, ...args) {
  originalInfo(entry, ...args);
  // Écrire dans l'audit trail si l'entrée a un champ `event` RGPD
  if (entry && typeof entry === 'object' && entry.event) {
    audit.log({
      action:   resolveActionFromEvent(entry.event),
      resource: resolveResourceFromEvent(entry.event),
      userId:   entry.userId || entry.kindeUserId || entry.requestedBy || 'system',
      email:    entry.userEmail || null,
      details:  sanitizeEventDetails(entry),
    });
  }
};

function resolveActionFromEvent(event) {
  if (!event) return audit.ACTION.READ;
  if (event.includes('DELETION') || event.includes('ERASURE') || event.includes('DELETE')) return audit.ACTION.DELETE;
  if (event.includes('EXPORT') || event.includes('DOWNLOAD')) return audit.ACTION.EXPORT;
  if (event.includes('PURGE'))  return audit.ACTION.PURGE;
  if (event.includes('UPDATED') || event.includes('ACTIVATED') || event.includes('CREATED')) return audit.ACTION.WRITE;
  return audit.ACTION.READ;
}

function resolveResourceFromEvent(event) {
  if (!event) return 'inconnu';
  if (event.includes('ACCOUNT') || event.includes('PROFILE')) return 'profil';
  if (event.includes('RGPD') || event.includes('ERASURE') || event.includes('EXPORT')) return 'rgpd_operations';
  if (event.includes('SUBSCRIPTION') || event.includes('STRIPE')) return 'facturation';
  if (event.includes('PURGE')) return 'purge_rgpd';
  return 'systeme';
}

function sanitizeEventDetails(entry) {
  // Exclure les champs trop verbeux ou déjà présents dans le schéma principal
  const { event, userId, kindeUserId, requestedBy, userEmail, timestamp, ...rest } = entry;
  return Object.keys(rest).length ? { event, ...rest } : { event };
}

module.exports = { auditLog: auditMiddleware, logger };
