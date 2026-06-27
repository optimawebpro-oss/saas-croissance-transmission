/**
 * Pipeline de données — Illustration 3D animée
 * Section "Fonctionnement" (4 étapes)
 *
 * UTILISATION :
 * 1. Placer ce fichier dans js/
 * 2. Ajouter dans la page HTML, là où vous voulez l'illustration :
 *    <div id="pipeline-container" style="width:100%;height:340px;"></div>
 * 3. Inclure le script après le conteneur :
 *    <script src="js/pipeline-animation.js"></script>
 *
 * Le canvas s'adapte automatiquement à la taille du conteneur.
 */

(function () {
  var container = document.getElementById('pipeline-container');
  if (!container) return;

  var canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  var cx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var W, H, sR;
  var spheres, dataParticles;

  function resize() {
    var rect = container.getBoundingClientRect();
    W = rect.width * dpr;
    H = rect.height * dpr;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    sR = 28 * dpr;
    spheres = [
      { x: W * 0.15, y: H * 0.5, label: '1' },
      { x: W * 0.38, y: H * 0.5, label: '2' },
      { x: W * 0.62, y: H * 0.5, label: '3' },
      { x: W * 0.85, y: H * 0.5, label: '4' },
    ];
  }

  function initParticles() {
    dataParticles = [];
    for (var i = 0; i < 25; i++) {
      dataParticles.push({
        seg: Math.floor(Math.random() * 3),
        t: Math.random(),
        speed: 0.004 + Math.random() * 0.006,
      });
    }
  }

  function loop() {
    cx.clearRect(0, 0, W, H);
    var now = Date.now() * 0.001;

    // Tubes between spheres
    for (var i = 0; i < 3; i++) {
      var from = spheres[i],
        to = spheres[i + 1];
      var grad = cx.createLinearGradient(from.x, from.y, to.x, to.y);
      grad.addColorStop(0, 'rgba(99,102,241,0.3)');
      grad.addColorStop(0.5, 'rgba(59,130,246,0.15)');
      grad.addColorStop(1, 'rgba(99,102,241,0.3)');
      cx.beginPath();
      cx.moveTo(from.x + sR, from.y);
      cx.lineTo(to.x - sR, to.y);
      cx.strokeStyle = grad;
      cx.lineWidth = 4 * dpr;
      cx.stroke();

      // Side rails
      cx.lineWidth = 1 * dpr;
      cx.strokeStyle = 'rgba(99,102,241,0.1)';
      cx.beginPath();
      cx.moveTo(from.x + sR, from.y - 8 * dpr);
      cx.lineTo(to.x - sR, to.y - 8 * dpr);
      cx.stroke();
      cx.beginPath();
      cx.moveTo(from.x + sR, from.y + 8 * dpr);
      cx.lineTo(to.x - sR, to.y + 8 * dpr);
      cx.stroke();
    }

    // Flowing data particles
    for (var i = 0; i < dataParticles.length; i++) {
      var dp = dataParticles[i];
      dp.t += dp.speed;
      if (dp.t > 1) {
        dp.t = 0;
        dp.seg = (dp.seg + 1) % 3;
      }
      var from = spheres[dp.seg],
        to = spheres[dp.seg + 1];
      var startX = from.x + sR;
      var endX = to.x - sR;
      var px = startX + (endX - startX) * dp.t;
      var py = from.y + Math.sin(dp.t * Math.PI) * (-15 * dpr);
      cx.beginPath();
      cx.arc(px, py, 2 * dpr, 0, 6.283);
      cx.fillStyle = 'rgba(59,130,246,0.8)';
      cx.fill();
    }

    // Spheres (nodes)
    for (var i = 0; i < 4; i++) {
      var sp = spheres[i];
      var pulse = 1 + 0.08 * Math.sin(now * 2 + i * 1.5);
      var r = sR * pulse;

      // Glow
      cx.beginPath();
      cx.arc(sp.x, sp.y, r + 6 * dpr, 0, 6.283);
      cx.fillStyle = 'rgba(99,102,241,0.06)';
      cx.fill();

      // Body
      cx.beginPath();
      cx.arc(sp.x, sp.y, r, 0, 6.283);
      cx.fillStyle = 'rgba(16,20,40,0.9)';
      cx.strokeStyle =
        'rgba(99,102,241,' + (0.4 + 0.3 * pulse).toFixed(3) + ')';
      cx.lineWidth = 1.5 * dpr;
      cx.fill();
      cx.stroke();

      // Number
      cx.fillStyle = 'rgba(129,140,248,0.9)';
      cx.font = 14 * dpr + 'px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(sp.label, sp.x, sp.y);
    }

    // Step labels
    var labels = ['Connexion', 'Diagnostic', 'Plan', 'Suivi'];
    cx.font = 11 * dpr + 'px sans-serif';
    cx.fillStyle = 'rgba(167,175,255,0.7)';
    cx.textAlign = 'center';
    for (var i = 0; i < 4; i++) {
      cx.fillText(labels[i], spheres[i].x, spheres[i].y + sR + 18 * dpr);
    }

    requestAnimationFrame(loop);
  }

  resize();
  initParticles();
  loop();

  window.addEventListener('resize', function () {
    resize();
  });
})();
