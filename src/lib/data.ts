/* 합성 데이터 생성기와 분석 규칙. 모든 값은 시드로 고정된 가상 값이다 (실측 아님, 정확도 미검증). */

export const DAYS = 28 // 출시 후 D+0 ~ D+28
export const PRE = 14 // 출시 전 베이스라인 일수
/** 화면의 "오늘". 제품마다 출시일은 오늘에서 현재 경과일을 뺀 날이다. */
export const REFERENCE_DATE = new Date(2026, 10, 3)
import { PLACES, type Place } from './stores'
export const TYPES =['대학가', '오피스', '주거', '역세권', '관광'] as const
export type StoreType = (typeof TYPES)[number]
export type Kind = 'burst' | 'slow' | 'wave'
export type ShapeName = '단발형' | '완만형' | '반복형'

export type LaunchKind = '새로운 맛' | '콜라보' | '캠페인'
export interface Scenario {
  id: string; label: string; launch: LaunchKind; shape: ShapeName; kind: Kind; radarKind: Kind; radarShape: ShapeName
  /** 출시 후 현재 경과일 (오늘 기준 D+N) */
  today: number
  /** 제품 선택 옆에 보여 줄 한 줄 설명 (가상) */
  blurb: string
  /** 선출시 매장을 직접 고른 경우 그 목록. 없으면 상권마다 1곳 */
  pilotIds?: string[]
  /** 이 맛이 출시 결정으로 만들어진 경우 레이더 키워드 */
  kw?: string
}
export const SCENARIOS: Record<'a' | 'b' | 'c', Scenario> = {
  a: { id: 'a', label: '솔티 캐러멜 크런치', launch: '새로운 맛', shape: '단발형', kind: 'burst', radarKind: 'slow', radarShape: '완만형', today: 5,
    blurb: '이달의 맛 신제품. 달콤짠 캐러멜에 바삭한 크런치를 더한 시즌 한정 맛. 매장 20곳 중 5곳이 먼저 출시.' },
  b: { id: 'b', label: '달빛토끼 루나 콜라보', launch: '콜라보', shape: '완만형', kind: 'slow', radarKind: 'slow', radarShape: '완만형', today: 12,
    blurb: '캐릭터 루나와 함께한 시즌 메뉴와 한정 굿즈. 팬 방문을 늘리는 것이 목표인 4주 콜라보.' },
  c: { id: 'c', label: '주말 더블업 캠페인', launch: '캠페인', shape: '반복형', kind: 'wave', radarKind: 'burst', radarShape: '단발형', today: 18,
    blurb: '금토일 방문 고객에게 더블 사이즈 쿠폰을 주는 4주 프로모션. 주말 방문 늘리기가 목표.' },
}
export const launchDate = (scn: Scenario) => new Date(REFERENCE_DATE.getTime() - scn.today * 86400000)

export const TYPE_SPEC: Record<StoreType, { base: number; speed: number; amp: number; wk: number[] }> = {
  '대학가': { base: 160, speed: 0.85, amp: 1.2, wk: [1.0, 1.05, 1.05, 1.05, 1.1, 0.8, 0.6] },
  '오피스': { base: 120, speed: 1.0, amp: 0.85, wk: [1.1, 1.12, 1.1, 1.08, 1.0, 0.55, 0.45] },
  '주거': { base: 90, speed: 1.3, amp: 0.75, wk: [0.85, 0.85, 0.9, 0.9, 1.0, 1.25, 1.25] },
  '역세권': { base: 200, speed: 0.95, amp: 1.0, wk: [1.0, 1.0, 1.0, 1.0, 1.1, 1.05, 0.95] },
  '관광': { base: 140, speed: 1.1, amp: 1.05, wk: [0.85, 0.85, 0.9, 0.95, 1.1, 1.3, 1.25] },
}

export function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const noise = (r: () => number) => (r() + r() + r() - 1.5) * 0.08

