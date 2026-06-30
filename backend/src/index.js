require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const https = require('https');
const { auditLog } = require('./middleware/audit');
const { getUserPlan } = require('./services/subscriptionDb');

const app = express();
const PORT = process.env.PORT || 3001;

const KINDE_DOMAIN      = process.env.KINDE_DOMAIN;
const CLIENT_ID         = process.env.KINDE_CLIENT_ID;
const CLIENT_SECRET     = process.env.KINDE_CLIENT_SECRET;
const REDIRECT_URI      = process.env.KINDE_REDIRECT_URI || `http://localhost:${PORT}/callback`;
const FRONTEND_URL      = process.env.FRONTEND_URL || 'http://localhost:5500';
const JWT_SECRET        = process.env.SESSION_SECRET || 'apogee-secret';

// ── Sécurité ─────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
const frontendOrigin = (() => {
  try { return new URL(FRONTEND_URL).origin; } catch { return FRONTEND_URL; }
})();
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use(auditLog);

// ── Helper : appel HTTPS simple ──────────────────────────
function httpsPost(url, data, headers) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'string' ? data : new URLSearchParams(data).toString();
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), ...headers },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Auth Routes ──────────────────────────────────────────

function randomState() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// GET /login → redirige vers Kinde login
app.get('/login', (req, res) => {
  const url = `${KINDE_DOMAIN}/oauth2/auth?` + new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
    response_type: 'code', scope: 'openid profile email',
    state: randomState(),
  });
  res.redirect(url);
});

// GET /register → redirige vers Kinde register
app.get('/register', (req, res) => {
  const url = `${KINDE_DOMAIN}/oauth2/auth?` + new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
    response_type: 'code', scope: 'openid profile email',
    prompt: 'create', state: randomState(),
  });
  res.redirect(url);
});

// GET /callback → échange le code, génère JWT, redirige vers frontend
app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(FRONTEND_URL + '?auth=error');

  try {
    // 1. Échanger le code contre des tokens
    const tokens = await httpsPost(`${KINDE_DOMAIN}/oauth2/token`, {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    });

    if (!tokens.access_token) return res.redirect(FRONTEND_URL + '?auth=error');

    // 2. Récupérer le profil utilisateur
    const profile = await httpsGet(`${KINDE_DOMAIN}/oauth2/v2/user_profile`, {
      Authorization: `Bearer ${tokens.access_token}`,
    });

    if (!profile.id) return res.redirect(FRONTEND_URL + '?auth=error');

    // 3. Générer un JWT signé
    const subscription = getUserPlan(profile.id) || { plan: 'gratuit', billing: null, status: 'active' };
    const token = jwt.sign({
      id: profile.id,
      email: profile.email,
      given_name: profile.given_name || profile.first_name || '',
      family_name: profile.family_name || profile.last_name || '',
      plan: subscription.plan,
      billing: subscription.billing,
    }, JWT_SECRET, { expiresIn: '7d' });

    // 4. Rediriger vers le frontend avec le token
    res.redirect(FRONTEND_URL + '/?auth_token=' + token);
  } catch (err) {
    console.error('[/callback]', err.message);
    res.redirect(FRONTEND_URL + '?auth=error');
  }
});

// GET /logout
app.get('/logout', (req, res) => {
  const url = `${KINDE_DOMAIN}/logout?` + new URLSearchParams({ redirect: FRONTEND_URL });
  res.redirect(url);
});

// ── API Routes ───────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/stripe',  require('./routes/stripe'));
app.use('/api/mistral', require('./routes/mistral'));

const strictLimit = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use('/api/entreprise', strictLimit, require('./routes/entreprise'));
app.use('/api/fec',        strictLimit, require('./routes/fec'));
app.use('/api/banking',    require('./routes/banking'));
app.use('/api/crm',        require('./routes/crm'));
app.use('/api/sirh',       require('./routes/sirh'));
app.use('/api/benchmarks', require('./routes/benchmarks'));
app.use('/api/juridique',  strictLimit, require('./routes/juridique'));
app.use('/api/rgpd',         strictLimit, require('./routes/rgpd'));
app.use('/api/compta',       require('./routes/compta'));
app.use('/api/facturation',  require('./routes/facturation'));
app.use('/api/inpi',         strictLimit, require('./routes/inpi'));
app.use('/api/documents',    require('./routes/documents'));
app.use('/api/questionnaire',require('./routes/questionnaire'));

app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Erreur interne.' : err.message });
});

app.listen(PORT, () => {
  console.log(`✦ Apogée Backend démarré sur le port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
