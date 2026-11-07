/* 콜라보 후보: 캐릭터·IP의 주간 검색량 곡선에서 급등 근거를 계산한다.
 * 실제 IP 검색량을 아직 연결하지 못해, 곡선은 시드로 만든 가상 시연값이다.
 * 연결할 때는 같은 모양의 CSV(키워드, 주 시작일, 검색량)로 series만 바꾸면 아래 계산은 그대로 쓴다. */
import { hash, rng } from './data'
import { RADAR } from './trend-data'
import { addWeeks } from './trend'

export const WEEKS = 104
export type CollabAction = '후보' | '관찰' | '제외'

export interface CollabItem {
  kw: string
  /** 최근 4주 평균 ÷ 직전 12주 평균 */
  jump: number
  /** 최근 4주 중 직전 주보다 오른 주 수 */
  rising: number
  /** 최근 4주 평균 ÷ 지난 1년 평균 */
  vsYear: number
  /** 지금 검색량 ÷ 2년 최고 (최고 = 100) */
  size: number
  /** 최근 4주 평균이 지난 1년 평균 이상으로 이어진 주 수 */
  steady: number
  action: CollabAction
  reason: string
  series: number[]
  /** 급등이 시작된 주 */
  since: string
}

/** 모양 이름은 시연용 가정: 급등 중, 완만 상승, 반짝 후 하락, 평탄 */
const IPS: { kw: string; shape: 'surge' | 'climb' | 'fade' | 'flat'; level: number }[] = [
  { kw: '몬치치', shape: 'surge', level: 8 },
  { kw: '포켓몬스터', shape: 'climb', level: 30 },
  { kw: '원피스', shape: 'surge', level: 22 },
  { kw: '치이카와', shape: 'climb', level: 12 },
  { kw: '짱구는 못말려', shape: 'flat', level: 18 },
  { kw: '쿠로미', shape: 'fade', level: 14 },
]

function make(kw: string, shape: (typeof IPS)[number]['shape'], level: number): number[] {
  const r = rng(hash('collab:' + kw))
  const raw = Array.from({ length: WEEKS }, (_, i) => {
    const n = 1 + (r() - 0.5) * 0.22
    const t = i - (WEEKS - 10) // 마지막 10주 구간
    let m = 1
    if (shape === 'surge' && t > 0) m = 1 + 0.55 * t * (t < 7 ? 1 : 0.9)
    if (shape === 'climb') m = 1 + (i / WEEKS) * 0.5 + (t > 0 ? 0.08 * t : 0) + 1.6 * Math.exp(-(((i - 34) / 7) ** 2))
    if (shape === 'fade') m = i > WEEKS - 22 ? Math.max(0.55, 2.2 - (i - (WEEKS - 22)) * 0.09) : 1.1
    return Math.max(0.2, level * m * n)
  })
  const hi = Math.max(...raw)
  return raw.map((v) => Math.round((v / hi) * 1000) / 10)
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)

export function collabItems(): CollabItem[] {
  const last = RADAR.meta.last
  return IPS.map(({ kw, shape, level }) => {
    const s = make(kw, shape, level)
    const n = s.length
    const l4 = s.slice(n - 4), p12 = s.slice(n - 16, n - 4), yr = s.slice(n - 52)
    const jump = avg(l4) / Math.max(0.1, avg(p12))
    const vsYear = avg(l4) / Math.max(0.1, avg(yr))
    const rising = l4.filter((v, i) => v > (i === 0 ? s[n - 5] : l4[i - 1])).length
    const size = s[n - 1]
    let steady = 0
    for (let i = n - 1; i >= 0 && s[i] >= avg(yr); i--) steady++
    const action: CollabAction = jump >= 1.5 && size >= 20 ? '후보' : jump >= 1.25 ? '관찰' : '제외'
    const reason = action === '후보' ? `직전 3개월보다 ${jump.toFixed(1)}배, 최근 4주 중 ${rising}주 상승` : action === '관찰' ? (size < 20 ? '오르지만 전성기 대비 규모가 작음' : '오름폭이 아직 작음') : '급등 신호 없음'
    let since = ''
    for (let i = n - 1; i > 0; i--) if (s[i] < avg(yr) * 1.15) { since = addWeeks(last, i + 1 - n); break }
    return { kw, jump, rising, vsYear, size, steady, action, reason, series: s, since: since || addWeeks(last, 1 - n) }
  }).sort((a, b) => b.jump - a.jump)
}

export const COLLABS = collabItems()
export const collabStart = () => addWeeks(RADAR.meta.last, 1 - WEEKS)
