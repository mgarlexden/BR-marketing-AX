import type { Art } from '@/lib/flavor-trends'
import { IceCream } from '@/components/icecream'
import { cn } from '@/lib/utils'

/** 트렌드·조합 데이터(Art)를 IceCream 그림으로 옮긴다. 화면에서는 여백을 잘라(tight) 높이로 크기를 정한다 */
export function Scoop({ art, className }: { art: Art; className?: string; small?: boolean }) {
  return (
    <IceCream
      fit="tight"
      baseColor={art.scoop}
      topping={art.bit === 'round' ? 'mochi' : 'chocochip'}
      toppingColor={art.bits}
      cupColor={art.cup}
      className={cn('w-auto', className)}
    />
  )
}
