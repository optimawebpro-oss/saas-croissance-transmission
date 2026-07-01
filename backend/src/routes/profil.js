'use strict';

const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { requireAuth }     = require('../middleware/kindeAuth');
const { getUserPlan }     = require('../services/subscriptionDb');
const { updateKindeUser } = require('../services/kindeManagement');
const {
  mergeWithJwt, updateProfile,
  LOCAL_FIELDS, KINDE_FIELDS,
} = require('../services/profileDb');
const audit = require('../services/auditTrail');

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) throw new Error('SESSION_SECRET manquant dans les variables d\'environnement.');

function maskEmail(e) {
  if (!e || !e.includes('@')) return e;
  const [l, d] = e.split('@');
  return l.slice(0, 2) + '***@' + d;
}

// ── GET /api/profil — Profil complet (JWT + données locales) ─────────────────
router.get('/', requireAuth, (req, res) => {
  const profil = mergeWithJwt(req.user.id, req.user);
  res.json({ success: true, profil });
});

// ── PATCH /api/profil — Mise à jour partielle ────────────────────────────────
router.patch('/', requireAuth, async (req, res, next) => {
  try {
    const userId  = req.user.id;
    const current = mergeWithJwt(userId, req.user);
    const ip      = req.ip || req.connection?.remoteAddress;

    // Filtrer les champs reçus
    const allowed = [...KINDE_FIELDS, ...LOCAL_FIELDS];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        const val = String(req.body[field]).trim();
        if (val !== '') updates[field] = val;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucun champ valide fourni.' });
    }

    // Validation email
    if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      return res.status(400).json({ error: 'Format email invalide.' });
    }

    // Validation téléphone (optionnel — format E.164 ou libre)
    if (updates.telephone && updates.telephone.length > 20) {
      return res.status(400).json({ error: 'Numéro de téléphone trop long.' });
    }

    // ── 1. Synchroniser avec Kinde si champs Kinde modifiés ──
    const kindeUpdates = {};
    for (const f of KINDE_FIELDS) {
      if (updates[f] && updates[f] !== current[f]) kindeUpdates[f] = updates[f];
    }

    let kindeSync = null;
    if (Object.keys(kindeUpdates).length > 0) {
      try {
        await updateKindeUser(userId, kindeUpdates);
        kindeSync = { success: true, fields: Object.keys(kindeUpdates) };
      } catch (err) {
        // Si Kinde échoue sur l'email, on bloque la mise à jour
        if (kindeUpdates.email) {
          return res.status(409).json({ error: err.message });
        }
        // Pour nom/prénom, on continue malgré l'échec Kinde (la donnée locale reste cohérente)
        kindeSync = { success: false, error: err.message };
      }
    }

    // ── 2. Persister localement ───────────────────────────────
    updateProfile(userId, updates);

    // ── 3. Audit trail — une entrée par champ modifié ─────────
    const changes = [];
    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = current[field] ?? null;
      if (String(oldValue ?? '') !== String(newValue)) {
        changes.push({ field, oldValue, newValue });
      }
    }
    if (changes.length > 0) {
      audit.log({
        action:   audit.ACTION.WRITE,
        resource: 'profil',
        userId,
        email:    req.user.email,
        ip,
        details: {
          champsModifies: changes.map(c => ({
            champ:       c.field,
            ancienneValeur: c.field === 'email' ? maskEmail(c.oldValue) : c.oldValue,
            nouvelleValeur: c.field === 'email' ? maskEmail(c.newValue) : c.newValue,
          })),
        },
      });
    }

    // ── 4. Réémettre un JWT avec les nouvelles valeurs ─────────
    const subscription = getUserPlan(userId) || {};
    const newToken = jwt.sign({
      id:          userId,
      email:       updates.email       || req.user.email,
      given_name:  updates.given_name  || req.user.given_name,
      family_name: updates.family_name || req.user.family_name,
      plan:        subscription.plan   || req.user.plan,
      billing:     subscription.billing || req.user.billing,
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success:    true,
      token:      newToken,
      kindeSync,
      changes:    changes.length,
      updatedFields: Object.keys(updates),
    });
  } catch (err) { next(err); }
});

module.exports = router;
