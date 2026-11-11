import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Heart, Minus, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { SCENARIOS, TYPES } from '@/lib/data'
import { launchKey, skipKey, type LaunchDecision, type SkipDecision } from '@/lib/derived'
import { ASSUME, dataFor, expectedEffect, launchId, MAX_SLOTS, recommendedStores } from '@/lib/launch'
import type { CollabItem } from '@/lib/collab'
import { RADAR } from '@/lib/trend-data'
import { addWeeks, shortDate, type RadarItem } from '@/lib/trend'
import {
  COLLAB_DROPPED, COLLAB_TRENDS, conceptBase, conceptSets, conceptSub, conceptWhy, H, MAX_INGREDIENTS, MAX_REPEAT, radarItem, SALE, timingOf, TRENDS, weeklyNow, WEEKLY_MEDIAN,
  type AnyTrend, type CollabTrend, type Concept, type FlavorTrend, type TrendStatus,
} from '@/lib/flavor-trends'
import { BR_SOURCE, brLine, brRecord, MENU_NAMES, SINGLE_GAP, THIS_YEAR } from '@/lib/br-history'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { HowTo, TabTitle } from '@/components/page'
import { Pill } from '@/components/status'
import { Sparkline } from '@/components/charts/mini'
import { EvidenceBadge } from '@/components/evidence'
import { Scoop } from '@/components/scoop'
import { ACTION_LABEL, ActionTag, Chip } from '@/components/radar'
import { cn } from '@/lib/utils'

const { meta, scores } = RADAR

const man = (x: number) => (x >= 10000 ? `${(x / 10000).toFixed(1)}억` : `${Math.round(x).toLocaleString()}만`)
const pc = (x: number) => `${Math.round(x * 100)}%`
const FR = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Pick = { id: string; kw: string; concept?: string; kind: '맛' | '콜라보'; type: string; prob: number; detected: string; line: string }
const flavorPick = (i: RadarItem, concept: string): Pick => ({ id: 'f:' + concept, kw: i.kw, concept, kind: '맛', type: i.type, prob: i.prob, detected: i.detected, line: `${H}주 뒤 생존 ${Math.round(i.prob * 100)}%, ${i.jump}배 급등, 전성기 대비 ${i.size}%` })
const collabPick = (c: CollabItem): Pick => ({ id: 'c:' + c.kw, kw: c.kw, kind: '콜라보', type: '콜라보', prob: 0.5, detected: c.since, line: `검색 ${c.jump.toFixed(1)}배 급등, 최근 4주 중 ${c.rising}주 상승, 전성기 대비 ${Math.round(c.size)}%` })

const ROW = 'md:grid-cols-[2.25rem_2.5rem_minmax(11rem,15rem)_minmax(0,1fr)_2.5rem_7.5rem_6.5rem]'
const TRENDING: TrendStatus[] = ['뜨는 중', '정점', '스테디']
/** 트렌드 목록의 상태 칩 색 */
const STATUS_STYLE: Record<TrendStatus, string> = {
  '뜨는 중': 'bg-flavor-sky text-sky-800 dark:text-sky-200',
  스테디: 'bg-flavor-sand text-flavor-brown-ink',
  정점: 'bg-flavor-blush text-primary',
  하락: 'bg-flavor-lilac text-violet-800 dark:text-violet-200',
}
const STATUS_NOTE: Record<TrendStatus, string> = {
  '뜨는 중': '최근 4주 검색이 직전 3개월보다 15% 넘게 올랐어요',
  정점: '검색이 3년 중 최고에 가깝고 아직 오르고 있어요',
  스테디: '최근 4주 검색이 직전 3개월과 비슷하게 유지돼요',
  하락: '최근 4주 검색이 직전 3개월보다 15% 넘게 줄었어요',
}
function ListStatus({ status }: { status: TrendStatus }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_STYLE[status])}>{status}</span>
}
/** 지난주와 비교한 우선순위 변화 */
function RankDelta({ v }: { v: number }) {
  if (!v) return <span className="num inline-flex h-6 items-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">변동 없음</span>
  return <span className={cn('num inline-flex h-6 items-center gap-0.5 whitespace-nowrap rounded-full px-2 text-xs font-semibold', v > 0 ? 'bg-flavor-sky text-sky-800 dark:text-sky-200' : 'bg-flavor-sand text-flavor-brown-ink')}>{v > 0 ? `▲${v} 상승` : `▼${-v} 하락`}</span>
}
const Heading = ({ children }: { children: React.ReactNode }) => <h3 className="text-sm font-bold tracking-tight">{children}</h3>
/** 트렌드 상세의 큰 소제목 (다른 소제목의 1.5배) */
const BigHeading = ({ children }: { children: React.ReactNode }) => <h3 className="text-[21px] font-bold leading-tight tracking-tight">{children}</h3>
/** 조합 구성 항목별 글자 색 */
const PART: Record<'베이스' | '리본' | '토핑' | '기존 맛', string> = {
  베이스: 'text-amber-800 dark:text-amber-300', 리본: 'text-pink-700 dark:text-pink-300', 토핑: 'text-orange-600 dark:text-orange-300', '기존 맛': 'text-primary',
}

const useLikes = () => {
  const [likes, setLikes] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('br-flavor-likes') || '[]') } catch { return [] } })
  const toggle = (id: string) => setLikes((p) => {
    const next = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    try { localStorage.setItem('br-flavor-likes', JSON.stringify(next)) } catch { /* 저장 못 해도 동작 */ }
    return next
  })
  return { likes, toggle }
}

function downloadReport() {
  const lines = [`주간 맛 트렌드 리포트 (데이터 기준일 ${shortDate(meta.last)})`, '네이버 데이터랩 주간 검색량 기준. 트렌드 묶음과 조합은 팀 가설입니다. 배라에 이미 있는 재료는 뺐습니다.', '']
  TRENDS.forEach((t) => {
    lines.push(`${t.rank}. ${t.name} | ${t.status} | 확산 지수 ${t.index} | 출시 판단 ${t.timing.label}`)
    t.ingredients.forEach((it) => lines.push(`   - ${it.kw}: ${it.type}, ${H}주 생존 ${Math.round(it.prob * 100)}%, 이번 주 약 ${weeklyNow(it).toLocaleString()}회 검색, ${ACTION_LABEL[it.action]}`))
  })
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = `맛트렌드_주간리포트_${meta.last}.txt`; a.click()
  URL.revokeObjectURL(url)
}

