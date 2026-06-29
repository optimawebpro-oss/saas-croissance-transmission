// ===== MISTRAL AI — EVOLUTY =====
const MISTRAL_BACKEND_URL = (window.EVOLUTY_BACKEND_URL || 'http://localhost:3001') + '/api/mistral/chat';
const MISTRAL_MODEL = 'mistral-large-latest';

// ── Prompts de base (hors plan) ──────────────────────────────────────────────
const BASE_PROMPTS = {
  c: `Tu es un conseiller stratégique d'élite spécialisé en croissance d'entreprise, intégré à la plateforme Evoluty.
Tu réalises des diagnostics complets et génères des plans d'action ultra-détaillés pour aider les dirigeants à accélérer, structurer et pérenniser leur développement.
Ton analyse couvre : finance & rentabilité, stratégie commerciale, organisation & RH, opérations & processus, positionnement marché, gouvernance.
Tu fournis des conseils concrets, chiffrés et actionnables. Tu poses des questions précises pour affiner ton diagnostic.
Tu attribues un score de croissance sur 100 après chaque diagnostic complet.
Réponds toujours en français, de façon structurée, professionnelle et bienveillante.`,

  t: `Tu es un conseiller expert en cession d'entreprise, intégré à la plateforme Evoluty.
Tu réalises des audits de cédabilité complets et génères des plans de préparation à la vente pour maximiser la valeur de cession des entreprises.
Ton analyse couvre : valorisation financière, récurrence du CA, autonomie de l'entreprise (dépendance au dirigeant), clarté juridique, attractivité du dossier, marché et acquéreurs potentiels.
Tu identifies les points bloquants pour une cession réussie et proposes des actions concrètes pour les résoudre.
Tu attribues un score de cédabilité sur 100 après chaque audit complet.
Réponds toujours en français, de façon structurée, professionnelle et rassurante.`
};

// ── Prompt génération de plan mensuel ────────────────────────────────────────
const PLAN_PROMPTS = {
  c: (mois) => `Tu es un conseiller stratégique d'élite spécialisé en croissance d'entreprise, intégré à la plateforme Evoluty.
L'entreprise du dirigeant vient de te demander son PLAN MENSUEL EVOLUTY pour ${mois}.

Tu dois générer un plan mensuel ultra-détaillé, structuré EXACTEMENT comme suit (respecte ces titres de section à la lettre) :

## RÉSUMÉ EXÉCUTIF
[2-3 phrases résumant la situation de l'entreprise et l'ambition du mois]

## SCORE DE CROISSANCE ACTUEL
[Score /100 avec justification courte sur 3 dimensions : finance, commercial, organisation]

## OBJECTIFS DU MOIS (3 à 5)
[Liste numérotée d'objectifs SMART, chiffrés et datés dans le mois]

## PLAN D'ACTION — SEMAINE PAR SEMAINE
### Semaine 1 — [Thème]
[3-4 actions concrètes avec responsable et livrable attendu]
### Semaine 2 — [Thème]
[3-4 actions concrètes]
### Semaine 3 — [Thème]
[3-4 actions concrètes]
### Semaine 4 — [Thème]
[3-4 actions concrètes + bilan de fin de mois]

## KPIs & INDICATEURS À SUIVRE
[5-7 indicateurs chiffrés avec valeur cible pour la fin du mois]

## RESSOURCES & BUDGET ESTIMÉ
[Budget estimé, ressources humaines et outils nécessaires]

## RISQUES DU MOIS & PLAN B
[2-3 risques identifiés avec action de contingence pour chacun]

## CONSEIL PRIORITAIRE DU MOIS
[Un seul conseil, le plus important, formulé comme une conviction forte]

Sois précis, concret et actif. Ce plan sera exporté en PDF et utilisé comme référence tout le mois. Réponds uniquement en français.`,

  t: (mois) => `Tu es un conseiller expert en cession d'entreprise, intégré à la plateforme Evoluty.
L'entreprise du dirigeant vient de te demander son PLAN MENSUEL DE PRÉPARATION À LA CESSION pour ${mois}.

Tu dois générer un plan mensuel ultra-détaillé, structuré EXACTEMENT comme suit (respecte ces titres de section à la lettre) :

## RÉSUMÉ EXÉCUTIF
[2-3 phrases résumant l'état de préparation à la cession et l'avancement global]

## SCORE DE CÉDABILITÉ ACTUEL
[Score /100 avec justification courte sur 4 dimensions : finance, autonomie, récurrence CA, clarté juridique]

## OBJECTIFS DE CESSION DU MOIS (3 à 5)
[Liste numérotée d'objectifs SMART pour améliorer la cédabilité ce mois]

## PLAN D'ACTION — SEMAINE PAR SEMAINE
### Semaine 1 — [Thème]
[3-4 actions concrètes avec responsable et livrable attendu]
### Semaine 2 — [Thème]
[3-4 actions concrètes]
### Semaine 3 — [Thème]
[3-4 actions concrètes]
### Semaine 4 — [Thème]
[3-4 actions concrètes + bilan de fin de mois]

## KPIs DE CÉDABILITÉ À SUIVRE
[5-7 indicateurs chiffrés avec valeur cible pour la fin du mois]

## VALORISATION ESTIMÉE ACTUELLE
[Fourchette basse/centrale/haute en k€ avec hypothèses clés]

## RISQUES & POINTS BLOQUANTS DU MOIS
[2-3 points bloquants identifiés avec action de résolution]

## CONSEIL PRIORITAIRE DU MOIS
[Un seul conseil, le plus important pour maximiser la valeur de cession]

Sois précis, concret et actif. Ce plan sera exporté en PDF et utilisé comme référence tout le mois. Réponds uniquement en français.`
};

