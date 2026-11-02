import { cn } from '@/lib/utils'

/** 작은 추세선. invert면 값이 작을수록 위 (순위). */
export function Sparkline({ values, invert, min, max, tone = 'main', w = 96, h = 28 }: { values: number[]; invert?: boolean; min?: number; max?: number; tone?: 'main' | 'ctx'; w?: number; h?: number }) {
  const pad = 3
  let lo = min ?? Math.min(...values), hi = max ?? Math.max(...values)
  if (hi === lo) { hi += 1; lo -= 1 }
  const d = values.map((v, i) => {
    const x = pad + (w - 2 * pad) * (values.length === 1 ? 1 : i / (values.length - 1))
    const t = (v - lo) / (hi - lo)
    const y = invert ? pad + (h - 2 * pad) * t : h - pad - (h - 2 * pad) * t
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join('')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="inline-block align-middle">
      <path d={d} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={tone === 'main' ? 'stroke-primary' : 'stroke-muted-foreground'} />
    </svg>
  )
}

/** 0을 가운데 두는 막대 (표 안에서 변화율을 한눈에) */
export function ZBar({ v, range }: { v: number; range: number }) {
  const w = Math.min(50, (Math.abs(v) / range) * 50)
  return (
    <span aria-hidden className="relative mr-3 inline-block h-2 w-24 align-middle">
      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-border" />
      <span className={cn('absolute inset-y-0 rounded-full', v >= 0 ? 'left-1/2 bg-primary' : 'right-1/2 bg-muted-foreground/60')} style={{ width: `${w}%` }} />
    </span>
  )
}

export function Tone({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'neutral' | 'primary'; children: React.ReactNode }) {
  const c = {
    good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    bad: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    neutral: 'bg-muted text-muted-foreground',
    primary: 'bg-accent text-accent-foreground',
  }[tone]
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', c)}>{children}</span>
}
