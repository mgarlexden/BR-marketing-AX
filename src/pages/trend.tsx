import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts'
import { RADAR } from '@/lib/trend-data'
import { addWeeks, shortDate, type RadarAction, type RadarItem, type RadarType } from '@/lib/trend'
import { Card, CardHeader } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Segmented } from '@/components/ui/segmented'
import { HowTo, PageHeader } from '@/components/page'
import { Pill } from '@/components/status'
import { cn } from '@/lib/utils'

const { meta, scores, items, clusters, season } = RADAR
const H = meta.horizon

const ACTION: Record<RadarAction, { label: string; tone: 'good' | 'primary' | 'warn' | 'neutral' }> = {
  후보: { label: '이달의 맛 후보', tone: 'primary' },
  시즌: { label: '시즌 재출시', tone: 'neutral' },
  관찰: { label: '관찰', tone: 'warn' },
  단기: { label: '단기 대응', tone: 'neutral' },
}
const TYPE_NOTE: Record<RadarType, string> = {
  단발형: '갑자기 튀고 빠르게 식는 키워드',
  완만형: '원래 찾던 수요 위에서 천천히 오르는 키워드',
  반복형: '매년 같은 철에 돌아오는 키워드',
  보류: '뜨는 속도가 애매해서 유형 판정을 미룬 키워드',
}
const ACTION_TEXT: Record<RadarAction, string> = {
  후보: 'text-primary', 시즌: 'text-foreground', 관찰: 'text-amber-600 dark:text-amber-300', 단기: 'text-muted-foreground',
}
type Tab = 'radar' | 'season' | 'model'
const TABS: { value: Tab; label: string }[] = [
  { value: 'radar', label: '급등 키워드' }, { value: 'season', label: '다가오는 시즌' }, { value: 'model', label: '모델 성능' },
]
type Filter = 'all' | RadarAction
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' }, { value: '후보', label: '후보' }, { value: '시즌', label: '시즌' }, { value: '관찰', label: '관찰' }, { value: '단기', label: '단기' },
]
const lineCfg = { v: { label: '검색량', color: 'var(--primary)' } } satisfies ChartConfig
const shapeCfg = { v: { label: '평균 모양', color: 'var(--primary)' } } satisfies ChartConfig

