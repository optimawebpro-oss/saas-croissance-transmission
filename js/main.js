// ===== NAVBAR =====
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.querySelector('.nav-links')?.classList.toggle('mob-open');
  document.querySelector('.nav-cta')?.classList.toggle('mob-open');
});

window.addEventListener('scroll', () => {
  const nb = document.querySelector('.navbar');
  if (nb) nb.style.borderBottomColor = scrollY > 10 ? 'rgba(33,84,200,0.3)' : 'var(--border)';
});

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== MODULE TABS (Croissance / Transmission) =====
document.querySelectorAll('.module-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.module-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.module-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('module-' + tab.dataset.module)?.classList.add('active');
  });
});

// ===== SIDEBAR SOUS-PAGES =====
document.querySelectorAll('.sidebar-item').forEach(item => {
  item.addEventListener('click', () => {
    const sidebar = item.closest('.espace-sidebar');
    const main = item.closest('.module-panel').querySelector('.espace-main');
    sidebar.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const target = item.dataset.sub;
    main.querySelectorAll('.subpage').forEach(p => p.classList.remove('active'));
    main.querySelector('#' + target)?.classList.add('active');
  });
});

function goToSubpage(subId, sidebarId) {
  const sidebar = document.getElementById(sidebarId);
  sidebar?.querySelectorAll('.sidebar-item').forEach(i => {
    i.classList.toggle('active', i.dataset.sub === subId);
  });
  const panel = sidebar?.closest('.module-panel');
  panel?.querySelectorAll('.subpage').forEach(p => p.classList.remove('active'));
  panel?.querySelector('#' + subId)?.classList.add('active');
}

// ===== CONNEXIONS TOGGLE =====
function toggleConn(card) {
  const status = card.querySelector('.conn-status');
  const isConnected = card.classList.contains('connected');
  card.classList.toggle('connected', !isConnected);
  status.className = 'conn-status ' + (isConnected ? 'nok' : 'ok');
  status.textContent = isConnected ? '⬤ Non connecté' : '⬤ Connecté';
  showToast(isConnected ? 'Connexion retirée.' : '✦ Connexion établie avec succès !');
}

// ===== PARTENAIRE INVITE =====
function invitePartner(suffix) {
  const email = document.getElementById('partner-email-' + suffix)?.value?.trim();
  if (!email || !email.includes('@')) { showToast('⚠️ Veuillez entrer un email valide.'); return; }
  showToast('✦ Invitation envoyée à ' + email);
  document.getElementById('partner-email-' + suffix).value = '';
}

// ===== MOBILE STYLES =====
const s = document.createElement('style');
s.textContent = `
  @media(max-width:768px){
    .nav-links.mob-open,.nav-cta.mob-open{
      display:flex!important;flex-direction:column;
      position:fixed;top:68px;left:0;right:0;
      background:rgba(8,8,15,0.97);backdrop-filter:blur(16px);
      border-bottom:1px solid var(--border);padding:16px 24px;gap:8px;z-index:999;
    }
  }
`;
document.head.appendChild(s);
