import { Component, createContext, useContext, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** 왼쪽 메뉴 탭(트렌드, 매장 반응, 환류)의 제목과 한 줄 설명. 설명은 20자 이내로 쓴다 */
export function TabTitle({ title, desc, badge, children }: { title: string; desc?: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight">{title}{badge}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </header>
  )
}

/** 다른 화면 안에 탭으로 들어갈 때는 제목과 루프 띠를 숨기고 오른쪽 조작만 남긴다 */
export const EmbeddedCtx = createContext(false)

export function PageHeader({ title, sub, right, basis, loop }: { title: string; sub?: ReactNode; right?: ReactNode; basis?: { level: string; why: string }; loop?: number[] }) {
  const embedded = useContext(EmbeddedCtx)
  if (embedded) return right ? <div className="mb-3 flex flex-wrap items-center justify-end gap-2">{right}</div> : null
  if (loop) {
    return (
      <TabTitle title={title} desc={sub} badge={basis && <span title={basis.why} className="cursor-help rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">근거 {basis.level}</span>}>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </TabTitle>
    )
  }
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {basis && <span title={basis.why} className="cursor-help rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">근거 {basis.level}</span>}
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {sub && <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">{sub}</p>}
    </header>
  )
}

/** 기준과 계산 방식은 접어 둔다 */
export function HowTo({ title = '기준', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="group mt-5 text-sm">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-full border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground active:translate-y-px disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{title}</summary>
      <div className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">{children}</div>
    </details>
  )
}

export function EmptyState({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/70 px-5 py-4">
      <p className="text-sm font-medium">{title}</p>
      {action && <Button variant="outline" size="sm" onClick={action.onClick}>{action.label}</Button>}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">불러오는 중</span>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64 rounded-3xl lg:col-span-2" /><Skeleton className="h-64 rounded-3xl" /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
    </div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey }
  static getDerivedStateFromError(error: Error) { return { error } }
  static getDerivedStateFromProps(p: { resetKey: string }, s: { key: string }) { return p.resetKey !== s.key ? { error: null, key: p.resetKey } : null }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-3xl border border-border bg-card p-6">
        <p className="font-semibold text-destructive">이 화면을 그리지 못했습니다</p>
        <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>다시 시도</Button>
      </div>
    )
  }
}

export function Stat({ label, value, note, className }: { label: string; value: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('num mt-0.5 text-2xl font-bold tracking-tighter')}>{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
