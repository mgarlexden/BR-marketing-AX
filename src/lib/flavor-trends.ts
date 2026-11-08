/* 트렌드 화면의 상위 묶음: 레이더 키워드(재료)를 맛 트렌드로 묶고, 묶음 지수와 출시 타이밍을 계산한다.
 * 수치는 모두 RADAR 실데이터에서 나온다. 묶는 방식과 조합(CONCEPTS)만 팀 가설이고 화면에 '가정'으로 표시한다. */
import { RADAR } from './trend-data'
import type { RadarItem } from './trend'

const { meta, items } = RADAR
export const H = meta.horizon
/** 이달의 맛 판매 기간 (주) */
export const SALE = 4

export type TrendStatus = '뜨는 중' | '스테디' | '정점' | '하락'
export type TimingVerdict = '지금' | '선점' | '관찰' | '늦음'
export type ConceptTag = '빠른 대응형' | '트렌드 결합형' | '정면 승부형'

export interface Art { bg: 'butter' | 'sky' | 'mint' | 'peach' | 'lilac'; scoop: string; ribbon: string; bits: string }
export interface Concept { id: string; name: string; tag: ConceptTag; lead: string; base: string; ribbon: string; topping: string; linked: string; art: Art }
interface ThemeDef { id: string; name: string; color: string; desc: string; ingredients: string[]; risk: string; checks: string[]; concepts: Omit<Concept, 'id'>[] }

