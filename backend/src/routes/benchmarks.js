const router = require('express').Router();
const { getMultiple, calculateValorisation, loadBenchmarks, invalidateCache } = require('../services/benchmarks');

// GET /api/benchmarks/multiple/:codeNAF
router.get('/multiple/:codeNAF', (req, res) => {
  const m = getMultiple(req.params.codeNAF);
  if (!m) return res.status(404).json({ error: 'Aucun benchmark trouvé pour ce code NAF.' });
  res.json({ success: true, data: m });
});

// POST /api/benchmarks/valorisation — calcule la valorisation
router.post('/valorisation', (req, res) => {
  const { ebitda, codeNAF } = req.body;
  if (!ebitda) return res.status(400).json({ error: 'ebitda requis.' });
  const v = calculateValorisation(parseFloat(ebitda), codeNAF);
  if (!v) return res.status(404).json({ error: 'Impossible de calculer la valorisation (benchmark manquant ou EBE négatif).' });
  res.json({ success: true, data: v });
});

// GET /api/benchmarks — liste tous les secteurs
router.get('/', (req, res) => {
  const data = loadBenchmarks();
  res.json({ success: true, data: data.secteurs });
});

// POST /api/benchmarks/refresh — réservé (pas d'accès public)
router.post('/refresh', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  invalidateCache();
  res.json({ success: true, message: 'Cache benchmarks invalidé.' });
});

module.exports = router;
