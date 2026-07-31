import { readFileSync } from 'node:fs'
import { homedir as osHomedir } from 'node:os'

/** Default local Beeper Desktop API endpoint (see docs/JOURNAL.md 2026-07-30). */
export const DEFAULT_ENDPOINT = 'http://127.0.0.1:23373'

/** User-configurable notification hook (Slice 14): a command run on a new
 *  inbound message. Only a redacted summary (app + network) is ever passed —
 *  never sender or message content (invariant 6). */
export interface NotifyConfig {
  command: string[]
}

export interface ResolvedConfig {
  endpoint: string
  configPath: string
  /** Notification hook, or null when not configured. */
  notify: NotifyConfig | null
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
  let notify: NotifyConfig | null = null
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
  }

  const endpoint = validateEndpoint(env.BEEPER_TUI_ENDPOINT ?? fileEndpoint ?? DEFAULT_ENDPOINT)
  return { endpoint, configPath, notify }
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