const gam = (x: number, p: number) => (x <= 0 ? 0 : (x / p) * Math.exp(1 - x / p))
export function unit(kind: Kind, d: number, speed: number): number {
  if (kind === 'burst') {
    const p = 2.2 * speed
    return 0.88 * gam(d + 0.6, p) + 0.12 * (1 - Math.exp(-d / 2)) * Math.exp(-Math.max(0, d - 14) / 30)
  }
  if (kind === 'slow') {
    const c = 5 * speed
    return (1 / (1 + Math.exp(-(d - c) / (c * 0.45)))) * Math.exp(-Math.max(0, d - 20) / 22)
  }
  const s2 = 14 * Math.min(speed, 1.1)
  return 0.3 * gam(d + 0.6, 2.5 * speed) + (d >= s2 - 0.6 ? gam(d - s2 + 0.6, 3 * speed) : 0)
}
export const SCN_AMP: Record<Kind, number> = { burst: 0.78, slow: 0.58, wave: 0.7 }

export interface DayInfo { d: number; date: Date; dow: number; temp: number; tf: number }
function dayInfo(i: number, launch: Date): DayInfo {
  const date = new Date(launch.getTime() + i * 86400000)
  const dow = (date.getDay() + 6) % 7
  const r = rng(hash('weather:' + i))
  const temp = Math.round((19 - 0.18 * (i + PRE) + (r() - 0.5) * 7) * 10) / 10
  return { d: i, date, dow, temp, tf: 1 + 0.012 * (temp - 15) }
}

export interface DayPoint {
  d: number; visits: number; exp: number; expRaw: number; react: number; reactRaw: number
  dwell: number; sales: number; stock: number; out: boolean
  /** 같은 날 신제품이 없었다면(대조 매장 가정) 방문 수와 반응. 같은 기준선·요일·기온 요인만 반영한 합성 값 */
  ctrlVis: number; ctrlReact: number
  /** 그날 전체 주문 수(합성). 신제품 판매 비중 = sales / orders */
  orders: number
}
export interface Store {
  id: string; type: StoreType; name: string; place: Place; base: number; dwell0: number; conv0: number; alloc: number; jitter: number
  conv: number; lowConv: boolean; event?: boolean; /** 행사 시작일 (행사 매장만 의미 있음, 3일간) */ evStart?: number; /** 선출시 매장 (상권마다 1곳) */ pilot: boolean; baseline: number; baselineRaw: number; dwellBase: number; stock0: number
  series: DayPoint[]
}
export interface Data {
  scn: Scenario; days: DayInfo[]; pre: DayInfo[]; stores: Store[]; agg: number[]; aggRaw: number[]; byType: Record<StoreType, number[]>
  /** 선출시 매장 반응, 대조 매장(같은 기간 미출시 가정) 반응, 둘의 차이(순효과) */
  pilotAgg: number[]; ctrlAgg: number[]; netAgg: number[]
}

export const shortName = (st: { name: string }) => st.name.replace(' 매장', '')

