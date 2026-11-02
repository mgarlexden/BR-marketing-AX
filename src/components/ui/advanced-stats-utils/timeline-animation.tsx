'use client'
import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** 화면에 들어올 때 한 번 아래에서 떠오르는 등장 효과. 모션 줄이기 설정이면 바로 보인다. */
export function TimelineAnimation({
  animationNum = 0,
  timelineRef,
  className,
  children,
}: {
  animationNum?: number
  timelineRef?: React.RefObject<HTMLElement | null>
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !ref.current || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { root: timelineRef?.current && timelineRef.current.scrollHeight > timelineRef.current.clientHeight ? timelineRef.current : null, threshold: 0.05 },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [timelineRef])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${Math.min(animationNum, 8) * 60}ms` : '0ms' }}
      className={cn(
        'transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
