/** 주간 맛 트렌드 리포트 PDF. 화면과 같은 색 토큰(index.css 라이트 테마)으로 jsPDF에 직접 그린다 */
import type { jsPDF } from 'jspdf'
import type { TimingVerdict, TrendStatus } from './flavor-trends'

export interface ReportRow { kw: string; type: string; prob: number; weekly: number; action: string; candidate: boolean }
/** peakIn: 반복형 기준 재료의 정점까지 남은 주 (flavor-trends.ts 의 timingOf 결과 그대로, 반복형이 아니면 null) */
export interface ReportTrend { rank: number; name: string; status: TrendStatus; index: number; verdict: TimingVerdict; verdictLabel: string; peakIn: number | null; color: string; rows: ReportRow[] }
export interface ReportData { dataDate: string; source: string; horizon: number; sale: number; trends: ReportTrend[]; createdAt: Date }

const FONT = 'Pretendard'
/** PDF 기본 폰트에는 한글이 없어 앱과 같은 Pretendard를 넣는다 */
export function registerFonts(doc: jsPDF, regular: string, bold: string) {
  doc.addFileToVFS('Pretendard-Regular.ttf', regular)
  doc.addFont('Pretendard-Regular.ttf', FONT, 'normal')
  doc.addFileToVFS('Pretendard-Bold.ttf', bold)
  doc.addFont('Pretendard-Bold.ttf', FONT, 'bold')
}

const C = { primary: '#8a1f55', accent: '#fbeef4', pick: '#b5487a', muted: '#f1f1f8', border: '#e2e2ee', line: '#c9c9d8', fg: '#0d0d12', sub: '#62627a', white: '#ffffff', blush: '#f7cbdd' }
/** 상태 칩: 화면 목록의 STATUS_STYLE과 같은 색 [배경, 글자] */
const STATUS: Record<TrendStatus, [string, string]> = {
  '뜨는 중': ['#d3e3f3', '#075985'], 정점: ['#f7cbdd', C.primary], 스테디: ['#ead7bf', '#7a4f1f'], 하락: ['#e6dcf2', '#5b21b6'],
}
/** 출시 판단 태그 [배경, 글자, 테두리]: 지금 출시만 꽉 찬 브랜드색 */
const VERDICT: Record<TimingVerdict, [string | null, string, string | null]> = {
  지금: [C.primary, C.white, null], 선점: [C.accent, C.primary, C.pick], 관찰: [C.muted, C.sub, null], 늦음: [null, C.sub, C.line],
}

const VERDICT_NAME: Record<TimingVerdict, string> = { 지금: '지금 출시', 선점: '아직 이름', 관찰: '지켜보기', 늦음: '이번엔 늦음' }

