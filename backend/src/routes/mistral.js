const router = require('express').Router();
const https = require('https');
const { requireAuth } = require('../middleware/kindeAuth');

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// POST /api/mistral/chat — proxy streaming vers Mistral, clé jamais exposée côté client
router.post('/chat', requireAuth, (req, res) => {
  const { messages, model, temperature, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages requis.' });
  }

  const body = JSON.stringify({
    model: model || 'mistral-large-latest',
    messages,
    temperature: temperature ?? 0.55,
    max_tokens: max_tokens ?? 1800,
    stream: true,
  });

  const options = {
    hostname: 'api.mistral.ai',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  // Transmet les headers SSE au client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no'); // désactive le buffering Nginx/Railway

  const mistralReq = https.request(options, mistralRes => {
    if (mistralRes.statusCode !== 200) {
      res.status(mistralRes.statusCode).end();
      return;
    }
    mistralRes.pipe(res);
  });

  mistralReq.on('error', () => res.status(502).end());
  mistralReq.write(body);
  mistralReq.end();
});

module.exports = router;
