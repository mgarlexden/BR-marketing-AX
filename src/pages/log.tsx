import { useMemo } from 'react'
import { Undo2 } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { DIR_LABEL, shortName } from '@/lib/data'
import { dirDecisions, dirKey, fixKey, fixRequests, launchKey, launchesOf, learnKey, radarKey, skipKey, skipsOf, type LearnDecision, type RadarApproval } from '@/lib/derived'
import { dataFor } from '@/lib/launch'
import { RADAR } from '@/lib/trend-data'
import { shortDate } from '@/lib/trend'
import { Card } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, TabTitle } from '@/components/page'
import { DirChip, Pill } from '@/components/status'
import { Day } from '@/components/figures'
import { CAUSE, USE } from './feedback'
import { causeOf } from '@/lib/derived'

const H = RADAR.meta.horizon

/** 결정 로그: 트렌드·매장 반응·피드백에서 내린 결정을 시점순으로 모은다 */
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
      if (le) r.push({ sort: le.day, when: <Day n={le.day} />, flavor: sc.label, kind: '학습 판단', body: <span className="text-xs">{CAUSE[causeOf(le.cause)]?.label ?? le.cause}, <b>{USE[le.use]}</b>{le.note ? `. ${le.note}` : ''}</span>, undo: () => setAppr(learnKey(sc.id), null) })
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

export default function DecisionLog() {
  return (
    <div>
      <TabTitle title="결정 로그" desc="출시 결정, 판정, 학습 판단을 시점순으로 모아요" />
      <Log />
    </div>
  )
}
