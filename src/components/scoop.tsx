import { useId } from 'react'
import type { Art } from '@/lib/flavor-trends'
import { cn } from '@/lib/utils'

export const ART_BG: Record<Art['bg'], string> = {
  butter: 'bg-flavor-butter', sky: 'bg-flavor-sky', mint: 'bg-flavor-mint', peach: 'bg-flavor-peach', lilac: 'bg-flavor-lilac',
}

/** 토핑 조각 위치. 조합마다 색만 달라진다 */
const BITS = [[70, 72, 14], [98, 56, -18], [128, 70, 30], [84, 96, -30], [116, 98, 12], [142, 96, -12], [60, 104, 24]]

/** 컵에 담긴 아이스크림 그림. 재료 사진이 없어 조합의 색으로 그린다 */
export function Scoop({ art, className }: { art: Art; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 200 210" aria-hidden className={cn('block', className)}>
      <defs>
        <radialGradient id={`${id}s`} cx="36%" cy="26%" r="85%">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".22" />
        </radialGradient>
        <linearGradient id={`${id}c`} x1="0" x2="1">
          <stop offset="0" stopColor="#E9E2E0" /><stop offset=".4" stopColor="#FFFFFF" /><stop offset="1" stopColor="#DAD0CF" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="196" rx="62" ry="8" fill="#000" opacity=".14" />
      <path d="M56 130 L69 188 Q100 198 131 188 L144 130 Z" fill={`url(#${id}c)`} />
      <path d="M58.500 141 L63 161 Q100 171 137 161 L141.500 141 Q100 151 58.500 141 Z" fill="#CF4F8E" />
      <g>
        <path id={`${id}b`} d="M46 124 C36 74 66 32 102 32 C142 32 166 76 154 124 C150 136 142 128 134 134 C126 140 118 130 108 136 C98 142 90 130 80 136 C70 142 64 130 56 134 C50 136 48 132 46 124 Z" fill={art.scoop} />
        <use href={`#${id}b`} fill={`url(#${id}s)`} />
        <path d="M58 84 C72 68 84 92 100 80 C116 68 126 90 146 74" fill="none" stroke={art.ribbon} strokeWidth="9" strokeLinecap="round" />
        <path d="M56 112 C72 98 86 120 102 108 C118 96 130 118 150 104" fill="none" stroke={art.ribbon} strokeWidth="7" strokeLinecap="round" />
        {BITS.map(([x, y, r], i) => <rect key={i} x={x - 6} y={y - 5} width="13" height="11" rx="2" fill={art.bits} stroke="#000" strokeOpacity=".12" transform={`rotate(${r} ${x} ${y})`} />)}
      </g>
    </svg>
  )
}
