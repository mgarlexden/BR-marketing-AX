/* 가상 카메라 동선 메커니즘.
 * 실제 카메라 대신 "가상 손님"이 도면 위를 움직이고, 가상 카메라가 그 위치를 찍은 것처럼 만든다.
 * 흐름: 가상 위치(미터 좌표) -> 존 진입, 이탈, 체류 이벤트 -> 집계(존 간 흐름, 0.5m 칸 체류) -> 해석 규칙.
 * 이 파일의 모든 동선은 합성이다. 실제 매장에서는 개인별 동선이 매장 PC 밖으로 나가지 않는다. */
import { hash, rng, type DayPoint, type Store } from './data'

export const PLAN_W = 12
export const PLAN_H = 8
export const CELL = 0.5

export interface Rect { x: number; y: number; w: number; h: number }
export type ZoneId = 'entrance' | 'pop' | 'showcase' | 'queue' | 'pos' | 'freezer' | 'seating'

// 존 판정 우선순위 (겹치면 앞쪽이 이긴다)
export const ZONE_ORDER: ZoneId[] = ['pos', 'queue', 'pop', 'showcase', 'freezer', 'seating', 'entrance']
export const ZONES: Record<ZoneId, { label: string; rect: Rect; color: string }> = {
  entrance: { label: '입구', rect: { x: 2.4, y: 6.2, w: 2.2, h: 1.8 }, color: 'var(--muted-foreground)' },
  pop: { label: '신제품 구역', rect: { x: 4.6, y: 3.7, w: 2.4, h: 1.9 }, color: 'var(--chart-1)' },
  showcase: { label: '맛 고르기', rect: { x: 7.0, y: 3.7, w: 3.4, h: 1.9 }, color: 'var(--chart-2)' },
  queue: { label: '대기줄', rect: { x: 8.6, y: 5.7, w: 2.0, h: 1.7 }, color: 'var(--chart-3)' },
  pos: { label: '계산대', rect: { x: 10.5, y: 3.7, w: 1.4, h: 1.9 }, color: 'var(--chart-5)' },
  freezer: { label: '포장 냉동고', rect: { x: 0.3, y: 1.0, w: 1.8, h: 4.2 }, color: 'var(--chart-4)' },
  seating: { label: '좌석', rect: { x: 0.4, y: 5.4, w: 1.9, h: 2.2 }, color: 'var(--muted-foreground)' },
}

export interface Fixture { id: string; label: string; rect: Rect; round?: boolean }
export const FIXTURES: Fixture[] = [
  { id: 'back', label: '스쿱 스테이션 (직원 구역)', rect: { x: 4.5, y: 0.3, w: 7.0, h: 1.6 } },
  { id: 'cabinet', label: '쇼케이스', rect: { x: 4.6, y: 2.1, w: 5.8, h: 1.3 } },
  { id: 'pos', label: 'POS', rect: { x: 11.0, y: 3.7, w: 0.8, h: 1.9 } },
  { id: 'kiosk', label: '키오스크', rect: { x: 11.2, y: 6.2, w: 0.6, h: 0.8 } },
  { id: 'freezer', label: '냉동고', rect: { x: 0.2, y: 1.0, w: 0.7, h: 4.2 } },
  { id: 'pop', label: 'POP', rect: { x: 4.75, y: 3.55, w: 0.5, h: 0.5 } },
  { id: 't1', label: '', rect: { x: 1.0, y: 5.8, w: 0.8, h: 0.8 }, round: true },
  { id: 't2', label: '', rect: { x: 1.0, y: 6.8, w: 0.8, h: 0.8 }, round: true },
]
export const DOOR = { x1: 2.6, x2: 4.2 }
export const CAMERA = { x: 11.6, y: 7.6, dirX: -5.6, dirY: -4.1, fov: (100 * Math.PI) / 180, range: 10.5 }

export const WINDOWS = [
  { label: '11:00~13:00', start: 11 * 3600, end: 13 * 3600 },
  { label: '13:00~15:00', start: 13 * 3600, end: 15 * 3600 },
  { label: '15:00~17:00', start: 15 * 3600, end: 17 * 3600 },
  { label: '17:00~19:00', start: 17 * 3600, end: 19 * 3600 },
  { label: '19:00~21:00', start: 19 * 3600, end: 21 * 3600 },
]

