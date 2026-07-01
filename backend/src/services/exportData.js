'use strict';

const fs   = require('fs');
const path = require('path');
const { getUserPlan }            = require('./subscriptionDb');
const { getFreeDiagnosticsUsed } = require('./usageDb');

const DOCUMENTS_DIR     = path.join(__dirname, '../../data/documents');
const AUDIT_LOG_PATH    = path.join(__dirname, '../../logs/audit.log');
const EXPORT_TOKENS_PATH = path.join(__dirname, '../../data/export_tokens.json');

// ── Tokens temporaires (7 jours) ─────────────────────────

function readTokens() {
  if (!fs.existsSync(EXPORT_TOKENS_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(EXPORT_TOKENS_PATH, 'utf8')); } catch { return {}; }
}

function writeTokens(data) {
  fs.mkdirSync(path.dirname(EXPORT_TOKENS_PATH), { recursive: true });
  fs.writeFileSync(EXPORT_TOKENS_PATH, JSON.stringify(data, null, 2));
}

function createExportToken(userId) {
  const tokens = readTokens();
  // Purge les tokens expirés
  const now = Date.now();
  for (const [k, v] of Object.entries(tokens)) {
    if (v.expiresAt < now) delete tokens[k];
  }
  const token = require('uuid').v4();
  tokens[token] = { userId, expiresAt: now + 7 * 24 * 60 * 60 * 1000, createdAt: new Date().toISOString() };
  writeTokens(tokens);
  return token;
}

function resolveExportToken(token) {
  const tokens = readTokens();
  const entry = tokens[token];
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) return null;
  return entry.userId;
}

// ── Collecte des données ──────────────────────────────────

function getUserDocuments(userId) {
  const userDir = path.join(DOCUMENTS_DIR, userId);
  if (!fs.existsSync(userDir)) return [];
  return fs.readdirSync(userDir).map(f => {
    const stat = fs.statSync(path.join(userDir, f));
    return { nom: f, taille_octets: stat.size, date_upload: stat.birthtime.toISOString() };
  });
}

function getUserAuditLogs(userId) {
  if (!fs.existsSync(AUDIT_LOG_PATH)) return [];
  const lines = fs.readFileSync(AUDIT_LOG_PATH, 'utf8').split('\n').filter(Boolean);
  const logs = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      // Inclure les entrées qui concernent cet utilisateur
      if (entry.userId === userId || entry.requestedBy === userId) {
        logs.push({
          date:      entry.timestamp,
          evenement: entry.event || entry.message,
          methode:   entry.method,
          chemin:    entry.path,
          ip:        entry.ip,
        });
      }
    } catch { /* ligne non-JSON, on ignore */ }
  }
  return logs.slice(-200); // 200 derniers logs max
}

function buildExport(userId, userJwt) {
  const subscription = getUserPlan(userId) || {};
  const diagnosticsUsed = getFreeDiagnosticsUsed(userId);

  return {
    meta: {
      version:       '1.0',
      exported_at:   new Date().toISOString(),
      base_legale:   'Art. 15 RGPD — Droit d\'accès',
      retention:     'Ce fichier contient vos données personnelles au moment de l\'export.',
    },
    profil: {
      id:         userId,
      email:      userJwt.email      || null,
      prenom:     userJwt.given_name  || null,
      nom:        userJwt.family_name || null,
    },
    abonnement: {
      plan:       subscription.plan   || 'gratuit',
      statut:     subscription.status || 'active',
      facturation: subscription.billing || null,
      mis_a_jour: subscription.updatedAt || null,
      // Pas de stripeCustomerId ni stripeSubscriptionId (données bancaires exclues)
    },
    usage_ia: {
      diagnostics_utilises: diagnosticsUsed,
    },
    documents_transmis: getUserDocuments(userId),
    logs_connexion:     getUserAuditLogs(userId),
  };
}

module.exports = { buildExport, createExportToken, resolveExportToken };
