/* The goose. A Canada goose that wanders along the bottom of the page.
   FX.goose.mount(document.body, { autoDelayMs }) -> { destroy(), release() }
   Listens for document 'goose:release' and for the word "honk" typed anywhere outside a field. */
(function () {
  'use strict';
  const FX = (window.FX = window.FX || {});

  const SEEN = 'rd.goose.seen';
  const LIFE = 25;         // seconds before it wanders off on its own
  const HARD_CAP = 36;     // never stays longer than this, whatever happens
  const NEAR = 140;        // px: how close the pointer may come before it gets ideas
  const CHASE = 3;         // seconds of hissing pursuit
  const TAU = Math.PI * 2;
  const LIFT = 2;          // px between the feet and the bottom edge
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  let uid = 0;

  // ---------- styles ----------
  const CSS = `
.fxg{position:fixed;left:0;bottom:0;width:0;height:0;z-index:60;pointer-events:none;
  font-family:var(--font-mono,ui-monospace,monospace)}
.fxg__goose{position:absolute;left:0;bottom:0;will-change:transform}
.fxg__btn{all:unset;display:block;position:relative;pointer-events:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.fxg__btn:focus-visible{outline:2px solid var(--accent-ink,#a35f06);outline-offset:2px;border-radius:6px}
.fxg__svg{display:block;max-width:none;overflow:visible;pointer-events:none}
.fxg__all{pointer-events:visiblePainted}
.fxg__hit{fill:transparent}
.fxg__fwing{visibility:hidden}
.fxg.is-flying .fxg__fwing{visibility:visible}
.fxg.is-flying .fxg__wing{visibility:hidden}
.fxg__svg{filter:drop-shadow(0 0 .6px rgba(243,234,219,.55))}
.fxg__shadow{position:absolute;left:0;bottom:1px;height:6px;border-radius:50%;
  background:radial-gradient(closest-side,rgba(0,0,0,.16),rgba(0,0,0,0));will-change:transform,opacity}
html[data-theme="filled"] .fxg__shadow{background:radial-gradient(closest-side,rgba(0,0,0,.5),rgba(0,0,0,0))}
.fxg__bubble{position:absolute;left:0;bottom:0;white-space:nowrap;pointer-events:none;will-change:transform}
.fxg__say{display:block;position:relative;font:400 11px/1 var(--font-mono,ui-monospace,monospace);letter-spacing:.02em;
  color:var(--ink,#121212);background:var(--bg,#fff);border:1px solid var(--ink,#121212);border-radius:11px;
  padding:5px 8px 5px;opacity:0;transform:translateY(4px) scale(.86);transform-origin:var(--ox,0%) 100%;
  transition:opacity .16s ease,transform .32s var(--ease-out,cubic-bezier(.16,1,.3,1))}
.fxg__bubble.is-on .fxg__say{opacity:1;transform:none}
.fxg__say::after{content:"";position:absolute;bottom:-4px;left:9px;width:6px;height:6px;background:inherit;
  border:solid var(--ink,#121212);border-width:0 1px 1px 0;transform:rotate(45deg) skew(8deg,8deg)}
.fxg__bubble[data-side="l"] .fxg__say::after{left:auto;right:9px}
.fxg__bubble.is-big .fxg__say::after{width:9px;height:9px;bottom:-6px;left:13px;border-width:0 1.5px 1.5px 0}
.fxg__bubble.is-big[data-side="l"] .fxg__say::after{left:auto;right:13px}
.fxg__bubble.is-big .fxg__say{font-size:20px;font-weight:500;letter-spacing:.01em;padding:8px 12px 7px;border-radius:15px;border-width:1.5px}
.fxg__bubble.is-hiss .fxg__say{letter-spacing:.12em}
.fxg__egg{position:fixed;bottom:3px;z-index:59;pointer-events:none;width:12px;height:15px;
  transition:opacity 1.6s ease;animation:fxg-egg .5s cubic-bezier(.3,1.6,.5,1) both}
.fxg__egg.is-gone{opacity:0}
@keyframes fxg-egg{0%{transform:translateY(-14px) scale(.7)}60%{transform:translateY(0) rotate(-8deg)}100%{transform:none}}
.fxg.is-fading{opacity:0;transition:opacity .7s ease}
.fxg__sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){
  .fxg__say{transition:opacity .2s ease;transform:none}
  .fxg__egg{animation:none}
}`;
  let styleRefs = 0, styleEl = null;
  function addStyle() {
    if (styleRefs++ === 0) {
      styleEl = document.createElement('style');
      styleEl.id = 'fx-goose-style';
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }
  }
  function dropStyle() { if (--styleRefs === 0 && styleEl) { styleEl.remove(); styleEl = null; } }

  // ---------- drawing (facing right; ground at y = 88) ----------
  function scallops() {
    const rows = [
      { y: 51.2, xs: [57, 51.5, 46, 40.5, 35] },
      { y: 55, xs: [54, 48.5, 43, 37.5, 32, 26.5] },
      { y: 58.6, xs: [50, 44.5, 39, 33.5] }
    ];
    let d = '';
    for (const r of rows) for (const x of r.xs) d += 'M' + (x - 2.6) + ' ' + r.y + 'q2.6 3 5.2 0';
    return d;
  }
  function gooseSVG(id) {
    const leg = (cls, col) =>
      '<g class="fxg__leg ' + cls + '"><g class="fxg__shin"><path d="M-1.05 -1L1.05 -1L.85 15.2L-.75 15.2Z" fill="' + col + '"/></g>' +
      '<g class="fxg__foot"><path d="M-1.6 14.6C.5 14.2 4 14.6 6.4 15.6C7 15.9 6.9 16.5 6.2 16.6L-1.9 16.6C-2.4 16.2 -2.2 15 -1.6 14.6Z" fill="' + col + '"/></g></g>';
    const fwing = cls =>
      '<g class="fxg__fwing ' + cls + '"><g class="fxg__fwing-in">' +
      '<path d="M5 2C6.5 -8 5 -19 .5 -29L-2.6 -43.6Q-4.2 -45.4 -5.4 -42.6L-6.2 -37.6L-8.4 -42.4Q-10 -44 -10.9 -41L-11 -36L-13.2 -39.6Q-14.8 -41 -15.4 -37.8L-15 -33.2L-16.6 -35.2Q-18.4 -36 -18.6 -32.6C-19.4 -24 -17.6 -12 -13 -2Z" fill="#6a5b4c"/>' +
      '<path d="M.5 -29L-2.6 -43.6Q-4.2 -45.4 -5.4 -42.6L-6.2 -37.6L-8.4 -42.4Q-10 -44 -10.9 -41L-11 -36L-13.2 -39.6Q-14.8 -41 -15.4 -37.8L-15 -33.2L-16.6 -35.2Q-18.4 -36 -18.6 -32.6C-18.8 -30.6 -18.8 -29 -18.6 -27.4C-12 -28.6 -5.6 -29.4 .5 -29Z" fill="#25201c"/>' +
      '<path d="M-16.8 -21q2.3 1.8 4.6 0q2.3 1.8 4.6 0q2.3 1.8 4.6 0M-15.6 -13q2.3 1.8 4.6 0q2.3 1.8 4.6 0q2.3 1.8 4.6 0M-13 -5q2.2 1.6 4.4 0q2.2 1.6 4.4 0" fill="none" stroke="#ab9a82" stroke-width=".85" stroke-linecap="round"/>' +
      '</g></g>';
    return '' +
      '<svg class="fxg__svg" viewBox="-14 -8 128 98" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<linearGradient id="fxgb' + id + '" x1="14" y1="0" x2="76" y2="0" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0" stop-color="#6a5b4b"/><stop offset=".45" stop-color="#8a7a66"/><stop offset=".78" stop-color="#bfb19d"/><stop offset="1" stop-color="#dcd2c3"/>' +
        '</linearGradient>' +
        '<linearGradient id="fxgv' + id + '" x1="0" y1="58" x2="0" y2="76" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0" stop-color="#f3eee6" stop-opacity="0"/><stop offset="1" stop-color="#f3eee6" stop-opacity=".6"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g class="fxg__flip"><g class="fxg__all">' +
        leg('fxg__leg--far', '#33302c') +
        fwing('fxg__fwing--far') +
        '<g class="fxg__torso">' +
          // white under-tail, black tail
          '<path d="M30 71.6C22 73 13.6 69.2 9.2 61.4C16 62.4 24 63 31 63.2Z" fill="#f8f6f1"/>' +
          '<path d="M22 53.4L9.4 51C6.6 50.6 5.4 53.6 6.9 55.6C8.2 57.2 10 58 12.2 58.5L23 60.6Z" fill="#191613"/>' +
          // body
          '<path d="M73 57C74.5 66.5 66 74.5 52 75C40 75.4 28.5 73 21.5 67.4C16.6 63.4 14.8 57.6 17.6 53.4C22.4 47.4 36 45.2 50 46C62 46.6 71.6 50.4 73 57Z" fill="url(#fxgb' + id + ')"/>' +
          '<path d="M73 57C74.5 66.5 66 74.5 52 75C40 75.4 28.5 73 21.5 67.4C30 70 44 70.6 56 68C64 66.4 70 62.6 73 57Z" fill="url(#fxgv' + id + ')"/>' +
          // faint flank barring
          '<path d="M30 66.2q6 2 12 .4M43.5 68q6.5 1.6 13 -.2M57 67.2q5.5 .6 9.8 -2" fill="none" stroke="#a89883" stroke-width=".8" stroke-linecap="round" opacity=".7"/>' +
          // folded wing with pale feather edges
          '<g class="fxg__wing">' +
            '<path d="M66.5 51.6C58.5 47 39 46.2 25 49.8C18.6 51.4 12.4 53.6 8.4 55.4C15 58.6 26 61.6 39.5 61.8C52 62 62.6 58.6 66.5 51.6Z" fill="#665747"/>' +
            '<path d="M33 57.4C24 57.2 15 56.4 8.4 55.4C14 58.6 23 61 33 61.3Z" fill="#2a2520"/>' +
            '<path d="' + scallops() + '" fill="none" stroke="#b09f87" stroke-width=".85" stroke-linecap="round" opacity=".9"/>' +
          '</g>' +
          '<ellipse class="fxg__hit" cx="44" cy="60" rx="33" ry="17"/>' +
        '</g>' +
        leg('fxg__leg--near', '#1d1a17') +
        '<path class="fxg__neck" d="" fill="#171513"/>' +
        '<g class="fxg__head">' +
          '<circle class="fxg__hit" cx="5" cy="-1" r="9.5"/>' +
          '<path d="M-3.8 2.6C-5.2 -2.4 -2.2 -6.9 3.4 -7.1C7.4 -7.2 9.8 -5.4 10.4 -2.6L10.4 1.6C7.2 3.8 .6 4.9 -3.8 2.6Z" fill="#171513"/>' +
          '<path class="fxg__tongue" d="M9.6 .6L15 .9L9.6 1.6Z" fill="#c85a6a"/>' +
          '<g class="fxg__jaw"><path d="M9.4 .5C12 .7 14.6 .8 16.4 .3C15.2 1.9 12.2 2.7 9.4 2.3Z" fill="#171513"/></g>' +
          '<path d="M9.6 -3.4C12.2 -3.5 15.2 -2.4 17.4 -.5C15.8 .4 12.2 .6 9.6 .6Z" fill="#171513"/>' +
          '<path d="M1.2 -3.6C3.8 -5.4 6.8 -4.4 7.8 -1.8C8.6 .2 8.8 2.2 8.2 3.6C5.2 4.6 1.8 4.2 .2 2.8C-.8 1 -.4 -2.2 1.2 -3.6Z" fill="#fbf9f4"/>' +
          '<circle cx="7.1" cy="-4.5" r="1.05" fill="#050505"/>' +
          '<circle cx="7.45" cy="-4.85" r=".38" fill="#fff"/>' +
        '</g>' +
        fwing('fxg__fwing--near') +
      '</g></g>' +
      '</svg>';
  }

  // poses: head attach point (hx,hy), head rotation, beak, neck control offsets
  const POSE = {
    stand: { hx: 70.5, hy: 19, rot: 0, beak: 0, c1x: 7, c1y: -13, c2x: -5, c2y: 10, wing: 0, crouch: 0 },
    honk: { hx: 73, hy: 13.5, rot: -24, beak: 1, c1x: 7, c1y: -15, c2x: -4, c2y: 10, wing: -6, crouch: -2 },
    peckUp: { hx: 80, hy: 59, rot: 62, beak: 0, c1x: 9, c1y: -10, c2x: -2, c2y: -9, wing: 0, crouch: 2 },
    peckDown: { hx: 82, hy: 69, rot: 76, beak: 0.15, c1x: 9, c1y: -9, c2x: -1, c2y: -10, wing: 0, crouch: 3 },
    hiss: { hx: 89, hy: 46, rot: 8, beak: 0.85, c1x: 6, c1y: -11, c2x: -10, c2y: -1, wing: -10, crouch: 3 },
    fly: { hx: 95, hy: 33, rot: 4, beak: 0, c1x: 9, c1y: -6, c2x: -9, c2y: 2, wing: 0, crouch: 0 }
  };
  const KEYS = ['hx', 'hy', 'rot', 'beak', 'c1x', 'c1y', 'c2x', 'c2y', 'wing', 'crouch'];

  // ---------- sound: a short, nasal, synthesized honk ----------
  let actx = null;
  function honkSound() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + 0.01;
      const out = actx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.12, t + 0.025);
      out.gain.setValueAtTime(0.12, t + 0.2);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 3.2;
      bp.frequency.setValueAtTime(1250, t);
      bp.frequency.exponentialRampToValueAtTime(900, t + 0.33);
      const o1 = actx.createOscillator(), o2 = actx.createOscillator(), g2 = actx.createGain();
      o1.type = 'sawtooth'; o2.type = 'square';
      o2.detune.value = 22; g2.gain.value = 0.55;
      for (const o of [o1, o2]) {
        o.frequency.setValueAtTime(390, t);
        o.frequency.linearRampToValueAtTime(470, t + 0.045);
        o.frequency.exponentialRampToValueAtTime(285, t + 0.34);
      }
      o1.connect(bp); o2.connect(g2); g2.connect(bp); bp.connect(out); out.connect(actx.destination);
      o1.start(t); o2.start(t); o1.stop(t + 0.37); o2.stop(t + 0.37);
      o1.onended = () => { try { o1.disconnect(); o2.disconnect(); g2.disconnect(); bp.disconnect(); out.disconnect(); } catch (e) { /* noop */ } };
    } catch (e) { /* audio is a bonus */ }
  }

  function mount(host, opts) {
    opts = opts || {};
    host = host || document.body;
    addStyle();
    const mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const RM = () => mqReduce.matches;
    const autoDelay = opts.autoDelayMs == null ? 40000 : +opts.autoDelayMs;

    let G = null;            // the live goose, or null
    let raf = 0, last = 0;
    let autoTimer = 0;
    const pointer = { x: -9999, y: -9999, t: -1e9 };
    let typed = '';

    // ---------- lifecycle ----------
    function seen() { try { return sessionStorage.getItem(SEEN) === '1'; } catch (e) { return false; } }
    function markSeen() { try { sessionStorage.setItem(SEEN, '1'); } catch (e) { /* noop */ } }

    function scale() { return (document.documentElement.clientWidth || innerWidth) < 640 ? 56 / 76 : 70 / 76; }

    function spawn() {
      markSeen();
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = 0; }
      const id = ++uid;
      const wrap = document.createElement('div');
      wrap.className = 'fxg';
      wrap.innerHTML =
        '<div class="fxg__shadow"></div>' +
        '<div class="fxg__goose"><button type="button" class="fxg__btn" aria-label="A Canada goose. Press to honk at it.">' + gooseSVG(id) + '</button></div>' +
        '<div class="fxg__bubble" aria-hidden="true"><span class="fxg__say"></span></div>' +
        '<p class="fxg__sr" aria-live="polite"></p>';
      host.appendChild(wrap);
      const q = s => wrap.querySelector(s);
      const vw = document.documentElement.clientWidth || innerWidth;
      const k = scale();
      const fromLeft = Math.random() < 0.35;
      G = {
        wrap, k,
        el: q('.fxg__goose'), btn: q('.fxg__btn'), svg: q('.fxg__svg'), shadow: q('.fxg__shadow'),
        bubble: q('.fxg__bubble'), say: q('.fxg__say'), sr: q('.fxg__sr'),
        flip: q('.fxg__flip'), all: q('.fxg__all'), torso: q('.fxg__torso'), wing: q('.fxg__wing'),
        neck: q('.fxg__neck'), head: q('.fxg__head'), jaw: q('.fxg__jaw'), tongue: q('.fxg__tongue'),
        legN: q('.fxg__leg--near'), legF: q('.fxg__leg--far'),
        fwN: q('.fxg__fwing--near .fxg__fwing-in'), fwF: q('.fxg__fwing--far .fxg__fwing-in'),
        x: 0, y: 0, vy: 0, vx: 0, dir: fromLeft ? 1 : -1, face: fromLeft ? 1 : -1,
        state: 'enter', st: 0, life: 0, tx: 0, speed: 46, phase: 0, flap: 0,
        pose: Object.assign({}, POSE.stand), flipHead: 1, flipHeadT: 1,
        clicks: 0, cooldown: 1.2, honkT: rnd(3, 6), bubbleT: 0, bubbleText: '', bubbleKind: '',
        hissJ: 0, fadeT: 0, still: RM()
      };
      sizeGoose();
      G.btn.addEventListener('click', onGooseClick);
      G.sr.textContent = '';
      setTimeout(() => { if (G) G.sr.textContent = 'A goose has wandered onto the page.'; }, 60);

      if (G.still) {
        // reduced motion: it simply stands at bottom-right, says its piece and fades
        G.state = 'still'; G.dir = -1; G.face = -1;
        G.x = vw - G.w - 16;
        render(0);
        bubble('honk', 'sm', 4.6);
        positionBubble();
        G.fadeTimer = setTimeout(() => fadeOut(), 5000);
        return;
      }
      G.x = fromLeft ? -G.w - 8 : vw + 8;
      G.tx = fromLeft ? rnd(vw * 0.15, vw * 0.45) : rnd(vw * 0.5, vw * 0.85) - G.w;
      G.tx = clamp(G.tx, 8, vw - G.w - 8);
      start();
    }

    function sizeGoose() {
      if (!G) return;
      G.k = scale();
      G.w = 128 * G.k; G.h = 98 * G.k;
      G.svg.setAttribute('width', G.w.toFixed(1));
      G.svg.setAttribute('height', G.h.toFixed(1));
      G.shadow.style.width = (60 * G.k).toFixed(1) + 'px';
    }

    function removeGoose() {
      if (!G) return;
      clearTimeout(G.fadeTimer);
      G.btn.removeEventListener('click', onGooseClick);
      G.wrap.remove();
      G = null;
      stop();
    }
    function fadeOut() {
      if (!G || G.fading) return;
      G.fading = true;
      G.wrap.classList.add('is-fading');
      const g = G;
      setTimeout(() => { if (G === g) removeGoose(); }, 750);
    }

    function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    // ---------- speech ----------
    function bubble(text, kind, secs) {
      if (!G) return;
      G.bubbleText = text; G.bubbleKind = kind; G.bubbleT = secs;
      G.say.textContent = text;
      G.bubble.classList.toggle('is-big', kind === 'big');
      G.bubble.classList.toggle('is-hiss', kind === 'hiss');
      G.bubble.classList.remove('is-on');
      void G.bubble.offsetWidth;
      G.bubble.classList.add('is-on');
      G.bw = G.say.offsetWidth; G.bh = G.say.offsetHeight;
    }
    function hush() { if (G) { G.bubbleT = 0; G.bubble.classList.remove('is-on'); } }

    // ---------- interaction ----------
    function onGooseClick(e) {
      if (!G || G.state === 'fly' || G.fading) return;
      e.preventDefault();
      G.clicks++;
      honkSound();
      if (G.clicks === 1) alarm();
      else takeOff();
    }
    function alarm() {
      if (!G) return;
      bubble('HONK!', 'big', 1.3);
      if (G.still) { clearTimeout(G.fadeTimer); G.fadeTimer = setTimeout(() => fadeOut(), 5000); return; }
      // mid-entrance: keep walking on, honking (stopping here strands it at the edge)
      if (G.state === 'enter') { G.alarmT = 1.1; return; }
      G.state = 'alarm'; G.st = 0;
    }
    function takeOff() {
      if (!G) return;
      if (G.still) { layEgg(); fadeOut(); return; }
      G.state = 'fly'; G.st = 0; G.vy = 0;
      G.vx = G.dir * 40;
      G.wrap.classList.add('is-flying');
      bubble('honk honk', 'sm', 0.9);
      layEgg();
    }
    function layEgg() {
      if (!G) return;
      const egg = document.createElement('div');
      egg.className = 'fxg__egg';
      egg.setAttribute('aria-hidden', 'true');
      egg.style.left = (px(40) - 6).toFixed(1) + 'px';
      egg.innerHTML = '<svg viewBox="0 0 12 15" width="12" height="15"><ellipse cx="6" cy="14.2" rx="5" ry="1" fill="rgba(0,0,0,.14)"/>' +
        '<path d="M6 .8C9 .8 11.2 5.4 11.2 8.8C11.2 11.8 8.9 14 6 14C3.1 14 .8 11.8 .8 8.8C.8 5.4 3 .8 6 .8Z" fill="#f4efe3" stroke="#d6cdbb" stroke-width=".6"/>' +
        '<ellipse cx="4.4" cy="5.6" rx="1.3" ry="2" fill="#fff" opacity=".8"/></svg>';
      host.appendChild(egg);
      eggs.add(egg);
      setTimeout(() => egg.classList.add('is-gone'), 2400);
      setTimeout(() => { egg.remove(); eggs.delete(egg); }, 4200);
    }
    const eggs = new Set();

    function release() {
      if (G) {
        if (G.state === 'fly' || G.fading) return;
        // already here: it honks (with sound only when a person just asked for it)
        const ua = navigator.userActivation;
        if (ua && ua.isActive) honkSound();
        alarm();
        return;
      }
      spawn();
    }

    function onPointer(e) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now();
    }
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (dialogOpen()) { typed = ''; return; }
      typed = (typed + e.key.toLowerCase()).slice(-4);
      if (typed === 'honk') { typed = ''; release(); }
    }
    function onRelease() { release(); }
    function onResize() {
      if (!G) return;
      sizeGoose();
      const vw = document.documentElement.clientWidth || innerWidth;
      if (G.state === 'still') G.x = vw - G.w - 16;
      else if (G.state !== 'fly' && G.state !== 'leave' && G.state !== 'enter') G.tx = clamp(G.tx, 8, vw - G.w - 8);
      render(0);
    }

    // ---------- behaviour ----------
    function vwNow() { return document.documentElement.clientWidth || innerWidth; }
    function dialogOpen() { return !!document.querySelector('dialog[open]'); }
    function pickNext() {
      const vw = vwNow();
      if (G.life > LIFE) {
        G.state = 'leave'; G.st = 0;
        const mid = G.x + G.w / 2;
        G.tx = mid < vw / 2 ? -G.w - 20 : vw + 20;
        return;
      }
      // never idle at the edge (a stalled entrance, a honk mid-walk): walk back in first
      if (G.x < 8 || G.x > vw - G.w - 8) {
        G.state = 'walk'; G.st = 0; G.flipHeadT = 1;
        G.tx = clamp(G.x < 8 ? rnd(vw * 0.15, vw * 0.45) : rnd(vw * 0.5, vw * 0.85) - G.w, 8, vw - G.w - 8);
        return;
      }
      const r = Math.random();
      G.st = 0; G.flipHeadT = 1;
      if (r < 0.5) {
        G.state = 'walk';
        let tx = G.x + rnd(90, 300) * (Math.random() < 0.5 ? -1 : 1);
        G.tx = clamp(tx, 8, vw - G.w - 8);
        if (Math.abs(G.tx - G.x) < 40) G.tx = clamp(G.x + 160 * (G.x < vw / 2 ? 1 : -1), 8, vw - G.w - 8);
      } else if (r < 0.72) { G.state = 'peck'; G.dur = rnd(1.4, 2.2); }
      else if (r < 0.9) { G.state = 'look'; G.dur = rnd(1.6, 2.4); }
      else { G.state = 'pause'; G.dur = rnd(0.7, 1.4); }
    }

    // svg x (facing-corrected) -> viewport px; svg y -> px above the viewport bottom
    function px(sx) { const f = G.face >= 0 ? 1 : -1; return G.x + (50 + (sx - 50) * f + 14) * G.k; }
    function py(sy) { return G.y + LIFT + (90 - sy) * G.k; }
    function gooseCenter() { return { x: px(46), y: innerHeight - py(52) }; }

    function update(dt) {
      const vw = vwNow();
      G.life += dt; G.st += dt;
      G.cooldown -= dt;
      if (G.bubbleT > 0) { G.bubbleT -= dt; if (G.bubbleT <= 0) hush(); }
      if (G.life > LIFE + 4 && (G.state === 'peck' || G.state === 'look' || G.state === 'pause' || G.state === 'walk')) pickNext();
      if (G.life > HARD_CAP && G.state !== 'fly') { fadeOut(); }

      // the pointer gets too close: turn, lower the neck, hiss, give chase
      const calm = G.state === 'walk' || G.state === 'peck' || G.state === 'look' || G.state === 'pause' || G.state === 'enter';
      if (calm && G.cooldown <= 0 && performance.now() - pointer.t < 1500 && G.x > -G.w * 0.5 && G.x < vw - G.w * 0.5) {
        const c = gooseCenter();
        if (Math.hypot(pointer.x - c.x, pointer.y - c.y) < NEAR) {
          G.state = 'chase'; G.st = 0; G.flipHeadT = 1;
          bubble('hssss', 'hiss', CHASE);
        }
      }

      let target = POSE.stand, moving = false, speed = 46;
      switch (G.state) {
        case 'enter':
        case 'walk':
        case 'leave': {
          const dx = G.tx - G.x;
          G.dir = dx >= 0 ? 1 : -1;
          moving = true;
          speed = G.state === 'leave' ? 78 : 46;
          if (G.alarmT > 0) { G.alarmT -= dt; if (G.state === 'enter') target = POSE.honk; }
          if (Math.abs(dx) < 2) {
            if (G.state === 'leave') { removeGoose(); return; }
            pickNext();
          }
          break;
        }
        case 'peck': {
          const t = G.st;
          if (t < G.dur - 0.3) {
            const s = 0.5 - 0.5 * Math.cos(Math.max(0, t - 0.25) * TAU * 2.4);
            target = blend(POSE.peckUp, POSE.peckDown, s);
          }
          if (t > G.dur) pickNext();
          break;
        }
        case 'look': {
          const t = G.st;
          G.flipHeadT = t > 0.35 && t < G.dur * 0.6 ? -1 : 1;
          target = Object.assign({}, POSE.stand, { rot: t > G.dur * 0.6 ? -8 * Math.sin(t * 5) : 0 });
          if (t > G.dur) { G.flipHeadT = 1; pickNext(); }
          break;
        }
        case 'pause':
          if (G.st > G.dur) pickNext();
          break;
        case 'alarm':
          target = POSE.honk;
          if (G.st > 1.1) { G.cooldown = 2.5; pickNext(); }
          break;
        case 'chase': {
          const c = gooseCenter();
          const want = pointer.x - (c.x - G.x);
          // head for the pointer but never past the screen edge; pinned there, it still faces you
          G.tx = clamp(want, 4, vw - G.w - 4);
          const dx = G.tx - G.x;
          if (Math.abs(dx) > 6) { G.dir = dx > 0 ? 1 : -1; moving = true; }
          else if (Math.abs(want - G.x) > 6) G.dir = want > G.x ? 1 : -1;
          speed = 105;
          target = POSE.hiss;
          G.hissJ += dt;
          if (G.st > CHASE) {
            G.cooldown = 4;
            hush();
            G.state = 'pause'; G.st = 0; G.dur = 0.8;
            if (Math.random() < 0.6) bubble('honk.', 'sm', 1.2);
          }
          break;
        }
        case 'fly': {
          target = POSE.fly;
          G.flap += dt * (G.st < 0.3 ? 7 : 5.2);
          G.vx += G.dir * dt * 150; G.vx = clamp(G.vx, -260, 260);
          if (G.st > 0.28) G.vy = Math.min(320, G.vy + dt * 420);
          G.x += G.vx * dt; G.y += G.vy * dt;
          if (G.y > innerHeight + 40 || G.x < -G.w * 2 || G.x > vw + G.w) { removeGoose(); return; }
          break;
        }
      }

      // random small talk
      if (G.state === 'walk' || G.state === 'pause' || G.state === 'look') {
        G.honkT -= dt;
        if (G.honkT <= 0) { G.honkT = rnd(5, 10); if (G.bubbleT <= 0) bubble('honk', 'sm', 1.2); }
      }

      // locomotion
      if (moving && G.state !== 'fly') {
        const turning = Math.sign(G.face) !== G.dir || Math.abs(G.face) < 0.98;
        const sp = turning ? speed * 0.25 : speed;
        const step = Math.min(Math.abs(G.tx - G.x), sp * dt);
        G.x += G.dir * step;
        G.phase += (step / (21.5 * G.k)) * TAU;
        G.speed = sp;
      } else if (G.state !== 'fly') {
        G.speed = 0;
        // settle the legs back under the body
        const ph = ((G.phase % Math.PI) + Math.PI) % Math.PI;
        if (ph > 0.05 && ph < Math.PI - 0.05) G.phase += dt * 8 * (ph < Math.PI / 2 ? -1 : 1);
      }
      // facing: squash through zero, like turning around in profile
      G.face += clamp(G.dir - G.face, -dt / 0.11, dt / 0.11);
      G.flipHead += clamp(G.flipHeadT - G.flipHead, -dt / 0.08, dt / 0.08);

      // ease the pose
      const kk = 1 - Math.exp(-dt * (G.state === 'chase' || G.state === 'alarm' || G.alarmT > 0 ? 16 : 10));
      for (const key of KEYS) G.pose[key] = lerp(G.pose[key], target[key], kk);
    }
    function blend(a, b, t) { const o = {}; for (const key of KEYS) o[key] = lerp(a[key], b[key], t); return o; }

    // ---------- render ----------
    function rot(deg, x, y) { return 'rotate(' + deg.toFixed(2) + ' ' + x + ' ' + y + ')'; }
    function render(time) {
      if (!G) return;
      const P = G.pose;
      const flying = G.state === 'fly';
      const walking = G.state !== 'still' && !flying;
      const ph = G.phase;
      const A = 22;
      const sw = walking ? Math.sin(ph) : 0;
      // legs
      let thN = A * sw, thF = -A * sw;
      let liftN = walking ? Math.max(0, -Math.cos(ph)) : 0, liftF = walking ? Math.max(0, Math.cos(ph)) : 0;
      if (!G.speed || G.state === 'peck' || G.state === 'look' || G.state === 'pause' || G.state === 'alarm') { liftN *= 0.3; liftF *= 0.3; }
      if (flying) { const tuck = Math.min(1, G.st * 3); thN = thF = 75 * tuck; liftN = liftF = 0.3 * tuck; }
      legT(G.legN, 50, 72, thN, liftN);
      legT(G.legF, 44.5, 72, thF, liftF);
      // body: bob + waddle + crouch
      const bob = walking ? 1.3 * sw * sw : 0;
      const waddle = walking ? 2.4 * sw : 0;
      const pitch = flying ? -12 + 3 * Math.sin(G.flap * TAU) : P.crouch + waddle * 0.6;
      G.torso.setAttribute('transform', 'translate(0 ' + bob.toFixed(2) + ') ' + rot(pitch, 45, 62));
      G.wing.setAttribute('transform', rot(P.wing, 64, 51));
      // neck base follows the body
      const pr = pitch * Math.PI / 180;
      const nbx0 = 67, nby0 = 53;
      const nbx = 45 + (nbx0 - 45) * Math.cos(pr) - (nby0 - 62) * Math.sin(pr);
      const nby = 62 + (nbx0 - 45) * Math.sin(pr) + (nby0 - 62) * Math.cos(pr) + bob;
      let hx = P.hx + (nbx - nbx0), hy = P.hy + (nby - nby0);
      if (walking && G.speed > 1 && G.state !== 'chase') hx += 1.4 * Math.sin(ph * 2 + 0.6);
      if (G.state === 'chase') { hx += Math.sin(G.hissJ * 47) * 0.7; hy += Math.sin(G.hissJ * 31) * 0.5; }
      if (flying) { const fr = G.flap * TAU; hy += Math.sin(fr) * 1.2; }
      const c1x = nbx + P.c1x, c1y = nby + P.c1y, c2x = hx + P.c2x, c2y = hy + P.c2y;
      G.neck.setAttribute('d', neckPath(nbx, nby, c1x, c1y, c2x, c2y, hx, hy));
      G.head.setAttribute('transform', 'translate(' + hx.toFixed(2) + ' ' + hy.toFixed(2) + ') rotate(' + P.rot.toFixed(2) + ') scale(' + G.flipHead.toFixed(3) + ' 1)');
      G.jaw.setAttribute('transform', rot(P.beak * 20, 9.4, 1));
      G.tongue.style.opacity = P.beak > 0.3 ? '1' : '0';
      // flying wings: up and down through edge-on
      if (flying) {
        const fr = G.flap * TAU;
        const c = Math.cos(fr);
        const s = (c < 0 ? -1 : 1) * Math.max(0.18, Math.abs(c));
        const tN = 'translate(57 52) rotate(' + (-10 + 12 * Math.sin(fr)).toFixed(2) + ') scale(1.3 ' + (s * 1.3).toFixed(3) + ')';
        const tF = 'translate(52 50) rotate(' + (-18 + 12 * Math.sin(fr)).toFixed(2) + ') scale(1.15 ' + (s * 1.18).toFixed(3) + ')';
        G.fwN.setAttribute('transform', tN);
        G.fwF.setAttribute('transform', tF);
      }
      // facing
      G.flip.setAttribute('transform', 'translate(50 0) scale(' + (Math.abs(G.face) < 0.04 ? 0.04 * Math.sign(G.face || 1) : G.face).toFixed(3) + ' 1) translate(-50 0)');
      // place in the viewport
      G.el.style.transform = 'translate3d(' + G.x.toFixed(1) + 'px,' + (-G.y - LIFT).toFixed(1) + 'px,0)';
      const sh = clamp(1 - G.y / 160, 0, 1);
      const shx = px(46) - 30 * G.k + (flying ? G.vx * 0.05 : 0);
      G.shadow.style.transform = 'translate3d(' + shx.toFixed(1) + 'px,0,0) scale(' + (0.6 + 0.4 * sh).toFixed(3) + ',1)';
      G.shadow.style.opacity = sh.toFixed(3);
      positionBubble(hx, hy);
    }
    // a tapered neck: thick where it meets the breast, slimmer under the head,
    // ending in a clean curved collar line across the chest
    function neckPath(x0, y0, x1, y1, x2, y2, x3, y3) {
      const N = 14, L = [], Rr = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, u = 1 - t;
        const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
        const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
        let dx = 3 * u * u * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t * t * (x3 - x2);
        let dy = 3 * u * u * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t * t * (y3 - y2);
        const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
        const hw = (9.6 - 3.2 * Math.pow(t, 0.6)) / 2;
        L.push([x - dy * hw, y + dx * hw]); Rr.push([x + dy * hw, y - dx * hw]);
      }
      const f = n => n.toFixed(2);
      let d = 'M' + f(L[0][0]) + ' ' + f(L[0][1]);
      for (let i = 1; i <= N; i++) d += 'L' + f(L[i][0]) + ' ' + f(L[i][1]);
      const e = Rr[N], hw = 1.5;
      d += 'A' + hw + ' ' + hw + ' 0 0 0 ' + f(e[0]) + ' ' + f(e[1]);
      for (let i = N - 1; i >= 0; i--) d += 'L' + f(Rr[i][0]) + ' ' + f(Rr[i][1]);
      // collar: bow gently down across the chest
      const tx = x1 - x0, ty = y1 - y0, tm = Math.hypot(tx, ty) || 1;
      d += 'Q' + f(x0 - tx / tm * 3) + ' ' + f(y0 - ty / tm * 3) + ' ' + f(L[0][0]) + ' ' + f(L[0][1]) + 'Z';
      return d;
    }
    function legT(g, hipx, hipy, th, lift) {
      const sy = 1 - 0.2 * lift;
      g.setAttribute('transform', 'translate(' + hipx + ' ' + hipy + ') rotate(' + th.toFixed(2) + ')');
      g.firstChild.setAttribute('transform', 'scale(1 ' + sy.toFixed(3) + ')');
      // keep the foot level on the ground; curl the toes while it swings
      g.lastChild.setAttribute('transform', 'translate(0 ' + (-15.6 * (1 - sy)).toFixed(2) + ') ' + rot(-th + 16 * lift, 0, 15.6));
    }
    function positionBubble(hx, hy) {
      if (!G || G.bubbleT <= 0 && !G.bubble.classList.contains('is-on')) return;
      if (hx == null) { hx = G.pose.hx; hy = G.pose.hy; }
      const vw = vwNow();
      const big = G.bubbleKind === 'big';
      const f = G.face >= 0 ? 1 : -1;
      const hpx = px(hx + 6), hpy = py(hy - 4); // just above and ahead of the eye
      const bw = G.bw || 40, bh = G.bh || 22;
      let left = f > 0 ? hpx + 4 : hpx - 4 - bw;
      let ox = f > 0 ? '0%' : '100%';
      if (left + bw > vw - 6) { left = hpx - 4 - bw - 8 * G.k; ox = '100%'; }
      if (left < 6) { left = hpx + 4 + 8 * G.k; ox = '0%'; }
      left = clamp(left, 6, Math.max(6, vw - bw - 6));
      let bottom = hpy + (big ? 8 : 6);
      const mobile = vw < 640;
      if (mobile && G.state !== 'fly') bottom = Math.min(bottom, 90 - bh - 2);
      G.bubble.style.transform = 'translate3d(' + left.toFixed(1) + 'px,' + (-bottom).toFixed(1) + 'px,0)';
      G.say.style.setProperty('--ox', ox);
      const side = ox === '0%' ? 'r' : 'l';
      if (G.bubble.getAttribute('data-side') !== side) G.bubble.setAttribute('data-side', side);
    }

    function frame(now) {
      raf = 0;
      if (!G) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      update(dt);
      if (!G) return;
      render(now);
      raf = requestAnimationFrame(frame);
    }

    // ---------- wiring ----------
    document.addEventListener('goose:release', onRelease);
    document.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('pointerdown', onPointer, { passive: true });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    // one unprompted visit per session: not under reduced motion or the site's
    // motion switch, and not while a dialog covers the page (it waits for it)
    function motionOff() { return document.documentElement.classList.contains('motion-off'); }
    function autoVisit() {
      autoTimer = 0;
      if (G || RM() || motionOff() || seen()) return;
      if (dialogOpen()) { autoTimer = setTimeout(autoVisit, 5000); return; }
      spawn();
    }
    if (!RM() && !motionOff() && !seen() && autoDelay >= 0) autoTimer = setTimeout(autoVisit, autoDelay);

    return {
      release,
      destroy() {
        if (autoTimer) clearTimeout(autoTimer);
        document.removeEventListener('goose:release', onRelease);
        document.removeEventListener('pointermove', onPointer);
        document.removeEventListener('pointerdown', onPointer);
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
        removeGoose();
        eggs.forEach(e => e.remove()); eggs.clear();
        if (actx) { try { actx.close(); } catch (e) { /* noop */ } actx = null; }
        dropStyle();
      }
    };
  }

  FX.goose = { mount };
})();