export interface Pt { t: number; x: number; y: number }
export interface Stay { zone: ZoneId; t0: number; t1: number }
export type Outcome = 'buy' | 'leave'
export interface Track {
  id: number; pts: Pt[]; t0: number; t1: number; outcome: Outcome; seg: 'pop' | 'showcase' | 'freezer'
  stays: Stay[]; popVisited: boolean; reachedPos: boolean; lastZone: ZoneId
}

/** 존에 이만큼 머물러야 방문으로 센다 (초) */
export const MIN_STAY = 6
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const gauss = (r: () => number) => (r() + r() + r() - 1.5) * 2
const lognorm = (r: () => number, med: number, sigma: number) => med * Math.exp(gauss(r) * sigma)
const inRect = (x: number, y: number, q: Rect) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h
export const zoneAt = (x: number, y: number): ZoneId | null => {
  for (const z of ZONE_ORDER) if (inRect(x, y, ZONES[z].rect)) return z
  return null
}

interface WP { x: number; y: number; dwell: number }
function buildPath(r: () => number, t0: number, wps: WP[]): Pt[] {
  const pts: Pt[] = [{ t: t0, x: wps[0].x, y: wps[0].y }]
  let t = t0
  let cur = wps[0]
  for (let i = 1; i < wps.length; i++) {
    const nx = wps[i]
    const dx = nx.x - cur.x, dy = nx.y - cur.y
    const dist = Math.hypot(dx, dy)
    const v = 0.9 + 0.4 * r()
    const steps = Math.max(1, Math.ceil(dist / v))
    const off = (r() - 0.5) * Math.min(1.2, dist * 0.3)
    const cx = (cur.x + nx.x) / 2 + (-dy / (dist || 1)) * off
    const cy = (cur.y + nx.y) / 2 + (dx / (dist || 1)) * off
    for (let s = 1; s <= steps; s++) {
      const u = s / steps
      const x = (1 - u) * (1 - u) * cur.x + 2 * u * (1 - u) * cx + u * u * nx.x
      const y = (1 - u) * (1 - u) * cur.y + 2 * u * (1 - u) * cy + u * u * nx.y
      t += dist / v / steps
      pts.push({ t, x: clamp(x, 0.25, PLAN_W - 0.25), y: clamp(y, 0.25, PLAN_H - 0.05) })
    }
    const dwell = nx.dwell
    for (let s = 2; s <= dwell; s += 2) {
      t += 2
      pts.push({ t, x: clamp(nx.x + (r() - 0.5) * 0.5, 0.25, PLAN_W - 0.25), y: clamp(nx.y + (r() - 0.5) * 0.4, 0.25, PLAN_H - 0.05) })
    }
    cur = nx
  }
  return pts
}

export interface SimInput {
  seed: string; win: number; n: number
  react: number // 신제품 구역 반응 (평소 대비)
  dwellMed: number // 신제품 구역 체류 중앙값 (초)
  buyFactor: number // 신제품 구역을 본 사람이 구매로 이어질 상대 확률 (평소 1)
  soldOut: boolean
  baseline: boolean // 출시 전 평소 동선
}

