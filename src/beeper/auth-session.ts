import {
  authorize,
  isExpired,
  refreshTokens,
  revokeToken,
  type AuthorizeDeps,
  type OAuthHttp,
} from '@/beeper/oauth.ts'
import {
  bunSecrets,
  clearAuth,
  loadAuth,
  saveAuth,
  type SecretStore,
  type StoredAuth,
} from '@/beeper/token-store.ts'
import type { OAuthEndpoints, ServerInfo } from '@/beeper/types.ts'
import { resolveToken } from '@/beeper/keychain.ts'

/**
 * The OAuth session lifecycle (Slice 13): tie the PKCE flow (`oauth.ts`) to
 * persistent storage (`token-store.ts`). Pure orchestration with injected deps
 * (secret store, HTTP + clock, `getInfo`) so login/logout/refresh/resolution are
 * unit-tested without a live endpoint or the real keychain.
 */

/** Run the interactive login and persist the resulting session. */
export async function login(
  endpoints: OAuthEndpoints,
  deps: AuthorizeDeps,
  store: SecretStore = bunSecrets
): Promise<StoredAuth> {
  const { clientId, tokens } = await authorize(endpoints, deps)
  const auth: StoredAuth = { clientId, tokens }
  await saveAuth(auth, store)
  return auth
}

/** Log out: revoke the token (best-effort) then clear the stored session. */
export async function logout(
  endpoints: OAuthEndpoints,
  http: OAuthHttp,
  store: SecretStore = bunSecrets
): Promise<void> {
  const auth = await loadAuth(store)
  if (auth !== null) {
    try {
      await revokeToken(
        endpoints,
        { clientId: auth.clientId, token: auth.tokens.accessToken },
        http
      )
    } catch {
      // Revoke is best-effort — a network failure must not block local logout.
    }
  }
  await clearAuth(store)
}

/**
 * The current access token from the stored session, refreshing it first if it's
 * expired and a refresh token is available (the new tokens are persisted).
 * Returns null when there's no stored session. A failed refresh returns the
 * stale token — the API surfaces a 401 honestly rather than us guessing.
 */
export async function currentAccessToken(
  endpoints: OAuthEndpoints,
  http: OAuthHttp,
  store: SecretStore = bunSecrets
): Promise<string | null> {
  const auth = await loadAuth(store)
  if (auth === null) return null
  if (!isExpired(auth.tokens, http.nowMs) || auth.tokens.refreshToken === undefined) {
    return auth.tokens.accessToken
  }
  try {
    const tokens = await refreshTokens(
      endpoints,
      { clientId: auth.clientId, refreshToken: auth.tokens.refreshToken },
      http
    )
    await saveAuth({ clientId: auth.clientId, tokens }, store)
    return tokens.accessToken
  } catch {
    return auth.tokens.accessToken
  }
}

export interface TokenResolveDeps {
  /** Fetch server info (for the OAuth endpoints) — injected so this is testable. */
  getInfo: () => Promise<ServerInfo>
  http: OAuthHttp
  store?: SecretStore
  /** Env/legacy resolver override (tests). Defaults to the keychain module. */
  direct?: () => string | undefined
}

/**
 * Resolve the access token the app should use. Precedence: an explicit
 * env/legacy-keychain token first (fast, works offline), then a stored OAuth
 * session (which may refresh). Returns undefined when nothing is available — the
 * app then shows an honest unauthorized state.
 */
export async function resolveActiveToken(deps: TokenResolveDeps): Promise<string | undefined> {
  const direct = (deps.direct ?? resolveToken)()
  if (direct !== undefined) return direct
  try {
    const info = await deps.getInfo()
    const token = await currentAccessToken(info.oauth, deps.http, deps.store)
    return token ?? undefined
  } catch {
    // Offline / no OAuth session — no token; the UI degrades visibly.
    return undefined
  }
}
