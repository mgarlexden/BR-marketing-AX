import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, XAxis, YAxis } from 'recharts'
import { useApp } from '@/lib/app-context'
import { classify, DAYS, DIR_LABEL, diagnose, mean, radarCurve, shortName, verdict } from '@/lib/data'
import { causeOf, dirDecisions, launchesOf, learnKey, radarKey, type Cause, type LearnDecision, type RadarApproval } from '@/lib/derived'
import { ASSUME, betaStats, dataFor, expectedEffect } from '@/lib/launch'
import { RADAR } from '@/lib/trend-data'
import { shortDate } from '@/lib/trend'
import { pct } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { HowTo, Stat, TabTitle } from '@/components/page'
import { DirChip, Pill } from '@/components/status'
import { Day } from '@/components/figures'
import { EvidenceBadge } from '@/components/evidence'
import { FitLine, josa, ro } from '@/components/fit-line'
import { cn } from '@/lib/utils'

const { meta, items } = RADAR
const H = meta.horizon
const past = items.filter((i) => i.actual !== null)
const hit = past.filter((i) => (i.prob >= 0.5) === i.actual).length
const pp = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%p` }
const FR = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const ROW = 'md:grid-cols-[minmax(11rem,1.2fr)_minmax(9rem,1fr)_minmax(10rem,1fr)_7rem_5.5rem]'
/** 펼친 행이 끝나는 곳에 선을 그어 아래 행과 구분한다 (매장 반응 탭과 같은 모양) */
const ROW_LI = (on: boolean) => cn('rounded-2xl', on && 'mb-3 border-b-2 border-border bg-card pb-1')
const ROW_BTN = (on: boolean) => cn('grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors active:translate-y-px', FR, on ? 'picked' : 'border-transparent bg-muted/70 hover:bg-accent/50')

/** 판매 = 방문 × 구매 전환 × 재고. 어디서 어긋났는지에 따라 학습에 쓰는 방식이 다르다 */
export const CAUSE: Record<Cause, { label: string; hint: string; use: string }> = {
  visit: { label: '방문 부족', hint: '트렌드를 잘못 봤거나 노출이 부족했다', use: '레이더 예측 보정에 반영' },
  conv: { label: '구매 전환 낮음', hint: '방문은 왔지만 사지 않았다. 맛이나 진열 문제', use: '맛은 학습에 반영하고, 진열 문제는 운영 이슈로 분리' },
  event: { label: '품절·행사', hint: '재고 부족이나 매장 행사 같은 운영 이벤트', use: '학습에서 제외' },
}
export const USE: Record<LearnDecision['use'], string> = { use: '학습에 반영', exclude: '학습에서 제외', hold: '보류' }
/** 요약 문장에서 원인을 부르는 말 */
const CAUSE_TEXT: Record<Cause, string> = { visit: '방문 부족', conv: '구매 전환 낮음', event: '품절·행사' }
/** 유형마다 반응이 어떻게 생겼는지 */
const SHAPE_DESC: Record<string, string> = { 단발형: '짧게 확 떴다가 금방 식는 모양', 완만형: '천천히 올라 오래 가는 모양', 반복형: '식었다가 다시 오르는 모양' }
const radarCfg = { orig: { label: '레이더 예상', color: 'var(--muted-foreground)' }, actual: { label: '매장 실제', color: 'var(--primary)' } } satisfies ChartConfig

/** 상세 안의 단계 패널 (매장 반응 탭의 판정 기록 패널과 같은 모양) */
function StepPanel({ step, title, desc, children }: { step: number; title: string; desc: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-6">
      <div className="mb-5 border-b border-border pb-4">
        <p className="text-xs font-bold text-primary">{step}단계</p>
        <h3 className="mt-0.5 text-xl font-extrabold tracking-tight">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      {children}
    </section>
  )
}

/** 고른 맛 하나의 원인 추정. 판매 = 방문 × 구매 전환 × 재고라서, 대표 매장 15곳 기준으로 기대 방문 범위와 어긋났거나 유형이 다르면 원인을 가린다.
 *  품절·행사가 2곳 이상이면 운영 이벤트, 구매 점검이 3곳 이상이면 구매 전환 낮음, 그 외는 방문 부족으로 본다 */
function useLearnInfo() {
  const { data: d, day: D, scn } = useApp()
  return useMemo(() => {
    const cls = classify(d, D)
    const isFlavor = scn.launch === '새로운 맛'
    const pendingType = isFlavor && cls.type === '판정 보류'
    const mismatch = isFlavor && !pendingType && cls.type !== scn.radarShape
    const live = d.stores.filter((s) => s.pilot)
    const flags = diagnose(d, D).rows.filter((r) => r.zone === 'flag')
    const outs = live.filter((s) => s.series[D].out)
    const events = live.filter((s) => s.event && s.evStart !== undefined && s.evStart <= D && s.evStart + 2 >= D - 2)
    const exp = expectedEffect(scn.radarShape, live.map((s) => s.id), ASSUME.price, ASSUME.cannibal)
    const act = mean(d.netAgg.slice(1, D + 1))
    const range: '범위 아래' | '범위 위' | '범위 안' = act < exp.visitLo ? '범위 아래' : act > exp.visitHi ? '범위 위' : '범위 안'
    /** 판매가 예상과 다른가: 유형이 다르거나 방문이 기대 범위 밖 */
    const off = mismatch || range !== '범위 안'
    const guess: Cause = outs.length >= 2 || events.length >= 2 ? 'event' : flags.length >= 3 ? 'conv' : 'visit'
    return { cls, isFlavor, pendingType, mismatch, off, flags, outs, events, exp, act, range, guess }
  }, [d, D, scn])
}

/** 요약 문장. 원인에 해당하는 말은 자주색 */
function Headline() {
  const { scn } = useApp()
  const { isFlavor, pendingType, mismatch, off, range, guess } = useLearnInfo()
  let text: string, node: React.ReactNode
  if (isFlavor && pendingType && range === '범위 안') { text = '아직 실제 유형을 판정하기 일러요, 며칠 더 지켜봐요'; node = text }
  else if (!off) { text = isFlavor ? '예상과 같은 흐름이에요, 맞힌 사례로 학습에 반영해도 돼요' : `${josa(scn.launch, '은', '는')} 기대 방문 범위 안이라 원인을 가릴 게 없어요`; node = text }
  else {
    const lead = `${mismatch ? '유형이 예상과 달라요' : `방문이 기대 ${range === '범위 아래' ? '아래' : '위'}예요`}, 원인은 `
    const what = CAUSE_TEXT[guess]
    text = `${lead}${ro(what)} 보여요`
    node = <>{lead}<span className="text-primary">{what}</span>{ro(what).slice(what.length)} 보여요</>
  }
  return <h3 className="break-keep font-extrabold leading-[1.25] tracking-tight"><FitLine max={26} min={17} text={text}>{node}</FitLine></h3>
}

/** 1단계 레이더 오답 보정: 레이더가 예상한 유형이 틀렸으면 실제 유형을 정답으로 다시 넣는다 */
function FixStep() {
  const { data: d, day: D, appr, setAppr } = useApp()
  const { cls, isFlavor, mismatch } = useLearnInfo()
  const orig = radarCurve(d, false)
  const actual = d.agg.slice(0, D + 1)
  const rows = Array.from({ length: DAYS + 1 }, (_, i) => ({ day: i, orig: orig[i], actual: i <= D ? actual[i] : null }))
  const hi = Math.max(0.4, ...rows.flatMap((r) => [r.orig, r.actual ?? 0])), step = hi > 1.2 ? 0.5 : 0.2
  const saved = appr[radarKey(d.scn.id)] as RadarApproval | undefined
  const state = !isFlavor ? `${josa(d.scn.launch, '은', '는')} 유형 예측이 없어 보정할 게 없어요` : cls.type === '판정 보류' ? '아직 실제 유형을 판정하기 일러요' : mismatch ? `레이더는 ${ro(d.scn.radarShape)} 봤지만 실제는 ${josa(cls.type, '이에요', '예요')}` : '레이더가 유형을 맞혀서 보정할 게 없어요'
  return (
    <StepPanel step={1} title="레이더 오답 보정" desc="레이더가 예상한 유형이 실제 매장 반응과 다르면 레이더의 답이 틀린 거예요. 실제 유형을 정답으로 기록해서 레이더를 보정해요">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={cn('text-sm font-semibold', mismatch && 'text-primary')}>{state}</p>
        <span className="text-xs text-muted-foreground">예상 <b className="text-foreground">{d.scn.radarShape}</b> / 실제 <b className="text-foreground">{cls.type}</b></span>
      </div>
      <ChartContainer config={radarCfg} className="mt-3 aspect-auto h-52 w-full">
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
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5"><i className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" />레이더 예상 ({d.scn.radarShape})</li>
        <li className="flex items-center gap-1.5"><i className="h-1 w-4 rounded bg-primary" />매장 실제</li>
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">근거 {cls.days}일, 신뢰도 {cls.conf}{saved && <> · 기록됨: <b className="text-foreground">{saved.state === 'approved' ? `${ro(saved.shape ?? '')} 보정` : '보류'}</b></>}</span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!mismatch} onClick={() => setAppr(radarKey(d.scn.id), { kind: 'radar', state: 'deferred', day: D })}>보류</Button>
          <Button disabled={!mismatch || !cls.kind} onClick={() => setAppr(radarKey(d.scn.id), { kind: 'radar', state: 'approved', day: D, curve: cls.kind!, peakVal: cls.peakVal, shape: cls.type })}>{ro(cls.type)} 보정</Button>
        </div>
      </div>
    </StepPanel>
  )
}

/** 원인별로 무엇이 문제였는지 자세히. 대표 매장 기준 */
function CauseDetail({ cause }: { cause: Cause }) {
  const { data: d, day: D } = useApp()
  const { cls, flags, outs, events, exp, act, range, mismatch } = useLearnInfo()
  if (cause === 'conv') return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="font-bold">구매 점검 매장 <span className={cn(flags.length >= 3 && 'text-primary')}>{flags.length}곳</span> <span className="text-xs font-normal text-muted-foreground">3곳 이상이면 구매 전환 낮음으로 봐요</span></p>
      <p className="text-muted-foreground">방문은 평소보다 15% 넘게 늘었는데, 신제품 구매 전환이 전체 중앙값보다 25% 넘게 낮은 대표 매장이에요. 손님은 왔는데 사지 않았다는 뜻이라, 맛 자체이거나 진열 위치, 가격표, 시식 같은 매장 운영 문제예요. 맛 문제는 학습에 반영하고, 진열·가격표는 운영 이슈로 따로 넘겨요</p>
      {flags.length > 0 && <ul className="divide-y divide-border border-y border-border">{flags.map((r) => <li key={r.st.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs"><span className="font-medium">{shortName(r.st)} <span className="text-muted-foreground">{r.st.type}</span></span><span className="num">방문 {pct(r.x)}, 전환 중앙값 대비 <b className="text-bad">{pct(r.y)}</b></span></li>)}</ul>}
    </div>
  )
  if (cause === 'event') return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <p className="font-bold">품절 의심 <span className={cn(outs.length > 0 && 'text-primary')}>{outs.length}곳</span> <span className="text-xs font-normal text-muted-foreground">대표 매장 기준, 2곳 이상이면 운영 이벤트로 봐요</span></p>
        <p className="mt-1 text-muted-foreground">재고가 바닥나 팔 게 없던 대표 매장이에요. 품절된 날은 판매가 끊기고 손님도 줄어서 반응이 일찍 꺾인 것처럼 보여요. 수요가 식은 게 아니라 재고가 막은 거라 레이더 탓으로 볼 수 없고, 재고는 물류 쪽으로 넘겨요</p>
        {outs.length > 0 && <p className="mt-1.5 text-xs font-medium">{outs.map((s) => shortName(s)).join(', ')} (<Day n={D} className="text-xs" /> 기준)</p>}
      </div>
      <div>
        <p className="font-bold">행사 매장 <span className={cn(events.length > 0 && 'text-primary')}>{events.length}곳</span> <span className="text-xs font-normal text-muted-foreground">최근 3일 안 행사, 2곳 이상이면 운영 이벤트로 봐요</span></p>
        <p className="mt-1 text-muted-foreground">신제품과 상관없는 행사로 손님이 반짝 몰렸다가 빠진 대표 매장이에요. 행사 3일 동안 방문이 크게 뛰었다가 끝나면 원래대로 돌아가서, 반응이 신제품 때문인 것처럼 보일 수 있어요</p>
        {events.length > 0 && <ul className="mt-2 divide-y divide-border border-y border-border">{events.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs"><span className="font-medium">{shortName(s)} <span className="text-muted-foreground">{s.type}</span></span><span className="num">행사 D+{s.evStart}~D+{(s.evStart ?? 0) + 2}</span></li>)}</ul>}
      </div>
    </div>
  )
  // 방문 부족: 매장 쪽 문제도 행사도 아닌데 방문이 기대와 다르거나 유형이 다르다
  return (
    <div className="text-sm">
      <p className="font-bold">방문이 기대와 달랐어요</p>
      <p className="mt-1 text-muted-foreground">기대 방문 증가는 <b className="text-foreground">+{Math.round(exp.visitLo * 100)}~{Math.round(exp.visitHi * 100)}%</b>인데 지금까지 평균 순효과는 <b className="text-primary">{pp(act)}</b>로 <b className="text-foreground">{range}</b>예요.{mismatch ? <> 레이더는 <b className="text-foreground">{d.scn.radarShape}</b>({SHAPE_DESC[d.scn.radarShape]})으로 예상했지만 실제 반응은 <Day n={cls.peakDay} className="text-sm" />에 정점 {pct(cls.peakVal)}을 찍고 지금 {pct(d.agg[D])}이라 <b className="text-primary">{cls.type}</b>({SHAPE_DESC[cls.type] ?? '판정 전'})이에요.</> : null} 구매 점검 대표 매장 {flags.length}곳(3곳 미만), 품절 의심 {outs.length}곳, 행사 {events.length}곳으로 매장 쪽 문제는 걸리지 않아서, 트렌드를 잘못 봤거나 노출이 부족했던 것으로 봐요</p>
    </div>
  )
}

/** 2단계 학습 판단 후 반영: 방문 부족은 레이더 보정에, 구매 전환 낮음은 맛 학습에 반영하고, 품절·행사는 학습에서 뺀다 */
function LearnStep() {
  const { day: D, scn, appr, setAppr } = useApp()
  const { isFlavor, pendingType, off, guess } = useLearnInfo()
  const saved = appr[learnKey(scn.id)] as LearnDecision | undefined
  const [cause, setCause] = useState<Cause>(saved ? causeOf(saved.cause) : guess)
  const [note, setNote] = useState(saved?.note ?? '')
  const ready = D >= 14
  // 품절·행사로 어긋난 사례는 수요 신호가 아니라서 학습에 쓰지 않는다
  const learnable = !off || cause !== 'event'
  const save = (use: LearnDecision['use']) => setAppr(learnKey(scn.id), { kind: 'learn', scn: scn.id, day: D, cause, use, note: note.trim() })
  return (
    <StepPanel step={2} title="학습 판단 후 반영" desc={<>판매는 방문, 구매 전환, 재고가 곱해진 값이라 어디서 어긋났는지 가려요. 방문 부족은 레이더 예측 보정에, 구매 전환 낮음은 맛 학습에 반영하고, 품절·행사는 학습에서 빼요. 이걸 가르지 않으면 레이더가 엉뚱한 걸 배워요. {ready ? `출시 후 D+${D}${D < 28 ? ' (잠정, D+28에 확정)' : ''}` : '출시 후 14일부터 판단해요'}</>}>
      {off ? (
        <>
          <p className="mb-2 text-xs font-medium text-muted-foreground">판매가 어긋난 원인</p>
          <div role="radiogroup" aria-label="원인" className="grid gap-2.5 sm:grid-cols-3">
            {(Object.keys(CAUSE) as Cause[]).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cause === c} onClick={() => setCause(c)}
                className={cn('rounded-2xl border p-3 text-left transition-colors active:translate-y-px', FR, cause === c ? 'picked' : 'border-border bg-card hover:bg-accent/50')}>
                <span className="block text-sm font-semibold">{CAUSE[c].label}{c === guess && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">추정</span>}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{CAUSE[c].hint}</span>
                <span className="mt-1 block text-xs font-medium text-primary">{CAUSE[c].use}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-4"><CauseDetail cause={cause} /></div>
        </>
      ) : <p className="text-sm text-muted-foreground">{isFlavor && pendingType ? '아직 실제 유형을 판정하기 일러 원인을 가리지 않아요' : '예상과 같은 흐름이라 원인을 가릴 필요가 없어요'}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="사유 (선택)" aria-label="사유" className="h-10 min-w-56 flex-1 rounded-full border border-input bg-background px-4 text-sm" />
        <div className="flex gap-2">
          <Button variant="outline" disabled={!ready} onClick={() => save('hold')}>보류</Button>
          <Button variant={learnable ? 'outline' : 'default'} disabled={!ready} onClick={() => save('exclude')}>학습에서 제외</Button>
          <Button disabled={!ready || !learnable} title={learnable ? undefined : `${CAUSE[cause].label}는 수요 신호가 아니라 학습에 반영할 수 없어요`} onClick={() => save('use')}>학습에 반영</Button>
        </div>
      </div>
      {!learnable && <p className="mt-2 text-xs text-muted-foreground">{josa(CAUSE[cause].label, '은', '는')} 수요 신호가 아니라 학습에 반영할 수 없어요</p>}
      {saved && <p className="mt-2 text-xs text-muted-foreground">기록됨: <b className="text-foreground">{CAUSE[causeOf(saved.cause)].label}, {USE[saved.use]}</b> (<Day n={saved.day} className="text-xs" />)</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">대표 매장을 본사가 골랐다는 점을 감안해 가중합니다. 사람이 승인한 뒤에만 반영하고, 이 화면은 반영 여부를 기록하며 모델 재학습은 별도로 실행합니다.</p>
    </StepPanel>
  )
}

function Detail() {
  const { scn } = useApp()
  return (
    <div className="border-t border-border px-1 pb-6 pt-5 sm:px-3">
      <Headline />
      <div className="mt-6 flex flex-col gap-5">
        <FixStep />
        <LearnStep key={scn.id} />
      </div>
    </div>
  )
}

/** 선출시한 맛마다 레이더 예상과 매장 실측을 나란히 */
function ProductList({ open, onOpen }: { open: string | null; onOpen: (id: string | null) => void }) {
  const { scenarios, appr } = useApp()
  const rows = useMemo(() => scenarios.filter((sc) => sc.launch !== '캠페인').map((sc) => {
    const dd = dataFor(sc), D = sc.today
    const cls = classify(dd, D)
    const rec = launchesOf(appr).find((l) => l.id === sc.id)
    const pil = dd.stores.filter((s) => s.pilot).map((s) => s.id)
    const e = rec?.exp ?? expectedEffect(sc.radarShape, pil, ASSUME.price, ASSUME.cannibal)
    const act = dd.netAgg.slice(1, D + 1).reduce((a, b) => a + b, 0) / Math.max(1, D)
    const shape = sc.launch !== '새로운 맛' ? '해당 없음' : cls.type === '판정 보류' ? '판단 보류' : cls.type === sc.radarShape ? '맞음' : '틀림'
    const rng = act < e.visitLo ? '범위 아래' : act > e.visitHi ? '범위 위' : '범위 안'
    const lastDir = dirDecisions(appr, sc.id, D)[0]
    return { sc, D, cls, rec, e, act, shape, rng, lastDir, learn: appr[learnKey(sc.id)] as LearnDecision | undefined, rec_: verdict(dd, D).dir }
  }), [scenarios, appr])
  const learned = rows.filter((r) => r.learn?.use === 'use')
  const nFlavor = learned.filter((r) => r.sc.launch === '새로운 맛').length
  const stage = nFlavor >= 10 ? '비교하고 갱신' : '기록만'
  return (
    <Card className="mb-6 border-border pb-5">
      <div className="mb-3">
        <h2 className="flex flex-wrap items-center gap-x-2 text-xl font-extrabold tracking-tight text-primary">선출시한 맛의 예상과 실측</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">학습에 반영한 사례: 맛 {nFlavor}건, 콜라보 {learned.length - nFlavor}건 (유형별로 따로 셉니다). 맛이 10건 미만이면 {stage}하고 모델은 바꾸지 않습니다</p>
      </div>
      <div className={cn('hidden gap-3 px-3 pb-2 text-[11px] text-muted-foreground md:grid', ROW)}>
        <span>맛</span><span title="결정 시점에 고정한 레이더 예상 유형과 지금 매장 반응이 보이는 유형">예상 유형 → 실제 유형</span><span title="결정 시점의 예상 방문 증가와 지금까지 평균 순효과">예상 방문율 → 실제 방문율</span><span className="text-center">판정</span><span className="text-center">학습</span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const on = open === r.sc.id
          return (
            <li key={r.sc.id} className={ROW_LI(on)}>
              <button type="button" aria-expanded={on} onClick={() => onOpen(on ? null : r.sc.id)} className={cn(ROW_BTN(on), ROW)}>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2"><span className="truncate text-base font-bold">{r.sc.label}</span>{r.sc.launch !== '새로운 맛' && <span className="whitespace-nowrap rounded-full bg-card px-2 py-0.5 text-[11px] font-bold">{r.sc.launch}</span>}{!r.rec && <span className="text-[11px] font-normal text-muted-foreground">시연</span>}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground"><Day n={r.D} className="text-[11px]" />{r.D < 28 && ' 잠정'}</span>
                </span>
                <span className="col-start-1 whitespace-nowrap text-xs md:col-start-auto">{r.shape === '해당 없음' ? <span className="text-muted-foreground">{josa(r.sc.launch, '은', '는')} 유형 예측 없음</span> : <>{r.sc.radarShape} → <b>{r.cls.type}</b> <span className={cn('ml-1', r.shape === '맞음' ? 'text-good' : r.shape === '틀림' ? 'text-bad' : 'text-muted-foreground')}>{r.shape}</span></>}</span>
                <span className="num hidden whitespace-nowrap text-xs md:block">+{Math.round(r.e.visitLo * 100)}~{Math.round(r.e.visitHi * 100)}% → <b>{pp(r.act)}</b> <span className={cn('ml-1', r.rng === '범위 아래' ? 'text-bad' : r.rng === '범위 위' ? 'text-good' : 'text-muted-foreground')}>{r.rng}</span></span>
                <span className="col-start-2 row-start-1 text-center md:col-start-auto md:row-start-auto">{r.lastDir ? <DirChip dir={r.lastDir.choice} /> : <span className="text-[11px] text-muted-foreground">미결정 ({DIR_LABEL[r.rec_]} 권고)</span>}</span>
                <span className="hidden text-center text-xs md:block">{r.learn ? <Pill tone={r.learn.use === 'use' ? 'primary' : 'neutral'}>{USE[r.learn.use]}</Pill> : <span className="text-muted-foreground">{r.D >= 14 ? '대기' : 'D+14부터'}</span>}</span>
              </button>
              {on && <Detail key={r.sc.id} />}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

/** 레이더 정답률 확인: 출시 여부와 관계없이 모든 후보에 13주 뒤 정답이 생긴다. 누르면 아래로 펼쳐진다 */
function SearchCheck() {
  const [open, setOpen] = useState(false)
  const k = hit, m = past.length - hit
  const b = betaStats(k, m)
  return (
    <Card className="mb-6 border-border pb-5">
      <div className="mb-3">
        <h2 className="flex flex-wrap items-center gap-x-2 text-xl font-extrabold tracking-tight text-primary">레이더 정답률 확인<EvidenceBadge kind="ok" /></h2>
        <p className="mt-0.5 text-xs text-muted-foreground">출시하지 않은 후보도 포함해 13주 뒤 실제 검색과 비교해요. 매장 데이터 없이 레이더만의 정답률을 확인해요</p>
      </div>
      <div className={ROW_LI(open)}>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={cn(ROW_BTN(open), 'md:grid-cols-[minmax(0,1fr)_auto_auto]')}>
          <span className="min-w-0">
            <span className="block text-base font-bold">13주 뒤 실제 검색 적중</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">결과가 나온 키워드 {past.length}개 · 생존 확률 50% 기준</span>
          </span>
          <span className="text-right"><span className="block text-[11px] text-muted-foreground">예측이 맞은 키워드</span><b className="num text-lg">{k} / {past.length}</b></span>
          <span className="hidden text-right md:block"><span className="block text-[11px] text-muted-foreground">맞힐 확률 추정</span><b className="num text-lg">{Math.round(b.mean * 100)}%</b></span>
        </button>
        {open && (
          <div className="border-t border-border px-1 pb-6 pt-5 sm:px-3">
            <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <div className="flex flex-col gap-3">
                <Stat label="예측이 맞은 키워드" value={`${k} / ${past.length}`} note={<span className="text-[0.8em]">생존 확률 50% 기준</span>} />
                <Stat label="맞힐 확률 추정" value={`${Math.round(b.mean * 100)}%`} />
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
          </div>
        )}
      </div>
    </Card>
  )
}

export default function Feedback() {
  const { scn, go } = useApp()
  const [open, setOpen] = useState<string | null>(null)
  const pick = (id: string | null) => { setOpen(id); if (id) go('feedback', { launch: id }) }
  return (
    <div>
      <TabTitle title="피드백" desc="원인을 분석하고, 레이더 오답은 정답으로 다시 반영해 정확도를 올려요" badge={<span title="검색 기준 비교는 실데이터입니다. 매장 쪽 비교는 합성 데이터라 절차를 시연하는 용도이고, 학습 반영은 사람이 승인한 뒤에만 합니다." className="cursor-help rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">근거 약함</span>} />
      <ProductList open={open && scn.id === open ? open : null} onOpen={pick} />
      <SearchCheck />
      <HowTo title="피드백 규칙">
        <p>두 종류의 정답을 따로 씁니다. 검색 기준은 출시 여부와 관계없이 모든 후보에 {H}주 뒤 정답이 생기고, 매장 기준은 선출시한 맛에만 생깁니다. 출시한 것만 학습하면 내가 고른 것만 배우는 편향이 생기므로 둘을 함께 봅니다.</p>
        <p className="mt-1">매장 사례는 출시 후 14일부터 판단하고 D+28에 확정합니다. 사례가 10건 미만이면 기록만 하고, 10건 이상이면 예상과 실측을 비교해 구간을 갱신하며, 30건 이상이면 재학습을 검토합니다. 품절, 행사 같은 이벤트가 있었던 사례는 학습에서 제외합니다.</p>
        <p className="mt-1">원인은 이 순서로 가립니다: 예상 유형과 실제 유형이 같으면 원인을 찾지 않고, 다르면 구매 점검 매장 3곳 이상이거나 품절이 있을 때 출시 실행 문제, 아니고 행사 매장이 있으면 외부 이벤트, 둘 다 아니면 레이더 오판입니다.</p>
        <p className="mt-1">결정 시점의 예측과 기대효과는 그때 고정한 값이며, 이후 모델이 바뀌어도 바꾸지 않습니다. 반응이 며칠 이어질지는 예측하지 않으므로 그 항목의 비교는 없습니다.</p>
      </HowTo>
    </div>
  )
}
