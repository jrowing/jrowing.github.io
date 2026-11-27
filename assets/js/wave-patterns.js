/* Animated wave and physics patterns, drawn on a <canvas>. Used by the front page and by /writing/wave-backgrounds.html.
   WavePatterns.count            number of patterns
   WavePatterns.mount(canvas, i) draw pattern i (0-based) live on the canvas; returns {caption, reroll(), destroy()}
   The canvas colour (CSS `color`) is the ink. Each pattern uses its own random settings every time it is mounted. */
(function () {
  var TAU = 2 * Math.PI;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
  function crest(f, lo) { var v = (f - lo) / (1 - lo); return v < 0 ? 0 : v > 1 ? 1 : v * v * (3 - 2 * v); }

  // Each maker returns {caption, alpha, shade(px, py, t)} for pixel patterns (shade gives 0..1 at css pixel px, py),
  // or {caption, vector: true, render(ctx, t)} for patterns drawn with lines.
  var MAKERS = [
      function interference(cssW, cssH, rgb) {
        var n = rint(2, 4), lam = rnd(24, 40), k = TAU / lam, w = k * 24, src = [], i;
        var x0 = cssW * (cssW < 700 ? 0.82 : 0.8), spread = Math.min(cssH * 0.2, 110) * (n > 2 ? 1.6 : 1);
        for (i = 0; i < n; i++) src.push([x0 + (n > 2 ? rnd(-0.12, 0.12) * cssW : 0), n === 2 ? cssH / 2 + (i ? 1 : -1) * spread / 2 : rnd(0.2, 0.8) * cssH]);
        return { caption: ['', '', 'Two', 'Three', 'Four'][n] + '-source interference, drawn live.', alpha: 120,
          shade: function (px, py, t) {
            var s = 0, a = 0, j, r, amp;
            for (j = 0; j < n; j++) { r = Math.sqrt((px - src[j][0]) * (px - src[j][0]) + (py - src[j][1]) * (py - src[j][1])); amp = 1 / Math.sqrt(1 + r / 70); s += amp * Math.cos(k * r - w * t); a += amp; }
            return crest(s / a, 0.2);
          } };
      },
      function chladni(cssW, cssH, rgb) {
        var n = rint(2, 8), m = rint(2, 8); if (m === n) m += 1;
        var morph = rnd(0.25, 0.45), ph = rnd(0, TAU);
        return { caption: 'A standing-wave (Chladni) pattern, drawn live.', alpha: 130,
          shade: function (px, py, t) {
            var u = px / cssW * Math.PI, v = py / cssH * Math.PI, s = Math.cos(morph * t + ph);
            var f = Math.cos(n * u) * Math.cos(m * v) + s * Math.cos(m * u) * Math.cos(n * v);
            var q = f / 0.14; return Math.exp(-q * q);
          } };
      },
      function moire(cssW, cssH, rgb) {
        var k = TAU / rnd(7, 13), c1 = [cssW * rnd(0.6, 0.85), cssH * rnd(0.3, 0.7)], c2 = [cssW * rnd(0.6, 0.85), cssH * rnd(0.3, 0.7)], rad = rnd(18, 40), sp = rnd(0.2, 0.4), ep = rnd(0.015, 0.04);
        return { caption: 'Two sets of rings overlapping (moiré), drawn live.', alpha: 135,
          shade: function (px, py, t) {
            var x2 = c2[0] + rad * Math.cos(sp * t), y2 = c2[1] + rad * Math.sin(sp * t);
            var r1 = Math.sqrt((px - c1[0]) * (px - c1[0]) + (py - c1[1]) * (py - c1[1])), r2 = Math.sqrt((px - x2) * (px - x2) + (py - y2) * (py - y2));
            return crest(0.5 + 0.5 * Math.cos(k * r1) * Math.cos(k * r2 * (1 + ep)), 0.55);
          } };
      },
      function lattice(cssW, cssH, rgb) {
        var n = [3, 5, 7][rint(0, 2)], lam = rnd(26, 42), k = TAU / lam, rot = rnd(0, Math.PI), w = TAU * rnd(0.08, 0.16), kx = [], ky = [], i;
        for (i = 0; i < n; i++) { kx.push(k * Math.cos(rot + Math.PI * i / n)); ky.push(k * Math.sin(rot + Math.PI * i / n)); }
        var name = n === 3 ? 'Three' : n === 5 ? 'Five' : 'Seven';
        return { caption: name + ' plane waves crossing, drawn live.', alpha: 110,
          shade: function (px, py, t) {
            var s = 0, j; for (j = 0; j < n; j++) s += Math.cos(kx[j] * px + ky[j] * py - w * t);
            return crest(s / n * (n === 3 ? 1.9 : 1.6) , 0.45);
          } };
      },
      function zonePlate(cssW, cssH, rgb) {
        var c = [cssW * rnd(0.6, 0.85), cssH * rnd(0.25, 0.75)], lam = rnd(18, 34), kap = Math.PI / (lam * 300), w = TAU * rnd(0.12, 0.22);
        return { caption: 'A Fresnel zone plate, drawn live.', alpha: 105,
          shade: function (px, py, t) {
            var r2 = (px - c[0]) * (px - c[0]) + (py - c[1]) * (py - c[1]);
            return crest(Math.cos(kap * r2 - w * t), 0.25);
          } };
      },
      function doppler(cssW, cssH, rgb) {
        // A source moving at speed v (in units of the wave speed) to the left, drawn in the source's own frame.
        // Distances are in pixels and the wave speed is 20 px/s. The sound reaching a point left the source tau pixels-of-travel ago.
        var shock = Math.random() < 0.45, v = shock ? rnd(1.4, 2.3) : rnd(0.35, 0.8), om = TAU / rnd(26, 36), v2 = v * v, A = 1 - v2;
        var sx = cssW * (shock ? 0.42 : 0.6), sy = cssH * rnd(0.4, 0.6);
        return { caption: shock ? 'A shock wave: a source moving faster than its own waves, drawn live.' : 'The Doppler effect: waves from a moving source, drawn live.', alpha: 125,
          shade: function (px, py, t) {
            var a = px - sx, dy = py - sy, D = a * a * v2 + A * (a * a + dy * dy), q, t1, t2, s = 0, n = 0, f;
            if (!shock) {
              t1 = (Math.sqrt(D) - a * v) / A;
              f = crest(Math.cos(om * (20 * t - t1)), 0.2) * 1.6 / Math.sqrt(1 + t1 / 14);
              return f > 1 ? 1 : f;
            }
            if (D < 0) return 0;
            q = Math.sqrt(D); t1 = (-a * v + q) / A; t2 = (-a * v - q) / A;
            if (t1 > 0) { s += Math.cos(om * (20 * t - t1)); n++; }
            if (t2 > 0) { s += Math.cos(om * (20 * t - t2)); n++; }
            return n ? crest(s / 2, 0.15) : 0;
          } };
      },
      function beats(cssW, cssH, rgb) {
        var ang = rnd(0, Math.PI), lam = rnd(24, 36), k1 = TAU / lam, k2 = k1 * rnd(1.08, 1.16), w1 = TAU * 0.25, w2 = w1 * (k2 / k1) , ca = Math.cos(ang), sa = Math.sin(ang);
        return { caption: 'Beats: two waves of slightly different wavelength, drawn live.', alpha: 115,
          shade: function (px, py, t) {
            var x = px * ca + py * sa;
            return crest((Math.cos(k1 * x - w1 * t) + Math.cos(k2 * x - w2 * t)) / 2, 0.25);
          } };
      },
      function slits(cssW, cssH, rgb) {
        var two = Math.random() < 0.6, lam = rnd(20, 30), k = TAU / lam, w = k * 22, a = lam * rnd(0.9, 1.6), d = lam * rnd(3.2, 5), sx = cssW * 0.3, sy = cssH / 2;
        return { caption: two ? 'Double-slit diffraction, drawn live.' : 'Single-slit diffraction, drawn live.', alpha: 130,
          shade: function (px, py, t) {
            var dx = px - sx, dy = py - sy, r, sn, b, env, f;
            if (dx <= 0) return 0;
            r = Math.sqrt(dx * dx + dy * dy); sn = dy / r; b = Math.PI * a * sn / lam;
            env = Math.abs(b) < 1e-4 ? 1 : Math.sin(b) / b;
            f = env * (two ? Math.cos(Math.PI * d * sn / lam) : 1) * Math.cos(k * r - w * t);
            return crest(f * Math.sqrt(1 + 60 / (r + 1)) * 0.9, 0.2);
          } };
      },
      function spiral(cssW, cssH, rgb) {
        var m = rint(1, 4), lam = rnd(30, 46), k = TAU / lam, w = TAU * rnd(0.12, 0.2), cx = cssW * rnd(0.65, 0.85), cy = cssH * rnd(0.35, 0.65), dir = Math.random() < 0.5 ? 1 : -1;
        return { caption: (m === 1 ? 'A spiral wave' : m + '-armed spiral waves') + ', drawn live.', alpha: 115,
          shade: function (px, py, t) {
            var dx = px - cx, dy = py - cy, r = Math.sqrt(dx * dx + dy * dy);
            return crest(Math.cos(m * Math.atan2(dy, dx) * dir + k * r - w * t), 0.2);
          } };
      },
      function orbital(cssW, cssH, rgb) {
        // A hydrogen orbital (probability density) in a plane through the nucleus, slowly rotating.
        var O = [
          { n: '2p', f: function (r, c, s) { return r * Math.exp(-r / 2) * c; }, S: 5 },
          { n: '3s', f: function (r, c, s) { return (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3); }, S: 11 },
          { n: '3p', f: function (r, c, s) { return (6 - r) * r * Math.exp(-r / 3) * c; }, S: 11 },
          { n: '3d (z²)', f: function (r, c, s) { return r * r * Math.exp(-r / 3) * (3 * c * c - 1); }, S: 10 },
          { n: '3d (xz)', f: function (r, c, s) { return r * r * Math.exp(-r / 3) * c * s; }, S: 10 },
          { n: '4f', f: function (r, c, s) { return r * r * r * Math.exp(-r / 4) * c * (5 * c * c - 3); }, S: 18 }
        ];
        var o = O[rint(0, O.length - 1)], cx = cssW * rnd(0.7, 0.8), cy = cssH / 2, scale = Math.min(cssH * 0.46, 260) / o.S, spin = rnd(0.06, 0.12) * (Math.random() < 0.5 ? 1 : -1), mx = 0, i, j, x, y, p;
        function dens(dx, dy) { var r = Math.sqrt(dx * dx + dy * dy) + 1e-9, v = o.f(r, dy / r, dx / r); return v * v; }
        for (i = -30; i <= 30; i++) for (j = -30; j <= 30; j++) { p = dens(i / 30 * o.S, j / 30 * o.S); if (p > mx) mx = p; }
        return { caption: 'A hydrogen ' + o.n + ' orbital (probability density), drawn live.', alpha: 135,
          shade: function (px, py, t) {
            var a = spin * t, ca = Math.cos(a), sa = Math.sin(a), dx = (px - cx) / scale, dy = (py - cy) / scale, rx = dx * ca - dy * sa, ry = dx * sa + dy * ca;
            var q = Math.pow(dens(rx, ry) / mx, 0.6); return 1 - Math.exp(-q * 1.8);
          } };
      },
      function fieldLines(cssW, cssH, rgb) {
        var n = rint(2, 3), q = n === 2 ? [1, Math.random() < 0.5 ? 1 : -1] : [1, -1, 1], ch = [], i, M = rint(7, 12);
        for (i = 0; i < n; i++) ch.push({ x: cssW * rnd(0.55, 0.88), y: cssH * (0.2 + 0.6 * (i + 0.5) / n), q: q[i], ph: rnd(0, TAU), sp: rnd(0.12, 0.25), rad: rnd(14, 34) });
        var same = n === 2 && q[0] === q[1];
        return { caption: n === 2 ? (same ? 'Electric field lines of two like charges, drawn live.' : 'Electric field lines of a dipole, drawn live.') : 'Electric field lines of three charges, drawn live.', alpha: 125,
          shade: function (px, py, t) {
            var phi = 0, j, c, dx, dy, d2, near = 1;
            for (j = 0; j < n; j++) {
              c = ch[j]; dx = px - (c.x + c.rad * Math.cos(c.sp * t + c.ph)); dy = py - (c.y + c.rad * Math.sin(c.sp * t + c.ph));
              d2 = dx * dx + dy * dy; phi += c.q * Math.atan2(dy, dx); if (d2 < 400) near = Math.min(near, d2 / 400);
            }
            return crest(Math.cos(M * phi), 0.8) * near;
          } };
      },
      function earthMoon(cssW, cssH, rgb) {
        // Not to scale: the Moon's orbit is enlarged and sped up, but its speed stays below the Earth's, so its path round the Sun is a wavy line, not loops.
        var cx = cssW * (cssW < 700 ? 0.7 : 0.74), cy = cssH / 2, R = Math.min(cssH * 0.4, cssW * 0.2), n = rint(6, 10), r = R * rnd(0.6, 0.9) / n,
            PE = rnd(34, 46), dir = Math.random() < 0.5 ? 1 : -1, we = TAU / PE * dir, wm = we * n, ph0 = rnd(0, TAU), TR = 0.3 * PE, N = 150;
        function pos(tt) { var a = ph0 + we * tt, ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a), b = wm * tt; return [ex, ey, ex + r * Math.cos(b), ey + r * Math.sin(b)]; }
        function col(a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }
        return { caption: 'Earth and Moon orbiting the Sun (not to scale), drawn live.', vector: true,
          render: function (c, t) {
            var k, p0, p1, f, g;
            c.lineCap = 'round';
            c.strokeStyle = col(0.12); c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
            p0 = pos(t - TR);
            for (k = 1; k <= N; k++) {
              f = k / N; p1 = pos(t - TR * (1 - f));
              c.strokeStyle = col(0.45 * f * f); c.lineWidth = 1.4; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
              c.strokeStyle = col(0.7 * f * f); c.lineWidth = 1.1; c.beginPath(); c.moveTo(p0[2], p0[3]); c.lineTo(p1[2], p1[3]); c.stroke();
              p0 = p1;
            }
            g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.28); g.addColorStop(0, 'rgba(245,179,1,0.5)'); g.addColorStop(1, 'rgba(245,179,1,0)');
            c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 0.28, 0, TAU); c.fill();
            c.fillStyle = 'rgba(245,179,1,0.95)'; c.beginPath(); c.arc(cx, cy, 9, 0, TAU); c.fill();
            c.fillStyle = col(0.95); c.beginPath(); c.arc(p1[0], p1[1], 5, 0, TAU); c.fill();
            c.fillStyle = col(0.75); c.beginPath(); c.arc(p1[2], p1[3], 2.3, 0, TAU); c.fill();
          } };
      }
  ];

  function mount(cv, index) {
    var ctx = cv.getContext('2d'), img, W, H, cssW, cssH, rgb = [23, 106, 115], SCALE = 2, cur, t0 = performance.now(), last = 0,
        running = false, onScreen = true, dead = false, reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches, mo, io;

    function readColour() {
      var m = getComputedStyle(cv).color.match(/[\d.]+/g);
      if (m && m.length >= 3) rgb = [+m[0], +m[1], +m[2]];
    }
    function size() {
      cssW = cv.clientWidth; cssH = cv.clientHeight;
      W = Math.max(1, Math.round(cssW / SCALE)); H = Math.max(1, Math.round(cssH / SCALE));
      cv.width = W; cv.height = H; img = ctx.createImageData(W, H);
    }
    function setRes(vector) {            // vector patterns draw at device resolution, pixel patterns at half
      var s = vector ? 1 / Math.min(window.devicePixelRatio || 1, 2) : 2;
      if (s !== SCALE || !img) { SCALE = s; size(); }
    }
    function draw(t) {
      if (cur.render) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
        ctx.save(); ctx.scale(1 / SCALE, 1 / SCALE); cur.render(ctx, t); ctx.restore();
        return;
      }
      var d = img.data, i = 0, x, y, py, v, al = cur.alpha, sh = cur.shade;
      for (y = 0; y < H; y++) {
        py = y * SCALE;
        for (x = 0; x < W; x++, i += 4) {
          v = sh(x * SCALE, py, t);
          d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = v * al;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    function now() { return (performance.now() - t0) / 1000; }
    function make() { cur = MAKERS[index](cssW, cssH, rgb); setRes(!!cur.render); out.caption = cur.caption; t0 = performance.now(); draw(0); }
    function frame(ts) {
      if (!running) return;
      if (ts - last > 40) { last = ts; draw((ts - t0) / 1000); }
      requestAnimationFrame(frame);
    }
    function start() { if (dead || reduced || running || !onScreen || document.hidden) return; running = true; requestAnimationFrame(frame); }
    function stop() { running = false; }
    function onResize() {               // keep the same pattern unless the canvas has changed shape a lot
      var w0 = cssW, h0 = cssH; size();
      if (Math.abs(cssW - w0) > 0.08 * w0 || Math.abs(cssH - h0) > 0.08 * h0) make(); else draw(now());
    }
    function onVis() { document.hidden ? stop() : start(); }

    var out = {
      caption: '',
      reroll: function () { make(); },
      destroy: function () {
        dead = true; stop(); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis);
        if (mo) mo.disconnect(); if (io) io.disconnect();
      }
    };
    size(); readColour(); make();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);
    mo = new MutationObserver(function () { readColour(); if (!running) draw(now()); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; onScreen ? start() : stop(); }); io.observe(cv);
    }
    start();
    return out;
  }

  window.WavePatterns = { count: MAKERS.length, mount: mount };
})();
