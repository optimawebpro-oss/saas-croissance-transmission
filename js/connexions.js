// ===== EVOLUTY — Connexions Frontend =====
const API = 'http://localhost:3001/api';

// ── 1. SIRET / Pappers ──────────────────────────────────
async function searchSiret() {
  const siret = document.getElementById('siret-input')?.value?.trim();
  if (!siret) return showConnToast('Veuillez saisir un SIRET.', 'warn');

  const btn = document.getElementById('btn-siret');
  setLoading(btn, true);
  clearSiretResult();

  try {
    const res = await fetch(`${API}/entreprise/siret/${siret}`, {
      headers: { 'x-user-id': getUserId() },
    });
    const json = await res.json();

    if (!res.ok) return showSiretError(json.error);
    displaySiretResult(json.data);
    showConnToast('✦ Entreprise identifiée et profil pré-rempli.', 'ok');
  } catch {
    showSiretError('Serveur backend inaccessible. Démarrez le backend (npm run dev).');
  } finally {
    setLoading(btn, false);
  }
}

function displaySiretResult(d) {
  const zone = document.getElementById('siret-result');
  if (!zone) return;
  zone.style.display = 'block';
  zone.innerHTML = `
    <div class="conn-result-grid">
      <div class="conn-result-item"><span class="cr-label">Raison sociale</span><span class="cr-value">${d.raisonSociale || '—'}</span></div>
      <div class="conn-result-item"><span class="cr-label">SIRET</span><span class="cr-value">${d.siret || '—'}</span></div>
      <div class="conn-result-item"><span class="cr-label">Forme juridique</span><span class="cr-value">${d.formeJuridique || '—'}</span></div>
      <div class="conn-result-item"><span class="cr-label">Code NAF</span><span class="cr-value">${d.codeNAF || '—'} ${d.libelleNAF ? '· ' + d.libelleNAF : ''}</span></div>
      <div class="conn-result-item"><span class="cr-label">Date création</span><span class="cr-value">${d.dateCreation || '—'}</span></div>
      <div class="conn-result-item"><span class="cr-label">Effectif</span><span class="cr-value">${d.effectif || '—'}</span></div>
      <div class="conn-result-item" style="grid-column:1/-1"><span class="cr-label">Adresse</span><span class="cr-value">${d.adresse || '—'}</span></div>
      ${d.dirigeants?.length ? `<div class="conn-result-item" style="grid-column:1/-1"><span class="cr-label">Dirigeants</span><span class="cr-value">${d.dirigeants.map(p => `${p.nom} (${p.qualite})`).join(' · ')}</span></div>` : ''}
    </div>`;
}

function showSiretError(msg) {
  const zone = document.getElementById('siret-result');
  if (!zone) return;
  zone.style.display = 'block';
  zone.innerHTML = `<div class="conn-error">⚠️ ${msg}</div>`;
}
function clearSiretResult() {
  const z = document.getElementById('siret-result');
  if (z) { z.style.display = 'none'; z.innerHTML = ''; }
}

// ── 2. FEC Upload ───────────────────────────────────────
function setupFecDrop() {
  const zone = document.getElementById('fec-drop');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadFEC(file);
  });
}

async function handleFecInput(input) {
  const file = input.files[0];
  if (file) uploadFEC(file);
}

async function uploadFEC(file) {
  const status = document.getElementById('fec-status');
  const result = document.getElementById('fec-result');
  if (status) status.textContent = `⏳ Analyse de ${file.name}…`;
  if (result) result.style.display = 'none';

  const fd = new FormData();
  fd.append('fec', file);

  try {
    const res = await fetch(`${API}/fec/upload`, {
      method: 'POST',
      headers: { 'x-user-id': getUserId() },
      body: fd,
    });
    const json = await res.json();

    if (!res.ok) {
      if (status) status.textContent = `❌ ${json.error}`;
      return;
    }

    if (status) status.textContent = `✅ ${json.message}`;
    displayFECResult(json.data);
    showConnToast('✦ FEC analysé — données financières extraites.', 'ok');
  } catch {
    if (status) status.textContent = '❌ Serveur backend inaccessible.';
  }
}