function ProbBar({ p, pick, className }: { p: number; pick?: boolean; className?: string }) {
  return (
    <div className={cn('relative h-1 w-14 overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('absolute inset-y-0 left-0 rounded-full', pick ? 'bg-primary' : p >= 0.6 ? 'bg-good' : p >= 0.4 ? 'bg-amber-400' : 'bg-muted-foreground/40')} style={{ width: `${p * 100}%` }} />
    </div>
  )
}

/** 숫자 칸 대신 사람이 읽는 문장으로 (토스증권 종목 상세처럼) */
function facts(it: RadarItem) {
  const ratio = it.weekly / Math.max(it.usual, 1)
  const year = it.base >= 0.8 ? '지난 1년 평균과 비슷한 수준이고'
    : it.base < 0.1 ? '지난 1년엔 거의 검색되지 않았고'
    : <>지난 1년 평균의 <span className="font-semibold">{(1 / it.base).toFixed(1)}배</span>이고</>
  const steady = it.steady > 104 ? '2년 넘게 꾸준히 검색돼 온 단어예요.'
    : it.steady <= 5 ? '최근에 갑자기 튀어 오른 단어예요.'
    : <><span className="font-semibold">{it.steady}주째</span> 비슷한 수준으로 검색되고 있어요.</>
  return [
    <>이번 주 <span className="font-semibold">{it.weekly.toLocaleString()}회</span> 검색됐어요. 평소 {it.usual.toLocaleString()}회보다 <span className="font-semibold">{ratio.toFixed(1)}배</span> 많아요.</>,
    <>{year}, {steady}</>,
  ]
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
        title={<span className="flex items-baseline gap-2 text-xl font-bold">{it.kw}<span className="text-sm font-normal text-muted-foreground">{it.type}</span></span>}
        description={TYPE_NOTE[it.type]}
        right={<Pill tone={a.tone}>{a.label}</Pill>}
      />
      <ChartContainer config={lineCfg} className="aspect-auto h-52 w-full">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="i" type="number" domain={[0, rows.length - 1]} ticks={yearTicks} tickFormatter={(i) => addWeeks(meta.seriesStart, i).slice(0, 4)} tickLine={false} axisLine={false} />
          <YAxis domain={[0, yMax]} ticks={[0, yMax / 2, yMax]} allowDataOverflow tickLine={false} axisLine={false} width={32} />
          <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltipContent labelFormatter={(_, p) => `${shortDate(addWeeks(meta.seriesStart, p?.[0]?.payload?.i ?? 0))} 주`} formatter={(val) => <span className="flex w-full justify-between gap-6"><span className="text-muted-foreground">검색량</span><span className="font-semibold tabular-nums">{Number(val).toFixed(1)}</span></span>} />} />
          <ReferenceArea x1={it.detectedIdx} x2={Math.min(end, rows.length - 1)} fill="var(--primary)" fillOpacity={0.07} />
          <ReferenceLine x={it.detectedIdx} stroke="var(--foreground)" strokeDasharray="4 4" />
          {end <= rows.length - 1 && <ReferenceLine x={end} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
          <Line dataKey="v" stroke="var(--color-v)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
      <p className="mt-1 text-xs text-muted-foreground">
        {yMax < 100 && `최근 2년이 잘 보이도록 세로축을 0~${yMax}로 확대 (전성기 = 100). `}점선: 급등 감지 {shortDate(it.detected)} / 음영: 그 후 {H}주 (출시까지 걸리는 시간){end > rows.length - 1 && ', 아직 진행 중'}. 이번 주는 역대 최고 주의 {it.size}% 수준
      </p>

      {it.warn && (
        <div className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-4 text-sm leading-relaxed">
          <p className="font-semibold text-amber-700 dark:text-amber-300">30세 이상 검색이 갑자기 늘어난 급등</p>
          <p className="mt-1 text-xs text-muted-foreground">평소엔 20대가 주로 찾던 디저트예요. 이런 급등은 과거 {scores.warn_n}건 중 {Math.round(scores.warn_rate * 100)}%만 {H}주를 버텼어요. 다른 새 트렌드는 {Math.round(scores.survive_rate * 100)}%예요.</p>
        </div>
      )}

      <div className="mt-5 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">{H}주 뒤에도 남을 확률</p>
        <p className={cn('mt-1 text-[32px] font-semibold tracking-tight tabular-nums', it.action === '후보' && 'text-primary')}>{Math.round(it.prob * 100)}%</p>
        <p className="mt-3 text-[15px] leading-relaxed">{it.suggestion}</p>
        {it.actual !== null && (
          <p className="mt-2 text-xs text-muted-foreground">실제 결과: <b className={it.actual ? 'text-good' : 'text-bad'}>{it.actual ? '버팀' : '못 버팀'}</b> (감지 후 {H}주 경과)</p>
        )}
      </div>

      <div className="mt-5 divide-y divide-border border-t border-border text-[15px] leading-relaxed">
        {facts(it).map((f, i) => <p key={i} className="py-3">{f}</p>)}
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

/** 다가오는 시즌: 급등을 기다리지 않고, 출시 시점(13주 뒤)과 그다음 달에 매년 정점인 재료를 미리 보여 준다 */
type SeasonItem = (typeof season.items)[number]
const SEASON_NOTE = ['지금 준비해야 맞출 수 있어요', '지금 준비하면 여유 있게 맞출 수 있어요']
const seasonYear = (m: number) => Number(season.target.slice(0, 4)) + (m < Number(season.target.slice(5, 7)) ? 1 : 0)

function SeasonDetail({ it }: { it: SeasonItem }) {
  const first = it.month === season.months[0]
  const rows = it.series.map((v, i) => ({ i, v }))
  const yearTicks = rows.filter((r) => addWeeks(meta.seriesStart, r.i).slice(5, 7) === '01' && Number(addWeeks(meta.seriesStart, r.i).slice(8)) <= 7).map((r) => r.i)
  // 해마다 정점 달을 연하게 칠해서 '매년 이맘때 오른다'가 보이게
  const bands: [number, number][] = []
  rows.forEach((r) => {
    const inMonth = Number(addWeeks(meta.seriesStart, r.i).slice(5, 7)) === it.month
    if (!inMonth) return
    const last = bands[bands.length - 1]
    if (last && last[1] === r.i - 1) last[1] = r.i
    else bands.push([r.i, r.i])
  })
  const ratio = it.peak / Math.max(it.usual, 1)
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-baseline gap-2 text-xl font-bold">{it.kw}<span className="text-sm font-normal text-muted-foreground">반복형</span></span>}
        description={`매년 ${it.month}월 전후에 정점을 찍는 재료`}
        right={it.brand ? <Pill tone="neutral">콜라보 검토</Pill> : <Pill tone="neutral">시즌 재출시</Pill>}
      />
      <ChartContainer config={lineCfg} className="aspect-auto h-52 w-full">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="i" type="number" domain={[0, rows.length - 1]} ticks={yearTicks} tickFormatter={(i) => addWeeks(meta.seriesStart, i).slice(0, 4)} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false} width={32} />
          <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltipContent labelFormatter={(_, p) => `${shortDate(addWeeks(meta.seriesStart, p?.[0]?.payload?.i ?? 0))} 주`} formatter={(val) => <span className="flex w-full justify-between gap-6"><span className="text-muted-foreground">검색량</span><span className="font-semibold tabular-nums">{Number(val).toFixed(1)}</span></span>} />} />
          {bands.map(([x1, x2]) => <ReferenceArea key={x1} x1={x1} x2={x2} fill={first ? 'var(--bad)' : 'var(--foreground)'} fillOpacity={0.07} />)}
          <Line dataKey="v" stroke="var(--color-v)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
      <p className="mt-1 text-xs text-muted-foreground">음영: 해마다 {it.month}월 (전성기 = 100)</p>

      <div className="mt-5 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">다음 정점</p>
        <p className={cn('mt-1 text-[32px] font-semibold tracking-tight tabular-nums', first && 'text-bad')}>{seasonYear(it.month)}년 {it.month}월</p>
        <p className="mt-2 text-[15px] leading-relaxed">{SEASON_NOTE[first ? 0 : 1]}. {it.brand ? '이미 있는 제품이라 이달의 맛보다는 콜라보로 검토해요.' : '시즌 한정 맛으로 준비해요.'}</p>
      </div>

      <div className="mt-5 divide-y divide-border border-t border-border text-[15px] leading-relaxed">
        <p className="py-3">최근 {it.total}년 중 <span className="font-semibold">{it.years}번</span> 이 무렵에 정점을 찍었어요.</p>
        <p className="py-3">최근 1년 중 가장 많을 때 주 <span className="font-semibold">{it.peak.toLocaleString()}회</span> 검색됐어요. 1년 평균 {it.usual.toLocaleString()}회의 <span className="font-semibold">{ratio.toFixed(1)}배</span>예요.</p>
      </div>
    </Card>
  )
}