export function build(scnId: string, custom?: Scenario): Data {
  const scn = custom ?? SCENARIOS[(scnId as 'a') in SCENARIOS ? (scnId as 'a') : 'a']
  const days: DayInfo[] = [], pre: DayInfo[] = []
  const launch = launchDate(scn)
  for (let i = -PRE; i <= DAYS; i++) (i < 0 ? pre : days).push(dayInfo(i, launch))
  const stores: Store[] = []
  TYPES.forEach((t, ti) => {
    for (let n = 1; n <= 4; n++) {
      const id = 's' + ('0' + (ti * 4 + n)).slice(-2)
      const r = rng(hash(scn.id + ':' + id + ':spec'))
      stores.push({
        id, type: t, name: PLACES[ti * 4 + n - 1].name, place: PLACES[ti * 4 + n - 1],
        base: TYPE_SPEC[t].base * (0.85 + 0.3 * r()),
        dwell0: 15 + 7 * r(), conv0: 0.2 + 0.05 * r(), alloc: 0.8 + 1.0 * r(), jitter: 0.85 + 0.3 * r(),
        conv: 1, lowConv: false, pilot: false, baseline: 0, baselineRaw: 0, dwellBase: 0, stock0: 0, series: [],
      })
    }
  })
  const pick = rng(hash(scn.id + ':lowconv'))
  const chosen = new Set<number>()
  while (chosen.size < 4) chosen.add(Math.floor(pick() * stores.length))
  chosen.forEach((k) => { stores[k].lowConv = true; stores[k].conv = 0.45 })
  const evPick = rng(hash(scn.id + ':event'))
  let nEv = 0
  while (nEv < 2) { const k2 = Math.floor(evPick() * stores.length); if (!stores[k2].event) { stores[k2].event = true; nEv++ } }

  if (scn.pilotIds?.length) stores.forEach((st) => { st.pilot = scn.pilotIds!.includes(st.id) })
  else TYPES.forEach((t, ti) => { stores[ti * 4 + Math.floor(rng(hash(scn.id + ':pilot:' + t))() * 4)].pilot = true })

  stores.forEach((st) => {
    const spec = TYPE_SPEC[st.type]
    const r = rng(hash(scn.id + ':' + st.id + ':daily'))
    const preVis = pre.map((p) => st.base * spec.wk[p.dow] * p.tf * (1 + noise(r)))
    const preDes = pre.map((p, k) => preVis[k] / (spec.wk[p.dow] * p.tf))
    st.baseline = preDes.reduce((a, b) => a + b, 0) / PRE
    st.baselineRaw = preVis.reduce((a, b) => a + b, 0) / PRE
    st.dwellBase = st.dwell0
    const amp = SCN_AMP[scn.kind] * spec.amp * st.jitter
    let stock = Math.round((st.base * st.conv0 * 1.3 * 7 * st.alloc) / 10) * 10
    st.stock0 = stock
    let outLeft = 0
    const evStart = 5 + Math.floor(((st.jitter * 10) % 7))
    st.evStart = evStart
    const series: DayPoint[] = []
    days.forEach((dy) => {
      const rt = amp * unit(scn.kind, dy.d, spec.speed * (0.92 + 0.16 * st.jitter))
      const exp = st.baseline * spec.wk[dy.dow] * dy.tf
      const shock = st.event && dy.d >= evStart && dy.d < evStart + 3 ? 1.55 : 1
      let vis = st.base * spec.wk[dy.dow] * dy.tf * (1 + rt) * shock * (1 + noise(r)) * (outLeft > 0 ? 0.7 : 1)
      vis = Math.round(vis)
      const conv = st.conv0 * st.conv * (1 + noise(r) * 1.2)
      const sold = outLeft > 0 ? 0 : Math.min(stock, Math.round(vis * conv))
      stock -= sold
      const stockedOut = outLeft > 0 || stock <= 0
      if (outLeft > 0) {
        outLeft--
        if (outLeft === 0) stock = Math.round((st.base * st.conv0 * 1.3 * 12) / 10) * 10
      } else if (stock <= 0) outLeft = 2
      const dwell = st.dwell0 * (1 + 0.3 * rt) * (st.lowConv ? 1.25 : 1) * (1 + noise(r) * 0.6)
      series.push({ d: dy.d, visits: vis, exp, expRaw: st.baselineRaw, react: vis / exp - 1, reactRaw: vis / st.baselineRaw - 1, dwell, sales: sold, stock, out: stockedOut, ctrlVis: 0, ctrlReact: 0, orders: 0 })
    })
    // 새 필드는 별도 난수열로 만들어 기존 값이 바뀌지 않게 한다
    const rc = rng(hash(scn.id + ':' + st.id + ':ctrl')), ro = rng(hash(scn.id + ':' + st.id + ':orders'))
    series.forEach((pt, i) => {
      const dy = days[i]
      pt.ctrlVis = Math.round(st.base * spec.wk[dy.dow] * dy.tf * (1 + noise(rc)))
      pt.ctrlReact = pt.ctrlVis / pt.exp - 1
      pt.orders = Math.max(pt.sales, Math.round(pt.visits * 0.62 * (1 + noise(ro))))
    })
    st.series = series
  })

  const aggregate = (list: Store[], d: number, raw = false) => {
    let s = 0, e = 0
    list.forEach((st) => { const p = st.series[d]; s += p.visits; e += raw ? p.expRaw : p.exp })
    return s / e - 1
  }
  const agg: number[] = [], aggRaw: number[] = []
  for (let d = 0; d <= DAYS; d++) { agg.push(aggregate(stores, d)); aggRaw.push(aggregate(stores, d, true)) }
  const byType = {} as Record<StoreType, number[]>
  TYPES.forEach((t) => {
    const list = stores.filter((s) => s.type === t)
    byType[t] = []
    for (let d = 0; d <= DAYS; d++) byType[t].push(aggregate(list, d))
  })
  const pilots = stores.filter((s2) => s2.pilot), ctrls = stores.filter((s2) => !s2.pilot)
  const pilotAgg: number[] = [], ctrlAgg: number[] = []
  for (let d = 0; d <= DAYS; d++) {
    pilotAgg.push(aggOf(pilots, d).v)
    let sv = 0, se = 0
    ctrls.forEach((c) => { sv += c.series[d].ctrlVis; se += c.series[d].exp })
    ctrlAgg.push(sv / se - 1)
  }
  const netAgg = pilotAgg.map((v, d) => v - ctrlAgg[d])
  return { scn, days, pre, stores, agg, aggRaw, byType, pilotAgg, ctrlAgg, netAgg }
}

