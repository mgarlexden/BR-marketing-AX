import { useMemo } from 'react'
import { ChevronRight, ClipboardCheck } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { DIR_LABEL, DIR_RULE, diagnose, typeStats, verdict, verdictPhases, type Dir } from '@/lib/data'
import { dateLabel, num, pct } from '@/lib/format'
import { feed, pending } from '@/lib/derived'
import AdvancedStats, { type Kpi } from '@/components/ui/advanced-stats'
import { ClippedAreaChart } from '@/components/ui/advanced-stats-utils/charts'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Day, Delta } from '@/components/figures'
import { PageHeader, EmptyState } from '@/components/page'
import { DirChip, Pill } from '@/components/status'
import { Sparkline, ZBar } from '@/components/charts/mini'

const DIR_COLOR: Record<Dir, string> = { expand: 'var(--dir-expand)', maintain: 'var(--dir-maintain)', fix: 'var(--dir-fix)', wrap: 'var(--dir-wrap)', wait: 'var(--border)' }

export default function Brief() {
  const { data: d, day: D, appr, href, go } = useApp()
  const v = useMemo(() => verdict(d, D), [d, D])
  const phases = useMemo(() => verdictPhases(d, D), [d, D])
  const pend = pending(d, D, appr)
  const types = typeStats(d, D)
  const lead = types.filter((t) => t.reached).sort((a, b) => a.peakDay - b.peakDay || b.peak - a.peak)[0]
  const items = useMemo(() => feed(d, D, 8), [d, D])
  const agg = d.agg[D], prev = D > 0 ? d.agg[D - 1] : agg
  const flagsPrev = D > 0 ? diagnose(d, D - 1).rows.filter((r) => r.zone === 'flag').length : 0
  const pp = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%p`
  const maxAbs = Math.max(0.3, ...types.map((t) => Math.abs(t.now)))

  const kpis: Kpi[] = [
    { label: '최근 3일 추세', hint: '3일 전보다 반응이 얼마나 변했는지', value: pp(v.slope), change: `정점 ${pct(v.peak)}`, tone: v.slope >= 0 ? 'good' : 'bad', accent: true },
    { label: '구매 전환 점검 매장', hint: '방문은 늘었는데 구매 비율이 낮은 매장', value: `${v.flagged}곳`, change: `${v.flagged - flagsPrev >= 0 ? '+' : '−'}${Math.abs(v.flagged - flagsPrev)}`, tone: v.flagged ? 'bad' : 'good', accent: true },
    { label: '놓친 판매(추정)', hint: '위 매장이 평균 구매 비율이었다면 더 팔렸을 수량', value: `${num(v.lostUnits)}개/일`, change: `${Math.round(v.lostShare * 100)}%`, tone: v.lostUnits > 1 ? 'bad' : 'good', accent: true },
    { label: '반응 선두 상권', hint: '가장 빨리 정점에 닿은 상권', value: lead ? lead.type : '집계 중', change: lead ? `D+${lead.peakDay}` : '', tone: 'good' },
  ]

  const bands = phases.filter((p) => p.dir !== 'wait').map((p) => ({ from: p.from, to: p.to, color: DIR_COLOR[p.dir], label: p.to - p.from >= 2 ? DIR_LABEL[p.dir] : undefined }))
  const shownPhases = phases.filter((p) => p.dir !== 'wait').slice(-4).reverse()

  const chart = (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-muted/70 px-4 py-3">
        <DirChip dir={v.dir} className="text-sm" />
        <p className="min-w-0 flex-1 text-sm font-medium">{v.headline}</p>
      </div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">전체 반응 (평소 대비)</p>
          <p className="flex items-baseline gap-3"><span className="num text-4xl font-bold tracking-tighter">{pct(agg)}</span><span className="text-sm text-muted-foreground">어제 대비 <Delta v={agg - prev} /></span></p>
        </div>
        <p className="text-xs text-muted-foreground">색 띠는 그날의 판정, 점선은 기존 확인 시점</p>
      </div>
      <ClippedAreaChart data={d.agg.map((x, i) => ({ day: i, value: i <= D ? x : null }))} clipDay={D} bands={bands} refs={[{ x: 15, label: '기존 D+15' }, { x: 22, label: 'D+22' }]} height={230} />
      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">날짜별 판정과 이유</p>
        <ul className="divide-y divide-border">
          {shownPhases.map((p) => (
            <li key={p.from} className="flex items-center gap-3 py-1.5 text-sm">
              <DirChip dir={p.dir} className="w-11 justify-center" />
              <span className="w-24 shrink-0 text-xs"><Day n={p.from} />{p.to !== p.from && <span className="text-muted-foreground"> ~ </span>}{p.to !== p.from && <Day n={p.to} />}</span>
              <span className="min-w-0 flex-1 text-muted-foreground">{p.reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  const todo: string[] = []
  if (pend.dir) todo.push(`방향 판단 (${DIR_LABEL[v.dir]} 권고)`)
  if (pend.fix) todo.push(`${v.flagged}개 매장 보완 요청`)
  if (pend.radar) todo.push('레이더 유형 보정')

  return (
    <div>
      <PageHeader title="출시 현황" sub="반응 = 방문자 수가 평소보다 늘어난 정도. 가상 카메라가 센 20개 매장의 방문 인원을 합산해, 출시 전 14일 평균(요일·기온 보정)과 비교합니다." right={<span className="text-sm text-muted-foreground">기준일 <b className="text-foreground">{dateLabel(d, D)}</b></span>} />
      <AdvancedStats
        chart={chart}
        goal={{ label: '현재 판정', title: DIR_LABEL[v.dir], value: `신뢰도 ${v.conf}`, target: `근거 ${v.days}일`, percent: (v.days / 15) * 100, note: DIR_RULE[v.dir] }}
        note={{
          icon: <ClipboardCheck className="size-4" />, title: '의사결정 대기', emphasis: pend.count > 0, figure: pend.count > 0 ? `${pend.count}건` : undefined,
          body: todo.length ? <ul className="flex flex-col gap-1.5">{todo.map((t) => <li key={t} className="flex items-center gap-2 font-medium"><i className="size-1.5 rounded-full bg-white" />{t}</li>)}</ul> : '대기 중인 결정이 없습니다',
          action: pend.count ? <Button variant="dark" size="sm" onClick={() => go('decisions')}>결정하기<ChevronRight /></Button> : undefined,
        }}
        kpis={kpis}
      >
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="변화 알림" />
            {items.length === 0 ? <EmptyState title="아직 알림이 없습니다" /> : (
              <ul className="divide-y divide-border">
                {items.map((it, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-10 shrink-0 text-xs"><Day n={it.day} /></span>
                    <Pill tone={it.tone}>{it.tone === 'primary' ? '알림' : it.tone === 'warn' ? '점검' : '주의'}</Pill>
                    <span className="min-w-0 flex-1">{it.text}</span>
                    {it.store && <a href={href('why', { store: it.store })} className="shrink-0 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm active:translate-y-px">동선</a>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="상권별 반응" right={<a href={href('where')} className="text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm active:translate-y-px">전체 보기</a>} />
            <Table>
              <THead><TR><TH>상권</TH><TH>반응</TH><TH>추이</TH></TR></THead>
              <TBody>
                {types.slice().sort((a, b) => b.now - a.now).map((t) => (
                  <TR key={t.type}>
                    <TD><a href={href('where', { type: t.type })} className="font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm active:translate-y-px">{t.type}</a></TD>
                    <TD className="whitespace-nowrap"><ZBar v={t.now} range={maxAbs} /><b className="num">{pct(t.now)}</b></TD>
                    <TD><Sparkline values={t.series.slice(-7)} w={72} h={22} tone={t.now >= 0 ? 'main' : 'ctx'} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      </AdvancedStats>
    </div>
  )
}
