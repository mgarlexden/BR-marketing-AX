import { cn } from '@/lib/utils'
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('rounded-2xl bg-muted', className)} />
