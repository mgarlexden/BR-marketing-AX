import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import { Undo2 } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { DAYS, DIR_LABEL, shortName } from '@/lib/data'
import { dirDecisions, dirKey, fixKey, fixRequests, launchKey, launchesOf, learnKey, radarKey, skipKey, skipsOf, type Cause, type LearnDecision, type RadarApproval } from '@/lib/derived'
import { betaStats, dataFor } from '@/lib/launch'
import { causeAnalysis, CAUSE_HINT, CAUSE_LABEL, CAUSE_RULE, type CauseResult } from '@/lib/cause'
import { RADAR } from '@/lib/trend-data'
import { shortDate } from '@/lib/trend'
import { pct } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { EmbeddedCtx, EmptyState, HowTo, Stat, TabTitle } from '@/components/page'
import { DirChip, Pill } from '@/components/status'
import { Day } from '@/components/figures'
import { EvidenceBadge } from '@/components/evidence'
import { SourceBadge } from '@/components/source-badge'
import { FitLine, josa } from '@/components/fit-line'
import { cn } from '@/lib/utils'
import Why from './why'

const { meta, items, scores } = RADAR
const H = meta.horizon
const past = items.filter((i) => i.actual !== null)
const hit = past.filter((i) => (i.prob >= 0.5) === i.actual).length
const FR = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const ROW = 'md:grid-cols-[minmax(12rem,1.3fr)_minmax(9rem,1fr)_6.5rem_5.5rem_5.5rem]'
const BigHeading = ({ children }: { children: React.ReactNode }) => <h3 className="text-[21px] font-bold leading-tight tracking-tight">{children}</h3>
const USE: Record<LearnDecision['use'], string> = { use: '레이더에 반영', exclude: '학습에서 제외', hold: '보류' }
const GROUPS: Exclude<Cause, 'event'>[] = ['ops', 'flavor', 'radar']
const curveCfg = { orig: { label: '레이더 예상', color: 'var(--muted-foreground)' }, fixed: { label: '정답으로 보정', color: 'var(--chart-2)' }, actual: { label: '매장 실제', color: 'var(--primary)' } } satisfies ChartConfig
/** 원인별 권고: 레이더 오판과 맛 자체는 정답으로 학습에 쓰고, 매장 실행과 외부 이벤트는 레이더 탓이 아니라 뺀다 */
const RECOMMEND: Record<Cause, LearnDecision['use']> = { radar: 'use', flavor: 'use', ops: 'exclude', event: 'exclude' }

function headlineOf(r: CauseResult) {
  if (!r.cause) return '모든 지표가 기대 안에 있어, 레이더 예측이 맞았어요'
  return `가장 크게 어긋난 건 ${josa(r.top.label, '이라', '라')}, 원인은 ${josa(CAUSE_LABEL[r.cause], '으로', '로')} 봐요`
}

