import { cn } from '@/lib/utils'

/** 둥근 홈에 흰 알약이 올라타는 선택 컨트롤 (1W 1M 1Y, Slow Normal Fast 같은 형태) */
export function Segmented<T extends string | number>({ value, options, onChange, label, className, onDark }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; className?: string; onDark?: boolean
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex flex-wrap gap-0.5 rounded-full border p-0.5', onDark ? 'border-white/15 bg-white/5' : 'border-border bg-muted', className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={String(o.value)} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={cn('h-8 rounded-full px-3.5 text-xs font-semibold transition-colors active:translate-y-px',
              on ? (onDark ? 'bg-white text-zinc-900' : 'bg-card text-foreground shadow-sm') : (onDark ? 'text-white/60 hover:text-white' : 'text-muted-foreground hover:text-foreground'))}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