const THEMES: ThemeDef[] = [
  {
    id: 'nutty', name: '고소한 스프레드·쿠키', color: '#C98F4E',
    desc: '로투스와 땅콩버터처럼 고소하고 달콤한 스프레드·쿠키 재료의 검색이 함께 올랐습니다. 원래 찾던 수요가 있는 완만형 재료가 중심입니다.',
    ingredients: ['로투스', '땅콩버터', '프랄린', '헤이즐넛'],
    risk: '스프레드 리본은 얼면 단단해져 식감이 달라질 수 있어 배합 검증이 먼저 필요합니다. 로투스는 상표라 원료 사용 조건도 확인해야 합니다.',
    checks: ['냉동 상태에서 리본 식감 유지', '쿠키 크럼블이 눅눅해지는 시점', '땅콩 알레르기 표시', '상표 사용과 원료 공급 조건'],
    concepts: [
      { name: '로투스 엄마는 외계인', tag: '빠른 대응형', lead: '로투스', base: '엄마는 외계인', ribbon: '로투스 스프레드', topping: '로투스 쿠키 크럼블', linked: '엄마는 외계인', art: { bg: 'butter', scoop: '#5B3A2B', ribbon: '#C98F4E', bits: '#F3DDB8' } },
      { name: '피넛버터 초코 봉봉', tag: '트렌드 결합형', lead: '땅콩버터', base: '아몬드 봉봉', ribbon: '땅콩버터', topping: '초콜릿 코팅 땅콩', linked: '아몬드 봉봉', art: { bg: 'sky', scoop: '#D9BE93', ribbon: '#A9682F', bits: '#5B3A2B' } },
      { name: '스페큘러스 바닐라', tag: '트렌드 결합형', lead: '로투스', base: '바닐라', ribbon: '카라멜', topping: '로투스 쿠키 조각', linked: '바닐라', art: { bg: 'mint', scoop: '#F4E6C8', ribbon: '#B9772F', bits: '#9A6A3A' } },
      { name: '땅콩버터 쿠키 앤 크림', tag: '정면 승부형', lead: '땅콩버터', base: '땅콩버터 아이스크림', ribbon: '초콜릿', topping: '쿠키 크럼블', linked: '쿠키 앤 크림', art: { bg: 'peach', scoop: '#C99A5B', ribbon: '#4A2E22', bits: '#2F2320' } },
    ],
  },
  {
    id: 'honey', name: '달큰한 꿀·전통 단맛', color: '#EDB62F',
    desc: '꿀과 조청처럼 설탕과 다른 결의 단맛을 찾는 검색이 오르고 있습니다. 조청은 매년 같은 철에 돌아오는 반복형입니다.',
    ingredients: ['꿀', '조청', '벌집꿀', '약과'],
    risk: '꿀과 조청은 단맛이 강해 기존 맛보다 달게 느껴질 수 있고, 잘 얼지 않아 리본이 흘러내릴 수 있습니다.',
    checks: ['당도 조정과 시식 평가', '판매 온도에서 리본 점도', '원료 원가와 공급처', '시즌 일정에 맞는 원료 확보'],
    concepts: [
      { name: '허니 콘플레이크 바닐라', tag: '빠른 대응형', lead: '꿀', base: '바닐라', ribbon: '꿀', topping: '허니 콘플레이크', linked: '바닐라', art: { bg: 'sky', scoop: '#F6E7BE', ribbon: '#E0A21E', bits: '#D79A3B' } },
      { name: '조청 아몬드 봉봉', tag: '트렌드 결합형', lead: '조청', base: '아몬드 봉봉', ribbon: '조청', topping: '캐러멜라이즈 아몬드', linked: '아몬드 봉봉', art: { bg: 'butter', scoop: '#B98752', ribbon: '#6B3F1D', bits: '#E9CFA3' } },
      { name: '벌꿀 요거트 그래놀라', tag: '트렌드 결합형', lead: '꿀', base: '요거트', ribbon: '꿀', topping: '그래놀라', linked: '요거트', art: { bg: 'mint', scoop: '#FBF3E2', ribbon: '#E0A21E', bits: '#B57E45' } },
      { name: '조청 쌀강정', tag: '정면 승부형', lead: '조청', base: '쌀 아이스크림', ribbon: '조청', topping: '쌀강정 조각', linked: '바닐라', art: { bg: 'lilac', scoop: '#EFE3CF', ribbon: '#7A4A22', bits: '#FFF7E8' } },
    ],
  },
  {
    id: 'cream', name: '진한 카페 크림', color: '#7A5233',
    desc: '아인슈페너를 중심으로 커피와 크림이 겹치는 카페 디저트 검색이 올랐습니다. 생크림과 뚱카롱은 아직 규모나 지속성이 작아 함께 지켜볼 재료입니다.',
    ingredients: ['아인슈페너', '생크림', '뚱카롱', '요거트 아이스크림'],
    risk: '커피 풍미는 호불호가 갈리고 카페인 함량 표시가 필요합니다. 크림 리본은 냉동 중 결정이 커질 수 있습니다.',
    checks: ['커피 농도별 시식 평가', '카페인 함량 표시', '크림 리본 결정 크기', '겨울철 커피 맛 판매 비중'],
    concepts: [
      { name: '아인슈페너 자모카', tag: '빠른 대응형', lead: '아인슈페너', base: '자모카 아몬드 훠지', ribbon: '바닐라 크림', topping: '커피 크럼블', linked: '자모카 아몬드 훠지', art: { bg: 'peach', scoop: '#7B5238', ribbon: '#F7EEDD', bits: '#3A241A' } },
      { name: '크림 커피 쿠키', tag: '트렌드 결합형', lead: '아인슈페너', base: '쿠키 앤 크림', ribbon: '에스프레소', topping: '쿠키 크럼블', linked: '쿠키 앤 크림', art: { bg: 'sky', scoop: '#EFE7DA', ribbon: '#4A2E22', bits: '#2F2320' } },
      { name: '아인슈페너 바닐라', tag: '트렌드 결합형', lead: '아인슈페너', base: '바닐라', ribbon: '커피', topping: '휘핑 머랭', linked: '바닐라', art: { bg: 'butter', scoop: '#F4E6C8', ribbon: '#6B4630', bits: '#FFFFFF' } },
      { name: '더블샷 아인슈페너', tag: '정면 승부형', lead: '아인슈페너', base: '커피 크림 아이스크림', ribbon: '에스프레소', topping: '초콜릿 커피빈', linked: '자모카 아몬드 훠지', art: { bg: 'mint', scoop: '#A47A58', ribbon: '#3A241A', bits: '#F2E4D0' } },
    ],
  },
  {
    id: 'grain', name: '구수한 담백 디저트', color: '#A9623F',
    desc: '고구마처럼 구수하고 담백한 재료의 검색이 가을에 들어 올랐습니다. 녹차와 그래놀라는 오래 가지 못할 가능성이 커 단기 대응 재료입니다.',
    ingredients: ['고구마', '그래놀라', '녹차'],
    risk: '고구마는 전분 때문에 얼면 거칠어질 수 있어 입자 크기 검증이 필요합니다. 제철이 지나면 원료 수급이 달라집니다.',
    checks: ['냉동 후 입자감 평가', '원료 수급 시기', '단맛과 구수한 맛의 균형', '겨울 시즌 메뉴와의 겹침'],
    concepts: [
      { name: '군고구마 바닐라', tag: '빠른 대응형', lead: '고구마', base: '바닐라', ribbon: '고구마 무스', topping: '고구마 칩', linked: '바닐라', art: { bg: 'lilac', scoop: '#F4E6C8', ribbon: '#D88A3A', bits: '#8A4B2A' } },
      { name: '고구마 치즈케이크', tag: '트렌드 결합형', lead: '고구마', base: '뉴욕 치즈케이크', ribbon: '고구마', topping: '그래놀라', linked: '뉴욕 치즈케이크', art: { bg: 'butter', scoop: '#FBF0D8', ribbon: '#D88A3A', bits: '#B57E45' } },
      { name: '꿀고구마 아몬드', tag: '트렌드 결합형', lead: '고구마', base: '아몬드 봉봉', ribbon: '꿀 고구마', topping: '캐러멜 아몬드', linked: '아몬드 봉봉', art: { bg: 'sky', scoop: '#D9BE93', ribbon: '#E0A21E', bits: '#8A5A2B' } },
      { name: '호박고구마 시나몬', tag: '정면 승부형', lead: '고구마', base: '고구마 아이스크림', ribbon: '시나몬', topping: '고구마 말랭이', linked: '바닐라', art: { bg: 'mint', scoop: '#E2A54F', ribbon: '#7A4A22', bits: '#F4D08F' } },
    ],
  },
  {
    id: 'fruit', name: '제철 과일 시즌', color: '#D8497A',
    desc: '딸기, 포도, 복숭아, 무화과는 매년 같은 철에 검색이 돌아오는 반복형입니다. 출시 시점을 제철에 맞추는 것이 핵심입니다.',
    ingredients: ['딸기', '포도', '복숭아', '무화과', '애플망고', '유자'],
    risk: '제철 과일은 시즌에 맞춰 원료를 미리 확보해야 합니다. 출시가 정점보다 늦으면 이번 시즌 대신 다음 시즌을 겨냥해야 합니다.',
    checks: ['시즌 원료 사전 확보', '과육 입자와 해동 후 식감', '기존 과일 맛과의 잠식', '다음 시즌 재출시 일정'],
    concepts: [
      { name: '동결건조 딸기 듬뿍', tag: '빠른 대응형', lead: '딸기', base: '사랑에 빠진 딸기', ribbon: '딸기', topping: '동결건조 딸기', linked: '사랑에 빠진 딸기', art: { bg: 'mint', scoop: '#F3A9BD', ribbon: '#C92F55', bits: '#E2506F' } },
      { name: '포도 젤리 샤베트', tag: '트렌드 결합형', lead: '포도', base: '샤베트', ribbon: '포도', topping: '포도 젤리', linked: '레인보우 샤베트', art: { bg: 'butter', scoop: '#C7A4DC', ribbon: '#6A3B8F', bits: '#8E5BB5' } },
      { name: '복숭아 요거트', tag: '트렌드 결합형', lead: '복숭아', base: '요거트', ribbon: '복숭아', topping: '복숭아 과육', linked: '요거트', art: { bg: 'sky', scoop: '#FBDCCB', ribbon: '#F08A66', bits: '#F7B48E' } },
      { name: '무화과 치즈케이크', tag: '정면 승부형', lead: '무화과', base: '무화과 아이스크림', ribbon: '무화과 잼', topping: '치즈케이크 크럼블', linked: '뉴욕 치즈케이크', art: { bg: 'peach', scoop: '#B9799B', ribbon: '#6C2F58', bits: '#F4E6C8' } },
    ],
  },
]

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)
export const radarItem = (kw: string): RadarItem => {
  const it = items.find((i) => i.kw === kw)
  if (!it) throw new Error(`레이더에 없는 재료: ${kw}`)
  return it
}
/** 레이더 키워드는 전 기간 최고가 100이라, 화면에 있는 3년 안의 최고를 100으로 다시 맞춰 재료끼리 평균 낼 수 있게 한다 */
const normalized = (s: number[]) => { const hi = Math.max(1, ...s); return s.map((v) => (v / hi) * 100) }

