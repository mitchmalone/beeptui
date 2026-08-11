'use client'

import { useState } from 'react'
import { Check, Copy } from '@/components/icons'

export function CopyButton({
  value,
  label = 'Copy command',
  size = 15,
}: {
  value: string
  label?: string
  size?: number
}) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex shrink-0 cursor-pointer p-1 text-muted-foreground transition-colors hover:text-primary"
    >
      {copied ? <Check size={size} className="text-primary" /> : <Copy size={size} />}
    </button>
  )
}
