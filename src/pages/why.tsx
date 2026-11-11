import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, ReferenceArea, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts'
import { Pause, Play, Sparkles } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { DIAG, diagnose, liveStores, shortName, TYPES } from '@/lib/data'
import { storeStatuses } from '@/lib/derived'
import { hhmm, pct } from '@/lib/format'
import { interpret, mergeNewZone, metrics, simInputFor, simulate, WINDOWS, ZONES, type FloorMetrics, type Reading, type Track, type ZoneId } from '@/lib/floor'
import { runMatch, MATCH_WINDOW, FIFO_MARGIN, type MatchResult } from '@/lib/match'
import { EvidenceBadge, type Evidence } from '@/components/evidence'
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

interface FunnelRow { label: string; now: number; before: number; of: number; badge?: Evidence; na?: string; note?: string }
function Funnel({ rows }: { rows: FunnelRow[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 font-medium">{r.label}{r.badge && <EvidenceBadge kind={r.badge} />}</span>
            {r.na ? <span className="text-xs text-muted-foreground">{r.na}</span> : <span className="num"><b>{r.now}명</b> <span className="text-xs text-muted-foreground">평소 {r.before}명</span></span>}
          </div>
          {!r.na && (
            <>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-muted"><div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(r.now / r.of) * 100}%` }} /></div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-muted-foreground/45" style={{ width: `${(r.before / r.of) * 100}%` }} /></div>
            </>
          )}
          {r.note && <p className="mt-1 text-[11px] text-muted-foreground">{r.note}</p>}
        </div>
      ))}
    </div>
  )
}

function Distribution() {
  const { data: d, day: D, setQ, href, route } = useApp()
  const dg =useMemo(() => diagnose(d, D), [d, D])
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
        {flags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{flags.map((r) => <a key={r.st.id} href={href(route, { store: r.st.id, tab: 'floor' })} onClick={() => setQ({ tab: 'floor', store: r.st.id })} className="rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent">{shortName(r.st)} 동선</a>)}</div>}
      </Card>
      <Card>
        <CardHeader title="놓친 판매 (추정, 하루)" />
        {loss.length ? <ParetoChart data={loss} valueLabel="놓친 판매" unit="개" height={300} /> : <EmptyState title="놓친 판매가 없습니다" />}
      </Card>
    </div>
  )
}

/** 신제품 구역을 지정하지 않았을 때의 해석: 신제품만의 반응은 구분하지 않고 쇼케이스 앞 전체로 읽는다 */
function readingMerged(a: FloorMetrics, b: FloorMetrics, soldOut: boolean): Reading {
  const rate = (m: FloorMetrics) => m.zoneVisits.showcase / Math.max(1, m.n)
  const pc = (v: number) => Math.round(v * 100) + '%'
  const bullets = [
    `쇼케이스 앞에 들른 사람이 평소 ${pc(rate(b))}에서 ${pc(rate(a))}입니다.`,
    `그곳에 머문 시간(중앙값)은 평소 ${Math.round(b.zoneDwell.showcase)}초에서 ${Math.round(a.zoneDwell.showcase)}초입니다.`,
    `계산대까지 간 사람은 ${pc(a.buyN / Math.max(1, a.n))}입니다 (평소 ${pc(b.buyN / Math.max(1, b.n))}).`,
  ]
  const actions = ['매장에서 신제품 통 위치를 구역으로 지정하면 신제품 구역 방문과 시식 후 구매를 볼 수 있습니다.']
  if (soldOut) return { tone: 'bad', title: '재고가 바닥나 놓치고 있습니다', bullets, actions: ['입고 일정을 먼저 확인하세요.', ...actions] }
  return { tone: 'neutral', title: '신제품 구역이 지정되지 않아 신제품만의 반응은 구분할 수 없습니다', bullets, actions }
}

