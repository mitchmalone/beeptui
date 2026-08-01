import type { OAuthEndpoints } from '@/beeper/types.ts'
import { normalizeError } from '@/beeper/errors.ts'

/**
 * OAuth 2.0 Authorization Code + PKCE flow for the remote Beeper Server Client
 * endpoint (Slice 13). The endpoints come from `/v1/info` discovery
 * (`ServerInfo.oauth`), the client is registered dynamically (RFC 7591), and the
 * redirect is a localhost loopback (RFC 8252 native-app pattern).
 *
 * Security posture (to be confirmed by the mandated review):
 *  - PKCE with S256 only — never `plain`.
 *  - A CSRF `state` param is generated and verified on the callback.
 *  - The `code_verifier` and all tokens are secrets: never logged, never placed
 *    in error messages, never in process argv (invariant 6). This module returns
 *    them to the caller; persistence is the storage layer's job.
 *  - The loopback redirect must match exactly on exchange.
 *
 * Crypto uses Web Crypto (`crypto.subtle`), available in Bun. Network calls take
 * an injected `fetch` so the flow is unit-tested against a fake authorization
 * server with no live dependency.
 */

const VERIFIER_BYTES = 32 // 256 bits of entropy → 43-char base64url verifier

/** base64url (no padding) of raw bytes. */
function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A cryptographically-random base64url string from `byteLength` random bytes. */
function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}

export interface PkcePair {
  /** The high-entropy secret kept client-side until token exchange. */
  verifier: string
  /** The S256 hash sent in the authorization request. */
  challenge: string
  method: 'S256'
}

/** Generate a PKCE verifier/challenge pair (RFC 7636, S256). */
export async function generatePkce(): Promise<PkcePair> {
  const verifier = randomToken(VERIFIER_BYTES)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64url(new Uint8Array(digest)), method: 'S256' }
}

/** A random CSRF `state` value for the authorization request. */
export function generateState(): string {
  return randomToken(VERIFIER_BYTES)
}

export interface AuthorizationRequest {
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string
  /** Space-delimited scopes, if the server expects any. */
  scope?: string
}

/** Build the authorization URL the user's browser is sent to. */
export function buildAuthorizationUrl(
  endpoints: OAuthEndpoints,
  request: AuthorizationRequest
): string {
  const url = new URL(endpoints.authorizationEndpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', request.clientId)
  url.searchParams.set('redirect_uri', request.redirectUri)
  url.searchParams.set('code_challenge', request.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', request.state)
  if (request.scope !== undefined) url.searchParams.set('scope', request.scope)
  return url.toString()
}

/**
 * Parse the loopback redirect. Verifies the returned `state` matches what we
 * sent (CSRF defence) and surfaces an OAuth `error` param honestly. Returns the
 * authorization code on success.
 */
export function parseCallback(
  callbackUrl: string,
  expectedState: string
): { code: string } | { error: string } {
  let params: URLSearchParams
  try {
    params = new URL(callbackUrl).searchParams
  } catch {
    return { error: 'Malformed callback URL' }
  }
  const error = params.get('error')
  if (error !== null) return { error: params.get('error_description') ?? error }
  if (params.get('state') !== expectedState) return { error: 'State mismatch — possible CSRF' }
  const code = params.get('code')
  if (code === null || code.length === 0) return { error: 'No authorization code in callback' }
  return { code }
}

export interface TokenSet {
  accessToken: string
  refreshToken?: string
  /** Absolute expiry as epoch ms, computed from `expires_in` when provided. */
  expiresAt?: number
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

/** Map a token-endpoint response to our `TokenSet`, given a clock (`nowMs`) so
 *  expiry is deterministic in tests. */
function toTokenSet(body: TokenResponse, nowMs: number): TokenSet {
  if (body.access_token === undefined || body.access_token.length === 0) {
    throw new Error(body.error_description ?? body.error ?? 'Token response had no access_token')
  }
  return {
    accessToken: body.access_token,
    ...(body.refresh_token !== undefined ? { refreshToken: body.refresh_token } : {}),
    ...(body.expires_in !== undefined ? { expiresAt: nowMs + body.expires_in * 1000 } : {}),
  }
}

export interface OAuthHttp {
  fetch: typeof fetch
  /** Injected clock (epoch ms) so token expiry is deterministic. */
  nowMs: number
}

async function postForm(
  http: OAuthHttp,
  url: string,
  form: Record<string, string>
): Promise<Response> {
  return http.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(form).toString(),
  })
}

async function jsonBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

/**
 * RFC 7591 dynamic client registration. Registers a public native client for the
 * loopback redirect and returns the issued `client_id`.
 */
export async function registerClient(
  endpoints: OAuthEndpoints,
  redirectUri: string,
  http: OAuthHttp
): Promise<{ clientId: string }> {
  try {
    const response = await http.fetch(endpoints.registrationEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_name: 'beeper-tui',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none', // public client (PKCE), no secret
        application_type: 'native',
      }),
    })
    const body = await jsonBody<{ client_id?: string; error_description?: string; error?: string }>(
      response
    )
    if (body.client_id === undefined || body.client_id.length === 0) {
      throw new Error(body.error_description ?? body.error ?? 'Registration returned no client_id')
    }
    return { clientId: body.client_id }
  } catch (err) {
    throw normalizeError(err)
  }
}

