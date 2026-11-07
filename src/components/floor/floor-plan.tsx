import { useMemo, useState } from 'react'
import { CAMERA, CELL, DOOR, FIXTURES, MERGED_SHOWCASE, PLAN_H, PLAN_W, ZONES, heatCells, type FloorMetrics, type Track, type ZoneId } from '@/lib/floor'
import { cn } from '@/lib/utils'

export type FloorMode = 'tracks' | 'flow' | 'heat'
const S = 80 // 1미터 = 80px
const M = 10
const X = (m: number) => M + m * S
const Y = (m: number) => M + m * S
const W = PLAN_W * S + 2 * M
const H = PLAN_H * S + 2 * M + 22

type ZoneMap = typeof ZONES
const center = (z: ZoneId, zones: ZoneMap) => { const r = zones[z].rect; return { x: r.x + r.w / 2, y: r.y + r.h / 2 } }

function interp(tr: Track, t: number) {
  const p = tr.pts
  let lo = 0, hi = p.length - 1
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (p[mid].t <= t) lo = mid; else hi = mid }
  const a = p[lo], b = p[hi]
  const u = b.t === a.t ? 0 : Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)))
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, i: lo }
}

export function FloorPlan({ tracks, metrics, mode, clock, zoneInfo, merged = false }: {
  tracks: Track[]; metrics: FloorMetrics; mode: FloorMode; clock: number | null; zoneInfo: Record<ZoneId, string[]>
  /** true면 신제품 구역을 따로 지정하지 않은 상태: 쇼케이스 앞 한 구역으로 그린다 */
  merged?: boolean
}) {
  const Z: ZoneMap = merged ? { ...ZONES, showcase: { ...ZONES.showcase, label: '쇼케이스 앞 (신제품 구역 미지정)', rect: MERGED_SHOWCASE } } : ZONES
  const [hover, setHover] = useState<ZoneId | null>(null)
  const heat = useMemo(() => heatCells(metrics), [metrics])
  const maxFlow = Math.max(1, ...metrics.flows.map((f) => f.n))

  const wedge = useMemo(() => {
    const a0 = Math.atan2(CAMERA.dirY, CAMERA.dirX)
    const pts = [`${X(CAMERA.x)},${Y(CAMERA.y)}`]
    for (let i = 0; i <= 24; i++) {
      const a = a0 - CAMERA.fov / 2 + (CAMERA.fov * i) / 24
      pts.push(`${X(CAMERA.x + Math.cos(a) * CAMERA.range)},${Y(CAMERA.y + Math.sin(a) * CAMERA.range)}`)
    }
    return pts.join(' ')
  }, [])

  const active = clock == null ? [] : tracks.filter((t) => t.t0 <= clock && t.t1 >= clock)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
        aria-label={`매장 도면. 가상 카메라 1대. ${mode === 'tracks' ? '가상 개인 동선' : mode === 'flow' ? '존 사이 이동 흐름' : '체류 시간 히트맵'}을 보여 줍니다`}>
        <defs>
          <clipPath id="plan-clip"><rect x={X(0)} y={Y(0)} width={PLAN_W * S} height={PLAN_H * S} /></clipPath>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--primary)" /></marker>
        </defs>

        {/* 바닥 */}
        <rect x={X(0)} y={Y(0)} width={PLAN_W * S} height={PLAN_H * S} rx={10} fill="var(--muted)" fillOpacity={0.55} />
        {/* 카메라 시야 */}
        <g clipPath="url(#plan-clip)"><polygon points={wedge} fill="var(--primary)" fillOpacity={0.06} stroke="var(--primary)" strokeOpacity={0.35} strokeDasharray="5 5" /></g>

        {/* 설비 */}
        {FIXTURES.filter((f) => !(merged && f.id === 'pop')).map((f) => (
          <g key={f.id} pointerEvents="none">
            {f.round
              ? <circle cx={X(f.rect.x + f.rect.w / 2)} cy={Y(f.rect.y + f.rect.h / 2)} r={(f.rect.w * S) / 2} fill="var(--card)" stroke="var(--border)" strokeWidth={1.5} />
              : <rect x={X(f.rect.x)} y={Y(f.rect.y)} width={f.rect.w * S} height={f.rect.h * S} rx={f.id === 'pop' ? 6 : 7} fill={f.id === 'pop' ? 'var(--chart-1)' : 'var(--card)'} stroke={f.id === 'pop' ? 'var(--chart-1)' : 'var(--border)'} strokeWidth={1.5} />}
            {f.label && f.id !== 'pop' && f.id !== 'pos' && f.id !== 'kiosk' && f.id !== 'freezer' && (
              <text x={X(f.rect.x + f.rect.w / 2)} y={Y(f.rect.y + f.rect.h / 2) + 4} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{f.label}</text>
            )}
          </g>
        ))}
        {/* 존 */}
        {(Object.keys(Z) as ZoneId[]).filter((z) => !(merged && z === 'pop')).map((z) => {
          const r = Z[z].rect, on = hover === z
          return (
            <g key={z} onMouseEnter={() => setHover(z)} onMouseLeave={() => setHover(null)}>
              <rect x={X(r.x)} y={Y(r.y)} width={r.w * S} height={r.h * S} rx={8} fill={Z[z].color} fillOpacity={on ? 0.24 : z === 'pop' ? 0.16 : 0.09} stroke={Z[z].color} strokeOpacity={on ? 0.9 : 0.5} strokeWidth={on ? 2 : 1.25} strokeDasharray={z === 'pop' ? undefined : '4 4'} />
              <text x={X(r.x) + 8} y={Y(r.y) + 17} fontSize={12} fontWeight={z === 'pop' ? 700 : 600} fill="var(--foreground)" fillOpacity={0.8}>{z === 'pop' ? '신제품 구역 (가정)' : Z[z].label}</text>
              {z === 'pop' && (
                <g pointerEvents="none">
                  <circle cx={X(r.x + 1.75)} cy={Y(r.y + 0.62)} r={11} fill="var(--card)" stroke={Z[z].color} strokeWidth={2} />
                  <text x={X(r.x + 1.75)} y={Y(r.y + 0.62) + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={Z[z].color}>통</text>
                </g>
              )}
            </g>
          )
        })}

        <text x={X(11.4)} y={Y(4.65)} fontSize={11} fill="var(--muted-foreground)" textAnchor="middle" transform={`rotate(-90 ${X(11.4)} ${Y(4.65)})`} pointerEvents="none">POS</text>
        <text x={X(0.55)} y={Y(3.1)} fontSize={11} fill="var(--muted-foreground)" textAnchor="middle" transform={`rotate(-90 ${X(0.55)} ${Y(3.1)})`} pointerEvents="none">냉동고</text>
        <text x={X(11.5)} y={Y(6.65) + 3} fontSize={10} fill="var(--muted-foreground)" textAnchor="middle" pointerEvents="none">키오스크</text>

        {/* 벽과 출입문 */}
        <path d={`M${X(0)} ${Y(PLAN_H)} L${X(0)} ${Y(0)} L${X(PLAN_W)} ${Y(0)} L${X(PLAN_W)} ${Y(PLAN_H)} L${X(DOOR.x2)} ${Y(PLAN_H)} M${X(DOOR.x1)} ${Y(PLAN_H)} L${X(0)} ${Y(PLAN_H)}`} fill="none" stroke="var(--foreground)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <text x={X((DOOR.x1 + DOOR.x2) / 2)} y={Y(PLAN_H) + 17} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--muted-foreground)">출입문 (거리 쪽)</text>

        {/* 가상 카메라 */}
        <g pointerEvents="none">
          <rect x={X(CAMERA.x) - 9} y={Y(CAMERA.y) - 9} width={18} height={18} rx={5} fill="var(--primary)" />
          <circle cx={X(CAMERA.x)} cy={Y(CAMERA.y)} r={3.5} fill="var(--primary-foreground)" />
          <text x={X(CAMERA.x) - 14} y={Y(CAMERA.y) + 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--primary)">가상 카메라 1</text>
        </g>

        {/* 보기: 히트맵 */}
        {mode === 'heat' && (
          <g pointerEvents="none">
            {heat.map((c, i) => <rect key={i} x={X(c.x)} y={Y(c.y)} width={CELL * S - 1} height={CELL * S - 1} rx={3} fill="var(--primary)" fillOpacity={0.08 + 0.82 * Math.pow(c.v, 0.6)} />)}
          </g>
        )}

        {/* 보기: 존 간 흐름 */}
        {mode === 'flow' && (
          <g pointerEvents="none">
            {metrics.flows.filter((f) => f.n >= 2 && f.from !== f.to).map((f) => {
              const a = center(f.from, Z), b = center(f.to, Z)
              const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1
              const nx = -dy / len, ny = dx / len
              const sh = 0.55, off = 0.12
              const x1 = X(a.x + (dx / len) * sh + nx * off), y1 = Y(a.y + (dy / len) * sh + ny * off)
              const x2 = X(b.x - (dx / len) * sh + nx * off), y2 = Y(b.y - (dy / len) * sh + ny * off)
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
              return (
                <g key={f.from + f.to}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--primary)" strokeOpacity={0.55} strokeWidth={1.5 + (f.n / maxFlow) * 8} strokeLinecap="round" markerEnd="url(#arr)" />
                  <rect x={mx - 13} y={my - 10} width={26} height={20} rx={10} fill="var(--card)" stroke="var(--primary)" strokeOpacity={0.5} />
                  <text x={mx} y={my + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--foreground)" className="num">{f.n}</text>
                </g>
              )
            })}
          </g>
        )}

        {/* 보기: 개인 동선 (가상) */}
        {mode === 'tracks' && (
          <g clipPath="url(#plan-clip)" pointerEvents="none" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {tracks.map((tr) => (
              <polyline key={tr.id} points={tr.pts.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}
                stroke={tr.outcome === 'buy' ? 'var(--primary)' : 'var(--bad)'} strokeWidth={1.6} strokeOpacity={clock == null ? 0.38 : 0.12} />
            ))}
            {active.map((tr) => {
              const cur = interp(tr, clock as number)
              const from = Math.max(0, cur.i - 40)
              const trail = [...tr.pts.slice(from, cur.i + 1), { t: 0, x: cur.x, y: cur.y }].map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
              const c = tr.outcome === 'buy' ? 'var(--primary)' : 'var(--bad)'
              return (
                <g key={tr.id}>
                  <polyline points={trail} stroke={c} strokeWidth={2.6} strokeOpacity={0.8} />
                  <circle cx={X(cur.x)} cy={Y(cur.y)} r={6} fill={c} stroke="var(--card)" strokeWidth={2} />
                </g>
              )
            })}
          </g>
        )}
      </svg>

      {hover && (
        <div className="pointer-events-none absolute top-3 right-3 z-10 w-52 rounded-2xl border border-border bg-popover p-3 text-xs shadow-xl">
          <p className="mb-1 flex items-center gap-2 font-semibold"><i className="size-2.5 rounded-full" style={{ background: Z[hover].color }} />{hover === 'pop' ? '신제품 구역 (가정)' : Z[hover].label}</p>
          {zoneInfo[hover].map((l, i) => <p key={i} className="text-muted-foreground">{l}</p>)}
        </div>
      )}
    </div>
  )
}

export function FloorLegend({ mode, merged = false }: { mode: FloorMode; merged?: boolean }) {
  const item = (c: string, t: string) => <span className="flex items-center gap-2"><i className={cn('h-0.5 w-5 rounded-full', c)} />{t}</span>
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      {mode === 'tracks' && <>{item('bg-primary', '구매까지 간 동선')}{item('bg-bad', '사지 않고 나간 동선')}</>}
      {mode === 'flow' && <span>화살표가 굵을수록 그 존으로 옮겨 간 사람이 많습니다. 숫자는 표본 안의 인원입니다.</span>}
      {mode === 'heat' && <span>진할수록 그 자리(0.5m 칸)에 오래 머물렀습니다. 실제 매장에서 본사로 가는 집계 형태입니다.</span>}
      <span className="flex items-center gap-2"><i className="size-3 rounded-sm bg-primary" />가상 카메라와 시야각</span>
      {!merged && <span className="flex items-center gap-2"><i className="grid size-3.5 place-items-center rounded-full border-2 border-[var(--chart-1)] text-[8px] font-bold" />신제품 통 (매장에서 지정, 가정)</span>}
    </div>
  )
}
