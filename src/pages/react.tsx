import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { diagnose, DIR_LABEL, DIR_MEANING, DIR_OPTIONS, DIR_RULE, mean, shortName, verdict, type Data, type Dir, type Store } from '@/lib/data'
import { dirDecisions, dirKey, fixKey, fixRequests, pending, salesTrend} from '@/lib/derived'
import { dataFor } from '@/lib/launch'
import { metrics, simInputFor, simulate } from '@/lib/floor'
import { num, pct } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Day, Delta } from '@/components/figures'
import { DirChip } from '@/components/status'
import { EmbeddedCtx, HowTo, TabTitle } from '@/components/page'
import { EvidenceBadge } from '@/components/evidence'
import { Sparkline } from '@/components/charts/mini'
import { SourceBadge, type Source } from '@/components/source-badge'
import { FitLine } from '@/components/fit-line'
import { NationalCard } from '@/components/national-card'
import { Chip } from '@/components/radar'
import { cn } from '@/lib/utils'
import Why from './why'

const FR = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const pp = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%p` }
const ROW = 'md:grid-cols-[minmax(12rem,1.3fr)_6.5rem_7rem_6rem_6.5rem_6.5rem]'
const BigHeading = ({ children }: { children: React.ReactNode }) => <h3 className="text-[21px] font-bold leading-tight tracking-tight">{children}</h3>
/** 품절 의심 매장이 이 수 이상일 때만 목록에 알린다 */
const OUT_ALERT = 3

/* ---------- 지표 (대표 매장의 오늘 값. 지표를 펼치면 선출시·대조 매장별로 본다) ---------- */
type MetricId = 'visit' | 'zone' | 'sold' | 'share' | 'net' | 'out'
interface StoreVal { st: Store; vis: number; exp: number; zone: number; sales: number; orders: number; out: boolean; ctrl: number }
interface Metric { id: MetricId; label: string; value: string; note: string; tone?: 'good' | 'bad'; sources: Source[]; per: (s: StoreVal) => { text: string; tone?: 'good' | 'bad' }; /** 고른 매장이 모두 미출시라 값이 없음 */ none?: boolean }
type Group = 'pilot' | 'general' | 'all'
const GROUP_LABEL: Record<Group, string> = { pilot: '대표 매장', general: '대조 매장(가상)', all: '전체' }
/** 대표 매장 / 대조 매장 / 전체 고르기 */
function GroupChips({ value, onChange, counts, after }: { value: Group | null; onChange: (g: Group | null) => void; counts: Record<Group, number>; /** 고른 칩 바로 옆에 붙일 것 (전체에는 붙이지 않음) */ after?: React.ReactNode }) {
  return <>{(['all', 'pilot', 'general'] as Group[]).map((g) => (
    <span key={g} className="flex items-center gap-1.5">
      <Chip on={value === g} onClick={() => onChange(value === g ? null : g)}>{GROUP_LABEL[g]} {counts[g]}</Chip>
      {value === g && g !== 'all' && after}
    </span>
  ))}</>
}

/** 대조 매장은 신제품을 팔지 않으므로 방문만 본다. 방문은 출시가 없을 때의 값(대조)을 쓴다 */
function storeVal(st: Store, D: number): StoreVal {
  const p = st.series[D]
  if (!st.pilot) return { st, vis: p.ctrlVis, exp: p.exp, zone: 0, sales: 0, orders: 0, out: false, ctrl: p.ctrlVis }
  const m = metrics(simulate(simInputFor(st, p, 0, false)))
  return { st, vis: p.visits, exp: p.exp, zone: p.visits * m.popRate, sales: p.sales, orders: p.orders, out: p.out, ctrl: p.ctrlVis }
}


/** 방문은 고른 매장 전체로 합친다. 신제품 지표는 대표 매장에만 있어 대조 매장만 고르면 비우고, 전체를 고르면 대표 매장 값이다 */
function metricList(d: Data, D: number, rows: StoreVal[], grp: Group, one = false): Metric[] {
  const sum = (k: keyof Omit<StoreVal, 'st' | 'out'>, list = rows) => list.reduce((a, r) => a + r[k], 0)
  const vis = sum('vis'), exp = sum('exp')
  const pil = rows.filter((r) => r.st.pilot)
  const pvis = sum('vis', pil), zone = sum('zone', pil), sales = sum('sales', pil), orders = sum('orders', pil)
  const out = pil.filter((r) => r.out).length
  // 매장 한 곳을 고르면 그 매장의 방문을 같은 매장의 미출시 가정 방문과 비교한다
  const net = one ? vis / exp - sum('ctrl') / exp : d.netAgg[D]
  const only = grp === 'all' ? ' (대표 매장만)' : ''
  const list: Metric[] = [
    { id: 'visit', label: '총 방문', value: num(vis), note: `평소 예상 ${num(exp)}명보다 ${pct(vis / exp - 1)}`, tone: vis >= exp ? 'good' : 'bad', sources: ['vision'], per: (s) => ({ text: `${num(s.vis)}명 (${pct(s.vis / s.exp - 1)})`, tone: s.vis >= s.exp ? 'good' : 'bad' }) },
    { id: 'zone', label: '신제품 구역 방문', value: num(Math.round(zone)), note: `방문의 ${Math.round((zone / Math.max(1, pvis)) * 100)}% (맛본 사람 근사)${only}`, sources: ['vision', 'assume'], per: (s) => ({ text: `${num(Math.round(s.zone))}명 (${Math.round((s.zone / Math.max(1, s.vis)) * 100)}%)` }) },
    { id: 'sold', label: '신제품 구매', value: `${num(sales)}개`, note: `방문 100명당 ${Math.round((sales / Math.max(1, pvis)) * 100)}개${only}`, sources: ['br'], per: (s) => ({ text: `${num(s.sales)}개 (100명당 ${Math.round((s.sales / Math.max(1, s.vis)) * 100)}개)` }) },
    { id: 'share', label: '신제품 비중', value: `${Math.round((sales / Math.max(1, orders)) * 100)}%`, note: `전체 주문 ${num(orders)}건 중${only}`, sources: ['br'], per: (s) => ({ text: `${Math.round((s.sales / Math.max(1, s.orders)) * 100)}%` }) },
    { id: 'net', label: '미출시 매장 대비 순효과', value: pp(net), note: one ? '이 매장 − 같은 매장 미출시 가정' : '선출시 − 미출시 매장', tone: net >= 0 ? 'good' : 'bad', sources: ['vision', 'assume'], per: (s) => { const v = s.vis / s.exp - s.ctrl / s.exp; return { text: pp(v), tone: v >= 0 ? 'good' : 'bad' } } },
    { id: 'out', label: '품절 의심', value: one ? (out ? '있음' : '없음') : `${out}곳`, note: `${out ? '재고 확인 필요' : '없음'}${only}`, tone: out ? 'bad' : undefined, sources: ['br'], per: (s) => ({ text: s.out ? '품절 의심' : '정상', tone: s.out ? 'bad' : undefined }) },
  ]
  if (grp === 'general') return list.map((m) => (m.id === 'visit' ? { ...m, note: `출시가 없을 때 방문, 평소 예상 ${num(exp)}명보다 ${pct(vis / exp - 1)}` } : { ...m, value: '-', note: '미출시 매장이라 없음', tone: undefined, none: true }))
  return list
}

/* ---------- 요약 문장: 한 줄에 공백 빼고 50자 안쪽, 쉼표로 끊고 앞 문장과 겹치는 말은 다시 쓰지 않는다 ---------- */
type V = ReturnType<typeof verdict>
type Gap = { n: number; k: number; scope: string; conv: number; dwell: number }
const abs = (x: number) => `${Math.abs(Math.round(x * 100))}%`

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
  if (v.dir === 'expand') return `정식 출시 확대가 필요해요${pilotGap ? `. 다만 대표 매장 ${pilotGap.k}곳은 구매 전환이 다른 곳보다 ${abs(pilotGap.conv)} 낮아요` : ''}`
  if (v.dir === 'wrap') return '정식 출시 전 정리가 필요해요'
  if (v.dir === 'wait') return '아직 방향을 정하지 않아요'
  return '지금 상태로 더 지켜봐야 해요'
}
/** 첫 문장만 굵게: 무엇을 해야 하는지가 먼저 보이게 */
function BoldFirst({ text }: { text: string }) {
  const i = text.indexOf('. ')
  return i < 0 ? <b className="font-bold text-foreground">{text}</b> : <><b className="font-bold text-foreground">{text.slice(0, i + 1)}</b>{text.slice(i + 1)}</>
}

/** 지표를 누르면 바로 아래에 위에서 고른 범위의 매장마다 값이 열린다 */
const inGroup = (st: Store, g: Group) => g === 'all' || (g === 'pilot') === st.pilot
function StoreBreakdown({ m, rows, grp, onClose }: { m: Metric; rows: StoreVal[]; grp: Group; onClose: () => void }) {
  return (
    <section aria-label={`${m.label} 매장 값`} className="mt-3 border-y border-border py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="mr-1 text-base font-extrabold tracking-tight">{m.label}</h4>
        <span className="text-xs text-muted-foreground">{GROUP_LABEL[grp]} {rows.length}곳</span>
        <button type="button" onClick={onClose} aria-label="매장 값 닫기" className={cn('ml-auto grid size-8 place-items-center rounded-full hover:bg-muted active:translate-y-px', FR)}><X className="size-4" /></button>
      </div>
      {grp !== 'pilot' && <p className="mt-2 text-xs text-muted-foreground">대조 매장은 신제품을 팔지 않아 {m.id === 'visit' ? '출시가 없을 때의 방문(대조)을 보여 줘요' : '이 지표가 없어요'}</p>}
      <ul className="mt-2 divide-y divide-border">
        {rows.map((s) => {
          const r = s.st.pilot || m.id === 'visit' ? m.per(s) : { text: '미출시', tone: undefined }
          return (
            <li key={s.st.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{shortName(s.st)} <span className="text-xs font-normal text-muted-foreground">{s.st.type}</span>{grp === 'all' && <span className={cn('ml-1.5 text-[11px] font-semibold', s.st.pilot ? 'text-primary' : 'text-muted-foreground')}>{s.st.pilot ? '대표' : '대조'}</span>}</span>
              <b className={cn('num whitespace-nowrap', !s.st.pilot && m.id !== 'visit' && 'font-normal text-muted-foreground', r.tone === 'good' && 'text-good', r.tone === 'bad' && 'text-bad')}>{r.text}</b>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** 상품 행을 누르면 바로 아래에 펼쳐지는 요약과 지표 */
function Detail({ onDecide, onClose, deciding }: { onDecide: () => void; onClose: () => void; deciding: boolean }) {
  const { data: d, day: D, scn, q, setQ } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const pilots = d.stores.filter((s) => s.pilot).length
  const info = useMemo(() => {
    const flag = diagnose(d, D).rows.filter((r) => r.zone === 'flag')
    const pil = flag.filter((r) => r.st.pilot)
    const gapOf = (rows: typeof flag, n: number, scope: string): Gap => ({ n, k: rows.length, scope, conv: mean(rows.map((r) => r.y)), dwell: mean(rows.map((r) => r.dwell)) })
    return {
      g: pil.length ? gapOf(pil, pilots, '대표') : gapOf(flag, d.stores.length, '전체'),
      pilotGap: pil.length ? gapOf(pil, pilots, '대표') : null,
    }
  }, [d, D, pilots])
  // 처음에는 칩을 고르지 않은 상태로 대표 매장 합계를 보여 준다
  const [chip, setChip] = useState<Group | null>(null)
  const grp: Group = chip ?? 'pilot'
  const [ps, setPs] = useState('')
  const all = useMemo(() => d.stores.map((st) => storeVal(st, D)), [d, D])
  const counts: Record<Group, number> = { pilot: pilots, general: all.length - pilots, all: all.length }
  const inGrp = all.filter((r) => inGroup(r.st, grp))
  const one = inGrp.find((r) => r.st.id === ps)
  const rows = one ? [one] : inGrp
  const list = useMemo(() => metricList(d, D, rows, one ? (one.st.pilot ? 'pilot' : 'general') : grp, !!one), [d, D, rows, one, grp]) // eslint-disable-line react-hooks/exhaustive-deps
  const pickGroup = (g: Group | null) => { setChip(g); setPs(''); setMetric(null) }
  const [metric, setMetric] = useState<MetricId | null>(null)
  const [floor, setFloor] = useState(false)
  const open = list.find((m) => m.id === metric)
  const advice = adviceOf(v, info.pilotGap)
  const day = d.days[D].date
  return (
    <div className="border-t border-border px-1 pb-6 pt-5 sm:px-3">
      {q.from === 'launch' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-accent px-4 py-3 text-sm">
          <p className="min-w-0 flex-1"><b>개발 13주가 지났다고 가정</b>하고 대표 매장 {pilots}곳(손님 유형마다 3곳)의 출시 후 <Day n={D} /> 시점을 열었습니다. 합성 시뮬레이션이며, 실제 매장은 가상 카메라와 POS 연결 뒤에 같은 화면으로 봅니다.</p>
          <button type="button" aria-label="안내 닫기" onClick={() => setQ({ from: '' })} className="rounded-md p-1 text-muted-foreground hover:bg-background/60"><X className="size-4" /></button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-keep font-extrabold leading-[1.25] tracking-tight"><FitLine max={26} min={17} text={headlineOf(v, info.g, D)} /></h3>
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
            <li><FitLine max={14} min={12} text={advice}><BoldFirst text={advice} /></FitLine></li>
            <li><FitLine max={14} min={12} text={`${v.days}일동안의 데이터에요`} /></li>
          </ul>
        </div>
        <p className="text-right"><span className="block text-[11px] text-muted-foreground">판정</span><span className="block text-xl font-extrabold leading-tight text-primary">{DIR_LABEL[v.dir]}</span></p>
      </div>

      <NationalCard />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1"><BigHeading>{day.getMonth() + 1}월 {day.getDate()}일 상세 지표</BigHeading></span>
          <GroupChips value={chip} onChange={pickGroup} counts={counts} after={
          <select value={ps} onChange={(e) => { setPs(e.target.value); setMetric(null) }} aria-label="매장 고르기" className={cn('h-8 max-w-60 rounded-full border border-input bg-card px-3 text-xs font-semibold', FR)}>
            <option value="">{GROUP_LABEL[grp]} {counts[grp]}곳 합계</option>
            {(['pilot', 'general'] as const).filter((g) => grp === 'all' || grp === g).map((g) => (
              <optgroup key={g} label={g === 'pilot' ? `대표 매장 ${counts.pilot}곳` : `대조 매장 ${counts.general}곳 (미출시)`}>
                {all.filter((r) => (g === 'pilot') === r.st.pilot).map((r) => <option key={r.st.id} value={r.st.id}>{r.st.name} ({r.st.type})</option>)}
              </optgroup>
            ))}
          </select>} />
        </div>
        <span className="text-[11px] text-muted-foreground">{one ? '매장 한 곳의 값이에요' : '지표를 누르면 매장마다 값이 열려요'}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{one ? `${one.st.name} (${one.st.pilot ? '선출시' : '대조 매장, 미출시'})` : `${GROUP_LABEL[grp]} ${counts[grp]}곳 합계`}{(one ? !one.st.pilot : grp !== 'pilot') && ', 대조 매장은 신제품을 팔지 않아 방문만 있어요'} · 판정 기준: {DIR_RULE[v.dir]}</p>
      <ul className="mt-3 grid gap-x-8 md:grid-cols-2">
        {list.map((m) => {
          const on = metric === m.id
          return (
            <li key={m.id} className="border-b border-border">
              <button type="button" aria-pressed={on} disabled={!!one} onClick={() => setMetric(on ? null : m.id)}
                className={cn('flex w-full items-center gap-3 rounded-xl border px-2 py-3 text-left transition-colors', FR, one ? 'cursor-default' : 'active:translate-y-px', on ? 'picked' : cn('border-transparent', !one && 'hover:bg-muted/60'))}>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1 text-sm font-semibold">{m.label}{m.sources.map((s) => <SourceBadge key={s} source={s} />)}</span>
                  <span className="block text-xs text-muted-foreground">{m.note}</span>
                </span>
                <b className={cn('num whitespace-nowrap text-lg tracking-tight', m.none && 'font-normal text-muted-foreground', m.tone === 'good' && 'text-good', m.tone === 'bad' && 'text-bad')}>{m.value}</b>
              </button>
            </li>
          )
        })}
      </ul>
      {open && !one && <StoreBreakdown m={open} rows={inGrp} grp={grp} onClose={() => setMetric(null)} />}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" aria-expanded={floor} onClick={() => setFloor(!floor)} className={cn('text-sm font-semibold text-primary underline-offset-4 hover:underline', FR)}>{floor ? '매장 동선 접기' : '매장 동선과 전환 자세히 보기'}</button>
        <Button className="h-11 px-6" onClick={deciding ? onClose : onDecide} disabled={v.dir === 'wait'}>{deciding ? '판정 기록 닫기' : '판정 기록하기'}</Button>
      </div>
      {floor && <div className="mt-3"><EmbeddedCtx.Provider value><Why /></EmbeddedCtx.Provider></div>}
      {deciding && <JudgeSection onClose={onClose} />}
    </div>
  )
}

function ProductList({ open, onOpen, deciding, onDecide, onClose }: { open: string | null; onOpen: (id: string | null) => void; deciding: boolean; onDecide: () => void; onClose: () => void }) {
  const { scenarios, href } = useApp()
  const rows = useMemo(() => scenarios.filter((sc) => sc.launch !== '캠페인').map((sc) => {
    const d = dataFor(sc)
    return { sc, d, now: d.agg[sc.today], net: d.netAgg[sc.today], sales: salesTrend(d, sc.today), dir: verdict(d, sc.today).dir }
  }), [scenarios])
  return (
    <Card className="mb-6 border-border pb-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-x-2 text-xl font-extrabold tracking-tight text-primary">판매 중인 상품<EvidenceBadge kind="assume" note="상권별 속도 비교, 순위 급변, 판정 규칙은 공개 근거를 찾지 못한 자체 가설입니다. 카메라와 POS 값은 모두 합성입니다" /></h2>
          <p className="mt-0.5 text-xs text-muted-foreground">눌러서 자세히 보기</p>
        </div>
        <a href={href('log')} className={cn('inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-primary hover:underline', FR)}>과거 기록 보기<ArrowRight className="size-4" /></a>
      </div>
      <div className={cn('hidden gap-3 px-3 pb-2 text-[11px] text-muted-foreground md:grid', ROW)}>
        <span>상품</span><span className="text-right" title="전체 매장의 방문이 평소보다 늘어난 정도">방문 증가율</span><span className="text-right" title="대표 매장의 최근 3일 하루 평균 판매를 직전 3일과 비교">신제품 판매 증가율</span><span className="text-right">미출시 대비</span><span className="text-center">판정</span><span className="text-center">반응 추이</span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {rows.map(({ sc, d, now, net, sales, dir }) => {
          const on = open === sc.id
          return (
            <li key={sc.id} className={cn('rounded-2xl', on && 'mb-3 border-b-2 border-border bg-card pb-1')}>
              <button type="button" aria-expanded={on} onClick={() => onOpen(on ? null : sc.id)}
                className={cn('grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors active:translate-y-px', ROW, FR, on ? 'picked' : 'border-transparent bg-muted/70 hover:bg-accent/50')}>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2"><span className="truncate text-base font-bold">{sc.label}</span><span className="whitespace-nowrap rounded-full bg-card px-2 py-0.5 text-[11px] font-bold">{sc.launch === '콜라보' ? '콜라보' : '이달의 맛'}</span></span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">출시 <Day n={sc.today} className="text-[11px]" />{sales.out >= OUT_ALERT && <span title="최근 6일 동안 대표 매장 중 품절 의심이 있었던 매장 수. 품절이 있으면 판매 증가율이 왜곡될 수 있습니다" className="font-semibold text-bad">품절 의심 매장 {sales.out}곳</span>}</span>
                </span>
                <span className="num col-start-1 text-sm font-bold md:col-start-auto md:text-right">{pct(now)}</span>
                <span className={cn('num hidden text-right text-sm font-bold md:block', sales.growth === null ? '' : sales.growth >= 0 ? 'text-good' : 'text-bad')}>{sales.growth === null ? '-' : pct(sales.growth)}</span>
                <span className="num hidden text-right text-sm font-bold md:block">{pp(net)}</span>
                <span className="col-start-2 row-start-1 text-center md:col-start-auto md:row-start-auto"><DirChip dir={dir} className="px-3" /></span>
                <span className="hidden text-center md:block"><Sparkline values={d.agg.slice(0, sc.today + 1)} w={96} h={28} /></span>
              </button>
              {on && <Detail key={sc.id} deciding={deciding} onDecide={onDecide} onClose={onClose} />}
            </li>
          )
        })}
      </ol>
      {!rows.length && <p className="rounded-2xl bg-muted/70 py-6 text-center text-sm text-muted-foreground">판매 중인 상품이 없어요. 트렌드 탭에서 출시를 정하면 여기에 생겨요</p>}
    </Card>
  )
}

/** 방향 판단: 확대, 유지, 보완, 정리 중 하나를 기록한다 */
function DirBlock() {
  const { data: d, day: D, scn, appr, setAppr } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const rec = v.dir as Exclude<Dir, 'wait'>
  const [choice, setChoice] = useState<Exclude<Dir, 'wait'>>(rec)
  const [note, setNote] = useState('')
  useEffect(() => { setChoice(rec); setNote('') }, [rec, D])
  const saved = dirDecisions(appr, scn.id, D)[0]
  const peakDay = d.agg.slice(0, D + 1).indexOf(v.peak)
  const meaning = DIR_MEANING[scn.launch]
  const evidence = [
    { k: '전체 반응', v: `${pct(v.a)} (정점 ${pct(v.peak)}, D+${Math.max(0, peakDay)})` },
    { k: '최근 3일', v: <Delta v={v.slope} /> },
    { k: '구매 점검 매장', v: `${v.flagged}곳, 놓친 판매 ${num(v.lostUnits)}개/일` },
    { k: '근거', v: `${v.days}일` },
  ]
  return (
    <div>
      <BigHeading>방향 판단</BigHeading>
      <p className="mt-1 text-xs text-muted-foreground">{scn.label} · 출시 <Day n={D} className="text-xs" /> · 권고는 {DIR_LABEL[rec]}</p>
      <div role="radiogroup" aria-label="방향 선택" className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {DIR_OPTIONS.map((o) => {
          const on = choice === o
          return (
            <button key={o} type="button" role="radio" aria-checked={on} onClick={() => setChoice(o)}
              className={cn('rounded-2xl border p-4 text-left transition-colors active:translate-y-px', FR, on ? 'picked' : 'border-border bg-card hover:bg-accent/50')}>
              <span className="flex items-center justify-between gap-2"><span className="text-lg font-bold">{DIR_LABEL[o]}</span>{o === rec && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">권고</span>}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{meaning[o]}</span>
            </button>
          )
        })}
      </div>
      <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {evidence.map((e) => (
          <div key={e.k} className="flex items-center justify-between gap-3 border-t border-border py-2 text-sm">
            <dt className="text-muted-foreground">{e.k}</dt>
            <dd className="num text-right font-semibold">{e.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={choice === rec ? '메모 (선택)' : '권고와 다른 이유 (선택)'} aria-label="사유" className="h-10 min-w-56 flex-1 rounded-full border border-input bg-background px-4 text-sm" />
        <Button className="h-10" onClick={() => setAppr(dirKey(scn.id, D), { kind: 'dir', day: D, choice, rec, note: note.trim() })}>{DIR_LABEL[choice]}로 기록</Button>
      </div>
      {saved && <p className="mt-2 text-xs text-muted-foreground">기록됨: <b className="text-foreground">{DIR_LABEL[saved.choice]}</b> (<Day n={saved.day} className="text-xs" />){saved.choice !== saved.rec && `, 권고는 ${DIR_LABEL[saved.rec]}`}</p>}
    </div>
  )
}

/** 보완 요청: 구매 전환이 낮은 매장을 골라 기록한다 */
function FixBlock() {
  const { data: d, day: D, scn, appr, setAppr } = useApp()
  const rows = useMemo(() => diagnose(d, D).rows.filter((r) => r.zone === 'flag').sort((a, b) => a.y - b.y), [d, D])
  const [sel, setSel] = useState<string[]>(rows.map((r) => r.st.id))
  useEffect(() => setSel(rows.map((r) => r.st.id)), [rows])
  const saved = fixRequests(appr, scn.id, D)[0]
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2"><BigHeading>보완 요청</BigHeading><span className="num text-xs text-muted-foreground">구매 점검 {rows.length}곳</span></div>
      <ul className="mt-2 divide-y divide-border">
        {rows.map((r) => {
          const on = sel.includes(r.st.id)
          return (
            <li key={r.st.id} className="flex items-start gap-3 py-2.5">
              <input type="checkbox" checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== r.st.id) : [...sel, r.st.id])} aria-label={`${r.st.name} 선택`} className="mt-1 size-4 accent-[var(--primary)]" />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{r.st.name}</p><p className="text-xs text-muted-foreground">{r.hint}</p></div>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        {saved && <span className="text-xs text-muted-foreground">기록됨: {saved.stores.length}곳 (<Day n={saved.day} className="text-xs" />)</span>}
        <Button disabled={!sel.length} onClick={() => setAppr(fixKey(scn.id, D), { kind: 'fix', day: D, stores: sel })}>{sel.length}곳 보완 요청 기록</Button>
      </div>
    </div>
  )
}

/** 판정 기록: 상세 안에서 버튼 바로 아래에 열리는 패널. 방향 판단과, 대기 중이면 보완 요청 */
function JudgeSection({ onClose }: { onClose: () => void }) {
  const { data: d, day: D, appr, scn } = useApp()
  const pend = pending(d, D, appr)
  // 기록한 뒤에는 대기가 풀려도 기록 결과를 볼 수 있게 남긴다
  const showFix = pend.fix || !!fixRequests(appr, scn.id, D)[0] || diagnose(d, D).rows.filter((r) => r.zone === 'flag').length >= 2
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [])
  return (
    <section ref={ref} aria-label="판정 기록" className="mt-5 scroll-mt-6 rounded-2xl border border-border bg-muted/40 p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-xl font-extrabold tracking-tight">판정 기록하기</h3>
          <p className="mt-1 text-xs text-muted-foreground">같은 판정은 3일 동안 다시 올라오지 않고, 판정이 바뀌면 바로 다시 올라와요</p>
        </div>
        <button type="button" onClick={onClose} aria-label="판정 기록 닫기" className={cn('grid size-9 shrink-0 place-items-center rounded-full hover:bg-muted active:translate-y-px', FR)}><X className="size-5" /></button>
      </div>
      <div className="flex flex-col gap-8">
        <DirBlock key={scn.id} />
        {showFix && <FixBlock />}
        <p className="text-xs text-muted-foreground">레이더 예상과 실제의 비교, 학습 반영 여부는 <a href={`#/feedback?launch=${scn.id}`} className="font-semibold text-primary underline underline-offset-4">피드백</a>에서 결정해요</p>
      </div>
    </section>
  )
}

