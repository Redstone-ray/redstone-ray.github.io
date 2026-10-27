/*
 * Viscous fingering (Saffman–Taylor) hero toy.
 *
 * A Hele-Shaw cell in a canvas: amber fluid is injected through a port and
 * pushes into a more viscous medium. The interface is unstable; fingers grow,
 * compete and tip-split into many-petalled blooms.
 *
 * Method: Laplacian (dielectric-breakdown) growth on a coarse grid.
 *   - potential φ = 0 inside the injected fluid, relaxing to 1 far away
 *     (weakly screened Laplace, so several blooms can share the plate);
 *     warm-started red-black SOR, a few sweeps per frame, per growing bloom.
 *   - every perimeter cell accumulates "fill" ∝ (φ − σ·κ)^η and becomes fluid
 *     when it reaches its own (slightly random) threshold: continuous noise
 *     reduction + a curvature (surface-tension) penalty → smooth fingers that
 *     widen and tip-split instead of DLA dust.
 *   - each bloom has an injection rate Q (cells/s) that the budget is spread
 *     over, so area grows like a syringe pump; pressing raises the pressure.
 * Rendering: per-cell tone from depth (veins), age and arrival time (growth
 * rings); then a 2× supersampled pass interpolates a blurred fill field into a
 * crisp sub-cell contour with a rim light. Upscaled bilinearly onto the canvas,
 * with a small JS-blurred "backlight" glow underneath and on top.
 *
 * API: FX.fingering.mount(el, {auto:true}) → { destroy(), reset(), inject(xFrac, yFrac) }
 */
