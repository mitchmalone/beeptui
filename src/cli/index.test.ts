import { describe, expect, test } from 'bun:test'

// End-to-end tests that spawn the real CLI entrypoint. `doctor`/`status` are
// pointed at a closed port so they behave deterministically whether or not a
// real Beeper Desktop is running on this machine.
const ENTRY = new URL('./index.ts', import.meta.url).pathname
const CLOSED_ENDPOINT = 'http://127.0.0.1:1'

async function runCli(
  args: string[],
  env: Record<string, string> = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: ['bun', 'run', ENTRY, ...args],
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      BEEPER_TUI_ENDPOINT: CLOSED_ENDPOINT,
      // Ensure no ambient token leaks into the run.
      BEEPER_ACCESS_TOKEN: '',
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const code = await proc.exited
  return { code, stdout, stderr }
}

describe('beeper-tui CLI', () => {
  test('doctor against a closed endpoint names the failure and exits non-zero', async () => {
    const { code, stdout } = await runCli(['doctor', '--json'])
    expect(code).toBe(1)
    const result = JSON.parse(stdout)
    const reachable = result.checks[0]
    expect(reachable.name).toMatch(/reachable/i)
    expect(reachable.status).toBe('fail')
    expect(reachable.remediation).toMatch(/beeper desktop/i)
    // Nothing secret in the output.
    expect(stdout).not.toContain('Bearer')
  })

  test('status against a closed endpoint reports unreachable and exits non-zero', async () => {
    const { code, stdout } = await runCli(['status', '--json'])
    expect(code).toBe(1)
    expect(JSON.parse(stdout)).toMatchObject({ reachable: false })
  })

  test('--help prints usage and exits 0', async () => {
    const { code, stdout } = await runCli(['--help'])
    expect(code).toBe(0)
    expect(stdout).toContain('beeper-tui')
    expect(stdout).toContain('doctor')
  })

  test('unknown command exits 2', async () => {
    const { code, stderr } = await runCli(['frobnicate'])
    expect(code).toBe(2)
    expect(stderr).toMatch(/unknown command/i)
  })

  test('--version prints the version and exits 0', async () => {
    const { code, stdout } = await runCli(['--version'])
    expect(code).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test('a bad config surfaces one clear line, not a stack trace', async () => {
    const { code, stderr } = await runCli(['status'], {
      BEEPER_TUI_ENDPOINT: 'http://not-loopback.example:23373',
    })
    expect(code).toBe(1)
    expect(stderr).toMatch(/https/i)
    expect(stderr).not.toMatch(/at .*\.ts:\d+/) // no stack frames
  })
})
