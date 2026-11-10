/* 화면 공통 파생 값: 매장 상태, 결정 기록, 결정 대기 */
import { classify, diagnose, movers, verdict, DAYS, type Data, type Dir, type Store } from './data'

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


/* ---------- 결정 기록 ---------- */
export interface DirDecision { kind: 'dir'; day: number; choice: Dir; rec: Dir; note: string }
export interface FixRequest { kind: 'fix'; day: number; stores: string[] }
export interface RadarApproval { kind: 'radar'; state: 'approved' | 'deferred'; day: number; curve?: 'burst' | 'slow' | 'wave'; peakVal?: number; shape?: string }
/** 감지·결정 화면에서 내린 출시 결정. 결정 시점의 예측과 기대효과를 그대로 얼려 둔다 */
export interface LaunchDecision {
  kind: 'launch'; kw: string; /** 재료(kw)로 만든 조합 이름. 화면에는 이 이름으로 보이고 피드백은 kw 기준으로 한다 */ concept?: string; id: string; /** 맛 후보는 레이더 유형, 콜라보는 '콜라보' */ type: string; launch?: '새로운 맛' | '콜라보'; prob: number; detected: string; stores: string[]
  price: number; cannibal: number
  exp: { visitLo: number; visitHi: number; salesLo: number; salesHi: number }
}
export interface SkipDecision { kind: 'skip'; kw: string; prob: number; type: string }
/** 피드백 화면의 원인 분류. flavor는 맛 자체 (예전 기록의 event는 외부 이벤트) */
export type Cause = 'radar' | 'ops' | 'flavor' | 'event'
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

/** 결정 대기: 매장 반응의 재고 방향(dir), 피드백의 레이더 보정(radar) */
export interface Pending { dir: boolean; radar: boolean; count: number }
export function pending(data: Data, D: number, appr: Approvals): Pending {
  const v = verdict(data, D)
  const last = dirDecisions(appr, data.scn.id, D)[0]
  const dir = v.dir !== 'wait' && (!last || D - last.day >= 3 || last.rec !== v.dir)
  const cls = classify(data, D)
  const ra = appr[radarKey(data.scn.id)] as RadarApproval | undefined
  const radar = !!cls.kind && cls.type !== data.scn.radarShape && !(ra && ra.day <= D)
  return { dir, radar, count: Number(dir) + Number(radar) }
}

export function storeById(data: Data, id: string): Store | undefined { return data.stores.find((s) => s.id === id) }
export { DAYS }
