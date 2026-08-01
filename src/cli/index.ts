#!/usr/bin/env bun
import {
  BeeperAdapter,
  clearAuth,
  introspectToken,
  login,
  logout,
  openUrl,
  resolveActiveToken,
  resolveConfig,
  startLoopback,
} from '@/beeper/index.ts'
import { formatDoctor, runDoctor } from '@/cli/doctor.ts'
import { runStatus } from '@/cli/status.ts'

const USAGE = `beeper-tui — a terminal client for Beeper

Usage:
  beeper-tui              Launch the TUI
  beeper-tui status       Show endpoint, auth state, and connected accounts
  beeper-tui doctor       Run diagnostic checks (non-zero exit on any failure)
  beeper-tui login        Authenticate a remote endpoint via OAuth (browser)
  beeper-tui logout       Revoke + forget the stored OAuth session
  beeper-tui --help       Show this help

Flags:
  --json                  Machine-readable output (status, doctor)
`

/** Build the live context: resolve the endpoint, then the active token (an
 *  explicit env/legacy token, else a stored OAuth session that may refresh). */
async function buildContext(): Promise<{
  endpoint: string
  hasToken: boolean
  adapter: BeeperAdapter
  introspect?: () => Promise<{ active: boolean; scopes: string[] } | null>
}> {
  const { endpoint } = resolveConfig()
  const preAuth = new BeeperAdapter({ endpoint })
  const token = await resolveActiveToken({
    getInfo: () => preAuth.getInfo(),
    http: { fetch, nowMs: Date.now() },
  })
  const adapter = new BeeperAdapter({ endpoint, accessToken: token })
  // Token-scope introspection for `doctor`: null when there's no token or the
  // endpoint doesn't support RFC 7662 (doctor then just skips the check).
  const introspect =
    token === undefined
      ? undefined
      : async () => {
          try {
            const info = await preAuth.getInfo()
            return await introspectToken(info.oauth, token, { fetch, nowMs: Date.now() })
          } catch {
            return null
          }
        }
  return { endpoint, hasToken: token !== undefined, adapter, ...(introspect ? { introspect } : {}) }
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv
  const json = rest.includes('--json')

  switch (command) {
    case undefined:
    case 'run': {
      const { launch } = await import('@/tui/launch.ts')
      await launch()
      return
    }
    case 'status': {
      const { output, code } = await runStatus(await buildContext(), { json })
      console.log(output)
      process.exit(code)
      break
    }
    case 'doctor': {
      const result = await runDoctor(await buildContext())
      console.log(json ? JSON.stringify(result, null, 2) : formatDoctor(result))
      process.exit(result.code)
      break
    }
    case 'login': {
      const { endpoint } = resolveConfig()
      const adapter = new BeeperAdapter({ endpoint })
      try {
        const info = await adapter.getInfo()
        console.log('Opening your browser to authenticate…')
        await login(info.oauth, {
          http: { fetch, nowMs: Date.now() },
          startLoopback,
          openBrowser: openUrl,
        })
        // Never print the token — only that it was stored (invariant 6).
        console.log('Logged in. Token stored in the OS credential store.')
        process.exit(0)
      } catch (err) {
        console.error(`Login failed: ${err instanceof Error ? err.message : 'unknown error'}`)
        process.exit(1)
      }
      break
    }
    case 'logout': {
      const { endpoint } = resolveConfig()
      try {
        const info = await new BeeperAdapter({ endpoint }).getInfo()
        await logout(info.oauth, { fetch, nowMs: Date.now() })
      } catch {
        // Offline: revoke can't run, but still forget the session locally.
        await clearAuth()
      }
      console.log('Logged out.')
      process.exit(0)
      break
    }
    case '--help':
    case '-h':
      console.log(USAGE)
      return
    default:
      console.error(`Unknown command: ${command}\n`)
      console.error(USAGE)
      process.exit(2)
  }
}

await main(process.argv.slice(2))
