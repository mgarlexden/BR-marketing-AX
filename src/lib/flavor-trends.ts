/* 트렌드 화면의 상위 묶음: 레이더 키워드(재료)를 맛 트렌드로 묶고, 묶음 지수와 출시 타이밍을 계산한다.
 * 수치는 모두 RADAR 실데이터에서 나온다. 묶는 방식과 조합(concepts)만 팀 가설이고 화면에 '가정'으로 표시한다.
 * 배라에 이미 있는 재료는 br-history 규칙으로 걸러 낸다. 콜라보(IP)도 같은 모양의 목록 행으로 만든다. */
import { RADAR } from './trend-data'
import type { RadarItem } from './trend'
import { COLLABS, type CollabItem } from './collab'
import { brKept, brRecord, type BrRecord } from './br-history'

const { meta, items } = RADAR
export const H = meta.horizon
/** 이달의 맛 판매 기간 (주) */
export const SALE = 4
/** 트렌드 하나에 쓰는 핵심 재료 수 */
export const MAX_INGREDIENTS = 3
/** 추천 조합 3개 안에서 같은 재료가 나올 수 있는 최대 횟수 */
export const MAX_REPEAT = 2

export type TrendStatus = '뜨는 중' | '스테디' | '정점' | '하락'
export type TimingVerdict = '지금' | '선점' | '관찰' | '늦음'
export const VERDICT_LABEL: Record<TimingVerdict, string> = { 지금: '지금 출시', 선점: '먼저 출시', 관찰: '지켜보기', 늦음: '이번엔 늦음' }
export type ConceptTag = '빠른 대응형' | '트렌드 결합형' | '정면 승부형'

/** 아이스크림 그림: 아이스크림·리본(시럽 띠)·토핑 색, 컵 색(트렌드 테마마다 하나, 아이스크림과 다른 색), 토핑 모양(조각 또는 동글) */
export interface Art { scoop: string; ribbon: string; bits: string; cup?: string; bit?: 'chunk' | 'round' }
/** 조합 재료. blend는 기존 베이스에 섞어 배합을 조정하는 재료, isNew는 베이스를 새로 개발한다는 뜻, existing은 바탕이 되는 배라 기존 맛 */
interface ConceptDef { name: string; lead: string; base: string; blend?: string; isNew?: boolean; ribbon: string; topping: string; existing: string; art: Art }
export interface Concept extends ConceptDef { id: string; tag: ConceptTag; keys: string[] }
interface ThemeDef { id: string; name: string; art: Art; desc: string; ingredients: string[]; risk: string; checks: string[]; concepts: ConceptDef[] }

