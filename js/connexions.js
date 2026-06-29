// ===== EVOLUTY — Connexions Frontend =====
const API = 'https://saas-croissance-transmission-production.up.railway.app/api';

function authHeaders(extra) {
  const token = localStorage.getItem('evoluty_auth_token');
  return { ...(token ? { 'Authorization': 'Bearer ' + token } : {}), ...extra };
}

// ── 1. SIRET / Pappers ──────────────────────────────────
async function searchSiret() {
  const siret = document.getElementById('siret-input')?.value?.trim();
  if (!siret) return showConnToast('Veuillez saisir un SIRET.', 'warn');

  const btn = document.getElementById('btn-siret');
  setLoading(btn, true);
  clearSiretResult();

  try {
    const res = await fetch(`${API}/entreprise/siret/${siret}`, {
      headers: authHeaders(),
    });
    const json = await res.json();

    if (!res.ok) return showSiretError(json.error);
    displaySiretResult(json.data);
    showConnToast('Entreprise identifiée et profil pré-rempli.', 'ok');
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
  zone.innerHTML = `<div class="conn-error">${msg}</div>`;
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
  if (status) status.textContent = `Analyse de ${file.name}…`;
  if (result) result.style.display = 'none';

  const fd = new FormData();
  fd.append('fec', file);

  try {
    const res = await fetch(`${API}/fec/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: fd,
    });
    const json = await res.json();

    if (!res.ok) {
      if (status) status.textContent = json.error;
      return;
    }

    if (status) status.textContent = json.message;
    displayFECResult(json.data);
    showConnToast('FEC analysé — données financières extraites.', 'ok');
  } catch {
    if (status) status.textContent = 'Serveur backend inaccessible.';
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok) return showConnToast(json.error, 'warn');
    window.open(json.authUrl, '_blank', 'width=600,height=700');
    showConnToast('Fenêtre de connexion bancaire ouverte.', 'ok');
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
      headers: authHeaders(),
    });
    const json = await res.json();
    showConnToast(res.ok ? 'Accès bancaire révoqué.' : json.error, res.ok ? 'ok' : 'warn');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  }
}

// ── 4. CRM ──────────────────────────────────────────────
async function connectCRM(provider) {
  try {
    const res = await fetch(`${API}/crm/${provider}/auth`, { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) return showConnToast(json.error, 'warn');
    window.open(json.authUrl, '_blank', 'width=600,height=700');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  }
}

// ── 5. SIRH ─────────────────────────────────────────────
async function connectSIRH(provider) {
  try {
    const res = await fetch(`${API}/sirh/${provider}/auth`, { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) return showConnToast(json.error, 'warn');
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    showConnToast(res.ok ? 'Données RH enregistrées.' : json.error, res.ok ? 'ok' : 'warn');
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
    const res = await fetch(`${API}/juridique/${siren}`, { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) return showConnToast(json.error, 'warn');

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
    showConnToast('Données juridiques Infogreffe récupérées.', 'ok');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  } finally {
    setLoading(btn, false);
  }
}

// ── 8. Stripe / Facturation ─────────────────────────────
async function connectFacturation(provider) {
  try {
    const res = await fetch(`${API}/facturation/${provider}/auth`, { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) return showConnToast(json.error, 'warn');
    window.open(json.authUrl, '_blank', 'width=600,height=700');
  } catch {
    showConnToast('Backend inaccessible.', 'warn');
  }
}

async function uploadContrats(input, mod) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('type', 'contrats');
  try {
    const res = await fetch(`${API}/documents/upload`, { method: 'POST', headers: authHeaders(), body: fd });
    const json = await res.json();
    showConnToast(res.ok ? 'Contrats importés.' : json.error, res.ok ? 'ok' : 'warn');
  } catch { showConnToast('Backend inaccessible.', 'warn'); }
}

// ── 9. INPI ─────────────────────────────────────────────
async function fetchINPI(mod) {
  const siren = document.getElementById('siret-input')?.value?.replace(/\s/g, '').substring(0, 9);
  if (!siren || siren.length !== 9) return showConnToast("Identifiez d'abord votre entreprise avec le SIRET (étape 1).", 'warn');
  const btn = document.getElementById(`btn-inpi-${mod}`);
  setLoading(btn, true);
  try {
    const res = await fetch(`${API}/inpi/${siren}`, { headers: authHeaders() });
    const json = await res.json();
    const zone = document.getElementById(`inpi-result-${mod}`);
    if (zone) {
      zone.style.display = 'block';
      zone.innerHTML = res.ok
        ? `<div class="conn-result-grid">
            <div class="conn-result-item"><span class="cr-label">Marques déposées</span><span class="cr-value">${json.marques ?? '—'}</span></div>
            <div class="conn-result-item"><span class="cr-label">Brevets</span><span class="cr-value">${json.brevets ?? '—'}</span></div>
            <div class="conn-result-item"><span class="cr-label">Dessins & modèles</span><span class="cr-value">${json.dessins ?? '—'}</span></div>
           </div>`
        : `<div class="conn-error">${json.error}</div>`;
    }
    if (res.ok) showConnToast('Propriété intellectuelle récupérée.', 'ok');
  } catch { showConnToast('Backend inaccessible.', 'warn'); }
  finally { setLoading(btn, false); }
}

// ── 10. Import documentaire ──────────────────────────────
async function uploadDoc(input, docType, mod) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('type', docType);
  const statusEl = document.getElementById(`doc-${docType}-${mod}`);
  if (statusEl) statusEl.textContent = '…';
  try {
    const res = await fetch(`${API}/documents/upload`, { method: 'POST', headers: authHeaders(), body: fd });
    const json = await res.json();
    if (statusEl) statusEl.textContent = res.ok ? '✓' : '✕';
    showConnToast(res.ok ? `${file.name} importé.` : json.error, res.ok ? 'ok' : 'warn');
  } catch {
    if (statusEl) statusEl.textContent = '✕';
    showConnToast('Backend inaccessible.', 'warn');
  }
}

// ── 11. Questionnaires déclaratifs ───────────────────────
async function submitQuestionnaire(e, type, mod) {
  e.preventDefault();
  let data = {};
  if (type === 'dirigeant') {
    data = {
      semaines_absence: parseFloat(document.getElementById(`q-absence-${mod}`)?.value) || 0,
      pct_decisions_deleguees: parseFloat(document.getElementById(`q-delegation-${mod}`)?.value) || 0,
      pct_ca_relation_perso: parseFloat(document.getElementById(`q-ca-perso-${mod}`)?.value) || 0,
      pct_savoir_faire_documente: parseFloat(document.getElementById(`q-savoir-faire-${mod}`)?.value) || 0,
    };
  } else if (type === 'process') {
    data = {
      pct_process_cles_documentes: parseFloat(document.getElementById(`q-process-${mod}`)?.value) || 0,
      a_manuel_onboarding: document.getElementById(`q-onboarding-${mod}`)?.checked || false,
      pct_rh_formalisee: parseFloat(document.getElementById(`q-rh-${mod}`)?.value) || 0,
      nb_hommes_cles_non_securises: parseInt(document.getElementById(`q-hc-${mod}`)?.value) || 0,
    };
  } else if (type === 'remunerations') {
    data = {
      remuneration_dirigeant_actuelle: parseFloat(document.getElementById(`q-rem-actuelle-${mod}`)?.value) || 0,
      remuneration_dirigeant_normative: parseFloat(document.getElementById(`q-rem-normative-${mod}`)?.value) || 0,
      loyer_actuel: parseFloat(document.getElementById(`q-loyer-actuel-${mod}`)?.value) || 0,
      loyer_normatif: parseFloat(document.getElementById(`q-loyer-normatif-${mod}`)?.value) || 0,
    };
  }
  try {
    const res = await fetch(`${API}/questionnaire/${type}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ mod, ...data }),
    });
    const json = await res.json();
    showConnToast(res.ok ? 'Réponses enregistrées.' : json.error, res.ok ? 'ok' : 'warn');
  } catch { showConnToast('Backend inaccessible.', 'warn'); }
}