export function simulate(inp: SimInput): Track[] {
  const r = rng(hash(inp.seed + ':' + inp.win + ':' + (inp.baseline ? 'b' : 'a')))
  const w = WINDOWS[inp.win]
  const react = inp.baseline ? 0 : Math.max(0, inp.react)
  const pPop = clamp(0.16 + 0.5 * react, 0.16, 0.8)
  const pFreezer = 0.14
  const buyPop = inp.baseline ? 0.55 : clamp(0.55 * inp.buyFactor, 0.08, 0.8) * (inp.soldOut && !inp.baseline ? 0.2 : 1)
  const popDwell = (inp.baseline ? inp.dwellMed : inp.dwellMed) * (inp.soldOut && !inp.baseline ? 0.4 : 1)
  const tracks: Track[] = []
  for (let i = 0; i < inp.n; i++) {
    const t0 = w.start + r() * (w.end - w.start - 600)
    const door: WP = { x: 3.3 + (r() - 0.5) * 0.8, y: 7.95, dwell: 0 }
    const mid: WP = { x: 3.6 + (r() - 0.5) * 0.6, y: 6.4 + (r() - 0.5) * 0.4, dwell: 0 }
    const u = r()
    const seg: Track['seg'] = u < pFreezer ? 'freezer' : u < pFreezer + pPop ? 'pop' : 'showcase'
    const popPt = (dwell: number): WP => ({ x: 5.4 + (r() - 0.5) * 1.0, y: 4.7 + (r() - 0.5) * 0.6, dwell })
    const showPt = (dwell: number): WP => ({ x: 8.6 + (r() - 0.5) * 1.6, y: 4.7 + (r() - 0.5) * 0.5, dwell })
    const wps: WP[] = [door, mid]
    let buyProb = 0.72
    if (seg === 'freezer') {
      wps.push({ x: 1.3 + (r() - 0.5) * 0.4, y: 1.6 + r() * 3.0, dwell: lognorm(r, 35, 0.4) })
      buyProb = 0.8
    } else if (seg === 'pop') {
      wps.push(popPt(lognorm(r, popDwell, 0.45)))
      if (r() < 0.45) wps.push(showPt(lognorm(r, 28, 0.4)))
      buyProb = buyPop
    } else {
      wps.push(showPt(lognorm(r, 32, 0.4)))
      if (r() < 0.25) wps.push(popPt(lognorm(r, popDwell * 0.6, 0.4)))
    }
    let outcome: Outcome = r() < buyProb ? 'buy' : 'leave'
    if (outcome === 'buy') {
      wps.push({ x: 9.5 + (r() - 0.5) * 0.8, y: 6.4 + (r() - 0.5) * 0.8, dwell: lognorm(r, 34, 0.5) })
      if (r() < 0.05) outcome = 'leave' // 줄이 길어 포기
      else {
        wps.push({ x: 10.65, y: 4.6 + (r() - 0.5) * 0.7, dwell: lognorm(r, 26, 0.3) })
        if (r() < 0.3) wps.push({ x: 1.5 + (r() - 0.5) * 0.8, y: 6.4 + (r() - 0.5) * 1.0, dwell: 60 + r() * 120 })
      }
    }
    wps.push(mid, { ...door, y: 7.95 })
    const pts = buildPath(r, t0, wps)
    // 존 이벤트: 연속된 같은 존을 하나의 체류로 합친다
    const stays: Stay[] = []
    for (let k = 0; k < pts.length; k++) {
      const z = zoneAt(pts[k].x, pts[k].y)
      if (!z) continue
      const last = stays[stays.length - 1]
      const tEnd = k + 1 < pts.length ? pts[k + 1].t : pts[k].t
      if (last && last.zone === z && pts[k].t - last.t1 <= 3) last.t1 = tEnd
      else stays.push({ zone: z, t0: pts[k].t, t1: tEnd })
    }
    // 스치고 지나간 것(몇 초 미만)은 방문으로 세지 않는다. 입구는 예외.
    const kept = stays.filter((s) => s.zone === 'entrance' || s.t1 - s.t0 >= MIN_STAY)
    const merged: Stay[] = []
    kept.forEach((s) => { const l = merged[merged.length - 1]; if (l && l.zone === s.zone) l.t1 = s.t1; else merged.push({ ...s }) })
    stays.length = 0
    merged.forEach((m) => stays.push(m))
    const meaningful = stays.filter((s) => s.zone !== 'entrance' && s.zone !== 'seating')
    tracks.push({
      id: i, pts, t0: pts[0].t, t1: pts[pts.length - 1].t, outcome, seg, stays,
      popVisited: stays.some((s) => s.zone === 'pop'),
      reachedPos: stays.some((s) => s.zone === 'pos'),
      lastZone: outcome === 'leave' ? (meaningful.length ? meaningful[meaningful.length - 1].zone : 'entrance') : 'pos',
    })
  }
  return tracks
}

