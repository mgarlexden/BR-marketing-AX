import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, ReferenceArea, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts'
import { Pause, Play, Sparkles } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { DIAG, diagnose, shortName, TYPES } from '@/lib/data'
import { storeStatuses } from '@/lib/derived'
import { hhmm, pct } from '@/lib/format'
import { interpret, metrics, simInputFor, simulate, WINDOWS, ZONES, type ZoneId } from '@/lib/floor'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Segmented } from '@/components/ui/segmented'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, HowTo, PageHeader } from '@/components/page'
import { Pill } from '@/components/status'
import { FloorLegend, FloorPlan, type FloorMode } from '@/components/floor/floor-plan'
import { ParetoChart } from '@/components/charts/pareto'
import { cn } from '@/lib/utils'

const READ_TONE = { good: '정상 반응', warn: '관심-구매 괴리', bad: '재고 문제', neutral: '확인 필요' } as const
const pp = (a: number, b: number) => { const v = Math.round((a - b) * 100); return (v >= 0 ? '+' : '−') + Math.abs(v) + '%p' }
const scatterCfg = { flag: { label: '점검', color: 'var(--bad)' }, other: { label: '그 외', color: 'var(--muted-foreground)' } } satisfies ChartConfig

function Funnel({ rows }: { rows: { label: string; now: number; before: number; of: number }[] }) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-medium">{r.label}</span><span className="num"><b>{r.now}명</b> <span className="text-xs text-muted-foreground">평소 {r.before}명</span></span></div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-muted"><div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(r.now / r.of) * 100}%` }} /></div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-muted-foreground/45" style={{ width: `${(r.before / r.of) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

function Distribution() {
  const { data: d, day: D, setQ, href } = useApp()
  const dg = useMemo(() => diagnose(d, D), [d, D])
  const flags = dg.rows.filter((r) => r.zone === 'flag')
  const pts = dg.rows.map((r) => ({ x: r.x * 100, y: r.y * 100, name: shortName(r.st), flag: r.zone === 'flag' }))
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const xMax = Math.max(60, Math.ceil(Math.max(...xs) / 20) * 20), xMin = Math.min(0, Math.floor(Math.min(...xs) / 20) * 20)
  const yMax = Math.max(50, Math.ceil(Math.max(...ys) / 25) * 25), yMin = Math.min(-50, Math.floor(Math.min(...ys) / 25) * 25)
  const range = (a: number, b: number, s: number) => { const t: number[] = []; for (let v = a; v <= b + 1e-9; v += s) t.push(v); return t }
  const loss = dg.rows.map((r) => ({ name: shortName(r.st), value: Math.max(0, Math.round(r.visits3 * (dg.medConv - r.conv))) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 9)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="방문 변화와 구매 전환" right={<span className="text-xs text-muted-foreground">붉은 영역이 점검 대상</span>} />
        <ChartContainer config={scatterCfg} className="aspect-auto h-80 w-full">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 22, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" dataKey="x" domain={[xMin, xMax]} ticks={range(xMin, xMax, 20)} tickFormatter={(v) => pct(v / 100)} tickLine={false} axisLine={false} label={{ value: '방문 변화 (3일)', position: 'insideBottom', offset: -12, fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <YAxis type="number" dataKey="y" domain={[yMin, yMax]} ticks={range(yMin, yMax, 25)} tickFormatter={(v) => pct(v / 100)} tickLine={false} axisLine={false} width={52} />
            <ZAxis range={[80, 80]} />
            <ReferenceArea x1={DIAG.rise * 100} x2={xMax} y1={yMin} y2={DIAG.convLow * 100} fill="var(--bad)" fillOpacity={0.08} />
            <ReferenceLine x={DIAG.rise * 100} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <ReferenceLine y={DIAG.convLow * 100} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <ChartTooltip cursor={false} content={({ active, payload }) => active && payload?.length ? <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl"><p className="font-semibold">{payload[0].payload.name}</p><p className="num text-muted-foreground">방문 {pct(payload[0].payload.x / 100)}, 전환 {pct(payload[0].payload.y / 100)}</p></div> : null} />
            <Scatter data={pts.filter((p) => !p.flag)} fill="var(--color-other)" fillOpacity={0.55} isAnimationActive={false} />
            <Scatter data={pts.filter((p) => p.flag)} fill="var(--color-flag)" isAnimationActive={false} />
          </ScatterChart>
        </ChartContainer>
        {flags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{flags.map((r) => <a key={r.st.id} href={href('why', { store: r.st.id, tab: 'floor' })} onClick={() => setQ({ tab: 'floor', store: r.st.id })} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent">{shortName(r.st)} 동선</a>)}</div>}
      </Card>
      <Card>
        <CardHeader title="놓친 판매 (추정, 하루)" />
        {loss.length ? <ParetoChart data={loss} valueLabel="놓친 판매" unit="개" height={300} /> : <EmptyState title="놓친 판매가 없습니다" />}
      </Card>
    </div>
  )
}

export default function Why() {
  const { data: d, day: D, q, setQ } = useApp()
  const tab = q.tab === 'dist' ? 'dist' : 'floor'
  const status = useMemo(() => storeStatuses(d, D), [d, D])
  const sev = { stockout: 0, check: 1, drop: 2, surge: 3, normal: 4 } as const
  const list = useMemo(() => d.stores.slice().sort((a, b) => sev[status[a.id].key] - sev[status[b.id].key] || b.series[D].react - a.series[D].react), [d, D, status])
  const [lf, setLf] = useState<'all' | 'attn'>('attn')
  const shownList = list.filter((s) => lf === 'all' || status[s.id].key !== 'normal')
  const storeId = d.stores.some((s) => s.id === q.store) ? q.store : list[0].id
  const store = d.stores.find((s) => s.id === storeId)!
  const win = Math.max(0, Math.min(4, Number.isNaN(parseInt(q.win, 10)) ? 3 : parseInt(q.win, 10)))
  const mode: FloorMode = q.view === 'flow' || q.view === 'heat' ? q.view : 'tracks'
  const period = q.period === 'before' ? 'before' : 'after'
  const p = store.series[D]
  const w = WINDOWS[win]

  const afterT = useMemo(() => simulate(simInputFor(store, p, win, false)), [store, p, win])
  const beforeT = useMemo(() => simulate(simInputFor(store, p, win, true)), [store, p, win])
  const after = useMemo(() => metrics(afterT), [afterT])
  const before = useMemo(() => metrics(beforeT), [beforeT])
  const shown = period === 'before' ? before : after
  const shownT = period === 'before' ? beforeT : afterT
  const reading = useMemo(() => interpret(after, before, { soldOut: p.out, name: store.name }), [after, before, p.out, store.name])

  const [clock, setClock] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)
  useEffect(() => { setClock(null); setPlaying(false) }, [storeId, win, period, D, mode, tab])
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let c = clock ?? w.start
    const tick = (now: number) => {
      c += ((now - last) / 1000) * 300
      last = now
      if (c >= w.end) { setClock(null); setPlaying(false); return }
      setClock(c)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  const zoneInfo = useMemo(() => {
    const o = {} as Record<ZoneId, string[]>
    ;(Object.keys(ZONES) as ZoneId[]).forEach((z) => { o[z] = [`${shown.n}명 중 ${shown.zoneVisits[z]}명 지나감`, `체류 중앙값 ${Math.round(shown.zoneDwell[z])}초`, `평소 ${before.zoneVisits[z]}명, ${Math.round(before.zoneDwell[z])}초`] })
    return o
  }, [shown, before])
  const dropData = after.drop.map((x) => ({ name: x.zone === 'entrance' ? '입구에서 바로' : ZONES[x.zone].label, value: x.n }))

  return (
    <div>
      <PageHeader title="매장 동선 분석" basis={{ level: '중간에서 약함', why: '카메라 단독으로는 상품을 집었는지, 구매했는지 알 수 없어 POS와 함께 읽습니다. 신제품 진열이 구매를 일으킨다는 인과를 보인 공개 사례는 찾지 못했습니다. 동선과 도면은 합성입니다.' }}
        right={<Segmented label="화면" value={tab} onChange={(v) => setQ({ tab: v })} options={[{ value: 'floor', label: '매장별 동선' }, { value: 'dist', label: '전체 분포' }]} />} />
      {tab === 'dist' ? <Distribution /> : (
        <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Card className="p-0 lg:sticky lg:top-32">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <Segmented label="목록" value={lf} onChange={setLf} options={[{ value: 'attn', label: '주의' }, { value: 'all', label: '전체' }]} />
              <span className="num text-xs text-muted-foreground">{shownList.length}곳</span>
            </div>
            <ul className="max-h-[calc(100dvh-18rem)] overflow-auto p-1.5">
              {shownList.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setQ({ store: s.id })} aria-current={s.id === storeId ? 'true' : undefined}
                    className={cn('flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm', s.id === storeId ? 'bg-accent' : 'hover:bg-accent/50')}>
                    <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                    <Pill tone={status[s.id].tone}>{status[s.id].label}</Pill>
                    <span className="num w-10 text-right text-xs text-muted-foreground">{pct(s.series[D].react)}</span>
                  </button>
                </li>
              ))}
              {shownList.length === 0 && <li className="p-3 text-sm text-muted-foreground">주의할 매장이 없습니다</li>}
            </ul>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5"><h2 className="text-base font-bold">{store.name}</h2><Pill tone={status[store.id].tone}>{status[store.id].label}</Pill></div>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented label="보기" value={mode} onChange={(v) => setQ({ view: v })} options={[{ value: 'tracks', label: '동선' }, { value: 'flow', label: '흐름' }, { value: 'heat', label: '히트맵' }]} />
                  <Segmented label="시점" value={period} onChange={(v) => setQ({ period: v })} options={[{ value: 'after', label: `D+${D}` }, { value: 'before', label: '출시 전' }]} />
                  <select value={win} onChange={(e) => setQ({ win: e.target.value })} aria-label="시간대" className="h-8 rounded-full border border-input bg-card px-2.5 text-xs font-semibold">{WINDOWS.map((x, i) => <option key={i} value={i}>{x.label}</option>)}</select>
                  {mode === 'tracks' && <Button size="sm" variant={playing ? 'default' : 'outline'} onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? <Pause /> : <Play />}재생</Button>}
                  {clock != null && <span className="num w-11 text-xs font-semibold">{hhmm(clock)}</span>}
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
                <div>
                  <FloorPlan tracks={shownT} metrics={shown} mode={mode} clock={clock} zoneInfo={zoneInfo} />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2"><FloorLegend mode={mode} /><span className="text-xs text-muted-foreground">가상 표본 {shown.n}명, {w.label}</span></div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl bg-zinc-900 p-4 text-white dark:bg-secondary">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-400"><Sparkles className="size-3.5" />해석</p>
                    <p className="font-bold leading-snug">{reading.title}</p>
                    <div className="mt-2"><Pill tone={reading.tone === 'good' ? 'good' : reading.tone === 'warn' ? 'warn' : reading.tone === 'bad' ? 'bad' : 'neutral'}>{READ_TONE[reading.tone]}</Pill></div>
                    <ul className="mt-3 flex flex-col gap-1.5 text-xs text-zinc-300">{reading.bullets.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}</ul>
                    <p className="mt-3 rounded-xl bg-white/10 p-3 text-xs">{reading.actions[0]}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ l: '존 방문', v: pct(after.popRate), c: pp(after.popRate, before.popRate), ok: after.popRate >= before.popRate }, { l: '체류', v: `${Math.round(after.popDwell)}초`, c: `${after.popDwell >= before.popDwell ? '+' : '−'}${Math.abs(Math.round(after.popDwell - before.popDwell))}`, ok: true }, { l: '계산대', v: pct(after.popBuyRate), c: pp(after.popBuyRate, before.popBuyRate), ok: after.popBuyRate >= before.popBuyRate - 0.05 }].map((k) => (
                      <div key={k.l} className="rounded-xl border border-border p-2.5"><p className="text-[11px] text-muted-foreground">{k.l}</p><p className="num text-base font-bold tracking-tighter">{k.v}</p><p className={cn('num text-[11px] font-semibold', k.ok ? 'text-good' : 'text-bad')}>{k.c}</p></div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-5">
              <Card className="md:col-span-3"><CardHeader title="동선이 끝난 곳 (사지 않고 나간 사람)" />{dropData.length ? <ParetoChart data={dropData} valueLabel="이탈" unit="명" height={220} within="80% 안" beyond="80% 밖" /> : <EmptyState title="이탈한 사람이 없습니다" />}</Card>
              <Card className="md:col-span-2"><CardHeader title="입장에서 구매까지" /><Funnel rows={[{ label: '입장', now: after.n, before: before.n, of: after.n }, { label: '신제품 존 방문', now: after.popN, before: before.popN, of: after.n }, { label: '방문 후 구매', now: after.popBuyN, before: before.popBuyN, of: after.n }]} /></Card>
            </div>

            <details className="group rounded-2xl border border-border bg-card px-4 py-1 text-sm">
              <summary className="flex h-10 cursor-pointer list-none items-center font-semibold">존별 숫자</summary>
              <Table>
                <THead><TR><TH>존</TH><TH className="text-right">지나간 사람</TH><TH className="text-right">평소</TH><TH className="text-right">체류</TH><TH className="text-right">평소</TH></TR></THead>
                <TBody>{(['entrance', 'pop', 'showcase', 'queue', 'pos', 'freezer', 'seating'] as ZoneId[]).map((z) => (
                  <TR key={z} className={z === 'pop' ? 'bg-accent/50' : ''}><TD className="font-medium"><i className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: ZONES[z].color }} />{ZONES[z].label}</TD><TD className="num text-right font-semibold">{after.zoneVisits[z]}명</TD><TD className="num text-right text-muted-foreground">{before.zoneVisits[z]}명</TD><TD className="num text-right font-semibold">{Math.round(after.zoneDwell[z])}초</TD><TD className="num text-right text-muted-foreground">{Math.round(before.zoneDwell[z])}초</TD></TR>
                ))}</TBody>
              </Table>
            </details>
            <HowTo>
              <p>신제품 존 방문률이 평소보다 12%p 이상 늘고 계산대 도달률이 15%p 이상 떨어지면 "관심은 높은데 구매로 이어지지 않음", 재고가 바닥난 날은 품절, 방문률이 5%p도 늘지 않으면 노출 부족으로 읽습니다. 6초 이상 머문 것만 방문으로 셉니다. 표본이 작아 숫자가 흔들릴 수 있으니 시간대와 매장을 바꿔 같은 방향인지 보세요. 도면은 시연용이며 개인별 동선은 실제 매장에서 매장 PC 밖으로 나가지 않습니다.</p>
            </HowTo>
          </div>
        </div>
      )}
    </div>
  )
}