const THEMES: ThemeDef[] = [
  {
    id: 'chewy', name: '쫀득한 떡·모찌', art: { scoop: '#EADBC0', ribbon: '#5A3A22', bits: '#B08A5E', cup: '#8E3442', bit: 'round' },
    desc: '찹쌀모찌를 중심으로 쫀득한 떡 식감 재료의 검색이 올랐습니다. 잔기지떡은 매년 같은 철에 돌아오는 재료입니다.',
    ingredients: ['찹쌀모찌', '찹쌀떡', '잔기지떡'],
    risk: '떡은 얼면 딱딱해져 식감 유지 배합 검증이 먼저 필요합니다. 모찌가 녹으면서 아이스크림과 분리되지 않는지도 봐야 합니다.',
    checks: ['냉동 상태에서 떡 식감 유지', '조각 크기와 스쿱 작업성', '쌀 원료 원가와 공급처', '기존 떡 메뉴와의 겹침'],
    concepts: [
      { name: '흑당 찹쌀모찌 바닐라', lead: '찹쌀모찌', base: '바닐라', ribbon: '흑당', topping: '찹쌀모찌 조각', existing: '바닐라', art: { scoop: '#F3E6C9', ribbon: '#5A3A22', bits: '#FBF7EF', bit: 'round' } },
      { name: '인절미 모찌 그린티', lead: '찹쌀모찌', base: '그린티', blend: '볶은 콩가루', ribbon: '연유', topping: '찹쌀모찌 조각', existing: '그린티', art: { scoop: '#A9C08A', ribbon: '#FFF7E8', bits: '#F5EEDF', bit: 'round' } },
      { name: '잔기지떡 프랄린', lead: '잔기지떡', base: '프랄린 앤 크림', ribbon: '카라멜', topping: '잔기지떡 조각', existing: '프랄린 앤 크림', art: { scoop: '#E2C48F', ribbon: '#B9772F', bits: '#C79A62', bit: 'round' } },
      { name: '콩가루 잔기지떡', lead: '잔기지떡', base: '콩가루 아이스크림', isNew: true, ribbon: '흑당', topping: '잔기지떡 조각', existing: '바닐라', art: { scoop: '#CDAE76', ribbon: '#5A3A22', bits: '#E8CFA0', bit: 'round' } },
    ],
  },
  {
    id: 'choco', name: '겨울 초콜릿·향신료', art: { scoop: '#7A4E36', ribbon: '#2F1D16', bits: '#3A241A', cup: '#A3262E' },
    desc: '생초콜릿과 핫초코, 진저브레드처럼 겨울에 돌아오는 초콜릿·향신료 재료입니다. 모두 매년 같은 철에 검색이 오르는 반복형이라 출시 시점이 핵심입니다.',
    ingredients: ['생초콜릿', '진저브레드', '핫초코', '생강 쿠키'],
    risk: '시즌이 짧아 출시가 늦으면 다음 해를 기다려야 합니다. 생강 같은 향신료는 호불호가 갈려 농도 검증이 필요합니다.',
    checks: ['시즌 정점에 맞는 출시일', '향신료 농도별 시식 평가', '초콜릿 원가와 공급처', '기존 초콜릿 맛과의 잠식'],
    concepts: [
      { name: '생초콜릿 가나슈 바닐라', lead: '생초콜릿', base: '바닐라', ribbon: '가나슈', topping: '생초콜릿 큐브', existing: '바닐라', art: { scoop: '#F3E6C9', ribbon: '#3A241A', bits: '#5B3A2B' } },
      { name: '핫초코 마시멜로', lead: '핫초코', base: '초콜릿', blend: '핫초코 파우더', ribbon: '마시멜로 크림', topping: '미니 마시멜로', existing: '초콜릿', art: { scoop: '#8A5A3A', ribbon: '#FFF7EE', bits: '#FFFFFF', bit: 'round' } },
      { name: '진저브레드 카라멜', lead: '진저브레드', base: '바닐라', blend: '진저 스파이스', ribbon: '카라멜', topping: '진저브레드 쿠키 조각', existing: '바닐라', art: { scoop: '#E8CFA6', ribbon: '#B9772F', bits: '#A9682F' } },
      { name: '트러플 생초콜릿', lead: '생초콜릿', base: '생초콜릿 아이스크림', isNew: true, ribbon: '다크 가나슈', topping: '코코아 트러플', existing: '초콜릿', art: { scoop: '#5A3727', ribbon: '#1F130E', bits: '#8A5E3C', bit: 'round' } },
    ],
  },
  {
    id: 'hangwa', name: '바삭한 전통 강정', art: { scoop: '#EBD3A6', ribbon: '#9A5B26', bits: '#C98A35', cup: '#2E4A7A' },
    desc: '조청, 오꼬시, 강정처럼 명절에 찾는 전통 단맛과 바삭한 식감의 재료입니다. 매년 설 전후에 검색이 돌아옵니다.',
    ingredients: ['조청', '오꼬시', '강정', '과즐', '유과'],
    risk: '조청은 단맛이 강하고 잘 얼지 않아 리본이 흘러내릴 수 있습니다. 강정 조각은 수분을 먹으면 바삭함을 잃습니다.',
    checks: ['판매 온도에서 리본 점도', '강정 조각의 바삭함 유지 기간', '당도 조정과 시식 평가', '설 시즌 일정에 맞는 원료 확보'],
    concepts: [
      { name: '조청 강정 바닐라', lead: '조청', base: '바닐라', ribbon: '조청', topping: '쌀강정 조각', existing: '바닐라', art: { scoop: '#F6E7BE', ribbon: '#9A5B26', bits: '#E3B873' } },
      { name: '오꼬시 쿠키 앤 크림', lead: '오꼬시', base: '오레오 쿠키 앤 크림', blend: '볶은 쌀', ribbon: '카라멜', topping: '오꼬시 조각', existing: '오레오 쿠키 앤 크림', art: { scoop: '#E5D6BC', ribbon: '#B9772F', bits: '#C99A5B' } },
      { name: '조청 아몬드 봉봉', lead: '조청', base: '아몬드 봉봉', ribbon: '조청', topping: '캐러멜라이즈 아몬드', existing: '아몬드 봉봉', art: { scoop: '#B98752', ribbon: '#9A5B26', bits: '#EBCB97', bit: 'round' } },
      { name: '쌀강정 꿀 아이스크림', lead: '강정', base: '쌀 아이스크림', isNew: true, ribbon: '꿀', topping: '강정 조각', existing: '바닐라', art: { scoop: '#EFE3CF', ribbon: '#D9A441', bits: '#C98A35' } },
    ],
  },
  {
    id: 'street', name: '따끈한 겨울 간식', art: { scoop: '#E8C58F', ribbon: '#6A2F2A', bits: '#9A5B26', cup: '#2F7F86' },
    desc: '붕어빵처럼 추워지면 찾는 길거리 간식의 검색이 돌아오고 있습니다. 정점이 가까워 이번 겨울 출시는 어렵고 다음 시즌을 겨냥할 재료입니다.',
    ingredients: ['타이야끼', '초코붕어빵', '미니붕어빵', '호빵'],
    risk: '이미 제철이라 개발 기간을 거치면 정점이 지납니다. 빵 조각은 얼면 질겨져 식감 검증이 필요합니다.',
    checks: ['다음 겨울 출시 일정', '냉동 상태에서 빵 조각 식감', '팥 앙금 당도', '겨울철 아이스크림 판매 비중'],
    concepts: [
      { name: '붕어빵 바닐라 크런치', lead: '미니붕어빵', base: '바닐라', ribbon: '팥', topping: '미니붕어빵 조각', existing: '바닐라', art: { scoop: '#F4E6C8', ribbon: '#6A2F2A', bits: '#C98F4E' } },
      { name: '초코붕어빵 무스', lead: '초코붕어빵', base: '초콜릿', blend: '구운 와플 풍미', ribbon: '카라멜', topping: '초코붕어빵 조각', existing: '초콜릿', art: { scoop: '#7B5238', ribbon: '#C98F4E', bits: '#D9A05B' } },
      { name: '단팥 타이야끼 그린티', lead: '타이야끼', base: '그린티', ribbon: '연유', topping: '타이야끼 조각', existing: '그린티', art: { scoop: '#A9C08A', ribbon: '#FFF7E8', bits: '#C98F4E' } },
      { name: '슈크림 붕어빵', lead: '타이야끼', base: '슈크림 아이스크림', isNew: true, ribbon: '팥', topping: '타이야끼 조각', existing: '바닐라', art: { scoop: '#F7E3A6', ribbon: '#6A2F2A', bits: '#C98F4E' } },
    ],
  },
  {
    id: 'fruit', name: '제철 과일 시즌', art: { scoop: '#E3A8C0', ribbon: '#8A3A64', bits: '#8E3B66', cup: '#3F8F5B' },
    desc: '무화과와 복숭아처럼 매년 같은 철에 검색이 돌아오는 과일과, 겨울에 찾는 유자입니다. 출시 시점을 제철에 맞추는 것이 핵심입니다.',
    ingredients: ['딸기', '포도', '복숭아', '무화과', '애플망고', '유자'],
    risk: '제철 과일은 시즌에 맞춰 원료를 미리 확보해야 합니다. 출시가 정점보다 늦으면 이번 시즌 대신 다음 시즌을 겨냥해야 합니다.',
    checks: ['시즌 원료 사전 확보', '과육 입자와 해동 후 식감', '기존 과일 맛과의 잠식', '다음 시즌 재출시 일정'],
    concepts: [
      { name: '무화과 치즈케이크', lead: '무화과', base: '뉴욕 치즈케이크', ribbon: '무화과 잼', topping: '크래커 크럼블', existing: '뉴욕 치즈케이크', art: { scoop: '#F4E6C8', ribbon: '#8A3A64', bits: '#D9B27A' } },
      { name: '복숭아 요거트', lead: '복숭아', base: '31요거트', blend: '복숭아 퓨레', ribbon: '복숭아 콩포트', topping: '복숭아 과육', existing: '31요거트', art: { scoop: '#FBDCCB', ribbon: '#F08A66', bits: '#F7B48E' } },
      { name: '유자 샤베트', lead: '유자', base: '레인보우 샤베트', blend: '유자 과즙', ribbon: '유자청', topping: '유자 필', existing: '레인보우 샤베트', art: { scoop: '#FFE08A', ribbon: '#E09A00', bits: '#F7C948' } },
      { name: '무화과 꿀 아이스크림', lead: '무화과', base: '무화과 아이스크림', isNew: true, ribbon: '꿀', topping: '호두 크럼블', existing: '바닐라', art: { scoop: '#C98AA8', ribbon: '#D9A441', bits: '#8A5A3A' } },
    ],
  },
]

