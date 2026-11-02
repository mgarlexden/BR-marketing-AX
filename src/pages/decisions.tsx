import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, XAxis, YAxis } from 'recharts'
import { Check, ChevronRight, Undo2 } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { classify, DAYS, DIR_LABEL, DIR_MEANING, DIR_OPTIONS, diagnose, radarCurve, shortName, verdict, type Dir } from '@/lib/data'
import { dirDecisions, dirKey, feed, fixKey, fixRequests, pending, radarKey, type RadarApproval } from '@/lib/derived'
import { dLabel, num, pct } from '@/lib/format'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Segmented } from '@/components/ui/segmented'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, HowTo, PageHeader } from '@/components/page'
import { DirChip, Pill } from '@/components/status'
import { Day, Delta } from '@/components/figures'
import { cn } from '@/lib/utils'

const pp = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%p`
const radarCfg = { orig: { label: '레이더 예상', color: 'var(--muted-foreground)' }, fixed: { label: '보정 후', color: 'var(--chart-1)' }, actual: { label: '매장 실제', color: 'var(--primary)' } } satisfies ChartConfig

function DirCard() {
  const { data: d, day: D, setAppr, href } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const rec = v.dir as Exclude<Dir, 'wait'>
  const [choice, setChoice] = useState<Exclude<Dir, 'wait'>>(rec)
  const [note, setNote] = useState('')
  useEffect(() => { setChoice(rec); setNote('') }, [rec, D])
  const peakDay = d.agg.slice(0, D + 1).indexOf(v.peak)
  const evidence = [
    { k: '전체 반응', v: `${pct(v.a)} (정점 ${pct(v.peak)}, ${dLabel(Math.max(0, peakDay))})`, to: href('where') },
    { k: '최근 3일', v: <Delta v={v.slope} />, to: href('where', { view: 'curve' }) },
    { k: '구매 점검 매장', v: `${v.flagged}곳, 놓친 판매 ${num(v.lostUnits)}개/일`, to: href('why', { tab: 'dist' }) },
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

function FixCard() {
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
              <a href={href('why', { store: r.st.id })} className="shrink-0 text-xs font-semibold text-primary">동선</a>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex justify-end"><Button disabled={!sel.length} onClick={() => setAppr(fixKey(d.scn.id, D), { kind: 'fix', day: D, stores: sel })}>{sel.length}곳 보완 요청 기록</Button></div>
    </Card>
  )
}

function RadarCard() {
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

interface Row { day: number; kind: string; body: React.ReactNode; after: React.ReactNode; undo?: () => void }

function Log() {
  const { data: d, day: D, appr, setAppr } = useApp()
  const rows = useMemo(() => {
    const r: Row[] = []
    dirDecisions(appr, d.scn.id, D).forEach((x) => r.push({
      day: x.day, kind: '방향 판단',
      body: <span className="flex flex-wrap items-center gap-2"><DirChip dir={x.choice} />{x.choice === x.rec ? <span className="text-xs text-muted-foreground">권고와 같음</span> : <span className="text-xs text-muted-foreground">권고는 <b>{DIR_LABEL[x.rec]}</b></span>}{x.note && <span className="text-xs">{x.note}</span>}</span>,
      after: <>재검토 <Day n={x.day + 3} /> 또는 판정 변경 시</>, undo: () => setAppr(dirKey(d.scn.id, x.day), null),
    }))
    fixRequests(appr, d.scn.id, D).forEach((x) => {
      const gap = (day: number) => { const rr = diagnose(d, day).rows.filter((q) => x.stores.includes(q.st.id)); return rr.reduce((s, q) => s + q.y, 0) / (rr.length || 1) }
      r.push({ day: x.day, kind: '보완 요청', body: <span className="text-xs">{x.stores.map((id) => shortName(d.stores.find((s) => s.id === id)!)).join(', ')}</span>, after: <>재검토 <Day n={x.day + 3} />, 전환 격차 {pct(gap(x.day))}</>, undo: () => setAppr(fixKey(d.scn.id, x.day), null) })
    })
    const ra = appr[radarKey(d.scn.id)] as RadarApproval | undefined
    if (ra && ra.day <= D) r.push({ day: ra.day, kind: '레이더 보정', body: ra.state === 'approved' ? <span className="text-xs"><b>{ra.shape}</b>으로 보정</span> : <span className="text-xs text-muted-foreground">보류</span>, after: '', undo: () => setAppr(radarKey(d.scn.id), null) })
    feed(d, D, 40).filter((f) => f.text.startsWith('판정이')).forEach((f) => r.push({ day: f.day, kind: '판정 변경', body: <span className="text-xs text-muted-foreground">{f.text}</span>, after: '' }))
    return r.sort((a, b) => b.day - a.day)
  }, [appr, d, D, setAppr])
  if (!rows.length) return <EmptyState title="기록이 없습니다" />
  return (
    <Card className="p-0">
      <Table>
        <THead><TR><TH className="pl-5">시점</TH><TH>종류</TH><TH>내용</TH><TH>다음 재검토</TH><TH className="pr-5" /></TR></THead>
        <TBody>
          {rows.map((r, i) => (
            <TR key={i}>
              <TD className="whitespace-nowrap pl-5"><Day n={r.day} /></TD>
              <TD><Pill tone={r.kind === '판정 변경' ? 'neutral' : 'primary'}>{r.kind}</Pill></TD>
              <TD>{r.body}</TD>
              <TD className="whitespace-nowrap text-xs text-muted-foreground">{r.after}</TD>
              <TD className="pr-5 text-right">{r.undo && <button type="button" onClick={r.undo} className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"><Undo2 className="size-3" />되돌리기</button>}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  )
}

export default function Decisions() {
  const { data: d, day: D, appr, q, setQ } = useApp()
  const pend = pending(d, D, appr)
  const logN = dirDecisions(appr, d.scn.id, D).length + fixRequests(appr, d.scn.id, D).length + (appr[radarKey(d.scn.id)] ? 1 : 0)
  const tab = q.tab === 'log' ? 'log' : 'todo'
  const last = dirDecisions(appr, d.scn.id, D)[0]
  return (
    <div>
      <PageHeader title="의사결정 관리" basis={{ level: '약함', why: '승인은 집행이 아니라 결정 기록입니다. 총괄의 승인 구조는 아직 확인하지 못했습니다. 판정 규칙과 레이더 보정은 공개 근거가 없는 자체 가설입니다.' }}
        right={<Segmented label="탭" value={tab} onChange={(v) => setQ({ tab: v })} options={[{ value: 'todo', label: `대기 ${pend.count}` }, { value: 'log', label: `기록 ${logN}` }]} />} />
      {tab === 'log' ? <Log /> : (
        <div className="flex flex-col gap-4">
          {pend.count === 0 && (
            <EmptyState title={last ? `D+${last.day}에 ${DIR_LABEL[last.choice]}(으)로 결정했습니다. 3일 뒤 또는 판정이 바뀌면 다시 올라옵니다` : '대기 중인 결정이 없습니다'} action={{ label: '기록 보기', onClick: () => setQ({ tab: 'log' }) }} />
          )}
          {pend.dir && <DirCard />}
          {pend.fix && <FixCard />}
          {pend.radar && <RadarCard />}
          {pend.count > 0 && last && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3.5" />최근 결정: {dLabel(last.day)} {DIR_LABEL[last.choice]}</p>}
        </div>
      )}
      <HowTo title="판정 기준">
        <p>확대: 평소보다 25% 이상이고 최근 3일 오르는 중, 또는 정점의 80% 이상을 유지. 보완: 구매 점검 매장이 3곳 이상이고 놓친 판매가 기대 판매의 8% 이상. 정리: 출시 후 6일부터 반응이 12% 아래로 식었거나, 25% 아래에서 계속 내려감. 그 외는 유지이며, 출시 후 3일 전에는 판단하지 않습니다. 신뢰도는 근거 일수로 정하며 7일 미만 낮음, 14일 미만 중간입니다. 같은 판정은 3일 동안 다시 올라오지 않고, 판정이 바뀌면 바로 다시 올라옵니다.</p>
      </HowTo>
    </div>
  )
}
