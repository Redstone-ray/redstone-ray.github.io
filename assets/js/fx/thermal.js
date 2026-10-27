/*
  thermal.js — the portrait, seen through a pretend FLIR camera.
  FX.thermal.mount(figureEl, { src, alt }) -> { destroy(), toggle() }

  Base layer: the photo in black and white (slightly lifted contrast).
  Thermal layer: a heat field estimated from the photo itself
    skin -> hot, hair -> medium, clothing -> cool-medium, bright background -> cold,
    plus a soft warm halo around the face (from the skin mask's centroid),
    box-blurred for the smeared bolometer look, mapped through an ironbow palette,
    with the photo's fine detail blended back in (like FLIR's "MSX").
  Hover (fine pointer), click / tap, or the small toggle button switches modes.
  On file:// the canvas is tainted, so it falls back to CSS + SVG filters.
*/
(function () {
  'use strict';
  const FX = (window.FX = window.FX || {});

  const T_MIN = 22.0;
  const T_MAX = 35.5;
  const PROC_W = 360; // heat field resolution (width)
  const STYLE_ID = 'fx-thermal-style';

  // Ironbow-ish palette: black -> indigo -> violet -> magenta -> red -> orange -> yellow -> near white
  const STOPS = [
    [0.00, [0, 0, 6]],
    [0.07, [14, 6, 48]],
    [0.15, [38, 14, 96]],
    [0.27, [74, 18, 138]],
    [0.39, [124, 24, 150]],
    [0.50, [178, 33, 128]],
    [0.60, [220, 58, 72]],
    [0.70, [240, 104, 30]],
    [0.80, [249, 158, 28]],
    [0.90, [254, 214, 70]],
    [1.00, [255, 250, 226]]
  ];

  const CSS = `
.fxt{position:relative;display:block;width:100%;overflow:hidden;border-radius:var(--radius,2px);background:#d9d9d9;
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;cursor:crosshair;isolation:isolate}
.fxt>img,.fxt canvas,.fxt .fxt-img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover}
.fxt.is-on.is-hover{cursor:none}
.fxt-base{opacity:0;transition:opacity .5s ease}
.fxt.is-ready .fxt-base{opacity:1}
html[data-theme="filled"] .fxt-base,html[data-theme="filled"] .fxt-fb-base{filter:brightness(.9)}
html[data-theme="filled"] .fxt-fb-base{filter:grayscale(1) contrast(1.05) brightness(.9)}
.fxt-ir{position:absolute;inset:0;opacity:0;transition:opacity .4s cubic-bezier(.65,0,.35,1);pointer-events:none;background:#14082f}
.fxt.is-on .fxt-ir{opacity:1}
.fxt-hud{position:absolute;inset:0;font:400 11px/1.2 var(--font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);color:#fff;
  letter-spacing:.02em;text-shadow:0 1px 2px rgba(0,0,0,.55),0 0 1px rgba(0,0,0,.5);font-variant-numeric:tabular-nums}
.fxt-tl{position:absolute;left:12px;top:11px;display:flex;align-items:baseline;gap:6px}
.fxt-tl b{font-weight:500;font-size:13px}
.fxt-k{opacity:.72}
.fxt-bl{position:absolute;left:12px;bottom:13px;opacity:.9}
.fxt-scale{position:absolute;right:12px;top:11px;height:min(64%,360px);width:34px;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.fxt-bar{flex:1;width:7px;border:1px solid rgba(255,255,255,.85);box-shadow:0 0 0 1px rgba(0,0,0,.25);
  background:linear-gradient(to top,var(--fxt-grad))}
.fxt-x{position:absolute;left:0;top:0;width:0;height:0;opacity:0;transition:opacity .2s ease}
.fxt.has-x .fxt-x{opacity:1}
.fxt-x svg{position:absolute;left:-15px;top:-15px;width:30px;height:30px;max-width:none;overflow:visible}
.fxt-xt{position:absolute;left:14px;top:-22px;white-space:nowrap}
.fxt-x.is-flip .fxt-xt{left:auto;right:14px}
.fxt-x.is-low .fxt-xt{top:10px}
.fxt-btn{position:absolute;right:10px;bottom:10px;z-index:2;display:inline-flex;align-items:center;gap:7px;margin:0;
  padding:6px 9px 6px 8px;border:1px solid rgba(255,255,255,.22);border-radius:var(--radius,2px);
  background:rgba(12,10,9,.58);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#f3efe7;
  font:400 11px/1 var(--font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);letter-spacing:.02em;cursor:pointer;
  transition:background-color .2s ease,border-color .2s ease}
.fxt-btn::before{content:'';position:absolute;inset:-10px -6px}
.fxt-btn:hover{background:rgba(12,10,9,.78);border-color:rgba(255,255,255,.4)}
.fxt-btn:focus-visible{outline:2px solid var(--accent-night,var(--accent,#e8962c));outline-offset:2px}
.fxt-btn i{width:7px;height:7px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(243,239,231,.8);transition:background-color .25s ease,box-shadow .25s ease}
.fxt.is-on .fxt-btn i{background:#fdc23a;box-shadow:0 0 0 1px #fdc23a,0 0 8px rgba(253,194,58,.8)}
.fxt-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.fxt-fb-base{filter:grayscale(1) contrast(1.05)}
@media (prefers-reduced-motion: reduce){.fxt-base,.fxt-ir,.fxt-x,.fxt-btn,.fxt-btn i{transition:none}}
@media (max-width:640px){.fxt-tl{left:10px;top:9px}.fxt-bl{left:10px;bottom:12px}.fxt-scale{right:10px;top:9px}}
`;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  let LUT = null;
  function getLut() {
    if (LUT) return LUT;
    LUT = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let k = 1;
      while (k < STOPS.length - 1 && STOPS[k][0] < t) k++;
      const a = STOPS[k - 1], b = STOPS[k];
      const f = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
      const e = f * f * (3 - 2 * f) * 0.35 + f * 0.65; // slightly eased between stops
      for (let c = 0; c < 3; c++) LUT[i * 3 + c] = a[1][c] + (b[1][c] - a[1][c]) * e;
    }
    return LUT;
  }
  function paletteCss(n) {
    const lut = getLut();
    const out = [];
    for (let i = 0; i <= n; i++) {
      const j = Math.round((i / n) * 255) * 3;
      out.push(`rgb(${lut[j]},${lut[j + 1]},${lut[j + 2]}) ${((i / n) * 100).toFixed(1)}%`);
    }
    return out.join(',');
  }

  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  function ss(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  // Separable box blur with clamped edges. src/dst Float32Array, tmp scratch.
  function boxBlur(buf, tmp, w, h, r, passes) {
    const inv = 1 / (2 * r + 1);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        let acc = 0;
        for (let x = -r; x <= r; x++) acc += buf[row + (x < 0 ? 0 : x > w - 1 ? w - 1 : x)];
        for (let x = 0; x < w; x++) {
          tmp[row + x] = acc * inv;
          const ai = x + r + 1, ri = x - r;
          acc += buf[row + (ai > w - 1 ? w - 1 : ai)] - buf[row + (ri < 0 ? 0 : ri)];
        }
      }
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += tmp[(y < 0 ? 0 : y > h - 1 ? h - 1 : y) * w + x];
        for (let y = 0; y < h; y++) {
          buf[y * w + x] = acc * inv;
          const ai = y + r + 1, ri = y - r;
          acc += tmp[(ai > h - 1 ? h - 1 : ai) * w + x] - tmp[(ri < 0 ? 0 : ri) * w + x];
        }
      }
    }
  }

  // Cheap smooth value noise for a little wall-temperature variation.
  function makeNoise(seed) {
    let s = seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const G = 7, g = [];
    for (let i = 0; i < G * G; i++) g.push(rnd());
    return (u, v) => {
      const x = u * (G - 1), y = v * (G - 1);
      const x0 = Math.min(G - 2, Math.floor(x)), y0 = Math.min(G - 2, Math.floor(y));
      let fx = x - x0, fy = y - y0;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const a = g[y0 * G + x0], b = g[y0 * G + x0 + 1], c = g[(y0 + 1) * G + x0], d = g[(y0 + 1) * G + x0 + 1];
      return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    };
  }

  // Estimate a heat field (0..1) from RGBA pixels.
  function computeHeat(px, w, h) {
    const n = w * h;
    const skin = new Float32Array(n);
    const bgm = new Float32Array(n);
    const heat = new Float32Array(n);
    const blue = new Float32Array(n);
    const val = new Float32Array(n);
    const pale = new Float32Array(n); // bright, barely tinted pink/orange: lit skin, or nothing

    let sw = 0, sx = 0, sy = 0;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const r = px[p] / 255, g = px[p + 1] / 255, b = px[p + 2] / 255;
      const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const d = mx - mn;
      const v = mx, s = mx > 0 ? d / mx : 0;
      let hue = 0;
      if (d > 1e-6) {
        if (mx === r) hue = 60 * (((g - b) / d) % 6);
        else if (mx === g) hue = 60 * ((b - r) / d + 2);
        else hue = 60 * ((r - g) / d + 4);
        if (hue < 0) hue += 360;
      }
      const hueW = hue <= 42 ? 1 : hue < 58 ? 1 - (hue - 42) / 16 : hue > 325 ? Math.min(1, (hue - 325) / 15) : 0;
      // washed-out highlights on skin are barely saturated but still lean pink/orange;
      // the backdrop is just as pale but leans blue-grey
      const satW = ss(0.04, 0.1, s) * (1 - ss(0.64, 0.76, s));
      const valW = ss(0.2, 0.32, v);
      const sk = hueW * satW * valW;
      const bg = (1 - ss(0.07, 0.17, s)) * ss(0.52, 0.72, v) * (1 - sk);
      skin[i] = sk; bgm[i] = bg; val[i] = v;
      pale[i] = (hue >= 280 || hue <= 50 ? 1 : 0) * ss(0.02, 0.05, s) * ss(0.5, 0.65, v);
      blue[i] = (hue > 190 && hue < 265 ? 1 : 0) * ss(0.18, 0.34, s);
      if (sk > 0.45) { const y = (i / w) | 0; if (y < h * 0.82) { sw += sk; sx += sk * (i - y * w); sy += sk * y; } }
    }

    // Face: centroid + covariance of the confident skin pixels.
    let cx = w * 0.5, cy = h * 0.4, sxx = (w * 0.12) ** 2, syy = (h * 0.12) ** 2, sxy = 0;
    if (sw > 50) {
      cx = sx / sw; cy = sy / sw;
      let a = 0, b = 0, c = 0;
      for (let i = 0; i < n; i++) {
        const sk = skin[i];
        if (sk <= 0.45) continue;
        const y = (i / w) | 0; if (y >= h * 0.82) continue;
        const dx = i - y * w - cx, dy = y - cy;
        a += sk * dx * dx; b += sk * dy * dy; c += sk * dx * dy;
      }
      sxx = a / sw; syy = b / sw; sxy = c / sw;
    }
    // inverse covariance, inflated a little so the halo spills past the jaw
    const inf = 1.55 * 1.55;
    const A = sxx * inf, B = sxy * inf, C = syy * inf;
    const det = A * C - B * B || 1;
    const iA = C / det, iB = -B / det, iC = A / det;
    const faceR = Math.sqrt(Math.max(sxx, syy));

    const noise = makeNoise(0x5eed);
    const torsoX = cx, torsoY = cy + faceR * 3.2;
    const torsoS2 = (faceR * 3.0) ** 2;

    for (let i = 0; i < n; i++) {
      const y = (i / w) | 0, x = i - y * w;
      const u = x / w, v = y / h;
      const dx = x - cx, dy = y - cy;
      const m2 = dx * dx * iA + 2 * dx * dy * iB + dy * dy * iC; // squared Mahalanobis
      const face = Math.exp(-0.5 * m2);
      const core = 1 - ss(0.55, 1.25, m2);

      let sk = skin[i], bg = bgm[i];
      // strongly lit skin near the face washes out to almost white; the backdrop stays blue-grey
      if (bg > 0.05 && pale[i] > 0) {
        const p = pale[i] * (1 - ss(2.2, 4.5, m2));
        sk = Math.max(sk, p * 0.9); bg *= 1 - p;
      }
      // room: cool, faintly warmer near the ceiling, a little uneven
      const room = 0.115 + 0.03 * (1 - v) + 0.045 * (noise(u, v) - 0.5) + 0.02 * (1 - val[i]);
      // what is left once skin and background are explained: hair, eyes, sweater
      const tdx = x - torsoX, tdy = y - torsoY;
      const torso = Math.exp(-(tdx * tdx + tdy * tdy * 0.6) / (2 * torsoS2));
      const cloth = 0.27 + 0.17 * torso + 0.04 * blue[i] * torso;
      const hair = 0.4 + 0.32 * face; // thin hair over a warm head reads warmer
      const isBelowFace = ss(cy + faceR * 0.9, cy + faceR * 1.6, y);
      const other = hair + (cloth - hair) * Math.max(blue[i], isBelowFace);
      // shadowed skin (eye sockets, under the jaw, neck) runs warmer than highlights (nose tip)
      const skinHeat = 0.69 + 0.13 * ss(0.95, 0.45, val[i]) + 0.07 * Math.exp(-1.3 * m2);

      let hv = room * bg + (1 - bg) * (skinHeat * sk + other * (1 - sk));
      // inside the face, eyes / teeth / brows still read warm
      hv = Math.max(hv, (0.7 + 0.06 * face) * core * (1 - bg * 0.85));
      // the face core runs hottest; a soft radiant halo spills around the head
      hv += 0.12 * face * (1 - 0.6 * bg);
      heat[i] = hv;
    }

    const tmp = new Float32Array(n);
    boxBlur(heat, tmp, w, h, Math.max(2, Math.round(w / 72)), 3);

    let max = 0, maxI = 0, min = 1;
    for (let i = 0; i < n; i++) {
      let hv = heat[i];
      if (hv > 0.985) hv = 0.985 + (hv - 0.985) * 0.2;
      heat[i] = clamp01(hv);
      if (hv > max) { max = hv; maxI = i; }
      if (hv < min) min = hv;
    }
    const my = (maxI / w) | 0;
    return { heat, w, h, max, min, hot: { u: (maxI - my * w + 0.5) / w, v: (my + 0.5) / h } };
  }

  function heatToTemp(h) { return T_MIN + clamp01(h) * (T_MAX - T_MIN); }

  let uid = 0;

  FX.thermal = {
    mount(fig, opts = {}) {
      if (!fig) return { destroy() {}, toggle() {} };
      injectStyle();
      const id = ++uid;
      const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
      const hoverMQ = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : { matches: false };
      const oldImg = fig.querySelector('img');
      const src = opts.src || fig.getAttribute('data-src') || (oldImg && (oldImg.currentSrc || oldImg.src));
      const alt = opts.alt || fig.getAttribute('data-alt') || (oldImg && oldImg.alt) || 'Portrait';
      if (!src) return { destroy() {}, toggle() {} };

      let natW = (oldImg && oldImg.naturalWidth) || +(oldImg && oldImg.getAttribute('width')) || 883;
      let natH = (oldImg && oldImg.naturalHeight) || +(oldImg && oldImg.getAttribute('height')) || 1200;

      // ---- DOM -------------------------------------------------------------
      const stage = document.createElement('div');
      stage.className = 'fxt';
      stage.style.aspectRatio = natW + ' / ' + natH;
      stage.style.setProperty('--fxt-grad', paletteCss(12));
      stage.innerHTML =
        '<canvas class="fxt-base" role="img"></canvas>' +
        '<div class="fxt-ir" aria-hidden="true"><canvas class="fxt-heat"></canvas>' +
          '<div class="fxt-hud">' +
            '<div class="fxt-tl"><span class="fxt-k">max</span><b class="fxt-max">34.1</b><span>°C</span></div>' +
            '<div class="fxt-scale"><span class="fxt-smax"></span><i class="fxt-bar"></i><span class="fxt-smin"></span></div>' +
            '<div class="fxt-bl">RD-IR · ε 0.98</div>' +
            '<div class="fxt-x"><svg viewBox="-15 -15 30 30" aria-hidden="true">' +
              '<g fill="none" stroke-linecap="square">' +
                '<path d="M0-12V-4M0 4V12M-12 0H-4M4 0H12" stroke="rgba(0,0,0,.45)" stroke-width="3"/>' +
                '<path d="M0-12V-4M0 4V12M-12 0H-4M4 0H12" stroke="#fff" stroke-width="1.4"/>' +
                '<circle r="1.2" fill="#fff" stroke="rgba(0,0,0,.4)" stroke-width=".6"/>' +
              '</g></svg><span class="fxt-xt"></span></div>' +
          '</div></div>' +
        // a stable name ("thermal"); the state is aria-pressed, the visible ": on/off" is decoration
        '<button class="fxt-btn" type="button" aria-pressed="false"><i aria-hidden="true"></i><span>thermal<span class="fxt-state" aria-hidden="true">: off</span></span></button>' +
        '<span class="fxt-sr" aria-live="polite"></span>';
      const baseCv = stage.querySelector('.fxt-base');
      const heatCv = stage.querySelector('.fxt-heat');
      const ir = stage.querySelector('.fxt-ir');
      const btn = stage.querySelector('.fxt-btn');
      const btnState = btn.querySelector('.fxt-state');
      const live = stage.querySelector('.fxt-sr');
      const xh = stage.querySelector('.fxt-x');
      const xt = stage.querySelector('.fxt-xt');
      const maxEl = stage.querySelector('.fxt-max');
      stage.querySelector('.fxt-smax').textContent = T_MAX.toFixed(1);
      stage.querySelector('.fxt-smin').textContent = T_MIN.toFixed(1);
      baseCv.setAttribute('aria-label', alt);

      // ---- state -----------------------------------------------------------
      let destroyed = false;
      let img = null;
      let field = null;        // heat field
      let tainted = false;
      let renderedW = 0;
      let lastLum = null;      // luminance at display res (for detail)
      let thermalPainted = false;
      let on = false, pinned = false, hovering = false, hoverSuppressed = false;
      let xu = 0.5, xv = 0.4, hasPointer = false;
      let flickerT = 0, jitter = 0;
      let raf = 0, ro = null, resizeT = 0, idleH = 0;
      let visible = true, visIO = null, nearIO = null, loading = false;

      // ---- image + processing ----------------------------------------------
      function displaySize() {
        const r = stage.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(Math.min(natW, (r.width || 420) * dpr)));
        return { w, h: Math.max(1, Math.round(w * natH / natW)) };
      }

      function paintBase() {
        if (!img || tainted || destroyed) return;
        const { w, h } = displaySize();
        if (Math.abs(w - renderedW) < 2 && lastLum) return;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(img, 0, 0, w, h);
        let data;
        try { data = cx.getImageData(0, 0, w, h); } catch (e) { tainted = true; return; }
        const px = data.data;
        const lum = new Float32Array(w * h);
        for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
          // a portrait-friendly mono mix, then a gentle S-curve with a lifted floor
          let y = (0.32 * px[p] + 0.58 * px[p + 1] + 0.10 * px[p + 2]) / 255;
          lum[i] = y;
          y = y + 0.09 * Math.sin((y - 0.5) * Math.PI) * (1 - Math.abs(y - 0.5));
          y = 0.03 + y * 0.955;
          const o = y * 255;
          px[p] = px[p + 1] = px[p + 2] = o;
        }
        baseCv.width = w; baseCv.height = h;
        baseCv.getContext('2d').putImageData(data, 0, 0);
        lastLum = lum;
        renderedW = w;
        thermalPainted = false;
        if (on || field) paintThermal();
      }

      function computeField() {
        if (field || tainted || !img) return;
        const w = PROC_W, h = Math.round(PROC_W * natH / natW);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(img, 0, 0, w, h);
        let data;
        try { data = cx.getImageData(0, 0, w, h); } catch (e) { tainted = true; return; }
        field = computeHeat(data.data, w, h);
        maxEl.textContent = heatToTemp(field.max).toFixed(1);
        if (!hasPointer) { xu = field.hot.u; xv = field.hot.v; }
      }

      function paintThermal() {
        if (tainted || destroyed) return;
        computeField();
        if (!field || !lastLum || thermalPainted) return;
        const w = baseCv.width, h = baseCv.height, n = w * h;
        const { heat, w: fw, h: fh } = field;
        // the photo's fine detail (high-pass of luminance), added back on top like FLIR's MSX
        const lp = Float32Array.from(lastLum);
        boxBlur(lp, new Float32Array(n), w, h, Math.max(1, Math.round(w / 280)), 2);
        // bilinear lookup tables for upsampling the heat field
        const x0s = new Int32Array(w), wxs = new Float32Array(w);
        for (let x = 0; x < w; x++) {
          const fx = Math.min(fw - 1.001, Math.max(0, (x + 0.5) * fw / w - 0.5));
          x0s[x] = fx | 0; wxs[x] = fx - (fx | 0);
        }
        heatCv.width = w; heatCv.height = h;
        const ctx = heatCv.getContext('2d');
        const out = ctx.createImageData(w, h);
        const o = out.data;
        const lut = getLut();
        let seed = 0x2545f491; // a whisper of sensor grain
        for (let y = 0, i = 0; y < h; y++) {
          const fy = Math.min(fh - 1.001, Math.max(0, (y + 0.5) * fh / h - 0.5));
          const r0 = (fy | 0) * fw, r1 = r0 + fw, wy = fy - (fy | 0);
          for (let x = 0; x < w; x++, i++) {
            const x0 = x0s[x], wx = wxs[x];
            const a = heat[r0 + x0], b = heat[r0 + x0 + 1], c = heat[r1 + x0], d = heat[r1 + x0 + 1];
            const top = a + (b - a) * wx, bot = c + (d - c) * wx;
            const hv = top + (bot - top) * wy;
            let hp = lastLum[i] - lp[i];
            if (hp < 0) hp *= 0.8;
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const add = 74 * Math.tanh(hp * 4.2) + ((seed >>> 24) - 128) * 0.035;
            let j = Math.round((hv + hp * 0.04) * 255);
            j = (j < 0 ? 0 : j > 255 ? 255 : j) * 3;
            const p = i * 4;
            o[p] = lut[j] + add; o[p + 1] = lut[j + 1] + add; o[p + 2] = lut[j + 2] + add * 0.9; o[p + 3] = 255;
          }
        }
        ctx.putImageData(out, 0, 0);
        thermalPainted = true;
      }

      function sampleTemp(u, v) {
        if (!field) return null;
        const { heat, w, h } = field;
        const x = Math.min(w - 1.001, Math.max(0, u * w - 0.5));
        const y = Math.min(h - 1.001, Math.max(0, v * h - 0.5));
        const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
        const a = heat[y0 * w + x0], b = heat[y0 * w + x0 + 1];
        const c = heat[(y0 + 1) * w + x0], d = heat[(y0 + 1) * w + x0 + 1];
        return heatToTemp(a + (b - a) * fx + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy);
      }

      // ---- fallback (file://, tainted canvas) ------------------------------
      function buildFallback() {
        tainted = true;
        stage.classList.add('is-fallback');
        baseCv.remove();
        heatCv.remove();
        const baseImg = img.cloneNode();
        baseImg.className = 'fxt-img fxt-fb-base';
        baseImg.alt = alt;
        stage.insertBefore(baseImg, ir);
        // heat ~ (red - blue) + (darkness), blurred, then ironbow via a lookup table
        const lut = getLut();
        const tv = c => { const a = []; for (let i = 0; i <= 16; i++) a.push((lut[Math.round(i / 16 * 255) * 3 + c] / 255).toFixed(3)); return a.join(' '); };
        const fid = 'fxt-ironbow-' + id;
        const row = '1.622 -0.2625 -1.7265 0 0.48';
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
        svg.style.position = 'absolute';
        svg.innerHTML =
          `<filter id="${fid}" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">` +
          `<feColorMatrix type="matrix" values="${row} ${row} ${row} 0 0 0 1 0"/>` +
          '<feGaussianBlur stdDeviation="5" edgeMode="duplicate"/>' +
          `<feComponentTransfer><feFuncR type="table" tableValues="${tv(0)}"/><feFuncG type="table" tableValues="${tv(1)}"/><feFuncB type="table" tableValues="${tv(2)}"/></feComponentTransfer>` +
          '</filter>';
        stage.appendChild(svg);
        const irImg = img.cloneNode();
        irImg.className = 'fxt-img';
        irImg.alt = '';
        irImg.style.filter = `url(#${fid})`;
        ir.insertBefore(irImg, ir.firstChild);
        xt.style.display = 'none';
        stage.classList.add('is-ready');
      }

      // ---- view state ------------------------------------------------------
      function placeCrosshair() {
        raf = 0;
        const r = stage.getBoundingClientRect();
        xh.style.transform = `translate3d(${(xu * r.width).toFixed(1)}px,${(xv * r.height).toFixed(1)}px,0)`;
        xh.classList.toggle('is-flip', xu > 0.68);
        xh.classList.toggle('is-low', xv < 0.12);
        const t = sampleTemp(xu, xv);
        if (t != null) xt.textContent = (t + jitter).toFixed(1) + ' °C';
      }
      function schedule() { if (!raf) raf = requestAnimationFrame(placeCrosshair); }

      function setOn(next, announce) {
        next = !!next;
        if (next && !tainted) { paintThermal(); }
        if (next === on) return;
        on = next;
        stage.classList.toggle('is-on', on);
        stage.classList.toggle('has-x', on);
        btn.setAttribute('aria-pressed', String(on));
        btnState.textContent = on ? ': on' : ': off';
        if (on) { schedule(); startFlicker(); } else stopFlicker();
        if (announce) say();
      }
      function say() {
        live.textContent = on
          ? (field ? `Thermal view on. Warmest spot ${heatToTemp(field.max).toFixed(1)} °C, the room about ${heatToTemp(field.min + 0.03).toFixed(0)} °C.` : 'Thermal view on.')
          : 'Thermal view off.';
      }
      function sync(announce) { setOn(pinned || (hovering && !hoverSuppressed), announce); }

      function startFlicker() {
        if (reduce.matches || flickerT || tainted || !visible) return;
        flickerT = setInterval(() => {
          if (document.hidden) return;
          jitter = Math.max(-0.1, Math.min(0.1, jitter + (Math.random() - 0.5) * 0.1));
          schedule();
        }, 420);
      }
      function stopFlicker() { clearInterval(flickerT); flickerT = 0; jitter = 0; }

      function toggle(announce = true, at) {
        // a click while the hover preview is showing means "keep it on", not "off"
        // (and the button, which you can only reach by hovering, then works in one click)
        if (on && !pinned) {
          pinned = true;
          sync(false);
          if (announce) say();
          schedule();
          return;
        }
        const next = !on;
        pinned = next;
        if (!next && hovering) hoverSuppressed = true;
        if (next) hoverSuppressed = false;
        if (next && at) { xu = at.u; xv = at.v; hasPointer = true; }
        else if (next && !hovering && field) { xu = field.hot.u; xv = field.hot.v; }
        sync(announce);
        schedule();
      }

      // ---- events ----------------------------------------------------------
      function rel(e) {
        const r = stage.getBoundingClientRect();
        return { u: clamp01((e.clientX - r.left) / r.width), v: clamp01((e.clientY - r.top) / r.height) };
      }
      function onEnter(e) {
        if (e.pointerType === 'touch' || !hoverMQ.matches) return;
        hovering = true; hasPointer = true;
        stage.classList.add('is-hover');
        const p = rel(e); xu = p.u; xv = p.v;
        sync(false);
        schedule();
      }
      function onLeave(e) {
        if (e.pointerType === 'touch') return;
        hovering = false; hoverSuppressed = false;
        stage.classList.remove('is-hover');
        if (!pinned && field) { hasPointer = false; }
        sync(false);
      }
      function onMove(e) {
        if (e.pointerType === 'touch') return;
        if (!hovering && hoverMQ.matches) { onEnter(e); return; }
        const p = rel(e); xu = p.u; xv = p.v; hasPointer = true;
        if (on) schedule();
      }
      function onClick(e) {
        if (e.target.closest && e.target.closest('.fxt-btn')) return;
        toggle(true, rel(e));
      }
      function onBtn(e) { e.stopPropagation(); toggle(true); }

      stage.addEventListener('pointerenter', onEnter);
      stage.addEventListener('pointerleave', onLeave);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('click', onClick);
      btn.addEventListener('click', onBtn);

      // ---- load ------------------------------------------------------------
      function install() {
        if (destroyed) return;
        if (oldImg && oldImg.parentNode === fig) {
          fig.insertBefore(stage, oldImg);
          // keep the original <img> underneath while the canvas fades in
          oldImg.setAttribute('aria-hidden', 'true');
          oldImg.alt = '';
          stage.insertBefore(oldImg, stage.firstChild);
        } else {
          fig.insertBefore(stage, fig.firstChild);
        }
      }

      const im = new Image();
      im.decoding = 'async';
      im.onload = () => {
        if (destroyed) return;
        img = im;
        natW = im.naturalWidth || natW; natH = im.naturalHeight || natH;
        stage.style.aspectRatio = natW + ' / ' + natH;
        install();
        paintBase();
        if (tainted) { buildFallback(); }
        else {
          requestAnimationFrame(() => stage.classList.add('is-ready'));
          // the photo underneath can go once the B&W layer has faded in
          setTimeout(() => { if (!destroyed && oldImg && oldImg.parentNode === stage) oldImg.remove(); }, reduce.matches ? 0 : 650);
          const idle = window.requestIdleCallback || (cb => setTimeout(cb, 200));
          idleH = idle(() => { if (!destroyed) { computeField(); if (!hasPointer && field) { xu = field.hot.u; xv = field.hot.v; } } });
        }
        if ('ResizeObserver' in window) {
          ro = new ResizeObserver(() => {
            clearTimeout(resizeT);
            resizeT = setTimeout(() => { if (!tainted) { paintBase(); if (on) paintThermal(); } schedule(); }, 160);
          });
          ro.observe(stage);
        }
      };
      im.onerror = () => { /* leave the original <img> alone */ };

      // The portrait sits far below the fold: fetch the full file only when it gets
      // close (the page's own lazy <img> covers the view until then). If that <img>
      // already chose the full file, the request is shared, so go right away.
      function load() {
        if (loading || destroyed) return;
        loading = true;
        if (nearIO) { nearIO.disconnect(); nearIO = null; }
        im.src = src;
      }
      function sameFile(a, b) {
        try { return !!a && new URL(a, location.href).href === new URL(b, location.href).href; } catch (e) { return false; }
      }
      if (oldImg && sameFile(oldImg.currentSrc, src)) load();
      else if ('IntersectionObserver' in window) {
        nearIO = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) load(); }, { rootMargin: '600px 0px' });
        nearIO.observe(fig);
      } else load();

      // Off screen: no flicker timer, no crosshair frames.
      if ('IntersectionObserver' in window) {
        visIO = new IntersectionObserver(ents => {
          visible = ents[ents.length - 1].isIntersecting;
          if (!visible) { stopFlicker(); if (raf) { cancelAnimationFrame(raf); raf = 0; } }
          else if (on) { startFlicker(); schedule(); }
        });
        visIO.observe(fig);
      }

      return {
        toggle() { toggle(true); },
        destroy() {
          destroyed = true;
          clearTimeout(resizeT);
          stopFlicker();
          if (raf) cancelAnimationFrame(raf);
          if (idleH && window.cancelIdleCallback) window.cancelIdleCallback(idleH);
          if (ro) ro.disconnect();
          if (visIO) visIO.disconnect();
          if (nearIO) nearIO.disconnect();
          stage.removeEventListener('pointerenter', onEnter);
          stage.removeEventListener('pointerleave', onLeave);
          stage.removeEventListener('pointermove', onMove);
          stage.removeEventListener('click', onClick);
          btn.removeEventListener('click', onBtn);
          if (oldImg) { oldImg.removeAttribute('aria-hidden'); oldImg.alt = alt; }
          if (stage.parentNode) {
            if (oldImg) stage.parentNode.insertBefore(oldImg, stage);
            stage.remove();
          }
        }
      };
    }
  };
})();
