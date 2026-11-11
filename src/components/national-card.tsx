import { useMemo } from 'react'
import { useApp } from '@/lib/app-context'
import { nationalEstimate } from '@/lib/data'
import { TYPE_COUNT } from '@/lib/stores'
import { EvidenceBadge } from '@/components/evidence'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

const spp = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%p`

/** 대표 매장의 유형별 순효과에 유형 가중치(서울 후보 매장 수 비중, 가정)를 곱해 전국 평균을 미리 읽는다 */
export function NationalCard() {
  const { data: d, day: D } = useApp()
  const est = useMemo(() => nationalEstimate(d, D), [d, D])
  const thin = est.rows.filter((r) => r.n > 0 && r.n / TYPE_COUNT[r.type] < 0.05 && r.weight >= 0.15).map((r) => r.type)
  return (
    <section id="national-estimate" aria-label="전국 평균 예측" className="mt-6 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[21px] font-bold leading-tight tracking-tight">전국 평균 예측 <span className="text-sm font-medium text-muted-foreground">대표 {est.n}곳 → 손님 유형별 가중</span></h3>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">대표 매장 반응으로 전국을 미리 읽음<EvidenceBadge kind="sim" /></span>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-medium text-muted-foreground">전국 평균 순효과 (대조 대비)</p>
          <p className="num text-3xl font-bold tracking-tighter">{spp(est.net)}</p>
          <p className="text-xs text-muted-foreground">대표 매장 사이 범위 <b className="num text-foreground">{spp(est.lo)} ~ {spp(est.hi)}</b></p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">유형별 순효과 × 유형 가중치의 합입니다. 가중치는 서울 후보 매장 수 비중을 쓴 가정이고, 전국 확대 뒤 실제 POS와 비교해 맞춥니다.</p>
        </div>
        <Table>
          <THead><TR><TH>손님 유형</TH><TH className="text-right">대표</TH><TH className="text-right">가중치</TH><TH className="text-right">대표가 덮는 비율</TH><TH className="text-right">순효과</TH><TH className="text-right">대표 사이 범위</TH></TR></THead>
          <TBody>
            {est.rows.map((r) => (
              <TR key={r.type}>
                <TD className="font-semibold">{r.type}</TD>
                <TD className="num text-right">{r.n}곳</TD>
                <TD className="num text-right">{Math.round(r.weight * 100)}%</TD>
                <TD className="num text-right">{Math.round((r.n / TYPE_COUNT[r.type]) * 100)}%</TD>
                <TD className="num text-right font-semibold">{r.n ? spp(r.net) : '-'}</TD>
                <TD className="num text-right text-muted-foreground">{r.n ? `${spp(r.lo)} ~ ${spp(r.hi)}` : '-'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      {thin.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{thin.join(', ')} 유형은 가중치가 큰데 대표가 3곳뿐이라 범위가 더 넓을 수 있어요.</p>}
    </section>
  )
}
