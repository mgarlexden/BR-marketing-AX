import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { classify, diagnose, mean, verdict, type Dir, type Store } from '@/lib/data'
import { pending, salesTrend, verdictCause, type VerdictCause } from '@/lib/derived'
import { dataFor } from '@/lib/launch'
import { simInputFor, metrics, simulate } from '@/lib/floor'
import { num, pct } from '@/lib/format'
import { Card, CardHeader } from '@/components/ui/card'
import { Day } from '@/components/figures'
import { DirChip } from '@/components/status'
import { EmptyState, EmbeddedCtx, HowTo, TabTitle } from '@/components/page'
import { EvidenceBadge, type Evidence } from '@/components/evidence'
import { cn } from '@/lib/utils'
import Brief, { PilotCard } from './brief'
import Where from './where'
import Why from './why'
import { DirCard, FixCard } from './decisions'

type View = 'summary' | 'stores' | 'floor' | 'judge'
const pp = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%p` }

const FR = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** 카드 아래 판정 칩 색. 카드 테두리는 모두 같은 회색이다 */
const VERDICT_CHIP: Record<Dir, string> = {
  expand: 'bg-primary text-primary-foreground',
  fix: 'bg-amber-500 text-zinc-950 dark:bg-amber-500 dark:text-zinc-950',
  maintain: 'bg-zinc-600 text-white',
  wrap: 'bg-rose-600 text-white',
  wait: 'bg-muted text-muted-foreground',
}
/** 품절 의심 매장이 이 수 이상일 때만 카드에 알린다 */
const OUT_ALERT = 3

/** 진행 중인 맛과 콜라보. 대략적인 숫자만 보여 주고, 눌러야 아래에 상세가 열린다 */
function ProductStrip({ picked, onPick }: { picked: boolean; onPick: () => void }) {
  const { scenarios, launch, go, href, q } = useApp()
  const rows = useMemo(() => scenarios.filter((sc) => sc.launch !== '캠페인').map((sc) => {
    const dd = dataFor(sc)
    return { sc, now: dd.agg[sc.today], net: dd.netAgg[sc.today], sales: salesTrend(dd, sc.today), total: dd.stores.length, dir: verdict(dd, sc.today).dir }
  }), [scenarios])
  return (
    <section aria-label="판매 중인 상품" className="mb-5 rounded-3xl bg-muted/70 p-5 lg:p-6">
      <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">판매 중인 상품<EvidenceBadge kind="assume" note="상권별 속도 비교, 순위 급변, 판정 규칙은 공개 근거를 찾지 못한 자체 가설입니다. 카메라와 POS 값은 모두 합성입니다" /></h2>
      <p className="mt-1 text-sm text-muted-foreground">클릭하면 상세 데이터가 표시돼요</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div role="radiogroup" aria-label="판매 중인 상품" className="flex w-full flex-wrap gap-3 sm:w-auto">
          {rows.map(({ sc, now, net, sales, total, dir }) => {
            const on = picked && sc.id === launch
            const label = cn('min-w-0 break-keep text-sm font-semibold leading-snug', on && 'text-zinc-100')
            const sub = cn('mt-0.5 text-xs leading-snug', on ? 'text-zinc-400' : 'text-foreground/70')
            return (
              <button key={sc.id} type="button" role="radio" aria-checked={on} onClick={() => { onPick(); go('react', { launch: sc.id }) }}
                className={cn('relative w-full rounded-3xl border p-5 text-left transition-all active:translate-y-px sm:w-[22rem]', FR,
                  on ? 'border-transparent bg-zinc-900 text-white shadow-lg ring-4 ring-primary/30 dark:bg-secondary' : 'border-border bg-card hover:border-primary/60 hover:shadow-sm')}>
                {on && <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-white text-zinc-900 shadow ring-1 ring-black/10" aria-hidden><Check className="size-4" /></span>}
                <div className="flex items-baseline justify-between gap-2">
                  <p className="flex min-w-0 flex-wrap items-center gap-2 text-xl font-extrabold leading-snug tracking-tight">{sc.label}
                    <span className={cn('whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', on ? 'bg-white/15 text-white' : 'bg-muted text-foreground')}>{sc.launch === '콜라보' ? '콜라보' : '이달의 맛'}</span>
                  </p>
                  <span className={cn('-translate-y-0.5 shrink-0 whitespace-nowrap text-xs font-bold', on ? 'text-zinc-300' : 'text-foreground/70')}>출시 D+{sc.today}</span>
                </div>
                {/* 라벨 줄 수가 달라도 큰 숫자 높이가 맞도록 행 단위로 놓는다 */}
                <div className="mt-4 grid grid-cols-2 gap-x-3">
                  <p className={label} title={`전체 ${total}곳의 방문이 평소보다 늘어난 정도`}>방문 증가율</p>
                  <p className={label} title="선출시 매장의 최근 3일 하루 평균 판매를 직전 3일과 비교">신제품 판매 증가율</p>
                  <p className="num mt-1 text-3xl font-bold tracking-tighter">{pct(now)}</p>
                  <p className={cn('num mt-1 text-3xl font-bold tracking-tighter', sales.growth === null ? '' : sales.growth >= 0 ? (on ? 'text-emerald-300' : 'text-good') : (on ? 'text-rose-300' : 'text-bad'))}>{sales.growth === null ? '-' : pct(sales.growth)}</p>
                  <p className={cn(sub, 'whitespace-nowrap')}>미출시 매장 대비 <b className={cn('num', on ? 'text-white' : 'text-foreground')}>{pp(net)}</b></p>
                  <p className={sub}>직전 3일 대비</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <DirChip dir={dir} className={cn('px-3 py-0.5 text-[13px]', VERDICT_CHIP[dir])} />
                  {sales.out >= OUT_ALERT && <span title="최근 6일 동안 선출시 매장 중 품절 의심이 있었던 매장 수. 품절이 있으면 판매 증가율이 왜곡될 수 있습니다" className={cn('whitespace-nowrap text-xs font-semibold', on ? 'text-rose-300' : 'text-bad')}>품절 의심 매장 {sales.out}곳</span>}
                </div>
              </button>
            )
          })}
        </div>
        <a href={href('feedback', { at: 'log' })} className={cn('inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-primary hover:underline', FR)}>과거 기록 보기<ArrowRight className="size-4" /></a>
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

type Params = { v: View } & Record<string, string>
type TileDef = { off?: boolean; anchor?: string; id: string; label: string; value: React.ReactNode; note: React.ReactNode; badge: Source[]; tone?: 'good' | 'bad'; to: (store: Store | undefined) => Params }
/** 상세 지표의 데이터 출처. br: 배스킨라빈스 자사 POS·키오스크, vision: 넥스트페이먼츠 Vision AI 카메라.
 *  assume은 출처와 함께 붙는 표시로, 그 값이 아직 확인되지 않은 가정 위에서 계산됐다는 뜻이다 */
type Source = 'br' | 'vision' | 'assume'
function SourceBadge({ source }: { source: Source }) {
  if (source === 'assume') return <EvidenceBadge kind="assume" className="bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground" />
  if (source === 'br') return (
    <span title="배스킨라빈스 자사 데이터 (POS·키오스크 주문)" className="inline-flex shrink-0 cursor-help items-center rounded-full bg-[#fde6f4] px-1.5 py-px text-[10px] font-extrabold leading-4 tracking-tight dark:bg-white">
      <span className="text-[#f130a5]">B</span><span className="text-[#182da1]">R</span>
    </span>
  )
  return <span title="넥스트페이먼츠 Vision AI 카메라 데이터" className="inline-flex shrink-0 cursor-help items-center rounded-full bg-black px-1.5 py-px text-[10px] font-medium leading-4 tracking-tight text-white dark:bg-white dark:text-black">Vision AI</span>
}
const ORDER = ['visit', 'net', 'zone', 'sold', 'share', 'out']
const RESET = { grp: '', st: '', sort: '', tab: '', q: '', store: '', view: '' }

/** 선출시 매장의 오늘 숫자. 매장별 필터로 한 곳만 볼 수 있고, 숫자를 누르면 그 숫자의 상세가 아래에 열린다 */
function TodayPanel() {
  const { data: d, day: D, appr, q, setQ } = useApp()
  const count = pending(d, D, appr).count
  const pilots = useMemo(() => d.stores.filter((x) => x.pilot), [d])
  const general = useMemo(() => d.stores.filter((x) => !x.pilot), [d])
  const store = d.stores.find((x) => x.id === q.ps)
  /** 일반 매장은 신제품을 팔지 않으므로 방문만 본다. 방문은 출시가 없을 때의 값(대조)을 쓴다 */
  const plain = !!store && !store.pilot
  const s = useMemo(() => {
    let vis = 0, exp = 0, sales = 0, orders = 0, out = 0, zone = 0
    if (store && !store.pilot) { const p = store.series[D]; return { vis: p.ctrlVis, exp: p.exp, sales, orders, out, zone } }
    ;(store ? [store] : pilots).forEach((st) => {
      const p = st.series[D]
      vis += p.visits; exp += p.exp; sales += p.sales; orders += p.orders; if (p.out) out++
      const m = metrics(simulate(simInputFor(st, p, 0, false)))
      zone += p.visits * m.popRate
    })
    return { vis, exp, sales, orders, out, zone }
  }, [pilots, store, D])
  const none = (t: Omit<TileDef, 'value' | 'note' | 'tone'>): TileDef => ({ ...t, value: '-', note: '미출시 매장', off: true })
  const list: TileDef[] = [
    { id: 'visit', label: '총 방문', value: num(s.vis), note: <>평소 예상 {num(s.exp)}명보다 <b className={cn('num', s.vis >= s.exp ? 'text-good' : 'text-bad')}>{pct(s.vis / s.exp - 1)}</b></>, badge: ['vision'], to: () => ({ v: 'summary' }) },
    plain ? none({ id: 'zone', label: '신제품 구역 방문', badge: ['vision', 'assume'], to: () => ({ v: 'floor' }) })
      : { id: 'zone', label: '신제품 구역 방문', value: num(Math.round(s.zone)), note: `방문의 ${Math.round((s.zone / s.vis) * 100)}% (맛본 사람 근사)`, badge: ['vision', 'assume'], to: (st): Params => (st ? { v: 'floor', tab: 'floor', store: st.id } : { v: 'floor', tab: 'dist' }) },
    plain ? none({ id: 'sold', label: '신제품 구매', badge: ['br'], to: () => ({ v: 'stores' }) })
      : { id: 'sold', label: '신제품 구매', value: `${num(s.sales)}개`, note: `방문 100명당 ${Math.round((s.sales / s.vis) * 100)}개`, badge: ['br'], to: (st) => ({ v: 'stores', grp: 'pilot', sort: 'conv-desc', q: st?.name ?? '' }) },
    plain ? none({ id: 'share', label: '신제품 비중', badge: ['br'], to: () => ({ v: 'stores' }) })
      : { id: 'share', label: '신제품 비중', value: `${Math.round((s.sales / s.orders) * 100)}%`, note: `전체 주문 ${num(s.orders)}건 중`, badge: ['br'], to: (st) => ({ v: 'stores', grp: 'pilot', sort: 'share-desc', q: st?.name ?? '' }) },
    plain ? none({ id: 'net', label: '대조 대비 순효과', badge: ['vision', 'assume'], to: () => ({ v: 'summary' }) })
      : { id: 'net', label: '대조 대비 순효과', value: pp(d.netAgg[D]), note: '선출시 − 대조 매장', badge: ['vision', 'assume'], tone: d.netAgg[D] >= 0 ? 'good' : 'bad', to: () => ({ v: 'summary' }), anchor: 'pilot-effect' },
    plain ? none({ id: 'out', label: '품절 의심', badge: ['br'], to: () => ({ v: 'stores' }) })
      : { id: 'out', label: '품절 의심', value: `${s.out}곳`, note: s.out ? '재고 확인 필요' : '없음', badge: ['br'], tone: s.out ? 'bad' : undefined, to: (st): Params => (st ? { v: 'stores', grp: 'pilot', q: st.name } : { v: 'stores', grp: 'pilot', st: 'attention' }) },
  ]
  const tiles = [...list].sort((x, y) => ORDER.indexOf(x.id) - ORDER.indexOf(y.id))
  const open = (t: TileDef) => {
    if (t.off) return
    setQ({ ...RESET, m: t.id, ...t.to(store) })
    requestAnimationFrame(() => document.getElementById(t.anchor ?? 'react-detail')?.scrollIntoView({ behavior: 'smooth' }))
  }
  const pick = (id: string) => {
    const next = d.stores.find((x) => x.id === id)
    const cur = tiles.find((t) => t.id === q.m)
    // 일반 매장으로 바꾸면 신제품 숫자의 상세는 닫는다
    if (cur && next && !next.pilot && cur.id !== 'visit') { setQ({ ps: id, ...RESET, m: '', v: '' }); return }
    setQ({ ps: id, ...(cur ? { ...RESET, ...cur.to(next) } : {}) })
  }
  const judging = q.v === 'judge' && !q.m
  const day = d.days[D].date
  return (
    <section aria-label="상세 지표" className="border-t border-border bg-muted/50 px-6 py-5 lg:px-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-primary">출시 D+{D}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold">{day.getMonth() + 1}월 {day.getDate()}일 상세 지표</h2>
          <label className="flex h-9 items-center gap-2 rounded-full border border-input bg-card pl-4 pr-2 text-sm font-semibold">
            매장별
            <select value={store?.id ?? ''} onChange={(e) => pick(e.target.value)} className={cn('h-8 max-w-56 rounded-full bg-transparent pr-1 text-sm font-semibold text-primary', FR)}>
              <option value="">선출시 {pilots.length}곳 전체</option>
              <optgroup label={`선출시 매장 ${pilots.length}곳`}>
                {pilots.map((st) => <option key={st.id} value={st.id}>{st.name} ({st.type})</option>)}
              </optgroup>
              <optgroup label={`일반 매장 ${general.length}곳 (미출시)`}>
                {general.map((st) => <option key={st.id} value={st.id}>{st.name} ({st.type})</option>)}
              </optgroup>
            </select>
          </label>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => {
          const on = q.m === t.id
          return (
            <button key={t.id} type="button" aria-pressed={on} disabled={t.off} onClick={() => open(t)} className={cn('min-w-0 rounded-2xl border bg-card p-3.5 text-left transition-colors', FR, t.off ? 'cursor-default border-border opacity-60' : 'hover:border-primary/60 active:translate-y-px', on ? 'border-primary ring-1 ring-primary' : 'border-border')}>
              <span className="flex min-h-10 flex-wrap content-start items-center gap-1 text-xs font-medium text-muted-foreground"><span className="mr-0.5">{t.label}</span>{t.badge.map((b) => <SourceBadge key={b} source={b} />)}</span>
              <span className={cn('num mt-0.5 block text-2xl font-bold tracking-tighter', t.tone === 'good' && 'text-good', t.tone === 'bad' && 'text-bad')}>{t.value}</span>
              <span className="block text-xs text-muted-foreground">{t.note}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{!q.m && !judging ? (plain ? '일반 매장은 신제품을 팔지 않아 방문만 볼 수 있어요' : '지표를 누르면 상세 데이터가 아래에 열려요') : ''}</p>
        <button type="button" aria-pressed={judging} onClick={() => setQ({ ...RESET, m: '', v: 'judge' })} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-px', FR, judging && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background')}>판정하기
            {count > 0 && <span aria-label={`판정 필요 ${count}건`} className="num grid size-5 place-items-center rounded-full bg-white text-xs font-bold text-primary">{count}</span>}
          </button>
      </div>
    </section>
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
      {pend.count === 0 && <EmptyState title="지금 대기 중인 판정이 없습니다. 같은 판정은 3일 동안 다시 올라오지 않고, 판정이 바뀌면 바로 다시 올라옵니다" action={{ label: '모델 탭에서 기록 보기', onClick: () => { location.hash = '#/feedback' } }} />}
      {pend.dir && <DirCard />}
      {pend.fix && <FixCard />}
      <p className="text-xs text-muted-foreground">레이더 예상과 실제의 비교, 학습 반영 여부는 <button type="button" onClick={() => { location.hash = '#/feedback?launch=' + d.scn.id }} className="font-semibold text-primary underline underline-offset-4">모델 탭</button>에서 결정합니다.</p>
      <HowTo title="판정 기준">
        <p>확대 필요: 평소보다 25% 이상이고 최근 3일 오르는 중, 또는 정점의 80% 이상을 유지. 보완 필요: 구매 점검 매장이 3곳 이상이고 놓친 판매가 기대 판매의 8% 이상. 정리: 출시 후 6일부터 반응이 12% 아래로 식었거나, 25% 아래에서 계속 내려감. 그 외는 유지이며, 출시 후 3일 전에는 판단하지 않습니다.</p>
      </HowTo>
    </div>
  )
}

/** 문장이 한 줄에 들어가도록 칸 폭에 맞춰 글자를 max에서 min까지 줄인다. min으로도 넘치면 그때만 줄바꿈한다 */
function FitLine({ max, min, className, children }: { max: number; min: number; className?: string; children: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState({ size: max, wrap: false })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el?.parentElement) return
    const measure = () => {
      const prev = { fs: el.style.fontSize, ws: el.style.whiteSpace }
      el.style.fontSize = `${max}px`; el.style.whiteSpace = 'nowrap'
      const room = el.clientWidth, need = el.scrollWidth
      el.style.fontSize = prev.fs; el.style.whiteSpace = prev.ws
      const size = need > room ? Math.floor(((max * room) / need) * 2) / 2 : max
      setFit(size >= min ? { size, wrap: false } : { size: min, wrap: true })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [max, min, children])
  return <span ref={ref} className={cn('block', className)} style={{ fontSize: fit.size, whiteSpace: fit.wrap ? 'normal' : 'nowrap' }}>{children}</span>
}

type V = ReturnType<typeof verdict>
type Gap = { n: number; k: number; scope: string; conv: number; dwell: number }
const abs = (x: number) => `${Math.abs(Math.round(x * 100))}%`

/* 요약 문장은 한 줄에 공백 빼고 50자 안쪽으로, 길면 쉼표로 끊고 앞 문장과 겹치는 말은 다시 쓰지 않는다 */
function headlineOf(v: V, g: Gap, D: number) {
  const a = pct(v.a)
  if (v.dir === 'fix') return `손님이 평소보다 평균 ${a} 더 모이지만, ${g.scope} 매장 ${g.k}곳은 구매 전환이 다른 곳보다 ${abs(g.conv)} 낮아요`
  if (v.dir === 'expand') return v.slope >= 0 ? `손님이 평소보다 평균 ${a} 더 모이고, 증가 폭은 최근 3일간 ${pp(v.slope)} 커졌어요` : `손님이 평소보다 평균 ${a} 더 모이고, 최고치의 ${Math.round((v.a / v.peak) * 100)}%를 유지해요`
  if (v.dir === 'wrap') return `방문 증가율이 최고 ${pct(v.peak)}에서 ${a}까지 식었어요`
  if (v.dir === 'wait') return `출시 ${D + 1}일째라, 아직 판단할 근거가 부족해요`
  return `손님이 평소보다 평균 ${a} 더 모이고, 최근 3일 변화는 ${pp(v.slope)}예요`
}

function adviceOf(v: V, pilotGap: Gap | null) {
  if (v.dir === 'fix') return `정식 출시 전 보완이 필요해요. 놓친 판매가 하루 약 ${num(v.lostUnits)}개로 기대 판매의 ${Math.round(v.lostShare * 100)}%예요`
  if (v.dir === 'expand') return `정식 출시 확대가 필요해요${pilotGap ? `. 다만 선출시 매장 ${pilotGap.k}곳은 구매 전환이 다른 곳보다 ${abs(pilotGap.conv)} 낮아요` : ''}`
  if (v.dir === 'wrap') return '정식 출시 전 정리가 필요해요'
  if (v.dir === 'wait') return '아직 방향을 정하지 않아요'
  return '지금 상태로 더 지켜봐야 해요'
}

function causeLine(cause: VerdictCause | null, launch: string, g: Gap, shapes: { radar: string; actual: string }, events: number) {
  if (!cause) return '상세 데이터는 아래에서 확인해요'
  const what = cause === '외부 이벤트' ? `외부 이벤트예요. 행사 중인 매장이 ${events}곳이에요`
    : cause === '트렌드 오판' ? `트렌드 오판이에요. 예상은 ${shapes.radar}, 실제는 ${shapes.actual}이에요`
      : `${launch === '콜라보' ? '콜라보 구성이에요' : '맛이에요'}. 체류는 ${abs(g.dwell)} ${g.dwell >= 0 ? '늘었지만' : '줄었고'} 사지 않았어요`
  return `원인은 ${what}. 상세 데이터는 아래에서 확인해요`
}

function Detail() {
  const { data: d, day: D, scn, q, setQ } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const pilots = d.stores.filter((s) => s.pilot).length
  const info = useMemo(() => {
    const flag = diagnose(d, D).rows.filter((r) => r.zone === 'flag')
    const pil = flag.filter((r) => r.st.pilot)
    const gapOf = (rows: typeof flag, n: number, scope: string): Gap => ({ n, k: rows.length, scope, conv: mean(rows.map((r) => r.y)), dwell: mean(rows.map((r) => r.dwell)) })
    const cls = classify(d, D)
    return {
      g: pil.length ? gapOf(pil, pilots, '선출시') : gapOf(flag, d.stores.length, '전체'),
      pilotGap: pil.length ? gapOf(pil, pilots, '선출시') : null,
      shapes: { radar: d.scn.radarShape, actual: cls.type },
      events: flag.filter((r) => r.st.event).length,
    }
  }, [d, D, pilots])
  const cause = useMemo(() => verdictCause(d, D, v.dir), [d, D, v.dir])
  const view: View | null = q.m || q.v === 'judge' ? ((['summary', 'stores', 'floor', 'judge'] as const).includes(q.v as View) ? (q.v as View) : 'summary') : null
  return (
    <>
      {q.from === 'launch' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-accent px-4 py-3 text-sm">
          <p className="min-w-0 flex-1"><b>개발 13주가 지났다고 가정</b>하고 선출시 {pilots}곳의 출시 후 <Day n={D} /> 시점을 열었습니다. 합성 시뮬레이션이며, 실제 매장은 가상 카메라와 POS 연결 뒤에 같은 화면으로 봅니다.</p>
          <button type="button" aria-label="안내 닫기" onClick={() => setQ({ from: '' })} className="rounded-md p-1 text-muted-foreground hover:bg-background/60"><X className="size-4" /></button>
        </div>
      )}
      <section aria-label="인사이트 요약" className="mb-5 overflow-hidden rounded-3xl border border-border bg-card">
        <div className="px-6 py-5 lg:px-8 lg:py-6">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold">요약</span>
          <h2 className="mt-3 break-keep font-extrabold leading-[1.25] tracking-tight"><FitLine max={28} min={18}>{headlineOf(v, info.g, D)}</FitLine></h2>
          <ul className="mt-4 list-disc space-y-0.5 pl-5 text-base text-foreground marker:text-muted-foreground">
            <li><FitLine max={16} min={13}>{adviceOf(v, info.pilotGap)}</FitLine></li>
            <li><FitLine max={16} min={13}>{causeLine(cause, scn.launch, info.g, info.shapes, info.events)}</FitLine></li>
            <li><FitLine max={16} min={13}>{`${v.days}일동안의 데이터에요`}</FitLine></li>
          </ul>
        </div>
        <TodayPanel />
      </section>
      <div id="react-detail" className="scroll-mt-20">
        {view && (
          <EmbeddedCtx.Provider value>
            {view === 'summary' && (q.m === 'net' ? <PilotCard /> : <Brief hideNet />)}
            {view === 'stores' && <Where />}
            {view === 'floor' && <Why />}
            {view === 'judge' && <Judge />}
          </EmbeddedCtx.Provider>
        )}
      </div>
    </>
  )
}

export default function ReactPage() {
  const { scn, q, setQ } = useApp()
  // 주소에 남은 launch는 선택으로 치지 않는다. 카드를 누르거나 트렌드에서 넘어올 때(open=1)만 상세를 연다
  const [picked, setPicked] = useState(q.open === '1')
  useEffect(() => { if (q.open === '1') setQ({ open: '' }) }, [q.open, setQ])
  const selected = picked && !!q.launch && scn.id === q.launch && scn.launch !== '캠페인'
  return (
    <div>
      <TabTitle title="매장 반응" desc="선출시 매장 반응을 보고 판정해요" />
      <ProductStrip picked={picked} onPick={() => setPicked(true)} />
      {selected && <Detail />}
    </div>
  )
}
