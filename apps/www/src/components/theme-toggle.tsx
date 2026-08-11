'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from '@/components/icons'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="flex cursor-pointer p-1.5 text-muted-foreground transition-colors hover:text-primary"
    >
      {/* CSS-driven swap off the .dark class — no mounted state, no hydration flash */}
      <Sun size={18} className="block dark:hidden" />
      <Moon size={18} className="hidden dark:block" />
    </button>
  )
}
