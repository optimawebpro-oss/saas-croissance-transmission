const payfit = require('./payfit');
const lucca = require('./lucca');

const ADAPTERS = { payfit, lucca };

function getAdapter(provider) {
  const a = ADAPTERS[provider.toLowerCase()];
  if (!a) throw new Error(`SIRH non supporté : ${provider}`);
  return a;
}

async function fetchSIRHData(provider, accessToken) {
  const adapter = getAdapter(provider);
  const raw = await adapter.fetchData(accessToken);
  if (!raw.ok) return raw;
  return { ok: true, data: normalize(raw.data) };
}

/**
 * Normalise les données SIRH vers notre format interne
 * Alimente les scores "capital humain" et "dépendance au dirigeant"
 */
function normalize(raw) {
  const { employes, postes, departs } = raw;

  const effectif = employes.length;
  const now = Date.now();
  const un_an = 365 * 24 * 60 * 60 * 1000;

  // Ancienneté moyenne
  const anciennetes = employes.map(e => {
    const debut = new Date(e.dateEntree).getTime();
    return (now - debut) / un_an;
  });
  const ancienneteMoyenne = anciennetes.length
    ? anciennetes.reduce((s, a) => s + a, 0) / anciennetes.length
    : 0;

  // Turnover 12 mois
  const departsAn = departs.filter(d => (now - new Date(d.date).getTime()) < un_an).length;
  const turnover12m = effectif > 0 ? (departsAn / effectif) * 100 : 0;

  // Dépendance au dirigeant : y a-t-il un N-1 opérationnel ?
  const hasDirectionN1 = postes.some(p =>
    /directeur|manager|responsable|DG|DAF|DRH|DSI|directrice/i.test(p.intitule) &&
    p.niveau === 'N-1'
  );

  return {
    effectif,
    ancienneteMoyenneMois: Math.round(ancienneteMoyenne * 12 * 10) / 10,
    turnover12mois: Math.round(turnover12m * 10) / 10,
    hasDirectionN1,
    dependanceDirigeant: !hasDirectionN1,
    repartitionPostes: postes.reduce((acc, p) => {
      acc[p.categorie] = (acc[p.categorie] || 0) + 1;
      return acc;
    }, {}),
  };
}

/**
 * Saisie manuelle (fallback TPE sans SIRH)
 */
function computeManual(data) {
  return {
    effectif: data.effectif,
    ancienneteMoyenneMois: data.ancienneteMoyenneMois,
    turnover12mois: data.turnover12mois,
    hasDirectionN1: data.hasDirectionN1,
    dependanceDirigeant: !data.hasDirectionN1,
    repartitionPostes: { manuel: data.effectif },
    source: 'manuel',
  };
}

module.exports = { fetchSIRHData, getAdapter, computeManual };