/** 콜라보 IP 목록 행의 그림 색 */
const IP_ART: Record<string, Art> = {
  몬치치: { scoop: '#9A6B4A', ribbon: '#E8B48A', bits: '#F2D3B3', cup: '#C8463A' },
  포켓몬스터: { scoop: '#F7D35A', ribbon: '#D9452B', bits: '#3B3B3B', cup: '#2F5DA8', bit: 'round' },
  원피스: { scoop: '#E2574C', ribbon: '#F4C152', bits: '#FFF4D6', cup: '#2B4C8C' },
  치이카와: { scoop: '#FBEFF2', ribbon: '#F4A6B8', bits: '#F4A6B8', cup: '#5C9BD1', bit: 'round' },
  '짱구는 못말려': { scoop: '#F6D365', ribbon: '#D9452B', bits: '#E2574C', cup: '#3A6FB0' },
  쿠로미: { scoop: '#B9A3D9', ribbon: '#3B2F4A', bits: '#F4A6C8', cup: '#2A2433', bit: 'round' },
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)
export const radarItem = (kw: string): RadarItem => {
  const it = items.find((i) => i.kw === kw)
  if (!it) throw new Error(`레이더에 없는 재료: ${kw}`)
  return it
}
/** 레이더 키워드는 전 기간 최고가 100이라, 화면에 있는 3년 안의 최고를 100으로 다시 맞춰 재료끼리 평균 낼 수 있게 한다 */
const normalized = (s: number[]) => { const hi = Math.max(1, ...s); return s.map((v) => (v / hi) * 100) }

