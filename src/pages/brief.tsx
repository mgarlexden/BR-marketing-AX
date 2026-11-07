import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { useApp } from '@/lib/app-context'
import { DIR_LABEL, DIR_RULE, stageStats, typeStats, verdict, verdictPhases, type Dir } from '@/lib/data'
import { dateLabel, pct } from '@/lib/format'
import { feed } from '@/lib/derived'
import AdvancedStats, { type Kpi } from '@/components/ui/advanced-stats'
import { ClippedAreaChart } from '@/components/ui/advanced-stats-utils/charts'
import { Card, CardHeader } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Day, Delta } from '@/components/figures'
import { PageHeader, EmptyState } from '@/components/page'
import { DirChip, Pill } from '@/components/status'
import { Sparkline, ZBar } from '@/components/charts/mini'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EvidenceBadge } from '@/components/evidence'
import { DAYS } from '@/lib/data'

const DIR_COLOR: Record<Dir, string> = { expand: 'var(--dir-expand)', maintain: 'var(--dir-maintain)', fix: 'var(--dir-fix)', wrap: 'var(--dir-wrap)', wait: 'var(--border)' }


const pilotCfg = { pilot: { label: '선출시 매장', color: 'var(--primary)' }, ctrl: { label: '대조 매장', color: 'var(--muted-foreground)' } } satisfies ChartConfig

