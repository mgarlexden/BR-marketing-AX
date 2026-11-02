'use client'
import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceDot, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { pct } from '@/lib/format'

export interface ClippedPoint { day: number; value: number | null }
export interface Band { from: number; to: number; color: string; label?: string }

/** 날짜까지만 영역을 채우고 그 뒤는 비워 두는 면적 차트. 날짜 스크러버가 곧 클립 경계다. */
export function ClippedAreaChart({
  data, clipDay, refs = [], bands = [], height = 280, label = '전체 반응',
}: {
  data: ClippedPoint[]
  clipDay: number
  refs?: { x: number; label: string }[]
  bands?: Band[]
  height?: number
  label?: string
}) {
  const config = { value: { label, color: 'var(--primary)' } } satisfies ChartConfig
  const vals = data.map((d) => d.value).filter((v): v is number => v != null)
  const lo = Math.min(0, ...vals), hi = Math.max(0.4, ...vals)
  const step = hi - lo > 1.2 ? 0.5 : 0.2
  const yMin = Math.floor(lo / step) * step, yMax = Math.ceil(hi / step) * step
  const cur = data[clipDay]?.value
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="clipFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="day" type="number" domain={[0, 28]} ticks={[0, 7, 14, 21, 28]} tickFormatter={(d) => `D+${d}`} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis domain={[yMin, yMax]} tickFormatter={(v) => pct(v)} tickLine={false} axisLine={false} width={48} tickCount={5} />
        {bands.map((b) => (
          <ReferenceArea key={`band-${b.from}`} x1={Math.max(0, b.from - 0.5)} x2={b.to + 0.5} fill={b.color} fillOpacity={0.11} stroke="none"
            label={b.label ? { value: b.label, position: 'insideTop', fill: b.color, fontSize: 11, fontWeight: 700 } : undefined} />
        ))}
        {refs.map((r) => (
          <ReferenceLine key={`ref-${r.x}`} x={r.x} stroke="var(--muted-foreground)" strokeDasharray="2 4" label={{ value: r.label, position: 'insideTopRight', fill: 'var(--muted-foreground)', fontSize: 11 }} />
        ))}
        <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltipContent hideIndicator labelFormatter={(_, p) => `D+${p?.[0]?.payload?.day ?? ''}`} formatter={(v) => <span className="num font-semibold text-foreground">{pct(Number(v))}</span>} />} />
        <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2.5} fill="url(#clipFill)" connectNulls={false} isAnimationActive={false} />
        <ReferenceLine x={clipDay} stroke="var(--foreground)" strokeWidth={1} />
        {cur != null && <ReferenceDot x={clipDay} y={cur} r={5} fill="var(--color-value)" stroke="var(--card)" strokeWidth={2} />}
      </AreaChart>
    </ChartContainer>
  )
}
