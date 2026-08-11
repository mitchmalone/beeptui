import type { BeeperAdapter } from '@/beeper/client.ts'
import { BeeperError } from '@/beeper/errors.ts'
import type { Account, ServerInfo } from '@/beeper/types.ts'

export interface StatusContext {
  endpoint: string
  hasToken: boolean
  adapter: BeeperAdapter
}

interface StatusReport {
  endpoint: string
  reachable: boolean
  authenticated: boolean
  app?: { name: string; version: string; platform: string }
  accounts?: Array<{ id: string; network: string; displayName: string }>
  error?: string
}

async function gather(ctx: StatusContext): Promise<StatusReport> {
  let info: ServerInfo
  try {
    info = await ctx.adapter.getInfo()
  } catch (err) {
    const kind = err instanceof BeeperError ? err.kind : 'unknown'
    return { endpoint: ctx.endpoint, reachable: false, authenticated: false, error: kind }
  }

  const report: StatusReport = {
    endpoint: ctx.endpoint,
    reachable: true,
    authenticated: false,
    app: { name: info.appName, version: info.appVersion, platform: `${info.os}/${info.arch}` },
  }

  if (!ctx.hasToken) return report

  try {
    const accounts: Account[] = await ctx.adapter.listAccounts()
    report.authenticated = true
    report.accounts = accounts.map((a) => ({
      id: a.id,
      network: a.network,
      displayName: a.displayName,
    }))
  } catch (err) {
    report.error = err instanceof BeeperError ? err.kind : 'unknown'
  }

  return report
}

function renderHuman(report: StatusReport): string {
  const lines = [`Endpoint:  ${report.endpoint}`]
  if (!report.reachable) {
    const detail = report.error && report.error !== 'unreachable' ? ` (${report.error})` : ''
    lines.push(`Status:    unreachable${detail}`)
    lines.push('           Is Beeper Desktop running? Try `beeptui doctor`.')
    return lines.join('\n')
  }
  if (report.app) {
    lines.push(`Server:    ${report.app.name} ${report.app.version} (${report.app.platform})`)
  }
  lines.push(`Auth:      ${report.authenticated ? 'authenticated' : `not authenticated`}`)
  if (report.accounts) {
    lines.push(`Accounts:  ${report.accounts.length}`)
    for (const a of report.accounts) lines.push(`  • ${a.network} — ${a.displayName}`)
  } else if (!report.authenticated) {
    lines.push('           No token configured — run `beeptui doctor` for help.')
  }
  return lines.join('\n')
}

/**
 * Summarize the endpoint, auth state, and connected accounts. Exit code is 0
 * only when reachable and authenticated, so scripts get a clean signal. Output
 * never contains the token (invariant 6) — only the account list summary.
 */
export async function runStatus(
  ctx: StatusContext,
  opts: { json?: boolean } = {}
): Promise<{ output: string; code: number }> {
  const report = await gather(ctx)
  const code = report.reachable && report.authenticated ? 0 : 1
  const output = opts.json ? JSON.stringify(report, null, 2) : renderHuman(report)
  return { output, code }
}
