/**
 * Interface commune CRM — Architecture extensible
 * Ajouter un nouveau CRM = créer un fichier dans ce dossier et l'enregistrer ici
 */

const hubspot = require('./hubspot');
const pipedrive = require('./pipedrive');

const ADAPTERS = {
  hubspot,
  pipedrive,
  // salesforce: require('./salesforce'),  // À brancher plus tard sans modifier ce fichier
};

/**
 * Retourne l'adaptateur CRM correspondant
 * @param {string} provider
 */
function getAdapter(provider) {
  const adapter = ADAPTERS[provider.toLowerCase()];
  if (!adapter) throw new Error(`CRM non supporté : ${provider}`);
  return adapter;
}

/**
 * Récupère les données CRM normalisées pour un provider donné
 * @param {string} provider
 * @param {string} accessToken
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
async function fetchCRMData(provider, accessToken) {
  const adapter = getAdapter(provider);
  const raw = await adapter.fetchData(accessToken);
  if (!raw.ok) return raw;
  return { ok: true, data: normalize(raw.data) };
}

/**
 * Normalise les données brutes CRM vers notre format interne
 * Permet une comparaison et un traitement uniforme quel que soit le CRM
 */
function normalize(raw) {
  const { clients, transactions } = raw;

  // CA par client sur 12-24 mois
  const caParClient = {};
  const now = Date.now();
  const limit24m = now - 24 * 30 * 24 * 60 * 60 * 1000;

  for (const tx of transactions) {
    if (new Date(tx.date).getTime() < limit24m) continue;
    if (!caParClient[tx.clientId]) {
      caParClient[tx.clientId] = { nom: tx.clientNom, ca: 0, transactions: 0 };
    }
    caParClient[tx.clientId].ca += tx.montant;
    caParClient[tx.clientId].transactions++;
  }

  const caList = Object.values(caParClient).sort((a, b) => b.ca - a.ca);
  const caTotal = caList.reduce((s, c) => s + c.ca, 0);

  // Concentration : % du top 1, top 3
  const top1 = caList[0] ? (caList[0].ca / caTotal) * 100 : 0;
  const top3CA = caList.slice(0, 3).reduce((s, c) => s + c.ca, 0);
  const top3 = caTotal > 0 ? (top3CA / caTotal) * 100 : 0;

  // Churn estimé (clients avec tx l'an passé mais pas cette année)
  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;
  const clientsLastYear = new Set();
  const clientsThisYear = new Set();
  for (const tx of transactions) {
    const y = new Date(tx.date).getFullYear();
    if (y === lastYear) clientsLastYear.add(tx.clientId);
    if (y === thisYear) clientsThisYear.add(tx.clientId);
  }
  const churned = [...clientsLastYear].filter(id => !clientsThisYear.has(id)).length;
  const churnRate = clientsLastYear.size > 0 ? (churned / clientsLastYear.size) * 100 : 0;

  return {
    nbClients: clients.length,
    caTotal: Math.round(caTotal),
    concentrationTop1: Math.round(top1 * 10) / 10,
    concentrationTop3: Math.round(top3 * 10) / 10,
    churnRate: Math.round(churnRate * 10) / 10,
    top5Clients: caList.slice(0, 5).map(c => ({ ...c, ca: Math.round(c.ca), part: Math.round((c.ca / caTotal) * 1000) / 10 })),
  };
}

module.exports = { fetchCRMData, getAdapter };
