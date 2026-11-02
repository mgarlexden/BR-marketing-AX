import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, ScanEye, Search } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { DAYS, TYPES, diagnose, movers, typeStats, type StoreType } from '@/lib/data'
import { storeStatuses } from '@/lib/derived'
import { num, pct, signed } from '@/lib/format'
import { Day } from '@/components/figures'
import { Card } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Segmented } from '@/components/ui/segmented'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, HowTo, PageHeader } from '@/components/page'
import { Pill } from '@/components/status'
import { Sparkline, ZBar } from '@/components/charts/mini'
import { cn } from '@/lib/utils'

const COLORS: Record<StoreType, string> = { '대학가': 'var(--chart-1)', '오피스': 'var(--chart-2)', '주거': 'var(--chart-3)', '역세권': 'var(--chart-4)', '관광': 'var(--chart-5)' }
type SortKey = 'name' | 'react' | 'visits' | 'conv' | 'rank'
const STATUS_GROUP = { all: null, attention: ['check', 'stockout'], move: ['surge', 'drop'], normal: ['normal'] } as const

export default function Where() {
  const { data: d, day: D, q, setQ, href } = useApp()
  const type = (TYPES as readonly string[]).includes(q.type) ? (q.type as StoreType) : null
  const sg = (q.st in STATUS_GROUP ? q.st : 'all') as keyof typeof STATUS_GROUP
  const view = q.view === 'curve' ? 'curve' : 'table'
  const [sk, sd] = (q.sort || 'react-desc').split('-') as [SortKey, 'asc' | 'desc']
  const text = (q.q || '').trim()

  const types = typeStats(d, D)
  const diag = useMemo(() => diagnose(d, D), [d, D])
  const mv = useMemo(() => movers(d, D, 5, 3), [d, D])
  const status = useMemo(() => storeStatuses(d, D), [d, D])

  const rows = useMemo(() => d.stores.map((st) => {
    const p = st.series[D]
    const dr = diag.rows.find((r) => r.st.id === st.id)!
    const m = mv.find((r) => r.st.id === st.id)!
    return { st, p, react: p.react, conv: dr.conv * 100, convGap: dr.y, status: status[st.id], rank: m.now, delta: m.delta, hasDelta: m.before != null, trail: st.series.slice(Math.max(0, D - 6), D + 1).map((x) => x.react) }
  }), [d, D, diag, mv, status])

  const shown = rows
    .filter((r) => (!type || r.st.type === type) && (!STATUS_GROUP[sg] || (STATUS_GROUP[sg] as readonly string[]).includes(r.status.key)) && (!text || r.st.name.includes(text)))
    .sort((a, b) => {
      const k = { name: a.st.name.localeCompare(b.st.name, 'ko'), react: a.react - b.react, visits: a.p.visits - b.p.visits, conv: a.conv - b.conv, rank: a.rank - b.rank }[sk]
      return sd === 'asc' ? k : -k
    })
  const maxAbs = Math.max(0.3, ...rows.map((r) => Math.abs(r.react)))

  const th = (key: SortKey, label: string, right = false) => {
    const on = sk === key
    return (
      <TH className={right ? 'text-right' : ''} aria-sort={on ? (sd === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => setQ({ sort: `${key}-${on && sd === 'desc' ? 'asc' : 'desc'}` })} className={cn('inline-flex items-center gap-1 hover:text-foreground', on && 'text-foreground')}>
          {label}{on && (sd === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
      </TH>
    )
  }

  const config = Object.fromEntries(TYPES.map((t) => [t, { label: t, color: COLORS[t] }])) as ChartConfig
  const curveRows = Array.from({ length: DAYS + 1 }, (_, i) => ({ day: i, ...Object.fromEntries(types.map((t) => [t.type, i <= D ? t.series[i] : null])) }))
  const all = types.flatMap((t) => t.series)
  const hi = Math.max(0.4, ...all), lo = Math.min(0, ...all), step = hi - lo > 1.2 ? 0.5 : 0.2

  return (
    <div>
      <PageHeader title="매장 반응 분석" basis={{ level: '약함', why: '상권별 속도 비교와 순위 급변은 공개 근거를 찾지 못한 자체 가설입니다. 합성 데이터에서 상권별 차이를 넣어 시연합니다.' }}
        right={<Segmented label="보기" value={view} onChange={(v) => setQ({ view: v })} options={[{ value: 'table', label: '매장 표' }, { value: 'curve', label: '상권 곡선' }]} />} />

      <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {types.map((t) => {
          const on = type === t.type
          return (
            <button key={t.type} type="button" aria-pressed={on} onClick={() => setQ({ type: on ? '' : t.type })}
              className={cn('rounded-2xl border p-3.5 text-left transition-colors', on ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border bg-card hover:bg-accent/50')}>
              <div className="flex items-center justify-between"><span className="text-sm font-semibold">{t.type}</span><i className="size-2 rounded-full" style={{ background: COLORS[t.type] }} /></div>
              <p className="num mt-1 text-xl font-bold tracking-tighter">{pct(t.now)}</p>
              <div className="flex items-center justify-between"><span className="num text-xs text-muted-foreground">{t.reached ? <>정점 <Day n={t.peakDay} /></> : '진행 중'}</span><Sparkline values={t.series.slice(-7)} w={56} h={18} tone={on ? 'main' : 'ctx'} /></div>
            </button>
          )
        })}
      </div>

      {view === 'curve' ? (
        <Card className="p-5">
          <ChartContainer config={config} className="aspect-auto h-80 w-full">
            <ComposedChart data={curveRows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" type="number" domain={[0, 28]} ticks={[0, 7, 14, 21, 28]} tickFormatter={(x) => `D+${x}`} tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis domain={[Math.floor(lo / step) * step, Math.ceil(hi / step) * step]} tickFormatter={(x) => pct(x)} tickLine={false} axisLine={false} width={48} tickCount={5} />
              <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltipContent labelFormatter={(_, p) => `D+${p?.[0]?.payload?.day ?? ''}`} formatter={(v, n) => <span className="flex w-full justify-between gap-6"><span className="text-muted-foreground">{n}</span><span className="num font-semibold">{pct(Number(v))}</span></span>} />} />
              {TYPES.map((t) => <Line key={t} dataKey={t} stroke={COLORS[t]} strokeOpacity={!type || type === t ? 1 : 0.2} strokeWidth={type === t ? 3.5 : 2} dot={false} isAnimationActive={false} />)}
              <ReferenceLine x={D} stroke="var(--foreground)" />
            </ComposedChart>
          </ChartContainer>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">{TYPES.map((t) => <span key={t} className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: COLORS[t] }} />{t}</span>)}</div>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={q.q || ''} onChange={(e) => setQ({ q: e.target.value })} placeholder="매장 검색" aria-label="매장 검색" className="h-9 w-44 rounded-full border border-input bg-background pl-9 pr-3 text-sm" />
            </label>
            <Segmented label="상태" value={sg} onChange={(v) => setQ({ st: v })} options={[{ value: 'all', label: '전체' }, { value: 'attention', label: '점검' }, { value: 'move', label: '급변' }, { value: 'normal', label: '정상' }]} />
            <span className="num ml-auto text-xs text-muted-foreground">{shown.length} / {rows.length}곳</span>
          </div>
          {shown.length === 0 ? <div className="p-4"><EmptyState title="조건에 맞는 매장이 없습니다" action={{ label: '필터 지우기', onClick: () => setQ({ type: '', st: '', q: '' }) }} /></div> : (
            <Table wrapperClassName="max-h-[34rem]" className="[&_td]:py-1.5">
              <THead className="sticky top-0 z-10 bg-card">
                <TR>{th('name', '매장')}{th('react', '반응')}{th('visits', '방문', true)}{th('conv', '구매 전환', true)}<TH>상태</TH>{th('rank', '순위', true)}<TH>추이</TH><TH className="text-right">동선</TH></TR>
              </THead>
              <TBody>
                {shown.map((r) => (
                  <TR key={r.st.id} className="hover:bg-accent/40">
                    <TD className="whitespace-nowrap font-semibold">{r.st.name}</TD>
                    <TD className="whitespace-nowrap"><ZBar v={r.react} range={maxAbs} /><b className="num">{pct(r.react)}</b></TD>
                    <TD className="num text-right">{num(r.p.visits)}<span className="text-muted-foreground"> / {num(r.p.exp)}</span></TD>
                    <TD className="num whitespace-nowrap text-right">{r.conv.toFixed(0)}개<span className={cn('ml-1 text-xs', r.convGap <= -0.25 ? 'text-bad' : 'text-muted-foreground')}>{pct(r.convGap)}</span></TD>
                    <TD><Pill tone={r.status.tone}>{r.status.label}</Pill></TD>
                    <TD className="num whitespace-nowrap text-right">{r.rank}위{r.hasDelta && r.delta !== 0 && <span className={cn('ml-1 text-xs', r.delta > 0 ? 'text-good' : 'text-bad')}>{signed(r.delta)}</span>}</TD>
                    <TD><Sparkline values={r.trail} w={72} h={22} tone={r.react >= 0 ? 'main' : 'ctx'} /></TD>
                    <TD className="text-right"><a href={href('why', { store: r.st.id })} aria-label={`${r.st.name} 동선 보기`} className="inline-flex size-8 items-center justify-center rounded-full text-primary hover:bg-accent"><ScanEye className="size-4" /></a></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}
      <HowTo>
        <p>반응 = 오늘 방문 ÷ 평소 예상 − 1 (평소는 출시 전 14일 평균에 요일과 기온을 맞춘 값). 구매 전환 = 존 방문 100명당 신제품 판매 수이고 오른쪽 값은 전 매장 중앙값 대비입니다. 순위는 최근 3일 평균 반응 기준이며, 3일 전과 비교해 5계단 이상 움직이고 전체 흐름과 다르게 달라진 매장만 급변으로 표시합니다. 구매 점검은 방문이 15% 이상 늘었는데 전환이 중앙값보다 25% 넘게 낮은 매장입니다.</p>
      </HowTo>
    </div>
  )
}