function TimingBar({ peakIn }: { peakIn: number | null }) {
  const at = peakIn ?? H
  const axis = Math.max(30, Math.ceil((at + 4) / 10) * 10)
  const left = (w: number) => `${(w / axis) * 100}%`
  const ticks = Array.from({ length: axis / 10 + 1 }, (_, i) => i * 10)
  return (
    <div className="mt-4">
      <div className="relative h-3 rounded-full bg-muted">
        <i className="absolute inset-y-0 left-0 rounded-l-full bg-muted-foreground/35" style={{ width: left(H) }} />
        <i className="absolute inset-y-0 bg-primary/40" style={{ left: left(H), width: left(SALE) }} />
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
    <div title={title} className="border-l border-border pl-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('num text-base tracking-tight', strong ? 'font-bold' : 'font-semibold')}>{value}{unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}</p>
    </div>
  )
}

/** 핵심 재료 칩을 누르면 칩 바로 아래에 열리는 재료 상세 */
function IngredientDetail({ it, onClose }: { it: RadarItem; onClose: () => void }) {
  const { appr } = useApp()
  const timing = timingOf(it)
  const br = brRecord(it.kw)
  return (
    <section aria-label={`${it.kw} 재료 상세`} className="mt-3 border-y border-border py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-base font-extrabold tracking-tight">{it.kw}</h4>
        <span className="text-xs text-muted-foreground">{it.type}</span>
        <ActionTag action={it.action} />
        {it.warn && <span title={`평소 20대가 주로 찾던 디저트에 30세 이상 검색이 갑자기 몰린 급등. 과거 이런 급등은 ${Math.round(scores.warn_rate * 100)}%만 ${H}주를 버텼습니다`}><Pill tone="primary" className="cursor-help">주의</Pill></span>}
        {appr[launchKey(it.kw)] ? <Pill tone="primary">선출시 중</Pill> : appr[skipKey(it.kw)] ? <span className="text-xs font-semibold text-muted-foreground">출시 안 함</span> : null}
        <button type="button" onClick={onClose} aria-label="재료 상세 닫기" className={cn('ml-auto grid size-8 place-items-center rounded-full hover:bg-muted active:translate-y-px', FR)}><X className="size-4" /></button>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">{it.suggestion}</p>
      <p className="mt-1 text-xs text-muted-foreground">배라 출시 이력: {brLine(br)}</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] text-muted-foreground">최근 1년 검색량 · 출시 판단 <b className="text-foreground">{timing.label}</b> · 감지 {shortDate(it.detected)}</p>
          <div className="[&>svg]:h-auto [&>svg]:w-full"><Sparkline values={it.series.slice(-52)} w={320} h={64} /></div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Metric label="급등 폭" value={it.jump.toFixed(1)} unit="배" strong title="직전 4주 평균 대비 감지 주 검색량" />
          <Metric label="평소 대비" value={(1 / Math.max(0.1, it.base)).toFixed(1)} unit="배" title="지난 1년 평균 대비 감지 주 검색량" />
          <Metric label="꾸준한 주" value={it.steady > 104 ? '2년+' : String(it.steady)} unit={it.steady > 104 ? '' : '주'} title="지금 수준의 25% 이상으로 이어진 주 수" />
          <Metric label="전성기 대비" value={String(it.size)} unit="%" title="이 키워드가 가장 많이 검색됐던 주를 100%로 볼 때 감지 주 검색량" />
          <Metric label={`${H}주 생존`} value={String(Math.round(it.prob * 100))} unit="%" strong title={`감지 후 ${H}주 뒤 검색량이 감지 시점의 50% 이상일 확률`} />
          <Metric label="이번 주 검색" value={weeklyNow(it).toLocaleString()} unit="회" title="감지 주 실제 검색 수를 곡선 비율로 이번 주에 옮긴 추정치" />
        </div>
      </div>
    </section>
  )
}

/** 출시 이력 때문에 빠지거나 재출시로 남은 재료 */
function BrNotes({ t }: { t: FlavorTrend }) {
  const due = t.ingredients.filter((i) => t.br[i.kw].status === 'due')
  if (!due.length && !t.dropped.length) return null
  return (
    <div className="mt-5 border-t border-border pt-4">
      <Heading>배라 출시 이력 확인</Heading>
      <ul className="mt-1.5 flex flex-col gap-1 text-xs leading-relaxed">
        {due.map((i) => <li key={i.kw}><b className="text-primary">{i.kw} 재출시 주기</b> <span className="text-muted-foreground">{brLine(t.br[i.kw])}</span></li>)}
        {t.dropped.map((d) => <li key={d.kw}><b>{d.kw} 제외</b> <span className="text-muted-foreground">{d.why === 'cap' ? `핵심 재료는 ${MAX_INGREDIENTS}개까지라, 생존 확률이 더 낮은 이 재료는 뺐어요` : brLine(t.br[d.kw])}</span></li>)}
      </ul>
    </div>
  )
}

