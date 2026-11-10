import { Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { RADAR } from '@/lib/trend-data'
import { Card, CardHeader } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { HowTo } from '@/components/page'
import { shortDate } from '@/lib/trend'
import { cn } from '@/lib/utils'

const { meta, scores, items, clusters, season } = RADAR
const H = meta.horizon
const fresh = items.filter((i) => i.actual === null)
const warnCount = fresh.filter((i) => i.warn).length
const shapeCfg = { v: { label: '평균 모양', color: 'var(--primary)' } } satisfies ChartConfig

function Shapes() {
  const xs = Array.from({ length: 79 }, (_, k) => k - 26)
  // 단발형이 두 묶음이면 13주 뒤 남은 정도로 구분해서 이름 붙인다
  const burst = clusters.filter((c) => c.main === '단발형').sort((a, b) => a.curve[26 + H] - b.curve[26 + H])
  const name = (c: (typeof clusters)[number]) => burst.length < 2 || c.main !== '단발형' ? c.main : c.id === burst[0].id ? '단발형 (반짝)' : '단발형 (천천히 식음)'
  return (
    <Card>
      <CardHeader title={<span className="text-lg font-bold">곡선 모양으로 스스로 나눈 4묶음</span>} description={`정답 없이 최고점 앞 26주, 뒤 52주의 모양만 학습 (K-means). 사람이 정한 유형과 ${Math.round(scores.cluster_match * 100)}% 일치`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {clusters.map((c) => {
          const data = xs.map((x, k) => ({ x, v: c.curve[k] }))
          return (
            <div key={c.id}>
              <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">{name(c)}</p><span className="shrink-0 text-xs text-muted-foreground tabular-nums" title="규칙 유형과 일치한 수 / 묶음 크기">{c.match}/{c.size}</span></div>
              <ChartContainer config={shapeCfg} className="aspect-auto h-24 w-full">
                <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                  <XAxis dataKey="x" type="number" domain={[-26, 52]} ticks={[0]} tickFormatter={() => '최고점'} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 1]} hide />
                  <ReferenceLine x={0} stroke="var(--border)" />
                  <Line dataKey="v" stroke="var(--color-v)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.members.slice(0, 6).join(', ')}</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Scores() {
  const bars = [
    ...scores.models.map((m) => ({ label: m.name, tag: m.used ? '사용 중' : undefined, v: m.bal, auc: m.auc as number | undefined, cls: m.used ? 'bg-primary' : 'bg-muted-foreground/35' })),
    { label: '기존 규칙 (5주 이하면 못 버팀)', tag: undefined, v: scores.rule_bal, auc: undefined, cls: 'bg-muted-foreground/20' },
    { label: '찍기 (동전 던지기)', tag: undefined, v: 0.5, auc: undefined, cls: 'bg-border' },
  ]
  return (
    <Card>
      <CardHeader title={<span className="text-lg font-bold">{H}주 생존 예측 성능</span>} description={`학습에 안 쓴 키워드로 2024년 이후를 맞혀 본 점수. 새 트렌드 급등 ${scores.samples.toLocaleString()}건`} />
      <div className="mb-5 grid grid-cols-2 divide-x divide-border border-b border-border pb-5">
        <div><p className="text-sm text-muted-foreground">꺼질 급등을 맞힘</p><p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{Math.round(scores.hit_fail * 100)}%</p></div>
        <div className="pl-5"><p className="text-sm text-muted-foreground">버틸 급등을 맞힘</p><p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{Math.round(scores.hit_survive * 100)}%</p></div>
      </div>
      <div className="flex flex-col gap-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-medium">{b.label}{b.tag && <span className="ml-1.5 text-xs font-normal text-primary">{b.tag}</span>}</span><span className="font-semibold tabular-nums">{Math.round(b.v * 100)}%{b.auc !== undefined && <span className="ml-1.5 text-xs font-normal text-muted-foreground">AUC {b.auc.toFixed(2)}</span>}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', b.cls)} style={{ width: `${b.v * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        새 트렌드는 10개 중 8개가 {H}주 안에 꺼져요. 그래서 이 레이더는 버틸 것을 고르는 것보다 꺼질 것을 거르는 데 더 믿을 만해요.
        {' '}{scores.chronos ? 'Chronos-2를 더해서 명절 전에 반짝 뜨는 전통 간식은 더 잘 거르고, 제철이 막 시작된 재료는 더 잘 잡아요.' : '가장 크게 보는 신호는 평소 수요, 특히 30세 이상이 평소에 얼마나 찾던 디저트인지예요.'}{' '}
        퍼센트는 버틴 것과 꺼진 것을 각각 맞힌 비율의 평균이라 50%가 찍기예요.
      </p>
    </Card>
  )
}

export function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}


/** 모델 탭 위쪽: 추적 키워드, 급등 수, 예측 정확도, 모델 성능, 계산 방법 */
export function ModelPanel() {
  return (
    <section aria-label="모델 성능" className="mb-8">
      <Card className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="추적 중인 키워드" value={scores.keywords} note={`디저트, 재료의 네이버 검색량 (${shortDate(meta.first)} ~ ${shortDate(meta.last)})`} />
        <Kpi label="최근 3개월 급등" value={fresh.length} note={warnCount ? `주의 ${warnCount}개 포함` : '평소보다 확실히 많이 검색됨'} />
        <Kpi label="예측 정확도" value={`${Math.round(scores.all_bal * 100)}%`} note={`반복형 포함 기준. 새 트렌드만 보면 ${Math.round(scores.model_bal * 100)}% (꺼질 것 ${Math.round(scores.hit_fail * 100)}%, 버틸 것 ${Math.round(scores.hit_survive * 100)}%)`} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Scores />
        <div className="lg:col-span-2"><Shapes /></div>
      </div>
      <HowTo title="계산 방법">
        <p><b>급등 감지:</b> 이번 주 검색량이 5 이상이고 직전 12주(3개월) 평균의 1.5배 이상이어야 해요. 그리고 검색광고 API의 실제 검색 수로 환산했을 때 평소 흔들림의 {meta.z}배 이상 올라야 해요(검색이 적은 키워드의 우연한 출렁임은 빼요). 화면에는 최근 {H}주 안에 감지된 것만 결정 대상으로 보여 줘요. 그보다 오래된 것은 출시 타이밍이 이미 지났기 때문이에요.</p>
        <p className="mt-1"><b>{H}주 생존:</b> 급등으로 늘어난 검색 중 {Math.round(meta.keep * 100)}% 이상이 {H}주 뒤(12~14주 3주 평균)에도 남으면 버팀이에요. 평소 수준으로 돌아가기만 한 것은 못 버팀이에요. 랜덤 포레스트가 감지 시점까지의 곡선 특징 8개(급등 폭, 평소 수요, 꾸준히 검색된 기간, 작년 같은 철 등), 실제 검색 규모, 30세 이상 검색 곡선 3개로 확률을 내요.{scores.chronos && <> 여기에 Chronos-2(Amazon이 공개한 시계열 예측 모델, 학습 없이 그대로 사용)의 값 2가지를 더해요. 하나는 Chronos-2가 예측한 {H}주 뒤 검색량이고, 다른 하나는 Chronos-2가 곡선을 읽고 만든 요약 벡터에 로지스틱 회귀만 학습시켜 낸 버팀 확률이에요.</>}</p>
        <p className="mt-1"><b>주의:</b> 30세 이상 검색 비중이 50% 미만인 디저트(20대 위주)에서, 30세 이상 검색이 20대보다 훨씬 더 오른 급등(상위 25%)이에요. 과거 이런 급등은 {Math.round(scores.warn_rate * 100)}%만 버텨서 확률과 상관없이 단기 대응으로 둬요. 30세 이상 비중은 데이터랩 연령별 곡선으로 전체 곡선을 맞춰 추정한 값이에요.</p>
        <p className="mt-1"><b>다가오는 시즌:</b> 반복형 재료는 검색이 튀고 나서 잡으면 올해 출시가 늦어요. 그래서 데이터 기준일에서 {H}주 뒤가 속한 달({season.months[0]}월)과 그다음 달({season.months[1]}월)에 매년 정점을 찍는 반복형 재료를 급등 전에 미리 보여줘요. '최근 N년 중 N번'은 2016~2025년 중 그 달 전후 한 달 안에 정점이었던 해의 수예요.</p>
        <p className="mt-1"><b>예측 정확도:</b> 맨 위 숫자는 반복형까지 포함한 급등 {scores.all_samples.toLocaleString()}건 기준이에요. 반복형은 매년 같은 철에 돌아와서 맞히기 쉽고, 화면에서는 확률과 상관없이 시즌 재출시로 두기 때문에 새 트렌드만 본 숫자를 같이 적었어요. 성능 카드는 새 트렌드(반복형 제외) 급등 {scores.samples.toLocaleString()}건으로, 학습에 안 쓴 키워드의 2024년, 2025년 이후 급등을 맞힌 균형 정확도예요. 살아남은 것 중 맞힌 비율과 꺼진 것 중 맞힌 비율의 평균이에요. 기존 규칙은 최고점까지 5주 이하로 뜨면 못 버틴다고 보는 규칙(데이터랩 판정 탭에서 트렌드 25개로 찾은 것)이에요.</p>
        <p className="mt-1"><b>유형:</b> 1년 주기 자기상관이 0.5 이상이고 10년 중 80% 이상 같은 철(±1달)에 정점이면 반복형이에요. 아니면 최고점까지 뜨는 데 걸린 주가 5주 이하면 단발형, 10주 이상이면 완만형, 그 사이는 보류예요.</p>
        <p className="mt-1"><b>주 검색:</b> 급등 감지 주의 실제 검색 수예요. 데이터랩 곡선(키워드마다 최고 주 = 100)을 검색광고 API의 최근 한 달 실제 검색 수에 맞춰 환산한 값이라 키워드끼리 크기를 비교할 수 있어요. 역대 최고 주 대비 수준은 상세 화면 그래프 아래에 참고로만 보여 줘요.</p>
        <p className="mt-1"><b>제안:</b> 반복형은 시즌 재출시, 주의가 붙은 급등은 단기 대응이에요. 생존 확률 60% 이상이면서 실제 검색이 주 {meta.minWeekly.toLocaleString()}회 이상이면 이달의 맛 후보예요. 단, 이미 있는 제품 이름(오리온초코파이 같은 상표)은 후보 대신 관찰로 두고 콜라보로 검토해요. 확률은 높지만 주 {meta.minWeekly.toLocaleString()}회 미만이거나 확률이 40~60%면 관찰, 40% 미만은 단기 대응이에요.</p>
        <p className="mt-1"><b>데이터:</b> 기존 79개에 위키백과 디저트 목록, 해외 바이럴 디저트, 네이버 연관 검색어로 찾은 디저트를 더했어요(뜬 적 없는 디저트 포함). 실제 검색 수가 없거나, 최근 검색이 0이거나, 기록이 2년 미만인 키워드는 뺐어요.</p>
        <p className="mt-1"><b>한계:</b> 정답은 BR 판매가 아니라 검색량 유지 여부예요. 데이터랩은 키워드마다 최고 주를 100으로 맞추기 때문에, 그 값만으로는 키워드끼리 규모를 비교하지 않아요. 계산은 model/export_radar.py에서 해요.</p>
      </HowTo>
    </section>
  )
}
