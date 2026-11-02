import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

export interface ParetoItem { name: string; value: number }

/** 막대(큰 순서)와 누적 비율선, 80% 기준선. 80% 안에 드는 막대만 진하게 칠한다. */
export function ParetoChart({ data, valueLabel, unit = '', height = 280, within = '80% 안', beyond = '80% 밖' }: {
  data: ParetoItem[]; valueLabel: string; unit?: string; height?: number; within?: string; beyond?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let run = 0
  const rows = data.map((d) => {
    const before = run / total
    run += d.value
    return { ...d, cum: Math.round((run / total) * 100), inside: before < 0.8 }
  })
  const config = { value: { label: valueLabel, color: 'var(--primary)' }, cum: { label: '누적 비율', color: 'var(--foreground)' } } satisfies ChartConfig
  return (
    <div>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <ComposedChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} className="stroke-border" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
          <YAxis yAxisId="l" tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <YAxis yAxisId="r" orientation="right" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={44} />
          <ReferenceLine yAxisId="r" y={80} stroke="var(--muted-foreground)" strokeDasharray="5 5" label={{ value: '80%', position: 'insideTopRight', fill: 'var(--foreground)', fontSize: 12, fontWeight: 700 }} />
          <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent hideIndicator formatter={(v, n) => <span className="flex w-full justify-between gap-4"><span className="text-muted-foreground">{n === 'cum' ? '누적 비율' : valueLabel}</span><span className="num font-semibold">{n === 'cum' ? `${v}%` : `${v}${unit}`}</span></span>} />} />
          <Bar yAxisId="l" dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            {rows.map((r, i) => <Cell key={i} fill="var(--primary)" fillOpacity={r.inside ? 1 : 0.22} />)}
          </Bar>
          <Line yAxisId="r" dataKey="cum" type="monotone" stroke="var(--foreground)" strokeWidth={2.5} dot={{ r: 4.5, fill: 'var(--card)', stroke: 'var(--foreground)', strokeWidth: 2.5 }} isAnimationActive={false} />
        </ComposedChart>
      </ChartContainer>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="flex items-center gap-2"><i className="size-3 rounded-full bg-primary" />{valueLabel}, {within}</span>
        <span className="flex items-center gap-2"><i className="size-3 rounded-full bg-primary/25" />{valueLabel}, {beyond}</span>
        <span className="flex items-center gap-2"><i className="size-3 rounded-full bg-foreground" />누적 비율</span>
      </div>
    </div>
  )
}
