import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts'
import { RADAR } from '@/lib/trend-data'
import { addWeeks, shortDate, type RadarAction, type RadarItem, type RadarType } from '@/lib/trend'
import { Card, CardHeader } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Segmented } from '@/components/ui/segmented'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { HowTo, PageHeader, Stat } from '@/components/page'
import { Pill } from '@/components/status'
import { cn } from '@/lib/utils'

const { meta, scores, items, clusters } = RADAR
const H = meta.horizon

const ACTION: Record<RadarAction, { label: string; tone: 'good' | 'primary' | 'warn' | 'neutral' }> = {
  후보: { label: '이달의 맛 후보', tone: 'good' },
  시즌: { label: '시즌 재출시', tone: 'primary' },
  관찰: { label: '관찰', tone: 'warn' },
  단기: { label: '단기 대응', tone: 'neutral' },
}
const TYPE_NOTE: Record<RadarType, string> = {
  단발형: '갑자기 튀고 빠르게 식는 키워드',
  완만형: '원래 찾던 수요 위에서 천천히 오르는 키워드',
  반복형: '매년 같은 철에 돌아오는 키워드',
  보류: '뜨는 속도가 애매해서 유형 판정을 미룬 키워드',
}
type Filter = 'all' | RadarAction
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' }, { value: '후보', label: '후보' }, { value: '시즌', label: '시즌' }, { value: '관찰', label: '관찰' }, { value: '단기', label: '단기' },
]
const lineCfg = { v: { label: '검색량', color: 'var(--primary)' } } satisfies ChartConfig
const shapeCfg = { v: { label: '평균 모양', color: 'var(--primary)' } } satisfies ChartConfig

function ProbBar({ p }: { p: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn('absolute inset-y-0 left-0 rounded-full', p >= 0.6 ? 'bg-good' : p >= 0.4 ? 'bg-amber-400' : 'bg-muted-foreground/45')} style={{ width: `${p * 100}%` }} />
      </div>
      <span className="num text-xs font-semibold">{Math.round(p * 100)}%</span>
    </div>
  )
}

