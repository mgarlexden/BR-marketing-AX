/* 화면 8개 (홈 + 기능 7개). 모두 합성 데이터 위에서 그린다. 문자열 템플릿을 돌려주고, 클릭은 app.js가 data-* 로 처리한다. */
(function (root) {
  'use strict';
  var BR = root.BR, U = root.UI, V = {};

  /* ---------- 공통 ---------- */
  var short = function (st) { return st.name.replace(' 매장', ''); };
  function aggOf(list, d, raw) {
    var s = 0, e = 0;
    list.forEach(function (st) { var p = st.series[d]; s += p.visits; e += raw ? p.expRaw : p.exp; });
    return { v: s / e - 1, vis: s, exp: e };
  }
  function niceRange(vals, minHi) {
    var lo = Math.min.apply(null, [0].concat(vals)), hi = Math.max.apply(null, [minHi || 0.2].concat(vals));
    var span = hi - lo, steps = [0.1, 0.2, 0.25, 0.5, 1, 2], step = 2, i;
    for (i = 0; i < steps.length; i++) if (span / steps[i] <= 6) { step = steps[i]; break; }
    lo = Math.floor(lo / step + 1e-9) * step; hi = Math.ceil(hi / step - 1e-9) * step;
    var ticks = []; for (var t = lo; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);
    return { min: lo, max: hi, ticks: ticks };
  }
  function cache(data, key, fn) { data._c = data._c || {}; return data._c[key] || (data._c[key] = fn()); }
  function head(title, question, right) {
    return '<header class="page-head"><div><h1>' + U.esc(title) + '</h1><p class="page-q">' + question + '</p></div>' + (right ? '<div class="page-tools">' + right + '</div>' : '') + '</header>';
  }
  function seg(label, opts, cur) {
    return '<div class="seg" role="group" aria-label="' + U.esc(label) + '">' + opts.map(function (o) {
      return '<button type="button" class="seg__btn" data-q="' + o.q + '" aria-pressed="' + (String(o.v) === String(cur)) + '">' + U.esc(o.label) + '</button>';
    }).join('') + '</div>';
  }
  function basis(strength, text) { // 근거 강도 한 줄
    return '<p class="basis"><b>근거 강도: ' + U.esc(strength) + '.</b> ' + text + '</p>';
  }
  function readoutDay(c, d) { return '<b>' + U.dLabel(d) + '</b> ' + U.esc(U.dateLabel(c.data, d)); }

  /* ---------- 홈 ---------- */
  V.home = function (c) {
    var d = c.data, D = c.D, ms = cache(d, 'ms', function () { return BR.milestones(d); });
    var agg = d.agg[D], types = BR.typeStats(d, D);
    var diag = BR.diagnose(d, D), flags = diag.rows.filter(function (r) { return r.zone === 'flag'; });
    var ord = BR.orders(d, D, c.params);
    var nOrder = ord.rows.filter(function (r) { return r.action === 'order'; }), nSwap = ord.rows.filter(function (r) { return r.action === 'swap'; }), nHold = ord.rows.filter(function (r) { return r.action === 'hold'; });
    var pendingOrders = nOrder.filter(function (r) { return !c.appr[c.key('order', r.st.id)]; }).length;
    var cls = BR.classify(d, D), radarApp = c.appr[d.scn.id + ':radar'];
    var mismatch = cls.kind && cls.type !== d.scn.radarShape;
    var mv = BR.movers(d, D, 5, 3).filter(function (r) { return r.alert; });
    var up = mv.filter(function (r) { return r.delta > 0; }).length, down = mv.length - up;
    var speed = types.filter(function (t) { return t.reached; })
      .sort(function (a, b) { return a.peakDay - b.peakDay || b.peak - a.peak; });

    var range = niceRange(d.agg.slice(0, D + 1), 0.4);
    var id = 'home';
    var svg = U.lineChart({
      id: id, w: 760, h: 300, xMax: BR.DAYS, yMin: range.min, yMax: range.max, yTicks: range.ticks, yFmt: function (t) { return U.pct(t); },
      xTicks: [0, 7, 14, 21, 28], rightPad: 24, day: D, ticks: [ms.signal, ms.gap, ms.order, ms.radar, ms.alert].filter(function (x) { return x != null && x <= D; }),
      refs: [{ x: 15, label: '기존 확인 D+15' }, { x: 22, label: 'D+22' }],
      series: [{ pts: d.agg.slice(0, D + 1), cls: 'ch-line--main', dot: true }],
      aria: '출시 후 전체 반응 변화율. 지금 ' + U.dLabel(D) + ' ' + U.pct(agg),
      readout: function (day) { return day > D ? readoutDay(c, day) + ' 아직 오지 않은 날입니다' : readoutDay(c, day) + ' 전체 ' + '<b>' + U.pct(d.agg[day]) + '</b>'; }
    });
    var sig = [
      { d: ms.signal, t: '반응 신호', n: '평소보다 15% 이상 높은 날이 이틀 이어짐' },
      { d: ms.gap, t: '관심-구매 괴리', n: '3개 매장 이상에서 감지' },
      { d: ms.order, t: '발주 권고', n: '추가 발주 대상이 처음 생김' },
      { d: ms.radar, t: '레이더 유형 판정', n: '매장 반응으로 유형을 판정' },
      { d: ms.alert, t: '순위 급변', n: '처음 알림이 뜸' }
    ];
    var sigHtml = '<ol class="signals">' + sig.map(function (s) {
      var on = s.d != null && s.d <= D;
      return '<li class="' + (on ? 'is-on' : '') + '"><span class="signals__d num">' + (s.d == null ? '해당 없음' : on ? U.dLabel(s.d) : '아직') + '</span><span class="signals__t">' + s.t + '</span></li>';
    }).join('') + '</ol>';

    function row(n, name, route, result, tone, status) {
      return '<tr><th scope="row"><a class="rowlink" href="' + c.href(route) + '"><span class="n num">' + n + '</span>' + name + '</a></th><td>' + result + '</td><td>' + U.chip(status, tone) + '</td></tr>';
    }
    var rows = '';
    rows += row(1, '반응 지수', 'reaction', '전체 <b class="num">' + U.pct(agg) + '</b>' + (speed.length ? '. 정점이 가장 빨랐던 유형: ' + speed[0].type : ''), agg >= 0.15 ? '' : 'quiet', agg >= 0.15 ? '반응 있음' : '반응 약함');
    rows += row(2, '관심-구매 진단', 'diagnosis', flags.length ? '<b class="num">' + flags.length + '개</b> 매장이 방문은 늘었는데 구매가 낮습니다' : '방문과 구매가 함께 움직입니다', flags.length ? 'alert' : 'quiet', flags.length ? '판단 필요' : '이상 없음');
    rows += row(3, '발주·교체 권고', 'orders', D < 2 ? '출시 후 2일째부터 판단합니다' : '추가 발주 <b class="num">' + nOrder.length + '건</b>, 교체 후보 <b class="num">' + nSwap.length + '건</b>, 보류 <b class="num">' + nHold.length + '건</b>', pendingOrders ? 'alert' : 'quiet', pendingOrders ? '승인 대기 ' + pendingOrders + '건' : D < 2 ? '대기' : '승인 완료');
    var radarText, radarTone = 'quiet', radarStatus;
    if (!cls.kind) { radarText = '매장 반응으로 유형을 판정하기엔 이릅니다. 4일째부터 판정합니다'; radarStatus = '판정 보류'; }
    else if (!mismatch) { radarText = '레이더 예상 ' + d.scn.radarShape + ', 매장 반응 ' + cls.type + '. 맞습니다'; radarStatus = '일치'; }
    else if (radarApp && radarApp.state === 'approved' && radarApp.day <= D) { radarText = '매장 반응 기준 ' + cls.type + '으로 보정했습니다'; radarStatus = '보정 반영'; }
    else if (radarApp && radarApp.state === 'deferred' && radarApp.day <= D) { radarText = '레이더 예상 ' + d.scn.radarShape + ', 매장 반응 ' + cls.type + '. 보정을 보류했습니다'; radarStatus = '보정 보류'; }
    else { radarText = '레이더 예상 ' + d.scn.radarShape + ', 매장 반응 ' + cls.type + '. 보정을 검토하세요'; radarTone = 'alert'; radarStatus = '보정 권고'; }
    rows += row(4, '레이더 보정', 'radar', radarText, radarTone, radarStatus);
    rows += row(6, '유형별 반응 속도', 'types', speed.length ? '정점이 가장 빨랐던 유형 <b>' + speed[0].type + '</b> (' + U.dLabel(speed[0].peakDay) + ')' : '아직 정점에 도달한 유형이 없습니다', 'quiet', '비교 가능');
    rows += row(7, '순위 급변', 'ranks', mv.length ? '급등 <b class="num">' + up + '곳</b>, 급락 <b class="num">' + down + '곳</b> (3일 전 대비)' : '기준을 넘은 매장이 없습니다', mv.length ? 'alert' : 'quiet', mv.length ? '확인 필요' : '변동 없음');
    rows += row(5, '프라이버시 설계', 'privacy', '영상은 저장하지 않고 존 단위 집계값만 씁니다', 'quiet', '항상 적용');

    var visSum = aggOf(d.stores, D);
    return head('홈', U.esc(d.scn.label) + '은 출시 ' + U.dLabel(D) + '일째입니다. 지금 판단할 것을 모았습니다.') +
      '<section class="home-top" aria-label="전체 반응과 타임라인">' +
      '<dl class="bigfig"><dt>전체 반응 변화율</dt><dd class="num">' + U.pct(agg) + '</dd>' +
      '<dd class="bigfig__note">' + d.stores.length + '개 매장 합계로, 오늘 신제품 쇼케이스·POP 존 방문은 <b class="num">' + U.num(visSum.vis) + '명</b>입니다. 평소(출시 전 14일 평균)에 요일과 기온을 맞추면 <b class="num">' + U.num(visSum.exp) + '명</b>이 예상됩니다.</dd></dl>' +
      '<figure class="timeline"><figcaption>출시 후 반응 곡선. 세로 점선은 기존 방식으로 확인하던 시점입니다. 차트를 누르면 그날로 이동합니다.</figcaption>' +
      U.chartBox(id, svg, readoutDay(c, D) + ' 전체 <b>' + U.pct(agg) + '</b>', { setDay: true, aria: '출시 후 반응 곡선. 방향키로 날짜를 옮겨 값을 읽습니다' }) + sigHtml + '</figure></section>' +
      '<section class="block"><h2>오늘 읽을 결과</h2><div class="tablewrap"><table class="tbl tbl--home"><thead><tr><th scope="col">기능</th><th scope="col">지금 결과</th><th scope="col">상태</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
      '<p class="basis">기존 확인 시점은 공식 발표치 기준(출시 15일 100만 개, 22일 142만 개)이고, 이 화면의 값은 모두 합성 데이터에서 계산한 시연입니다.</p>';
  };

  /* ---------- 1. 반응 지수 ---------- */
  V.reaction = function (c) {
    var d = c.data, D = c.D, q = c.q, type = q.type || 'all';
    var list = type === 'all' ? d.stores : d.stores.filter(function (s) { return s.type === type; });
    var now = aggOf(list, D), adj = [], raw = [], lo = [], hi = [], k;
    for (k = 0; k <= D; k++) {
      adj.push(aggOf(list, k).v); raw.push(aggOf(list, k, true).v);
      var vals = list.map(function (s) { return s.series[k].react; }).sort(function (a, b) { return a - b; });
      lo.push(vals[Math.floor(vals.length * 0.25)]); hi.push(vals[Math.floor(vals.length * 0.75)]);
    }
    var range = niceRange(adj.concat(raw, hi, lo), 0.4);
    var svg = U.lineChart({
      id: 'reaction', w: 760, h: 320, xMax: BR.DAYS, yMin: range.min, yMax: range.max, yTicks: range.ticks, yFmt: function (t) { return U.pct(t); },
      xTicks: [0, 7, 14, 21, 28], day: D, rightPad: 72, band: { lo: lo, hi: hi },
      series: [{ pts: raw, cls: 'ch-line--ctx', label: '보정 전', labelCls: 'is-ctx' }, { pts: adj, cls: 'ch-line--main', label: '보정 후', dot: true }],
      aria: (type === 'all' ? '전체' : type) + ' 반응 변화율. 지금 ' + U.pct(adj[D]),
      readout: function (day) {
        return day > D ? readoutDay(c, day) + ' 아직 오지 않은 날입니다' :
          readoutDay(c, day) + ' 보정 후 <b>' + U.pct(adj[day]) + '</b>, 보정 전 ' + U.pct(raw[day]) + ', 매장 중간 절반 ' + U.pct(lo[day]) + ' ~ ' + U.pct(hi[day]);
      }
    });
    var rows = list.map(function (st) {
      var p = st.series[D];
      return { st: st, p: p, r: p.react, dw: p.dwell / st.dwellBase - 1, tr: st.series.slice(Math.max(0, D - 6), D + 1).map(function (x) { return x.react; }) };
    }).sort(function (a, b) { return b.r - a.r; });
    var maxAbs = Math.max(0.3, Math.max.apply(null, rows.map(function (r) { return Math.abs(r.r); })));
    var body = rows.map(function (r) {
      var open = q.open === r.st.id;
      var dChart = '';
      if (open) {
        var s = r.st.series, mine = s.slice(0, D + 1).map(function (x) { return x.react; });
        var rg = niceRange(mine.concat(adj), 0.4);
        var svg2 = U.lineChart({
          id: 'store', w: 640, h: 220, xMax: BR.DAYS, yMin: rg.min, yMax: rg.max, yTicks: rg.ticks, yFmt: function (t) { return U.pct(t); },
          xTicks: [0, 7, 14, 21, 28], day: D, rightPad: 88,
          series: [{ pts: adj, cls: 'ch-line--ctx', label: type === 'all' ? '전체' : type, labelCls: 'is-ctx' }, { pts: mine, cls: 'ch-line--main', label: short(r.st), dot: true }],
          aria: r.st.name + ' 반응 변화율', readout: function (day) { return day > D ? readoutDay(c, day) + ' 아직 오지 않은 날입니다' : readoutDay(c, day) + ' ' + short(r.st) + ' <b>' + U.pct(mine[day]) + '</b>, 비교 ' + U.pct(adj[day]); }
        });
        var days3 = s.slice(Math.max(0, D - 4), D + 1).map(function (x) { return '<tr><th scope="row">' + U.dLabel(x.d) + '</th><td class="num">' + U.num(x.visits) + '명</td><td class="num">' + U.num(x.exp) + '명</td><td class="num">' + U.pct(x.react) + '</td></tr>'; }).join('');
        dChart = '<tr class="detail"><td colspan="7"><div class="detail__grid">' + U.chartBox('store', svg2, readoutDay(c, D) + ' ' + short(r.st) + ' <b>' + U.pct(mine[D]) + '</b>') +
          '<div><h3>' + U.esc(r.st.name) + ' 최근 5일</h3><table class="tbl tbl--mini"><thead><tr><th scope="col">날짜</th><th scope="col">방문</th><th scope="col">예상</th><th scope="col">변화율</th></tr></thead><tbody>' + days3 + '</tbody></table></div></div></td></tr>';
      }
      return '<tr class="' + (open ? 'is-open' : '') + '"><th scope="row"><button type="button" class="rowtoggle" data-q-toggle="open=' + r.st.id + '" aria-expanded="' + open + '">' + U.icon(open ? 'down' : 'right', 16) + U.esc(r.st.name) + '</button></th>' +
        '<td>' + U.esc(r.st.type) + '</td><td class="num">' + U.num(r.p.visits) + '</td><td class="num muted">' + U.num(r.p.exp) + '</td>' +
        '<td class="cell-bar">' + U.zbar(r.r, maxAbs) + '<b>' + U.pct(r.r) + '</b></td>' +
        '<td class="num">' + Math.round(r.p.dwell) + '초 <span class="muted">(' + U.pct(r.dw) + ')</span></td>' +
        '<td>' + U.spark(r.tr, { cls: r.r >= 0 ? 'spark--main' : 'spark--ctx' }) + '</td></tr>' + dChart;
    }).join('');
    var tabs = seg('매장 유형', [{ v: 'all', label: '전체', q: 'type=all' }].concat(BR.TYPES.map(function (t) { return { v: t, label: t, q: 'type=' + t }; })), type);
    return head('반응 지수', '신제품 쇼케이스·POP 존은 평소보다 얼마나 붐비나요?', tabs) +
      '<section class="split split--chart"><dl class="bigfig bigfig--sm"><dt>' + (type === 'all' ? '전체' : U.esc(type)) + ' 반응 변화율, ' + U.dLabel(D) + '</dt><dd class="num">' + U.pct(now.v) + '</dd>' +
      '<dd class="bigfig__note">오늘 방문 <b class="num">' + U.num(now.vis) + '명</b>, 평소라면 <b class="num">' + U.num(now.exp) + '명</b>. 요일과 기온을 보정한 값입니다.</dd></dl>' +
      '<div>' + U.chartBox('reaction', svg, readoutDay(c, D) + ' 보정 후 <b>' + U.pct(adj[D]) + '</b>, 보정 전 ' + U.pct(raw[D]) + ', 매장 중간 절반 ' + U.pct(lo[D]) + ' ~ ' + U.pct(hi[D]), { setDay: true }) +
      '<p class="chart-note">음영은 매장들의 중간 절반(상위 25%와 하위 25% 사이)입니다. 보정 전 선이 요일에 따라 출렁이는 것을 보정 후 선이 잡아 줍니다.</p></div></section>' +
      '<section class="block"><h2>매장별 오늘 반응</h2><div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">매장</th><th scope="col">유형</th><th scope="col" class="num">오늘 방문</th><th scope="col" class="num">평소 예상</th><th scope="col">변화율</th><th scope="col" class="num">체류 중앙값</th><th scope="col">최근 7일</th></tr></thead><tbody>' + body + '</tbody></table></div></section>' +
      '<details class="how"><summary>계산 방식</summary><p>반응 변화율 = 오늘 방문 ÷ 평소 예상 − 1. 평소 예상은 출시 전 14일의 요일·기온을 걷어낸 평균에 오늘의 요일 계수와 기온 계수를 곱한 값입니다. 방문은 신제품 쇼케이스·POP 존에 들어온 횟수이고, 체류는 그 존에 머문 시간의 중앙값입니다.</p></details>' +
      basis('중간에서 약함', '방문과 체류 지표는 벤더가 일반적으로 제공하지만, 신제품 진열이 구매를 일으킨다는 인과를 보인 공개 사례는 찾지 못했습니다. 그래서 "평소 대비 변화"로만 읽습니다.');
  };

  /* ---------- 2. 관심-구매 진단 ---------- */
  V.diagnosis = function (c) {
    var d = c.data, D = c.D, q = c.q, view = q.view || 'flag';
    var dg = BR.diagnose(d, D), rows = dg.rows;
    var flags = rows.filter(function (r) { return r.zone === 'flag'; }).sort(function (a, b) { return a.y - b.y; });
    var shown = view === 'all' ? rows.slice().sort(function (a, b) { return a.y - b.y; }) : flags;
    var xr = niceRange(rows.map(function (r) { return r.x; }), 0.5), yr = (function () {
      var ys = rows.map(function (r) { return r.y; }), lo = Math.min(-0.5, Math.min.apply(null, ys)), hi = Math.max(0.5, Math.max.apply(null, ys));
      lo = Math.floor(lo * 4) / 4; hi = Math.ceil(hi * 4) / 4; var t = []; for (var v = lo; v <= hi + 1e-9; v += 0.25) t.push(Math.round(v * 100) / 100);
      return { min: lo, max: hi, ticks: t };
    })();
    var W = 600, H = 460, m = { l: 72, r: 16, t: 16, b: 48 }, x0 = m.l, x1 = W - m.r, y0 = H - m.b, y1 = m.t;
    var sx = function (v) { return x0 + (x1 - x0) * (v - xr.min) / (xr.max - xr.min); }, sy = function (v) { return y0 - (y0 - y1) * (v - yr.min) / (yr.max - yr.min); };
    var f = function (n) { return Math.round(n * 10) / 10; };
    var svg = '<svg class="scatter" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="방문 변화율과 구매 전환을 비교한 산점도. 점검이 필요한 매장 ' + flags.length + '곳">';
    svg += '<rect class="sc-flag" x="' + f(sx(BR.DIAG.rise)) + '" y="' + f(sy(BR.DIAG.convLow)) + '" width="' + f(x1 - sx(BR.DIAG.rise)) + '" height="' + f(y0 - sy(BR.DIAG.convLow)) + '"/>';
    xr.ticks.forEach(function (t) { svg += '<line class="ch-grid" x1="' + f(sx(t)) + '" x2="' + f(sx(t)) + '" y1="' + y1 + '" y2="' + y0 + '"/><text class="ch-tick" x="' + f(sx(t)) + '" y="' + (y0 + 18) + '" text-anchor="middle">' + U.pct(t) + '</text>'; });
    yr.ticks.forEach(function (t) { svg += '<line class="ch-grid" x1="' + x0 + '" x2="' + x1 + '" y1="' + f(sy(t)) + '" y2="' + f(sy(t)) + '"/><text class="ch-tick" x="' + (x0 - 8) + '" y="' + f(sy(t) + 4) + '" text-anchor="end">' + U.pct(t) + '</text>'; });
    svg += '<line class="sc-cut" x1="' + f(sx(BR.DIAG.rise)) + '" x2="' + f(sx(BR.DIAG.rise)) + '" y1="' + y1 + '" y2="' + y0 + '"/><line class="sc-cut" x1="' + x0 + '" x2="' + x1 + '" y1="' + f(sy(BR.DIAG.convLow)) + '" y2="' + f(sy(BR.DIAG.convLow)) + '"/>';
    svg += '<text class="sc-quad is-flag" x="' + (x1 - 8) + '" y="' + (y0 - 10) + '" text-anchor="end">관심 높음, 구매 낮음</text><text class="sc-quad" x="' + (x1 - 8) + '" y="' + (y1 + 16) + '" text-anchor="end">정상 반응</text>' +
      '<text class="sc-quad" x="' + (x0 + 8) + '" y="' + (y0 - 10) + '">인지·유입 부족</text><text class="sc-quad" x="' + (x0 + 8) + '" y="' + (y1 + 16) + '">노출 확대 여지</text>';
    var tags = [];
    rows.forEach(function (r) {
      var fl = r.zone === 'flag';
      svg += '<circle class="sc-dot' + (fl ? ' is-flag' : '') + '" cx="' + f(sx(r.x)) + '" cy="' + f(sy(r.y)) + '" r="' + (fl ? 6 : 5) + '"><title>' + U.esc(r.st.name) + ': 방문 ' + U.pct(r.x) + ', 전환 ' + U.pct(r.y) + '</title></circle>';
      if (fl) tags.push({ x: sx(r.x) + 10, y: sy(r.y) + 4, t: short(r.st) });
    });
    tags.sort(function (a, b) { return a.y - b.y; });
    tags.forEach(function (g, i) { if (i && g.y - tags[i - 1].y < 15) g.y = tags[i - 1].y + 15; svg += '<text class="sc-name" x="' + f(g.x) + '" y="' + f(g.y) + '">' + U.esc(g.t) + '</text>'; });
    svg += '<text class="ch-axis" x="' + f((x0 + x1) / 2) + '" y="' + (H - 8) + '" text-anchor="middle">방문 변화율 (최근 3일, 평소 대비)</text>';
    svg += '<text class="ch-axis" transform="translate(12 ' + f((y0 + y1) / 2) + ') rotate(-90)" text-anchor="middle">구매 전환 (전 매장 중앙값 대비)</text></svg>';
    var table;
    if (!shown.length) {
      table = U.empty('점검할 매장이 없습니다', '방문이 평소보다 ' + Math.round(BR.DIAG.rise * 100) + '% 이상 늘었는데 구매 전환이 중앙값보다 ' + Math.abs(Math.round(BR.DIAG.convLow * 100)) + '% 넘게 낮은 매장이 지금은 없습니다.', '전체 매장 보기', 'q:view=all');
    } else {
      table = '<div class="tablewrap tablewrap--cap"><table class="tbl"><thead><tr><th scope="col">매장</th><th scope="col" class="num">방문</th><th scope="col" class="num">전환</th><th scope="col">' + (view === 'all' ? '진단' : '확인할 것') + '</th></tr></thead><tbody>' +
        shown.map(function (r) {
          var zoneName = { flag: '관심 높음, 구매 낮음', good: '정상 반응', reach: '인지·유입 부족', hidden: '노출 확대 여지' }[r.zone];
          return '<tr class="' + (r.zone === 'flag' && view === 'all' ? 'is-flag' : '') + '"><th scope="row">' + U.esc(r.st.name) + '</th><td class="num">' + U.pct(r.x) + '</td><td class="num">' + (r.conv * 100).toFixed(0) + '개 <span class="muted">(' + U.pct(r.y) + ')</span></td><td>' + (view === 'all' ? '<b>' + zoneName + '</b>' + (r.hint ? '<br><span class="muted">' + r.hint + '</span>' : '') : r.hint) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    var lead = flags.length ? '<b class="num">' + flags.length + '개</b> 매장에서 방문은 평소보다 늘었는데 구매 전환이 중앙값보다 낮습니다.' : '지금은 방문과 구매가 함께 움직이고 있습니다.';
    return head('관심-구매 진단', '관심은 있는데 구매로 이어지지 않는 매장은 어디인가요?', seg('보기', [{ v: 'flag', label: '점검 필요만', q: 'view=flag' }, { v: 'all', label: '전체 매장', q: 'view=all' }], view)) +
      '<p class="lead-line">' + lead + ' 전환은 존 방문 100명당 신제품 판매 수이고, 중앙값은 ' + (dg.medConv * 100).toFixed(0) + '개입니다.</p>' +
      '<section class="split split--scatter"><div class="scatterwrap">' + svg + '</div><div>' + table + '</div></section>' +
      '<details class="how"><summary>기준과 계산 방식</summary><p>점검 대상은 최근 3일 평균 방문이 평소보다 ' + Math.round(BR.DIAG.rise * 100) + '% 이상 늘었고 구매 전환이 전 매장 중앙값보다 ' + Math.abs(Math.round(BR.DIAG.convLow * 100)) + '% 넘게 낮은 매장입니다. 재고가 바닥난 날은 전환 계산에서 뺍니다(못 산 것이지 안 산 것이 아니기 때문). 방문이 늘지 않았는데 전환도 낮으면 인지·유입 문제로, 전환만 높으면 노출을 늘릴 여지로 읽습니다.</p></details>' +
      basis('중간', '체류가 곧 구매는 아닙니다(쇼퍼 동선 연구, 2009). 그래서 방문과 체류는 항상 판매와 짝지어 읽습니다. 판매는 합성 POS입니다.');
  };

  /* ---------- 3. 발주·교체 권고 ---------- */
  var FIELDS = [
    { k: 'cover', label: '남은 재고가 이 일수 이하면 추가 발주', min: 1, max: 7, step: 1, unit: '일', scale: 1 },
    { k: 'rise', label: '반응이 평소보다 이 수준 이상일 때만', min: 5, max: 50, step: 5, unit: '%', scale: 100 },
    { k: 'target', label: '추가 발주는 이 일수치 재고를 채우는 양', min: 3, max: 14, step: 1, unit: '일', scale: 1 },
    { k: 'low', label: '반응이 이 수준보다 낮으면 교체 후보', min: 0, max: 20, step: 5, unit: '%', scale: 100 },
    { k: 'over', label: '재고가 이 일수를 넘게 남았을 때 교체 후보', min: 5, max: 30, step: 1, unit: '일', scale: 1 }
  ];
  V.orders = function (c) {
    var d = c.data, D = c.D, q = c.q, act = q.act || 'all';
    var P = Object.assign({}, BR.ORDER_DEFAULT, c.params);
    var res = BR.orders(d, D, P), rows = res.rows;
    var by = function (a) { return rows.filter(function (r) { return r.action === a; }); };
    var orders = by('order'), swaps = by('swap'), holds = by('hold');
    var done = function (r) { return !!c.appr[c.key('order', r.st.id)]; };
    var pending = orders.filter(function (r) { return !done(r); });
    var prio = { order: 0, hold: 1, swap: 2, keep: 3, wait: 4 };
    var shown = rows.filter(function (r) { return act === 'all' ? true : r.action === act; }).sort(function (a, b) { return prio[a.action] - prio[b.action] || a.cover - b.cover; });
    var label = { order: '추가 발주', swap: '교체 후보', hold: '발주 보류', keep: '유지', wait: '판단 전' };
    var tone = { order: 'alert', swap: 'ink', hold: 'ink', keep: 'quiet', wait: 'quiet' };
    var body = shown.map(function (r) {
      var key = c.key('order', r.st.id), approved = !!c.appr[key];
      var actionCell = '';
      if (r.action === 'order' || r.action === 'swap') {
        actionCell = approved ? '<span class="approved">' + U.icon('check', 16) + '승인됨</span> <button type="button" class="linkbtn" data-act="appr-undo:' + key + '">되돌리기</button>' :
          '<button type="button" class="btn btn--quiet btn--sm" data-act="appr-set:' + key + '">승인</button>';
      }
      return '<tr><th scope="row">' + U.esc(r.st.name) + '</th><td class="num">' + U.pct(r.r3) + '</td><td class="num">' + U.num(r.stock) + '개</td><td class="num">' + (r.cover >= 99 ? '재고 많음' : r.cover < 0.05 ? '바닥' : r.cover.toFixed(1) + '일') + '</td>' +
        '<td>' + U.chip(label[r.action] + (r.action === 'order' ? ' +' + U.num(r.qty) + '개' : ''), tone[r.action]) + '</td><td class="why">' + U.esc(r.why) + '</td><td class="act">' + actionCell + '</td></tr>';
    }).join('');
    var empty = shown.length ? '' : U.empty('이 조건에 맞는 매장이 없습니다', '권고 종류를 바꾸거나, 오른쪽 가정 값을 조정해 보세요.', '전체 권고 보기', 'q:act=all');
    var fields = FIELDS.map(function (fd) {
      var cur = Math.round(P[fd.k] * fd.scale);
      return '<div class="field"><label for="p-' + fd.k + '">' + fd.label + '</label><div class="field__row"><input id="p-' + fd.k + '" type="range" min="' + fd.min + '" max="' + fd.max + '" step="' + fd.step + '" value="' + cur + '" data-param="' + fd.k + '" data-scale="' + fd.scale + '"><output for="p-' + fd.k + '" class="num">' + cur + fd.unit + '</output></div></div>';
    }).join('');
    var totalQty = orders.reduce(function (s, r) { return s + r.qty; }, 0);
    var stats = '<dl class="stats"><div><dt>추가 발주</dt><dd class="num">' + orders.length + '건</dd><dd class="stats__n">합계 ' + U.num(totalQty) + '개, 승인 대기 ' + pending.length + '건</dd></div>' +
      '<div><dt>교체 후보</dt><dd class="num">' + swaps.length + '건</dd><dd class="stats__n">' + (D < 7 ? '출시 후 7일째부터 판단' : '반응이 평소 수준이고 재고가 많은 매장') + '</dd></div>' +
      '<div><dt>발주 보류</dt><dd class="num">' + holds.length + '건</dd><dd class="stats__n">관심-구매 진단에서 점검 대상</dd></div></dl>';
    var bulk = '<button type="button" class="btn btn--primary" data-act="appr-all"' + (pending.length ? '' : ' disabled aria-disabled="true"') + '>추천 발주 ' + pending.length + '건 모두 승인</button>';
    return head('발주·교체 권고', '어느 매장에 얼마나 더 보내고, 어느 매장은 줄일까요?', bulk) +
      '<p class="notice">합성 환경입니다. 승인해도 실제 발주로 전달되지 않고, 이 화면의 기록으로만 남습니다.</p>' + stats +
      '<section class="split split--orders"><div><div class="toolrow">' + seg('권고 종류', [{ v: 'all', label: '전체', q: 'act=all' }, { v: 'order', label: '추가 발주', q: 'act=order' }, { v: 'hold', label: '보류', q: 'act=hold' }, { v: 'swap', label: '교체 후보', q: 'act=swap' }], act) + '</div>' +
      (shown.length ? '<div class="tablewrap"><table class="tbl tbl--orders"><thead><tr><th scope="col">매장</th><th scope="col" class="num">반응(3일)</th><th scope="col" class="num">재고</th><th scope="col" class="num">소진까지</th><th scope="col">권고</th><th scope="col">근거</th><th scope="col">승인</th></tr></thead><tbody>' + body + '</tbody></table></div>' : empty) + '</div>' +
      '<aside class="params" aria-label="가정 값"><h2>가정 값 바꿔보기</h2><p class="params__hint">값을 바꾸면 왼쪽 권고가 바로 다시 계산됩니다.</p>' + fields +
      '<button type="button" class="btn btn--quiet btn--sm" data-act="params-reset">기본값으로</button></aside></section>' +
      '<details class="how"><summary>권고 규칙</summary><p>① 구매 전환이 낮은 매장은 발주를 보류하고 매장 안 요인부터 확인합니다. ② 남은 재고가 ' + P.cover + '일치 이하이고 최근 3일 반응이 평소보다 ' + Math.round(P.rise * 100) + '% 이상이면 ' + P.target + '일치 재고를 채우는 양을 추가 발주로 권고합니다. ③ 출시 후 7일부터, 최근 5일 반응이 평소보다 ' + Math.round(P.low * 100) + '% 미만이고 재고가 ' + P.over + '일치를 넘으면 교체 후보로 올립니다. 예측 모델이 아니라 읽을 수 있는 규칙이며, 재고와 판매는 합성 값입니다.</p></details>' +
      basis('중간에서 약함', '초기 판매에 맞춰 대응하면 이익이 개선된다는 연구는 있으나(패션, 2차 확인) 판매 데이터 기반이고 카메라 데이터가 아닙니다.');
  };

  /* ---------- 4. 레이더 보정 ---------- */
  V.radar = function (c) {
    var d = c.data, D = c.D, cls = BR.classify(d, D), key = d.scn.id + ':radar', ap = c.appr[key];
    var applied = ap && ap.day <= D && ap.state === 'approved', deferred = ap && ap.day <= D && ap.state === 'deferred';
    var orig = BR.radarCurve(d, false);
    var fixed = applied ? BR.radarCurve(d, true, { kind: ap.kind, peakVal: ap.peakVal }) : null;
    var actual = d.agg.slice(0, D + 1);
    var base = fixed || orig;
    var sa = 0, sf = 0; for (var k = 0; k <= D; k++) { sa += actual[k]; sf += base[k]; }
    var gap = sf > 0.2 ? (sa - sf) / sf : null;
    var all = actual.concat(orig, fixed || []);
    var range = niceRange(all, 0.4);
    var series = [{ pts: orig, cls: 'ch-line--ctx ch-line--dash', label: applied ? '보정 전 예상' : '레이더 예상', labelCls: 'is-ctx' }];
    if (fixed) series.push({ pts: fixed, cls: 'ch-line--ink ch-line--dash', label: '보정 후 예상', labelDy: 14 });
    series.push({ pts: actual, cls: 'ch-line--main', label: '매장 실제', dot: true, labelDy: -6 });
    var svg = U.lineChart({
      id: 'radar', w: 760, h: 320, xMax: BR.DAYS, yMin: range.min, yMax: range.max, yTicks: range.ticks, yFmt: function (t) { return U.pct(t); },
      xTicks: [0, 7, 14, 21, 28], day: D, rightPad: 96, series: series, aria: '레이더 예상 곡선과 매장 실제 반응 비교',
      readout: function (day) {
        return day > D ? readoutDay(c, day) + ' 아직 오지 않은 날입니다 (예상 ' + U.pct(base[day]) + ')' :
          readoutDay(c, day) + ' 실제 <b>' + U.pct(actual[day]) + '</b>, 예상 ' + U.pct(base[day]);
      }
    });
    var mismatch = cls.kind && cls.type !== d.scn.radarShape;
    var verdict, actions = '';
    if (!cls.kind) {
      verdict = '<p class="verdict__big">판정 보류</p><p>매장 반응으로 유형을 가르려면 최소 4일의 근거가 필요합니다. 지금 근거는 <b class="num">' + cls.days + '일</b>입니다.</p>';
    } else if (applied) {
      verdict = '<p class="verdict__big">보정 반영됨</p><p>' + U.dLabel(ap.day) + '에 승인했습니다. 레이더의 이후 예상 곡선이 <b>' + ap.shape + '</b> 흐름으로 바뀌었습니다.</p>';
      actions = '<button type="button" class="linkbtn" data-act="appr-undo:' + key + '">' + U.icon('undo', 16) + '되돌리기</button>';
    } else if (!mismatch) {
      verdict = '<p class="verdict__big">보정이 필요하지 않습니다</p><p>레이더가 예상한 <b>' + d.scn.radarShape + '</b>과 매장 반응(' + cls.type + ')이 맞습니다.</p>';
    } else {
      verdict = '<p class="verdict__big">' + (deferred ? '보정 보류 중' : '보정을 검토하세요') + '</p><p>레이더는 <b>' + d.scn.radarShape + '</b>으로 봤지만, 매장 반응은 <b>' + cls.type + '</b>에 가깝습니다.</p>';
      actions = deferred ? '<button type="button" class="linkbtn" data-act="appr-undo:' + key + '">' + U.icon('undo', 16) + '보류 취소</button>' :
        '<button type="button" class="btn btn--primary" data-act="radar-approve">' + cls.type + '으로 보정 승인</button><button type="button" class="btn btn--quiet" data-act="radar-defer">보류</button>';
    }
    var facts = '<dl class="facts"><div><dt>레이더 예상 유형</dt><dd>' + d.scn.radarShape + '</dd></div><div><dt>매장 반응 유형</dt><dd>' + cls.type + '</dd></div><div><dt>정점</dt><dd class="num">' + U.dLabel(cls.peakDay) + ', ' + U.pct(cls.peakVal) + '</dd></div>' +
      '<div><dt>정점 대비 지금</dt><dd class="num">' + (cls.peakVal > 0.02 ? U.pct(actual[D] / cls.peakVal - 1) : '해당 없음') + '</dd></div><div><dt>근거 일수</dt><dd class="num">' + cls.days + '일</dd></div><div><dt>신뢰도</dt><dd>' + cls.conf + '</dd></div></dl>';
    return head('레이더 보정', '레이더가 예상한 흐름과 매장 반응이 맞나요?') +
      '<section class="split split--radar"><div>' + U.chartBox('radar', svg, readoutDay(c, D) + ' 실제 <b>' + U.pct(actual[D]) + '</b>, 예상 ' + U.pct(base[D]), { setDay: true }) +
      '<p class="chart-note">점선은 예상, 실선은 실제입니다. 실제 선은 오늘까지만 그립니다.</p></div>' +
      '<div class="verdict">' + verdict + (gap == null ? '' : '<dl class="bigfig bigfig--sm"><dt>예상 대비 실제 (오늘까지 누적)</dt><dd class="num">' + U.pct(gap) + '</dd><dd class="bigfig__note">오늘 값만 보면 실제 ' + U.pct(actual[D]) + ', 예상 ' + U.pct(base[D]) + '으로 ' + Math.abs(Math.round((actual[D] - base[D]) * 100)) + '%p ' + (actual[D] >= base[D] ? '높습니다' : '낮습니다') + '. 누적은 초반 값의 영향을 크게 받습니다.</dd></dl>') + (actions ? '<div class="verdict__actions">' + actions + '</div>' : '') + '</div></section>' +
      '<section class="block"><h2>판정 근거</h2>' + facts + '</section>' +
      '<details class="how"><summary>판정 규칙</summary><p>단발형은 출시 후 6일 안에 정점을 찍고 정점의 65% 아래로 내려온 경우, 완만형은 정점이 5일째 이후이고 8일 이상 지켜본 경우, 반복형은 정점의 절반 아래로 식은 뒤 다시 0.2 이상 오른 경우입니다. 근거 일수가 4일 미만이면 판정하지 않고, 7일 미만은 신뢰도를 낮음, 14일 미만은 중간으로 표시합니다. 레이더 예상 곡선은 합성 값입니다.</p></details>' +
      basis('약함', '이 기능은 공개 근거를 찾지 못한 우리 팀의 가설입니다. 레이더 판정과 매장 반응이 어긋날 때 사람이 보정을 승인하는 흐름을 보여 주는 시연입니다.');
  };

  /* ---------- 5. 프라이버시 ---------- */
  var STEPS = [
    { t: '프레임 읽기', n: '카메라가 영상을 매장 엣지 PC로 보냅니다. 본사로는 아무것도 가지 않습니다.', hq: '없음', store: '프레임 1장(메모리)' },
    { t: '사람 위치만 찾기', n: '엣지 PC가 프레임에서 사람의 위치만 찾습니다. 얼굴을 식별하지 않고, 사진도 잘라 두지 않습니다.', hq: '없음', store: '위치 좌표(메모리)' },
    { t: '존 단위로 합산', n: '위치를 입구, 쇼케이스, POP, 계산대 같은 존의 진입, 이탈, 체류 이벤트로 바꿉니다.', hq: '없음', store: '존 이벤트(메모리)' },
    { t: '프레임 폐기, 집계 전송', n: '프레임과 위치는 버리고, 집계된 이벤트만 본사로 보냅니다. 영상은 저장하지 않습니다.', hq: '집계 이벤트', store: '없음' }
  ];
  var EXTRA = [
    { k: 'emb', label: '얼굴 특징값(임베딩)', field: '"face_embedding": [0.12, 0.88, ...]' },
    { k: 'pid', label: '영구 고객 ID', field: '"customer_id": "c-90417"' },
    { k: 'frm', label: '영상 프레임', field: '"frame_jpeg": "/9j/4AAQ..."' },
    { k: 'xy', label: '개인별 이동 좌표', field: '"path_xy": [[1.2, 3.4], [1.3, 3.5]]' }
  ];
  V.privacy = function (c) {
    var q = c.q, step = Math.min(4, Math.max(1, parseInt(q.step, 10) || 4));
    var picked = (q.x || '').split(',').filter(Boolean);
    var S = STEPS[step - 1];
    var on = function (cond) { return cond ? ' is-on' : ''; };
    var dg = '<svg class="diagram" viewBox="0 0 880 200" role="img" aria-label="데이터 흐름도. 매장 카메라에서 매장 엣지 PC로 영상이 가고, 엣지 PC에서 본사 서버로는 집계 이벤트만 갑니다. 현재 ' + step + '단계 ' + S.t + '">' +
      '<g class="dg-box' + on(step === 1) + '"><rect x="8" y="40" width="240" height="120" rx="8"/><text x="128" y="92" text-anchor="middle" class="dg-t">매장 카메라</text><text x="128" y="118" text-anchor="middle" class="dg-s">영상 프레임</text></g>' +
      '<g class="dg-arrow' + on(step === 1) + '"><line x1="252" x2="310" y1="100" y2="100"/><path d="M304 94l8 6-8 6"/><text x="282" y="86" text-anchor="middle" class="dg-s">영상</text></g>' +
      '<g class="dg-box dg-box--edge' + on(step >= 2 && step <= 4) + '"><rect x="316" y="24" width="248" height="152" rx="8"/><text x="440" y="76" text-anchor="middle" class="dg-t">매장 엣지 PC</text><text x="440" y="102" text-anchor="middle" class="dg-s">메모리에서 한 장씩 처리</text><text x="440" y="128" text-anchor="middle" class="dg-s">저장하지 않음</text></g>' +
      '<g class="dg-arrow' + on(step === 4) + '"><line x1="568" x2="626" y1="100" y2="100"/><path d="M620 94l8 6-8 6"/><text x="598" y="86" text-anchor="middle" class="dg-s">집계</text></g>' +
      '<g class="dg-box' + on(step === 4) + '"><rect x="632" y="40" width="240" height="120" rx="8"/><text x="752" y="92" text-anchor="middle" class="dg-t">본사 서버</text><text x="752" y="118" text-anchor="middle" class="dg-s">집계 이벤트만 수신</text></g></svg>';
    var stepper = '<ol class="stepper">' + STEPS.map(function (s, i) {
      return '<li><button type="button" class="stepper__btn" data-q="step=' + (i + 1) + '" aria-current="' + (i + 1 === step ? 'step' : 'false') + '"><span class="num">' + (i + 1) + '</span>' + s.t + '</button></li>';
    }).join('') + '</ol>';
    var sample = ['"event_id": "e-000183"', '"store_id": "s03"', '"zone_id": "showcase_new"', '"event_type": "dwell"', '"ts_start": "2026-09-30T14:02:10+09:00"', '"ts_end": "2026-09-30T14:02:31+09:00"', '"dwell_sec": 21', '"track_ref": "9f3a1c"'];
    var extra = EXTRA.filter(function (e) { return picked.indexOf(e.k) >= 0; });
    var json = '{\n' + sample.concat(extra.map(function (e) { return e.field; })).map(function (l) { return '  ' + l; }).join(',\n') + '\n}';
    var verdict = extra.length ?
      '<p class="check check--no" role="status"><b>수신 거부.</b> ' + extra.map(function (e) { return U.esc(e.label); }).join(', ') + ' 필드는 허용 목록에 없습니다. 스키마에 정의된 필드만 받습니다.</p>' :
      '<p class="check check--ok" role="status"><b>수신 가능.</b> 정의된 필드만 들어 있습니다. 영상, 얼굴, 영구 ID를 담을 자리가 스키마에 없습니다.</p>';
    var boxes = EXTRA.map(function (e) {
      var ck = picked.indexOf(e.k) >= 0, next = ck ? picked.filter(function (x) { return x !== e.k; }) : picked.concat(e.k);
      return '<label class="check-opt"><input type="checkbox" data-q-check="x=' + next.join(',') + '"' + (ck ? ' checked' : '') + '>' + U.esc(e.label) + '</label>';
    }).join('');
    return head('프라이버시 설계', '카메라 영상은 어디까지 가고, 본사에는 무엇이 도착하나요?') +
      '<section class="block block--tight"><h2>데이터가 움직이는 길</h2>' + dg + stepper +
      '<p class="step-note" aria-live="polite"><b>' + step + '단계, ' + S.t + '.</b> ' + S.n + '</p>' +
      '<dl class="facts facts--2"><div><dt>이 순간 매장에 있는 것</dt><dd>' + S.store + '</dd></div><div><dt>이 순간 본사에 도착한 것</dt><dd>' + S.hq + '</dd></div></dl></section>' +
      '<section class="block"><h2>들어오는 것과 들어오지 않는 것</h2><div class="twolist"><div><h3>본사에 도착하는 것</h3><ul><li>존 진입과 이탈 횟수</li><li>존 체류 시간(집계)</li><li>시각과 매장, 존 이름</li></ul></div><div><h3>도착하지 않는 것</h3><ul><li>영상과 사진, 사람을 잘라낸 이미지</li><li>얼굴 특징값과 영구 ID</li><li>개인별 이동 경로</li></ul></div></div></section>' +
      '<section class="block"><h2>이벤트 검사기</h2><p class="lead-line">이벤트에 아래 필드를 넣어 보세요. 설계 규칙이 어떻게 막는지 보여 주는 시연이며, 서버에 아무것도 보내지 않습니다.</p>' +
      '<div class="split split--check"><div class="opts" role="group" aria-label="추가해 볼 필드">' + boxes + '</div><div><pre class="code" tabindex="0" aria-label="이벤트 예시"><code>' + U.esc(json) + '</code></pre>' + verdict + '</div></div></section>' +
      '<details class="how"><summary>법적 근거와 확인이 필요한 것</summary><p>근거: 개인정보 보호법 제25조제1항 제6호와 시행령 제22조(2023년 9월 신설). 영상을 저장하지 않고 통계값을 만드는 경우 고정형 영상정보처리기기를 설치할 수 있다고 정합니다. 2024년 12월 개인정보보호위원회 안내서도 같은 취지입니다(교육청 사본으로 확인, 원본 확인 필요).</p><ul><li>개인 단위 동선과 체류시간이 "통계값 산출" 예외에 포함되는지</li><li>매장 보안 CCTV와 분석용 카메라를 같은 장비로 쓸 때의 목적 외 이용</li><li>협업사와의 위탁 또는 제3자 제공 구조</li><li>통계 목적 예외 장비도 안내판이 필요한지</li></ul><p>법률 자문이 아닙니다. 실제 도입 전에 개인정보위 상담(182)이나 법무 검토가 필요합니다.</p></details>' +
      basis('강함', '법규 근거는 시행령과 안내서 문구를 직접 확인했습니다. 연령·성별 추정은 이 설계에서 개인 단위가 아니라 구간 집계로만 다루며, 켜기 전에 법적 확인이 필요합니다.');
  };

  /* ---------- 6. 유형별 반응 속도 ---------- */
  V.types = function (c) {
    var d = c.data, D = c.D, st = BR.typeStats(d, D);
    var ordered = st.slice().sort(function (a, b) { return (b.reached ? 1 : 0) - (a.reached ? 1 : 0) || a.peakDay - b.peakDay || b.peak - a.peak; });
    var sel = c.q.sel && BR.TYPES.indexOf(c.q.sel) >= 0 ? c.q.sel : ordered[0].type;
    var all = []; st.forEach(function (t) { all = all.concat(t.series); });
    var range = niceRange(all, 0.4);
    var series = st.filter(function (t) { return t.type !== sel; }).map(function (t) { return { pts: t.series, cls: 'ch-line--ctx', label: t.type, labelCls: 'is-ctx' }; });
    var cur = st.filter(function (t) { return t.type === sel; })[0];
    series.push({ pts: cur.series, cls: 'ch-line--main', label: cur.type, dot: true, labelCls: 'is-main' });
    var svg = U.lineChart({
      id: 'types', w: 1080, h: 380, xMax: BR.DAYS, yMin: range.min, yMax: range.max, yTicks: range.ticks, yFmt: function (t) { return U.pct(t); },
      xTicks: [0, 7, 14, 21, 28], day: D, rightPad: 64, series: series, aria: '상권 유형별 반응 변화율 비교',
      readout: function (day) {
        return day > D ? readoutDay(c, day) + ' 아직 오지 않은 날입니다' :
          readoutDay(c, day) + ' ' + st.map(function (t) { return t.type + ' ' + (t.type === sel ? '<b>' + U.pct(t.series[day]) + '</b>' : U.pct(t.series[day])); }).join(', ');
      }
    });
    var tabs = seg('강조할 유형', BR.TYPES.map(function (t) { return { v: t, label: t, q: 'sel=' + t }; }), sel);
    var body = ordered.map(function (t) {
      var isSel = t.type === sel;
      return '<tr class="' + (isSel ? 'is-sel' : '') + '"><th scope="row">' + U.esc(t.type) + '</th><td class="num">' + t.n + '곳</td><td class="num">' + (t.reached ? U.dLabel(t.peakDay) : '진행 중') + '</td><td class="num">' + U.pct(t.peak) + '</td><td class="num">' + U.pct(t.now) + '</td><td class="num">' + (t.retain == null ? '<span class="muted">D+14 이후</span>' : Math.round(t.retain * 100) + '%') + '</td></tr>';
    }).join('');
    var fast = ordered[0].reached ? '<b>' + ordered[0].type + '</b> 매장이 정점에 가장 빨리 도달했습니다(' + U.dLabel(ordered[0].peakDay) + ', ' + U.pct(ordered[0].peak) + ').' : '아직 정점에 도달한 유형이 없습니다. 반응이 더 지켜봐야 합니다.';
    return head('유형별 반응 속도', '어떤 상권의 매장이 가장 빨리 반응하나요?', tabs) +
      '<p class="lead-line">' + fast + ' 반응이 빠른 유형의 매장부터 발주와 노출을 판단하면 됩니다.</p>' +
      U.chartBox('types', svg, readoutDay(c, D) + ' ' + cur.type + ' <b>' + U.pct(cur.now) + '</b>', { setDay: true }) +
      '<section class="block"><h2>유형별 비교</h2><div class="tablewrap"><table class="tbl"><thead><tr><th scope="col">유형</th><th scope="col" class="num">매장 수</th><th scope="col" class="num">정점 도달</th><th scope="col" class="num">정점</th><th scope="col" class="num">지금</th><th scope="col" class="num">정점 대비 D+14</th></tr></thead><tbody>' + body + '</tbody></table></div></section>' +
      basis('약함', '유형별 반응 속도 비교는 공개 사례나 논문을 찾지 못한 우리 팀의 가설입니다. 합성 데이터에서 유형별 속도 차이를 일부러 넣었으므로, 실제 매장에서도 같은 차이가 나는지는 실측해야 압니다.');
  };

  /* ---------- 7. 순위 급변 ---------- */
  V.ranks = function (c) {
    var d = c.data, D = c.D, q = c.q;
    var thr = Math.min(10, Math.max(2, parseInt(q.thr, 10) || 5)), gap = [1, 3, 7].indexOf(parseInt(q.gap, 10)) >= 0 ? parseInt(q.gap, 10) : 3;
    var rows = BR.movers(d, D, thr, gap).sort(function (a, b) { return a.now - b.now; });
    var alerts = rows.filter(function (r) { return r.alert; }).sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
    var up = alerts.filter(function (r) { return r.delta > 0; }).length, down = alerts.length - up;
    var ctl = '<div class="toolrow">' + seg('비교 시점', [{ v: 1, label: '하루 전', q: 'gap=1' }, { v: 3, label: '3일 전', q: 'gap=3' }, { v: 7, label: '7일 전', q: 'gap=7' }], gap) +
      '<div class="stepper-num" role="group" aria-label="급변 기준"><span class="stepper-num__l">급변 기준</span><button type="button" class="iconbtn" data-q="thr=' + Math.max(2, thr - 1) + '" aria-label="기준 낮추기"' + (thr <= 2 ? ' disabled aria-disabled="true"' : '') + '>' + U.icon('minus', 16) + '</button><output class="num">' + thr + '계단</output><button type="button" class="iconbtn" data-q="thr=' + Math.min(10, thr + 1) + '" aria-label="기준 높이기"' + (thr >= 10 ? ' disabled aria-disabled="true"' : '') + '>' + U.icon('plus', 16) + '</button></div></div>';
    var list;
    if (D < gap) list = U.empty('비교할 날이 아직 없습니다', '출시 후 ' + gap + '일째부터 ' + gap + '일 전과 비교할 수 있습니다.', '하루 전과 비교', 'q:gap=1');
    else if (!alerts.length) list = U.empty('기준을 넘은 매장이 없습니다', gap + '일 전과 비교해 순위가 ' + thr + '계단 이상 움직이고 전체 흐름과 다르게 달라진 매장이 없습니다.', thr > 3 ? '기준을 3계단으로 낮추기' : null, 'q:thr=3');
    else list = '<ul class="alerts">' + alerts.map(function (r) {
      return '<li class="alert ' + (r.delta > 0 ? 'is-up' : 'is-down') + '"><div class="alert__top"><b>' + U.esc(r.st.name) + '</b>' + U.chip(r.delta > 0 ? '급등' : '급락', r.delta > 0 ? 'ink' : 'alert') + '<span class="num alert__move">' + r.before + '위에서 ' + r.now + '위로 (' + Math.abs(r.delta) + '계단)</span></div><p>' + r.cause + '</p></li>';
    }).join('') + '</ul>';
    var maxR = 0; rows.forEach(function (r) { maxR = Math.max(maxR, r.trail.length); });
    var table = rows.map(function (r) {
      return '<tr class="' + (r.alert ? 'is-flag' : '') + '"><td class="num rank">' + r.now + '</td><th scope="row">' + U.esc(r.st.name) + '</th><td>' + U.esc(r.st.type) + '</td><td class="num">' + (r.before == null ? '<span class="muted">해당 없음</span>' : r.before + '위') + '</td>' +
        '<td class="num">' + (r.before == null ? '' : r.delta === 0 ? '0' : (r.alert ? '<b>' : '') + U.signed(r.delta) + (r.alert ? '</b>' : '')) + '</td><td class="num">' + U.pct(r.react) + '</td><td>' + U.spark(r.trail, { invert: true, min: 1, max: 20, cls: r.alert ? 'spark--main' : 'spark--ctx' }) + '</td></tr>';
    }).join('');
    return head('순위 급변', '어제와 달라진 매장은 어디인가요?', ctl) +
      '<section class="block block--tight"><h2>급변 알림 <span class="count num">급등 ' + up + '곳, 급락 ' + down + '곳</span></h2>' + list + '</section>' +
      '<section class="block"><h2>전체 순위</h2><div class="tablewrap"><table class="tbl"><thead><tr><th scope="col" class="num">순위</th><th scope="col">매장</th><th scope="col">유형</th><th scope="col" class="num">' + gap + '일 전</th><th scope="col" class="num">변동</th><th scope="col" class="num">반응</th><th scope="col">최근 14일 순위</th></tr></thead><tbody>' + table + '</tbody></table></div></section>' +
      '<details class="how"><summary>급변 기준</summary><p>순위는 최근 3일 평균 반응으로 매겨 하루 노이즈에 흔들리지 않게 했습니다. 순위가 기준 이상 움직였고, 전체 흐름을 뺀 그 매장 고유의 반응도 25%p 이상 달라졌을 때만 알립니다. 비슷한 반응끼리 자리만 바꾸는 경우와 전체가 함께 식는 경우는 알리지 않습니다. 원인 문구는 재고와 방문 변화로 추정한 힌트이며 확정이 아닙니다.</p></details>' +
      basis('약함', '카메라 데이터로 순위 급변을 탐지한 공개 사례나 논문을 찾지 못했습니다. 우리 팀의 가설이며, 합성 데이터에서 현장 행사와 재고 소진 충격을 넣어 시연합니다.');
  };

  root.Views = V;
})(window);
