import { describe, expect, test } from 'bun:test'
import {
  authorize,
  buildAuthorizationUrl,
  exchangeCode,
  generatePkce,
  generateState,
  isExpired,
  parseCallback,
  refreshTokens,
  registerClient,
  revokeToken,
  type LoopbackReceiver,
  type OAuthHttp,
} from '@/beeper/oauth.ts'
import type { OAuthEndpoints } from '@/beeper/types.ts'

const endpoints: OAuthEndpoints = {
  authorizationEndpoint: 'https://beeper.example/oauth/authorize',
  tokenEndpoint: 'https://beeper.example/oauth/token',
  registrationEndpoint: 'https://beeper.example/oauth/register',
  introspectionEndpoint: 'https://beeper.example/oauth/introspect',
  revocationEndpoint: 'https://beeper.example/oauth/revoke',
  userinfoEndpoint: 'https://beeper.example/oauth/userinfo',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Capture the last request so tests can assert what was sent. */
function capturingHttp(
  response: Response,
  nowMs = 1_000_000
): {
  http: OAuthHttp
  last: () => { url: string; method: string; body: string }
} {
  let captured = { url: '', method: '', body: '' }
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    captured = {
      url: typeof input === 'string' ? input : input.toString(),
      method: (init?.method ?? 'GET').toUpperCase(),
      body: init?.body ? String(init.body) : '',
    }
    return response
  }) as unknown as typeof fetch
  return { http: { fetch: fetchImpl, nowMs }, last: () => captured }
}

describe('PKCE', () => {
  test('generatePkce produces an S256 challenge that is the base64url SHA-256 of the verifier', async () => {
    const pkce = await generatePkce()
    expect(pkce.method).toBe('S256')
    expect(pkce.verifier.length).toBeGreaterThanOrEqual(43)
    expect(pkce.verifier).toMatch(/^[A-Za-z0-9\-_]+$/) // base64url, no padding
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9\-_]+$/)

    // Recompute the challenge independently to prove it's SHA-256(verifier).
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pkce.verifier))
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(pkce.challenge).toBe(expected)
  })

  test('verifiers are unique across calls (high entropy)', async () => {
    const a = await generatePkce()
    const b = await generatePkce()
    expect(a.verifier).not.toBe(b.verifier)
  })

  test('generateState is random and non-empty', () => {
    expect(generateState()).not.toBe(generateState())
    expect(generateState().length).toBeGreaterThan(0)
  })
})

describe('buildAuthorizationUrl', () => {
  test('includes response_type, PKCE S256, state, and redirect', () => {
    const url = new URL(
      buildAuthorizationUrl(endpoints, {
        clientId: 'client-1',
        redirectUri: 'http://127.0.0.1:49152/callback',
        codeChallenge: 'CHALLENGE',
        state: 'STATE',
        scope: 'read write',
      })
    )
    expect(url.origin + url.pathname).toBe('https://beeper.example/oauth/authorize')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('client-1')
    expect(url.searchParams.get('code_challenge')).toBe('CHALLENGE')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe('STATE')
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:49152/callback')
    expect(url.searchParams.get('scope')).toBe('read write')
  })
})

describe('parseCallback', () => {
  test('returns the code when state matches', () => {
    const result = parseCallback('http://127.0.0.1:49152/callback?code=abc&state=S', 'S')
    expect(result).toEqual({ code: 'abc' })
  })

  test('rejects a state mismatch (CSRF defence)', () => {
    const result = parseCallback('http://127.0.0.1:49152/callback?code=abc&state=WRONG', 'S')
    expect(result).toEqual({ error: 'State mismatch — possible CSRF' })
  })

  test('surfaces an OAuth error param honestly', () => {
    const result = parseCallback(
      'http://127.0.0.1:49152/callback?error=access_denied&error_description=nope&state=S',
      'S'
    )
    expect(result).toEqual({ error: 'nope' })
  })

  test('rejects a callback with no code', () => {
    expect(parseCallback('http://127.0.0.1:49152/callback?state=S', 'S')).toEqual({
      error: 'No authorization code in callback',
    })
  })
})

describe('registerClient', () => {
  test('posts an RFC 7591 registration and returns the client_id', async () => {
    const { http, last } = capturingHttp(json({ client_id: 'issued-123' }))
    const result = await registerClient(endpoints, 'http://127.0.0.1:49152/callback', http)
    expect(result.clientId).toBe('issued-123')
    const sent = last()
    expect(sent.url).toBe(endpoints.registrationEndpoint)
    expect(sent.method).toBe('POST')
    const body = JSON.parse(sent.body)
    expect(body.redirect_uris).toEqual(['http://127.0.0.1:49152/callback'])
    expect(body.token_endpoint_auth_method).toBe('none') // public client
    expect(body.grant_types).toContain('refresh_token')
  })

  test('throws when the server returns no client_id', async () => {
    const { http } = capturingHttp(json({ error: 'invalid_redirect_uri' }))
    await expect(
      registerClient(endpoints, 'http://127.0.0.1:49152/callback', http)
    ).rejects.toBeTruthy()
  })
})

