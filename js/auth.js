// ===== APOGÉE — Auth & Abonnement (Kinde + Stripe JWT) =====
(function () {
  var BACKEND = (window.APOGEE_BACKEND_URL || 'http://localhost:3001');
  var TOKEN_KEY = 'apogee_auth_token';

  var currentUser = null;
  var currentPlan = null;

  document.addEventListener('DOMContentLoaded', function () {
    // Récupère le token depuis l'URL si on revient de Kinde
    var params = new URLSearchParams(window.location.search);
    var token = params.get('auth_token');
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      // Nettoie l'URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('auth') === 'error') {
      showToast('Erreur de connexion. Veuillez réessayer.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }

    checkAuth();
    bindPlanButtons();
    showAlerts();
    wireStaticButtons();
  });

  function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function checkAuth() {
    var token = getStoredToken();
    if (!token) { updateNavAuth(false); return; }

    fetch(BACKEND + '/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.authenticated) {
          currentUser = data.user;
          currentPlan = data.subscription;
          updateNavAuth(true);
          updatePlanBadges();
        } else {
          localStorage.removeItem(TOKEN_KEY);
          updateNavAuth(false);
        }
      })
      .catch(function () { updateNavAuth(false); });
  }

  function updateNavAuth(isAuth) {
    var navCta = document.querySelector('.nav-cta');
    if (!navCta) return;

    if (isAuth && currentUser) {
      var planLabel = currentPlan ? capitalise(currentPlan.plan) : 'Gratuit';
      var planClass = currentPlan ? currentPlan.plan : 'gratuit';
      navCta.innerHTML =
        '<span class="nav-user-name">' + (currentUser.given_name || currentUser.email) + '</span>' +
        '<span class="nav-plan-badge nav-plan-' + planClass + '">' + planLabel + '</span>' +
        '<a href="#" class="btn-nav" id="logout-btn">Se déconnecter</a>';
      document.getElementById('logout-btn').addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = BACKEND + '/logout';
      });
    } else {
      navCta.innerHTML =
        '<a href="' + BACKEND + '/login" class="btn-nav">Se connecter</a>' +
        '<a href="' + BACKEND + '/register" class="btn-nav btn-nav-primary">S\'inscrire</a>';
    }
  }

  function wireStaticButtons() {
    document.querySelectorAll('a.btn-nav, a.btn').forEach(function (el) {
      var text = el.textContent.trim();
      if (text === 'Se connecter') el.href = BACKEND + '/login';
      else if (text === "S'inscrire") el.href = BACKEND + '/register';
      else if (text === "S'inscrire gratuitement →" || text === "S'inscrire gratuitement") el.href = BACKEND + '/register';
    });
  }

  function bindPlanButtons() {
    document.querySelectorAll('[data-plan]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var plan = btn.getAttribute('data-plan');
        var billing = btn.getAttribute('data-billing') || 'monthly';
        subscribeToPlan(plan, billing);
      });
    });
  }

  function subscribeToPlan(plan, billing) {
    if (plan === 'gratuit') { window.location.href = BACKEND + '/register'; return; }
    var token = getStoredToken();
    if (!token) { window.location.href = BACKEND + '/register'; return; }
    window.location.href = BACKEND + '/api/stripe/checkout?plan=' + plan + '&billing=' + billing + '&token=' + encodeURIComponent(token);
  }

  function updatePlanBadges() {
    if (!currentPlan || currentPlan.plan === 'gratuit') return;
    document.querySelectorAll('[data-plan="' + currentPlan.plan + '"]').forEach(function (btn) {
      btn.textContent = 'Plan actif ✓';
      btn.classList.add('btn-success');
      btn.style.pointerEvents = 'none';
    });
  }

  function showAlerts() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success') {
      showToast('Abonnement activé avec succès !', 'success');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('subscription') === 'cancelled') {
      showToast('Paiement annulé.', 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  function showToast(msg, type) {
    var t = document.getElementById('ev-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ev-toast';
      t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:14px 20px;border-radius:10px;font-size:0.9rem;font-family:Inter,sans-serif;color:#fff;max-width:340px;box-shadow:0 4px 20px rgba(0,0,0,0.4);transition:opacity 0.3s;';
      document.body.appendChild(t);
    }
    var colors = { success: '#16a34a', info: '#2154c8', warning: '#d97706', error: '#dc2626' };
    t.style.background = colors[type] || colors.info;
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(function () { t.style.opacity = '0'; }, 4000);
  }

  function capitalise(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

  window.ApogeeAuth = {
    subscribeToPlan: subscribeToPlan,
    getUser: function () { return currentUser; },
    getPlan: function () { return currentPlan; },
    getToken: getStoredToken,
  };
})();
