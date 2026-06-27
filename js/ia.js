// ===== MISTRAL AI — EVOLUTY =====
// ⚠️ Clé API exposée côté client — à sécuriser via un backend en production.
const MISTRAL_KEY = 'qoubbydVESrPU5VePMzIxmoN47ngEMny';
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest';

const SYSTEM_PROMPTS = {
  c: `Tu es un conseiller stratégique d'élite spécialisé en croissance d'entreprise, intégré à la plateforme Evoluty.
Tu réalises des diagnostics complets et génères des plans d'action ultra-détaillés pour aider les dirigeants à accélérer, structurer et pérenniser leur développement.
Ton analyse couvre : finance & rentabilité, stratégie commerciale, organisation & RH, opérations & processus, positionnement marché, gouvernance.
Tu fournis des conseils concrets, chiffrés et actionnables. Tu poses des questions précises pour affiner ton diagnostic.
Tu attribues un score de croissance sur 100 après chaque diagnostic complet.
Réponds toujours en français, de façon structurée, professionnelle et bienveillante.`,

  t: `Tu es un conseiller expert en transmission et cession d'entreprise, intégré à la plateforme Evoluty.
Tu réalises des audits de cédabilité complets et génères des plans de préparation à la vente pour maximiser la valeur de cession des entreprises.
Ton analyse couvre : valorisation financière, récurrence du CA, autonomie de l'entreprise (dépendance au dirigeant), clarté juridique, attractivité du dossier, marché et acquéreurs potentiels.
Tu identifies les points bloquants pour une cession réussie et proposes des actions concrètes pour les résoudre.
Tu attribues un score de cédabilité sur 100 après chaque audit complet.
Réponds toujours en français, de façon structurée, professionnelle et rassurante.`
};

// Historique des messages par module
const histories = { c: [], t: [] };

// ===== ENVOI DE MESSAGE =====
async function sendMessage(mod) {
  const input = document.getElementById('input-' + mod);
  const text = input?.value?.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  appendMsg(mod, 'user', text);

  histories[mod].push({ role: 'user', content: text });

  const btn = document.getElementById('send-' + mod);
  const spinner = document.getElementById('spinner-' + mod);
  const sendText = document.getElementById('send-text-' + mod);
  btn.disabled = true;
  spinner.style.display = 'inline-block';
  sendText.style.display = 'none';

  // Afficher l'indicateur de frappe
  const typingId = 'typing-' + Date.now();
  appendTyping(mod, typingId);

  try {
    const res = await fetch(MISTRAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_KEY}`
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[mod] },
          ...histories[mod]
        ],
        temperature: 0.5,
        max_tokens: 1800,
        stream: true
      })
    });

    if (!res.ok) throw new Error(`Erreur API (${res.status})`);

    // Supprimer l'indicateur de frappe
    document.getElementById(typingId)?.remove();

    // Créer la bulle de réponse en streaming
    const bubbleId = 'bubble-' + Date.now();
    appendMsg(mod, 'ai', '', bubbleId);
    const bubble = document.getElementById(bubbleId);

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
            if (bubble) bubble.innerHTML = formatAIText(fullText);
            scrollChat(mod);
          }
        } catch (_) {}
      }
    }

    histories[mod].push({ role: 'assistant', content: fullText });

  } catch (err) {
    document.getElementById(typingId)?.remove();
    appendMsg(mod, 'ai', `❌ Erreur : ${err.message}. Vérifiez votre connexion et réessayez.`);
    console.error(err);
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
    sendText.style.display = 'inline';
  }
}

// ===== APPENDER MESSAGES =====
function appendMsg(mod, role, text, id) {
  const chat = document.getElementById('chat-' + mod);
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const avatar = role === 'ai' ? '✦' : '👤';
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

// ===== FORMATAGE =====
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

// ===== TOUCHE ENTRÉE =====
function handleKey(e, mod) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(mod);
  }
}

// ===== AUTO-RESIZE TEXTAREA =====
document.querySelectorAll('.chat-input-area textarea').forEach(ta => {
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  });
});
