import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppProvider, ROUTE_TITLES, useApp, type RouteId } from '@/lib/app-context'
import { Shell } from '@/components/layout/shell'
import { ErrorBoundary, PageSkeleton } from '@/components/page'

const PAGES: Record<RouteId, React.LazyExoticComponent<() => React.JSX.Element>> = {
  decide: lazy(() => import('@/pages/decide')),
  react: lazy(() => import('@/pages/react')),
  feedback: lazy(() => import('@/pages/feedback')),
  radar: lazy(() => import('@/pages/trend')),
  privacy: lazy(() => import('@/pages/privacy')),
}

function Routes() {
  const { route, launch } = useApp()
  document.title = `${ROUTE_TITLES[route]} | 매장 데이터 | 배라 AX`
  const Page = PAGES[route]
  return (
    <ErrorBoundary resetKey={route + launch}>
      <Suspense fallback={<PageSkeleton />}><Page /></Suspense>
    </ErrorBoundary>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <Shell><Routes /></Shell>
    </AppProvider>
  </StrictMode>,
)