function Detail({ it }: { it: RadarItem }) {
  const rows = it.series.map((v, i) => ({ i, v }))
  const end = it.detectedIdx + H
  const yearTicks = rows.filter((r) => addWeeks(meta.seriesStart, r.i).slice(5, 7) === '01' && Number(addWeeks(meta.seriesStart, r.i).slice(8)) <= 7).map((r) => r.i)
  const a = ACTION[it.action]
  const top = Math.max(10, ...it.series.slice(-104))
  const yMax = top > 60 ? 100 : Math.ceil(top / 10) * 10
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2">{it.kw}<Pill tone="neutral">{it.type}</Pill></span>}
        description={TYPE_NOTE[it.type]}
        right={<Pill tone={a.tone}>{a.label}</Pill>}
      />
      <ChartContainer config={lineCfg} className="aspect-auto h-52 w-full">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="i" type="number" domain={[0, rows.length - 1]} ticks={yearTicks} tickFormatter={(i) => addWeeks(meta.seriesStart, i).slice(0, 4)} tickLine={false} axisLine={false} />
          <YAxis domain={[0, yMax]} ticks={[0, yMax / 2, yMax]} allowDataOverflow tickLine={false} axisLine={false} width={32} />
          <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltipContent labelFormatter={(_, p) => `${shortDate(addWeeks(meta.seriesStart, p?.[0]?.payload?.i ?? 0))} 주`} formatter={(val) => <span className="flex w-full justify-between gap-6"><span className="text-muted-foreground">검색량</span><span className="num font-semibold">{Number(val).toFixed(1)}</span></span>} />} />
          <ReferenceArea x1={it.detectedIdx} x2={Math.min(end, rows.length - 1)} fill="var(--primary)" fillOpacity={0.07} />
          <ReferenceLine x={it.detectedIdx} stroke="var(--foreground)" strokeDasharray="4 4" />
          {end <= rows.length - 1 && <ReferenceLine x={end} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
          <Line dataKey="v" stroke="var(--color-v)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
      <p className="mt-1 text-xs text-muted-foreground">
        {yMax < 100 && `최근 2년이 잘 보이도록 세로축을 0~${yMax}로 확대 (전성기 = 100). `}점선: 급등 감지 {shortDate(it.detected)} / 음영: 그 후 {H}주 (출시까지 걸리는 시간){end > rows.length - 1 && ', 아직 진행 중'}
      </p>

      {it.warn && (
        <div className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 text-sm leading-relaxed">
          <p className="font-semibold text-amber-700 dark:text-amber-300">30세 이상 검색이 갑자기 늘어난 급등이에요</p>
          <p className="mt-1 text-xs text-muted-foreground">평소엔 20대가 주로 찾던 디저트예요. 과거 비슷한 급등은 {Math.round(scores.warn_rate * 100)}%만 {H}주를 버텼어요 ({scores.warn_n}건, 새 트렌드 평균 {Math.round(scores.survive_rate * 100)}%). 이유는 아직 확인되지 않았어요.</p>
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-muted/70 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{H}주 뒤에도 늘어난 검색의 절반 이상이 남을 확률</p>
          <p className="num text-2xl font-bold tracking-tighter">{Math.round(it.prob * 100)}%</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed">{it.suggestion}</p>
        {it.actual !== null && (
          <p className="mt-2 text-xs text-muted-foreground">실제 결과: <b className={it.actual ? 'text-good' : 'text-bad'}>{it.actual ? '버팀' : '못 버팀'}</b> (감지 후 {H}주 경과)</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="주 검색 수" value={it.weekly.toLocaleString()} note={`${it.weekly < meta.minWeekly ? '규모 작음' : '규모 충분'}, 평소 ${it.usual.toLocaleString()}회`} />
        <Stat label="전성기 대비" value={`${it.size}%`} note="역대 최고 주 = 100%" />
        <Stat label="평소 수요" value={`${Math.round(Math.min(it.base, 9.99) * 100)}%`} note="1년 평균 / 지금" />
        <Stat label="4주 전 대비" value={`${it.jump}배`} note="급등 폭" />
        <Stat label="꾸준히 검색된 주" value={it.steady > 104 ? '2년+' : `${it.steady}주`} note={it.steady <= 5 ? '갑자기 튐' : '원래 찾던 단어'} />
        <Stat label="30세 이상 비중" value={it.oldShare === null ? '없음' : `${Math.round(it.oldShare * 100)}%`} note={it.oldShare === null ? '연령 데이터 없음' : it.oldShare < 0.5 ? '20대 위주' : '30세 이상 위주'} />
      </div>
    </Card>
  )
}

function Shapes() {
  const xs = Array.from({ length: 79 }, (_, k) => k - 26)
  // 단발형이 두 묶음이면 13주 뒤 남은 정도로 구분해서 이름 붙인다
  const burst = clusters.filter((c) => c.main === '단발형').sort((a, b) => a.curve[26 + H] - b.curve[26 + H])
  const name = (c: (typeof clusters)[number]) => burst.length < 2 || c.main !== '단발형' ? c.main : c.id === burst[0].id ? '단발형 (반짝)' : '단발형 (천천히 식음)'
  return (
    <Card>
      <CardHeader title="곡선 모양으로 스스로 나눈 4묶음" description={`정답 없이 최고점 앞 26주, 뒤 52주의 모양만 학습 (K-means). 사람이 정한 유형과 ${Math.round(scores.cluster_match * 100)}% 일치`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {clusters.map((c) => {
          const data = xs.map((x, k) => ({ x, v: c.curve[k] }))
          return (
            <div key={c.id} className="rounded-2xl border border-border p-3">
              <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">{name(c)}</p><span className="num shrink-0 text-xs text-muted-foreground" title="규칙 유형과 일치한 수 / 묶음 크기">{c.match}/{c.size}</span></div>
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
    ...scores.models.map((m) => ({ label: m.name, tag: m.used ? '화면에 사용' : undefined, v: m.bal, auc: m.auc as number | undefined, cls: m.used ? 'bg-primary' : 'bg-primary/45' })),
    { label: '기존 규칙 (5주 이하면 못 버팀)', tag: undefined, v: scores.rule_bal, auc: undefined, cls: 'bg-muted-foreground/45' },
    { label: '찍기 (동전 던지기)', tag: undefined, v: 0.5, auc: undefined, cls: 'bg-border' },
  ]
  return (
    <Card>
      <CardHeader title={`${H}주 생존 예측 성능`} description={`새 트렌드 급등 ${scores.samples.toLocaleString()}건. 처음 보는 키워드로, 2024년과 2025년 이후의 미래를 맞히게 시험 (키워드 5묶음, 묶음 나누기 ${scores.repeat}번 평균)`} />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-muted/70 p-3"><p className="text-xs text-muted-foreground">꺼질 급등을 맞힘</p><p className="num text-2xl font-bold tracking-tighter">{Math.round(scores.hit_fail * 100)}%</p></div>
        <div className="rounded-2xl bg-muted/70 p-3"><p className="text-xs text-muted-foreground">버틸 급등을 맞힘</p><p className="num text-2xl font-bold tracking-tighter">{Math.round(scores.hit_survive * 100)}%</p></div>
      </div>
      <div className="flex flex-col gap-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-medium">{b.label}{b.tag && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">{b.tag}</span>}</span><span className="num font-semibold">{Math.round(b.v * 100)}%{b.auc !== undefined && <span className="ml-1.5 text-xs font-normal text-muted-foreground">AUC {b.auc.toFixed(2)}</span>}</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', b.cls)} style={{ width: `${b.v * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        퍼센트는 균형 정확도(버틴 것과 못 버틴 것을 각각 맞힌 비율의 평균), AUC는 버틴 키워드에 더 높은 점수를 준 정도(0.5 찍기, 1.0 완벽).
        새 트렌드 급등 중 {H}주를 버틴 건 {Math.round(scores.survive_rate * 100)}%뿐이라, 레이더는 '버틸 것' 보증보다 '꺼질 것' 거르기에 강합니다.
        30세 이상 검색 힌트를 넣은 랜덤 포레스트를 화면 예측에 씁니다. 가장 크게 본 신호는 평소 수요(특히 30세 이상의 평소 수요).
        버팀 기준을 30~70%로 바꿔도 정확도는 비슷했습니다.
      </p>
    </Card>
  )
}

/** 감지 후 13주가 지나지 않은 것만 지금 결정할 대상. 지난 것은 실제 결과와 함께 따로 보여준다. */
const fresh = items.filter((i) => i.actual === null)
const past = items.filter((i) => i.actual !== null)
const pastHit = past.filter((i) => (i.prob >= 0.5) === i.actual).length
const warnCount = fresh.filter((i) => i.warn).length

function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="num mt-1 text-3xl font-bold tracking-tighter">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

export default function Trend() {
  const [filter, setFilter] = useState<Filter>('all')
  const [sel, setSel] = useState(fresh[0]?.kw ?? items[0]?.kw ?? '')
  const list = useMemo(() => fresh.filter((i) => filter === 'all' || i.action === filter), [filter])
  const cur = items.find((i) => i.kw === sel) ?? items[0]
  const count = (a: RadarAction) => fresh.filter((i) => i.action === a).length
  const opts = FILTERS.map((f) => ({ ...f, label: f.value === 'all' ? `${f.label} ${fresh.length}` : `${f.label} ${count(f.value)}` }))
  const row = (it: RadarItem, extra?: React.ReactNode) => (
    <TR key={it.kw} onClick={() => setSel(it.kw)} aria-selected={it.kw === cur?.kw}
      className={cn('cursor-pointer hover:bg-muted/50', it.kw === cur?.kw && 'bg-muted/70')}>
      <TD className="whitespace-nowrap font-medium">{it.kw}</TD>
      <TD className="hidden text-xs text-muted-foreground sm:table-cell">{it.type}</TD>
      <TD><ProbBar p={it.prob} /></TD>
      <TD className={cn('num whitespace-nowrap text-xs', it.weekly < meta.minWeekly ? 'text-muted-foreground' : 'font-semibold')} title="감지 주 실제 검색 수 (검색광고 API 월간 검색 수로 환산)">{it.weekly.toLocaleString()}회</TD>
      {extra ?? <TD className="whitespace-nowrap"><Pill tone={ACTION[it.action].tone}>{ACTION[it.action].label}</Pill>{it.action === '관찰' && <span className="ml-1.5 text-xs text-muted-foreground">{it.prob >= 0.6 && it.weekly < meta.minWeekly ? '규모 작음' : '확률 애매'}</span>}{it.warn && <span className="ml-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">주의</span>}</TD>}
      <TD className="num hidden text-right text-xs text-muted-foreground sm:table-cell">{shortDate(it.detected)}</TD>
    </TR>
  )

  return (
    <div>
      <PageHeader
        title="트렌드 레이더"
        basis={{ level: '실데이터', why: `네이버 데이터랩 주간 검색량 ${shortDate(meta.first)} ~ ${shortDate(meta.last)}, 키워드 ${scores.keywords}개` }}
        sub={`최근 3개월(${H}주) 안에 검색량이 급등한 키워드를 골라, 이달의 맛 출시까지 걸리는 ${H}주 뒤에도 수요가 남을지 예측합니다. 데이터 기준일 ${shortDate(meta.last)}.`}
      />

      <Card className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="추적 중인 키워드" value={scores.keywords} note="디저트, 재료의 네이버 검색량" />
        <Kpi label="최근 3개월 급등" value={fresh.length} note={`평소의 1.5배 이상 + 평소 흔들림의 ${meta.z}배 이상${warnCount ? `, 주의 ${warnCount}개` : ''}`} />
        <Kpi label="이 중 이달의 맛 후보" value={count('후보')} note={`13주 뒤까지 남을 확률 60%+, 주 검색 ${meta.minWeekly.toLocaleString()}회+, 주의 아님`} />
        <Kpi label="예측 정확도" value={`${Math.round(scores.model_bal * 100)}%`} note={`꺼질 것 ${Math.round(scores.hit_fail * 100)}%, 버틸 것 ${Math.round(scores.hit_survive * 100)}% 맞힘 (기존 규칙 ${Math.round(scores.rule_bal * 100)}%)`} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="최근 3개월 급등 키워드" description="지금 결정할 대상" right={<Segmented label="제안 필터" value={filter} options={opts} onChange={setFilter} />} />
          <Table wrapperClassName="max-h-[560px]">
            <THead>
              <TR><TH>키워드</TH><TH className="hidden sm:table-cell">유형</TH><TH>{H}주 생존</TH><TH title="감지 주 실제 검색 수 (검색광고 API 월간 검색 수로 환산)">주 검색</TH><TH>제안</TH><TH className="hidden text-right sm:table-cell">감지</TH></TR>
            </THead>
            <TBody>{list.map((it) => row(it))}</TBody>
          </Table>
          {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">해당하는 키워드가 없습니다</p>}

          {past.length > 0 && (
            <details className="mt-4 rounded-2xl border border-border p-3 text-sm">
              <summary className="cursor-pointer list-none font-medium">
                지난 판정 {past.length}개 <span className="text-xs font-normal text-muted-foreground">감지 후 {H}주가 지나 실제 결과가 나온 키워드. 예측이 맞은 것 {pastHit}/{past.length}</span>
              </summary>
              <Table wrapperClassName="mt-2">
                <THead>
                  <TR><TH>키워드</TH><TH className="hidden sm:table-cell">유형</TH><TH>예측 생존</TH><TH title="감지 주 실제 검색 수 (검색광고 API 월간 검색 수로 환산)">주 검색</TH><TH>실제</TH><TH className="hidden text-right sm:table-cell">감지</TH></TR>
                </THead>
                <TBody>
                  {past.map((it) => row(it, <TD className="whitespace-nowrap"><Pill tone={it.actual ? 'good' : 'neutral'}>{it.actual ? '버팀' : '못 버팀'}</Pill>{(it.prob >= 0.5) === it.actual ? <span className="ml-1.5 text-xs text-good">맞음</span> : <span className="ml-1.5 text-xs text-bad">틀림</span>}</TD>))}
                </TBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">이 기간은 모델 학습에도 쓰였으므로 참고용입니다. 공정한 성능은 아래 예측 성능 카드의 교차검증 점수를 보세요.</p>
            </details>
          )}
        </Card>
        <div className="lg:col-span-2">{cur && <Detail it={cur} />}</div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Scores />
        <div className="lg:col-span-2"><Shapes /></div>
      </div>

      <HowTo>
        <p><b>급등 감지:</b> 이번 주 검색량이 5 이상이고 직전 12주(3개월) 평균의 1.5배 이상. 그리고 검색광고 API의 실제 검색 수로 환산했을 때 평소 흔들림의 {meta.z}배 이상 올라야 합니다(검색이 적은 키워드의 우연한 출렁임 제외). 화면에는 최근 {H}주 안에 감지된 것만 결정 대상으로 보여 줍니다. 그보다 오래된 것은 출시 타이밍이 이미 지났기 때문입니다.</p>
        <p className="mt-1"><b>{H}주 생존:</b> 급등으로 늘어난 검색 중 {Math.round(meta.keep * 100)}% 이상이 {H}주 뒤(12~14주 3주 평균)에도 남으면 버팀. 평소 수준으로 돌아가기만 한 것은 못 버팀입니다. 랜덤 포레스트가 감지 시점까지의 곡선 특징 8개(급등 폭, 평소 수요, 꾸준히 검색된 기간, 작년 같은 철 등), 실제 검색 규모, 30세 이상 검색 곡선 3개로 확률을 냅니다.</p>
        <p className="mt-1"><b>주의:</b> 30세 이상 검색 비중이 50% 미만인 디저트(20대 위주)에서, 30세 이상 검색이 20대보다 훨씬 더 오른 급등(상위 25%). 과거 이런 급등은 {Math.round(scores.warn_rate * 100)}%만 버텨서 확률과 상관없이 단기 대응으로 둡니다. 30세 이상 비중은 데이터랩 연령별 곡선으로 전체 곡선을 맞춰 추정한 값입니다.</p>
        <p className="mt-1"><b>예측 정확도:</b> 새 트렌드(반복형 제외) 급등 {scores.samples.toLocaleString()}건으로, 학습에 안 쓴 키워드의 2024년, 2025년 이후 급등을 맞힌 균형 정확도. 살아남은 것 중 맞힌 비율과 꺼진 것 중 맞힌 비율의 평균입니다. 기존 규칙은 최고점까지 5주 이하로 뜨면 못 버틴다고 보는 규칙(데이터랩 판정 탭에서 트렌드 25개로 찾은 것)입니다.</p>
        <p className="mt-1"><b>유형:</b> 1년 주기 자기상관 0.5 이상이고 10년 중 80% 이상 같은 철(±1달)에 정점이면 반복형. 아니면 최고점까지 뜨는 데 걸린 주가 5주 이하면 단발형, 10주 이상이면 완만형, 그 사이는 보류.</p>
        <p className="mt-1"><b>주 검색:</b> 급등 감지 주의 실제 검색 수. 데이터랩 곡선(키워드마다 최고 주 = 100)을 검색광고 API의 최근 한 달 실제 검색 수에 맞춰 환산한 값이라 키워드끼리 크기 비교가 됩니다. 전성기 대비는 그 키워드의 역대 최고 주를 100%로 본 값으로, 상세 화면에서 참고로만 보여 줍니다.</p>
        <p className="mt-1"><b>제안:</b> 반복형은 시즌 재출시. 주의가 붙은 급등은 단기 대응. 생존 확률 60% 이상이면서 실제 검색이 주 {meta.minWeekly.toLocaleString()}회 이상이면 이달의 맛 후보. 확률은 높지만 주 {meta.minWeekly.toLocaleString()}회 미만이거나, 확률이 40~60%면 관찰. 40% 미만은 단기 대응.</p>
        <p className="mt-1"><b>데이터:</b> 기존 79개에 위키백과 디저트 목록, 해외 바이럴 디저트, 네이버 연관 검색어로 찾은 디저트를 더했습니다(뜬 적 없는 디저트 포함). 실제 검색 수가 없거나 최근 검색이 0이거나 기록이 2년 미만인 키워드는 뺐습니다.</p>
        <p className="mt-1"><b>한계:</b> 정답은 BR 판매가 아니라 검색량 유지 여부이고, 데이터랩은 키워드마다 최고 주를 100으로 맞추므로 키워드 간 절대 규모는 비교하지 않습니다. 계산은 model/ 폴더의 노트북과 export_radar.py.</p>
      </HowTo>
    </div>
  )
}
