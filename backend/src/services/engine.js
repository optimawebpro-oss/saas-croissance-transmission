/**
 * engine.js — Moteur de calcul déterministe ExitReady (port de engine.py)
 *
 * RÈGLE D'OR : ce module est l'UNIQUE source de chiffres d'ExitReady.
 * Mistral ne calcule JAMAIS lui-même un score, une valorisation ou un impact fiscal.
 * Il appelle ces fonctions via function calling et restitue les résultats.
 */

'use strict';

// ============================================================
// 1. UTILITAIRES
// ============================================================

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function interpolate(x, points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (x <= sorted[0][0]) return sorted[0][1];
  if (x >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
  for (let i = 0; i < sorted.length - 1; i++) {
    const [x0, y0] = sorted[i];
    const [x1, y1] = sorted[i + 1];
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y0;
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return sorted[sorted.length - 1][1];
}

function applyProgressiveBrackets(amount, brackets) {
  if (amount <= 0) return 0;
  let total = 0;
  for (const [low, high, rate] of brackets) {
    if (amount <= low) break;
    const upper = high === null ? amount : Math.min(amount, high);
    const taxable = upper - low;
    if (taxable > 0) total += taxable * rate;
  }
  return total;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

// ============================================================
// 2. SCORING QUALITATIF — LES 8 AXES
// ============================================================

const AXIS_WEIGHTS = {
  axe1_dependance_dirigeant:    15,
  axe2_concentration_client:    15,
  axe3_recurrence_revenus:      12,
  axe4_qualite_financiere:      15,
  axe5_capital_humain:          10,
  axe6_documentation_process:   10,
  axe7_conformite_juridique:    13,
  axe8_attractivite_sectorielle: 10,
};

const AXIS_VALUATION_IMPACT = {
  axe1_dependance_dirigeant:    [-0.25, 0.00],
  axe2_concentration_client:    [-0.30, 0.05],
  axe3_recurrence_revenus:      [-0.15, 0.30],
  axe4_qualite_financiere:      [-0.15, 0.15],
  axe5_capital_humain:          [-0.10, 0.15],
  axe6_documentation_process:   [-0.10, 0.10],
  axe7_conformite_juridique:    [-0.20, 0.05],
  axe8_attractivite_sectorielle:[-0.10, 0.20],
};

const TOTAL_ADJUSTMENT_BOUNDS = [-0.55, 0.45];

function scoreAxe1(d) {
  const subAbsence   = interpolate(d.semaines_absence_sans_impact, [[0,0],[1,3],[2,5],[4,7],[8,9],[12,10]]);
  const subDelegation = clamp(d.pct_decisions_deleguees / 10, 0, 10);
  const subRelation   = clamp(10 - d.pct_ca_relation_personnelle_dirigeant / 10, 0, 10);
  const subSavoir     = clamp(d.pct_savoir_faire_documente / 10, 0, 10);
  const score = (subAbsence + subDelegation + subRelation + subSavoir) / 4;
  return { axe: 'axe1_dependance_dirigeant', score: Math.round(score * 100) / 100, poids: AXIS_WEIGHTS.axe1_dependance_dirigeant,
    detail: `absence=${subAbsence.toFixed(1)}, délégation=${subDelegation.toFixed(1)}, relation_perso=${subRelation.toFixed(1)}, savoir_faire=${subSavoir.toFixed(1)}` };
}

function scoreAxe2(d) {
  const scoreTop1 = interpolate(d.pct_top1_client, [[0,10],[10,9],[20,7],[30,5],[50,2],[70,0]]);
  const penalite  = (d.pct_top1_client < 30 && d.pct_top3_clients > 70) ? 1.5 : 0;
  const score = clamp(scoreTop1 - penalite, 0, 10);
  return { axe: 'axe2_concentration_client', score: Math.round(score * 100) / 100, poids: AXIS_WEIGHTS.axe2_concentration_client,
    detail: `top1=${d.pct_top1_client.toFixed(0)}%, top3=${d.pct_top3_clients.toFixed(0)}%, nb_clients=${d.nb_clients_actifs}` };
}

function scoreAxe3(d) {
  const score = interpolate(d.pct_ca_recurrent_contractuel, [[0,1],[10,3],[25,5],[50,7],[80,9],[100,10]]);
  return { axe: 'axe3_recurrence_revenus', score: Math.round(score * 100) / 100, poids: AXIS_WEIGHTS.axe3_recurrence_revenus,
    detail: `part_ca_recurrent=${d.pct_ca_recurrent_contractuel.toFixed(0)}%` };
}

function scoreAxe4(d) {
  const ecartMarge = d.marge_ebe_pct - d.marge_ebe_mediane_secteur_pct;
  const scoreMarge    = clamp(5 + ecartMarge * 0.5, 0, 10);
  const scoreCroissance = interpolate(d.croissance_ca_moyenne_pct, [[-10,1],[-3,4],[0,5],[5,7],[10,8],[15,10]]);
  const scoreEndettement = interpolate(d.gearing, [[0,9],[0.5,9],[1,7],[2,5],[3,3],[4,1]]);
  const modTendance = { amelioration: 1.0, stable: 0.0, degradation: -1.5 }[d.tendance_marge] ?? 0;
  const score = clamp((scoreMarge + scoreCroissance + scoreEndettement) / 3 + modTendance, 0, 10);
  return { axe: 'axe4_qualite_financiere', score: Math.round(score * 100) / 100, poids: AXIS_WEIGHTS.axe4_qualite_financiere,
    detail: `marge_vs_mediane=${ecartMarge > 0 ? '+' : ''}${ecartMarge.toFixed(1)}pt, croissance=${d.croissance_ca_moyenne_pct.toFixed(1)}%, gearing=${d.gearing.toFixed(2)}, tendance=${d.tendance_marge}` };
}

function scoreAxe5(d) {
  const subN1       = d.a_un_n1_identifie ? 10 : 3;
  const subTurnover = interpolate(d.turnover_annuel_pct, [[0,10],[5,9],[10,7],[15,6],[20,4],[30,1]]);
  const subHommes   = clamp(10 - Math.min(d.nb_hommes_cles_non_securises, 5) * 1.5, 0, 10);
  const subRH       = clamp(d.pct_rh_formalisee / 10, 0, 10);
  const score = (subN1 + subTurnover + subHommes + subRH) / 4;
  return { axe: 'axe5_capital_humain', score: Math.round(score * 100) / 100, poids: AXIS_WEIGHTS.axe5_capital_humain,
    detail: `n1_identifie=${d.a_un_n1_identifie}, turnover=${d.turnover_annuel_pct.toFixed(0)}%, hommes_cles_non_securises=${d.nb_hommes_cles_non_securises}, rh_formalisee=${d.pct_rh_formalisee.toFixed(0)}%` };
}

function scoreAxe6(d) {
  const base = d.pct_process_cles_documentes / 10;
  const modOnboarding = d.a_manuel_onboarding ? 1.0 : -0.5;
  const score = clamp(base + modOnboarding, 0, 10);
  return { axe: 'axe6_documentation_process', score: Math.round(score * 100) / 100, poids: AXIS_WEIGHTS.axe6_documentation_process,
    detail: `process_documentes=${d.pct_process_cles_documentes.toFixed(0)}%, onboarding=${d.a_manuel_onboarding}` };
}

function scoreAxe7(d) {
  const score = clamp(10 - d.nb_non_conformites_majeures * 3 - d.nb_non_conformites_mineures * 0.5 - (d.a_litiges_non_provisionnes ? 3 : 0), 0, 10);
  return { axe: 'axe7_conformite_juridique', score: Math.round(score * 100) / 100, poids: AXIS_WEIGHTS.axe7_conformite_juridique,
    detail: `non_conformites_majeures=${d.nb_non_conformites_majeures}, mineures=${d.nb_non_conformites_mineures}, litiges_non_provisionnes=${d.a_litiges_non_provisionnes}` };
}

function scoreAxe8(d) {
  const base = interpolate(d.croissance_secteur_pct, [[-10,1],[-3,3],[3,5],[10,7],[20,9]]);
  const modPosition  = { leader: 1.0, niche: 1.0, challenger: 0.0, suiveur: -1.0 }[d.positionnement] ?? 0;
  const modBarrieres = { fortes: 0.5, moyennes: 0.0, faibles: -0.5 }[d.barrieres_entree] ?? 0;
  const score = clamp(base + modPosition + modBarrieres, 0, 10);
  return { axe: 'axe8_attractivite_sectorielle', score: Math.round(score * 100) / 100, poids: AXIS_WEIGHTS.axe8_attractivite_sectorielle,
    detail: `croissance_secteur=${d.croissance_secteur_pct.toFixed(1)}%, positionnement=${d.positionnement}, barrieres_entree=${d.barrieres_entree}` };
}

function calculateTransmissibilityScore(inputs) {
  const axisScores = [scoreAxe1, scoreAxe2, scoreAxe3, scoreAxe4, scoreAxe5, scoreAxe6, scoreAxe7, scoreAxe8].map(fn => fn(inputs));
  const scoreGlobal = axisScores.reduce((sum, a) => sum + a.score * a.poids, 0) / 10;
  const axesFaibles = axisScores
    .filter(a => a.score < 5)
    .sort((a, b) => a.score - b.score)
    .map(a => a.axe);
  return {
    score_global_sur_100: Math.round(scoreGlobal * 10) / 10,
    scores_par_axe: axisScores,
    axes_faibles: axesFaibles,
  };
}

function axisAdjustment(axe, score) {
  const [low, high] = AXIS_VALUATION_IMPACT[axe];
  return interpolate(score, [[0, low], [10, high]]);
}

function totalQualitativeAdjustment(scoreResult) {
  const total = scoreResult.scores_par_axe.reduce((sum, a) => sum + axisAdjustment(a.axe, a.score), 0);
  return clamp(total, ...TOTAL_ADJUSTMENT_BOUNDS);
}

// ============================================================
// 3. MULTIPLES SECTORIELS
// ============================================================

const SECTOR_TABLE = {
  tech_saas:                { key: 'tech_saas',                label: 'SaaS / Tech récurrent',        low: 6.0, median: 9.0, high: 12.0 },
  ecommerce:                { key: 'ecommerce',                label: 'E-commerce',                    low: 4.0, median: 5.5, high: 7.0  },
  conseil_b2b:              { key: 'conseil_b2b',              label: 'Conseil B2B',                   low: 4.0, median: 5.0, high: 6.0  },
  industrie_manufacturiere: { key: 'industrie_manufacturiere', label: 'Industrie manufacturière',      low: 4.0, median: 5.0, high: 6.0  },
  services_entreprises:     { key: 'services_entreprises',     label: 'Services aux entreprises',      low: 4.0, median: 5.0, high: 6.0  },
  btp:                      { key: 'btp',                      label: 'BTP / construction',            low: 3.0, median: 4.0, high: 5.0  },
  distribution_gros:        { key: 'distribution_gros',        label: 'Distribution / commerce gros',  low: 3.0, median: 4.0, high: 5.0  },
  restauration_hotellerie:  { key: 'restauration_hotellerie',  label: 'Restauration / hôtellerie',     low: 4.0, median: 5.5, high: 7.0  },
  commerce_detail:          { key: 'commerce_detail',          label: 'Commerce de détail',            low: 3.0, median: 4.0, high: 5.0  },
  artisanat:                { key: 'artisanat',                label: 'Artisanat',                     low: 2.0, median: 3.0, high: 4.0  },
  transport:                { key: 'transport',                label: 'Transport',                     low: 3.0, median: 4.0, high: 5.0  },
};

const NAF_TO_SECTOR = {
  ...Object.fromEntries([...Array(24)].map((_, i) => [(10 + i).toString(), 'industrie_manufacturiere'])),
  '41': 'btp', '42': 'btp', '43': 'btp',
  '45': 'distribution_gros', '46': 'distribution_gros',
  '47': 'commerce_detail',
  '49': 'transport', '50': 'transport', '51': 'transport', '52': 'transport', '53': 'transport',
  '55': 'restauration_hotellerie', '56': 'restauration_hotellerie',
  '58': 'tech_saas', '59': 'tech_saas', '60': 'tech_saas', '61': 'tech_saas', '62': 'tech_saas', '63': 'tech_saas',
  '69': 'conseil_b2b', '70': 'conseil_b2b', '71': 'conseil_b2b', '72': 'conseil_b2b',
  '73': 'conseil_b2b', '74': 'conseil_b2b',
};

const DEFAULT_SECTOR = { key: 'generaliste', label: 'Généraliste (secteur non reconnu)', low: 3.0, median: 4.0, high: 5.0 };

function getSectorMultiples(nafCode) {
  const code = nafCode.trim().toUpperCase().replace(/[. ]/g, '');
  if (code.startsWith('4791')) return SECTOR_TABLE['ecommerce'];
  const division = code.slice(0, 2);
  const key = NAF_TO_SECTOR[division];
  return key ? SECTOR_TABLE[key] : DEFAULT_SECTOR;
}

// ============================================================
// 4. EBE NORMATIF
// ============================================================

function computeEbeNormatif(ebeComptable, retraitements = {}) {
  const {
    remuneration_dirigeant_actuelle = 0,
    remuneration_dirigeant_normative = 0,
    loyer_actuel = 0,
    loyer_normatif = 0,
    charges_exceptionnelles_non_recurrentes = 0,
    produits_exceptionnels_non_recurrents = 0,
    charges_personnelles_reintegrees = 0,
  } = retraitements;

  const deltaRemuneration = remuneration_dirigeant_actuelle - remuneration_dirigeant_normative;
  const deltaLoyer = loyer_actuel - loyer_normatif;

  const ebeNormatif = ebeComptable + deltaRemuneration + deltaLoyer
    + charges_exceptionnelles_non_recurrentes
    - produits_exceptionnels_non_recurrents
    + charges_personnelles_reintegrees;

  return {
    ebe_comptable: roundMoney(ebeComptable),
    ebe_normatif: roundMoney(ebeNormatif),
    detail_ajustements: {
      delta_remuneration_dirigeant: roundMoney(deltaRemuneration),
      delta_loyer: roundMoney(deltaLoyer),
      charges_exceptionnelles_reintegrees: roundMoney(charges_exceptionnelles_non_recurrentes),
      produits_exceptionnels_deduits: roundMoney(-produits_exceptionnels_non_recurrents),
      charges_personnelles_reintegrees: roundMoney(charges_personnelles_reintegrees),
    },
  };
}

// ============================================================
// 5. VALORISATION
// ============================================================

function calculateValuation(ebeNormatif, nafCode, scoreResult, detteFinanciere = 0, tresorerieDisponible = 0) {
  const sector = getSectorMultiples(nafCode);
  const adjustment = totalQualitativeAdjustment(scoreResult);

  const multBas    = sector.low    * (1 + adjustment);
  const multMedian = sector.median * (1 + adjustment);
  const multHaut   = sector.high   * (1 + adjustment);

  const veBasse   = ebeNormatif * multBas;
  const veMediane = ebeNormatif * multMedian;
  const veHaute   = ebeNormatif * multHaut;

  const detteNette = detteFinanciere - tresorerieDisponible;

  const axesPrioritaires = [...scoreResult.axes_faibles]
    .sort((a, b) => AXIS_VALUATION_IMPACT[a][0] - AXIS_VALUATION_IMPACT[b][0])
    .slice(0, 3);

  return {
    ebe_normatif: roundMoney(ebeNormatif),
    secteur: sector.label,
    multiple_sectoriel_median_brut: sector.median,
    ajustement_qualitatif_pct: Math.round(adjustment * 1000) / 10,
    multiple_ajuste_bas:    Math.round(multBas    * 100) / 100,
    multiple_ajuste_median: Math.round(multMedian * 100) / 100,
    multiple_ajuste_haut:   Math.round(multHaut   * 100) / 100,
    valeur_entreprise_basse:   roundMoney(veBasse),
    valeur_entreprise_mediane: roundMoney(veMediane),
    valeur_entreprise_haute:   roundMoney(veHaute),
    dette_nette: roundMoney(detteNette),
    valeur_titres_basse:   roundMoney(veBasse   - detteNette),
    valeur_titres_mediane: roundMoney(veMediane - detteNette),
    valeur_titres_haute:   roundMoney(veHaute   - detteNette),
    axes_prioritaires_amelioration: axesPrioritaires,
  };
}

// ============================================================
// 6. SIMULATEUR FISCAL — à jour LF 2026
// ============================================================

const PFU_IR_RATE    = 0.128;
const PFU_PS_RATE    = 0.186;
const PFU_TOTAL_RATE = PFU_IR_RATE + PFU_PS_RATE; // 31,4 %
const ABATTEMENT_RETRAITE = 500_000;
const DUTREIL_EXONERATION = 0.75;
const ABATTEMENT_PARENT_ENFANT = 100_000;

const CEHR_BRACKETS = {
  celibataire: [[0, 250_000, 0], [250_000, 500_000, 0.03], [500_000, null, 0.04]],
  couple:      [[0, 500_000, 0], [500_000, 1_000_000, 0.03], [1_000_000, null, 0.04]],
};

const DONATION_BRACKETS = [
  [0, 8_072, 0.05], [8_072, 12_109, 0.10], [12_109, 15_932, 0.15],
  [15_932, 552_324, 0.20], [552_324, 902_838, 0.30], [902_838, 1_805_677, 0.40], [1_805_677, null, 0.45],
];

function cehr(rfr, situation) {
  return applyProgressiveBrackets(rfr, CEHR_BRACKETS[situation] || CEHR_BRACKETS.celibataire);
}

function scenarioPFU(plusValueBrute, rfr = 0, situation = 'celibataire') {
  const ir = plusValueBrute * PFU_IR_RATE;
  const ps = plusValueBrute * PFU_PS_RATE;
  const cehrMontant = rfr > 0 ? cehr(rfr, situation) : 0;
  const imposition = ir + ps + cehrMontant;
  return {
    nom: 'Cession directe au PFU',
    eligible: true,
    raisons_ineligibilite: [],
    imposition_immediate: roundMoney(imposition),
    net_disponible_immediat: roundMoney(plusValueBrute - imposition),
    contraintes: [],
    detail: { plus_value_brute: roundMoney(plusValueBrute), ir_12_8: roundMoney(ir), prelevements_sociaux_18_6: roundMoney(ps), cehr: roundMoney(cehrMontant) },
  };
}

function scenarioRetraite(plusValueBrute, params, rfr = 0, situation = 'celibataire') {
  const raisons = [];
  if (params.detention_pct < 25)              raisons.push('Détention < 25 % du capital');
  if (params.annees_detention < 5)            raisons.push('Détention < 5 ans');
  if (params.annees_direction < 5)            raisons.push('Fonction de direction < 5 ans');
  if (!params.pme_sens_europeen)              raisons.push("L'entreprise n'est pas une PME au sens européen");
  if (!params.cessation_fonctions)            raisons.push('Le cédant ne cesse pas toute fonction');
  if (!params.depart_retraite_dans_24_mois)   raisons.push('Départ en retraite non prévu dans les 24 mois');
  if (!params.cession_a_un_tiers)             raisons.push("La cession n'est pas faite à un tiers");
  const eligible = raisons.length === 0;
  const assiette = eligible ? Math.max(0, plusValueBrute - ABATTEMENT_RETRAITE) : plusValueBrute;
  const ir = assiette * PFU_IR_RATE;
  const ps = plusValueBrute * PFU_PS_RATE;
  const cehrMontant = rfr > 0 ? cehr(rfr, situation) : 0;
  const imposition = ir + ps + cehrMontant;
  return {
    nom: 'Cession + abattement 500 k€ départ retraite',
    eligible, raisons_ineligibilite: raisons,
    imposition_immediate: roundMoney(eligible ? imposition : plusValueBrute * PFU_TOTAL_RATE),
    net_disponible_immediat: roundMoney(eligible ? plusValueBrute - imposition : plusValueBrute * (1 - PFU_TOTAL_RATE)),
    contraintes: ['Abattement applicable uniquement sur assiette IR (PS dus sur assiette pleine)'],
    detail: { plus_value_brute: roundMoney(plusValueBrute), assiette_ir: roundMoney(assiette), ir: roundMoney(ir), prelevements_sociaux: roundMoney(ps), cehr: roundMoney(cehrMontant) },
  };
}

function scenarioApportCession(prixCession, params) {
  const raisons = [];
  if (!params.apport_realise_plus_de_12_mois_avant_cession)
    raisons.push('Apport trop proche de la cession : risque abus de droit (structurer 12-18 mois avant)');
  const eligible = raisons.length === 0;
  const montantReinvestir = (!params.holding_conserve_plus_de_3_ans && eligible) ? prixCession * 0.70 : 0;
  const contraintes = params.holding_conserve_plus_de_3_ans
    ? ['Conservation > 3 ans par la holding : aucune obligation de réinvestissement']
    : ['70 % du produit à réinvestir dans activité éligible sous 36 mois', 'Conservation 5 ans minimum', 'Activités financières et immobilières exclues'];
  return {
    nom: "Apport-cession via holding (report d'imposition)",
    eligible, raisons_ineligibilite: raisons,
    imposition_immediate: eligible ? 0 : roundMoney(prixCession * PFU_TOTAL_RATE),
    net_disponible_immediat: eligible ? roundMoney(prixCession) : roundMoney(prixCession * (1 - PFU_TOTAL_RATE)),
    contraintes,
    detail: { prix_cession: roundMoney(prixCession), montant_a_reinvestir: roundMoney(montantReinvestir), report_pas_exoneration: true },
  };
}

function scenarioDutreil(valeurTitres, params) {
  const raisons = [];
  if (!params.societe_eligible_dutreil)        raisons.push('Société non éligible (activité non opérationnelle)');
  if (!params.engagement_collectif_respecte)   raisons.push('Engagement collectif de conservation non respecté');
  if (!params.fonction_direction_beneficiaire) raisons.push('Aucun bénéficiaire ne prend la direction');
  const eligible = raisons.length === 0;
  const pctNonOp = params.pct_actifs_non_operationnels || 0;
  const valeurOp    = valeurTitres * (1 - pctNonOp / 100);
  const valeurNonOp = valeurTitres - valeurOp;
  const assiette = eligible ? (valeurOp * (1 - DUTREIL_EXONERATION) + valeurNonOp) : valeurTitres;
  const abattementTotal = ABATTEMENT_PARENT_ENFANT * (params.nb_beneficiaires || 1);
  const assietteTaxable = Math.max(0, assiette - abattementTotal);
  let droits = applyProgressiveBrackets(assietteTaxable / Math.max(params.nb_beneficiaires || 1, 1), DONATION_BRACKETS) * Math.max(params.nb_beneficiaires || 1, 1);
  if (params.donation_avant_70_ans && eligible) droits *= 0.5;
  const contraintes = [
    'Engagement total de conservation : 8 ans (2 ans collectif + 6 ans individuel — LF 2026)',
    'Cession partielle pendant engagement individuel → déchéance totale',
  ];
  if (pctNonOp > 0) contraintes.push(`${pctNonOp.toFixed(0)} % de la valeur exclue de l'exonération (actifs non opérationnels)`);
  return {
    nom: 'Donation avec Pacte Dutreil',
    eligible, raisons_ineligibilite: raisons,
    imposition_immediate: roundMoney(droits),
    net_disponible_immediat: roundMoney(valeurTitres - droits),
    contraintes,
    detail: { valeur_titres: roundMoney(valeurTitres), valeur_operationnelle: roundMoney(valeurOp), assiette_apres_dutreil_et_abattements: roundMoney(assietteTaxable), droits_de_donation: roundMoney(droits) },
  };
}

function runFiscalSimulation(plusValueBrute, prixCession, rfr = 0, situation = 'celibataire', eligibiliteRetraite, eligibiliteApportCession, eligibiliteDutreil) {
  const scenarios = [scenarioPFU(plusValueBrute, rfr, situation)];
  if (eligibiliteRetraite)       scenarios.push(scenarioRetraite(plusValueBrute, eligibiliteRetraite, rfr, situation));
  if (eligibiliteApportCession)  scenarios.push(scenarioApportCession(prixCession, eligibiliteApportCession));
  if (eligibiliteDutreil)        scenarios.push(scenarioDutreil(prixCession, eligibiliteDutreil));
  return { scenarios };
}

// ============================================================
// 7. DISPATCHER FUNCTION CALLING
// ============================================================

function executeToolCall(toolName, args) {
  if (toolName === 'calculate_transmissibility_score') {
    return calculateTransmissibilityScore(args);
  }
  if (toolName === 'get_sector_multiples') {
    return getSectorMultiples(args.naf_code);
  }
  if (toolName === 'compute_ebe_normatif') {
    return computeEbeNormatif(args.ebe_comptable, args.retraitements || {});
  }
  if (toolName === 'calculate_valuation') {
    const scoreResult = calculateTransmissibilityScore(args.qualitative_inputs);
    return calculateValuation(args.ebe_normatif, args.naf_code, scoreResult, args.dette_financiere || 0, args.tresorerie_disponible || 0);
  }
  if (toolName === 'run_fiscal_simulation') {
    return runFiscalSimulation(
      args.plus_value_brute, args.prix_cession,
      args.revenu_fiscal_reference || 0,
      args.situation_foyer || 'celibataire',
      args.eligibilite_retraite,
      args.eligibilite_apport_cession,
      args.eligibilite_dutreil,
    );
  }
  return { error: `Outil inconnu : ${toolName}` };
}

module.exports = { executeToolCall, calculateTransmissibilityScore, calculateValuation, computeEbeNormatif, runFiscalSimulation, getSectorMultiples };
