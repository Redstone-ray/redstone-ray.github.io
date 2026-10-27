/* ==========================================================================
   Richard Ding — site.js
   Renders the page from assets/js/data.js (window.SITE / PROJECTS / LAYOUT),
   runs the work grid, the project view (#/work/<slug>), the Liquafilm theme
   toggle, and mounts the FX toys defensively.
   Classic script, no modules, no globals (only reads window.FX / SITE / …).
   ========================================================================== */
(function () {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const SITE = window.SITE || null;
  const PROJECTS = (Array.isArray(window.PROJECTS) ? window.PROJECTS : []).filter(function (p) {
    return p && p.slug && !p.hidden;
  });
  const BY_SLUG = new Map(PROJECTS.map(function (p) { return [p.slug, p]; }));
  const LAYOUT = Array.isArray(window.LAYOUT) ? window.LAYOUT : [];

  const mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} }; };
  const mqReduce = mq('(prefers-reduced-motion: reduce)');
  const mqFine = mq('(hover: hover) and (pointer: fine)');
  const mqDark = mq('(prefers-color-scheme: dark)');
  // The OS setting, or the site's own motion switch (html.motion-off, see setupMotion).
  const reduced = function () { return mqReduce.matches || root.classList.contains('motion-off'); };

  const $ = function (s, el) { return (el || doc).querySelector(s); };
  const $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); };

  const store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  /* Tiny element builder. Attribute order is preserved (matters for <img>:
     loading/sizes/srcset must be set before src). */
  function h(tag, props, kids) {
    const n = doc.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'style') {
          Object.keys(v).forEach(function (s) { n.style.setProperty(s, v[s]); });
        } else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v === true ? '' : String(v));
      });
    }
    if (kids != null) {
      [].concat(kids).forEach(function (c) {
        if (c == null || c === false) return;
        n.append(c.nodeType ? c : doc.createTextNode(String(c)));
      });
    }
    return n;
  }

  const pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  const clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  const isExternal = function (url) { return /^https?:\/\//i.test(url); };
  // The visible ↗ is decoration; screen readers hear the words instead.
  const newTabHint = function () {
    return [h('span', { class: 'ext', 'aria-hidden': 'true', text: '↗' }), h('span', { class: 'sr-only', text: ' (opens in new tab)' })];
  };
  const markNewTab = function (a) {
    a.target = '_blank';
    a.rel = 'noopener';
    if (!a.querySelector('.sr-only')) a.append(h('span', { class: 'sr-only', text: ' (opens in new tab)' }));
  };

  function safePlay(v) {
    if (!v || !v.paused) return;
    try {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* interrupted or blocked: stay on poster */ });
    } catch (e) { /* ignore */ }
  }

  /* -------- Media helpers -------- */
  // Every .webp under assets/media has a 720px "-sm" twin, except in these folders.
  // Full https:// URLs (images hosted elsewhere) never have one.
  const NO_SMALL = [];
  function smallOf(src) {
    if (!src || isExternal(src) || !/\.webp$/i.test(src) || /-(sm|poster)\.webp$/i.test(src)) return null;
    for (let i = 0; i < NO_SMALL.length; i++) if (src.indexOf(NO_SMALL[i]) === 0) return null;
    return src.replace(/\.webp$/i, '-sm.webp');
  }
  // Animated SVG covers carry a frozen twin ("still"). An <img> can't hear the
  // site's motion switch, so swap the file itself: still under reduced motion.
  function motionSrc(src, still) { return still && reduced() ? still : src; }
  function markStill(img, src, still) {
    if (!still) return;
    img.setAttribute('data-anim', src);
    img.setAttribute('data-still', still);
  }
  function syncStills() {
    const r = reduced();
    $$('img[data-still]').forEach(function (img) {
      const want = img.getAttribute(r ? 'data-still' : 'data-anim');
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    });
  }
  doc.addEventListener('motionchange', syncStills);
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', syncStills);
  function responsiveImg(src, alt, sizes, cls) {
    const sm = smallOf(src);
    const img = h('img', {
      class: cls,
      alt: alt || '',
      loading: 'lazy',
      decoding: 'async',
      draggable: 'false',
      sizes: sm ? sizes : null,
      srcset: sm ? sm + ' 720w, ' + src + ' 1600w' : null,
      src: src
    });
    img.addEventListener('error', function () {
      if (img.hasAttribute('srcset')) { img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = src; }
    }, { once: true });
    return img;
  }
  // One src, chosen for the viewport (no srcset, so naturalWidth stays honest).
  function pickSrc(src) {
    const sm = smallOf(src);
    return sm && window.innerWidth < 600 ? sm : src;
  }

  /* ======================================================================
     Content from data.js
     ====================================================================== */
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }

  function renderContent() {
    if (!SITE) return;

    $$('[data-bind]').forEach(function (el) {
      const v = get(SITE, el.getAttribute('data-bind'));
      if (typeof v === 'string' && v) el.textContent = v;
    });
    $$('[data-bind-html]').forEach(function (el) {
      const v = get(SITE, el.getAttribute('data-bind-html'));
      if (typeof v === 'string' && v) el.innerHTML = v;
    });

    // Eyebrow: wrap only between its " · " segments
    const eb = $('#hero-eyebrow');
    if (eb && SITE.hero && SITE.hero.eyebrow) {
      const parts = String(SITE.hero.eyebrow).split(/\s+·\s+/);
      const kids = [];
      parts.forEach(function (t, i) {
        // the separator's own padding sets the spacing; <wbr> lets the line break after it
        if (i) kids.push(h('span', { class: 'sep', 'aria-hidden': 'true', text: '·' }), h('wbr'));
        kids.push(h('span', { class: 'seg', text: t }));
      });
      eb.replaceChildren.apply(eb, kids);
    }

    // About copy
    const copy = $('#about-copy');
    if (copy && Array.isArray(SITE.about) && SITE.about.length) {
      copy.replaceChildren.apply(copy, SITE.about.map(function (html, i) {
        return h('p', { class: i === 0 ? 'about__lede' : null, html: html });
      }));
      $$('a[href^="http"]', copy).forEach(markNewTab);
    }

    // Facts
    const facts = $('#facts');
    if (facts && Array.isArray(SITE.facts)) {
      facts.replaceChildren.apply(facts, SITE.facts.map(function (f) {
        return h('div', null, [h('dt', { text: f.k }), h('dd', { text: f.v })]);
      }));
    }

    renderDegree();
    renderCV();

    // Email everywhere
    if (SITE.email) {
      const mail = 'mailto:' + SITE.email;
      ['#ft-mail', '#ft-email'].forEach(function (s) { const a = $(s); if (a) a.href = mail; });
      const fe = $('#ft-email'); if (fe) fe.textContent = SITE.email;
    }

    const count = $('#work-count');
    if (count) count.textContent = '(' + PROJECTS.length + ')';
  }

  function renderDegree() {
    const box = $('#degree');
    const d = SITE && SITE.degree;
    if (!box || !d || !d.start || !d.end) return;
    const start = new Date(d.start + 'T00:00:00');
    const end = new Date(d.end + 'T00:00:00');
    if (isNaN(start) || isNaN(end) || end <= start) return;
    const p = clamp((Date.now() - start) / (end - start), 0, 1);
    const pct = Math.round(p * 100);
    const fmt = function (dt) {
      try { return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); } catch (e) { return String(dt.getFullYear()); }
    };
    box.hidden = false;
    $('.degree__name', box).textContent = d.label || 'Mechatronics engineer';
    $('.degree__almost', box).textContent = pct >= 100 ? '(done!)' : '(almost)';
    $('.degree__start', box).textContent = fmt(start);
    $('.degree__end', box).textContent = fmt(end);
    box.style.setProperty('--p', p.toFixed(4));
    const track = $('.degree__track', box);
    track.setAttribute('aria-valuenow', String(pct));
    track.setAttribute('aria-valuetext', pct + '% of the way to a degree');
    const num = $('.degree__num', box);

    const show = function () {
      box.classList.add('is-in');
      if (reduced()) { num.textContent = String(pct); return; }
      const t0 = performance.now(), dur = 1800;
      const ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
      (function step(now) {
        const t = clamp((now - t0) / dur, 0, 1);
        num.textContent = String(Math.round(ease(t) * pct));
        if (t < 1) requestAnimationFrame(step);
      })(t0);
    };
    if (!('IntersectionObserver' in window) || reduced()) { show(); return; }
    const io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); show(); } });
    }, { threshold: .6 });
    io.observe(track);
  }

  function renderCV() {
    const body = $('#cv-body');
    const cv = SITE && SITE.cv;
    if (!body || !cv) return;

    const item = function (e) {
      return h('li', { class: 'cv__item' }, [
        h('span', { class: 'cv__when', text: e.when || '' }),
        h('div', null, [
          h('p', { class: 'cv__what', text: e.what || '' }),
          e.where ? h('p', { class: 'cv__where', text: e.where }) : null,
          e.note ? h('p', { class: 'cv__note', text: e.note }) : null
        ])
      ]);
    };
    const kv = function (e) {
      return h('li', { class: 'cv__item' }, [
        h('span', { class: 'cv__key', text: e.k || '' }),
        h('p', { class: 'cv__val', text: e.v || '' })
      ]);
    };
    const group = function (title, list, fn) {
      if (!Array.isArray(list) || !list.length) return null;
      return h('div', { class: 'cv__group' }, [
        h('h3', { class: 'cv__h', text: title }),
        h('ol', { class: 'cv__list' }, list.map(fn || item))
      ]);
    };
    const pubs = cv.publications && cv.publications.show ? cv.publications.items : null;

    body.replaceChildren.apply(body, [
      group('Experience', cv.experience),
      group('Education', cv.education),
      pubs ? group('Publications', pubs) : null,
      group('Talks', cv.talks),
      group('Awards', cv.awards),
      group('Service', cv.service),
      group('Skills', cv.skills, kv)
    ].filter(Boolean));

    // Links row
    const links = $('#cv-links');
    if (links) {
      const items = [];
      if (SITE.email) items.push(h('li', null, h('a', { href: 'mailto:' + SITE.email, text: SITE.email })));
      (SITE.links || []).forEach(function (l) {
        items.push(h('li', null, h('a', { href: l.url, target: '_blank', rel: 'noopener' }, [l.label].concat(newTabHint()))));
      });
      if (items.length) links.replaceChildren.apply(links, items);
    }
    const ftl = $('#ft-links');
    if (ftl && Array.isArray(SITE.links) && SITE.links.length) {
      ftl.replaceChildren.apply(ftl, SITE.links.map(function (l) {
        return h('li', null, h('a', { href: l.url, target: '_blank', rel: 'noopener' }, [l.label].concat(newTabHint())));
      }));
    }

    revealOnce($$('.cv__group', body), 'will-reveal', 80);
  }

  /* ======================================================================
     Reveal-on-scroll (once)
     ====================================================================== */
  function revealOnce(els, cls, stagger) {
    if (!els.length || reduced() || !('IntersectionObserver' in window)) return;
    els.forEach(function (el) { el.classList.add(cls); });
    const io = new IntersectionObserver(function (entries) {
      const hits = entries.filter(function (e) { return e.isIntersecting; });
      hits.sort(function (a, b) {
        return (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left);
      });
      hits.forEach(function (e, i) {
        const el = e.target;
        io.unobserve(el);
        el.style.transitionDelay = (i * stagger) + 'ms';
        el.classList.add('is-in');
        setTimeout(function () {
          el.classList.remove(cls, 'is-in');
          el.style.transitionDelay = '';
        }, 900 + i * stagger);
      });
    }, { threshold: .08, rootMargin: '0px 0px -5% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ======================================================================
     Work grid
     ====================================================================== */
  const grid = { el: null, order: [], rows: [], tiles: new Map(), videos: [], mode: '', io: null };

  function buildGrid() {
    grid.el = $('#grid');
    if (!grid.el || !PROJECTS.length) return;

    const seen = new Set();
    const rows = [];
    LAYOUT.forEach(function (r) {
      if (!Array.isArray(r)) return;
      const row = r.map(function (s) { return BY_SLUG.get(s); }).filter(function (p) {
        if (!p || seen.has(p.slug)) return false;
        seen.add(p.slug); return true;
      });
      if (row.length) rows.push(row);
    });
    const rest = PROJECTS.filter(function (p) { return !seen.has(p.slug); });
    for (let i = 0; i < rest.length; i += 3) rows.push(rest.slice(i, i + 3));
    grid.rows = rows;
    grid.order = rows.reduce(function (a, r) { return a.concat(r); }, []);

    rows.forEach(function (row) {
      const sum = row.reduce(function (s, p) { return s + aspectOf(p); }, 0);
      row.forEach(function (p) {
        const vw = Math.round(aspectOf(p) / sum * 100);
        grid.tiles.set(p.slug, makeTile(p, '(min-width: 900px) ' + clamp(vw, 20, 100) + 'vw, (min-width: 600px) 50vw, 100vw'));
      });
    });

    layoutGrid();
    [mq('(min-width: 900px)'), mq('(min-width: 600px)')].forEach(function (m) {
      if (m.addEventListener) m.addEventListener('change', layoutGrid);
    });

    setupTileVideos();
    revealOnce(Array.from(grid.tiles.values()), 'will-reveal', 60);
  }

  function aspectOf(p) {
    const a = p.cover && +p.cover.aspect;
    return a > 0 ? a : 1.33;
  }

  function layoutGrid() {
    const w = window.innerWidth;
    const mode = w >= 900 ? 'd' : w >= 600 ? 't' : 'm';
    if (mode === grid.mode) return;
    grid.mode = mode;

    let groups;
    if (mode === 'd') groups = grid.rows;
    else {
      const n = mode === 't' ? 2 : 1;
      groups = [];
      for (let i = 0; i < grid.order.length; i += n) groups.push(grid.order.slice(i, i + n));
    }
    const frag = doc.createDocumentFragment();
    groups.forEach(function (g, ri) {
      const row = h('div', { class: 'grid__row' + (mode === 'd' && ri % 2 === 1 ? ' grid__row--inset' : '') });
      g.forEach(function (p) {
        const t = grid.tiles.get(p.slug);
        let a = aspectOf(p);
        if (mode === 't') a = clamp(a, .9, 1.5);
        if (mode === 'm') a = clamp(a, .85, 1.5);
        t.style.setProperty('--a', String(a));
        // flex-grow below 1 would leave a lone portrait tile short of the row's width
        t.style.flexGrow = g.length === 1 && a < 1 ? '1' : '';
        row.append(t);
      });
      frag.append(row);
    });
    grid.el.replaceChildren(frag);

    // Moving a <video> pauses it; re-arm the observer so visible ones resume.
    if (grid.io) grid.videos.forEach(function (v) { grid.io.unobserve(v); grid.io.observe(v); });
  }

  function makeTile(p, sizes) {
    const c = p.cover || {};
    const tone = c.tone === 'light' ? 'light' : 'dark';
    const contain = c.fit === 'contain';
    const bg = c.bg || '';
    const nearWhite = /^#(f{3}|f{6}|f[0-9a-f]f[0-9a-f]f[0-9a-f])$/i.test(bg);

    const paper = tone === 'light' && !contain && c.type !== 'video';
    // An illustration drawn on its own paper: the tile is that paper, edge to edge.
    const sheet = paper && /\.svg$/i.test(c.src || '');
    const a = h('a', {
      class: 'tile tile--' + tone + (contain ? ' tile--contain' : '') + (paper ? ' tile--paper' : '') + (sheet ? ' tile--sheet' : '') + (c.hover ? ' tile--has-hover' : '') + (nearWhite ? ' tile--edge' : '') + (c.scrim === 'strong' ? ' tile--scrim-strong' : '') + (c.feather ? ' tile--feather' : ''),
      href: '#/work/' + p.slug,
      'data-slug': p.slug,
      'aria-label': p.title + '. ' + p.caption,
      style: bg ? { '--tile-bg': bg } : null
    });

    const media = h('div', { class: 'tile__media' });
    if (c.type === 'video' && c.src) {
      const v = h('video', {
        class: 'tile__img',
        muted: true, loop: true, playsinline: true,
        preload: 'none',
        poster: c.poster || null,
        'aria-hidden': 'true',
        disablepictureinpicture: true,
        disableremoteplayback: true
      }, h('source', { src: c.src, type: 'video/mp4' }));
      v.muted = true;
      media.append(v);
      grid.videos.push(v);
    } else if (c.src) {
      const base = responsiveImg(motionSrc(c.src, c.still), c.alt || p.title, sizes, 'tile__img tile__img--base');
      markStill(base, c.src, c.still);
      media.append(base);
      if (c.hover) media.append(responsiveImg(c.hover, '', sizes, 'tile__img tile__img--hover'));
      if (paper && !sheet) base.addEventListener('load', function () { matchPaper(a, base); }, { once: true });
    }
    a.append(media);
    if (tone === 'dark' && !contain) a.append(h('div', { class: 'tile__scrim', 'aria-hidden': 'true' }));
    a.append(h('div', { class: 'tile__text', 'aria-hidden': 'true' }, [
      h('p', { class: 'tile__meta', text: [p.year, p.where].filter(Boolean).join(' · ') }),
      h('p', { class: 'tile__cap', text: p.caption })
    ]));

    a.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      pv.pending = { scroll: window.scrollY, hash: location.hash, origin: a, viaNav: true };
    });
    return a;
  }

  // Light renders sit on their own paper colour; sample it so the tile is seamless.
  function matchPaper(tile, img) {
    try {
      const cv = doc.createElement('canvas');
      cv.width = cv.height = 4;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 4, 4, 0, 0, 4, 4);
      const d = ctx.getImageData(1, 1, 1, 1).data;
      if (d[3] > 250 && d[0] + d[1] + d[2] > 600) {
        tile.style.setProperty('--tile-bg', 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')');
        tile.classList.toggle('tile--edge', d[0] + d[1] + d[2] > 735);
      }
    } catch (e) { /* tainted or unsupported: keep the data colour */ }
  }

  function setupTileVideos() {
    if (!grid.videos.length || !('IntersectionObserver' in window)) return;
    grid.io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        const v = e.target;
        v._visible = e.isIntersecting && e.intersectionRatio >= .4;
        syncTileVideo(v);
      });
    }, { threshold: [0, .4, .6] });
    grid.videos.forEach(function (v) { grid.io.observe(v); });

    doc.addEventListener('visibilitychange', syncAllTileVideos);
    doc.addEventListener('motionchange', syncAllTileVideos);
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', syncAllTileVideos);
  }
  function syncTileVideo(v) {
    const want = v._visible && !reduced() && !doc.hidden && !pv.open;
    if (want) safePlay(v); else if (!v.paused) v.pause();
  }
  function syncAllTileVideos() { grid.videos.forEach(syncTileVideo); }

  /* ======================================================================
     "view" cursor bubble (fine pointers only)
     ====================================================================== */
  function setupCursor() {
    if (!mqFine.matches || !grid.tiles.size) return;
    const dot = h('span', { class: 'cursor__dot', text: 'view' });
    const c = h('div', { class: 'cursor', 'aria-hidden': 'true' }, dot);
    doc.body.append(c);
    root.classList.add('has-cursor');

    let x = -200, y = -200, tx = x, ty = y, vx = 0, vy = 0, raf = 0, on = false, seen = false;
    const set = function (state) {
      if (state === on) return;
      on = state;
      c.classList.toggle('is-on', on);
    };
    const step = function () {
      if (reduced()) { x = tx; y = ty; vx = vy = 0; }
      else {
        vx = (vx + (tx - x) * .24) * .62;
        vy = (vy + (ty - y) * .24) * .62;
        x += vx; y += vy;
      }
      c.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      if (Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) > .2) raf = requestAnimationFrame(step);
      else raf = 0;
    };
    const kick = function () { if (!raf) raf = requestAnimationFrame(step); };
    const test = function (target) {
      const t = target && target.closest ? target.closest('.tile') : null;
      set(!!t && !pv.open);
    };

    doc.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!seen) { x = tx; y = ty; seen = true; }
      test(e.target);
      kick();
    }, { passive: true });
    doc.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && on) dot.style.transform = 'scale(.86)'; }, { passive: true });
    doc.addEventListener('pointerup', function () { dot.style.transform = ''; }, { passive: true });
    root.addEventListener('mouseleave', function () { set(false); });
    let scrollRaf = 0;
    window.addEventListener('scroll', function () {
      if (!seen || scrollRaf) return;
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = 0;
        test(doc.elementFromPoint(tx, ty));
      });
    }, { passive: true });
    pv.onToggle.push(function () { if (pv.open) set(false); });
  }

  /* ======================================================================
     Project view + hash routing
     ====================================================================== */
  const ROUTE = /^#\/work\/([A-Za-z0-9_-]+)\/?$/;
  const pv = {
    dlg: null, sheet: null, content: null,
    open: false, slug: null, viaNav: false,
    returnScroll: 0, returnHash: '', origin: null,
    pending: null, io: null, videos: [], onToggle: [],
    closeTimer: 0, swapTimer: 0, baseTitle: doc.title
  };

  function slugFromHash(hash) {
    const m = (hash || '').match(ROUTE);
    return m && BY_SLUG.has(m[1]) ? m[1] : null;
  }

  function setupOverlay() {
    pv.dlg = $('#pv');
    pv.sheet = $('#pv-sheet');
    pv.content = $('#pv-content');
    if (!pv.dlg || !pv.sheet || !pv.content || !PROJECTS.length) return false;
    if (typeof pv.dlg.showModal !== 'function') {
      // Very old browser: fall back to a plain fixed overlay.
      pv.dlg.showModal = function () { pv.dlg.setAttribute('open', ''); };
      pv.dlg.close = function () { pv.dlg.removeAttribute('open'); };
    }

    $('.pv__back', pv.dlg).addEventListener('click', requestClose);
    pv.dlg.addEventListener('cancel', function (e) { e.preventDefault(); requestClose(); });
    pv.dlg.addEventListener('keydown', onOverlayKey);

    // prev / next replace the current history entry, so Back still closes.
    pv.dlg.addEventListener('click', function (e) {
      const a = e.target.closest && e.target.closest('a[data-go]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(a.getAttribute('data-go'));
    });

    let st = 0;
    pv.sheet.addEventListener('scroll', function () {
      if (st) return;
      st = requestAnimationFrame(function () {
        st = 0;
        pv.sheet.classList.toggle('is-scrolled', pv.sheet.scrollTop > 4);
      });
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      pv.io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          const v = e.target;
          // 40% of the video, or (for tall ones) 30% of the screen
          v._visible = e.isIntersecting && (e.intersectionRatio >= .4 || e.intersectionRect.height >= window.innerHeight * .3);
          syncOverlayVideo(v);
          if (e.isIntersecting && v._onSeen) { const f = v._onSeen; v._onSeen = null; f(); }
        });
      }, { threshold: [0, .1, .2, .3, .4, .6] });
    }

    const syncVideos = function () { pv.videos.forEach(syncOverlayVideo); };
    doc.addEventListener('visibilitychange', syncVideos);
    doc.addEventListener('motionchange', syncVideos);

    // Let the toys sleep under an open project (fingering, plunger and sumo listen).
    pv.onToggle.push(function () {
      root.classList.toggle('pv-open', pv.open);
      doc.dispatchEvent(new CustomEvent('overlaychange', { detail: { open: pv.open } }));
    });
    return true;
  }

  function onRoute() {
    const slug = slugFromHash(location.hash);
    if (slug) {
      if (pv.open) { if (slug !== pv.slug) swapProject(slug); }
      else openOverlay(slug);
      return;
    }
    if (ROUTE.test(location.hash)) {
      // Unknown project: drop the route quietly.
      history.replaceState(null, '', location.pathname + location.search + '#work');
      if (pv.open) closeOverlay(); else scrollToId('work', true);
      return;
    }
    if (pv.open) closeOverlay();
  }

  function openOverlay(slug) {
    const pend = pv.pending || {};
    pv.pending = null;
    pv.viaNav = !!pend.viaNav;
    pv.returnScroll = pend.scroll != null ? pend.scroll : window.scrollY;
    pv.returnHash = pv.viaNav ? (pend.hash || '') : '';
    pv.origin = pend.origin || grid.tiles.get(slug) || null;
    pv.open = true;
    clearTimeout(pv.closeTimer);

    renderProject(slug);
    lockScroll(true);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    pv.dlg.classList.remove('is-closing');
    if (!pv.dlg.open) pv.dlg.showModal();
    pv.sheet.scrollTop = 0;
    pv.sheet.classList.remove('is-scrolled');
    try { pv.sheet.focus({ preventScroll: true }); } catch (e) { pv.sheet.focus(); }

    if (reduced()) pv.dlg.classList.add('is-open');
    else {
      void pv.sheet.offsetWidth; // commit the off-screen start state
      requestAnimationFrame(function () { pv.dlg.classList.add('is-open'); });
    }
    syncAllTileVideos();
    pv.onToggle.forEach(function (f) { f(); });
  }

  function requestClose() {
    if (!pv.open) return;
    if (pv.viaNav && ROUTE.test(location.hash)) {
      history.back(); // hashchange → closeOverlay
      clearTimeout(pv.closeTimer);
      pv.closeTimer = setTimeout(function () { if (pv.open) closeOverlay(); }, 450);
    } else {
      history.replaceState(null, '', location.pathname + location.search + (pv.returnHash || ''));
      closeOverlay();
    }
  }

  function closeOverlay() {
    if (!pv.open) return;
    pv.open = false;
    clearTimeout(pv.closeTimer);
    pv.videos.forEach(function (v) { try { v.pause(); } catch (e) { /* ignore */ } });

    const finish = function () {
      pv.sheet.removeEventListener('transitionend', onEnd);
      clearTimeout(fallback);
      if (pv.open) return; // reopened meanwhile
      pv.dlg.classList.remove('is-open', 'is-closing');
      if (pv.dlg.open) pv.dlg.close();
      teardownMedia();
      pv.content.replaceChildren();
      pv.slug = null;
      doc.title = pv.baseTitle;
      lockScroll(false);

      if (pv.viaNav) window.scrollTo(0, pv.returnScroll);
      else {
        // Deep link: land the visitor on the tile they just looked at.
        const t = pv.origin;
        if (t && t.getBoundingClientRect) {
          const r = t.getBoundingClientRect();
          window.scrollTo(0, Math.max(0, window.scrollY + r.top - (window.innerHeight - r.height) / 2));
        }
      }
      if (pv.origin && pv.origin.focus) { try { pv.origin.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
      syncAllTileVideos();
      pv.onToggle.forEach(function (f) { f(); });
    };
    const onEnd = function (e) { if (e.target === pv.sheet && e.propertyName === 'transform') finish(); };
    let fallback = 0;

    if (reduced()) { finish(); return; }
    pv.dlg.classList.add('is-closing');
    pv.dlg.classList.remove('is-open');
    pv.sheet.addEventListener('transitionend', onEnd);
    fallback = setTimeout(finish, 800);
  }

  function go(slug) {
    if (!BY_SLUG.has(slug)) return;
    history.replaceState(null, '', location.pathname + location.search + '#/work/' + slug);
    swapProject(slug);
  }

  function swapProject(slug) {
    if (slug === pv.slug) return;
    pv.slug = slug; // so rapid prev/next presses step from the target
    // Deep links return to whichever tile was last viewed; clicks return to the clicked tile.
    if (!pv.viaNav) pv.origin = grid.tiles.get(slug) || pv.origin;
    clearTimeout(pv.swapTimer);
    // Focus on a link inside the old content (e.g. "next project") would be lost
    // when it is replaced: move it to the new title instead.
    const render = function () {
      const ae = doc.activeElement;
      const wasInside = pv.content.contains(ae) || ae === doc.body;
      renderProject(slug);
      pv.sheet.scrollTop = 0;
      announceProject(slug);
      if (wasInside) {
        const t = $('#pv-title');
        if (t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
      }
    };
    if (reduced()) { render(); return; }
    pv.content.classList.add('is-swapping');
    pv.swapTimer = setTimeout(function () {
      render();
      requestAnimationFrame(function () { pv.content.classList.remove('is-swapping'); });
    }, 180);
  }

  function announceProject(slug) {
    const live = $('#pv-live');
    const p = BY_SLUG.get(slug);
    const nb = neighbours(slug);
    if (!live || !p) return;
    live.textContent = nb ? 'Project ' + (nb.i + 1) + ' of ' + nb.n + ': ' + p.title : p.title;
  }

  function onOverlayKey(e) {
    if (e.key === 'Tab') trapTab(e);
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = neighbours(pv.slug);
      if (!n) return;
      e.preventDefault();
      go(e.key === 'ArrowRight' ? n.next.slug : n.prev.slug);
    }
  }

  function trapTab(e) {
    const f = $$('a[href], button:not([disabled]), input:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])', pv.dlg)
      .filter(function (el) { return el.offsetParent !== null || el === doc.activeElement; });
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (doc.activeElement === first || doc.activeElement === pv.sheet)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function neighbours(slug) {
    const list = grid.order.length ? grid.order : PROJECTS;
    const i = list.findIndex(function (p) { return p.slug === slug; });
    if (i < 0) return null;
    return { i: i, n: list.length, prev: list[(i - 1 + list.length) % list.length], next: list[(i + 1) % list.length] };
  }

  function lockScroll(on) {
    if (on) {
      const sbw = window.innerWidth - root.clientWidth;
      root.style.setProperty('--sbw', Math.max(0, sbw) + 'px');
      root.classList.add('is-locked');
    } else {
      root.classList.remove('is-locked');
      root.style.removeProperty('--sbw');
    }
  }

  function teardownMedia() {
    pv.videos.forEach(function (v) {
      if (pv.io) pv.io.unobserve(v);
      try { v.pause(); v.removeAttribute('src'); } catch (e) { /* ignore */ }
    });
    pv.videos = [];
  }

  /* -------- Project page rendering -------- */
  function renderProject(slug) {
    const p = BY_SLUG.get(slug);
    if (!p) return;
    teardownMedia();
    pv.slug = slug;
    const nb = neighbours(slug);

    // Top bar
    const count = $('#pv-count');
    if (count && nb) count.textContent = pad2(nb.i + 1) + ' / ' + pad2(nb.n);
    const prev = $('#pv-prev'), next = $('#pv-next');
    if (nb) {
      prev.href = '#/work/' + nb.prev.slug; prev.setAttribute('data-go', nb.prev.slug); prev.setAttribute('aria-label', 'Previous project: ' + nb.prev.title);
      next.href = '#/work/' + nb.next.slug; next.setAttribute('data-go', nb.next.slug); next.setAttribute('aria-label', 'Next project: ' + nb.next.title);
    }

    // Header
    const meta = h('dl', { class: 'pv__meta' });
    [['year', p.year], ['where', p.where], ['role', p.role]].forEach(function (r) {
      if (r[1]) meta.append(h('dt', { text: r[0] }), h('dd', { text: r[1] }));
    });
    const tags = Array.isArray(p.tags) && p.tags.length
      ? h('ul', { class: 'chips', 'aria-label': 'Tags' }, p.tags.map(function (t) { return h('li', { text: t }); }))
      : null;
    const text = h('div', { class: 'pv__text' }, (p.body || []).map(function (para) { return h('p', { html: para }); }));
    $$('a[href^="http"]', text).forEach(markNewTab);
    const links = Array.isArray(p.links) && p.links.length
      ? h('p', { class: 'pv__links' }, p.links.map(function (l) {
        const ext = isExternal(l.url);
        return h('a', { href: l.url, target: ext ? '_blank' : null, rel: ext ? 'noopener' : null }, [l.label].concat(ext ? newTabHint() : []));
      }))
      : null;

    // a plain div: the dialog shouldn't expose a second banner landmark
    const head = h('div', { class: 'pv__head' }, [
      h('div', { class: 'pv__intro' }, [
        h('p', { class: 'pv__kicker', text: nb ? 'No. ' + pad2(nb.i + 1) : 'project' }),
        h('h2', { class: 'pv__title', id: 'pv-title', tabindex: '-1', text: p.title }),
        h('p', { class: 'pv__deck', text: p.caption })
      ]),
      h('div', { class: 'pv__info' }, [meta, tags, text, links])
    ]);

    const gallery = buildGallery(p);

    const nextBlock = nb && nb.n > 1 ? h('div', { class: 'pv__next-block' },
      h('a', { class: 'pv__next-link', href: '#/work/' + nb.next.slug, 'data-go': nb.next.slug }, [
        h('span', { class: 'pv__next-k', text: 'next project' }),
        h('span', { class: 'pv__next-t' }, [nb.next.title + ' ', h('span', { class: 'arr', 'aria-hidden': 'true', text: '→' })]),
        h('span', { class: 'pv__next-c', text: nb.next.caption })
      ])) : null;

    pv.content.replaceChildren.apply(pv.content, [head, gallery, nextBlock].filter(Boolean));
    doc.title = p.title + ' — Richard Ding';
  }

  function buildGallery(p) {
    const items = (Array.isArray(p.gallery) ? p.gallery : []).slice();
    const c = p.cover || {};
    const used = new Set();
    items.forEach(function (it) { [it.src, it.before, it.after].forEach(function (s) { if (s) used.add(s); }); });

    // Lead with the tile's own media when the gallery doesn't already show it
    // (cover.lead: false opts out, e.g. when the gallery opens on the same scene).
    if (c.src && !used.has(c.src) && c.lead !== false) {
      items.unshift({
        type: c.type === 'video' ? 'video' : 'image',
        src: c.src, poster: c.poster, still: c.still, alt: c.alt || p.title,
        wide: true, plate: c.bg || (c.type === 'video' ? '#0b0b0b' : null), cover: true
      });
    }
    if (items.length === 1) items[0] = Object.assign({}, items[0], { wide: true });
    if (!items.length) return null;

    // Rows: wide items alone; others in pairs (a lone leftover keeps its half-width slot).
    const rows = [];
    let pair = [];
    const flush = function () {
      if (pair.length === 1) rows.push({ kind: 'solo', items: pair });
      else if (pair.length) rows.push({ kind: 'pair', items: pair });
      pair = [];
    };
    items.forEach(function (it) {
      if (it.wide) { flush(); rows.push({ kind: 'wide', items: [it] }); }
      else { pair.push(it); if (pair.length === 2) flush(); }
    });
    flush();

    return h('div', { class: 'gallery' }, rows.map(function (row) {
      const figs = row.items.map(figure);
      const el = h('div', { class: 'g-row' + (row.kind === 'pair' ? '' : ' g-row--' + row.kind) }, figs);
      if (row.kind === 'pair') {
        // Like the wide rows, a pair is never taller than the screen: cap the row's
        // width at (sum of aspects) x 82vh once the figures know their shapes.
        const fit = function () {
          const sum = figs.reduce(function (t, f) { return t + (parseFloat(f.style.getPropertyValue('--a')) || 1.333); }, 0);
          el.style.setProperty('--rowa', sum.toFixed(4));
        };
        figs.forEach(function (f) { f._onAspect = fit; });
        fit();
      }
      return el;
    }));
  }

  function figure(it) {
    if (it.type === 'compare') return figCompare(it);
    const isVideo = it.type === 'video';
    const isSvg = !isVideo && /\.svg$/i.test(it.src || '');
    const fig = h('figure', { class: 'g-item g-item--' + (isVideo ? 'video' : 'image') + (isSvg ? ' g-item--svg' : '') + (it.edge ? ' g-item--edge' : '') });
    // Only videos and drawings get a plate; photos and renders hug their own edges.
    // The illustrations are drawn on paper (#f4f2ee), so their plate is paper too.
    const frame = h('div', {
      class: 'g-frame' + (isSvg ? ' has-plate' : ''),
      style: isVideo || isSvg ? { '--plate': it.plate || (isSvg ? '#f4f2ee' : '#050403') } : null
    });
    fig.append(frame);
    if (it.caption) fig.append(h('figcaption', { class: 'g-cap', text: it.caption }));

    const setAspect = function (w, hgt) {
      if (w > 0 && hgt > 0) fig.style.setProperty('--a', (w / hgt).toFixed(4));
      if (fig._onAspect) fig._onAspect();
    };

    if (isVideo) {
      const v = h('video', {
        class: 'g-media g-video', muted: true, loop: true, playsinline: true, preload: 'none',
        poster: it.poster || null, 'aria-label': it.alt || '',
        disablepictureinpicture: true, disableremoteplayback: true
      }, h('source', { src: it.src, type: 'video/mp4' }));
      v.muted = true;
      const btn = h('button', { class: 'g-vbtn', type: 'button', 'aria-label': 'Play video' }, [h('i'), h('span', { text: 'play' })]);
      frame.append(v, btn);
      if (it.poster) {
        const probe = new Image();
        probe.onload = function () { setAspect(probe.naturalWidth, probe.naturalHeight); fig.classList.add('is-ready'); };
        probe.onerror = function () { fig.classList.add('is-ready'); };
        probe.src = it.poster;
      } else fig.classList.add('is-ready');
      v.addEventListener('loadedmetadata', function () { setAspect(v.videoWidth, v.videoHeight); });

      const ui = function () {
        const playing = !v.paused;
        btn.classList.toggle('is-playing', playing);
        btn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
        btn.lastChild.textContent = playing ? 'pause' : (v._userPaused ? 'paused' : 'play');
        fig.classList.toggle('is-paused', !playing && (v._userPaused || reduced()));
      };
      v.addEventListener('play', ui);
      v.addEventListener('pause', ui);
      const toggle = function (e) {
        if (e) e.stopPropagation();
        if (v.paused) { v._userPaused = false; v._userPlayed = true; safePlay(v); }
        else { v._userPaused = true; v.pause(); }
        ui();
      };
      frame.addEventListener('click', toggle);
      btn.addEventListener('click', toggle);
      ui();
      pv.videos.push(v);
      if (pv.io) pv.io.observe(v);
    } else {
      const src = isSvg ? motionSrc(it.src, it.still) : pickSrc(it.src);
      const img = h('img', {
        class: 'g-media' + (isSvg ? ' g-svg' : ''),
        alt: it.alt || '', loading: it.cover ? 'eager' : 'lazy', decoding: 'async', draggable: 'false', src: src
      });
      if (isSvg) markStill(img, it.src, it.still);
      // Vectors scale cleanly: they take their own shape (data aspect first, since an
      // SVG without width/height has no reliable natural size) and any width.
      if (isSvg && +it.aspect > 0) fig.style.setProperty('--a', String(+it.aspect));
      const ready = function () {
        if (!isSvg) {
          setAspect(img.naturalWidth, img.naturalHeight);
          // Never blow small images up past 1.25x: the figure (and its caption) shrinks to fit.
          if (img.naturalWidth) fig.style.setProperty('--wmax', Math.round(img.naturalWidth * 1.25) + 'px');
        } else if (!(+it.aspect > 0)) {
          setAspect(img.naturalWidth, img.naturalHeight);
        }
        fig.classList.add('is-ready');
      };
      img.addEventListener('load', ready, { once: true });
      img.addEventListener('error', function () {
        if (src !== it.src) img.src = it.src; else fig.classList.add('is-ready');
      });
      // A wide diagram can ship a tall twin for phones (srcNarrow + aspectNarrow).
      if (isSvg && it.srcNarrow) {
        frame.append(h('picture', { class: 'g-pic' }, [h('source', { media: '(max-width: 599px)', srcset: it.srcNarrow }), img]));
        if (+it.aspectNarrow > 0) { fig.style.setProperty('--an', String(+it.aspectNarrow)); fig.classList.add('g-item--narrow'); }
      } else frame.append(img);
      if (img.complete && img.naturalWidth) ready();
    }
    return fig;
  }

  function figCompare(it) {
    const labels = Array.isArray(it.labels) ? it.labels : ['before', 'after'];
    // two drawings on paper: the slider spans the column on a paper plate, like the other sheets
    const svgPair = /\.svg$/i.test(it.before || '') && /\.svg$/i.test(it.after || '');
    const fig = h('figure', { class: 'g-item g-item--cmp' + (svgPair ? ' g-item--cmp-svg' : '') });
    const a = h('img', { class: 'cmp__img cmp__img--a', alt: '', loading: 'lazy', decoding: 'async', draggable: 'false', src: pickSrc(it.before) });
    const b = h('img', { class: 'cmp__img cmp__img--b', alt: it.alt || '', loading: 'lazy', decoding: 'async', draggable: 'false', src: pickSrc(it.after) });
    const range = h('input', {
      class: 'cmp__range', type: 'range', min: '0', max: '100', step: '1', value: '50',
      'aria-label': 'Compare: ' + labels[0] + ' on the left, ' + labels[1] + ' on the right'
    });
    const grip = h('span', { class: 'cmp__grip', html: '<svg viewBox="0 0 18 10" aria-hidden="true"><path d="M5 1 1 5l4 4M13 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
    const cmp = h('div', { class: 'cmp' }, [
      a, b,
      h('span', { class: 'cmp__label cmp__label--l', 'aria-hidden': 'true', text: labels[0] }),
      h('span', { class: 'cmp__label cmp__label--r', 'aria-hidden': 'true', text: labels[1] }),
      h('span', { class: 'cmp__line', 'aria-hidden': 'true' }, grip),
      range
    ]);
    fig.append(h('div', { class: 'g-frame' }, cmp));
    if (it.caption) fig.append(h('figcaption', { class: 'g-cap', text: it.caption }));

    let pos = 50, touched = false;
    const set = function (v) {
      pos = clamp(v, 0, 100);
      cmp.style.setProperty('--pos', pos.toFixed(2) + '%');
      range.value = String(Math.round(pos));
      range.setAttribute('aria-valuetext', Math.round(pos) + '% ' + labels[0]);
    };
    set(50);

    a.addEventListener('load', function () {
      const w = a.naturalWidth, hh = a.naturalHeight;
      if (w && hh) {
        const cmax = Math.max(320, Math.round(w * 1.75)) + 'px';
        fig.style.setProperty('--a', (w / hh).toFixed(4));
        fig.style.setProperty('--wmax', cmax); // the figure (and caption) hugs the slider
        cmp.style.setProperty('--ca', (w / hh).toFixed(4));
        cmp.style.setProperty('--cmax', cmax);
        if (fig._onAspect) fig._onAspect();
      }
      fig.classList.add('is-ready');
    }, { once: true });

    range.addEventListener('input', function () { touched = true; set(+range.value); });

    let dragging = false;
    let tap = null; // a touch that hasn't decided yet: drag, scroll or tap
    const fromEvent = function (e) {
      const r = cmp.getBoundingClientRect();
      set((e.clientX - r.left) / r.width * 100);
    };
    const grab = function (e) {
      dragging = true; touched = true;
      cmp.classList.add('is-drag');
      try { cmp.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      range.focus({ preventScroll: true });
    };
    cmp.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (e.pointerType === 'touch') {
        // Don't jump yet: a vertical swipe here should still scroll the page.
        tap = { id: e.pointerId, x: e.clientX, pos: pos };
        return;
      }
      e.preventDefault(); // keep focus on the range, not the scrolling sheet
      grab(e);
      fromEvent(e);
    });
    cmp.addEventListener('pointermove', function (e) {
      if (tap && !dragging && e.pointerId === tap.id && Math.abs(e.clientX - tap.x) > 6) grab(e);
      if (dragging) fromEvent(e);
    });
    const end = function () { dragging = false; tap = null; cmp.classList.remove('is-drag'); };
    cmp.addEventListener('pointerup', function (e) {
      // a touch that never moved is a tap: jump to the finger
      if (tap && !dragging && e.pointerId === tap.id) { touched = true; fromEvent(e); }
      end();
    });
    cmp.addEventListener('pointercancel', function () {
      if (tap) set(tap.pos); // the browser took the gesture (a scroll): undo
      end();
    });
    cmp.addEventListener('lostpointercapture', function () { if (dragging) end(); });

    // A one-time nudge (50 → 65 → 50) to hint that it moves.
    if (!reduced() && pv.io) {
      cmp._onSeen = function () {
        setTimeout(function () {
          if (touched || reduced() || !cmp.isConnected) return;
          const t0 = performance.now(), dur = 1500;
          (function step(now) {
            if (touched || !cmp.isConnected) return;
            const t = clamp((now - t0) / dur, 0, 1);
            set(50 + 15 * Math.sin(Math.PI * t) * (1 - .15 * Math.sin(Math.PI * t)));
            if (t < 1) requestAnimationFrame(step); else set(50);
          })(t0);
        }, 450);
      };
      // Observed by the overlay observer only for its first sighting.
      const once = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio >= .6) { once.disconnect(); if (cmp._onSeen) { const f = cmp._onSeen; cmp._onSeen = null; f(); } }
        });
      }, { threshold: [.6] });
      once.observe(cmp);
    }
    return fig;
  }

  function syncOverlayVideo(v) {
    if (!pv.open) { if (!v.paused) v.pause(); return; }
    if (v._userPaused) return;
    const auto = !reduced() || v._userPlayed;
    if (v._visible && auto && !doc.hidden) safePlay(v);
    else if (!v.paused) v.pause();
  }

  /* ======================================================================
     In-page anchors (#work, #about, …) with header offset
     ====================================================================== */
  function scrollToId(id, instant) {
    const el = doc.getElementById(id);
    if (!el) return false;
    const top = id === 'top' ? 0 : el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, top), behavior: instant || reduced() ? 'auto' : 'smooth' });
    return true;
  }

  function setupAnchors() {
    doc.addEventListener('click', function (e) {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = a.getAttribute('href');
      if (ROUTE.test(href) || href === '#') return;
      const id = decodeURIComponent(href.slice(1));
      if (!doc.getElementById(id)) return;
      e.preventDefault();
      scrollToId(id);
      history.replaceState(null, '', location.pathname + location.search + (id === 'top' ? '' : '#' + id));
      if (a.classList.contains('skip')) {
        const t = doc.getElementById(id);
        t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      }
    });
  }

  /* ======================================================================
     Header: legibility over the hero / footer + scrollspy
     ====================================================================== */
  function setupHeader() {
    const hd = $('#hd');
    if (!hd) return;
    const hero = $('#top');
    const ft = $('#contact');
    const meta = $('meta[name="theme-color"]');
    let raf = 0, last = '';

    const update = function () {
      raf = 0;
      const y = 28; // header midline
      let state = '';
      if (hero) {
        const r = hero.getBoundingClientRect();
        // transparent only at the very top; once scrolled, frost it so it never sits on the headline
        if (r.top <= y && r.bottom > y) state = window.scrollY > 8 ? 'is-dark' : 'is-hero';
      }
      if (!state && ft) {
        const r = ft.getBoundingClientRect();
        if (r.top <= y && r.bottom > y) state = 'is-dark';
      }
      if (state !== last) {
        hd.classList.remove('is-hero', 'is-dark');
        if (state) hd.classList.add(state);
        last = state;
        if (meta) meta.setAttribute('content', state ? '#050403' : getComputedStyle(root).getPropertyValue('--bg').trim() || '#ffffff');
      }
    };
    const req = function () { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req, { passive: true });
    doc.addEventListener('themechange', function () { last = '?'; req(); });
    update();

    // Scrollspy
    if (!('IntersectionObserver' in window)) return;
    const links = $$('.hd__links a');
    const map = new Map();
    links.forEach(function (a) {
      const s = doc.getElementById(a.getAttribute('href').slice(1));
      if (s) map.set(s, a);
    });
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        const a = map.get(e.target);
        if (!a) return;
        if (e.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute('aria-current'); });
          a.setAttribute('aria-current', 'true');
        } else if (a.getAttribute('aria-current')) a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    map.forEach(function (_, s) { io.observe(s); });
  }

  /* ======================================================================
     Liquafilm theme toggle
     ====================================================================== */
  const theme = { btn: null, busy: false, liquid: null };

  function currentTheme() { return root.getAttribute('data-theme') === 'filled' ? 'filled' : 'drained'; }

  function syncThemeButton() {
    const b = theme.btn;
    if (!b) return;
    const filled = currentTheme() === 'filled';
    b.setAttribute('aria-pressed', filled ? 'true' : 'false');
    const label = $('.themebtn__label', b);
    if (label) label.textContent = filled ? 'drain' : 'fill';
    // Visible "fill" / "drain" plus this hidden tail makes the button's name.
    const sr = $('.themebtn__sr', b);
    if (sr) sr.textContent = filled ? ' the page (light mode)' : ' the page with liquid (dark mode)';
    b.title = filled ? 'Liquafilm mode: drain the page' : 'Liquafilm mode: fill the page with liquid';
  }

  function applyTheme(t, persist) {
    root.setAttribute('data-theme', t);
    if (persist) store.set('rd-theme', t);
    syncThemeButton();
    doc.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } }));
  }

  function liquidEl() {
    if (theme.liquid) return theme.liquid;
    const wave = function (cls) {
      return '<svg viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
        '<path class="' + cls + '" d="M0 22 C100 6 200 6 300 22 S500 38 600 22 S800 6 900 22 S1100 38 1200 22 V44 H0 Z"/></svg>';
    };
    const back = function (cls) {
      return '<svg viewBox="0 0 1200 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
        '<path class="' + cls + '" d="M0 26 C150 12 250 12 400 26 S650 40 800 26 S1050 12 1200 26 V44 H0 Z"/></svg>';
    };
    const el = h('div', { class: 'liquid', 'aria-hidden': 'true', hidden: true, html:
      '<div class="liquid__wave">' + wave('liquid__top-fill') + back('liquid__top-fill') + '</div>' +
      '<div class="liquid__body"></div>' +
      '<div class="liquid__wave liquid__wave--bottom">' + wave('liquid__bot-fill') + back('liquid__bot-fill') + '</div>'
    });
    doc.body.append(el);
    theme.liquid = el;
    return el;
  }

  function toggleTheme() {
    if (theme.busy) return;
    const next = currentTheme() === 'filled' ? 'drained' : 'filled';
    if (reduced() || typeof Element.prototype.animate !== 'function') { applyTheme(next, true); return; }

    theme.busy = true;
    theme.btn.classList.add('is-busy');
    const liq = liquidEl();
    const H = window.innerHeight;
    const W = 44;
    liq.style.height = (H + 2 * W) + 'px';
    liq.hidden = false;

    const below = 'translate3d(0,' + (H + W) + 'px,0)';
    const above = 'translate3d(0,' + -(H + W) + 'px,0)';
    const cover = 'translate3d(0,0,0)';
    // fill: the level rises from the sill. drain: liquid falls in from the top.
    const from = next === 'filled' ? below : above;
    // Icon follows the liquid
    root.classList.add('theme-anim');

    const inA = liq.animate([{ transform: from }, { transform: cover }], {
      duration: next === 'filled' ? 950 : 750,
      easing: next === 'filled' ? 'cubic-bezier(.55,0,.3,1)' : 'cubic-bezier(.5,0,.75,0)',
      fill: 'forwards'
    });
    inA.finished.then(function () {
      applyTheme(next, true);
      const outA = liq.animate([{ transform: cover }, { transform: below }], {
        duration: 900,
        delay: 60,
        easing: 'cubic-bezier(.6,0,.2,1)',
        fill: 'forwards'
      });
      return outA.finished;
    }).catch(function () { applyTheme(next, true); }).then(function () {
      liq.hidden = true;
      liq.getAnimations().forEach(function (a) { a.cancel(); });
      theme.busy = false;
      theme.btn.classList.remove('is-busy');
      root.classList.remove('theme-anim');
    });
  }

  function setupTheme() {
    theme.btn = $('.themebtn');
    if (!theme.btn) return;
    syncThemeButton();
    theme.btn.addEventListener('click', toggleTheme);
    // Follow the system while the visitor hasn't chosen.
    if (mqDark.addEventListener) {
      mqDark.addEventListener('change', function (e) {
        const s = store.get('rd-theme');
        if (s !== 'filled' && s !== 'drained') applyTheme(e.matches ? 'filled' : 'drained', false);
      });
    }
  }

  /* ======================================================================
     Footer clock (Cambridge, MA)
     ====================================================================== */
  function setupClock() {
    const t = $('#ft-time');
    if (!t) return;
    let fmt, hourFmt, dayFmt;
    try {
      fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
      hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
      dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
    } catch (e) { return; }
    const status = $('#ft-status');
    t.parentElement.hidden = false;
    const tick = function () {
      const now = new Date();
      t.textContent = fmt.format(now).replace(/\s?(AM|PM)$/, function (m) { return ' ' + m.trim().toLowerCase(); });
      t.setAttribute('datetime', now.toISOString());
      if (status) {
        const hr = parseInt(hourFmt.format(now), 10) % 24;
        const wd = dayFmt.format(now);
        const weekend = wd === 'Sat' || wd === 'Sun';
        let s;
        if (hr < 7) s = 'probably asleep';
        else if (hr < 9) s = 'probably making iced coffee';
        else if (hr < 18 && !weekend) s = 'probably in the lab';
        else if (hr < 23) s = 'probably building something';
        else s = 'probably should be asleep';
        status.textContent = ' — ' + s;
      }
      setTimeout(tick, 60000 - (now.getTime() % 60000) + 40);
    };
    tick();
  }

  /* ======================================================================
     Hero, about media, goose
     ====================================================================== */
  function setupHero() {
    const hero = $('#top');
    if (!hero) return;
    const done = function (e) {
      if (e && e.target && e.target.closest && e.target.closest('a, button')) return;
      hero.classList.add('is-touched');
      hero.removeEventListener('pointerdown', done);
    };
    hero.addEventListener('pointerdown', done);
  }

  function setupReel() {
    const v = $('.reel__video');
    if (!v) return;
    v.muted = true;
    if (!('IntersectionObserver' in window)) return;
    let vis = false;
    const sync = function () {
      if (vis && !reduced() && !doc.hidden && !pv.open) safePlay(v);
      else if (!v.paused) v.pause();
    };
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { vis = e.isIntersecting && e.intersectionRatio >= .4; sync(); });
    }, { threshold: [0, .4] }).observe(v);
    doc.addEventListener('visibilitychange', sync);
    doc.addEventListener('motionchange', sync);
    pv.onToggle.push(sync);
  }

  /* ======================================================================
     Motion switch (WCAG 2.2.2): one toggle for the hero blooms, tile videos and
     the reel. html.motion-off + a 'motionchange' event; the FX listen for both.
     ====================================================================== */
  function setupMotion() {
    if (store.get('rd-motion') === 'off') root.classList.add('motion-off');
    const heroBtn = $('.hero__pause');
    const ftBtn = $('.ft__motion');
    const isOff = function () { return root.classList.contains('motion-off'); };
    const sync = function () {
      const off = isOff();
      if (heroBtn) heroBtn.textContent = off ? 'play motion' : 'pause motion';
      if (ftBtn) ftBtn.textContent = off ? 'motion: off' : 'motion: on';
    };
    const toggle = function () {
      const off = !isOff();
      root.classList.toggle('motion-off', off);
      store.set('rd-motion', off ? 'off' : 'on');
      sync();
      doc.dispatchEvent(new CustomEvent('motionchange', { detail: { off: off } }));
    };
    if (heroBtn) { heroBtn.hidden = false; heroBtn.addEventListener('click', toggle); }
    if (ftBtn) {
      const row = ftBtn.closest('.ft__motion-row');
      if (row) row.hidden = false;
      ftBtn.addEventListener('click', toggle);
    }
    sync();
  }

  function setupGoose() {
    doc.addEventListener('click', function (e) {
      const b = e.target.closest && e.target.closest('[data-goose]');
      if (!b) return;
      doc.dispatchEvent(new CustomEvent('goose:release'));
    });
  }

  /* ======================================================================
     FX mounting (each toy is optional; a broken one never breaks the page)
     ====================================================================== */
  function mountFX(name, el, opts) {
    if (!el) return null;
    const FX = window.FX;
    if (!FX || !FX[name] || typeof FX[name].mount !== 'function') return null;
    try {
      const ph = el.querySelector(':scope > .toy__ph, :scope > .scent__ph');
      if (ph) ph.remove();
      const inst = FX[name].mount(el, opts || {});
      el.classList.add('fx-mounted');
      return inst || null;
    } catch (e) {
      console.warn('[site] FX "' + name + '" failed to mount:', e);
      return null;
    }
  }

  function mountAll() {
    mountFX('fingering', doc.getElementById('hero-fx'), { auto: true });
    mountFX('rocket', doc.getElementById('toy-rocket'));
    mountFX('plunger', doc.getElementById('toy-plunger'));
    mountFX('sumo', doc.getElementById('toy-sumo'));
    mountFX('scent', doc.getElementById('scent-lcd'));
    const portrait = doc.getElementById('portrait');
    if (portrait) mountFX('thermal', portrait, { src: portrait.getAttribute('data-src'), alt: portrait.getAttribute('data-alt') });
    mountFX('goose', doc.body, { autoDelayMs: 40000 });
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  function boot() {
    setupMotion();
    renderContent();
    buildGrid();
    setupAnchors();
    setupHeader();
    setupTheme();
    setupHero();
    setupReel();
    setupGoose();
    setupClock();
    const hasOverlay = setupOverlay();
    setupCursor();
    mountAll();

    if (hasOverlay) {
      window.addEventListener('hashchange', onRoute);
      if (slugFromHash(location.hash) || ROUTE.test(location.hash)) onRoute();
    }
    // Section deep links: the grid just changed the page height, so land again.
    if (!pv.open && /^#[A-Za-z][\w-]*$/.test(location.hash)) {
      const id = location.hash.slice(1);
      requestAnimationFrame(function () { scrollToId(id, true); });
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
