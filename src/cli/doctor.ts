import type { BeeperAdapter } from '@/beeper/client.ts'
import { BeeperError } from '@/beeper/errors.ts'
import type { ServerInfo } from '@/beeper/types.ts'

/** Classify a configured endpoint as the local Desktop loopback or a remote
 *  server, from its host — so `doctor` can name local-vs-remote failure modes
 *  (Slice 13). A non-URL string is treated as local (the default path). */
export function classifyEndpoint(endpoint: string): 'local' | 'remote' {
  try {
    // `URL.hostname` brackets IPv6 (`[::1]`), so strip brackets before comparing.
    const host = new URL(endpoint).hostname.replace(/^\[|\]$/g, '')
    return host === '127.0.0.1' || host === 'localhost' || host === '::1' ? 'local' : 'remote'
  } catch {
    return 'local'
  }
}

export interface DoctorContext {
  endpoint: string
  hasToken: boolean
  adapter: BeeperAdapter
  /** Introspect the active token's scopes (RFC 7662), or null when the endpoint
   *  doesn't support it. Injected so `doctor` stays testable and never handles
   *  the raw token itself. */
  introspect?: () => Promise<{ active: boolean; scopes: string[] } | null>
}

export interface DoctorCheck {
  name: string
  status: 'pass' | 'fail' | 'skip'
  detail: string
  remediation?: string
}

export interface DoctorResult {
  checks: DoctorCheck[]
  code: number
}

/**
 * Run the diagnostic checks in order, short-circuiting downstream checks when a
 * prerequisite fails (a closed Beeper makes "authenticated" unknowable, not
 * failed). Details are safe strings — kind + status only — so nothing leaks a
 * token or message body (CLAUDE.md invariant 6).
 */
export async function runDoctor(ctx: DoctorContext): Promise<DoctorResult> {
  const checks: DoctorCheck[] = []

  // 1. Reachability — via the pre-auth /v1/info endpoint.
  const kind = classifyEndpoint(ctx.endpoint)
  let reachable = false
  let info: ServerInfo | null = null
  try {
    info = await ctx.adapter.getInfo()
    reachable = true
    checks.push({
      name: kind === 'remote' ? 'Remote endpoint reachable' : 'Beeper Desktop reachable',
      status: 'pass',
      detail: `Reached the ${kind} API at ${ctx.endpoint}.`,
    })
  } catch (err) {
    const errorKind = err instanceof BeeperError ? err.kind : 'unknown'
    checks.push({
      name: kind === 'remote' ? 'Remote endpoint reachable' : 'Beeper Desktop reachable',
      status: 'fail',
      detail: `Could not reach the ${kind} API at ${ctx.endpoint} (${errorKind}).`,
      remediation:
        kind === 'remote'
          ? 'Check the remote endpoint URL, that the host is up, and that Beeper remote access is enabled there.'
          : 'Make sure Beeper Desktop is running and the API is enabled in its settings.',
    })
  }

  // 1b. Endpoint kind + remote-access posture (informational; helps distinguish
  // a local-Desktop setup from a remote one when diagnosing).
  if (info !== null) {
    checks.push({
      name: 'Endpoint',
      status: 'pass',
      detail:
        kind === 'remote'
          ? `Remote endpoint (server remote access: ${info.remoteAccessEnabled ? 'on' : 'off'}).`
          : `Local Beeper Desktop (remote access: ${info.remoteAccessEnabled ? 'on' : 'off'}).`,
    })
  }

  // 2. Access token configured.
  const tokenCheck: DoctorCheck = ctx.hasToken
    ? { name: 'Access token configured', status: 'pass', detail: 'A token is available.' }
    : {
        name: 'Access token configured',
        status: 'fail',
        detail: 'No access token found in the keychain or environment.',
        remediation:
          'Create a token in Beeper Desktop → Settings → Integrations → Approved connections, ' +
          'then store it (or set BEEPER_ACCESS_TOKEN).',
      }
  checks.push(tokenCheck)

  // 3. Authenticated — only knowable if reachable and a token exists.
  if (!reachable || !ctx.hasToken) {
    checks.push({
      name: 'Authenticated',
      status: 'skip',
      detail: reachable ? 'Skipped — no token to check.' : 'Skipped — Beeper is unreachable.',
    })
    checks.push({
      name: 'Connected accounts',
      status: 'skip',
      detail: 'Skipped — could not authenticate.',
    })
    return { checks, code: checks.some((c) => c.status === 'fail') ? 1 : 0 }
  }

  let accountCount = 0
  try {
    accountCount = (await ctx.adapter.listAccounts()).length
    checks.push({ name: 'Authenticated', status: 'pass', detail: 'The API accepted the token.' })
  } catch (err) {
    const kind = err instanceof BeeperError ? err.kind : 'unknown'
    checks.push({
      name: 'Authenticated',
      status: 'fail',
      detail: `The API rejected the request (${kind}).`,
      remediation:
        kind === 'unauthorized'
          ? 'The token was rejected. Create a fresh token in Beeper Desktop and store it again.'
          : 'Retry shortly; if it persists, check Beeper Desktop.',
    })
    checks.push({
      name: 'Connected accounts',
      status: 'skip',
      detail: 'Skipped — could not authenticate.',
    })
    return { checks, code: 1 }
  }

  // 4. Connected accounts.
  checks.push(
    accountCount > 0
      ? {
          name: 'Connected accounts',
          status: 'pass',
          detail: `${accountCount} account${accountCount === 1 ? '' : 's'} connected.`,
        }
      : {
          name: 'Connected accounts',
          status: 'fail',
          detail: 'No chat accounts are connected.',
          remediation: 'Connect at least one network in Beeper Desktop.',
        }
  )

  // 5. Token scope — surface send-capability so a read-only token doesn't look
  // send-capable until a send fails. Skipped when introspection is unavailable.
  if (ctx.introspect !== undefined) {
    try {
      const info = await ctx.introspect()
      if (info !== null && info.active) {
        const canSend = info.scopes.includes('write') || info.scopes.includes('send')
        const scopeList = info.scopes.length > 0 ? info.scopes.join(', ') : 'none reported'
        checks.push({
          name: 'Token scope',
          status: 'pass',
          detail: canSend
            ? `Scopes: ${scopeList} — can read and send.`
            : `Scopes: ${scopeList} — read-only; sends will fail.`,
          ...(canSend
            ? {}
            : {
                remediation:
                  'This token is read-only. Create one with write/send access in Beeper Desktop ' +
                  'if you want to send messages.',
              }),
        })
      }
      // info === null (introspection unsupported) or inactive → no check, no noise.
    } catch {
      // Introspection failed (endpoint absent / errored) — omit silently; the
      // other checks already establish auth. Never a hard failure on a nicety.
    }
  }

  return { checks, code: checks.some((c) => c.status === 'fail') ? 1 : 0 }
}

/** Render a doctor result as human-readable lines. */
export function formatDoctor(result: DoctorResult): string {
  const glyph = { pass: '✔', fail: '✖', skip: '−' } as const
  const lines = result.checks.map((c) => {
    const head = `${glyph[c.status]} ${c.name} — ${c.detail}`
    return c.remediation && c.status === 'fail' ? `${head}\n    → ${c.remediation}` : head
  })
  lines.push('')
  lines.push(result.code === 0 ? 'All checks passed.' : 'Some checks failed.')
  return lines.join('\n')
}
