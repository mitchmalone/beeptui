import { BUILTIN_THEMES, DEFAULT_THEME, type Theme } from '@/tui/theme/theme.ts'

/** Token keys a theme file may set (everything but `name`). */
const TOKEN_KEYS: ReadonlyArray<keyof Omit<Theme, 'name'>> = [
  'fg',
  'muted',
  'selectionBg',
  'selectionFg',
  'border',
  'borderFocused',
  'accent',
  'warning',
  'danger',
  'success',
  'menuBg',
]

const HEX = /^#[0-9a-fA-F]{3,8}$/

/**
 * Parse + validate a user theme file. Partial by design: any token the file
 * omits inherits the default, so a theme can define only what differs (like the
 * Dracula theme files). Each provided token must be a hex colour, or it throws
 * with a clear per-field message. `name` defaults to the filename but an explicit
 * `name` field wins.
 */
export function parseThemeFile(raw: string, name: string): Theme {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid theme file "${name}.json": not valid JSON`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid theme file "${name}.json": must be a JSON object`)
  }
  const obj = parsed as Record<string, unknown>
  const theme: Theme = { ...DEFAULT_THEME, name }
  for (const key of TOKEN_KEYS) {
    if (!(key in obj)) continue
    const value = obj[key]
    if (typeof value !== 'string' || !HEX.test(value)) {
      throw new Error(`Invalid theme file "${name}.json": "${key}" must be a hex colour`)
    }
    theme[key] = value
  }
  if (typeof obj.name === 'string' && obj.name.length > 0) theme.name = obj.name
  return theme
}

export interface ThemeLoaderDeps {
  /** Basenames of files in the themes dir (e.g. `["nord.json"]`), or [] if none. */
  listThemeFiles: () => string[]
  /** Read a theme file by basename, or undefined if unreadable. */
  readThemeFile: (basename: string) => string | undefined
}

/**
 * Build the name→Theme registry: the built-ins, plus any `*.json` in the themes
 * folder (a custom theme may override a built-in of the same name). A theme file
 * that fails to parse throws — a typo in a theme surfaces, it isn't swallowed.
 */
export function buildThemeRegistry(deps: ThemeLoaderDeps): Map<string, Theme> {
  const registry = new Map<string, Theme>(Object.entries(BUILTIN_THEMES))
  for (const file of deps.listThemeFiles()) {
    if (!file.endsWith('.json')) continue
    const raw = deps.readThemeFile(file)
    if (raw === undefined) continue
    const name = file.slice(0, -'.json'.length)
    registry.set(name, parseThemeFile(raw, name))
  }
  return registry
}

/** Resolve a configured theme name against the registry. An absent selection uses
 *  `system` (the intended default); an unknown name degrades to the default. */
export function resolveTheme(name: string | undefined, registry: Map<string, Theme>): Theme {
  if (name === undefined) return registry.get('system') ?? DEFAULT_THEME
  return registry.get(name) ?? DEFAULT_THEME
}
