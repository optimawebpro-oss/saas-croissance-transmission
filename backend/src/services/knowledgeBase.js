const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '../../data/knowledge/exitready-docs');

// ── Chargement à froid au démarrage du serveur ────────────────────────────────
function load(relPath) {
  try { return fs.readFileSync(path.join(BASE, relPath), 'utf8'); }
  catch { return ''; }
}

const KB = {
  // Toujours injectés (règles critiques, ~28 Ko)
  core: {
    antiHallucination: load('skills/00-anti-hallucination-CRITIQUE.md'),
    charte:            load('ton-et-disclaimers/01-charte-de-ton.md'),
    disclaimers:       load('ton-et-disclaimers/02-disclaimers-obligatoires.md'),
  },

  // Scoring — 8 axes
  scoring: {
    dependanceDirigeant:   load('scoring/01-axe-dependance-dirigeant.md'),
    concentrationClient:   load('scoring/02-axe-concentration-client.md'),
    recurrenceRevenus:     load('scoring/03-axe-recurrence-revenus.md'),
    qualiteFinanciere:     load('scoring/04-axe-qualite-financiere.md'),
    capitalHumain:         load('scoring/05-axe-capital-humain.md'),
    documentationProcess:  load('scoring/06-axe-documentation-process.md'),
    conformiteJuridique:   load('scoring/07-axe-conformite-juridique.md'),
    attractiviteSectorielle: load('scoring/08-axe-attractivite-sectorielle.md'),
  },

  // Méthodologie et réglementation
  methodologie: load('methodologie/01-methodologie-valorisation.md'),
  reglementation: {
    dutreil:        load('reglementation/01-pacte-dutreil.md'),
    apportCession:  load('reglementation/02-apport-cession-150-0-b-ter.md'),
    plusValues:     load('reglementation/03-fiscalite-plus-values-cession.md'),
    partsVsFonds:   load('reglementation/04-cession-parts-vs-fonds-commerce.md'),
  },

  // Skills (procédures de raisonnement)
  skills: {
    diagnostic:      load('skills/01-diagnostic-initial.md'),
    planAction:      load('skills/02-generation-plan-action.md'),
    ecartValorisation: load('skills/03-explication-ecart-valorisation.md'),
    dataRoom:        load('skills/04-redaction-data-room.md'),
    simulateurFiscal: load('skills/05-simulateur-fiscal.md'),
  },

  // Glossaire et cas types
  glossaire: load('glossaire/01-glossaire-financier.md'),
  faq:       load('glossaire/02-faq-dirigeants.md'),
  casTypes: {
    btp:            load('cas-types/01-exemple-pme-btp.md'),
    cabinetConseil: load('cas-types/02-exemple-cabinet-conseil.md'),
    ecommerce:      load('cas-types/03-exemple-ecommerce.md'),
  },
};

// ── Règles de détection par mots-clés ────────────────────────────────────────
const KEYWORD_RULES = [
  { keys: ['dutreil', 'pacte', '787 b', 'transmission familiale'], doc: () => KB.reglementation.dutreil },
  { keys: ['apport-cession', 'apport cession', '150-0 b ter', '150 0 b'], doc: () => KB.reglementation.apportCession },
  { keys: ['plus-value', 'plus value', 'flat tax', 'prélèvement forfaitaire', 'pfu', 'imposition cession'], doc: () => KB.reglementation.plusValues },
  { keys: ['parts sociales', 'cession de fonds', 'fonds de commerce', 'parts vs fonds'], doc: () => KB.reglementation.partsVsFonds },
  { keys: ['data room', 'due diligence', 'audit acheteur', 'repreneur', 'document vendeur'], doc: () => KB.skills.dataRoom },
  { keys: ['fiscalité', 'fiscal', 'impôt', 'taxe', 'simuler', 'simulation fiscale'], doc: () => KB.skills.simulateurFiscal },
  { keys: ['valorisation', 'valeur', 'multiple', 'ebitda', 'ebe', 'valoriser'], doc: () => KB.methodologie + '\n\n' + KB.skills.ecartValorisation },
  { keys: ['diagnostic', 'score', 'transmissibilité', 'cédabilité', 'axe', 'noter'], doc: () => KB.skills.diagnostic },
  { keys: ['plan d\'action', 'plan action', 'feuille de route', 'roadmap', 'prioriser'], doc: () => KB.skills.planAction },
  { keys: ['dépendance dirigeant', 'dependance dirigeant', 'successeur', 'délégation'], doc: () => KB.scoring.dependanceDirigeant },
  { keys: ['client', 'concentration', 'portefeuille client', 'churn'], doc: () => KB.scoring.concentrationClient },
  { keys: ['récurrent', 'abonnement', 'revenu récurrent', 'arr', 'mrr'], doc: () => KB.scoring.recurrenceRevenus },
  { keys: ['rh', 'salariés', 'effectif', 'turnover', 'capital humain', 'equipe'], doc: () => KB.scoring.capitalHumain },
  { keys: ['juridique', 'conformité', 'statuts', 'contrat', 'baux', 'litige'], doc: () => KB.scoring.conformiteJuridique },
  { keys: ['secteur', 'marché', 'concurrents', 'attractivité'], doc: () => KB.scoring.attractiviteSectorielle },
  { keys: ['btp', 'construction', 'bâtiment'], doc: () => KB.casTypes.btp },
  { keys: ['cabinet', 'conseil', 'consulting', 'prestation intellectuelle'], doc: () => KB.casTypes.cabinetConseil },
  { keys: ['e-commerce', 'ecommerce', 'boutique en ligne', 'marketplace'], doc: () => KB.casTypes.ecommerce },
];

// ── Bloc de scoring complet (tous les 8 axes) ~50 Ko ─────────────────────────
function allScoringAxes() {
  return Object.values(KB.scoring).join('\n\n---\n\n');
}

// ── Fonction principale : construit le contexte à injecter ───────────────────
/**
 * @param {string} mod  'c' (croissance) | 't' (cession)
 * @param {string} lastUserMessage  dernier message de l'utilisateur
 * @returns {string}  bloc de contexte à préfixer au system prompt
 */
function buildContext(mod, lastUserMessage) {
  const msg = (lastUserMessage || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  const sections = [];

  // 1. Toujours : règles anti-hallucination + charte + disclaimers
  sections.push('# RÈGLES ABSOLUES\n' + KB.core.antiHallucination);
  sections.push('# CHARTE DE TON\n' + KB.core.charte);
  sections.push('# DISCLAIMERS OBLIGATOIRES\n' + KB.core.disclaimers);

  // 2. Module cession → injecte méthodologie + tous les axes de scoring
  if (mod === 't') {
    sections.push('# MÉTHODOLOGIE DE VALORISATION\n' + KB.methodologie);
    sections.push('# AXES DE SCORING DE TRANSMISSIBILITÉ\n' + allScoringAxes());
  }

  // 3. Détection par mots-clés (dédupliqué)
  const injected = new Set();
  for (const rule of KEYWORD_RULES) {
    if (rule.keys.some(k => msg.includes(k))) {
      const content = rule.doc();
      if (content && !injected.has(content)) {
        injected.add(content);
        sections.push(content);
      }
    }
  }

  // 4. Module croissance sans mot-clé détecté → injecte le glossaire
  if (mod === 'c' && injected.size === 0) {
    sections.push('# GLOSSAIRE FINANCIER\n' + KB.glossaire);
  }

  return sections.join('\n\n---\n\n');
}

module.exports = { buildContext };
