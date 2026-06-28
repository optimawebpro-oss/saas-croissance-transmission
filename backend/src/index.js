require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const { setupKinde } = require('@kinde-oss/kinde-node-express');

const { auditLog } = require('./middleware/audit');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Sécurité ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
// Extrait uniquement le domaine (sans chemin) pour le CORS
const frontendOrigin = (() => {
  try { return new URL(process.env.FRONTEND_URL || 'http://localhost:5500').origin; }
  catch { return 'http://localhost:5500'; }
})();
app.use(cors({ origin: frontendOrigin, credentials: true }));

// ── Session (requise par Kinde) ────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'evoluty-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

app.use(cookieParser());

// Webhook Stripe doit recevoir le raw body AVANT express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Intercepte /callback pour forcer la sauvegarde de session avant la redirection
app.get('/callback', (req, res, next) => {
  const orig = res.redirect.bind(res);
  res.redirect = function (url) {
    req.session.save(() => orig(url));
  };
  next();
});

// ── Kinde Auth (v1.7.0 — paramètres snake_case) ───────────
const kindeConfig = {
  grantType:              'AUTHORIZATION_CODE',
  clientId:               process.env.KINDE_CLIENT_ID,
  issuerBaseUrl:          process.env.KINDE_DOMAIN,
  siteUrl:                (process.env.BACKEND_URL || `http://localhost:${PORT}`) + '/auth/post-auth',
  secret:                 process.env.KINDE_CLIENT_SECRET,
  redirectUrl:            process.env.KINDE_REDIRECT_URI || `http://localhost:${PORT}/callback`,
  unAuthorisedUrl:        (process.env.FRONTEND_URL || 'http://localhost:5500') + '/tarifs.html',
  postLogoutRedirectUrl:  process.env.FRONTEND_URL || 'http://localhost:5500',
};
setupKinde(kindeConfig, app);

// Routes Kinde (automatiquement créées par setupKinde) :
// GET /login   → redirige vers Kinde login
// GET /register → redirige vers Kinde register
// GET /callback → callback OAuth2 Kinde
// GET /logout  → déconnecte et redirige vers FRONTEND_URL

// ── Rate limiting ─────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer dans 15 minutes.' },
}));
const strictLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Limite atteinte pour cette ressource sensible.' },
});

// ── Middleware d'audit ────────────────────────────────────
app.use(auditLog);

// ── Routes ────────────────────────────────────────────────
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/auth',     authRouter);
app.use('/api/stripe',     require('./routes/stripe'));

app.use('/api/entreprise', strictLimit, require('./routes/entreprise'));
app.use('/api/fec',        strictLimit, require('./routes/fec'));
app.use('/api/banking',    require('./routes/banking'));
app.use('/api/crm',        require('./routes/crm'));
app.use('/api/sirh',       require('./routes/sirh'));
app.use('/api/benchmarks', require('./routes/benchmarks'));
app.use('/api/juridique',  strictLimit, require('./routes/juridique'));
app.use('/api/rgpd',       strictLimit, require('./routes/rgpd'));

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
  console.log(`✦ Evoluty Backend démarré sur le port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
