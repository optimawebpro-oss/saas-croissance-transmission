'use strict';

/**
 * auditTrail.js — Journal d'audit RGPD centralisé (append-only)
 *
 * Schéma de chaque entrée :
 * {
 *   id          : UUID v4 (identifiant unique de l'entrée)
 *   timestamp   : ISO 8601
 *   userId      : identifiant Kinde ou "anonymous"
 *   userEmail   : email masqué (an***@domain.com) ou null
 *   action      : READ | WRITE | DELETE | EXPORT | LOGIN | PURGE | ADMIN
 *   resource    : catégorie de données (profil, documents, ia_prompts, …)
 *   details     : objet libre (champs modifiés, ancienne/nouvelle valeur, …)
 *   ip          : adresse IP du demandeur
 *   userAgent   : User-Agent HTTP
 *   statusCode  : code HTTP de la réponse (renseigné après réponse)
 * }
 *
 * Le fichier est append-only : on n'écrit jamais par-dessus une ligne existante.
 * La purge des entrées >12 mois est assurée par purge.js (R4).
 */

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { LOGS_DIR } = require('../config/storage');
const AUDIT_FILE = path.join(LOGS_DIR, 'audit.log');

// ── Actions normalisées ───────────────────────────────────
const ACTION = {
  READ:   'READ',
  WRITE:  'WRITE',
  DELETE: 'DELETE',
  EXPORT: 'EXPORT',
  LOGIN:  'LOGIN',
  PURGE:  'PURGE',
  ADMIN:  'ADMIN',
};

// ── Ressources par préfixe de route ──────────────────────
const ROUTE_RESOURCE = [
  ['/api/profil',         'profil'],
  ['/api/documents',      'documents'],
  ['/api/mistral',        'ia_prompts'],
  ['/api/fec',            'fec'],
  ['/api/banking',        'open_banking'],
  ['/api/crm',            'crm'],
  ['/api/sirh',           'sirh'],
  ['/api/rgpd',           'rgpd_operations'],
  ['/api/stripe',         'facturation'],
  ['/api/auth',           'authentification'],
  ['/api/questionnaire',  'questionnaire'],
  ['/api/entreprise',     'entreprise'],
  ['/api/juridique',      'juridique'],
  ['/api/inpi',           'registre_entreprises'],
  ['/api/compta',         'comptabilite'],
  ['/api/benchmarks',     'benchmarks'],
  ['/api/admin',          'administration'],
];

function resolveResource(routePath) {
  const match = ROUTE_RESOURCE.find(([prefix]) => routePath.startsWith(prefix));
  return match ? match[1] : 'autre';
}

// ── Action depuis méthode HTTP + route ───────────────────
function resolveAction(method, routePath) {
  const m = method.toUpperCase();
  if (routePath.includes('/export') || routePath.includes('/download')) return ACTION.EXPORT;
  if (routePath.includes('/purge'))  return ACTION.PURGE;
  if (routePath.includes('/login') || routePath.includes('/callback')) return ACTION.LOGIN;
  if (m === 'GET')    return ACTION.READ;
  if (m === 'DELETE') return ACTION.DELETE;
  if (m === 'POST' || m === 'PATCH' || m === 'PUT') return ACTION.WRITE;
  return ACTION.READ;
}

// ── Masquage email ─────────────────────────────────────────
function maskEmail(email) {
  if (!email || !email.includes('@')) return email || null;
  const [local, domain] = email.split('@');
  return local.slice(0, 2) + '***@' + domain;
}

// ── Écriture append-only ──────────────────────────────────
function append(entry) {
  try {
    fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    // Ne jamais planter l'app si le log échoue
    console.error('[AuditTrail] Erreur écriture :', err.message);
  }
}

// ── API publique ──────────────────────────────────────────

/**
 * log() — point d'entrée principal pour toutes les sources.
 *
 * @param {object} opts
 * @param {string}  opts.action     - ACTION.* constant
 * @param {string}  opts.resource   - catégorie de données
 * @param {string}  [opts.userId]   - identifiant Kinde
 * @param {string}  [opts.email]    - email brut (sera masqué automatiquement)
 * @param {object}  [opts.details]  - contexte métier (champs, valeurs, …)
 * @param {string}  [opts.ip]
 * @param {string}  [opts.userAgent]
 * @param {number}  [opts.statusCode]
 */
function log({ action, resource, userId, email, details, ip, userAgent, statusCode }) {
  append({
    id:         uuidv4(),
    timestamp:  new Date().toISOString(),
    userId:     userId  || 'anonymous',
    userEmail:  maskEmail(email),
    action:     action  || ACTION.READ,
    resource:   resource || 'inconnu',
    details:    details || null,
    ip:         ip       || null,
    userAgent:  userAgent || null,
    statusCode: statusCode || null,
  });
}

/**
 * fromRequest() — construit automatiquement une entrée depuis un objet Express req/res.
 * Appelé par le middleware après que la réponse a été envoyée.
 */
function fromRequest(req, statusCode, extraDetails) {
  const user     = req.user;
  const resource = resolveResource(req.path);
  const action   = resolveAction(req.method, req.path);

  log({
    action,
    resource,
    userId:     user?.id    || 'anonymous',
    email:      user?.email || null,
    ip:         req.ip || req.connection?.remoteAddress,
    userAgent:  req.headers?.['user-agent'],
    statusCode,
    details:    extraDetails || null,
  });
}

// ── Lecture pour l'endpoint admin ─────────────────────────

/**
 * query() — lit le journal avec filtres et pagination.
 *
 * @param {object} opts
 * @param {string}  [opts.userId]     - filtrer par userId
 * @param {string}  [opts.action]     - filtrer par action
 * @param {string}  [opts.resource]   - filtrer par ressource
 * @param {string}  [opts.from]       - ISO date début
 * @param {string}  [opts.to]         - ISO date fin
 * @param {number}  [opts.page=1]
 * @param {number}  [opts.limit=100]
 * @returns {{ entries: object[], total: number, pages: number }}
 */
function query({ userId, action, resource, from, to, page = 1, limit = 100 } = {}) {
  if (!fs.existsSync(AUDIT_FILE)) return { entries: [], total: 0, pages: 0 };

  const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean);

  const fromTs = from ? new Date(from).getTime() : null;
  const toTs   = to   ? new Date(to).getTime()   : null;

  const filtered = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (userId   && e.userId   !== userId)   continue;
      if (action   && e.action   !== action)   continue;
      if (resource && e.resource !== resource) continue;
      const ts = new Date(e.timestamp).getTime();
      if (fromTs && ts < fromTs) continue;
      if (toTs   && ts > toTs)   continue;
      filtered.push(e);
    } catch { /* ligne corrompue — ignorer */ }
  }

  // Ordre anti-chronologique (plus récent en premier)
  filtered.reverse();

  const total   = filtered.length;
  const pages   = Math.ceil(total / limit) || 1;
  const offset  = (Math.max(page, 1) - 1) * limit;
  const entries = filtered.slice(offset, offset + limit);

  return { entries, total, pages, page: Math.max(page, 1) };
}

module.exports = { log, fromRequest, query, ACTION, resolveResource, resolveAction };
