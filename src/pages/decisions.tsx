import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChevronRight } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { classify, DAYS, DIR_LABEL, DIR_MEANING, DIR_OPTIONS, diagnose, radarCurve, verdict, type Dir } from '@/lib/data'
import { dirKey, fixKey, radarKey } from '@/lib/derived'
import { dLabel, num, pct } from '@/lib/format'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { DirChip } from '@/components/status'
import { Day, Delta } from '@/components/figures'
import { cn } from '@/lib/utils'

const pp = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%p`
const radarCfg = { orig: { label: '레이더 예상', color: 'var(--muted-foreground)' }, fixed: { label: '보정 후', color: 'var(--chart-1)' }, actual: { label: '매장 실제', color: 'var(--primary)' } } satisfies ChartConfig

export function DirCard() {
  const { data: d, day: D, setAppr, href } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const rec = v.dir as Exclude<Dir, 'wait'>
  const [choice, setChoice] = useState<Exclude<Dir, 'wait'>>(rec)
  const [note, setNote] = useState('')
  useEffect(() => { setChoice(rec); setNote('') }, [rec, D])
  const peakDay = d.agg.slice(0, D + 1).indexOf(v.peak)
  const evidence = [
    { k: '전체 반응', v: `${pct(v.a)} (정점 ${pct(v.peak)}, ${dLabel(Math.max(0, peakDay))})`, to: href('react', { v: 'stores' }) },
    { k: '최근 3일', v: <Delta v={v.slope} />, to: href('react', { v: 'stores', view: 'curve' }) },
    { k: '구매 점검 매장', v: `${v.flagged}곳, 놓친 판매 ${num(v.lostUnits)}개/일`, to: href('react', { v: 'floor', tab: 'dist' }) },
    { k: '근거', v: `${v.days}일, 신뢰도 ${v.conf}`, to: undefined },
  ]
  const meaning = DIR_MEANING[d.scn.launch]
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2">방향 판단<Day n={D} className="text-sm" /></span>} right={<span className="text-xs text-muted-foreground">권고 <DirChip dir={rec} className="ml-1" /></span>} />
      <div role="radiogroup" aria-label="방향 선택" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {DIR_OPTIONS.map((o) => {
          const on = choice === o
          return (
            <button key={o} type="button" role="radio" aria-checked={on} onClick={() => setChoice(o)}
              className={cn('rounded-2xl border p-4 text-left transition-colors', on ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border bg-card hover:bg-accent/50')}>
              <div className="flex items-center justify-between"><span className="text-lg font-bold">{DIR_LABEL[o]}</span>{o === rec && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">권고</span>}</div>
              <p className="mt-1 text-xs text-muted-foreground">{meaning[o]}</p>
            </button>
          )
        })}
      </div>
      <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
        {evidence.map((e) => (
          <div key={e.k} className="flex items-center justify-between gap-3 border-t border-border py-2 text-sm">
            <dt className="text-muted-foreground">{e.k}</dt>
            <dd className="flex items-center gap-1.5 text-right font-semibold tabular-nums">{e.v}{e.to && <a href={e.to} aria-label={`${e.k} 자세히`} className="text-primary"><ChevronRight className="size-4" /></a>}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={choice === rec ? '메모 (선택)' : '권고와 다른 이유 (선택)'} aria-label="사유" className="h-10 min-w-56 flex-1 rounded-full border border-input bg-background px-4 text-sm" />
        <Button onClick={() => setAppr(dirKey(d.scn.id, D), { kind: 'dir', day: D, choice, rec, note: note.trim() })}>{DIR_LABEL[choice]}(으)로 기록</Button>
      </div>
    </Card>
  )
}

export function FixCard() {
  const { data: d, day: D, setAppr, href } = useApp()
  const rows = useMemo(() => diagnose(d, D).rows.filter((r) => r.zone === 'flag').sort((a, b) => a.y - b.y), [d, D])
  const [sel, setSel] = useState<string[]>(rows.map((r) => r.st.id))
  useEffect(() => setSel(rows.map((r) => r.st.id)), [rows])
  return (
    <Card>
      <CardHeader title="보완 요청" right={<span className="num text-xs text-muted-foreground">구매 점검 {rows.length}곳</span>} />
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const on = sel.includes(r.st.id)
          return (
            <li key={r.st.id} className="flex items-start gap-3 py-2.5">
              <input type="checkbox" checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== r.st.id) : [...sel, r.st.id])} aria-label={`${r.st.name} 선택`} className="mt-1 size-4 accent-[var(--primary)]" />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{r.st.name}</p><p className="text-xs text-muted-foreground">{r.hint}</p></div>
              <a href={href('react', { v: 'floor', store: r.st.id })} className="shrink-0 text-xs font-semibold text-primary">동선</a>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex justify-end"><Button disabled={!sel.length} onClick={() => setAppr(fixKey(d.scn.id, D), { kind: 'fix', day: D, stores: sel })}>{sel.length}곳 보완 요청 기록</Button></div>
    </Card>
  )
}

export function RadarCard() {
  const { data: d, day: D, setAppr } = useApp()
  const cls = classify(d, D)
  const orig = radarCurve(d, false)
  const actual = d.agg.slice(0, D + 1)
  const rows = Array.from({ length: DAYS + 1 }, (_, i) => ({ day: i, orig: orig[i], actual: i <= D ? actual[i] : null }))
  const hi = Math.max(0.4, ...rows.flatMap((r) => [r.orig, r.actual ?? 0])), step = hi > 1.2 ? 0.5 : 0.2
  return (
    <Card>
      <CardHeader title="레이더 유형 보정" right={<span className="text-xs text-muted-foreground">예상 <b className="text-foreground">{d.scn.radarShape}</b> / 매장 반응 <b className="text-foreground">{cls.type}</b></span>} />
      <ChartContainer config={radarCfg} className="aspect-auto h-52 w-full">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="day" type="number" domain={[0, 28]} ticks={[0, 7, 14, 21, 28]} tickFormatter={(x) => `D+${x}`} tickLine={false} axisLine={false} />
          <YAxis domain={[0, Math.ceil(hi / step) * step]} tickFormatter={(x) => pct(x)} tickLine={false} axisLine={false} width={48} tickCount={4} />
          <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltipContent labelFormatter={(_, p) => `D+${p?.[0]?.payload?.day ?? ''}`} formatter={(val, n) => <span className="flex w-full justify-between gap-6"><span className="text-muted-foreground">{radarCfg[n as keyof typeof radarCfg]?.label}</span><span className="num font-semibold">{pct(Number(val))}</span></span>} />} />
          <Line dataKey="orig" stroke="var(--color-orig)" strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
          <Line dataKey="actual" stroke="var(--color-actual)" strokeWidth={3} dot={false} isAnimationActive={false} />
          <ReferenceLine x={D} stroke="var(--foreground)" />
          <ReferenceDot x={D} y={actual[D]} r={4.5} fill="var(--color-actual)" stroke="var(--card)" strokeWidth={2} />
        </ComposedChart>
      </ChartContainer>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">근거 {cls.days}일, 신뢰도 {cls.conf}</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAppr(radarKey(d.scn.id), { kind: 'radar', state: 'deferred', day: D })}>보류</Button>
          <Button onClick={() => setAppr(radarKey(d.scn.id), { kind: 'radar', state: 'approved', day: D, curve: cls.kind!, peakVal: cls.peakVal, shape: cls.type })}>{cls.type}으로 보정</Button>
        </div>
      </div>
    </Card>
  )
}

