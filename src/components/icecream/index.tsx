import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import cupSvg from './cup.svg?raw'
import baseSvg from './base.svg?raw'
import './icecream.css'

/** 이 폴더의 topping-<종류>.svg를 모두 읽는다. 파일을 추가하면 그 이름이 바로 topping 값으로 쓰인다 (예: topping-kadaif.svg → 'kadaif') */
const TOPPING_FILES = import.meta.glob('./topping-*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const TOPPING_SVG: Record<string, string> = Object.fromEntries(Object.entries(TOPPING_FILES).map(([path, svg]) => [path.match(/topping-(.+)\.svg$/)![1], svg]))
/** 파일이 없는 종류가 오면 이 모양에 색만 바꿔 보여 준다 */
export const DEFAULT_TOPPING = 'chocochip'
export const TOPPING_KINDS = Object.keys(TOPPING_SVG)
export type ToppingKind = 'chocochip' | 'mochi' | 'none' | (string & {})

/** 'frame'은 원본 416×401 그대로, 'tight'는 아이스크림만 보이게 여백을 잘라 작은 자리에서 쓴다 */
export type IceCreamFit = 'frame' | 'tight'
const VIEWBOX: Record<IceCreamFit, { box: string; ratio: string }> = {
  frame: { box: '0 0 416 401', ratio: '416 / 401' },
  tight: { box: '104 116 204 224', ratio: '204 / 224' },
}

/** 배경 rect(#F5F5F5)를 지우고, 맞춤 방식에 따라 viewBox를 바꾼다 */
const prepare = (svg: string, fit: IceCreamFit) =>
  svg.replace(/<rect[^>]*fill="#F5F5F5"[^>]*\/>\s*/i, '').replace(/viewBox="[^"]*"/, `viewBox="${VIEWBOX[fit].box}"`)
const cache = new Map<string, string>()
const prepared = (key: string, svg: string, fit: IceCreamFit) => {
  const k = `${key}:${fit}`
  if (!cache.has(k)) cache.set(k, prepare(svg, fit))
  return cache.get(k)!
}

export interface IceCreamProps {
  /** 베이스 아이스크림 색 (base-color-1, base-color-2를 칠함) */
  baseColor: string
  /** 토핑 종류. 'none'이면 토핑을 숨긴다 */
  topping?: ToppingKind
  /** 토핑 색. 없으면 SVG 파일에 있는 색 그대로 */
  toppingColor?: string
  /** 컵 몸통 색. 없으면 원래 자주색 */
  cupColor?: string
  fit?: IceCreamFit
  /** 화면 읽기 프로그램에 읽힐 이름. 없으면 장식으로 본다 */
  title?: string
  className?: string
}

/** 컵 → 베이스 → 토핑 순으로 SVG 세 장을 겹친 아이스크림. 폭은 부모를 따라가고 비율은 유지한다. 색은 0.3초에 걸쳐 바뀐다 */
export function IceCream({ baseColor, topping = DEFAULT_TOPPING, toppingColor, cupColor, fit = 'frame', title, className }: IceCreamProps) {
  const hidden = topping === 'none'
  const kind = TOPPING_SVG[topping] ? topping : DEFAULT_TOPPING
  const style = {
    aspectRatio: VIEWBOX[fit].ratio,
    '--ic-base': baseColor,
    '--ic-topping': toppingColor,
    '--ic-cup': cupColor,
  } as CSSProperties
  return (
    <div
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('icecream relative w-full', className)}
      style={style}
      data-topping-color={toppingColor ? '' : undefined}
      data-cup={cupColor ? '' : undefined}
    >
      <div className="ic-layer" dangerouslySetInnerHTML={{ __html: prepared('cup', cupSvg, fit) }} />
      <div className="ic-layer" dangerouslySetInnerHTML={{ __html: prepared('base', baseSvg, fit) }} />
      <div className="ic-layer" style={{ opacity: hidden ? 0 : 1 }} dangerouslySetInnerHTML={{ __html: prepared(kind, TOPPING_SVG[kind], fit) }} />
    </div>
  )
}
