import { useMemo } from 'react'
import { ArrowRight, Check, ClipboardCheck, X } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { DIR_LABEL, mean, verdict } from '@/lib/data'
import { pending } from '@/lib/derived'
import { dataFor } from '@/lib/launch'
import { simInputFor, metrics, simulate } from '@/lib/floor'
import { num, pct } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Day, Delta } from '@/components/figures'
import { DirChip } from '@/components/status'
import { EmptyState, EmbeddedCtx, HowTo, PageHeader } from '@/components/page'
import { EvidenceBadge, type Evidence } from '@/components/evidence'
import { cn } from '@/lib/utils'
import Brief from './brief'
import Where from './where'
import Why from './why'
import { DirCard, FixCard } from './decisions'

type View = 'summary' | 'stores' | 'floor' | 'judge'
const pp = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%p` }

/** 어떤 맛을 볼지 고르는 곳. 아래 내용은 모두 여기서 고른 맛 기준이라, 선택된 카드를 어둡게 눌러 구분한다 */
function FlavorStrip() {
  const { scenarios, launch, appr, go, q } = useApp()
  const rows = useMemo(() => scenarios.map((sc) => {
    const dd = dataFor(sc)
    const v = verdict(dd, sc.today)
    return { sc, now: dd.agg[sc.today], net: dd.netAgg[sc.today], dir: v.dir, pend: pending(dd, sc.today, appr).count, n: dd.stores.filter((s) => s.pilot).length }
  }), [scenarios, appr])
  return (
    <section aria-label="선출시 맛 선택" className="mb-5 rounded-3xl bg-muted/70 p-4 lg:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">살펴볼 맛을 고르세요</h2>
        <span className="text-xs text-muted-foreground">선출시 중 {scenarios.length}개 / 최대 5개. 새 맛은 트렌드에서 추가합니다</span>
      </div>
      <div role="radiogroup" aria-label="선출시 중인 맛" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map(({ sc, now, net, dir, pend, n }) => {
          const on = sc.id === launch
          return (
            <button key={sc.id} type="button" role="radio" aria-checked={on} onClick={() => go('react', { launch: sc.id, v: q.v })}
              className={cn('relative rounded-2xl p-4 text-left transition-all active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                on ? 'bg-zinc-900 text-white shadow-lg ring-4 ring-primary/30 dark:bg-secondary' : 'border border-border bg-card hover:border-primary/60 hover:shadow-sm')}>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-base font-bold leading-snug">{sc.label}</p>
                {on ? <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-zinc-900" aria-hidden><Check className="size-4" /></span>
                  : pend > 0 && <span className="num shrink-0 rounded-full bg-bad px-1.5 text-[11px] font-bold leading-5 text-white" title="판정 대기">{pend}</span>}
              </div>
              <p className={cn('mt-0.5 text-xs', on ? 'text-zinc-400' : 'text-muted-foreground')}>{sc.launch} · 선출시 {n}곳</p>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="num text-3xl font-bold tracking-tighter">{pct(now)}</p>
                  <p className={cn('text-xs', on ? 'text-zinc-400' : 'text-muted-foreground')}>순효과 <b className={cn('num', on ? 'text-white' : 'text-foreground')}>{pp(net)}</b></p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={cn('num text-sm font-semibold', on ? 'text-zinc-200' : 'text-primary')}>D+{sc.today}</span>
                  <DirChip dir={dir} />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Tile({ label, value, note, badge, tone }: { label: string; value: React.ReactNode; note?: React.ReactNode; badge?: Evidence; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><span className="truncate">{label}</span>{badge && <EvidenceBadge kind={badge} />}</p>
      <p className={cn('num mt-0.5 text-2xl font-bold tracking-tighter', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/** 그날 온 손님을 기준으로 한 번에 보는 지표. 선출시 매장만 합친다 */
function TodayStrip() {
  const { data: d, day: D } = useApp()
  const s = useMemo(() => {
    const pil = d.stores.filter((x) => x.pilot)
    let vis = 0, exp = 0, sales = 0, orders = 0, out = 0, zone = 0
    pil.forEach((st) => {
      const p = st.series[D]
      vis += p.visits; exp += p.exp; sales += p.sales; orders += p.orders; if (p.out) out++
      const m = metrics(simulate(simInputFor(st, p, 0, false)))
      zone += p.visits * m.popRate
    })
    return { n: pil.length, vis, exp, sales, orders, out, zone }
  }, [d, D])
  return (
    <Card className="mb-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">오늘 선출시 {s.n}곳 <span className="font-normal text-muted-foreground">(<Day n={D} />, 가상 카메라와 합성 POS 기준)</span></p>
        <p className="text-xs text-muted-foreground">방문 손님을 기준으로 단계마다 얼마나 남는지 봅니다</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="총 방문" value={num(s.vis)} note={<>평소 예상 {num(s.exp)}명 대비 <Delta v={s.vis / s.exp - 1} /></>} badge="ok" />
        <Tile label="신제품 구역 방문" value={num(Math.round(s.zone))} note={`방문의 ${Math.round((s.zone / s.vis) * 100)}% (맛본 사람 근사)`} badge="assume" />
        <Tile label="신제품 구매" value={`${num(s.sales)}개`} note={`방문 100명당 ${Math.round((s.sales / s.vis) * 100)}개`} badge="ext" />
        <Tile label="신제품 비중" value={`${Math.round((s.sales / s.orders) * 100)}%`} note={`전체 주문 ${num(s.orders)}건 중`} badge="ext" />
        <Tile label="대조 대비 순효과" value={pp(d.netAgg[D])} note="선출시 − 대조 매장" badge="sim" tone={d.netAgg[D] >= 0 ? 'good' : 'bad'} />
        <Tile label="품절 의심" value={`${s.out}곳`} note={s.out ? '재고 확인 필요' : '없음'} badge="ext" tone={s.out ? 'bad' : undefined} />
      </div>
    </Card>
  )
}

/** 신제품은 고객이 출시를 미리 알기 어려워 기대치를 정하기 어렵다. 대조 매장과 출시 전 자기 모습을 기준으로 본다 */
function EffectMetrics() {
  const { data: d, day: D } = useApp()
  const m = useMemo(() => {
    const pil = d.stores.filter((s) => s.pilot)
    let zA = 0, zB = 0, bA = 0, bB = 0, wA = 0, wB = 0, sales = 0, orders = 0, outDays = 0
    pil.forEach((st) => {
      const p = st.series[D]
      const a = metrics(simulate(simInputFor(st, p, 0, false)))
      const b = metrics(simulate(simInputFor(st, p, 0, true)))
      zA += a.popRate; zB += b.popRate; bA += a.popBuyRate; bB += b.popBuyRate; wA += a.popDwell || 0; wB += b.popDwell || 0
      for (let i = Math.max(0, D - 2); i <= D; i++) { sales += st.series[i].sales; orders += st.series[i].orders }
      for (let i = 0; i <= D; i++) if (st.series[i].out) outDays++
    })
    const n = pil.length || 1
    const net = d.netAgg.slice(0, D + 1)
    const peak = Math.max(...net)
    const last3 = mean(net.slice(Math.max(0, D - 2)))
    return { zA: zA / n, zB: zB / n, bA: bA / n, bB: bB / n, wA: wA / n, wB: wB / n, share: orders ? sales / orders : 0, outDays, peak, retain: peak > 0.05 ? last3 / peak : null, last3 }
  }, [d, D])
  const pc = (x: number) => `${Math.round(x * 100)}%`
  return (
    <Card className="mb-4">
      <CardHeader title="출시 효과 지표" description="신제품은 고객이 출시를 미리 알기 어려워 기대치를 정하기 어렵습니다. 같은 기간 대조 매장과 출시 전 자기 모습을 기준으로 봅니다" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-3">
        <Tile label="대조 매장 대비 순효과" value={pp(d.netAgg[D])} note={<>최근 3일 평균 {pp(m.last3)}</>} badge="sim" tone={d.netAgg[D] >= 0 ? 'good' : 'bad'} />
        <Tile label="출시 전 대비 방문" value={`+${Math.round(d.pilotAgg[D] * 100)}%`.replace("+-", "−")} note="선출시 매장, 출시 전 14일 평균 대비" badge="ok" tone={d.pilotAgg[D] >= 0 ? 'good' : 'bad'} />
        <Tile label="정점 대비 유지" value={m.retain === null ? '-' : pc(m.retain)} note={m.retain === null ? '정점이 아직 낮아 계산하지 않음' : `순효과 정점 ${pp(m.peak)} 대비 최근 3일`} badge="sim" />
        <Tile label="신제품 구역 방문율" value={<>{pc(m.zB)}<span className="mx-1 text-lg text-muted-foreground">→</span>{pc(m.zA)}</>} note={`출시 전 → 지금. 체류 중앙값 ${Math.round(m.wB)}초 → ${Math.round(m.wA)}초`} badge="assume" />
        <Tile label="구역 방문자의 구매율" value={<>{pc(m.bB)}<span className="mx-1 text-lg text-muted-foreground">→</span>{pc(m.bA)}</>} note="구역에 머문 손님 중 신제품 구매" badge="ext" />
        <Tile label="신제품 비중" value={pc(m.share)} note={`전체 주문 중, 최근 3일${m.outDays ? `. 품절 의심 ${m.outDays}매장·일` : ''}`} badge="ext" />
      </div>
    </Card>
  )
}

function Judge() {
  const { data: d, day: D, appr } = useApp()
  const pend = pending(d, D, appr)
  return (
    <div className="flex flex-col gap-4">
      <EffectMetrics />
      {pend.count === 0 && <EmptyState title="지금 대기 중인 판정이 없습니다. 같은 판정은 3일 동안 다시 올라오지 않고, 판정이 바뀌면 바로 다시 올라옵니다" action={{ label: '환류에서 기록 보기', onClick: () => { location.hash = '#/feedback' } }} />}
      {pend.dir && <DirCard />}
      {pend.fix && <FixCard />}
      <p className="text-xs text-muted-foreground">레이더 예상과 실제의 비교, 학습 반영 여부는 <button type="button" onClick={() => { location.hash = '#/feedback?launch=' + d.scn.id }} className="font-semibold text-primary underline underline-offset-4">환류</button>에서 결정합니다.</p>
      <HowTo title="판정 기준">
        <p>확대: 평소보다 25% 이상이고 최근 3일 오르는 중, 또는 정점의 80% 이상을 유지. 보완: 구매 점검 매장이 3곳 이상이고 놓친 판매가 기대 판매의 8% 이상. 정리: 출시 후 6일부터 반응이 12% 아래로 식었거나, 25% 아래에서 계속 내려감. 그 외는 유지이며, 출시 후 3일 전에는 판단하지 않습니다. 신뢰도는 근거 일수로 정하며 7일 미만 낮음, 14일 미만 중간입니다.</p>
      </HowTo>
    </div>
  )
}

export default function ReactPage() {
  const { data: d, day: D, scn, appr, q, setQ } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const pend = pending(d, D, appr)
  const view: View = (['summary', 'stores', 'floor', 'judge'] as const).includes(q.v as View) ? (q.v as View) : 'summary'
  const fromLaunch = q.from === 'launch'
  return (
    <div>
      <PageHeader title="매장 반응" loop={[3, 4, 5]}
        sub="선출시 중인 맛의 매장 반응을 보고, 확대·보완·정리를 정하는 곳입니다."
        basis={{ level: '약함', why: '상권별 속도 비교, 순위 급변, 판정 규칙은 공개 근거를 찾지 못한 자체 가설입니다. 카메라와 POS 값은 모두 합성이고 개인정보는 쓰지 않습니다.' }} />

      {fromLaunch && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-accent px-4 py-3 text-sm">
          <p className="min-w-0 flex-1"><b>개발 13주가 지났다고 가정</b>하고 선출시 {d.stores.filter((s) => s.pilot).length}곳의 출시 후 <Day n={D} /> 시점을 열었습니다. 합성 시뮬레이션이며, 실제 매장은 가상 카메라와 POS 연결 뒤에 같은 화면으로 봅니다.</p>
          <button type="button" aria-label="안내 닫기" onClick={() => setQ({ from: '' })} className="rounded-md p-1 text-muted-foreground hover:bg-background/60"><X className="size-4" /></button>
        </div>
      )}

      <FlavorStrip />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <DirChip dir={v.dir} className="text-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold"><span className="text-muted-foreground">{scn.label}</span> · {v.headline}</p>
          <p className="mt-0.5 text-xs text-muted-foreground"><b className="text-foreground">{DIR_LABEL[v.dir]}</b> 권고, 신뢰도 {v.conf}, 근거 {v.days}일. {pend.count > 0 ? `결정 ${pend.count}건이 기다립니다.` : '대기 중인 결정은 없습니다.'}</p>
        </div>
        <Button size="sm" variant={pend.count > 0 ? 'default' : 'outline'} onClick={() => setQ({ v: 'judge' })}>{pend.count > 0 ? <><ClipboardCheck />판정하기</> : <>판정 보기<ArrowRight /></>}</Button>
      </div>

      <TodayStrip />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Segmented label="보기" value={view} onChange={(x) => setQ({ v: x })}
          options={[{ value: 'summary', label: '추이' }, { value: 'stores', label: '매장별' }, { value: 'floor', label: 'Vision AI' }, { value: 'judge', label: pend.count ? `판정 ${pend.count}` : '판정' }]} />
        <p className="text-xs text-muted-foreground">{view === 'summary' && '시간에 따른 전체 반응과 선출시 효과'}{view === 'stores' && '어느 매장, 어느 상권이 반응하는가'}{view === 'floor' && 'Vision AI가 본 전체 분포, 그다음 매장별 동선'}{view === 'judge' && '확대, 보완, 정리 중 무엇을 할까'}</p>
      </div>

      <EmbeddedCtx.Provider value>
        {view === 'summary' && <Brief />}
        {view === 'stores' && <Where />}
        {view === 'floor' && <Why />}
        {view === 'judge' && <Judge />}
      </EmbeddedCtx.Provider>
    </div>
  )
}