const PW = 210, PH = 297, M = 14, CW = PW - M * 2, FOOT = PH - 11
/** 카드 안쪽 여백, 표 머리 높이, 표 한 줄 높이 (mm) */
const P = 5, HEAD = 6.5, ROW = 7
const PT = 0.3528
const p2 = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) => `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
const cardHeight = (t: ReportTrend) => 27.5 + HEAD + t.rows.length * ROW + 3.5
/** 카드에 쓰는 판단 이유. timingOf 와 같은 규칙을 리포트용 짧은 문장(해요체 없이)으로 옮긴다 */
const reasonOf = (t: ReportTrend, h: number, sale: number) => {
  const p = t.peakIn
  if (p != null) {
    const tail = t.verdict === '지금' ? `판매 ${sale}주 안에 정점 도래` : t.verdict === '선점' ? `${p - h - sale}~${p - h}주 뒤 개발 시작, ${p - sale}~${p}주 뒤 출시` : '출시 전에 정점이 지나 다음 시즌 겨냥'
    return `정점까지 약 ${p}주 · ${tail}`
  }
  if (t.verdict === '지금') return `${h}주 뒤 출시 시점에도 수요가 남을 전망`
  if (t.verdict === '관찰') return '아직 판단하기 이름 · 4주 더 지켜보기'
  return `${h}주 개발하면 수요가 식을 가능성이 높음`
}

type TextOpt = { size: number; bold?: boolean; color?: string; align?: 'left' | 'center' | 'right' }

export function drawReport(doc: jsPDF, d: ReportData) {
  const font = (size: number, bold = false) => { doc.setFont(FONT, bold ? 'bold' : 'normal'); doc.setFontSize(size) }
  const width = (s: string, size: number, bold = false) => { font(size, bold); return doc.getTextWidth(s) }
  const text = (s: string, x: number, y: number, o: TextOpt) => {
    font(o.size, o.bold); doc.setTextColor(o.color ?? C.fg)
    doc.text(s, x, y, { align: o.align ?? 'left', baseline: 'middle' })
  }
  /** 칸보다 길면 말줄임 */
  const fit = (s: string, w: number, size: number, bold = false) => {
    if (width(s, size, bold) <= w) return s
    let t = s
    while (t && width(t + '…', size, bold) > w) t = t.slice(0, -1)
    return t + '…'
  }
  const chip = (s: string, x: number, cy: number, o: { bg: string | null; fg: string; border?: string | null; size: number; align?: 'left' | 'right'; pad?: number }) => {
    const w = width(s, o.size, true) + (o.pad ?? 2.4) * 2, h = o.size * PT * 1.8
    const left = o.align === 'right' ? x - w : x
    doc.setLineWidth(0.3)
    if (o.bg) doc.setFillColor(o.bg)
    if (o.border) doc.setDrawColor(o.border)
    doc.roundedRect(left, cy - h / 2, w, h, h / 2, h / 2, o.bg && o.border ? 'FD' : o.bg ? 'F' : 'S')
    text(s, left + w / 2, cy, { size: o.size, bold: true, color: o.fg, align: 'center' })
    return w
  }
  const bar = (x: number, cy: number, w: number, h: number, ratio: number, color: string) => {
    doc.setFillColor(C.muted); doc.roundedRect(x, cy - h / 2, w, h, h / 2, h / 2, 'F')
    const r = Math.min(1, Math.max(0, ratio))
    if (r > 0) { doc.setFillColor(color); doc.roundedRect(x, cy - h / 2, Math.max(h, w * r), h, h / 2, h / 2, 'F') }
  }

  /** 첫 장 머리: 제목 띠, 데이터 기준일, 출처 */
  const cover = () => {
    const y = M, h = 34
    doc.setFillColor(C.primary); doc.roundedRect(M, y, CW, h, 4, 4, 'F')
    text('신제품 기획팀 · 주간 공유', M + 8, y + 9, { size: 8.5, color: C.blush })
    text('주간 맛 트렌드 리포트', M + 8, y + 19, { size: 21, bold: true, color: C.white })
    text(`지금 뜨는 맛이 ${d.horizon}주 뒤 출시 시점에도 남을지 예측해 우선순위로 정리`, M + 8, y + 27.5, { size: 8.5, color: C.blush })
    text('데이터 기준일', M + CW - 8, y + 11, { size: 8, color: C.blush, align: 'right' })
    text(d.dataDate, M + CW - 8, y + 20, { size: 18, bold: true, color: C.white, align: 'right' })
    let sy = y + h + 6
    text('출처', M, sy, { size: 8, bold: true, color: C.primary })
    font(8.5)
    const lines: string[] = doc.splitTextToSize(d.source, CW - 10)
    lines.forEach((l) => { text(l, M + 10, sy, { size: 8.5, color: C.sub }); sy += 4.3 })
    return sy + 3
  }

  /** 핵심 숫자 카드 4개 */
  const summary = (y: number) => {
    const rows = d.trends.flatMap((t) => t.rows)
    const count = (v: TimingVerdict) => d.trends.filter((t) => t.verdict === v).length
    const items = [
      { label: '이번 주 감지 트렌드', value: d.trends.length, unit: '개' },
      { label: '지금 출시', value: count('지금'), unit: '개', strong: true },
      { label: '아직 이름', value: count('선점'), unit: '개' },
      { label: '이달의 맛 후보 키워드', value: rows.filter((r) => r.candidate).length, unit: `/ ${rows.length}개` },
    ]
    const gap = 4, w = (CW - gap * 3) / 4, h = 22
    items.forEach((it, i) => {
      const x = M + i * (w + gap)
      doc.setFillColor(it.strong ? C.accent : C.muted); doc.roundedRect(x, y, w, h, 3, 3, 'F')
      text(it.label, x + 5, y + 7, { size: 8, color: it.strong ? C.primary : C.sub, bold: !!it.strong })
      const v = String(it.value)
      text(v, x + 5, y + 15.5, { size: 20, bold: true, color: it.strong ? C.primary : C.fg })
      text(it.unit, x + 5 + width(v, 20, true) + 1.2, y + 16.5, { size: 9, color: C.sub })
    })
    return y + h + 9
  }

  const COLS: { label: string; w: number; right?: boolean }[] = [
    { label: '키워드', w: 50 }, { label: '유형', w: 24 }, { label: `${d.horizon}주 생존율`, w: 32, right: true }, { label: '이번 주 검색량', w: 32, right: true }, { label: '권장 액션', w: CW - P * 2 - 138 },
  ]
  const colX = (i: number, x: number) => x + COLS.slice(0, i).reduce((a, c) => a + c.w, 0)

  const table = (rows: ReportRow[], x: number, y: number) => {
    const tw = CW - P * 2
    doc.setFillColor(C.muted); doc.roundedRect(x, y, tw, HEAD, 1.5, 1.5, 'F')
    COLS.forEach((c, i) => {
      const cx = colX(i, x)
      text(c.label, c.right ? cx + c.w - 2.5 : cx + 2.5, y + HEAD / 2, { size: 7.5, bold: true, color: C.sub, align: c.right ? 'right' : 'left' })
    })
    rows.forEach((r, i) => {
      const ry = y + HEAD + i * ROW, mid = ry + ROW / 2
      if (i > 0) { doc.setDrawColor(C.border); doc.setLineWidth(0.2); doc.line(x, ry, x + tw, ry) }
      text(fit(r.kw, COLS[0].w - 4, 9.5, true), colX(0, x) + 2.5, mid, { size: 9.5, bold: true })
      text(r.type, colX(1, x) + 2.5, mid, { size: 9, color: C.sub })
      const px = colX(2, x)
      bar(px + 4, mid, 12, 1.8, r.prob, C.primary)
      text(`${Math.round(r.prob * 100)}%`, px + COLS[2].w - 2.5, mid, { size: 9.5, bold: true, align: 'right' })
      text(`약 ${r.weekly.toLocaleString()}회`, colX(3, x) + COLS[3].w - 2.5, mid, { size: 9.5, align: 'right' })
      const ax = colX(4, x) + 2.5
      if (r.candidate) chip(r.action, ax, mid, { bg: C.accent, fg: C.primary, size: 7.5, pad: 2 })
      else text(r.action, ax, mid, { size: 8.5, color: C.sub })
    })
  }

  const card = (t: ReportTrend, y: number) => {
    const x = M + P, right = M + CW - P
    doc.setDrawColor(C.border); doc.setLineWidth(0.3); doc.setFillColor(C.white)
    doc.roundedRect(M, y, CW, cardHeight(t), 3, 3, 'FD')
    // 1행: 순위, 트렌드명, 상태, 출시 판단
    const r1 = y + 9
    doc.setFillColor(C.primary); doc.circle(x + 4, r1, 4, 'F')
    text(String(t.rank), x + 4, r1, { size: 10, bold: true, color: C.white, align: 'center' })
    const nx = x + 11
    const name = fit(t.name, right - nx - 55, 13, true)
    text(name, nx, r1, { size: 13, bold: true })
    const [sb, sf] = STATUS[t.status]
    chip(t.status, nx + width(name, 13, true) + 3, r1, { bg: sb, fg: sf, size: 7.5, pad: 2 })
    const [vb, vf, vd] = VERDICT[t.verdict]
    chip(t.verdictLabel, right, r1, { bg: vb, fg: vf, border: vd, size: 9, align: 'right', pad: 3.2 })
    // 태그 바로 아래: 이렇게 판단한 이유
    text(fit(reasonOf(t, d.horizon, d.sale), right - x, 8), right, y + 15.5, { size: 8, color: t.verdict === '지금' ? C.primary : C.sub, align: 'right' })
    // 2행: 확산 지수 막대 (색은 화면처럼 트렌드 고유색)
    const r2 = y + 21.5
    text('확산 지수', x, r2, { size: 8, color: C.sub })
    const bx = x + 16, bw = 100
    bar(bx, r2, bw, 2.6, t.index / 100, t.color)
    const v = String(t.index)
    text(v, bx + bw + 3, r2, { size: 10, bold: true })
    text('/ 100', bx + bw + 3 + width(v, 10, true) + 1, r2, { size: 7.5, color: C.sub })
    table(t.rows, x, y + 27.5)
  }

  /** 출시 판단 4가지의 뜻. 순위도 이 순서를 먼저 따른다 (flavor-trends.ts 의 timingOf 규칙) */
  const LEGEND: [TimingVerdict, string][] = [
    ['지금', `${d.horizon}주 뒤 출시하면 판매 ${d.sale}주 안에 정점이 오거나, 출시 때도 수요가 남을 전망`],
    ['선점', `정점이 아직 멀어 지금 개발하면 정점 전에 판매가 끝남. 개발 시작을 늦춰 정점 ${d.sale}주 전~정점 주에 출시`],
    ['관찰', '아직 판단하기 이름. 4주 더 지켜본 뒤 결정'],
    ['늦음', `개발하는 ${d.horizon}주 사이 정점이 지나거나 수요가 식을 전망. 다음 시즌 겨냥`],
  ]
  const LEGEND_ROW = 5.8, legendHeight = LEGEND.length * LEGEND_ROW + 5
  const legend = (y: number) => {
    doc.setFillColor(C.muted); doc.roundedRect(M, y, CW, legendHeight, 3, 3, 'F')
    LEGEND.forEach(([v, note], i) => {
      const cy = y + 2.5 + LEGEND_ROW * (i + 0.5)
      const [bg, fg, border] = VERDICT[v]
      chip(VERDICT_NAME[v], M + 5, cy, { bg: bg === C.muted ? C.white : bg, fg, border, size: 7.5, pad: 2.2 })
      text(note, M + 29, cy, { size: 8, color: C.fg })
    })
    return y + legendHeight + 5
  }

  /** 둘째 장부터의 머리 */
  const running = () => {
    text('주간 맛 트렌드 리포트', M, M + 2, { size: 9, bold: true, color: C.primary })
    text(`데이터 기준일 ${d.dataDate}`, M + CW, M + 2, { size: 8, color: C.sub, align: 'right' })
    doc.setDrawColor(C.border); doc.setLineWidth(0.3); doc.line(M, M + 6, M + CW, M + 6)
    return M + 11
  }
  /** 남은 공간이 h보다 작으면 다음 장으로 넘겨 카드가 잘리지 않게 한다 */
  const room = (y: number, h: number) => (y + h > FOOT - 4 ? (doc.addPage(), running()) : y)

  let y = summary(cover())
  // 소제목·판단 기준이 첫 카드와 떨어지지 않게 함께 잰다
  y = room(y, 6 + legendHeight + 5 + (d.trends[0] ? cardHeight(d.trends[0]) : 0))
  text('트렌드 우선순위', M, y, { size: 12.5, bold: true })
  text('출시 판단 → 상태 → 확산 지수 순', M + CW, y, { size: 8, color: C.sub, align: 'right' })
  y = legend(y + 5)
  d.trends.forEach((t) => {
    const h = cardHeight(t)
    y = room(y, h)
    card(t, y)
    y += h + 4
  })

  const notes = [
    `${d.horizon}주 생존율: 급등이 감지된 시점에 모델이 본, ${d.horizon}주 뒤에도 검색이 남을 확률`,
    '이번 주 검색량: 감지 주의 실제 검색 수를 검색 곡선 비율로 이번 주에 옮긴 추정치',
    '확산 지수: 재료별 검색 곡선을 3년 중 최고 주 = 100으로 맞춰 평균 낸 이번 주 값',
  ]
  y = room(y, 6 + notes.length * 4.3)
  text('읽는 법', M, y + 1, { size: 8, bold: true, color: C.primary })
  notes.forEach((n, i) => text(n, M + 12, y + 1 + i * 4.3, { size: 8, color: C.sub }))

  // 모든 장 아래: 생성 일시와 쪽 번호
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setDrawColor(C.border); doc.setLineWidth(0.3); doc.line(M, FOOT - 3.5, M + CW, FOOT - 3.5)
    text(`생성 ${stamp(d.createdAt)}`, M, FOOT, { size: 7.5, color: C.sub })
    text(`${p} / ${total}`, M + CW, FOOT, { size: 7.5, bold: true, color: C.sub, align: 'right' })
  }
}
