import { useApp, type RouteId } from '@/lib/app-context'
import { cn } from '@/lib/utils'

/** 화면 3개가 루프의 큰 단계 3개. 안에 묶인 세부 단계는 한 줄로 나란히 보여 준다 */
const GROUPS: { name: string; to: RouteId; steps: string[]; nums: number[] }[] = [
  { name: '트렌드', to: 'decide', steps: ['감지·예측', '출시 결정'], nums: [1, 2] },
  { name: '매장 반응', to: 'react', steps: ['선출시', '매장 반응', '판정'], nums: [3, 4, 5] },
  { name: '피드백', to: 'feedback', steps: ['피드백'], nums: [6] },
]

/** active: 지금 화면이 맡은 세부 단계 번호(1~6). 해당하는 큰 단계가 강조된다 */
export function LoopBar({ active, className }: { active: number[]; className?: string }) {
  const { href } = useApp()
  return (
    <ol className={cn('grid gap-2 sm:grid-cols-3', className)} aria-label="루프 단계">
      {GROUPS.map((g, i) => {
        const on = g.nums.some((n) => active.includes(n))
        return (
          <li key={g.name}>
            <a href={href(g.to)} aria-current={on ? 'step' : undefined}
              className={cn('flex h-full items-center gap-3 rounded-2xl border px-4 py-3 transition-colors active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                on ? 'border-primary/40 bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground hover:bg-background hover:text-foreground')}>
              <span className={cn('num grid size-10 shrink-0 place-items-center rounded-full text-lg font-semibold', on ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>{i + 1}</span>
              <span className="min-w-0">
                <span className={cn('block text-base leading-tight', on ? 'font-semibold' : 'font-medium')}>{g.name}</span>
                <span className={cn('mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm leading-tight', 'text-muted-foreground')}>
                  {g.steps.map((s, k) => (
                    <span key={s} className="flex items-center gap-1.5">{k > 0 && <span aria-hidden className="opacity-50">|</span>}{s}</span>
                  ))}
                </span>
              </span>
            </a>
          </li>
        )
      })}
    </ol>
  )
}