export function aggOf(list: Store[], d: number, raw = false) {
  let s = 0, e = 0
  list.forEach((st) => { const p = st.series[d]; s += p.visits; e += raw ? p.expRaw : p.exp })
  return { v: s / e - 1, vis: s, exp: e }
}

export function radarCurve(data: Data, corrected = false, observed?: { kind: Kind; peakVal: number }): number[] {
  const kind = corrected && observed ? observed.kind : data.scn.radarKind
  const amp = corrected && observed ? observed.peakVal : 0.5
  const out: number[] = []
  for (let d = 0; d <= DAYS; d++) out.push(amp * unit(kind, d, 1))
  return out
}

export interface Classification { type: ShapeName | '판정 보류'; kind: Kind | null; conf: '높음' | '중간' | '낮음' | '보류'; peakDay: number; peakVal: number; days: number }
export function classify(data: Data, D: number): Classification {
  const a = data.agg.slice(0, D + 1)
  let peakDay = 0
  a.forEach((v, i) => { if (v > a[peakDay]) peakDay = i })
  const peakVal = a[peakDay]
  const conf = D >= 14 ? '높음' : D >= 7 ? '중간' : D >= 4 ? '낮음' : '보류'
  const res: Classification = { type: '판정 보류', kind: null, conf, peakDay, peakVal, days: D + 1 }
  if (D < 4) return res
  const cur = a[D]
  let secondRise = false, runMax = 0
  for (let j = 0; j <= D - 2; j++) {
    runMax = Math.max(runMax, a[j])
    if (j < 2 || runMax < 0.12 || a[j] > 0.5 * runMax) continue
    let later = -Infinity
    for (let k = j + 1; k <= D; k++) later = Math.max(later, a[k])
    if (later - a[j] >= 0.2) { secondRise = true; break }
  }
  if (secondRise) { res.type = '반복형'; res.kind = 'wave'; return res }
  if (peakDay <= 6 && D >= peakDay + 2 && cur <= 0.65 * peakVal) { res.type = '단발형'; res.kind = 'burst'; return res }
  if (D >= 8 && peakDay >= 5) { res.type = '완만형'; res.kind = 'slow'; return res }
  return res
}

