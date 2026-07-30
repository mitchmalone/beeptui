import { readFileSync } from 'node:fs'
import { homedir as osHomedir } from 'node:os'

/** Default local Beeper Desktop API endpoint (see docs/JOURNAL.md 2026-07-30). */
export const DEFAULT_ENDPOINT = 'http://127.0.0.1:23373'

export interface ResolvedConfig {
  endpoint: string
  configPath: string
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
  }

  const endpoint = validateEndpoint(env.BEEPER_TUI_ENDPOINT ?? fileEndpoint ?? DEFAULT_ENDPOINT)
  return { endpoint, configPath }
}
