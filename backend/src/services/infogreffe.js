const axios = require('axios');

const BASE = 'https://opendata.infogreffe.fr/api/explore/v2.1/catalog/datasets';

// Délai minimal entre appels (rate limiting Infogreffe)
let lastCall = 0;
const MIN_INTERVAL_MS = 2000;

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastCall;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastCall = Date.now();
}

/**
 * Récupère les informations juridiques d'une entreprise via Infogreffe
 * @param {string} siren — 9 chiffres
 * @returns {{ ok: boolean, data?: object, alerts?: string[], error?: string }}
 */
async function fetchJuridique(siren) {
  const cleaned = siren.replace(/\s/g, '');
  if (!/^\d{9}$/.test(cleaned)) {
    return { ok: false, error: 'SIREN invalide — 9 chiffres requis.' };
  }

  await throttle();

  const headers = {};
  if (process.env.INFOGREFFE_API_KEY) {
    headers['Authorization'] = `Apikey ${process.env.INFOGREFFE_API_KEY}`;
  }

  try {
    // Actes déposés
    const actesRes = await axios.get(`${BASE}/actes/records`, {
      headers,
      params: { where: `siren="${cleaned}"`, limit: 20, order_by: 'datecloture desc' },
      timeout: 10000,
    });

    // Procédures collectives
    const proceduresRes = await axios.get(`${BASE}/procedures_collectives/records`, {
      headers,
      params: { where: `siren="${cleaned}"`, limit: 5 },
      timeout: 10000,
    });

    // Privilèges et nantissements
    const privilegesRes = await axios.get(`${BASE}/privileges/records`, {
      headers,
      params: { where: `siren="${cleaned}"`, limit: 10 },
      timeout: 10000,
    });

    const actes = (actesRes.data.results || []).map(a => ({
      type: a.typeacte,
      date: a.datecloture,
      libelle: a.libelleacte,
    }));

    const procedures = (proceduresRes.data.results || []).map(p => ({
      type: p.typeprocedure,
      dateOuverture: p.dateouverture,
      statut: p.statut,
    }));

    const privileges = (privilegesRes.data.results || []).map(p => ({
      type: p.typeprivilege,
      date: p.dateinscription,
      montant: p.montant,
    }));

    // Génération automatique des alertes
    const alerts = [];

    const proceduresActives = procedures.filter(p =>
      p.statut?.toLowerCase().includes('ouvert') ||
      p.statut?.toLowerCase().includes('en cours')
    );
    if (proceduresActives.length > 0) {
      alerts.push(`⚠️ Procédure collective en cours : ${proceduresActives.map(p => p.type).join(', ')}`);
    }

    const privilegesActifs = privileges.filter(p => !p.statut || p.statut?.toLowerCase() !== 'radié');
    if (privilegesActifs.length > 0) {
      alerts.push(`⚠️ ${privilegesActifs.length} nantissement(s)/privilège(s) actif(s) inscrit(s)`);
    }

    const actesMajeurs = actes.filter(a =>
      /cession|fusion|scission|dissolution|liquidation/i.test(a.type || '')
    );
    if (actesMajeurs.length > 0) {
      alerts.push(`ℹ️ Actes majeurs détectés : ${actesMajeurs.map(a => a.type).join(', ')}`);
    }

    return {
      ok: true,
      data: { actes, procedures, privileges },
      alerts,
      scoreConformite: computeConformiteScore(procedures, privileges),
    };
  } catch (err) {
    if (err.response?.status === 429) {
      return { ok: false, error: 'Quota Infogreffe dépassé. Réessayez dans quelques minutes.' };
    }
    if (err.response?.status === 401) {
      return { ok: false, error: 'Clé API Infogreffe invalide.' };
    }
    return { ok: false, error: `Infogreffe indisponible : ${err.message}` };
  }
}

/**
 * Calcule un score de conformité juridique /100
 */
function computeConformiteScore(procedures, privileges) {
  let score = 100;
  const proceduresActives = procedures.filter(p =>
    p.statut?.toLowerCase().includes('ouvert') || p.statut?.toLowerCase().includes('en cours')
  );
  score -= proceduresActives.length * 40; // Très pénalisant
  const privilegesActifs = privileges.filter(p => !p.statut || p.statut?.toLowerCase() !== 'radié');
  score -= privilegesActifs.length * 15;
  return Math.max(0, score);
}

module.exports = { fetchJuridique };
