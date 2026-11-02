/* 라우터, 상태, 이벤트. 상태는 주소(해시)에 둔다: #/route?launch=a&day=5&type=대학가 */
(function (root) {
  'use strict';
  var BR = root.BR, U = root.UI, V = root.Views;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  var ROUTES = {
    home: { title: '홈', view: 'home' },
    reaction: { title: '반응 지수', view: 'reaction' },
    diagnosis: { title: '관심-구매 진단', view: 'diagnosis' },
    orders: { title: '발주·교체 권고', view: 'orders' },
    radar: { title: '레이더 보정', view: 'radar' },
    privacy: { title: '프라이버시 설계', view: 'privacy', minimal: true },
    types: { title: '유형별 반응 속도', view: 'types' },
    ranks: { title: '순위 급변', view: 'ranks' }
  };
  var GLOBAL = ['launch', 'day', 'cover', 'rise', 'target', 'low', 'over'];
  var DEFAULT_DAY = 5;

  var state = { route: 'home', q: {} };
  var dataCache = {};
  var lastCtx = null;
  var playTimer = null;

  /* ---------- 승인 기록 (이 브라우저에만 저장, 어디로도 전송하지 않음) ---------- */
  var APPR_KEY = 'br-store-module-approvals-v1';
  var appr = (function () { try { return JSON.parse(localStorage.getItem(APPR_KEY)) || {}; } catch (e) { return {}; } })();
  function saveAppr() { try { localStorage.setItem(APPR_KEY, JSON.stringify(appr)); } catch (e) { /* 저장이 막혀도 화면은 동작한다 */ } }

  /* ---------- 주소 ---------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), qi = h.indexOf('?');
    var route = (qi < 0 ? h : h.slice(0, qi)) || 'home';
    var q = {};
    if (qi >= 0) new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) { q[k] = v; });
    if (!ROUTES[route]) route = 'home';
    if (['a', 'b', 'c'].indexOf(q.launch) < 0) q.launch = 'a';
    var day = parseInt(q.day, 10);
    q.day = String(isNaN(day) ? DEFAULT_DAY : Math.max(0, Math.min(BR.DAYS, day)));
    return { route: route, q: q };
  }
  function build(route, patch, keepPage) {
    var q = {};
    GLOBAL.forEach(function (k) { if (state.q[k] != null && state.q[k] !== '') q[k] = state.q[k]; });
    if (keepPage) Object.keys(state.q).forEach(function (k) { if (GLOBAL.indexOf(k) < 0 && state.q[k] !== '') q[k] = state.q[k]; });
    Object.keys(patch || {}).forEach(function (k) { if (patch[k] === '' || patch[k] == null) delete q[k]; else q[k] = String(patch[k]); });
    var qs = new URLSearchParams(q).toString();
    return '#/' + route + (qs ? '?' + qs : '');
  }
  function href(route, patch) { return build(route, patch, route === state.route); }
  function commit(patch, opts) { // 같은 화면 안에서 상태만 바꾼다
    var h = build(state.route, patch, true);
    history.replaceState(null, '', h);
    state = parseHash();
    render(opts);
  }

  /* ---------- 데이터와 컨텍스트 ---------- */
  function params(q) {
    var p = {};
    ['cover', 'target', 'over'].forEach(function (k) { if (q[k] != null && q[k] !== '') p[k] = Number(q[k]); });
    ['rise', 'low'].forEach(function (k) { if (q[k] != null && q[k] !== '') p[k] = Number(q[k]) / 100; });
    return p;
  }
  function context(data) {
    var D = parseInt(state.q.day, 10);
    return {
      data: data, D: D, q: state.q, params: params(state.q), appr: appr,
      href: href, key: function (kind, id) { return data.scn.id + ':' + kind + ':' + id + ':' + D; }
    };
  }

  /* ---------- 그리기 ---------- */
  var main;
  function focusDescriptor() {
    var a = document.activeElement;
    if (!a || !main.contains(a)) return null;
    var attrs = ['data-q', 'data-q-toggle', 'data-act', 'data-param', 'data-q-check'];
    for (var i = 0; i < attrs.length; i++) if (a.hasAttribute(attrs[i])) return '[' + attrs[i] + '="' + a.getAttribute(attrs[i]).replace(/"/g, '\\"') + '"]';
    if (a.id) return '#' + a.id;
    return null;
  }
  function syncChrome() {
    var r = ROUTES[state.route], d = dataCache[state.q.launch];
    document.title = r.title + ' | 매장 데이터 | 배라 AX';
    $$('[data-route]').forEach(function (a) {
      if (a.dataset.route === state.route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      a.setAttribute('href', href(a.dataset.route));
    });
    $$('[data-link]').forEach(function (a) { a.setAttribute('href', href(a.dataset.link)); });
    var D = parseInt(state.q.day, 10);
    $('#launch').value = state.q.launch;
    $('#day').value = D;
    $('#dayOut').textContent = 'D+' + D;
    $('#dateOut').textContent = d ? U.dateLabel(d, D) : '';
    $('.topbar').classList.toggle('topbar--minimal', !!r.minimal);
  }
  function render(opts) {
    opts = opts || {};
    var launch = state.q.launch, restore = focusDescriptor();
    var routeChanged = render.lastRoute !== state.route;
    render.lastRoute = state.route;
    var go = function () {
      try {
        var data = dataCache[launch];
        lastCtx = context(data);
        main.innerHTML = V[ROUTES[state.route].view](lastCtx);
        main.removeAttribute('aria-busy');
      } catch (err) {
        if (root.console) console.error(err);
        main.innerHTML = U.error('이 화면을 그리지 못했습니다', 'retry');
        main.removeAttribute('aria-busy');
      }
      syncChrome();
      if (restore) { var el = $(restore, main); if (el) el.focus({ preventScroll: true }); }
      if (routeChanged && !opts.keepScroll) { window.scrollTo(0, 0); }
    };
    if (!dataCache[launch]) { // 처음 만드는 신제품은 만드는 동안 자리 표시를 보여 준다
      main.setAttribute('aria-busy', 'true');
      main.innerHTML = U.skeleton('chart');
      setTimeout(function () {
        try { dataCache[launch] = BR.build(launch); } catch (err) {
          if (root.console) console.error(err);
          main.innerHTML = U.error('합성 데이터를 만들지 못했습니다', 'retry'); main.removeAttribute('aria-busy'); return;
        }
        go();
      }, 0);
    } else go();
  }

  /* ---------- 재생 ---------- */
  function setPlaying(on) {
    var btn = $('#play');
    clearInterval(playTimer); playTimer = null;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '재생 멈춤' : '출시 후 날짜를 하루씩 재생');
    btn.innerHTML = U.icon(on ? 'pause' : 'play', 18);
    if (on) {
      playTimer = setInterval(function () {
        var D = parseInt(state.q.day, 10);
        if (D >= BR.DAYS) { setPlaying(false); return; }
        commit({ day: D + 1 }, { keepScroll: true });
      }, 900);
    }
  }

  /* ---------- 차트 읽기 ---------- */
  function chartDay(box, clientX) {
    var svg = $('svg', box), rect = svg.getBoundingClientRect(), meta = U.charts[box.dataset.chart];
    if (!meta) return 0;
    var vx = (clientX - rect.left) / rect.width * meta.w;
    return Math.max(0, Math.min(meta.max, Math.round((vx - meta.x0) / (meta.x1 - meta.x0) * meta.max)));
  }
  function showReadout(box, day) {
    var meta = U.charts[box.dataset.chart];
    if (!meta || !meta.fn) return;
    $('.chart__readout', box).innerHTML = meta.fn(day);
    var cross = $('.ch-cross', box), x = Math.round(meta.xs(day) * 10) / 10;
    cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.removeAttribute('hidden');
    box._cursor = day;
  }

  /* ---------- 동작 ---------- */
  function act(name, arg) {
    var c = lastCtx, d = c.data, D = c.D, key;
    if (name === 'retry') { delete dataCache[state.q.launch]; render(); return; }
    if (name === 'q') { var i = arg.indexOf('='); var p = {}; p[arg.slice(0, i)] = arg.slice(i + 1); commit(p); return; }
    if (name === 'appr-set') { appr[arg] = true; saveAppr(); render({ keepScroll: true }); return; }
    if (name === 'appr-undo') { delete appr[arg]; saveAppr(); render({ keepScroll: true }); return; }
    if (name === 'appr-all') {
      BR.orders(d, D, c.params).rows.forEach(function (r) { if (r.action === 'order') appr[c.key('order', r.st.id)] = true; });
      saveAppr(); render({ keepScroll: true }); return;
    }
    if (name === 'radar-approve') {
      var cls = BR.classify(d, D); key = d.scn.id + ':radar';
      appr[key] = { state: 'approved', day: D, kind: cls.kind, peakVal: cls.peakVal, shape: cls.type };
      saveAppr(); render({ keepScroll: true }); return;
    }
    if (name === 'radar-defer') { appr[d.scn.id + ':radar'] = { state: 'deferred', day: D }; saveAppr(); render({ keepScroll: true }); return; }
    if (name === 'params-reset') { commit({ cover: '', rise: '', target: '', low: '', over: '' }); return; }
    if (name === 'appr-clear') { Object.keys(appr).forEach(function (k) { delete appr[k]; }); saveAppr(); render({ keepScroll: true }); return; }
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act], [data-q], [data-q-toggle], .chart[data-setday], .menu-btn, #play, [data-route], .scrim');
      if (!t) return;
      if (t.matches('.menu-btn')) { toggleNav(); return; }
      if (t.matches('.scrim')) { toggleNav(false); return; }
      if (t.matches('#play')) { setPlaying(!playTimer); return; }
      if (t.matches('[data-route]')) { toggleNav(false); return; }
      if (t.matches('[data-act]')) {
        var a = t.getAttribute('data-act'), i = a.indexOf(':');
        act(i < 0 ? a : a.slice(0, i), i < 0 ? '' : a.slice(i + 1)); return;
      }
      if (t.matches('[data-q-toggle]')) {
        var tg = t.getAttribute('data-q-toggle'), j = tg.indexOf('='), k = tg.slice(0, j), v = tg.slice(j + 1), pp = {};
        pp[k] = state.q[k] === v ? '' : v; commit(pp); return;
      }
      if (t.matches('[data-q]')) {
        if (t.disabled) return;
        var s = t.getAttribute('data-q'), n = s.indexOf('='), q2 = {}; q2[s.slice(0, n)] = s.slice(n + 1); commit(q2); return;
      }
      if (t.matches('.chart[data-setday]')) { setPlaying(false); commit({ day: chartDay(t, e.clientX) }, { keepScroll: true }); }
    });

    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'day') { setPlaying(false); commit({ day: t.value }, { keepScroll: true }); return; }
      if (t.matches('[data-param]')) {
        var out = t.parentNode.querySelector('output'), unit = out.textContent.replace(/[0-9\-.]/g, '');
        out.textContent = t.value + unit;
      }
    });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'launch') { setPlaying(false); commit({ launch: t.value, day: state.q.day }); return; }
      if (t.matches('[data-param]')) { var p = {}; p[t.getAttribute('data-param')] = t.value; commit(p, { keepScroll: true }); return; }
      if (t.matches('[data-q-check]')) { var s = t.getAttribute('data-q-check'), n = s.indexOf('='), q2 = {}; q2[s.slice(0, n)] = s.slice(n + 1); commit(q2, { keepScroll: true }); }
    });

    document.addEventListener('pointermove', function (e) {
      var box = e.target.closest && e.target.closest('.chart');
      if (box) showReadout(box, chartDay(box, e.clientX));
    });
    document.addEventListener('pointerout', function (e) {
      var box = e.target.closest && e.target.closest('.chart');
      if (box && !box.contains(e.relatedTarget) && document.activeElement !== box) $('.ch-cross', box).setAttribute('hidden', '');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') toggleNav(false);
      var box = e.target.classList && e.target.classList.contains('chart') ? e.target : null;
      if (!box) return;
      var cur = box._cursor == null ? parseInt(state.q.day, 10) : box._cursor;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); var meta = U.charts[box.dataset.chart];
        showReadout(box, Math.max(0, Math.min(meta.max, cur + (e.key === 'ArrowRight' ? 1 : -1))));
      } else if ((e.key === 'Enter' || e.key === ' ') && box.hasAttribute('data-setday')) {
        e.preventDefault(); commit({ day: cur }, { keepScroll: true });
      }
    });
    window.addEventListener('hashchange', function () { state = parseHash(); render(); });
  }

  function toggleNav(force) {
    var open = force == null ? !document.body.classList.contains('nav-open') : force;
    document.body.classList.toggle('nav-open', open);
    $('.menu-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function init() {
    main = $('#main');
    if (!root.BR || !root.UI || !root.Views) {
      main.innerHTML = '<div class="state state--error" role="alert"><h3>화면을 불러오지 못했습니다</h3><p>스크립트 파일(data.js, ui.js, views.js)이 함께 있어야 합니다.</p></div>';
      return;
    }
    if (!location.hash) history.replaceState(null, '', '#/home?launch=a&day=' + DEFAULT_DAY);
    state = parseHash();
    setPlaying(false);
    bind();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
