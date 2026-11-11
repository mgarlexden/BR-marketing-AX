/* 화면 공통 파생 값: 매장 상태, 변화 알림, 결정 대기 */
import { classify, diagnose, liveStores, movers, shortName, verdict, DAYS, type Data, type Dir, type Store } from './data'

export type StatusKey = 'stockout' | 'check' | 'surge' | 'drop' | 'normal'
export interface StoreStatus { key: StatusKey; label: string; tone: 'bad' | 'warn' | 'primary' | 'good' | 'neutral' }

/** 매장 한 곳의 현재 상태. 위에 있는 것이 우선한다. */
export function storeStatuses(data: Data, D: number): Record<string, StoreStatus> {
  const diag = diagnose(data, D)
  const mv = movers(data, D, 5, 3)
  const out: Record<string, StoreStatus> = {}
  liveStores(data).forEach((st) => {
    const row = diag.rows.find((r) => r.st.id === st.id)!
    const m = mv.find((r) => r.st.id === st.id)!
    let s: StoreStatus = { key: 'normal', label: '정상', tone: 'neutral' }
    if (st.series[D].out) s = { key: 'stockout', label: '품절 의심', tone: 'bad' }
    else if (row.zone === 'flag') s = { key: 'check', label: '구매 점검', tone: 'warn' }
    else if (m.alert) s = m.delta > 0 ? { key: 'surge', label: '급등', tone: 'primary' } : { key: 'drop', label: '급락', tone: 'bad' }
    out[st.id] = s
  })
  return out
}

export interface FeedItem { day: number; text: string; tone: 'bad' | 'warn' | 'primary' | 'good' | 'neutral'; store?: string }
/** D일까지 생긴 변화 알림을 최근 순으로 */
export function feed(data: Data, D: number, limit = 10): FeedItem[] {
  const items: FeedItem[] = []
  let prevFlag = new Set<string>()
  let prevAlert = new Set<string>()
  let prevDir: Dir | null = null
  for (let d = 1; d <= D; d++) {
    const v = verdict(data, d).dir
    if (prevDir && v !== prevDir && v !== 'wait' && prevDir !== 'wait') items.push({ day: d, text: `판정이 ${LABEL[prevDir]}에서 ${LABEL[v]}로 바뀜`, tone: 'primary' })
    prevDir = v
    const flag = new Set(diagnose(data, d).rows.filter((r) => r.zone === 'flag').map((r) => r.st.id))
    flag.forEach((id) => { if (!prevFlag.has(id)) { const st = data.stores.find((s) => s.id === id)!; items.push({ day: d, text: `${shortName(st)} 구매 전환 낮음`, tone: 'warn', store: id }) } })
    prevFlag = flag
    const al = movers(data, d, 5, 3).filter((r) => r.alert)
    const alSet = new Set(al.map((r) => r.st.id))
    al.forEach((r) => { if (!prevAlert.has(r.st.id)) items.push({ day: d, text: `${shortName(r.st)} 순위 ${r.delta > 0 ? '급등' : '급락'} ${Math.abs(r.delta)}계단`, tone: r.delta > 0 ? 'primary' : 'bad', store: r.st.id }) })
    prevAlert = alSet
    liveStores(data).forEach((st) => { if (st.series[d].out && !st.series[d - 1].out) items.push({ day: d, text: `${shortName(st)} 품절 의심`, tone: 'bad', store: st.id }) })
  }
  return items.sort((a, b) => b.day - a.day).slice(0, limit)
}

/** 선출시 매장의 판매 추세: 최근 3일과 직전 3일의 하루 평균 비교, 같은 6일 동안 품절 의심이 있던 매장·일 수 */
export function salesTrend(data: Data, D: number): { growth: number | null; out: number } {
  const pil = data.stores.filter((s) => s.pilot)
  const perDay = (from: number, to: number) => {
    let sum = 0
    for (let d = from; d <= to; d++) pil.forEach((st) => { sum += st.series[d].sales })
    return sum / (to - from + 1)
  }
  const start = Math.max(0, D - 5)
  const prev = D >= 3 ? perDay(start, D - 3) : 0
  const out = pil.filter((st) => st.series.slice(start, D + 1).some((p) => p.out)).length
  return { growth: prev > 0 ? perDay(D - 2, D) / prev - 1 : null, out }
}

/** 판촉이 판매를 얼마나 늘렸나: 선출시 매장의 실제 판매와, 판촉이 없었을 때의 방문에 매장 구매 전환을 곱한 예상 판매를 비교한다 */
export function promoLift(data: Data, D: number): { lift: number | null; extra: number } {
  let sold = 0, base = 0
  data.stores.filter((s) => s.pilot).forEach((st) => {
    for (let d = 0; d <= D; d++) { sold += st.series[d].sales; base += st.series[d].ctrlVis * st.conv0 * st.conv }
  })
  return { lift: base > 0 ? sold / base - 1 : null, extra: sold - base }
}

export type VerdictCause = '맛' | '트렌드 오판' | '외부 이벤트'
/** 보완·정리 판정의 원인 추정 (자체 규칙). 구매 점검 매장의 절반 이상이 최근 3일 행사 중이면 외부 이벤트.
 *  보완은 체류는 늘었는데 구매가 안 되면 맛을 먼저 보고, 정리는 레이더가 본 곡선과 다르면 트렌드 오판을 먼저 본다 */