describe('exchangeCode', () => {
  test('posts the code + PKCE verifier and returns tokens with a computed expiry', async () => {
    const { http, last } = capturingHttp(
      json({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }),
      1_000_000
    )
    const tokens = await exchangeCode(
      endpoints,
      {
        clientId: 'client-1',
        code: 'CODE',
        codeVerifier: 'VERIFIER',
        redirectUri: 'http://127.0.0.1:49152/callback',
      },
      http
    )
    expect(tokens).toEqual({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresAt: 1_000_000 + 3_600_000,
    })
    const form = new URLSearchParams(last().body)
    expect(form.get('grant_type')).toBe('authorization_code')
    expect(form.get('code')).toBe('CODE')
    expect(form.get('code_verifier')).toBe('VERIFIER')
    expect(form.get('redirect_uri')).toBe('http://127.0.0.1:49152/callback')
  })

  test('throws (not a silent empty token) when the server returns an error', async () => {
    const { http } = capturingHttp(json({ error: 'invalid_grant', error_description: 'bad code' }))
    await expect(
      exchangeCode(
        endpoints,
        { clientId: 'c', code: 'x', codeVerifier: 'v', redirectUri: 'r' },
        http
      )
    ).rejects.toBeTruthy()
  })
})

describe('refreshTokens', () => {
  test('posts the refresh grant and keeps the old refresh token when the server omits one', async () => {
    const { http, last } = capturingHttp(json({ access_token: 'AT2', expires_in: 1800 }), 2_000_000)
    const tokens = await refreshTokens(endpoints, { clientId: 'c', refreshToken: 'OLD-RT' }, http)
    expect(tokens.accessToken).toBe('AT2')
    expect(tokens.refreshToken).toBe('OLD-RT') // preserved
    expect(tokens.expiresAt).toBe(2_000_000 + 1_800_000)
    const form = new URLSearchParams(last().body)
    expect(form.get('grant_type')).toBe('refresh_token')
    expect(form.get('refresh_token')).toBe('OLD-RT')
  })

  test('uses a rotated refresh token when the server returns one', async () => {
    const { http } = capturingHttp(json({ access_token: 'AT2', refresh_token: 'NEW-RT' }))
    const tokens = await refreshTokens(endpoints, { clientId: 'c', refreshToken: 'OLD-RT' }, http)
    expect(tokens.refreshToken).toBe('NEW-RT')
  })
})

describe('revokeToken', () => {
  test('posts the token to the revocation endpoint', async () => {
    const { http, last } = capturingHttp(json({}))
    await revokeToken(endpoints, { clientId: 'c', token: 'AT' }, http)
    expect(last().url).toBe(endpoints.revocationEndpoint)
    expect(new URLSearchParams(last().body).get('token')).toBe('AT')
  })
})

describe('authorize (full flow orchestration)', () => {
  /** A fake authorization server + loopback that plays the whole flow. */
  function fakeFlow(over: { state?: 'good' | 'mismatch' | 'error' } = {}) {
    const events: string[] = []
    let issuedState = ''
    const http: OAuthHttp = {
      nowMs: 1_000_000,
      fetch: (async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.endsWith('/register')) {
          events.push('register')
          return json({ client_id: 'issued-1' })
        }
        if (url.endsWith('/token')) {
          events.push('exchange')
          const form = new URLSearchParams(String(init?.body ?? ''))
          expect(form.get('code_verifier')).toBeTruthy() // PKCE verifier sent
          return json({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 })
        }
        return json({}, 404)
      }) as unknown as typeof fetch,
    }
    const receiver: LoopbackReceiver = {
      redirectUri: 'http://127.0.0.1:49152/callback',
      awaitCallback: async () => {
        // The browser was opened first; replay a callback with the sent state.
        const returnedState = over.state === 'mismatch' ? 'WRONG' : issuedState
        if (over.state === 'error') {
          return `http://127.0.0.1:49152/callback?error=access_denied&error_description=denied&state=${returnedState}`
        }
        return `http://127.0.0.1:49152/callback?code=CODE&state=${returnedState}`
      },
      close: () => events.push('close'),
    }
    const deps = {
      http,
      startLoopback: async () => {
        events.push('loopback')
        return receiver
      },
      openBrowser: async (url: string) => {
        events.push('browser')
        issuedState = new URL(url).searchParams.get('state') ?? ''
      },
    }
    return { deps, events }
  }

  test('registers, opens the browser, exchanges the code, and returns tokens', async () => {
    const { deps, events } = fakeFlow()
    const tokens = await authorize(endpoints, deps)
    expect(tokens).toEqual({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresAt: 1_000_000 + 3_600_000,
    })
    expect(events).toEqual(['loopback', 'register', 'browser', 'exchange', 'close'])
  })

  test('rejects a CSRF state mismatch and still tears down the receiver', async () => {
    const { deps, events } = fakeFlow({ state: 'mismatch' })
    await expect(authorize(endpoints, deps)).rejects.toThrow(/Authorization failed/)
    expect(events).toContain('close') // receiver always closed
    expect(events).not.toContain('exchange') // never exchanged a mismatched code
  })

  test('surfaces an OAuth error callback and closes the receiver', async () => {
    const { deps, events } = fakeFlow({ state: 'error' })
    await expect(authorize(endpoints, deps)).rejects.toThrow(/denied/)
    expect(events).toContain('close')
  })
})

describe('isExpired', () => {
  test('honors the skew window and treats no-expiry as non-expiring', () => {
    expect(isExpired({ accessToken: 'x', expiresAt: 100_000 }, 50_000)).toBe(false)
    expect(isExpired({ accessToken: 'x', expiresAt: 100_000 }, 100_000)).toBe(true)
    expect(isExpired({ accessToken: 'x', expiresAt: 100_000 }, 80_000, 30_000)).toBe(true) // within skew
    expect(isExpired({ accessToken: 'x' }, 999_999_999)).toBe(false) // no expiry
  })
})