/** Exchange an authorization code for tokens (with the PKCE verifier). */
export async function exchangeCode(
  endpoints: OAuthEndpoints,
  params: { clientId: string; code: string; codeVerifier: string; redirectUri: string },
  http: OAuthHttp
): Promise<TokenSet> {
  try {
    const response = await postForm(http, endpoints.tokenEndpoint, {
      grant_type: 'authorization_code',
      code: params.code,
      client_id: params.clientId,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
    })
    return toTokenSet(await jsonBody<TokenResponse>(response), http.nowMs)
  } catch (err) {
    throw normalizeError(err)
  }
}

/** Refresh an access token using a refresh token. */
export async function refreshTokens(
  endpoints: OAuthEndpoints,
  params: { clientId: string; refreshToken: string },
  http: OAuthHttp
): Promise<TokenSet> {
  try {
    const response = await postForm(http, endpoints.tokenEndpoint, {
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
      client_id: params.clientId,
    })
    const set = toTokenSet(await jsonBody<TokenResponse>(response), http.nowMs)
    // Some servers omit a rotated refresh token on refresh — keep the old one.
    return set.refreshToken !== undefined ? set : { ...set, refreshToken: params.refreshToken }
  } catch (err) {
    throw normalizeError(err)
  }
}

/** Revoke a token (logout). Best-effort — a revoke failure is non-fatal. */
export async function revokeToken(
  endpoints: OAuthEndpoints,
  params: { clientId: string; token: string },
  http: OAuthHttp
): Promise<void> {
  try {
    await postForm(http, endpoints.revocationEndpoint, {
      token: params.token,
      client_id: params.clientId,
    })
  } catch (err) {
    throw normalizeError(err)
  }
}

/** Is this token set expired (or within `skewMs` of expiry) at `nowMs`? A set
 *  with no expiry is treated as non-expiring. */
export function isExpired(tokens: TokenSet, nowMs: number, skewMs = 30_000): boolean {
  return tokens.expiresAt !== undefined && nowMs >= tokens.expiresAt - skewMs
}

/** A running loopback redirect receiver. `redirectUri` is registered with the
 *  server; `awaitCallback` resolves with the full callback URL the browser hits;
 *  `close` tears down the listener. The real implementation (Bun.serve on an
 *  ephemeral port) lives at the launch layer; the orchestrator takes it injected
 *  so the whole flow is unit-testable with no sockets. */
export interface LoopbackReceiver {
  redirectUri: string
  awaitCallback(): Promise<string>
  close(): void
}

export interface AuthorizeDeps {
  http: OAuthHttp
  /** Start the loopback receiver (opens a port, returns its redirect URI). */
  startLoopback(): Promise<LoopbackReceiver>
  /** Open the user's browser at the authorization URL. */
  openBrowser(url: string): Promise<void>
  scope?: string
}

/**
 * Drive the full Authorization Code + PKCE flow and return the registered
 * `clientId` plus the tokens: register the client → generate PKCE + state → open
 * the browser at the authorization URL → receive the loopback callback → verify
 * state → exchange the code. The `clientId` is returned so the caller can persist
 * it for later refresh/revoke. The receiver is always torn down; secrets
 * (verifier, tokens) never touch a log or the returned error text.
 */
export async function authorize(
  endpoints: OAuthEndpoints,
  deps: AuthorizeDeps
): Promise<{ clientId: string; tokens: TokenSet }> {
  const receiver = await deps.startLoopback()
  try {
    const { clientId } = await registerClient(endpoints, receiver.redirectUri, deps.http)
    const pkce = await generatePkce()
    const state = generateState()
    const authUrl = buildAuthorizationUrl(endpoints, {
      clientId,
      redirectUri: receiver.redirectUri,
      codeChallenge: pkce.challenge,
      state,
      ...(deps.scope !== undefined ? { scope: deps.scope } : {}),
    })
    await deps.openBrowser(authUrl)
    const callbackUrl = await receiver.awaitCallback()
    const parsed = parseCallback(callbackUrl, state)
    if ('error' in parsed) throw new Error(`Authorization failed: ${parsed.error}`)
    const tokens = await exchangeCode(
      endpoints,
      {
        clientId,
        code: parsed.code,
        codeVerifier: pkce.verifier,
        redirectUri: receiver.redirectUri,
      },
      deps.http
    )
    return { clientId, tokens }
  } finally {
    receiver.close()
  }
}
