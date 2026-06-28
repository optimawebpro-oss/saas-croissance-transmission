const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/subscriptions.json');

function readDb() {
  if (!fs.existsSync(DB_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch (_) { return {}; }
}

function writeDb(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/**
 * Récupère le plan d'un utilisateur Kinde.
 * @returns {{ plan: 'gratuit'|'croissance'|'cession', billing: 'monthly'|'annual', status: string, stripeSubscriptionId: string|null }}
 */
function getUserPlan(kindeUserId) {
  const db = readDb();
  return db[kindeUserId] || { plan: 'gratuit', billing: null, status: 'active', stripeSubscriptionId: null };
}

/**
 * Met à jour ou crée le plan d'un utilisateur.
 */
function setUserPlan(kindeUserId, { plan, billing, status, stripeSubscriptionId, stripeCustomerId }) {
  const db = readDb();
  db[kindeUserId] = {
    plan,
    billing: billing || null,
    status: status || 'active',
    stripeSubscriptionId: stripeSubscriptionId || null,
    stripeCustomerId: stripeCustomerId || null,
    updatedAt: new Date().toISOString(),
  };
  writeDb(db);
  return db[kindeUserId];
}

/**
 * Trouve un utilisateur Kinde par son stripeSubscriptionId.
 */
function findUserByStripeSubscription(stripeSubscriptionId) {
  const db = readDb();
  return Object.entries(db).find(([, v]) => v.stripeSubscriptionId === stripeSubscriptionId) || null;
}

/**
 * Trouve un utilisateur Kinde par son stripeCustomerId.
 */
function findUserByStripeCustomer(stripeCustomerId) {
  const db = readDb();
  return Object.entries(db).find(([, v]) => v.stripeCustomerId === stripeCustomerId) || null;
}

/**
 * Supprime toutes les données d'un utilisateur (droit à l'effacement RGPD).
 */
function deleteUser(kindeUserId) {
  const db = readDb();
  delete db[kindeUserId];
  writeDb(db);
}

module.exports = { getUserPlan, setUserPlan, findUserByStripeSubscription, findUserByStripeCustomer, deleteUser };
