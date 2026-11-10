import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { DIR_LABEL, DIR_MEANING, DIR_OPTIONS, DIR_RULE, EXPAND_RULE, shortName, verdict, type Check as Crit, type CheckId, type Dir, type StoreCheck, type Verdict } from '@/lib/data'
import { dirDecisions, dirKey } from '@/lib/derived'
import { dataFor } from '@/lib/launch'
import { pct } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Day } from '@/components/figures'
import { DirChip } from '@/components/status'
import { HowTo, TabTitle } from '@/components/page'
import { EvidenceBadge } from '@/components/evidence'
import { Sparkline } from '@/components/charts/mini'
import { SourceBadge, type Source } from '@/components/source-badge'
import { FitLine, josa, ro } from '@/components/fit-line'
import { cn } from '@/lib/utils'

const FR = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const pp = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%p` }
const ROW = 'md:grid-cols-[minmax(12rem,1.3fr)_minmax(10rem,1fr)_5.5rem_6.5rem_6.5rem]'
const BigHeading = ({ children }: { children: React.ReactNode }) => <h3 className="text-[21px] font-bold leading-tight tracking-tight">{children}</h3>

/** 지표별 데이터 출처 */
const SOURCES: Record<CheckId, Source[]> = {
  visit: ['vision'], net: ['vision', 'assume'], sold: ['br'], share: ['br'], growth: ['br'], out: ['br'], deplete: ['br'], spread: ['br', 'vision'],
}
/** 지표를 눌렀을 때 매장별로 보는 값 */
const STORE_VALUE: Record<CheckId, (s: StoreCheck) => { text: string; pass: boolean }> = {
  visit: (s) => ({ text: pct(s.visit), pass: s.visit >= EXPAND_RULE.visit }),
  net: (s) => ({ text: pp(s.net), pass: s.net >= EXPAND_RULE.net }),
  sold: (s) => ({ text: `100명당 ${Math.round(s.sold)}개`, pass: s.sold >= EXPAND_RULE.sold }),
  share: (s) => ({ text: `${Math.round(s.share * 100)}%`, pass: s.share >= EXPAND_RULE.share }),
  growth: (s) => ({ text: s.growth === null ? '-' : pct(s.growth), pass: s.growth !== null && s.growth >= EXPAND_RULE.growth }),
  out: (s) => ({ text: s.outDays ? `최근 3일 중 ${s.outDays}일` : '없음', pass: !s.outDays }),
  deplete: (s) => ({ text: `하루 ${Math.round(s.deplete * 100)}%`, pass: s.deplete >= EXPAND_RULE.deplete }),
  spread: (s) => ({ text: `방문 ${pct(s.visit)}, 100명당 ${Math.round(s.sold)}개`, pass: s.pass }),
}

/* 요약 문장은 한 줄에 공백 빼고 50자 안쪽으로, 쉼표로 끊고 끝 온점은 쓰지 않는다. 어떤 지표 때문에 확대하는지(안 하는지)를 먼저 말한다 */
function headlineOf(v: Verdict, D: number) {
  const { checks, stores, storesPassed } = v.ex
  const numeric = checks.filter((c) => c.id !== 'spread' && c.id !== 'out')
  const best = numeric.filter((c) => c.pass).sort((a, b) => b.margin - a.margin)[0]
  const worst = checks.filter((c) => !c.pass).sort((a, b) => a.margin - b.margin)[0]
  const net = checks.find((c) => c.id === 'net')!
  if (v.dir === 'wait') return `출시 ${D + 1}일째라, 확대를 판단하기엔 아직 일러요`
  if (v.dir === 'expand') return `${josa(best.short, '이', '가')} ${ro(best.display)} 기준을 크게 넘어, 전국 확대를 권해요`
  if (v.dir === 'fix') return `선출시 ${stores.length}곳 중 ${storesPassed}곳만 기준을 넘어, 그 상권만 부분 확대를 권해요`
  const w = v.dir === 'wrap' && !net.pass ? net : worst
  if (v.dir === 'wrap') return `${josa(w.short, '이', '가')} ${ro(w.display)} 기준에 못 미쳐, 재고 축소를 권해요`
  return w ? `${josa(w.short, '이', '가')} ${ro(w.display)} 기준에 못 미쳐, 전국 확대는 보류해요` : '확대 기준은 넘었지만, 며칠 더 지켜봐요'
}

function PassMark({ pass, className }: { pass: boolean; className?: string }) {
  return <span aria-label={pass ? '통과' : '미달'} className={cn('grid size-6 shrink-0 place-items-center rounded-full', pass ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground', className)}>{pass ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}</span>
}
/** 8개 기준의 통과 여부를 점으로 */
function PassDots({ checks }: { checks: Crit[] }) {
  return <span className="flex gap-1" aria-hidden>{checks.map((c) => <i key={c.id} title={`${c.label} ${c.pass ? '통과' : '미달'}`} className={cn('size-2.5 rounded-full', c.pass ? 'bg-primary' : 'bg-muted-foreground/25')} />)}</span>
}

/** 지표를 누르면 바로 아래에 선출시 매장별 값이 열린다 */
function StoreBreakdown({ c, stores, onClose }: { c: Crit; stores: StoreCheck[]; onClose: () => void }) {
  return (
    <section aria-label={`${c.label} 매장별`} className="mt-3 border-y border-border py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-base font-extrabold tracking-tight">{c.label} 매장별</h4>
        <span className="text-xs text-muted-foreground">기준 {c.id === 'spread' ? `매장마다 방문 +${EXPAND_RULE.visit * 100}% 이상, 100명당 ${EXPAND_RULE.sold}개 이상` : c.id === 'out' ? '품절 의심 없음' : c.rule}</span>
        <button type="button" onClick={onClose} aria-label="매장별 닫기" className={cn('ml-auto grid size-8 place-items-center rounded-full hover:bg-muted active:translate-y-px', FR)}><X className="size-4" /></button>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {stores.map((s) => {
          const r = STORE_VALUE[c.id](s)
          return (
            <li key={s.st.id} className="flex items-center gap-3 py-2 text-sm">
              <PassMark pass={r.pass} className="size-5" />
              <span className="min-w-0 flex-1 truncate font-medium">{shortName(s.st)} <span className="text-xs font-normal text-muted-foreground">{s.st.type}</span></span>
              <b className={cn('num whitespace-nowrap', !r.pass && 'text-muted-foreground')}>{r.text}</b>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** 상품 행을 누르면 바로 아래에 펼쳐지는 확대 기준 상세 */
function Detail({ onDecide, deciding }: { onDecide: () => void; deciding: boolean }) {
  const { data: d, day: D, q, setQ } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const [metric, setMetric] = useState<CheckId | null>(null)
  const { checks, stores, storesPassed, passed } = v.ex
  const open = checks.find((c) => c.id === metric)
  const headline = headlineOf(v, D)
  const lines = [
    `확대 기준 8개 중 ${passed}개 통과, 전국 확대는 ${EXPAND_RULE.need}개 이상이에요`,
    `선출시 ${stores.length}곳 중 ${storesPassed}곳이 매장 기준을 넘었어요`,
    `최근 3일(D+${Math.max(0, D - 2)}~D+${D}) 선출시 매장 기준이에요`,
  ]
  return (
    <div className="border-t border-border px-1 pb-6 pt-5 sm:px-3">
      {q.from === 'launch' && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-accent px-4 py-3 text-sm">
          <p className="min-w-0 flex-1"><b>개발 13주가 지났다고 가정</b>하고 선출시 {stores.length}곳의 출시 후 <Day n={D} /> 시점을 열었어요. 합성 시뮬레이션이에요</p>
          <button type="button" aria-label="안내 닫기" onClick={() => setQ({ from: '' })} className="rounded-md p-1 text-muted-foreground hover:bg-background/60"><X className="size-4" /></button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-keep font-extrabold leading-[1.25] tracking-tight"><FitLine max={26} min={17} text={headline} /></h3>
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
            {lines.map((l) => <li key={l}><FitLine max={14} min={12} text={l} /></li>)}
          </ul>
        </div>
        <p className="text-right"><span className="block text-[11px] text-muted-foreground">재고 방향</span><span className="block text-xl font-extrabold leading-tight text-primary">{DIR_LABEL[v.dir]}</span></p>
      </div>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <BigHeading>확대 기준</BigHeading>
        <span className="text-[11px] text-muted-foreground">지표를 누르면 매장별 값이 열려요</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{EXPAND_RULE.need}개 이상 통과하고 순효과와 매장 편차를 모두 넘으면 전국 확대예요</p>
      <ul className="mt-3 grid gap-x-8 md:grid-cols-2">
        {checks.map((c) => {
          const on = metric === c.id
          return (
            <li key={c.id} className="border-b border-border">
              <button type="button" aria-pressed={on} onClick={() => setMetric(on ? null : c.id)}
                className={cn('flex w-full items-center gap-3 rounded-xl border px-2 py-3 text-left transition-colors active:translate-y-px', FR, on ? 'picked' : 'border-transparent hover:bg-muted/60')}>
                <PassMark pass={c.pass} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1 text-sm font-semibold">{c.label}{SOURCES[c.id].map((s) => <SourceBadge key={s} source={s} />)}</span>
                  <span className="block text-xs text-muted-foreground">기준 {c.rule}</span>
                </span>
                <span className="text-right">
                  <b className={cn('num block whitespace-nowrap text-lg tracking-tight', !c.pass && 'text-muted-foreground')}>{c.display}</b>
                  <span className={cn('block text-[11px] font-semibold', c.pass ? 'text-primary' : 'text-muted-foreground')}>{c.pass ? '통과' : '미달'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {open && <StoreBreakdown c={open} stores={stores} onClose={() => setMetric(null)} />}
      <div className="mt-6 flex justify-center">
        <Button className="h-11 px-6" onClick={onDecide} disabled={v.dir === 'wait'}>{deciding ? '아래에서 재고 방향을 정하고 있어요' : '재고 방향 정하기'}</Button>
      </div>
    </div>
  )
}

function ProductList({ open, onOpen, deciding, onDecide }: { open: string | null; onOpen: (id: string | null) => void; deciding: boolean; onDecide: () => void }) {
  const { scenarios, href } = useApp()
  const rows = useMemo(() => scenarios.filter((sc) => sc.launch !== '캠페인').map((sc) => {
    const d = dataFor(sc)
    return { sc, d, v: verdict(d, sc.today) }
  }), [scenarios])
  return (
    <Card className="mb-6 border-border pb-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-x-2 text-xl font-extrabold tracking-tight text-primary">선출시 중인 상품<EvidenceBadge kind="sim" note="카메라와 POS 값은 모두 합성입니다. 확대 기준은 공개 근거를 찾지 못한 자체 가정입니다" /></h2>
          <p className="mt-0.5 text-xs text-muted-foreground">눌러서 확대 기준 보기</p>
        </div>
        <a href={href('feedback', { at: 'log' })} className={cn('inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-primary hover:underline', FR)}>과거 기록 보기<ArrowRight className="size-4" /></a>
      </div>
      <div className={cn('hidden gap-3 px-3 pb-2 text-[11px] text-muted-foreground md:grid', ROW)}>
        <span>상품</span><span>확대 기준 통과</span><span className="text-right">순효과</span><span className="text-center">재고 방향</span><span className="text-center">순효과 추이</span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {rows.map(({ sc, d, v }) => {
          const on = open === sc.id
          return (
            <li key={sc.id} className={cn('rounded-2xl', on && 'bg-card')}>
              <button type="button" aria-expanded={on} onClick={() => onOpen(on ? null : sc.id)}
                className={cn('grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors active:translate-y-px', ROW, FR, on ? 'picked' : 'border-transparent bg-muted/70 hover:bg-accent/50')}>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2"><span className="truncate text-base font-bold">{sc.label}</span><span className="whitespace-nowrap rounded-full bg-card px-2 py-0.5 text-[11px] font-bold">{sc.launch === '콜라보' ? '콜라보' : '이달의 맛'}</span></span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">출시 <Day n={sc.today} className="text-[11px]" /> · 선출시 {v.ex.stores.length}곳</span>
                </span>
                <span className="col-start-1 flex items-center gap-2 md:col-start-auto"><PassDots checks={v.ex.checks} /><b className="num text-sm">{v.ex.passed}/8</b></span>
                <span className="num hidden text-right text-sm font-bold md:block">{pp(v.ex.checks.find((c) => c.id === 'net')!.value ?? 0)}</span>
                <span className="col-start-2 row-start-1 text-center md:col-start-auto md:row-start-auto"><DirChip dir={v.dir} className={cn('px-3', v.dir === 'expand' && 'bg-primary text-primary-foreground')} /></span>
                <span className="hidden text-center md:block"><Sparkline values={d.netAgg.slice(0, sc.today + 1)} w={96} h={28} /></span>
              </button>
              {on && <Detail key={sc.id} deciding={deciding} onDecide={onDecide} />}
            </li>
          )
        })}
      </ol>
      {!rows.length && <p className="rounded-2xl bg-muted/70 py-6 text-center text-sm text-muted-foreground">선출시 중인 상품이 없어요. 트렌드 탭에서 출시를 정하면 여기에 생겨요</p>}
    </Card>
  )
}

/** 재고 방향 정하기: 전국 확대, 부분 확대, 유지, 축소 중 하나를 기록한다 */
function DirSection() {
  const { data: d, day: D, scn, appr, setAppr } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const rec = v.dir as Exclude<Dir, 'wait'>
  const [choice, setChoice] = useState<Exclude<Dir, 'wait'>>(rec)
  const [note, setNote] = useState('')
  useEffect(() => { setChoice(rec); setNote('') }, [rec, D])
  const saved = dirDecisions(appr, scn.id, D)[0]
  const passedTypes = v.ex.stores.filter((s) => s.pass).map((s) => s.st.type)
  const meaning = DIR_MEANING[scn.launch]
  const evidence = [
    { k: '확대 기준', v: `8개 중 ${v.ex.passed}개 통과` },
    { k: '매장 기준', v: `${v.ex.stores.length}곳 중 ${v.ex.storesPassed}곳 통과${passedTypes.length ? ` (${passedTypes.join(', ')})` : ''}` },
    { k: '순효과', v: v.ex.checks.find((c) => c.id === 'net')!.display },
    { k: '근거', v: `${v.days}일` },
  ]
  return (
    <section aria-label="재고 방향" className="mb-6">
      <div className="mb-4">
        <h2 className="text-2xl font-extrabold tracking-tight">재고 방향을 정해볼까요</h2>
        <p className="mt-1 text-xs text-muted-foreground">{scn.label} · 출시 <Day n={D} className="text-xs" /> · 권고는 {DIR_LABEL[rec]}</p>
      </div>
      <div role="radiogroup" aria-label="재고 방향" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {DIR_OPTIONS.map((o) => {
          const on = choice === o
          return (
            <button key={o} type="button" role="radio" aria-checked={on} onClick={() => setChoice(o)}
              className={cn('rounded-2xl border p-4 text-left transition-colors active:translate-y-px', FR, on ? 'picked' : 'border-border bg-card hover:bg-accent/50')}>
              <span className="flex items-center justify-between gap-2"><span className="text-lg font-bold">{DIR_LABEL[o]}</span>{o === rec && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">권고</span>}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{meaning[o]}</span>
              {o === 'fix' && passedTypes.length > 0 && <span className="mt-1 block text-xs font-semibold text-primary">대상 상권: {passedTypes.join(', ')}</span>}
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
        <Button className="h-10" onClick={() => setAppr(dirKey(scn.id, D), { kind: 'dir', day: D, choice, rec, note: note.trim() })}>{ro(DIR_LABEL[choice])} 기록</Button>
      </div>
      {saved && <p className="mt-2 text-xs text-muted-foreground">기록됨: <b className="text-foreground">{DIR_LABEL[saved.choice]}</b> (<Day n={saved.day} className="text-xs" />){saved.choice !== saved.rec && `, 권고는 ${DIR_LABEL[saved.rec]}`}</p>}
    </section>
  )
}

export default function ReactPage() {
  const { scn, q, setQ, go } = useApp()
  // 주소에 남은 launch는 선택으로 치지 않는다. 행을 누르거나 트렌드에서 넘어올 때(open=1)만 상세를 연다
  const [open, setOpen] = useState<string | null>(q.open === '1' ? scn.id : null)
  const [deciding, setDeciding] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (q.open === '1') setQ({ open: '' }) }, [q.open, setQ])
  useEffect(() => { if (deciding) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [deciding])
  const pick = (id: string | null) => {
    setOpen(id); setDeciding(false)
    if (id) go('react', { launch: id })
  }
  const shown = open && scn.id === open && scn.launch !== '캠페인'
  return (
    <div>
      <TabTitle title="매장 반응" desc="선출시 결과로 전국 확대를 정해요" />
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold tracking-tight">전국으로 확대할까요?</h2>
        <p className="mt-1 text-sm text-muted-foreground">선출시 매장의 8개 지표가 확대 기준을 넘었는지 보고, 재고를 늘릴지 유지할지 줄일지 정해요</p>
      </header>
      <ProductList open={shown ? open : null} onOpen={pick} deciding={deciding} onDecide={() => setDeciding(true)} />
      <div ref={ref} className="scroll-mt-6">{shown && deciding && <DirSection key={scn.id} />}</div>
      <HowTo title="확대 기준">
        <p>선출시 매장의 최근 3일을 봅니다. <b>총 방문</b> 평소 예상 대비 +{EXPAND_RULE.visit * 100}% 이상, <b>미출시 매장 대비 순효과</b> +{EXPAND_RULE.net * 100}%p 이상, <b>신제품 구매 수</b> 방문 100명당 {EXPAND_RULE.sold}개 이상, <b>판매 비중</b> 전체 주문의 {EXPAND_RULE.share * 100}% 이상, <b>판매 증가율</b> 직전 3일 대비 {EXPAND_RULE.growth * 100}%보다 덜 꺾임, <b>품절 의심</b> 선출시 매장의 {EXPAND_RULE.out * 100}% 미만(품절이 많으면 판매 수치가 재고에 막혀 실제 수요를 못 보여 줍니다), <b>재고 소진 속도</b> 하루 판매가 첫 입고량의 {EXPAND_RULE.deplete * 100}% 이상, <b>매장 간 결과 편차</b> 선출시 매장의 {EXPAND_RULE.spread * 100}% 이상이 매장 기준(방문 +{EXPAND_RULE.visit * 100}%, 100명당 {EXPAND_RULE.sold}개)을 넘음.</p>
        <p className="mt-1"><b>재고 방향:</b> {DIR_RULE.expand}. {DIR_RULE.fix}. {DIR_RULE.wrap}. {DIR_RULE.maintain}. 출시 후 3일 전에는 판단하지 않습니다.</p>
        <p className="mt-1">기준값은 공개 근거를 찾지 못한 팀 가정이고, 카메라와 POS 값은 합성입니다. 결과가 왜 이렇게 나왔는지(원인)는 피드백 탭에서 봅니다.</p>
      </HowTo>
    </div>
  )
}
