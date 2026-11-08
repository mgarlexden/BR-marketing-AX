/* 화면 공통 파생 값: 매장 상태, 변화 알림, 결정 대기 */
import { classify, diagnose, movers, shortName, verdict, DAYS, type Data, type Dir, type Store } from './data'

export type StatusKey = 'stockout' | 'check' | 'surge' | 'drop' | 'normal'
export interface StoreStatus { key: StatusKey; label: string; tone: 'bad' | 'warn' | 'primary' | 'good' | 'neutral' }

/** 매장 한 곳의 현재 상태. 위에 있는 것이 우선한다. */
export function storeStatuses(data: Data, D: number): Record<string, StoreStatus> {
  const diag = diagnose(data, D)
  const mv = movers(data, D, 5, 3)
  const out: Record<string, StoreStatus> = {}
  data.stores.forEach((st) => {
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
    if (prevDir && v !== prevDir && v !== 'wait' && prevDir !== 'wait') items.push({ day: d, text: `판정이 ${LABEL[prevDir]}에서 ${LABEL[v]}(으)로 바뀜`, tone: 'primary' })
    prevDir = v
    const flag = new Set(diagnose(data, d).rows.filter((r) => r.zone === 'flag').map((r) => r.st.id))
    flag.forEach((id) => { if (!prevFlag.has(id)) { const st = data.stores.find((s) => s.id === id)!; items.push({ day: d, text: `${shortName(st)} 구매 전환 낮음`, tone: 'warn', store: id }) } })
    prevFlag = flag
    const al = movers(data, d, 5, 3).filter((r) => r.alert)
    const alSet = new Set(al.map((r) => r.st.id))
    al.forEach((r) => { if (!prevAlert.has(r.st.id)) items.push({ day: d, text: `${shortName(r.st)} 순위 ${r.delta > 0 ? '급등' : '급락'} ${Math.abs(r.delta)}계단`, tone: r.delta > 0 ? 'primary' : 'bad', store: r.st.id }) })
    prevAlert = alSet
    data.stores.forEach((st) => { if (st.series[d].out && !st.series[d - 1].out) items.push({ day: d, text: `${shortName(st)} 품절 의심`, tone: 'bad', store: st.id }) })
  }
  return items.sort((a, b) => b.day - a.day).slice(0, limit)
}

const LABEL: Record<Dir, string> = { wait: '관찰 중', expand: '확대', maintain: '유지', fix: '보완', wrap: '정리' }

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
export type Cause = 'radar' | 'ops' | 'event'
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
