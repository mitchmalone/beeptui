import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_THEME, type Theme } from '@/tui/theme/theme.ts'

/** The active theme. Defaults to the built-in default so components (and their
 *  isolated tests) always have tokens even without a provider. */
const ThemeContext = createContext<Theme>(DEFAULT_THEME)

export function ThemeProvider({ theme, children }: { theme: Theme; children?: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

/** Read the active theme's tokens. */
export function useTheme(): Theme {
  return useContext(ThemeContext)
}
