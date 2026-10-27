/*
  scent.js — the Aroma diffuser's 16x2 character LCD, in the footer.
  FX.scent.mount(el) -> { destroy(), set(name) }

  Tap / click (or Left / Right when focused) to cycle scents. Each scent
  re-tints the site: sets --accent / --accent-ink on <html> for the current
  theme, remembers the choice, dispatches `scentchange`, and puffs a little
  mist out of the top of the display.

  The display is drawn dot by dot with an HD44780-style 5x8 font, including
  the slow liquid-crystal response, so text "types" in behind a cursor.
*/
(function () {
  'use strict';
  const FX = (window.FX = window.FX || {});

  const STYLE_ID = 'fx-scent-style';
  const STORE_KEY = 'rd-scent';
  const COLS = 16, ROWS = 2;

  // [name, lcd text, light accent, light accent-ink, dark accent, dark accent-ink, genre]
  // Iced coffee's light accent is a touch lighter than its ink so fills still read on the black hero.
  const SCENTS = [
    ['Citrus', 'CITRUS', '#e8962c', '#a35f06', '#f2a93b', '#f2b155', 'POP'],
    ['Lavender', 'LAVENDER', '#8b78e6', '#5a44c2', '#a998ff', '#b9abff', 'LOFI'],
    ['Pine', 'PINE', '#3f8f5b', '#2b6b41', '#5fbf80', '#7fd09b', 'FOLK'],
    ['Ocean', 'OCEAN', '#2f80d1', '#1d5fa3', '#5aa6f0', '#7cb8f5', 'AMBIENT'],
    ['Poutine', 'POUTINE', '#9a6331', '#7a4a1f', '#c98b52', '#d9a372', 'HOCKEY'],
    ['Iced coffee', 'ICED COFFEE', '#6b4a33', '#3b2a20', '#c9a27e', '#d8b896', 'MATH ROCK']
  ].map(a => ({ name: a[0], lcd: a[1], light: [a[2], a[3]], dark: [a[4], a[5]], genre: a[6] }));

  const WATER = ['HIGH', 'OK', 'LOW', 'REFILL ME'];
  const WATER_WORDS = ['high', 'okay', 'low', 'empty'];

  // Custom characters (CGRAM-style) live in the control range.
  const NOTE = '\u0001', DROP = '\u0002', ELL = '\u0003';

  // HD44780 A00-style glyphs: 7 rows of 5 bits (row 8 is the cursor line).
  const GLYPHS = {
    A: '0E 11 11 11 1F 11 11', B: '1E 11 11 1E 11 11 1E', C: '0E 11 10 10 10 11 0E', D: '1C 12 11 11 11 12 1C',
    E: '1F 10 10 1E 10 10 1F', F: '1F 10 10 1E 10 10 10', G: '0E 11 10 17 11 11 0F', H: '11 11 11 1F 11 11 11',
    I: '0E 04 04 04 04 04 0E', J: '07 02 02 02 02 12 0C', K: '11 12 14 18 14 12 11', L: '10 10 10 10 10 10 1F',
    M: '11 1B 15 15 11 11 11', N: '11 11 19 15 13 11 11', O: '0E 11 11 11 11 11 0E', P: '1E 11 11 1E 10 10 10',
    Q: '0E 11 11 11 15 12 0D', R: '1E 11 11 1E 14 12 11', S: '0F 10 10 0E 01 01 1E', T: '1F 04 04 04 04 04 04',
    U: '11 11 11 11 11 11 0E', V: '11 11 11 11 11 0A 04', W: '11 11 11 15 15 15 0A', X: '11 11 0A 04 0A 11 11',
    Y: '11 11 11 0A 04 04 04', Z: '1F 01 02 04 08 10 1F',
    0: '0E 11 13 15 19 11 0E', 1: '04 0C 04 04 04 04 0E', 2: '0E 11 01 02 04 08 1F', 3: '1F 02 04 02 01 11 0E',
    4: '02 06 0A 12 1F 02 02', 5: '1F 10 1E 01 01 11 0E', 6: '06 08 10 1E 11 11 0E', 7: '1F 01 02 04 08 08 08',
    8: '0E 11 11 0E 11 11 0E', 9: '0E 11 11 0F 01 02 0C',
    ':': '00 0C 0C 00 0C 0C 00', '.': '00 00 00 00 00 0C 0C', '-': '00 00 00 1F 00 00 00', '!': '04 04 04 04 00 00 04',
    '?': '0E 11 01 02 04 00 04', '/': '00 01 02 04 08 10 00', '+': '00 04 04 1F 04 04 00', "'": '0C 04 08 00 00 00 00',
    [NOTE]: '02 03 02 02 0E 1E 0C', [DROP]: '04 04 0A 0A 11 11 0E', [ELL]: '00 00 00 00 00 00 15'
  };
  const FONT = {};
  Object.keys(GLYPHS).forEach(k => { FONT[k] = GLYPHS[k].split(' ').map(h => parseInt(h, 16)).concat(0); });
  const BLANK = [0, 0, 0, 0, 0, 0, 0, 0];
  const glyph = ch => FONT[ch] || FONT[String(ch).toUpperCase()] || BLANK;

  const CSS = `
.fxs-host{max-width:100%}
.fxs{position:relative;display:inline-flex;flex-direction:column;align-items:flex-start;gap:10px;width:300px;max-width:100%}
.fxs-lcd{position:relative;display:block;width:100%;aspect-ratio:300/88;margin:0;padding:0;border:0;border-radius:6px;cursor:pointer;
  color:inherit;font:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
  background:linear-gradient(180deg,#2a2c32 0%,#17181c 42%,#0f1013 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.09),inset 0 -1px 0 rgba(0,0,0,.7),0 1px 1px rgba(0,0,0,.18),0 10px 24px -14px rgba(0,0,0,.55);
  transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s cubic-bezier(.16,1,.3,1)}
.fxs-lcd:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),inset 0 -1px 0 rgba(0,0,0,.7),0 2px 2px rgba(0,0,0,.16),0 14px 28px -14px rgba(0,0,0,.6)}
.fxs-lcd:active{transform:translateY(1px) scale(.992);transition-duration:.08s}
.fxs-lcd:focus-visible{outline:2px solid var(--accent-night,var(--accent,#e8962c));outline-offset:3px}
.fxs-screw{position:absolute;top:50%;width:7px;height:7px;margin-top:-3.5px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#b9bbc2 0%,#6b6d74 45%,#2c2d32 100%);box-shadow:0 0 0 1px rgba(0,0,0,.55),0 1px 0 rgba(255,255,255,.06)}
.fxs-screw::after{content:"";position:absolute;left:1px;right:1px;top:3px;height:1px;background:rgba(20,20,24,.75);transform:rotate(-35deg)}
.fxs-screw--l{left:6px}.fxs-screw--r{right:6px}.fxs-screw--r::after{transform:rotate(25deg)}
.fxs-screen{position:absolute;left:19px;right:19px;top:9px;bottom:9px;border-radius:2px;overflow:hidden;
  background:radial-gradient(130% 150% at 50% 42%,#3657da 0%,#2f4fd0 46%,#2440b8 100%);
  box-shadow:inset 0 0 0 1px rgba(4,8,40,.65),inset 0 1px 10px rgba(4,10,60,.55),inset 0 0 22px rgba(70,110,255,.22),0 0 0 1px rgba(255,255,255,.035);
  transition:filter .5s ease}
.fxs-lcd:hover .fxs-screen{filter:brightness(1.07) saturate(1.04)}
.fxs-screen.is-pulse{animation:fxs-pulse .45s ease-out}
.fxs-screen.is-off{filter:brightness(.32) saturate(.7)}
.fxs-screen.is-boot{transition:filter .55s cubic-bezier(.16,1,.3,1)}
@keyframes fxs-pulse{0%{filter:brightness(1.22)}100%{filter:brightness(1)}}
.fxs-screen canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.fxs-glass{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(168deg,rgba(255,255,255,.13) 0%,rgba(255,255,255,.035) 34%,rgba(255,255,255,0) 35%),
    linear-gradient(0deg,rgba(0,0,30,.18),rgba(0,0,30,0) 30%)}
.fxs-label{margin:0;display:flex;align-items:center;gap:7px;font:400 10px/1.2 var(--font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);
  letter-spacing:.04em;color:var(--ink-3,#8a8a8a)}
.fxs-dot{width:6px;height:6px;border-radius:50%;background:var(--accent,#e8962c);transition:background-color .6s ease}
.fxs-mist{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:1}
.fxs-p{position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;will-change:transform,opacity;opacity:0;filter:blur(3px)}
.fxs-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
html[data-theme="filled"] .fxs-lcd{box-shadow:inset 0 1px 0 rgba(255,255,255,.1),inset 0 -1px 0 rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.07),0 10px 24px -14px rgba(0,0,0,.9)}
@media (prefers-reduced-motion: reduce){.fxs-lcd,.fxs-screen,.fxs-dot{transition:none}.fxs-lcd:hover,.fxs-lcd:active{transform:none}.fxs-screen.is-pulse{animation:none}}
`;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function store(get, val) {
    try {
      if (get) return window.localStorage.getItem(STORE_KEY);
      window.localStorage.setItem(STORE_KEY, val);
    } catch (e) { /* private mode etc. */ }
    return null;
  }

  function findScent(name) {
    if (!name) return -1;
    const k = String(name).trim().toLowerCase();
    return SCENTS.findIndex(s => s.name.toLowerCase() === k || s.lcd.toLowerCase() === k);
  }

  FX.scent = {
    mount(el, opts = {}) {
      if (!el) return { destroy() {}, set() {} };
      injectStyle();
      const root = document.documentElement;
      const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
      const reduce = () => reduceMQ.matches;
      const original = el.innerHTML;
      // the host may shrink below the LCD's 300px (a 320px phone has 288px of row)
      const hadHost = el.classList.contains('fxs-host');
      el.classList.add('fxs-host');

      // ---- state ---------------------------------------------------------
      let idx = findScent(store(true));
      if (idx < 0) idx = 0;
      let water = 0;
      let theme = root.getAttribute('data-theme') === 'filled' ? 'filled' : 'drained';
      let destroyed = false, visible = true, booted = false;

      // ---- DOM -------------------------------------------------------------
      el.innerHTML =
        '<div class="fxs">' +
          '<button class="fxs-lcd" type="button">' +
            '<span class="fxs-screw fxs-screw--l" aria-hidden="true"></span>' +
            '<span class="fxs-screen" aria-hidden="true"><canvas></canvas><span class="fxs-glass"></span></span>' +
            '<span class="fxs-screw fxs-screw--r" aria-hidden="true"></span>' +
          '</button>' +
          '<p class="fxs-label" aria-hidden="true"><i class="fxs-dot"></i>aroma · tap to change scent</p>' +
          '<span class="fxs-sr" aria-live="polite"></span>' +
          '<div class="fxs-mist" aria-hidden="true"></div>' +
        '</div>';
      const wrap = el.querySelector('.fxs');
      const btn = el.querySelector('.fxs-lcd');
      const screen = el.querySelector('.fxs-screen');
      const cv = el.querySelector('canvas');
      const ctx = cv.getContext('2d');
      const live = el.querySelector('.fxs-sr');
      const mist = el.querySelector('.fxs-mist');

      // ---- text composition --------------------------------------------------
      // per-cell displayed char, plus a cursor column during typing
      const shown = new Array(COLS * ROWS).fill(' ');
      let target = shown.slice();
      let typing = null;        // { t0, step, from }
      let marquee = null;       // { t0, step, len }
      let blinkOn = true;

      function pad(s) { return (s + ' '.repeat(COLS)).slice(0, COLS); }
      function line1Full() { return 'SCENT:' + SCENTS[idx].lcd; }
      function line1Static() {
        const full = line1Full();
        return full.length <= COLS ? pad(full) : full.slice(0, COLS - 1) + ELL;
      }
      function line2() {
        const s = SCENTS[idx];
        const refill = water === 3;
        const left = DROP + (refill && !blinkOn ? ' '.repeat(WATER[3].length) : WATER[water]);
        const right = NOTE + s.genre;
        if (left.length + 1 + right.length <= COLS) return left + ' '.repeat(COLS - left.length - right.length) + right;
        return pad(left);
      }
      function compose(now) {
        let l1 = line1Static();
        if (marquee) {
          const full = line1Full() + '    ';
          const k = Math.floor(Math.max(0, now - marquee.t0) / marquee.step);
          if (k >= full.length) marquee = null;
          else if (now >= marquee.t0) { const loop = full + full; l1 = loop.slice(k, k + COLS); }
        }
        return (l1 + line2()).split('');
      }

      // ---- dot renderer ------------------------------------------------------
      const DOTS = 5 * 8;
      const inten = new Float32Array(COLS * ROWS * DOTS);
      let L = null;             // layout
      let unlit = null;         // cached canvas of unlit cells
      const lit = document.createElement('canvas');
      const lctx = lit.getContext('2d');
      const glow = document.createElement('canvas');
      const gctx = glow.getContext('2d');
      let raf = 0, lastT = 0, cursor = -1;

      function layout() {
        const r = screen.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
        // grid: 16 cells of 5 dots + 1-dot gaps; 2 rows of 8 dots + a 1.5-dot gap
        let px = Math.min((W * 0.93) / 95, (H * 0.86) / (17.5 * 1.1));
        if (px >= 3.6) px = Math.floor(px);
        let py = px * 1.1;
        if (px >= 3.6) py = Math.round(py);
        const dw = px >= 3.6 ? px - 1 : px * 0.82;
        const dh = px >= 3.6 ? py - 1 : py * 0.84;
        const gw = 95 * px, gh = 17.5 * py;
        const ox = Math.round((W - gw) / 2 + (px - dw) / 2), oy = Math.round((H - gh) / 2 + (py - dh) / 2);
        cv.width = W; cv.height = H;
        lit.width = W; lit.height = H;
        glow.width = Math.max(1, Math.round(W / 5)); glow.height = Math.max(1, Math.round(H / 5));
        L = { W, H, px, py, dw, dh, ox, oy };
        // unlit layer: every dot of every cell, faintly
        unlit = document.createElement('canvas');
        unlit.width = W; unlit.height = H;
        const u = unlit.getContext('2d');
        u.fillStyle = 'rgba(205,218,255,0.052)';
        for (let c = 0; c < COLS * ROWS; c++) {
          const { x, y } = cellXY(c);
          for (let ry = 0; ry < 8; ry++) for (let rx = 0; rx < 5; rx++) u.fillRect(x + rx * px, y + ry * py, dw, dh);
        }
        return true;
      }
      function cellXY(c) {
        const row = (c / COLS) | 0, col = c % COLS;
        return { x: L.ox + col * 6 * L.px, y: L.oy + row * 9.5 * L.py };
      }

      function draw() {
        if (!L) return;
        const { W, H, px, py, dw, dh } = L;
        lctx.clearRect(0, 0, W, H);
        lctx.fillStyle = '#e6ecff';
        for (let c = 0; c < COLS * ROWS; c++) {
          const { x, y } = cellXY(c);
          const base = c * DOTS;
          for (let d = 0; d < DOTS; d++) {
            const a = inten[base + d];
            if (a < 0.01) continue;
            lctx.globalAlpha = a > 1 ? 1 : a;
            lctx.fillRect(x + (d % 5) * px, y + ((d / 5) | 0) * py, dw, dh);
          }
        }
        lctx.globalAlpha = 1;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(unlit, 0, 0);
        // bloom: downsample + upsample the lit layer, added on top
        gctx.clearRect(0, 0, glow.width, glow.height);
        gctx.imageSmoothingEnabled = true;
        gctx.drawImage(lit, 0, 0, glow.width, glow.height);
        ctx.imageSmoothingEnabled = true;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        ctx.drawImage(glow, 0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(lit, 0, 0);
      }

      // ---- animation loop (only runs while something is changing) ------------
      function kick() { if (!raf && !destroyed) { lastT = 0; raf = requestAnimationFrame(frame); } }
      function frame(t) {
        raf = 0;
        const dt = lastT ? Math.min(64, t - lastT) : 16;
        lastT = t;
        let busy = false;
        const now = performance.now();
        target = compose(now);
        if (marquee) busy = true;
        if (typing) {
          const k = Math.floor((now - typing.t0) / typing.step);
          for (let c = 0; c < COLS * ROWS; c++) {
            const col = c % COLS;
            shown[c] = col < k ? target[c] : typing.from[c];
          }
          cursor = k < COLS ? k : -1;
          if (k >= COLS) typing = null; else busy = true;
        } else {
          for (let c = 0; c < COLS * ROWS; c++) shown[c] = target[c];
          cursor = -1;
        }
        const snap = reduce();
        const kOn = snap ? 1 : 1 - Math.exp(-dt / 26);
        const kOff = snap ? 1 : 1 - Math.exp(-dt / 55);
        const kCur = snap ? 1 : 1 - Math.exp(-dt / 14); // the cursor line is driven harder
        for (let c = 0; c < COLS * ROWS; c++) {
          const g = glyph(shown[c]);
          const base = c * DOTS;
          const curRow = cursor === c % COLS;
          for (let d = 0; d < DOTS; d++) {
            const ry = (d / 5) | 0, rx = d % 5;
            const on = (ry === 7 && curRow) || ((g[ry] >> (4 - rx)) & 1);
            const cur = inten[base + d];
            const tgt = on ? 1 : 0;
            const nx = cur + (tgt - cur) * (ry === 7 ? kCur : tgt > cur ? kOn : kOff);
            inten[base + d] = Math.abs(nx - tgt) < 0.004 ? tgt : nx;
            if (inten[base + d] !== tgt) busy = true;
          }
        }
        draw();
        if (busy && !destroyed) raf = requestAnimationFrame(frame);
      }

      // ---- timers: blink + marquee scheduling, paused off-screen ------------
      let blinkT = 0, marqueeT = 0;
      function blinkLoop() {
        clearTimeout(blinkT); blinkT = 0;
        if (destroyed || water !== 3 || reduce()) { if (!blinkOn) { blinkOn = true; kick(); } return; }
        if (!visible || document.hidden) return;
        blinkT = setTimeout(() => { blinkOn = !blinkOn; kick(); blinkLoop(); }, blinkOn ? 640 : 380);
      }
      function startMarquee(delay) {
        clearTimeout(marqueeT);
        marquee = null;
        if (reduce() || line1Full().length <= COLS) return;
        marqueeT = setTimeout(() => {
          if (destroyed || !visible || document.hidden) return;
          marquee = { t0: performance.now(), step: 240 };
          kick();
        }, delay);
      }

      // ---- accent ------------------------------------------------------------
      function accentFor(i, th) { const s = SCENTS[i]; return th === 'filled' ? s.dark : s.light; }
      // --accent-night is the scent's dark-theme accent in BOTH themes: for things that
      // always sit on black (the hero, the footer), ≥ 7:1 on #050403 for every scent.
      function applyAccent(announceEvent) {
        const [a, ink] = accentFor(idx, theme);
        const night = SCENTS[idx].dark[0];
        let prev = '', prevNight = '';
        try {
          const cs = getComputedStyle(root);
          prev = cs.getPropertyValue('--accent').trim();
          prevNight = cs.getPropertyValue('--accent-night').trim();
        } catch (e) { /* ignore */ }
        root.style.setProperty('--accent', a);
        root.style.setProperty('--accent-ink', ink);
        root.style.setProperty('--accent-night', night);
        if (announceEvent || prev.toLowerCase() !== a || prevNight.toLowerCase() !== night) {
          document.dispatchEvent(new CustomEvent('scentchange', { detail: { name: SCENTS[idx].name, accent: a } }));
        }
        return a;
      }
      function updateLabel() {
        btn.setAttribute('aria-label', 'Change scent, current: ' + SCENTS[idx].name);
      }

      // ---- mist ("pssht") --------------------------------------------------------
      function puff(color) {
        if (reduce() || !mist.animate) return;
        const b = btn.getBoundingClientRect(), w = wrap.getBoundingClientRect();
        const [r, g, bl] = hexRgb(color);
        const n = 12 + Math.floor(Math.random() * 5);
        const ox = b.left - w.left, oy = b.top - w.top;
        for (let i = 0; i < n; i++) {
          const p = document.createElement('span');
          p.className = 'fxs-p';
          const s = 16 + Math.random() * 24;
          const pale = Math.random() < 0.3;
          const cr = pale ? Math.round(r + (255 - r) * 0.6) : r, cg = pale ? Math.round(g + (255 - g) * 0.6) : g, cb = pale ? Math.round(bl + (255 - bl) * 0.6) : bl;
          p.style.width = p.style.height = s.toFixed(1) + 'px';
          p.style.background = `radial-gradient(circle, rgba(${cr},${cg},${cb},.52) 0%, rgba(${cr},${cg},${cb},.2) 45%, rgba(${cr},${cg},${cb},0) 72%)`;
          mist.appendChild(p);
          const x0 = ox + b.width * (0.3 + Math.random() * 0.4) - s / 2;
          const y0 = oy + 6 - s / 2;
          const dx = (Math.random() - 0.5) * 70, dy = -(46 + Math.random() * 74);
          const sway = (Math.random() - 0.5) * 24;
          const dur = 1100 + Math.random() * 500;
          const anim = p.animate([
            { transform: `translate(${x0}px,${y0}px) scale(.35)`, opacity: 0 },
            { transform: `translate(${x0 + dx * 0.3 + sway}px,${y0 + dy * 0.3}px) scale(.9)`, opacity: 0.8, offset: 0.18 },
            { transform: `translate(${x0 + dx * 0.7 - sway * 0.5}px,${y0 + dy * 0.72}px) scale(1.5)`, opacity: 0.35, offset: 0.6 },
            { transform: `translate(${x0 + dx}px,${y0 + dy}px) scale(1.9)`, opacity: 0 }
          ], { duration: dur, delay: Math.random() * 160, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
          anim.onfinish = () => p.remove();
        }
      }

      // ---- change ---------------------------------------------------------------
      function change(nextIdx, fromUser) {
        if (nextIdx === idx && !fromUser) return;
        idx = (nextIdx + SCENTS.length) % SCENTS.length;
        water = (water + 1) % WATER.length;
        blinkOn = true;
        store(false, SCENTS[idx].name);
        const a = applyAccent(true);
        updateLabel();
        live.textContent = `Scent: ${SCENTS[idx].name}. Water ${WATER_WORDS[water]}.`;
        if (reduce()) { typing = null; }
        else typing = { t0: performance.now(), step: 250 / COLS, from: shown.slice() };
        startMarquee(250 + 700);
        blinkLoop();
        if (fromUser) {
          puff(a);
          screen.classList.remove('is-pulse');
          void screen.offsetWidth;
          screen.classList.add('is-pulse');
        }
        kick();
      }

      // ---- events -------------------------------------------------------------
      function onClick() { change(idx + 1, true); }
      function onKey(e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); change(idx + 1, true); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); change(idx - 1, true); }
      }
      function onTheme(e) {
        const t = (e && e.detail && e.detail.theme) || (root.getAttribute('data-theme') === 'filled' ? 'filled' : 'drained');
        if (t === theme) return;
        theme = t;
        applyAccent(false);
      }
      function onMutate() {
        const t = root.getAttribute('data-theme') === 'filled' ? 'filled' : 'drained';
        if (t !== theme) { theme = t; applyAccent(false); }
      }
      function onVis() {
        if (document.hidden) { clearTimeout(blinkT); blinkT = 0; }
        else { blinkLoop(); }
      }
      btn.addEventListener('click', onClick);
      btn.addEventListener('keydown', onKey);
      document.addEventListener('themechange', onTheme);
      window.addEventListener('themechange', onTheme);
      document.addEventListener('visibilitychange', onVis);
      const mo = 'MutationObserver' in window ? new MutationObserver(onMutate) : null;
      if (mo) mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

      let ro = null;
      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(() => { if (layout()) draw(); });
        ro.observe(screen);
      }

      function boot() {
        if (booted) return;
        booted = true;
        if (reduce()) { kick(); return; }
        // backlight warms up, then the status types itself in
        screen.classList.add('is-boot');
        requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.remove('is-off')));
        setTimeout(() => {
          if (destroyed) return;
          screen.classList.remove('is-boot');
          typing = { t0: performance.now(), step: 260 / COLS, from: new Array(COLS * ROWS).fill(' ') };
          startMarquee(260 + 900);
          kick();
        }, 380);
      }

      let io = null;
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(entries => {
          visible = entries[entries.length - 1].isIntersecting;
          if (visible) { boot(); blinkLoop(); }
          else { clearTimeout(blinkT); blinkT = 0; }
        }, { threshold: 0.35 });
        io.observe(btn);
      } else { boot(); }

      // ---- init ------------------------------------------------------------------
      updateLabel();
      applyAccent(false);
      layout();
      if (reduce() || !io) {
        // show the status immediately
        booted = true;
        target = compose(performance.now());
        for (let c = 0; c < shown.length; c++) shown[c] = target[c];
        kick();
      } else {
        screen.classList.add('is-off');
        draw();
      }

      return {
        set(name) {
          const i = findScent(name);
          if (i >= 0 && i !== idx) change(i, false);
        },
        destroy() {
          destroyed = true;
          if (raf) cancelAnimationFrame(raf);
          clearTimeout(blinkT); clearTimeout(marqueeT);
          btn.removeEventListener('click', onClick);
          btn.removeEventListener('keydown', onKey);
          document.removeEventListener('themechange', onTheme);
          window.removeEventListener('themechange', onTheme);
          document.removeEventListener('visibilitychange', onVis);
          if (mo) mo.disconnect();
          if (ro) ro.disconnect();
          if (io) io.disconnect();
          if (!hadHost) el.classList.remove('fxs-host');
          el.innerHTML = original;
        }
      };
    }
  };
})();
