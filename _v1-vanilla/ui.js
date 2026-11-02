/* 화면 공통 도구: 포맷, 인라인 SVG 차트, 아이콘, 상태 블록. 색은 전부 CSS 토큰으로 칠하고 여기서는 클래스만 붙인다. */
(function (root) {
  'use strict';
  var BR = root.BR;
  var U = { charts: {} };

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };

  var MINUS = '−';
  U.pct = function (v, digits) {
    var k = Math.pow(10, digits || 0), n = Math.round(v * 100 * k) / k;
    var sign = n > 0 ? '+' : n < 0 ? MINUS : '';
    return sign + Math.abs(n).toFixed(digits || 0) + '%';
  };
  U.signed = function (n) { return n > 0 ? '+' + n : n < 0 ? MINUS + Math.abs(n) : '0'; };
  U.num = function (n) { return Math.round(n).toLocaleString('ko-KR'); };
  U.dLabel = function (d) { return 'D+' + d; };
  var WD = ['월', '화', '수', '목', '금', '토', '일'];
  U.dateLabel = function (data, d) {
    var info = data.days[d];
    return (info.date.getMonth() + 1) + '월 ' + info.date.getDate() + '일 (' + WD[info.dow] + ')';
  };

  var ICONS = {
    play: '<path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5.5v13M16 5.5v13" />',
    menu: '<path d="M4 7h16M4 12h16M4 17h16" />',
    close: '<path d="M6 6l12 12M18 6L6 18" />',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" />',
    down: '<path d="M6 9.5l6 6 6-6" />',
    right: '<path d="M9.5 6l6 6-6 6" />',
    minus: '<path d="M6 12h12" />',
    plus: '<path d="M12 6v12M6 12h12" />',
    undo: '<path d="M9 7L4.5 11.5 9 16M5 11.5h9a5 5 0 010 10h-2" />'
  };
  U.icon = function (name, size) {
    var s = size || 18;
    return '<svg class="icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  };

  /* 선 차트. o: {id, w, h, xMax, yMin, yMax, yTicks[], yFmt, xTicks[], series[], band, day, refs[], rightPad, aria}
   * series[i]: {pts:[v|null ...] (index = day), cls, label, labelDy} */
  U.lineChart = function (o) {
    var W = o.w || 720, H = o.h || 300;
    var m = { l: 48, r: o.rightPad == null ? 76 : o.rightPad, t: 24, b: 34 };
    var x0 = m.l, x1 = W - m.r, y0 = H - m.b, y1 = m.t;
    var xs = function (d) { return x0 + (x1 - x0) * d / o.xMax; };
    var ys = function (v) { return y0 - (y0 - y1) * (v - o.yMin) / (o.yMax - o.yMin); };
    var f = function (n) { return Math.round(n * 10) / 10; };
    var out = '<svg class="chart__svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + U.esc(o.aria || '') + '" data-x0="' + x0 + '" data-x1="' + x1 + '" data-w="' + W + '" data-max="' + o.xMax + '">';
    // 가로 격자
    (o.yTicks || []).forEach(function (t) {
      out += '<line class="ch-grid' + (t === 0 ? ' ch-grid--zero' : '') + '" x1="' + x0 + '" x2="' + x1 + '" y1="' + f(ys(t)) + '" y2="' + f(ys(t)) + '"/>';
      out += '<text class="ch-tick" x="' + (x0 - 8) + '" y="' + f(ys(t) + 4) + '" text-anchor="end">' + U.esc(o.yFmt ? o.yFmt(t) : t) + '</text>';
    });
    (o.xTicks || []).forEach(function (t) {
      out += '<text class="ch-tick" x="' + f(xs(t)) + '" y="' + (y0 + 22) + '" text-anchor="middle">D+' + t + '</text>';
    });
    // 밴드 (최소~최대 또는 사분위)
    if (o.band) {
      var top = '', bot = '';
      for (var i = 0; i < o.band.hi.length; i++) {
        top += (i ? 'L' : 'M') + f(xs(i)) + ' ' + f(ys(o.band.hi[i]));
      }
      for (var j = o.band.lo.length - 1; j >= 0; j--) bot += 'L' + f(xs(j)) + ' ' + f(ys(o.band.lo[j]));
      out += '<path class="ch-band" d="' + top + bot + 'Z"/>';
    }
    // 세로 기준선 (기존 확인 시점 등)
    (o.refs || []).forEach(function (r) {
      out += '<line class="ch-ref" x1="' + f(xs(r.x)) + '" x2="' + f(xs(r.x)) + '" y1="' + y1 + '" y2="' + y0 + '"/>';
      out += '<text class="ch-ref-text" x="' + f(xs(r.x) + 6) + '" y="' + (y1 + 12) + '">' + U.esc(r.label) + '</text>';
    });
    // 시리즈
    var labels = [];
    (o.series || []).forEach(function (s) {
      var d = '', started = false;
      s.pts.forEach(function (v, k) {
        if (v == null) return;
        d += (started ? 'L' : 'M') + f(xs(k)) + ' ' + f(ys(Math.max(o.yMin, Math.min(o.yMax, v))));
        started = true;
      });
      if (!d) return;
      out += '<path class="ch-line ' + (s.cls || '') + '" d="' + d + '"/>';
      var last = -1;
      s.pts.forEach(function (v, k) { if (v != null) last = k; });
      if (s.label && last >= 0) {
        labels.push({ x: xs(last) + 8, y: ys(Math.max(o.yMin, Math.min(o.yMax, s.pts[last]))) + (s.labelDy || 0) + 4, text: s.label, cls: s.labelCls || '' });
      }
      if (s.dot && last >= 0) {
        out += '<circle class="ch-dot ' + (s.cls || '') + '" cx="' + f(xs(last)) + '" cy="' + f(ys(Math.max(o.yMin, Math.min(o.yMax, s.pts[last])))) + '" r="4.5"/>';
      }
    });
    // 끝 라벨이 겹치지 않게 위에서부터 15px 이상 벌린다
    labels.sort(function (a, b) { return a.y - b.y; });
    labels.forEach(function (l, i) { if (i && l.y - labels[i - 1].y < 15) l.y = labels[i - 1].y + 15; });
    labels.forEach(function (l) {
      out += '<text class="ch-label ' + l.cls + '" x="' + f(l.x) + '" y="' + f(l.y) + '">' + U.esc(l.text) + '</text>';
    });
    // 오늘 표시
    if (o.day != null) {
      out += '<line class="ch-day" x1="' + f(xs(o.day)) + '" x2="' + f(xs(o.day)) + '" y1="' + y1 + '" y2="' + y0 + '"/>';
    }
    (o.ticks || []).forEach(function (t) { // 신호가 켜진 날: 가로축 위의 짧은 표시
      out += '<line class="ch-sig" x1="' + f(xs(t)) + '" x2="' + f(xs(t)) + '" y1="' + (y0 - 9) + '" y2="' + y0 + '"/>';
    });
    out += '<line class="ch-cross" x1="0" x2="0" y1="' + y1 + '" y2="' + y0 + '" hidden/>';
    out += '</svg>';
    U.charts[o.id] = { x0: x0, x1: x1, w: W, max: o.xMax, xs: xs, fn: o.readout };
    return out;
  };

  U.chartBox = function (id, svg, readoutText, opts) {
    opts = opts || {};
    return '<div class="chart" data-chart="' + id + '"' + (opts.setDay ? ' data-setday' : '') + ' tabindex="0" role="group" aria-label="' + U.esc(opts.aria || '차트, 방향키로 날짜를 옮겨 값을 읽습니다') + '">' +
      '<p class="chart__readout" aria-live="polite">' + readoutText + '</p>' + svg + '</div>';
  };

  /* 작은 추세선. invert면 값이 작을수록 위 (순위). */
  U.spark = function (vals, o) {
    o = o || {};
    var W = o.w || 96, H = o.h || 28, pad = 3;
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (o.min != null) min = o.min;
    if (o.max != null) max = o.max;
    if (max === min) { max += 1; min -= 1; }
    var d = '';
    vals.forEach(function (v, i) {
      var x = pad + (W - 2 * pad) * (vals.length === 1 ? 1 : i / (vals.length - 1));
      var t = (v - min) / (max - min);
      var y = o.invert ? pad + (H - 2 * pad) * t : H - pad - (H - 2 * pad) * t;
      d += (i ? 'L' : 'M') + Math.round(x * 10) / 10 + ' ' + Math.round(y * 10) / 10;
    });
    return '<svg class="spark' + (o.cls ? ' ' + o.cls : '') + '" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + d + '"/></svg>';
  };

  /* 0을 가운데 두는 막대 (표 안에서 변화율을 한눈에). v는 비율, range는 한쪽 끝 값. */
  U.zbar = function (v, range) {
    var w = Math.min(50, Math.abs(v) / range * 50);
    return '<span class="zbar" aria-hidden="true"><i class="zbar__fill ' + (v >= 0 ? 'is-up' : 'is-down') + '" style="inline-size:' + w.toFixed(1) + '%"></i></span>';
  };

  U.chip = function (text, tone) { return '<span class="chip' + (tone ? ' chip--' + tone : '') + '">' + U.esc(text) + '</span>'; };

  U.skeleton = function (kind) {
    var rows = '';
    for (var i = 0; i < 6; i++) rows += '<div class="sk sk--row"></div>';
    return '<div class="state state--loading" role="status" aria-live="polite"><span class="visually-hidden">불러오는 중</span>' +
      '<div class="sk sk--title"></div><div class="sk sk--line"></div>' +
      (kind === 'chart' ? '<div class="sk sk--chart"></div>' : '') + rows + '</div>';
  };
  U.empty = function (title, why, actionLabel, action) {
    return '<div class="state state--empty"><p class="state__t">' + U.esc(title) + '</p><p>' + U.esc(why) + '</p>' +
      (actionLabel ? '<button type="button" class="btn btn--quiet" data-act="' + U.esc(action) + '">' + U.esc(actionLabel) + '</button>' : '') + '</div>';
  };
  U.error = function (what, action) {
    return '<div class="state state--error" role="alert"><p class="state__t">' + U.esc(what) + '</p><p>화면을 그리는 중 문제가 생겼습니다. 다시 시도해도 같으면 합성 데이터 생성 단계(data.js)를 확인하세요.</p>' +
      '<button type="button" class="btn btn--quiet" data-act="' + U.esc(action || 'retry') + '">다시 시도</button></div>';
  };

  root.UI = U;
})(window);
