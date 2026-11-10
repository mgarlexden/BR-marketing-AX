/* 피드백: 선출시 결과가 기대와 어긋난 원인 찾기. 지표마다 '기대 대비 어긋난 정도(0~1)'를 내고, 가장 큰 지표가 속한 묶음을 원인으로 본다 */
import { classify, diagnose, hash, mean, radarCurve, rng, type Classification, type Data } from './data'
import { metrics, simInputFor, simulate } from './floor'
import { expectedEffect } from './launch'
import type { Cause } from './derived'

export const CAUSE_LABEL: Record<Cause, string> = { ops: '매장 실행', flavor: '맛 자체', radar: '레이더 오판', event: '외부 이벤트' }
export const CAUSE_HINT: Record<Cause, string> = {
  ops: '노출, 시식, 매장별 운영이 기대에 못 미침',
  flavor: '들러서 맛봤지만 사지 않거나 다시 사지 않음',
  radar: '레이더가 본 반응 모양이나 크기가 실제와 다름',
  event: '행사, 날씨, 바이럴 같은 일회성 요인',
}
/** 원인 분석 기준 (자체 가정) */
export const CAUSE_RULE = {
  /** 신제품 구역 방문: 출시 전보다 이만큼(%p) 늘어야 기대만큼 */ zoneUp: 0.1,
  /** 시식률 목표 */ taste: 0.25,
  /** 재구매율 목표 */ repeat: 0.2,
  /** 매장별 전환 차이: 전환이 전체 중앙값보다 이만큼 낮은 매장을 센다 */ storeLow: -0.5,
  /** 기대 방문 범위를 이만큼 넘게 벗어나야 레이더 오답으로 본다 */ rangeTol: 0.15,
  /** 가장 큰 어긋남이 이보다 작으면 원인 없음 (기대대로) */ minGap: 0.1,
  /** 학습 판단을 시작하는 출시 후 일수 */ ready: 7,
}

export type CauseMetricId = 'zone' | 'taste' | 'conv' | 'repeat' | 'storeGap' | 'shape' | 'range'
export interface CauseMetric {
  id: CauseMetricId; label: string; group: Exclude<Cause, 'event'>; value: string; expect: string
  /** 기대 대비 어긋난 정도 0~1 */ gap: number; sources: ('br' | 'vision' | 'assume' | 'sim')[]
}
export interface CauseResult {
  metrics: CauseMetric[]; top: CauseMetric; cause: Cause | null
  cls: Classification; radarWrong: boolean
  curve: { orig: number[]; fixed: number[] | null; actual: number[] }
  /** 레이더 예상 곡선과 실제의 평균 차이: 지금, 정답으로 보정한 뒤 */ errBefore: number; errAfter: number | null
  exp: { visitLo: number; visitHi: number }; act: number
}

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const pc = (x: number) => `${Math.round(x * 100)}%`

export function causeAnalysis(d: Data, D: number): CauseResult {
  const R = CAUSE_RULE
  const pil = d.stores.filter((s) => s.pilot)
  let zA = 0, zB = 0, bA = 0, bB = 0
  pil.forEach((st) => {
    const p = st.series[D]
    const a = metrics(simulate(simInputFor(st, p, 0, false))), b = metrics(simulate(simInputFor(st, p, 0, true)))
    zA += a.popRate; zB += b.popRate; bA += a.popBuyRate; bB += b.popBuyRate
  })
  const n = pil.length || 1
  zA /= n; zB /= n; bA /= n; bB /= n
  // 시식률과 재구매율은 카메라·멤버십 연결 전이라 구역 방문과 구매율에 맞춘 시연값이다
  const r = rng(hash(d.scn.id + ':taste'))
  const taste = zA * (0.4 + 0.3 * r())
  const repeat = 0.1 + 0.12 * Math.min(1.3, bA / Math.max(0.01, bB)) * (0.6 + 0.8 * r())
  const diag = diagnose(d, D).rows.filter((x) => x.st.pilot)
  const low = diag.filter((x) => x.y <= R.storeLow).length
  const cls = classify(d, D)
  const shapeGap = cls.type === '판정 보류' || cls.type === d.scn.radarShape ? 0 : cls.conf === '높음' ? 1 : cls.conf === '중간' ? 0.7 : 0.4
  const exp = expectedEffect(d.scn.radarShape, pil.map((s) => s.id))
  const act = mean(d.netAgg.slice(1, D + 1))
  const rangeGap = act < exp.visitLo ? clamp((exp.visitLo - act) / Math.max(0.01, exp.visitLo)) : act > exp.visitHi ? clamp((act - exp.visitHi) / Math.max(0.01, exp.visitHi)) : 0
  const zoneTarget = zB + R.zoneUp
  const list: CauseMetric[] = [
    { id: 'zone', label: '신제품 구역 방문', group: 'ops', value: pc(zA), expect: `출시 전 ${pc(zB)} +${R.zoneUp * 100}%p`, gap: clamp((zoneTarget - zA) / zoneTarget), sources: ['vision', 'assume'] },
    { id: 'taste', label: '시식률', group: 'ops', value: pc(taste), expect: `${R.taste * 100}% 이상`, gap: clamp((R.taste - taste) / R.taste), sources: ['vision', 'sim'] },
    { id: 'storeGap', label: '매장별 전환 차이', group: 'ops', value: `${low}곳이 50% 낮음`, expect: '0곳', gap: clamp(low / n), sources: ['br'] },
    { id: 'conv', label: '전환율', group: 'flavor', value: pc(bA), expect: `출시 전 ${pc(bB)} 이상`, gap: clamp((bB - bA) / Math.max(0.01, bB)), sources: ['vision', 'br'] },
    { id: 'repeat', label: '재구매율', group: 'flavor', value: pc(repeat), expect: `${R.repeat * 100}% 이상`, gap: clamp((R.repeat - repeat) / R.repeat), sources: ['br', 'sim'] },
    { id: 'shape', label: '유형 예측 vs 실측', group: 'radar', value: `${d.scn.radarShape} → ${cls.type}`, expect: '같은 유형', gap: shapeGap, sources: ['vision'] },
    { id: 'range', label: '기대 방문 범위 vs 실측', group: 'radar', value: `+${Math.round(exp.visitLo * 100)}~${Math.round(exp.visitHi * 100)}% → ${act >= 0 ? '+' : '−'}${Math.abs(Math.round(act * 100))}%`, expect: '범위 안', gap: rangeGap, sources: ['vision', 'assume'] },
  ]
  const top = list.reduce((a, b) => (b.gap > a.gap ? b : a))
  const orig = radarCurve(d, false)
  const fixed = cls.kind ? radarCurve(d, true, { kind: cls.kind, peakVal: cls.peakVal }) : null
  const actual = d.agg
  const err = (c: number[]) => mean(actual.slice(0, D + 1).map((v, i) => Math.abs(v - c[i])))
  return {
    metrics: list, top, cause: top.gap >= R.minGap ? top.group : null, cls,
    radarWrong: shapeGap > 0 || rangeGap >= R.rangeTol,
    curve: { orig, fixed, actual }, errBefore: err(orig), errAfter: fixed ? err(fixed) : null, exp, act,
  }
}
