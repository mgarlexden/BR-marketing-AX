import { EvidenceBadge } from '@/components/evidence'

/** 지표의 데이터 출처. br: 배스킨라빈스 자사 POS·키오스크, vision: 넥스트페이먼츠 Vision AI 카메라.
 *  assume은 출처와 함께 붙는 표시로, 그 값이 아직 확인되지 않은 가정 위에서 계산됐다는 뜻이다. sim은 연결 전 시연값 */
export type Source = 'br' | 'vision' | 'assume' | 'sim'

export function SourceBadge({ source }: { source: Source }) {
  if (source === 'assume') return <EvidenceBadge kind="assume" className="bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground" />
  if (source === 'sim') return <EvidenceBadge kind="sim" />
  if (source === 'br') return (
    <span title="배스킨라빈스 자사 데이터 (POS·키오스크 주문)" className="inline-flex shrink-0 cursor-help items-center rounded-full bg-[#fde6f4] px-1.5 py-px text-[10px] font-extrabold leading-4 tracking-tight dark:bg-white">
      <span className="text-[#f130a5]">B</span><span className="text-[#182da1]">R</span>
    </span>
  )
  return <span title="넥스트페이먼츠 Vision AI 카메라 데이터" className="inline-flex shrink-0 cursor-help items-center rounded-full bg-black px-1.5 py-px text-[10px] font-medium leading-4 tracking-tight text-white dark:bg-white dark:text-black">Vision AI</span>
}
