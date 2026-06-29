/**
 * mistral.js — Proxy backend vers Mistral AI avec function calling déterministe
 *
 * Flux :
 *  1. Requête client → enrichissement RAG → appel Mistral non-streaming
 *  2. Si Mistral demande un tool_call → exécution locale (engine.js) → réponse injectée
 *  3. Appel final Mistral en streaming → pipe SSE vers client
 *
 * Mistral NE calcule JAMAIS les chiffres lui-même.
 */

'use strict';

const router = require('express').Router();
const https  = require('https');
const { requireAuth } = require('../middleware/kindeAuth');
const { requirePlan } = require('../middleware/requirePlan');
const { buildContext } = require('../services/knowledgeBase');
const { executeToolCall } = require('../services/engine');

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_HOST    = 'api.mistral.ai';

// ── Définitions des outils exposés à Mistral ─────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'calculate_transmissibility_score',
      description: "Calcule le score de transmissibilité de l'entreprise sur 100 à partir de 22 critères qualitatifs répartis sur 8 axes. Obligatoire avant tout diagnostic ou valorisation.",
      parameters: {
        type: 'object',
        required: ['semaines_absence_sans_impact','pct_decisions_deleguees','pct_ca_relation_personnelle_dirigeant','pct_savoir_faire_documente','pct_top1_client','pct_top3_clients','nb_clients_actifs','pct_ca_recurrent_contractuel','marge_ebe_pct','marge_ebe_mediane_secteur_pct','croissance_ca_moyenne_pct','gearing','tendance_marge','a_un_n1_identifie','turnover_annuel_pct','nb_hommes_cles_non_securises','pct_rh_formalisee','pct_process_cles_documentes','a_manuel_onboarding','nb_non_conformites_majeures','nb_non_conformites_mineures','a_litiges_non_provisionnes','croissance_secteur_pct','positionnement','barrieres_entree'],
        properties: {
          semaines_absence_sans_impact:         { type: 'number', description: "Semaines d'absence du dirigeant sans impact sur l'exploitation" },
          pct_decisions_deleguees:              { type: 'number', description: "% des decisions operationnelles deleguees (0-100)" },
          pct_ca_relation_personnelle_dirigeant:{ type: 'number', description: "% du CA reposant sur la relation personnelle du dirigeant (0-100)" },
          pct_savoir_faire_documente:           { type: 'number', description: "% du savoir-faire metier documente (0-100)" },
          pct_top1_client:                      { type: 'number', description: "% du CA realise avec le 1er client" },
          pct_top3_clients:                     { type: 'number', description: "% du CA realise avec les 3 premiers clients" },
          nb_clients_actifs:                    { type: 'number', description: "Nombre de clients actifs sur 12 mois" },
          pct_ca_recurrent_contractuel:         { type: 'number', description: "% du CA sous contrat recurrent (abonnement, contrat-cadre) (0-100)" },
          marge_ebe_pct:                        { type: 'number', description: "Marge EBE de l'entreprise en % du CA" },
          marge_ebe_mediane_secteur_pct:        { type: 'number', description: "Marge EBE mediane du secteur en %" },
          croissance_ca_moyenne_pct:            { type: 'number', description: "Croissance annuelle moyenne du CA sur 3 ans (%)" },
          gearing:                              { type: 'number', description: "Ratio dette financiere nette / EBE normatif" },
          tendance_marge:                       { type: 'string', enum: ['amelioration','stable','degradation'], description: "Tendance de la marge EBE sur 3 ans" },
          a_un_n1_identifie:                    { type: 'boolean', description: "L'entreprise a un N-1 capable de remplacer le dirigeant" },
          turnover_annuel_pct:                  { type: 'number', description: "Taux de turnover annuel du personnel (%)" },
          nb_hommes_cles_non_securises:         { type: 'number', description: "Nombre d'hommes-cles sans clause de non-concurrence" },
          pct_rh_formalisee:                    { type: 'number', description: "% de la politique RH formalisee (0-100)" },
          pct_process_cles_documentes:          { type: 'number', description: "% des process cles documentes (0-100)" },
          a_manuel_onboarding:                  { type: 'boolean', description: "Manuel d'onboarding ou procedures d'integration existants" },
          nb_non_conformites_majeures:          { type: 'number', description: "Nombre de non-conformites juridiques majeures" },
          nb_non_conformites_mineures:          { type: 'number', description: "Nombre de non-conformites juridiques mineures" },
          a_litiges_non_provisionnes:           { type: 'boolean', description: "Litiges significatifs non provisionnes" },
          croissance_secteur_pct:               { type: 'number', description: "Croissance annuelle du secteur d'activite (%)" },
          positionnement:                       { type: 'string', enum: ['leader','niche','challenger','suiveur'] },
          barrieres_entree:                     { type: 'string', enum: ['fortes','moyennes','faibles'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compute_ebe_normatif',
      description: "Calcule l'EBE normatif (EBITDA retraité) à partir de l'EBE comptable et des ajustements standard. À appeler avant calculate_valuation.",
      parameters: {
        type: 'object',
        required: ['ebe_comptable'],
        properties: {
          ebe_comptable: { type: 'number', description: 'EBE comptable brut en euros' },
          retraitements: {
            type: 'object',
            description: 'Ajustements normatifs',
            properties: {
              remuneration_dirigeant_actuelle:      { type: 'number', description: 'Rémunération actuelle du dirigeant (charges comprises)' },
              remuneration_dirigeant_normative:     { type: 'number', description: 'Rémunération normative pour un directeur général salarié équivalent' },
              loyer_actuel:                         { type: 'number', description: 'Loyer payé actuellement (si immobilier dissocié)' },
              loyer_normatif:                       { type: 'number', description: 'Loyer de marché équivalent' },
              charges_exceptionnelles_non_recurrentes: { type: 'number', description: 'Charges non récurrentes à réintégrer (restructuration, litiges, etc.)' },
              produits_exceptionnels_non_recurrents:   { type: 'number', description: "Produits exceptionnels a deduire (cession d'actifs, etc.)" },
              charges_personnelles_reintegrees:     { type: 'number', description: "Avantages en nature ou charges personnelles passes en frais d'entreprise" },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_valuation',
      description: "Calcule la fourchette de valorisation de l'entreprise (EBE × multiple sectoriel ajusté par le score qualitatif). Nécessite l'EBE normatif et les données qualitatives complètes.",
      parameters: {
        type: 'object',
        required: ['ebe_normatif', 'naf_code', 'qualitative_inputs'],
        properties: {
          ebe_normatif:       { type: 'number', description: 'EBE normatif en euros (résultat de compute_ebe_normatif)' },
          naf_code:           { type: 'string', description: "Code NAF de l'entreprise (ex: 6201Z, 4399A)" },
          qualitative_inputs: { type: 'object', description: 'Identique aux paramètres de calculate_transmissibility_score' },
          dette_financiere:   { type: 'number', description: 'Dette financière brute en euros (défaut 0)' },
          tresorerie_disponible: { type: 'number', description: 'Trésorerie disponible en euros (défaut 0)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sector_multiples',
      description: "Retourne les multiples d'EBE sectoriels (bas / médian / haut) selon le code NAF.",
      parameters: {
        type: 'object',
        required: ['naf_code'],
        properties: {
          naf_code: { type: 'string', description: 'Code NAF (ex : 6201Z, 4752B, 1071A)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_fiscal_simulation',
      description: "Simule et compare jusqu'à 4 scénarios fiscaux de cession : PFU direct, abattement départ retraite, apport-cession (report d'imposition), Pacte Dutreil (donation). À jour LF 2026.",
      parameters: {
        type: 'object',
        required: ['plus_value_brute', 'prix_cession'],
        properties: {
          plus_value_brute:          { type: 'number', description: 'Plus-value brute de cession en euros (prix - prix de revient)' },
          prix_cession:              { type: 'number', description: 'Prix de cession total en euros' },
          revenu_fiscal_reference:   { type: 'number', description: 'RFR du foyer fiscal pour calcul CEHR (défaut 0)' },
          situation_foyer:           { type: 'string', enum: ['celibataire','couple'], description: 'Situation du foyer fiscal' },
          eligibilite_retraite: {
            type: 'object',
            description: "Parametres d'eligibilite a l'abattement depart retraite (500 k€)",
            properties: {
              detention_pct:                  { type: 'number' },
              annees_detention:               { type: 'number' },
              annees_direction:               { type: 'number' },
              pme_sens_europeen:              { type: 'boolean' },
              cessation_fonctions:            { type: 'boolean' },
              depart_retraite_dans_24_mois:   { type: 'boolean' },
              cession_a_un_tiers:             { type: 'boolean' },
            },
          },
          eligibilite_apport_cession: {
            type: 'object',
            description: "Parametres d'eligibilite a l'apport-cession (art. 150-0 B ter)",
            properties: {
              apport_realise_plus_de_12_mois_avant_cession: { type: 'boolean' },
              holding_conserve_plus_de_3_ans: { type: 'boolean' },
            },
          },
          eligibilite_dutreil: {
            type: 'object',
            description: "Parametres d'eligibilite au Pacte Dutreil (donation)",
            properties: {
              societe_eligible_dutreil:        { type: 'boolean' },
              engagement_collectif_respecte:   { type: 'boolean' },
              fonction_direction_beneficiaire: { type: 'boolean' },
              nb_beneficiaires:                { type: 'number' },
              pct_actifs_non_operationnels:    { type: 'number' },
              donation_avant_70_ans:           { type: 'boolean' },
            },
          },
        },
      },
    },
  },
];

// ── Appel HTTP vers Mistral (promesse) ────────────────────────────────────────

function mistralRequest(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: MISTRAL_HOST,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { reject(new Error('JSON parse error from Mistral')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function mistralStream(payload, res) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ...payload, stream: true });
    const options = {
      hostname: MISTRAL_HOST,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, mistralRes => {
      if (mistralRes.statusCode !== 200) {
        return reject(new Error(`Mistral ${mistralRes.statusCode}`));
      }
      mistralRes.pipe(res);
      mistralRes.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Route principale ─────────────────────────────────────────────────────────

router.post('/chat', requireAuth, requirePlan('croissance'), async (req, res) => {
  const { messages, model, temperature, max_tokens, mod } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages requis.' });
  }

  // Injecte la base de connaissances dans le system prompt
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const knowledgeContext = buildContext(mod || 't', lastUserMsg);

  const enrichedMessages = messages.map((m, i) => {
    if (m.role === 'system' && i === 0) {
      return { ...m, content: knowledgeContext + '\n\n---\n\n# INSTRUCTIONS SPÉCIFIQUES\n\n' + m.content };
    }
    return m;
  });

  const basePayload = {
    model:       model       || 'mistral-large-latest',
    temperature: temperature ?? 0.55,
    max_tokens:  max_tokens  ?? 1800,
    tools:       TOOLS,
    tool_choice: 'auto',
  };

  // ── Boucle function calling (max 5 tours) ──────────────────────────────────
  let conversation = [...enrichedMessages];

  try {
    for (let turn = 0; turn < 5; turn++) {
      const result = await mistralRequest({ ...basePayload, messages: conversation, stream: false });

      if (result.status !== 200) {
        return res.status(result.status).json({ error: 'Erreur Mistral', detail: result.body });
      }

      const choice = result.body.choices?.[0];
      if (!choice) return res.status(502).json({ error: 'Réponse Mistral vide.' });

      // Pas de tool_calls → on passe au streaming final avec ce message
      if (!choice.message?.tool_calls?.length) {
        conversation.push(choice.message);
        break;
      }

      // Des tool_calls ont été demandés → on les exécute
      conversation.push(choice.message);

      for (const tc of choice.message.tool_calls) {
        let toolArgs;
        try { toolArgs = JSON.parse(tc.function.arguments); }
        catch { toolArgs = {}; }

        const toolResult = executeToolCall(tc.function.name, toolArgs);

        conversation.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(toolResult),
        });
      }

      // Si finish_reason === 'tool_calls' → boucler, sinon on sort
      if (choice.finish_reason !== 'tool_calls') break;
    }

    // ── Streaming de la réponse finale ─────────────────────────────────────
    // On retire les tools pour le dernier appel (pas besoin de les proposer à nouveau)
    const finalPayload = { ...basePayload, messages: conversation };
    delete finalPayload.tools;
    delete finalPayload.tool_choice;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    await mistralStream(finalPayload, res);

  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Erreur proxy Mistral', detail: err.message });
    } else {
      res.end();
    }
  }
});

module.exports = router;
