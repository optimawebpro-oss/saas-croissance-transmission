'use strict';

/**
 * purge.js — Moteur de purge RGPD automatique
 *
 * Règles de conservation (art. 5(1)(e) RGPD) :
 *  R1 — Documents & historique IA   : 30 jours après fin de mission
 *  R2 — Données prospects           : 3 ans après dernier contact
 *  R3 — Comptes clôturés            : suppression complète 30 jours après clôture
 *  R4 — Logs de connexion           : 12 mois
 *  R5 — Factures                    : 10 ans — NE PAS SUPPRIMER
 */

const fs   = require('fs');
const path = require('path');

// ── Chemins ──────────────────────────────────────────────
const { DATA_DIR, LOGS_DIR } = require('../config/storage');
const SUBSCRIPTIONS   = path.join(DATA_DIR, 'subscriptions.json');
const USAGE_DB        = path.join(DATA_DIR, 'usage.json');
const DOCUMENTS_DIR   = path.join(DATA_DIR, 'documents');
const PROSPECTS_DB    = path.join(DATA_DIR, 'prospects.json');
const AUDIT_LOG       = path.join(LOGS_DIR, 'audit.log');
const PURGE_LOG       = path.join(LOGS_DIR, 'purge.log');

// ── Durées (ms) ───────────────────────────────────────────
const DAY_MS   = 24 * 60 * 60 * 1000;
const DAYS_30  = 30  * DAY_MS;
const MONTHS_12 = 365 * DAY_MS;
const YEARS_3  = 3 * 365 * DAY_MS;

// ── Logger de purge ───────────────────────────────────────

function logPurge(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.appendFileSync(PURGE_LOG, line, 'utf8');
}

// ── Helpers ───────────────────────────────────────────────

function readJSON(file) {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function ageMs(isoDate) {
  return Date.now() - new Date(isoDate).getTime();
}

// ── R1 : Documents — 30 jours après fin de mission ───────
// "Fin de mission" = cancelledAt sur le compte, ou mtime du fichier si pas de date

function purgeDocuments(subscriptions) {
  const result = { rule: 'R1_DOCUMENTS_30J', deleted: 0, errors: 0, detail: [] };
  if (!fs.existsSync(DOCUMENTS_DIR)) return result;

  const userDirs = fs.readdirSync(DOCUMENTS_DIR);

  for (const userId of userDirs) {
    const userDir = path.join(DOCUMENTS_DIR, userId);
    if (!fs.statSync(userDir).isDirectory()) continue;

    const sub = subscriptions[userId];
    let referenceDate = null;

    // Priorité 1 : date de clôture explicite
    if (sub?.cancelledAt) referenceDate = sub.cancelledAt;
    // Priorité 2 : mission terminée (champ missionEndedAt si présent)
    else if (sub?.missionEndedAt) referenceDate = sub.missionEndedAt;

    const files = fs.readdirSync(userDir);
    for (const file of files) {
      const filePath = path.join(userDir, file);
      try {
        const stat = fs.statSync(filePath);
        // Si on a une date de fin de mission, on purge 30j après
        // Sinon, on purge si le fichier n'a pas été touché depuis 30j ET le compte est inactif
        const isCancelled = sub?.status === 'cancelled' || sub?.status === 'past_due';
        const fileAge = Date.now() - stat.mtimeMs;

        let shouldDelete = false;
        if (referenceDate && ageMs(referenceDate) > DAYS_30) {
          shouldDelete = true;
        } else if (!referenceDate && isCancelled && fileAge > DAYS_30) {
          shouldDelete = true;
        }

        if (shouldDelete) {
          fs.unlinkSync(filePath);
          result.deleted++;
          result.detail.push({ userId, file, reason: referenceDate ? `missionEnd+30j` : `compte_inactif+30j` });
          logPurge({ rule: 'R1', action: 'DELETE_DOCUMENT', userId, file });
        }
      } catch (err) {
        result.errors++;
        logPurge({ rule: 'R1', action: 'ERROR', userId, file, error: err.message });
      }
    }

    // Supprimer le dossier s'il est vide
    try {
      if (fs.readdirSync(userDir).length === 0) fs.rmdirSync(userDir);
    } catch { /* ignore */ }
  }

  return result;
}

// ── R2 : Prospects — 3 ans après dernier contact ─────────

function purgeProspects() {
  const result = { rule: 'R2_PROSPECTS_3ANS', deleted: 0, errors: 0, detail: [] };
  const db = readJSON(PROSPECTS_DB);
  if (!Object.keys(db).length) return result;

  let modified = false;
  for (const [id, prospect] of Object.entries(db)) {
    try {
      const lastContact = prospect.lastContactAt || prospect.createdAt;
      if (!lastContact) continue;

      if (ageMs(lastContact) > YEARS_3) {
        delete db[id];
        modified = true;
        result.deleted++;
        result.detail.push({ id, lastContact, reason: 'dernier_contact+3ans' });
        logPurge({ rule: 'R2', action: 'DELETE_PROSPECT', prospectId: id, lastContact });
      }
    } catch (err) {
      result.errors++;
      logPurge({ rule: 'R2', action: 'ERROR', prospectId: id, error: err.message });
    }
  }

  if (modified) writeJSON(PROSPECTS_DB, db);
  return result;
}

// ── R3 : Comptes clôturés — suppression complète 30j après clôture ──

function purgeClosedAccounts(subscriptions) {
  const result = { rule: 'R3_COMPTES_CLOTURES_30J', deleted: 0, errors: 0, detail: [] };
  let modified = false;

  for (const [userId, sub] of Object.entries(subscriptions)) {
    if (sub.status !== 'cancelled') continue;
    if (!sub.cancelledAt) continue;

    try {
      if (ageMs(sub.cancelledAt) > DAYS_30) {
        // Supprimer les documents
        const userDir = path.join(DOCUMENTS_DIR, userId);
        if (fs.existsSync(userDir)) {
          fs.rmSync(userDir, { recursive: true, force: true });
          logPurge({ rule: 'R3', action: 'DELETE_DOCUMENTS_DIR', userId });
        }

        // Supprimer l'usage
        const usage = readJSON(USAGE_DB);
        if (usage[userId]) {
          delete usage[userId];
          writeJSON(USAGE_DB, usage);
          logPurge({ rule: 'R3', action: 'DELETE_USAGE', userId });
        }

        // Supprimer l'abonnement (conserver les factures = on garde uniquement un enregistrement anonyme)
        delete subscriptions[userId];
        modified = true;
        result.deleted++;
        result.detail.push({ userId, cancelledAt: sub.cancelledAt, reason: 'cloture+30j' });
        logPurge({ rule: 'R3', action: 'DELETE_ACCOUNT_DATA', userId, cancelledAt: sub.cancelledAt });
      }
    } catch (err) {
      result.errors++;
      logPurge({ rule: 'R3', action: 'ERROR', userId, error: err.message });
    }
  }

  return { result, modified };
}

// ── R4 : Logs de connexion — 12 mois ─────────────────────

function purgeAuditLogs() {
  const result = { rule: 'R4_LOGS_12MOIS', deleted: 0, errors: 0 };
  if (!fs.existsSync(AUDIT_LOG)) return result;

  try {
    const lines = fs.readFileSync(AUDIT_LOG, 'utf8').split('\n').filter(Boolean);
    const cutoff = Date.now() - MONTHS_12;
    const kept = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const ts = new Date(entry.timestamp || entry['@timestamp']).getTime();
        if (!isNaN(ts) && ts < cutoff) {
          result.deleted++;
        } else {
          kept.push(line);
        }
      } catch {
        kept.push(line); // ligne non-JSON → garder par sécurité
      }
    }

    if (result.deleted > 0) {
      fs.writeFileSync(AUDIT_LOG, kept.join('\n') + (kept.length ? '\n' : ''), 'utf8');
      logPurge({ rule: 'R4', action: 'PURGE_AUDIT_LOGS', deletedLines: result.deleted });
    }
  } catch (err) {
    result.errors++;
    logPurge({ rule: 'R4', action: 'ERROR', error: err.message });
  }

  return result;
}