// ── Prompt accompagnement (plan existant) ────────────────────────────────────
const SUPPORT_PROMPTS = {
  c: (mois, planText) => `Tu es un conseiller stratégique d'élite spécialisé en croissance d'entreprise, intégré à la plateforme Evoluty.

Le dirigeant a déjà son PLAN MENSUEL EVOLUTY pour ${mois}. Voici ce plan :

---
${planText}
---

TON RÔLE CE MOIS-CI :
Tu n'as PAS à régénérer le plan. Il est fixé pour le mois.
Tu dois aider le dirigeant à EXÉCUTER ce plan avec succès :
- Répondre à ses questions opérationnelles
- Lui donner des méthodes concrètes pour réaliser les actions du plan
- L'encourager et le recadrer si il dérive
- Rappeler les priorités du plan si il se disperse
- Signaler si une action du plan est en retard
- Adapter les conseils à la semaine en cours du mois

Si le dirigeant te demande à nouveau le plan, rappelle-lui qu'il est déjà généré et disponible en PDF. Propose-lui de l'aider à avancer sur une action spécifique.

Réponds toujours en français, de façon concise, concrète et motivante.`,

  t: (mois, planText) => `Tu es un conseiller expert en cession d'entreprise, intégré à la plateforme Evoluty.

Le dirigeant a déjà son PLAN MENSUEL DE PRÉPARATION À LA CESSION pour ${mois}. Voici ce plan :

---
${planText}
---

TON RÔLE CE MOIS-CI :
Tu n'as PAS à régénérer le plan. Il est fixé pour le mois.
Tu dois aider le dirigeant à EXÉCUTER ce plan avec succès :
- Répondre à ses questions opérationnelles sur la cession
- Lui donner des méthodes concrètes pour avancer les actions du plan
- L'aider à débloquer les points bloquants identifiés
- Rappeler les priorités si il se disperse
- Signaler si une action est en retard par rapport au planning semaine
- Lui rappeler l'impact sur son score de cédabilité et sa valorisation

Si le dirigeant te demande à nouveau le plan, rappelle-lui qu'il est déjà disponible en PDF. Propose-lui de l'aider sur une action spécifique.

Réponds toujours en français, de façon concise, concrète et rassurante.`
};

// ── Gestion du plan mensuel en localStorage ───────────────────────────────────
function getPlanKey(mod) {
  const d = new Date();
  return `evoluty_plan_${mod}_${d.getFullYear()}_${String(d.getMonth()).padStart(2, '0')}`;
}

function getMonthLabel() {
  return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getStoredPlan(mod) {
  try { return JSON.parse(localStorage.getItem(getPlanKey(mod))); } catch { return null; }
}

function savePlan(mod, planText) {
  const obj = { text: planText, generatedAt: new Date().toISOString(), month: getMonthLabel() };
  localStorage.setItem(getPlanKey(mod), JSON.stringify(obj));
  return obj;
}

function isPlanRequest(text) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const triggers = ['plan du mois', 'plan mensuel', 'mon plan', 'programme du mois', 'objectifs ce mois',
    'objectifs du mois', 'demarre le plan', 'genere le plan', 'cree le plan', 'faire le plan',
    'plan de ce mois', 'nouveau plan', 'commencer le mois', 'commencer ce mois', 'plan evoluty',
    'plan pour ce mois', 'plan du mois', 'planifie', 'planifier ce mois'];
  return triggers.some(t => lower.includes(t));
}

