/* 합성 데이터 생성기와 분석 규칙. 모든 값은 시드로 고정된 가상 값이다 (실측 아님, 정확도 미검증).
 * 브라우저에서는 window.BR, node에서는 module.exports로 쓴다. */
(function (root) {
  'use strict';

  var DAYS = 28;          // 출시 후 D+0 ~ D+28
  var PRE = 14;           // 출시 전 베이스라인 일수
  var LAUNCH = new Date(2026, 8, 25); // 2026-09-25, 가상 출시일
  var TYPES = ['대학가', '오피스', '주거', '역세권', '관광'];

  // 시연할 가상 신제품 3개. 어떤 실제 트렌드 사례로 되감을지는 팀 미정이라 유형 이름만 쓴다.
  var SCENARIOS = {
    a: { id: 'a', label: '가상 신제품 A', shape: '단발형', kind: 'burst', radarKind: 'slow', radarShape: '완만형' },
    b: { id: 'b', label: '가상 신제품 B', shape: '완만형', kind: 'slow', radarKind: 'slow', radarShape: '완만형' },
    c: { id: 'c', label: '가상 신제품 C', shape: '반복형', kind: 'wave', radarKind: 'burst', radarShape: '단발형' }
  };

  // 상권 유형: 하루 존 방문 기준값, 반응 속도 배수, 반응 크기 배수, 요일 계수(월~일)
  var TYPE_SPEC = {
    '대학가': { base: 160, speed: 0.85, amp: 1.2, wk: [1.0, 1.05, 1.05, 1.05, 1.1, 0.8, 0.6] },
    '오피스': { base: 120, speed: 1.0, amp: 0.85, wk: [1.1, 1.12, 1.1, 1.08, 1.0, 0.55, 0.45] },
    '주거': { base: 90, speed: 1.3, amp: 0.75, wk: [0.85, 0.85, 0.9, 0.9, 1.0, 1.25, 1.25] },
    '역세권': { base: 200, speed: 0.95, amp: 1.0, wk: [1.0, 1.0, 1.0, 1.0, 1.1, 1.05, 0.95] },
    '관광': { base: 140, speed: 1.1, amp: 1.05, wk: [0.85, 0.85, 0.9, 0.95, 1.1, 1.3, 1.25] }
  };

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise(r) { return (r() + r() + r() - 1.5) * 0.08; } // 표준편차 약 0.04

  function gam(x, p) { return x <= 0 ? 0 : (x / p) * Math.exp(1 - x / p); }
  // 단위 반응 곡선 (정점이 대략 1). kind: burst 단발형, slow 완만형, wave 반복형
  function unit(kind, d, speed) {
    if (kind === 'burst') {
      var p = 2.2 * speed;
      return 0.88 * gam(d + 0.6, p) + 0.12 * (1 - Math.exp(-d / 2)) * Math.exp(-Math.max(0, d - 14) / 30);
    }
    if (kind === 'slow') {
      var c = 5 * speed;
      return (1 / (1 + Math.exp(-(d - c) / (c * 0.45)))) * Math.exp(-Math.max(0, d - 20) / 22);
    }
    var s2 = 14 * Math.min(speed, 1.1);
    return 0.3 * gam(d + 0.6, 2.5 * speed) + (d >= s2 - 0.6 ? gam(d - s2 + 0.6, 3 * speed) : 0);
  }
  var SCN_AMP = { burst: 0.78, slow: 0.58, wave: 0.7 };

  function dayInfo(i) { // i = -PRE .. DAYS
    var dt = new Date(LAUNCH.getTime() + i * 86400000);
    var dow = (dt.getDay() + 6) % 7; // 월=0
    var r = rng(hash('weather:' + i));
    var temp = Math.round((19 - 0.18 * (i + PRE) + (r() - 0.5) * 7) * 10) / 10; // 가을, 서서히 하강
    return { d: i, date: dt, dow: dow, temp: temp, tf: 1 + 0.012 * (temp - 15) };
  }

  function build(scnId) {
    var scn = SCENARIOS[scnId] || SCENARIOS.a;
    var days = [], pre = [];
    for (var i = -PRE; i <= DAYS; i++) (i < 0 ? pre : days).push(dayInfo(i));
    var stores = [];
    TYPES.forEach(function (t, ti) {
      for (var n = 1; n <= 4; n++) {
        var id = 's' + ('0' + (ti * 4 + n)).slice(-2);
        var r = rng(hash(scn.id + ':' + id + ':spec'));
        stores.push({
          id: id, type: t, name: t + ' 매장 ' + n,
          base: TYPE_SPEC[t].base * (0.85 + 0.3 * r()),
          dwell0: 15 + 7 * r(),
          conv0: 0.2 + 0.05 * r(),
          alloc: 0.8 + 1.0 * r(),
          jitter: 0.85 + 0.3 * r(),
          conv: 1,
          lowConv: false
        });
      }
    });
    // 구매 전환이 낮은 매장 4곳 (시나리오마다 다르게 뽑는다)
    var pick = rng(hash(scn.id + ':lowconv'));
    var chosen = {};
    while (Object.keys(chosen).length < 4) chosen[Math.floor(pick() * stores.length)] = 1;
    Object.keys(chosen).forEach(function (k) { stores[k].lowConv = true; stores[k].conv = 0.45; });
    // 현장 행사로 방문이 갑자기 늘어나는 매장 2곳
    var evPick = rng(hash(scn.id + ':event')), nEv = 0;
    while (nEv < 2) { var k2 = Math.floor(evPick() * stores.length); if (!stores[k2].event) { stores[k2].event = true; nEv++; } }

    stores.forEach(function (st) {
      var spec = TYPE_SPEC[st.type];
      var r = rng(hash(scn.id + ':' + st.id + ':daily'));
      // 출시 전 14일
      var preVis = pre.map(function (p) {
        return st.base * spec.wk[p.dow] * p.tf * (1 + noise(r));
      });
      var preDes = pre.map(function (p, k) { return preVis[k] / (spec.wk[p.dow] * p.tf); });
      st.baseline = preDes.reduce(function (a, b) { return a + b; }, 0) / PRE; // 요일·기온 보정 베이스라인
      st.baselineRaw = preVis.reduce(function (a, b) { return a + b; }, 0) / PRE; // 보정 없는 평균
      st.dwellBase = st.dwell0;
      var amp = SCN_AMP[scn.kind] * spec.amp * st.jitter;
      var stock = Math.round(st.base * st.conv0 * 1.3 * 7 * st.alloc / 10) * 10;
      st.stock0 = stock;
      var outLeft = 0, series = [];
      var evStart = 5 + Math.floor(st.jitter * 10 % 7); // 현장 행사가 있는 매장의 시작일
      days.forEach(function (dy) {
        var rt = amp * unit(scn.kind, dy.d, spec.speed * (0.92 + 0.16 * st.jitter));
        var exp = st.baseline * spec.wk[dy.dow] * dy.tf;
        var shock = st.event && dy.d >= evStart && dy.d < evStart + 3 ? 1.55 : 1;
        // 재고가 바닥나면 이틀간 방문이 줄고, 그 뒤 정기 배송이 들어온다
        var vis = st.base * spec.wk[dy.dow] * dy.tf * (1 + rt) * shock * (1 + noise(r)) * (outLeft > 0 ? 0.7 : 1);
        vis = Math.round(vis);
        var conv = st.conv0 * st.conv * (1 + noise(r) * 1.2);
        var sold = outLeft > 0 ? 0 : Math.min(stock, Math.round(vis * conv));
        stock -= sold;
        var stockedOut = outLeft > 0 || stock <= 0;
        if (outLeft > 0) {
          outLeft--;
          if (outLeft === 0) stock = Math.round(st.base * st.conv0 * 1.3 * 12 / 10) * 10;
        } else if (stock <= 0) {
          outLeft = 2;
        }
        var dwell = st.dwell0 * (1 + 0.3 * rt) * (st.lowConv ? 1.25 : 1) * (1 + noise(r) * 0.6);
        series.push({
          d: dy.d, visits: vis, exp: exp, expRaw: st.baselineRaw,
          react: vis / exp - 1, reactRaw: vis / st.baselineRaw - 1,
          dwell: dwell, sales: sold, stock: stock, out: stockedOut
        });
      });
      st.series = series;
    });

    // 매장 유형별, 전체 평균 (예상 방문 가중)
    function aggregate(list, d, key) {
      var s = 0, e = 0;
      list.forEach(function (st) { var p = st.series[d]; s += p.visits; e += (key === 'raw' ? p.expRaw : p.exp); });
      return s / e - 1;
    }
    var agg = [], aggRaw = [], byType = {};
    for (var d = 0; d <= DAYS; d++) { agg.push(aggregate(stores, d)); aggRaw.push(aggregate(stores, d, 'raw')); }
    TYPES.forEach(function (t) {
      var list = stores.filter(function (s) { return s.type === t; });
      byType[t] = [];
      for (var d2 = 0; d2 <= DAYS; d2++) byType[t].push(aggregate(list, d2));
    });
    return { scn: scn, days: days, pre: pre, stores: stores, agg: agg, aggRaw: aggRaw, byType: byType };
  }

  // 레이더가 예상한 곡선 (합성): 유형 판정과 크기만 가진 자체 가설
  function radarCurve(data, corrected, observed) {
    var kind = corrected && observed ? observed.kind : data.scn.radarKind;
    var amp = corrected && observed ? observed.peakVal : 0.5;
    var out = [];
    for (var d = 0; d <= DAYS; d++) out.push(amp * unit(kind, d, 1));
    return out;
  }

  var SHAPE_KIND = { '단발형': 'burst', '완만형': 'slow', '반복형': 'wave' };

  // 매장 반응으로 본 유형 판정 (자체 규칙, 근거 일수에 따라 신뢰도가 달라진다)
  function classify(data, D) {
    var a = data.agg.slice(0, D + 1);
    var peakDay = 0;
    a.forEach(function (v, i) { if (v > a[peakDay]) peakDay = i; });
    var peakVal = a[peakDay];
    var conf = D >= 14 ? '높음' : D >= 7 ? '중간' : D >= 4 ? '낮음' : '보류';
    var res = { type: '판정 보류', kind: null, conf: conf, peakDay: peakDay, peakVal: peakVal, days: D + 1 };
    if (D < 4) return res;
    var cur = a[D];
    // 반복형: 어느 날 그때까지 정점의 절반 아래로 식었다가, 이후 0.2 이상 다시 오른 경우
    var secondRise = false, j, k, runMax = 0, later;
    for (j = 0; j <= D - 2; j++) {
      runMax = Math.max(runMax, a[j]);
      if (j < 2 || runMax < 0.12 || a[j] > 0.5 * runMax) continue;
      later = -Infinity;
      for (k = j + 1; k <= D; k++) later = Math.max(later, a[k]);
      if (later - a[j] >= 0.2) { secondRise = true; break; }
    }
    if (secondRise) { res.type = '반복형'; res.kind = 'wave'; return res; }
    if (peakDay <= 6 && D >= peakDay + 2 && cur <= 0.65 * peakVal) { res.type = '단발형'; res.kind = 'burst'; return res; }
    if (D >= 8 && peakDay >= 5) { res.type = '완만형'; res.kind = 'slow'; return res; }
    return res;
  }

  function mean(arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / (arr.length || 1); }
  function lastN(st, D, n, key) {
    var from = Math.max(0, D - n + 1), v = [];
    for (var i = from; i <= D; i++) v.push(st.series[i][key]);
    return v;
  }
  function median(arr) {
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  var DIAG = { rise: 0.15, convLow: -0.25 };

  // 기능 2: 방문 변화와 구매 전환을 함께 본다
  function diagnose(data, D, adjust) {
    var key = adjust === false ? 'reactRaw' : 'react';
    var rows = data.stores.map(function (st) {
      var x = mean(lastN(st, D, 3, key));
      // 재고가 바닥난 날은 구매 전환 계산에서 뺀다 (못 산 것이지 안 산 것이 아니다)
      var sales = 0, vis = 0, i, p, span;
      for (span = 3; span <= 8 && !vis; span += 5) { // 3일 안에 재고가 있던 날이 없으면 최근 8일로 넓혀 본다
        for (i = Math.max(0, D - span + 1); i <= D; i++) {
          p = st.series[i];
          if (!p.out) { sales += p.sales; vis += p.visits; }
        }
      }
      var conv = vis ? sales / vis : null;
      var dw = mean(lastN(st, D, 3, 'dwell')) / st.dwellBase - 1;
      return { st: st, x: x, conv: conv, dwell: dw, out: st.series[D].out };
    });
    var med = median(rows.filter(function (r) { return r.conv != null; }).map(function (r) { return r.conv; }));
    rows.forEach(function (r) {
      if (r.conv == null) r.conv = med;
      r.y = med ? r.conv / med - 1 : 0;
      var hi = r.x >= DIAG.rise, lowConv = r.y <= DIAG.convLow;
      r.zone = hi && lowConv ? 'flag' : hi ? 'good' : lowConv ? 'reach' : 'hidden';
      r.hint = r.zone === 'flag'
        ? (r.dwell > 0.2 ? '체류는 평소보다 ' + Math.round(r.dwell * 100) + '% 길지만 구매 전환은 중앙값보다 ' + Math.abs(Math.round(r.y * 100)) + '% 낮습니다. 가격표, 시식, 진열 위치를 확인하세요.'
          : '방문은 늘었지만 구매 전환이 중앙값보다 ' + Math.abs(Math.round(r.y * 100)) + '% 낮습니다. 진열과 안내 문구를 확인하세요.')
        : r.zone === 'reach' ? '방문 자체가 약합니다. POP와 쇼케이스 노출을 먼저 점검하세요.'
          : r.zone === 'hidden' ? '구매 효율은 높습니다. 노출을 늘릴 여지가 있습니다.' : '';
    });
    return { rows: rows, medConv: med };
  }

  var ORDER_DEFAULT = { cover: 3, rise: 0.2, target: 7, low: 0.1, over: 10 };

  // 기능 3: 규칙 기반 발주·교체 권고
  function orders(data, D, p, adjust) {
    p = Object.assign({}, ORDER_DEFAULT, p || {});
    var diag = diagnose(data, D, adjust);
    var flagged = {};
    diag.rows.forEach(function (r) { if (r.zone === 'flag') flagged[r.st.id] = true; });
    var rows = data.stores.map(function (st) {
      var cur = st.series[D];
      var s3 = mean(lastN(st, D, 3, 'sales'));
      var r3 = mean(lastN(st, D, 3, adjust === false ? 'reactRaw' : 'react'));
      var r5 = mean(lastN(st, D, 5, adjust === false ? 'reactRaw' : 'react'));
      var cover = s3 > 0 ? cur.stock / s3 : (cur.stock > 0 ? 99 : 0);
      var row = { st: st, stock: cur.stock, sales3: s3, r3: r3, cover: cover, action: 'keep', qty: 0, why: '' };
      if (D < 2) { row.action = 'wait'; row.why = '출시 후 2일 이상 지나야 판단합니다.'; return row; }
      if (flagged[st.id]) {
        row.action = 'hold'; row.why = '구매 전환이 낮아 먼저 매장 안 요인을 확인합니다. 발주는 보류합니다.';
      } else if (cover <= p.cover && r3 >= p.rise) {
        row.action = 'order';
        row.qty = Math.max(10, Math.round((s3 * p.target - cur.stock) / 10) * 10);
        row.why = '반응이 평소보다 높고 재고가 ' + (cover < 0.05 ? '바닥났습니다.' : '약 ' + cover.toFixed(1) + '일치 남았습니다.');
      } else if (D >= 7 && r5 < p.low && cover > p.over) {
        row.action = 'swap';
        row.why = '반응이 평소 수준으로 돌아왔고 재고가 ' + Math.round(cover) + '일치 남았습니다.';
      } else {
        row.why = '지금 재고로 버틸 수 있습니다.';
      }
      return row;
    });
    return { rows: rows, params: p };
  }

  function typeStats(data, D) {
    return TYPES.map(function (t) {
      var a = data.byType[t].slice(0, D + 1);
      var pk = 0;
      a.forEach(function (v, i) { if (v > a[pk]) pk = i; });
      var reached = D >= pk + 2 && a[D] < a[pk] * 0.9 || D >= 12;
      var ret = D >= 14 ? a[14] / a[pk] : null;
      return {
        type: t, n: data.stores.filter(function (s) { return s.type === t; }).length,
        peakDay: pk, peak: a[pk], now: a[D], reached: reached, retain: ret, series: a
      };
    });
  }

  // 기능 7: 매장별 일별 반응 순위와 급변
  function rankSeries(data, adjust) {
    // 하루 노이즈로 순위가 흔들리지 않도록 최근 3일 평균 반응으로 순위를 매긴다
    var key = adjust === false ? 'reactRaw' : 'react';
    var ranks = data.stores.map(function () { return []; });
    for (var d = 0; d <= DAYS; d++) {
      var order = data.stores.map(function (s, i) { return { i: i, v: mean(lastN(s, d, 3, key)) }; })
        .sort(function (a, b) { return b.v - a.v; });
      order.forEach(function (o, pos) { ranks[o.i][d] = pos + 1; });
    }
    return ranks;
  }
  // 급변 = 순위가 기준 이상 움직였고, 전체 흐름과 무관하게 그 매장의 반응이 10%p 이상 달라진 경우.
  // 순위만 흔들리는 매장(비슷한 반응끼리 자리를 바꾸는 경우)과 전체가 함께 식는 경우는 알리지 않는다.
  var DEV_MIN = 0.25;
  function movers(data, D, threshold, gap, adjust) {
    var key = adjust === false ? 'reactRaw' : 'react';
    var ranks = rankSeries(data, adjust);
    var sm = function (st, d) { return mean(lastN(st, d, 3, key)); };
    var aggSm = function (d) { return mean(data.stores.map(function (st) { return sm(st, d); })); };
    var rows = data.stores.map(function (st, i) {
      var now = ranks[i][D];
      var before = D - gap >= 0 ? ranks[i][D - gap] : null;
      var delta = before == null ? 0 : before - now; // 양수면 순위 상승
      var dev = before == null ? 0 : (sm(st, D) - sm(st, D - gap)) - (aggSm(D) - aggSm(D - gap));
      var alert = before != null && Math.abs(delta) >= threshold && Math.abs(dev) >= DEV_MIN && (delta > 0) === (dev > 0);
      var cause = '';
      if (alert) {
        var s = st.series[D], prev = st.series[Math.max(0, D - gap)];
        var cover = s.stock / Math.max(1, mean(lastN(st, D, 3, 'sales')));
        if (delta < 0 && s.out && !prev.out) cause = '재고가 바닥나며 방문이 줄었을 가능성이 있습니다.';
        else if (delta < 0 && cover < 1.5) cause = '재고가 얼마 남지 않았습니다. 발주 화면을 확인하세요.';
        else if (delta > 0) cause = '방문이 갑자기 늘었습니다. 현장 행사나 노출 변화가 있었는지 확인하세요.';
        else cause = '원인이 보이지 않습니다. 현장 확인이 필요합니다.';
      }
      return {
        st: st, now: now, before: before, delta: delta, dev: dev, cause: cause, alert: alert,
        trail: ranks[i].slice(Math.max(0, D - 13), D + 1), react: st.series[D][key]
      };
    });
    return rows;
  }

  // 홈 타임라인: 각 기능의 신호가 처음 켜진 날
  function milestones(data) {
    var m = { signal: null, gap: null, order: null, radar: null, alert: null };
    var cls = null;
    for (var D = 0; D <= DAYS; D++) {
      if (m.signal == null && D >= 1 && data.agg[D] >= 0.15 && data.agg[D - 1] >= 0.15) m.signal = D;
      if (m.gap == null && D >= 2 && diagnose(data, D).rows.filter(function (r) { return r.zone === 'flag'; }).length >= 3) m.gap = D;
      if (m.order == null && D >= 2 && orders(data, D).rows.some(function (r) { return r.action === 'order'; })) m.order = D;
      if (m.radar == null && D >= 4) { cls = classify(data, D); if (cls.kind && cls.conf !== '보류') m.radar = D; }
      if (m.alert == null && D >= 2 && movers(data, D, 5, 3).some(function (r) { return r.alert; })) m.alert = D;
    }
    return m;
  }

  var API = {
    DAYS: DAYS, PRE: PRE, TYPES: TYPES, SCENARIOS: SCENARIOS, LAUNCH: LAUNCH, DIAG: DIAG, ORDER_DEFAULT: ORDER_DEFAULT,
    SHAPE_KIND: SHAPE_KIND, TYPE_SPEC: TYPE_SPEC,
    build: build, radarCurve: radarCurve, classify: classify, diagnose: diagnose, orders: orders,
    typeStats: typeStats, rankSeries: rankSeries, movers: movers, milestones: milestones, unit: unit, mean: mean
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BR = API;
})(typeof window !== 'undefined' ? window : globalThis);
