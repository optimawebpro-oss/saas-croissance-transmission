require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { auditLog } = require('./middleware/audit');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Sécurité ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer dans 15 minutes.' },
}));

// Rate limiting strict pour les routes sensibles
const strictLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Limite atteinte pour cette ressource sensible.' },
});

// ── Middleware d'audit ────────────────────────────────────
app.use(auditLog);

// ── Routes ────────────────────────────────────────────────
app.use('/api/entreprise', strictLimit, require('./routes/entreprise'));
app.use('/api/fec', strictLimit, require('./routes/fec'));
app.use('/api/banking', require('./routes/banking'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/sirh', require('./routes/sirh'));
app.use('/api/benchmarks', require('./routes/benchmarks'));
app.use('/api/juridique', strictLimit, require('./routes/juridique'));
app.use('/api/rgpd', strictLimit, require('./routes/rgpd'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

// ── Gestionnaire d'erreurs global ─────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur.'
      : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`✦ Evoluty Backend démarré sur le port ${PORT} [${process.env.NODE_ENV}]`);
});