function Season() {
  const [month, setMonth] = useState(season.months[0])
  const [sel, setSel] = useState(season.items[0]?.kw ?? '')
  const list = season.items.filter((it) => it.month === month)
  const cur = list.find((i) => i.kw === sel) ?? list[0]
  const gi = season.months.indexOf(month)
  const opts = season.months.map((m) => ({ value: String(m), label: `${m}월` }))
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader title={<span className="text-lg font-bold">다가오는 시즌</span>} description="곧 다가오는 시즌이에요."
          right={<Segmented label="정점 달" value={String(month)} options={opts} onChange={(v) => { setMonth(Number(v)); setSel('') }} />} />
        <div className={cn('mb-2 rounded-2xl px-4 py-3.5', gi === 0 ? 'bg-bad/10' : 'bg-primary/10')}>
          <p className={cn('text-base font-bold', gi === 0 ? 'text-bad' : 'text-primary')}>{SEASON_NOTE[gi]}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">매년 {month}월에 정점을 찍는 재료예요. 이달의 맛 출시까지 {H}주가 걸려요.</p>
        </div>
        <ul className="-mx-1 max-h-[600px] overflow-y-auto pt-1">
          {list.map((it) => (
            <li key={it.kw}>
              <button type="button" onClick={() => setSel(it.kw)} aria-current={it.kw === cur?.kw}
                className={cn('flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted/50', it.kw === cur?.kw && 'bg-muted/70')}>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{it.kw}{it.brand && <span className="ml-2 text-xs font-normal text-muted-foreground">기존 제품</span>}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">최근 {it.total}년 중 {it.years}번 정점</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-medium tabular-nums">{it.peak.toLocaleString()}회</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">정점 주 검색</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div className="lg:col-span-2">{cur && <SeasonDetail it={cur} />}</div>
    </div>
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
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}

export default function Trend() {
  const [tab, setTab] = useState<Tab>('radar')
  const [filter, setFilter] = useState<Filter>('all')
  const [sel, setSel] = useState(fresh[0]?.kw ?? items[0]?.kw ?? '')
  const list = useMemo(() => fresh.filter((i) => filter === 'all' || i.action === filter), [filter])
  const cur = items.find((i) => i.kw === sel) ?? items[0]
  const count = (a: RadarAction) => fresh.filter((i) => i.action === a).length
  const opts = FILTERS.map((f) => ({ ...f, label: f.value === 'all' ? `${f.label} ${fresh.length}` : `${f.label} ${count(f.value)}` }))
  const row = (it: RadarItem, right?: React.ReactNode) => (
    <li key={it.kw}>
      <button type="button" onClick={() => setSel(it.kw)} aria-current={it.kw === cur?.kw}
        className={cn('flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted/50', it.kw === cur?.kw && 'bg-muted/70')}>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{it.kw}{it.warn && <span className="ml-2 text-xs font-semibold text-amber-600 dark:text-amber-300">주의</span>}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground" title="감지 주 실제 검색 수 (검색광고 API 월간 검색 수로 환산)">
            {it.type}, {shortDate(it.detected)} 감지, 주 <span className={cn('tabular-nums', it.weekly >= meta.minWeekly && 'text-foreground')}>{it.weekly.toLocaleString()}</span>회
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-2"><ProbBar p={it.prob} pick={it.action === '후보'} /><span className={cn('w-11 text-base font-medium tabular-nums', it.action === '후보' && 'text-primary')}>{Math.round(it.prob * 100)}%</span></div>
          {right ?? <p className={cn('mt-0.5 text-[13px] font-medium', ACTION_TEXT[it.action])}>{ACTION[it.action].label}{it.action === '관찰' && <span className="font-normal text-muted-foreground"> ({it.brand ? '기존 제품' : it.prob >= 0.6 && it.weekly < meta.minWeekly ? '규모 작음' : '확률 애매'})</span>}</p>}
        </div>
      </button>
    </li>
  )

  return (
    <div>
      <PageHeader
        title="트렌드 레이더"
        basis={{ level: '실데이터', why: `네이버 데이터랩 주간 검색량 ${shortDate(meta.first)} ~ ${shortDate(meta.last)}, 키워드 ${scores.keywords}개` }}
        sub={`최근 3개월(${H}주) 안에 검색량이 급등한 키워드를 골라, 이달의 맛 출시까지 걸리는 ${H}주 뒤에도 수요가 남을지 예측해요. 데이터 기준일 ${shortDate(meta.last)}.`}
      />

      <Card className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="추적 중인 키워드" value={scores.keywords} note="디저트, 재료의 네이버 검색량" />
        <Kpi label="최근 3개월 급등" value={fresh.length} note={warnCount ? `주의 ${warnCount}개 포함` : '평소보다 확실히 많이 검색됨'} />
        <Kpi label="이 중 이달의 맛 후보" value={count('후보')} note={`확률 60% 이상, 주 ${meta.minWeekly.toLocaleString()}회 이상`} />
        <Kpi label="예측 정확도" value={`${Math.round(scores.all_bal * 100)}%`} note={`반복형 포함 기준. 새 트렌드만 보면 ${Math.round(scores.model_bal * 100)}% (꺼질 것 ${Math.round(scores.hit_fail * 100)}%, 버틸 것 ${Math.round(scores.hit_survive * 100)}%)`} />
      </Card>

      <div role="tablist" aria-label="레이더 보기" className="mb-5 flex gap-7 border-b border-border">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}
            className={cn('-mb-px border-b-2 pb-3 pt-1 text-[17px] transition-colors',
              tab === t.value ? 'border-foreground font-bold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'season' && <Season />}

      {tab === 'radar' && <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title={<span className="text-lg font-bold">최근 3개월 급등 키워드</span>} description="지금 결정할 대상" right={<Segmented label="제안 필터" value={filter} options={opts} onChange={setFilter} />} />
          <p className="flex justify-between px-3 pb-2 text-xs text-muted-foreground"><span>키워드</span><span>{H}주 뒤 남을 확률</span></p>
          <ul className="-mx-1 max-h-[560px] overflow-y-auto border-t border-border pt-1">{list.map((it) => row(it))}</ul>
          {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">해당하는 키워드가 없어요</p>}

          {past.length > 0 && (
            <details className="mt-4 border-t border-border pt-4 text-sm">
              <summary className="cursor-pointer list-none px-3 font-medium">
                지난 판정 {past.length}개 <span className="text-xs font-normal text-muted-foreground">감지 후 {H}주가 지나 실제 결과가 나온 키워드. 예측이 맞은 것 {pastHit}/{past.length}</span>
              </summary>
              <ul className="-mx-1 mt-2">
                {past.map((it) => row(it, <p className="mt-0.5 text-xs">실제 <b className={it.actual ? 'text-good' : 'text-muted-foreground'}>{it.actual ? '버팀' : '못 버팀'}</b>{(it.prob >= 0.5) === it.actual ? <span className="ml-1.5 text-good">맞음</span> : <span className="ml-1.5 text-bad">틀림</span>}</p>))}
              </ul>
              <p className="mt-2 px-3 text-xs text-muted-foreground">이 기간은 모델 학습에도 쓰여서 참고용이에요. 공정한 성능은 아래 예측 성능 카드의 교차검증 점수를 보세요.</p>
            </details>
          )}
        </Card>
        <div className="lg:col-span-2">{cur && <Detail it={cur} />}</div>
      </div>}

      {tab === 'model' && <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Scores />
        <div className="lg:col-span-2"><Shapes /></div>
      </div>

      <HowTo>
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
      </>}
    </div>
  )
}
