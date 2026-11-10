import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, Heart, Minus, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { SCENARIOS, TYPES } from '@/lib/data'
import { launchKey, skipKey, type LaunchDecision, type SkipDecision } from '@/lib/derived'
import { ASSUME, dataFor, expectedEffect, launchId, MAX_SLOTS, recommendedStores } from '@/lib/launch'
import { COLLABS, type CollabItem } from '@/lib/collab'
import { RADAR } from '@/lib/trend-data'
import { addWeeks, shortDate, type RadarAction, type RadarItem } from '@/lib/trend'
import { conceptBase, conceptSub, conceptWhy, H, radarItem, SALE, timingOf, TRENDS, type Concept, type Trend, type TrendStatus } from '@/lib/flavor-trends'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { HowTo, TabTitle } from '@/components/page'
import { Pill } from '@/components/status'
import { Sparkline } from '@/components/charts/mini'
import { EvidenceBadge } from '@/components/evidence'
import { ART_BG, Scoop } from '@/components/scoop'
import { cn } from '@/lib/utils'

const { meta, scores, items } = RADAR
const fresh = items.filter((i) => i.actual === null)
const flavors = fresh.filter((i) => (i.action === '후보' || i.action === '시즌') && !i.brand).sort((a, b) => b.prob - a.prob)
const collabs = COLLABS.filter((c) => c.action !== '제외')

const man = (x: number) => (x >= 10000 ? `${(x / 10000).toFixed(1)}억` : `${Math.round(x).toLocaleString()}만`)
const pc = (x: number) => `${Math.round(x * 100)}%`
const FR = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Pick = { id: string; kw: string; concept?: string; kind: '맛' | '콜라보'; type: string; prob: number; detected: string; line: string }
const flavorPick = (i: RadarItem, concept: string): Pick => ({ id: 'f:' + concept, kw: i.kw, concept, kind: '맛', type: i.type, prob: i.prob, detected: i.detected, line: `${H}주 뒤 생존 ${Math.round(i.prob * 100)}%, ${i.jump}배 급등, 전성기 대비 ${i.size}%` })
const collabPick = (c: CollabItem): Pick => ({ id: 'c:' + c.kw, kw: c.kw, kind: '콜라보', type: '콜라보', prob: 0.5, detected: c.since, line: `검색 ${c.jump.toFixed(1)}배 급등, 최근 4주 중 ${c.rising}주 상승, 전성기 대비 ${Math.round(c.size)}%` })

const ACTION: Record<RadarAction, { label: string; tone: 'good' | 'primary' | 'warn' | 'neutral' }> = {
  후보: { label: '이달의 맛 후보', tone: 'good' },
  시즌: { label: '시즌 재출시', tone: 'primary' },
  관찰: { label: '관찰', tone: 'warn' },
  단기: { label: '단기 대응', tone: 'neutral' },
}
const STATUS_STYLE: Record<TrendStatus, string> = {
  '뜨는 중': 'bg-flavor-sky text-sky-800 dark:text-sky-200',
  스테디: 'bg-flavor-sand text-flavor-brown-ink',
  정점: 'bg-flavor-blush text-primary',
  하락: 'bg-flavor-lilac text-violet-800 dark:text-violet-200',
}
const FILTERS: ('전체' | TrendStatus)[] = ['전체', '뜨는 중', '정점', '스테디', '하락']
const ROW = 'md:grid-cols-[2.25rem_2rem_minmax(11rem,14rem)_minmax(0,1fr)_2.5rem_3.75rem_6.5rem]'

const useLikes = () => {
  const [likes, setLikes] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('br-flavor-likes') || '[]') } catch { return [] } })
  const toggle = (id: string) => setLikes((p) => {
    const next = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    try { localStorage.setItem('br-flavor-likes', JSON.stringify(next)) } catch { /* 저장 못 해도 동작 */ }
    return next
  })
  return { likes, toggle }
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={cn('h-8 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors active:translate-y-px', FR, on ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/75 hover:bg-accent')}>{children}</button>
}
function StatusPill({ status }: { status: TrendStatus }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_STYLE[status])}>{status}</span>
}
function Delta({ v }: { v: number }) {
  return <span className={cn('num inline-flex h-6 items-center justify-center gap-0.5 whitespace-nowrap rounded-full px-2 text-xs font-semibold', v > 0 ? 'bg-flavor-sky text-sky-800 dark:text-sky-200' : 'bg-flavor-sand text-flavor-brown-ink')}>{v > 0 ? '▲' : v < 0 ? '▼' : ''}{Math.abs(v)}</span>
}
const Ball = ({ color, className }: { color: string; className?: string }) => <i aria-hidden className={cn('block size-7 rounded-full', className)} style={{ background: `radial-gradient(circle at 34% 28%, #ffffffb0, ${color} 58%, #00000030 130%)` }} />
const Heading = ({ children }: { children: React.ReactNode }) => <h3 className="text-sm font-bold tracking-tight">{children}</h3>

