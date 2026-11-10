import { useEffect, useMemo, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { classify, DIR_LABEL, diagnose, shortName, verdict } from '@/lib/data'
import { dirDecisions, dirKey, fixKey, fixRequests, launchKey, launchesOf, learnKey, radarKey, skipKey, skipsOf, type Cause, type LearnDecision, type RadarApproval } from '@/lib/derived'
import { ASSUME, betaStats, dataFor, expectedEffect } from '@/lib/launch'
import { RADAR } from '@/lib/trend-data'
import { shortDate } from '@/lib/trend'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, HowTo, PageHeader, Stat } from '@/components/page'
import { DirChip, Pill } from '@/components/status'
import { Day } from '@/components/figures'
import { EvidenceBadge } from '@/components/evidence'
import { cn } from '@/lib/utils'
import { RadarCard } from './decisions'

const { meta, items } = RADAR
const H = meta.horizon
const past = items.filter((i) => i.actual !== null)
const hit = past.filter((i) => (i.prob >= 0.5) === i.actual).length
const pp = (x: number) => { const n = Math.round(x * 100); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%p` }

const CAUSE: Record<Cause, { label: string; hint: string }> = {
  radar: { label: '레이더 오판', hint: '신호나 유형을 잘못 봤다' },
  ops: { label: '출시 실행 문제', hint: '위치, 품절, 시식 등 매장 쪽 문제' },
  event: { label: '외부 이벤트', hint: '행사, 날씨, 바이럴 등 일회성 요인' },
}
const USE: Record<LearnDecision['use'], string> = { use: '학습에 반영', exclude: '학습에서 제외', hold: '보류' }

/** 검색 기준 환류: 출시 여부와 관계없이 모든 후보에 정답이 생긴다 */
function SearchCheck() {
  const k = hit, m = past.length - hit
  const b = betaStats(k, m)
  return (
    <Card className="mb-4">
      <CardHeader title={`레이더가 맞았나: ${H}주 뒤 실제 검색`} description="출시하지 않은 후보도 포함합니다. 매장 데이터 없이 정답이 나오는 유일한 환류입니다" right={<EvidenceBadge kind="ok" />} />
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Stat label="예측이 맞은 키워드" value={`${k} / ${past.length}`} note="생존 확률 50% 기준" />
          <Stat label="맞힐 확률 추정" value={`${Math.round(b.mean * 100)}%`} note={`90% 구간 ${Math.round(b.lo * 100)}~${Math.round(b.hi * 100)}% (Beta(${1 + k}, ${1 + m}))`} />
          {past.every((i) => !i.actual) && <p className="text-xs leading-relaxed text-bad">실제로 버틴 키워드가 0건입니다. 못 버틸 것을 맞히는 능력만 확인되고, 버틸 것을 맞히는 능력은 이 표로 알 수 없습니다.</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">맞음과 틀림 수로 구간을 갱신합니다. 이 기간은 모델 학습에도 쓰여 참고용이고, 공정한 성능은 감지·출시 결정의 교차검증 점수를 봅니다.</p>
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

/** 선출시한 맛마다 레이더 예상과 매장 실측을 나란히 */
function Cases() {
  const { scenarios, launch, appr, go } = useApp()
  const rows = useMemo(() => scenarios.map((sc) => {
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
    <Card className="mb-4">
      <CardHeader title="선출시한 맛의 예상과 실측" description={`학습에 반영한 사례: 맛 ${nFlavor}건, 콜라보·캠페인 ${learned.length - nFlavor}건 (유형별로 따로 셉니다). 맛이 10건 미만이면 ${stage}하고 모델은 바꾸지 않습니다`} />
      <Table>
        <THead><TR><TH>맛</TH><TH>시점</TH><TH title="결정 시점에 고정한 레이더 예상 유형과 지금 매장 반응이 보이는 유형">유형 예상 → 실측</TH><TH title="결정 시점의 기대 방문 증가와 지금까지 평균 순효과">기대 방문 → 실측</TH><TH>판정</TH><TH>학습</TH></TR></THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.sc.id} onClick={() => go('feedback', { launch: r.sc.id })} aria-selected={r.sc.id === launch} className={cn('cursor-pointer hover:bg-muted/50', r.sc.id === launch && 'bg-muted/70')}>
              <TD className="font-medium">{r.sc.label}{r.sc.launch !== '새로운 맛' && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{r.sc.launch}</span>}{!r.rec && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">시연</span>}</TD>
              <TD className="whitespace-nowrap"><Day n={r.D} />{r.D < 28 && <span className="ml-1 text-[11px] text-muted-foreground">잠정</span>}</TD>
              <TD className="whitespace-nowrap text-xs">{r.shape === '해당 없음' ? <span className="text-muted-foreground">{r.sc.launch}은 유형 예측 없음</span> : <>{r.sc.radarShape} → <b>{r.cls.type}</b> <span className={cn('ml-1', r.shape === '맞음' ? 'text-good' : r.shape === '틀림' ? 'text-bad' : 'text-muted-foreground')}>{r.shape}</span></>}</TD>
              <TD className="num whitespace-nowrap text-xs">+{Math.round(r.e.visitLo * 100)}~{Math.round(r.e.visitHi * 100)}% → <b>{pp(r.act)}</b> <span className={cn('ml-1', r.rng === '범위 아래' ? 'text-bad' : r.rng === '범위 위' ? 'text-good' : 'text-muted-foreground')}>{r.rng}</span></TD>
              <TD>{r.lastDir ? <DirChip dir={r.lastDir.choice} /> : <span className="text-xs text-muted-foreground">미결정 ({DIR_LABEL[r.rec_]} 권고)</span>}</TD>
              <TD className="whitespace-nowrap text-xs">{r.learn ? <Pill tone={r.learn.use === 'use' ? 'primary' : 'neutral'}>{USE[r.learn.use]}</Pill> : <span className="text-muted-foreground">{r.D >= 14 ? '대기' : 'D+14부터'}</span>}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  )
}

/** 고른 맛 하나의 학습 판단: 왜 어긋났는지 분류하고, 학습에 쓸지 정한다 */
function LearnCard() {
  const { data: d, day: D, scn, appr, setAppr } = useApp()
  const cls = classify(d, D)
  const isFlavor = scn.launch === '새로운 맛'
  const mismatch = isFlavor && cls.type !== '판정 보류' && cls.type !== scn.radarShape
  const flagged = diagnose(d, D).rows.filter((r) => r.zone === 'flag').length
  const stockout = d.stores.filter((s) => s.pilot && s.series[D].out).length
  const saved = appr[learnKey(scn.id)] as LearnDecision | undefined
  const guess: Cause = !mismatch ? 'radar' : flagged >= 3 || stockout > 0 ? 'ops' : d.stores.some((s) => s.event) ? 'event' : 'radar'
  const [cause, setCause] = useState<Cause>(saved?.cause ?? guess)
  const [note, setNote] = useState(saved?.note ?? '')
  const ready = D >= 14
  const save = (use: LearnDecision['use']) => setAppr(learnKey(scn.id), { kind: 'learn', scn: scn.id, day: D, cause, use, note: note.trim() })
  return (
    <Card className="mb-4">
      <CardHeader title={`학습 판단: ${scn.label}`} description={ready ? `출시 후 D+${D}${D < 28 ? ' (잠정. D+28에 확정)' : ''}` : '출시 후 14일부터 판단합니다. 더 이른 결과는 노이즈가 큽니다'} />
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/70 p-3"><p className="text-xs text-muted-foreground">유형</p><p className="mt-0.5">{isFlavor ? <>예상 <b>{scn.radarShape}</b> → 실측 <b>{cls.type}</b></> : `${scn.launch}은 유형 예측이 없어 비교하지 않음`}</p></div>
        <div className="rounded-2xl bg-muted/70 p-3"><p className="text-xs text-muted-foreground">실행 점검</p><p className="mt-0.5">구매 점검 {flagged}곳, 품절 의심 {stockout}곳</p></div>
        <div className="rounded-2xl bg-muted/70 p-3"><p className="text-xs text-muted-foreground">결론</p><p className="mt-0.5">{!isFlavor ? '기대 방문 범위와 실측을 기준으로 판단합니다' : !mismatch ? '예상과 같은 흐름이라 학습에 반영해도 됩니다' : `예상과 다름. 원인이 ${CAUSE[guess].label}로 보입니다`}</p></div>
      </div>

      <p className="mb-2 text-xs font-medium text-muted-foreground">어긋난 원인 (이걸 가르지 않고 학습하면 레이더가 엉뚱한 걸 배웁니다)</p>
      <div role="radiogroup" aria-label="원인" className="grid gap-2.5 sm:grid-cols-3">
        {(Object.keys(CAUSE) as Cause[]).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cause === c} onClick={() => setCause(c)}
            className={cn('rounded-2xl border p-3 text-left transition-colors', cause === c ? 'border-primary bg-accent ring-1 ring-primary' : 'border-border bg-card hover:bg-accent/50')}>
            <p className="text-sm font-semibold">{CAUSE[c].label}{c === guess && mismatch && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">추정</span>}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{CAUSE[c].hint}</p>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="사유 (선택)" aria-label="사유" className="h-10 min-w-56 flex-1 rounded-full border border-input bg-background px-4 text-sm" />
        <div className="flex gap-2">
          <Button variant="outline" disabled={!ready} onClick={() => save('hold')}>보류</Button>
          <Button variant="outline" disabled={!ready} onClick={() => save('exclude')}>제외</Button>
          <Button disabled={!ready} onClick={() => save('use')}>학습에 반영</Button>
        </div>
      </div>
      {saved && <p className="mt-3 text-xs text-muted-foreground">기록됨: {CAUSE[saved.cause].label}, {USE[saved.use]}</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">반영할 때는 품절, 행사 등 매장 이벤트가 있던 사례는 제외하고, 선출시 매장을 본사가 골랐다는 점을 감안해 가중합니다. 사람이 승인한 뒤에만 반영합니다. 이 화면은 반영 여부를 기록하며, 모델 재학습은 별도로 실행합니다.</p>
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
        sort: x.day, when: <Day n={x.day} />, flavor: sc.label, kind: '판정',
        body: <span className="flex flex-wrap items-center gap-2"><DirChip dir={x.choice} />{x.choice === x.rec ? <span className="text-xs text-muted-foreground">권고와 같음</span> : <span className="text-xs text-muted-foreground">권고는 <b>{DIR_LABEL[x.rec]}</b></span>}{x.note && <span className="text-xs">{x.note}</span>}</span>,
        undo: () => setAppr(dirKey(sc.id, x.day), null),
      }))
      fixRequests(appr, sc.id, 99).forEach((x) => r.push({ sort: x.day, when: <Day n={x.day} />, flavor: sc.label, kind: '보완 요청', body: <span className="text-xs">{x.stores.map((id) => shortName(dd.stores.find((s) => s.id === id)!)).join(', ')}</span>, undo: () => setAppr(fixKey(sc.id, x.day), null) }))
      const ra = appr[radarKey(sc.id)] as RadarApproval | undefined
      if (ra) r.push({ sort: ra.day, when: <Day n={ra.day} />, flavor: sc.label, kind: '유형 보정', body: ra.state === 'approved' ? <span className="text-xs"><b>{ra.shape}</b>으로 보정</span> : <span className="text-xs text-muted-foreground">보류</span>, undo: () => setAppr(radarKey(sc.id), null) })
      const le = appr[learnKey(sc.id)] as LearnDecision | undefined
      if (le) r.push({ sort: le.day, when: <Day n={le.day} />, flavor: sc.label, kind: '학습 판단', body: <span className="text-xs">{CAUSE[le.cause].label}, <b>{USE[le.use]}</b>{le.note ? `. ${le.note}` : ''}</span>, undo: () => setAppr(learnKey(sc.id), null) })
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
  const { q } = useApp()
  useEffect(() => { if (q.at === 'log') document.getElementById('decision-log')?.scrollIntoView() }, [q.at])
  return (
    <div>
      <PageHeader title="환류" loop={[6]}
        sub="결정과 판정의 기록을 남기고, 레이더의 예측이 현실과 맞았는지 보고, 그 결과를 레이더 학습에 쓸지 정합니다."
        basis={{ level: '약함', why: '검색 기준 비교는 실데이터입니다. 매장 쪽 비교는 합성 데이터라 절차를 시연하는 용도이고, 학습 반영은 사람이 승인한 뒤에만 합니다.' }} />
      <SearchCheck />
      <Cases />
      <LearnCard />
      <div className="mb-4"><RadarCard /></div>
      <h2 id="decision-log" className="mb-2 scroll-mt-20 text-sm font-semibold">결정 로그</h2>
      <Log />
      <HowTo title="환류 규칙">
        <p>두 종류의 정답을 따로 씁니다. 검색 기준은 출시 여부와 관계없이 모든 후보에 {H}주 뒤 정답이 생기고, 매장 기준은 선출시한 맛에만 생깁니다. 출시한 것만 학습하면 내가 고른 것만 배우는 편향이 생기므로 둘을 함께 봅니다.</p>
        <p className="mt-1">매장 사례는 출시 후 14일부터 판단하고 D+28에 확정합니다. 사례가 10건 미만이면 기록만 하고, 10건 이상이면 예상과 실측을 비교해 구간을 갱신하며, 30건 이상이면 재학습을 검토합니다. 품절, 행사 같은 이벤트가 있었던 사례는 학습에서 제외합니다.</p>
        <p className="mt-1">결정 시점의 예측과 기대효과는 그때 고정한 값이며, 이후 모델이 바뀌어도 바꾸지 않습니다. 반응이 며칠 이어질지는 예측하지 않으므로 그 항목의 비교는 없습니다.</p>
      </HowTo>
    </div>
  )
}