function displayFECResult(data) {
  const zone = document.getElementById('fec-result');
  if (!zone) return;
  const last = data.dernierExercice;
  zone.style.display = 'block';
  zone.innerHTML = `
    <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px;">
      Données extraites — ${data.nbExercices} exercice(s)
    </h4>
    <div class="conn-result-grid">
      <div class="conn-result-item"><span class="cr-label">CA (dernier ex.)</span><span class="cr-value">${formatEur(last.ca)}</span></div>
      <div class="conn-result-item"><span class="cr-label">EBITDA</span><span class="cr-value">${formatEur(last.ebitda)}</span></div>
      <div class="conn-result-item"><span class="cr-label">Marge EBITDA</span><span class="cr-value">${last.margeEbitda}%</span></div>
      <div class="conn-result-item"><span class="cr-label">Résultat net</span><span class="cr-value">${formatEur(last.resultat)}</span></div>
      <div class="conn-result-item"><span class="cr-label">Charges totales</span><span class="cr-value">${formatEur(last.charges)}</span></div>
      <div class="conn-result-item"><span class="cr-label">Qualité FEC</span><span class="cr-value">${data.qualite.tauxValidite}% lignes valides</span></div>
    </div>
    ${data.nbExercices > 1 ? `<div style="margin-top:12px; font-size:0.8rem; color:var(--text-muted);">Exercices disponibles : ${data.exercices.map(e => e.annee).join(', ')}</div>` : ''}`;
}

