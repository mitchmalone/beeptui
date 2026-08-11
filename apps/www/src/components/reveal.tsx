'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Fades + lifts children into view on scroll. Progressive enhancement:
 * renders visible by default (SSR / no-JS safe), and only hides + observes
 * below-the-fold elements when motion is allowed — mirroring the design.
 */
export function Reveal({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: ElementType
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight) return // above fold

    setShown(false)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={cn(
        'transition-all duration-200 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-[7px] opacity-0',
        className
      )}
    >
      {children}
    </Tag>
  )
}