export const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
function lastN(st: Store, D: number, n: number, key: keyof DayPoint): number[] {
  const v: number[] = []
  for (let i = Math.max(0, D - n + 1); i <= D; i++) v.push(Number(st.series[i][key]))
  return v
}
function median(arr: number[]) {
  const s = arr.slice().sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const DIAG = { rise: 0.15, convLow: -0.25 }
export type Zone = 'flag' | 'good' | 'reach' | 'hidden'
export interface DiagRow { st: Store; x: number; y: number; conv: number; dwell: number; out: boolean; zone: Zone; hint: string; visits3: number }
export function diagnose(data: Data, D: number): { rows: DiagRow[]; medConv: number } {
  const rows: DiagRow[] = data.stores.map((st) => {
    const x = mean(lastN(st, D, 3, 'react'))
    let sales = 0, vis = 0
    for (let span = 3; span <= 8 && !vis; span += 5) {
      for (let i = Math.max(0, D - span + 1); i <= D; i++) {
        const p = st.series[i]
        if (!p.out) { sales += p.sales; vis += p.visits }
      }
    }
    const dwell = mean(lastN(st, D, 3, 'dwell')) / st.dwellBase - 1
    return { st, x, y: 0, conv: vis ? sales / vis : NaN, dwell, out: st.series[D].out, zone: 'hidden' as Zone, hint: '', visits3: mean(lastN(st, D, 3, 'visits')) }
  })
  const med = median(rows.filter((r) => !Number.isNaN(r.conv)).map((r) => r.conv))
  rows.forEach((r) => {
    if (Number.isNaN(r.conv)) r.conv = med
    r.y = med ? r.conv / med - 1 : 0
    const hi = r.x >= DIAG.rise, low = r.y <= DIAG.convLow
    r.zone = hi && low ? 'flag' : hi ? 'good' : low ? 'reach' : 'hidden'
    r.hint = r.zone === 'flag'
      ? r.dwell > 0.2
        ? `체류는 평소보다 ${Math.round(r.dwell * 100)}% 길지만 구매 전환은 중앙값보다 ${Math.abs(Math.round(r.y * 100))}% 낮습니다. 가격표, 시식, 진열 위치를 확인하세요.`
        : `방문은 늘었지만 구매 전환이 중앙값보다 ${Math.abs(Math.round(r.y * 100))}% 낮습니다. 진열과 안내 문구를 확인하세요.`
      : r.zone === 'reach' ? '방문 자체가 약합니다. POP와 쇼케이스 노출을 먼저 점검하세요.'
        : r.zone === 'hidden' ? '구매 효율은 높습니다. 노출을 늘릴 여지가 있습니다.' : ''
  })
  return { rows, medConv: med }
}

export interface OrderParams { cover: number; rise: number; target: number; low: number; over: number }
export const ORDER_DEFAULT: OrderParams = { cover: 3, rise: 0.2, target: 7, low: 0.1, over: 10 }
export type OrderAction = 'order' | 'swap' | 'hold' | 'keep' | 'wait'
export interface OrderRow { st: Store; stock: number; sales3: number; r3: number; cover: number; action: OrderAction; qty: number; why: string }
export function orders(data: Data, D: number, params?: Partial<OrderParams>): { rows: OrderRow[]; params: OrderParams } {
  const p = { ...ORDER_DEFAULT, ...(params || {}) }
  const diag = diagnose(data, D)
  const flagged = new Set(diag.rows.filter((r) => r.zone === 'flag').map((r) => r.st.id))
  const rows = data.stores.map((st): OrderRow => {
    const cur = st.series[D]
    const s3 = mean(lastN(st, D, 3, 'sales'))
    const r3 = mean(lastN(st, D, 3, 'react'))
    const r5 = mean(lastN(st, D, 5, 'react'))
    const cover = s3 > 0 ? cur.stock / s3 : cur.stock > 0 ? 99 : 0
    const row: OrderRow = { st, stock: cur.stock, sales3: s3, r3, cover, action: 'keep', qty: 0, why: '' }
    if (D < 2) { row.action = 'wait'; row.why = '출시 후 2일 이상 지나야 판단합니다.'; return row }
    if (flagged.has(st.id)) {
      row.action = 'hold'; row.why = '구매 전환이 낮아 먼저 매장 안 요인을 확인합니다. 발주는 보류합니다.'
    } else if (cover <= p.cover && r3 >= p.rise) {
      row.action = 'order'
      row.qty = Math.max(10, Math.round((s3 * p.target - cur.stock) / 10) * 10)
      row.why = '반응이 평소보다 높고 재고가 ' + (cover < 0.05 ? '바닥났습니다.' : '약 ' + cover.toFixed(1) + '일치 남았습니다.')
    } else if (D >= 7 && r5 < p.low && cover > p.over) {
      row.action = 'swap'; row.why = '반응이 평소 수준으로 돌아왔고 재고가 ' + Math.round(cover) + '일치 남았습니다.'
    } else row.why = '지금 재고로 버틸 수 있습니다.'
    return row
  })
  return { rows, params: p }
}

export interface TypeStat { type: StoreType; n: number; peakDay: number; peak: number; now: number; reached: boolean; retain: number | null; series: number[] }
export function typeStats(data: Data, D: number): TypeStat[] {
  return TYPES.map((t) => {
    const a = data.byType[t].slice(0, D + 1)
    let pk = 0
    a.forEach((v, i) => { if (v > a[pk]) pk = i })
    const reached = (D >= pk + 2 && a[D] < a[pk] * 0.9) || D >= 12
    return { type: t, n: data.stores.filter((s) => s.type === t).length, peakDay: pk, peak: a[pk], now: a[D], reached, retain: D >= 14 ? a[14] / a[pk] : null, series: a }
  })
}

export function rankSeries(data: Data): number[][] {
  const ranks: number[][] = data.stores.map(() => [])
  for (let d = 0; d <= DAYS; d++) {
    const order = data.stores.map((s, i) => ({ i, v: mean(lastN(s, d, 3, 'react')) })).sort((a, b) => b.v - a.v)
    order.forEach((o, pos) => { ranks[o.i][d] = pos + 1 })
  }
  return ranks
}
const DEV_MIN = 0.25
export interface Mover { st: Store; now: number; before: number | null; delta: number; dev: number; cause: string; alert: boolean; trail: number[]; react: number }
export function movers(data: Data, D: number, threshold: number, gap: number): Mover[] {
  const ranks = rankSeries(data)
  const sm = (st: Store, d: number) => mean(lastN(st, d, 3, 'react'))
  const aggSm = (d: number) => mean(data.stores.map((st) => sm(st, d)))
  return data.stores.map((st, i) => {
    const now = ranks[i][D]
    const before = D - gap >= 0 ? ranks[i][D - gap] : null
    const delta = before == null ? 0 : before - now
    const dev = before == null ? 0 : sm(st, D) - sm(st, D - gap) - (aggSm(D) - aggSm(D - gap))
    const alert = before != null && Math.abs(delta) >= threshold && Math.abs(dev) >= DEV_MIN && delta > 0 === dev > 0
    let cause = ''
    if (alert) {
      const s = st.series[D], prev = st.series[Math.max(0, D - gap)]
      const cover = s.stock / Math.max(1, mean(lastN(st, D, 3, 'sales')))
      if (delta < 0 && s.out && !prev.out) cause = '재고가 바닥나며 방문이 줄었을 가능성이 있습니다.'
      else if (delta < 0 && cover < 1.5) cause = '재고가 얼마 남지 않았습니다. 발주 화면을 확인하세요.'
      else if (delta > 0) cause = '방문이 갑자기 늘었습니다. 현장 행사나 노출 변화가 있었는지 확인하세요.'
      else cause = '원인이 보이지 않습니다. 현장 확인이 필요합니다.'
    }
    return { st, now, before, delta, dev, cause, alert, trail: ranks[i].slice(Math.max(0, D - 13), D + 1), react: st.series[D].react }
  })
}

export interface Milestones { signal: number | null; gap: number | null; order: number | null; radar: number | null; alert: number | null }
export function milestones(data: Data): Milestones {
  const m: Milestones = { signal: null, gap: null, order: null, radar: null, alert: null }
  for (let D = 0; D <= DAYS; D++) {
    if (m.signal == null && D >= 1 && data.agg[D] >= 0.15 && data.agg[D - 1] >= 0.15) m.signal = D
    if (m.gap == null && D >= 2 && diagnose(data, D).rows.filter((r) => r.zone === 'flag').length >= 3) m.gap = D
    if (m.order == null && D >= 2 && orders(data, D).rows.some((r) => r.action === 'order')) m.order = D
    if (m.radar == null && D >= 4) { const c = classify(data, D); if (c.kind && c.conf !== '보류') m.radar = D }
    if (m.alert == null && D >= 2 && movers(data, D, 5, 3).some((r) => r.alert)) m.alert = D
  }
  return m
}

/* ---------- 방향 판단 (확대, 유지, 보완, 정리) ---------- */
export type Dir = 'wait' | 'expand' | 'maintain' | 'fix' | 'wrap'
export const DIR_LABEL: Record<Dir, string> = { wait: '관찰 중', expand: '확대 필요', maintain: '유지', fix: '보완 필요', wrap: '정리' }
export const DIR_OPTIONS: Exclude<Dir, 'wait'>[] = ['expand', 'maintain', 'fix', 'wrap']
/** 출시 유형마다 같은 선택지가 뜻하는 행동이 다르다 */
export const DIR_MEANING: Record<LaunchKind, Record<Exclude<Dir, 'wait'>, string>> = {
  '새로운 맛': { expand: '이달의 맛 연장, 노출 확대', maintain: '현 상태로 며칠 더 관찰', fix: '가격표, 시식, 진열 보완', wrap: '판매 종료 시점 검토, 후속 맛 준비' },
  '콜라보': { expand: '콜라보 기간 연장, 굿즈와 노출 확대', maintain: '현 상태로 며칠 더 관찰', fix: '굿즈와 POP 안내 보완', wrap: '종료 시점 검토, 후속 콜라보 후보' },
  '캠페인': { expand: '캠페인 연장, 채널 확대', maintain: '현 상태로 며칠 더 관찰', fix: '쿠폰과 메시지 보완', wrap: '종료 검토, 후속 캠페인 준비' },
}
export interface Verdict {
  dir: Dir; conf: '낮음' | '중간' | '높음'; days: number; headline: string
  a: number; peak: number; slope: number; flagged: number; lostShare: number; lostUnits: number
}
export function verdict(data: Data, D: number): Verdict {
  const a = data.agg[D]
  const peak = Math.max(...data.agg.slice(0, D + 1))
  const slope = a - data.agg[Math.max(0, D - 3)]
  const diag = diagnose(data, D)
  const fl = diag.rows.filter((r) => r.zone === 'flag')
  const expected = diag.rows.reduce((s, r) => s + r.visits3 * diag.medConv, 0) || 1
  const lostUnits = fl.reduce((s, r) => s + Math.max(0, r.visits3 * (diag.medConv - r.conv)), 0)
  const lostShare = lostUnits / expected
  const conf: Verdict['conf'] = D >= 14 ? '높음' : D >= 7 ? '중간' : '낮음'
  let dir: Dir
  if (D < 3) dir = 'wait'
  else if (D >= 6 && a < 0.12 && slope < 0.03) dir = 'wrap'
  else if (a >= 0.25 && slope >= 0.03) dir = 'expand' // 뚜렷이 오르는 중이면 보완보다 확대가 먼저
  else if (fl.length >= 3 && lostShare >= 0.08) dir = 'fix'
  else if (a >= 0.25 && a >= 0.8 * peak) dir = 'expand'
  else if (D >= 6 && a < 0.25 && slope < -0.05) dir = 'wrap'
  else dir = 'maintain'
  const headline =
    dir === 'wait' ? '출시 직후라 판단할 근거가 부족합니다' :
    dir === 'fix' ? `평소보다 ${pct0(a)} 더 모이지만 ${fl.length}개 매장은 구매로 이어지지 않습니다` :
    dir === 'expand' ? `평소보다 ${pct0(a)} 더 모이고 ${slope >= 0 ? '오르는 중입니다' : '높은 수준을 지킵니다'}` :
    dir === 'wrap' ? `반응이 평소 수준 ${pct0(a)}까지 식었습니다` :
    `평소보다 ${pct0(a)} 더 모입니다. 방향을 바꿀 신호는 아직 없습니다`
  return { dir, conf, days: D + 1, headline, a, peak, slope, flagged: fl.length, lostShare, lostUnits }
}
const pct0 = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%'

export function verdictSeries(data: Data): Dir[] {
  const out: Dir[] = []
  for (let d = 0; d <= DAYS; d++) out.push(verdict(data, d).dir)
  return out
}

/** 판정의 이유 한 줄 */
export function verdictReason(data: Data, D: number): string {
  const v = verdict(data, D)
  const sg = (x: number) => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x * 100))
  switch (v.dir) {
    case 'wait': return '출시 직후라 근거가 부족'
    case 'expand': return `반응 ${sg(v.a)}%, 최근 3일 ${sg(v.slope)}%p`
    case 'fix': return `구매 점검 ${v.flagged}곳, 놓친 판매 ${Math.round(v.lostShare * 100)}%`
    case 'wrap': return `반응 ${sg(v.a)}%로 식음`
    default: return `반응 ${sg(v.a)}%, 방향을 바꿀 신호 없음`
  }
}
export interface VerdictPhase { dir: Dir; from: number; to: number; reason: string }
/** 같은 판정이 이어진 구간으로 묶고, 구간의 이유는 마지막 날 기준 */
export function verdictPhases(data: Data, D: number): VerdictPhase[] {
  const out: VerdictPhase[] = []
  for (let d = 0; d <= D; d++) {
    const dir = verdict(data, d).dir
    const last = out[out.length - 1]
    if (last && last.dir === dir) { last.to = d; last.reason = verdictReason(data, d) }
    else out.push({ dir, from: d, to: d, reason: verdictReason(data, d) })
  }
  return out
}

