const path = require('path');
const fs = require('fs');

const DATA_PATH = path.join(__dirname, '../../data/benchmarks.json');

let cache = null;

function loadBenchmarks() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    return cache;
  } catch {
    console.warn('[Benchmarks] Fichier non trouvé, retour vide.');
    return { secteurs: [] };
  }
}

/**
 * Retourne le multiple EBE pour un code NAF donné
 * Architecture prévue pour brancher une API externe (ex: Epsilon Research) sans refactoring
 * @param {string} codeNAF
 * @returns {{ multiple_bas, multiple_moyen, multiple_haut, source, secteur } | null}
 */
function getMultiple(codeNAF) {
  const data = loadBenchmarks();
  const code = (codeNAF || '').replace(/\s/g, '').toUpperCase();

  // Correspondance exacte code NAF
  let entry = data.secteurs.find(s => s.codes_naf?.includes(code));

  // Fallback : 2 premiers caractères (ex: "47" pour le commerce de détail)
  if (!entry) {
    entry = data.secteurs.find(s => s.codes_naf?.some(c => code.startsWith(c.substring(0, 2))));
  }

  // Fallback global "tous secteurs"
  if (!entry) {
    entry = data.secteurs.find(s => s.codes_naf?.includes('*'));
  }

  return entry ? {
    multiple_bas: entry.multiple_bas,
    multiple_moyen: entry.multiple_moyen,
    multiple_haut: entry.multiple_haut,
    source: entry.source,
    secteur: entry.secteur,
    dateMAJ: entry.date_maj,
  } : null;
}

/**
 * Calcule la valorisation de l'entreprise à partir de l'EBE et du multiple sectoriel
 * @param {number} ebitda — EBE en euros
 * @param {string} codeNAF
 * @returns {{ valorisation_basse, valorisation_moyenne, valorisation_haute, multiple } | null}
 */
function calculateValorisation(ebitda, codeNAF) {
  if (!ebitda || ebitda <= 0) return null;
  const m = getMultiple(codeNAF);
  if (!m) return null;
  return {
    valorisation_basse: Math.round(ebitda * m.multiple_bas),
    valorisation_moyenne: Math.round(ebitda * m.multiple_moyen),
    valorisation_haute: Math.round(ebitda * m.multiple_haut),
    multiple: m,
  };
}

/**
 * Invalide le cache (après mise à jour du fichier)
 */
function invalidateCache() { cache = null; }

module.exports = { getMultiple, calculateValorisation, loadBenchmarks, invalidateCache };
