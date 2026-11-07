import { useMemo } from 'react'
import { ArrowRight, Camera, Cpu, Server, ShieldCheck, ShieldX } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { metrics, simInputFor, simulate, windowEvent, WINDOWS } from '@/lib/floor'
import { Card, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { HowTo, PageHeader } from '@/components/page'
import { cn } from '@/lib/utils'

const STEPS = [
  { t: '프레임 읽기', n: '카메라 영상이 매장 엣지 PC로 갑니다.', hq: '없음', store: '프레임 1장 (메모리)' },
  { t: '사람 위치', n: '사람 위치만 찾습니다. 얼굴은 식별하지 않습니다.', hq: '없음', store: '위치 좌표 (메모리)' },
  { t: '존 단위 합산', n: '위치를 존의 진입, 이탈, 체류 이벤트로 바꿉니다.', hq: '없음', store: '존 이벤트 (메모리)' },
  { t: '집계 전송', n: '프레임과 위치는 버리고 집계 이벤트만 보냅니다.', hq: '집계 이벤트', store: '없음' },
]
const EXTRA = [
  { k: 'emb', label: '얼굴 특징값', field: '"face_embedding": [0.12, 0.88, ...]' },
  { k: 'pid', label: '영구 고객 ID', field: '"customer_id": "c-90417"' },
  { k: 'frm', label: '영상 프레임', field: '"frame_jpeg": "/9j/4AAQ..."' },
  { k: 'xy', label: '개인별 이동 좌표', field: '"path_xy": [[1.2, 3.4], [1.3, 3.5]]' },
]

export default function Privacy() {
  const { data: d, day: D, q, setQ } = useApp()
  const step = Math.min(4, Math.max(1, parseInt(q.step, 10) || 4))
  const S = STEPS[step - 1]
  const picked = (q.x || '').split(',').filter(Boolean)
  const extra = EXTRA.filter((e) => picked.includes(e.k))

  const st = d.stores[0]
  const ev = useMemo(() => windowEvent(metrics(simulate(simInputFor(st, st.series[D], 3, false))), st.id, WINDOWS[3].label), [st, D])
  const json = extra.length ? JSON.stringify({ ...ev, ...Object.fromEntries(extra.map((e) => [e.field.split('"')[1], '...'])) }, null, 2) : JSON.stringify(ev, null, 2)

  const node = (on: boolean) => cn('flex flex-1 flex-col items-center gap-1.5 rounded-2xl border p-4 text-center text-sm transition-colors', on ? 'border-primary bg-accent' : 'border-border bg-muted/50')
  return (
    <div>
      <PageHeader title="개인정보 보호" basis={{ level: '강함', why: '법규 근거는 시행령과 안내서 문구를 직접 확인했습니다. 연령·성별 추정은 구간 집계로만 다루며 켜기 전에 법적 확인이 필요합니다.' }} />
      <Card>
        <CardHeader title="데이터가 움직이는 길" right={<Segmented label="단계" value={step} onChange={(v) => setQ({ step: v })} options={STEPS.map((s, i) => ({ value: i + 1, label: `${i + 1}. ${s.t}` }))} />} />
        <div className="flex flex-col items-stretch gap-2.5 md:flex-row md:items-center">
          <div className={node(step === 1)}><Camera className="size-5" /><b>매장 카메라</b></div>
          <ArrowRight className={cn('mx-auto size-5 shrink-0 rotate-90 md:rotate-0', step === 1 ? 'text-primary' : 'text-muted-foreground')} />
          <div className={node(step >= 2)}><Cpu className="size-5" /><b>매장 엣지 PC</b><span className="text-xs text-muted-foreground">저장하지 않음</span></div>
          <ArrowRight className={cn('mx-auto size-5 shrink-0 rotate-90 md:rotate-0', step === 4 ? 'text-primary' : 'text-muted-foreground')} />
          <div className={node(step === 4)}><Server className="size-5" /><b>본사 서버</b><span className="text-xs text-muted-foreground">집계만 수신</span></div>
        </div>
        <p className="mt-4 text-sm" aria-live="polite"><b>{S.t}.</b> <span className="text-muted-foreground">{S.n}</span></p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/60 p-3.5"><dt className="text-xs text-muted-foreground">매장에 있는 것</dt><dd className="mt-0.5 font-semibold">{S.store}</dd></div>
          <div className="rounded-2xl bg-muted/60 p-3.5"><dt className="text-xs text-muted-foreground">본사에 도착한 것</dt><dd className="mt-0.5 font-semibold">{S.hq}</dd></div>
        </dl>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card><CardHeader title="도착하는 것" /><ul className="divide-y divide-border text-sm">{['존 진입과 이탈 횟수', '존 체류 시간 (집계)', '시각, 매장, 존 이름'].map((t) => <li key={t} className="flex items-center gap-2 py-2"><ShieldCheck className="size-4 text-primary" />{t}</li>)}</ul></Card>
        <Card><CardHeader title="도착하지 않는 것" /><ul className="divide-y divide-border text-sm">{['영상, 사진, 잘라낸 이미지', '얼굴 특징값, 영구 ID', '개인별 이동 경로'].map((t) => <li key={t} className="flex items-center gap-2 py-2"><ShieldX className="size-4 text-destructive" />{t}</li>)}</ul></Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="이벤트 검사기" right={<span className="text-xs text-muted-foreground">시연용, 서버로 보내지 않음</span>} />
        <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
          <div role="group" aria-label="추가해 볼 필드" className="flex flex-col">
            {EXTRA.map((e) => {
              const on = picked.includes(e.k)
              return <label key={e.k} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={on} className="size-4 accent-[var(--primary)]" onChange={() => setQ({ x: (on ? picked.filter((x) => x !== e.k) : [...picked, e.k]).join(',') })} />{e.label}</label>
            })}
          </div>
          <div>
            <pre className="max-h-72 overflow-auto rounded-2xl bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100 dark:bg-secondary" tabIndex={0} aria-label="집계 이벤트 예시"><code className="font-mono">{json}</code></pre>
            {extra.length
              ? <p role="status" className="mt-2.5 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><b>수신 거부.</b> {extra.map((e) => e.label).join(', ')}는 허용 필드가 아닙니다.</p>
              : <p role="status" className="mt-2.5 rounded-xl bg-muted px-3.5 py-2.5 text-sm"><b>수신 가능.</b> 정의된 필드만 있습니다.</p>}
          </div>
        </div>
      </Card>

      <HowTo title="법적 근거">
        <p>개인정보 보호법 제25조제1항 제6호, 시행령 제22조(2023년 9월 신설), 개인정보보호위원회 안내서(2024년 12월, 교육청 사본으로 확인). 확인이 필요한 것: 개인 단위 동선이 통계값 예외에 포함되는지, 보안 CCTV와 분석 카메라 겸용, 협업사와의 위탁 구조, 안내판 의무. 법률 자문이 아니며 실제 도입 전에 개인정보위 상담(182)이나 법무 검토가 필요합니다. 도면 화면의 개인별 동선은 합성 시연용이며 실제 매장에서는 매장 PC 밖으로 나가지 않습니다.</p>
      </HowTo>
    </div>
  )
}