// ── 3. Open Banking — Bridge ────────────────────────────
async function connectBanking() {
  const btn = document.getElementById('btn-banking');
  setLoading(btn, true);
  try {
    const res = await fetch(`${API}/banking/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': getUserId() },
      body: JSON.stringify({ userId: getUserId() }),
    });
    const json = await res.json();
    if (!res.ok) return showConnToast(`⚠️ ${json.error}`, 'warn');
    window.open(json.authUrl, '_blank', 'width=600,height=700');
    showConnToast('✦ Fenêtre de connexion bancaire ouverte.', 'ok');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  } finally {
    setLoading(btn, false);
  }
}

async function revokeBanking() {
  if (!confirm('Révoquer l\'accès bancaire ? Toutes les données bancaires seront supprimées.')) return;
  try {
    const res = await fetch(`${API}/banking/revoke`, {
      method: 'DELETE',
      headers: { 'x-user-id': getUserId(), 'x-bridge-user-id': getUserId() },
    });
    const json = await res.json();
    showConnToast(res.ok ? '✦ Accès bancaire révoqué.' : `⚠️ ${json.error}`, res.ok ? 'ok' : 'warn');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  }
}

// ── 4. CRM ──────────────────────────────────────────────
async function connectCRM(provider) {
  try {
    const res = await fetch(`${API}/crm/${provider}/auth`, { headers: { 'x-user-id': getUserId() } });
    const json = await res.json();
    if (!res.ok) return showConnToast(`⚠️ ${json.error}`, 'warn');
    window.open(json.authUrl, '_blank', 'width=600,height=700');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  }
}

// ── 5. SIRH ─────────────────────────────────────────────
async function connectSIRH(provider) {
  try {
    const res = await fetch(`${API}/sirh/${provider}/auth`, { headers: { 'x-user-id': getUserId() } });
    const json = await res.json();
    if (!res.ok) return showConnToast(`⚠️ ${json.error}`, 'warn');
    window.open(json.authUrl, '_blank', 'width=600,height=700');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  }
}

async function submitSIRHManuel(e) {
  e.preventDefault();
  const data = {
    effectif: parseInt(document.getElementById('sirh-effectif')?.value),
    ancienneteMoyenneMois: parseFloat(document.getElementById('sirh-anciennete')?.value),
    turnover12mois: parseFloat(document.getElementById('sirh-turnover')?.value),
    hasDirectionN1: document.getElementById('sirh-n1')?.checked,
  };
  try {
    const res = await fetch(`${API}/sirh/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': getUserId() },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    showConnToast(res.ok ? '✦ Données RH enregistrées.' : `⚠️ ${json.error}`, res.ok ? 'ok' : 'warn');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  }
}

// ── 7. Infogreffe ───────────────────────────────────────
async function fetchJuridique() {
  const siren = document.getElementById('siret-input')?.value?.replace(/\s/g, '').substring(0, 9);
  if (!siren || siren.length !== 9) return showConnToast('Identifiez d\'abord votre entreprise avec le SIRET (section ci-dessus).', 'warn');

  const btn = document.getElementById('btn-juridique');
  setLoading(btn, true);

  try {
    const res = await fetch(`${API}/juridique/${siren}`, { headers: { 'x-user-id': getUserId() } });
    const json = await res.json();
    if (!res.ok) return showConnToast(`⚠️ ${json.error}`, 'warn');

    const zone = document.getElementById('juridique-result');
    if (zone) {
      zone.style.display = 'block';
      zone.innerHTML = `
        <div class="conn-result-grid">
          <div class="conn-result-item"><span class="cr-label">Score conformité</span><span class="cr-value" style="color:${json.scoreConformite >= 80 ? 'var(--blue-light)' : '#eab308'}">${json.scoreConformite}/100</span></div>
          <div class="conn-result-item"><span class="cr-label">Procédures actives</span><span class="cr-value">${json.data.procedures.length || 'Aucune'}</span></div>
          <div class="conn-result-item"><span class="cr-label">Nantissements</span><span class="cr-value">${json.data.privileges.length || 'Aucun'}</span></div>
          <div class="conn-result-item"><span class="cr-label">Actes déposés</span><span class="cr-value">${json.data.actes.length}</span></div>
        </div>
        ${json.alerts?.length ? `<div class="conn-alerts">${json.alerts.map(a => `<div class="conn-alert">${a}</div>`).join('')}</div>` : ''}`;
    }
    showConnToast('✦ Données juridiques Infogreffe récupérées.', 'ok');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  } finally {
    setLoading(btn, false);
  }
}

// ── UTILS ───────────────────────────────────────────────
function getUserId() {
  let id = localStorage.getItem('evoluty_uid');
  if (!id) { id = 'user_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('evoluty_uid', id); }
  return id;
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.6' : '1';
}

function formatEur(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function showConnToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  const m = document.getElementById('toast-msg');
  if (!t || !m) return;
  m.textContent = msg;
  t.style.borderColor = type === 'ok' ? 'var(--border-blue)' : '#eab308';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── HTML TEMPLATE CONNEXIONS ────────────────────────────
function buildConnexionsHTML(mod) {
  return `
  <!-- 1. Identité entreprise -->
  <div class="conn-section">
    <div class="conn-section-title">1 — Identité entreprise (Pappers / INSEE)</div>
    <div style="display:flex;gap:10px;align-items:center;">
      <input id="siret-input" type="text" placeholder="SIRET (14 chiffres)"
        style="flex:1;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;color:var(--text-white);font-size:0.9rem;"
        onkeydown="if(event.key==='Enter')searchSiret()" />
      <button id="btn-siret" class="btn btn-primary btn-sm" onclick="searchSiret()">Rechercher →</button>
    </div>
    <div id="siret-result" style="display:none;margin-top:12px;"></div>
  </div>

  <!-- 2. FEC -->
  <div class="conn-section">
    <div class="conn-section-title">2 — Fichier des Écritures Comptables (FEC)</div>
    <div class="fec-drop" id="fec-drop" onclick="document.getElementById('fec-file').click()">
      <span class="drop-icon">📂</span>
      <p>Glissez votre fichier FEC ici ou cliquez pour sélectionner</p>
      <span style="font-size:0.75rem;color:var(--text-muted);">Formats acceptés : .txt · .csv · Max 50 Mo · Norme DGFiP</span>
      <input id="fec-file" type="file" accept=".txt,.csv" style="display:none" onchange="handleFecInput(this)" />
    </div>
    <div class="fec-status" id="fec-status"></div>
    <div id="fec-result" style="display:none;margin-top:12px;"></div>
  </div>

  <!-- 3. Open Banking -->
  <div class="conn-section">
    <div class="conn-section-title">3 — Open Banking · Bridge (PSD2)</div>
    <div class="conn-card-sm" style="margin-bottom:10px;">
      <div class="cc-left">
        <span class="cc-icon">🏦</span>
        <div>
          <h4>Compte bancaire professionnel</h4>
          <p>Solde, flux entrants/sortants 6 mois · Consentement 90 jours · Révocable à tout moment</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="btn-banking" class="btn btn-primary btn-sm" onclick="connectBanking()">Connecter</button>
        <button class="btn btn-secondary btn-sm" onclick="revokeBanking()" title="Révoquer l'accès">✕</button>
      </div>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);padding:8px 0;">🛡️ Lecture seule · Données chiffrées AES-256 · Hébergement UE · Révocable à tout moment</div>
  </div>

  <!-- 4. CRM & Facturation -->
  <div class="conn-section">
    <div class="conn-section-title">4 — CRM & Facturation</div>
    <div class="conn-cards-row">
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon">🟠</span><div><h4>HubSpot</h4><p>CA par client, pipeline, churn</p></div></div>
        <button class="btn btn-outline btn-sm" onclick="connectCRM('hubspot')">Connecter</button>
      </div>
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon">🔵</span><div><h4>Pipedrive</h4><p>Deals gagnés, clients, revenus</p></div></div>
        <button class="btn btn-outline btn-sm" onclick="connectCRM('pipedrive')">Connecter</button>
      </div>
    </div>
  </div>

  <!-- 5. SIRH -->
  <div class="conn-section">
    <div class="conn-section-title">5 — SIRH (Capital humain)</div>
    <div class="conn-cards-row" style="margin-bottom:12px;">
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon">💼</span><div><h4>PayFit</h4><p>Effectif, ancienneté, turnover</p></div></div>
        <button class="btn btn-outline btn-sm" onclick="connectSIRH('payfit')">Connecter</button>
      </div>
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon">🟣</span><div><h4>Lucca</h4><p>Collaborateurs, organigramme</p></div></div>
        <button class="btn btn-outline btn-sm" onclick="connectSIRH('lucca')">Connecter</button>
      </div>
    </div>
    <details>
      <summary style="font-size:0.83rem;color:var(--text-muted);cursor:pointer;padding:8px 0;">Pas de SIRH ? Saisie manuelle →</summary>
      <form class="sirh-manual" onsubmit="submitSIRHManuel(event)" style="margin-top:8px;">
        <h4>Saisie manuelle (TPE / PME sans SIRH)</h4>
        <div class="form-row">
          <div class="form-group">
            <label>Effectif total</label>
            <input id="sirh-effectif" type="number" min="1" placeholder="Ex : 12" required />
          </div>
          <div class="form-group">
            <label>Ancienneté moyenne (mois)</label>
            <input id="sirh-anciennete" type="number" min="0" placeholder="Ex : 36" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Turnover 12 mois (%)</label>
            <input id="sirh-turnover" type="number" min="0" max="100" placeholder="Ex : 15" />
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:10px;padding-top:24px;">
            <input id="sirh-n1" type="checkbox" style="width:auto;accent-color:var(--blue-accent);" />
            <label for="sirh-n1" style="font-weight:400;font-size:0.88rem;cursor:pointer;">Direction N-1 en place</label>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">Enregistrer →</button>
      </form>
    </details>
  </div>

  <!-- 6. Benchmarks sectoriels -->
  <div class="conn-section">
    <div class="conn-section-title">6 — Benchmarks sectoriels</div>
    <div class="conn-card-sm">
      <div class="cc-left"><span class="cc-icon">📊</span>
        <div><h4>Multiples EBE par secteur</h4><p>Table interne mise à jour manuellement · 9 secteurs couverts · Extensible API Epsilon</p></div>
      </div>
      <span class="badge badge-blue">✦ Actif</span>
    </div>
  </div>

  <!-- 7. Infogreffe -->
  <div class="conn-section">
    <div class="conn-section-title">7 — Conformité juridique (Infogreffe)</div>
    <div style="display:flex;gap:10px;align-items:center;">
      <div style="flex:1;font-size:0.85rem;color:var(--text-muted);">Actes déposés, nantissements, procédures collectives — alimentés par le SIREN de votre entreprise (étape 1).</div>
      <button id="btn-juridique" class="btn btn-primary btn-sm" onclick="fetchJuridique()">Analyser →</button>
    </div>
    <div id="juridique-result" style="display:none;margin-top:12px;"></div>
  </div>

  <!-- Partenaires -->
  <div class="conn-section">
    <div class="conn-section-title">Inviter un partenaire</div>
    <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
      <div class="form-group" style="flex:1;margin:0;">
        <label>Email</label>
        <input type="email" id="partner-email-${mod}" placeholder="expert@cabinet.fr" />
      </div>
      <div class="form-group" style="margin:0;">
        <label>Rôle</label>
        <select id="partner-role-${mod}">
          <option>Expert-comptable</option><option>Avocat</option>
          <option>Conseiller en cession</option><option>Notaire</option><option>Autre</option>
        </select>
      </div>
      <button class="btn btn-primary btn-sm" onclick="invitePartner('${mod}')">Inviter →</button>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:10px;">🛡️ Toutes les données sont chiffrées AES-256 · Hébergement UE · Droit à l'effacement garanti (RGPD art. 17)</div>
  </div>`;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  // Injecter le HTML des connexions dans les deux modules
  ['c', 't'].forEach(mod => {
    const zone = document.getElementById(`connexions-content-${mod}`);
    if (zone) zone.innerHTML = buildConnexionsHTML(mod);
  });

  setupFecDrop();
  const siretInput = document.getElementById('siret-input');
  if (siretInput) {
    siretInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchSiret(); });
  }
});
