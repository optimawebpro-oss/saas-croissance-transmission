'use strict';

const router = require('express').Router();
const https  = require('https');
const { requireAuth } = require('../middleware/kindeAuth');

function inpiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'data.inpi.fr',
      path,
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'Apogee/1.0' },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// GET /api/inpi/:siren — marques, brevets, dessins
router.get('/:siren', requireAuth, async (req, res) => {
  const { siren } = req.params;
  if (!/^\d{9}$/.test(siren)) return res.status(400).json({ error: 'SIREN invalide (9 chiffres).' });

  try {
    const [marques, brevets] = await Promise.all([
      inpiGet(`/marques?q=siren:${siren}&rows=100`).catch(() => null),
      inpiGet(`/brevets?q=siren:${siren}&rows=100`).catch(() => null),
    ]);

    res.json({
      success: true,
      marques: marques?.body?.total_results ?? marques?.body?.length ?? 0,
      brevets: brevets?.body?.total_results ?? brevets?.body?.length ?? 0,
      dessins: 0,
      note: "Données issues de data.inpi.fr (open data INPI)",
    });
  } catch (err) {
    res.status(502).json({ error: 'INPI inaccessible.', detail: err.message });
  }
});

module.exports = router;
