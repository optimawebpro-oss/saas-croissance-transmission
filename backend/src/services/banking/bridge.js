const axios = require('axios');

/**
 * Bridge API (bridgeapi.io) — Open Banking PSD2
 * Recommandé pour les PME françaises : meilleure UX, pricing lisible, docs FR
 */

const BASE = 'https://api.bridgeapi.io/v2';

const headers = () => ({
  'Bridge-Version': '2021-06-01',
  'Client-Id': process.env.BRIDGE_CLIENT_ID,
  'Client-Secret': process.env.BRIDGE_CLIENT_SECRET,
  'Content-Type': 'application/json',
});

/**
 * Crée une URL d'autorisation OAuth pour connecter un compte bancaire
 * @param {string} userId — identifiant interne de l'utilisateur
 * @returns {{ ok: boolean, authUrl?: string, error?: string }}
 */
async function createAuthUrl(userId) {
  try {
    // Créer ou récupérer l'utilisateur Bridge
    const userRes = await axios.post(`${BASE}/users`, {
      email: `${userId}@apogee.internal`,
      password: generateTempPassword(userId),
    }, { headers: headers() });

    const bridgeUserId = userRes.data.uuid;

    // Créer la session de connexion bancaire
    const sessionRes = await axios.post(`${BASE}/connect/sessions/banks`, {
      prefill_email: `${userId}@apogee.internal`,
      country: 'fr',
    }, { headers: { ...headers(), 'User-Uuid': bridgeUserId } });

    return {
      ok: true,
      authUrl: sessionRes.data.url,
      bridgeUserId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  } catch (err) {
    console.error('[Bridge] createAuthUrl error:', err.response?.data || err.message);
    return { ok: false, error: 'Impossible de démarrer la connexion bancaire. Vérifiez votre configuration Bridge.' };
  }
}

/**
 * Récupère le solde et les transactions des 6 derniers mois
 * @param {string} bridgeUserId
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
async function fetchBankData(bridgeUserId) {
  try {
    const h = { ...headers(), 'User-Uuid': bridgeUserId };

    // Comptes
    const accountsRes = await axios.get(`${BASE}/accounts`, { headers: h });
    const accounts = accountsRes.data.resources || [];

    // Transactions des 6 derniers mois
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    const sinceStr = since.toISOString().split('T')[0];

    const txRes = await axios.get(`${BASE}/transactions`, {
      headers: h,
      params: { since: sinceStr, limit: 1000 },
    });
    const transactions = txRes.data.resources || [];

    // Calculs flux
    const fluxEntrants = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const fluxSortants = transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);

    return {
      ok: true,
      data: {
        comptes: accounts.map(a => ({
          id: a.id,
          nom: a.name,
          iban: a.iban ? maskIBAN(a.iban) : null,
          solde: a.balance,
          devise: a.currency_code,
        })),
        soldeTotal: accounts.reduce((s, a) => s + (a.balance || 0), 0),
        fluxEntrants6mois: Math.round(fluxEntrants * 100) / 100,
        fluxSortants6mois: Math.round(fluxSortants * 100) / 100,
        nbTransactions: transactions.length,
        periode: { depuis: sinceStr, jusqu: new Date().toISOString().split('T')[0] },
        consentementValideJusqu: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  } catch (err) {
    console.error('[Bridge] fetchBankData error:', err.response?.data || err.message);
    return { ok: false, error: 'Impossible de récupérer les données bancaires.' };
  }
}

/**
 * Révoque le consentement bancaire (droit de retrait RGPD/PSD2)
 * @param {string} bridgeUserId
 */
async function revokeAccess(bridgeUserId) {
  try {
    await axios.delete(`${BASE}/users/${bridgeUserId}`, { headers: headers() });
    return { ok: true };
  } catch (err) {
    console.error('[Bridge] revokeAccess error:', err.message);
    return { ok: false, error: 'Erreur lors de la révocation.' };
  }
}

function maskIBAN(iban) {
  return iban.replace(/^(.{4})(.+)(.{4})$/, (_, s, m, e) => s + '*'.repeat(m.length) + e);
}

function generateTempPassword(userId) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', process.env.ENCRYPTION_KEY || 'dev').update(userId).digest('hex').substring(0, 16);
}

module.exports = { createAuthUrl, fetchBankData, revokeAccess };
