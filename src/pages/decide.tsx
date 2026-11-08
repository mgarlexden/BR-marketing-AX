import { useMemo, useRef, useState } from 'react'
import { useApp } from '@/lib/app-context'
import { SCENARIOS, TYPES } from '@/lib/data'
import { launchKey, skipKey, type LaunchDecision, type SkipDecision } from '@/lib/derived'
import { ASSUME, dataFor, expectedEffect, launchId, MAX_SLOTS, recommendedStores } from '@/lib/launch'
import { COLLABS, type CollabItem } from '@/lib/collab'
import { RADAR } from '@/lib/trend-data'
import { addWeeks, shortDate, type RadarItem } from '@/lib/trend'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { HowTo, PageHeader, Stat } from '@/components/page'
import { Pill } from '@/components/status'
import { Sparkline } from '@/components/charts/mini'
import { EvidenceBadge } from '@/components/evidence'
import { cn } from '@/lib/utils'

const { meta, scores, items } = RADAR
const H = meta.horizon
/** 감지 후 13주가 지나지 않은 것만 지금 결정할 대상. 지난 것은 환류에서 실제 결과와 비교한다 */
const fresh = items.filter((i) => i.actual === null)
const flavors = fresh.filter((i) => i.action === '후보' || i.action === '시즌').sort((a, b) => b.prob - a.prob)
const collabs = COLLABS.filter((c) => c.action !== '제외')

const man = (x: number) => (x >= 10000 ? `${(x / 10000).toFixed(1)}억` : `${Math.round(x).toLocaleString()}만`)
const pc = (x: number) => `${Math.round(x * 100)}%`

type Pick = { id: string; kw: string; kind: '맛' | '콜라보'; type: string; prob: number; detected: string; line: string }
const flavorPick = (i: RadarItem): Pick => ({ id: 'f:' + i.kw, kw: i.kw, kind: '맛', type: i.type, prob: i.prob, detected: i.detected, line: `${H}주 뒤 생존 ${Math.round(i.prob * 100)}%, ${i.jump}배 급등, 전성기 대비 ${i.size}%` })
const collabPick = (c: CollabItem): Pick => ({ id: 'c:' + c.kw, kw: c.kw, kind: '콜라보', type: '콜라보', prob: 0.5, detected: c.since, line: `검색 ${c.jump.toFixed(1)}배 급등, 최근 4주 중 ${c.rising}주 상승, 전성기 대비 ${Math.round(c.size)}%` })

