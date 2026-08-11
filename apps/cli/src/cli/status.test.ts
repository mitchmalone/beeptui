import { describe, expect, test } from 'bun:test'
import { BeeperAdapter } from '@/beeper/client.ts'
import { accountsFixture, infoFixture } from '@/beeper/fixtures.ts'
import { runStatus, type StatusContext } from '@/cli/status.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function ctx(
  handler: (method: string, path: string) => Response | never,
  hasToken = true
): StatusContext {
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    return handler((init?.method ?? 'GET').toUpperCase(), url.pathname)
  }) as unknown as typeof fetch
  return {
    endpoint: 'http://127.0.0.1:23373',
    hasToken,
    adapter: new BeeperAdapter({
      endpoint: 'http://127.0.0.1:23373',
      accessToken: hasToken ? 'test-token' : '',
      fetch: fetchImpl,
    }),
  }
}

const healthy = (_m: string, p: string): Response =>
  p === '/v1/info'
    ? json(infoFixture)
    : p === '/v1/accounts'
      ? json(accountsFixture)
      : json({}, 404)

describe('runStatus (json)', () => {
  test('healthy instance → reachable, authenticated, accounts, exit 0', async () => {
    const { output, code } = await runStatus(ctx(healthy), { json: true })
    const parsed = JSON.parse(output)
    expect(code).toBe(0)
    expect(parsed).toMatchObject({ reachable: true, authenticated: true })
    expect(parsed.accounts).toHaveLength(2)
    expect(parsed.app.version).toBe('4.2.900')
  })

  test('unreachable → reachable false, exit 1', async () => {
    const { output, code } = await runStatus(
      ctx(() => {
        throw new TypeError('fetch failed')
      }),
      { json: true }
    )
    expect(code).toBe(1)
    expect(JSON.parse(output)).toMatchObject({ reachable: false, error: 'unreachable' })
  })

  test('reachable but no token → authenticated false, exit 1', async () => {
    const { output, code } = await runStatus(ctx(healthy, false), { json: true })
    expect(code).toBe(1)
    expect(JSON.parse(output).authenticated).toBe(false)
  })
})

describe('runStatus (human)', () => {
  test('lists networks and never prints the token', async () => {
    const { output } = await runStatus(ctx(healthy), { json: false })
    expect(output).toContain('WhatsApp')
    expect(output).toContain('Slack')
    expect(output).toContain('127.0.0.1:23373')
    expect(output).not.toContain('test-token')
  })
})
