/**
 * Neural Network Wipe — Transition de page
 * Durée : 1.9s | Thème : réseau neuronal bleu/indigo
 *
 * UTILISATION :
 * 1. Inclure ce script dans toutes les pages : <script src="js/page-transition.js"></script>
 * 2. Ajouter la classe "page-link" sur tous les liens de navigation internes :
 *    <a href="tarifs.html" class="page-link">Tarifs</a>
 * 3. C'est tout. Le script intercepte les clics et lance l'animation.
 */

(function () {
  var DURATION = 1900;
  var NODE_COUNT = 100;
  var canvas, ctx, W, H;

  function createOverlay() {
    canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:99999;pointer-events:none;opacity:0;transition:opacity 0s';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }

  function sizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    W = window.innerWidth * dpr;
    H = window.innerHeight * dpr;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  function runTransition(href) {
    if (!canvas) createOverlay();
    sizeCanvas();
    canvas.style.opacity = '1';

    var nodes = [];
    for (var i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1.5 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
      });
    }

    var t0 = Date.now();
    var navigated = false;

    function loop() {
      var p = Math.min((Date.now() - t0) / DURATION, 1);
      ctx.clearRect(0, 0, W, H);

      // Move nodes
      for (var i = 0; i < NODE_COUNT; i++) {
        nodes[i].x += nodes[i].vx;
        nodes[i].y += nodes[i].vy;
        if (nodes[i].x < 0 || nodes[i].x > W) nodes[i].vx *= -1;
        if (nodes[i].y < 0 || nodes[i].y > H) nodes[i].vy *= -1;
      }

      var density, nodeAlpha, lineAlpha, maxDist;

      if (p < 0.5) {
        var t = p / 0.5;
        density = t;
        nodeAlpha = t;
        lineAlpha = t * 0.4;
        maxDist = 80 + 170 * t;
      } else {
        var t = (p - 0.5) / 0.5;
        density = 1 - t;
        nodeAlpha = 1 - t;
        lineAlpha = 0.4 * (1 - t);
        maxDist = 250 * (1 - t);
      }

      // Draw connections
      if (maxDist > 10) {
        for (var i = 0; i < NODE_COUNT; i++) {
          for (var j = i + 1; j < NODE_COUNT; j++) {
            var dx = nodes[i].x - nodes[j].x;
            var dy = nodes[i].y - nodes[j].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist) {
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.strokeStyle =
                'rgba(99,102,241,' +
                (lineAlpha * (1 - dist / maxDist)).toFixed(3) +
                ')';
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
      }

      // Draw nodes
      for (var i = 0; i < NODE_COUNT; i++) {
        var nr = nodes[i].r * (0.5 + density * 0.8);
        if (nr < 0.3) continue;
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, nr, 0, 6.283);
        ctx.fillStyle =
          'rgba(129,140,248,' + (nodeAlpha * 0.9).toFixed(3) + ')';
        ctx.fill();
      }

      // Navigate at midpoint
      if (p >= 0.5 && !navigated) {
        navigated = true;
        window.location.href = href;
      }

      if (p < 1) {
        requestAnimationFrame(loop);
      }
    }

    requestAnimationFrame(loop);
  }

  // On page load: play the fade-out half if we arrived via transition
  function playEntrance() {
    if (!sessionStorage.getItem('nn-transition')) return;
    sessionStorage.removeItem('nn-transition');

    createOverlay();
    sizeCanvas();
    canvas.style.opacity = '1';

    var nodes = [];
    for (var i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1.5 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
      });
    }

    var t0 = Date.now();
    var halfDur = DURATION / 2;

    function loop() {
      var p = Math.min((Date.now() - t0) / halfDur, 1);
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < NODE_COUNT; i++) {
        nodes[i].x += nodes[i].vx;
        nodes[i].y += nodes[i].vy;
        if (nodes[i].x < 0 || nodes[i].x > W) nodes[i].vx *= -1;
        if (nodes[i].y < 0 || nodes[i].y > H) nodes[i].vy *= -1;
      }

      var density = 1 - p;
      var nodeAlpha = 1 - p;
      var lineAlpha = 0.4 * (1 - p);
      var maxDist = 250 * (1 - p);

      if (maxDist > 10) {
        for (var i = 0; i < NODE_COUNT; i++) {
          for (var j = i + 1; j < NODE_COUNT; j++) {
            var dx = nodes[i].x - nodes[j].x;
            var dy = nodes[i].y - nodes[j].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxDist) {
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.strokeStyle =
                'rgba(99,102,241,' +
                (lineAlpha * (1 - dist / maxDist)).toFixed(3) +
                ')';
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
      }

      for (var i = 0; i < NODE_COUNT; i++) {
        var nr = nodes[i].r * (0.5 + density * 0.8);
        if (nr < 0.3) continue;
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, nr, 0, 6.283);
        ctx.fillStyle =
          'rgba(129,140,248,' + (nodeAlpha * 0.9).toFixed(3) + ')';
        ctx.fill();
      }

      if (p < 1) {
        requestAnimationFrame(loop);
      } else {
        canvas.style.opacity = '0';
        ctx.clearRect(0, 0, W, H);
      }
    }

    requestAnimationFrame(loop);
  }

  // Intercept clicks on page-link elements
  document.addEventListener('click', function (e) {
    var link = e.target.closest('.page-link');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http')) return;
    e.preventDefault();
    sessionStorage.setItem('nn-transition', '1');
    runTransition(href);
  });

  // Play entrance animation on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', playEntrance);
  } else {
    playEntrance();
  }
})();
