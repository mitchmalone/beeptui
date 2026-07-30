import type { BeeperAdapter } from '@/beeper/client.ts'
import { BeeperError } from '@/beeper/errors.ts'

export interface DoctorContext {
  endpoint: string
  hasToken: boolean
  adapter: BeeperAdapter
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
  let reachable = false
  try {
    await ctx.adapter.getInfo()
    reachable = true
    checks.push({
      name: 'Beeper Desktop reachable',
      status: 'pass',
      detail: `Reached the API at ${ctx.endpoint}.`,
    })
  } catch (err) {
    const kind = err instanceof BeeperError ? err.kind : 'unknown'
    checks.push({
      name: 'Beeper Desktop reachable',
      status: 'fail',
      detail: `Could not reach the API at ${ctx.endpoint} (${kind}).`,
      remediation: 'Make sure Beeper Desktop is running and the API is enabled in its settings.',
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
