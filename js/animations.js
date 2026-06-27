// ===== EVOLUTY — Animations page d'accueil =====
(function () {
  var BG = '#08080f';
  var dpr = window.devicePixelRatio || 1;

  function fitCanvas(cv) {
    var r = cv.parentElement.getBoundingClientRect();
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    cv.style.width = r.width + 'px';
    cv.style.height = r.height + 'px';
    return { w: cv.width, h: cv.height };
  }

  // ─────────────────────────────────────────────────────────
  // 1. CINÉMATIQUE — Section en haut de page (reste visible)
  // ─────────────────────────────────────────────────────────
  function initCinematic() {
    var cv = document.getElementById('opening-cv');
    if (!cv) return;
    var cx = cv.getContext('2d');
    var W, H, mx, my;

    function resize() {
      var r = cv.parentElement.getBoundingClientRect();
      W = r.width * dpr; H = r.height * dpr;
      cv.width = W; cv.height = H;
      cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      mx = W / 2; my = H / 2;
    }
    resize();
    window.addEventListener('resize', resize);

    var N = 240, pts = [];
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      var r = 130 * dpr + Math.random() * 35 * dpr;
      pts.push({
        tx: Math.cos(b) * Math.cos(a) * r,
        ty: Math.sin(b) * r,
        tz: Math.cos(b) * Math.sin(a) * r,
        x: (Math.random() - 0.5) * W * 2,
        y: (Math.random() - 0.5) * H * 2,
        z: Math.random() * 600 - 300,
        r: 1 + Math.random() * 2.5,
      });
    }

    var t0 = Date.now(), dur = 3400, done = false, idleAngle = 0;

    function draw(p) {
      cx.fillStyle = BG; cx.fillRect(0, 0, W, H);

      var ep = 1 - Math.pow(1 - Math.min(p, 1), 3);
      var animAngle = p * Math.PI * 0.5;
      var totalAngle = done ? idleAngle : animAngle;
      var cosR = Math.cos(totalAngle), sinR = Math.sin(totalAngle);

      // compute positions
      var projected = [];
      for (var i = 0; i < N; i++) {
        var pt = pts[i];
        var fx = done ? pt.tx : pt.x + (pt.tx - pt.x) * ep;
        var fy = done ? pt.ty : pt.y + (pt.ty - pt.y) * ep;
        var fz = done ? pt.tz : pt.z + (pt.tz - pt.z) * ep;
        var rx = fx * cosR - fz * sinR, rz = fx * sinR + fz * cosR;
        var sc = 700 / (700 + rz);
        projected.push({ x: mx + rx * sc, y: my + fy * sc, z: rz, r: pt.r * sc, alpha: Math.min(ep * 2, 1) * (0.35 + sc * 0.45) });
      }
      projected.sort(function (a, b) { return a.z - b.z; });

      // lines
      var la = done ? 1 : Math.max(0, (ep - 0.3) / 0.7);
      if (la > 0) {
        for (var i = 0; i < projected.length; i++) {
          for (var j = i + 1; j < projected.length; j++) {
            var dx = projected[i].x - projected[j].x, dy = projected[i].y - projected[j].y;
            var dist = Math.sqrt(dx * dx + dy * dy), maxD = 85 * dpr * la;
            if (dist < maxD) {
              cx.beginPath(); cx.moveTo(projected[i].x, projected[i].y); cx.lineTo(projected[j].x, projected[j].y);
              cx.strokeStyle = 'rgba(99,102,241,' + (la * 0.22 * (1 - dist / maxD)).toFixed(3) + ')';
              cx.lineWidth = 0.5 * dpr; cx.stroke();
            }
          }
        }
      }

      // nodes
      for (var i = 0; i < projected.length; i++) {
        var pp = projected[i];
        cx.beginPath(); cx.arc(pp.x, pp.y, pp.r * dpr, 0, 6.283);
        cx.fillStyle = 'rgba(129,140,248,' + Math.min(pp.alpha, 0.95).toFixed(3) + ')'; cx.fill();
      }

      // glow ring
      var ga = done ? 1 : Math.max(0, (ep - 0.55) * 2.2);
      if (ga > 0 && ga < 1.5) {
        cx.beginPath(); cx.arc(mx, my, 200 * dpr * Math.min(ga, 1), 0, 6.283);
        cx.strokeStyle = 'rgba(59,130,246,' + (0.25 * (1 - Math.min(ga, 1))).toFixed(3) + ')';
        cx.lineWidth = 2 * dpr; cx.stroke();
      }

      // text
      var to = done ? 1 : (p >= 0.8 ? (p - 0.8) / 0.2 : 0);
      if (to > 0) {
        cx.textAlign = 'center';
        cx.font = 'bold ' + Math.round(30 * dpr) + 'px Inter,sans-serif';
        cx.fillStyle = 'rgba(240,240,248,' + to.toFixed(3) + ')';
        cx.fillText('Evoluty', mx, my + 175 * dpr);
        cx.font = Math.round(13 * dpr) + 'px Inter,sans-serif';
        cx.fillStyle = 'rgba(78,137,232,' + to.toFixed(3) + ')';
        cx.fillText("Croissance & Transmission d'entreprise par l'IA", mx, my + 200 * dpr);
      }
    }

    function loop() {
      var elapsed = Date.now() - t0;
      var p = elapsed / dur;
      if (p >= 1 && !done) { done = true; }
      if (done) { idleAngle += 0.0015; draw(1); }
      else { draw(p); }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ─────────────────────────────────────────────────────────
  // 2. CERVEAU STRATÉGIQUE 3D
  // ─────────────────────────────────────────────────────────
  function initBrain() {
    var cv = document.getElementById('hero-brain');
    if (!cv) return;
    var cx = cv.getContext('2d');
    var s = fitCanvas(cv), W = s.w, H = s.h, mx = W / 2, my = H / 2;

    var colors = [[99,102,241],[59,130,246],[139,92,246],[236,72,153],[34,211,238],[16,185,129],[245,158,11]];
    var N = 220, nodes = [];
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
      var baseR = 105 * dpr, cosB = Math.cos(b), sinB = Math.sin(b);
      var hemisphere = Math.cos(a) > 0 ? 1 : -1;
      var split = Math.abs(Math.cos(a)) < 0.08 ? 0.7 : 1;
      var bulge = 1 + 0.22 * Math.pow(cosB, 2);
      var Rx = baseR * bulge * split * (1 + 0.15 * Math.abs(Math.sin(a)));
      var Ry = baseR * 0.75 * bulge, Rz = baseR * bulge * 0.85;
      var px = cosB * Math.cos(a) * Rx + hemisphere * 8 * dpr;
      var py = sinB * Ry - 10 * dpr, pz = cosB * Math.sin(a) * Rz;
      var stem = Math.random() < 0.08;
      if (stem) { px = (Math.random() - 0.5) * 25 * dpr; py = baseR * 0.75 * 0.6 + Math.random() * 40 * dpr; pz = (Math.random() - 0.5) * 20 * dpr; }
      var region = py < -baseR * 0.3 ? 0 : py > baseR * 0.3 ? (stem ? 6 : 5) : Math.cos(a) > 0.3 ? 1 : Math.cos(a) < -0.3 ? 2 : Math.sin(a) > 0 ? 3 : 4;
      nodes.push({ x: px, y: py, z: pz, r: 1 + Math.random() * 2.2, col: colors[region % colors.length], pulse: Math.random() * 6.283, speed: 0.4 + Math.random() * 2.5 });
    }
    var particles = [];
    for (var i = 0; i < 40; i++) particles.push({ from: Math.floor(Math.random() * N), to: Math.floor(Math.random() * N), t: Math.random(), speed: 0.003 + Math.random() * 0.007 });

    var angle = 0;
    function brainLoop() {
      cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
      angle += 0.003;
      var now = Date.now() * 0.001, cosA = Math.cos(angle), sinA = Math.sin(angle);
      var tiltA = 0.15, cosT = Math.cos(tiltA), sinT = Math.sin(tiltA);
      var proj = [], idxMap = [];
      for (var i = 0; i < N; i++) {
        var n = nodes[i];
        var rx = n.x * cosA - n.z * sinA, rz = n.x * sinA + n.z * cosA;
        var ry = n.y * cosT - rz * sinT, rz2 = n.y * sinT + rz * cosT;
        var sc = 650 / (650 + rz2);
        var pulse = 0.6 + 0.4 * Math.sin(now * n.speed + n.pulse);
        proj.push({ x: mx + rx * sc, y: my + ry * sc, z: rz2, r: n.r * sc, col: n.col, pulse: pulse });
        idxMap[i] = { x: mx + rx * sc, y: my + ry * sc };
      }
      proj.sort(function (a, b) { return a.z - b.z; });
      for (var i = 0; i < N; i++) {
        for (var j = i + 1; j < N; j++) {
          var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dz = nodes[i].z - nodes[j].z;
          var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < 70 * dpr) {
            var c = nodes[i].col;
            cx.beginPath(); cx.moveTo(idxMap[i].x, idxMap[i].y); cx.lineTo(idxMap[j].x, idxMap[j].y);
            cx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.1 * (1 - dist / (70 * dpr))).toFixed(3) + ')';
            cx.lineWidth = 0.5 * dpr; cx.stroke();
          }
        }
      }
      for (var i = 0; i < proj.length; i++) {
        var pp = proj[i];
        cx.beginPath(); cx.arc(pp.x, pp.y, pp.r * dpr * pp.pulse, 0, 6.283);
        cx.fillStyle = 'rgba(' + pp.col[0] + ',' + pp.col[1] + ',' + pp.col[2] + ',' + (0.4 + pp.pulse * 0.5).toFixed(3) + ')';
        cx.fill();
      }
      for (var i = 0; i < particles.length; i++) {
        var pa = particles[i]; pa.t += pa.speed;
        if (pa.t > 1) { pa.t = 0; pa.from = pa.to; pa.to = Math.floor(Math.random() * N); }
        var f = idxMap[pa.from], t = idxMap[pa.to];
        if (!f || !t) continue;
        var ppx = f.x + (t.x - f.x) * pa.t, ppy = f.y + (t.y - f.y) * pa.t;
        var c = colors[Math.floor(Math.random() * colors.length)];
        cx.beginPath(); cx.arc(ppx, ppy, 2 * dpr, 0, 6.283);
        cx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.85)'; cx.fill();
      }
      requestAnimationFrame(brainLoop);
    }
    brainLoop();
    window.addEventListener('resize', function () { var s2 = fitCanvas(cv); W = s2.w; H = s2.h; mx = W / 2; my = H / 2; });
  }

  // ─────────────────────────────────────────────────────────
  // 3. CUBE ÉCLATÉ
  // ─────────────────────────────────────────────────────────
  function initCube() {
    var cv = document.getElementById('cube-cv');
    if (!cv) return;
    var cx = cv.getContext('2d');
    var s = fitCanvas(cv), W = s.w, H = s.h;

    var labels = ['Pas de vision', 'Plans génériques', 'Transmission', 'Accompagnement', 'Suivi inexistant', 'Données éparpillées'];
    var cols = ['99,102,241', '59,130,246', '139,92,246', '236,72,153', '34,211,238', '245,158,11'];
    var spread = 85 * dpr;
    var dirs = [[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]];
    var faces = [];
    for (var i = 0; i < 6; i++) {
      var d = dirs[i];
      faces.push({ bx: d[0]*spread, by: d[1]*spread, bz: d[2]*spread, driftX: (Math.random()-0.5)*45*dpr, driftY: (Math.random()-0.5)*45*dpr, driftZ: (Math.random()-0.5)*35*dpr, wobbleX: Math.random()*6.283, wobbleY: Math.random()*6.283, wobSpeedX: 0.3+Math.random()*0.5, wobSpeedY: 0.2+Math.random()*0.4, wobAmp: 7+Math.random()*10, label: labels[i], col: cols[i], sz: 48*dpr });
    }
    var ang = 0;
    function cubeLoop() {
      cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
      ang += 0.004;
      var now = Date.now() * 0.001, cosA = Math.cos(ang), sinA = Math.sin(ang), cosB = Math.cos(ang*0.6), sinB = Math.sin(ang*0.6);
      var sorted = [];
      for (var i = 0; i < 6; i++) {
        var f = faces[i];
        var wx = Math.sin(now*f.wobSpeedX+f.wobbleX)*f.wobAmp*dpr, wy = Math.sin(now*f.wobSpeedY+f.wobbleY)*f.wobAmp*dpr;
        var fx = f.bx+f.driftX+wx, fy = f.by+f.driftY+wy, fz = f.bz+f.driftZ;
        var rx = fx*cosA-fz*sinA, rz = fx*sinA+fz*cosA;
        var ry = fy*cosB-rz*sinB, rz2 = fy*sinB+rz*cosB;
        var sc = 500/(500+rz2);
        sorted.push({ x: W/2+rx*sc, y: H/2+ry*sc, z: rz2, sc: sc, col: f.col, label: f.label, sz: f.sz*sc });
      }
      sorted.sort(function(a,b){return a.z-b.z;});
      for (var i = 0; i < sorted.length; i++) {
        for (var j = i+1; j < sorted.length; j++) {
          cx.beginPath(); cx.setLineDash([4*dpr,6*dpr]); cx.moveTo(sorted[i].x,sorted[i].y); cx.lineTo(sorted[j].x,sorted[j].y);
          cx.strokeStyle='rgba(99,102,241,0.04)'; cx.lineWidth=0.5*dpr; cx.stroke(); cx.setLineDash([]);
        }
      }
      for (var i = 0; i < sorted.length; i++) {
        var ff = sorted[i], sz = ff.sz;
        cx.fillStyle='rgba('+ff.col+',0.08)'; cx.strokeStyle='rgba('+ff.col+','+(0.3+ff.sc*0.25).toFixed(3)+')';
        cx.lineWidth=1*dpr; cx.beginPath(); cx.rect(ff.x-sz/2,ff.y-sz/2,sz,sz); cx.fill(); cx.stroke();
        cx.fillStyle='rgba('+ff.col+','+(0.7+ff.sc*0.25).toFixed(3)+')';
        cx.font='500 '+(Math.round(9*dpr*ff.sc))+'px Inter,sans-serif'; cx.textAlign='center'; cx.textBaseline='middle';
        var words = ff.label.split(' ');
        if (words.length <= 2) { cx.fillText(ff.label,ff.x,ff.y); }
        else {
          var half = Math.ceil(words.length/2);
          cx.fillText(words.slice(0,half).join(' '),ff.x,ff.y-6*dpr*ff.sc);
          cx.fillText(words.slice(half).join(' '),ff.x,ff.y+6*dpr*ff.sc);
        }
      }
      requestAnimationFrame(cubeLoop);
    }
    cubeLoop();
    window.addEventListener('resize', function() { var s2=fitCanvas(cv); W=s2.w; H=s2.h; });
  }

  // ─────────────────────────────────────────────────────────
  // 4. ORBITES
  // ─────────────────────────────────────────────────────────
  function initOrbits() {
    var cv = document.getElementById('orbits-cv');
    if (!cv) return;
    var cx = cv.getContext('2d');
    var s = fitCanvas(cv), W = s.w, H = s.h, mx = W/2, my = H/2;

    var R1 = 110*dpr, R2 = 165*dpr, tilt1 = 0.38, tilt2 = 0.32;
    var dots1 = [], dots2 = [];
    for (var i = 0; i < 14; i++) dots1.push({ a: i/14*Math.PI*2, speed: 0.007+Math.random()*0.003 });
    for (var i = 0; i < 18; i++) dots2.push({ a: i/18*Math.PI*2, speed: 0.004+Math.random()*0.002 });

    function orbitsLoop() {
      cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
      var now = Date.now()*0.001, pulse = 0.7+0.3*Math.sin(now*1.5);
      cx.beginPath(); cx.arc(mx,my,22*dpr,0,6.283); cx.fillStyle='rgba(99,102,241,'+(0.15*pulse).toFixed(3)+')'; cx.fill();
      cx.beginPath(); cx.arc(mx,my,14*dpr,0,6.283); cx.fillStyle='rgba(129,140,248,0.85)'; cx.fill();
      cx.strokeStyle='rgba(139,92,246,0.2)'; cx.lineWidth=1*dpr; cx.beginPath();
      for (var a=0;a<Math.PI*2;a+=0.04){var x=mx+Math.cos(a)*R1,y=my+Math.sin(a)*R1*tilt1;if(a===0)cx.moveTo(x,y);else cx.lineTo(x,y);}
      cx.closePath(); cx.stroke();
      cx.strokeStyle='rgba(59,130,246,0.2)'; cx.beginPath();
      for (var a=0;a<Math.PI*2;a+=0.04){var x=mx+Math.cos(a)*R2,y=my+Math.sin(a)*R2*tilt2;if(a===0)cx.moveTo(x,y);else cx.lineTo(x,y);}
      cx.closePath(); cx.stroke();
      for (var i=0;i<dots1.length;i++){var d=dots1[i];d.a+=d.speed;var x=mx+Math.cos(d.a)*R1,y=my+Math.sin(d.a)*R1*tilt1;cx.beginPath();cx.arc(x,y,3.5*dpr,0,6.283);cx.fillStyle='rgba(139,92,246,0.85)';cx.fill();cx.beginPath();cx.moveTo(mx,my);cx.lineTo(x,y);cx.strokeStyle='rgba(139,92,246,0.04)';cx.lineWidth=0.5*dpr;cx.stroke();}
      for (var i=0;i<dots2.length;i++){var d=dots2[i];d.a-=d.speed;var x=mx+Math.cos(d.a)*R2,y=my+Math.sin(d.a)*R2*tilt2;cx.beginPath();cx.arc(x,y,2.8*dpr,0,6.283);cx.fillStyle='rgba(59,130,246,0.75)';cx.fill();}
      var lblSize=Math.round(13*dpr), subSize=Math.round(10*dpr);
      var ly1=my+R1*tilt1+22*dpr;
      cx.fillStyle='rgba(8,8,15,0.85)'; var bw1=130*dpr,bh1=30*dpr; cx.beginPath(); cx.roundRect(mx-bw1/2,ly1-bh1/2,bw1,bh1,6*dpr); cx.fill(); cx.strokeStyle='rgba(139,92,246,0.45)'; cx.lineWidth=1*dpr; cx.stroke();
      cx.fillStyle='rgba(196,181,253,0.95)'; cx.font='500 '+lblSize+'px Inter,sans-serif'; cx.textAlign='center'; cx.textBaseline='middle'; cx.fillText('Croissance',mx,ly1);
      var ly2=my-R2*tilt2-22*dpr;
      cx.fillStyle='rgba(8,8,15,0.85)'; var bw2=140*dpr,bh2=30*dpr; cx.beginPath(); cx.roundRect(mx-bw2/2,ly2-bh2/2,bw2,bh2,6*dpr); cx.fill(); cx.strokeStyle='rgba(59,130,246,0.45)'; cx.lineWidth=1*dpr; cx.stroke();
      cx.fillStyle='rgba(147,197,253,0.95)'; cx.font='500 '+lblSize+'px Inter,sans-serif'; cx.fillText('Transmission',mx,ly2);
      cx.fillStyle='rgba(200,210,255,0.55)'; cx.font=subSize+'px Inter,sans-serif'; cx.fillText('Votre entreprise',mx,my+30*dpr);
      requestAnimationFrame(orbitsLoop);
    }
    orbitsLoop();
    window.addEventListener('resize', function(){var s2=fitCanvas(cv);W=s2.w;H=s2.h;mx=W/2;my=H/2;R1=110*dpr;R2=165*dpr;});
  }

  // ─────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────
  function init() {
    initCinematic();
    initBrain();
    initCube();
    initOrbits();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