export const DIR_RULE: Record<Dir, string> = {
  wait: '출시 후 3일부터 판단합니다',
  expand: '반응 25% 이상이고 오르는 중이면 확대 필요',
  maintain: '방향을 바꿀 신호가 없으면 유지',
  fix: '구매 점검 3곳 이상, 놓친 판매 8% 이상이면 보완 필요',
  wrap: '반응 12% 미만이거나 25% 아래로 계속 내려가면 정리',
}

/* ---------- 매장 반응 4단계 (유입, 관심, 전환, 맛 단위) ---------- */
export interface Stage { now: number; before: number }
export interface Stages { inflow: Stage; interest: Stage; conv: Stage; share: Stage }
/** 전체 20곳 기준. 최근 3일 값과 그 직전 3일 값 */
export function stageStats(data: Data, D: number): Stages {
  const at = (d: number) => {
    const interest = mean(data.stores.map((st) => mean(lastN(st, d, 3, 'dwell')) / st.dwellBase - 1))
    let sales = 0, vis = 0, ord = 0, sold = 0
    data.stores.forEach((st) => {
      for (let i = Math.max(0, d - 2); i <= d; i++) {
        const p = st.series[i]
        ord += p.orders; sold += p.sales
        if (!p.out) { sales += p.sales; vis += p.visits }
      }
    })
    return { inflow: mean(data.agg.slice(Math.max(0, d - 2), d + 1)), interest, conv: vis ? (sales / vis) * 100 : 0, share: ord ? sold / ord : 0 }
  }
  const a = at(D), b = at(Math.max(0, D - 3))
  return { inflow: { now: a.inflow, before: b.inflow }, interest: { now: a.interest, before: b.interest }, conv: { now: a.conv, before: b.conv }, share: { now: a.share, before: b.share } }
}
