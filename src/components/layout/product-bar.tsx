import { useApp } from '@/lib/app-context'
import { SCENARIOS, launchDate } from '@/lib/data'
import { cn } from '@/lib/utils'
import { Day } from '@/components/figures'

/** 제품 선택, 출시 후 경과일, 한 줄 설명. 페이지 제목 바로 아래에 둔다. */
export function ProductBar({ className }: { className?: string }) {
  const { route, launch, go, day } = useApp()
  const scn = SCENARIOS[launch as 'a']
  const ld = launchDate(scn)
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card px-3 py-2', className)}>
      <label className="flex min-w-0 items-center">
        <span className="sr-only">출시 제품</span>
        <select value={launch} onChange={(e) => go(route, { launch: e.target.value })}
          className="h-9 min-w-0 max-w-full rounded-lg border border-input bg-background px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {Object.values(SCENARIOS).map((s) => <option key={s.id} value={s.id}>{s.label} ({s.launch})</option>)}
        </select>
      </label>
      <div className="flex shrink-0 items-baseline gap-2" title={`${ld.getMonth() + 1}월 ${ld.getDate()}일 출시`}>
        <span className="text-xs text-muted-foreground">출시 후</span>
        <Day n={day} className="text-lg leading-none" />
      </div>
      <p className="order-last min-w-0 basis-full text-[13px] leading-snug text-muted-foreground lg:order-none lg:basis-0 lg:flex-1" title={scn.blurb}>{scn.blurb}</p>
    </div>
  )
}
