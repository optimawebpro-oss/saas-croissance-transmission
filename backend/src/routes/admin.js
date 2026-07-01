'use strict';

/**
 * admin.js — Endpoint lecture seule du journal d'audit (art. 32 RGPD)
 *
 * Protégé par :
 *  1. requireAuth (JWT valide)
 *  2. Header x-admin-key = ADMIN_KEY env var
 *
 * GET /api/admin/audit        — liste paginée, filtrable
 * GET /api/admin/audit/stats  — statistiques agrégées
 * GET /api/admin/audit/export — export complet en JSON (téléchargement)
 */

const router = require('express').Router();
const { requireAuth } = require('../middleware/kindeAuth');
const { query, ACTION } = require('../services/auditTrail');
const audit = require('../services/auditTrail');
const fs    = require('fs');
const path  = require('path');

const AUDIT_FILE = path.join(__dirname, '../../logs/audit.log');

// ── Middleware admin ──────────────────────────────────────
function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    // En dev sans clé configurée : on bloque quand même pour sécurité
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'ADMIN_KEY non configurée en production.' });
    }
    // En dev : on passe mais on logue l'accès
    return next();
  }
  if (req.headers['x-admin-key'] !== adminKey) {
    audit.log({
      action: ACTION.ADMIN, resource: 'administration',
      userId: req.user?.id, email: req.user?.email,
      ip: req.ip, details: { attempt: 'unauthorized_admin_access', path: req.path },
    });
    return res.status(403).json({ error: 'Clé administrateur incorrecte.' });
  }
  next();
}

// ── GET /api/admin/audit — Journal paginé et filtrable ────
router.get('/audit', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const {
      userId, action, resource,
      from, to,
      page  = 1,
      limit = 100,
    } = req.query;

    // Valider les paramètres
    const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

    if (action && !Object.values(ACTION).includes(action.toUpperCase())) {
      return res.status(400).json({ error: `Action inconnue. Valeurs : ${Object.values(ACTION).join(', ')}` });
    }

    const result = query({
      userId, resource,
      action: action?.toUpperCase(),
      from, to,
      page: pageNum,
      limit: limitNum,
    });

    // Logger l'accès admin lui-même
    audit.log({
      action: ACTION.ADMIN, resource: 'administration',
      userId: req.user.id, email: req.user.email,
      ip: req.ip,
      details: { operation: 'audit_read', filters: { userId, action, resource, from, to }, returned: result.entries.length },
    });

    res.json({
      success: true,
      ...result,
      filters: { userId: userId || null, action: action || null, resource: resource || null, from: from || null, to: to || null },
    });
  } catch (err) { next(err); }
});

// ── GET /api/admin/audit/stats — Statistiques agrégées ───
router.get('/audit/stats', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { entries } = query({ from, to, limit: 999999 });

    const byAction   = {};
    const byResource = {};
    const byUser     = {};
    const byDay      = {};

    for (const e of entries) {
      byAction[e.action]     = (byAction[e.action]     || 0) + 1;
      byResource[e.resource] = (byResource[e.resource] || 0) + 1;
      if (e.userId !== 'anonymous' && e.userId !== 'system') {
        byUser[e.userId] = (byUser[e.userId] || 0) + 1;
      }
      const day = (e.timestamp || '').slice(0, 10);
      if (day) byDay[day] = (byDay[day] || 0) + 1;
    }

    // Top 10 utilisateurs les plus actifs (sans exposer les userId complets en prod)
    const topUsers = Object.entries(byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([uid, count]) => ({
        userId: uid.slice(0, 8) + '***',
        count,
      }));

    audit.log({
      action: ACTION.ADMIN, resource: 'administration',
      userId: req.user.id, email: req.user.email,
      ip: req.ip,
      details: { operation: 'audit_stats' },
    });

    res.json({
      success: true,
      total: entries.length,
      periode: { from: from || null, to: to || null },
      byAction,
      byResource,
      topUsers,
      byDay,
    });
  } catch (err) { next(err); }
});

// ── GET /api/admin/audit/export — Export complet (JSON) ──
router.get('/audit/export', requireAuth, requireAdmin, (req, res, next) => {
  try {
    if (!fs.existsSync(AUDIT_FILE)) {
      return res.json({ success: true, entries: [] });
    }

    audit.log({
      action: ACTION.EXPORT, resource: 'administration',
      userId: req.user.id, email: req.user.email,
      ip: req.ip,
      details: { operation: 'audit_full_export' },
    });

    const filename = `audit_export_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream le fichier ligne par ligne → JSON array
    const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean);
    const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    res.send(JSON.stringify({ exported_at: new Date().toISOString(), total: entries.length, entries }, null, 2));
  } catch (err) { next(err); }
});

module.exports = router;