/** 이번 주 실제 검색 수 추정: 감지 주의 실제 검색 수를 곡선 비율로 옮긴다 */
export const weeklyNow = (it: RadarItem) => Math.round((it.series[it.series.length - 1] * it.weekly) / Math.max(0.1, it.series[it.detectedIdx]))
const sorted = items.map(weeklyNow).sort((a, b) => a - b)
/** 추적 중인 키워드 전체의 이번 주 검색 수 중앙값 (비교 기준) */
export const WEEKLY_MEDIAN = sorted[sorted.length >> 1]

export interface Timing { verdict: TimingVerdict; label: string; peakIn: number | null; headline: string }

/** 반복형은 최근 1년의 정점 주가 내년 같은 때 돌아온다고 본다. 나머지는 정점을 예측하지 않고 레이더의 13주 생존 판정을 그대로 쓴다 */
export function timingOf(it: RadarItem): Timing {
  const t = (verdict: TimingVerdict, peakIn: number | null, headline: string): Timing => ({ verdict, label: VERDICT_LABEL[verdict], peakIn, headline })
  if (it.type === '반복형') {
    const n = it.series.length, year = it.series.slice(-52)
    const peakIn = n - 52 + year.indexOf(Math.max(...year)) + 52 - (n - 1)
    if (peakIn < H) return t('늦음', peakIn, `이번 시즌은 출시 전에 정점이 지나요 → 다음 시즌 겨냥`)
    if (peakIn <= H + SALE) return t('지금', peakIn, `판매 ${SALE}주 안에 정점이 들어와요 → 지금 출시`)
    return t('선점', peakIn, `정점보다 ${peakIn - H - SALE}주 먼저 판매를 마칠 수 있어요 → 먼저 출시`)
  }
  if (it.action === '후보') return t('지금', null, `${H}주 뒤 출시 시점에도 수요가 남을 전망 → 지금 출시`)
  if (it.action === '관찰') return t('관찰', null, '아직 판단하기 일러요 → 4주 더 지켜보기')
  return t('늦음', null, `${H}주 개발하면 수요가 식을 가능성이 높아요 → 이번엔 늦음`)
}

