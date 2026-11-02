import * as React from 'react'
import { cn } from '@/lib/utils'

/** rounded-3xl 카드. tone: 기본 / 흐린 바탕 / 어두운 강조 / 브랜드 강조 */
export type CardTone = 'default' | 'dark' | 'primary' | 'muted'
const TONES: Record<CardTone, string> = {
  default: 'bg-card text-card-foreground border border-border',
  muted: 'bg-muted/60 text-card-foreground border border-border',
  dark: 'bg-zinc-900 text-white shadow-lg dark:bg-secondary dark:border dark:border-border',
  primary: 'bg-primary text-primary-foreground shadow-lg',
}

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { tone?: CardTone }>(
  ({ className, tone = 'default', ...props }, ref) => (
    <div ref={ref} className={cn('min-w-0 rounded-3xl p-6', TONES[tone], className)} {...props} />
  ),
)
Card.displayName = 'Card'

export function CardHeader({ className, title, description, right, ...props }: Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & { title?: React.ReactNode; description?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)} {...props}>
      <div className="min-w-0">
        {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {right}
    </div>
  )
}