function Section({ no, title, desc, right, children }: { no: string; title: string; desc: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader title={<span className="flex items-center gap-2"><span className="num grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{no}</span>{title}</span>} description={desc} right={right} />
      {children}
    </Card>
  )
}

function Num({ v, unit, strong }: { v: string; unit?: string; strong?: boolean }) {
  return <span className={cn('num whitespace-nowrap', strong && 'font-semibold')}>{v}{unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}</span>
}

function FlavorSection({ pick, onPick }: { pick: string; onPick: (p: Pick) => void }) {
  const { appr } = useApp()
  const tag = (kw: string) => (appr[launchKey(kw)] ? <Pill tone="primary">선출시 중</Pill> : appr[skipKey(kw)] ? <Pill tone="neutral">출시 안 함</Pill> : null)
  return (
    <Section no="1" title="맛 트렌드 후보" desc={`네이버 검색량이 최근 급등한 디저트·재료 중 ${H}주 뒤에도 남을 것으로 보이는 순서입니다`} right={<EvidenceBadge kind="ok" note="네이버 데이터랩 주간 검색량 실데이터" />}>
      <Table>
        <THead><TR>
          <TH>키워드</TH><TH>최근 1년</TH>
          <TH title="직전 4주 평균 대비 감지 주 검색량">급등 폭</TH>
          <TH title="지난 1년 평균 대비 감지 주 검색량">평소 대비</TH>
          <TH title="지금 수준의 25% 이상으로 이어진 주 수">꾸준한 주</TH>
          <TH title="이 키워드가 가장 많이 검색됐던 주를 100%로 볼 때 지금 검색량">전성기 대비</TH>
          <TH>{H}주 생존</TH><TH>제안</TH>
        </TR></THead>
        <TBody>
          {flavors.map((it) => {
            const on = pick === 'f:' + it.kw
            return (
              <TR key={it.kw} onClick={() => onPick(flavorPick(it))} aria-selected={on} className={cn('cursor-pointer hover:bg-muted/50', on && 'bg-muted/70')}>
                <TD className="whitespace-nowrap font-medium">{it.kw} <span className="ml-1 text-xs font-normal text-muted-foreground">{it.type}</span> {tag(it.kw)}</TD>
                <TD><Sparkline values={it.series.slice(-52)} w={88} h={24} tone="main" /></TD>
                <TD><Num v={it.jump.toFixed(1)} unit="배" strong /></TD>
                <TD><Num v={(1 / Math.max(0.1, it.base)).toFixed(1)} unit="배" /></TD>
                <TD><Num v={it.steady > 104 ? '2년+' : String(it.steady)} unit={it.steady > 104 ? '' : '주'} /></TD>
                <TD><Num v={String(it.size)} unit="%" /></TD>
                <TD><Num v={String(Math.round(it.prob * 100))} unit="%" strong /></TD>
                <TD><Pill tone={it.action === '시즌' ? 'primary' : 'good'}>{it.action === '시즌' ? '시즌 재출시' : '이달의 맛 후보'}</Pill></TD>
              </TR>
            )
          })}
        </TBody>
      </Table>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">후보는 {H}주 뒤 생존 확률 60% 이상이고 실제 검색이 주 {meta.minWeekly.toLocaleString()}회 이상인 키워드(반복형은 시즌 재출시, 경고 붙은 급등은 제외)입니다. 해외에서 시작된 유행인지, 기존 스테디셀러와의 조합인지는 이 데이터로 알 수 없습니다. 급등 폭과 생존 확률의 계산은 <a href="#/radar" className="font-semibold text-primary underline underline-offset-4">트렌드 레이더</a>에 있습니다.</p>
    </Section>
  )
}

function CollabSection({ pick, onPick }: { pick: string; onPick: (p: Pick) => void }) {
  const { appr } = useApp()
  const tag = (kw: string) => (appr[launchKey(kw)] ? <Pill tone="primary">선출시 중</Pill> : appr[skipKey(kw)] ? <Pill tone="neutral">출시 안 함</Pill> : null)
  return (
    <Section no="2" title="콜라보 후보" desc="최근 검색량이 급등한 캐릭터·IP입니다. 맛과 달리 생존 예측 모델이 없어 급등 근거만 보여 줍니다" right={<EvidenceBadge kind="sim" note="실제 IP 검색량을 연결하기 전의 시연값" />}>
      <div className="mb-3 rounded-2xl bg-muted/70 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        지금 이 표의 곡선은 <b className="text-foreground">가상 시연값</b>입니다. 캐릭터 이름의 네이버 검색량을 맛 키워드와 같은 형식으로 넣으면 아래 계산은 그대로 실제 값이 됩니다. 인스타그램 같은 SNS 수치는 공개 API로 받을 수 없어 검색량으로 대신 봅니다.
      </div>
      <Table>
        <THead><TR>
          <TH>캐릭터·IP</TH><TH>최근 2년</TH>
          <TH title="최근 4주 평균 ÷ 직전 12주 평균">급등 폭</TH>
          <TH title="최근 4주 중 직전 주보다 오른 주 수">상승 주</TH>
          <TH title="최근 4주 평균 ÷ 지난 1년 평균">1년 대비</TH>
          <TH title="2년 최고를 100으로 볼 때 지금 검색량">전성기 대비</TH>
          <TH>제안</TH>
        </TR></THead>
        <TBody>
          {collabs.map((c) => {
            const on = pick === 'c:' + c.kw
            return (
              <TR key={c.kw} onClick={() => onPick(collabPick(c))} aria-selected={on} className={cn('cursor-pointer hover:bg-muted/50', on && 'bg-muted/70')}>
                <TD className="whitespace-nowrap font-medium">{c.kw} {tag(c.kw)}</TD>
                <TD><Sparkline values={c.series} w={120} h={24} tone="main" /></TD>
                <TD><Num v={c.jump.toFixed(1)} unit="배" strong /></TD>
                <TD><Num v={`${c.rising}/4`} /></TD>
                <TD><Num v={c.vsYear.toFixed(1)} unit="배" /></TD>
                <TD><Num v={String(Math.round(c.size))} unit="%" /></TD>
                <TD className="whitespace-nowrap"><Pill tone={c.action === '후보' ? 'good' : 'warn'}>{c.action === '후보' ? '콜라보 후보' : '관찰'}</Pill><span className="ml-1.5 text-xs text-muted-foreground">{c.reason}</span></TD>
              </TR>
            )
          })}
        </TBody>
      </Table>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">후보 기준은 직전 3개월보다 1.5배 이상 오르고 전성기 대비 20% 이상입니다. 콜라보는 계약 기간과 일정이 정해져 있어 이 표는 "지금 관심이 오르는 IP"까지만 말하고, 협상 가능 여부와 비용은 알 수 없습니다.</p>
    </Section>
  )
}

function Decision({ pick, onPick }: { pick: string; onPick: (p: Pick | null) => void }) {
  const { appr, setAppr, go, scenarios } = useApp()
  const cur = useMemo(() => {
    if (pick.startsWith('f:')) { const i = flavors.find((x) => 'f:' + x.kw === pick); return i ? flavorPick(i) : null }
    const c = collabs.find((x) => 'c:' + x.kw === pick)
    return c ? collabPick(c) : null
  }, [pick])
  const stores = useMemo(() => dataFor(SCENARIOS.a).stores, [])
  const [sel, setSel] = useState<string[]>(recommendedStores)
  const [price, setPrice] = useState(ASSUME.price)
  const [cannibal, setCannibal] = useState(Math.round(ASSUME.cannibal * 100))
  const ex = useMemo(() => expectedEffect(cur?.type ?? '완만형', sel, price, cannibal / 100), [cur, sel, price, cannibal])
  const covered = new Set(sel.map((id) => stores.find((s) => s.id === id)?.type))
  const missing = TYPES.filter((t) => !covered.has(t))
  const full = scenarios.length >= MAX_SLOTS
  const launched = cur ? (appr[launchKey(cur.kw)] as LaunchDecision | undefined) : undefined
  const skipped = cur ? (appr[skipKey(cur.kw)] as SkipDecision | undefined) : undefined
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  const sale = (cur?.kind ?? '맛') === '콜라보' ? '팬 방문 중심의 4주 콜라보를 가정합니다' : `개발 ${H}주를 가정하면 출시 예정일은 ${cur ? shortDate(addWeeks(cur.detected, H)) : '-'} 무렵입니다`

  return (
    <Card className="mb-4 border-primary/40">
      <CardHeader title={<span className="flex items-center gap-2"><span className="num grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>출시 결정</span>} description="후보를 고르고, 어느 매장에서 먼저 출시할지 정합니다" />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">맛 후보 ({flavors.length})</span>
          <select value={pick.startsWith('f:') ? pick : ''} onChange={(e) => { const i = flavors.find((x) => 'f:' + x.kw === e.target.value); onPick(i ? flavorPick(i) : null) }}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">맛 후보 선택</option>
            {flavors.map((i) => <option key={i.kw} value={'f:' + i.kw}>{i.kw} ({i.type}, {H}주 생존 {Math.round(i.prob * 100)}%)</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">콜라보 후보 ({collabs.length})</span>
          <select value={pick.startsWith('c:') ? pick : ''} onChange={(e) => { const c = collabs.find((x) => 'c:' + x.kw === e.target.value); onPick(c ? collabPick(c) : null) }}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">콜라보 후보 선택</option>
            {collabs.map((c) => <option key={c.kw} value={'c:' + c.kw}>{c.kw} (검색 {c.jump.toFixed(1)}배 급등)</option>)}
          </select>
        </label>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">둘 중 하나만 선택됩니다. 위 표의 행을 눌러도 고를 수 있습니다.</p>

      {!cur ? <p className="mt-4 rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">위 표에서 후보를 누르거나 드롭다운에서 고르세요.</p> : launched ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="기대 방문 증가 (대조 대비 4주 평균)" value={`+${pc(launched.exp.visitLo)}~${pc(launched.exp.visitHi)}`} note="가정 범위" />
            <Stat label="기대 매출 순증 (4주 합)" value={`${man(launched.exp.salesLo)}~${man(launched.exp.salesHi)}원`} note={`객단가 ${launched.price.toLocaleString()}원, 잠식 ${pc(launched.cannibal)} 가정`} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm"><b>{cur.kw}</b> {launched.stores.length}곳 선출시 결정됨</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAppr(launchKey(cur.kw), null)}>결정 취소</Button>
              <Button size="sm" onClick={() => go('react', { launch: launched.id })}>매장 반응 보기</Button>
            </div>
          </div>
        </div>
      ) : skipped ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/70 px-4 py-3 text-sm">
          <span><b>{cur.kw}</b> 출시 안 함으로 기록했습니다. 맛 후보는 {H}주 뒤 실제 검색 결과와 환류에서 비교합니다.</span>
          <Button variant="outline" size="sm" onClick={() => setAppr(skipKey(cur.kw), null)}>기록 취소</Button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/70 px-4 py-3 text-sm">
            <Pill tone={cur.kind === '콜라보' ? 'primary' : 'good'}>{cur.kind === '콜라보' ? '콜라보' : '이달의 맛'}</Pill>
            <b>{cur.kw}</b><span className="text-muted-foreground">{cur.line}</span>
            <span className="ml-auto text-xs text-muted-foreground">{sale}</span>
          </div>

          <p className="mb-2 mt-4 flex items-baseline justify-between text-xs font-medium text-muted-foreground"><span>선출시 매장 {sel.length}곳 (상권마다 1곳 추천에서 시작)</span><span>슬롯 {scenarios.length}/{MAX_SLOTS}</span></p>
          <div className="flex flex-col gap-2">
            {TYPES.map((t) => (
              <div key={t} className="flex flex-wrap items-center gap-1.5">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">{t}</span>
                {stores.filter((s) => s.type === t).map((s) => {
                  const on = sel.includes(s.id)
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(s.id)} title={`${s.place.gu} ${s.place.dong} · 유동 ${Math.round(s.place.flow / 1000)}천명`}
                      className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'border-primary bg-accent text-foreground' : 'border-border text-muted-foreground hover:bg-accent/50')}>
                      {s.name.replace(/점$/, '')}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {missing.length > 0 && sel.length > 0 && <p className="mt-2 text-xs text-bad">{missing.join(', ')} 상권 매장이 없습니다. 결과를 전체로 일반화하기 어렵습니다.</p>}

          <div className="mt-4 rounded-2xl bg-muted/70 p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">기대효과 <span className="font-normal">(과거 사례 0건. 상권 유형별 가정 범위이고 예측 모델이 아님)</span></p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">대조 대비 방문 증가, 4주 평균 <EvidenceBadge kind="assume" /></p>
                <p className="num text-2xl font-bold tracking-tighter">{sel.length ? `+${pc(ex.visitLo)}~${pc(ex.visitHi)}` : '-'}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">매출 순증, 4주 합 <EvidenceBadge kind="ext" note="POS가 있어야 실측할 수 있고, 객단가와 잠식률은 가정" /></p>
                <p className="num text-2xl font-bold tracking-tighter">{sel.length ? `${man(ex.salesLo)}~${man(ex.salesHi)}원` : '-'}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5">객단가 <input type="number" min={1000} step={500} value={price} onChange={(e) => setPrice(Math.max(1000, Number(e.target.value) || 0))} className="num h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-foreground" />원</label>
              <label className="flex items-center gap-1.5" title="신제품을 사느라 기존 맛 매출이 줄어드는 비율">잠식률 <input type="number" min={0} max={90} step={5} value={cannibal} onChange={(e) => setCannibal(Math.min(90, Math.max(0, Number(e.target.value) || 0)))} className="num h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-foreground" />%</label>
              <span>매출 순증 = 추가 방문 × 객단가 × (1 − 잠식률)</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setAppr(skipKey(cur.kw), { kind: 'skip', kw: cur.kw, prob: cur.prob, type: cur.type })}>출시 안 함</Button>
            <div className="flex items-center gap-3">
              {full && <span className="text-xs text-bad">선출시 슬롯이 가득 찼습니다</span>}
              <Button disabled={!sel.length || full}
                onClick={() => {
                  const id = launchId(cur.kw)
                  setAppr(launchKey(cur.kw), { kind: 'launch', kw: cur.kw, id, type: cur.type, launch: cur.kind === '콜라보' ? '콜라보' : '새로운 맛', prob: cur.prob, detected: cur.detected, stores: sel, price, cannibal: cannibal / 100, exp: { visitLo: ex.visitLo, visitHi: ex.visitHi, salesLo: ex.salesLo, salesHi: ex.salesHi } })
                  go('react', { launch: id, from: 'launch' })
                }}>선출시 결정, {H}주 뒤 매장 반응 보기</Button>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

export default function Decide() {
  const { scenarios } = useApp()
  const [pick, setPick] = useState<Pick | null>(null)
  const decisionRef = useRef<HTMLDivElement>(null)
  const choose = (p: Pick | null) => { setPick(p); if (p) setTimeout(() => decisionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }
  return (
    <div>
      <PageHeader
        title="감지된 트렌드"
        loop={[1, 2]}
        basis={{ level: '실데이터 + 가정', why: `맛 후보는 네이버 데이터랩 주간 검색량(${shortDate(meta.first)} ~ ${shortDate(meta.last)}) 실데이터입니다. 콜라보 후보 곡선은 시연값이고, 기대효과는 가정입니다.` }}
        sub="뜨는 맛과 뜨는 캐릭터를 수치 근거와 함께 보고, 마지막에 무엇을 어느 매장에서 먼저 출시할지 결정합니다."
      />

      <Card className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="맛 후보" value={flavors.length} note={`급등 ${fresh.length}개 중 ${H}주 뒤 생존 유력`} />
        <Stat label="콜라보 후보" value={collabs.filter((c) => c.action === '후보').length} note={`관찰 ${collabs.filter((c) => c.action === '관찰').length}개 별도`} />
        <Stat label="선출시 슬롯" value={`${scenarios.length}/${MAX_SLOTS}`} note="동시에 선출시할 수 있는 맛" />
        <Stat label="맛 예측 정확도" value={`${Math.round(scores.model_bal * 100)}%`} note="콜라보에는 적용하지 않음" />
      </Card>

      <FlavorSection pick={pick?.id ?? ''} onPick={choose} />
      <CollabSection pick={pick?.id ?? ''} onPick={choose} />
      <div ref={decisionRef}><Decision pick={pick?.id ?? ''} onPick={choose} /></div>

      <HowTo>
        <p><b>맛 후보:</b> 이번 주 검색량이 5 이상이고 직전 12주 평균의 1.5배 이상인 키워드를 급등으로 감지합니다. 급등 폭은 직전 4주 평균 대비, 평소 대비는 지난 1년 평균 대비입니다. 랜덤 포레스트가 곡선 특징 8개로 {H}주 뒤 생존 확률을 냅니다. 모델 성능과 곡선 묶음은 트렌드 레이더에서 봅니다.</p>
        <p className="mt-1"><b>콜라보 후보:</b> 같은 방식으로 최근 4주 평균이 직전 12주 평균의 1.5배 이상이고 전성기 대비 20% 이상이면 후보입니다. 콜라보에 맞게 학습한 생존 모델은 없어 확률은 내지 않습니다.</p>
        <p className="mt-1"><b>기대효과:</b> 과거 매장 사례가 아직 없어 상권 유형별 가정 진폭과 반응 곡선으로 4주 평균을 계산하고, 가정 범위로 ±40% 폭을 둡니다. 모델이 아니고, 반응이 며칠 이어질지는 예측하지 않습니다. 매출은 POS가 있어야 실측되며 객단가와 잠식률은 입력값입니다.</p>
      </HowTo>
    </div>
  )
}
