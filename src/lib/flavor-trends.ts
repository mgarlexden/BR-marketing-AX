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
/** 조합 재료. blend는 기존 베이스에 섞어 배합을 조정하는 재료, isNew는 베이스를 새로 개발한다는 뜻이다 */
interface ConceptDef { name: string; lead: string; base: string; blend?: string; isNew?: boolean; ribbon: string; topping: string; linked: string; art: Art }
export interface Concept extends ConceptDef { id: string; tag: ConceptTag }
interface ThemeDef { id: string; name: string; color: string; desc: string; ingredients: string[]; risk: string; checks: string[]; concepts: ConceptDef[] }

const THEMES: ThemeDef[] = [
  {
    id: 'chewy', name: '쫀득한 떡·모찌', color: '#D9C7A5',
    desc: '찹쌀모찌를 중심으로 쫀득한 떡 식감 재료의 검색이 올랐습니다. 찹쌀떡과 잔기지떡은 매년 같은 철에 돌아오는 재료입니다.',
    ingredients: ['찹쌀모찌', '찹쌀떡', '잔기지떡'],
    risk: '떡은 얼면 딱딱해져 식감 유지 배합 검증이 먼저 필요합니다. 모찌가 녹으면서 아이스크림과 분리되지 않는지도 봐야 합니다.',
    checks: ['냉동 상태에서 떡 식감 유지', '조각 크기와 스쿱 작업성', '쌀 원료 원가와 공급처', '기존 모찌 메뉴와의 겹침'],
    concepts: [
      { name: '찹쌀모찌 엄마는 외계인', lead: '찹쌀모찌', base: '엄마는 외계인', ribbon: '흑당', topping: '찹쌀모찌 조각', linked: '엄마는 외계인', art: { bg: 'butter', scoop: '#5B3A2B', ribbon: '#C98F4E', bits: '#F8F2E6' } },
      { name: '찹쌀모찌 바닐라', lead: '찹쌀모찌', base: '바닐라', blend: '쌀 크림', ribbon: '캐러멜', topping: '찹쌀모찌 조각', linked: '바닐라', art: { bg: 'sky', scoop: '#EAD6AE', ribbon: '#B9772F', bits: '#FFF7E8' } },
      { name: '찹쌀떡 쿠키 앤 크림', lead: '찹쌀떡', base: '쿠키 앤 크림', blend: '볶은 콩가루', ribbon: '초콜릿', topping: '찹쌀떡 조각', linked: '쿠키 앤 크림', art: { bg: 'mint', scoop: '#D9C7A5', ribbon: '#4A2E22', bits: '#FBF3E2' } },
      { name: '콩가루 찹쌀모찌', lead: '찹쌀모찌', base: '콩가루 아이스크림', isNew: true, ribbon: '흑당', topping: '찹쌀모찌 조각', linked: '바닐라', art: { bg: 'peach', scoop: '#CDAE76', ribbon: '#5C3A1E', bits: '#FFF7E8' } },
    ],
  },
  {
    id: 'choco', name: '겨울 초콜릿·향신료', color: '#6B4630',
    desc: '생초콜릿과 핫초코, 진저브레드처럼 겨울에 돌아오는 초콜릿·향신료 재료입니다. 모두 매년 같은 철에 검색이 오르는 반복형이라 출시 시점이 핵심입니다.',
    ingredients: ['생초콜릿', '진저브레드', '핫초코', '생강 쿠키'],
    risk: '시즌이 짧아 출시가 늦으면 다음 해를 기다려야 합니다. 생강 같은 향신료는 호불호가 갈려 농도 검증이 필요합니다.',
    checks: ['시즌 정점에 맞는 출시일', '향신료 농도별 시식 평가', '초콜릿 원가와 공급처', '기존 초콜릿 맛과의 잠식'],
    concepts: [
      { name: '생초콜릿 엄마는 외계인', lead: '생초콜릿', base: '엄마는 외계인', ribbon: '가나슈', topping: '생초콜릿 큐브', linked: '엄마는 외계인', art: { bg: 'butter', scoop: '#5B3A2B', ribbon: '#2F1D16', bits: '#8A5A3A' } },
      { name: '핫초코 마시멜로 바닐라', lead: '핫초코', base: '바닐라', blend: '핫초코 파우더', ribbon: '초콜릿', topping: '마시멜로', linked: '바닐라', art: { bg: 'sky', scoop: '#B98E6A', ribbon: '#4A2E22', bits: '#FFFFFF' } },
      { name: '진저브레드 초콜릿', lead: '진저브레드', base: '초콜릿 무스', blend: '진저 스파이스', ribbon: '캐러멜', topping: '진저브레드 조각', linked: '초콜릿 무스', art: { bg: 'mint', scoop: '#6B4630', ribbon: '#C98F4E', bits: '#A9682F' } },
      { name: '트러플 생초콜릿', lead: '생초콜릿', base: '생초콜릿 아이스크림', isNew: true, ribbon: '다크 가나슈', topping: '코코아 트러플', linked: '엄마는 외계인', art: { bg: 'peach', scoop: '#3F2A20', ribbon: '#1F130E', bits: '#7A5233' } },
    ],
  },
  {
    id: 'hangwa', name: '바삭한 전통 강정', color: '#D79A3B',
    desc: '조청, 오꼬시, 강정처럼 명절에 찾는 전통 단맛과 바삭한 식감의 재료입니다. 매년 설 전후에 검색이 돌아옵니다.',
    ingredients: ['조청', '오꼬시', '강정', '과즐', '유과'],
    risk: '조청은 단맛이 강하고 잘 얼지 않아 리본이 흘러내릴 수 있습니다. 강정 조각은 수분을 먹으면 바삭함을 잃습니다.',
    checks: ['판매 온도에서 리본 점도', '강정 조각의 바삭함 유지 기간', '당도 조정과 시식 평가', '설 시즌 일정에 맞는 원료 확보'],
    concepts: [
      { name: '조청 강정 바닐라', lead: '조청', base: '바닐라', ribbon: '조청', topping: '쌀강정 조각', linked: '바닐라', art: { bg: 'sky', scoop: '#F6E7BE', ribbon: '#7A4A22', bits: '#E9CFA3' } },
      { name: '오꼬시 쿠키 앤 크림', lead: '오꼬시', base: '쿠키 앤 크림', blend: '볶은 쌀', ribbon: '조청', topping: '오꼬시 조각', linked: '쿠키 앤 크림', art: { bg: 'butter', scoop: '#E5D6BC', ribbon: '#6B3F1D', bits: '#C99A5B' } },
      { name: '조청 아몬드 봉봉', lead: '조청', base: '아몬드 봉봉', blend: '조청 시럽', ribbon: '조청', topping: '캐러멜라이즈 아몬드', linked: '아몬드 봉봉', art: { bg: 'mint', scoop: '#B98752', ribbon: '#6B3F1D', bits: '#E9CFA3' } },
      { name: '쌀강정 아이스크림', lead: '강정', base: '쌀 아이스크림', isNew: true, ribbon: '조청', topping: '강정 조각', linked: '바닐라', art: { bg: 'lilac', scoop: '#EFE3CF', ribbon: '#7A4A22', bits: '#D79A3B' } },
    ],
  },
  {
    id: 'street', name: '따끈한 겨울 간식', color: '#B9772F',
    desc: '붕어빵과 호빵처럼 추워지면 찾는 길거리 간식의 검색이 돌아오고 있습니다. 정점이 가까워 이번 겨울 출시는 어렵고 다음 시즌을 겨냥할 재료입니다.',
    ingredients: ['타이야끼', '초코붕어빵', '미니붕어빵', '호빵'],
    risk: '이미 제철이라 개발 기간을 거치면 정점이 지납니다. 빵 조각은 얼면 질겨져 식감 검증이 필요합니다.',
    checks: ['다음 겨울 출시 일정', '냉동 상태에서 빵 조각 식감', '팥 앙금 당도', '겨울철 아이스크림 판매 비중'],
    concepts: [
      { name: '붕어빵 바닐라 크런치', lead: '미니붕어빵', base: '바닐라', ribbon: '팥', topping: '미니붕어빵 조각', linked: '바닐라', art: { bg: 'peach', scoop: '#F4E6C8', ribbon: '#6A2F2A', bits: '#C98F4E' } },
      { name: '초코붕어빵 무스', lead: '초코붕어빵', base: '초콜릿 무스', blend: '구운 와플 풍미', ribbon: '초콜릿', topping: '붕어빵 조각', linked: '초콜릿 무스', art: { bg: 'sky', scoop: '#7B5238', ribbon: '#3A241A', bits: '#D9A05B' } },
      { name: '단팥 타이야끼 그린티', lead: '타이야끼', base: '그린티', blend: '단팥', ribbon: '연유', topping: '타이야끼 조각', linked: '그린티', art: { bg: 'butter', scoop: '#A9C08A', ribbon: '#FFF7E8', bits: '#C98F4E' } },
      { name: '단팥 호빵', lead: '호빵', base: '단팥 아이스크림', isNew: true, ribbon: '연유', topping: '호빵 조각', linked: '바닐라', art: { bg: 'mint', scoop: '#A9746E', ribbon: '#FFF7E8', bits: '#F8F2E6' } },
    ],
  },
  {
    id: 'fruit', name: '제철 과일 시즌', color: '#D8497A',
    desc: '딸기, 포도, 복숭아, 무화과는 매년 같은 철에 검색이 돌아오는 반복형입니다. 출시 시점을 제철에 맞추는 것이 핵심입니다.',
    ingredients: ['딸기', '포도', '복숭아', '무화과', '애플망고', '유자'],
    risk: '제철 과일은 시즌에 맞춰 원료를 미리 확보해야 합니다. 출시가 정점보다 늦으면 이번 시즌 대신 다음 시즌을 겨냥해야 합니다.',
    checks: ['시즌 원료 사전 확보', '과육 입자와 해동 후 식감', '기존 과일 맛과의 잠식', '다음 시즌 재출시 일정'],
    concepts: [
      { name: '동결건조 딸기 듬뿍', lead: '딸기', base: '사랑에 빠진 딸기', ribbon: '딸기', topping: '동결건조 딸기', linked: '사랑에 빠진 딸기', art: { bg: 'mint', scoop: '#F3A9BD', ribbon: '#C92F55', bits: '#E2506F' } },
      { name: '포도 젤리 샤베트', lead: '포도', base: '샤베트', blend: '포도 과즙', ribbon: '포도', topping: '포도 젤리', linked: '레인보우 샤베트', art: { bg: 'butter', scoop: '#C7A4DC', ribbon: '#6A3B8F', bits: '#8E5BB5' } },
      { name: '복숭아 요거트', lead: '복숭아', base: '요거트', blend: '복숭아 퓨레', ribbon: '복숭아', topping: '복숭아 과육', linked: '요거트', art: { bg: 'sky', scoop: '#FBDCCB', ribbon: '#F08A66', bits: '#F7B48E' } },
      { name: '무화과 치즈케이크', lead: '무화과', base: '무화과 아이스크림', isNew: true, ribbon: '무화과 잼', topping: '치즈케이크 크럼블', linked: '뉴욕 치즈케이크', art: { bg: 'peach', scoop: '#B9799B', ribbon: '#6C2F58', bits: '#F4E6C8' } },
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

/** 유형은 베이스만 보고 정한다: 새로 개발 → 정면 승부형, 배합 조정 → 트렌드 결합형, 그대로 → 빠른 대응형 */
const tagOf = (c: ConceptDef): ConceptTag => (c.isNew ? '정면 승부형' : c.blend ? '트렌드 결합형' : '빠른 대응형')

/** 레이더 데이터를 다시 만들면 키워드가 사라질 수 있어, 없는 재료와 그 재료로 만든 조합은 뺀다 */
function build(t: ThemeDef): Trend | null {
  const ingredients = items.filter((i) => t.ingredients.includes(i.kw)).sort((a, b) => b.prob - a.prob)
  const defs = t.concepts.filter((c) => items.some((i) => i.kw === c.lead))
  if (!ingredients.length || !defs.length) return null
  const candidates = ingredients.filter((i) => i.action === '후보' || i.action === '시즌')
  const lead = candidates[0] ?? ingredients[0]
  const curves = ingredients.map((i) => normalized(i.series))
  const series = curves[0].map((_, k) => avg(curves.map((c) => c[k])))
  const index = Math.round(series[series.length - 1])
  return {
    ...t, ingredients, lead, timing: timingOf(lead), series, index, delta: index - Math.round(series[series.length - 2]), status: statusOf(series, index),
    concepts: defs.map((c, i) => ({ ...c, id: `${t.id}-${i}`, tag: tagOf(c) })),
  }
}

/** 우선순위: 출시 타이밍 → 상승세 → 확산 지수 */
export const TRENDS: Trend[] = THEMES.map(build).filter((t): t is Trend => t !== null).sort((a, b) => VERDICT_RANK[a.timing.verdict] - VERDICT_RANK[b.timing.verdict] || STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.index - a.index)

export const conceptWhy = (c: Concept) => c.tag === '빠른 대응형'
  ? `${c.base} 기존 배합은 그대로 두고 리본과 토핑만 더해, ${H}주 리드타임 안에 출시하기 가장 쉬운 조합입니다.`
  : c.tag === '트렌드 결합형'
    ? `${c.base} 베이스를 ${c.blend} 쪽으로 조정해, 기존 맛을 아는 손님에게 트렌드 재료를 소개하는 조합입니다. 빠른 대응형보다 배합 검증이 더 필요합니다.`
    : `${c.lead} 트렌드를 정면으로 보여 주는 신규 배합입니다. 배합 개발과 원료 확보 부담이 가장 큽니다.`
export const conceptBase = (c: Concept) => (c.blend ? `${c.base} + ${c.blend}` : c.base)
export const conceptSub = (c: Concept) => c.isNew ? `${c.tag} · 신규 배합 + ${c.ribbon}` : c.blend ? `${c.tag} · ${conceptBase(c)}` : `${c.tag} · ${c.base} 응용`
