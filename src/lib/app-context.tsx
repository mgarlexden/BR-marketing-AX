import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { build, SCENARIOS, type Data } from './data'
import type { Approvals } from './derived'

export type RouteId = 'brief' | 'where' | 'why' | 'decisions' | 'trend' | 'privacy'
export const ROUTE_TITLES: Record<RouteId, string> = {
  brief: '출시 현황', where: '매장 반응 분석', why: '매장 동선 분석', decisions: '의사결정 관리', trend: '트렌드 레이더', privacy: '개인정보 보호',
}
const GLOBAL = ['launch']

type Q = Record<string, string>
type Patch = Record<string, string | number | null | undefined>

interface Ctx {
  route: RouteId; q: Q; day: number; launch: string; data: Data
  appr: Approvals; setAppr: (key: string, val: Approvals[string] | null) => void; clearAppr: () => void
  setQ: (patch: Patch) => void; go: (route: RouteId, patch?: Patch) => void; href: (route: RouteId, patch?: Patch) => string
  dark: boolean; toggleDark: () => void
}
const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp must be used within AppProvider')
  return c
}

function parse(): { route: RouteId; q: Q } {
  const h = location.hash.replace(/^#\/?/, '')
  const qi = h.indexOf('?')
  const name = (qi < 0 ? h : h.slice(0, qi)) || 'brief'
  const route = (name in ROUTE_TITLES ? name : 'home') as RouteId
  const q: Q = {}
  if (qi >= 0) new URLSearchParams(h.slice(qi + 1)).forEach((v, k) => { q[k] = v })
  if (!['a', 'b', 'c'].includes(q.launch)) q.launch = 'a'
  return { route, q }
}

const APPR_KEY = 'br-store-module-approvals-v4'
function loadAppr(): Approvals { try { return JSON.parse(localStorage.getItem(APPR_KEY) || '{}') || {} } catch { return {} } }

export function AppProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState(parse)
  const [appr, setApprState] = useState<Approvals>(loadAppr)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    if (!location.hash) history.replaceState(null, '', '#/brief?launch=a')
    const f = () => setSt(parse())
    f()
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  const build_ = useCallback((route: RouteId, patch: Patch | undefined, keepPage: boolean) => {
    const q: Q = {}
    Object.entries(st.q).forEach(([k, v]) => { if (GLOBAL.includes(k) || keepPage) q[k] = v })
    Object.entries(patch || {}).forEach(([k, v]) => { if (v === '' || v == null) delete q[k]; else q[k] = String(v) })
    const qs = new URLSearchParams(q).toString()
    return `#/${route}${qs ? '?' + qs : ''}`
  }, [st])

  const href = useCallback((route: RouteId, patch?: Patch) => build_(route, patch, route === st.route), [build_, st.route])
  const go = useCallback((route: RouteId, patch?: Patch) => { location.hash = build_(route, patch, false) }, [build_])
  const setQ = useCallback((patch: Patch) => {
    history.replaceState(null, '', build_(st.route, patch, true))
    setSt(parse())
  }, [build_, st.route])

  const setAppr = useCallback((key: string, val: Approvals[string] | null) => {
    setApprState((prev) => {
      const next = { ...prev }
      if (val == null) delete next[key]; else next[key] = val
      try { localStorage.setItem(APPR_KEY, JSON.stringify(next)) } catch { /* 저장이 막혀도 동작한다 */ }
      return next
    })
  }, [])
  const clearAppr = useCallback(() => {
    setApprState({})
    try { localStorage.removeItem(APPR_KEY) } catch { /* noop */ }
  }, [])

  const toggleDark = useCallback(() => {
    setDark((d) => {
      const n = !d
      document.documentElement.classList.toggle('dark', n)
      try { localStorage.setItem('br-theme', n ? 'dark' : 'light') } catch { /* noop */ }
      return n
    })
  }, [])

  const launch = st.q.launch
  const data = useMemo(() => build(launch), [launch])
  const value: Ctx = {
    route: st.route, q: st.q, day: SCENARIOS[launch as 'a'].today, launch, data, appr, setAppr, clearAppr,
    setQ, go, href, dark, toggleDark,
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