/** 트렌드 행을 누르면 바로 아래에 펼쳐지는 상세 */
function FlavorDetail({ t, onDevelop, developing }: { t: FlavorTrend; onDevelop: () => void; developing: boolean }) {
  const [ing, setIng] = useState<string | null>(null)
  const { timing, lead } = t
  const seasonal = timing.peakIn !== null
  const open = ing ? t.ingredients.find((i) => i.kw === ing) : undefined
  const counts = t.ingredients.map(weeklyNow)
  const top = Math.max(WEEKLY_MEDIAN, ...counts)
  // 스테디는 '꾸준히 높다'는 뜻이 되도록 다른 트렌드와 최근 12주 평균을 견준다
  const recent = (s: number[]) => s.slice(-12).reduce((a, b) => a + b, 0) / 12
  const others = TRENDS.filter((x) => x.id !== t.id)
  const mine = Math.round(recent(t.series)), theirs = Math.round(others.reduce((n, x) => n + recent(x.series), 0) / Math.max(1, others.length))
  return (
    <div className="border-t border-border px-1 pb-6 pt-5 sm:px-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{STATUS_NOTE[t.status]}. {seasonal ? `다음 정점은 약 ${timing.peakIn}주 후예요` : `${H}주 뒤 생존 확률 ${Math.round(lead.prob * 100)}%`} ({lead.kw} 기준)</p>
        <p className="text-right"><span className="block text-[11px] text-muted-foreground">출시 판단</span><span className="block text-xl font-extrabold leading-tight text-primary">{timing.label}</span></p>
      </div>
      {t.status === '스테디' && (
        <p className="mt-2 text-sm"><b>다른 트렌드와 비교:</b> 최근 12주 확산 지수 평균이 <b className="num">{mine}</b>으로, 다른 트렌드 평균 <b className="num">{theirs}</b>보다 <b className={cn('num', mine >= theirs && 'text-primary')}>{Math.abs(mine - theirs)}</b> {mine >= theirs ? '높게 꾸준히 유지돼요' : '낮지만 꺼지지 않고 유지돼요'}</p>
      )}
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div className="min-w-0 md:border-r md:border-border md:pr-6">
          <BigHeading>출시 타이밍</BigHeading>
          <p className="mt-1 text-xs text-muted-foreground">지금 기획 시작 → 리드타임 {H}주 → 이달의 맛 판매 {SALE}주</p>
          <p className="mt-4 text-base font-extrabold tracking-tight">{timing.headline}</p>
          <TimingBar peakIn={timing.peakIn} />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5"><i className="h-2.5 w-3.5 rounded-sm bg-muted-foreground/35" />개발 {H}주</li>
            <li className="flex items-center gap-1.5"><i className="h-2.5 w-3.5 rounded-sm bg-primary/40" />판매 {SALE}주</li>
            <li className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-primary" />{seasonal ? `다음 정점 (${timing.peakIn}주 후)` : `${H}주 생존 판정 시점`}</li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed">{seasonal
            ? `기준 재료 ${lead.kw}: 매년 같은 철에 돌아오는 재료라 최근 1년의 정점 주를 다음 정점으로 잡았습니다. 지금 기획을 시작하면 ${H}주 뒤 출시합니다.`
            : `기준 재료 ${lead.kw}: 시즌을 타지 않아 정점 시점을 예측하지 않습니다. 대신 모델이 ${H}주 뒤에도 감지 시점의 절반 이상 수요가 남을 확률을 ${Math.round(lead.prob * 100)}%로 봅니다.`}</p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{seasonal
            ? <><b className="text-primary">지금 출시</b> 판매 {SALE}주 안에 정점 &nbsp; <b>먼저 출시</b> 정점 전에 판매를 마침 &nbsp; <b>이번엔 늦음</b> 출시 전에 정점이 지남</>
            : <><b className="text-primary">지금 출시</b> {H}주 생존 60%+ &nbsp; <b>지켜보기</b> 40~60% 또는 규모 작음 &nbsp; <b>이번엔 늦음</b> 40% 미만</>}</p>
          <BrNotes t={t} />
        </div>
        <div className="min-w-0">
          <BigHeading>트렌드 설명</BigHeading>
          <p className="mt-1.5 text-sm leading-relaxed">{t.desc}</p>
          <div className="mt-6 flex items-baseline justify-between gap-2"><BigHeading>핵심 재료</BigHeading><span className="text-[11px] text-muted-foreground">눌러서 재료 상세 보기</span></div>
          <div className="mt-2 flex flex-wrap gap-2">
            {t.ingredients.map((i) => {
              const on = ing === i.kw
              return <button key={i.kw} type="button" aria-pressed={on} onClick={() => setIng(on ? null : i.kw)} className={cn('inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-semibold transition-colors active:translate-y-px', FR, on ? 'picked' : 'border-border bg-card hover:bg-muted')}>{i.kw}{t.br[i.kw].status === 'due' && <span className="ml-1 text-[10px] font-bold text-primary">재출시</span>}</button>
            })}
          </div>
          {open && <IngredientDetail it={open} onClose={() => setIng(null)} />}
          <div className="mt-6"><BigHeading>재료별 검색 신호</BigHeading></div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">네이버에서 이번 주 이 재료를 검색한 횟수(추정)예요. 비교 기준: 추적 중인 키워드 {scores.keywords}개의 중앙값은 <b className="text-foreground">주 {WEEKLY_MEDIAN.toLocaleString()}회</b></p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {t.ingredients.map((i, k) => {
              const v = counts[k]
              return (
                <li key={i.kw}>
                  <p className="mb-1 flex justify-between gap-2 text-xs"><span className={i.kw === lead.kw ? 'font-semibold text-primary' : 'text-muted-foreground'}>{i.kw}{i.kw === lead.kw && ' (기준 재료)'}</span><span className="num whitespace-nowrap"><b>주 {v.toLocaleString()}회</b> <span className="text-muted-foreground">중앙값의 {(v / WEEKLY_MEDIAN).toFixed(1)}배</span></span></p>
                  <div className="relative h-2 rounded-full bg-muted">
                    <i className={cn('absolute inset-y-0 left-0 rounded-full', i.kw === lead.kw ? 'bg-primary' : 'bg-muted-foreground/45')} style={{ width: `${(v / top) * 100}%` }} />
                    <i title={`중앙값 주 ${WEEKLY_MEDIAN.toLocaleString()}회`} className="absolute -inset-y-1 w-0.5 rounded bg-foreground/60" style={{ left: `${(WEEKLY_MEDIAN / top) * 100}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">세로선 = 중앙값</p>
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <Button className="h-11 px-6" onClick={onDevelop}>{developing ? '아래에서 이달의 맛을 보고 있어요' : '이달의 맛으로 개발해보기'}</Button>
      </div>
    </div>
  )
}

function CollabDetail({ t, onDevelop, developing }: { t: CollabTrend; onDevelop: () => void; developing: boolean }) {
  const c = t.collab
  return (
    <div className="border-t border-border px-1 pb-6 pt-5 sm:px-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{STATUS_NOTE[t.status]}. {c.reason}</p>
        <p className="text-right"><span className="block text-[11px] text-muted-foreground">출시 판단</span><span className="block text-xl font-extrabold leading-tight text-primary">{t.timing.label}</span></p>
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div className="min-w-0 md:border-r md:border-border md:pr-6">
          <BigHeading>최근 2년 검색량</BigHeading>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">2년 중 최고 주 = 100 <EvidenceBadge kind="sim" note="실제 IP 검색량을 연결하기 전의 시연값" /></p>
          <div className="mt-3 [&>svg]:h-auto [&>svg]:w-full"><Sparkline values={c.series} w={420} h={120} /></div>
          <p className="mt-3 text-base font-extrabold tracking-tight">{t.timing.headline}</p>
        </div>
        <div className="min-w-0">
          <BigHeading>급등 근거</BigHeading>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <Metric label="급등 폭" value={c.jump.toFixed(1)} unit="배" strong title="최근 4주 평균 ÷ 직전 12주 평균" />
            <Metric label="상승 주" value={`${c.rising}/4`} title="최근 4주 중 직전 주보다 오른 주 수" />
            <Metric label="1년 대비" value={c.vsYear.toFixed(1)} unit="배" title="최근 4주 평균 ÷ 지난 1년 평균" />
            <Metric label="전성기 대비" value={String(Math.round(c.size))} unit="%" title="2년 최고를 100으로 볼 때 지금 검색량" />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">배라 출시 이력: {brLine(t.br)}. 맛과 달리 콜라보에는 생존 예측 모델이 없어 급등 근거만 봅니다. 계약 기간과 비용은 이 데이터로 알 수 없습니다.</p>
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <Button className="h-11 px-6" onClick={onDevelop}>{developing ? '아래에서 콜라보를 보고 있어요' : '콜라보로 개발해보기'}</Button>
      </div>
    </div>
  )
}

function TrendList({ kind, setKind, query, selected, onSelect, developing, onDevelop }: { kind: '맛' | '콜라보'; setKind: (k: '맛' | '콜라보') => void; query: string; selected: string | null; onSelect: (id: string | null) => void; developing: string | null; onDevelop: (id: string) => void }) {
  const [group, setGroup] = useState<'trending' | 'falling'>('trending')
  const q = query.trim()
  const all: AnyTrend[] = kind === '맛' ? TRENDS : COLLAB_TRENDS
  const rows = all.filter((t) => !q || t.name.includes(q) || (t.kind === '맛' && t.ingredients.some((i) => i.kw.includes(q))))
  const trending = rows.filter((t) => t.status !== '하락'), falling = rows.filter((t) => t.status === '하락')
  const sections = group === 'trending' ? TRENDING.map((s) => ({ s, list: trending.filter((t) => t.status === s) })).filter((x) => x.list.length) : [{ s: '하락' as TrendStatus, list: falling }]
  const order = sections.flatMap((x) => x.list)
  const fastest = trending.length ? trending.reduce((a, b) => (b.series[b.series.length - 1] - b.series[b.series.length - 2] > a.series[a.series.length - 1] - a.series[a.series.length - 2] ? b : a)) : null
  const gain = (t: AnyTrend) => Math.round(t.series[t.series.length - 1] - t.series[t.series.length - 2])
  return (
    <Card className="mb-6 border-border pb-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-baseline gap-x-3 text-xl font-extrabold tracking-tight text-primary">이번 주 감지된 트렌드
            <span className="text-xs font-semibold text-muted-foreground" title="학습에 쓰지 않은 키워드로 2024년 이후 급등의 13주 생존을 맞힌 균형 정확도">{kind === '맛' ? `맛 예측 정확도 ${Math.round(scores.model_bal * 100)}%` : '콜라보는 예측 모델 없음'}</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">눌러서 자세히 보기</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fastest && <span className="rounded-2xl bg-flavor-sky px-3 py-1.5 text-center"><span className="block text-[10px] text-muted-foreground">확산 지수가 가장 많이 오른 {kind === '맛' ? '맛' : 'IP'}</span><span className="block text-xs font-bold">{fastest.name} <span className="num">+{gain(fastest)}</span></span></span>}
          <Chip on={kind === '맛'} onClick={() => { setKind('맛'); onSelect(null) }}>맛</Chip>
          <Chip on={kind === '콜라보'} onClick={() => { setKind('콜라보'); onSelect(null) }}>콜라보</Chip>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip on={group === 'trending'} onClick={() => setGroup('trending')}>트렌딩 중 {trending.length}</Chip>
        <Chip on={group === 'falling'} onClick={() => setGroup('falling')}>하락 중 {falling.length}</Chip>
        {kind === '콜라보' && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><EvidenceBadge kind="sim" note="실제 IP 검색량을 연결하기 전의 시연값" />곡선은 가상 시연값</span>}
      </div>
      {group === 'falling' && <p className="mb-3 text-xs text-muted-foreground">하락 중인 트렌드는 출시 후보가 아니에요. 이미 기획 중인 맛이 꺾이고 있지 않은지 확인하는 용도로만 보여 줘요</p>}
      <div className={cn('hidden gap-3 px-3 pb-2 text-[11px] text-muted-foreground md:grid', ROW)}>
        <span className="col-span-3">순위 · 트렌드</span>
        <span title="재료들의 이번 주 검색량이 각자 최근 3년 중 가장 많이 검색된 주의 몇 % 수준인지 평균">확산 지수 (3년 중 최고 주 = 100)</span><span />
        <span className="text-center">지난주 대비 우선순위</span><span className="text-center">12주 추이</span>
      </div>
      <div className="flex flex-col gap-4">
        {sections.map(({ s, list }) => (
          <div key={s}>
            {group === 'trending' && <p className="mb-1.5 flex items-center gap-2 px-1 text-xs font-bold"><ListStatus status={s} /><span className="font-normal text-muted-foreground">{STATUS_NOTE[s]}</span></p>}
            <ol className="flex flex-col gap-2.5">
              {list.map((t) => {
                const on = t.id === selected
                const due = t.kind === '맛' && t.ingredients.some((i) => t.br[i.kw].status === 'due')
                return (
                  <li key={t.id} className={cn('rounded-2xl', on && 'bg-card')}>
                    <button type="button" aria-expanded={on} onClick={() => onSelect(on ? null : t.id)}
                      className={cn('grid w-full grid-cols-[2rem_2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-2xl border px-3 py-3 text-left transition-colors active:translate-y-px', ROW, FR, on ? 'picked' : 'border-transparent bg-muted/70 hover:bg-accent/50')}>
                      <span className={cn('num grid size-8 place-items-center rounded-full text-sm font-bold', on ? 'bg-primary text-primary-foreground' : 'bg-card')}>{order.indexOf(t) + 1}</span>
                      <Scoop art={t.art} small className="size-10" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{t.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground"><ListStatus status={t.status} /><b className={t.timing.verdict === '지금' ? 'text-primary' : 'text-foreground'}>{t.timing.label}</b>{due && <span className="font-semibold text-primary">· 재출시 주기</span>}</span>
                      </span>
                      <span className="hidden h-2.5 overflow-hidden rounded-full bg-card md:block"><i className="block h-full rounded-full" style={{ width: `${t.index}%`, background: t.art.bits }} /></span>
                      <span className="num hidden text-right text-sm font-bold md:block">{t.index}</span>
                      <span className="text-center"><RankDelta v={t.rankDelta} /></span>
                      <span className="hidden text-center md:block"><Sparkline values={t.series.slice(-12)} w={96} h={28} /></span>
                    </button>
                    {on && (t.kind === '맛'
                      ? <FlavorDetail key={t.id} t={t} developing={developing === t.id} onDevelop={() => onDevelop(t.id)} />
                      : <CollabDetail key={t.id} t={t} developing={developing === t.id} onDevelop={() => onDevelop(t.id)} />)}
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>
      {!order.length && <p className="rounded-2xl bg-muted/70 py-6 text-center text-sm text-muted-foreground">{group === 'falling' ? '하락 중인 트렌드가 없어요' : '조건에 맞는 트렌드가 없어요'}</p>}
      {kind === '콜라보' && COLLAB_DROPPED.length > 0 && <p className="mt-3 text-xs text-muted-foreground">이미 배라 이달의 맛으로 나온 IP는 뺐어요: {COLLAB_DROPPED.map((r) => `${r.kw}(${r.launches.map((l) => `${l.year} ${l.name}`).join(', ')})`).join(' · ')}</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground"><b>확산 지수</b>는 재료들의 이번 주 검색량이 각자 최근 3년 중 가장 많이 검색된 주의 몇 % 수준인지 평균한 값이에요. 100이면 3년 중 가장 뜨거운 때, 30이면 그 30% 수준이에요</p>
    </Card>
  )
}

function ConceptCard({ c, on, liked, onSelect, onLike, launched, due }: { c: Concept; on: boolean; liked: boolean; onSelect: () => void; onLike: () => void; launched: boolean; due: boolean }) {
  return (
    <article className={cn('relative rounded-3xl border bg-card p-2 transition-colors', on ? 'picked' : 'border-border hover:border-primary/40')}>
      <div className="relative grid h-44 place-items-center rounded-2xl sm:h-52">
        <Scoop art={c.art} className="h-40 sm:h-48" />
        {launched && <span className="absolute left-3 top-3 rounded-full bg-card px-2.5 py-1 text-[11px] font-bold text-primary">선출시 중</span>}
        {!launched && due && <span className="absolute left-3 top-3 rounded-full bg-card px-2.5 py-1 text-[11px] font-bold text-primary">재출시 주기</span>}
        <button type="button" aria-pressed={liked} aria-label={`${c.name} 찜하기`} onClick={onLike} className={cn('absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-card active:translate-y-px', FR)}><Heart className={cn('size-4', liked && 'fill-current text-primary')} /></button>
      </div>
      <div className="px-2.5 pb-2 pt-3">
        <h3><button type="button" aria-pressed={on} onClick={onSelect} className={cn('text-left text-sm font-extrabold after:absolute after:inset-0 after:rounded-3xl', FR)}>{c.name}</button></h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{conceptSub(c)}</p>
      </div>
    </article>
  )
}

function Accordion({ title, tone, open, children }: { title: string; tone: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group">
      <summary className={cn('flex h-12 cursor-pointer list-none items-center justify-between rounded-2xl px-4 text-sm font-bold [&::-webkit-details-marker]:hidden', FR, tone)}>
        <span className="flex items-center gap-2">{title}<EvidenceBadge kind="assume" note="팀 가설. 실제 배합 검증 전" /></span>
        <span aria-hidden className="grid size-6 place-items-center text-muted-foreground"><Plus className="size-3.5 group-open:hidden" /><Minus className="hidden size-3.5 group-open:block" /></span>
      </summary>
      <div className="px-1 pt-2 text-xs leading-relaxed">{children}</div>
    </details>
  )
}

function Row({ k, children }: { k: keyof typeof PART; children: React.ReactNode }) {
  return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 py-0.5 text-sm"><dt className={cn('font-bold', PART[k])}>{k}</dt><dd>{children}</dd></div>
}

/** 고른 조합(또는 콜라보)의 상세. 맨 아래가 출시 결정 */
function Decision({ cur, liked, onLike, children, verdict, eyebrow, tag, title, sub }: { cur: Pick; liked: boolean; onLike: () => void; children: React.ReactNode; verdict: string; eyebrow: string; tag: string; title: string; sub: string }) {
  const { appr, setAppr, go, scenarios } = useApp()
  const stores = useMemo(() => dataFor(SCENARIOS.a).stores.filter((s) => s.place.rep), [])
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
  const sale = cur.kind === '콜라보' ? '팬 방문 중심의 4주 콜라보를 가정합니다' : `지금 개발을 시작하면 대표 매장 선출시는 ${shortDate(addWeeks(meta.last, H))} 무렵이고, 4주 반응을 본 뒤 전국 확대를 판단합니다`

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><b className="text-foreground">{tag}</b>{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        </div>
        <p className="text-right"><span className="block text-[11px] text-muted-foreground">출시 판단</span><span className="block text-xl font-extrabold text-primary">{verdict}</span></p>
      </div>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
        <b>{cur.kw}</b><span className="text-muted-foreground">{cur.line}</span><span className="basis-full text-muted-foreground">{sale}</span>
      </div>

      <div className="mt-auto">
        {launched ? (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs font-medium text-muted-foreground">전국 평균 기대 방문 증가 (대조 대비 4주)</p><p className="num mt-0.5 text-xl font-bold tracking-tighter">+{pc(launched.exp.visitLo)}~{pc(launched.exp.visitHi)}</p><p className="text-xs text-muted-foreground">가정 범위</p></div>
              <div><p className="text-xs font-medium text-muted-foreground">매장당 평균 기대 매출 순증 (4주 합)</p><p className="num mt-0.5 text-xl font-bold tracking-tighter">{man(launched.exp.salesLo)}~{man(launched.exp.salesHi)}원</p><p className="text-xs text-muted-foreground">객단가 {launched.price.toLocaleString()}원, 잠식 {pc(launched.cannibal)} 가정</p></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm"><b>{launched.concept ?? launched.kw}</b> 대표 매장 {launched.stores.length}곳 선출시 결정됨</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAppr(launchKey(cur.kw), null)}>결정 취소</Button>
                <Button size="sm" onClick={() => go('react', { launch: launched.id, open: 1 })}>매장 반응 보기</Button>
              </div>
            </div>
          </div>
        ) : skipped ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
            <span><b>{cur.kw}</b> 출시 안 함으로 기록했습니다.{cur.kind === '맛' && ` ${H}주 뒤 실제 검색 결과와 피드백에서 비교합니다.`}</span>
            <Button variant="outline" size="sm" onClick={() => setAppr(skipKey(cur.kw), null)}>기록 취소</Button>
          </div>
        ) : (
          <>
            <details className="group mt-4 border-y border-border">
              <summary className={cn('flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden', FR)}>
                <span>매장 고르기·기대효과</span>
                <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground"><span className="num">{sel.length ? `+${pc(ex.visitLo)}~${pc(ex.visitHi)} · ${man(ex.salesLo)}~${man(ex.salesHi)}원` : '-'}</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /></span>
              </summary>
              <div className="pb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">대표 매장 {sel.length}곳 선출시 (손님 유형마다 3곳, 전부 선택에서 시작)</p>
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground"><b className="text-foreground">대표 매장:</b> 손님 유형 {TYPES.length}종({TYPES.join(', ')})마다 대표 3곳이 먼저 출시해요. 대표 매장 반응에 유형 가중치를 곱해 전국 평균을 미리 읽어요. 매장 이름에 마우스를 올리면 동네와 직영·가맹이 보여요.</p>
                <div className="flex flex-col gap-2">
                  {TYPES.map((t) => (
                    <div key={t} className="flex flex-wrap items-center gap-1.5">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">{t}</span>
                      {stores.filter((s) => s.type === t).map((s) => {
                        const on = sel.includes(s.id)
                        return (
                          <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(s.id)} title={`${s.place.gu} ${s.place.dong} · ${s.place.direct ? '직영' : '가맹'}${s.place.license === '인허가 없음' ? ' · 영업 확인 필요' : ''}`}
                            className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors active:translate-y-px', FR, on ? 'picked' : 'border-border text-muted-foreground hover:bg-accent/50')}>
                            {s.name.replace(/점$/, '')}{s.place.license === '인허가 없음' && <span className="ml-1 text-primary" aria-label="영업 확인 필요">*</span>}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
                {sel.some((id) => stores.find((s) => s.id === id)?.place.license === '인허가 없음') && <p className="mt-2 text-xs text-muted-foreground"><span className="text-primary">*</span> 인허가 기록이 없는 직영점이라 실제 영업 여부 확인이 필요해요. 닫았다면 같은 유형의 다음 매장으로 바꿉니다.</p>}
                {missing.length > 0 && sel.length > 0 && <p className="mt-2 text-xs text-primary">{missing.join(', ')} 유형의 대표 매장이 없습니다. 전국 평균 환산에서 이 유형은 빠집니다.</p>}

                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">기대효과 <span className="font-normal">(과거 사례 0건. 손님 유형별 가정 범위에 유형 가중치를 곱한 전국 평균이고 예측 모델이 아님)</span></p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">전국 평균 방문 증가 (대조 대비, 4주) <EvidenceBadge kind="assume" /></p>
                      <p className="num text-xl font-bold tracking-tighter">{sel.length ? `+${pc(ex.visitLo)}~${pc(ex.visitHi)}` : '-'}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">매장당 평균 매출 순증, 4주 합 <EvidenceBadge kind="ext" note="POS가 있어야 실측할 수 있고, 객단가와 잠식률은 가정" /></p>
                      <p className="num text-xl font-bold tracking-tighter">{sel.length ? `${man(ex.salesLo)}~${man(ex.salesHi)}원` : '-'}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground"><b className="text-foreground">계산 방법:</b> 고른 대표 매장마다 손님 유형별로 정해 둔 반응 크기(가정)에 이 재료 유형({cur.type})의 반응 곡선을 곱해, 출시 후 28일 동안 날마다 방문이 평소보다 몇 % 늘지 구하고 평균을 냅니다. 매출 순증은 그렇게 늘어난 방문 수를 28일 더한 뒤 객단가와 (1 − 잠식률)을 곱한 값이에요. 유형별 평균에 유형 가중치(서울 후보 매장 수 비중, 가정)를 곱해 전국 평균으로 바꾸고, 실제 사례가 없어 계산값의 60~140%를 범위로 보여 줍니다.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <label className="flex items-center gap-1.5">객단가 <input type="number" min={1000} step={500} value={price} onChange={(e) => setPrice(Math.max(1000, Number(e.target.value) || 0))} className="num h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-foreground" />원</label>
                    <label className="flex items-center gap-1.5" title="신제품을 사느라 기존 맛 매출이 줄어드는 비율">잠식률 <input type="number" min={0} max={90} step={5} value={cannibal} onChange={(e) => setCannibal(Math.min(90, Math.max(0, Number(e.target.value) || 0)))} className="num h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-foreground" />%</label>
                    <span>매출 순증 = 추가 방문 × 객단가 × (1 − 잠식률), 유형 가중 평균</span>
                    <span className="basis-full">유형 가중치: {ex.rows.map((r) => `${r.type} ${Math.round(r.weight * 100)}%`).join(' · ')}</span>
                  </div>
                </div>
              </div>
            </details>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Button className="h-11" disabled={!sel.length || full}
                onClick={() => {
                  const id = launchId(cur.kw)
                  setAppr(launchKey(cur.kw), { kind: 'launch', kw: cur.kw, concept: cur.concept, id, type: cur.type, launch: cur.kind === '콜라보' ? '콜라보' : '새로운 맛', prob: cur.prob, detected: cur.detected, stores: sel, price, cannibal: cannibal / 100, exp: { visitLo: ex.visitLo, visitHi: ex.visitHi, salesLo: ex.salesLo, salesHi: ex.salesHi } })
                  go('react', { launch: id, from: 'launch', open: 1 })
                }}>대표 매장 선출시 요청</Button>
              <button type="button" aria-pressed={liked} aria-label={`${title} 찜하기`} onClick={onLike} className={cn('grid size-11 place-items-center rounded-full border border-border hover:bg-muted active:translate-y-px', FR)}><Heart className={cn('size-4', liked && 'fill-current text-primary')} /></button>
              <Button variant="ghost" className="ml-auto h-11 text-muted-foreground" onClick={() => setAppr(skipKey(cur.kw), { kind: 'skip', kw: cur.kw, prob: cur.prob, type: cur.type })}>출시 안 함</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{full ? <span className="text-primary">매장 반응 화면에서 한 번에 볼 수 있는 맛이 가득 찼어요. 끝난 선출시를 정리하면 다시 요청할 수 있어요</span> : `요청하면 대표 매장에 선출시로 기록되고, ${H}주 뒤 매장 반응에서 전국 평균을 미리 읽습니다.`}</p>
          </>
        )}
      </div>
    </Card>
  )
}

/** '이달의 맛으로 개발해보기'를 누르면 열리는 조합 추천 */
function DevelopFlavor({ t }: { t: FlavorTrend }) {
  const { appr } = useApp()
  const { likes, toggle: toggleLike } = useLikes()
  const sets = useMemo(() => conceptSets(t.concepts), [t])
  const [offset, setOffset] = useState(0)
  const [conceptId, setConceptId] = useState<string | null>(null)
  const shown = sets[offset % sets.length]
  const concept = shown.find((c) => c.id === conceptId)
  const leadItem = concept ? radarItem(concept.lead) : null
  const leadBr = concept ? t.br[concept.lead] : null
  return (
    <section aria-label="이달의 맛 추천" className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">이달의 맛으로 만들어볼까요<EvidenceBadge kind="assume" note="재료와 기존 맛을 엮은 팀 가설. 판매 근거 없음" /></h2>
          <p className="mt-1 text-xs text-muted-foreground">{t.name} 재료 × 배라 기존 맛 · 맛을 누르면 자세한 설명이 열려요</p>
        </div>
        {sets.length > 1 && <Button variant="outline" className="h-10" onClick={() => { setOffset((o) => o + 1); setConceptId(null) }}><RefreshCw />다른 조합 추천</Button>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {shown.map((c) => <ConceptCard key={c.id} c={c} on={c.id === conceptId} liked={likes.includes(c.id)} onSelect={() => setConceptId(c.id === conceptId ? null : c.id)} onLike={() => toggleLike(c.id)} due={t.br[c.lead]?.status === 'due'} launched={(appr[launchKey(c.lead)] as LaunchDecision | undefined)?.concept === c.name} />)}
      </div>

      {concept && leadItem && (
        <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-1 flex-wrap items-center justify-center gap-4 rounded-3xl p-5 sm:flex-nowrap sm:justify-between">
              <ul className="flex shrink-0 flex-col gap-3 text-xs font-medium">
                {([['베이스', conceptBase(concept), concept.art.scoop], ['리본', concept.ribbon, concept.art.ribbon], ['토핑', concept.topping, concept.art.bits]] as const).map(([k, label, color]) => (
                  <li key={k} className="flex items-center gap-2"><i className="size-5 rounded-full border border-black/10" style={{ background: color }} /><span><b className={cn('block text-[11px]', PART[k])}>{k}</b>{label}</span></li>
                ))}
              </ul>
              <Scoop art={concept.art} className="h-56 sm:h-64" />
              <span className="hidden w-12 shrink-0 xl:block" />
            </div>
            <Accordion title="리스크" tone="bg-muted/70" open><p>{t.risk}</p></Accordion>
            <Accordion title="출시 체크포인트" tone="bg-muted/70"><ul className="flex list-disc flex-col gap-1 pl-4">{t.checks.map((c) => <li key={c}>{c}</li>)}</ul></Accordion>
          </div>
          <Decision key={concept.id} cur={flavorPick(leadItem, concept.name)} liked={likes.includes(concept.id)} onLike={() => toggleLike(concept.id)} tag={concept.tag} eyebrow={`${t.name} 트렌드에서 추천`} title={concept.name} sub={conceptSub(concept)} verdict={timingOf(leadItem).label}>
            <div className="mt-4">
              <Heading>추천 근거</Heading>
              <p className="mt-1 text-sm leading-relaxed">{conceptWhy(concept)}</p>
            </div>
            <div className="mt-4">
              <Heading>구성</Heading>
              <dl className="mt-1">
                <Row k="베이스">{conceptBase(concept)}<span className="text-muted-foreground"> ({concept.isNew ? '신규 개발' : concept.blend ? '배합 조정' : '기존 배합 그대로'})</span></Row>
                <Row k="리본">{concept.ribbon}<span className="text-muted-foreground"> (아이스크림 사이에 물결처럼 넣는 시럽·소스 띠)</span></Row>
                <Row k="토핑">{concept.topping}</Row>
                <Row k="기존 맛">{concept.existing}<span className="text-muted-foreground"> ({MENU_NAMES.includes(concept.existing) ? '지금 매장에서 판매 중' : '판매 중인 메뉴에 없음'})</span></Row>
              </dl>
            </div>
            {leadBr && leadBr.status === 'due' && (
              <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed"><b className="text-primary">{concept.lead}는 예전에 쓴 재료예요.</b> <span className="text-muted-foreground">{brLine(leadBr)}. 같은 재료로 낸 지난 이달의 맛: {leadBr.launches.map((l) => `${l.name}(${l.year})`).join(', ')}</span></p>
            )}
          </Decision>
        </div>
      )}
    </section>
  )
}

function DevelopCollab({ t }: { t: CollabTrend }) {
  const { likes, toggle: toggleLike } = useLikes()
  const c = t.collab
  return (
    <section aria-label="콜라보 추천" className="mb-6">
      <div className="mb-3 min-w-0">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">콜라보로 풀어볼까요<EvidenceBadge kind="sim" note="실제 IP 검색량을 연결하기 전의 시연값" /></h2>
        <p className="mt-1 text-xs text-muted-foreground">{c.kw} 검색 급등을 근거로 한 콜라보 제안</p>
      </div>
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-1 items-center justify-center rounded-3xl p-5"><Scoop art={t.art} className="h-56 sm:h-64" /></div>
          <Accordion title="리스크" tone="bg-muted/70" open><p>콜라보는 계약 기간과 일정이 정해져 있습니다. 협상 가능 여부와 비용은 이 데이터로 알 수 없습니다.</p></Accordion>
          <Accordion title="출시 체크포인트" tone="bg-muted/70"><ul className="flex list-disc flex-col gap-1 pl-4"><li>실제 IP 검색량 연결</li><li>권리사 협상과 계약 기간</li><li>팬 방문 중심의 4주 운영 가정 검증</li></ul></Accordion>
        </div>
        <Decision cur={collabPick(c)} liked={likes.includes('c:' + c.kw)} onLike={() => toggleLike('c:' + c.kw)} tag={c.action === '후보' ? '콜라보 후보' : '관찰'} eyebrow="최근 검색 급등 캐릭터·IP" title={c.kw} sub={c.reason} verdict={t.timing.label}>
          <div className="mt-4">
            <Heading>추천 근거</Heading>
            <p className="mt-1 text-sm leading-relaxed">최근 4주 검색량이 직전 3개월보다 {c.jump.toFixed(1)}배이고, 지난 1년 평균보다는 {c.vsYear.toFixed(1)}배입니다. 생존 예측 모델이 없어 급등 근거만 봅니다.</p>
          </div>
        </Decision>
      </div>
    </section>
  )
}

export default function Decide() {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'맛' | '콜라보'>('맛')
  const [selected, setSelected] = useState<string | null>(null)
  const [developing, setDeveloping] = useState<string | null>(null)
  const devRef = useRef<HTMLDivElement>(null)
  const all: AnyTrend[] = kind === '맛' ? TRENDS : COLLAB_TRENDS
  const dev = developing && developing === selected ? all.find((t) => t.id === developing) : undefined
  useEffect(() => { if (dev) devRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [dev])

  return (
    <div className="flavor-page">
      <TabTitle title="트렌드" desc="뜨는 맛을 찾고 출시를 결정해요">
        <label className="flex w-full items-center gap-2 border-b border-border px-1 pb-1.5 sm:w-64">
          <span className="sr-only">맛, 재료 검색</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="맛·재료 검색" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <Search className="size-4 text-muted-foreground" aria-hidden />
        </label>
      </TabTitle>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold tracking-tight">안녕하세요, 신제품 기획팀</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">트렌드를 누르면 출시 타이밍이 나오고, 이달의 맛으로 개발해볼 수 있어요
            <span title={`맛 트렌드는 네이버 데이터랩 주간 검색량(${shortDate(meta.first)} ~ ${shortDate(meta.last)}) 실데이터입니다. 트렌드 묶음과 맛 조합은 팀 가설, 콜라보 곡선은 시연값, 기대효과는 가정입니다.`} className="cursor-help text-xs underline decoration-dotted underline-offset-4">근거 실데이터 + 가정</span>
          </p>
        </div>
        <Button className="h-11" onClick={downloadReport}>주간 리포트 받기</Button>
      </header>

      <TrendList kind={kind} setKind={(k) => { setKind(k); setDeveloping(null) }} query={query} selected={selected} onSelect={(id) => { setSelected(id); if (id !== developing) setDeveloping(null) }} developing={developing} onDevelop={(id) => setDeveloping(id)} />

      <div ref={devRef} className="scroll-mt-6">
        {dev && (dev.kind === '맛' ? <DevelopFlavor key={dev.id} t={dev} /> : <DevelopCollab key={dev.id} t={dev} />)}
      </div>

      <footer className="mt-5 flex flex-wrap items-end justify-between gap-2 rounded-3xl bg-muted/70 px-6 py-6">
        <div><p className="text-2xl font-extrabold tracking-tight">Flavor Radar</p><p className="mt-1 text-xs text-muted-foreground">감지 → 기획 → 출시 타이밍 → 출시 후 측정</p></div>
        <p className="text-xs text-muted-foreground">데이터 기준일 {shortDate(meta.last)}</p>
      </footer>

      <HowTo>
        <p><b>트렌드 묶음:</b> 레이더가 감지한 급등 중 아이스크림으로 풀기 좋은 재료를 맛의 결이 비슷한 {TRENDS.length}개로 팀이 묶었습니다(가설). 묶음마다 핵심 재료는 {MAX_INGREDIENTS}개까지이고, 이달의 맛 후보·시즌 재출시 재료를 먼저, 그다음 {H}주 생존 확률이 높은 순으로 고릅니다.</p>
        <p className="mt-1"><b>배라 출시 이력:</b> 배스킨라빈스 홈페이지의 아이스크림 메뉴 {MENU_NAMES.length}종과 2018~{THIS_YEAR}년 이달의 맛 히스토리({BR_SOURCE.collected} 수집)를 씁니다. 지금 파는 메뉴의 이름이나 해시태그에 같은 재료가 있으면 뺍니다. 이달의 맛으로 나온 적 있는 재료는 출시 사이 평균 간격(년)을 주기로 보고, 마지막 출시 뒤 그만큼 지났으면 '재출시 주기'로 남기고 아니면 뺍니다. 한 번만 나온 재료는 {SINGLE_GAP}년 주기로 가정합니다. 히스토리에 월이 없어 연 단위로만 셉니다({THIS_YEAR}년 기준). 같은 재료로 보는 표현(예: 딸기=스트로베리, 붕어빵=팥붕·슈붕)은 팀이 정했습니다.</p>
        <p className="mt-1"><b>이달의 맛 조합:</b> 조합 하나는 베이스·리본·토핑 3가지로 만들고, 베이스는 지금 파는 배라 맛을 우선 씁니다. 베이스를 그대로 두면 빠른 대응형, 다른 재료를 섞어 배합을 조정하면 트렌드 결합형, 베이스를 새로 개발하면 정면 승부형입니다. 한 번에 보여 주는 3개 안에서 같은 재료(베이스, 섞는 재료, 리본, 토핑)는 {MAX_REPEAT}번까지만 나오게 하고, 덜 겹치는 묶음부터 보여 줍니다. 조합은 팀 가설이고 판매 근거는 없습니다.</p>
        <p className="mt-1"><b>확산 지수:</b> 재료마다 이번 주 검색량이 최근 3년 중 가장 많이 검색된 주의 몇 %인지 구해 묶음 평균을 냅니다. 재료끼리 검색 규모를 비교하지는 않아서, 규모는 재료별 검색 신호(이번 주 검색 수 추정)에서 봅니다.</p>
        <p className="mt-1"><b>상태와 우선순위:</b> 최근 4주 평균을 직전 12주 평균과 비교해 1.15배 이상 뜨는 중, 1.05배 이상이면서 지수 70 이상이면 정점, 0.85배 이하 하락, 그 외 스테디입니다. 우선순위는 출시 판단(지금 출시 → 먼저 출시 → 지켜보기 → 이번엔 늦음), 상태, 확산 지수 순이고, 지난주 대비는 곡선을 한 주 전에서 잘라 같은 규칙으로 매긴 순위와의 차이입니다.</p>
        <p className="mt-1"><b>출시 판단:</b> 묶음에서 이달의 맛 후보·시즌 재출시 재료 중 첫 재료를 기준으로 합니다. 반복형은 최근 1년 정점 주가 내년에 돌아온다고 보고, 지금부터 {H}주 개발 후 {SALE}주 판매 구간과 비교합니다. 그 외 유형은 레이더 제안(후보 지금 출시, 관찰 지켜보기, 단기 이번엔 늦음)을 따릅니다.</p>
        <p className="mt-1"><b>레이더:</b> 급등 감지와 {H}주 생존 확률 계산은 트렌드 레이더 탭의 기준에 있습니다.</p>
        <p className="mt-1"><b>콜라보:</b> 최근 4주 평균이 직전 12주 평균의 1.5배 이상이고 전성기 대비 20% 이상이면 지금 출시, 1.25배 이상이면 지켜보기입니다. 곡선은 실제 IP 검색량을 연결하기 전의 시연값이고, 생존 모델이 없어 확률은 내지 않습니다.</p>
        <p className="mt-1"><b>기대효과:</b> 과거 매장 사례가 아직 없어 상권 유형별 가정 반응 크기와 재료 유형별 반응 곡선으로 28일 평균을 계산하고, 계산값의 60~140%를 범위로 둡니다. 모델이 아니고, 매출은 POS가 있어야 실측되며 객단가와 잠식률은 입력값입니다.</p>
      </HowTo>
    </div>
  )
}
