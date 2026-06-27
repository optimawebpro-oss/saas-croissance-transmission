const axios = require('axios');

const PAPPERS_BASE = 'https://api.pappers.fr/v2';
const INSEE_BASE = 'https://api.insee.fr/entreprises/sirene/V3';

/**
 * Recherche une entreprise par SIRET via Pappers (prioritaire) ou INSEE (fallback)
 * @param {string} siret — 14 chiffres
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
async function searchBySiret(siret) {
  const cleaned = siret.replace(/\s/g, '');

  if (!/^\d{14}$/.test(cleaned)) {
    return { ok: false, error: 'SIRET invalide — il doit contenir exactement 14 chiffres.' };
  }

  // 1. Essai Pappers
  if (process.env.PAPPERS_API_KEY) {
    try {
      const res = await axios.get(`${PAPPERS_BASE}/entreprise`, {
        params: { api_token: process.env.PAPPERS_API_KEY, siret: cleaned },
        timeout: 8000,
      });
      return { ok: true, data: normalizePappers(res.data), source: 'pappers' };
    } catch (err) {
      if (err.response?.status === 404) {
        return { ok: false, error: 'Entreprise non trouvée pour ce SIRET.' };
      }
      console.warn('[Pappers] Erreur, bascule sur INSEE:', err.message);
    }
  }

  // 2. Fallback INSEE/SIRENE
  try {
    const headers = {};
    if (process.env.INSEE_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.INSEE_API_KEY}`;
    }
    const res = await axios.get(`${INSEE_BASE}/siret/${cleaned}`, { headers, timeout: 8000 });
    return { ok: true, data: normalizeINSEE(res.data.etablissement), source: 'insee' };
  } catch (err) {
    if (err.response?.status === 404) {
      return { ok: false, error: 'Entreprise non trouvée dans le registre SIRENE.' };
    }
    if (err.response?.status === 401) {
      return { ok: false, error: 'Clé API INSEE invalide ou absente.' };
    }
    return { ok: false, error: `Service d'identification indisponible. Réessayez dans quelques instants.` };
  }
}

// Normalise la réponse Pappers vers notre format interne
function normalizePappers(d) {
  return {
    siret: d.siret,
    siren: d.siren,
    raisonSociale: d.nom_entreprise || d.denomination,
    formeJuridique: d.forme_juridique,
    codeNAF: d.code_naf,
    libelleNAF: d.libelle_code_naf,
    dateCreation: d.date_creation,
    effectif: d.tranche_effectif_salarie || d.effectif,
    adresse: [d.adresse_ligne_1, d.code_postal, d.ville].filter(Boolean).join(', '),
    dirigeants: (d.dirigeants || []).map(p => ({
      nom: `${p.prenom || ''} ${p.nom || ''}`.trim(),
      qualite: p.qualite,
    })),
    statut: d.statut_rcs || null,
  };
}

// Normalise la réponse INSEE SIRENE vers notre format interne
function normalizeINSEE(etab) {
  const ul = etab?.uniteLegale || {};
  return {
    siret: etab.siret,
    siren: etab.siren,
    raisonSociale: ul.denominationUniteLegale || `${ul.prenom1UniteLegale || ''} ${ul.nomUniteLegale || ''}`.trim(),
    formeJuridique: ul.categorieJuridiqueUniteLegale,
    codeNAF: etab.activitePrincipaleEtablissement,
    libelleNAF: null, // non fourni directement par SIRENE
    dateCreation: ul.dateCreationUniteLegale,
    effectif: ul.trancheEffectifsUniteLegale,
    adresse: [
      etab.adresseEtablissement?.numeroVoieEtablissement,
      etab.adresseEtablissement?.typeVoieEtablissement,
      etab.adresseEtablissement?.libelleVoieEtablissement,
      etab.adresseEtablissement?.codePostalEtablissement,
      etab.adresseEtablissement?.libelleCommuneEtablissement,
    ].filter(Boolean).join(' '),
    dirigeants: [],
    statut: ul.etatAdministratifUniteLegale === 'A' ? 'Actif' : 'Cessé',
  };
}

module.exports = { searchBySiret };