const STATUS_RANK: Record<TrendStatus, number> = { '뜨는 중': 0, 정점: 1, 스테디: 2, 하락: 3 }
const VERDICT_RANK: Record<TimingVerdict, number> = { 지금: 0, 선점: 1, 관찰: 2, 늦음: 3 }

/** 최근 4주 평균을 직전 12주 평균과 비교 */
export function statusOf(series: number[], index: number): TrendStatus {
  const n = series.length
  const ratio = avg(series.slice(n - 4)) / Math.max(0.1, avg(series.slice(n - 16, n - 4)))
  if (ratio >= 1.05 && index >= 70) return '정점'
  if (ratio >= 1.15) return '뜨는 중'
  if (ratio <= 0.85) return '하락'
  return '스테디'
}

/** 목록 한 줄에 필요한 값. 맛 트렌드와 콜라보가 같은 모양을 쓴다 */
interface RowBase { id: string; name: string; art: Art; series: number[]; index: number; status: TrendStatus; timing: Timing; rank: number; rankDelta: number }
export interface FlavorTrend extends RowBase, Omit<ThemeDef, 'concepts' | 'ingredients' | 'art' | 'id' | 'name'> {
  kind: '맛'
  ingredients: RadarItem[]
  /** 재료별 배라 출시 이력 */
  br: Record<string, BrRecord>
  /** 빠진 재료와 이유 */
  dropped: { kw: string; why: string }[]
  concepts: Concept[]
  lead: RadarItem
}
export interface CollabTrend extends RowBase { kind: '콜라보'; collab: CollabItem; br: BrRecord }
export type AnyTrend = FlavorTrend | CollabTrend

/** 유형은 베이스만 보고 정한다: 새로 개발 → 정면 승부형, 배합 조정 → 트렌드 결합형, 그대로 → 빠른 대응형 */
const tagOf = (c: ConceptDef): ConceptTag => (c.isNew ? '정면 승부형' : c.blend ? '트렌드 결합형' : '빠른 대응형')
/** 겹침을 세는 재료: 베이스, 섞는 재료, 리본, 토핑(조각 같은 말은 떼고) */
const keysOf = (c: ConceptDef) => [...new Set([c.base, c.blend, c.ribbon, c.topping.replace(/ (조각|큐브|과육)$/, '')].filter((x): x is string => !!x))]

/** 레이더 데이터를 다시 만들면 키워드가 사라질 수 있어, 없는 재료와 그 재료로 만든 조합은 뺀다 */
function buildFlavor(t: ThemeDef): Omit<FlavorTrend, 'rank' | 'rankDelta'> | null {
  const found = items.filter((i) => t.ingredients.includes(i.kw))
  const br = Object.fromEntries(found.map((i) => [i.kw, brRecord(i.kw)]))
  const dropped: FlavorTrend['dropped'] = found.filter((i) => !brKept(br[i.kw])).map((i) => ({ kw: i.kw, why: 'br' }))
  const pref = (i: RadarItem) => (i.action === '후보' || i.action === '시즌' ? 1 : 0)
  const kept = found.filter((i) => brKept(br[i.kw])).sort((a, b) => pref(b) - pref(a) || b.prob - a.prob)
  const ingredients = kept.slice(0, MAX_INGREDIENTS)
  kept.slice(MAX_INGREDIENTS).forEach((i) => dropped.push({ kw: i.kw, why: 'cap' }))
  const defs = t.concepts.filter((c) => ingredients.some((i) => i.kw === c.lead))
  if (!ingredients.length || !defs.length) return null
  const lead = ingredients.find((i) => pref(i)) ?? ingredients[0]
  const curves = ingredients.map((i) => normalized(i.series))
  const series = curves[0].map((_, k) => avg(curves.map((c) => c[k])))
  const index = Math.round(series[series.length - 1])
  return {
    ...t, kind: '맛', ingredients, br, dropped, lead, timing: timingOf(lead), series, index, status: statusOf(series, index),
    concepts: defs.map((c, i) => ({ ...c, art: { ...c.art, cup: c.art.cup ?? t.art.cup }, id: `${t.id}-${i}`, tag: tagOf(c), keys: keysOf(c) })),
  }
}