export function verdictCause(data: Data, D: number, dir: Dir): VerdictCause | null {
  if (dir !== 'fix' && dir !== 'wrap') return null
  const flagged = diagnose(data, D).rows.filter((r) => r.zone === 'flag')
  const inEvent = flagged.filter((r) => r.st.event && r.st.evStart !== undefined && r.st.evStart <= D && r.st.evStart + 2 >= D - 2).length
  if (flagged.length && inEvent * 2 >= flagged.length) return '외부 이벤트'
  const cls = classify(data, D)
  const offCurve = !!cls.kind && cls.type !== data.scn.radarShape
  const curious = flagged.filter((r) => r.dwell > 0.2).length * 2 >= flagged.length && flagged.length > 0
  if (dir === 'fix') return curious || !offCurve ? '맛' : '트렌드 오판'
  return offCurve ? '트렌드 오판' : '맛'
}

const LABEL: Record<Dir, string> = { wait: '관찰 중', expand: '확대 필요', maintain: '유지', fix: '보완 필요', wrap: '정리' }

/* ---------- 결정 기록 ---------- */
export interface DirDecision { kind: 'dir'; day: number; choice: Dir; rec: Dir; note: string }
export interface FixRequest { kind: 'fix'; day: number; stores: string[] }
export interface RadarApproval { kind: 'radar'; state: 'approved' | 'deferred'; day: number; curve?: 'burst' | 'slow' | 'wave'; peakVal?: number; shape?: string }
/** 감지·결정 화면에서 내린 출시 결정. 결정 시점의 예측과 기대효과를 그대로 얼려 둔다 */
export interface LaunchDecision {
  kind: 'launch'; kw: string; /** 재료(kw)로 만든 조합 이름. 화면에는 이 이름으로 보이고 환류는 kw 기준으로 한다 */ concept?: string; id: string; /** 맛 후보는 레이더 유형, 콜라보는 '콜라보' */ type: string; launch?: '새로운 맛' | '콜라보'; prob: number; detected: string; stores: string[]
  price: number; cannibal: number
  exp: { visitLo: number; visitHi: number; salesLo: number; salesHi: number }
}
export interface SkipDecision { kind: 'skip'; kw: string; prob: number; type: string }
/** 환류 화면의 학습 판단 */
/** 판매가 예상과 어긋난 원인: 방문 부족(트렌드·노출), 구매 전환 낮음(맛·진열), 품절·행사(운영 이벤트) */
export type Cause = 'visit' | 'conv' | 'event'
/** 예전에 저장된 기록(radar, ops)도 새 분류로 읽는다 */
export const causeOf = (c: string): Cause => (c === 'radar' ? 'visit' : c === 'ops' ? 'conv' : (c as Cause))
export interface LearnDecision { kind: 'learn'; scn: string; day: number; cause: Cause; use: 'use' | 'exclude' | 'hold'; note: string }
export type Approvals = Record<string, DirDecision | FixRequest | RadarApproval | LaunchDecision | SkipDecision | LearnDecision>

export const launchKey = (kw: string) => `launch:${kw}`
export const skipKey = (kw: string) => `skip:${kw}`
export const learnKey = (scn: string) => `${scn}:learn`
export const launchesOf = (appr: Approvals): LaunchDecision[] => Object.values(appr).filter((v): v is LaunchDecision => v.kind === 'launch')
export const skipsOf = (appr: Approvals): SkipDecision[] => Object.values(appr).filter((v): v is SkipDecision => v.kind === 'skip')

export const dirKey = (scn: string, day: number) => `${scn}:dir:${day}`
export const fixKey = (scn: string, day: number) => `${scn}:fix:${day}`
export const radarKey = (scn: string) => `${scn}:radar`

export function dirDecisions(appr: Approvals, scn: string, D: number): DirDecision[] {
  return Object.entries(appr).filter(([k, v]) => k.startsWith(scn + ':dir:') && v.kind === 'dir' && v.day <= D).map(([, v]) => v as DirDecision).sort((a, b) => b.day - a.day)
}
export function fixRequests(appr: Approvals, scn: string, D: number): FixRequest[] {
  return Object.entries(appr).filter(([k, v]) => k.startsWith(scn + ':fix:') && v.kind === 'fix' && v.day <= D).map(([, v]) => v as FixRequest).sort((a, b) => b.day - a.day)
}

export interface Pending { dir: boolean; fix: boolean; radar: boolean; count: number }
export function pending(data: Data, D: number, appr: Approvals): Pending {
  const v = verdict(data, D)
  const last = dirDecisions(appr, data.scn.id, D)[0]
  const dir = v.dir !== 'wait' && (!last || D - last.day >= 3 || last.rec !== v.dir)
  const flagged = diagnose(data, D).rows.filter((r) => r.zone === 'flag').length
  const lastFix = fixRequests(appr, data.scn.id, D)[0]
  const fix = flagged >= 2 && !(lastFix && D - lastFix.day < 3)
  const cls = classify(data, D)
  const ra = appr[radarKey(data.scn.id)] as RadarApproval | undefined
  const radar = !!cls.kind && cls.type !== data.scn.radarShape && !(ra && ra.day <= D)
  return { dir, fix, radar, count: Number(dir) + Number(fix) + Number(radar) }
}

export function storeById(data: Data, id: string): Store | undefined { return data.stores.find((s) => s.id === id) }
export { DAYS }
