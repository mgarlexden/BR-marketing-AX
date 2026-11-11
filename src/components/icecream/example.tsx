import { useState } from 'react'
import { cn } from '@/lib/utils'
import { IceCream, type ToppingKind } from '.'

/** 사용 예시: 추천 카드를 누르면 큰 그림의 색과 토핑이 0.3초에 걸쳐 바뀐다 */
const RECS: { name: string; baseColor: string; topping: ToppingKind; toppingColor?: string }[] = [
  { name: '쫀득 엄마는 외계인', baseColor: '#7A4A35', topping: 'mochi', toppingColor: '#FAF6EF' },
  { name: '말차 흑임자', baseColor: '#8DAA5B', topping: 'chocochip', toppingColor: '#2F2A2A' },
  { name: '유자 꿀 셔벗', baseColor: '#FFD45A', topping: 'none' },
]

export function IceCreamExample() {
  const [pick, setPick] = useState(0)
  const cur = RECS[pick]
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
      <div className="max-w-md">
        <IceCream baseColor={cur.baseColor} topping={cur.topping} toppingColor={cur.toppingColor} title={cur.name} />
      </div>
      <ul className="flex flex-col gap-2">
        {RECS.map((r, i) => (
          <li key={r.name}>
            <button type="button" onClick={() => setPick(i)} className={cn('flex w-full items-center gap-3 rounded-2xl border bg-card p-2 text-left text-sm font-bold', i === pick ? 'picked' : 'border-border')}>
              <IceCream fit="tight" baseColor={r.baseColor} topping={r.topping} toppingColor={r.toppingColor} className="size-12" />
              {r.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
