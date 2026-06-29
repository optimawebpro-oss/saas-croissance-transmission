const router = require('express').Router();
const https = require('https');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan } = require('../middleware/requirePlan');
const { buildContext } = require('../services/knowledgeBase');

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// POST /api/mistral/chat — réservé aux plans payants (croissance ou cession)
router.post('/chat', requireAuth, requirePlan('croissance'), (req, res) => {
  const { messages, model, temperature, max_tokens, mod } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages requis.' });
  }

  // Injecte la base de connaissances dans le system prompt existant
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const knowledgeContext = buildContext(mod || 't', lastUserMsg);

  const enrichedMessages = messages.map((m, i) => {
    // Préfixe uniquement le premier message system avec la base de connaissances
    if (m.role === 'system' && i === 0) {
      return { ...m, content: knowledgeContext + '\n\n---\n\n# INSTRUCTIONS SPÉCIFIQUES\n\n' + m.content };
    }
    return m;
  });

  const body = JSON.stringify({
    model: model || 'mistral-large-latest',
    messages: enrichedMessages,
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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

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