/** 콜라보는 실제 IP 곡선이 연결되기 전의 시연값. 이미 배라 콜라보로 나온 IP는 같은 규칙으로 거른다 */
function buildCollab(c: CollabItem): Omit<CollabTrend, 'rank' | 'rankDelta'> {
  const index = Math.round(c.series[c.series.length - 1])
  const verdict: TimingVerdict = c.action === '후보' ? '지금' : '관찰'
  return {
    kind: '콜라보', id: 'ip:' + c.kw, name: c.kw, art: IP_ART[c.kw] ?? { scoop: '#E9D7E3', ribbon: '#8A1F55', bits: '#8A1F55' }, collab: c, br: brRecord(c.kw),
    series: c.series, index, status: statusOf(c.series, index),
    timing: { verdict, label: VERDICT_LABEL[verdict], peakIn: null, headline: verdict === '지금' ? '검색이 확실히 오르는 중 → 지금 출시' : '오름폭이 아직 작아요 → 지켜보기' },
  }
}

/** 우선순위: 출시 타이밍 → 상태 → 확산 지수. 지난주 순위는 곡선을 한 주 전에서 잘라 같은 규칙으로 다시 매긴다 */
function ranked<T extends Omit<RowBase, 'rank' | 'rankDelta'>>(list: T[]): (T & { rank: number; rankDelta: number })[] {
  const key = (x: T, back: number) => {
    const s = back ? x.series.slice(0, -back) : x.series
    const index = Math.round(s[s.length - 1])
    return { v: VERDICT_RANK[x.timing.verdict], st: STATUS_RANK[statusOf(s, index)], index }
  }
  const order = (back: number) => [...list].sort((a, b) => { const p = key(a, back), q = key(b, back); return p.v - q.v || p.st - q.st || q.index - p.index })
  const now = order(0), prev = order(1)
  return now.map((x, i) => ({ ...x, rank: i + 1, rankDelta: prev.indexOf(x) - i }))
}

export const TRENDS: FlavorTrend[] = ranked(THEMES.map(buildFlavor).filter((t): t is Omit<FlavorTrend, 'rank' | 'rankDelta'> => t !== null))
const collabRows = COLLABS.filter((c) => c.action !== '제외').map(buildCollab)
export const COLLAB_TRENDS: CollabTrend[] = ranked(collabRows.filter((c) => brKept(c.br)))
/** 이미 배라 콜라보로 나와 뺀 IP */
export const COLLAB_DROPPED = collabRows.filter((c) => !brKept(c.br)).map((c) => c.br)

/** 추천 조합 3개 묶음: 같은 재료가 MAX_REPEAT번을 넘지 않는 묶음만, 덜 겹치는 순서로 */
export function conceptSets(concepts: Concept[]): Concept[][] {
  if (concepts.length <= 3) return [concepts]
  const sets: { s: Concept[]; over: number }[] = []
  for (let i = 0; i < concepts.length; i++) for (let j = i + 1; j < concepts.length; j++) for (let k = j + 1; k < concepts.length; k++) {
    const s = [concepts[i], concepts[j], concepts[k]]
    const count = new Map<string, number>()
    s.forEach((c) => c.keys.forEach((x) => count.set(x, (count.get(x) ?? 0) + 1)))
    const max = Math.max(...count.values())
    if (max <= MAX_REPEAT) sets.push({ s, over: [...count.values()].reduce((n, v) => n + v - 1, 0) })
  }
  return sets.sort((a, b) => a.over - b.over).map((x) => x.s)
}

export const conceptWhy = (c: Concept) => c.tag === '빠른 대응형'
  ? `기존 맛 ${c.base}의 배합은 그대로 두고 리본과 토핑만 더해, ${H}주 리드타임 안에 출시하기 가장 쉬운 조합입니다.`
  : c.tag === '트렌드 결합형'
    ? `기존 맛 ${c.base}의 배합에 ${c.blend} 풍미를 더해, 익숙한 맛으로 트렌드 재료를 소개하는 조합입니다. 빠른 대응형보다 배합 검증이 더 필요합니다.`
    : `${c.lead} 트렌드를 정면으로 보여 주는 신규 베이스입니다. 배합 개발과 원료 확보 부담이 가장 큽니다.`
export const conceptBase = (c: Concept) => (c.blend ? `${c.base} + ${c.blend}` : c.base)
export const conceptSub = (c: Concept) => `${c.tag} · ${c.isNew ? '신규 베이스' : `기존 맛 ${c.existing}`}`
