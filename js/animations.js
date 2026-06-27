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
        cx.fillText('Evoluty', mx, my + 20 * dpr);
        cx.font = Math.round(13 * dpr) + 'px Inter,sans-serif';
        cx.fillStyle = 'rgba(78,137,232,' + to.toFixed(3) + ')';
        cx.fillText("Croissance & Transmission d'entreprise par l'IA", mx, my + 48 * dpr);
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
  // 3. ENTREPRISE FRAGMENTÉE 3D v3
  // ─────────────────────────────────────────────────────────
  function initCube() {
    var cv = document.getElementById('cube-cv');
    if (!cv) return;
    var cx = cv.getContext('2d');
    var s = fitCanvas(cv), W = s.w, H = s.h, mx = W/2, my = H/2;

    var labels = ['Pas de vision','Plans génériques','Transmission\nmal préparée','Accompagnement\ninaccessible','Suivi\ninexistant','Données\néparpillées'];
    var faceColors = [[99,102,241],[59,130,246],[139,92,246],[236,72,153],[34,211,238],[245,158,11]];
    var S = 48 * dpr;
    var facesDef = [
      {n:[0,0,1],verts:[[1,1,1],[-1,1,1],[-1,-1,1],[1,-1,1]]},
      {n:[0,0,-1],verts:[[-1,1,-1],[1,1,-1],[1,-1,-1],[-1,-1,-1]]},
      {n:[1,0,0],verts:[[1,1,-1],[1,1,1],[1,-1,1],[1,-1,-1]]},
      {n:[-1,0,0],verts:[[-1,1,1],[-1,1,-1],[-1,-1,-1],[-1,-1,1]]},
      {n:[0,1,0],verts:[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]},
      {n:[0,-1,0],verts:[[1,-1,1],[-1,-1,1],[-1,-1,-1],[1,-1,-1]]}
    ];

    var faces = [];
    for (var i = 0; i < 6; i++) {
      var n = facesDef[i].n;
      faces.push({
        def: facesDef[i],
        ox: n[0]*120*dpr, oy: n[1]*120*dpr, oz: n[2]*120*dpr,
        wobPhaseX: Math.random()*6.283, wobPhaseY: Math.random()*6.283, wobPhaseZ: Math.random()*6.283,
        wobSpdX: 0.15+Math.random()*0.3, wobSpdY: 0.2+Math.random()*0.25, wobSpdZ: 0.1+Math.random()*0.2,
        wobAmpX: 18+Math.random()*25, wobAmpY: 15+Math.random()*20, wobAmpZ: 10+Math.random()*15,
        selfRot: Math.random()*6.283, selfRotSpd: (Math.random()-0.5)*0.008,
        col: faceColors[i], label: labels[i]
      });
    }

    var debris = [];
    for (var i = 0; i < 60; i++) {
      debris.push({
        x: (Math.random()-0.5)*300*dpr, y: (Math.random()-0.5)*300*dpr, z: (Math.random()-0.5)*300*dpr,
        vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3, vz: (Math.random()-0.5)*0.3,
        r: 0.5+Math.random()*1.5, col: faceColors[Math.floor(Math.random()*6)]
      });
    }

    var sparks = [];
    for (var i = 0; i < 20; i++) {
      sparks.push({ faceIdx: Math.floor(Math.random()*6), t: Math.random(), speed: 0.002+Math.random()*0.005, trail: [] });
    }

    function rotY(p,a){var c=Math.cos(a),s=Math.sin(a);return[p[0]*c-p[2]*s,p[1],p[0]*s+p[2]*c];}
    function rotX(p,a){var c=Math.cos(a),s=Math.sin(a);return[p[0],p[1]*c-p[2]*s,p[1]*s+p[2]*c];}
    function prj(p){var sc=700/(700+p[2]);return{x:mx+p[0]*sc,y:my+p[1]*sc,z:p[2],sc:sc};}

    var angY=0, angX=0;
    function cubeLoop() {
      cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
      angY += 0.004;
      angX = Math.sin(angY*0.3)*0.2;
      var now = Date.now()*0.001;

      var rendered = [];
      for (var i = 0; i < 6; i++) {
        var f = faces[i];
        f.selfRot += f.selfRotSpd;
        var wobX = Math.sin(now*f.wobSpdX+f.wobPhaseX)*f.wobAmpX*dpr;
        var wobY = Math.sin(now*f.wobSpdY+f.wobPhaseY)*f.wobAmpY*dpr;
        var wobZ = Math.sin(now*f.wobSpdZ+f.wobPhaseZ)*f.wobAmpZ*dpr;
        var cx0=f.ox+wobX, cy0=f.oy+wobY, cz0=f.oz+wobZ;
        var verts=f.def.verts, projected=[], zSum=0;
        for (var v=0;v<4;v++) {
          var lx=verts[v][0]*S, ly=verts[v][1]*S, lz=verts[v][2]*S;
          var cr=Math.cos(f.selfRot), sr=Math.sin(f.selfRot);
          var rlx=lx*cr-ly*sr, rly=lx*sr+ly*cr;
          var wx=rlx+cx0, wy=rly+cy0, wz=lz+cz0;
          var r1=rotY([wx,wy,wz],angY), r2=rotX(r1,angX), pp=prj(r2);
          projected.push(pp); zSum+=pp.z;
        }
        var center=rotX(rotY([cx0,cy0,cz0],angY),angX), cp=prj(center);
        rendered.push({proj:projected,z:zSum/4,col:f.col,label:f.label,cx:cp.x,cy:cp.y,sc:cp.sc,idx:i});
      }

      for (var i=0;i<debris.length;i++) {
        var d=debris[i];
        d.x+=d.vx; d.y+=d.vy; d.z+=d.vz;
        if(Math.abs(d.x)>250*dpr)d.vx*=-1;
        if(Math.abs(d.y)>250*dpr)d.vy*=-1;
        if(Math.abs(d.z)>250*dpr)d.vz*=-1;
        var r1=rotY([d.x,d.y,d.z],angY), r2=rotX(r1,angX), pp=prj(r2);
        cx.beginPath(); cx.arc(pp.x,pp.y,d.r*dpr*pp.sc,0,6.283);
        cx.fillStyle='rgba('+d.col[0]+','+d.col[1]+','+d.col[2]+',0.3)'; cx.fill();
      }

      rendered.sort(function(a,b){return a.z-b.z;});

      for (var i=0;i<rendered.length;i++) {
        for (var j=i+1;j<rendered.length;j++) {
          cx.beginPath(); cx.setLineDash([3*dpr,8*dpr]);
          cx.moveTo(rendered[i].cx,rendered[i].cy); cx.lineTo(rendered[j].cx,rendered[j].cy);
          cx.strokeStyle='rgba(99,102,241,0.05)'; cx.lineWidth=0.5*dpr; cx.stroke(); cx.setLineDash([]);
        }
      }

      for (var i=0;i<rendered.length;i++) {
        var rf=rendered[i], p=rf.proj, c=rf.col;
        cx.beginPath(); cx.moveTo(p[0].x,p[0].y);
        for (var v=1;v<4;v++) cx.lineTo(p[v].x,p[v].y);
        cx.closePath();
        cx.fillStyle='rgba('+c[0]+','+c[1]+','+c[2]+',0.07)'; cx.fill();
        cx.strokeStyle='rgba('+c[0]+','+c[1]+','+c[2]+','+(0.3+rf.sc*0.2).toFixed(3)+')';
        cx.lineWidth=1.2*dpr; cx.stroke();
        for (var v=0;v<4;v++) {
          cx.beginPath(); cx.arc(p[v].x,p[v].y,2.5*dpr*p[v].sc,0,6.283);
          cx.fillStyle='rgba('+c[0]+','+c[1]+','+c[2]+',0.7)'; cx.fill();
        }
        var edgePulse=0.5+0.5*Math.sin(now*2+rf.idx);
        cx.beginPath(); cx.moveTo(p[0].x,p[0].y);
        for (var v=1;v<4;v++) cx.lineTo(p[v].x,p[v].y);
        cx.closePath();
        cx.strokeStyle='rgba('+c[0]+','+c[1]+','+c[2]+','+(0.08*edgePulse).toFixed(3)+')';
        cx.lineWidth=4*dpr; cx.stroke();
        cx.fillStyle='rgba('+c[0]+','+c[1]+','+c[2]+','+(0.65+rf.sc*0.25).toFixed(3)+')';
        var fs=Math.round(10*dpr*Math.min(rf.sc*1.1,1.2));
        cx.font='500 '+fs+'px Inter,sans-serif'; cx.textAlign='center'; cx.textBaseline='middle';
        var lines=rf.label.split('\n');
        for (var l=0;l<lines.length;l++) {
          cx.fillText(lines[l],rf.cx,rf.cy+(l-(lines.length-1)/2)*fs*1.25);
        }
      }

      for (var i=0;i<sparks.length;i++) {
        var sp=sparks[i]; sp.t+=sp.speed;
        if(sp.t>1){sp.t=0;sp.faceIdx=(sp.faceIdx+1)%6;}
        var f1=faces[sp.faceIdx], f2=faces[(sp.faceIdx+1)%6];
        var x1=f1.ox+Math.sin(now*f1.wobSpdX+f1.wobPhaseX)*f1.wobAmpX*dpr;
        var y1=f1.oy+Math.sin(now*f1.wobSpdY+f1.wobPhaseY)*f1.wobAmpY*dpr;
        var z1=f1.oz+Math.sin(now*f1.wobSpdZ+f1.wobPhaseZ)*f1.wobAmpZ*dpr;
        var x2=f2.ox+Math.sin(now*f2.wobSpdX+f2.wobPhaseX)*f2.wobAmpX*dpr;
        var y2=f2.oy+Math.sin(now*f2.wobSpdY+f2.wobPhaseY)*f2.wobAmpY*dpr;
        var z2=f2.oz+Math.sin(now*f2.wobSpdZ+f2.wobPhaseZ)*f2.wobAmpZ*dpr;
        var px=x1+(x2-x1)*sp.t, py=y1+(y2-y1)*sp.t, pz=z1+(z2-z1)*sp.t;
        var r1=rotY([px,py,pz],angY), r2=rotX(r1,angX), pp=prj(r2);
        sp.trail.push({x:pp.x,y:pp.y});
        if(sp.trail.length>12)sp.trail.shift();
        for (var t=0;t<sp.trail.length;t++) {
          var alpha=(t/sp.trail.length)*0.5;
          cx.beginPath(); cx.arc(sp.trail[t].x,sp.trail[t].y,1.5*dpr*(t/sp.trail.length),0,6.283);
          cx.fillStyle='rgba(129,140,248,'+alpha.toFixed(3)+')'; cx.fill();
        }
        cx.beginPath(); cx.arc(pp.x,pp.y,2.5*dpr,0,6.283);
        cx.fillStyle='rgba(199,210,254,0.9)'; cx.fill();
      }

      requestAnimationFrame(cubeLoop);
    }
    cubeLoop();
    window.addEventListener('resize', function() { var s2=fitCanvas(cv); W=s2.w; H=s2.h; mx=W/2; my=H/2; });
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
