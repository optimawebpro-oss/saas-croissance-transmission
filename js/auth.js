// ===== EVOLUTY — Auth & Abonnement (Kinde + Stripe) =====
(function () {
  var BACKEND = (window.EVOLUTY_BACKEND_URL || 'http://localhost:3001');

  // ── État global ────────────────────────────────────────
  var currentUser = null;
  var currentPlan = null;

  // ── Init ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    checkAuth();
    bindPlanButtons();
    showAlerts();
  });

  // ── Vérification auth ──────────────────────────────────
  function checkAuth() {
    fetch(BACKEND + '/api/auth/me', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.authenticated) {
          currentUser = data.user;
          currentPlan = data.subscription;
          updateNavAuth(true);
          updatePlanBadges();
        } else {
          updateNavAuth(false);
        }
      })
      .catch(function () { updateNavAuth(false); });
  }

  // ── Mise à jour navbar selon état auth ─────────────────
  function updateNavAuth(isAuth) {
    var loginBtns  = document.querySelectorAll('[data-auth="login"]');
    var registerBtns = document.querySelectorAll('[data-auth="register"]');
    var logoutBtns = document.querySelectorAll('[data-auth="logout"]');
    var userInfos  = document.querySelectorAll('[data-auth="user"]');
    var navCta     = document.querySelector('.nav-cta');

    if (isAuth && currentUser) {
      // Cacher login/register, afficher logout + user
      loginBtns.forEach(function (el) { el.style.display = 'none'; });
      registerBtns.forEach(function (el) { el.style.display = 'none'; });
      logoutBtns.forEach(function (el) { el.style.display = ''; });
      userInfos.forEach(function (el) {
        el.style.display = '';
        el.textContent = currentUser.given_name || currentUser.email;
      });

      // Injecter dynamiquement si non déjà présent
      if (navCta && !navCta.querySelector('[data-auth="logout"]')) {
        navCta.innerHTML =
          '<span class="nav-user-name" data-auth="user">' + (currentUser.given_name || currentUser.email) + '</span>' +
          '<span class="nav-plan-badge nav-plan-' + (currentPlan ? currentPlan.plan : 'gratuit') + '">' +
            capitalise(currentPlan ? currentPlan.plan : 'Gratuit') +
          '</span>' +
          '<a href="' + BACKEND + '/logout" class="btn-nav" data-auth="logout">Se déconnecter</a>';
      }
    } else {
      loginBtns.forEach(function (el) { el.style.display = ''; });
      registerBtns.forEach(function (el) { el.style.display = ''; });
      logoutBtns.forEach(function (el) { el.style.display = 'none'; });
      userInfos.forEach(function (el) { el.style.display = 'none'; });

      // Remettre les boutons par défaut si besoin
      if (navCta && !navCta.querySelector('[data-auth="login"]')) {
        navCta.innerHTML =
          '<a href="' + BACKEND + '/login" class="btn-nav" data-auth="login">Se connecter</a>' +
          '<a href="' + BACKEND + '/register" class="btn-nav btn-nav-primary" data-auth="register">S\'inscrire</a>';
      }
    }
  }

  // ── Boutons "Se connecter" / "S'inscrire" dans le DOM ──
  // Remplace les href="#" par les vraies URLs Kinde
  (function wireStaticButtons() {
    document.addEventListener('DOMContentLoaded', function () {
      document.querySelectorAll('a.btn-nav, a.btn').forEach(function (el) {
        var text = el.textContent.trim();
        if (text === 'Se connecter') {
          el.href = BACKEND + '/login';
          el.setAttribute('data-auth', 'login');
        } else if (text === "S'inscrire" || text === 'S\'inscrire') {
          el.href = BACKEND + '/register';
          el.setAttribute('data-auth', 'register');
        } else if (text === 'S\'inscrire gratuitement →' || text === 'S\'inscrire gratuitement') {
          el.href = BACKEND + '/register';
          el.setAttribute('data-auth', 'register');
        }
      });
    });
  })();

  // ── Boutons d'abonnement sur tarifs.html ───────────────
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
    // Vérifier si l'utilisateur est connecté
    if (!currentUser) {
      window.location.href = BACKEND + '/register?post_login_redirect=tarifs';
      return;
    }
    // Rediriger vers la Stripe Checkout Session créée par le backend
    window.location.href = BACKEND + '/api/stripe/checkout?plan=' + plan + '&billing=' + billing;
  }

  // ── Badge plan sur tarifs.html (si déjà abonné) ────────
  function updatePlanBadges() {
    if (!currentPlan || currentPlan.plan === 'gratuit') return;
    var planName = currentPlan.plan; // 'croissance' ou 'cession'
    document.querySelectorAll('[data-plan="' + planName + '"]').forEach(function (btn) {
      btn.textContent = 'Plan actif ✓';
      btn.classList.add('btn-success');
      btn.style.pointerEvents = 'none';
    });
  }

  // ── Alertes URL params (?subscription=success, ?error=...) ──
  function showAlerts() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success') {
      var plan = params.get('plan') || 'votre plan';
      showToast('Abonnement ' + capitalise(plan) + ' activé avec succès !', 'success');
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('subscription') === 'cancelled') {
      showToast('Paiement annulé. Vous pouvez réessayer à tout moment.', 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error') === 'login_required') {
      showToast('Veuillez vous connecter pour accéder à ce plan.', 'warning');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  // ── Toast notification ─────────────────────────────────
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

  function capitalise(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ── Exposer pour usage externe ─────────────────────────
  window.EvolutyAuth = { subscribeToPlan: subscribeToPlan, getUser: function () { return currentUser; }, getPlan: function () { return currentPlan; } };
})();
