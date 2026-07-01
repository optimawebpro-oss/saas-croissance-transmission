const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('./encryption');

const DB_PATH = path.join(__dirname, '../../data/subscriptions.json');

// Champs sensibles chiffrés au repos (IDs Stripe permettent d'identifier les clients)
const SENSITIVE_FIELDS = ['stripeSubscriptionId', 'stripeCustomerId'];

function readDb() {
  if (!fs.existsSync(DB_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    // Déchiffre les champs sensibles à la lecture
    const out = {};
    for (const [userId, record] of Object.entries(raw)) {
      out[userId] = { ...record };
      for (const field of SENSITIVE_FIELDS) {
        if (record[field] && record[field] !== null) {
          try { out[userId][field] = decrypt(record[field]); }
          catch { /* valeur déjà en clair (migration) */ }
        }
      }
    }
    return out;
  } catch (_) { return {}; }
}

function writeDb(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  // Chiffre les champs sensibles avant écriture disque
  const safe = {};
  for (const [userId, record] of Object.entries(data)) {
    safe[userId] = { ...record };
    for (const field of SENSITIVE_FIELDS) {
      if (record[field] && record[field] !== null) {
        safe[userId][field] = encrypt(record[field]);
      }
    }
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(safe, null, 2));
}

function getUserPlan(kindeUserId) {
  const db = readDb();
  return db[kindeUserId] || { plan: 'gratuit', billing: null, status: 'active', stripeSubscriptionId: null };
}

function setUserPlan(kindeUserId, { plan, billing, status, stripeSubscriptionId, stripeCustomerId }) {
  const db  = readDb();
  const prev = db[kindeUserId] || {};
  const now  = new Date().toISOString();

  db[kindeUserId] = {
    plan,
    billing: billing || null,
    status: status || 'active',
    stripeSubscriptionId: stripeSubscriptionId || null,
    stripeCustomerId: stripeCustomerId || null,
    updatedAt: now,
    // Trace la date de clôture pour la purge R3 (30j après cancelledAt)
    cancelledAt: (status === 'cancelled' && !prev.cancelledAt) ? now : (prev.cancelledAt || null),
  };
  writeDb(db);
  return db[kindeUserId];
}

function findUserByStripeSubscription(stripeSubscriptionId) {
  const db = readDb();
  return Object.entries(db).find(([, v]) => v.stripeSubscriptionId === stripeSubscriptionId) || null;
}

function findUserByStripeCustomer(stripeCustomerId) {
  const db = readDb();
  return Object.entries(db).find(([, v]) => v.stripeCustomerId === stripeCustomerId) || null;
}

function deleteUser(kindeUserId) {
  const db = readDb();
  delete db[kindeUserId];
  writeDb(db);
}

module.exports = { getUserPlan, setUserPlan, findUserByStripeSubscription, findUserByStripeCustomer, deleteUser };
