'use strict';

const router = require('express').Router();
const { logger }       = require('../middleware/audit');
const { requireAuth }  = require('../middleware/kindeAuth');
const { deleteAccount }                              = require('../services/accountDeletion');
const { buildExport, createExportToken, resolveExportToken } = require('../services/exportData');
const { runPurge }                                   = require('../services/purgeScheduler');
const fs   = require('fs');
const path = require('path');
const { LOGS_DIR } = require('../config/storage');
const PURGE_LOG = path.join(LOGS_DIR, 'purge.log');

// ── GET /api/rgpd/export — Génère un lien de téléchargement temporaire (7j) ──
router.get('/export', requireAuth, (req, res, next) => {
  try {
    const userId = req.user.id;

    logger.info({ event: 'RGPD_EXPORT_REQUESTED', userId, timestamp: new Date().toISOString() });

    const token   = createExportToken(userId);
    const baseUrl = process.env.FRONTEND_URL
      ? process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`
      : `${req.protocol}://${req.get('host')}`;

    res.json({
      success:    true,
      download_url: `${baseUrl}/api/rgpd/download/${token}`,
      expires_in:   '7 jours',
      expires_at:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) { next(err); }
});

// ── GET /api/rgpd/download/:token — Téléchargement direct du JSON ─────────────
router.get('/download/:token', (req, res, next) => {
  try {
    const userId = resolveExportToken(req.params.token);
    if (!userId) {
      return res.status(404).json({ error: 'Lien invalide ou expiré.' });
    }

    // On reconstruit le JWT partiel depuis le token de session si disponible,
    // sinon on passe un objet vide (le profil sera incomplet mais les données locales seront là)
    const userJwt = req.user || {};
    const data    = buildExport(userId, userJwt);
    const filename = `apogee_export_${userId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`;

    logger.info({ event: 'RGPD_EXPORT_DOWNLOADED', userId, timestamp: new Date().toISOString() });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  } catch (err) { next(err); }
});

// ── GET /api/rgpd/export/direct — Téléchargement immédiat (authentifié) ──────
router.get('/export/direct', requireAuth, (req, res, next) => {
  try {
    const userId = req.user.id;
    const data   = buildExport(userId, req.user);
    const filename = `apogee_export_${userId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`;

    logger.info({ event: 'RGPD_EXPORT_DIRECT', userId, timestamp: new Date().toISOString() });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  } catch (err) { next(err); }
});

// ── POST /api/rgpd/admin/purge — Déclencher la purge manuellement (admin) ────
// Protection minimale : clé admin en env — à remplacer par un vrai middleware admin en prod
router.post('/admin/purge', requireAuth, async (req, res, next) => {
  try {
    const adminKey = process.env.ADMIN_PURGE_KEY;
    if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
      return res.status(403).json({ error: 'Clé admin incorrecte.' });
    }
    logger.info({ event: 'PURGE_MANUAL_TRIGGER', userId: req.user.id, timestamp: new Date().toISOString() });
    const summary = await runPurge();
    res.json({ success: true, summary });
  } catch (err) { next(err); }
});

// ── GET /api/rgpd/admin/purge-logs — Consulter les dernières entrées du log ──
router.get('/admin/purge-logs', requireAuth, (req, res, next) => {
  try {
    const adminKey = process.env.ADMIN_PURGE_KEY;
    if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
      return res.status(403).json({ error: 'Clé admin incorrecte.' });
    }
    if (!fs.existsSync(PURGE_LOG)) return res.json({ logs: [] });
    const lines = fs.readFileSync(PURGE_LOG, 'utf8').split('\n').filter(Boolean);
    const limit = parseInt(req.query.limit || '100', 10);
    const logs  = lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
    res.json({ logs, total: lines.length });
  } catch (err) { next(err); }
});

// ── DELETE /api/rgpd/compte — Suppression de compte (art. 17 RGPD) ──────────
router.delete('/compte', requireAuth, async (req, res, next) => {
  try {
    const userId    = req.user.id;
    const userEmail = req.user.email;
    const { confirmation } = req.body;

    if (confirmation !== `SUPPRIMER_MON_COMPTE_${userId}`) {
      return res.status(400).json({
        error: `Confirmation incorrecte. Envoyez { "confirmation": "SUPPRIMER_MON_COMPTE_${userId}" } pour valider.`,
      });
    }

    logger.info({ event: 'RGPD_ACCOUNT_DELETION_REQUESTED', userId, userEmail, timestamp: new Date().toISOString() });

    const result = await deleteAccount(userId, userEmail);

    logger.info({
      event:       'RGPD_ACCOUNT_DELETION_COMPLETED',
      anonymousId: result.anonymousId,
      success:     result.success,
      steps:       result.steps,
      timestamp:   result.deletedAt,
    });

    return res.status(result.success ? 200 : 207).json(result);
  } catch (err) { next(err); }
});

// ── DELETE /api/rgpd/entreprise/:entrepriseId — Effacement données (art. 17) ──
router.delete('/entreprise/:entrepriseId', requireAuth, async (req, res, next) => {
  try {
    const { entrepriseId } = req.params;
    const { confirmation }  = req.body;

    if (entrepriseId !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé : vous ne pouvez supprimer que vos propres données.' });
    }
    if (confirmation !== `SUPPRIMER_${entrepriseId}`) {
      return res.status(400).json({
        error: `Confirmation incorrecte. Envoyez { confirmation: "SUPPRIMER_${entrepriseId}" } pour confirmer.`,
      });
    }

    logger.info({ event: 'RGPD_ERASURE', entrepriseId, requestedBy: req.user.id, requestedByEmail: req.user.email, timestamp: new Date().toISOString() });

    const result = await deleteAccount(entrepriseId, req.user.email);

    res.status(result.success ? 200 : 207).json(result);
  } catch (err) { next(err); }
});

module.exports = router;
