import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center rounded-[5px] border border-b-2 border-border bg-card px-[7px] py-px font-mono text-[12px] text-foreground',
        className
      )}
    >
      {children}
    </kbd>
  )
}
