'use strict';

const router = require('express').Router();
const https  = require('https');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan }  = require('../middleware/requirePlan');

// Stockage en mémoire (remplacer par DB chiffrée en prod)
const apiKeys = {};

// POST /api/compta/apikey — enregistre la clé API du logiciel comptable
router.post('/apikey', requireAuth, requirePlan('croissance'), (req, res) => {
  const { provider, apiKey } = req.body;
  if (!provider || !apiKey) return res.status(400).json({ error: 'provider et apiKey requis.' });
  const allowed = ['pennylane', 'quickbooks', 'sage'];
  if (!allowed.includes(provider)) return res.status(400).json({ error: 'Fournisseur non supporté.' });
  apiKeys[`${req.user.id}_${provider}`] = apiKey;
  res.json({ success: true, message: `Clé API ${provider} enregistrée.` });
});

// GET /api/compta/:provider/status — vérifie si une clé est présente
router.get('/:provider/status', requireAuth, (req, res) => {
  const key = apiKeys[`${req.user.id}_${req.params.provider}`];
  res.json({ connected: !!key });
});

// DELETE /api/compta/:provider — supprime la clé
router.delete('/:provider', requireAuth, (req, res) => {
  delete apiKeys[`${req.user.id}_${req.params.provider}`];
  res.json({ success: true });
});

module.exports = router;
