import * as React from 'react'
import { cn } from '@/lib/utils'

export const Table = ({ className, wrapperClassName, ...p }: React.HTMLAttributes<HTMLTableElement> & { wrapperClassName?: string }) => (
  <div className={cn('relative w-full overflow-auto', wrapperClassName)}><table className={cn('w-full caption-bottom text-sm', className)} {...p} /></div>
)
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} className={cn('[&_tr]:border-b', p.className)} />
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} className={cn('[&_tr:last-child]:border-0', p.className)} />
export const TR = (p: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...p} className={cn('border-b transition-colors', p.className)} />
export const TH = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...p} className={cn('h-10 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-muted-foreground', className)} />
export const TD = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...p} className={cn('px-3 py-3 align-middle', className)} />