/** 시식→구매 연결 방식: 규칙 기반 시간 매칭의 결과를 두 가지 방식으로 보여 준다 (문서 2.4) */
function LinkCard({ res, nzOn, win }: { res: MatchResult; nzOn: boolean; win: string }) {
  const [tab, setTab] = useState<'agg' | 'person'>('agg')
  const maxV = Math.max(1, ...res.bins.map((b) => Math.max(nzOn ? b.visitors : 0, b.newSales)))
  const totVis = res.bins.reduce((s2, b) => s2 + b.visitors, 0), totNew = res.bins.reduce((s2, b) => s2 + b.newSales, 0)
  return (
    <Card>
      <CardHeader title="시식→구매 연결 방식" right={<span className="flex items-center gap-1.5"><EvidenceBadge kind="assume" note="Vision AI 로그와 POS 주문의 시각을 맞출 수 있다는 가정" /><EvidenceBadge kind="sim" /></span>} />
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
          <ol className="flex list-decimal flex-col gap-1.5 pl-4">
            <li>결제 시각 직전 {MATCH_WINDOW}초 안에 계산대에 있던 트랙을 후보로 찾습니다.</li>
            <li>후보가 한 명이면 확정, 여럿이면 대기줄에 먼저 선 순서로 정합니다. 간격이 {FIFO_MARGIN}초보다 좁으면 미확정으로 뺍니다.</li>
            <li>확정된 사람의 이동 기록에 신제품 구역 체류가 있으면 "방문 후 구매"로 나눕니다.</li>
          </ol>
          <p>LLM을 쓰지 않는 규칙이라 같은 입력이면 같은 결과가 나옵니다. 매칭률은 항상 함께 봅니다. {win} 표본의 가상 로그입니다.</p>
          <Segmented label="연결 방식" value={tab} onChange={setTab} options={[{ value: 'agg', label: '시간대 집계' }, { value: 'person', label: '개인 매칭' }]} />
        </div>
        {tab === 'agg' ? (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">15분 단위로 {nzOn ? '신제품 구역 방문자 수(파란 막대)와 ' : ''}신제품 주문 수를 따로 세어 비교합니다. 개인을 맞추지 않아 오매칭이 없고, "시식한 사람이 샀다"는 개별 인과는 말하지 않습니다.</p>
            <div className="grid grid-cols-8 items-end gap-1.5">
              {res.bins.map((b) => (
                <div key={b.label} className="flex flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end justify-center gap-0.5">
                    {nzOn && <i className="block w-2.5 rounded-t bg-primary" style={{ height: `${(b.visitors / maxV) * 100}%`, minHeight: b.visitors ? 3 : 0 }} title={`방문 ${b.visitors}명`} />}
                    <i className="block w-2.5 rounded-t bg-[var(--chart-5)]" style={{ height: `${(b.newSales / maxV) * 100}%`, minHeight: b.newSales ? 3 : 0 }} title={`신제품 주문 ${b.newSales}건`} />
                  </div>
                  <span className="num text-[10px] text-muted-foreground">{b.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {nzOn && <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-primary" />신제품 구역 방문 {totVis}명</span>}
              <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-[var(--chart-5)]" />신제품 주문 {totNew}건</span>
              {nzOn ? <span>방문 대비 주문 <b className="num text-foreground">{totVis ? Math.round((totNew / totVis) * 100) : 0}%</b></span> : <span>신제품 구역 미지정: 방문자 막대는 산출 불가</span>}
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[{ l: '매칭률', v: Math.round(res.rate * 100) + '%', n: `확정 ${res.confirmed} / 주문 ${res.orders}건` }, { l: '미확정', v: res.ambiguous + '건', n: '대기줄 순서가 불확실' }, { l: '카메라 밖 주문', v: res.unseen + '건', n: '포장·배달·키오스크 등' }, { l: '확정 건 정확도', v: Math.round(res.precision * 100) + '%', n: '합성이라 정답을 알 수 있음' }].map((k) => (
                <div key={k.l} className="rounded-xl border border-border p-2.5"><p className="text-[11px] text-muted-foreground">{k.l}</p><p className="num text-lg font-bold tracking-tighter">{k.v}</p><p className="text-[11px] text-muted-foreground">{k.n}</p></div>
              ))}
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {nzOn ? (
                <>
                  <li className="flex justify-between border-t border-border pt-1.5"><span>신제품 구역 방문 후 신제품 구매</span><b className="num">{res.newAfterVisit}건</b></li>
                  <li className="flex justify-between"><span>신제품 구역 방문 후 다른 맛 구매</span><b className="num">{res.otherAfterVisit}건</b></li>
                  <li className="flex justify-between"><span>방문하지 않고 신제품 구매</span><b className="num">{res.newWithoutVisit}건</b></li>
                </>
              ) : (
                <li className="flex justify-between border-t border-border pt-1.5"><span>신제품 구매 (구역 미지정이라 방문 여부는 구분 불가)</span><b className="num">{res.newAfterVisit + res.newWithoutVisit}건</b></li>
              )}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">임시 트랙 번호는 이 계산 안에서만 쓰고 본사로는 집계값만 보냅니다. 같은 시각에 여러 명이 서거나 일행이 함께 결제하면 미확정이 늘어납니다.</p>
          </div>
        )}
      </div>
    </Card>
  )
}

export default function Why() {
  const { data: d, day: D, q, setQ } = useApp()
  const tab = q.tab === 'floor' || (q.store && q.tab !== 'dist') ? 'floor' : 'dist'
  const status = useMemo(() => storeStatuses(d, D), [d, D])
  const sev = { stockout: 0, check: 1, drop: 2, surge: 3, normal: 4 } as const
  const list = useMemo(() => liveStores(d).sort((a, b) => sev[status[a.id].key] - sev[status[b.id].key] || b.series[D].react - a.series[D].react), [d, D, status])
  const [lf, setLf] = useState<'all' | 'attn'>('attn')
  const shownList = list.filter((s) => lf === 'all' || status[s.id].key !== 'normal')
  const storeId = list.some((s) => s.id === q.store) ? q.store : list[0].id
  const store = list.find((s) => s.id === storeId)!
  const win = Math.max(0, Math.min(4, Number.isNaN(parseInt(q.win, 10)) ? 3 : parseInt(q.win, 10)))
  const mode: FloorMode = q.view === 'flow' || q.view === 'heat' ? q.view : 'tracks'
  const period = q.period === 'before' ? 'before' : 'after'
  const p = store.series[D]
  const w = WINDOWS[win]

  const nzOn = q.nz !== 'off'
  const afterRaw = useMemo(() => simulate(simInputFor(store, p, win, false)), [store, p, win])
  const beforeRaw = useMemo(() => simulate(simInputFor(store, p, win, true)), [store, p, win])
  const afterT = useMemo(() => (nzOn ? afterRaw : mergeNewZone(afterRaw)), [afterRaw, nzOn])
  const beforeT = useMemo(() => (nzOn ? beforeRaw : mergeNewZone(beforeRaw)), [beforeRaw, nzOn])
  const after = useMemo(() => metrics(afterT), [afterT])
  const before = useMemo(() => metrics(beforeT), [beforeT])
  const shown = period === 'before' ? before : after
  const shownT = period === 'before' ? beforeT : afterT
  const reading = useMemo(() => (nzOn ? interpret(after, before, { soldOut: p.out, name: store.name }) : readingMerged(after, before, p.out)), [nzOn, after, before, p.out, store.name])
  const seed = store.id + ':' + p.d
  const matchAfter = useMemo(() => runMatch(afterRaw, seed + ':a', win), [afterRaw, seed, win])
  const matchBefore = useMemo(() => runMatch(beforeRaw, seed + ':b', win), [beforeRaw, seed, win])
  const matchShown = period === 'before' ? matchBefore : matchAfter
  const front = (ts: Track[]) => ts.filter((t) => t.stays.some((z) => z.zone === 'pop' || z.zone === 'showcase')).length
  const popPos = (ts: Track[]) => ts.filter((t) => t.popVisited && t.reachedPos).length
  const newBuy = (m: MatchResult) => (nzOn ? m.newAfterVisit : m.newAfterVisit + m.newWithoutVisit)

  const [clock, setClock] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)
  useEffect(() => { setClock(null); setPlaying(false) }, [storeId, win, period, D, mode, tab, nzOn])
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
  const dropData = after.drop.map((x) => ({ name: x.zone === 'entrance' ? '입구에서 바로' : x.zone === 'showcase' && !nzOn ? '쇼케이스 앞' : ZONES[x.zone].label, value: x.n }))

  return (
    <div>
      <PageHeader title="매장 동선 분석" basis={{ level: '중간에서 약함', why: '카메라 단독으로는 상품을 집었는지, 구매했는지 알 수 없어 POS와 함께 읽습니다. 신제품 구역을 매장에서 지정하고 신제품 통 위치를 구분할 수 있다는 것은 가정이며 공식 사이트에서 확인하지 못했습니다. 신제품 진열이 구매를 일으킨다는 인과를 보인 공개 사례도 찾지 못했습니다. 동선과 도면은 합성입니다.' }}
        right={<Segmented label="화면" value={tab} onChange={(v) => setQ({ tab: v })} options={[{ value: 'dist', label: '전체 분포' }, { value: 'floor', label: '매장별 동선' }]} />} />
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
                  <Segmented label="신제품 구역" value={nzOn ? 'on' : 'off'} onChange={(v) => setQ({ nz: v === 'off' ? 'off' : '' })} options={[{ value: 'on', label: '지정 (가정)' }, { value: 'off', label: '미지정' }]} />
                  <Segmented label="보기" value={mode} onChange={(v) => setQ({ view: v })} options={[{ value: 'tracks', label: '동선' }, { value: 'flow', label: '흐름' }, { value: 'heat', label: '히트맵' }]} />
                  <Segmented label="시점" value={period} onChange={(v) => setQ({ period: v })} options={[{ value: 'after', label: `D+${D}` }, { value: 'before', label: '출시 전' }]} />
                  <select value={win} onChange={(e) => setQ({ win: e.target.value })} aria-label="시간대" className="h-8 rounded-full border border-input bg-card px-2.5 text-xs font-semibold">{WINDOWS.map((x, i) => <option key={i} value={i}>{x.label}</option>)}</select>
                  {mode === 'tracks' && <Button size="sm" variant={playing ? 'default' : 'outline'} onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? <Pause /> : <Play />}재생</Button>}
                  {clock != null && <span className="num w-11 text-xs font-semibold">{hhmm(clock)}</span>}
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
                <div>
                  <FloorPlan tracks={shownT} metrics={shown} mode={mode} clock={clock} zoneInfo={zoneInfo} merged={!nzOn} />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2"><FloorLegend mode={mode} merged={!nzOn} /><span className="text-xs text-muted-foreground">가상 표본 {shown.n}명, {w.label}</span></div>
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
                    {(nzOn
                      ? [
                        { l: '구역 방문', b: 'assume' as Evidence, v: pct(after.popRate), c: pp(after.popRate, before.popRate), ok: after.popRate >= before.popRate, na: false },
                        { l: '구역 체류', b: 'assume' as Evidence, v: `${Math.round(after.popDwell)}초`, c: `${after.popDwell >= before.popDwell ? '+' : '−'}${Math.abs(Math.round(after.popDwell - before.popDwell))}`, ok: true, na: false },
                        { l: '계산대 도달', b: 'ok' as Evidence, v: pct(after.popBuyRate), c: pp(after.popBuyRate, before.popBuyRate), ok: after.popBuyRate >= before.popBuyRate - 0.05, na: false },
                      ]
                      : [
                        { l: '구역 방문', b: 'assume' as Evidence, v: '—', c: '산출 불가', ok: true, na: true },
                        { l: '앞 체류', b: 'ok' as Evidence, v: `${Math.round(after.zoneDwell.showcase)}초`, c: `${after.zoneDwell.showcase >= before.zoneDwell.showcase ? '+' : '−'}${Math.abs(Math.round(after.zoneDwell.showcase - before.zoneDwell.showcase))}`, ok: true, na: false },
                        { l: '계산대 도달', b: 'ok' as Evidence, v: pct(after.buyN / Math.max(1, after.n)), c: pp(after.buyN / Math.max(1, after.n), before.buyN / Math.max(1, before.n)), ok: true, na: false },
                      ]).map((k) => (
                      <div key={k.l} className="rounded-xl border border-border p-2.5"><p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">{k.l}<EvidenceBadge kind={k.b} /></p><p className={cn('num font-bold tracking-tighter', k.na ? 'text-sm text-muted-foreground' : 'text-base')}>{k.v}</p><p className={cn('num text-[11px] font-semibold', k.na ? 'text-muted-foreground' : k.ok ? 'text-good' : 'text-bad')}>{k.c}</p></div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-5">
              <Card className="md:col-span-3"><CardHeader title="동선이 끝난 곳 (사지 않고 나간 사람)" />{dropData.length ? <ParetoChart data={dropData} valueLabel="이탈" unit="명" height={220} within="80% 안" beyond="80% 밖" /> : <EmptyState title="이탈한 사람이 없습니다" />}</Card>
              <Card className="md:col-span-2"><CardHeader title="입장에서 구매까지" /><Funnel rows={[
                { label: '입장', now: after.n, before: before.n, of: after.n },
                { label: '쇼케이스 앞 방문', now: front(afterT), before: front(beforeT), of: after.n, badge: 'ok' },
                nzOn ? { label: '신제품 구역 방문', now: after.popN, before: before.popN, of: after.n, badge: 'assume' } : { label: '신제품 구역 방문', now: 0, before: 0, of: after.n, badge: 'assume', na: '산출 불가 (구역 미지정)' },
                nzOn ? { label: '계산대 도달', now: popPos(afterT), before: popPos(beforeT), of: after.n, badge: 'ok' } : { label: '계산대 도달', now: after.buyN, before: before.buyN, of: after.n, badge: 'ok' },
                { label: '신제품 구매 (POS 매칭)', now: newBuy(matchAfter), before: newBuy(matchBefore), of: after.n, badge: 'ext', note: `매칭률 ${Math.round(matchShown.rate * 100)}% (가상)` },
              ]} /></Card>
            </div>

            <LinkCard res={matchShown} nzOn={nzOn} win={w.label} />

            <details className="group rounded-2xl border border-border bg-card px-4 py-1 text-sm">
              <summary className="flex h-10 cursor-pointer list-none items-center font-semibold">존별 숫자</summary>
              <Table>
                <THead><TR><TH>존</TH><TH className="text-right">지나간 사람</TH><TH className="text-right">평소</TH><TH className="text-right">체류</TH><TH className="text-right">평소</TH></TR></THead>
                <TBody>{(['entrance', 'pop', 'showcase', 'queue', 'pos', 'freezer', 'seating'] as ZoneId[]).filter((z) => nzOn || z !== 'pop').map((z) => (
                  <TR key={z} className={z === 'pop' ? 'bg-accent/50' : ''}><TD className="font-medium"><i className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: ZONES[z].color }} />{z === 'showcase' && !nzOn ? '쇼케이스 앞' : ZONES[z].label}</TD><TD className="num text-right font-semibold">{after.zoneVisits[z]}명</TD><TD className="num text-right text-muted-foreground">{before.zoneVisits[z]}명</TD><TD className="num text-right font-semibold">{Math.round(after.zoneDwell[z])}초</TD><TD className="num text-right text-muted-foreground">{Math.round(before.zoneDwell[z])}초</TD></TR>
                ))}</TBody>
              </Table>
            </details>
            <HowTo>
              <p>신제품 구역 방문률이 평소보다 12%p 이상 늘고 계산대 도달률이 15%p 이상 떨어지면 "관심은 높은데 구매로 이어지지 않음", 재고가 바닥난 날은 품절, 방문률이 5%p도 늘지 않으면 노출 부족으로 읽습니다. 6초 이상 머문 것만 방문으로 셉니다. 표본이 작아 숫자가 흔들릴 수 있으니 시간대와 매장을 바꿔 같은 방향인지 보세요. 신제품 구역은 매장에서 신제품 통 위치를 구역으로 지정한다는 가정이며, 미지정으로 바꾸면 구역 단위 지표가 사라집니다. 도면은 시연용이며 개인별 동선은 실제 매장에서 매장 PC 밖으로 나가지 않습니다.</p>
            </HowTo>
          </div>
        </div>
      )}
    </div>
  )
}