(function () {
  'use strict';
  const FX = (window.FX = window.FX || {});

  const DEFAULTS = {
    screen: 40,        // screening length of the potential (cells)
    margin: 64,        // SOR box margin around a growing bloom (cells)
    sweeps: 6,         // red-black SOR sweeps per frame (per growing bloom)
    omega: 1.85,
    eta: 1.8,          // growth ∝ flux^η (sharper tips → thinner fingers)
    sigma: 0.07,       // surface tension (relative to the bloom's mean field)
    sigGrow: 0.35,     // σ ∝ (R/R0)^sigGrow: capillary length grows as the front slows
    R0: 10,
    diskR: 2.8,        // curvature estimator radius (cells)
    diagW: 0.35,       // weight of diagonal faces in the flux (cancels lattice bias)
    nine: 1,           // isotropic 9-point Laplacian
    noise: 0.6,        // temporal noise on growth weights
    thrJitter: 1.0,    // quenched, spatially correlated disorder in fill thresholds
    modeAmp: 0.1,      // per-bloom angular bias → every bloom unique
    kMin: 10, kMax: 14,
    envA: 1.2, envQ: 0.8,  // keep petals of similar length (angular envelope)
    drainBand: 0,      // optional fade width at the retreating front (fraction of growth time)
    fillRatio: 0.34,   // area / (π R²) of a typical bloom, to size targets (thin fingers: lots of gap)
    ringPeriod: 0.85,  // growth-ring period (s)
    glow: 0.06, halo: 0.12,
    // tone map (0 = deep vein … 0.6 = accent … 0.86 = tip … 1 = hot)
    al0: 0.36, al1: 0.47, rimEnd: 0.86, v0: 0.74,
    base: 0.7, rim: 0.19, fresh: 0.09, vein: 0.22, core: 0.2, ring: 0.05
  };

  const LIFE = 40;        // s before a bloom relaxes
  const DRAIN = 3.2;      // s to drain
  const MAX_LIVE = 5;
  const SLOTS = 8;
  const SECT = 48;        // angular sectors for the bloom envelope
  const GLOW_DIV = 3;     // glow buffer is 1/3 of the grid
  const M = 20;           // off-screen margin (cells): petals run out of frame instead of hitting a wall
  const CAP = 0.30;       // max filled fraction of the plate
  const TAU_UP = 0.22;    // pressure build-up
  const TAU_DOWN = 0.95;  // pressure decay after release
  const TAP_S = 1.5;      // a tap injects for this long
  const LABEL = 'Interactive simulation of viscous fingering: press and hold to inject fluid';

  /* ---------------- colour ---------------- */
  function parseColor(s) {
    s = (s || '').trim();
    let m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
      const n = parseInt(h.slice(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
    if (m) return [+m[1], +m[2], +m[3]].map(v => Math.max(0, Math.min(255, Math.round(v))));
    return null;
  }
  function rgb2hsl(c) {
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d > 1e-6) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // Palette ramp (dark vein → accent → bright tip). For the default amber
  // #e8962c this lands on tips ≈ #ffd36a and veins ≈ #7a3404.
  function buildPalette(acc) {
    const [h, s, l] = rgb2hsl(acc);
    // Saturated amber (blue channel ~0 in the fluid).
    const tip = hsl2rgb(h + 10, Math.min(1, s * 1.3), Math.min(0.66, l + 0.08));
    const hot = hsl2rgb(h + 16, Math.min(1, s * 1.3), Math.min(0.78, l + 0.2));
    const vein = hsl2rgb(h - 9.4, Math.min(1, s * 1.17), l * 0.457);
    const deep = hsl2rgb(h - 12, Math.min(1, s * 1.1), l * 0.25);
    const stops = [[0, deep], [0.3, vein], [0.6, acc], [0.84, tip], [1, hot]];
    const lut = new Uint32Array(256);
    for (let k = 0; k < 256; k++) {
      const t = k / 255;
      let j = 0; while (j < stops.length - 2 && t > stops[j + 1][0]) j++;
      const a = stops[j], b = stops[j + 1], u = (t - a[0]) / (b[0] - a[0]);
      const c = mix(a[1], b[1], Math.max(0, Math.min(1, u)));
      lut[k] = ((Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
    }
    const gl = mix(tip, acc, 0.35);
    return { lut, tip, vein, acc, glow: ((Math.round(gl[2]) << 16) | (Math.round(gl[1]) << 8) | Math.round(gl[0])) >>> 0 };
  }

  /* ---------------- styles for the keyboard affordance ---------------- */
  function injectStyle() {
    if (document.getElementById('fx-fingering-style')) return;
    const st = document.createElement('style');
    st.id = 'fx-fingering-style';
    st.textContent =
      '.fxf-key{position:absolute;right:var(--gutter,24px);top:88px;z-index:3;margin:0;' +
      'font:500 11px/1 var(--font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);letter-spacing:.08em;' +
      'text-transform:uppercase;color:#f3efe7;background:rgba(5,4,3,.78);border:1px solid rgba(243,239,231,.2);' +
      'border-radius:999px;padding:9px 14px;cursor:pointer;opacity:0;pointer-events:none;' +
      'transform:translateY(4px);transition:opacity .2s,transform .2s}' +
      '.fxf-key:focus-visible{opacity:1;pointer-events:auto;transform:none;' +
      'outline:2px solid var(--accent-night,var(--accent,#e8962c));outline-offset:2px}' +
      '.fxf-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;' +
      'clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;text-transform:none}' +
      '@media (prefers-reduced-motion:reduce){.fxf-key{transition:none}}';
    document.head.appendChild(st);
  }

  /* ======================================================================= */
  function mount(el, opts) {
    opts = opts || {};
    const PR = Object.assign({}, DEFAULTS, opts.params || {});
    const auto = opts.auto !== false;
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reduced = !!(mq && mq.matches);

    /* ---------- DOM ---------- */
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.touchAction = 'pan-y';
    const canvas = document.createElement('canvas');
    canvas.className = 'fx-fingering';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', LABEL);
    const cs = canvas.style;
    cs.position = 'absolute'; cs.left = cs.top = '0'; cs.width = cs.height = '100%';
    cs.display = 'block'; cs.touchAction = 'pan-y'; cs.userSelect = 'none';
    cs.webkitUserSelect = 'none'; cs.webkitTapHighlightColor = 'transparent';
    el.insertBefore(canvas, el.firstChild);
    const ctx = canvas.getContext('2d');
    const low = document.createElement('canvas');
    const lctx = low.getContext('2d');
    const glow = document.createElement('canvas');
    const gctx = glow.getContext('2d');

    injectStyle();
    const keyBtn = document.createElement('button');
    keyBtn.type = 'button';
    keyBtn.className = 'fxf-key';
    // accessible name = the visible text + a hidden how-to (no aria-label, so the two never disagree)
    keyBtn.textContent = 'hold space · grow a flower';
    const keySr = document.createElement('span');
    keySr.className = 'fxf-sr';
    keySr.textContent = ' (Space or Enter; hold to keep injecting)';
    keyBtn.appendChild(keySr);
    el.appendChild(keyBtn);

    /* ---------- state ---------- */
    let cssW = 0, cssH = 0, dpr = 1, cell = 4, W = 0, H = 0, N = 0, S = 800;
    let fl, fill, phi, tA, thr, bias, pR, pSec, b1, b2, tmp, brA, amA, pList, inP, pW, pOwn, inner, conv, convK;
    let imgData = null, px32 = null, gImg = null, g32 = null, gA = null, gB = null, lastG = null, Nvis = 1;
    let disk = null, diskN = 0, f0 = 0.4, nb8 = null, lo = 6;
    const nbN = PR.diagW > 0 ? 8 : 4;
    const sortBuf = new Float32Array(SECT);
    let pN = 0, fluidCount = 0;
    const slots = new Array(SLOTS + 1).fill(null);
    let simT = 0, lastWall = 0, raf = 0, idleTimer = 0, running = false;
    let inView = true, docVisible = !document.hidden, destroyed = false;
    // inView = on screen per the IntersectionObserver AND not covered by the project overlay
    const rootEl = document.documentElement;
    let ioVisible = true, overlayOpen = rootEl.classList.contains('pv-open');
    // the site's own motion switch: no auto blooms, loop only runs while the user pushes
    let motionOff = rootEl.classList.contains('motion-off');
    if (overlayOpen) inView = false;
    let pal = buildPalette([232, 150, 44]);
    let dirty = true, lastRegion = null, lastActivityT = -1e9;
    let autoQueue = [];
    let rmJobs = [], rmBusy = false;
    const stats = { sim: 0, render: 0, frames: 0, simAvg: 0, renderAvg: 0, fluid: 0, perim: 0, blooms: 0 };
    // per-slot render params
    const sT0 = new Float32Array(SLOTS + 1), sInvSpan = new Float32Array(SLOTS + 1),
      sAlpha = new Float32Array(SLOTS + 1), sCut = new Float32Array(SLOTS + 1),
      sInvBand = new Float32Array(SLOTS + 1), sDrain = new Uint8Array(SLOTS + 1);

    // The hero is always dark, so prefer the scent's night accent (bright enough on
    // #050403 in either page theme); fall back to the page accent.
    function readAccent() {
      let c = null;
      try {
        const cs = getComputedStyle(document.documentElement);
        const s = cs.getPropertyValue('--accent-night').trim() || cs.getPropertyValue('--accent');
        c = parseColor(s);
      } catch (e) { c = null; }
      pal = buildPalette(c || [232, 150, 44]);
      dirty = true;
    }

    /* ---------- grid ---------- */
    function pickCell(w, h) {
      // ~100k cells on a laptop hero; finer cells on phones so small blooms still finger
      const c = Math.sqrt((w * h) / 98000);
      return Math.max(2.5, Math.min(5, Math.round(c * 4) / 4));
    }
    function alloc(w, h) {
      W = Math.ceil(w / cell) + 1 + 2 * M; H = Math.ceil(h / cell) + 1 + 2 * M; N = W * H;
      Nvis = (W - 2 * M) * (H - 2 * M);
      fl = new Uint8Array(N); fill = new Float32Array(N); phi = new Float32Array(N).fill(1);
      tA = new Float32Array(N); thr = new Float32Array(N); bias = new Float32Array(N).fill(1);
      pR = new Float32Array(N); pSec = new Uint8Array(N);
      b1 = new Float32Array(N); b2 = new Float32Array(N); tmp = new Float32Array(N);
      brA = new Float32Array(N); amA = new Float32Array(N);
      pList = new Int32Array(N); inP = new Int32Array(N); pW = new Float32Array(N); pOwn = new Uint8Array(N);
      conv = new Int32Array(N); convK = new Int32Array(N); inner = new Uint8Array(N);
      // quenched disorder, spatially correlated over a few cells (plate roughness)
      for (let i = 0; i < N; i++) b1[i] = Math.random();
      boxBlurAll(b1, b2, 2); boxBlurAll(b2, b1, 2);
      let mu = 0, va = 0;
      for (let i = 0; i < N; i++) mu += b1[i]; mu /= N;
      for (let i = 0; i < N; i++) { const d = b1[i] - mu; va += d * d; }
      const sd = Math.sqrt(va / N) || 1;
      for (let i = 0; i < N; i++) thr[i] = 1 + PR.thrJitter * 0.5 * Math.max(-2, Math.min(2, (b1[i] - mu) / sd));
      b1.fill(0); b2.fill(0);
      // curvature disk
      const R = PR.diskR, Ri = Math.ceil(R), offs = []; let below = 0;
      for (let dy = -Ri; dy <= Ri; dy++) for (let dx = -Ri; dx <= Ri; dx++) {
        if (dx * dx + dy * dy <= R * R) { offs.push(dy * W + dx); if (dy <= -1) below++; }
      }
      disk = new Int32Array(offs); diskN = offs.length; f0 = below / diskN;
      nb8 = new Int32Array([-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1]);
      lo = Ri + 2;
      for (let y = lo; y < H - lo; y++) for (let x = lo; x < W - lo; x++) inner[y * W + x] = 1;
      low.width = W * 2; low.height = H * 2;
      imgData = lctx.createImageData(W * 2, H * 2);
      px32 = new Uint32Array(imgData.data.buffer);
      glow.width = Math.max(1, Math.ceil(W / GLOW_DIV)); glow.height = Math.max(1, Math.ceil(H / GLOW_DIV));
      gImg = gctx.createImageData(glow.width, glow.height); g32 = new Uint32Array(gImg.data.buffer);
      gA = new Float32Array(glow.width * glow.height); gB = new Float32Array(glow.width * glow.height);
      pN = 0; fluidCount = 0; lastRegion = null; lastG = null;
    }

    function addP(i, o) {
      if (inP[i] || fl[i] || !inner[i]) return;
      pList[pN] = i; inP[i] = ++pN;
      const b = slots[o];
      if (b) {
        const x = i % W, y = (i / W) | 0, th = Math.atan2(y - b.sy, x - b.sx);
        bias[i] = angBias(b, th);
        pR[i] = Math.hypot(x - b.sx, y - b.sy);
        pSec[i] = Math.min(SECT - 1, ((th + Math.PI) / (2 * Math.PI)) * SECT | 0);
      }
    }
    function removeP(i) {
      const k = inP[i]; if (!k) return;
      const last = pList[--pN];
      pList[k - 1] = last; inP[last] = k; inP[i] = 0;
    }
    function rebuildPerimeter() {
      pN = 0; inP.fill(0);
      for (let i = 0; i < N; i++) {
        if (fl[i] || !inner[i]) continue;
        let o = 0;
        for (let k = 0; k < nbN; k++) { const f = fl[i + nb8[k]]; if (f) { o = f; break; } }
        if (o) addP(i, o); else if (fill[i] > 0) fill[i] = 0;
      }
    }
    function angBias(b, th) {
      let v = 1; const m = b.modes;
      for (let k = 0; k < m.length; k += 3) v += m[k + 1] * Math.cos(m[k] * th + m[k + 2]);
      return v;
    }

    /* ---------- blooms ---------- */
    function liveBlooms() { const a = []; for (let s = 1; s <= SLOTS; s++) { const b = slots[s]; if (b && !b.draining) a.push(b); } return a; }
    function oldest(list, exclude) {
      let best = null;
      for (const b of list) if (b !== exclude && !b.held && (!best || b.t0 < best.t0)) best = b;
      return best;
    }

    function seed(cx, cy, cfg) {
      cfg = cfg || {};
      cx = Math.max(M, Math.min(W - M - 1, Math.round(cx)));
      cy = Math.max(M, Math.min(H - M - 1, Math.round(cy)));
      const live = liveBlooms();
      if (live.length >= MAX_LIVE) { const o = oldest(live); if (o) startDrain(o); }
      let id = 0;
      for (let s = 1; s <= SLOTS; s++) if (!slots[s]) { id = s; break; }
      if (!id) { // all slots busy: finish the most drained one now
        let best = null;
        for (let s = 1; s <= SLOTS; s++) { const b = slots[s]; if (b.draining && (!best || b.drainT0 < best.drainT0)) best = b; }
        if (!best) return null;
        removeBloom(best); id = best.id;
      }
      const modes = [];
      const nm = 3;
      for (let k = 0; k < nm; k++) modes.push(PR.kMin + Math.floor(Math.random() * (PR.kMax - PR.kMin + 1)), PR.modeAmp * (0.4 + 0.6 * Math.random()), Math.random() * 6.283);
      const b = {
        id, sx: cx, sy: cy, t0: simT, tMax: simT, area: 0, Q: 0, pressure: 0, held: false, holdT: 0,
        holdUntil: 0, lastBoostT: simT, autoTarget: cfg.target || 0, autoT: cfg.T || 6, kind: cfg.kind || null,
        draining: false, drainT0: 0, alpha: 1, x0: cx, y0: cy, x1: cx, y1: cy, gref: 0.5,
        sig: PR.sigma * (0.85 + 0.3 * Math.random()), modes, lastGrowT: simT,
        sect: new Float32Array(SECT).fill(3), rEnv: 3
      };
      slots[id] = b;
      const r0 = 2.6, ri = 3;
      for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy); if (d > r0) continue;
        const i = (cy + dy) * W + cx + dx;
        const f = fl[i];
        if (f && f !== id) { const ob = slots[f]; if (ob && !ob.draining) continue; if (ob) ob.area--; fluidCount--; }
        if (f === id) continue;
        removeP(i);
        fl[i] = id; fill[i] = 1; phi[i] = 0; tA[i] = simT - 0.3 * (1 - d / r0); b.area++; fluidCount++;
      }
      for (let dy = -ri - 1; dy <= ri + 1; dy++) for (let dx = -ri - 1; dx <= ri + 1; dx++) {
        const i = (cy + dy) * W + cx + dx;
        if (fl[i]) continue;
        for (let k = 0; k < nbN; k++) if (fl[i + nb8[k]] === id) { addP(i, id); break; }
      }
      b.x0 = cx - ri; b.x1 = cx + ri; b.y0 = cy - ri; b.y1 = cy + ri;
      // relax the field around the new seed so the first frames are sensible
      solveBox(b, 8);
      dirty = true;
      return b;
    }

    function startDrain(b) {
      if (!b || b.draining) return;
      if (reduced) { removeBloom(b); rebuildPerimeter(); dirty = true; return; }
      b.draining = true; b.drainT0 = simT; b.held = false; b.pressure = 0; b.Q = 0;
      b.userDrain = motionOff; // with motion off, only a press can start a drain: let it finish
      // empty the partially-filled perimeter of this bloom
      for (let k = 0; k < pN; k++) {
        const i = pList[k];
        for (let j = 0; j < 8; j++) if (fl[i + nb8[j]] === b.id) { fill[i] = 0; break; }
      }
      wake();
    }
    function removeBloom(b) {
      const id = b.id;
      for (let y = Math.max(0, b.y0 - 1); y <= Math.min(H - 1, b.y1 + 1); y++) {
        for (let x = Math.max(0, b.x0 - 1), i = y * W + x; x <= Math.min(W - 1, b.x1 + 1); x++, i++) {
          if (fl[i] === id) { fl[i] = 0; fill[i] = 0; phi[i] = 0.5; fluidCount--; }
        }
      }
      slots[id] = null;
      dirty = true;
    }
    function drainStep(b) {
      const p = Math.min(1, (simT - b.drainT0) / DRAIN);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
      const span = Math.max(0.05, b.tMax - b.t0 + 0.3);
      b.cut = b.t0 - 0.3 + span * (1 - e);
      b.band = span * PR.drainBand;
      b.alpha = 1 - 0.4 * e * e;
      const id = b.id, cut = b.cut;
      for (let y = b.y0; y <= b.y1; y++) {
        for (let x = b.x0, i = y * W + x; x <= b.x1; x++, i++) {
          if (fl[i] === id && tA[i] > cut) { fl[i] = 0; fill[i] = 0; phi[i] = 0.5; fluidCount--; b.area--; }
        }
      }
      if (p >= 1) { removeBloom(b); rebuildPerimeter(); onBloomGone(b); }
      dirty = true;
    }

    function findBloomAt(cx, cy) {
      cx = Math.round(cx); cy = Math.round(cy);
      let best = null, bd = 1e9;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const f = fl[y * W + x];
        if (f && slots[f] && !slots[f].draining) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = slots[f]; } }
      }
      if (best) return best;
      // inside the "hull" of a bloom (between petals, near its port)
      for (const b of liveBlooms()) {
        const r = 0.5 * Math.max(b.x1 - b.x0, b.y1 - b.y0);
        const d = Math.hypot(cx - b.sx, cy - b.sy);
        if (d < Math.max(6, r * 0.55)) return b;
      }
      return null;
    }

    /* ---------- physics ---------- */
    function solveBox(b, sweeps) {
      const mg = PR.margin;
      const x0 = Math.max(1, b.x0 - mg), x1 = Math.min(W - 2, b.x1 + mg);
      const y0 = Math.max(1, b.y0 - mg), y1 = Math.min(H - 2, b.y1 + mg);
      const s = 1 / (PR.screen * PR.screen), inv = 1 / (4 + s), om = PR.omega;
      const nine = PR.nine, s6 = 6 * s, inv9 = 1 / (20 + s6);
      for (let k = 0; k < sweeps; k++) {
        for (let c = 0; c < 2; c++) {
          for (let y = y0; y <= y1; y++) {
            const row = y * W;
            for (let x = x0 + ((x0 + y + c) & 1), i = row + x; x <= x1; x += 2, i += 2) {
              if (fl[i] !== 0) continue;
              const v = nine
                ? (4 * (phi[i - 1] + phi[i + 1] + phi[i - W] + phi[i + W]) + phi[i - W - 1] + phi[i - W + 1] + phi[i + W - 1] + phi[i + W + 1] + s6) * inv9
                : (phi[i - 1] + phi[i + 1] + phi[i - W] + phi[i + W] + s) * inv;
              phi[i] += om * (v - phi[i]);
            }
          }
        }
      }
    }

    function updateRates(dt) {
      const Qhold = (0.014 * S * S) / (cell * cell);
      const Amax = 0.16 * Nvis;
      let anyHeld = false;
      for (let s = 1; s <= SLOTS; s++) {
        const b = slots[s]; if (!b || b.draining) continue;
        let Q = 0;
        // motion off: auto blooms stop feeding (except while precomputing the static bloom)
        if (b.autoTarget > 0 && (!motionOff || rmBusy)) {
          // syringe-pump schedule: feed-forward rate + gentle correction
          // constant flow, easing off over the last quarter
          const T = b.autoT, t = (simT - b.t0) / T;
          if (t < 1.15) {
            const r0 = b.autoTarget / (0.875 * T), tc = Math.min(1, Math.max(0, t));
            const goal = tc < 0.75 ? r0 * tc * T : r0 * T * (0.75 + (tc - 0.75) * (1 - (tc - 0.75) * 2));
            const rate = tc < 0.75 ? r0 : r0 * Math.max(0, (1 - tc) * 4);
            Q += Math.max(0, Math.min(rate * 2 + 40, rate + (goal - b.area) * 1.5));
          }
        }
        const pushing = b.held || simT < b.holdUntil;
        if (pushing) {
          b.pressure += (1 - b.pressure) * (1 - Math.exp(-dt / TAU_UP));
          b.holdT += dt; b.lastBoostT = simT; anyHeld = true;
        } else {
          b.pressure *= Math.exp(-dt / TAU_DOWN);
          if (b.pressure < 0.01) { b.pressure = 0; b.holdT = 0; }
        }
        Q += Qhold * b.pressure * (1 + Math.min(1.4, b.holdT * 0.5));
        if (b.area > Amax) Q = 0;
        b.Q = Q;
      }
      if (reduced) return;
      // lifetime & plate capacity (with motion off nothing ages out on its own)
      for (let s = 1; s <= SLOTS && !motionOff; s++) {
        const b = slots[s];
        if (b && !b.draining && !b.held && simT > b.holdUntil && simT - Math.max(b.t0, b.lastBoostT) > LIFE) startDrain(b);
      }
      if (fluidCount > CAP * Nvis) {
        let draining = false;
        for (let s = 1; s <= SLOTS; s++) if (slots[s] && slots[s].draining) draining = true;
        if (!draining) { const o = oldest(liveBlooms()); if (o) startDrain(o); }
      }
      return anyHeld;
    }

    function grow(dt) {
      const eta = PR.eta, noise = PR.noise, dW = PR.diagW;
      for (let s = 1; s <= SLOTS; s++) {
        const b = slots[s]; if (!b) continue;
        b.sw = 0; b.sphi = 0; b.np = 0;
        if (b.draining || b.Q <= 0) continue;
        const R = Math.sqrt(b.area / (Math.PI * 0.5));
        b.sigEff = b.sig * b.gref * Math.pow(Math.max(1, R / PR.R0), PR.sigGrow);
        sortBuf.set(b.sect); sortBuf.sort();
        b.rEnv = Math.max(4, sortBuf[Math.min(SECT - 1, (PR.envQ * SECT) | 0)]);
        b.invEnv = 1 / b.rEnv;
        if (b.avoid) {
          const z = keepOut(); b.ax = (z[0] * cssW) / cell + M; b.ay = (z[1] * cssH) / cell + M;
          // a seed inside the zone means the zone is stale (e.g. fonts still loading): ignore it
          b.avoidOn = !(b.sx < b.ax && b.sy > b.ay - 6);
        }
      }
      const envA = PR.envA;
      // pass 1: weights. Finite-volume flux through the faces shared with
      // fluid (4-neighbours), with a curvature (surface tension) correction.
      for (let k = 0; k < pN; k++) {
        const i = pList[k];
        pOwn[k] = 0;
        let o = 0, bad = false, nf = 0;
        for (let j = 0; j < 8; j++) {
          const f = fl[i + nb8[j]];
          if (f) { nf += j < 4 ? 1 : dW; if (!o) o = f; else if (f !== o) { bad = true; break; } }
        }
        if (!nf || bad) continue;
        const b = slots[o];
        if (!b || b.draining || b.Q <= 0) continue;
        let sum = 0;
        for (let j = 0; j < diskN; j++) sum += fill[i + disk[j]];
        const kap = f0 - sum / diskN;
        const ph = phi[i];
        b.sphi += ph; b.np++;
        let w = ph - b.sigEff * kap;
        if (w <= 0) continue;
        w = Math.pow(nf * w, eta) * bias[i] * (1 - noise * 0.5 + noise * Math.random());
        const over = pR[i] * b.invEnv - 1;
        if (over > 0) w *= Math.exp(-envA * over);
        if (b.avoidOn) {
          // auto blooms flow around the headline (bottom-left): soft keep-out
          const dIn = Math.min(b.ax - (i % W), ((i / W) | 0) - b.ay);
          if (dIn > -12) w *= 1 / (1 + Math.exp((dIn + 4) / 2.2));
        }
        pW[k] = w; pOwn[k] = o; b.sw += w;
      }
      // pass 2: fill increments
      let nc = 0;
      for (let k = 0; k < pN; k++) {
        const o = pOwn[k]; if (!o) continue;
        const b = slots[o];
        const i = pList[k];
        let inc = b.Q * dt * pW[k] / b.sw;
        if (inc > 0.7) inc = 0.7;
        fill[i] += inc;
        if (fill[i] >= thr[i]) { conv[nc] = i; convK[nc++] = k; }
      }
      // pass 3: conversions
      for (let c = 0; c < nc; c++) {
        const i = conv[c];
        if (fl[i]) continue;
        const o = pOwn[convK[c]];
        const b = slots[o]; if (!b) continue;
        removeP(i);
        fl[i] = o; fill[i] = 1; phi[i] = 0; tA[i] = simT; b.area++; fluidCount++;
        b.tMax = simT; b.lastGrowT = simT;
        const x = i % W, y = (i / W) | 0;
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
        if (pR[i] > b.sect[pSec[i]]) b.sect[pSec[i]] = pR[i];
        for (let j = 0; j < nbN; j++) addP(i + nb8[j], o);
      }
      for (let s = 1; s <= SLOTS; s++) { const b = slots[s]; if (b && b.np > 4) b.gref = b.gref * 0.7 + 0.3 * (b.sphi / b.np); }
      return nc;
    }

    function step(dt) {
      updateRates(dt);
      let growing = false;
      for (let s = 1; s <= SLOTS; s++) {
        const b = slots[s]; if (!b) continue;
        if (b.draining) { drainStep(b); continue; }
        if (b.Q > 0.5) growing = true;
      }
      if (growing) {
        // sub-step so that no perimeter is asked to absorb too much per step
        // (otherwise every cell saturates and growth degenerates to a blob)
        let need = 1;
        for (let s = 1; s <= SLOTS; s++) {
          const b = slots[s]; if (!b || b.draining || b.Q <= 0.5) continue;
          need = Math.max(need, (b.Q * dt) / (0.1 * Math.max(8, b.np || 8)));
        }
        const sub = Math.max(1, Math.min(10, Math.ceil(need)));
        // share a sweep budget when several blooms grow at once (fields are warm-started)
        let ng = 0;
        for (let s = 1; s <= SLOTS; s++) { const b = slots[s]; if (b && !b.draining && b.Q > 0.5) ng++; }
        const perBloom = ng > 2 ? Math.max(2, Math.round((PR.sweeps * 2) / ng)) : PR.sweeps;
        const sw = Math.max(1, Math.round(perBloom / sub));
        for (let k = 0; k < sub; k++) {
          for (let s = 1; s <= SLOTS; s++) { const b = slots[s]; if (b && !b.draining && b.Q > 0.5) solveBox(b, sw); }
          if (grow(dt / sub)) dirty = true;
        }
        lastActivityT = simT;
      }
      return growing;
    }

    /* ---------- auto choreography ---------- */
    function spots() {
      const portrait = cssW < cssH * 0.85;
      return portrait
        ? { A: [0.58, 0.3, 0.29, 6], B: [0.86, 0.13, 0.12, 3.5] }
        : { A: [0.7, 0.385, 0.195, 6], B: [0.88, 0.18, 0.09, 3.5] };
    }
    // region kept clear for the headline: x < [0], y > [1] (fractions of the hero)
    // Measured from the hero's headline block when there is one (the h1's
    // container next to our element); otherwise the contract's bottom-left zone.
    let ko = null;
    function measureKeepOut() {
      ko = null;
      try {
        const host = el.parentElement, h1 = host && host.querySelector('h1');
        if (h1 && !el.contains(h1)) {
          const blk = h1.parentElement && h1.parentElement !== host ? h1.parentElement : h1;
          const r = blk.getBoundingClientRect(), e = el.getBoundingClientRect();
          if (r.width > 0 && e.width > 0) {
            ko = [Math.min(1.01, (r.right - e.left) / e.width + 0.025), Math.max(0.05, (r.top - e.top) / e.height - 0.035)];
          }
        }
      } catch (err) { ko = null; }
    }
    function keepOut() { return ko || (cssW < cssH * 0.85 ? [1.01, 0.47] : [0.59, 0.36]); }
    function targetCells(rFrac) { const r = (rFrac * S) / cell; return PR.fillRatio * Math.PI * r * r; }
    function autoSeed(kind, jitter) {
      measureKeepOut();
      const sp = spots()[kind];
      const jx = jitter ? (Math.random() - 0.5) * 0.06 : 0, jy = jitter ? (Math.random() - 0.5) * 0.06 : 0;
      const b = seed(((sp[0] + jx) * cssW) / cell + M, ((sp[1] + jy) * cssH) / cell + M, { target: targetCells(sp[2]), T: sp[3], kind });
      if (b) b.avoid = true;
      return b;
    }
    function runAutoQueue() {
      if (!auto || reduced) return;
      for (let k = autoQueue.length - 1; k >= 0; k--) {
        const ev = autoQueue[k];
        if (simT < ev.t) continue;
        autoQueue.splice(k, 1);
        const busy = liveBlooms().length >= 3 || fluidCount > CAP * Nvis * 0.6 || simT - lastPressT < 8;
        if (busy) { autoQueue.push({ t: simT + 4, kind: ev.kind, jitter: true }); continue; }
        autoSeed(ev.kind, ev.jitter);
      }
    }
    function onBloomGone(b) {
      if (auto && !reduced && !motionOff && b.kind) autoQueue.push({ t: simT + (b.kind === 'A' ? 2.2 : 5), kind: b.kind, jitter: true });
    }
    // motion back on: queue whichever auto blooms are missing (live or draining ones requeue themselves)
    function resumeAuto() {
      if (!auto || reduced) return;
      const have = {};
      for (let s = 1; s <= SLOTS; s++) { const b = slots[s]; if (b && b.kind) have[b.kind] = true; }
      for (const ev of autoQueue) have[ev.kind] = true;
      if (!have.A) autoQueue.push({ t: simT + 0.35, kind: 'A', jitter: false });
      if (!have.B) autoQueue.push({ t: simT + (have.A ? 3 : 7.5), kind: 'B', jitter: false });
    }
    let lastPressT = -1e9;

    /* ---------- rendering ---------- */
    function boxBlurAll(src, dst, r) { boxBlur(src, dst, r, 0, 0, W - 1, H - 1); }
    function boxBlur(src, dst, r, x0, y0, x1, y1) {
      const inv = 1 / (2 * r + 1);
      for (let y = y0; y <= y1; y++) {
        const row = y * W; let s = 0;
        for (let x = x0; x <= Math.min(x1, x0 + r); x++) s += src[row + x];
        for (let x = x0; x <= x1; x++) {
          tmp[row + x] = s * inv;
          const xa = x + r + 1; if (xa <= x1) s += src[row + xa];
          const xr = x - r; if (xr >= x0) s -= src[row + xr];
        }
      }
      for (let x = x0; x <= x1; x++) {
        let s = 0;
        for (let y = y0; y <= Math.min(y1, y0 + r); y++) s += tmp[y * W + x];
        for (let y = y0; y <= y1; y++) {
          dst[y * W + x] = s * inv;
          const ya = y + r + 1; if (ya <= y1) s += tmp[ya * W + x];
          const yr = y - r; if (yr >= y0) s -= tmp[yr * W + x];
        }
      }
    }

    // Backlight glow: fluid coverage averaged into a 1/3-res buffer and box-blurred twice
    // (≈ gaussian). Done in JS so it looks the same everywhere (no ctx.filter needed).
    function renderGlow(region) {
      const GD = GLOW_DIV, gw = glow.width, gh = glow.height, P = 5;
      let gr = null;
      if (region) gr = [Math.max(0, ((region[0] / GD) | 0) - P), Math.max(0, ((region[1] / GD) | 0) - P),
        Math.min(gw - 1, ((region[2] / GD) | 0) + P), Math.min(gh - 1, ((region[3] / GD) | 0) + P)];
      if (lastG) { const [a0, c0, a1, c1] = lastG; for (let y = c0; y <= c1; y++) g32.fill(0, y * gw + a0, y * gw + a1 + 1); }
      if (gr) {
        const [x0, y0, x1, y1] = gr;
        for (let y = y0; y <= y1; y++) gA.fill(0, y * gw + x0, y * gw + x1 + 1);
        const [cx0, cy0, cx1, cy1] = region, inv = 1 / (GD * GD);
        for (let y = cy0; y <= cy1; y++) {
          const gro = ((y / GD) | 0) * gw;
          for (let x = cx0, i = y * W + x; x <= cx1; x++, i++) if (fl[i]) gA[gro + ((x / GD) | 0)] += amA[i] * inv;
        }
        blurBuf(gA, gB, gw, 2, x0, y0, x1, y1); blurBuf(gB, gA, gw, 2, x0, y0, x1, y1);
        const col = pal.glow;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0, j = y * gw + x; x <= x1; x++, j++) {
            let v = gA[j] * 1.5; if (v <= 0.004) continue; if (v > 1) v = 1;
            g32[j] = (((v * 255) << 24) | col) >>> 0;
          }
        }
      }
      let u = gr || lastG;
      if (gr && lastG) u = [Math.min(gr[0], lastG[0]), Math.min(gr[1], lastG[1]), Math.max(gr[2], lastG[2]), Math.max(gr[3], lastG[3])];
      if (u) gctx.putImageData(gImg, 0, 0, u[0], u[1], u[2] - u[0] + 1, u[3] - u[1] + 1);
      lastG = gr;
    }
    function blurBuf(src, dst, w, r, x0, y0, x1, y1) {
      // separable box blur on a buffer of row stride w: src → dst
      const inv = 1 / (2 * r + 1);
      for (let y = y0; y <= y1; y++) {
        const row = y * w; let s = 0;
        for (let x = x0; x <= Math.min(x1, x0 + r); x++) s += src[row + x];
        for (let x = x0; x <= x1; x++) {
          dst[row + x] = s * inv;
          const xa = x + r + 1; if (xa <= x1) s += src[row + xa];
          const xr = x - r; if (xr >= x0) s -= src[row + xr];
        }
      }
      for (let x = x0; x <= x1; x++) {
        // vertical pass in place via a column copy
        for (let y = y0; y <= y1; y++) colTmp[y] = dst[y * w + x];
        let s = 0;
        for (let y = y0; y <= Math.min(y1, y0 + r); y++) s += colTmp[y];
        for (let y = y0; y <= y1; y++) {
          dst[y * w + x] = s * inv;
          const ya = y + r + 1; if (ya <= y1) s += colTmp[ya];
          const yr = y - r; if (yr >= y0) s -= colTmp[yr];
        }
      }
    }
    let colTmp = new Float32Array(4096);

    function render() {
      const t0 = performance.now();
      // region = union of blooms (+pad), in cells
      let rx0 = W, ry0 = H, rx1 = -1, ry1 = -1;
      for (let s = 1; s <= SLOTS; s++) {
        const b = slots[s]; if (!b) continue;
        if (b.x0 < rx0) rx0 = b.x0; if (b.y0 < ry0) ry0 = b.y0; if (b.x1 > rx1) rx1 = b.x1; if (b.y1 > ry1) ry1 = b.y1;
        const span = Math.max(0.05, b.tMax - b.t0 + 0.3);
        sT0[s] = b.t0 - 0.3; sInvSpan[s] = 1 / span; sAlpha[s] = b.alpha;
        sDrain[s] = b.draining ? 1 : 0; sCut[s] = b.cut || 0; sInvBand[s] = b.band > 1e-4 ? 1 / b.band : 0;
      }
      const pad = 6, W2 = W * 2;
      let region = null;
      if (rx1 >= 0) region = [Math.max(M - 4, rx0 - pad), Math.max(M - 4, ry0 - pad), Math.min(W - M + 3, rx1 + pad), Math.min(H - M + 3, ry1 + pad)];
      if (region && (region[2] <= region[0] + 2 || region[3] <= region[1] + 2)) region = null;
      if (lastRegion) {
        const [a0, c0, a1, c1] = lastRegion;
        for (let y = c0 * 2; y <= c1 * 2 + 1; y++) px32.fill(0, y * W2 + a0 * 2, y * W2 + a1 * 2 + 2);
      }
      if (region) {
        const [x0, y0, x1, y1] = region;
        boxBlur(fill, b1, 1, x0, y0, x1, y1);
        boxBlur(fill, b2, 4, x0, y0, x1, y1);
        const lut = pal.lut, now = simT, ringW = (2 * Math.PI) / PR.ringPeriod;
        const V0 = PR.v0, VI = 1 / (1 - PR.v0);
        const BASE = PR.base, FRESH = PR.fresh, VEIN = PR.vein, CORE = PR.core, RING = PR.ring, EDGE = PR.base + PR.rim * 0.6;
        // pass A (cells): body tone and opacity
        for (let y = y0; y <= y1; y++) {
          for (let x = x0, i = y * W + x; x <= x1; x++, i++) {
            if (b2[i] < 0.004) { brA[i] = 0; amA[i] = 0; continue; }
            let o = fl[i];
            if (o) {
              const ta = tA[i], age = now - ta;
              const fresh = age < 4 ? Math.exp(-age * 1.3) : 0;
              const nrm = (ta - sT0[o]) * sInvSpan[o];
              let d = (b2[i] - V0) * VI; d = d < 0 ? 0 : d > 1 ? 1 : d; d = d * d * (3 - 2 * d);
              const rc = 0.5 + 0.5 * Math.cos((ta - sT0[o]) * ringW);
              const ring = rc * rc * rc * rc;
              const core = nrm < 0.3 ? 1 - nrm / 0.3 : 0;
              brA[i] = BASE + FRESH * fresh - VEIN * d - CORE * core * core + RING * ring;
              let a = sAlpha[o];
              if (sDrain[o] && sInvBand[o] > 0) { const f = (sCut[o] - ta) * sInvBand[o]; if (f < 1) a *= f < 0 ? 0 : f; }
              amA[i] = a;
            } else {
              o = fl[i - 1] || fl[i + 1] || fl[i - W] || fl[i + W] || fl[i - W - 1] || fl[i + W + 1] || fl[i - W + 1] || fl[i + W - 1];
              brA[i] = EDGE;
              amA[i] = o ? sAlpha[o] * (sDrain[o] ? 0.5 : 1) : 1;
            }
          }
        }
        // pass B (2× supersampled): bilinear alpha field → crisp sub-cell contour + rim light
        const A0 = PR.al0, AI = 1 / (PR.al1 - PR.al0), R1 = PR.rimEnd, RI = 1 / (PR.rimEnd - PR.al1), RIM = PR.rim;
        for (let y = y0 + 1; y < y1; y++) {
          let ro = y * W;
          for (let x = x0 + 1; x < x1; x++) {
            const i = ro + x;
            if (b2[i] < 0.004) continue;
            const c = b1[i], l = b1[i - 1], r = b1[i + 1], u = b1[i - W], d = b1[i + W];
            const aTL = (9 * c + 3 * (l + u) + b1[i - W - 1]) * 0.0625;
            const aTR = (9 * c + 3 * (r + u) + b1[i - W + 1]) * 0.0625;
            const aBL = (9 * c + 3 * (l + d) + b1[i + W - 1]) * 0.0625;
            const aBR = (9 * c + 3 * (r + d) + b1[i + W + 1]) * 0.0625;
            if (aTL < A0 && aTR < A0 && aBL < A0 && aBR < A0) continue;
            const C = brA[i], L = brA[i - 1], Rr = brA[i + 1], U = brA[i - W], D = brA[i + W];
            const am = amA[i];
            const p0 = (2 * y) * W2 + 2 * x;
            for (let q = 0; q < 4; q++) {
              let av, bv;
              if (q === 0) { av = aTL; bv = (9 * C + 3 * (L + U) + brA[i - W - 1]) * 0.0625; }
              else if (q === 1) { av = aTR; bv = (9 * C + 3 * (Rr + U) + brA[i - W + 1]) * 0.0625; }
              else if (q === 2) { av = aBL; bv = (9 * C + 3 * (L + D) + brA[i + W - 1]) * 0.0625; }
              else { av = aBR; bv = (9 * C + 3 * (Rr + D) + brA[i + W + 1]) * 0.0625; }
              if (av < A0) continue;
              let a = (av - A0) * AI; if (a > 1) a = 1; a = a * a * (3 - 2 * a) * am;
              let rf = (R1 - av) * RI; rf = rf < 0 ? 0 : rf > 1 ? 1 : rf;
              let k = ((bv + RIM * rf) * 255) | 0; k = k < 0 ? 0 : k > 255 ? 255 : k;
              px32[p0 + (q & 1) + (q >> 1) * W2] = (((a * 255) << 24) | lut[k]) >>> 0;
            }
          }
        }
      }
      renderGlow(region);
      // put dirty rect (2× pixels)
      let ux0, uy0, ux1, uy1;
      if (region && lastRegion) {
        ux0 = Math.min(region[0], lastRegion[0]); uy0 = Math.min(region[1], lastRegion[1]);
        ux1 = Math.max(region[2], lastRegion[2]); uy1 = Math.max(region[3], lastRegion[3]);
      } else if (region || lastRegion) { [ux0, uy0, ux1, uy1] = region || lastRegion; }
      if (ux1 !== undefined) lctx.putImageData(imgData, 0, 0, ux0 * 2, uy0 * 2, (ux1 - ux0 + 1) * 2, (uy1 - uy0 + 1) * 2);
      lastRegion = region;
      const t1 = performance.now();
      // compose onto the visible canvas
      const cw = canvas.width, chh = canvas.height, sc = cell * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, cw, chh);
      if (region) {
        // bilinear is plenty: the fluid image is already 2× supersampled ('high' costs ~40 ms in software raster)
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
        const ox = -M * sc, gw = glow.width * GLOW_DIV * sc, gh = glow.height * GLOW_DIV * sc;
        // soft backlight under the fluid, the fluid, then a faint additive bloom
        ctx.globalAlpha = PR.halo;
        ctx.drawImage(glow, ox, ox, gw, gh);
        ctx.globalAlpha = 1;
        ctx.drawImage(low, ox, ox, W * sc, H * sc);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = PR.glow;
        ctx.drawImage(glow, ox, ox, gw, gh);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        // injection ports: a dark drilled hole with a lit rim (tinted by the scent)
        const tp = pal.tip, lip = 'rgba(' + (tp[0] | 0) + ',' + (tp[1] | 0) + ',' + (tp[2] | 0) + ',';
        for (let s = 1; s <= SLOTS; s++) {
          const b = slots[s]; if (!b) continue;
          let a = b.alpha; if (b.draining) a *= Math.max(0, 1 - (simT - b.drainT0) / (DRAIN * 0.8));
          if (a <= 0.01) continue;
          const x = (b.sx - M + 0.5) * sc, y = (b.sy - M + 0.5) * sc, r = Math.max(5, cell * 2.2) * dpr;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
          g.addColorStop(0, 'rgba(8,4,2,' + 0.97 * a + ')');
          g.addColorStop(0.5, 'rgba(14,6,2,' + 0.96 * a + ')');
          g.addColorStop(0.6, 'rgba(44,20,5,' + 0.92 * a + ')');
          g.addColorStop(0.69, lip + 0.62 * a + ')');
          g.addColorStop(0.8, lip + 0.2 * a + ')');
          g.addColorStop(1, lip + '0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, 6.2832); ctx.fill();
        }
      }
      const t2 = performance.now();
      stats.render = t1 - t0; stats.compose = t2 - t1;
      dirty = false;
    }

    /* ---------- loop ---------- */
    function isActive() {
      if (dirty) return true;
      for (let s = 1; s <= SLOTS; s++) {
        const b = slots[s]; if (!b) continue;
        if (b.draining || b.held || b.pressure > 0 || b.Q > 0.5 || simT < b.holdUntil) return true;
        if (b.autoTarget > 0 && simT < b.t0 + b.autoT * 1.15) return true;
      }
      return simT - lastActivityT < 3.5; // let "fresh" highlights settle
    }
    // Motion off: the loop only runs while the user is pushing fluid (or a drain
    // their press caused is finishing); everything else stays frozen as drawn.
    function userBusy() {
      for (let s = 1; s <= SLOTS; s++) {
        const b = slots[s]; if (!b) continue;
        if (b.draining ? b.userDrain : (b.held || b.pressure > 0 || simT < b.holdUntil)) return true;
      }
      return false;
    }
    function nextEventIn() {
      let t = Infinity;
      for (const ev of autoQueue) t = Math.min(t, ev.t - simT);
      for (let s = 1; s <= SLOTS; s++) {
        const b = slots[s]; if (b && !b.draining) t = Math.min(t, Math.max(b.t0, b.lastBoostT) + LIFE - simT);
      }
      return t;
    }
    function frame(now) {
      raf = 0;
      if (destroyed || !inView || !docVisible) { running = false; return; }
      let dt = (now - lastWall) / 1000; lastWall = now;
      if (!(dt > 0)) dt = 1 / 60; if (dt > 1 / 20) dt = 1 / 20;
      simT += dt;
      const a = performance.now();
      runAutoQueue();
      step(dt);
      const b = performance.now();
      if (dirty || simT - lastActivityT < 3.5) render();
      const c = performance.now();
      stats.sim = b - a; stats.frames++;
      stats.simAvg = stats.simAvg * 0.95 + stats.sim * 0.05;
      stats.renderAvg = stats.renderAvg * 0.95 + (c - b) * 0.05;
      if (motionOff) {
        if (userBusy()) raf = requestAnimationFrame(frame);
        else { running = false; lastWall = 0; } // frozen: the plate's clock stops too
      } else if (isActive() || nextEventIn() <= 0) { raf = requestAnimationFrame(frame); }
      else { running = false; scheduleIdle(); }
    }
    function scheduleIdle() {
      clearTimeout(idleTimer); idleTimer = 0;
      const t = nextEventIn();
      if (!isFinite(t)) return;
      idleTimer = setTimeout(() => { idleTimer = 0; wake(); }, Math.max(16, t * 1000 + 20));
    }
    // The plate's clock keeps time while the loop idles (but is visible), so
    // lifetimes are real seconds. Called before anything reads simT on input.
    function syncClock() {
      if (running || reduced || !lastWall) return;
      const now = performance.now();
      simT += Math.min(120, Math.max(0, (now - lastWall) / 1000));
      lastWall = now;
    }
    function wake() {
      if (destroyed || reduced || rmBusy) return; // rmPump wakes us when it is done
      if (running || !inView || !docVisible) return;
      syncClock();
      lastWall = performance.now();
      running = true;
      clearTimeout(idleTimer); idleTimer = 0;
      raf = requestAnimationFrame(frame);
    }
    function sleep() {
      if (raf) cancelAnimationFrame(raf); raf = 0; running = false;
      clearTimeout(idleTimer); idleTimer = 0;
    }

    /* ---------- reduced motion: compute, then draw once ---------- */
    // (also used with the motion switch off, to precompute the one static bloom)
    function rmRun(job) {
      rmJobs.push(job);
      if (!reduced) sleep(); // never step the plate from two places at once
      if (!rmBusy) rmPump();
    }
    function rmPump() {
      if (destroyed) return;
      const job = rmJobs[0];
      if (!job) { rmBusy = false; render(); wake(); return; }
      rmBusy = true;
      const start = performance.now();
      if (!job.started) { job.started = true; if (job.begin) job.begin(); }
      const dt = 1 / 60;
      while (performance.now() - start < 28) {
        simT += dt; job.t += dt;
        if (job.tick) job.tick();
        step(dt);
        if (job.done()) { rmJobs.shift(); if (job.end) job.end(); break; }
      }
      setTimeout(rmPump, 0);
    }

    /* ---------- input ---------- */
    const actives = new Map(); // pointerId → {b, type, pending, x, y, cx, cy, timer}
    function toCell(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return [(clientX - r.left) / cell + M, (clientY - r.top) / cell + M];
    }
    function begin(cx, cy, tap) {
      syncClock();
      lastPressT = simT;
      try { el.dispatchEvent(new CustomEvent('fingering:inject', { bubbles: true })); } catch (e) { /* noop */ }
      if (reduced) {
        let b = null;
        rmRun({
          t: 0,
          begin() { b = findBloomAt(cx, cy) || seed(cx, cy, {}); if (b) { b.held = false; b.holdUntil = simT + TAP_S + 0.4; } },
          done() { return !b || (simT > b.holdUntil && b.pressure < 0.02) || this.t > 6; }
        });
        return null;
      }
      let b = findBloomAt(cx, cy);
      if (!b) b = seed(cx, cy, {});
      if (!b) return null;
      if (tap) { b.holdUntil = Math.max(b.holdUntil, simT + TAP_S); }
      else { b.held = true; b.holdUntil = Math.max(b.holdUntil, simT + 0.25); }
      b.lastBoostT = simT;
      wake();
      return b;
    }
    // Release. minHold is measured from the press start (t0): a click still gets
    // a short pulse, a released long-press just coasts on its decaying pressure.
    function end(b, minHold, t0) {
      if (!b) return;
      syncClock();
      b.held = false;
      if (minHold) b.holdUntil = Math.max(b.holdUntil, (t0 === undefined ? simT : t0) + minHold);
      b.lastBoostT = simT;
      wake();
    }

    // One record per pointer, so multi-touch works.
    // Touch waits ~170 ms to tell a press from the start of a scroll (we never
    // preventDefault on touch; touch-action: pan-y keeps vertical scrolling native).
    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('a,button,input,textarea,select,label')) return;
      const [cx, cy] = toCell(e.clientX, e.clientY);
      const prev = actives.get(e.pointerId);
      if (prev) { clearTimeout(prev.timer); if (prev.b) end(prev.b, 0); }
      if (e.pointerType === 'touch') {
        const a = { type: 'touch', pending: true, x: e.clientX, y: e.clientY, cx, cy, b: null, timer: 0 };
        a.timer = setTimeout(() => {
          if (actives.get(e.pointerId) !== a || !a.pending) return;
          a.pending = false;
          a.b = begin(cx, cy, false);
          a.t0 = simT;
        }, 170);
        actives.set(e.pointerId, a);
        return;
      }
      if (e.pointerType === 'mouse') e.preventDefault(); // no text-selection drags
      const b = begin(cx, cy, false);
      actives.set(e.pointerId, { type: e.pointerType, pending: false, b, t0: simT, timer: 0 });
    }
    function onMove(e) {
      const a = actives.get(e.pointerId);
      if (!a || !a.pending) return;
      if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 10) { clearTimeout(a.timer); actives.delete(e.pointerId); }
    }
    function onUp(e) {
      const a = actives.get(e.pointerId); if (!a) return;
      actives.delete(e.pointerId);
      if (a.pending) { clearTimeout(a.timer); begin(a.cx, a.cy, true); return; } // a tap
      end(a.b, a.type === 'touch' ? TAP_S : 0.45, a.t0); // even a click gets a short pulse
    }
    function onCancel(e) {
      const a = actives.get(e.pointerId); if (!a) return;
      actives.delete(e.pointerId);
      clearTimeout(a.timer);
      if (!a.pending) end(a.b, a.type === 'touch' ? TAP_S : 0, a.t0);
    }
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);

    // keyboard path
    let keyB = null, keyDownT = -1e9;
    // Keyboard: re-press soon after → keep feeding the same bloom; otherwise
    // start a new one at the freest spot (away from other blooms and the headline).
    let lastKeyBloom = null, lastKeyUpT = -1e9, keyT0 = 0;
    function keySpot() {
      const kb = lastKeyBloom;
      if (kb && slots[kb.id] === kb && !kb.draining && simT - lastKeyUpT < 1.5) return [kb.sx, kb.sy];
      const z = keepOut(), portrait = cssW < cssH * 0.85;
      let best = null, bestD = -1;
      for (let k = 0; k < 28; k++) {
        const fx = portrait ? 0.15 + Math.random() * 0.7 : 0.6 + Math.random() * 0.34;
        const fy = portrait ? 0.1 + Math.random() * (z[1] - 0.18) : 0.12 + Math.random() * 0.76;
        if (fx < z[0] && fy > z[1]) continue;
        const x = (fx * cssW) / cell + M, y = (fy * cssH) / cell + M;
        let d = 1e9;
        for (const b of liveBlooms()) {
          const r = 0.5 * Math.max(b.x1 - b.x0, b.y1 - b.y0);
          d = Math.min(d, Math.hypot(x - b.sx, y - b.sy) - r);
        }
        if (d > bestD) { bestD = d; best = [x, y]; }
      }
      return best || [((spots().A[0]) * cssW) / cell + M, ((spots().A[1]) * cssH) / cell + M];
    }
    function onKeyDown(e) {
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return;
      e.preventDefault();
      if (e.repeat || keyB) return;
      keyDownT = performance.now();
      const [cx, cy] = keySpot();
      keyB = begin(cx, cy, reduced) || { held: false };
      keyT0 = simT;
      if (keyB.id) lastKeyBloom = keyB;
    }
    function onKeyUp(e) {
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return;
      e.preventDefault();
      if (keyB && keyB.id) end(keyB, 0.8, keyT0);
      keyB = null; keyDownT = performance.now(); lastKeyUpT = simT;
    }
    function onKeyClick(e) {
      if (performance.now() - keyDownT < 800) return; // handled by key events
      const [cx, cy] = keySpot();
      begin(cx, cy, true);
    }
    function onKeyBlur() { if (keyB && keyB.id) end(keyB, 0.8, keyT0); keyB = null; }
    keyBtn.addEventListener('keydown', onKeyDown);
    keyBtn.addEventListener('keyup', onKeyUp);
    keyBtn.addEventListener('click', onKeyClick);
    keyBtn.addEventListener('blur', onKeyBlur);

    function onAccent() { readAccent(); if (reduced) { if (!rmBusy) render(); } else { dirty = true; wake(); } }
    document.addEventListener('scentchange', onAccent);
    document.addEventListener('themechange', onAccent);

    /* ---------- visibility ---------- */
    function onVis() {
      docVisible = !document.hidden;
      if (docVisible && inView) { lastWall = performance.now(); wake(); } else { sleep(); lastWall = 0; }
    }
    document.addEventListener('visibilitychange', onVis);
    function setInView(v) {
      if (v === inView) return;
      inView = v;
      if (inView && docVisible) { lastWall = performance.now(); wake(); } else { sleep(); lastWall = 0; }
    }
    let io = null;
    if ('IntersectionObserver' in window) {
      // Require real overlap: with the hero's bottom edge exactly at y = 0 (e.g. after
      // jumping to #work) Chrome reports an edge-adjacent "intersection" of ratio 0.
      // The tiny second threshold makes 0 → visible a threshold crossing, so it reports.
      io = new IntersectionObserver((ents) => {
        const e = ents[ents.length - 1];
        ioVisible = e.isIntersecting && e.intersectionRatio > 0;
        setInView(ioVisible && !overlayOpen);
      }, { threshold: [0, 0.001] });
      io.observe(el);
    }
    // The project overlay covers the hero completely: treat it as off screen.
    function onOverlay(e) {
      overlayOpen = !!(e && e.detail && e.detail.open);
      setInView(ioVisible && !overlayOpen);
    }
    document.addEventListener('overlaychange', onOverlay);
    // The site's motion switch (core dispatches motionchange {off}).
    function onMotion(e) {
      const off = !!(e && e.detail && e.detail.off);
      if (off === motionOff || reduced) { motionOff = off; return; }
      motionOff = off;
      if (off) {
        // no more auto blooms; the frame in flight finishes drawing, then the loop
        // stops (see frame()) and the canvas stays exactly as it is
        autoQueue = [];
        clearTimeout(idleTimer); idleTimer = 0;
        if (!running) lastWall = 0;
      } else {
        resumeAuto();
        dirty = true;
        if (!running) lastWall = 0; // the plate's clock was stopped while frozen
        wake();
      }
    }
    document.addEventListener('motionchange', onMotion);

    /* ---------- sizing ---------- */
    function sizeCanvas() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
    }
    function measure() {
      const r = el.getBoundingClientRect();
      return [Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height))];
    }
    function setup(w, h) {
      cssW = w; cssH = h; S = Math.max(320, Math.min(1100, Math.min(w, h * 1.2)));
      cell = pickCell(w, h);
      alloc(w, h);
      sizeCanvas();
      measureKeepOut();
    }
    // Move existing pattern into a new grid with the same cell size (keeps blooms intact).
    // The live blooms move together: their union box keeps its relative position in the
    // hero, nudged so the whole union fits the new plate. A bloom that still can't fit
    // (plate too small for all of them) is copied clipped and drained away.
    function regrid(w, h) {
      const old = { W, H, fl, fill, phi, tA };
      const live = liveBlooms();
      const group = live.length ? live : slots.filter(Boolean);
      let ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
      for (const b of group) {
        ux0 = Math.min(ux0, b.x0); uy0 = Math.min(uy0, b.y0); ux1 = Math.max(ux1, b.x1); uy1 = Math.max(uy1, b.y1);
      }
      const has = group.length > 0;
      const fx = has ? (((ux0 + ux1) / 2 - M) * cell) / cssW : 0, fy = has ? (((uy0 + uy1) / 2 - M) * cell) / cssH : 0;
      cssW = w; cssH = h; S = Math.max(320, Math.min(1100, Math.min(w, h * 1.2)));
      alloc(w, h);
      sizeCanvas();
      let dx = 0, dy = 0;
      if (has) {
        // the shift closest to `want` that keeps [u0, u1] inside [lo, n - lo), or null
        const fit = (want, u0, u1, n) => {
          const min = lo - u0, max = n - lo - 1 - u1;
          return min <= max ? Math.max(min, Math.min(max, want)) : null;
        };
        const wx = Math.round((fx * cssW) / cell + M - (ux0 + ux1) / 2);
        const wy = Math.round((fy * cssH) / cell + M - (uy0 + uy1) / 2);
        // when the union can't fit, keep the bloom being held / touched last whole
        let key = null;
        for (const b of group) if (!key || b.held > key.held || (b.held === key.held && b.lastBoostT > key.lastBoostT)) key = b;
        const axis = (want, u0, u1, k0, k1, n) => {
          let d = fit(want, u0, u1, n);
          if (d === null) d = fit(want, k0, k1, n);
          if (d === null) d = Math.round((lo - k0 + n - lo - 1 - k1) / 2);
          return d;
        };
        dx = axis(wx, ux0, ux1, key.x0, key.x1, W);
        dy = axis(wy, uy0, uy1, key.y0, key.y1, H);
      }
      for (let y = 0; y < old.H; y++) {
        const ny = y + dy; if (ny < lo || ny >= H - lo) continue;
        for (let x = 0; x < old.W; x++) {
          const nx = x + dx; if (nx < lo || nx >= W - lo) continue;
          const i = y * old.W + x, j = ny * W + nx;
          fl[j] = old.fl[i]; fill[j] = old.fl[i] ? 1 : 0; phi[j] = old.phi[i]; tA[j] = old.tA[i];
          if (fl[j]) { fluidCount++; if (slots[fl[j]]) slots[fl[j]].area2 = (slots[fl[j]].area2 || 0) + 1; }
        }
      }
      const clipped = [];
      for (let s = 1; s <= SLOTS; s++) {
        const b = slots[s]; if (!b) continue;
        b.area = b.area2 || 0; b.area2 = 0;
        const cut = b.x0 + dx < lo || b.y0 + dy < lo || b.x1 + dx > W - lo - 1 || b.y1 + dy > H - lo - 1;
        b.sx += dx; b.sy += dy; b.x0 = Math.max(0, b.x0 + dx); b.x1 = Math.min(W - 1, b.x1 + dx);
        b.y0 = Math.max(0, b.y0 + dy); b.y1 = Math.min(H - 1, b.y1 + dy);
        if (b.x1 < b.x0 || b.y1 < b.y0 || b.sx < lo || b.sy < lo || b.sx >= W - lo || b.sy >= H - lo) { removeBloom(b); }
        else if (cut && !b.draining) clipped.push(b);
      }
      rebuildPerimeter();
      // a bloom cut by the new edge recedes instead of sitting there sliced
      // (a static bloom, under reduced motion or the motion switch, just stays as it is)
      if (!reduced && !motionOff) for (const b of clipped) startDrain(b);
      measureKeepOut();
      dirty = true;
    }
    let roTimer = 0;
    function onResize() {
      clearTimeout(roTimer);
      roTimer = setTimeout(() => {
        if (destroyed) return;
        const [w, h] = measure();
        if (w === cssW && h === cssH) { const d = Math.min(2, window.devicePixelRatio || 1); if (d !== dpr) { sizeCanvas(); dirty = true; render(); } return; }
        const nc = pickCell(w, h);
        if (Math.abs(nc - cell) / cell > 0.3) {
          setup(w, h); for (let s = 1; s <= SLOTS; s++) slots[s] = null;
          lastPressT = -1e9; // a fresh plate: don't let an old press hold back the first auto bloom
          startAuto(true);
        }
        else regrid(w, h);
        render();
        wake();
      }, 120);
    }
    let ro = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(onResize); ro.observe(el); }
    else window.addEventListener('resize', onResize);

    /* ---------- start ---------- */
    function startAuto(instant) {
      autoQueue = [];
      if (!auto) return;
      if (reduced || motionOff) {
        // one static bloom; wait (briefly) for web fonts so the headline we keep clear is measured right
        let b = null, go = false;
        const run = () => {
          if (go || destroyed) return; go = true;
          if (!reduced && !motionOff) { resumeAuto(); wake(); return; } // motion came back on meanwhile
          rmRun({ t: 0, begin() { b = autoSeed('A', false); }, done() { return !b || b.area >= b.autoTarget * 0.97 || this.t > 9; } });
        };
        try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); } catch (e) { /* noop */ }
        setTimeout(run, instant ? 0 : 1500);
        return;
      }
      autoQueue.push({ t: simT + (instant ? 0.05 : 0.35), kind: 'A', jitter: false });
      autoQueue.push({ t: simT + 7.5, kind: 'B', jitter: false });
    }
    function clearAll() {
      for (let s = 1; s <= SLOTS; s++) slots[s] = null;
      fl.fill(0); fill.fill(0); phi.fill(1); tA.fill(0); pN = 0; inP.fill(0); fluidCount = 0;
      rmJobs = [];
      dirty = true;
    }

    readAccent();
    const [w0, h0] = measure();
    setup(w0, h0);
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destroyed) measureKeepOut(); }); } catch (e) { /* noop */ }
    startAuto(false);
    lastWall = performance.now();
    if (reduced) render(); else wake();

    const api = {
      destroy() {
        destroyed = true; sleep();
        actives.forEach(a => clearTimeout(a.timer)); actives.clear();
        clearTimeout(roTimer);
        el.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        document.removeEventListener('scentchange', onAccent);
        document.removeEventListener('themechange', onAccent);
        document.removeEventListener('visibilitychange', onVis);
        document.removeEventListener('overlaychange', onOverlay);
        document.removeEventListener('motionchange', onMotion);
        if (io) io.disconnect();
        if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        if (keyBtn.parentNode) keyBtn.parentNode.removeChild(keyBtn);
      },
      reset() {
        clearAll();
        lastPressT = -1e9;
        startAuto(false);
        if (reduced) render(); else { render(); wake(); }
      },
      inject(xFrac, yFrac) {
        const x = Math.max(0, Math.min(1, +xFrac || 0)), y = Math.max(0, Math.min(1, +yFrac || 0));
        begin((x * cssW) / cell + M, (y * cssH) / cell + M, true);
      }
    };
    // tuning/diagnostics for the dev harness (not part of the public API)
    Object.defineProperty(api, '_debug', {
      enumerable: false,
      value: {
        stats,
        info() {
          stats.fluid = fluidCount / Nvis; stats.perim = pN; stats.blooms = liveBlooms().length;
          return Object.assign({ W, H, cell, dpr, simT }, stats, {
            blooms: slots.filter(Boolean).map(b => ({ id: b.id, area: b.area, target: Math.round(b.autoTarget), Q: Math.round(b.Q), w: (b.x1 - b.x0) * cell, h: (b.y1 - b.y0) * cell, draining: b.draining, gref: +b.gref.toFixed(3) }))
          });
        },
        bench(frames) {
          // run sim steps synchronously, return ms per step
          const t = performance.now();
          for (let k = 0; k < frames; k++) { simT += 1 / 60; runAutoQueue(); step(1 / 60); }
          const t1 = performance.now();
          render();
          return { stepMs: (t1 - t) / frames, renderMs: performance.now() - t1 };
        }
      }
    });
    return api;
  }

  FX.fingering = { mount };
})();
