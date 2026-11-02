import { cn } from '@/lib/utils'

/** 출시 후 경과일. 어디서나 같은 색으로 보여 눈에 먼저 들어오게 한다. */
export function Day({ n, className }: { n: number; className?: string }) {
  return <span className={cn('num font-bold text-primary', className)}>D+{n}</span>
}

/** 변화량(%p). 오르면 초록, 내리면 빨강. */
export function Delta({ v, className }: { v: number; className?: string }) {
  const r = Math.round(v * 100)
  return <b className={cn('num', r >= 0 ? 'text-good' : 'text-bad', className)}>{r >= 0 ? '+' : '\u2212'}{Math.abs(r)}%p</b>
}
