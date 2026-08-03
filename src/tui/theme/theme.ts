/**
 * Semantic theme tokens. Components read these (via `useTheme()`) instead of
 * hardcoding hex, so the whole UI recolours by swapping one object. Keep the set
 * small and meaning-based (not "blue"/"gray") so any palette can fill it.
 */
export interface Theme {
  /** Theme name, as selected in config / the themes folder. */
  name: string
  /** Default foreground text. */
  fg: string
  /** Secondary / hint text. */
  muted: string
  /** Active-cursor / selection background — the same across every column. */
  selectionBg: string
  /** Text on the selection background. */
  selectionFg: string
  /** Unfocused pane border. */
  border: string
  /** Focused pane border (marks where keyboard focus is). */
  borderFocused: string
  /** Accent for hints, titles, the compose caret. */
  accent: string
  /** Amber-ish state (archived / unread indicators). */
  warning: string
  /** Failed / error state. */
  danger: string
  /** Success / connected state. */
  success: string
  /** Background of floating menus (action menu / emoji picker). */
  menuBg: string
}

/** The original slate/cyan look, now expressed as tokens. Also the base a partial
 *  custom theme file merges onto, and the fallback for an unknown selection. */
export const DEFAULT_THEME: Theme = {
  name: 'default',
  fg: '#e2e8f0',
  muted: '#94a3b8',
  selectionBg: '#38bdf8',
  selectionFg: '#0f172a',
  border: '#334155',
  borderFocused: '#38bdf8',
  accent: '#38bdf8',
  warning: '#f59e0b',
  danger: '#f87171',
  success: '#4ade80',
  menuBg: '#1e293b',
}

/** Open-source Dracula (https://draculatheme.com). Purple active-highlight, cyan
 *  accents, on the Dracula base/comment/current-line palette. */
export const DRACULA_THEME: Theme = {
  name: 'dracula',
  fg: '#f8f8f2',
  muted: '#6272a4',
  selectionBg: '#bd93f9',
  selectionFg: '#282a36',
  border: '#44475a',
  borderFocused: '#bd93f9',
  accent: '#8be9fd',
  warning: '#ffb86c',
  danger: '#ff5555',
  success: '#50fa7b',
  menuBg: '#44475a',
}

/** Placeholder for the terminal-detected theme; real OSC detection lands in the
 *  next slice. Until then it resolves to the default palette. */
export const SYSTEM_THEME: Theme = { ...DEFAULT_THEME, name: 'system' }

/** Built-in themes, keyed by name. */
export const BUILTIN_THEMES: Readonly<Record<string, Theme>> = {
  default: DEFAULT_THEME,
  dracula: DRACULA_THEME,
  system: SYSTEM_THEME,
}