function downloadReport() {
  const lines = [`주간 맛 트렌드 리포트 (데이터 기준일 ${shortDate(meta.last)})`, '네이버 데이터랩 주간 검색량 기준. 트렌드 묶음과 조합은 팀 가설입니다.', '']
  TRENDS.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.name} | ${t.status} | 확산 지수 ${t.index} (지난주 대비 ${t.delta >= 0 ? '+' : ''}${t.delta}) | 출시 판단 ${t.timing.label}`)
    t.ingredients.forEach((it) => lines.push(`   - ${it.kw}: ${it.type}, ${H}주 생존 ${Math.round(it.prob * 100)}%, 전성기 대비 ${it.size}%, ${ACTION[it.action].label}`))
  })
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = `맛트렌드_주간리포트_${meta.last}.txt`; a.click()
  URL.revokeObjectURL(url)
}

function TrendList({ query, selected, onSelect }: { query: string; selected: string; onSelect: (id: string) => void }) {
  const { scenarios } = useApp()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('전체')
  const q = query.trim()
  const list = TRENDS.filter((t) => (filter === '전체' || t.status === filter) && (!q || t.name.includes(q) || t.ingredients.some((i) => i.kw.includes(q))))
  const fastest = TRENDS.reduce((a, b) => (b.delta > a.delta ? b : a))
  return (
      <Card className="mb-5 border-border pb-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-primary">이번 주 감지된 트렌드 <EvidenceBadge kind="ok" note="네이버 데이터랩 주간 검색량 실데이터" /></h2>
            <p className="mt-0.5 text-xs text-muted-foreground">우선순위 순 (출시 타이밍 → 상승세 → 확산 지수) · 눌러서 자세히 보기</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-2xl bg-flavor-sky px-3 py-1.5 text-center"><span className="block text-[10px] text-muted-foreground">가장 빠르게 오르는 맛</span><span className="block text-xs font-bold">{fastest.name} <span className="num">▲{fastest.delta}</span></span></span>
            {FILTERS.map((f) => <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>{f}</Chip>)}
          </div>
        </div>
        <div className={cn('hidden gap-3 px-3 pb-2 text-[11px] text-muted-foreground md:grid', ROW)}>
          <span className="col-span-3">순위 · 트렌드</span><span>확산 지수 (0~100)</span><span /><span className="text-center">지난주 대비</span><span className="text-center">12주 추이</span>
        </div>
        <ol className="flex flex-col gap-2.5">
          {list.map((t) => {
            const on = t.id === selected
            return (
              <li key={t.id}>
                <button type="button" aria-pressed={on} onClick={() => onSelect(t.id)}
                  className={cn('grid w-full grid-cols-[2rem_1.75rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 rounded-2xl border-2 px-3 py-3 text-left transition-colors active:translate-y-px', ROW, FR, on ? 'border-primary bg-accent/60' : 'border-transparent bg-muted/70 hover:bg-accent/50')}>
                  <span className={cn('num grid size-8 place-items-center rounded-full text-sm font-bold', on ? 'bg-primary text-primary-foreground' : 'bg-card')}>{TRENDS.indexOf(t) + 1}</span>
                  <Ball color={t.color} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{t.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground"><StatusPill status={t.status} />출시 판단 {t.timing.label}</span>
                  </span>
                  <span className="hidden h-2.5 overflow-hidden rounded-full bg-card md:block"><i className="block h-full rounded-full" style={{ width: `${t.index}%`, background: t.color }} /></span>
                  <span className="num text-right text-sm font-bold">{t.index}</span>
                  <span className="text-center"><Delta v={t.delta} /></span>
                  <span className="hidden text-center md:block"><Sparkline values={t.series.slice(-12)} w={96} h={28} /></span>
                </button>
              </li>
            )
          })}
        </ol>
        {list.length === 0 && <p className="rounded-2xl bg-muted/70 py-6 text-center text-sm text-muted-foreground">조건에 맞는 트렌드가 없습니다</p>}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 md:grid-cols-4">
          {[
            ['맛 후보', `${flavors.length}개`, `급등 ${fresh.length}개 중 이달의 맛 후보·시즌 재출시`],
            ['콜라보 후보', `${collabs.filter((c) => c.action === '후보').length}개`, `관찰 ${collabs.filter((c) => c.action === '관찰').length}개 별도`],
            ['선출시 슬롯', `${scenarios.length}/${MAX_SLOTS}`, '동시에 선출시할 수 있는 맛'],
            ['맛 예측 정확도', `${Math.round(scores.model_bal * 100)}%`, '콜라보에는 적용하지 않음'],
          ].map(([k, v, note]) => (
            <div key={k}><dt className="text-xs font-medium text-muted-foreground">{k}</dt><dd className="num text-lg font-bold tracking-tight">{v}</dd><dd className="text-[11px] leading-snug text-muted-foreground">{note}</dd></div>
          ))}
        </dl>
      </Card>
  )
}

function TimingBar({ peakIn }: { peakIn: number | null }) {
  const at = peakIn ?? H
  const axis = Math.max(30, Math.ceil((at + 4) / 10) * 10)
  const left = (w: number) => `${(w / axis) * 100}%`
  const ticks = Array.from({ length: axis / 10 + 1 }, (_, i) => i * 10)
  return (
    <div className="mt-4">
      <div className="relative h-3 rounded-full bg-primary/10">
        <i className="absolute inset-y-0 left-0 rounded-l-full bg-flavor-dev" style={{ width: left(H) }} />
        <i className="absolute inset-y-0 bg-flavor-sale" style={{ left: left(H), width: left(SALE) }} />
        <i className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-primary shadow" style={{ left: left(at) }} />
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-muted-foreground">
        {ticks.map((w, i) => <span key={w} className={cn('num absolute whitespace-nowrap', i === 0 ? '' : i === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2')} style={{ left: left(w) }}>{w === 0 ? '지금' : `${w}주`}</span>)}
      </div>
    </div>
  )
}

function Metric({ label, value, unit, title, strong }: { label: string; value: string; unit?: string; title: string; strong?: boolean }) {
  return (
    <div title={title} className="rounded-xl bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('num text-base tracking-tight', strong ? 'font-bold' : 'font-semibold')}>{value}{unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}</p>
    </div>
  )
}

/** 핵심 재료를 누르면 열리는 재료 상세. 기존 '맛 트렌드 후보' 표의 정보 */
function IngredientDetail({ it, onClose }: { it: RadarItem; onClose: () => void }) {
  const { appr } = useApp()
  const a = ACTION[it.action]
  const timing = timingOf(it)
  return (
    <section aria-label={`${it.kw} 재료 상세`} className="border-t border-border bg-accent/50 p-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-extrabold tracking-tight">{it.kw}</h3>
        <span className="text-xs text-muted-foreground">{it.type}</span>
        <Pill tone={a.tone}>{a.label}</Pill>
        {it.warn && <span title={`평소 20대가 주로 찾던 디저트에 30세 이상 검색이 갑자기 몰린 급등. 과거 이런 급등은 ${Math.round(scores.warn_rate * 100)}%만 ${H}주를 버텼습니다`}><Pill tone="warn" className="cursor-help">주의</Pill></span>}
        {appr[launchKey(it.kw)] ? <Pill tone="primary">선출시 중</Pill> : appr[skipKey(it.kw)] ? <Pill tone="neutral">출시 안 함</Pill> : null}
        <EvidenceBadge kind="ok" note="네이버 데이터랩 주간 검색량 실데이터" />
        <button type="button" onClick={onClose} aria-label="재료 상세 닫기" className={cn('ml-auto grid size-8 place-items-center rounded-full bg-card hover:bg-accent active:translate-y-px', FR)}><X className="size-4" /></button>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">{it.suggestion}</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-xl bg-card px-3 py-2">
          <p className="mb-1 text-[11px] text-muted-foreground">최근 1년 검색량 · 출시 판단 <b className="text-foreground">{timing.label}</b> · 감지 {shortDate(it.detected)}</p>
          <div className="[&>svg]:h-auto [&>svg]:w-full"><Sparkline values={it.series.slice(-52)} w={320} h={64} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="급등 폭" value={it.jump.toFixed(1)} unit="배" strong title="직전 4주 평균 대비 감지 주 검색량" />
          <Metric label="평소 대비" value={(1 / Math.max(0.1, it.base)).toFixed(1)} unit="배" title="지난 1년 평균 대비 감지 주 검색량" />
          <Metric label="꾸준한 주" value={it.steady > 104 ? '2년+' : String(it.steady)} unit={it.steady > 104 ? '' : '주'} title="지금 수준의 25% 이상으로 이어진 주 수" />
          <Metric label="전성기 대비" value={String(it.size)} unit="%" title="이 키워드가 가장 많이 검색됐던 주를 100%로 볼 때 지금 검색량" />
          <Metric label={`${H}주 생존`} value={String(Math.round(it.prob * 100))} unit="%" strong title={`감지 후 ${H}주 뒤 검색량이 감지 시점의 50% 이상일 확률`} />
          <Metric label="주 검색 수" value={it.weekly.toLocaleString()} unit="회" title="감지 주의 실제 검색 수 (검색광고 API로 환산)" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">후보는 {H}주 뒤 생존 확률 60% 이상이고 실제 검색이 주 {meta.minWeekly.toLocaleString()}회 이상인 키워드(반복형은 시즌 재출시)입니다. 해외에서 시작된 유행인지, 기존 스테디셀러와의 조합인지는 이 데이터로 알 수 없습니다. 급등 폭과 생존 확률의 계산은 <a href="#/radar" className="font-semibold text-primary underline underline-offset-4">트렌드 레이더</a>에 있습니다.</p>
    </section>
  )
}

function TrendDetail({ t }: { t: Trend }) {
  const [ing, setIng] = useState<string | null>(null)
  const { timing, lead } = t
  const seasonal = timing.peakIn !== null
  const open = ing ? t.ingredients.find((i) => i.kw === ing) : undefined
  return (
    <section aria-label={`${t.name} 상세`} className="mb-7 overflow-hidden rounded-3xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-flavor-brown px-5 py-4 text-white sm:px-6">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold tracking-tight">{t.name}<StatusPill status={t.status} /></h2>
          <p className="mt-0.5 text-xs text-white/85">{seasonal ? `다음 정점 약 ${timing.peakIn}주 후` : `${H}주 뒤 생존 ${Math.round(lead.prob * 100)}%`} ({lead.kw} 기준) · 확산 지수 {t.index}</p>
        </div>
        <span className="rounded-2xl bg-flavor-cream px-4 py-1.5 text-center text-flavor-brown-ink"><span className="block text-[11px]">출시 판단</span><span className="block text-lg font-extrabold leading-tight">{timing.label}</span></span>
      </header>
      <div className="grid md:grid-cols-2">
        <div className="bg-flavor-peach p-5 sm:p-6">
          <Heading>출시 타이밍</Heading>
          <p className="mt-1 text-xs text-muted-foreground">지금 기획 시작 → 리드타임 {H}주 → 이달의 맛 판매 {SALE}주</p>
          <p className="mt-4 text-base font-extrabold tracking-tight text-flavor-brown-ink">{timing.headline}</p>
          <TimingBar peakIn={timing.peakIn} />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5"><i className="h-2.5 w-3.5 rounded-sm bg-flavor-dev" />개발 {H}주</li>
            <li className="flex items-center gap-1.5"><i className="h-2.5 w-3.5 rounded-sm bg-flavor-sale" />판매 {SALE}주</li>
            <li className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-primary" />{seasonal ? `다음 정점 (${timing.peakIn}주 후)` : `${H}주 생존 판정 시점`}</li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed">{seasonal
            ? `기준 재료 ${lead.kw}: 매년 같은 철에 돌아오는 재료라 최근 1년의 정점 주를 다음 정점으로 잡았습니다. 지금 기획을 시작하면 ${H}주 뒤 출시합니다.`
            : `기준 재료 ${lead.kw}: 시즌을 타지 않아 정점 시점을 예측하지 않습니다. 대신 모델이 ${H}주 뒤에도 감지 시점의 절반 이상 수요가 남을 확률을 ${Math.round(lead.prob * 100)}%로 봅니다.`}</p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{seasonal
            ? <><b className="text-primary">지금</b> 판매 {SALE}주 안에 정점 &nbsp; <b className="text-sky-700 dark:text-sky-300">선점</b> 정점 전에 먼저 출시 &nbsp; <b className="text-bad">늦음</b> 출시 전에 정점이 지남</>
            : <><b className="text-primary">지금</b> {H}주 생존 60%+ &nbsp; <b className="text-flavor-brown-ink">관찰</b> 40~60% 또는 규모 작음 &nbsp; <b className="text-bad">늦음</b> 40% 미만</>}</p>
        </div>
        <div className="p-5 sm:p-6">
          <Heading>트렌드 설명</Heading>
          <p className="mt-1.5 text-sm leading-relaxed">{t.desc}</p>
          <div className="mt-5 flex items-baseline justify-between gap-2"><Heading>핵심 재료</Heading><span className="text-[11px] text-muted-foreground">눌러서 재료 상세 보기</span></div>
          <div className="mt-2 flex flex-wrap gap-2">
            {t.ingredients.map((i) => {
              const on = ing === i.kw
              return <button key={i.kw} type="button" aria-pressed={on} aria-expanded={on} onClick={() => setIng(on ? null : i.kw)} className={cn('inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors active:translate-y-px', FR, on ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground hover:bg-flavor-blush')}>{i.kw}<ChevronDown className={cn('size-3.5 transition-transform', on && 'rotate-180')} aria-hidden /></button>
            })}
          </div>
          <div className="mt-5 flex items-center gap-2"><Heading>재료별 검색 신호</Heading><span className="text-[11px] text-muted-foreground">네이버 검색, 최근 3년 최고 = 100</span></div>
          <ul className="mt-2 flex flex-col gap-2.5">
            {t.ingredients.map((i) => {
              const hi = Math.max(1, ...i.series), v = Math.round((i.series[i.series.length - 1] / hi) * 100)
              return (
                <li key={i.kw}>
                  <p className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">{i.kw}</span><span className="num font-semibold">{v}</span></p>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full bg-primary/80" style={{ width: `${v}%` }} /></div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      {open && <IngredientDetail it={open} onClose={() => setIng(null)} />}
    </section>
  )
}

function ConceptCard({ c, on, liked, onSelect, onLike, launched }: { c: Concept; on: boolean; liked: boolean; onSelect: () => void; onLike: () => void; launched: boolean }) {
  return (
    <article className={cn('relative rounded-3xl border-2 bg-card p-2 transition-colors', on ? 'border-primary' : 'border-border hover:border-primary/40')}>
      <div className={cn('relative grid h-44 place-items-center rounded-2xl sm:h-52', ART_BG[c.art.bg])}>
        <Scoop art={c.art} className="h-36 sm:h-44" />
        {launched && <span className="absolute left-3 top-3 rounded-full bg-card px-2.5 py-1 text-[11px] font-bold text-primary">선출시 중</span>}
        <button type="button" aria-pressed={liked} aria-label={`${c.name} 찜하기`} onClick={onLike} className={cn('absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-card text-primary active:translate-y-px', FR)}><Heart className={cn('size-4', liked && 'fill-current')} /></button>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 pb-2 pt-3">
        <div className="min-w-0">
          <h3><button type="button" aria-pressed={on} onClick={onSelect} className={cn('text-left text-sm font-extrabold text-primary after:absolute after:inset-0 after:rounded-3xl', FR)}>{c.name}</button></h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{conceptSub(c)}</p>
        </div>
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><ArrowRight className="size-4" /></span>
      </div>
    </article>
  )
}

function CollabTable({ pick, onPick }: { pick: string; onPick: (kw: string) => void }) {
  const { appr } = useApp()
  const tag = (kw: string) => (appr[launchKey(kw)] ? <Pill tone="primary">선출시 중</Pill> : appr[skipKey(kw)] ? <Pill tone="neutral">출시 안 함</Pill> : null)
  return (
    <Card className="mb-4">
      <div className="mb-3 rounded-2xl bg-muted/70 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <EvidenceBadge kind="sim" note="실제 IP 검색량을 연결하기 전의 시연값" className="mr-1.5" />지금 이 표의 곡선은 <b className="text-foreground">가상 시연값</b>입니다. 캐릭터 이름의 네이버 검색량을 맛 키워드와 같은 형식으로 넣으면 아래 계산은 그대로 실제 값이 됩니다. 인스타그램 같은 SNS 수치는 공개 API로 받을 수 없어 검색량으로 대신 봅니다. 맛과 달리 생존 예측 모델이 없어 급등 근거만 보여 줍니다.
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
            const on = pick === c.kw
            return (
              <TR key={c.kw} onClick={() => onPick(c.kw)} aria-selected={on} className={cn('cursor-pointer hover:bg-muted/50', on && 'bg-muted/70')}>
                <TD className="whitespace-nowrap font-medium">{c.kw} {tag(c.kw)}</TD>
                <TD><Sparkline values={c.series} w={120} h={24} /></TD>
                <TD className="num whitespace-nowrap font-semibold">{c.jump.toFixed(1)}<span className="text-xs font-normal text-muted-foreground">배</span></TD>
                <TD className="num whitespace-nowrap">{c.rising}/4</TD>
                <TD className="num whitespace-nowrap">{c.vsYear.toFixed(1)}<span className="text-xs font-normal text-muted-foreground">배</span></TD>
                <TD className="num whitespace-nowrap">{Math.round(c.size)}<span className="text-xs font-normal text-muted-foreground">%</span></TD>
                <TD className="whitespace-nowrap"><Pill tone={c.action === '후보' ? 'good' : 'warn'}>{c.action === '후보' ? '콜라보 후보' : '관찰'}</Pill><span className="ml-1.5 text-xs text-muted-foreground">{c.reason}</span></TD>
              </TR>
            )
          })}
        </TBody>
      </Table>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">후보 기준은 직전 3개월보다 1.5배 이상 오르고 전성기 대비 20% 이상입니다. 콜라보는 계약 기간과 일정이 정해져 있어 이 표는 "지금 관심이 오르는 IP"까지만 말하고, 협상 가능 여부와 비용은 알 수 없습니다.</p>
    </Card>
  )
}

function Accordion({ title, tone, open, children }: { title: string; tone: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group">
      <summary className={cn('flex h-12 cursor-pointer list-none items-center justify-between rounded-2xl px-4 text-sm font-bold [&::-webkit-details-marker]:hidden', FR, tone)}>
        <span className="flex items-center gap-2">{title}<EvidenceBadge kind="assume" note="팀 가설. 실제 배합 검증 전" /></span>
        <span aria-hidden className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="size-3.5 group-open:hidden" /><Minus className="hidden size-3.5 group-open:block" /></span>
      </summary>
      <div className="px-1 pt-2 text-xs leading-relaxed">{children}</div>
    </details>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-0.5 text-sm"><dt className="font-bold">{k}</dt><dd>{children}</dd></div>
}

/** 고른 조합(또는 콜라보)의 상세. 맨 아래가 기존 '출시 결정' */
function Decision({ cur, liked, onLike, children, verdict, eyebrow, tag, title, sub }: { cur: Pick; liked: boolean; onLike: () => void; children: React.ReactNode; verdict: string; eyebrow: string; tag: string; title: string; sub: string }) {
  const { appr, setAppr, go, scenarios } = useApp()
  const stores = useMemo(() => dataFor(SCENARIOS.a).stores, [])
  const [sel, setSel] = useState<string[]>(recommendedStores)
  const [price, setPrice] = useState(ASSUME.price)
  const [cannibal, setCannibal] = useState(Math.round(ASSUME.cannibal * 100))
  const ex = useMemo(() => expectedEffect(cur.type, sel, price, cannibal / 100), [cur, sel, price, cannibal])
  const typeOf = (id: string) => stores.find((s) => s.id === id)?.type
  const covered = new Set(sel.map(typeOf))
  const missing = TYPES.filter((t) => !covered.has(t))
  const full = scenarios.length >= MAX_SLOTS
  const launched = appr[launchKey(cur.kw)] as LaunchDecision | undefined
  const skipped = appr[skipKey(cur.kw)] as SkipDecision | undefined
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  /** 상권이 가장 적게 들어간 곳부터 채워 상권이 고르게 유지되게 한다 */
  const addStore = () => {
    const count = (t: string) => sel.filter((id) => typeOf(id) === t).length
    const next = stores.filter((s) => !sel.includes(s.id)).sort((a, b) => count(a.type) - count(b.type))[0]
    if (next) setSel([...sel, next.id])
  }
  const sale = cur.kind === '콜라보' ? '팬 방문 중심의 4주 콜라보를 가정합니다' : `지금 개발을 시작하면 출시 예정일은 ${shortDate(addWeeks(meta.last, H))} 무렵입니다`
  const stepBtn = cn('grid size-8 place-items-center rounded-full bg-primary text-primary-foreground active:translate-y-px disabled:opacity-40', FR)

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-accent px-2.5 py-1 font-bold text-accent-foreground">{tag}</span>{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-primary">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        </div>
        <p className="text-right"><span className="block text-[11px] text-muted-foreground">출시 판단</span><span className="block text-xl font-extrabold">{verdict}</span></p>
      </div>
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/70 px-4 py-2.5 text-xs">
        <b>{cur.kw}</b><span className="text-muted-foreground">{cur.line}</span><span className="basis-full text-muted-foreground">{sale}</span>
      </div>

      <div className="mt-auto">
        {launched ? (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs font-medium text-muted-foreground">기대 방문 증가 (대조 대비 4주 평균)</p><p className="num mt-0.5 text-xl font-bold tracking-tighter">+{pc(launched.exp.visitLo)}~{pc(launched.exp.visitHi)}</p><p className="text-xs text-muted-foreground">가정 범위</p></div>
              <div><p className="text-xs font-medium text-muted-foreground">기대 매출 순증 (4주 합)</p><p className="num mt-0.5 text-xl font-bold tracking-tighter">{man(launched.exp.salesLo)}~{man(launched.exp.salesHi)}원</p><p className="text-xs text-muted-foreground">객단가 {launched.price.toLocaleString()}원, 잠식 {pc(launched.cannibal)} 가정</p></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm"><b>{launched.concept ?? launched.kw}</b> {launched.stores.length}곳 선출시 결정됨</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAppr(launchKey(cur.kw), null)}>결정 취소</Button>
                <Button size="sm" onClick={() => go('react', { launch: launched.id, open: 1 })}>매장 반응 보기</Button>
              </div>
            </div>
          </div>
        ) : skipped ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/70 px-4 py-3 text-sm">
            <span><b>{cur.kw}</b> 출시 안 함으로 기록했습니다.{cur.kind === '맛' && ` ${H}주 뒤 실제 검색 결과와 환류에서 비교합니다.`}</span>
            <Button variant="outline" size="sm" onClick={() => setAppr(skipKey(cur.kw), null)}>기록 취소</Button>
          </div>
        ) : (
          <>
            <details className="group mt-4 rounded-2xl border border-border">
              <summary className={cn('flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden', FR)}>
                <span>매장 고르기·기대효과</span>
                <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground"><span className="num">{sel.length ? `+${pc(ex.visitLo)}~${pc(ex.visitHi)} · ${man(ex.salesLo)}~${man(ex.salesHi)}원` : '-'}</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /></span>
              </summary>
              <div className="px-4 pb-4">
                <p className="mb-2 flex items-baseline justify-between text-xs font-medium text-muted-foreground"><span>선출시 매장 {sel.length}곳 (상권마다 1곳 추천에서 시작)</span><span>슬롯 {scenarios.length}/{MAX_SLOTS}</span></p>
                <div className="flex flex-col gap-2">
                  {TYPES.map((t) => (
                    <div key={t} className="flex flex-wrap items-center gap-1.5">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">{t}</span>
                      {stores.filter((s) => s.type === t).map((s) => {
                        const on = sel.includes(s.id)
                        return (
                          <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(s.id)} title={`${s.place.gu} ${s.place.dong} · 유동 ${Math.round(s.place.flow / 1000)}천명`}
                            className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors active:translate-y-px', FR, on ? 'border-primary bg-accent text-foreground' : 'border-border text-muted-foreground hover:bg-accent/50')}>
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
                      <p className="num text-xl font-bold tracking-tighter">{sel.length ? `+${pc(ex.visitLo)}~${pc(ex.visitHi)}` : '-'}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">매출 순증, 4주 합 <EvidenceBadge kind="ext" note="POS가 있어야 실측할 수 있고, 객단가와 잠식률은 가정" /></p>
                      <p className="num text-xl font-bold tracking-tighter">{sel.length ? `${man(ex.salesLo)}~${man(ex.salesHi)}원` : '-'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1.5">객단가 <input type="number" min={1000} step={500} value={price} onChange={(e) => setPrice(Math.max(1000, Number(e.target.value) || 0))} className="num h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-foreground" />원</label>
                    <label className="flex items-center gap-1.5" title="신제품을 사느라 기존 맛 매출이 줄어드는 비율">잠식률 <input type="number" min={0} max={90} step={5} value={cannibal} onChange={(e) => setCannibal(Math.min(90, Math.max(0, Number(e.target.value) || 0)))} className="num h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-foreground" />%</label>
                    <span>매출 순증 = 추가 방문 × 객단가 × (1 − 잠식률)</span>
                  </div>
                </div>
              </div>
            </details>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <div role="group" aria-label="선출시 매장 수" className="flex h-11 items-center gap-2 rounded-full bg-accent px-1.5">
                <button type="button" aria-label="매장 줄이기" disabled={sel.length <= 1} onClick={() => setSel(sel.slice(0, -1))} className={stepBtn}><Minus className="size-4" /></button>
                <span className="num min-w-14 text-center text-xs font-bold">{sel.length}개 매장</span>
                <button type="button" aria-label="매장 늘리기" disabled={sel.length >= stores.length} onClick={addStore} className={stepBtn}><Plus className="size-4" /></button>
              </div>
              <Button className="h-11" disabled={!sel.length || full}
                onClick={() => {
                  const id = launchId(cur.kw)
                  setAppr(launchKey(cur.kw), { kind: 'launch', kw: cur.kw, concept: cur.concept, id, type: cur.type, launch: cur.kind === '콜라보' ? '콜라보' : '새로운 맛', prob: cur.prob, detected: cur.detected, stores: sel, price, cannibal: cannibal / 100, exp: { visitLo: ex.visitLo, visitHi: ex.visitHi, salesLo: ex.salesLo, salesHi: ex.salesHi } })
                  go('react', { launch: id, from: 'launch', open: 1 })
                }}>시식 테스트 요청</Button>
              <button type="button" aria-pressed={liked} aria-label={`${title} 찜하기`} onClick={onLike} className={cn('grid size-11 place-items-center rounded-full bg-accent text-primary active:translate-y-px', FR)}><Heart className={cn('size-4', liked && 'fill-current')} /></button>
              <Button variant="ghost" className="ml-auto h-11 text-muted-foreground" onClick={() => setAppr(skipKey(cur.kw), { kind: 'skip', kw: cur.kw, prob: cur.prob, type: cur.type })}>출시 안 함</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{full ? <span className="text-bad">선출시 슬롯이 가득 찼습니다</span> : `요청하면 고른 매장에 선출시로 기록되고, ${H}주 뒤 매장 반응으로 이어집니다.`}</p>
          </>
        )}
      </div>
    </Card>
  )
}

export default function Decide() {
  const { appr } = useApp()
  const { likes, toggle: toggleLike } = useLikes()
  const [themeId, setThemeId] = useState(TRENDS[0].id)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'flavor' | 'collab'>('flavor')
  const [offset, setOffset] = useState(0)
  const [conceptId, setConceptId] = useState<string | null>(null)
  const [collabKw, setCollabKw] = useState(collabs[0]?.kw ?? '')
  const t = TRENDS.find((x) => x.id === themeId) ?? TRENDS[0]
  useEffect(() => { setOffset(0); setConceptId(null) }, [themeId])

  const shown = Array.from({ length: Math.min(3, t.concepts.length) }, (_, i) => t.concepts[(offset + i) % t.concepts.length])
  const concept = t.concepts.find((c) => c.id === conceptId) ?? shown[0]
  const leadItem = radarItem(concept.lead)
  const collab = collabs.find((c) => c.kw === collabKw) ?? collabs[0]
  const isCollab = tab === 'collab' && !!collab

  return (
    <div className="flavor-page">
      <TabTitle title="트렌드" desc="뜨는 맛을 찾고 출시를 결정해요">
        <label className="flex w-full items-center gap-2 border-b-2 border-primary/70 px-1 pb-1.5 sm:w-64">
          <span className="sr-only">맛, 재료 검색</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="맛·재료 검색" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <Search className="size-4 text-primary" aria-hidden />
        </label>
      </TabTitle>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-[1.7rem]">안녕하세요, 신제품 기획팀</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">이번 주 감지된 맛 트렌드를 누르면 출시 타이밍과 이달의 맛 후보가 나옵니다
            <span title={`맛 후보는 네이버 데이터랩 주간 검색량(${shortDate(meta.first)} ~ ${shortDate(meta.last)}) 실데이터입니다. 트렌드 묶음과 맛 조합은 팀 가설, 콜라보 곡선은 시연값, 기대효과는 가정입니다.`} className="cursor-help text-xs underline decoration-dotted underline-offset-4">근거 실데이터 + 가정</span>
          </p>
        </div>
        <Button className="h-11" onClick={downloadReport}>주간 리포트 받기</Button>
      </header>

      <TrendList query={query} selected={t.id} onSelect={setThemeId} />
      <TrendDetail key={t.id} t={t} />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-primary">{isCollab ? '콜라보로 풀어볼까요' : '이달의 맛으로 만들어볼까요'}{!isCollab && <EvidenceBadge kind="assume" note="재료와 기존 맛을 엮은 팀 가설. 판매 근거 없음" />}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{isCollab ? '최근 검색량이 급등한 캐릭터·IP. 행을 누르면 아래에서 결정합니다' : `${t.name} 재료 × 어울리는 조합 × 배라 기존 맛 자산`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip on={!isCollab} onClick={() => setTab('flavor')}>맛 조합</Chip>
          <Chip on={isCollab} onClick={() => setTab('collab')}>콜라보 후보</Chip>
          {!isCollab && <Button className="h-10" onClick={() => { setOffset((o) => (o + 1) % t.concepts.length); setConceptId(null) }}><RefreshCw />다른 조합 추천</Button>}
        </div>
      </div>

      {isCollab ? <CollabTable pick={collab.kw} onPick={setCollabKw} /> : (
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          {shown.map((c) => <ConceptCard key={c.id} c={c} on={c.id === concept.id} liked={likes.includes(c.id)} onSelect={() => setConceptId(c.id)} onLike={() => toggleLike(c.id)} launched={(appr[launchKey(c.lead)] as LaunchDecision | undefined)?.concept === c.name} />)}
        </div>
      )}

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          {isCollab ? (
            <>
              <div className="flex flex-1 flex-col justify-center rounded-3xl bg-flavor-sky p-6">
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">최근 2년 검색량 <EvidenceBadge kind="sim" note="실제 IP 검색량을 연결하기 전의 시연값" /></p>
                <div className="[&>svg]:h-auto [&>svg]:w-full"><Sparkline values={collab.series} w={420} h={170} /></div>
              </div>
              <Accordion title="리스크" tone="bg-flavor-blush" open><p>콜라보는 계약 기간과 일정이 정해져 있습니다. 협상 가능 여부와 비용은 이 데이터로 알 수 없습니다.</p></Accordion>
              <Accordion title="출시 체크포인트" tone="bg-flavor-sand"><ul className="flex list-disc flex-col gap-1 pl-4"><li>실제 IP 검색량 연결</li><li>권리사 협상과 계약 기간</li><li>팬 방문 중심의 4주 운영 가정 검증</li></ul></Accordion>
            </>
          ) : (
            <>
              <div className={cn('flex flex-1 flex-wrap items-center justify-center gap-4 rounded-3xl p-5 sm:flex-nowrap sm:justify-between', ART_BG[concept.art.bg])}>
                <ul className="flex shrink-0 flex-col gap-3 text-xs font-medium">
                  {[[conceptBase(concept), concept.art.scoop], [concept.ribbon, concept.art.ribbon], [concept.topping, concept.art.bits]].map(([label, color]) => <li key={label} className="flex items-center gap-2"><i className="size-5 rounded-full border border-black/10" style={{ background: color }} />{label}</li>)}
                </ul>
                <Scoop art={concept.art} className="h-56 sm:h-64" />
                <span className="hidden w-12 shrink-0 xl:block" />
              </div>
              <Accordion title="리스크" tone="bg-flavor-blush" open><p>{t.risk}</p></Accordion>
              <Accordion title="출시 체크포인트" tone="bg-flavor-sand"><ul className="flex list-disc flex-col gap-1 pl-4">{t.checks.map((c) => <li key={c}>{c}</li>)}</ul></Accordion>
            </>
          )}
        </div>

        {isCollab ? (
          <Decision cur={collabPick(collab)} liked={likes.includes('c:' + collab.kw)} onLike={() => toggleLike('c:' + collab.kw)} tag={collab.action === '후보' ? '콜라보 후보' : '관찰'} eyebrow="최근 검색 급등 캐릭터·IP" title={collab.kw} sub={collab.reason} verdict={collab.action === '후보' ? '검토' : '관찰'}>
            <div className="mt-4">
              <Heading>추천 근거</Heading>
              <p className="mt-1 text-sm leading-relaxed">최근 4주 검색량이 직전 3개월보다 {collab.jump.toFixed(1)}배이고, 지난 1년 평균보다는 {collab.vsYear.toFixed(1)}배입니다. 생존 예측 모델이 없어 급등 근거만 봅니다.</p>
            </div>
          </Decision>
        ) : (
          <Decision cur={flavorPick(leadItem, concept.name)} liked={likes.includes(concept.id)} onLike={() => toggleLike(concept.id)} tag={concept.tag} eyebrow={`${t.name} 트렌드에서 추천`} title={concept.name} sub={conceptSub(concept)} verdict={timingOf(leadItem).label}>
            <div className="mt-4">
              <Heading>추천 근거</Heading>
              <p className="mt-1 text-sm leading-relaxed">{conceptWhy(concept)}</p>
            </div>
            <div className="mt-4">
              <Heading>구성</Heading>
              <dl className="mt-1">
                <Row k="베이스">{conceptBase(concept)}<span className="text-muted-foreground"> ({concept.isNew ? '신규 개발' : concept.blend ? '배합 조정' : '기존 배합 그대로'})</span></Row>
                <Row k="리본">{concept.ribbon}</Row>
                <Row k="토핑">{concept.topping}</Row>
                <Row k="연결되는 맛">{concept.linked}</Row>
              </dl>
            </div>
          </Decision>
        )}
      </div>

      <footer className="mt-5 flex flex-wrap items-end justify-between gap-2 rounded-3xl bg-flavor-brown px-6 py-6 text-white">
        <div><p className="text-2xl font-extrabold tracking-tight">Flavor Radar</p><p className="mt-1 text-xs text-white/85">감지 → 기획 → 출시 타이밍 → 출시 후 측정</p></div>
        <p className="text-xs text-white/85">데이터 기준일 {shortDate(meta.last)}</p>
      </footer>

      <HowTo>
        <p><b>트렌드 묶음:</b> 레이더가 감지한 급등 {fresh.length}개 중 아이스크림으로 풀기 좋은 재료 {TRENDS.reduce((n, x) => n + x.ingredients.length, 0)}개를 맛의 결이 비슷한 {TRENDS.length}개로 팀이 묶었습니다(가설). 상표 이름은 뺐습니다. 묶는 기준이 바뀌면 src/lib/flavor-trends.ts만 고치면 됩니다.</p>
        <p className="mt-1"><b>맛 조합 유형:</b> 베이스만 보고 정합니다. 베이스를 새로 개발하면 정면 승부형, 기존 맛을 바탕으로 배합을 조정하면 트렌드 결합형, 베이스는 그대로 두고 리본과 토핑만 더하면 빠른 대응형입니다. 조합은 팀 가설이고 판매 근거는 없습니다.</p>
        <p className="mt-1"><b>확산 지수:</b> 재료별 검색량을 화면의 최근 3년 최고 = 100으로 맞춘 뒤 묶음 평균을 낸 이번 주 값입니다. 지난주 대비는 같은 값의 지난주와의 차이입니다. SNS, 유튜브, 매장 메뉴 데이터는 없어 네이버 검색량만 씁니다.</p>
        <p className="mt-1"><b>상태:</b> 최근 4주 평균을 직전 12주 평균과 비교합니다. 1.15배 이상 뜨는 중, 1.05배 이상이면서 지수 70 이상이면 정점, 0.85배 이하 하락, 그 외 스테디.</p>
        <p className="mt-1"><b>출시 판단:</b> 묶음에서 {H}주 생존 확률이 가장 높은 후보 재료를 기준으로 합니다. 반복형은 최근 1년 정점 주가 내년에 돌아온다고 보고, 지금부터 {H}주 개발 후 {SALE}주 판매 구간과 비교합니다. 그 외 유형은 정점을 예측하지 않고 레이더 제안(후보 지금, 관찰, 단기 늦음)을 따릅니다.</p>
        <p className="mt-1"><b>맛 후보:</b> 이번 주 검색량이 5 이상이고 직전 12주 평균의 1.5배 이상이면서, 실제 검색 수로 환산해 평소 흔들림의 {meta.z}배 이상 오른 키워드를 급등으로 감지합니다. 급등 폭은 직전 4주 평균 대비, 평소 대비는 지난 1년 평균 대비입니다. {H}주 생존은 급등으로 늘어난 검색의 {Math.round(meta.keep * 100)}% 이상이 {H}주 뒤에도 남을 확률입니다. 모델 설명과 성능, 곡선 묶음은 트렌드 레이더에서 봅니다.</p>
        <p className="mt-1"><b>콜라보 후보:</b> 같은 방식으로 최근 4주 평균이 직전 12주 평균의 1.5배 이상이고 전성기 대비 20% 이상이면 후보입니다. 콜라보에 맞게 학습한 생존 모델은 없어 확률은 내지 않습니다.</p>
        <p className="mt-1"><b>기대효과:</b> 과거 매장 사례가 아직 없어 상권 유형별 가정 진폭과 반응 곡선으로 4주 평균을 계산하고, 가정 범위로 ±40% 폭을 둡니다. 모델이 아니고, 반응이 며칠 이어질지는 예측하지 않습니다. 매출은 POS가 있어야 실측되며 객단가와 잠식률은 입력값입니다.</p>
      </HowTo>
    </div>
  )
}
