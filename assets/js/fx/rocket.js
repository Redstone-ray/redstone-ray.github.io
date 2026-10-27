/*
  Hit the apogee — FX.rocket.mount(el) -> { destroy() }

  A 1-D flight sim of a student rocket with airbrakes. Launch, then hold
  (pointer or Space) to open the brakes and stop the rocket at 10,000 ft.
  The predicted apogee is a forward simulation from the current state,
  assuming the brakes close if you let go now — the same trick the real
  flight computer uses. "let my controller fly" runs a small PI loop on that
  prediction (with a noisy velocity estimate, so it isn't magic).
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

  /* ----------------------------------------------------------------- physics
     SI units inside, feet on screen. Tuned (see report) so that with the
     brakes shut a launch tops out near 12,000 ft (±4 % motor-to-motor), and
     with the brakes fully open from burnout it tops out near 8,500 ft. */
  const FT = 3.28084;
  const PH = {
    g: 9.80665, rho0: 1.225, hs: 8500,          // ρ(h) = ρ0·exp(−h/8500 m)
    m: 40, area: Math.PI * 0.0785 * 0.0785,     // 40 kg, 157 mm airframe
    cdBody: 0.38, cdBrake: 0.7953,              // Cd = Cd_body + Cd_brake·deploy
    burn: 2.5, thrust: 5301.9,                  // N, nominal motor
    slew: 2.5, dt: 0.005,                       // servo (deploy/s), sim step (s)
    target: 10000 / FT,
    motorVar: 0.032, cdBias: 0.01,              // per-launch scatter
    gust: 0.03, gustTau: 1.5,                   // turbulence on Cd_body (OU)
    kp: 0.006, ki: 0.02, ctrlDt: 0.05,          // controller (per metre of error)
    velNoise: 0.3, velTau: 2, altNoise: 1       // its state-estimate errors
  };
  const GUST_A = Math.exp(-PH.dt / PH.gustTau);
  const GUST_S = PH.gust * Math.sqrt(1 - GUST_A * GUST_A);

  function accel(hm, v, u, burning, thrust, k) {
    const rho = PH.rho0 * Math.exp(-hm / PH.hs);
    const cd = PH.cdBody * k + PH.cdBrake * u;
    return ((burning ? thrust : 0) - 0.5 * rho * cd * PH.area * v * Math.abs(v)) / PH.m - PH.g;
  }
  // one RK4 step of (h, v); splits the step exactly at burnout
  function rk4(s, dt, thrust, k) {
    if (s.t < PH.burn - 1e-9 && s.t + dt > PH.burn + 1e-9) {
      const d1 = PH.burn - s.t;
      rk4(s, d1, thrust, k); s.t = PH.burn;
      rk4(s, dt - d1, thrust, k);
      return;
    }
    const y = s.h, v = s.v, u = s.u, b = s.t < PH.burn - 1e-9;
    const a1 = accel(y, v, u, b, thrust, k);
    const v2 = v + a1 * dt / 2, a2 = accel(y + v * dt / 2, v2, u, b, thrust, k);
    const v3 = v + a2 * dt / 2, a3 = accel(y + v2 * dt / 2, v3, u, b, thrust, k);
    const v4 = v + a3 * dt, a4 = accel(y + v3 * dt, v4, u, b, thrust, k);
    s.h = y + dt / 6 * (v + 2 * v2 + 2 * v3 + v4);
    s.v = v + dt / 6 * (a1 + 2 * a2 + 2 * a3 + a4);
    s.t += dt;
  }
  // Forward-simulate to apogee (nominal model). cmd: null = hold the current
  // deployment; a number = the servo slews toward it (0 = "if you let go now").
  function predict(s0, thrust, cmd, dt) {
    dt = dt || 0.04;
    const s = { h: s0.h, v: s0.v, u: s0.u, t: s0.t };
    if (s.t > PH.burn && s.v <= 0) return s.h;
    while (s.t < 120) {
      if (cmd !== null && s.t >= PH.burn - 1e-9) s.u += clamp(cmd - s.u, -PH.slew * dt, PH.slew * dt);
      const ph = s.h, pv = s.v;
      rk4(s, dt, thrust, 1);
      if (s.t > PH.burn && s.v <= 0) return ph + (s.h - ph) * (pv / (pv - s.v));
    }
    return s.h;
  }
  // thrust that gives a chosen brakes-shut apogee (ft) on the nominal model
  function solveThrust(apoFt) {
    let lo = PH.thrust * 0.7, hi = PH.thrust * 1.4;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (predict({ h: 0, v: 0, u: 0, t: 0 }, mid, 0, 0.02) * FT < apoFt) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function gauss(rand) {
    let a = rand(); if (a < 1e-12) a = 1e-12;
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(6.283185307 * rand());
  }
  function makeFlight(thrust, bias, auto) {
    return {
      s: { h: 0, v: 0, u: 0, t: 0 }, thrust: thrust, bias: bias, auto: !!auto,
      gust: 0, cmd: 0, I: 0, ve: 0, nextCtrl: PH.burn, apogee: null, tApo: 0,
      trace: [0, 0, 0], nextTrace: 0.1
    };
  }
  function controllerCmd(f, rand) {
    const a = Math.exp(-PH.ctrlDt / PH.velTau);
    f.ve = f.ve * a + PH.velNoise * Math.sqrt(1 - a * a) * gauss(rand);
    const est = { h: f.s.h + PH.altNoise * gauss(rand), v: f.s.v + f.ve, u: f.s.u, t: f.s.t };
    const e = predict(est, f.thrust, null) - PH.target;            // metres
    f.I = clamp(f.I + PH.ki * e * PH.ctrlDt, 0, 1);
    return clamp(PH.kp * e + f.I, 0, 1);
  }
  // advance one fixed step; returns true at apogee
  function stepFlight(f, held, rand) {
    const dt = PH.dt;
    f.gust = f.gust * GUST_A + GUST_S * gauss(rand);
    if (f.s.t >= PH.burn - 1e-9) {
      if (f.auto) {
        if (f.s.t >= f.nextCtrl - 1e-9) { f.cmd = controllerCmd(f, rand); f.nextCtrl += PH.ctrlDt; }
      } else f.cmd = held ? 1 : 0;
      f.s.u += clamp(f.cmd - f.s.u, -PH.slew * dt, PH.slew * dt);
    }
    const ph = f.s.h, pv = f.s.v;
    rk4(f.s, dt, f.thrust, 1 + f.bias + f.gust);
    if (f.s.t >= f.nextTrace) { f.trace.push(f.s.t, f.s.h, f.s.u); f.nextTrace += 0.1; }
    if (f.s.t > PH.burn && f.s.v <= 0) {
      const fr = pv / (pv - f.s.v);
      f.apogee = ph + (f.s.h - ph) * fr;
      f.tApo = f.s.t - dt + dt * fr;
      f.s.h = f.apogee; f.s.v = 0; f.s.t = f.tApo;
      f.trace.push(f.tApo, f.apogee, f.s.u);
      return true;
    }
    return false;
  }
  // wall-clock compression: gentle off the pad, slowest while the brakes have
  // the most authority (fast flight), then quicker as the rocket runs out of
  // speed, so launch -> apogee takes ~8 s.
  const TS = { pad: 1.3, burnout: 2.0, coast: 2.6, vRef: 300 };
  function timeScale(s) {
    const smooth = x => x * x * (3 - 2 * x);
    if (s.t < PH.burn) return TS.pad + (TS.burnout - TS.pad) * smooth(clamp(s.t / PH.burn, 0, 1));
    return TS.burnout + TS.coast * smooth(clamp(1 - s.v / TS.vRef, 0, 1));
  }
  function verdict(missFt) {
    const a = Math.abs(Math.round(missFt));
    if (a <= 25) return 'Flight-controller material.';
    if (a <= 100) return 'Within spec. The judges nod.';
    if (a <= 400) return 'Close. The judges squint.';
    return missFt > 0 ? 'Overshot. Air traffic control has questions.' : 'Undershot. Those brakes were enthusiastic.';
  }

  /* ------------------------------------------------------------------- mount */
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
    const root = h('div', 'fxg-stage fxg-rocket');
    root.tabIndex = -1;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Hit the apogee: a rocket airbrake game');
    const cv = h('canvas', 'fxg-cv');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Side view of a small rocket on a launch rail, with an altitude scale from 0 to 14,000 feet and a dashed target line at 10,000 feet.');
    const ctx = cv.getContext('2d');

    const ro = h('dl', 'fxg-ro');
    ro.setAttribute('aria-hidden', 'true');
    const rv = {};
    let predLabel = null;
    [['alt', 'alt'], ['vel', 'vel'], ['brk', 'brakes'], ['pred', 'pred. apogee']].forEach(p => {
      const dt = ro.appendChild(h('dt', null, p[1]));
      if (p[0] === 'pred') predLabel = dt;
      rv[p[0]] = ro.appendChild(h('dd', null, '—'));
    });

    const bar = h('div', 'fxg-bar');
    const btnLaunch = h('button', 'fxg-btn', 'launch');
    btnLaunch.type = 'button';
    if (!coarse) { const kb = btnLaunch.appendChild(h('span', 'fxg-kbd', '↵')); kb.setAttribute('aria-hidden', 'true'); }
    const hint = h('span', 'fxg-hint');
    hint.setAttribute('aria-hidden', 'true');
    bar.appendChild(btnLaunch); bar.appendChild(hint);

    const card = h('div', 'fxg-card');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', 'Flight result');
    const head = card.appendChild(h('div', 'fxg-head'));
    const cLabel = head.appendChild(h('span', 'fxg-k'));
    const cBest = head.appendChild(h('span', 'fxg-k'));
    const row = card.appendChild(h('div', 'fxg-row'));
    const stats = row.appendChild(h('div', 'fxg-stats'));
    const st1 = stats.appendChild(h('div', 'fxg-stat'));
    st1.appendChild(h('span', 'fxg-k', 'apogee'));
    const cApo = st1.appendChild(h('span', 'fxg-v'));
    const st2 = stats.appendChild(h('div', 'fxg-stat'));
    st2.appendChild(h('span', 'fxg-k', 'miss'));
    const cMiss = st2.appendChild(h('span', 'fxg-v'));
    const spark = row.appendChild(h('canvas', 'fxg-spark'));
    spark.setAttribute('aria-hidden', 'true');
    const sctx = spark.getContext('2d');
    const cMsg = card.appendChild(h('div', 'fxg-msg'));
    const cSub = card.appendChild(h('div', 'fxg-sub'));
    const acts = card.appendChild(h('div', 'fxg-actions'));
    const btnAgain = acts.appendChild(h('button', 'fxg-btn', 'fly again'));
    btnAgain.type = 'button';
    const btnAuto = acts.appendChild(h('button', 'fxg-btn fxg-btn--2', 'let my controller fly'));
    btnAuto.type = 'button';

    const live = h('div', 'fxg-sr');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');

    root.appendChild(cv); root.appendChild(ro); root.appendChild(bar);
    root.appendChild(card); root.appendChild(live);
    host.appendChild(root);

    // ---- state
    let T = readTokens();
    let W = 0, H = 0, dpr = 1;
    let AX = 46, K = 0.072, padY = 0, followY = 0, RL = 0, RX = 0;
    let mode = 'idle';            // idle | flight | done
    let f = null;                 // current flight
    let lastPlayer = null;        // {thrust, bias, miss}
    let flightNo = 0;
    let pred = null, predShown = null;
    let acc = 0, wallT = 0, burnAnnounced = false;
    let cam = 0, camGoal = 0;
    let heldKey = false, heldPtr = false, ptrId = null;
    let raf = 0, last = 0, inView = true, alive = true;
    let best = parseFloat(store.get('fxg.rocket.best'));
    if (!isFinite(best)) best = null;
    const parts = [];
    let flick = 0, cardTimer = 0;
    const NOSE = 15, BODY = 44, R = 4.5, TAIL = 5;   // rocket drawing (px)

    function say(msg) { live.textContent = ''; setTimeout(() => { if (alive) live.textContent = msg; }, 30); }
    function held() { return heldKey || heldPtr; }

    // ---- layout
    function layout() {
      const r = root.getBoundingClientRect();
      W = Math.max(200, Math.round(r.width)); H = Math.max(240, Math.round(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      AX = W < 400 ? 40 : 46;
      K = H / 5800;                                // px per ft
      RL = NOSE + BODY + TAIL + 3;                 // nose tip to the pad
      padY = H - 62;                               // ground line when cam = 0
      followY = Math.round(H * 0.56);
      RX = Math.round(AX + (W - AX) * 0.42) + 0.5;
      root.classList.toggle('fxg--narrow', W < 400);
      root.classList.toggle('fxg--tiny', W < 340);
      predLabel.textContent = W < 400 ? 'pred.' : 'pred. apogee';
      cSub.style.display = W < 340 ? 'none' : '';
      const sw = 132, sh = 46;
      spark.style.width = sw + 'px'; spark.style.height = sh + 'px';
      spark.width = sw * dpr; spark.height = sh * dpr;
      if (mode === 'done') { camGoal = doneCam(); cam = camGoal; drawSpark(); }
      draw();
      if (mode === 'idle') updateHud();   // the idle hint depends on the width
    }
    const yOf = a => padY - (a - cam) * K;
    // The drawing isn't to scale (the rocket is ~900 ft tall at this zoom), so
    // its nose rides L px above its altitude on the pad and eases onto the true
    // altitude by 2,500 ft — slow enough that it always moves upward.
    const lift = a => { const x = clamp(a / 2500, 0, 1); return RL * (1 - x * x * (3 - 2 * x)); };
    const noseY = a => yOf(a) - lift(a);

    // ---- particles (world space: x px from rocket axis, a = altitude ft)
    function spawn(kind, n) {
      if (parts.length > 420) return;
      const vFt = f ? f.s.v * FT : 0, hFt = f ? f.s.h * FT : 0;
      for (let i = 0; i < n; i++) {
        if (kind === 'smoke') {
          parts.push({ k: 0, x: (rand() - 0.5) * 4, a: hFt - (RL - lift(hFt) - 4) / K - rand() * 60,
            vx: (rand() - 0.5) * 22, va: vFt - 160 - rand() * 200, r0: 1.5 + rand() * 1.5, r1: 5 + rand() * 7,
            life: 0, max: 2.2 + rand() * 1.2 });
        } else if (kind === 'spark') {
          parts.push({ k: 1, x: (rand() - 0.5) * 3, a: hFt - (RL - lift(hFt) - 4) / K,
            vx: (rand() - 0.5) * 30, va: vFt - 700 - rand() * 500, r0: 1, r1: 1, life: 0, max: 0.18 + rand() * 0.14 });
        } else if (kind === 'pad') {
          const side = rand() < 0.5 ? -1 : 1;
          parts.push({ k: 0, x: side * (2 + rand() * 6), a: 6 / K, vx: side * (20 + rand() * 70),
            va: rand() * 30, r0: 2.5, r1: 7 + rand() * 7, life: 0, max: 1.4 + rand() * 1.0 });
        }
      }
    }
    // puffs swell, then shrink away (fading by size keeps the outline trick intact)
    function puffR(p) {
      const q = p.life / p.max;
      const grow = 1 - Math.pow(1 - Math.min(1, q / 0.35), 2);
      const shrink = q < 0.55 ? 1 : 1 - Math.pow((q - 0.55) / 0.45, 1.6);
      return (p.r0 + (p.r1 - p.r0) * grow) * shrink;
    }
    function stepParts(dtw, dts) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dtw;
        if (p.life >= p.max) { parts.splice(i, 1); continue; }
        p.x += p.vx * dtw; p.vx *= Math.exp(-1.4 * dtw);
        p.a += p.va * dts; p.va *= Math.exp(-(p.k ? 2 : 3.2) * dts);
        if (p.k === 0 && p.a < 4 / K) {             // smoke hitting the pad rolls sideways
          p.a = 4 / K;
          if (!p.rolled) { p.rolled = true; p.vx += (p.x >= 0 ? 1 : -1) * (40 + rand() * 70); p.max += 0.5; }
          p.va = 0;
        }
      }
    }

    // ---- camera
    function followCam() { const a = f ? f.s.h * FT : 0; return Math.max(0, a - (padY - lift(a) - followY) / K); }
    function doneCam() {
      if (!f || f.apogee == null) return 0;
      const top = card.classList.contains('is-on') || mode === 'done' ? card.offsetTop + card.offsetHeight : 0;
      const yMid = top + (H - top) * 0.42;
      const aMid = (f.apogee * FT + 10000) / 2;
      return Math.max(0, aMid - (padY - yMid) / K);
    }

    // ---- drawing
    function tri(x, y, dir, s) { // dir: 1 = points left, -1 = points up
      ctx.beginPath();
      if (dir === 1) { ctx.moveTo(x, y); ctx.lineTo(x + s, y - s * 0.6); ctx.lineTo(x + s, y + s * 0.6); }
      else { ctx.moveTo(x, y); ctx.lineTo(x - s * 0.6, y + s); ctx.lineTo(x + s * 0.6, y + s); }
      ctx.closePath();
    }
    function text(str, x, y, color, align, size, weight) {
      ctx.font = (weight || 400) + ' ' + (size || 10) + 'px ' + T.mono;
      ctx.textAlign = align || 'left';
      ctx.fillStyle = color;
      ctx.fillText(str, x, y);
      return ctx.measureText(str).width;
    }
    function rocketShape(x, y) { // nose tip at (x, y)
      const yB = y + NOSE, yE = y + NOSE + BODY;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + R * 0.55, y + NOSE * 0.18, x + R, y + NOSE * 0.55, x + R, yB);
      ctx.lineTo(x + R, yE); ctx.lineTo(x - R, yE); ctx.lineTo(x - R, yB);
      ctx.bezierCurveTo(x - R, y + NOSE * 0.55, x - R * 0.55, y + NOSE * 0.18, x, y);
      ctx.closePath();
    }
    function finShape(x, y, side) {
      const yE = y + NOSE + BODY;
      ctx.beginPath();
      ctx.moveTo(x + side * R, yE - 14);
      ctx.lineTo(x + side * (R + 7.5), yE - 3.5);
      ctx.lineTo(x + side * (R + 7.5), yE + 2.5);
      ctx.lineTo(x + side * R, yE + 0.5);
      ctx.closePath();
    }
    function drawRocket(x, y, u, ghost, burning) {
      const fill = T.dark ? T.ink : '#ffffff';
      const line = T.dark ? T.bg : T.ink;
      const yE = y + NOSE + BODY;
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      if (ghost) {
        ctx.save();
        ctx.setLineDash([2, 2.5]);
        ctx.strokeStyle = T.ink; ctx.globalAlpha = 0.42;
        finShape(x, y, -1); ctx.stroke(); finShape(x, y, 1); ctx.stroke();
        rocketShape(x, y); ctx.fillStyle = T.bg2; ctx.fill(); ctx.stroke();
        ctx.restore();
        return;
      }
      // flame
      if (burning) {
        const L = (15 + 7 * flick) * (reduced ? 1 : Math.min(1, wallT / 0.18));
        const y0 = yE + 3;
        ctx.beginPath();
        ctx.moveTo(x - 3, y0);
        ctx.bezierCurveTo(x - 5, y0 + L * 0.35, x - 2, y0 + L * 0.8, x, y0 + L);
        ctx.bezierCurveTo(x + 2, y0 + L * 0.8, x + 5, y0 + L * 0.35, x + 3, y0);
        ctx.closePath();
        ctx.fillStyle = T.accent; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - 1.4, y0);
        ctx.quadraticCurveTo(x - 1.8, y0 + L * 0.3, x, y0 + L * 0.5);
        ctx.quadraticCurveTo(x + 1.8, y0 + L * 0.3, x + 1.4, y0);
        ctx.closePath();
        ctx.fillStyle = '#fff6e6'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      }
      // nozzle
      ctx.beginPath();
      ctx.moveTo(x - 2.2, yE); ctx.lineTo(x - 3.2, yE + 3); ctx.lineTo(x + 3.2, yE + 3); ctx.lineTo(x + 2.2, yE); ctx.closePath();
      ctx.fillStyle = T.dark ? T.ink2 : T.ink; ctx.fill();
      // fins
      ctx.strokeStyle = line; ctx.fillStyle = fill;
      finShape(x, y, -1); ctx.fill(); ctx.stroke();
      finShape(x, y, 1); ctx.fill(); ctx.stroke();
      // airbrake flaps: slide radially out of the airframe
      const yA = yE - 21, ext = 0.5 + u * 8.5;
      if (u > 0.002) {
        ctx.fillStyle = T.accent;
        ctx.beginPath(); ctx.rect(x + R - 1, yA - 2, ext + 1, 4); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.rect(x - R - ext, yA - 2, ext + 1, 4); ctx.fill(); ctx.stroke();
      }
      // body
      rocketShape(x, y); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
      // details: nose shoulder, avionics bay, brake slot, centre fin
      ctx.beginPath();
      ctx.moveTo(x - R, crisp(y + NOSE + 0.5) - 0.5); ctx.lineTo(x + R, crisp(y + NOSE + 0.5) - 0.5);
      ctx.moveTo(x - R, crisp(y + NOSE + 13)); ctx.lineTo(x + R, crisp(y + NOSE + 13));
      ctx.moveTo(x, yE - 12); ctx.lineTo(x, yE + 2.5);
      ctx.stroke();
      ctx.fillStyle = u > 0.002 ? T.accent : line;
      ctx.fillRect(x - R + 0.5, yA - 1, 2 * R - 1, 2);
    }
    const CLOUDS = [[2300, 0.8, 1], [5300, 0.17, 0.8], [7100, 0.86, 1.15], [9100, 0.2, 0.9], [11900, 0.76, 1], [13400, 0.22, 0.75]];
    const PUFFS = [[-15, -1, 6.5], [-6, -6, 8.5], [5, -8, 9.5], [15, -3, 7], [22, -1, 4.5]];
    function drawCloud(x, y, s, a) {
      if (a <= 0) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(x - 40 * s, y - 40 * s, 80 * s, 40 * s); ctx.clip();
      ctx.lineWidth = 2; ctx.strokeStyle = T.ink; ctx.globalAlpha = (T.dark ? 0.3 : 0.26) * a;
      for (let i = 0; i < PUFFS.length; i++) { const p = PUFFS[i]; ctx.beginPath(); ctx.arc(x + p[0] * s, y + p[1] * s, p[2] * s, 0, 6.2832); ctx.stroke(); }
      ctx.globalAlpha = a; ctx.fillStyle = T.bg2;
      for (let i = 0; i < PUFFS.length; i++) { const p = PUFFS[i]; ctx.beginPath(); ctx.arc(x + p[0] * s, y + p[1] * s, p[2] * s - 0.5, 0, 6.2832); ctx.fill(); }
      ctx.restore();
      ctx.lineWidth = 1; ctx.strokeStyle = T.ink; ctx.globalAlpha = (T.dark ? 0.3 : 0.26) * a;
      ctx.beginPath(); ctx.moveTo(x - 21.5 * s, crisp(y)); ctx.lineTo(x + 26.5 * s, crisp(y)); ctx.stroke();
      ctx.globalAlpha = 1;
    }
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

    function draw() {
      if (!W) return;
      const c = ctx;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalAlpha = 1; c.setLineDash([]);
      c.fillStyle = T.bg2; c.fillRect(0, 0, W, H);
      try { c.letterSpacing = '0.06em'; } catch (e) { /* older engines */ }
      c.lineWidth = 1;

      const aTop = cam + padY / K, aBot = cam - (H - padY) / K;
      const gY = yOf(0);
      const hFt = f ? f.s.h * FT : 0;

      // grid: one faint line per 1,000 ft
      c.strokeStyle = T.ink; c.globalAlpha = T.dark ? 0.09 : 0.07;
      c.beginPath();
      for (let a = Math.max(1000, Math.ceil(aBot / 1000) * 1000); a <= Math.min(14000, aTop); a += 1000) {
        if (a === 10000) continue;
        const y = crisp(yOf(a)); c.moveTo(AX, y); c.lineTo(W, y);
      }
      c.stroke();

      // flight-path centre line, drafting style (dash-dot)
      c.strokeStyle = T.ink; c.globalAlpha = T.dark ? 0.16 : 0.13; c.setLineDash([12, 3, 2, 3]);
      c.beginPath(); c.moveTo(RX, 0); c.lineTo(RX, Math.min(H, gY - 2)); c.stroke();
      c.setLineDash([]); c.globalAlpha = 1;

      // a few line-drawn clouds for a sense of speed
      for (let i = 0; i < CLOUDS.length; i++) {
        const cl = CLOUDS[i], y = yOf(cl[0]);
        if (y < -30 || y > H + 10) continue;
        drawCloud(AX + (W - AX) * cl[1], y, cl[2], clamp((y - 34) / 50, 0, 1));
      }

      // altitude axis
      c.globalAlpha = 0.7;
      const yAxTop = Math.max(0, yOf(14000)), yAxBot = Math.min(H, gY);
      c.beginPath(); c.moveTo(AX + 0.5, yAxTop); c.lineTo(AX + 0.5, yAxBot);
      for (let a = Math.max(0, Math.ceil(aBot / 250) * 250); a <= Math.min(14000, aTop); a += 250) {
        const y = crisp(yOf(a)), major = a % 1000 === 0;
        c.moveTo(AX + 0.5, y); c.lineTo(AX + 0.5 - (major ? 6 : 3), y);
      }
      if (yOf(14000) > 0) { const y = crisp(yOf(14000)); c.moveTo(AX - 6, y); c.lineTo(AX + 4, y); }
      c.stroke();
      c.globalAlpha = 1;
      c.textBaseline = 'middle';
      for (let a = Math.max(0, Math.ceil(aBot / 1000) * 1000); a <= Math.min(14000, aTop); a += 1000) {
        const y = yOf(a);
        if (y < 6 || y > H - 4) continue;
        text(a === 0 ? '0' : (a / 1000) + 'k', AX - 9, y + 0.5, a === 10000 ? T.accentText : T.ink3, 'right');
      }
      if (yOf(14000) > 14) text('ft', AX - 9, yOf(14000) - 12, T.ink3, 'right');

      // ground, pad, rail
      if (gY < H + 12) {
        const gy = crisp(gY);
        c.strokeStyle = T.ink; c.globalAlpha = 0.7;
        c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke();
        c.globalAlpha = 0.28; c.beginPath();
        for (let x = -2; x < W + 10; x += 7) { c.moveTo(x, gy + 1); c.lineTo(x - 6, gy + 8); }
        c.stroke();
        c.globalAlpha = 0.7;
        const rx = RX + R + 3;
        c.beginPath();
        c.moveTo(rx, gy); c.lineTo(rx, gy - 96);
        for (let y = gy - 8; y > gy - 96; y -= 12) { c.moveTo(rx, y); c.lineTo(rx + 2.5, y); }
        c.moveTo(rx, gy - 22); c.lineTo(rx + 12, gy);
        c.moveTo(RX - 11, crisp(gY - 3)); c.lineTo(RX + 11, crisp(gY - 3));
        c.moveTo(RX - 8, crisp(gY - 3)); c.lineTo(RX - 8, gy); c.moveTo(RX + 8, crisp(gY - 3)); c.lineTo(RX + 8, gy);
        c.stroke(); c.globalAlpha = 1;
      }

      // target line
      const yT = yOf(10000);
      if (yT > -2 && yT < H + 2) {
        c.strokeStyle = T.accent; c.lineWidth = 1.25; c.setLineDash([6, 4]);
        c.beginPath(); c.moveTo(AX, crisp(yT)); c.lineTo(W, crisp(yT)); c.stroke();
        c.setLineDash([]); c.lineWidth = 1;
        c.textBaseline = 'alphabetic';
        text('TARGET 10,000 FT', AX + 9, yT - 6, T.accentText, 'left');
      }

      // exhaust: sparks, then the smoke drawn as one line-art plume (stroke
      // every puff, then fill them all, leaving only the outer silhouette)
      c.strokeStyle = T.accent; c.lineWidth = 1.2;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]; if (p.k !== 1) continue;
        const y = yOf(p.a), x = RX + p.x; if (y < -20 || y > H + 20) continue;
        c.globalAlpha = 1 - p.life / p.max;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - p.vx * 0.02, y + 5); c.stroke();
      }
      c.globalAlpha = 1; c.lineWidth = 1;
      for (let pass = 0; pass < 2; pass++) {
        if (pass === 0) { c.lineWidth = 2; c.strokeStyle = T.ink; c.globalAlpha = T.dark ? 0.42 : 0.34; }
        else { c.globalAlpha = 1; c.fillStyle = T.bg2; }
        c.beginPath();
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i]; if (p.k !== 0) continue;
          const y = yOf(p.a), x = RX + p.x, r = puffR(p);
          if (r < 0.6 || y < -20 || y > H + 20) continue;
          c.moveTo(x + r - (pass ? 0.6 : 0), y);
          c.arc(x, y, Math.max(0.1, r - (pass ? 0.6 : 0)), 0, 6.2832);
        }
        if (pass === 0) c.stroke(); else c.fill();
      }
      c.globalAlpha = 1; c.lineWidth = 1;

      // predicted apogee: ghost rocket + tick on the axis
      if (mode === 'flight' && predShown != null) {
        const yP = yOf(predShown);
        if (yP > 4) {
          drawRocket(RX, yP, 0, true);
          c.strokeStyle = T.ink; c.globalAlpha = 0.35; c.setLineDash([1, 3]);
          c.beginPath(); c.moveTo(AX + 9, crisp(yP)); c.lineTo(RX - 10, crisp(yP)); c.stroke();
          c.setLineDash([]); c.globalAlpha = 0.85;
          tri(AX + 1.5, yP, 1, 7); c.fillStyle = T.bg2; c.fill(); c.strokeStyle = T.ink; c.stroke();
          c.globalAlpha = 1;
        }
      }
      // off-scale markers pinned to the top of the axis
      c.textBaseline = 'middle';
      let pinY = 18;
      const plate = (w, y) => { c.fillStyle = T.bg2; c.globalAlpha = 0.92; c.fillRect(AX + 2, y - 7, w + 22, 14); c.globalAlpha = 1; };
      if (yT < 4 && mode !== 'idle') {
        plate(88, pinY);
        tri(AX + 9, pinY - 4, -1, 6); c.fillStyle = T.accent; c.fill();
        text('TARGET 10,000', AX + 17, pinY + 0.5, T.accentText, 'left');
        pinY += 15;
      }
      if (mode === 'flight' && predShown != null && yOf(predShown) <= 4) {
        plate(96, pinY);
        tri(AX + 9, pinY - 4, -1, 6); c.fillStyle = T.bg2; c.fill(); c.strokeStyle = T.ink; c.globalAlpha = 0.8; c.stroke(); c.globalAlpha = 1;
        text('PRED ' + fmt(predShown), AX + 17, pinY + 0.5, T.ink2, 'left');
      }
      if (mode === 'idle' && yT < 4) {
        plate(88, pinY);
        tri(AX + 9, pinY - 4, -1, 6); c.fillStyle = T.accent; c.fill();
        text('TARGET 10,000', AX + 17, pinY + 0.5, T.accentText, 'left');
      }

      // the rocket
      const yN = noseY(mode === 'idle' ? 0 : hFt);
      drawRocket(RX, yN, f ? f.s.u : 0, false, mode === 'flight' && f && f.s.t < PH.burn);

      // apogee annotation: an engineering dimension between apogee and target
      if (mode === 'done' && f && f.apogee != null) {
        const aFt = f.apogee * FT, yA = yOf(aFt), dx = RX + 34;
        c.strokeStyle = T.ink; c.globalAlpha = 0.75;
        c.beginPath(); c.moveTo(RX + 8, crisp(yA)); c.lineTo(dx + 8, crisp(yA)); c.stroke();
        const span = Math.abs(yT - yA);
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(dx + 0.5, yA); c.lineTo(dx + 0.5, yT); c.stroke();
        c.fillStyle = T.ink;
        if (span >= 22) {
          const s1 = yT < yA ? 1 : -1;
          c.beginPath(); c.moveTo(dx + 0.5, yT); c.lineTo(dx - 2.5, yT + s1 * 6); c.lineTo(dx + 3.5, yT + s1 * 6); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(dx + 0.5, yA); c.lineTo(dx - 2.5, yA - s1 * 6); c.lineTo(dx + 3.5, yA - s1 * 6); c.closePath(); c.fill();
        } else if (span >= 1.5) {
          const top = Math.min(yT, yA), bot = Math.max(yT, yA);
          c.beginPath(); c.moveTo(dx + 0.5, top); c.lineTo(dx + 0.5, top - 9); c.moveTo(dx + 0.5, bot); c.lineTo(dx + 0.5, bot + 9); c.stroke();
          c.beginPath(); c.moveTo(dx + 0.5, top); c.lineTo(dx - 2.5, top - 6); c.lineTo(dx + 3.5, top - 6); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(dx + 0.5, bot); c.lineTo(dx - 2.5, bot + 6); c.lineTo(dx + 3.5, bot + 6); c.closePath(); c.fill();
        }
        c.globalAlpha = 1;
        const miss = Math.round(aFt - 10000);
        const label = (str, y, color, weight) => {
          c.font = (weight || 400) + ' ' + (weight ? 11 : 10) + 'px ' + T.mono;
          const w = c.measureText(str).width;
          c.fillStyle = T.bg2; c.fillRect(dx + 6, y - 7, w + 6, 14);
          c.textBaseline = 'middle'; text(str, dx + 9, y + 0.5, color, 'left', weight ? 11 : 10, weight);
        };
        const big = span >= 22;
        const yMiss = big ? (yA + yT) / 2 : Math.min(yA, yT) - 16;
        const yApo = big ? yA + (yA < yT ? -12 : 12) : Math.max(yA, yT) + 16;
        label((miss > 0 ? '+' : miss < 0 ? '−' : '±') + fmt(Math.abs(miss)) + ' FT', yMiss, T.ink, 500);
        label('APOGEE ' + fmt(aFt), yApo, T.ink3);
        c.textBaseline = 'alphabetic';
      }
      drawCorners();
    }

    function drawSpark() {
      if (!f || !f.trace.length) return;
      const w = 132, hh = 46, c = sctx, tr = f.trace;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, hh);
      const tMax = f.tApo || tr[tr.length - 3] || 1;
      const aMax = Math.max(f.apogee * FT, 10000) * 1.1;
      const px = t => 0.5 + (t / tMax) * (w - 1);
      const py = a => hh - 1 - (a / aMax) * (hh - 3);
      // brakes as a band along the bottom
      c.fillStyle = T.accent; c.globalAlpha = 0.55;
      c.beginPath(); c.moveTo(px(0), hh);
      for (let i = 0; i < tr.length; i += 3) c.lineTo(px(tr[i]), hh - tr[i + 2] * 12);
      c.lineTo(px(tMax), hh); c.closePath(); c.fill();
      c.globalAlpha = 1;
      // target
      c.strokeStyle = T.accent; c.setLineDash([3, 2]); c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, crisp(py(10000))); c.lineTo(w, crisp(py(10000))); c.stroke();
      c.setLineDash([]);
      // altitude
      c.strokeStyle = T.ink; c.lineWidth = 1.25; c.lineJoin = 'round';
      c.beginPath();
      for (let i = 0; i < tr.length; i += 3) { const x = px(tr[i]), y = py(tr[i + 1] * FT); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      c.strokeStyle = T.ink; c.globalAlpha = 0.25; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, hh - 0.5); c.lineTo(w, hh - 0.5); c.stroke(); c.globalAlpha = 1;
    }

    // ---- readouts / hint
    const shown = {};
    function setText(node, key, val) { if (shown[key] !== val) { shown[key] = val; node.textContent = val; } }
    function updateHud() {
      const s = f ? f.s : { h: 0, v: 0, u: 0, t: 0 };
      setText(rv.alt, 'alt', fmt(s.h * FT) + ' ft');
      setText(rv.vel, 'vel', fmt(Math.max(0, s.v * FT)) + ' ft/s');
      const locked = mode === 'flight' && s.t < PH.burn;
      setText(rv.brk, 'brk', locked ? 'locked' : (f && f.auto ? 'auto ' : '') + Math.round(s.u * 100) + ' %');
      rv.brk.classList.toggle('is-hot', s.u > 0.01);
      setText(rv.pred, 'pred', predShown != null && mode !== 'idle' ? fmt(predShown) + ' ft' : '—');
      let ht;
      if (mode === 'idle') ht = W < 400 ? 'then hold to brake' : coarse ? 'then press and hold to brake' : 'then hold space to brake';
      else if (mode === 'flight') {
        const clock = 'T+' + (s.t < 10 ? '0' : '') + s.t.toFixed(1);
        const narrow = W < 400;
        if (s.t < PH.burn) ht = clock + (narrow ? ' · burning · brakes locked' : ' · motor burning · brakes locked');
        else if (f.auto) ht = clock + (narrow ? ' · controller flying' : ' · controller flying · hands off');
        else ht = clock + (held() ? ' · braking' : ' · hold to brake');
      } else ht = '';
      if (mode === 'idle' && best != null && W >= 400) {
        // best is a miss distance, not an altitude; drop to the short prompt if it won't fit
        const pre = 'best: ' + fmt(best) + ' ft off · ';
        setText(hint, 'hint', pre + ht);
        if (hint.scrollWidth > hint.clientWidth + 1) setText(hint, 'hint', pre + 'then hold to brake');
        return;
      }
      setText(hint, 'hint', ht);
    }

    // ---- flow
    function launch(auto) {
      clearTimeout(cardTimer);
      let thrust, bias;
      if (auto && lastPlayer) { thrust = lastPlayer.thrust; bias = lastPlayer.bias; }
      else {
        thrust = solveThrust(12000 * (1 + (rand() * 2 - 1) * PH.motorVar));
        bias = (rand() * 2 - 1) * PH.cdBias;
      }
      f = makeFlight(thrust, bias, auto);
      if (!auto) flightNo++;
      mode = 'flight';
      acc = 0; wallT = 0; burnAnnounced = false; cam = 0;
      heldKey = false; heldPtr = false;
      pred = predict(f.s, f.thrust, 0); predShown = pred * FT;
      parts.length = 0;
      if (!reduced) spawn('pad', 14);
      card.classList.remove('is-on');
      bar.classList.remove('is-off');
      btnLaunch.style.visibility = 'hidden';
      root.style.touchAction = 'none';
      try { root.focus({ preventScroll: true }); } catch (e) { root.focus(); }
      say(auto
        ? 'Controller flying the same motor. Predicted apogee with brakes shut: ' + fmt(predShown) + ' feet.'
        : 'Launched. Brakes shut, this motor would reach ' + fmt(predShown) + ' feet. Brakes unlock at burnout.');
      updateHud();
      kick();
    }
    function finish() {
      mode = 'done';
      heldKey = heldPtr = false;
      root.style.touchAction = '';
      const aFt = f.apogee * FT, miss = aFt - 10000, missR = Math.round(miss);
      const sign = missR > 0 ? '+' : missR < 0 ? '−' : '±';
      let msg, newBest = false;
      if (f.auto) {
        msg = Math.abs(missR) <= 12
          ? 'Controller: ' + fmt(Math.abs(missR)) + ' ft off. It practised a lot.'
          : 'Controller: ' + fmt(Math.abs(missR)) + ' ft off. Even it has gusty days.';
      } else {
        msg = verdict(miss);
        lastPlayer = { thrust: f.thrust, bias: f.bias, miss: missR };
        const prev = best;
        if (prev == null || Math.abs(missR) < prev) { best = Math.abs(missR); newBest = prev != null; store.set('fxg.rocket.best', best); }
      }
      cLabel.textContent = f.auto ? 'controller · same motor' : 'flight ' + (flightNo < 10 ? '0' : '') + flightNo;
      cBest.innerHTML = '';
      if (newBest && !f.auto) cBest.appendChild(h('b', null, 'new best'));
      else if (best != null) cBest.textContent = 'best ' + fmt(best) + ' ft off';
      cApo.innerHTML = ''; cApo.appendChild(document.createTextNode(fmt(aFt))); cApo.appendChild(h('small', null, 'ft'));
      cMiss.innerHTML = ''; cMiss.appendChild(document.createTextNode(sign + fmt(Math.abs(missR)))); cMiss.appendChild(h('small', null, 'ft'));
      cMsg.textContent = msg;
      if (f.auto && lastPlayer) cSub.textContent = 'you: ' + fmt(Math.abs(lastPlayer.miss)) + ' ft off on this motor';
      else cSub.textContent = 'motor: ' + fmt(predict({ h: 0, v: 0, u: 0, t: 0 }, f.thrust, 0, 0.02) * FT) + ' ft with brakes shut';
      btnAuto.hidden = !!f.auto;
      btnAgain.textContent = f.auto ? 'your turn' : 'fly again';
      bar.classList.add('is-off');
      const words = f.auto
        ? msg
        : 'Apogee ' + fmt(aFt) + ' feet, ' + fmt(Math.abs(missR)) + (missR >= 0 ? ' feet over. ' : ' feet under. ') + msg;
      say(words);
      const show = () => {
        if (!alive || mode !== 'done') return;
        card.classList.add('is-on');
        drawSpark();
        camGoal = doneCam();
        if (reduced) cam = camGoal;
        try { btnAgain.focus({ preventScroll: true }); } catch (e) { btnAgain.focus(); }
        kick();
      };
      camGoal = cam;
      if (reduced) show(); else cardTimer = setTimeout(show, 550);
    }

    // ---- loop
    function needsFrame() {
      return mode === 'flight' || parts.length > 0 || Math.abs(cam - camGoal) > 0.5;
    }
    function frame(ts) {
      raf = 0;
      if (!alive) return;
      const dtw = last ? Math.min(0.05, (ts - last) / 1000) : 1 / 60;
      last = ts;
      let dts = 0;
      if (mode === 'flight') {
        wallT += dtw;
        dts = dtw * timeScale(f.s);
        acc += dts;
        let ended = false;
        while (acc >= PH.dt) {
          acc -= PH.dt;
          if (stepFlight(f, held(), rand)) { ended = true; break; }
        }
        if (!burnAnnounced && f.s.t >= PH.burn) {
          burnAnnounced = true;
          if (!f.auto) say('Burnout. Airbrakes unlocked. Hold to brake.');
        }
        if (ended) { predShown = null; finish(); }
        else {
          pred = f.auto ? predict(f.s, f.thrust, null) : predict(f.s, f.thrust, 0);
          predShown = pred * FT;
          if (f.s.t < PH.burn && !reduced) { spawn('smoke', 3); spawn('spark', 2); }
          else if (f.s.t < PH.burn) spawn('smoke', 1);
          cam = followCam(); camGoal = cam;
        }
        flick = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(ts * 0.09) * Math.sin(ts * 0.031 + 1);
      } else if (mode === 'done') {
        cam += (camGoal - cam) * (1 - Math.exp(-5 * dtw));
        if (Math.abs(camGoal - cam) < 0.5) cam = camGoal;
      }
      stepParts(dtw, mode === 'flight' ? dts : dtw * 0.6);
      updateHud();
      draw();
      if (needsFrame()) kick();
    }
    function kick() {
      if (raf || !alive || !inView || document.hidden) return;
      raf = requestAnimationFrame(frame);
    }
    function pause() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; last = 0;
      heldKey = heldPtr = false;
    }

    // ---- input
    function setPtr(on, e) {
      heldPtr = on;
      if (!on) ptrId = null;
      else if (e) { ptrId = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      updateHud();
    }
    function onPointerDown(e) {
      if (mode !== 'flight' || f.auto) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      setPtr(true, e);
    }
    function onPointerUp(e) { if (ptrId === e.pointerId) setPtr(false); }
    function onClick() { if (mode === 'idle') launch(false); }
    function onKeyDown(e) {
      const k = e.key;
      const onBtn = e.target && e.target.tagName === 'BUTTON';
      if (k === ' ' || k === 'Spacebar') {
        if (mode === 'flight') {
          e.preventDefault();
          if (!f.auto && !e.repeat) { heldKey = true; updateHud(); }
        } else if (mode !== 'flight' && !onBtn) { e.preventDefault(); launch(false); }
      } else if (k === 'Enter') {
        if (mode !== 'flight' && !onBtn) { e.preventDefault(); launch(false); }
      }
    }
    function onKeyUp(e) {
      if ((e.key === ' ' || e.key === 'Spacebar') && heldKey) { e.preventDefault(); heldKey = false; updateHud(); }
    }
    function onBlur() { heldKey = false; heldPtr = false; }
    function onCtx(e) { if (mode === 'flight') e.preventDefault(); }
    function onTheme() { T = readTokens(); draw(); if (mode === 'done') drawSpark(); }
    function onVis() { if (document.hidden) pause(); else { last = 0; kick(); } }

    btnLaunch.addEventListener('click', () => launch(false));
    btnAgain.addEventListener('click', () => launch(false));
    btnAuto.addEventListener('click', () => launch(true));
    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointerup', onPointerUp);
    cv.addEventListener('pointercancel', onPointerUp);
    cv.addEventListener('lostpointercapture', onPointerUp);
    cv.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('keyup', onKeyUp);
    root.addEventListener('contextmenu', onCtx);
    window.addEventListener('blur', onBlur);
    document.addEventListener('themechange', onTheme);
    document.addEventListener('scentchange', onTheme);
    document.addEventListener('visibilitychange', onVis);

    let rObs = null, iObs = null;
    if ('ResizeObserver' in window) { rObs = new ResizeObserver(() => layout()); rObs.observe(root); }
    else window.addEventListener('resize', layout);
    if ('IntersectionObserver' in window) {
      // edge-adjacent (ratio 0) counts as offscreen; the 0.01 step makes sure
      // a stage that starts edge-adjacent still reports when it scrolls in
      iObs = new IntersectionObserver(entries => {
        const e = entries[entries.length - 1];
        inView = e.isIntersecting && e.intersectionRatio > 0;
        if (inView) { last = 0; kick(); } else pause();
      }, { threshold: [0, 0.01] });
      iObs.observe(root);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) { draw(); if (mode === 'idle') updateHud(); } });

    layout();
    updateHud();

    return {
      destroy() {
        alive = false;
        pause();
        clearTimeout(cardTimer);
        if (rObs) rObs.disconnect(); else window.removeEventListener('resize', layout);
        if (iObs) iObs.disconnect();
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('themechange', onTheme);
        document.removeEventListener('scentchange', onTheme);
        document.removeEventListener('visibilitychange', onVis);
        if (root.parentNode) root.parentNode.removeChild(root);
        saved.forEach(n => host.appendChild(n));
        host.style.position = prevPos;
      }
    };
  }

  FX.rocket = {
    mount: mount,
    // exposed for offline verification of the tuning (no DOM needed)
    _sim: { PH: PH, FT: FT, predict: predict, solveThrust: solveThrust, makeFlight: makeFlight, stepFlight: stepFlight, timeScale: timeScale, TS: TS, verdict: verdict }
  };
})();
