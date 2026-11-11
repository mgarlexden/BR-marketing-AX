/* 출시 결정으로 생기는 선출시 맛, 결정 시점의 기대효과, 피드백의 베타 갱신 */
import { build, hash, mean, rng, SCENARIOS, SCN_AMP, TYPE_SPEC, TYPE_WEIGHT, TYPES, unit, type Data, type Kind, type Scenario, type ShapeName, type StoreType } from './data'
import { launchesOf, type Approvals } from './derived'

/** 개발 13주 뒤 선출시가 시작됐다고 가정할 때 화면이 열리는 시점 (출시 후 경과일) */
export const SIM_DAY = 14
export const MAX_SLOTS = 5

const KIND_OF: Record<string, Kind> = { 단발형: 'burst', 완만형: 'slow', 반복형: 'wave', 보류: 'slow' }
const SHAPE_OF: Record<Kind, ShapeName> = { burst: '단발형', slow: '완만형', wave: '반복형' }
export const kindOfType = (t: string): Kind => KIND_OF[t] ?? 'slow'

/** 키워드 하나가 선출시 맛이 된다. 레이더가 본 유형이 예상이고, 실제 매장 반응은 합성이라 생존 확률이 높을수록 예상대로 갈 확률이 크다 */
export function launchScenario(l: { kw: string; concept?: string; id: string; type: string; prob: number; stores: string[]; launch?: '새로운 맛' | '콜라보' }): Scenario {
  const radarKind = kindOfType(l.type)
  const r = rng(hash('outcome:' + l.kw))
  const others = (['burst', 'slow', 'wave'] as Kind[]).filter((k) => k !== radarKind)
  const kind = r() < 0.35 + 0.5 * l.prob ? radarKind : others[Math.floor(r() * others.length)]
  return {
    id: l.id, label: l.concept ?? l.kw, launch: l.launch ?? '새로운 맛', kind, radarKind, shape: SHAPE_OF[kind], radarShape: SHAPE_OF[radarKind], today: SIM_DAY,
    blurb: l.launch === '콜라보' ? `${l.kw} 콜라보. 개발 13주 뒤 선출시 ${l.stores.length}곳 가정.` : `레이더가 ${l.type}으로 본 키워드로 출시한 맛. 개발 13주 뒤 선출시 ${l.stores.length}곳 가정.`, pilotIds: l.stores, kw: l.kw,
  }
}
export const launchId = (kw: string) => 'k' + hash(kw).toString(36)

export function scenarioList(appr: Approvals): Scenario[] {
  const base = Object.values(SCENARIOS)
  const extra = launchesOf(appr).map(launchScenario)
  return [...base, ...extra].slice(0, MAX_SLOTS)
}

const cache = new Map<string, Data>()
export function dataFor(scn: Scenario): Data {
  const key = scn.id + ':' + (scn.pilotIds ?? []).join(',') + scn.kind
  let d = cache.get(key)
  if (!d) { d = build(scn.id, scn); cache.set(key, d) }
  return d
}

/* ---------- 기대효과 (가정 범위) ---------- */
export const ASSUME = { price: 9000, cannibal: 0.2, width: [0.6, 1.4] as const }
const baseStores = () => dataFor(SCENARIOS.a).stores

/** 선택한 대표 매장에서 4주 동안(D+1~D+28) 기대하는 대조 대비 방문 증가와 매장당 매출 순증.
 *  유형별로 평균을 낸 뒤 유형 가중치(서울 후보 매장 수 비중)를 곱해 전국 평균으로 바꾼다.
 *  사례가 없어 상권 유형별 가정 진폭을 쓴다. 모델이 아니라 기준 범위이고, 반응이 며칠 이어질지는 예측하지 않는다. */
export function expectedEffect(type: string, storeIds: string[], price = ASSUME.price, cannibal = ASSUME.cannibal) {
  const kind = kindOfType(type)
  const sts = baseStores().filter((s) => storeIds.includes(s.id))
  const empty = { visitLo: 0, visitHi: 0, salesLo: 0, salesHi: 0, n: 0, covered: 0, rows: [] as { type: StoreType; n: number; weight: number; visit: number }[] }
  if (!sts.length) return empty
  const rows: typeof empty.rows = []
  let visit = 0, sales = 0, wsum = 0
  TYPES.forEach((t) => {
    const list = sts.filter((s) => s.type === t)
    if (!list.length) return
    const sp = TYPE_SPEC[t]
    const wk = mean(sp.wk)
    let v = 0, extra = 0
    list.forEach((s) => {
      let sumR = 0, sumV = 0
      for (let d = 1; d <= 28; d++) { const r = SCN_AMP[kind] * sp.amp * unit(kind, d, sp.speed); sumR += r; sumV += s.base * wk * r }
      v += sumR / 28
      extra += sumV
    })
    const w = TYPE_WEIGHT[t]
    rows.push({ type: t, n: list.length, weight: w, visit: v / list.length })
    visit += (w * v) / list.length
    sales += (w * extra * price * (1 - cannibal)) / list.length / 10000
    wsum += w
  })
  const [lo, hi] = ASSUME.width
  visit /= wsum; sales /= wsum
  return { visitLo: visit * lo, visitHi: visit * hi, salesLo: sales * lo, salesHi: sales * hi, n: sts.length, covered: wsum, rows }
}

/** 기본 선출시 매장: 손님 유형마다 대표 3곳, 총 15곳 */
export function recommendedStores(): string[] {
  return dataFor(SCENARIOS.a).stores.filter((s) => s.place.rep).map((s) => s.id)
}

/* ---------- 피드백: 맞음/틀림을 베타 분포로 ---------- */
export function betaStats(k: number, m: number) {
  const a = 1 + k, b = 1 + m
  const N = 2000, xs: number[] = [], pdf: number[] = []
  let tot = 0
  for (let i = 1; i < N; i++) { const x = i / N; const v = Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x)); xs.push(x); pdf.push(v); tot += v }
  let c = 0, lo = 0, hi = 1
  for (let i = 0; i < xs.length; i++) { c += pdf[i] / tot; if (c < 0.05) lo = xs[i]; if (c < 0.95) hi = xs[i] }
  return { mean: a / (a + b), lo, hi }
}