export default function ReactPage() {
  const { scn, q, setQ, go } = useApp()
  // 주소에 남은 launch는 선택으로 치지 않는다. 행을 누르거나 트렌드에서 넘어올 때(open=1)만 상세를 연다
  const [open, setOpen] = useState<string | null>(q.open === '1' ? scn.id : null)
  const [deciding, setDeciding] = useState(false)
  useEffect(() => { if (q.open === '1') setQ({ open: '' }) }, [q.open, setQ])
  const pick = (id: string | null) => {
    setOpen(id); setDeciding(false)
    if (id) go('react', { launch: id })
  }
  const shown = open && scn.id === open && scn.launch !== '캠페인'
  return (
    <div>
      <TabTitle title="매장 반응" desc="대표 매장 선출시 반응으로 전국 평균을 미리 읽고, 확대·유지·보완·정리 중에서 판정해요" />
      <ProductList open={shown ? open : null} onOpen={pick} deciding={deciding} onDecide={() => setDeciding(true)} onClose={() => setDeciding(false)} />
      <HowTo title="판정 기준">
        <p>확대 필요: 평소보다 25% 이상이고 최근 3일 오르는 중, 또는 정점의 80% 이상을 유지. 보완 필요: 구매 점검 매장이 3곳 이상이고 놓친 판매가 기대 판매의 8% 이상. 정리: 출시 후 6일부터 반응이 12% 아래로 식었거나, 25% 아래에서 계속 내려감. 그 외는 유지이며, 출시 후 3일 전에는 판단하지 않습니다.</p>
      </HowTo>
    </div>
  )
}
