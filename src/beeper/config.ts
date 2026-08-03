import { readFileSync } from 'node:fs'
import { homedir as osHomedir } from 'node:os'

/** Default local Beeper Desktop API endpoint (see docs/JOURNAL.md 2026-07-30). */
export const DEFAULT_ENDPOINT = 'http://127.0.0.1:23373'

/** User-configurable notification hook: a command run on a new
 *  inbound message. Only a redacted summary (app + network) is ever passed —
 *  never sender or message content (invariant 6). */
export interface NotifyConfig {
  command: string[]
}

/** Visual theme overrides: selected theme, per-network accent colours, density. */
export interface ThemeConfig {
  /** Selected theme name — a built-in (`system` | `default` | `dracula`) or a file
   *  in `~/.config/beeptui/themes/`. Absent → `system`. */
  name?: string
  /** Network name → hex colour (e.g. `{ "WhatsApp": "#25d366" }`). */
  networkColors: Record<string, string>
  /** Initial layout density; `D` still toggles it at runtime. Absent → comfortable. */
  density?: 'comfortable' | 'compact'
}

export interface ResolvedConfig {
  endpoint: string
  /** Named endpoints (`{ name: url }`) the `endpoint` selector can reference —
   *  e.g. switch between a local Desktop and a remote box. Empty when unset. */
  endpoints: Record<string, string>
  configPath: string
  /** Notification hook, or null when not configured. */
  notify: NotifyConfig | null
  /** Raw keymap overrides (command name → key tokens), or null. Shape-validated
   *  here; command names are validated by the keymap layer when applied. */
  keymap: Record<string, string[]> | null
  /** Theme overrides, or null. */
  theme: ThemeConfig | null
}

export interface ResolveConfigDeps {
  /** Environment map. Injected so resolution is pure and testable. */
  env?: Record<string, string | undefined>
  /** Home directory for the default config path. */
  homedir?: string
  /** Reads a file's contents, or returns undefined if it doesn't exist. */
  readFile?: (path: string) => string | undefined
}

function defaultReadFile(path: string): string | undefined {
  try {
    // `readFileSync` throws ENOENT when absent; treat that as "no config".
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

/** Is this URL hostname the local machine? (`localhost`, IPv4 loopback, `::1` —
 *  with or without the URL-literal brackets). */
export function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.startsWith('127.')
  )
}

function validateEndpoint(endpoint: string): string {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error(`Invalid Beeper endpoint (not a URL): ${endpoint}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid Beeper endpoint (must be http/https): ${endpoint}`)
  }
  // Plain http is only safe on the local machine: over a network it would carry
  // the bearer token and message content in cleartext (invariant 6).
  if (url.protocol === 'http:' && !isLoopbackHost(url.hostname)) {
    throw new Error(
      `Refusing plain-http endpoint ${endpoint} — a non-loopback endpoint must use https ` +
        `(the access token and messages would otherwise transit unencrypted)`
    )
  }
  return endpoint
}

/**
 * Resolve the effective config. Endpoint precedence: `BEEPER_TUI_ENDPOINT` env >
 * config-file `endpoint` > default. The config file may set only the endpoint —
 * tokens never live in it (they belong in the platform credential store;
 * CLAUDE.md invariant 1/6).
 */
export function resolveConfig(deps: ResolveConfigDeps = {}): ResolvedConfig {
  const env = deps.env ?? process.env
  const homedir = deps.homedir ?? osHomedir()
  const readFile = deps.readFile ?? defaultReadFile

  const configHome = env.XDG_CONFIG_HOME ?? `${homedir}/.config`
  const configPath = `${configHome}/beeper-tui/config.json`

  let fileEndpoint: string | undefined
  let endpoints: Record<string, string> = {}
  let notify: NotifyConfig | null = null
  let keymap: Record<string, string[]> | null = null
  let theme: ThemeConfig | null = null
  const raw = readFile(configPath)
  if (raw !== undefined) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error(`Invalid Beeper config file (not valid JSON): ${configPath}`)
    }
    if (parsed !== null && typeof parsed === 'object' && 'endpoint' in parsed) {
      const value = (parsed as { endpoint: unknown }).endpoint
      if (typeof value !== 'string') {
        throw new Error(`Invalid Beeper config file ("endpoint" must be a string): ${configPath}`)
      }
      fileEndpoint = value
    }
    notify = parseNotify(parsed, configPath)
    keymap = parseKeymap(parsed, configPath)
    theme = parseTheme(parsed, configPath)
    endpoints = parseEndpoints(parsed, configPath)
  }

  // The selection may be a URL or the name of a configured endpoint; resolve a
  // name against `endpoints`, otherwise treat it as a literal URL.
  const selection = env.BEEPER_TUI_ENDPOINT ?? fileEndpoint ?? DEFAULT_ENDPOINT
  const endpoint = validateEndpoint(endpoints[selection] ?? selection)
  return { endpoint, endpoints, configPath, notify, keymap, theme }
}

