import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** 문장이 한 줄에 들어가도록 칸 폭에 맞춰 글자를 max에서 min까지 줄인다. min으로도 넘치면 그때만 줄바꿈한다 */
export function FitLine({ max, min, className, text, children }: { max: number; min: number; className?: string; text: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState({ size: max, wrap: false })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el?.parentElement) return
    const measure = () => {
      const prev = { fs: el.style.fontSize, ws: el.style.whiteSpace }
      el.style.fontSize = `${max}px`; el.style.whiteSpace = 'nowrap'
      const room = el.clientWidth, need = el.scrollWidth
      el.style.fontSize = prev.fs; el.style.whiteSpace = prev.ws
      const size = need > room ? Math.floor(((max * room) / need) * 2) / 2 : max
      const next = size >= min ? { size, wrap: false } : { size: min, wrap: true }
      setFit((p) => (p.size === next.size && p.wrap === next.wrap ? p : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [max, min, text])
  return <span ref={ref} className={cn('block', className)} style={{ fontSize: fit.size, whiteSpace: fit.wrap ? 'normal' : 'nowrap' }}>{children ?? text}</span>
}

/** 받침이 있으면 a, 없으면 b를 붙인다 (이/가, 은/는). 한글이 아니면 b */
export const josa = (w: string, a: string, b: string) => {
  const c = w.charCodeAt(w.length - 1)
  return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0 ? a : b)
}
/** '으로/로': 받침이 없거나 ㄹ 받침이면 로 */
export const ro = (w: string) => {
  const c = w.charCodeAt(w.length - 1)
  const jong = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0
  return w + (jong && jong !== 8 ? '으로' : '로')
}
