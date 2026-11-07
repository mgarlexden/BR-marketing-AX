/* 시식→구매 연결: LLM 없이 시간 기준 규칙으로 맞춘다 (문서 2.4).
 * 입력은 가상 카메라의 구역 이벤트(트랙)와 합성 POS 주문 로그. 개인 식별은 쓰지 않고, 트랙 번호는 이 계산 안에서만 쓰는 임시 번호다.
 * 합성이라 정답(어느 주문이 어느 트랙의 것인지)을 알 수 있어서, 확정한 건이 실제로 맞았는지도 같이 센다. */
import { hash, rng } from './data'
import { WINDOWS, type Track } from './floor'

/** 결제 시각 직전 이 시간(초) 안에 계산대 구역에 있던 트랙을 후보로 본다 */
export const MATCH_WINDOW = 90
/** 후보가 둘 이상일 때 대기줄에 먼저 선 사람과 다음 사람의 간격이 이보다 좁으면 미확정 (초) */
export const FIFO_MARGIN = 8

export interface Order { id: number; ts: number; item: 'new' | 'other'; truth: number | null }
export interface MatchResult {
  orders: number; confirmed: number; ambiguous: number; unseen: number; correct: number
  /** 확정 건 ÷ 전체 주문 */
  rate: number
  /** 확정 건 중 실제로 맞은 비율 (합성이라 계산할 수 있다) */
  precision: number
  newAfterVisit: number; otherAfterVisit: number; newWithoutVisit: number
  /** 15분 단위 집계: 신제품 구역 방문자 수와 신제품 주문 수 */
  bins: { label: string; visitors: number; newSales: number }[]
}

const stayOf = (t: Track, zone: string) => t.stays.find((s) => s.zone === zone)

export function buildOrders(tracks: Track[], seed: string, win: number): Order[] {
  const orders: Order[] = []
  tracks.forEach((t) => {
    if (t.outcome !== 'buy') return
    const pos = stayOf(t, 'pos')
    if (!pos) return
    const r = rng(hash(seed + ':item:' + t.id))
    orders.push({ id: orders.length, ts: pos.t0 + 0.6 * (pos.t1 - pos.t0), item: r() < (t.popVisited ? 0.85 : 0.12) ? 'new' : 'other', truth: t.id })
  })
  // 카메라 밖에서 들어온 주문(포장, 배달, 키오스크)은 맞출 트랙이 없다
  const w = WINDOWS[win], r = rng(hash(seed + ':unseen'))
  const extra = Math.max(1, Math.round(tracks.length * 0.1))
  for (let i = 0; i < extra; i++) orders.push({ id: orders.length, ts: w.start + r() * (w.end - w.start), item: r() < 0.3 ? 'new' : 'other', truth: null })
  return orders.sort((a, b) => a.ts - b.ts)
}

export function runMatch(tracks: Track[], seed: string, win: number): MatchResult {
  const orders = buildOrders(tracks, seed, win)
  const used = new Set<number>()
  const byId = new Map(tracks.map((t) => [t.id, t]))
  let confirmed = 0, ambiguous = 0, unseen = 0, correct = 0, newAfterVisit = 0, otherAfterVisit = 0, newWithoutVisit = 0
  orders.forEach((o) => {
    const cands = tracks.filter((t) => {
      if (used.has(t.id)) return false
      const p = stayOf(t, 'pos')
      return !!p && p.t0 <= o.ts && p.t1 >= o.ts - MATCH_WINDOW
    })
    if (cands.length === 0) { unseen++; return }
    const queueAt = (t: Track) => (stayOf(t, 'queue') ?? stayOf(t, 'pos')!).t0
    const sorted = cands.slice().sort((a, b) => queueAt(a) - queueAt(b))
    if (sorted.length > 1 && queueAt(sorted[1]) - queueAt(sorted[0]) < FIFO_MARGIN) { ambiguous++; return }
    const pick = sorted[0]
    used.add(pick.id)
    confirmed++
    if (o.truth === pick.id) correct++
    const tr = byId.get(pick.id)!
    if (tr.popVisited) { if (o.item === 'new') newAfterVisit++; else otherAfterVisit++ } else if (o.item === 'new') newWithoutVisit++
  })
  const w = WINDOWS[win]
  const bins = Array.from({ length: Math.round((w.end - w.start) / 900) }, (_, i) => {
    const a = w.start + i * 900, b = a + 900
    const hh = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
    return {
      label: hh(a),
      visitors: tracks.filter((t) => { const p = stayOf(t, 'pop'); return !!p && p.t0 >= a && p.t0 < b }).length,
      newSales: orders.filter((o) => o.item === 'new' && o.ts >= a && o.ts < b).length,
    }
  })
  return {
    orders: orders.length, confirmed, ambiguous, unseen, correct,
    rate: orders.length ? confirmed / orders.length : 0,
    precision: confirmed ? correct / confirmed : 0,
    newAfterVisit, otherAfterVisit, newWithoutVisit, bins,
  }
}