const median = (a: number[]) => {
  if (!a.length) return 0
  const s = a.slice().sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface Flow { from: ZoneId; to: ZoneId; n: number }
export interface FloorMetrics {
  n: number; popN: number; popRate: number; popDwell: number; popBuyN: number; popBuyRate: number
  buyN: number; leaveN: number; drop: { zone: ZoneId; n: number }[]
  zoneVisits: Record<ZoneId, number>; zoneDwell: Record<ZoneId, number>
  flows: Flow[]; heat: number[][]; heatMax: number; queueWait: number; queueAbandon: number
}
export function metrics(tracks: Track[]): FloorMetrics {
  const zones = Object.keys(ZONES) as ZoneId[]
  const visits = Object.fromEntries(zones.map((z) => [z, 0])) as Record<ZoneId, number>
  const dwells = Object.fromEntries(zones.map((z) => [z, [] as number[]])) as Record<ZoneId, number[]>
  const flowMap = new Map<string, number>()
  const dropMap = new Map<ZoneId, number>()
  const nx = Math.round(PLAN_W / CELL), ny = Math.round(PLAN_H / CELL)
  const heat = Array.from({ length: ny }, () => new Array<number>(nx).fill(0))
  let popN = 0, popBuyN = 0, buyN = 0, queueAbandon = 0
  const popDw: number[] = [], qWait: number[] = []
  tracks.forEach((tr) => {
    if (tr.outcome === 'buy') buyN++
    if (tr.popVisited) { popN++; if (tr.outcome === 'buy') popBuyN++ }
    if (tr.outcome === 'leave') {
      dropMap.set(tr.lastZone, (dropMap.get(tr.lastZone) || 0) + 1)
      if (tr.lastZone === 'queue') queueAbandon++
    }
    const seen = new Set<ZoneId>()
    tr.stays.forEach((s, i) => {
      if (!seen.has(s.zone)) { visits[s.zone]++; seen.add(s.zone) }
      dwells[s.zone].push(s.t1 - s.t0)
      if (s.zone === 'pop') popDw.push(s.t1 - s.t0)
      if (s.zone === 'queue') qWait.push(s.t1 - s.t0)
      const nxt = tr.stays[i + 1]
      if (nxt && nxt.zone !== s.zone) { const k = s.zone + '>' + nxt.zone; flowMap.set(k, (flowMap.get(k) || 0) + 1) }
    })
    for (let i = 0; i + 1 < tr.pts.length; i++) {
      const p = tr.pts[i]
      const dt = Math.min(3, tr.pts[i + 1].t - p.t)
      const cx = Math.min(nx - 1, Math.max(0, Math.floor(p.x / CELL))), cy = Math.min(ny - 1, Math.max(0, Math.floor(p.y / CELL)))
      heat[cy][cx] += dt
    }
  })
  let heatMax = 0
  heat.forEach((row) => row.forEach((v) => { if (v > heatMax) heatMax = v }))
  const n = tracks.length || 1
  return {
    n: tracks.length, popN, popRate: popN / n, popDwell: median(popDw), popBuyN, popBuyRate: popN ? popBuyN / popN : 0,
    buyN, leaveN: tracks.length - buyN,
    drop: Array.from(dropMap.entries()).map(([zone, c]) => ({ zone, n: c })).sort((a, b) => b.n - a.n),
    zoneVisits: visits,
    zoneDwell: Object.fromEntries(zones.map((z) => [z, median(dwells[z])])) as Record<ZoneId, number>,
    flows: Array.from(flowMap.entries()).map(([k, c]) => { const [from, to] = k.split('>') as [ZoneId, ZoneId]; return { from, to, n: c } }).sort((a, b) => b.n - a.n),
    heat, heatMax, queueWait: median(qWait), queueAbandon,
  }
}

export function simInputFor(st: Store, p: DayPoint, win: number, baseline: boolean, n = 60): SimInput {
  const conv = p.visits > 0 ? p.sales / p.visits : st.conv0
  return {
    seed: st.id + ':' + p.d, win, n, react: p.react, dwellMed: baseline ? st.dwellBase : p.dwell,
    buyFactor: conv / st.conv0, soldOut: p.out, baseline,
  }
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral'
export interface Reading { tone: Tone; title: string; bullets: string[]; actions: string[] }
const pc = (v: number) => Math.round(v * 100) + '%'
export function interpret(after: FloorMetrics, before: FloorMetrics, ctx: { soldOut: boolean; name: string }): Reading {
  const popUp = after.popRate - before.popRate
  const buyDrop = before.popBuyRate - after.popBuyRate
  const topDrop = after.drop[0]
  const dropShare = topDrop ? topDrop.n / Math.max(1, after.leaveN) : 0
  const bullets = [
    `신제품 구역에 들어간 사람이 평소 ${pc(before.popRate)}에서 ${pc(after.popRate)}로 ${popUp >= 0 ? '늘었습니다' : '줄었습니다'} (${popUp >= 0 ? '+' : '−'}${Math.abs(Math.round(popUp * 100))}%p).`,
    `그곳에 머문 시간(중앙값)은 평소 ${Math.round(before.popDwell)}초에서 ${Math.round(after.popDwell)}초입니다.`,
    `신제품 구역을 거친 사람 중 ${pc(after.popBuyRate)}가 계산대까지 갔습니다 (평소 ${pc(before.popBuyRate)}).`,
  ]
  if (topDrop) bullets.push(`사지 않고 나간 사람의 ${pc(dropShare)}가 ${ZONES[topDrop.zone].label}에서 동선이 끝났습니다.`)
  if (ctx.soldOut) return { tone: 'bad', title: '재고가 바닥나 놓치고 있습니다', bullets, actions: ['입고 일정을 먼저 확인하세요.', '신제품 구역 POP에 품절 안내를 붙이세요.'] }
  if (popUp >= 0.12 && buyDrop >= 0.15) return { tone: 'warn', title: '관심은 높은데 구매로 이어지지 않습니다', bullets, actions: ['신제품 구역의 가격 표기와 시식 여부를 확인하세요.', '쇼케이스 앞 안내 문구와 진열 위치를 점검하세요.'] }
  if (popUp >= 0.12) return { tone: 'good', title: '신제품이 관심을 끌고 구매로 이어집니다', bullets, actions: ['재고 소진 속도를 보고 발주 권고를 확인하세요.'] }
  if (popUp < 0.05) return { tone: 'neutral', title: '신제품 구역이 눈에 띄지 않습니다', bullets, actions: ['입구에서 신제품 구역이 보이는지 POP 위치를 확인하세요.'] }
  return { tone: 'neutral', title: '평소와 비슷한 흐름입니다', bullets, actions: ['며칠 더 지켜보세요.'] }
}

/** 신제품 구역을 따로 지정하지 않은 경우: 그 구역 체류를 쇼케이스 앞(맛 고르기)에 합쳐서 센다 */
export function mergeNewZone(tracks: Track[]): Track[] {
  return tracks.map((t) => {
    const stays: Stay[] = []
    t.stays.forEach((s) => {
      const z: ZoneId = s.zone === 'pop' ? 'showcase' : s.zone
      const last = stays[stays.length - 1]
      if (last && last.zone === z && s.t0 - last.t1 <= 3) last.t1 = s.t1
      else stays.push({ zone: z, t0: s.t0, t1: s.t1 })
    })
    return { ...t, stays, popVisited: false, lastZone: t.lastZone === 'pop' ? 'showcase' : t.lastZone }
  })
}

/** 신제품 구역을 합친 도면에서 쇼케이스 앞 구역의 범위 */
export const MERGED_SHOWCASE: Rect = { x: 4.6, y: 3.7, w: 5.8, h: 1.9 }

export const heatCells = (m: FloorMetrics) => {
  const out: { x: number; y: number; v: number }[] = []
  m.heat.forEach((row, cy) => row.forEach((v, cx) => { if (v > 0) out.push({ x: cx * CELL, y: cy * CELL, v: v / (m.heatMax || 1) }) }))
  return out
}

/** 본사로 가는 15분 집계 이벤트의 예시. 개인별 동선, 사진, 얼굴은 들어가지 않는다. */
export function windowEvent(m: FloorMetrics, storeId: string, winLabel: string) {
  return {
    schema: 'zone.window/v1',
    store_id: storeId,
    window: winLabel,
    camera_id: 'cam-1',
    source: 'synthetic',
    zones: (['pop', 'showcase', 'queue', 'pos'] as ZoneId[]).map((z) => ({ zone_id: z, entries: m.zoneVisits[z], dwell_p50_sec: Math.round(m.zoneDwell[z]) })),
    min_group: 3,
  }
}
