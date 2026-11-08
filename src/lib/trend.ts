/** 트렌드 레이더 데이터 형태. 값은 model/export_radar.py 가 trend-data.ts 로 만든다. */
import type { ShapeName } from './data'

export type RadarType = ShapeName | '보류'
export type RadarAction = '후보' | '관찰' | '단기' | '시즌'

export interface RadarItem {
  kw: string
  /** 규칙 유형: 반복형 판정 먼저, 그다음 뜨는 데 걸린 주 (5주 이하 단발형, 10주 이상 완만형) */
  type: RadarType
  /** 모델이 본 13주 생존 확률 (감지 시점 기준) */
  prob: number
  action: RadarAction
  suggestion: string
  /** 감지 주 검색량, 역대 최고 = 100 */
  size: number
  /** 급등이 감지된 주 (월요일) */
  detected: string
  /** series 안에서 감지 주의 위치 */
  detectedIdx: number
  /** 감지 후 13주가 지났으면 실제 결과, 아니면 null */
  actual: boolean | null
  /** 지금 수준의 25% 이상으로 이어진 주 수 */
  steady: number
  /** 지난 1년 평균 / 감지 주 검색량 */
  base: number
  /** 직전 4주 평균 대비 몇 배 */
  jump: number
  /** 감지 주 실제 검색 수 (검색광고 API 월간 검색 수로 환산, 주 단위) */
  weekly: number
  /** 직전 12주 평균 실제 검색 수 (주 단위) */
  usual: number
  /** 이 키워드 검색 중 30세 이상 비중 추정 (연령 데이터 없으면 null) */
  oldShare: number | null
  /** 평소 20대가 주로 찾던 디저트에 30세 이상이 갑자기 몰린 급등 */
  warn: boolean
  /** meta.seriesStart 부터의 주간 검색량 (키워드별 최고 주 = 100) */
  series: number[]
}

export interface RadarCluster { id: number; size: number; main: RadarType; match: number; members: string[]; curve: number[] }

export interface RadarData {
  meta: { minWeekly: number; /** 1차 규모 기준 (결정 탭에서 읽음, 레이더 판정에는 안 씀) */ minSize: number; first: string; last: string; seriesStart: string; weeks: number; horizon: number; recent: number; z: number; keep: number }
  scores: {
    samples: number; keywords: number; survive_rate: number; model_bal: number; model_auc: number; rule_bal: number; cluster_match: number
    /** 버틴 급등 중 맞힌 비율, 꺼진 급등 중 맞힌 비율 */
    hit_survive: number; hit_fail: number; repeat: number
    /** 경고 급등(20대 디저트에 30세 이상 몰림)이 과거에 버틴 비율과 건수 */
    warn_rate: number; warn_n: number
    models: { name: string; bal: number; auc: number; used: boolean; hit_survive: number; hit_fail: number }[]
  }
  items: RadarItem[]
  clusters: RadarCluster[]
}

/** 팀원 모듈의 Kind 와 맞춘 대응표 */
export const TYPE_KIND: Record<ShapeName, 'burst' | 'slow' | 'wave'> = { 단발형: 'burst', 완만형: 'slow', 반복형: 'wave' }

export function addWeeks(iso: string, w: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + w * 7)
  return d.toISOString().slice(0, 10)
}

export const shortDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${y.slice(2)}.${Number(m)}.${Number(d)}` }
