import { RADAR } from '@/lib/trend-data'
import { shortDate } from '@/lib/trend'
import { HowTo, PageHeader } from '@/components/page'
import { RadarHowTo, RadarSection } from '@/components/radar'

const { meta, scores } = RADAR

/** 트렌드 레이더 탭: 추적 중인 키워드 전체의 급등 감지와 생존 예측 */
export default function Trend() {
  return (
    <div>
      <PageHeader
        title="트렌드 레이더"
        basis={{ level: '실데이터', why: `네이버 데이터랩 주간 검색량 ${shortDate(meta.first)} ~ ${shortDate(meta.last)}, 키워드 ${scores.keywords}개` }}
        sub={`최근 3개월(${meta.horizon}주) 안에 검색량이 급등한 키워드를 골라, 이달의 맛 출시까지 걸리는 ${meta.horizon}주 뒤에도 수요가 남을지 예측해요. 데이터 기준일 ${shortDate(meta.last)}.`}
      />
      <RadarSection />
      <HowTo><RadarHowTo /></HowTo>
    </div>
  )
}