/** 선출시 매장과 같은 기간 미출시로 가정한 대조 매장을 나란히 놓고 차이(순효과)를 본다 */
function PilotCard() {
  const { data: d, day: D } = useApp()
  const nP = d.stores.filter((s) => s.pilot).length
  const rows = Array.from({ length: DAYS + 1 }, (_, i) => ({ day: i, pilot: i <= D ? d.pilotAgg[i] : null, ctrl: i <= D ? d.ctrlAgg[i] : null }))
  const net = d.netAgg[D]
  const net3 = d.netAgg.slice(Math.max(0, D - 2), D + 1).reduce((a, b) => a + b, 0) / Math.min(3, D + 1)
  const all = [...d.pilotAgg.slice(0, D + 1), ...d.ctrlAgg.slice(0, D + 1)]
  const hi = Math.max(0.4, ...all), lo = Math.min(0, ...all), step = hi - lo > 1.2 ? 0.5 : 0.2
  const pp2 = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%p`
  return (
    <Card className="mb-4">
      <CardHeader title={`선출시 효과: 선출시 ${nP}곳 vs 대조 ${d.stores.length - nP}곳`} right={<span className="flex items-center gap-1.5 text-xs text-muted-foreground">대조는 같은 기간 미출시로 가정<EvidenceBadge kind="sim" /></span>} />
      <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <ChartContainer config={pilotCfg} className="aspect-auto h-52 w-full">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" type="number" domain={[0, 28]} ticks={[0, 7, 14, 21, 28]} tickFormatter={(x) => `D+${x}`} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis domain={[Math.floor(lo / step) * step, Math.ceil(hi / step) * step]} tickFormatter={(x) => pct(x)} tickLine={false} axisLine={false} width={48} tickCount={5} />
            <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltipContent labelFormatter={(_, p) => `D+${p?.[0]?.payload?.day ?? ''}`} formatter={(v, n) => <span className="flex w-full justify-between gap-6"><span className="text-muted-foreground">{pilotCfg[n as keyof typeof pilotCfg]?.label}</span><span className="num font-semibold">{pct(Number(v))}</span></span>} />} />
            <Line dataKey="pilot" stroke="var(--color-pilot)" strokeWidth={3} dot={false} isAnimationActive={false} />
            <Line dataKey="ctrl" stroke="var(--color-ctrl)" strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
            <ReferenceLine x={D} stroke="var(--foreground)" />
          </ComposedChart>
        </ChartContainer>
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">순효과 (선출시 − 대조)</p>
            <p className="num text-3xl font-bold tracking-tighter">{pp2(net)}</p>
            <p className="text-xs text-muted-foreground">최근 3일 평균 <b className="num text-foreground">{pp2(net3)}</b></p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">날씨·요일 영향이 두 그룹에 똑같이 들어가므로 차이만 신제품 효과의 후보로 봅니다. 선출시 매장은 본사가 고르는 매장이라 이 차이를 가맹점 전체로 일반화하지 않습니다. 아래 20곳 합산은 확대 후 모습입니다.</p>
        </div>
      </div>
    </Card>
  )
}

export default function Brief() {
  const { data: d, day: D, href } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const phases = useMemo(() => verdictPhases(d, D), [d, D])
  const types = typeStats(d, D)
  const items = useMemo(() => feed(d, D, 8), [d, D])
  const agg = d.agg[D], prev = D > 0 ? d.agg[D - 1] : agg
  const pp = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%p` }
  const maxAbs = Math.max(0.3, ...types.map((t) => Math.abs(t.now)))

  const stg = useMemo(() => stageStats(d, D), [d, D])
  const dv = (x: { now: number; before: number }) => x.now - x.before
  const kpis: Kpi[] = [
    { label: '① 유입', hint: '방문 수가 평소보다 늘어난 정도 (최근 3일 평균)', value: pct(stg.inflow.now), change: pp(dv(stg.inflow)), tone: dv(stg.inflow) >= 0 ? 'good' : 'bad', accent: true, badge: <EvidenceBadge kind="ok" /> },
    { label: '② 관심', hint: '쇼케이스 앞 체류가 평소보다 길어진 정도', value: pct(stg.interest.now), change: pp(dv(stg.interest)), tone: dv(stg.interest) >= 0 ? 'good' : 'bad', accent: true, badge: <EvidenceBadge kind="assume" note="쇼케이스 앞 구역을 매장에서 지정한다는 가정" /> },
    { label: '③ 전환', hint: '방문 100명당 신제품 판매 수 (POS 필요)', value: `${stg.conv.now.toFixed(0)}개`, change: `${Math.round(dv(stg.conv)) > 0 ? '+' : Math.round(dv(stg.conv)) < 0 ? '−' : ''}${Math.abs(Math.round(dv(stg.conv)))}개`, tone: dv(stg.conv) >= 0 ? 'good' : 'bad', accent: true, badge: <EvidenceBadge kind="ext" /> },
    { label: '④ 맛 단위', hint: '전체 주문 중 신제품 비중 (POS·키오스크 필요)', value: `${Math.round(stg.share.now * 100)}%`, change: pp(dv(stg.share)), tone: dv(stg.share) >= 0 ? 'good' : 'bad', accent: true, badge: <EvidenceBadge kind="ext" /> },
  ]

  const bands = phases.filter((p) => p.dir !== 'wait').map((p) => ({ from: p.from, to: p.to, color: DIR_COLOR[p.dir], label: p.to - p.from >= 2 ? DIR_LABEL[p.dir] : undefined }))
  const shownPhases = phases.filter((p) => p.dir !== 'wait').slice(-4).reverse()

  const chart = (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-muted/70 px-4 py-3">
        <DirChip dir={v.dir} className="text-sm" />
        <p className="min-w-0 flex-1 text-sm font-medium">{v.headline}</p>
      </div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">전체 반응 (평소 대비)</p>
          <p className="flex items-baseline gap-3"><span className="num text-4xl font-bold tracking-tighter">{pct(agg)}</span><span className="text-sm text-muted-foreground">어제 대비 <Delta v={agg - prev} /></span></p>
        </div>
        <p className="text-xs text-muted-foreground">색 띠는 그날의 판정, 점선은 기존 확인 시점</p>
      </div>
      <ClippedAreaChart data={d.agg.map((x, i) => ({ day: i, value: i <= D ? x : null }))} clipDay={D} bands={bands} refs={[{ x: 15, label: '기존 D+15' }, { x: 22, label: 'D+22' }]} height={230} />
      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">날짜별 판정과 이유</p>
        <ul className="divide-y divide-border">
          {shownPhases.map((p) => (
            <li key={p.from} className="flex items-center gap-3 py-1.5 text-sm">
              <DirChip dir={p.dir} className="w-11 justify-center" />
              <span className="w-24 shrink-0 text-xs"><Day n={p.from} />{p.to !== p.from && <span className="text-muted-foreground"> ~ </span>}{p.to !== p.from && <Day n={p.to} />}</span>
              <span className="min-w-0 flex-1 text-muted-foreground">{p.reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )


  return (
    <div>
      <PageHeader title="출시 현황" right={<span className="text-sm text-muted-foreground">반응 = 방문이 평소보다 늘어난 정도 · 기준일 <b className="text-foreground">{dateLabel(d, D)}</b></span>} />
      <AdvancedStats
        chart={chart}
        goal={{ label: '현재 판정', title: DIR_LABEL[v.dir], value: `신뢰도 ${v.conf}`, target: `근거 ${v.days}일`, percent: (v.days / 15) * 100, note: DIR_RULE[v.dir] }}
        kpis={kpis}
      >
        <PilotCard />
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="변화 알림" />
            {items.length === 0 ? <EmptyState title="아직 알림이 없습니다" /> : (
              <ul className="divide-y divide-border">
                {items.map((it, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-10 shrink-0 text-xs"><Day n={it.day} /></span>
                    <Pill tone={it.tone}>{it.tone === 'primary' ? '알림' : it.tone === 'warn' ? '점검' : '주의'}</Pill>
                    <span className="min-w-0 flex-1">{it.text}</span>
                    {it.store && <a href={href('react', { v: 'floor', store: it.store })} className="shrink-0 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm active:translate-y-px">동선</a>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="상권별 반응" right={<a href={href('react', { v: 'stores' })} className="text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm active:translate-y-px">전체 보기</a>} />
            <Table>
              <THead><TR><TH>상권</TH><TH>반응</TH><TH>추이</TH></TR></THead>
              <TBody>
                {types.slice().sort((a, b) => b.now - a.now).map((t) => (
                  <TR key={t.type}>
                    <TD><a href={href('react', { v: 'stores', type: t.type })} className="font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm active:translate-y-px">{t.type}</a></TD>
                    <TD className="whitespace-nowrap"><ZBar v={t.now} range={maxAbs} /><b className="num">{pct(t.now)}</b></TD>
                    <TD><Sparkline values={t.series.slice(-7)} w={72} h={22} tone={t.now >= 0 ? 'main' : 'ctx'} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      </AdvancedStats>
    </div>
  )
}