// ── Bannière plan mensuel dans le chat header ─────────────────────────────────
function updatePlanBanner(mod) {
  const bannerId = `plan-banner-${mod}`;
  let banner = document.getElementById(bannerId);
  const plan = getStoredPlan(mod);
  if (!plan) { if (banner) banner.remove(); return; }

  if (!banner) {
    banner = document.createElement('div');
    banner.id = bannerId;
    banner.className = 'plan-banner';
    const header = document.getElementById(`chat-header-${mod}`);
    if (header) header.insertAdjacentElement('afterend', banner);
  }

  banner.innerHTML = `
    <span class="plan-banner-label">Plan ${plan.month} généré</span>
    <button class="plan-banner-dl" onclick="downloadPlanPDF('${mod}')">Télécharger le PDF →</button>`;
}

// ── Historique des messages par module ────────────────────────────────────────
const histories = { c: [], t: [] };

// ═══════════════════════════════════════════════════════════════════════════════
// ENVOI DE MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════
async function sendMessage(mod) {
  const input = document.getElementById('input-' + mod);
  const text = input?.value?.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  appendMsg(mod, 'user', text);

  const plan = getStoredPlan(mod);
  const mois = getMonthLabel();
  let isPlanGen = false;

  let systemPrompt;
  if (!plan && isPlanRequest(text)) {
    // MODE : Génération du plan mensuel
    isPlanGen = true;
    systemPrompt = PLAN_PROMPTS[mod](mois);
    histories[mod] = [{ role: 'user', content: text }];
  } else if (plan) {
    // MODE : Accompagnement du plan existant
    systemPrompt = SUPPORT_PROMPTS[mod](mois, plan.text);
    histories[mod].push({ role: 'user', content: text });
  } else {
    // MODE : Diagnostic libre (pas encore de plan demandé)
    systemPrompt = BASE_PROMPTS[mod];
    histories[mod].push({ role: 'user', content: text });
  }

  const btn = document.getElementById('send-' + mod);
  const spinner = document.getElementById('spinner-' + mod);
  const sendText = document.getElementById('send-text-' + mod);
  btn.disabled = true;
  spinner.style.display = 'inline-block';
  sendText.style.display = 'none';

  const typingId = 'typing-' + Date.now();
  appendTyping(mod, typingId);

  try {
    const token = localStorage.getItem('evoluty_auth_token');
    const res = await fetch(MISTRAL_BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        mod,
        messages: [{ role: 'system', content: systemPrompt }, ...histories[mod]],
        temperature: isPlanGen ? 0.4 : 0.55,
        max_tokens: isPlanGen ? 3200 : 1800,
      }),
    });

    if (!res.ok) throw new Error(`Erreur API (${res.status})`);

    document.getElementById(typingId)?.remove();

    if (isPlanGen) {
      appendPlanGenerating(mod);
    }

    const bubbleId = 'bubble-' + Date.now();
    if (!isPlanGen) appendMsg(mod, 'ai', '', bubbleId);
    const bubble = isPlanGen ? null : document.getElementById(bubbleId);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            if (bubble) { bubble.innerHTML = formatAIText(fullText); scrollChat(mod); }
          }
        } catch (_) {}
      }
    }

    histories[mod].push({ role: 'assistant', content: fullText });

    if (isPlanGen) {
      // Sauvegarder le plan et générer le PDF
      savePlan(mod, fullText);
      removePlanGenerating(mod);
      showPlanSuccess(mod, fullText, mois);
      updatePlanBanner(mod);
    }

  } catch (err) {
    document.getElementById(typingId)?.remove();
    removePlanGenerating(mod);
    appendMsg(mod, 'ai', `Erreur : ${err.message}. Vérifiez votre connexion et réessayez.`);
    console.error(err);
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
    sendText.style.display = 'inline';
  }
}

// ── Message "génération en cours" ─────────────────────────────────────────────
function appendPlanGenerating(mod) {
  const chat = document.getElementById('chat-' + mod);
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = 'plan-generating-' + mod;
  div.innerHTML = `
    <div class="msg-avatar">✦</div>
    <div>
      <div class="msg-bubble plan-generating-bubble">
        <div class="typing-dots"><span></span><span></span><span></span></div>
        <span style="margin-left:10px;font-size:0.85rem;color:var(--text-muted);">Génération de votre plan mensuel en cours…</span>
      </div>
    </div>`;
  chat.appendChild(div);
  scrollChat(mod);
}

