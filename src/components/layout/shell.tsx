import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ClipboardCheck, LayoutDashboard, MapPinned, Menu, Moon, PanelLeftClose, PanelLeftOpen, ScanEye, ShieldCheck, Sun, TrendingUp, X } from 'lucide-react'
import { useApp, type RouteId } from '@/lib/app-context'
import { pending } from '@/lib/derived'
import { cn } from '@/lib/utils'

const NAV: { id: RouteId; label: string; icon: typeof ScanEye }[] = [
  { id: 'brief', label: '출시 현황', icon: LayoutDashboard },
  { id: 'where', label: '매장 반응 분석', icon: MapPinned },
  { id: 'why', label: '매장 동선 분석', icon: ScanEye },
  { id: 'decisions', label: '의사결정 관리', icon: ClipboardCheck },
  { id: 'trend', label: '트렌드 레이더', icon: TrendingUp },
]

function Sidebar({ open, onClose, pendingCount, collapsed, onToggle }: { open: boolean; onClose: () => void; pendingCount: number; collapsed: boolean; onToggle: () => void }) {
  const { route, href, clearAppr } = useApp()
  const item = (id: RouteId, label: string, Icon: typeof ScanEye, badge?: number) => {
    const on = route === id
    return (
      <a key={id} href={href(id)} aria-current={on ? 'page' : undefined} onClick={onClose} title={collapsed ? label : undefined}
        className={cn('relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          on ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60')}>
        <Icon className="size-4 shrink-0" />
        <span className={cn('flex-1', collapsed && 'lg:hidden')}>{label}</span>
        {!!badge && <span className={cn('num min-w-5 rounded-md bg-primary px-1.5 text-center text-[11px] font-bold leading-5 text-primary-foreground', collapsed && 'lg:absolute lg:right-0.5 lg:top-0.5 lg:min-w-4 lg:px-1 lg:text-[10px] lg:leading-4')}>{badge}</span>}
      </a>
    )
  }
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside id="sidebar" aria-label="메뉴"
        className={cn('fixed inset-y-0 left-0 z-50 flex w-56 flex-col gap-5 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-transform motion-reduce:transition-none lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:translate-x-0 lg:shrink-0',
          collapsed ? 'lg:w-[4.25rem] lg:px-2.5' : '',
          open ? 'translate-x-0' : '-translate-x-full')}>
        <div className={cn('flex items-center px-1 pt-1', collapsed ? 'justify-between lg:justify-center' : 'justify-end')}>
          <button type="button" onClick={onToggle} aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'} aria-expanded={!collapsed} className="hidden size-9 place-items-center rounded-lg text-muted-foreground hover:bg-sidebar-accent active:translate-y-px disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid">
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
          <button type="button" onClick={onClose} aria-label="메뉴 닫기" className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"><X className="size-5" /></button>
        </div>
        <nav aria-label="메뉴" className="flex flex-col gap-0.5">
          {NAV.map((n) => item(n.id, n.label, n.icon, n.id === 'decisions' ? pendingCount : undefined))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-sidebar-border pt-3">
          {item('privacy', '개인정보 보호', ShieldCheck)}
          <p className={cn('px-3 text-xs leading-relaxed text-muted-foreground', collapsed && 'lg:hidden')}>영상과 개인 ID 없이 존 단위 집계값만 사용합니다.</p>
          <button type="button" onClick={clearAppr} className={cn('px-3 text-left text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', collapsed && 'lg:hidden')}>의사결정 기록 지우기</button>
        </div>
      </aside>
    </>
  )
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { dark, toggleDark, href } = useApp()
  const FR = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="flex items-center gap-x-4 px-4 py-2.5 lg:px-6">
        <button type="button" onClick={onMenu} aria-label="메뉴 열기" aria-expanded="false" aria-controls="sidebar" className={cn('grid size-9 place-items-center rounded-lg border border-input bg-card active:translate-y-px disabled:opacity-50 lg:hidden', FR)}><Menu className="size-5" /></button>
        <a href={href('brief')} aria-label="배스킨라빈스 출시 현황" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><img src={`${import.meta.env.BASE_URL}br-logo.png`} alt="배스킨라빈스 로고" className="h-9 w-auto" /></a>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span role="status" title="합성 데이터, 정확도 미검증" className="whitespace-nowrap rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground"><span className="sm:hidden">합성 데이터</span><span className="hidden sm:inline">합성 데이터, 정확도 미검증</span></span>
          <button type="button" onClick={toggleDark} aria-label={dark ? '라이트 모드' : '다크 모드'} className={cn('grid size-9 place-items-center rounded-lg border border-input bg-card hover:bg-accent active:translate-y-px disabled:opacity-50', FR)}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { data, day, appr } = useApp()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('br-sidebar-collapsed') === '1' } catch { return false } })
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem('br-sidebar-collapsed', c ? '0' : '1') } catch { /* 저장 못 해도 동작 */ } return !c })
  const pend = useMemo(() => pending(data, day, appr), [data, day, appr])
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1760px]">
      <Sidebar open={open} onClose={() => setOpen(false)} pendingCount={pend.count} collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-5 pb-12 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