/** Parse + validate the optional `endpoints` map (name → http/https URL). */
function parseEndpoints(parsed: unknown, configPath: string): Record<string, string> {
  if (parsed === null || typeof parsed !== 'object' || !('endpoints' in parsed)) return {}
  const endpoints = (parsed as { endpoints: unknown }).endpoints
  if (endpoints === null || typeof endpoints !== 'object' || Array.isArray(endpoints)) {
    throw new Error(`Invalid Beeper config file ("endpoints" must be an object): ${configPath}`)
  }
  const out: Record<string, string> = {}
  for (const [name, url] of Object.entries(endpoints)) {
    if (typeof url !== 'string') {
      throw new Error(
        `Invalid Beeper config file ("endpoints.${name}" must be a string): ${configPath}`
      )
    }
    out[name] = validateEndpoint(url)
  }
  return out
}

/** Parse + validate the optional `theme` block: `networkColors` (network → hex
 *  colour) and `density` (`comfortable` | `compact`). Both keys are optional. */
function parseTheme(parsed: unknown, configPath: string): ThemeConfig | null {
  if (parsed === null || typeof parsed !== 'object' || !('theme' in parsed)) return null
  const theme = (parsed as { theme: unknown }).theme
  if (theme === null || typeof theme !== 'object' || Array.isArray(theme)) {
    throw new Error(`Invalid Beeper config file ("theme" must be an object): ${configPath}`)
  }

  const out: Record<string, string> = {}
  if ('networkColors' in theme) {
    const colors = (theme as { networkColors: unknown }).networkColors
    if (colors === null || typeof colors !== 'object' || Array.isArray(colors)) {
      throw new Error(
        `Invalid Beeper config file ("theme.networkColors" must be an object): ${configPath}`
      )
    }
    for (const [network, color] of Object.entries(colors)) {
      if (typeof color !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(color)) {
        throw new Error(
          `Invalid Beeper config file ("theme.networkColors.${network}" must be a hex colour): ${configPath}`
        )
      }
      out[network] = color
    }
  }

  const result: ThemeConfig = { networkColors: out }
  if ('name' in theme) {
    const name = (theme as { name: unknown }).name
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(
        `Invalid Beeper config file ("theme.name" must be a non-empty string): ${configPath}`
      )
    }
    result.name = name
  }
  if ('density' in theme) {
    const density = (theme as { density: unknown }).density
    if (density !== 'comfortable' && density !== 'compact') {
      throw new Error(
        `Invalid Beeper config file ("theme.density" must be "comfortable" or "compact"): ${configPath}`
      )
    }
    result.density = density
  }
  return result
}

/** Shape-validate the optional `keymap` overrides: an object of command name →
 *  non-empty string array. Command-name validity is checked by the keymap layer. */
function parseKeymap(parsed: unknown, configPath: string): Record<string, string[]> | null {
  if (parsed === null || typeof parsed !== 'object' || !('keymap' in parsed)) return null
  const keymap = (parsed as { keymap: unknown }).keymap
  if (keymap === null || typeof keymap !== 'object' || Array.isArray(keymap)) {
    throw new Error(`Invalid Beeper config file ("keymap" must be an object): ${configPath}`)
  }
  const out: Record<string, string[]> = {}
  for (const [command, keys] of Object.entries(keymap)) {
    if (
      !Array.isArray(keys) ||
      keys.length === 0 ||
      !keys.every((k): k is string => typeof k === 'string')
    ) {
      throw new Error(
        `Invalid Beeper config file ("keymap.${command}" must be a non-empty string array): ${configPath}`
      )
    }
    out[command] = keys
  }
  return out
}

/** Parse + validate the optional `notify.command` (a non-empty string array).
 *  Errors are explicit so a bad config never silently disables notifications. */
function parseNotify(parsed: unknown, configPath: string): NotifyConfig | null {
  if (parsed === null || typeof parsed !== 'object' || !('notify' in parsed)) return null
  const notify = (parsed as { notify: unknown }).notify
  if (notify === null || typeof notify !== 'object' || !('command' in notify)) {
    throw new Error(`Invalid Beeper config file ("notify" must have a "command"): ${configPath}`)
  }
  const command = (notify as { command: unknown }).command
  if (
    !Array.isArray(command) ||
    command.length === 0 ||
    !command.every((c): c is string => typeof c === 'string')
  ) {
    throw new Error(
      `Invalid Beeper config file ("notify.command" must be a non-empty string array): ${configPath}`
    )
  }
  return { command }
}
