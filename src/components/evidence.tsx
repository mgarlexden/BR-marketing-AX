import { cn } from '@/lib/utils'

/** 화면의 숫자와 구역이 어떤 근거에서 나왔는지 표시한다. 정의는 범례(헤더)와 같다. */
export type Evidence = 'ok' | 'assume' | 'ext' | 'sim'

export const EVIDENCE: Record<Evidence, { label: string; tone: string; meaning: string }> = {
  ok: { label: '확인', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', meaning: '넥스트페이먼츠 공식 사이트 등 출처로 확인된 범위' },
  assume: { label: '가정', tone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', meaning: '팀이 가능하다고 가정한 내용. 실제 가능 여부는 확인 필요' },
  ext: { label: '타 시스템', tone: 'bg-accent text-accent-foreground', meaning: 'Vision AI가 아니라 POS, 키오스크, 해피포인트 같은 다른 데이터가 필요한 내용' },
  sim: { label: '가상', tone: 'bg-muted text-muted-foreground', meaning: '이 화면을 위해 합성한 값. 실제 성능이 아님' },
}

export function EvidenceBadge({ kind, className, note, label }: { kind: Evidence; className?: string; note?: string; /** 화면에 따라 다른 이름으로 보일 때 */ label?: string }) {
  const e = EVIDENCE[kind]
  return (
    <span title={note ? `${e.meaning}. ${note}` : e.meaning}
      className={cn('inline-flex shrink-0 cursor-help items-center whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-semibold leading-4', e.tone, className)}>
      {label ?? e.label}
    </span>
  )
}

/** 헤더에서 여는 범례 */
export function EvidenceLegend() {
  return (
    <details className="group relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-lg border border-input bg-card px-3 text-xs font-medium hover:bg-accent active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        근거 범례
      </summary>
      <div className="absolute right-0 top-11 z-40 w-80 rounded-2xl border border-border bg-popover p-4 text-xs shadow-xl">
        <p className="mb-2 font-semibold">숫자 옆 배지의 뜻</p>
        <ul className="flex flex-col gap-2">
          {(Object.keys(EVIDENCE) as Evidence[]).map((k) => (
            <li key={k} className="flex items-start gap-2">
              <EvidenceBadge kind={k} className="mt-0.5" />
              <span className="text-muted-foreground">{EVIDENCE[k].meaning}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
