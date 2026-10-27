/*
  Beat the plunger — FX.plunger.mount(el) -> { destroy() }

  A reaction-time toy built on the gravity-drop mix-and-quench plunger:
  press start, wait for the ligand to hit the crystal, then plunge it into
  liquid nitrogen as fast as you can. The real instrument does it in under
  10 ms. Reaction time is measured from the frame that showed the cue
  (requestAnimationFrame timestamp) to the input event's timestamp.
*/
(function () {
  'use strict';
  const FX = (window.FX = window.FX || {});

  /* ------------------------------------------------------------------ shared
     (this block is identical in rocket.js and plunger.js; first one wins) */
  const STYLE_ID = 'fx-games-style';
  const CSS = [
    '.fxg-stage{position:absolute;inset:0;overflow:hidden;background:var(--bg-2,#f4f2ee);color:var(--ink,#121212);font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;font-weight:400;line-height:1.4;text-align:left;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;outline:none;isolation:isolate}',
    '.fxg-stage:focus-visible{outline:none}',
    '.fxg-stage:focus-visible::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;box-shadow:inset 0 0 0 2px var(--accent-ink,#a35f06);border-radius:inherit}',
    '.fxg-stage *{box-sizing:border-box}',
    '.fxg-stage .fxg-cv{position:absolute;inset:0;width:100%;height:100%;display:block;max-width:none}',
    '.fxg-stage .fxg-ro{position:absolute;top:9px;right:10px;margin:0;padding:5px 6px 5px 8px;display:grid;grid-template-columns:auto auto;column-gap:14px;row-gap:2px;font:inherit;letter-spacing:.08em;text-transform:uppercase;pointer-events:none;font-variant-numeric:tabular-nums;background:var(--bg-2,#f4f2ee);border-radius:2px}',
    '.fxg-stage .fxg-ro dt,.fxg-stage .fxg-ro dd{margin:0;padding:0;font:inherit;letter-spacing:inherit;text-transform:inherit}',
    '.fxg-stage .fxg-ro dt{color:var(--ink-3,#8a8a8a)}',
    '.fxg-stage .fxg-ro dd{text-align:right;color:var(--ink,#121212);min-width:8.5ch}',
    '.fxg-stage .fxg-ro .is-hot{color:var(--accent-ink,#a35f06)}',
    '.fxg-stage .fxg-bar{position:absolute;left:16px;right:16px;bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;pointer-events:none;transition:opacity .3s}',
    '.fxg-stage .fxg-bar>.fxg-btn{pointer-events:auto}',
    '.fxg-stage .fxg-bar.is-off{opacity:0;visibility:hidden}',
    '.fxg-stage .fxg-hint{font:inherit;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#8a8a8a);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;font-variant-numeric:tabular-nums}',
    '.fxg-stage .fxg-btn{-webkit-appearance:none;appearance:none;display:inline-flex;align-items:center;margin:0;font-family:inherit;font-size:12px;font-weight:400;letter-spacing:.04em;text-transform:none;line-height:1;padding:9px 14px;min-height:34px;width:auto;border:1px solid var(--ink,#121212);border-radius:var(--radius,2px);background:var(--bg,#fff);color:var(--ink,#121212);box-shadow:none;cursor:pointer;white-space:nowrap;touch-action:manipulation;transition:background-color .2s,color .2s,border-color .2s}',
    '.fxg-stage .fxg-btn:hover{background:var(--ink,#121212);color:var(--bg,#fff)}',
    '.fxg-stage .fxg-btn:focus{outline:none}',
    '.fxg-stage .fxg-btn:focus-visible{outline:2px solid var(--accent-ink,#a35f06);outline-offset:2px}',
    '.fxg-stage .fxg-btn--2{background:transparent;border-color:var(--line,#e7e4de);border-color:color-mix(in srgb,var(--ink,#121212) 28%,transparent)}',
    '.fxg-stage .fxg-btn--2:hover{background:transparent;color:var(--ink,#121212);border-color:var(--ink,#121212)}',
    '.fxg-stage .fxg-btn[hidden]{display:none}',
    '.fxg-stage .fxg-kbd{opacity:.55;margin-left:8px;font-size:10px}',
    '.fxg-stage .fxg-card{position:absolute;left:12px;right:12px;top:12px;margin:0;padding:14px 16px 16px;background:var(--bg,#fff);color:var(--ink,#121212);border:1px solid var(--ink,#121212);border-radius:var(--radius,2px);box-shadow:0 18px 40px -26px rgba(0,0,0,.45);opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .3s,transform .5s cubic-bezier(.16,1,.3,1),visibility 0s .5s}',
    '.fxg-stage .fxg-card.is-on{opacity:1;visibility:visible;transform:none;transition:opacity .3s,transform .5s cubic-bezier(.16,1,.3,1),visibility 0s}',
    '.fxg-stage .fxg-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline}',
    '.fxg-stage .fxg-k{font-family:inherit;font-size:11px;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#8a8a8a)}',
    '.fxg-stage .fxg-k b{font-weight:500;color:var(--accent-ink,#a35f06)}',
    '.fxg-stage .fxg-row{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:10px}',
    '.fxg-stage .fxg-stats{display:flex;gap:28px;min-width:0}',
    '.fxg-stage .fxg-stat{display:flex;flex-direction:column;gap:4px;min-width:0}',
    '.fxg-stage .fxg-v{font-family:var(--font-display,"Instrument Serif",Georgia,serif);font-size:38px;font-weight:400;font-style:normal;line-height:.95;letter-spacing:-.01em;text-transform:none;color:var(--ink,#121212);white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.fxg-stage .fxg-v small{font-size:17px;margin-left:3px;letter-spacing:0}',
    '.fxg-stage .fxg-v.is-dim{color:var(--ink-3,#8a8a8a)}',
    '.fxg-stage .fxg-msg{margin:12px 0 0;font-family:var(--font-display,"Instrument Serif",Georgia,serif);font-style:italic;font-weight:400;font-size:21px;line-height:1.2;letter-spacing:0;text-transform:none;color:var(--ink,#121212);text-wrap:balance}',
    '.fxg-stage .fxg-sub{margin:6px 0 0;font-family:inherit;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2,#4b4b4b)}',
    '.fxg-stage .fxg-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}',
    '.fxg-stage .fxg-spark{display:block;flex:none;max-width:none}',
    '.fxg-stage .fxg-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;padding:0}',
    '.fxg-stage.fxg--narrow .fxg-v{font-size:32px!important}',
    '.fxg-stage.fxg--narrow .fxg-stats{gap:20px!important}',
    '.fxg-stage.fxg--narrow .fxg-msg{font-size:19px!important}',
    '.fxg-stage.fxg--narrow .fxg-spark{display:none!important}',
    '.fxg-stage.fxg--tiny .fxg-v{font-size:28px!important}',
    '.fxg-stage.fxg--tiny .fxg-stats{gap:16px!important}',
    '.fxg-stage.fxg--tiny .fxg-ro,.fxg-stage.fxg--tiny .fxg-hint{letter-spacing:.04em!important}',
    '@media (pointer:coarse){.fxg-stage .fxg-btn{min-height:44px}}',
    '@media (prefers-reduced-motion:reduce){.fxg-stage *,.fxg-stage{transition:none!important}}'
  ].join('');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  const probe = { c: null };
  function normColor(v, fallback) {
    try {
      if (!probe.c) probe.c = document.createElement('canvas').getContext('2d');
      probe.c.fillStyle = fallback;
      probe.c.fillStyle = v || fallback;
      return probe.c.fillStyle;
    } catch (e) { return fallback; }
  }
  function luminance(c) {
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    if (!m) { const r = /rgba?\(([^)]+)\)/.exec(c); if (!r) return 1; const p = r[1].split(',').map(Number); return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255; }
    const n = parseInt(m[1], 16);
    return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  }
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n, d) => normColor((cs.getPropertyValue(n) || '').trim(), d);
    const t = {
      bg: g('--bg', '#ffffff'), bg2: g('--bg-2', '#f4f2ee'), ink: g('--ink', '#121212'),
      ink2: g('--ink-2', '#4b4b4b'), ink3: g('--ink-3', '#8a8a8a'), line: g('--line', '#e7e4de'),
      accent: g('--accent', '#e8962c'), accentInk: g('--accent-ink', '#a35f06'),
      mono: (cs.getPropertyValue('--font-mono') || '').trim() || 'ui-monospace, SFMono-Regular, Menlo, monospace'
    };
    t.dark = luminance(t.bg2) < 0.35;
    t.accentText = t.dark ? t.accent : t.accentInk;   // accent-ink is tuned for light grounds
    return t;
  }
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, String(v)); } catch (e) { /* private mode */ } }
  };
  function mq(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const crisp = y => Math.round(y) + 0.5;

  const KEY_BEST = 'fxg.plunger.best';
  function tier(ms) {
    if (ms < 160) return 'Suspiciously fast. Are you a photogate?';
    if (ms < 250) return 'A respectable human.';
    if (ms < 400) return 'The crystal is now a different protein.';
    return 'The protein has retired.';
  }
  function ratioLine(ms) {
    const r = Math.round(ms / 10);
    if (r <= 1) return 'about as fast as a falling stick. suspicious.';
    return '~' + r + '× slower than a falling stick';
  }

  function mount(host) {
    injectStyle();
    const saved = Array.prototype.slice.call(host.childNodes);
    const prevPos = host.style.position;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    while (host.firstChild) host.removeChild(host.firstChild);

    const reduced = mq('(prefers-reduced-motion: reduce)');
    const coarse = mq('(pointer: coarse)');
    const rand = Math.random;

    // ---- DOM
    const root = h('div', 'fxg-stage fxg-plunger');
    root.tabIndex = -1;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Beat the plunger: a reaction-time game');
    const cv = h('canvas', 'fxg-cv');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'A gravity-drop plunger: a sample loop holding a protein crystal hangs on a vertical rail above a purple dewar of liquid nitrogen, with a pipette of ligand beside it.');
    const ctx = cv.getContext('2d');

    const ro = h('dl', 'fxg-ro');
    ro.setAttribute('aria-hidden', 'true');
    ro.appendChild(h('dt', null, 'best'));
    const rBest = ro.appendChild(h('dd', null, '—'));
    ro.appendChild(h('dt', null, 'last'));
    const rLast = ro.appendChild(h('dd', null, '—'));

    const bar = h('div', 'fxg-bar');
    const btnStart = h('button', 'fxg-btn', 'start');
    btnStart.type = 'button';
    if (!coarse) { const kb = btnStart.appendChild(h('span', 'fxg-kbd', '↵')); kb.setAttribute('aria-hidden', 'true'); }
    const hint = h('span', 'fxg-hint');
    hint.setAttribute('aria-hidden', 'true');
    bar.appendChild(btnStart); bar.appendChild(hint);

    const card = h('div', 'fxg-card');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', 'Reaction result');
    const head = card.appendChild(h('div', 'fxg-head'));
    const cLabel = head.appendChild(h('span', 'fxg-k'));
    const cBest = head.appendChild(h('span', 'fxg-k'));
    const row = card.appendChild(h('div', 'fxg-row'));
    const stats = row.appendChild(h('div', 'fxg-stats'));
    const s1 = stats.appendChild(h('div', 'fxg-stat'));
    s1.appendChild(h('span', 'fxg-k', 'you'));
    const cYou = s1.appendChild(h('span', 'fxg-v'));
    const s2 = stats.appendChild(h('div', 'fxg-stat'));
    s2.appendChild(h('span', 'fxg-k', 'the plunger'));
    const cPl = s2.appendChild(h('span', 'fxg-v is-dim'));
    cPl.appendChild(document.createTextNode('<10'));
    cPl.appendChild(h('small', null, 'ms'));
    const cMsg = card.appendChild(h('div', 'fxg-msg'));
    const cSub = card.appendChild(h('div', 'fxg-sub'));
    const acts = card.appendChild(h('div', 'fxg-actions'));
    const btnAgain = acts.appendChild(h('button', 'fxg-btn', 'again'));
    btnAgain.type = 'button';

    const live = h('div', 'fxg-sr');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');

    root.appendChild(cv); root.appendChild(ro); root.appendChild(bar);
    root.appendChild(card); root.appendChild(live);
    host.appendChild(root);

    // ---- state
    let T = readTokens();
    let W = 0, H = 0, dpr = 1;
    let L = {};                                   // layout
    let mode = 'idle';  // idle | reset | wait | cue | drop | result
    let early = false, rt = null;
    let cueAt = 0, cueDrawTs = null, cuePaintTs = null;
    let carriage = 0;                             // 0 = top, 1 = in the dewar
    let dropT0 = 0, resetT0 = 0, resetFrom = 1, splashT0 = -1, cueFlashT0 = 0;
    let attempts = 0, history = [];               // last 5: ms or null (too early)
    let best = parseFloat(store.get(KEY_BEST));
    if (!isFinite(best)) best = null;
    let raf = 0, inView = true, alive = true, now = 0, cardTimer = 0, idleTimer = 0;
    // offscreen = scrolled away (IO) or covered by the project overlay
    const html = document.documentElement;
    let ioIn = true, overlayOpen = html.classList.contains('pv-open');
    inView = ioIn && !overlayOpen;
    // the site's motion switch: idle mist holds still, games still play
    let motionOff = html.classList.contains('motion-off');
    let mistT = 3.1;                              // mist clock (s); 3.1 = the static reduced-motion frame
    const puffs = [];

    function say(msg) { live.textContent = ''; setTimeout(() => { if (alive) live.textContent = msg; }, 30); }

    // ---- layout
    function layout() {
      const r = root.getBoundingClientRect();
      W = Math.max(220, Math.round(r.width)); H = Math.max(260, Math.round(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      root.classList.toggle('fxg--narrow', W < 400);
      root.classList.toggle('fxg--tiny', W < 340);
      const cx = Math.round(W * 0.5) + 0.5;
      const rx = Math.round(clamp(W * 0.18, 56, 80));
      const benchY = H - 64;
      const dewH = Math.round(clamp(H * 0.15, 52, 66));
      const rimY = benchY - dewH;                  // rim ellipse centre
      const ry = Math.round(rx * 0.24);
      const surfY = rimY + 5;
      const mountY = 34;
      const cTop = mountY + 30;                   // carriage centre at the top
      const rod = Math.round(clamp(H * 0.22, 74, 96));
      const loopTop = cTop + 9 + rod + 9;         // loop centre when up
      const loopBot = rimY + ry + 10;             // loop centre when plunged (hidden by the dewar wall)
      const cBot = cTop + (loopBot - loopTop);
      L = { cx, rx, ry, benchY, rimY, surfY, mountY, cTop, cBot, rod, loopTop, loopBot, dewH,
        pipTip: [cx + 12, loopTop - 13], pipBase: [cx + Math.min(84, W * 0.2), loopTop - 78] };
      draw();
    }

    // ---- drawing helpers
    function text(str, x, y, color, align, size, weight) {
      ctx.font = (weight || 400) + ' ' + (size || 10) + 'px ' + T.mono;
      ctx.textAlign = align || 'left';
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
      return ctx.measureText(str).width;
    }
    function hatch(x0, x1, y, down) {
      ctx.beginPath();
      for (let x = x0; x < x1; x += 7) { ctx.moveTo(x, y); ctx.lineTo(x - 6, y + (down ? 7 : -7)); }
      ctx.stroke();
    }
    function purple() { return T.dark ? { body: '#6f56c4', rim: '#8d78d8', hole: '#3a2b78' } : { body: '#a28cf0', rim: '#c3b3fa', hole: '#6a54c4' }; }
    function ln2() { return T.dark ? '#2b2f4d' : '#eef0fb'; }

    function drawCorners() {
      ctx.strokeStyle = T.ink; ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
      const m = 6.5, l = 8;
      ctx.beginPath();
      ctx.moveTo(m, m + l); ctx.lineTo(m, m); ctx.lineTo(m + l, m);
      ctx.moveTo(W - m - l, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + l);
      ctx.moveTo(m, H - m - l); ctx.lineTo(m, H - m); ctx.lineTo(m + l, H - m);
      ctx.moveTo(W - m - l, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - l);
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    function carriageY() { return L.cTop + (L.cBot - L.cTop) * carriage; }

    function drawRig(lineA) {
      const c = ctx, cx = L.cx;
      // fixed support at the top
      c.strokeStyle = T.ink; c.globalAlpha = lineA;
      c.beginPath(); c.moveTo(cx - 26, crisp(L.mountY - 8)); c.lineTo(cx + 26, crisp(L.mountY - 8)); c.stroke();
      c.globalAlpha = lineA * 0.4; hatch(cx - 24, cx + 30, crisp(L.mountY - 8), false);
      c.globalAlpha = lineA;
      c.fillStyle = T.bg2;
      c.beginPath(); c.rect(cx - 12, crisp(L.mountY - 8), 24, 10); c.fill(); c.stroke();
      // rail
      c.beginPath();
      c.moveTo(cx - 3, L.mountY + 2); c.lineTo(cx - 3, L.cBot + 13);
      c.moveTo(cx + 3, L.mountY + 2); c.lineTo(cx + 3, L.cBot + 13);
      c.stroke();
      c.beginPath(); c.rect(cx - 8, crisp(L.cBot + 12), 16, 5); c.fillStyle = T.bg2; c.fill(); c.stroke();
    }
    function drawSample(y) {   // y = carriage centre; draws rod, pin, loop + crystal
      const c = ctx, cx = L.cx, yLoop = y + 9 + L.rod + 9;
      c.strokeStyle = T.ink; c.globalAlpha = 0.85; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(cx, y + 9); c.lineTo(cx, yLoop - 16); c.stroke();
      c.lineWidth = 1;
      // magnetic base + pin
      c.fillStyle = T.dark ? T.ink3 : T.ink2;
      c.fillRect(cx - 3, yLoop - 18, 6, 5);
      c.beginPath(); c.moveTo(cx + 0.5, yLoop - 13); c.lineTo(cx + 0.5, yLoop - 6.5); c.stroke();
      // nylon loop
      c.beginPath(); c.ellipse(cx + 0.5, yLoop, 5.5, 6.5, 0, 0, 6.2832); c.stroke();
      c.globalAlpha = 1;
      // crystal: a small faceted rhomb
      const flashing = mode === 'cue';
      const k = flashing ? 1 : 0;
      c.beginPath();
      c.moveTo(cx + 0.5, yLoop - 4); c.lineTo(cx + 3.5, yLoop - 1); c.lineTo(cx + 2.5, yLoop + 3.5);
      c.lineTo(cx - 1.5, yLoop + 3.5); c.lineTo(cx - 2.5, yLoop - 0.5); c.closePath();
      c.fillStyle = k ? T.accent : (T.dark ? '#b7c4e8' : '#cfd8f2');
      c.fill(); c.strokeStyle = T.ink; c.globalAlpha = 0.8; c.stroke(); c.globalAlpha = 1;
      if (flashing) {
        const tt = (now - cueFlashT0) / 1000;
        const pulse = reduced ? 0.5 : (tt * 1.6) % 1;
        c.strokeStyle = T.accent; c.lineWidth = 1.25;
        c.globalAlpha = 1 - pulse; c.beginPath(); c.arc(cx + 0.5, yLoop, 9 + pulse * 14, 0, 6.2832); c.stroke();
        c.globalAlpha = 1;
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + 0.39, r0 = 10, r1 = 15;
          c.moveTo(cx + 0.5 + Math.cos(a) * r0, yLoop + Math.sin(a) * r0);
          c.lineTo(cx + 0.5 + Math.cos(a) * r1, yLoop + Math.sin(a) * r1);
        }
        c.stroke(); c.lineWidth = 1;
      }
      return yLoop;
    }
    function drawCarriage(y) {
      const c = ctx, cx = L.cx;
      c.strokeStyle = T.ink; c.globalAlpha = 0.85; c.fillStyle = T.dark ? T.bg : '#ffffff';
      c.beginPath(); c.rect(cx - 11, crisp(y - 9), 22, 18); c.fill(); c.stroke();
      c.fillStyle = T.ink;
      c.beginPath(); c.arc(cx - 6, y - 4, 1.1, 0, 6.2832); c.arc(cx + 6, y - 4, 1.1, 0, 6.2832); c.fill();
      c.globalAlpha = 1;
    }
    function drawPipette() {
      const c = ctx, [bx, by] = L.pipBase, [tx, ty] = L.pipTip;
      const ang = Math.atan2(ty - by, tx - bx), len = Math.hypot(tx - bx, ty - by);
      c.save();
      c.translate(tx, ty); c.rotate(ang);
      c.strokeStyle = T.ink; c.globalAlpha = 0.8; c.fillStyle = T.dark ? T.bg : '#ffffff';
      // tip → barrel (drawn pointing along +x from the base, so mirror)
      c.beginPath();
      c.moveTo(0, -0.8); c.lineTo(-len * 0.45, -3); c.lineTo(-len, -3.5); c.lineTo(-len, 3.5); c.lineTo(-len * 0.45, 3); c.lineTo(0, 0.8); c.closePath();
      c.fill(); c.stroke();
      // liquid column
      c.globalAlpha = 0.9; c.fillStyle = T.accent;
      c.beginPath(); c.moveTo(-len * 0.45 - 4, -2); c.lineTo(-len * 0.8, -2.4); c.lineTo(-len * 0.8, 2.4); c.lineTo(-len * 0.45 - 4, 2); c.closePath();
      c.globalAlpha = 0.35; c.fill();
      c.restore();
      c.globalAlpha = 1;
      // the hanging droplet
      if (mode === 'idle' || mode === 'wait' || mode === 'reset' || (mode !== 'cue' && early)) {
        const wob = mode === 'wait' && !reduced ? Math.sin(now * 0.012) * 0.25 : 0;
        const r = 2.4 + wob;
        c.beginPath(); c.arc(tx, ty + r + 0.5, r, 0, 6.2832);
        c.fillStyle = T.accent; c.globalAlpha = 0.75; c.fill(); c.globalAlpha = 1;
        c.strokeStyle = T.ink; c.globalAlpha = 0.6; c.stroke(); c.globalAlpha = 1;
      }
    }
    function drawDewarBack() {
      const c = ctx, cx = L.cx, P = purple();
      // rim top (foam ring) and the opening
      c.beginPath(); c.ellipse(cx, L.rimY, L.rx, L.ry, 0, 0, 6.2832);
      c.fillStyle = P.rim; c.fill();
      c.strokeStyle = T.ink; c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1;
      const irx = L.rx * 0.66, iry = L.ry * 0.62;
      c.beginPath(); c.ellipse(cx, L.rimY, irx, iry, 0, 0, 6.2832);
      c.fillStyle = P.hole; c.fill();
      c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1;
      // liquid nitrogen surface just below the rim
      c.save();
      c.beginPath(); c.ellipse(cx, L.rimY, irx, iry, 0, 0, 6.2832); c.clip();
      c.beginPath(); c.ellipse(cx, L.surfY, irx * 0.96, iry * 0.86, 0, 0, 6.2832);
      c.fillStyle = ln2(); c.fill();
      if (splashT0 >= 0 && !reduced) {
        const tt = (now - splashT0) / 1000;
        for (let i = 0; i < 3; i++) {
          const q = tt * 1.4 - i * 0.22;
          if (q <= 0 || q >= 1) continue;
          c.beginPath(); c.ellipse(cx, L.surfY, 3 + q * irx, 1 + q * iry * 0.9, 0, 0, 6.2832);
          c.strokeStyle = T.ink; c.globalAlpha = 0.45 * (1 - q); c.stroke();
        }
        c.globalAlpha = 1;
      }
      c.restore();
    }
    function drawDewarFront() {
      const c = ctx, cx = L.cx, P = purple(), x0 = cx - L.rx, x1 = cx + L.rx;
      c.beginPath();
      c.moveTo(x0, L.rimY);
      c.ellipse(cx, L.rimY, L.rx, L.ry, 0, Math.PI, 0, true);   // front half of the rim
      c.lineTo(x1, L.benchY - L.ry * 0.5);
      c.ellipse(cx, L.benchY - L.ry * 0.5, L.rx, L.ry * 0.5, 0, 0, Math.PI, false);
      c.closePath();
      c.fillStyle = P.body; c.fill();
      c.strokeStyle = T.ink; c.globalAlpha = 0.7; c.stroke();
      // a soft vertical shade so it reads as a cylinder
      c.globalAlpha = T.dark ? 0.18 : 0.12; c.fillStyle = '#000';
      c.beginPath();
      c.moveTo(x1 - L.rx * 0.32, L.rimY + L.ry * 0.93);
      c.lineTo(x1 - L.rx * 0.32, L.benchY - L.ry * 0.05);
      c.lineTo(x1 - 0.5, L.benchY - L.ry * 0.5); c.lineTo(x1 - 0.5, L.rimY);
      c.ellipse(cx, L.rimY, L.rx - 0.5, L.ry, 0, 0, 0.35, false);
      c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
    function drawMist() {
      const c = ctx, cx = L.cx, irx = L.rx * 0.66, n = 6;
      const t = reduced ? 3.1 : mistT;
      c.strokeStyle = T.dark ? T.ink2 : T.ink3; c.lineWidth = 1; c.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const u = ((t * 0.11 + i * 0.173 + (i % 2) * 0.41) % 1);
        const x = cx + (i / (n - 1) - 0.5) * irx * 1.3;
        const y = L.surfY - 4 - u * 64;
        const sway = Math.sin(t * 0.7 + i * 1.9) * 5 + u * (i % 2 ? 9 : -9);
        c.globalAlpha = Math.sin(Math.PI * u) * (T.dark ? 0.32 : 0.38);
        c.beginPath();
        c.moveTo(x + sway * 0.4, y + 12);
        c.bezierCurveTo(x + sway - 5, y + 5, x - sway * 0.6 + 5, y - 4, x + sway * 0.7, y - 14);
        c.stroke();
      }
      c.globalAlpha = 1; c.lineCap = 'butt';
    }
    function puffR(p) {
      const q = p.life / p.max;
      const grow = 1 - Math.pow(1 - Math.min(1, q / 0.3), 2);
      const shrink = q < 0.5 ? 1 : 1 - Math.pow((q - 0.5) / 0.5, 1.5);
      return (p.r0 + (p.r1 - p.r0) * grow) * shrink;
    }
    function drawPuffs() {
      if (!puffs.length) return;
      const c = ctx;
      for (let pass = 0; pass < 2; pass++) {
        if (pass === 0) { c.lineWidth = 2; c.strokeStyle = T.ink; c.globalAlpha = T.dark ? 0.45 : 0.36; }
        else { c.globalAlpha = 1; c.fillStyle = T.bg2; }
        c.beginPath();
        for (let i = 0; i < puffs.length; i++) {
          const p = puffs[i], r = puffR(p) - (pass ? 0.6 : 0);
          if (r < 0.5) continue;
          c.moveTo(p.x + r, p.y); c.arc(p.x, p.y, r, 0, 6.2832);
        }
        if (pass === 0) c.stroke(); else c.fill();
      }
      c.globalAlpha = 1; c.lineWidth = 1;
    }
    function splash() {
      splashT0 = now;
      if (reduced) return;
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + (rand() - 0.5) * 2.2;
        const sp = 40 + rand() * 90;
        puffs.push({ x: L.cx + (rand() - 0.5) * L.rx * 0.8, y: L.surfY - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.9,
          r0: 2 + rand() * 2, r1: 6 + rand() * 8, life: 0, max: 0.9 + rand() * 0.7 });
      }
    }
    function stepPuffs(dt) {
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life += dt;
        if (p.life >= p.max) { puffs.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.exp(-3 * dt); p.vy = p.vy * Math.exp(-2.6 * dt) - 6 * dt;
      }
    }
    function drawSpark() {   // last five attempts, top-left
      const c = ctx, x0 = 18, y0 = 22, bw = 13, gap = 9, bh = 26;
      c.textBaseline = 'middle';
      text('LAST 5', x0, y0, T.ink3, 'left', 10);
      const base = crisp(y0 + 12 + bh);
      c.strokeStyle = T.ink; c.globalAlpha = 0.35;
      c.beginPath(); c.moveTo(x0, base); c.lineTo(x0 + 5 * bw + 4 * gap, base); c.stroke();
      c.globalAlpha = 1;
      for (let i = 0; i < 5; i++) {
        const v = history[i], x = x0 + i * (bw + gap);
        if (v === undefined) {
          c.strokeStyle = T.ink; c.globalAlpha = 0.35;
          c.beginPath(); c.moveTo(x + bw / 2, base); c.lineTo(x + bw / 2, base + 3); c.stroke();
          c.globalAlpha = 1;
          continue;
        }
        if (v === null) {
          c.strokeStyle = T.ink3; c.beginPath();
          c.moveTo(x + 3, base - 9); c.lineTo(x + bw - 3, base - 3); c.moveTo(x + bw - 3, base - 9); c.lineTo(x + 3, base - 3); c.stroke();
          continue;
        }
        const hh = Math.max(2, Math.min(1, v / 600) * bh);
        const isBest = best != null && Math.round(v) === Math.round(best);
        c.fillStyle = isBest ? T.accent : T.ink; c.globalAlpha = isBest ? 1 : (i === history.length - 1 ? 0.75 : 0.4);
        c.fillRect(x, base - hh, bw, hh);
        c.globalAlpha = 1;
        text(String(Math.round(v)), x + bw / 2, base + 10, i === history.length - 1 ? T.ink : T.ink3, 'center', 10);
      }
      c.textBaseline = 'alphabetic';
    }

    function draw() {
      if (!W) return;
      const c = ctx, cx = L.cx;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalAlpha = 1; c.setLineDash([]); c.lineWidth = 1;
      c.fillStyle = T.bg2; c.fillRect(0, 0, W, H);
      try { c.letterSpacing = '0.06em'; } catch (e) { /* older engines */ }

      // bench
      c.strokeStyle = T.ink; c.globalAlpha = 0.7;
      c.beginPath(); c.moveTo(0, crisp(L.benchY)); c.lineTo(W, crisp(L.benchY)); c.stroke();
      c.globalAlpha = 0.28; hatch(-2, W + 10, crisp(L.benchY) + 1, true);
      c.globalAlpha = 1;

      drawSpark();
      drawRig(0.7);
      drawDewarBack();
      const y = carriageY();
      const yLoop = drawSample(y);
      drawCarriage(y);
      drawDewarFront();
      drawMist();
      drawPuffs();
      drawPipette();

      // dimension: loop → liquid, "< 10 ms"
      const dx = cx + Math.max(40, L.rx * 0.66 + 14) + 0.5, yA = L.loopTop, yB = L.surfY;
      c.strokeStyle = T.ink; c.globalAlpha = 0.55;
      c.beginPath();
      c.moveTo(cx + 9, crisp(yA)); c.lineTo(dx + 5, crisp(yA));
      c.moveTo(dx - 12, crisp(yB)); c.lineTo(dx + 5, crisp(yB));
      c.moveTo(dx, yA); c.lineTo(dx, yB);
      c.stroke();
      c.fillStyle = T.ink;
      c.beginPath(); c.moveTo(dx, yA); c.lineTo(dx - 3, yA + 6); c.lineTo(dx + 3, yA + 6); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(dx, yB); c.lineTo(dx - 3, yB - 6); c.lineTo(dx + 3, yB - 6); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.textBaseline = 'middle';
      const ym = (yA + yB) / 2;
      c.fillStyle = T.bg2; c.fillRect(dx + 6, ym - 15, 64, 30);
      text('PLUNGE', dx + 9, ym - 6, T.ink3, 'left', 10);
      text('< 10 MS', dx + 9, ym + 7, T.ink, 'left', 11, 500);

      // labels
      const lx = cx - L.rx - 12, ly = L.rimY + L.dewH * 0.42;
      text('LN₂', lx, ly, T.ink2, 'right', 10, 500);
      text('−196 °C', lx, ly + 14, T.ink3, 'right', 10);
      if (mode === 'cue') {
        text('MIX!', cx - 22, yLoop + 1, T.accentText, 'right', 26, 500);
      } else if (carriage < 0.02 && mode !== 'drop') {
        c.strokeStyle = T.ink; c.globalAlpha = 0.45;
        c.beginPath(); c.moveTo(cx - 9, crisp(yLoop)); c.lineTo(cx - 26, crisp(yLoop)); c.stroke();
        c.globalAlpha = 1;
        text(mode === 'wait' ? 'WAIT FOR IT' : 'CRYSTAL', cx - 30, yLoop + 0.5, T.ink3, 'right', 10);
      }
      c.textBaseline = 'alphabetic';
      drawCorners();
    }

    // ---- HUD
    const shown = {};
    function setText(node, key, val) { if (shown[key] !== val) { shown[key] = val; node.textContent = val; } }
    function updateHud() {
      setText(rBest, 'best', best != null ? Math.round(best) + ' ms' : '—');
      const lastV = history.length ? history[history.length - 1] : undefined;
      setText(rLast, 'last', lastV === undefined ? '—' : lastV === null ? 'early' : Math.round(lastV) + ' ms');
      let ht = '';
      if (mode === 'idle') ht = W < 340 ? 'then tap on mix' : coarse ? 'then tap the moment it says mix' : 'then space the moment it says mix';
      else if (mode === 'reset') ht = 'loading a fresh crystal…';
      else if (mode === 'wait') ht = 'waiting for the ligand…';
      else if (mode === 'cue') ht = coarse ? 'tap!' : 'space!';
      setText(hint, 'hint', ht);
    }

    // ---- flow
    function start() {
      clearTimeout(cardTimer);
      card.classList.remove('is-on');
      bar.classList.remove('is-off');
      btnStart.style.visibility = 'hidden';
      early = false; rt = null; cueDrawTs = cuePaintTs = null; splashT0 = -1;
      puffs.length = 0;
      try { root.focus({ preventScroll: true }); } catch (e) { root.focus(); }
      if (carriage > 0.001) {
        mode = 'reset'; resetT0 = performance.now(); resetFrom = carriage;
        if (reduced) { carriage = 0; beginWait(); }
      } else beginWait();
      updateHud();
      kick();
    }
    function beginWait() {
      mode = 'wait';
      cueAt = performance.now() + 1500 + rand() * 2500;
      say('Waiting for the ligand. Press Space or tap the moment it says mix.');
      updateHud();
    }
    function press(e) {
      if (mode !== 'wait' && mode !== 'cue') return false;
      let tIn = performance.now();
      if (e && typeof e.timeStamp === 'number' && e.timeStamp > 0 && e.timeStamp <= tIn + 1) tIn = e.timeStamp;
      if (mode === 'wait') { early = true; rt = null; }
      else {
        const ref = cuePaintTs != null ? cuePaintTs : cueDrawTs;
        rt = Math.max(1, tIn - ref);
      }
      mode = 'drop'; dropT0 = performance.now();
      if (reduced) { carriage = 1; landed(); }
      updateHud();
      kick();
      return true;
    }
    function landed() {
      splash();
      const delay = reduced ? 0 : 520;
      cardTimer = setTimeout(result, delay);
    }
    function result() {
      if (!alive) return;
      mode = 'result';
      attempts++;
      history.push(early ? null : rt);
      if (history.length > 5) history.shift();
      let newBest = false;
      if (!early) {
        const prev = best;
        if (prev == null || rt < prev) { best = rt; newBest = prev != null; store.set(KEY_BEST, Math.round(rt)); }
      }
      cLabel.textContent = 'attempt ' + (attempts < 10 ? '0' : '') + attempts;
      cBest.innerHTML = '';
      if (newBest) cBest.appendChild(h('b', null, 'new best'));
      else if (best != null) cBest.textContent = 'best ' + Math.round(best) + ' ms';
      cYou.innerHTML = '';
      if (early) {
        cYou.appendChild(document.createTextNode('early'));
        cYou.classList.add('is-dim');
        cMsg.textContent = 'Too early. You froze it before it reacted. Science is ruined.';
        cSub.textContent = 'wait for mix, then go';
        say('Too early. You froze it before it reacted. Science is ruined.');
      } else {
        const ms = Math.round(rt);
        cYou.classList.remove('is-dim');
        cYou.appendChild(document.createTextNode(String(ms)));
        cYou.appendChild(h('small', null, 'ms'));
        cMsg.textContent = tier(rt);
        cSub.textContent = ratioLine(rt);
        say('You: ' + ms + ' milliseconds. The plunger: under 10. ' + ratioLine(rt).replace('~', 'About ').replace('×', ' times') + '. ' + tier(rt));
      }
      card.classList.add('is-on');
      bar.classList.add('is-off');
      try { btnAgain.focus({ preventScroll: true }); } catch (e) { btnAgain.focus(); }
      updateHud();
      draw();
    }
    function abort() {   // scrolled away / tab hidden mid-attempt: no score
      if (mode === 'wait' || mode === 'cue') {
        mode = 'idle'; early = false;
        btnStart.style.visibility = '';
        updateHud(); draw();
      }
    }

    // ---- loop
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    function isCalm() {
      return (mode === 'idle' || mode === 'result') && !puffs.length && (splashT0 < 0 || now - splashT0 > 900);
    }
    function needsFrame() {
      return mode === 'wait' || mode === 'cue' || mode === 'drop' || mode === 'reset' || puffs.length > 0 ||
        (splashT0 >= 0 && now - splashT0 < 900) || !(reduced || motionOff);
    }
    let lastTs = 0, lastDraw = 0;
    function frame(ts) {
      raf = 0;
      if (!alive) return;
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 1 / 60;
      lastTs = ts; now = ts;
      if (mode === 'cue' && cueDrawTs != null && cuePaintTs == null) cuePaintTs = ts;   // the cue frame is on screen
      if (mode === 'wait' && performance.now() >= cueAt) {
        mode = 'cue'; cueDrawTs = ts; cueFlashT0 = ts; cuePaintTs = null;
        say('Mix!');
        updateHud();
      }
      if (mode === 'reset') {
        const q = Math.min(1, (performance.now() - resetT0) / 520);
        carriage = resetFrom * (1 - easeOut(q));
        if (q >= 1) { carriage = 0; beginWait(); }
      }
      if (mode === 'drop' && carriage < 1) {
        const tt = (performance.now() - dropT0) / 1000;
        const a = 2 / (0.17 * 0.17);               // reaches the bottom in 170 ms
        carriage = Math.min(1, 0.5 * a * tt * tt);
        if (carriage >= 1) landed();
      }
      stepPuffs(dt);
      // when nothing but the mist is moving, ~30 fps is plenty: pace it with a
      // timer instead of waking on every vsync
      const calm = isCalm();
      if (!(motionOff && calm)) mistT += dt;
      if (!calm || ts - lastDraw > 30) { lastDraw = ts; draw(); }
      if (!needsFrame()) return;
      if (calm) { clearTimeout(idleTimer); idleTimer = setTimeout(() => { idleTimer = 0; kick(); }, 33); }
      else kick();
    }
    function kick() {
      if (raf || !alive || !inView || document.hidden) return;
      raf = requestAnimationFrame(frame);
    }
    function pause() {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      raf = 0; idleTimer = 0; lastTs = 0;
    }
    function syncView() {
      inView = ioIn && !overlayOpen;
      if (inView) kick(); else { pause(); abort(); }
    }

    // ---- input
    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('button')) return;
      if (mode === 'wait' || mode === 'cue') { e.preventDefault(); press(e); }
    }
    function onClick(e) {
      if (e.target !== cv) return;
      if (mode === 'idle') start();
    }
    function onKeyDown(e) {
      const k = e.key, isSpace = k === ' ' || k === 'Spacebar';
      if (!isSpace && k !== 'Enter') return;
      if (mode === 'wait' || mode === 'cue') { e.preventDefault(); if (!e.repeat) press(e); return; }
      if (mode === 'drop' || mode === 'reset') { e.preventDefault(); return; }
      const onBtn = e.target && e.target.tagName === 'BUTTON';
      if ((mode === 'idle' || mode === 'result') && !onBtn) { e.preventDefault(); start(); }
    }
    function onTheme() { T = readTokens(); draw(); }
    function onVis() { if (document.hidden) { pause(); abort(); } else kick(); }
    function onOverlay(e) { overlayOpen = !!(e && e.detail && e.detail.open); syncView(); }
    function onMotion(e) {
      motionOff = !!(e && e.detail && e.detail.off);
      // idle: settle on the same still frame reduced motion shows
      if (motionOff && isCalm()) { pause(); mistT = 3.1; draw(); }
      else kick();
    }

    btnStart.addEventListener('click', start);
    btnAgain.addEventListener('click', start);
    root.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    document.addEventListener('themechange', onTheme);
    document.addEventListener('scentchange', onTheme);
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('overlaychange', onOverlay);
    document.addEventListener('motionchange', onMotion);

    let rObs = null, iObs = null;
    if ('ResizeObserver' in window) { rObs = new ResizeObserver(() => layout()); rObs.observe(root); }
    else window.addEventListener('resize', layout);
    if ('IntersectionObserver' in window) {
      // edge-adjacent (ratio 0) counts as offscreen; the 0.01 step makes sure
      // a stage that starts edge-adjacent still reports when it scrolls in
      iObs = new IntersectionObserver(entries => {
        const e = entries[entries.length - 1];
        ioIn = e.isIntersecting && e.intersectionRatio > 0;
        syncView();
      }, { threshold: [0, 0.01] });
      iObs.observe(root);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) draw(); });

    layout();
    updateHud();
    kick();

    return {
      destroy() {
        alive = false;
        pause();
        clearTimeout(cardTimer);
        if (rObs) rObs.disconnect(); else window.removeEventListener('resize', layout);
        if (iObs) iObs.disconnect();
        document.removeEventListener('themechange', onTheme);
        document.removeEventListener('scentchange', onTheme);
        document.removeEventListener('visibilitychange', onVis);
        document.removeEventListener('overlaychange', onOverlay);
        document.removeEventListener('motionchange', onMotion);
        if (root.parentNode) root.parentNode.removeChild(root);
        saved.forEach(n => host.appendChild(n));
        host.style.position = prevPos;
      }
    };
  }

  FX.plunger = { mount: mount };
})();
