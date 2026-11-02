import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/page'

/** 자리표시자. 다른 팀원이 개발 중인 기능이 들어올 자리입니다. */
export default function Trend() {
  return (
    <div>
      <PageHeader title="트렌드 레이더" product={false} />
      <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card p-8 text-center">
        <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Construction className="size-6" /></div>
        <p className="font-semibold">준비 중인 기능입니다</p>
        <p className="max-w-md text-sm text-muted-foreground">다른 팀원이 개발하고 있으며, 완성되면 이 자리에 연결합니다.</p>
      </div>
    </div>
  )
}
