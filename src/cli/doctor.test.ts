import { describe, expect, test } from 'bun:test'
import { BeeperAdapter } from '@/beeper/client.ts'
import { accountsFixture, infoFixture } from '@/beeper/fixtures.ts'
import { runDoctor, type DoctorContext } from '@/cli/doctor.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function ctx(
  handler: (method: string, path: string) => Response | never,
  hasToken = true
): DoctorContext {
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

const ok = (_m: string, p: string): Response => {
  if (p === '/v1/info') return json(infoFixture)
  if (p === '/v1/accounts') return json(accountsFixture)
  return json({}, 404)
}

describe('runDoctor', () => {
  test('all green: reachable, authenticated, accounts connected → exit 0', async () => {
    const result = await runDoctor(ctx(ok))
    expect(result.code).toBe(0)
    expect(result.checks.every((c) => c.status === 'pass')).toBe(true)
  })

  test('Beeper closed → reachable fails, later checks skipped, exit non-zero', async () => {
    const result = await runDoctor(
      ctx(() => {
        throw new TypeError('fetch failed')
      })
    )
    expect(result.code).toBe(1)
    const reachable = result.checks[0]
    expect(reachable?.status).toBe('fail')
    expect(reachable?.remediation).toMatch(/beeper desktop/i)
    expect(result.checks.some((c) => c.status === 'skip')).toBe(true)
  })

  test('no token configured → auth check fails with remediation, exit non-zero', async () => {
    const result = await runDoctor(ctx(ok, false))
    expect(result.code).toBe(1)
    const tokenCheck = result.checks.find((c) => /token/i.test(c.name))
    expect(tokenCheck?.status).toBe('fail')
    expect(tokenCheck?.remediation).toMatch(/settings|integrations/i)
  })

  test('token rejected (401) → authenticated check fails, exit non-zero', async () => {
    const result = await runDoctor(
      ctx((_m, p) => (p === '/v1/info' ? json(infoFixture) : json({ code: 'unauthorized' }, 401)))
    )
    expect(result.code).toBe(1)
    expect(result.checks.find((c) => /authenticated/i.test(c.name))?.status).toBe('fail')
  })

  test('reachable + authed but zero accounts → accounts check fails', async () => {
    const result = await runDoctor(
      ctx((_m, p) => (p === '/v1/accounts' ? json([]) : json(infoFixture)))
    )
    expect(result.code).toBe(1)
    expect(result.checks.find((c) => /account/i.test(c.name))?.status).toBe('fail')
  })

  test('a failing check never leaks a token or raw body into its detail', async () => {
    const result = await runDoctor(
      ctx((_m, p) =>
        p === '/v1/info'
          ? json(infoFixture)
          : json({ code: 'unauthorized', message: 'secretbody' }, 401)
      )
    )
    expect(JSON.stringify(result)).not.toContain('secretbody')
    expect(JSON.stringify(result)).not.toContain('test-token')
  })
})
