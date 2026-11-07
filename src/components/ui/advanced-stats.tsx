'use client'
import { cn } from '@/lib/utils'
import React, { useRef } from 'react'
import { TimelineAnimation } from '@/components/ui/advanced-stats-utils/timeline-animation'

/* 제공된 AdvancedStats 레이아웃을 이 프로젝트용으로 일반화했다.
   구조는 그대로다: 큰 차트 카드, 어두운 목표 카드, 설명 카드, 4칸 KPI 줄.
   고정 문구(Total Revenue 등)는 props로 바꿨고, 대문자 자간 라벨은 한글에 맞게 풀었다. */

export interface Kpi {
  label: string
  /** 라벨 아래 한 줄 설명 */
  hint?: string
  value: string
  change: string
  /** good이면 초록 hover, bad면 빨강 hover. 값이 오르내리는 방향이 아니라 좋고 나쁨을 뜻한다. */
  tone: 'good' | 'bad'
  /** true면 값 자체를 좋고 나쁨 색으로 칠한다 */
  accent?: boolean
  /** 라벨 옆에 붙이는 근거 배지 */
  badge?: React.ReactNode
}

export interface AdvancedStatsProps {
  chart: React.ReactNode
  goal: { label: string; title: string; value: string; target: string; percent: number; note?: React.ReactNode }
  note?: { icon: React.ReactNode; title: string; body: React.ReactNode; action?: React.ReactNode; figure?: React.ReactNode; emphasis?: boolean }
  kpis: Kpi[]
  children?: React.ReactNode
}

export default function AdvancedStats({ chart, goal, note, kpis, children }: AdvancedStatsProps) {
  const timelineRef = useRef<HTMLDivElement>(null)

  return (
    <section ref={timelineRef} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Chart Section */}
        <TimelineAnimation
          animationNum={1}
          timelineRef={timelineRef}
          className="rounded-3xl border border-border bg-card p-6 lg:col-span-2 lg:p-8"
        >
          {chart}
        </TimelineAnimation>

        {/* Breakdown Section */}
        <div className="flex flex-col gap-4 lg:self-start">
          <TimelineAnimation
            animationNum={2}
            timelineRef={timelineRef}
            className="rounded-3xl bg-zinc-900 p-5 text-white shadow-lg dark:border dark:border-border dark:bg-secondary"
          >
            <div>
              <p className="mb-1 text-xs font-semibold text-zinc-400">{goal.label}</p>
              <h4 className="text-xl font-bold tracking-tight">{goal.title}</h4>
              {goal.note && <p className="mt-2 text-sm text-zinc-400">{goal.note}</p>}
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-end justify-between">
                <span className={cn('text-3xl font-semibold tracking-tighter', /^[+−-]?\d/.test(goal.value) && 'num')}>{goal.value}</span>
                <span className="mb-1 text-xs font-medium text-zinc-400">{goal.target}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800 dark:bg-white/10">
                <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(2, Math.min(100, goal.percent))}%` }} />
              </div>
            </div>
          </TimelineAnimation>

          {note && (
          <TimelineAnimation
            animationNum={3}
            timelineRef={timelineRef}
            className={cn('rounded-3xl p-6', note.emphasis ? 'bg-primary text-primary-foreground shadow-lg' : 'border border-border bg-card')}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn('flex size-8 items-center justify-center rounded-lg border', note.emphasis ? 'border-white/25 bg-white/15 text-white' : 'border-border bg-muted text-foreground')}>
                  {note.icon}
                </div>
                <h4 className="font-bold">{note.title}</h4>
              </div>
              {note.figure && <span className="num text-4xl font-bold leading-none tracking-tighter">{note.figure}</span>}
            </div>
            <div className={cn('text-sm', note.emphasis ? 'text-primary-foreground/90' : 'text-muted-foreground')}>{note.body}</div>
            {note.action && <div className="mt-4">{note.action}</div>}
          </TimelineAnimation>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((kpi, index) => (
          <TimelineAnimation
            animationNum={4 + index}
            timelineRef={timelineRef}
            key={kpi.label}
            className={cn(
              'rounded-2xl border border-border bg-card p-5 transition-colors',
              kpi.tone === 'good'
                ? 'hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                : 'hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10',
            )}
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">{kpi.label}{kpi.badge}</p>
            <p className="mb-2 mt-0.5 min-h-8 text-[11px] leading-snug text-muted-foreground/80">{kpi.hint}</p>
            <div className="flex items-baseline justify-between gap-2">
              <p className={cn('text-2xl font-bold tracking-tighter', /^[+−-]?\d/.test(kpi.value) && 'num', kpi.accent && (kpi.tone === 'good' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'))}>{kpi.value}</p>
              <span
                className={cn(
                  'num rounded px-1.5 py-0.5 text-xs font-bold',
                  kpi.tone === 'good'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
                )}
              >
                {kpi.change}
              </span>
            </div>
          </TimelineAnimation>
        ))}
      </div>
      {children}
    </section>
  )
}