function removePlanGenerating(mod) {
  document.getElementById('plan-generating-' + mod)?.remove();
}

// ── Message plan généré + bouton PDF ─────────────────────────────────────────
function showPlanSuccess(mod, planText, mois) {
  const chat = document.getElementById('chat-' + mod);
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.innerHTML = `
    <div class="msg-avatar">✦</div>
    <div>
      <div class="msg-bubble plan-success-bubble">
        <strong>Votre plan mensuel ${mois} est prêt !</strong><br/>
        J'ai analysé votre situation et construit un plan d'action semaine par semaine avec vos KPIs, ressources et risques anticipés.<br/><br/>
        Tout au long du mois, revenez ici pour que je vous aide à tenir ce plan — conseils pratiques, méthodes et suivi des actions.
        <div style="margin-top:14px;">
          <button class="btn btn-primary btn-sm" onclick="downloadPlanPDF('${mod}')">Télécharger le plan PDF →</button>
        </div>
      </div>
      <div class="msg-time">Evoluty IA · maintenant</div>
    </div>`;
  chat.appendChild(div);
  scrollChat(mod);

  // Génération PDF automatique
  setTimeout(() => generatePDF(mod, planText, mois), 400);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GÉNÉRATION PDF (jsPDF)
// ═══════════════════════════════════════════════════════════════════════════════
function downloadPlanPDF(mod) {
  const plan = getStoredPlan(mod);
  if (!plan) return;
  generatePDF(mod, plan.text, plan.month);
}

function generatePDF(mod, planText, mois) {
  if (typeof window.jspdf === 'undefined') {
    console.warn('jsPDF non chargé');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210; // largeur A4
  const ML = 18; // marge gauche
  const MR = 18; // marge droite
  const TW = W - ML - MR;
  let y = 0;

  // ── Couleurs ──
  const BLUE  = [33, 84, 200];
  const LBLUE = [78, 137, 232];
  const DARK  = [8, 8, 15];
  const WHITE = [240, 240, 248];
  const MUTED = [122, 122, 154];
  const GREEN = [52, 211, 153];

  // ── Page de garde ──────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 297, 'F');

  // Bande bleue
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 70, 'F');

  // Logo texte
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  doc.text('Evoluty', ML, 28);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 240);
  doc.text('Plateforme stratégique IA — AEL Corporation', ML, 37);

  // Module label
  const modLabel = mod === 'c' ? 'MODULE CROISSANCE' : 'MODULE TRANSMISSION';
  doc.setFontSize(9);
  doc.setTextColor(...LBLUE);
  doc.setFont('helvetica', 'bold');
  doc.text(modLabel, ML, 53);

  // Titre
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  const titre = mod === 'c' ? `Plan Mensuel de Croissance` : `Plan Mensuel de Cession`;
  doc.text(titre, ML, 63);

  // Mois
  doc.setFillColor(20, 20, 40);
  doc.roundedRect(ML, 78, TW, 16, 3, 3, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...LBLUE);
  doc.text(mois.toUpperCase(), W / 2, 89, { align: 'center' });

  // Généré par
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Généré par Evoluty IA (Mistral Large) · ${new Date().toLocaleDateString('fr-FR')}`, ML, 105);
  doc.text('Ce document est confidentiel et à usage exclusif du dirigeant.', ML, 111);

  // Ligne séparatrice
  doc.setDrawColor(...LBLUE);
  doc.setLineWidth(0.3);
  doc.line(ML, 118, W - MR, 118);

  // Avertissement données
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Données chiffrées AES-256 · Hébergement UE · RGPD conforme', ML, 125);

  y = 140;

  // ── Contenu du plan ────────────────────────────────────────────────────────
  // Parsing des sections ## et ###
  const lines = planText.split('\n');

  const addNewPage = () => {
    doc.addPage();
    // fond sombre
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, 297, 'F');
    // filet en haut
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, W, 4, 'F');
    y = 18;
  };

  const ensureSpace = (needed) => {
    if (y + needed > 278) addNewPage();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { y += 3; continue; }

    // Titre de section principal ##
    if (line.startsWith('## ')) {
      const title = line.replace(/^## /, '');
      ensureSpace(18);
      // Fond de section
      doc.setFillColor(20, 20, 50);
      doc.roundedRect(ML - 4, y - 5, TW + 8, 13, 2, 2, 'F');
      doc.setDrawColor(...BLUE);
      doc.setLineWidth(0.4);
      doc.rect(ML - 4, y - 5, 3, 13, 'F');
      doc.setFillColor(...BLUE);
      doc.rect(ML - 4, y - 5, 3, 13, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...WHITE);
      doc.text(title.toUpperCase(), ML + 2, y + 3);
      y += 14;
      continue;
    }

    // Sous-titre ###
    if (line.startsWith('### ')) {
      const title = line.replace(/^### /, '');
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...LBLUE);
      doc.text('· ' + title, ML, y);
      y += 8;
      continue;
    }

    // Texte en gras **...**
    if (line.startsWith('**') && line.endsWith('**')) {
      const t = line.replace(/^\*\*|\*\*$/g, '');
      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      const wrapped = doc.splitTextToSize(t, TW);
      ensureSpace(wrapped.length * 5 + 2);
      doc.text(wrapped, ML, y);
      y += wrapped.length * 5 + 3;
      continue;
    }

    // Liste - item
    if (line.startsWith('- ') || line.startsWith('• ')) {
      const t = line.replace(/^[-•] /, '').replace(/\*\*/g, '');
      ensureSpace(7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...WHITE);
      // Puce bleue
      doc.setFillColor(...LBLUE);
      doc.circle(ML + 1.5, y - 1.5, 1, 'F');
      const wrapped = doc.splitTextToSize(t, TW - 8);
      ensureSpace(wrapped.length * 5);
      doc.text(wrapped, ML + 6, y);
      y += wrapped.length * 5 + 2;
      continue;
    }

    // Texte normal (strip markdown simple)
    const clean = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
    if (clean) {
      ensureSpace(7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 200, 215);
      const wrapped = doc.splitTextToSize(clean, TW);
      ensureSpace(wrapped.length * 5);
      doc.text(wrapped, ML, y);
      y += wrapped.length * 5 + 2;
    }
  }

  // ── Dernière page : footer ─────────────────────────────────────────────────
  ensureSpace(30);
  y += 10;
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y);
  y += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Ce plan a été généré par Evoluty IA (Mistral Large). Il est basé sur les informations fournies par le dirigeant', ML, y);
  y += 5;
  doc.text('et doit être adapté à l\'évolution réelle de l\'entreprise. Evoluty · AEL Corporation · RGPD conforme.', ML, y);

  // ── Numérotation des pages ─────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Evoluty — ${modLabel} — ${mois}`, ML, 291);
    doc.text(`${p} / ${totalPages}`, W - MR, 291, { align: 'right' });
  }

  // ── Téléchargement ────────────────────────────────────────────────────────
  const filename = `Evoluty_Plan_${mod === 'c' ? 'Croissance' : 'Cession'}_${mois.replace(' ', '_')}.pdf`;
  doc.save(filename);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES & FORMATAGE
