import { DIR_LABEL, type Dir } from '@/lib/data'
import type { StoreStatus } from '@/lib/derived'
import { cn } from '@/lib/utils'

/** 재고 방향별 색. 전국 확대는 브랜드색, 부분 확대는 호박색, 축소는 장미색, 유지와 관찰은 회색. */
const DIR_STYLE: Record<Dir, { chip: string; bar: string }> = {
  expand: { chip: 'bg-primary text-primary-foreground', bar: 'bg-primary' },
  maintain: { chip: 'bg-muted text-foreground', bar: 'bg-muted-foreground/45' },
  fix: { chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200', bar: 'bg-amber-400' },
  wrap: { chip: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200', bar: 'bg-rose-400' },
  wait: { chip: 'bg-muted text-muted-foreground', bar: 'bg-border' },
}

export function DirChip({ dir, className }: { dir: Dir; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold', DIR_STYLE[dir].chip, className)}>{DIR_LABEL[dir]}</span>
}

const TONE: Record<StoreStatus['tone'], string> = {
  bad: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  primary: 'bg-accent text-accent-foreground',
  good: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  neutral: 'bg-muted text-muted-foreground',
}
export function Pill({ tone, children, className }: { tone: StoreStatus['tone']; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', TONE[tone], className)}>{children}</span>
}

