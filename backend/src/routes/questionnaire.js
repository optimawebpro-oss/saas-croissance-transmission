'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan }  = require('../middleware/requirePlan');

const answers = {};

// POST /api/questionnaire/:type — sauvegarde les réponses
router.post('/:type', requireAuth, requirePlan('croissance'), (req, res) => {
  const allowed = ['dirigeant', 'process', 'remunerations', 'sirh'];
  if (!allowed.includes(req.params.type)) return res.status(400).json({ error: 'Type invalide.' });
  const key = `${req.user.id}_${req.params.type}`;
  answers[key] = { ...req.body, updatedAt: new Date().toISOString() };
  res.json({ success: true, message: 'Réponses enregistrées.' });
});

// GET /api/questionnaire/:type — récupère les réponses
router.get('/:type', requireAuth, (req, res) => {
  const key = `${req.user.id}_${req.params.type}`;
  res.json({ data: answers[key] || null });
});

module.exports = router;