// ═══════════════════════════════════════════════════════════════════════════════
function appendMsg(mod, role, text, id) {
  const chat = document.getElementById('chat-' + mod);
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const avatar = role === 'ai' ? '✦' : 'Vous';
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div>
      <div class="msg-bubble" ${id ? `id="${id}"` : ''}>${role === 'ai' ? formatAIText(text) : escHtml(text)}</div>
      <div class="msg-time">${role === 'ai' ? 'Evoluty IA' : 'Vous'} · ${time}</div>
    </div>`;
  chat.appendChild(div);
  scrollChat(mod);
}

function appendTyping(mod, id) {
  const chat = document.getElementById('chat-' + mod);
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">✦</div>
    <div>
      <div class="msg-bubble">
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  chat.appendChild(div);
  scrollChat(mod);
}

function scrollChat(mod) {
  const chat = document.getElementById('chat-' + mod);
  if (chat) chat.scrollTop = chat.scrollHeight;
}

function formatAIText(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4 style="color:var(--blue-light);margin:12px 0 6px;font-size:0.92rem;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:var(--text-white);margin:14px 0 8px;font-size:1rem;">$1</h3>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0 4px 16px;">$1</li>')
    .replace(/\n/g, '<br />');
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function handleKey(e, mod) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(mod);
  }
}

document.querySelectorAll('.chat-input-area textarea').forEach(ta => {
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  });
});

// Init : afficher bannière si plan du mois déjà existant
document.addEventListener('DOMContentLoaded', () => {
  updatePlanBanner('c');
  updatePlanBanner('t');
});
