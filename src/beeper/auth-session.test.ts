import { describe, expect, test } from 'bun:test'
import { currentAccessToken, login, logout, resolveActiveToken } from '@/beeper/auth-session.ts'
import { loadAuth, saveAuth, type SecretStore, type StoredAuth } from '@/beeper/token-store.ts'
import type { LoopbackReceiver, OAuthHttp } from '@/beeper/oauth.ts'
import type { OAuthEndpoints, ServerInfo } from '@/beeper/types.ts'

const endpoints: OAuthEndpoints = {
  authorizationEndpoint: 'https://x/authorize',
  tokenEndpoint: 'https://x/token',
  registrationEndpoint: 'https://x/register',
  introspectionEndpoint: 'https://x/introspect',
  revocationEndpoint: 'https://x/revoke',
  userinfoEndpoint: 'https://x/userinfo',
}

function fakeStore(initial: Record<string, string> = {}): SecretStore {
  const data = new Map(Object.entries(initial))
  const key = (o: { service: string; name: string }) => `${o.service}/${o.name}`
  return {
    get: async (o) => data.get(key(o)) ?? null,
    set: async (o) => void data.set(key(o), o.value),
    delete: async (o) => data.delete(key(o)),
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}

/** An OAuthHttp whose token endpoint returns a fresh token; captures revokes. */
function http(nowMs = 1_000_000, revoked: string[] = []): OAuthHttp {
  return {
    nowMs,
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/revoke')) {
        revoked.push(new URLSearchParams(String(init?.body ?? '')).get('token') ?? '')
        return json({})
      }
      if (url.endsWith('/token')) return json({ access_token: 'AT-refreshed', expires_in: 3600 })
      return json({})
    }) as unknown as typeof fetch,
  }
}

describe('login', () => {
  test('runs the flow and persists the session', async () => {
    const store = fakeStore()
    const receiver: LoopbackReceiver = {
      redirectUri: 'http://127.0.0.1:5/callback',
      awaitCallback: async () => 'http://127.0.0.1:5/callback?code=C&state=' + issued(),
      close: () => {},
    }
    let issuedState = ''
    const issued = () => issuedState
    const deps = {
      http: {
        nowMs: 1_000_000,
        fetch: (async (input: string | URL | Request) => {
          const url = typeof input === 'string' ? input : input.toString()
          if (url.endsWith('/register')) return json({ client_id: 'cid-9' })
          if (url.endsWith('/token')) return json({ access_token: 'AT', refresh_token: 'RT' })
          return json({})
        }) as unknown as typeof fetch,
      },
      startLoopback: async () => receiver,
      openBrowser: async (u: string) => {
        issuedState = new URL(u).searchParams.get('state') ?? ''
      },
    }
    const auth = await login(endpoints, deps, store)
    expect(auth.clientId).toBe('cid-9')
    expect(auth.tokens.accessToken).toBe('AT')
    expect((await loadAuth(store))?.clientId).toBe('cid-9') // persisted
  })
})

describe('logout', () => {
  test('revokes the token then clears the stored session', async () => {
    const auth: StoredAuth = { clientId: 'c', tokens: { accessToken: 'AT-live' } }
    const store = fakeStore()
    await saveAuth(auth, store)
    const revoked: string[] = []
    await logout(endpoints, http(1_000_000, revoked), store)
    expect(revoked).toEqual(['AT-live'])
    expect(await loadAuth(store)).toBeNull()
  })

  test('is a no-op-safe when nothing is stored', async () => {
    const store = fakeStore()
    await logout(endpoints, http(), store) // must not throw
    expect(await loadAuth(store)).toBeNull()
  })
})

describe('currentAccessToken', () => {
  test('returns the token unchanged when not expired', async () => {
    const store = fakeStore()
    await saveAuth({ clientId: 'c', tokens: { accessToken: 'AT', expiresAt: 9_000_000 } }, store)
    expect(await currentAccessToken(endpoints, http(1_000_000), store)).toBe('AT')
  })

  test('refreshes an expired token and persists the new one', async () => {
    const store = fakeStore()
    await saveAuth(
      { clientId: 'c', tokens: { accessToken: 'AT-old', refreshToken: 'RT', expiresAt: 500_000 } },
      store
    )
    const token = await currentAccessToken(endpoints, http(1_000_000), store)
    expect(token).toBe('AT-refreshed')
    const stored = await loadAuth(store)
    expect(stored?.tokens.accessToken).toBe('AT-refreshed') // persisted
    expect(stored?.tokens.refreshToken).toBe('RT') // preserved
  })

  test('returns null when there is no stored session', async () => {
    expect(await currentAccessToken(endpoints, http(), fakeStore())).toBeNull()
  })
})

describe('resolveActiveToken', () => {
  const info: ServerInfo = {
    appName: 'B',
    appVersion: '4',
    os: 'darwin',
    arch: 'arm64',
    baseUrl: 'x',
    port: 1,
    remoteAccessEnabled: false,
    wsEventsUrl: 'x',
    oauth: endpoints,
  }

  test('prefers an explicit env/legacy token, without touching the network', async () => {
    let getInfoCalled = false
    const token = await resolveActiveToken({
      getInfo: async () => {
        getInfoCalled = true
        return info
      },
      http: http(),
      store: fakeStore(),
      direct: () => 'ENV-TOKEN',
    })
    expect(token).toBe('ENV-TOKEN')
    expect(getInfoCalled).toBe(false)
  })

  test('falls back to the stored OAuth session when no direct token', async () => {
    const store = fakeStore()
    await saveAuth(
      { clientId: 'c', tokens: { accessToken: 'AT-oauth', expiresAt: 9_000_000 } },
      store
    )
    const token = await resolveActiveToken({
      getInfo: async () => info,
      http: http(1_000_000),
      store,
      direct: () => undefined,
    })
    expect(token).toBe('AT-oauth')
  })

  test('returns undefined when offline and nothing is stored', async () => {
    const token = await resolveActiveToken({
      getInfo: async () => {
        throw new Error('offline')
      },
      http: http(),
      store: fakeStore(),
      direct: () => undefined,
    })
    expect(token).toBeUndefined()
  })
})