// ── UTILS ───────────────────────────────────────────────
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
      <span class="drop-icon">+</span>
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
        <span class="cc-icon"></span>
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
    <div style="font-size:0.75rem;color:var(--text-muted);padding:8px 0;">Lecture seule · Données chiffrées AES-256 · Hébergement UE · Révocable à tout moment</div>
  </div>

  <!-- 4. CRM & Facturation -->
  <div class="conn-section">
    <div class="conn-section-title">4 — CRM & Facturation</div>
    <div class="conn-cards-row">
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon"></span><div><h4>HubSpot</h4><p>CA par client, pipeline, churn</p></div></div>
        <button class="btn btn-outline btn-sm" onclick="connectCRM('hubspot')">Connecter</button>
      </div>
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon"></span><div><h4>Pipedrive</h4><p>Deals gagnés, clients, revenus</p></div></div>
        <button class="btn btn-outline btn-sm" onclick="connectCRM('pipedrive')">Connecter</button>
      </div>
    </div>
  </div>

  <!-- 5. SIRH -->
  <div class="conn-section">
    <div class="conn-section-title">5 — SIRH (Capital humain)</div>
    <div class="conn-cards-row" style="margin-bottom:12px;">
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon"></span><div><h4>PayFit</h4><p>Effectif, ancienneté, turnover</p></div></div>
        <button class="btn btn-outline btn-sm" onclick="connectSIRH('payfit')">Connecter</button>
      </div>
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon"></span><div><h4>Lucca</h4><p>Collaborateurs, organigramme</p></div></div>
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

  <!-- 8. Stripe / Facturation — CA récurrent -->
  <div class="conn-section">
    <div class="conn-section-title">8 — Facturation & CA récurrent (Stripe)</div>
    <div class="conn-cards-row">
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon"></span><div><h4>Stripe</h4><p>% CA récurrent, MRR, ARR, contrats actifs</p></div></div>
        <button class="btn btn-outline btn-sm" onclick="connectFacturation('stripe')">Connecter</button>
      </div>
      <div class="conn-card-sm">
        <div class="cc-left"><span class="cc-icon"></span><div><h4>Import contrats</h4><p>Déposez vos contrats-cadres ou bons de commande récurrents</p></div></div>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('contrats-file-${mod}').click()">Importer</button>
        <input id="contrats-file-${mod}" type="file" accept=".pdf,.csv,.xlsx" style="display:none" onchange="uploadContrats(this,'${mod}')" />
      </div>
    </div>
  </div>

  <!-- 9. INPI — Dépôts de marque -->
  <div class="conn-section">
    <div class="conn-section-title">9 — Propriété intellectuelle (INPI)</div>
    <div style="display:flex;gap:10px;align-items:center;">
      <div style="flex:1;font-size:0.85rem;color:var(--text-muted);">Dépôts de marque, brevets et dessins — alimentés automatiquement par le SIREN (étape 1).</div>
      <button id="btn-inpi-${mod}" class="btn btn-primary btn-sm" onclick="fetchINPI('${mod}')">Analyser →</button>
    </div>
    <div id="inpi-result-${mod}" style="display:none;margin-top:12px;"></div>
  </div>

  <!-- 10. Import documentaire -->
  <div class="conn-section">
    <div class="conn-section-title">10 — Import documentaire</div>
    <p style="font-size:0.83rem;color:var(--text-muted);margin-bottom:14px;">Déposez vos documents juridiques et contractuels. Ils sont analysés par l'IA pour enrichir le diagnostic.</p>
    <div class="doc-import-grid">
      <label class="doc-import-item">
        <input type="file" accept=".pdf,.docx" style="display:none" onchange="uploadDoc(this,'statuts','${mod}')" />
        <span class="doc-icon">📄</span>
        <span class="doc-label">Statuts</span>
        <span class="doc-status" id="doc-statuts-${mod}">—</span>
      </label>
      <label class="doc-import-item">
        <input type="file" accept=".pdf,.docx" style="display:none" onchange="uploadDoc(this,'cgv','${mod}')" />
        <span class="doc-icon">📄</span>
        <span class="doc-label">CGV</span>
        <span class="doc-status" id="doc-cgv-${mod}">—</span>
      </label>
      <label class="doc-import-item">
        <input type="file" accept=".pdf,.docx" style="display:none" onchange="uploadDoc(this,'baux','${mod}')" />
        <span class="doc-icon">📄</span>
        <span class="doc-label">Baux</span>
        <span class="doc-status" id="doc-baux-${mod}">—</span>
      </label>
      <label class="doc-import-item">
        <input type="file" accept=".pdf,.docx" style="display:none" onchange="uploadDoc(this,'pv_ag','${mod}')" />
        <span class="doc-icon">📄</span>
        <span class="doc-label">PV d'AG</span>
        <span class="doc-status" id="doc-pv_ag-${mod}">—</span>
      </label>
      <label class="doc-import-item">
        <input type="file" accept=".pdf,.docx" style="display:none" onchange="uploadDoc(this,'assurance','${mod}')" />
        <span class="doc-icon">📄</span>
        <span class="doc-label">Assurances</span>
        <span class="doc-status" id="doc-assurance-${mod}">—</span>
      </label>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:10px;">Fichiers chiffrés AES-256 · Stockage UE · Suppression sur demande</div>
  </div>

  <!-- 11. Questionnaires déclaratifs -->
  <div class="conn-section">
    <div class="conn-section-title">11 — Questionnaires déclaratifs</div>

    <details style="margin-bottom:10px;">
      <summary style="font-size:0.88rem;font-weight:600;cursor:pointer;padding:10px 0;color:var(--text-white);">Dépendance dirigeant — délégation, absence, relation client</summary>
      <form class="sirh-manual" onsubmit="submitQuestionnaire(event,'dirigeant','${mod}')" style="margin-top:8px;">
        <div class="form-row">
          <div class="form-group">
            <label>Semaines d'absence sans impact (an)</label>
            <input type="number" min="0" max="52" placeholder="Ex : 3" id="q-absence-${mod}" />
          </div>
          <div class="form-group">
            <label>% décisions opérationnelles déléguées</label>
            <input type="number" min="0" max="100" placeholder="Ex : 60" id="q-delegation-${mod}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>% CA lié à la relation personnelle du dirigeant</label>
            <input type="number" min="0" max="100" placeholder="Ex : 40" id="q-ca-perso-${mod}" />
          </div>
          <div class="form-group">
            <label>% savoir-faire métier documenté</label>
            <input type="number" min="0" max="100" placeholder="Ex : 50" id="q-savoir-faire-${mod}" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">Enregistrer →</button>
      </form>
    </details>

    <details style="margin-bottom:10px;">
      <summary style="font-size:0.88rem;font-weight:600;cursor:pointer;padding:10px 0;color:var(--text-white);">Documentation & process internes</summary>
      <form class="sirh-manual" onsubmit="submitQuestionnaire(event,'process','${mod}')" style="margin-top:8px;">
        <div class="form-row">
          <div class="form-group">
            <label>% process clés documentés</label>
            <input type="number" min="0" max="100" placeholder="Ex : 40" id="q-process-${mod}" />
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:10px;padding-top:24px;">
            <input id="q-onboarding-${mod}" type="checkbox" style="width:auto;accent-color:var(--blue-accent);" />
            <label for="q-onboarding-${mod}" style="font-weight:400;font-size:0.88rem;cursor:pointer;">Manuel d'onboarding existant</label>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>% RH formalisée (fiches de poste, règlement)</label>
            <input type="number" min="0" max="100" placeholder="Ex : 60" id="q-rh-${mod}" />
          </div>
          <div class="form-group">
            <label>Hommes-clés sans clause de non-concurrence</label>
            <input type="number" min="0" placeholder="Ex : 2" id="q-hc-${mod}" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">Enregistrer →</button>
      </form>
    </details>

    <details>
      <summary style="font-size:0.88rem;font-weight:600;cursor:pointer;padding:10px 0;color:var(--text-white);">Rémunération & loyer normatifs (retraitements EBE)</summary>
      <form class="sirh-manual" onsubmit="submitQuestionnaire(event,'remunerations','${mod}')" style="margin-top:8px;">
        <div class="form-row">
          <div class="form-group">
            <label>Rémunération actuelle dirigeant (€ charg. comp.)</label>
            <input type="number" min="0" placeholder="Ex : 120000" id="q-rem-actuelle-${mod}" />
          </div>
          <div class="form-group">
            <label>Rémunération normative DG équivalent (€)</label>
            <input type="number" min="0" placeholder="Ex : 80000" id="q-rem-normative-${mod}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Loyer actuel payé (€/an)</label>
            <input type="number" min="0" placeholder="Ex : 36000" id="q-loyer-actuel-${mod}" />
          </div>
          <div class="form-group">
            <label>Loyer de marché équivalent (€/an)</label>
            <input type="number" min="0" placeholder="Ex : 30000" id="q-loyer-normatif-${mod}" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">Enregistrer →</button>
      </form>
    </details>
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
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:10px;">Toutes les données sont chiffrées AES-256 · Hébergement UE · Droit à l'effacement garanti (RGPD art. 17)</div>
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
