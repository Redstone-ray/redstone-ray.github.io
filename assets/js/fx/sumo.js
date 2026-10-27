/* Stay in the ring — a top-down mini-sumo match against Richard's old robot.
   FX.sumo.mount(el) -> { destroy() }
   World units: the dohyo's outer radius is 1. Everything scales from that. */
(function () {
  'use strict';
  const FX = (window.FX = window.FX || {});

  // ---------- tuning ----------
  const ROUND = 15;            // seconds to survive
  const STORE = 'rd.sumo.best';
  const LINE = 0.055;          // white tawara line width
  const HL = 0.125;            // robot half length (body)
  const HW = 0.135;            // robot half width
  const PLOW = 0.03;           // plow lip beyond the body front
  const RP = 0.072;            // puck radius
  const CONE = 0.21;           // ultrasonic half angle (rad, ~12 deg)
  const RANGE = 1.15;          // ultrasonic range
  const V_CHARGE = 1.15, W_SEARCH = 3.3, W_TRACK = 1.45, A_FWD = 3.4, A_BRAKE = 8;
  const LOCK = 0.16;           // seconds to confirm an echo before charging (the tell)
  const V_P = 0.9, A_P = 7.5;  // player
  const MR = 5, MP = 1;        // masses
  const STEP = 1 / 120;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- styles (scoped, injected once) ----------
  const CSS = `
.sumo{position:absolute;inset:0;overflow:hidden;background:var(--bg-2,#f4f2ee);border-radius:inherit;
  font-family:var(--font-mono,ui-monospace,monospace);color:var(--ink-2,#4b4b4b);
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.sumo__surface{position:absolute;inset:0;outline:none;touch-action:manipulation}
.sumo.is-live .sumo__surface{touch-action:none;cursor:crosshair}
.sumo.is-idle .sumo__surface{cursor:pointer}
.sumo__surface:focus-visible{outline:2px solid var(--accent-ink,#a35f06);outline-offset:-6px}
.sumo canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sumo__hud{position:absolute;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;
  gap:12px;font-size:11px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase;pointer-events:none;font-variant-numeric:tabular-nums}
.sumo__hud--top{top:14px}
.sumo__hud--bot{bottom:16px;min-height:34px}
.sumo__time{color:var(--ink-3,#8a8a8a);white-space:nowrap}
.sumo__time b{font-weight:500;color:var(--ink,#121212)}
.sumo__time small{font-size:inherit}
.sumo__best{color:var(--ink-3,#8a8a8a);white-space:nowrap}
.sumo__slot{display:flex;align-items:center;flex:none}
.sumo__state{display:inline-flex;align-items:center;gap:7px;color:var(--ink-3,#8a8a8a);white-space:nowrap}
.sumo__dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7;transition:background-color .2s}
.sumo__state[data-s="charge"]{color:var(--accent-ink,#a35f06)}
.sumo__state[data-s="charge"] .sumo__dot{background:var(--accent,#e8962c);opacity:1}
.sumo__state[data-s="edge"] .sumo__dot{background:#e5484d;opacity:1}
.sumo__hint{color:var(--ink-3,#8a8a8a);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.sumo .sumo__btn{-webkit-appearance:none;appearance:none;display:inline-flex;align-items:center;margin:0;
  font:400 12px/1 var(--font-mono,ui-monospace,monospace);letter-spacing:.04em;text-transform:none;
  padding:9px 14px;min-height:34px;border:1px solid var(--ink,#121212);border-radius:var(--radius,2px);
  background:var(--bg,#fff);color:var(--ink,#121212);box-shadow:none;cursor:pointer;white-space:nowrap;
  pointer-events:auto;touch-action:manipulation;transition:background-color .2s,color .2s,border-color .2s}
.sumo .sumo__btn:hover{background:var(--ink,#121212);color:var(--bg,#fff)}
.sumo .sumo__btn:focus{outline:none}
.sumo .sumo__btn:focus-visible{outline:2px solid var(--accent-ink,#a35f06);outline-offset:2px}
.sumo .sumo__kbd{opacity:.55;margin-left:8px;font-size:10px}
.sumo:not(.is-ready) .sumo__btn,.sumo.is-ready .sumo__state{display:none}
.sumo__center{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.sumo__panel{grid-area:1/1;text-align:center;color:var(--on-tile,#f3efe7);max-width:min(72%,270px);
  transition:opacity .35s var(--ease-out,ease),transform .5s var(--ease-out,ease)}
.sumo__panel[hidden]{display:block;visibility:hidden;opacity:0;transform:translateY(6px)}
.sumo .sumo__sub{margin:0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.72}
.sumo__count{display:block;font:500 56px/1 var(--font-mono,ui-monospace,monospace);letter-spacing:-.02em;color:var(--on-tile,#f3efe7)}
.sumo__count.is-call{font-size:24px;letter-spacing:.02em;color:var(--accent-night,var(--accent,#e8962c))}
.sumo__count.is-pop{animation:sumo-pop .62s var(--ease-out,ease) both}
@keyframes sumo-pop{0%{opacity:0;transform:scale(1.35)}18%{opacity:1}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.96)}}
.sumo__count.is-call.is-pop{animation-duration:.9s}
.sumo .sumo__r1{margin:0;font:400 clamp(22px,2.4vw,28px)/1.1 var(--font-display,Georgia,serif);letter-spacing:-.005em}
.sumo .sumo__r2{margin:4px 0 0;font:italic 400 clamp(18px,2vw,22px)/1.15 var(--font-display,Georgia,serif);color:var(--accent-night,var(--accent,#e8962c))}
.sumo .sumo__r3{margin:14px 0 0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.6}
.sumo p{margin:0;max-width:none;color:inherit;font-size:inherit;line-height:inherit;letter-spacing:inherit}
.sumo__sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.sumo--full .sumo__r1.sumo__r1{font-size:clamp(26px,3vw,36px)}
@media (pointer:coarse){.sumo .sumo__btn{min-height:44px}.sumo__hud--bot{min-height:44px}}
@media (prefers-reduced-motion:reduce){
  .sumo__panel,.sumo .sumo__btn{transition:none}
  .sumo__count.is-pop{animation:none}
}`;
  let styleRefs = 0, styleEl = null;
  function addStyle() {
    if (styleRefs++ === 0) {
      styleEl = document.createElement('style');
      styleEl.id = 'fx-sumo-style';
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }
  }
  function dropStyle() { if (--styleRefs === 0 && styleEl) { styleEl.remove(); styleEl = null; } }

  function readBest() { try { const v = parseFloat(localStorage.getItem(STORE)); return isFinite(v) ? v : 0; } catch (e) { return 0; } }
  function writeBest(v) { try { localStorage.setItem(STORE, String(v)); } catch (e) { /* private mode */ } }

  // 7-segment digit map: a b c d e f g
  const SEG = { '0': 0x3f, '1': 0x06, '2': 0x5b, '3': 0x4f, '4': 0x66, '5': 0x6d, '6': 0x7d, '7': 0x07, '8': 0x7f, '9': 0x6f, '-': 0x40 };

  function mount(el, opts) {
    opts = opts || {};
    addStyle();
    const mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const mqCoarse = window.matchMedia ? matchMedia('(pointer: coarse)') : { matches: false };
    let RM = mqReduce.matches;

    // take over the mount point, remembering the static fallback
    const saved = Array.from(el.childNodes);
    const prevPos = el.style.position;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    saved.forEach(n => n.remove());

    const full = el.classList.contains('toy__stage--full');
    const root = document.createElement('div');
    root.className = 'sumo is-ready is-idle' + (full ? ' sumo--full' : '');
    root.innerHTML =
      '<div class="sumo__surface" tabindex="0" role="group" aria-label="Sumo ring. Arrow keys or W A S D move your puck. Press Enter to start.">' +
        '<canvas role="img" aria-label="Top-down view of a black sumo ring. A small pink robot with two ultrasonic eyes tries to push a white puck labelled you out of the ring."></canvas>' +
      '</div>' +
      '<div class="sumo__hud sumo__hud--top" aria-hidden="true">' +
        '<span class="sumo__time"><b>0.0</b><small> / ' + ROUND + ' s</small></span>' +
        '<span class="sumo__best"></span>' +
      '</div>' +
      '<div class="sumo__center">' +
        '<div class="sumo__panel" data-p="start"><p class="sumo__sub">survive ' + ROUND + ' seconds</p></div>' +
        '<div class="sumo__panel" data-p="count" aria-hidden="true" hidden><span class="sumo__count"></span></div>' +
        '<div class="sumo__panel" data-p="result" hidden><p class="sumo__r1"></p><p class="sumo__r2"></p><p class="sumo__r3"></p></div>' +
      '</div>' +
      '<div class="sumo__hud sumo__hud--bot">' +
        '<span class="sumo__slot">' +
          '<button type="button" class="sumo__btn" data-act="start"><span class="sumo__lbl">step in</span>' +
            (mqCoarse.matches ? '' : '<span class="sumo__kbd" aria-hidden="true">↵</span>') + '</button>' +
          '<span class="sumo__state" data-s="idle" aria-hidden="true"><i class="sumo__dot"></i><span>idle</span></span>' +
        '</span>' +
        '<span class="sumo__hint" aria-hidden="true"></span>' +
      '</div>' +
      '<p class="sumo__sr" aria-live="polite"></p>';
    el.appendChild(root);

    const $ = s => root.querySelector(s);
    const surface = $('.sumo__surface');
    const cv = $('canvas');
    const ctx = cv.getContext('2d');
    const elTime = $('.sumo__time b'), elBest = $('.sumo__best'), elState = $('.sumo__state'), elStateTxt = $('.sumo__state span');
    const elHint = $('.sumo__hint'), elLive = $('.sumo__sr');
    const pStart = $('[data-p="start"]'), pCount = $('[data-p="count"]'), pResult = $('[data-p="result"]');
    const elCount = $('.sumo__count');
    const r1 = $('.sumo__r1'), r2 = $('.sumo__r2'), r3 = $('.sumo__r3');
    const btn = $('.sumo__btn'), btnLbl = $('.sumo__lbl');
    elHint.textContent = mqCoarse.matches ? 'drag' : 'mouse · arrows';

    // tyre marks live in ring space so they survive resizes
    const marks = document.createElement('canvas');
    marks.width = marks.height = 640;
    const mctx = marks.getContext('2d');

    // ---------- theme tokens ----------
    let T = {};
    function readTokens() {
      const cs = getComputedStyle(document.documentElement);
      const g = (k, d) => (cs.getPropertyValue(k) || '').trim() || d;
      const ink = g('--ink', '#121212');
      T = {
        accent: g('--accent', '#e8962c'),
        // anything painted on the dark ring uses the night accent
        accN: cs.getPropertyValue('--accent-night').trim() || cs.getPropertyValue('--accent').trim() || '#e8962c',
        ink,
        // rim: color-mix(in srgb, var(--ink) 35%, transparent)
        rim: withAlpha(ink, 0.35, 'rgba(18,18,18,.35)'),
        line: g('--line', '#e7e4de'),
        ink3: g('--ink-3', '#8a8a8a'),
        mono: g('--font-mono', 'ui-monospace, monospace'),
        onTile: g('--on-tile', '#f3efe7'),
        dark: document.documentElement.getAttribute('data-theme') === 'filled'
      };
    }
    readTokens();

    // ---------- state ----------
    let w = 0, h = 0, dpr = 1, R = 100, cx = 0, cy = 0;
    const S = {
      phase: 'idle', t: 0, countT: 0, overT: 0, result: null, how: '',
      best: readBest(), shownTime: '',
      robot: null, puck: null,
      target: { x: 0, y: 0 }, keys: {}, mode: 'pointer',
      parts: [], pings: [], pingT: 0, shake: 0, shakeT: 0,
      lastContact: -9, contactNow: false, clock: 0
    };
    function resetBodies() {
      const side = Math.random() < 0.5 ? -1 : 1;
      S.robot = {
        x: 0.36, y: 0, a: side * Math.PI / 2 + rnd(-0.3, 0.3), v: 0, w: 0, vc: 0, wc: 0,
        state: 'wait', st: 0, sub: '', spin: side, lost: 0, lastSide: side, turnDir: 1, turnStop: 0.4,
        noise: 0, volt: 3.83, wl: 0, wr: 0, post: ''
      };
      S.puck = { x: -0.36, y: 0, vx: 0, vy: 0, fall: 0 };
      S.target.x = S.puck.x; S.target.y = S.puck.y;
      S.parts.length = 0; S.pings.length = 0; S.shake = 0;
      S.lastContact = -9;
    }
    function idleBodies() {
      resetBodies();
      const r = S.robot;
      r.x = 0; r.y = 0.5; r.a = -Math.PI / 2; r.state = 'idle';
    }
    idleBodies();
    renderBest();

    // ---------- helpers ----------
    function say(msg) { elLive.textContent = ''; setTimeout(() => { elLive.textContent = msg; }, 30); }
    function renderBest() {
      elBest.textContent = S.best > 0 ? (S.best >= ROUND ? 'best · survived' : 'best ' + S.best.toFixed(1) + ' s') : 'best —';
    }
    function setStateLabel(s) {
      const map = { idle: 'idle', wait: 'ready', search: 'search', charge: 'charge', edge: 'edge', spin: 'victory spin', demand: 'rematch?', stop: 'idle' };
      const txt = map[s] || s;
      if (elStateTxt.textContent !== txt) { elStateTxt.textContent = txt; elState.setAttribute('data-s', s); }
    }
    function showPanel(p) {
      [pStart, pCount, pResult].forEach(x => { x.hidden = x !== p; });
    }

    // ---------- sizing ----------
    function resize() {
      const nw = root.clientWidth, nh = root.clientHeight;
      if (!nw || !nh) return;
      w = nw; h = nh;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cx = w / 2; cy = h / 2;
      // keep the timer track clear of the bottom-left button slot
      const bw = mqCoarse.matches ? 86 : 100, bh = mqCoarse.matches ? 44 : 34;
      const slot = Math.hypot(Math.max(0, cx - 16 - bw), Math.max(0, h - 16 - bh - cy));
      R = clamp(Math.min(Math.min(w, h) * 0.41, slot - 10), 60, 330);
      draw();
    }

    // ---------- input ----------
    function toRing(e) {
      const r = surface.getBoundingClientRect();
      return { x: (e.clientX - r.left - cx) / R, y: (e.clientY - r.top - cy) / R };
    }
    let drag = null;
    function onMove(e) {
      if (e.pointerType === 'mouse' || (!drag && e.pointerType === 'pen' && e.pressure === 0)) {
        const p = toRing(e);
        S.target.x = p.x; S.target.y = p.y; S.mode = 'pointer';
      } else if (drag && e.pointerId === drag.id) {
        const p = toRing(e);
        S.target.x = drag.px + (p.x - drag.sx); S.target.y = drag.py + (p.y - drag.sy);
        S.mode = 'pointer';
        if (S.phase === 'live' || S.phase === 'count') e.preventDefault();
      }
    }
    function onDown(e) {
      if (e.pointerType === 'mouse') return;
      if (S.phase !== 'live' && S.phase !== 'count') return;
      const p = toRing(e);
      drag = { id: e.pointerId, sx: p.x, sy: p.y, px: S.puck.x, py: S.puck.y };
      try { surface.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      S.mode = 'pointer';
      e.preventDefault();
    }
    function onUp(e) {
      if (drag && e.pointerId === drag.id) {
        drag = null;
        S.target.x = S.puck.x + S.puck.vx * 0.05; S.target.y = S.puck.y + S.puck.vy * 0.05;
      }
    }
    const KEYMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    function keyOf(e) { return KEYMAP[e.code] || KEYMAP[e.key] || ({ w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' })[e.key]; }
    function onKeyDown(e) {
      const k = keyOf(e);
      const playing = S.phase === 'live' || S.phase === 'count';
      if (k && playing) { S.keys[k] = true; S.mode = 'keys'; e.preventDefault(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target === surface && (S.phase === 'idle' || (S.phase === 'over' && !pResult.hidden))) {
        e.preventDefault(); start();
      }
    }
    function onKeyUp(e) { const k = keyOf(e); if (k) S.keys[k] = false; }
    function onBlur() { S.keys = {}; }
    function onClick(e) {
      const b = e.target.closest('[data-act="start"]');
      if (b || (S.phase === 'idle' && surface.contains(e.target))) start();
    }

    surface.addEventListener('pointermove', onMove);
    surface.addEventListener('pointerdown', onDown);
    function onLeave(e) {
      // mouse left the stage: hold position instead of marching to the last known spot
      if (e.pointerType === 'mouse' && S.puck) { S.target.x = S.puck.x; S.target.y = S.puck.y; }
    }
    surface.addEventListener('pointerleave', onLeave);
    surface.addEventListener('pointerup', onUp);
    surface.addEventListener('pointercancel', onUp);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('keyup', onKeyUp);
    root.addEventListener('focusout', onBlur);
    root.addEventListener('click', onClick);

    // ---------- game flow ----------
    let countStep = -1;
    function start() {
      const keyboard = root.contains(document.activeElement);
      resetBodies();
      S.phase = 'count'; S.countT = 0; S.t = 0; S.overT = 0; S.result = null; S.shownTime = '';
      countStep = -1;
      root.classList.add('is-live');
      root.classList.remove('is-ready', 'is-idle');
      elTime.textContent = '0.0';
      showPanel(pCount);
      setStateLabel('wait');
      fadeMarks();
      if (keyboard) { try { surface.focus({ preventScroll: true }); } catch (e) { surface.focus(); } }
      kick();
    }
    function countdown() {
      const steps = ['3', '2', '1', 'hakkeyoi!'];
      const i = Math.min(3, Math.floor(S.countT / 0.7));
      if (i !== countStep) {
        countStep = i;
        elCount.textContent = steps[i];
        elCount.classList.toggle('is-call', i === 3);
        elCount.classList.remove('is-pop');
        void elCount.offsetWidth;
        elCount.classList.add('is-pop');
        if (i === 3) {
          S.phase = 'live'; S.t = 0;
          S.robot.state = 'search'; S.robot.st = 0;
          say('Hakkeyoi! Survive ' + ROUND + ' seconds.');
        }
      }
    }
    function finish(result) {
      if (S.phase !== 'live') return;
      S.phase = 'over'; S.result = result; S.overT = 0;
      root.classList.remove('is-live');
      drag = null; S.keys = {};
      const t = Math.min(S.t, ROUND);
      const prev = S.best;
      const isBest = t > prev + 1e-6;
      if (isBest) { S.best = t; writeBest(t); }
      const r = S.robot;
      if (result === 'win') {
        r.post = 'demand'; r.state = 'demand'; r.st = 0;
        r1.textContent = 'You survived ' + ROUND + ' s.';
        r2.textContent = 'The robot demands a rematch.';
      } else {
        r.post = 'spin';
        const pushed = S.clock - S.lastContact < 0.8;
        r1.textContent = (pushed ? 'Pushed out in ' : 'Stepped out in ') + t.toFixed(1) + ' s.';
        r2.textContent = 'Still undefeated.';
        if (!RM) addShake(4);
      }
      const fresh = isBest && (prev > 0 || result === 'win');
      r3.textContent = fresh ? 'new best' : (S.best >= ROUND ? 'best · survived' : 'best ' + S.best.toFixed(1) + ' s');
      elTime.textContent = t.toFixed(1);
      renderBest();
      say(r1.textContent + ' ' + r2.textContent + ' ' + (fresh ? 'New best.' : S.best >= ROUND ? 'You have survived before.' : 'Best: ' + S.best.toFixed(1) + ' seconds.'));
    }
    function revealResult() {
      showPanel(pResult);
      btnLbl.textContent = 'rematch';
      root.classList.add('is-ready');
      if (root.contains(document.activeElement)) {
        try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); }
      }
    }

    // ---------- simulation ----------
    function sensors(r) {
      const c = Math.cos(r.a), s = Math.sin(r.a);
      const at = (lx, ly) => Math.hypot(r.x + lx * c - ly * s, r.y + lx * s + ly * c);
      const lim = 1 - LINE + 0.005;
      return {
        fl: at(HL + PLOW * 0.5, -HW * 0.8) > lim,
        fr: at(HL + PLOW * 0.5, HW * 0.8) > lim,
        back: at(-HL, -HW * 0.8) > lim || at(-HL, HW * 0.8) > lim
      };
    }
    function see(r, p) {
      if (!p || p.fall > 0) return null;
      const ex = r.x + Math.cos(r.a) * HL, ey = r.y + Math.sin(r.a) * HL;
      const dx = p.x - ex, dy = p.y - ey, d = Math.hypot(dx, dy);
      if (d > RANGE) return null;
      const ang = wrap(Math.atan2(dy, dx) - r.a);
      const half = d > RP ? Math.asin(RP / d) : Math.PI / 2;
      if (Math.abs(ang) > CONE + half) return null;
      return { ang, d };
    }
    function setRobot(r, state) { r.state = state; r.st = 0; r.sub = ''; r.lost = 0; }

    function think(r, dt) {
      r.st += dt;
      const sen = sensors(r);
      const tgt = S.phase === 'live' ? see(r, S.puck) : null;
      const toC = wrap(Math.atan2(-r.y, -r.x) - r.a);

      const roaming = r.state === 'search' || r.state === 'roam' || r.state === 'charge' || r.state === 'lock' || r.state === 'demand';
      if ((sen.fl || sen.fr) && roaming && r.v >= -0.05) {
        setRobot(r, 'edge'); r.sub = 'back';
        r.turnDir = sen.fl && !sen.fr ? 1 : sen.fr && !sen.fl ? -1 : (toC >= 0 ? 1 : -1);
        if (!RM && Math.abs(r.v) > 0.6) addShake(1.2);
      }

      switch (r.state) {
        case 'idle': { // attract mode: a slow, patient scan
          const aim = -Math.PI / 2 + (RM ? 0 : 0.75 * Math.sin(S.clock * 0.7));
          r.vc = 0; r.wc = clamp(wrap(aim - r.a) * 6, -2, 2);
          break;
        }
        case 'wait':
          r.vc = 0; r.wc = 0;
          break;
        case 'search':
          r.vc = 0; r.wc = r.spin * W_SEARCH;
          if (tgt) { setRobot(r, 'lock'); r.lastSide = Math.sign(tgt.ang) || r.lastSide; }
          else if (r.st > 2.4) { setRobot(r, 'roam'); }
          if (S.phase === 'over' && r.post === 'spin') { setRobot(r, 'spin'); }
          break;
        case 'roam': // nothing in range: drive toward the middle and look again
          r.wc = clamp(toC * 5, -W_TRACK, W_TRACK);
          r.vc = Math.abs(toC) < 0.5 ? 0.7 : 0.1;
          if (tgt) setRobot(r, 'lock');
          else if (r.st > 0.7) setRobot(r, 'search');
          break;
        case 'lock': // brake the spin, listen for a second echo, then go
          r.vc = 0;
          r.wc = tgt ? clamp(tgt.ang * 8, -W_TRACK, W_TRACK) : 0;
          if (tgt) r.lastSide = Math.sign(tgt.ang) || r.lastSide;
          if (r.st > LOCK) {
            if (tgt) setRobot(r, 'charge');
            else { setRobot(r, 'search'); r.spin = r.lastSide; }
          }
          break;
        case 'charge':
          if (tgt) {
            r.lost = 0; r.lastSide = Math.sign(tgt.ang) || r.lastSide;
            r.wc = clamp(tgt.ang * 7, -W_TRACK, W_TRACK);
            r.vc = V_CHARGE;
          } else {
            r.lost += dt; r.wc = 0; r.vc = V_CHARGE;
            if (r.lost > 0.32 || S.phase !== 'live') { setRobot(r, 'search'); r.spin = r.lastSide; }
          }
          break;
        case 'edge':
          if (r.sub === 'back') {
            r.vc = -0.8; r.wc = 0;
            if (r.st > 0.26 || sen.back) {
              r.sub = 'turn'; r.st = 0;
              r.turnDir = toC >= 0 ? 1 : -1;
              r.turnStop = rnd(0.15, 0.7);
            }
          } else {
            r.vc = 0; r.wc = r.turnDir * 6.2;
            if (Math.abs(toC) < r.turnStop || r.st > 0.9) {
              if (S.phase === 'over' && r.post === 'spin') setRobot(r, 'spin');
              else { setRobot(r, 'search'); r.spin = r.turnDir; }
            }
          }
          break;
        case 'spin': // victory spin, then rest
          r.vc = 0; r.wc = r.st < 1.1 ? 9 : 0;
          if (r.st > 1.4) setRobot(r, 'stop');
          break;
        case 'demand': { // face the player and jab: rematch?
          const p = S.puck;
          const ang = wrap(Math.atan2(p.y - r.y, p.x - r.x) - r.a);
          r.wc = clamp(ang * 6, -4, 4);
          r.vc = r.st > 0.4 && r.st < 1.8 ? 0.42 * Math.sin((r.st - 0.4) * 15) : 0;
          if (r.st > 2) setRobot(r, 'stop');
          break;
        }
        case 'stop':
        default:
          r.vc = 0; r.wc = 0;
      }
    }

    function stepRobot(r, dt) {
      const speeding = Math.abs(r.vc) > Math.abs(r.v) && Math.sign(r.vc || 1) === Math.sign(r.v || r.vc);
      const acc = speeding ? A_FWD : A_BRAKE;
      const prevV = r.v;
      r.v += clamp(r.vc - r.v, -acc * dt, acc * dt);
      r.w += clamp(r.wc - r.w, -42 * dt, 42 * dt);
      // wheel slip: a little filtered noise, more when the wheels are working hard
      const work = Math.abs(r.v) * 0.9 + Math.abs(r.vc - r.v) * 0.8 + (Math.abs(r.w) > 1 ? 0.15 : 0);
      r.noise = r.noise * 0.9 + (Math.random() - 0.5) * 0.9;
      const wj = r.noise * work * 1.1;
      r.a = wrap(r.a + (r.w + wj) * dt);
      const c = Math.cos(r.a), s = Math.sin(r.a);
      const lat = r.noise * work * 0.012;
      r.x += (c * r.v - s * lat) * dt;
      r.y += (s * r.v + c * lat) * dt;
      // wheels (for tread animation + marks)
      r.wl += (r.v - r.w * HW) * dt;
      r.wr += (r.v + r.w * HW) * dt;
      // voltage sags under load, recovers at rest
      const sag = 3.83 - 0.22 * Math.min(1, Math.abs(r.v) / V_CHARGE) - 0.05 * Math.min(1, Math.abs(r.w) / 6);
      r.volt += (sag - r.volt) * Math.min(1, dt * 6);
      // keep the hull on the dohyo no matter what
      const d = Math.hypot(r.x, r.y), lim = 1 - LINE - 0.08;
      if (d > lim) { r.x *= lim / d; r.y *= lim / d; }
      // rubber on the ring when the wheels bite
      const accel = Math.abs(r.v - prevV) / dt;
      if (!RM && (accel > 3 || (Math.abs(r.w) > 4 && Math.abs(r.v) > 0.2))) laySkid(r);
    }

    function stepPuck(p, dt) {
      if (S.phase === 'live') {
        let dvx = 0, dvy = 0;
        const k = S.keys;
        const kx = (k.r ? 1 : 0) - (k.l ? 1 : 0), ky = (k.d ? 1 : 0) - (k.u ? 1 : 0);
        if (S.mode === 'keys' && (kx || ky)) {
          const m = Math.hypot(kx, ky); dvx = kx / m * V_P; dvy = ky / m * V_P;
        } else if (S.mode === 'pointer') {
          const dx = S.target.x - p.x, dy = S.target.y - p.y, d = Math.hypot(dx, dy);
          if (d > 0.002) { const sp = Math.min(V_P, Math.sqrt(2 * A_P * d) * 0.85); dvx = dx / d * sp; dvy = dy / d * sp; }
        }
        let ax = dvx - p.vx, ay = dvy - p.vy;
        const am = Math.hypot(ax, ay), lim = A_P * dt;
        if (am > lim) { ax *= lim / am; ay *= lim / am; }
        p.vx += ax; p.vy += ay;
      } else {
        const f = Math.exp(-3.2 * dt); p.vx *= f; p.vy *= f;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (S.phase !== 'idle') {
        const d = Math.hypot(p.x, p.y);
        if (d > 1 + RP * 0.2) p.fall = Math.min(1, p.fall + dt * 2.2);
        // off the dohyo it drops to the floor and stays put just outside
        const lim = 1 + RP * 2.4;
        if (d > lim) { p.x *= lim / d; p.y *= lim / d; p.vx *= 0.5; p.vy *= 0.5; }
        const mx = (w / 2) / R - RP, my = (h / 2) / R - RP;
        p.x = clamp(p.x, -mx, mx); p.y = clamp(p.y, -my, my);
      }
    }

    function collide(r, p, dt) {
      if (p.fall > 0.5) return false;
      const c = Math.cos(r.a), s = Math.sin(r.a);
      const dx = p.x - r.x, dy = p.y - r.y;
      const lx = dx * c + dy * s, ly = -dx * s + dy * c;
      const x0 = -HL, x1 = HL + PLOW, y0 = -HW - 0.008, y1 = HW + 0.008;
      const qx = clamp(lx, x0, x1), qy = clamp(ly, y0, y1);
      let nx = lx - qx, ny = ly - qy, d = Math.hypot(nx, ny), pen;
      if (d > 1e-6) {
        if (d >= RP) return false;
        nx /= d; ny /= d; pen = RP - d;
      } else { // centre inside the box: leave by the nearest face
        const f = [lx - x0, x1 - lx, ly - y0, y1 - ly];
        const i = f.indexOf(Math.min.apply(null, f));
        nx = i === 0 ? -1 : i === 1 ? 1 : 0; ny = i === 2 ? -1 : i === 3 ? 1 : 0;
        pen = RP + f[i];
      }
      // world normal (robot -> puck)
      const wx = nx * c - ny * s, wy = nx * s + ny * c;
      const kp = MR / (MP + MR), kr = MP / (MP + MR);
      p.x += wx * pen * kp; p.y += wy * pen * kp;
      r.x -= wx * pen * kr; r.y -= wy * pen * kr;
      // robot velocity at the contact point (translation + spin)
      const cxp = r.x + (qx * c - qy * s), cyp = r.y + (qx * s + qy * c);
      const rx = cxp - r.x, ry = cyp - r.y;
      const vx = c * r.v - r.w * ry, vy = s * r.v + r.w * rx;
      const relx = p.vx - vx, rely = p.vy - vy;
      const vn = relx * wx + rely * wy;
      if (vn < 0) {
        const e = 0.18;
        const j = -(1 + e) * vn / (1 / MP + 1 / MR);
        p.vx += wx * j / MP; p.vy += wy * j / MP;
        // the wheels resist sideways shoves; only the along-heading part slows the robot
        r.v -= (wx * c + wy * s) * j / MR;
        // a touch of tangential grip
        const tx = -wy, ty = wx, vt = relx * tx + rely * ty;
        p.vx -= tx * vt * 0.08; p.vy -= ty * vt * 0.08;
        if (-vn > 0.35 && !S.contactNow) impact(cxp, cyp, wx, wy, -vn);
      }
      return true;
    }

    function impact(x, y, nx, ny, sp) {
      if (RM) return;
      addShake(Math.min(4, sp * 3.2));
      const n = Math.min(10, 4 + Math.round(sp * 5));
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(ny, nx) + rnd(-1.3, 1.3);
        const v = rnd(0.25, 0.9) * (0.6 + sp * 0.5);
        S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(0.25, 0.5), r: rnd(0.6, 1.4) });
      }
    }
    function addShake(a) { if (RM) return; S.shake = Math.max(S.shake, a); }

    function laySkid(r) {
      const c = Math.cos(r.a), s = Math.sin(r.a);
      const K = marks.width / 2;
      mctx.save();
      mctx.globalAlpha = 0.01;
      mctx.fillStyle = '#ffffff';
      for (const side of [-1, 1]) {
        const lx = -0.03, ly = side * (HW - 0.01);
        const x = r.x + lx * c - ly * s, y = r.y + lx * s + ly * c;
        mctx.beginPath();
        mctx.arc(K + x * K, K + y * K, 0.013 * K, 0, TAU);
        mctx.fill();
      }
      mctx.restore();
    }
    function fadeMarks() {
      mctx.save();
      mctx.globalCompositeOperation = 'destination-out';
      mctx.fillStyle = 'rgba(0,0,0,0.35)';
      mctx.fillRect(0, 0, marks.width, marks.height);
      mctx.restore();
    }

    function simulate(dt) {
      S.clock += dt;
      const r = S.robot, p = S.puck;
      if (S.phase === 'count') {
        S.countT += dt;
        countdown();
      } else if (S.phase === 'live') {
        S.t += dt;
        if (S.t > 0.85 && !pCount.hidden) pCount.hidden = true;
      } else if (S.phase === 'over') {
        S.overT += dt;
      }
      think(r, dt);
      stepRobot(r, dt);
      stepPuck(p, dt);
      const hit = (S.phase === 'live' || S.phase === 'over') ? collide(r, p, dt) : false;
      if (hit) S.lastContact = S.clock;
      S.contactNow = hit;

      if (S.phase === 'live') {
        if (Math.hypot(p.x, p.y) > 1) finish('lose');
        else if (S.t >= ROUND) finish('win');
      }
      // pings
      if (!RM && (r.state === 'search' || r.state === 'charge' || r.state === 'lock' || r.state === 'roam' || r.state === 'idle')) {
        S.pingT += dt;
        const every = r.state === 'charge' || r.state === 'lock' ? 0.14 : 0.32;
        if (S.pingT > every) { S.pingT = 0; S.pings.push({ d: 0 }); }
      }
      for (let i = S.pings.length - 1; i >= 0; i--) { S.pings[i].d += dt * 2.4; if (S.pings[i].d > RANGE) S.pings.splice(i, 1); }
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const q = S.parts[i]; q.life += dt;
        q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9;
        if (q.life > q.max) S.parts.splice(i, 1);
      }
      S.shake *= Math.exp(-dt * 14);
      if (S.shake < 0.05) S.shake = 0;
    }

    // ---------- drawing ----------
    function rrect(c, x, y, ww, hh, rad) {
      const r = Math.min(rad, ww / 2, hh / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + ww, y, x + ww, y + hh, r);
      c.arcTo(x + ww, y + hh, x, y + hh, r);
      c.arcTo(x, y + hh, x, y, r);
      c.arcTo(x, y, x + ww, y, r);
      c.closePath();
    }
    function seg7(c, txt, x, y, dw, dh, col) {
      // draws a tiny red 7-seg string starting at (x,y) = top-left; dot is a separate glyph
      const t = Math.max(0.7, dw * 0.24);
      c.fillStyle = col;
      let px = x;
      for (const ch of txt) {
        if (ch === '.') { const q = t * 1.35; c.fillRect(px - dw * 0.25 - q / 2, y + dh - q, q, q); continue; }
        const m = SEG[ch] || 0;
        const segs = [
          [0, 0, 1, 0], [1, 0, 1, 0.5], [1, 0.5, 1, 1], [0, 1, 1, 1], [0, 0.5, 0, 1], [0, 0, 0, 0.5], [0, 0.5, 1, 0.5]
        ];
        for (let i = 0; i < 7; i++) {
          if (!(m & (1 << i))) continue;
          const sgm = segs[i];
          const ax = px + sgm[0] * dw, ay = y + sgm[1] * dh, bx = px + sgm[2] * dw, by = y + sgm[3] * dh;
          if (ay === by) c.fillRect(Math.min(ax, bx) + t * 0.5, ay - t / 2, Math.abs(bx - ax) - t, t);
          else c.fillRect(ax - t / 2, Math.min(ay, by) + t * 0.5, t, Math.abs(by - ay) - t);
        }
        px += dw * 1.5;
      }
    }

    function drawRing() {
      const ri = R * (1 - LINE);
      // flat dohyo, drawn like the other stages: no drop shadow, a slightly
      // lifted black so it isn't a hole in the page
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = '#151413'; ctx.fill();
      // satin sheen
      const gs = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, 0, cx - R * 0.2, cy - R * 0.25, R * 1.25);
      gs.addColorStop(0, 'rgba(255,255,255,.07)'); gs.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gs; ctx.fill();
      // tawara: the edge band the robot's line sensors watch for, kept quiet
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.arc(cx, cy, ri, 0, TAU, true);
      ctx.fillStyle = 'rgba(243,239,231,.07)'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, ri, 0, TAU);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(243,239,231,.16)'; ctx.stroke();
      // hairline rim in the page ink
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
      ctx.lineWidth = Math.max(1.25, R * 0.008); ctx.strokeStyle = T.rim; ctx.stroke();
      // tyre marks
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, ri, 0, TAU); ctx.clip();
      ctx.drawImage(marks, cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
      // shikiri-sen: the two brown start lines (left off while idle, under the start hint)
      if (S.phase === 'idle') return;
      ctx.fillStyle = '#5b3c26';
      const lw = Math.max(2, R * 0.022), ll = R * 0.2;
      ctx.fillRect(cx - R * 0.13 - lw / 2, cy - ll / 2, lw, ll);
      ctx.fillRect(cx + R * 0.13 - lw / 2, cy - ll / 2, lw, ll);
    }

    function drawTimer() {
      const rr = R + Math.max(7, R * 0.045);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU);
      ctx.strokeStyle = T.dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.055)';
      if (S.phase !== 'idle') ctx.stroke();
      const f = S.phase === 'live' ? Math.min(1, S.t / ROUND) : S.phase === 'over' ? Math.min(1, S.t / ROUND) : 0;
      if (f > 0) {
        ctx.beginPath(); ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + f * TAU);
        ctx.strokeStyle = T.accent; ctx.stroke();
      }
      if (S.phase === 'idle') return;
      // five-second ticks
      ctx.strokeStyle = T.dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * TAU / 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (rr - 3), cy + Math.sin(a) * (rr - 3));
        ctx.lineTo(cx + Math.cos(a) * (rr + 3), cy + Math.sin(a) * (rr + 3));
        ctx.stroke();
      }
    }

    function drawCone(r) {
      const charge = r.state === 'charge' || r.state === 'lock';
      const ex = cx + (r.x + Math.cos(r.a) * (HL + PLOW * 0.5)) * R, ey = cy + (r.y + Math.sin(r.a) * (HL + PLOW * 0.5)) * R;
      const rng = RANGE * R;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R * (1 - LINE), 0, TAU); ctx.clip();
      ctx.translate(ex, ey); ctx.rotate(r.a);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rng);
      if (charge) { g.addColorStop(0, withAlpha(T.accN, 0.26)); g.addColorStop(1, withAlpha(T.accN, 0)); }
      else { g.addColorStop(0, 'rgba(243,239,231,.11)'); g.addColorStop(1, 'rgba(243,239,231,0)'); }
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rng, -CONE, CONE); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      // ultrasonic pings
      ctx.lineWidth = 1.1;
      for (const pg of S.pings) {
        const al = (1 - pg.d / RANGE) * (charge ? 0.55 : 0.32);
        ctx.strokeStyle = charge ? withAlpha(T.accN, al) : 'rgba(243,239,231,' + al.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(0, 0, pg.d * R, -CONE * 0.9, CONE * 0.9); ctx.stroke();
      }
      ctx.restore();
    }

    function drawRobot(r) {
      const k = R; // px per unit
      const hl = HL * k, hw = HW * k;
      ctx.save();
      ctx.translate(cx + r.x * k, cy + r.y * k);
      ctx.rotate(r.a);
      // shadow / footprint
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      rrect(ctx, -hl + 1, -hw - 0.01 * k + 2, 2 * hl + PLOW * k, 2 * hw + 0.02 * k, 0.03 * k); ctx.fill();
      // treads peeking out at the sides
      const tx0 = -0.105 * k, tl = 0.16 * k, tw = 0.026 * k;
      for (const side of [-1, 1]) {
        const ty = side < 0 ? -hw - tw * 0.55 : hw - tw * 0.45;
        ctx.fillStyle = '#1c1c1f';
        rrect(ctx, tx0, ty, tl, tw, tw * 0.35); ctx.fill();
        // tread stripes move with the wheel
        const travel = (side < 0 ? r.wl : r.wr) * k;
        const gap = 0.024 * k;
        const off = ((travel % gap) + gap) % gap;
        ctx.save();
        rrect(ctx, tx0, ty, tl, tw, tw * 0.35); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = Math.max(0.6, 0.004 * k);
        for (let x = tx0 - gap + off; x < tx0 + tl + gap; x += gap) {
          ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x, ty + tw); ctx.stroke();
        }
        ctx.restore();
      }
      // plow / scoop (black foam bumper)
      ctx.fillStyle = '#18181a';
      rrect(ctx, hl - 0.03 * k, -hw - 0.01 * k, (PLOW + 0.03) * k, 2 * hw + 0.02 * k, 0.012 * k); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(hl + PLOW * k - 0.006 * k, -hw - 0.004 * k, 0.004 * k, 2 * hw + 0.008 * k);
      // pink body
      const gb = ctx.createLinearGradient(-hl, -hw, hl, hw);
      gb.addColorStop(0, '#ff54b1'); gb.addColorStop(0.55, '#ff2a98'); gb.addColorStop(1, '#d9127f');
      rrect(ctx, -hl, -hw, 2 * hl, 2 * hw, 0.03 * k);
      ctx.fillStyle = gb; ctx.fill();
      // purple marker scribbles on the nose, like the real one
      ctx.save();
      rrect(ctx, -hl, -hw, 2 * hl, 2 * hw, 0.03 * k); ctx.clip();
      ctx.strokeStyle = 'rgba(96,18,120,.24)'; ctx.lineWidth = Math.max(0.6, 0.005 * k);
      for (let i = 0; i < 6; i++) {
        const x = 0.035 * k + i * 0.016 * k;
        ctx.beginPath(); ctx.moveTo(x, -hw); ctx.lineTo(x + 0.03 * k, hw); ctx.stroke();
      }
      // duct tape: a wrap across the tail, a crooked strip across the middle
      ctx.fillStyle = 'rgba(190,194,201,.94)';
      ctx.fillRect(-hl - 1, -hw - 1, 0.055 * k, 2 * hw + 2);
      ctx.save();
      ctx.translate(-0.012 * k, 0); ctx.rotate(0.16);
      ctx.fillStyle = 'rgba(184,188,196,.82)';
      ctx.fillRect(-0.017 * k, -hw * 1.3, 0.034 * k, hw * 2.6);
      ctx.restore();
      // tape crinkles
      ctx.lineWidth = Math.max(0.5, 0.0035 * k);
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      const crinkle = [[-0.12, -0.11, -0.08, -0.095], [-0.118, 0.03, -0.085, 0.05], [-0.025, -0.1, -0.005, -0.06], [-0.02, 0.05, 0.0, 0.1]];
      for (const q of crinkle) { ctx.beginPath(); ctx.moveTo(q[0] * k, q[1] * k); ctx.lineTo(q[2] * k, q[3] * k); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(70,74,84,.3)';
      const crinkle2 = [[-0.115, -0.04, -0.08, -0.02], [-0.03, -0.01, -0.01, 0.03]];
      for (const q of crinkle2) { ctx.beginPath(); ctx.moveTo(q[0] * k, q[1] * k); ctx.lineTo(q[2] * k, q[3] * k); ctx.stroke(); }
      // a red wire looping over the top, because there always is one
      ctx.strokeStyle = '#d4231c'; ctx.lineWidth = Math.max(0.8, 0.008 * k); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.045 * k, 0.07 * k);
      ctx.bezierCurveTo(-0.01 * k, 0.115 * k, 0.03 * k, 0.04 * k, 0.012 * k, -0.02 * k);
      ctx.stroke();
      ctx.restore();
      // body edge
      rrect(ctx, -hl, -hw, 2 * hl, 2 * hw, 0.03 * k);
      ctx.strokeStyle = 'rgba(110,0,55,.55)'; ctx.lineWidth = 1; ctx.stroke();
      // the voltmeter: a tiny black box with red 7-seg digits (reads 3.83 at rest, sags under load)
      ctx.save();
      ctx.translate(-0.075 * k, -0.002 * k);
      ctx.rotate(Math.PI / 2);
      const bw = 0.12 * k, bh = 0.058 * k;
      ctx.fillStyle = '#111';
      rrect(ctx, -bw / 2, -bh / 2, bw, bh, 0.008 * k); ctx.fill();
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-bw / 2 + 0.006 * k, -bh / 2 + 0.006 * k, bw - 0.012 * k, bh - 0.012 * k);
      const dh = bh * 0.62, dw = dh * 0.5;
      ctx.shadowColor = 'rgba(255,40,30,.9)'; ctx.shadowBlur = Math.max(1, 0.012 * k);
      const txt = r.volt.toFixed(2);
      seg7(ctx, txt, -bw / 2 + 0.015 * k, -dh / 2, dw, dh, '#ff3b2f');
      ctx.restore();
      // ultrasonic eyes
      for (const side of [-1, 1]) {
        const ex = hl - 0.012 * k, ey = side * 0.058 * k, er = 0.033 * k;
        const ge = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, er * 0.1, ex, ey, er);
        ge.addColorStop(0, '#f4f5f7'); ge.addColorStop(1, '#9aa0a8');
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fillStyle = ge; ctx.fill();
        ctx.beginPath(); ctx.arc(ex, ey, er * 0.62, 0, TAU); ctx.fillStyle = '#3d4046'; ctx.fill();
        // mesh
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          if (i * i + j * j > 1) continue;
          ctx.fillRect(ex + i * er * 0.3 - 0.4, ey + j * er * 0.3 - 0.4, 0.8, 0.8);
        }
        ctx.beginPath(); ctx.arc(ex - er * 0.25, ey - er * 0.25, er * 0.16, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
      }
      ctx.restore();
    }

    function drawPuck(p) {
      const k = R;
      const fall = RM ? Math.min(p.fall, 0.001) : p.fall;
      const sc = 1 - fall * 0.22;
      ctx.save();
      ctx.translate(cx + p.x * k, cy + p.y * k);
      ctx.globalAlpha = 1 - fall * 0.6;
      ctx.scale(sc, sc);
      const rp = RP * k;
      // contact shadow
      ctx.beginPath(); ctx.arc(0.6, 1.6, rp, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
      const g = ctx.createRadialGradient(-rp * 0.35, -rp * 0.4, rp * 0.1, 0, 0, rp);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e6e0d5');
      ctx.beginPath(); ctx.arc(0, 0, rp, 0, TAU);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.stroke();
      ctx.fillStyle = '#121212';
      ctx.font = '500 9px ' + T.mono;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('you', 0, 0.5);
      ctx.restore();
    }

    function drawParts() {
      for (const q of S.parts) {
        const a = 1 - q.life / q.max;
        ctx.fillStyle = 'rgba(243,239,231,' + (a * 0.8).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(cx + q.x * R, cy + q.y * R, q.r, 0, TAU); ctx.fill();
      }
    }

    function withAlpha(col, a, fb) {
      col = (col || '').trim();
      if (col && col[0] !== '#' && !/^rgba?\(/.test(col)) {
        // named / modern colour syntax: let the canvas normalise it
        try { ctx.fillStyle = '#000'; ctx.fillStyle = col; col = String(ctx.fillStyle); } catch (e) { /* keep */ }
      }
      if (col[0] === '#') {
        let hx = col.slice(1);
        if (hx.length === 3) hx = hx.split('').map(c => c + c).join('');
        const n = parseInt(hx.slice(0, 6), 16);
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
      }
      const m = col.match(/rgba?\(([^)]+)\)/);
      if (m) { const p = m[1].split(',').map(s => s.trim()); return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a.toFixed(3) + ')'; }
      return fb || 'rgba(232,150,44,' + a.toFixed(3) + ')';
    }

    function draw() {
      if (!w) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      if (S.shake > 0 && !RM) ctx.translate(rnd(-1, 1) * S.shake, rnd(-1, 1) * S.shake);
      drawRing();
      drawTimer();
      const r = S.robot, p = S.puck;
      if (S.phase === 'idle') {
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
        ctx.fillStyle = 'rgba(8,8,8,.3)'; ctx.fill();
      }
      const sensing = r.state === 'search' || r.state === 'charge' || r.state === 'lock' || r.state === 'roam' || r.state === 'idle' || r.state === 'wait';
      if (sensing) drawCone(r);
      if (S.phase !== 'idle') drawPuck(p);
      drawRobot(r);
      drawParts();
      if (S.phase === 'over' && !pResult.hidden) {
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
        ctx.fillStyle = 'rgba(8,8,8,.62)'; ctx.fill();
      }
      ctx.restore();
      drawCorners();
    }
    // registration marks, as on the rocket and plunger stages
    function drawCorners() {
      ctx.strokeStyle = T.ink; ctx.globalAlpha = 0.28; ctx.lineWidth = 1; ctx.lineCap = 'butt';
      const m = 6.5, l = 8, W = w, H = h;
      ctx.beginPath();
      ctx.moveTo(m, m + l); ctx.lineTo(m, m); ctx.lineTo(m + l, m);
      ctx.moveTo(W - m - l, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + l);
      ctx.moveTo(m, H - m - l); ctx.lineTo(m, H - m); ctx.lineTo(m + l, H - m);
      ctx.moveTo(W - m - l, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - l);
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    function hud() {
      if (S.phase === 'live' || S.phase === 'count') {
        const txt = Math.min(S.t, ROUND).toFixed(1);
        if (txt !== S.shownTime) { S.shownTime = txt; elTime.textContent = txt; }
      }
      const rs = S.robot.state;
      const st = S.phase === 'idle' ? 'idle' : rs === 'roam' ? 'search' : rs === 'lock' ? 'charge' : rs;
      setStateLabel(st);
    }

    // ---------- loop ----------
    let raf = 0, last = 0, acc = 0, visible = true, alive = true;
    // offscreen = scrolled away (IO) or covered by the project overlay
    const html = document.documentElement;
    let ioVis = true, overlayOpen = html.classList.contains('pv-open');
    visible = ioVis && !overlayOpen;
    // the site's motion switch stops the attract mode; a round you start still runs
    let motionOff = html.classList.contains('motion-off');
    // attract mode rests after this many seconds (on screen) without a pointer over the stage
    const ATTRACT = 8;
    let attractT = 0;
    function needsLoop() {
      if (!alive || !visible || document.hidden) return false;
      if (S.phase === 'count' || S.phase === 'live') return true;
      if (S.phase === 'over') return S.overT < 3 || S.parts.length > 0;
      return !RM && !motionOff && attractT < ATTRACT; // idle attract mode
    }
    function frame(now) {
      raf = 0;
      if (!needsLoop()) {
        if (S.phase === 'idle') S.pings.length = 0; // rest without echoes frozen mid-air
        draw(); return;
      }
      let dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (S.phase === 'idle') attractT += dt;
      acc += dt;
      while (acc >= STEP) { simulate(STEP); acc -= STEP; }
      if (S.phase === 'over' && pResult.hidden && S.overT > (S.result === 'win' ? 0.35 : 0.75)) revealResult();
      hud();
      draw();
      raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (raf || !needsLoop()) { if (!raf) draw(); return; }
      last = performance.now(); acc = 0;
      raf = requestAnimationFrame(frame);
    }

    // ---------- observers ----------
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => resize()) : null;
    if (ro) ro.observe(root); else window.addEventListener('resize', resize);
    function syncVis() { visible = ioVis && !overlayOpen; kick(); }
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
      const e = es[es.length - 1];
      ioVis = e.isIntersecting && e.intersectionRatio > 0; // edge-adjacent counts as offscreen
      syncVis();
    }, { threshold: 0.05 }) : null;
    if (io) io.observe(root);
    function onVis() { kick(); }
    document.addEventListener('visibilitychange', onVis);
    function onOverlay(e) {
      overlayOpen = !!(e && e.detail && e.detail.open);
      if (overlayOpen) { drag = null; S.keys = {}; } // a live round waits, paused, behind the overlay
      syncVis();
    }
    document.addEventListener('overlaychange', onOverlay);
    function onMotion(e) {
      motionOff = !!(e && e.detail && e.detail.off);
      if (S.phase === 'idle') {
        // the same still frame reduced motion shows; back on, it scans again for a while
        if (motionOff) idleBodies(); else attractT = 0;
      }
      kick();
    }
    document.addEventListener('motionchange', onMotion);
    function wake() { if (S.phase === 'idle' && attractT > 0) { attractT = 0; kick(); } }
    surface.addEventListener('pointerenter', wake);
    surface.addEventListener('pointermove', wake);
    surface.addEventListener('touchstart', wake, { passive: true });
    root.addEventListener('focusin', wake);
    function onTheme() { readTokens(); draw(); }
    document.addEventListener('themechange', onTheme);
    document.addEventListener('scentchange', onTheme);
    function onRM() { RM = mqReduce.matches; kick(); }
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', onRM);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) { readTokens(); draw(); } });

    resize();
    kick();

    return {
      destroy() {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        document.removeEventListener('themechange', onTheme);
        document.removeEventListener('scentchange', onTheme);
        document.removeEventListener('overlaychange', onOverlay);
        document.removeEventListener('motionchange', onMotion);
        surface.removeEventListener('pointerenter', wake);
        surface.removeEventListener('pointermove', wake);
        surface.removeEventListener('touchstart', wake);
        root.removeEventListener('focusin', wake);
        if (mqReduce.removeEventListener) mqReduce.removeEventListener('change', onRM);
        root.remove();
        saved.forEach(n => el.appendChild(n));
        el.style.position = prevPos;
        dropStyle();
      }
    };
  }

  FX.sumo = { mount };
})();