// ── Purge tokens d'export expirés (maintenance) ───────────

function purgeExpiredExportTokens() {
  const TOKENS_FILE = path.join(DATA_DIR, 'export_tokens.json');
  if (!fs.existsSync(TOKENS_FILE)) return;
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    const now = Date.now();
    let deleted = 0;
    for (const [k, v] of Object.entries(tokens)) {
      if (v.expiresAt < now) { delete tokens[k]; deleted++; }
    }
    if (deleted > 0) {
      writeJSON(TOKENS_FILE, tokens);
      logPurge({ rule: 'MAINTENANCE', action: 'PURGE_EXPORT_TOKENS', deleted });
    }
  } catch { /* non bloquant */ }
}

// ── Orchestrateur principal ───────────────────────────────

async function runPurge() {
  const startedAt = new Date().toISOString();
  logPurge({ event: 'PURGE_START', startedAt });

  const subscriptions = readJSON(SUBSCRIPTIONS);

  const r1 = purgeDocuments(subscriptions);
  const r2 = purgeProspects();
  const { result: r3, modified: subsModified } = purgeClosedAccounts(subscriptions);
  const r4 = purgeAuditLogs();
  purgeExpiredExportTokens();

  // Persister subscriptions si R3 a supprimé des entrées
  if (subsModified) writeJSON(SUBSCRIPTIONS, subscriptions);

  const summary = {
    event:      'PURGE_COMPLETE',
    startedAt,
    finishedAt: new Date().toISOString(),
    rules: { r1, r2, r3, r4 },
    totals: {
      deleted: r1.deleted + r2.deleted + r3.deleted + r4.deleted,
      errors:  r1.errors  + r2.errors  + r3.errors  + r4.errors,
    },
  };

  logPurge(summary);
  return summary;
}

module.exports = { runPurge, PURGE_LOG };