export interface Timing { verdict: TimingVerdict; label: string; peakIn: number | null; headline: string }

/** 반복형은 최근 1년의 정점 주가 내년 같은 때 돌아온다고 본다. 나머지는 정점을 예측하지 않고 레이더의 13주 생존 판정을 그대로 쓴다 */
export function timingOf(it: RadarItem): Timing {
  if (it.type === '반복형') {
    const n = it.series.length, year = it.series.slice(-52)
    const peakIn = n - 52 + year.indexOf(Math.max(...year)) + 52 - (n - 1)
    if (peakIn < H) return { verdict: '늦음', label: `늦음 ${H - peakIn}주`, peakIn, headline: '이번 시즌은 출시 전에 정점이 지남 → 늦음' }
    if (peakIn <= H + SALE) return { verdict: '지금', label: '지금', peakIn, headline: `판매 ${SALE}주 안에 정점이 들어옴 → 지금` }
    return { verdict: '선점', label: `선점 ${peakIn - H - SALE}주`, peakIn, headline: `정점보다 ${peakIn - H - SALE}주 먼저 판매를 마칠 수 있음 → 선점` }
  }
  if (it.action === '후보') return { verdict: '지금', label: '지금', peakIn: null, headline: `${H}주 뒤 출시 시점에도 수요가 남을 전망 → 지금` }
  if (it.action === '관찰') return { verdict: '관찰', label: '관찰', peakIn: null, headline: '아직 판단하기 이름 → 4주 더 관찰' }
  return { verdict: '늦음', label: '늦음', peakIn: null, headline: `${H}주 개발하면 수요가 식을 가능성이 높음 → 늦음` }
}