/** 레이더 정답률: 출시 여부와 관계없이 모든 후보에 13주 뒤 정답이 생긴다 */
function SearchCheck() {
  const { appr } = useApp()
  const k = hit, m = past.length - hit
  const b = betaStats(k, m)
  const fixed = Object.values(appr).filter((v): v is RadarApproval => v.kind === 'radar' && v.state === 'approved').length
  return (
    <Card id="radar-accuracy" className="mb-6 scroll-mt-6">
      <CardHeader title="레이더 정답률 확인" description="출시하지 않은 후보도 포함해 13주 뒤 실제 검색과 비교해요. 매장 데이터 없이 레이더만의 정답률을 확인해요" right={<EvidenceBadge kind="ok" />} />
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Stat label="예측이 맞은 키워드" value={`${k} / ${past.length}`} note={<span className="text-[0.8em]">생존 확률 50% 기준</span>} />
          <Stat label="맞힐 확률 추정" value={`${Math.round(b.mean * 100)}%`} />
          <p className="text-xs text-muted-foreground">매장 결과로 정답 반영한 사례 <b className="num text-foreground">{fixed}건</b></p>
          {past.every((i) => !i.actual) && <p className="text-xs leading-relaxed text-bad">실제로 버틴 키워드가 0건입니다. 못 버틸 것을 맞히는 능력만 확인되고, 버틸 것을 맞히는 능력은 이 표로 알 수 없습니다.</p>}
          <div className="mt-auto flex flex-col gap-0.5 pt-3 text-xs leading-snug text-muted-foreground">
            <p className="mb-0.5 font-bold text-foreground">참고</p>
            <p>13주마다 결과가 나올 때마다 정답률을 다시 계산해요</p>
            <p>학습에 쓴 키워드라 점수가 후하게 나와요</p>
            <p>실제 실력은 레이더 탭 모델 성능에서 봐요</p>
          </div>
        </div>
        <Table wrapperClassName="max-h-72">
          <THead><TR><TH>키워드</TH><TH className="hidden sm:table-cell">유형</TH><TH>예측 생존</TH><TH>실제</TH><TH>적중</TH><TH className="hidden text-right sm:table-cell">감지</TH></TR></THead>
          <TBody>
            {past.map((it) => (
              <TR key={it.kw}>
                <TD className="whitespace-nowrap font-medium">{it.kw}</TD>
                <TD className="hidden text-xs text-muted-foreground sm:table-cell">{it.type}</TD>
                <TD className="num text-xs">{Math.round(it.prob * 100)}%</TD>
                <TD><Pill tone={it.actual ? 'good' : 'neutral'}>{it.actual ? '버팀' : '못 버팀'}</Pill></TD>
                <TD>{(it.prob >= 0.5) === it.actual ? <span className="text-xs text-good">맞음</span> : <span className="text-xs text-bad">틀림</span>}</TD>
                <TD className="num hidden text-right text-xs text-muted-foreground sm:table-cell">{shortDate(it.detected)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  )
}

/** ① 원인 분석: 지표마다 기대 대비 어긋난 정도를 막대로, 가장 큰 지표를 원인으로 */
function CauseBlock({ r }: { r: CauseResult }) {
  const [floor, setFloor] = useState(false)
  return (
    <div>
      <BigHeading>① 원인 분석</BigHeading>
      <p className="mt-1 text-xs text-muted-foreground">지표마다 기대에서 얼마나 어긋났는지 보고, 가장 크게 어긋난 지표가 속한 묶음을 원인으로 봐요</p>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        {GROUPS.map((g) => {
          const list = r.metrics.filter((m) => m.group === g)
          const lead = r.cause === g
          return (
            <div key={g} className="min-w-0">
              <p className="flex items-center gap-2 border-b border-border pb-1.5 text-sm font-bold">{CAUSE_LABEL[g]}{lead && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">원인</span>}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{CAUSE_HINT[g]}</p>
              <ul className="mt-2 flex flex-col gap-3">
                {list.map((m) => {
                  const top = lead && m.id === r.top.id
                  return (
                    <li key={m.id}>
                      <p className="flex flex-wrap items-center gap-1 text-xs font-semibold">{m.label}{m.sources.map((s) => <SourceBadge key={s} source={s} />)}</p>
                      <p className="mt-0.5 flex items-baseline justify-between gap-2 text-sm"><b className={cn('num', top && 'text-primary')}>{m.value}</b><span className="text-[11px] text-muted-foreground">기대 {m.expect}</span></p>
                      <div className="mt-1 h-2 rounded-full bg-muted"><i className={cn('block h-full rounded-full', top ? 'bg-primary' : 'bg-muted-foreground/45')} style={{ width: `${Math.max(2, m.gap * 100)}%` }} /></div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">어긋남 <b className={cn('num', top ? 'text-primary' : 'text-foreground')}>{Math.round(m.gap * 100)}%</b></p>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      <div className="mt-4">
        <button type="button" aria-expanded={floor} onClick={() => setFloor(!floor)} className={cn('text-sm font-semibold text-primary underline-offset-4 hover:underline', FR)}>{floor ? '매장 동선 접기' : '매장 동선과 전환 자세히 보기'}</button>
        {floor && <div className="mt-3"><EmbeddedCtx.Provider value><Why /></EmbeddedCtx.Provider></div>}
      </div>
    </div>
  )
}

/** ② 레이더 오답 확인: 예상 곡선과 실제, 정답으로 보정하면 오차가 얼마나 줄어드는지 */
function RadarBlock({ r }: { r: CauseResult }) {
  const { data: d, day: D } = useApp()
  const rows = Array.from({ length: DAYS + 1 }, (_, i) => ({ day: i, orig: r.curve.orig[i], fixed: r.radarWrong && r.curve.fixed ? r.curve.fixed[i] : null, actual: i <= D ? r.curve.actual[i] : null }))
  const hi = Math.max(0.4, ...rows.flatMap((x) => [x.orig, x.actual ?? 0, x.fixed ?? 0])), step = hi > 1.2 ? 0.5 : 0.2
  const shapeOk = r.cls.type === '판정 보류' ? null : r.cls.type === d.scn.radarShape
  const inRange = r.act >= r.exp.visitLo && r.act <= r.exp.visitHi
  const facts = [
    { k: '유형 예측 vs 실측', v: `${d.scn.radarShape} → ${r.cls.type}`, ok: shapeOk },
    { k: '기대 방문 범위 vs 실측', v: `+${Math.round(r.exp.visitLo * 100)}~${Math.round(r.exp.visitHi * 100)}% → ${pct(r.act)}`, ok: inRange || r.metrics.find((m) => m.id === 'range')!.gap < CAUSE_RULE.rangeTol },
  ]
  return (
    <div>
      <BigHeading>② 레이더 오답 확인</BigHeading>
      <p className="mt-1 text-xs text-muted-foreground">레이더가 예상한 반응 모양과 크기를 매장 실제와 비교해요. 틀렸으면 실제 모양을 정답으로 레이더에 다시 넣어요</p>
      <div className="mt-4 grid items-center gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ChartContainer config={curveCfg} className="aspect-auto h-52 w-full">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" type="number" domain={[0, 28]} ticks={[0, 7, 14, 21, 28]} tickFormatter={(x) => `D+${x}`} tickLine={false} axisLine={false} />
            <YAxis domain={[0, Math.ceil(hi / step) * step]} tickFormatter={(x) => pct(x)} tickLine={false} axisLine={false} width={48} tickCount={4} />
            <ChartTooltip cursor={{ stroke: 'var(--border)' }} content={<ChartTooltipContent labelFormatter={(_, p) => `D+${p?.[0]?.payload?.day ?? ''}`} formatter={(val, n) => <span className="flex w-full justify-between gap-6"><span className="text-muted-foreground">{curveCfg[n as keyof typeof curveCfg]?.label}</span><span className="num font-semibold">{pct(Number(val))}</span></span>} />} />
            <Line dataKey="orig" stroke="var(--color-orig)" strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
            <Line dataKey="fixed" stroke="var(--color-fixed)" strokeWidth={2} strokeDasharray="2 4" dot={false} isAnimationActive={false} />
            <Line dataKey="actual" stroke="var(--color-actual)" strokeWidth={3} dot={false} isAnimationActive={false} />
            <ReferenceLine x={D} stroke="var(--foreground)" />
          </ComposedChart>
        </ChartContainer>
        <div>
          <ul className="divide-y divide-border border-y border-border">
            {facts.map((f) => (
              <li key={f.k} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-muted-foreground">{f.k}</span>
                <span className="num text-right"><b>{f.v}</b> <span className={cn('ml-1 text-xs font-semibold', f.ok === null ? 'text-muted-foreground' : f.ok ? 'text-good' : 'text-bad')}>{f.ok === null ? '판정 보류' : f.ok ? '맞음' : '틀림'}</span></span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-muted-foreground">예상과 실제의 평균 차이</span>
              <span className="num text-right"><b>{Math.round(r.errBefore * 100)}%p</b>{r.radarWrong && r.errAfter !== null && <> → <b className="text-primary">{Math.round(r.errAfter * 100)}%p</b> <span className="text-xs text-muted-foreground">정답 반영 시</span></>}</span>
            </li>
          </ul>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t-2 border-dashed border-muted-foreground" />레이더 예상</li>
            {r.radarWrong && <li className="flex items-center gap-1.5"><i className="h-0.5 w-4 border-t-2 border-dotted border-[var(--chart-2)]" />정답으로 보정</li>}
            <li className="flex items-center gap-1.5"><i className="h-1 w-4 rounded bg-primary" />매장 실제</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/** 학습 판단: 원인을 확인하고, 레이더 오답이면 정답으로 반영한다 */
function LearnBlock({ r }: { r: CauseResult }) {
  const { data: d, day: D, scn, appr, setAppr } = useApp()
  const saved = appr[learnKey(scn.id)] as LearnDecision | undefined
  const guess: Cause = r.cause ?? 'radar'
  const [cause, setCause] = useState<Cause>(saved?.cause ?? guess)
  const [note, setNote] = useState(saved?.note ?? '')
  useEffect(() => { setCause(saved?.cause ?? guess); setNote(saved?.note ?? '') }, [scn.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const ready = D >= CAUSE_RULE.ready
  const rec = r.cause ? RECOMMEND[r.cause] : 'use'
  const save = (use: LearnDecision['use']) => {
    setAppr(learnKey(scn.id), { kind: 'learn', scn: scn.id, day: D, cause, use, note: note.trim() })
    if (use === 'use' && cause === 'radar' && r.cls.kind) setAppr(radarKey(scn.id), { kind: 'radar', state: 'approved', day: D, curve: r.cls.kind, peakVal: r.cls.peakVal, shape: r.cls.type })
    if (use === 'hold') setAppr(radarKey(scn.id), { kind: 'radar', state: 'deferred', day: D })
  }
  return (
    <div>
      <BigHeading>학습 판단: 레이더</BigHeading>
      <p className="mt-1 text-xs text-muted-foreground">{ready ? `출시 후 D+${D}${D < 28 ? ' (잠정, D+28에 확정)' : ''}` : `출시 후 ${CAUSE_RULE.ready}일부터 판단해요. 더 이른 결과는 흔들림이 커요`}</p>
      <div role="radiogroup" aria-label="원인" className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {(['radar', 'flavor', 'ops', 'event'] as Cause[]).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cause === c} onClick={() => setCause(c)}
            className={cn('rounded-2xl border p-3 text-left transition-colors active:translate-y-px', FR, cause === c ? 'picked' : 'border-border bg-card hover:bg-accent/50')}>
            <span className="flex items-center gap-1.5 text-sm font-semibold">{CAUSE_LABEL[c]}{c === r.cause && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">분석 결과</span>}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{CAUSE_HINT[c]}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="사유 (선택)" aria-label="사유" className="h-10 min-w-56 flex-1 rounded-full border border-input bg-background px-4 text-sm" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!ready} onClick={() => save('hold')}>보류</Button>
          <Button variant={rec === 'exclude' ? 'default' : 'outline'} disabled={!ready} onClick={() => save('exclude')}>학습에서 제외</Button>
          <Button variant={rec === 'use' ? 'default' : 'outline'} disabled={!ready} onClick={() => save('use')}>{cause === 'radar' && r.radarWrong ? `${r.cls.type} 정답으로 레이더에 반영` : '레이더에 반영'}</Button>
        </div>
      </div>
      {saved && <p className="mt-2 text-xs text-muted-foreground">기록됨: <b className="text-foreground">{CAUSE_LABEL[saved.cause]}, {USE[saved.use]}</b> (<Day n={saved.day} className="text-xs" />)</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">권고: {r.cause ? `${CAUSE_LABEL[r.cause]}라 ${RECOMMEND[r.cause] === 'use' ? '정답으로 학습에 써요' : '레이더 탓이 아니어서 학습에서 빼요'}` : '기대대로라 그대로 학습에 써요'}. 품절, 행사가 있던 사례는 빼고, 선출시 매장을 본사가 골랐다는 점을 감안해 가중해요. 사람이 승인한 뒤에만 반영하고, 모델 재학습은 별도로 실행해요{d.scn.launch === '콜라보' ? '. 콜라보는 레이더 대신 콜라보 기준에 반영해요' : ''}</p>
    </div>
  )
}

function Detail() {
  const { data: d, day: D } = useApp()
  const r = useMemo(() => causeAnalysis(d, D), [d, D])
  const lines = [
    r.cause ? `${r.top.label} 어긋남 ${Math.round(r.top.gap * 100)}%, 다른 지표보다 가장 커요` : `가장 큰 어긋남도 ${Math.round(r.top.gap * 100)}%로 기준 ${CAUSE_RULE.minGap * 100}% 아래예요`,
    r.radarWrong ? `레이더는 ${d.scn.radarShape}으로 봤지만 실제는 ${josa(r.cls.type, '이에요', '예요')}` : '레이더가 본 반응 모양과 크기는 실제와 맞았어요',
    `출시 후 ${D + 1}일 동안의 선출시 매장 데이터예요`,
  ]
  return (
    <div className="border-t border-border px-1 pb-6 pt-5 sm:px-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-keep font-extrabold leading-[1.25] tracking-tight"><FitLine max={26} min={17} text={headlineOf(r)} /></h3>
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
            {lines.map((l) => <li key={l}><FitLine max={14} min={12} text={l} /></li>)}
          </ul>
        </div>
        <p className="text-right"><span className="block text-[11px] text-muted-foreground">원인</span><span className="block text-xl font-extrabold leading-tight text-primary">{r.cause ? CAUSE_LABEL[r.cause] : '없음'}</span></p>
      </div>
      <div className="mt-6 flex flex-col gap-8">
        <CauseBlock r={r} />
        <RadarBlock r={r} />
        <LearnBlock r={r} />
      </div>
    </div>
  )
}

function ProductList({ open, onOpen }: { open: string | null; onOpen: (id: string | null) => void }) {
  const { scenarios, appr } = useApp()
  const rows = useMemo(() => scenarios.filter((sc) => sc.launch !== '캠페인').map((sc) => ({ sc, r: causeAnalysis(dataFor(sc), sc.today) })), [scenarios])
  return (
    <Card className="mb-6 border-border pb-5">
      <div className="mb-3">
        <h2 className="flex flex-wrap items-center gap-x-2 text-xl font-extrabold tracking-tight text-primary">선출시한 상품<EvidenceBadge kind="sim" note="매장 쪽 값은 합성이라 절차를 시연하는 용도입니다" /></h2>
        <p className="mt-0.5 text-xs text-muted-foreground">눌러서 원인 분석 보기</p>
      </div>
      <div className={cn('hidden gap-3 px-3 pb-2 text-[11px] text-muted-foreground md:grid', ROW)}>
        <span>상품</span><span>가장 크게 어긋난 지표</span><span className="text-center">원인</span><span className="text-center">레이더</span><span className="text-center">학습</span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {rows.map(({ sc, r }) => {
          const on = open === sc.id
          const learn = appr[learnKey(sc.id)] as LearnDecision | undefined
          return (
            <li key={sc.id} className={cn('rounded-2xl', on && 'bg-card')}>
              <button type="button" aria-expanded={on} onClick={() => onOpen(on ? null : sc.id)}
                className={cn('grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors active:translate-y-px', ROW, FR, on ? 'picked' : 'border-transparent bg-muted/70 hover:bg-accent/50')}>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2"><span className="truncate text-base font-bold">{sc.label}</span><span className="whitespace-nowrap rounded-full bg-card px-2 py-0.5 text-[11px] font-bold">{sc.launch === '콜라보' ? '콜라보' : '이달의 맛'}</span></span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">출시 <Day n={sc.today} className="text-[11px]" /></span>
                </span>
                <span className="col-start-1 min-w-0 md:col-start-auto">
                  <span className="block truncate text-xs font-semibold">{r.top.label} <span className="num text-muted-foreground">{Math.round(r.top.gap * 100)}%</span></span>
                  <span className="mt-1 block h-1.5 rounded-full bg-card"><i className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, r.top.gap * 100)}%` }} /></span>
                </span>
                <span className="col-start-2 row-start-1 text-center md:col-start-auto md:row-start-auto"><span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', r.cause ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{r.cause ? CAUSE_LABEL[r.cause] : '없음'}</span></span>
                <span className={cn('hidden text-center text-xs font-semibold md:block', r.radarWrong ? 'text-bad' : 'text-good')}>{r.radarWrong ? '틀림' : '맞음'}</span>
                <span className="hidden text-center text-xs text-muted-foreground md:block">{learn ? <b className="text-foreground">{USE[learn.use]}</b> : sc.today >= CAUSE_RULE.ready ? '대기' : `D+${CAUSE_RULE.ready}부터`}</span>
              </button>
              {on && <Detail key={sc.id} />}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

interface Row { sort: number; when: React.ReactNode; flavor: string; kind: string; body: React.ReactNode; undo?: () => void }

function Log() {
  const { scenarios, appr, setAppr } = useApp()
  const rows = useMemo(() => {
    const r: Row[] = []
    let ord = 0
    launchesOf(appr).forEach((l) => r.push({ sort: 1000 + ord++, when: <span className="text-xs">결정</span>, flavor: l.concept ?? l.kw, kind: '출시 결정', body: <span className="text-xs">{l.launch === '콜라보' ? '콜라보 · ' : ''}선출시 {l.stores.length}곳, 기대 방문 +{Math.round(l.exp.visitLo * 100)}~{Math.round(l.exp.visitHi * 100)}%{l.launch === '콜라보' ? '' : `, 생존 확률 ${Math.round(l.prob * 100)}% (${shortDate(l.detected)} 감지)`}</span>, undo: () => setAppr(launchKey(l.kw), null) }))
    skipsOf(appr).forEach((s) => r.push({ sort: 1000 + ord++, when: <span className="text-xs">결정</span>, flavor: s.kw, kind: '출시 안 함', body: <span className="text-xs">생존 확률 {Math.round(s.prob * 100)}%. {H}주 뒤 실제 검색과 비교합니다</span>, undo: () => setAppr(skipKey(s.kw), null) }))
    scenarios.forEach((sc) => {
      const dd = dataFor(sc)
      dirDecisions(appr, sc.id, 99).forEach((x) => r.push({
        sort: x.day, when: <Day n={x.day} />, flavor: sc.label, kind: '재고 방향',
        body: <span className="flex flex-wrap items-center gap-2"><DirChip dir={x.choice} />{x.choice === x.rec ? <span className="text-xs text-muted-foreground">권고와 같음</span> : <span className="text-xs text-muted-foreground">권고는 <b>{DIR_LABEL[x.rec]}</b></span>}{x.note && <span className="text-xs">{x.note}</span>}</span>,
        undo: () => setAppr(dirKey(sc.id, x.day), null),
      }))
      fixRequests(appr, sc.id, 99).forEach((x) => r.push({ sort: x.day, when: <Day n={x.day} />, flavor: sc.label, kind: '매장 점검 요청', body: <span className="text-xs">{x.stores.map((id) => shortName(dd.stores.find((s) => s.id === id)!)).join(', ')} (이전 기록)</span>, undo: () => setAppr(fixKey(sc.id, x.day), null) }))
      const ra = appr[radarKey(sc.id)] as RadarApproval | undefined
      if (ra) r.push({ sort: ra.day, when: <Day n={ra.day} />, flavor: sc.label, kind: '레이더 정답 반영', body: ra.state === 'approved' ? <span className="text-xs"><b>{ra.shape}</b>을 정답으로 반영</span> : <span className="text-xs text-muted-foreground">보류</span>, undo: () => setAppr(radarKey(sc.id), null) })
      const le = appr[learnKey(sc.id)] as LearnDecision | undefined
      if (le) r.push({ sort: le.day, when: <Day n={le.day} />, flavor: sc.label, kind: '학습 판단', body: <span className="text-xs">{CAUSE_LABEL[le.cause]}, <b>{USE[le.use]}</b>{le.note ? `. ${le.note}` : ''}</span>, undo: () => setAppr(learnKey(sc.id), null) })
    })
    return r.sort((a, b) => b.sort - a.sort)
  }, [scenarios, appr, setAppr])
  if (!rows.length) return <EmptyState title="아직 기록이 없습니다. 출시 결정과 판정이 여기에 쌓입니다" />
  return (
    <Card className="p-0">
      <Table>
        <THead><TR><TH className="pl-5">시점</TH><TH>맛</TH><TH>종류</TH><TH>내용</TH><TH className="pr-5" /></TR></THead>
        <TBody>
          {rows.map((r, i) => (
            <TR key={i}>
              <TD className="whitespace-nowrap pl-5">{r.when}</TD>
              <TD className="whitespace-nowrap text-sm font-medium">{r.flavor}</TD>
              <TD><Pill tone={r.kind === '출시 안 함' ? 'neutral' : 'primary'}>{r.kind}</Pill></TD>
              <TD>{r.body}</TD>
              <TD className="pr-5 text-right">{r.undo && <button type="button" onClick={r.undo} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"><Undo2 className="size-3" />되돌리기</button>}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  )
}

export default function Feedback() {
  const { scn, q, go } = useApp()
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { if (q.at === 'log') document.getElementById('decision-log')?.scrollIntoView() }, [q.at])
  const pick = (id: string | null) => { setOpen(id); if (id) go('feedback', { launch: id }) }
  const shown = open && scn.id === open ? open : null
  return (
    <div>
      <TabTitle title="피드백" desc="틀린 원인을 찾아 레이더에 반영해요" />
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold tracking-tight">레이더가 무엇을 틀렸을까요?</h2>
        <p className="mt-1 text-sm text-muted-foreground">가장 크게 어긋난 지표로 원인을 찾고, 레이더 오답은 정답으로 다시 반영해 정확도를 올려요</p>
      </header>
      <ProductList open={shown} onOpen={pick} />
      <SearchCheck />
      <h2 id="decision-log" className="mb-2 scroll-mt-20 text-sm font-semibold">결정 로그</h2>
      <Log />
      <HowTo title="피드백 규칙">
        <p><b>원인 분석:</b> 지표마다 기대 대비 어긋난 정도(0~100%)를 구하고 가장 큰 지표가 속한 묶음을 원인으로 봅니다. 매장 실행은 신제품 구역 방문(출시 전보다 +{CAUSE_RULE.zoneUp * 100}%p 기대), 시식률({CAUSE_RULE.taste * 100}% 기대), 매장별 전환 차이(전환이 중앙값보다 50% 낮은 선출시 매장 수)입니다. 맛 자체는 전환율(출시 전 이상 기대), 재구매율({CAUSE_RULE.repeat * 100}% 기대)입니다. 레이더 오판은 유형 예측 vs 실측(다르면 신뢰도에 따라 40~100%), 기대 방문 범위 vs 실측(범위를 벗어난 만큼)입니다. 가장 큰 어긋남이 {CAUSE_RULE.minGap * 100}% 미만이면 원인 없음입니다.</p>
        <p className="mt-1"><b>레이더 오답:</b> 유형이 다르거나 기대 방문 범위를 {CAUSE_RULE.rangeTol * 100}% 넘게 벗어나면 틀림입니다. 정답으로 반영하면 실제 모양(유형과 정점)을 레이더 예상 곡선 대신 쓰고, 예상과 실제의 평균 차이가 얼마나 줄어드는지 보여 줍니다.</p>
        <p className="mt-1"><b>학습 판단:</b> 출시 후 {CAUSE_RULE.ready}일부터 판단하고 D+28에 확정합니다. 레이더 오판과 맛 자체는 정답으로 학습에 쓰고, 매장 실행과 외부 이벤트는 레이더 탓이 아니라 뺄 것을 권합니다. 시식률과 재구매율은 카메라·멤버십 연결 전 시연값입니다.</p>
        <p className="mt-1"><b>레이더 정답률:</b> 검색 기준은 출시 여부와 관계없이 모든 후보에 {H}주 뒤 정답이 생기고, 매장 기준은 선출시한 맛에만 생깁니다. 출시한 것만 학습하면 고른 것만 배우는 편향이 생기므로 둘을 함께 봅니다. 학습에 안 쓴 키워드 기준 정확도는 {Math.round(scores.model_bal * 100)}%입니다.</p>
      </HowTo>
    </div>
  )
}
