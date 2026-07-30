#!/usr/bin/env bun
import { BeeperAdapter, resolveConfig, resolveToken } from '@/beeper/index.ts'
import { formatDoctor, runDoctor } from '@/cli/doctor.ts'
import { runStatus } from '@/cli/status.ts'

const USAGE = `beeper-tui — a terminal client for Beeper

Usage:
  beeper-tui              Launch the TUI
  beeper-tui status       Show endpoint, auth state, and connected accounts
  beeper-tui doctor       Run diagnostic checks (non-zero exit on any failure)
  beeper-tui --help       Show this help

Flags:
  --json                  Machine-readable output (status, doctor)
`

/** Build the live context from resolved config + credential store. */
function buildContext(): { endpoint: string; hasToken: boolean; adapter: BeeperAdapter } {
  const { endpoint } = resolveConfig()
  const token = resolveToken()
  const adapter = new BeeperAdapter({ endpoint, accessToken: token })
  return { endpoint, hasToken: token !== undefined, adapter }
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
      const { output, code } = await runStatus(buildContext(), { json })
      console.log(output)
      process.exit(code)
      break
    }
    case 'doctor': {
      const result = await runDoctor(buildContext())
      console.log(json ? JSON.stringify(result, null, 2) : formatDoctor(result))
      process.exit(result.code)
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