export interface Trend extends Omit<ThemeDef, 'concepts' | 'ingredients'> {
  ingredients: RadarItem[]; concepts: Concept[]; lead: RadarItem; timing: Timing
  series: number[]; index: number; delta: number; status: TrendStatus
}

const STATUS_RANK: Record<TrendStatus, number> = { '뜨는 중': 0, 정점: 1, 스테디: 2, 하락: 3 }
const VERDICT_RANK: Record<TimingVerdict, number> = { 지금: 0, 선점: 1, 관찰: 2, 늦음: 3 }

function statusOf(series: number[], index: number): TrendStatus {
  const n = series.length
  const ratio = avg(series.slice(n - 4)) / Math.max(0.1, avg(series.slice(n - 16, n - 4)))
  if (ratio >= 1.05 && index >= 70) return '정점'
  if (ratio >= 1.15) return '뜨는 중'
  if (ratio <= 0.85) return '하락'
  return '스테디'
}

function build(t: ThemeDef): Trend {
  const ingredients = t.ingredients.map(radarItem).sort((a, b) => b.prob - a.prob)
  const candidates = ingredients.filter((i) => i.action === '후보' || i.action === '시즌')
  const lead = candidates[0] ?? ingredients[0]
  const curves = ingredients.map((i) => normalized(i.series))
  const series = curves[0].map((_, k) => avg(curves.map((c) => c[k])))
  const index = Math.round(series[series.length - 1])
  return {
    ...t, ingredients, lead, timing: timingOf(lead), series, index, delta: index - Math.round(series[series.length - 2]), status: statusOf(series, index),
    concepts: t.concepts.map((c, i) => ({ ...c, id: `${t.id}-${i}` })),
  }
}

/** 우선순위: 출시 타이밍 → 상승세 → 확산 지수 */
export const TRENDS: Trend[] = THEMES.map(build).sort((a, b) => VERDICT_RANK[a.timing.verdict] - VERDICT_RANK[b.timing.verdict] || STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.index - a.index)

export const conceptWhy = (c: Concept) => c.tag === '빠른 대응형'
  ? `${c.base} 기존 배합은 그대로 두고 리본과 토핑만 더해, ${H}주 리드타임 안에 출시하기 가장 쉬운 조합입니다.`
  : c.tag === '트렌드 결합형'
    ? `${c.base}에 ${c.lead} 풍미를 더해, 기존 맛을 아는 손님에게 트렌드 재료를 부담 없이 소개하는 조합입니다.`
    : `${c.lead} 트렌드를 정면으로 보여 주는 신규 배합입니다. 배합 개발과 원료 확보 부담이 가장 큽니다.`
export const conceptSub = (c: Concept) => c.tag === '정면 승부형' ? `${c.tag} · 신규 배합 + ${c.ribbon}` : `${c.tag} · ${c.base} 응용`
